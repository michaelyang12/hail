import type { BusArrival } from "./bus/feed";
import { ARROW } from "./directions";
import { DEFAULT_COLOR, displayRoute, LINES } from "./lines";
import type { BusAnswer, BusRouteInfo, SubwayAnswer } from "./model";

// What the page shows for any answer, train or bus. Mode-specific decisions are
// made here, so the renderer draws both the same way.
export type Chip = { text: string; color: string; textColor?: string; shape: "round" | "diamond" | "pill" | "tag" };
export type Time = { secs: number; chip?: Chip };
export type Row = { label: string; lead?: string; trail?: string; where?: string; times: Time[]; empty: string };
export type Board = { chip: Chip; place: string; rows: Row[]; also: { text: string; q: string }[]; ageSecs: number };

const BUS_COLOR = "#0039a6";
const hex = (c: string, fallback: string) => (/^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback);

export function routeChip(route: string): Chip {
  const { name, express } = displayRoute(route);
  const line = LINES[name];
  const shape = express ? "diamond" : name === "SIR" ? "pill" : "round";
  return { text: name, color: line?.color ?? DEFAULT_COLOR, textColor: line?.text, shape };
}

const busChip = (r: BusRouteInfo): Chip => ({ text: r.name, color: hex(r.color, BUS_COLOR), textColor: hex(r.text, "#fff"), shape: "tag" });

export function subwayBoard(a: SubwayAnswer): Board {
  // Per-train chips only earn their space when trains differ (6 vs 6X express).
  const mixed = new Set(a.groups.flatMap((g) => g.arrivals.map((t) => t.route))).size > 1;
  return {
    chip: routeChip(a.line),
    place: a.station.name,
    rows: a.groups.map((g) => ({
      label: g.label,
      lead: ARROW[g.dir],
      times: g.arrivals.map((t) => ({ secs: t.secs, chip: mixed ? routeChip(t.route) : undefined })),
      // The feed only covers trips already under way, so "running" can't tell a skipped
      // stop from a train that just passed; the wording stays true for both.
      empty: g.running ? `no ${a.line} trains coming here right now` : `no ${a.line} trains running right now`,
    })),
    also: a.also.map((s) => ({ text: s.name, q: `${a.line} ${s.name}` })),
    ageSecs: a.ageSecs,
  };
}

// Stop names are cross streets ("1 Av/E 14 St"). Opposite sides of one corner are
// separate stops, often spelled differently ("E 23 St / Park Av South").
const streets = (stop: string) => stop.split("/").map((p) => p.trim().toLowerCase());
const corner = (stop: string) => streets(stop).toSorted().join("/");

// When the directions stop at different corners, the street they share names the place, like a station name.
export function place(stops: string[]): string {
  const parts = stops.map(streets);
  const i = parts[0]!.findIndex((p) => parts.every((ps) => ps.includes(p)));
  return i < 0 ? stops[0]! : stops[0]!.split("/")[i]!.trim();
}

// Bus Time says "at stop" a little before the predicted time runs out.
const busSecs = (b: BusArrival) => (b.proximity === "at stop" ? 0 : b.secs!);

// Riders know a bus by where it's headed, so the headsign leads and the compass arrow trails.
export function busBoard(a: BusAnswer): Board {
  const stops = a.groups.map((g) => g.stop);
  const shared = new Set(stops.map(corner)).size === 1;
  return {
    chip: busChip(a.route),
    place: shared ? stops[0]! : place(stops),
    rows: a.groups.map((g) => ({
      label: g.label,
      trail: g.dir ? ARROW[g.dir] : undefined,
      where: shared ? undefined : g.stop,
      times: g.arrivals.map((b) => ({ secs: busSecs(b) })),
      empty: `no ${a.route.name} buses on the way`,
    })),
    also: a.also.map((n) => ({ text: n, q: `${a.route.name} ${n}` })),
    ageSecs: a.ageSecs,
  };
}

export const toBoard = (a: SubwayAnswer | BusAnswer): Board => (a.kind === "subway" ? subwayBoard(a) : busBoard(a));
