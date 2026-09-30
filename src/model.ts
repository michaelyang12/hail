import type { BusArrival } from "./bus/feed";
import type { Compass, Dir } from "./directions";
import type { Arrival } from "./feed";
import type { Station } from "./stations";

// Which part of the query an error is about, so the hint can point at it.
export type Slot = "line" | "stop";

export type Group = { dir: Dir; label: string; arrivals: Arrival[]; running: boolean };
export type BusGroup = { dir: Compass | null; label: string; stop: string; arrivals: BusArrival[] };
export type BusRouteInfo = { key: string; name: string; color: string; text: string };

export type SubwayAnswer = { kind: "subway"; line: string; station: Station; also: Station[]; groups: Group[]; ageSecs: number };
export type BusAnswer = { kind: "bus"; route: BusRouteInfo; groups: BusGroup[]; also: string[]; ageSecs: number };
export type ErrorAnswer = { kind: "error"; slot: Slot | null; message: string };
export type Answer = SubwayAnswer | BusAnswer | ErrorAnswer;

export type Failure = { ok: false; slot: Slot; message: string };

export const errorAnswer = (slot: Slot | null, message: string): ErrorAnswer => ({ kind: "error", slot, message });
export const noStop = (line: string, text: string): ErrorAnswer => errorAnswer("stop", `no ${line} stop like "${text}"`);
