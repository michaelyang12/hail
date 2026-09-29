import { expect, test } from "bun:test";
import { decode, extractArrivals, feedsFor, getArrivals, routeIdsFor } from "../src/feed";

const fixture = new Uint8Array(await Bun.file(new URL("./fixtures/gtfs-ace.pb", import.meta.url)).arrayBuffer());
const msg = decode(fixture);
const now = Number(msg.header.timestamp);

test("extracts A arrivals at 14 St in both directions, sorted", () => {
  const arr = extractArrivals(msg, routeIdsFor("A"), "A31", now);
  expect(arr.length).toBeGreaterThan(0);
  expect(new Set(arr.map((a) => a.dir))).toEqual(new Set(["N", "S"]));
  expect(arr.every((a) => a.route === "A")).toBe(true);
  expect(arr.every((a) => a.secs >= -30)).toBe(true);
  expect(arr.map((a) => a.secs)).toEqual(arr.map((a) => a.secs).toSorted((x, y) => x - y));
});

test("does not match a stop whose id merely starts with ours", () => {
  // A3 must not pick up A31N/A31S etc.
  expect(extractArrivals(msg, routeIdsFor("A"), "A3", now)).toEqual([]);
});

test("route and feed aliases", () => {
  expect(routeIdsFor("S")).toEqual(new Set(["GS", "FS", "H"]));
  expect(routeIdsFor("6")).toEqual(new Set(["6", "6X"]));
  expect(routeIdsFor("SIR")).toEqual(new Set(["SI", "SS"]));
  expect(feedsFor("A")).toEqual(["gtfs-ace"]);
  expect(feedsFor("S")).toHaveLength(3);
});

test("getArrivals caches feeds and reports age", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return new Response(fixture);
  };
  const r1 = await getArrivals("A", "A31", now + 60, fetcher);
  const r2 = await getArrivals("A", "A31", now + 65, fetcher);
  expect(calls).toBe(1);
  expect(r1.ageSecs).toBe(60);
  expect(r2.arrivals.length).toBeGreaterThan(0);
});

test("getArrivals throws FeedError on HTTP failure", async () => {
  const fetcher = async () => new Response("nope", { status: 503 });
  await expect(getArrivals("G", "G22", now, fetcher)).rejects.toThrow("MTA feed unavailable");
});
