import { BOROUGHS, COMPASS_WORDS, type Dir } from "./directions";
import { LINE_ALIASES } from "./lines";
import type { Failure } from "./model";
import { knownLines } from "./stations";

export type DirWord = { dir: Dir } | { borough: string };
export type Variant = { dir: DirWord | null; stopText: string };
export type Parsed = { ok: true; line: string; variants: Variant[] } | Failure;

function dirWord(word: string, allowSingleLetter: boolean): DirWord | null {
  const w = word.toLowerCase();
  if (w.length === 1 && !allowSingleLetter) return null;
  const c = COMPASS_WORDS[w];
  if (c === "N" || c === "S") return { dir: c };
  if (BOROUGHS.has(w)) return { borough: w };
  return null;
}

function resolveLine(raw: string): string | null {
  const t = raw.toUpperCase();
  const name = LINE_ALIASES[t] ?? t;
  if (knownLines.has(name)) return name;
  if (t.endsWith("X") && knownLines.has(t.slice(0, -1))) return t.slice(0, -1);
  return null;
}

// Direction is looked for in the DIR slot (right after the line) or as the last
// word. Because words like "queens" or "bronx" also appear in stop names, a
// reading without the direction is always kept so the matcher can pick the better one.
export function parse(q: string): Parsed {
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { ok: false, slot: "line", message: "missing line" };

  const line = resolveLine(words[0]!);
  if (!line) return { ok: false, slot: "line", message: `line "${words[0]}" not found` };

  const rest = words.slice(1);
  if (rest.length === 0) return { ok: false, slot: "stop", message: "missing stop" };

  const plain: Variant = { dir: null, stopText: rest.join(" ") };
  if (rest.length < 2) return { ok: true, line, variants: [plain] };

  const first = dirWord(rest[0]!, true);
  if (first) return { ok: true, line, variants: [{ dir: first, stopText: rest.slice(1).join(" ") }, plain] };

  const last = dirWord(rest[rest.length - 1]!, false);
  if (last) return { ok: true, line, variants: [{ dir: last, stopText: rest.slice(0, -1).join(" ") }, plain] };

  return { ok: true, line, variants: [plain] };
}
