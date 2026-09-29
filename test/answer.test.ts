import { expect, test } from "bun:test";
import { answer } from "../src/answer";
import { FeedError, type FeedResult } from "../src/feed";

const fake = (r: FeedResult) => async () => r;
const trains: FeedResult = {
  ageSecs: 5,
  arrivals: [
    { dir: "S", route: "A", secs: 60 },
    { dir: "N", route: "A", secs: 120 },
    { dir: "S", route: "A", secs: 600 },
    { dir: "S", route: "A", secs: 900 },
  ],
};

test("direction given: one group, two arrivals", async () => {
  const a = await answer("A downtown 14th st", { getArrivals: fake(trains) });
  if (a.kind !== "ok") throw new Error(a.message);
  expect(a.station.stopId).toBe("A31");
  expect(a.groups).toHaveLength(1);
  expect(a.groups[0]!.label).toBe("Downtown");
  expect(a.groups[0]!.arrivals.map((t) => t.secs)).toEqual([60, 600]);
});

test("no direction: both groups", async () => {
  const a = await answer("A 14th st", { getArrivals: fake(trains) });
  expect(a.kind === "ok" && a.groups.map((g) => g.dir)).toEqual(["N", "S"]);
});

test("borough word resolved against station labels", async () => {
  const a = await answer("A manhattan nostrand", { getArrivals: fake(trains) });
  if (a.kind !== "ok") throw new Error(a.message);
  expect(a.station.name).toBe("Nostrand Av");
  expect(a.groups.map((g) => g.dir)).toEqual(["N"]);
});

test("borough word that is really part of the stop name", async () => {
  const a = await answer("E queens plaza", { getArrivals: fake(trains) });
  expect(a.kind === "ok" && a.station.stopId).toBe("G21");
});

test("parse and match errors carry the slot", async () => {
  expect(await answer("X 14", { getArrivals: fake(trains) })).toEqual({ kind: "error", slot: "line", message: 'line "X" not found' });
  const e = await answer("A qwerty zzz", { getArrivals: fake(trains) });
  expect(e).toEqual({ kind: "error", slot: "stop", message: 'no A stop like "qwerty zzz"' });
});

test("feed failure becomes a friendly error", async () => {
  const a = await answer("A 14th st", {
    getArrivals: async () => {
      throw new FeedError("MTA feed unavailable, try again");
    },
  });
  expect(a).toEqual({ kind: "error", slot: null, message: "MTA feed unavailable, try again" });
});
