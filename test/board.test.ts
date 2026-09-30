import { expect, test } from "bun:test";
import { busBoard, place, routeChip, subwayBoard } from "../src/board";
import { bus, subway } from "./samples";

test("subway board: line chip, station, arrow before the label", () => {
  const b = subwayBoard(subway);
  expect(b.chip).toEqual({ text: "A", color: "#0039a6", textColor: undefined, shape: "round" });
  expect(b.place).toBe("14 St");
  expect(b.rows).toEqual([{ label: "Downtown", lead: "↓", times: [{ secs: 70, chip: undefined }, { secs: 610, chip: undefined }], empty: "no A trains coming here right now" }]);
});

test("per-train chips only when routes differ", () => {
  const g = { ...subway.groups[0]!, arrivals: [{ dir: "S" as const, route: "6X", secs: 70 }, { dir: "S" as const, route: "6", secs: 300 }] };
  const times = subwayBoard({ ...subway, line: "6", groups: [g] }).rows[0]!.times;
  expect(times.map((t) => t.chip?.shape)).toEqual(["diamond", "round"]);
});

test("route chips: colors, express diamonds, SIR pill, readable text on yellow", () => {
  expect(routeChip("Q")).toMatchObject({ color: "#fccc0a", textColor: "#111" });
  expect(routeChip("7X")).toMatchObject({ text: "7", shape: "diamond" });
  expect(routeChip("SI")).toMatchObject({ text: "SIR", shape: "pill" });
  expect(routeChip("GS")).toMatchObject({ text: "S", color: "#808183" });
});

test("empty direction says whether the line is running at all", () => {
  const empty = (running: boolean) => subwayBoard({ ...subway, groups: [{ dir: "N", label: "Uptown", running, arrivals: [] }] }).rows[0]!.empty;
  expect(empty(true)).toBe("no A trains coming here right now");
  expect(empty(false)).toBe("no A trains running right now");
});

test("bus board: tag chip, headsign before arrow, at stop shows as now", () => {
  const b = busBoard(bus);
  expect(b.chip).toEqual({ text: "M15", color: "#006CB7", textColor: "#FFFFFF", shape: "tag" });
  expect(b.place).toBe("2 Av/E 22 St");
  expect(b.rows).toEqual([{ label: "South Ferry", trail: "↓", where: undefined, times: [{ secs: 0 }, { secs: 190 }], empty: "no M15 buses on the way" }]);
});

test("bad bus colors fall back to readable defaults", () => {
  expect(busBoard({ ...bus, route: { ...bus.route, color: "", text: "nope" } }).chip).toMatchObject({ color: "#0039a6", textColor: "#fff" });
});

test("bus stops at different corners: shared street in the header, each corner on its row", () => {
  const g = bus.groups[0]!;
  const b = busBoard({ ...bus, groups: [{ ...g, stop: "1 Av/E 14 St" }, { ...g, dir: "N", stop: "2 Av / E 14 St" }] });
  expect(b.place).toBe("E 14 St");
  expect(b.rows.map((r) => r.where)).toEqual(["1 Av/E 14 St", "2 Av / E 14 St"]);
});

test("the same corner spelled two ways is one place", () => {
  const g = bus.groups[0]!;
  const b = busBoard({ ...bus, groups: [{ ...g, stop: "E 23 St/Park Av South" }, { ...g, dir: "N", stop: "E 23 St / Park Av South" }] });
  expect(b.place).toBe("E 23 St/Park Av South");
  expect(b.rows.every((r) => r.where === undefined)).toBe(true);
});

test("corners with no street in common fall back to the first stop", () => {
  expect(place(["1 Av/E 23 St", "2 Av/E 22 St"])).toBe("1 Av/E 23 St");
});

test("also links carry the line or route", () => {
  expect(busBoard({ ...bus, also: ["2 Av/E 25 St"] }).also).toEqual([{ text: "2 Av/E 25 St", q: "M15 2 Av/E 25 St" }]);
});
