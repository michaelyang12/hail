import type { BusAnswer, BusGroup, ErrorAnswer } from "../render";
import { busData, type BusData } from "./data";
import { BusFeedError, getBusArrivals, type BusFeedResult } from "./feed";
import { findBusStop } from "./match";
import { parseBus } from "./parse";

export const TIMEOUT_MS = 3000;
const PER_DIR = 2;

type Impl = (q: string) => Promise<BusAnswer | ErrorAnswer>;
export type BusDeps = {
  data: () => Promise<BusData>;
  arrivals: (stopId: string, refs: string[]) => Promise<BusFeedResult>;
};
const live: BusDeps = { data: busData, arrivals: (stopId, refs) => getBusArrivals(stopId, refs) };

export async function lookup(q: string, deps: BusDeps = live): Promise<BusAnswer | ErrorAnswer> {
  const data = await deps.data();
  const p = parseBus(q, (k) => k in data.routes);
  if (!p.ok) return { kind: "error", slot: p.slot, message: p.message };
  const route = data.routes[p.route]!;

  const m = findBusStop(data, route, p.variants);
  if (!m) {
    const text = p.variants[p.variants.length - 1]!.stopText;
    return { kind: "error", slot: "stop", message: `no ${route.name} stop like "${text}"` };
  }

  let feeds: BusFeedResult[];
  try {
    feeds = await Promise.all(m.hits.map((h) => deps.arrivals(h.stopId, route.refs)));
  } catch (e) {
    if (e instanceof BusFeedError) return { kind: "error", slot: null, message: e.message };
    throw e;
  }

  const groups: BusGroup[] = m.hits.map((h, i) => ({
    dir: h.dir.compass,
    label: h.dir.headsigns[0] ?? `Direction ${h.dir.id}`,
    stop: h.name,
    // A stop served in both directions (loops, terminals) lists both; keep the one asked for.
    arrivals: feeds[i]!.arrivals.filter((a) => a.dir === null || a.dir === h.dir.id).slice(0, PER_DIR),
  }));
  return {
    kind: "bus",
    route: { key: p.route, name: route.name, color: route.color, text: route.text },
    groups,
    also: m.also,
    ageSecs: Math.max(...feeds.map((f) => f.ageSecs)),
  };
}

// Never throws and never takes longer than timeoutMs: every failure becomes an
// error answer, so a broken bus module can't take subway queries down with it.
export async function busAnswer(q: string, impl: Impl = (q) => lookup(q), timeoutMs = TIMEOUT_MS): Promise<BusAnswer | ErrorAnswer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ErrorAnswer>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "error", slot: null, message: "bus data timed out, try again" }), timeoutMs);
  });
  try {
    return await Promise.race([impl(q), timeout]);
  } catch (e) {
    console.error("bus:", e);
    return { kind: "error", slot: null, message: "bus data unavailable, try again" };
  } finally {
    clearTimeout(timer);
  }
}
