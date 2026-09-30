import { PER_DIR } from "./config";
import type { Dir } from "./directions";
import { orFeedError } from "./errors";
import { getArrivals as liveArrivals, type FeedResult } from "./feed";
import { findStop, type StopMatch } from "./match";
import { errorAnswer, noStop, type ErrorAnswer, type SubwayAnswer } from "./model";
import { parse, type DirWord, type Variant } from "./parse";
import type { Station } from "./stations";

type Deps = { getArrivals: (line: string, stopId: string) => Promise<FeedResult> };

function directions(dir: DirWord | null, station: Station): Dir[] {
  if (!dir) return ["N", "S"];
  if ("dir" in dir) return [dir.dir];
  if (station.northLabel.toLowerCase().includes(dir.borough)) return ["N"];
  if (station.southLabel.toLowerCase().includes(dir.borough)) return ["S"];
  return ["N", "S"];
}

function label(station: Station, dir: Dir): string {
  const l = dir === "N" ? station.northLabel : station.southLabel;
  return l && l !== "NaN" ? l : dir === "N" ? "Northbound" : "Southbound";
}

export async function answer(q: string, deps: Deps = { getArrivals: liveArrivals }): Promise<SubwayAnswer | ErrorAnswer> {
  const p = parse(q);
  if (!p.ok) return errorAnswer(p.slot, p.message);

  // Variants are ordered direction-first, so a tie keeps the direction reading.
  let best: { v: Variant; m: StopMatch } | null = null;
  for (const v of p.variants) {
    const m = findStop(p.line, v.stopText);
    if (m && (!best || m.score > best.m.score)) best = { v, m };
  }
  if (!best) {
    const text = p.variants[p.variants.length - 1]!.stopText;
    return noStop(p.line, text);
  }

  const { station, also } = best.m;
  const feed = await orFeedError(deps.getArrivals(p.line, station.stopId));
  if ("kind" in feed) return feed;

  const dirs = directions(best.v.dir, station);
  const groups = dirs
    .map((dir) => ({
      dir,
      label: label(station, dir),
      arrivals: feed.arrivals.filter((a) => a.dir === dir).slice(0, PER_DIR),
      running: feed.running.includes(dir),
    }))
    // At a terminal the "Last Stop" side only lists trains ending their run; hide it unless asked for.
    .filter((g) => dirs.length === 1 || g.label !== "Last Stop");

  return { kind: "subway", line: p.line, station, also, groups, ageSecs: feed.ageSecs };
}
