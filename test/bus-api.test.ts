import { expect, test } from "bun:test";
import { busAnswer } from "../src/bus/api";

const quiet = () => {
  const orig = console.error;
  console.error = () => {};
  return () => (console.error = orig);
};

test("missing API key is an error answer, not a crash", async () => {
  const key = process.env.BUSTIME_API_KEY;
  delete process.env.BUSTIME_API_KEY;
  expect(await busAnswer("M15 23rd")).toEqual({ kind: "error", slot: null, message: "bus arrivals aren't set up (BUSTIME_API_KEY missing)" });
  process.env.BUSTIME_API_KEY = key;
});

test("a throwing implementation becomes an error answer", async () => {
  const restore = quiet();
  const a = await busAnswer("M15 23rd", async () => {
    throw new Error("boom");
  });
  restore();
  expect(a).toEqual({ kind: "error", slot: null, message: "bus data unavailable, try again" });
});

test("a hanging implementation times out", async () => {
  const start = performance.now();
  const a = await busAnswer("M15 23rd", () => new Promise(() => {}), 50);
  expect(a).toEqual({ kind: "error", slot: null, message: "bus data timed out, try again" });
  expect(performance.now() - start).toBeLessThan(500);
});
