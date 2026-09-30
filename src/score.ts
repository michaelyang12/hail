export const MIN_SCORE = 0.5;
export const TIE = 0.02;

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

// Numbers must match exactly so "14" never lands on "145 St". With `near`, a
// street a block or two away scores low but nonzero: bus stops alternate streets
// by direction, so "23" should still find "E 22 St" when that's all there is.
function tokenScore(q: string, s: string, near: boolean): number {
  if (q === s) return 1;
  if (isNumeric(q) && isNumeric(s)) {
    const d = Math.abs(Number(q) - Number(s));
    return near && d <= 2 ? 0.7 - 0.1 * d : 0;
  }
  if (isNumeric(q) || isNumeric(s)) return 0;
  if (q.length >= 2 && s.startsWith(q)) return 0.85;
  const maxEdits = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (maxEdits && levenshtein(q, s) <= maxEdits) return 0.7;
  return 0;
}

// Mostly recall (how much of the query matched), with a little precision so that
// "14 st" prefers "14 St" over "14 St-Union Sq".
export function score(query: string[], station: string[], near = false): number {
  if (query.length === 0 || station.length === 0) return 0;
  const used = new Set<number>();
  let sum = 0;
  for (const q of query) {
    let best = 0;
    let bestIdx = -1;
    station.forEach((s, i) => {
      const v = tokenScore(q, s, near);
      if (v > best) (best = v), (bestIdx = i);
    });
    sum += best;
    if (bestIdx >= 0) used.add(bestIdx);
  }
  return 0.8 * (sum / query.length) + 0.2 * (used.size / station.length);
}

