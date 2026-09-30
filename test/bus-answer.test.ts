import { expect, test } from "bun:test";
import { lookup, type BusDeps } from "../src/bus/api";
import { busData } from "../src/bus/data";
import { extractBusArrivals } from "../src/bus/feed";
import { FeedError } from "../src/errors";

const fixture = await Bun.file(new URL("./fixtures/siri-m15.json", import.meta.url)).json();
const now = Date.parse("2026-09-29T08:30:10.000-04:00") / 1000;

const calls: string[] = [];
const deps: BusDeps = {
  data: busData,
  arrivals: async (stopId, refs) => (calls.push(stopId), extractBusArrivals(fixture, new Set(refs), now)),
};

test("direction given: one group with the headsign and the stop", async () => {
  const a = await lookup("M15 south 23rd", deps);
  if (a.kind !== "bus") throw new Error(a.message);
  expect(a.route).toEqual({ key: "M15", name: "M15", color: "006CB7", text: "FFFFFF" });
  expect(a.groups.map((g) => [g.dir, g.label, g.stop])).toEqual([["S", "South Ferry", "2 Av/E 22 St"]]);
  expect(a.groups[0]!.arrivals.map((b) => b.secs)).toEqual([10, 360]);
  expect(a.ageSecs).toBe(5);
});

test("same corner both ways: one request per stop id", async () => {
  calls.length = 0;
  const a = await lookup("M14A+ 14th 8 av", { ...deps, arrivals: async (id) => (calls.push(id), { arrivals: [], ageSecs: 0 }) });
  expect(a.kind === "bus" && a.groups.map((g) => g.dir)).toEqual(["E", "W"]);
  expect(calls).toHaveLength(2);
  expect(new Set(calls).size).toBe(2);
});

test("arrivals for the other direction at a shared stop are dropped", async () => {
  const a = await lookup("M15 harlem 1st av 23", deps); // fixture buses are all direction 1
  expect(a.kind === "bus" && a.groups[0]!.arrivals).toEqual([]);
});

test("buses without a prediction are left out", async () => {
  const far = { dir: 1 as const, route: "M15", secs: null, stopsAway: 31, proximity: "4.1 miles away" };
  const a = await lookup("M15 south 23rd", { ...deps, arrivals: async () => ({ arrivals: [far], ageSecs: 0 }) });
  expect(a.kind === "bus" && a.groups[0]!.arrivals).toEqual([]);
});

test("parse, match and feed errors", async () => {
  expect(await lookup("M999 23", deps)).toEqual({ kind: "error", slot: "line", message: 'route "M999" not found' });
  expect(await lookup("M15 qwerty zzz", deps)).toEqual({ kind: "error", slot: "stop", message: 'no M15 stop like "qwerty zzz"' });
  const down = await lookup("M15 23rd", { ...deps, arrivals: async () => { throw new FeedError("Bus Time unavailable, try again"); } });
  expect(down).toEqual({ kind: "error", slot: null, message: "Bus Time unavailable, try again" });
});
