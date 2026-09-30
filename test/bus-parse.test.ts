import { expect, test } from "bun:test";
import { parseBus, routeKey } from "../src/bus/parse";

const known = (k: string) => ["M15", "M15+", "BX12+", "B44", "B44+"].includes(k);

test("route keys", () => {
  expect(routeKey("M15")).toBe("M15");
  expect(routeKey("m15+")).toBe("M15+");
  expect(routeKey("M15-SBS")).toBe("M15+");
  expect(routeKey("Bx12-sbs")).toBe("BX12+");
});

test("SBS spelled several ways", () => {
  for (const q of ["M15+ 23", "M15-SBS 23", "m15 sbs 23", "M15 select bus 23", "M15 + 23"]) {
    const p = parseBus(q, known);
    expect(p.ok && p.route).toBe("M15+");
  }
});

test("direction candidates first and last, plain reading kept", () => {
  const p = parseBus("M15 south 1st av 23", known);
  if (!p.ok) throw new Error(p.message);
  expect(p.variants).toEqual([
    { dirWord: "south", stopText: "1st av 23" },
    { dirWord: "23", stopText: "south 1st av" },
    { dirWord: null, stopText: "south 1st av 23" },
  ]);
});

test("one word after the route is always the stop", () => {
  const p = parseBus("M15 23rd", known);
  expect(p.ok && p.variants).toEqual([{ dirWord: null, stopText: "23rd" }]);
});

test("plain number falls back to an SBS-only route", () => {
  const p = parseBus("BX12 fordham", known);
  expect(p.ok && p.route).toBe("BX12+");
  const local = parseBus("M15 23", known);
  expect(local.ok && local.route).toBe("M15");
});

test("errors carry the slot", () => {
  expect(parseBus("M999 23", known)).toEqual({ ok: false, slot: "line", message: 'route "M999" not found' });
  expect(parseBus("BM1 wall st", known)).toEqual({ ok: false, slot: "line", message: "express buses aren't supported yet" });
  expect(parseBus("M15", known)).toEqual({ ok: false, slot: "stop", message: "missing stop" });
  expect(parseBus("M15 sbs", known)).toEqual({ ok: false, slot: "stop", message: "missing stop" });
});
