// Builds data/bus.json from the MTA bus GTFS static feeds.
//
//   bun scripts/build-bus-data.ts [dir]
//
// Downloads the six bus zips (five NYCT boroughs + MTA Bus Company) into `dir`
// (default: a temp dir) unless they are already there. Needs `unzip` on PATH.

import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitCsvLine } from "../src/csv";
import type { BusData, BusDir } from "../src/bus/data";
import { OPPOSITE, type Compass } from "../src/directions";
import { routeKey } from "../src/bus/parse";

const FEEDS = ["b", "bx", "m", "q", "si", "busco"];
const BASE = "https://rrgtfsfeeds.s3.amazonaws.com";
const OUT = new URL("../data/bus.json", import.meta.url).pathname;

// Local, limited and SBS routes. Express (BM, BxM, QM, SIM, X) are out of scope for now.
const ROUTE_NAME = /^[A-Z]+\d+[A-Z]?(-SBS)?$/i;
const EXPRESS = /^(BM|BXM|QM|SIM|X)\d/i;

const dir = process.argv[2] ?? mkdtempSync(join(tmpdir(), "hail-bus-"));

async function download(name: string): Promise<string> {
  const path = join(dir, `gtfs_${name}.zip`);
  if (existsSync(path)) return path;
  console.error(`downloading gtfs_${name}.zip`);
  const res = await fetch(`${BASE}/gtfs_${name}.zip`);
  if (!res.ok) throw new Error(`gtfs_${name}.zip: HTTP ${res.status}`);
  await Bun.write(path, res);
  return path;
}

// Streams a file out of a zip as parsed CSV rows keyed by header.
async function* rows(zip: string, file: string): AsyncGenerator<Record<string, string>> {
  const proc = Bun.spawn(["unzip", "-p", zip, file], { stdout: "pipe" });
  const decoder = new TextDecoder();
  let header: string[] | null = null;
  let buf = "";
  const emit = (line: string) => {
    const cells = splitCsvLine(line.replace(/\r$/, ""));
    if (!header) return void (header = cells.map((h) => h.replace(/^﻿/, "").trim()));
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
  };
  for await (const chunk of proc.stdout) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      const r = line && emit(line);
      if (r) yield r;
    }
  }
  const r = buf && emit(buf);
  if (r) yield r;
  if ((await proc.exited) !== 0) throw new Error(`unzip ${zip} ${file} failed`);
}

const UPPER = new Set(["JFK", "LGA", "SBS", "CUNY", "LIRR", "PATH", "HS", "JHS", "IS", "PS", "MS", "NYC", "SI", "FDR", "LIJ", "YMCA", "VA", "US", "GW", "LES"]);
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[a-z][a-z']*/g, (w) => (UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)));
}

// "SELECT BUS SERVICE SOUTH FERRY via 2 AV" -> "SOUTH FERRY"
function cleanHeadsign(h: string): string {
  return h
    .replace(/^((SELECT BUS SERVICE|SELECT BUS|SBS|LIMITED|LTD|RUSH)\s+)+/i, "")
    .replace(/\s+-?\s*via\b.*$/i, "")
    .replace(/[\s-]+$/, "")
    .trim();
}

// Dominant compass direction of travel from a to b. Manhattan riders mean the
// street grid, which runs 29 degrees east of true north, so rotate for M routes.
const GRID = (29 * Math.PI) / 180;
function compassOf(a: [number, number], b: [number, number], grid: boolean): Compass {
  let dy = b[0] - a[0];
  let dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  if (grid) [dx, dy] = [dx * Math.cos(GRID) - dy * Math.sin(GRID), dx * Math.sin(GRID) + dy * Math.cos(GRID)];
  return Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? "N" : "S") : dx >= 0 ? "E" : "W";
}

type RouteAcc = { name: string; refs: Set<string>; color: string; text: string };
type DirAcc = { patterns: Map<string, number>; headsigns: Map<string, number> };

const routes = new Map<string, RouteAcc>();
const dirs = new Map<string, DirAcc>(); // `${key}|${direction_id}`
const stops = new Map<string, { name: string; lat: number; lon: number }>();

const inc = <K>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const top = <K>(m: Map<K, number>): K[] => [...m].sort((a, b) => b[1] - a[1]).map(([k]) => k);

for (const name of FEEDS) {
  const zip = await download(name);
  console.error(`reading ${name}`);

  const keyOf = new Map<string, string>(); // route_id -> key
  for await (const r of rows(zip, "routes.txt")) {
    const short = r.route_short_name!;
    if (!ROUTE_NAME.test(short) || EXPRESS.test(short)) continue;
    const key = routeKey(short);
    keyOf.set(r.route_id!, key);
    const acc = routes.get(key) ?? { name: short.replace(/^BX/i, "Bx"), refs: new Set(), color: r.route_color || "", text: r.route_text_color || "" };
    acc.refs.add(`${r.agency_id}_${r.route_id}`);
    routes.set(key, acc);
  }

  const tripDir = new Map<string, string>(); // trip_id -> dir key
  for await (const r of rows(zip, "trips.txt")) {
    const key = keyOf.get(r.route_id!);
    if (!key) continue;
    const dk = `${key}|${r.direction_id}`;
    tripDir.set(r.trip_id!, dk);
    const d = dirs.get(dk) ?? { patterns: new Map(), headsigns: new Map() };
    dirs.set(dk, d);
    const h = cleanHeadsign(r.trip_headsign ?? "");
    if (h) inc(d.headsigns, h);
  }

  for await (const r of rows(zip, "stops.txt")) {
    stops.set(r.stop_id!, { name: r.stop_name!, lat: Number(r.stop_lat), lon: Number(r.stop_lon) });
  }

  // stop_times is grouped by trip; each trip's stop sequence is one pattern.
  let trip = "";
  let seq: [number, string][] = [];
  const flush = () => {
    const dk = tripDir.get(trip);
    if (dk && seq.length) inc(dirs.get(dk)!.patterns, seq.sort((a, b) => a[0] - b[0]).map((s) => s[1]).join(" "));
    seq = [];
  };
  const done = new Set<string>();
  for await (const r of rows(zip, "stop_times.txt")) {
    if (r.trip_id !== trip) {
      flush();
      if (done.has(r.trip_id!)) throw new Error(`stop_times.txt not grouped by trip (${r.trip_id})`);
      done.add((trip = r.trip_id!));
    }
    if (tripDir.has(trip)) seq.push([Number(r.stop_sequence), r.stop_id!]);
  }
  flush();
}

const out: BusData = { generated: new Date().toISOString().slice(0, 10), stops: {}, routes: {} };
const used = new Set<string>();

for (const [key, r] of [...routes].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))) {
  const ds: (BusDir & { first: string; last: string })[] = [];
  for (const id of [0, 1] as const) {
    const d = dirs.get(`${key}|${id}`);
    if (!d || d.patterns.size === 0) continue;
    // Most frequent pattern gives the order; stops only on branches/short-turns are appended.
    const patterns = top(d.patterns).map((p) => p.split(" "));
    const main = patterns[0]!;
    const all = [...new Set(patterns.flat())].filter((s) => stops.has(s));
    const ordered = [...main.filter((s) => stops.has(s)), ...all.filter((s) => !main.includes(s))];
    ordered.forEach((s) => used.add(s));
    ds.push({ id, headsigns: top(d.headsigns).map(titleCase), compass: null, stops: ordered, first: main[0]!, last: main[main.length - 1]! });
  }
  if (ds.length === 0) continue;

  // Compass words only when the two directions point opposite ways.
  const pos = (s: string): [number, number] => [stops.get(s)!.lat, stops.get(s)!.lon];
  const cs = ds.map((d) => compassOf(pos(d.first), pos(d.last), key.startsWith("M")));
  if (ds.length === 2 && cs[1] === OPPOSITE[cs[0]!]) ds.forEach((d, i) => (d.compass = cs[i]!));

  out.routes[key] = {
    name: r.name,
    refs: [...r.refs].sort(),
    color: r.color,
    text: r.text,
    dirs: ds.map(({ first: _f, last: _l, ...d }) => d),
  };
}
for (const s of [...used].sort()) out.stops[s] = titleCase(stops.get(s)!.name);

await Bun.write(OUT, JSON.stringify(out));
console.error(`wrote ${OUT}: ${Object.keys(out.routes).length} routes, ${used.size} stops, ${(Bun.file(OUT).size / 1024).toFixed(0)} KB`);
