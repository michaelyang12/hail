import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { Dir } from "./parse";

type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type Arrival = { dir: Dir; route: string; secs: number };
export type FeedResult = { arrivals: Arrival[]; ageSecs: number };

export class FeedError extends Error {}

const BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F";
const CACHE_TTL = 20;
const TIMEOUT_MS = 3000;

const FEED_BY_LINE: Record<string, string[]> = {
  A: ["gtfs-ace"], C: ["gtfs-ace"], E: ["gtfs-ace"],
  B: ["gtfs-bdfm"], D: ["gtfs-bdfm"], F: ["gtfs-bdfm"], M: ["gtfs-bdfm"],
  G: ["gtfs-g"],
  J: ["gtfs-jz"], Z: ["gtfs-jz"],
  N: ["gtfs-nqrw"], Q: ["gtfs-nqrw"], R: ["gtfs-nqrw"], W: ["gtfs-nqrw"],
  L: ["gtfs-l"],
  "1": ["gtfs"], "2": ["gtfs"], "3": ["gtfs"], "4": ["gtfs"], "5": ["gtfs"], "6": ["gtfs"], "7": ["gtfs"],
  SIR: ["gtfs-si"],
  // The three shuttles (42 St, Franklin Av, Rockaway Park) live in different feeds.
  S: ["gtfs", "gtfs-bdfm", "gtfs-ace"],
};

const ROUTE_IDS: Record<string, string[]> = {
  S: ["GS", "FS", "H"],
  SIR: ["SI", "SS"],
  "6": ["6", "6X"],
  "7": ["7", "7X"],
  F: ["F", "FX"],
};

export const feedsFor = (line: string): string[] => FEED_BY_LINE[line] ?? [];
export const routeIdsFor = (line: string): Set<string> => new Set(ROUTE_IDS[line] ?? [line]);

export function decode(buf: Uint8Array): FeedMessage {
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
}

export function extractArrivals(msg: FeedMessage, routeIds: Set<string>, stopId: string, now: number): Arrival[] {
  const out: Arrival[] = [];
  for (const e of msg.entity) {
    const tu = e.tripUpdate;
    const route = tu?.trip.routeId;
    if (!tu || !route || !routeIds.has(route)) continue;
    for (const st of tu.stopTimeUpdate ?? []) {
      const id = st.stopId ?? "";
      const dir = id.slice(-1);
      if (id.length !== stopId.length + 1 || !id.startsWith(stopId) || (dir !== "N" && dir !== "S")) continue;
      const time = Number(st.arrival?.time ?? st.departure?.time ?? 0);
      if (!time) continue;
      const secs = time - now;
      if (secs >= -30) out.push({ dir, route, secs });
    }
  }
  return out.sort((a, b) => a.secs - b.secs);
}

// Filled only while serving a request; entries just expire, nothing refreshes them.
const cache = new Map<string, { at: number; msg: Promise<FeedMessage> }>();

async function fetchFeed(path: string, fetcher: Fetcher): Promise<FeedMessage> {
  let res: Response;
  try {
    res = await fetcher(BASE + path, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new FeedError("MTA feed unavailable, try again");
  }
  if (!res.ok) throw new FeedError("MTA feed unavailable, try again");
  return decode(new Uint8Array(await res.arrayBuffer()));
}

function getFeed(path: string, now: number, fetcher: Fetcher): Promise<FeedMessage> {
  const hit = cache.get(path);
  if (hit && now - hit.at < CACHE_TTL) return hit.msg;
  const msg = fetchFeed(path, fetcher);
  cache.set(path, { at: now, msg });
  msg.catch(() => cache.delete(path));
  return msg;
}

export async function getArrivals(
  line: string,
  stopId: string,
  now = Date.now() / 1000,
  fetcher: Fetcher = fetch,
): Promise<FeedResult> {
  const msgs = await Promise.all(feedsFor(line).map((p) => getFeed(p, now, fetcher)));
  const routeIds = routeIdsFor(line);
  const arrivals = msgs.flatMap((m) => extractArrivals(m, routeIds, stopId, now)).sort((a, b) => a.secs - b.secs);
  const oldest = Math.min(...msgs.map((m) => Number(m.header.timestamp)));
  return { arrivals, ageSecs: Math.max(0, Math.round(now - oldest)) };
}
