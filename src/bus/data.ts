import type { Compass } from "../directions";

export type BusDir = {
  id: 0 | 1;
  headsigns: string[]; // most common first
  compass: Compass | null; // null when the two directions don't point opposite ways
  stops: string[]; // stop ids, main pattern in order, then branch-only stops
};
export type BusRoute = { name: string; refs: string[]; color: string; text: string; dirs: BusDir[] };
export type BusData = { generated: string; stops: Record<string, string>; routes: Record<string, BusRoute> };

const PATH = new URL("../../data/bus.json", import.meta.url);

export async function loadBusData(path: URL | string = PATH): Promise<BusData> {
  const d = (await Bun.file(path).json()) as BusData;
  if (!d?.routes || !d?.stops) throw new Error(`${path} is malformed`);
  return d;
}

let loaded: Promise<BusData> | null = null;

// Loaded on first bus query, not at import, so missing or broken bus data can't
// stop the server from starting. A failed load is retried on the next query.
export function busData(): Promise<BusData> {
  loaded ??= loadBusData();
  loaded.catch(() => (loaded = null));
  return loaded;
}
