import type { Failure } from "../model";

export type BusVariant = { dirWord: string | null; stopText: string };
export type BusParsed = { ok: true; route: string; variants: BusVariant[] } | Failure;

const EXPRESS = /^(BM|BXM|QM|SIM|X)\d/;
const SBS_WORDS = new Set(["sbs", "+", "select"]);

// "B44-SBS" -> "B44+", "Bx12" -> "BX12": the key bus.json routes are stored under.
export const routeKey = (name: string) => name.toUpperCase().replace(/[-\s]?SBS$/, "+");

// Same slots as the subway parser: ROUTE [DIR] STOP, or ROUTE STOP [DIR]. DIR is
// resolved later against the route (compass or headsign word), so every word in
// those slots is a candidate and the plain reading is always kept.
export function parseBus(q: string, known: (key: string) => boolean): BusParsed {
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { ok: false, slot: "line", message: "missing route" };

  let raw = words[0]!;
  let rest = words.slice(1);
  if (rest[0] && SBS_WORDS.has(rest[0].toLowerCase()) && !raw.endsWith("+")) {
    raw += "+";
    rest = rest.slice(rest[0].toLowerCase() === "select" && rest[1]?.toLowerCase() === "bus" ? 2 : 1);
  }
  let route = routeKey(raw);
  if (EXPRESS.test(route)) return { ok: false, slot: "line", message: "express buses aren't supported yet" };
  // Some routes (M23, M34) run only as SBS, but riders still call them by the plain number.
  if (!known(route) && known(route + "+")) route += "+";
  if (!known(route)) return { ok: false, slot: "line", message: `route "${raw}" not found` };
  if (rest.length === 0) return { ok: false, slot: "stop", message: "missing stop" };

  const plain: BusVariant = { dirWord: null, stopText: rest.join(" ") };
  if (rest.length < 2) return { ok: true, route, variants: [plain] };
  return {
    ok: true,
    route,
    variants: [
      { dirWord: rest[0]!, stopText: rest.slice(1).join(" ") },
      { dirWord: rest[rest.length - 1]!, stopText: rest.slice(0, -1).join(" ") },
      plain,
    ],
  };
}
