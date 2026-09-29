import { normalize } from "./normalize";
import { stations, stationsOnLine, type Station } from "./stations";

export const MIN_SCORE = 0.5;
const TIE = 0.02;

export type StopMatch = { station: Station; score: number; also: Station[] };

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

const isNumeric = (t: string) => /^\d+$/.test(t);

// Numbers must match exactly so "14" never lands on "145 St".
function tokenScore(q: string, s: string): number {
  if (q === s) return 1;
  if (isNumeric(q) || isNumeric(s)) return 0;
  if (q.length >= 2 && s.startsWith(q)) return 0.85;
  const maxEdits = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (maxEdits && levenshtein(q, s) <= maxEdits) return 0.7;
  return 0;
}

// Mostly recall (how much of the query matched), with a little precision so that
// "14 st" prefers "14 St" over "14 St-Union Sq".
export function score(query: string[], station: string[]): number {
  if (query.length === 0 || station.length === 0) return 0;
  const used = new Set<number>();
  let sum = 0;
  for (const q of query) {
    let best = 0;
    let bestIdx = -1;
    station.forEach((s, i) => {
      const v = tokenScore(q, s);
      if (v > best) (best = v), (bestIdx = i);
    });
    sum += best;
    if (bestIdx >= 0) used.add(bestIdx);
  }
  return 0.8 * (sum / query.length) + 0.2 * (used.size / station.length);
}

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
