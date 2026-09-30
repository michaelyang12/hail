import { normalize } from "../normalize";
import { MIN_SCORE, score, TIE } from "../score";
import { COMPASS_WORDS } from "../directions";
import type { BusData, BusDir, BusRoute } from "./data";
import type { BusVariant } from "./parse";

// Bus stops are one-directional, so the same corner is usually two stops with
// different names ("1 Av/E 23 St" northbound, "2 Av/E 23 St" southbound). The
// other direction is kept when it scores within this much of the best.
const DIR_TIE = 0.1;
// An explicit direction that resolved is worth this much over the plain reading,
// so "M15 south 1st av 23" stays southbound (2 Av/E 22 St) instead of ignoring "south".
const DIR_BONUS = 0.1;

// Too common in headsigns and stop names to pick a direction on their own.
const WEAK = new Set(["st", "av", "rd", "blvd", "via", "and", "the", "sq", "pl", "ctr", "center", "station", "terminal", "term"]);

export type StopHit = { dir: BusDir; stopId: string; name: string };
export type BusMatch = { hits: StopHit[]; also: string[]; score: number };

// A direction word resolves to one direction, or null if it isn't one.
export function resolveDir(route: BusRoute, word: string): BusDir | null {
  const w = word.toLowerCase();
  const c = COMPASS_WORDS[w];
  if (c) return route.dirs.find((d) => d.compass === c) ?? null;
  if (w.length < 3 || !/^[a-z]+$/.test(w) || WEAK.has(w)) return null;
  const hits = route.dirs.filter((d) => d.headsigns.some((h) => normalize(h).some((t) => t.startsWith(w))));
  return hits.length === 1 ? hits[0]! : null;
}

function bestIn(query: string[], dir: BusDir, stops: Record<string, string>) {
  return dir.stops
    .map((stopId) => ({ stopId, name: stops[stopId]!, score: score(query, normalize(stops[stopId]!), true) }))
    .sort((a, b) => b.score - a.score);
}

function matchVariant(data: BusData, route: BusRoute, v: BusVariant): BusMatch | null {
  let dirs = route.dirs;
  if (v.dirWord) {
    const d = resolveDir(route, v.dirWord);
    if (!d) return null;
    dirs = [d];
  }
  const query = normalize(v.stopText);
  const ranked = dirs.map((dir) => ({ dir, ranked: bestIn(query, dir, data.stops) }));
  const topScore = Math.max(...ranked.map((r) => r.ranked[0]?.score ?? 0));
  if (topScore < MIN_SCORE) return null;

  const hits: StopHit[] = [];
  const also = new Set<string>();
  for (const { dir, ranked: rs } of ranked) {
    const best = rs[0];
    if (!best || best.score < MIN_SCORE || topScore - best.score > DIR_TIE) continue;
    hits.push({ dir, stopId: best.stopId, name: best.name });
    rs.slice(1)
      .filter((r) => best.score - r.score <= TIE && r.name !== best.name)
      .forEach((r) => also.add(r.name));
  }
  for (const h of hits) also.delete(h.name);
  return { hits, also: [...also].slice(0, 3), score: topScore };
}

// Variants are ordered direction-first, so a tie keeps the direction reading.
export function findBusStop(data: BusData, route: BusRoute, variants: BusVariant[]): BusMatch | null {
  let best: { m: BusMatch; rank: number } | null = null;
  for (const v of variants) {
    // Single letters only count right after the route, as in the subway parser.
    if (v.dirWord && v.dirWord.length === 1 && v !== variants[0]) continue;
    const m = matchVariant(data, route, v);
    const rank = m ? m.score + (v.dirWord ? DIR_BONUS : 0) : 0;
    if (m && (!best || rank > best.rank)) best = { m, rank };
  }
  return best?.m ?? null;
}
