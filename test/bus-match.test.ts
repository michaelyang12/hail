import { expect, test } from "bun:test";
import { busData, loadBusData } from "../src/bus/data";
import { findBusStop, resolveDir } from "../src/bus/match";
import { parseBus } from "../src/bus/parse";

const data = await busData();

function find(q: string) {
  const p = parseBus(q, (k) => k in data.routes);
  if (!p.ok) throw new Error(p.message);
  return findBusStop(data, data.routes[p.route]!, p.variants);
}
const names = (q: string) => find(q)?.hits.map((h) => `${h.dir.compass} ${h.name}`) ?? null;

test("bus.json covers local, SBS and limited routes in all five boroughs", () => {
  for (const k of ["M15", "M15+", "M101", "BX12+", "B44+", "Q10", "S79+", "Q6"]) expect(data.routes[k]).toBeDefined();
  expect(data.routes["BM1"]).toBeUndefined();
  expect(data.routes["M15"]!.refs).toEqual(["MTA NYCT_M15"]);
  expect(data.routes["Q6"]!.refs).toEqual(["MTABC_Q06"]);
});

test("stop typed the way riders say it", () => {
  expect(names("M15 1st av 23")).toEqual(["N 1 Av/E 23 St"]);
  expect(names("M101 lex 85")).toEqual(["S Lexington Av/E 85 St"]);
  expect(names("Bx12+ fordham walton")).toEqual(["E East Fordham Rd/Walton Av"]);
});

test("same corner in both directions returns one stop per direction", () => {
  expect(names("M14A+ 14th 8 av")).toEqual(["E W 14 St/8 Av", "W W 14 St/8 Av"]);
});

test("compass words on grid and crosstown routes", () => {
  expect(names("M15 south 1st av 23")).toEqual(["S 2 Av/E 22 St"]); // southbound runs on 2 Av
  expect(names("M14A+ west 14th 8 av")).toEqual(["W W 14 St/8 Av"]);
  expect(names("M14A+ 14th 8 av eastbound")).toEqual(["E W 14 St/8 Av"]);
  expect(names("M5 uptown 72")).toEqual(["N W 72 St/Broadway"]);
});

test("headsign words pick a direction", () => {
  expect(names("M15 ferry 22")).toEqual(["S 2 Av/E 22 St"]);
  expect(names("M15 harlem 23")).toEqual(["N 1 Av/E 23 St"]);
});

test("nearest street when the direction skips the one asked for", () => {
  expect(names("M15 south 23rd")).toEqual(["S 2 Av/E 22 St"]);
  expect(names("M15 23rd")).toEqual(["N 1 Av/E 23 St"]); // exact beats near
});

test("direction words that don't fit the route fall back to the plain reading", () => {
  const route = data.routes["M14A+"]!;
  expect(resolveDir(route, "north")).toBeNull();
  expect(resolveDir(route, "st")).toBeNull();
  expect(names("M15 qwerty zzz")).toBeNull();
});

test("missing or malformed bus data rejects instead of throwing at import", async () => {
  await expect(loadBusData("/nonexistent/bus.json")).rejects.toThrow();
  const tmp = `${process.env.TMPDIR ?? "/tmp"}/hail-bad-bus.json`;
  await Bun.write(tmp, "{}");
  await expect(loadBusData(tmp)).rejects.toThrow("malformed");
});
