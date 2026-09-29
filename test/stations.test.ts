import { expect, test } from "bun:test";
import { knownLines, loadStations, stations, stationsOnLine } from "../src/stations";

test("loads the committed station list", () => {
  const a31 = stations.find((s) => s.stopId === "A31")!;
  expect(a31.name).toBe("14 St");
  expect(a31.routes).toEqual(["A", "C", "E"]);
  expect(a31.northLabel).toBe("Uptown");
  expect(a31.southLabel).toBe("Downtown");
  expect(a31.tokens).toEqual(["14", "st"]);
});

test("stationsOnLine filters by route", () => {
  const ids = stationsOnLine("A").map((s) => s.stopId);
  expect(ids).toContain("A31");
  expect(ids).not.toContain("132");
});

test("knownLines comes from the data", () => {
  for (const l of ["A", "1", "7", "S", "SIR", "L"]) expect(knownLines.has(l)).toBe(true);
  expect(knownLines.has("X")).toBe(false);
});

test("handles quoted fields", () => {
  const csv =
    'GTFS Stop ID,Stop Name,Daytime Routes,North Direction Label,South Direction Label\n' +
    'X1,"Foo, Bar",A,Up,Down\n';
  expect(loadStations(csv)[0]!.name).toBe("Foo, Bar");
});
