import { expect, test } from "bun:test";
import { parse } from "../src/parse";

test("line, direction in DIR slot, stop", () => {
  const p = parse("A downtown 14th st");
  expect(p).toEqual({
    ok: true,
    line: "A",
    variants: [
      { dir: { dir: "S" }, stopText: "14th st" },
      { dir: null, stopText: "downtown 14th st" },
    ],
  });
});

test("direction as the final word", () => {
  const p = parse("a 14th st uptown");
  expect(p.ok && p.line).toBe("A");
  expect(p.ok && p.variants[0]).toEqual({ dir: { dir: "N" }, stopText: "14th st" });
});

test("no direction", () => {
  expect(parse("A 14th st")).toEqual({ ok: true, line: "A", variants: [{ dir: null, stopText: "14th st" }] });
});

test("borough word is kept as an alternative stop reading", () => {
  const p = parse("E queens plaza");
  expect(p.ok && p.variants).toEqual([
    { dir: { borough: "queens" }, stopText: "plaza" },
    { dir: null, stopText: "queens plaza" },
  ]);
});

test("single-letter direction only right after the line", () => {
  expect(parse("F av n")).toEqual({ ok: true, line: "F", variants: [{ dir: null, stopText: "av n" }] });
  const p = parse("N n times sq");
  expect(p.ok && p.variants[0]).toEqual({ dir: { dir: "N" }, stopText: "times sq" });
});

test("direction word alone is not consumed when it would leave no stop", () => {
  expect(parse("A downtown")).toEqual({ ok: true, line: "A", variants: [{ dir: null, stopText: "downtown" }] });
});

test("line aliases", () => {
  expect(parse("6x 51 st").ok && (parse("6x 51 st") as any).line).toBe("6");
  expect((parse("si st george") as any).line).toBe("SIR");
  expect((parse("sir st george") as any).line).toBe("SIR");
});

test("errors point at the failing slot", () => {
  expect(parse("X 14")).toEqual({ ok: false, slot: "line", message: 'line "X" not found' });
  expect(parse("A")).toEqual({ ok: false, slot: "stop", message: "missing stop" });
  expect(parse("   ")).toEqual({ ok: false, slot: "line", message: "missing line" });
});
