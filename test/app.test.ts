import { expect, test } from "bun:test";
import { answer } from "../src/answer";
import { handle, type Deps } from "../src/app";
import type { FeedResult } from "../src/feed";

const feed: FeedResult = { ageSecs: 5, arrivals: [{ dir: "S", route: "A", secs: 60 }, { dir: "N", route: "A", secs: 120 }] };
const subway = (q: string) => answer(q, { getArrivals: async () => feed });
const get = (deps: Deps, path: string) => handle(new Request(`http://x${path}`), deps);

const healthy: Deps = { subway, bus: async () => ({ kind: "error", slot: null, message: "bus stub" }) };
const broken: Deps[] = [
  { subway, bus: async () => { throw new Error("boom"); } },
  { subway, bus: () => new Promise(() => {}) },
];

test("subway responses are identical whatever state bus is in", async () => {
  for (const path of ["/?q=A+downtown+14th+st", "/?q=A+14th+st&partial", "/?q=Q+dekalb&partial", "/"]) {
    const want = await (await get(healthy, path)).text();
    for (const deps of broken) expect(await (await get(deps, path)).text()).toBe(want);
  }
});

test("bus-looking queries go to bus, others to subway", async () => {
  const seen: string[] = [];
  const deps: Deps = {
    subway: async (q) => (seen.push(`subway:${q}`), { kind: "error", slot: null, message: "s" }),
    bus: async (q) => (seen.push(`bus:${q}`), { kind: "error", slot: null, message: "b" }),
  };
  await get(deps, "/?q=M15+23rd&partial");
  await get(deps, "/?q=A+14th&partial");
  expect(seen).toEqual(["bus:M15 23rd", "subway:A 14th"]);
});

test("/bus returns the bus answer as JSON", async () => {
  const res = await get(healthy, "/bus?q=M15+23rd");
  expect(res.headers.get("content-type")).toContain("application/json");
  expect(await res.json()).toEqual({ kind: "error", slot: null, message: "bus stub" });
});

test("other paths 404", async () => {
  expect((await get(healthy, "/nope")).status).toBe(404);
});
