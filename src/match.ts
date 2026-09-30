import { normalize } from "./normalize";
import { MIN_SCORE, score, TIE } from "./score";
import { stations, stationsOnLine, type Station } from "./stations";

export { MIN_SCORE, score };

export type StopMatch = { station: Station; score: number; also: Station[] };

function bestOf(query: string[], candidates: Station[]): StopMatch | null {
  const ranked = candidates
    .map((station) => ({ station, score: score(query, station.tokens) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < MIN_SCORE) return null;
  const also = ranked
    .slice(1)
    .filter((r) => top.score - r.score <= TIE && r.station.name !== top.station.name)
    .slice(0, 3)
    .map((r) => r.station);
  return { station: top.station, score: top.score, also };
}

// Falls back to every station so night-only stops (not in Daytime Routes) still resolve.
export function findStop(line: string, stopText: string): StopMatch | null {
  const query = normalize(stopText);
  return bestOf(query, stationsOnLine(line)) ?? bestOf(query, stations);
}
