import { normalize } from "./normalize";

export type Station = {
  stopId: string;
  name: string;
  routes: string[];
  northLabel: string;
  southLabel: string;
  tokens: string[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") out.push(cur), (cur = "");
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function loadStations(csv: string): Station[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const cols = splitCsvLine(header!);
  const col = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`stations.csv missing column "${name}"`);
    return i;
  };
  const [id, name, routes, north, south] = [
    col("GTFS Stop ID"),
    col("Stop Name"),
    col("Daytime Routes"),
    col("North Direction Label"),
    col("South Direction Label"),
  ];
  return rows.map((row) => {
    const f = splitCsvLine(row);
    return {
      stopId: f[id]!,
      name: f[name]!,
      routes: f[routes]!.split(" ").filter(Boolean),
      northLabel: f[north]!,
      southLabel: f[south]!,
      tokens: normalize(f[name]!),
    };
  });
}

export const stations = loadStations(
  await Bun.file(new URL("../data/stations.csv", import.meta.url)).text(),
);

export const knownLines = new Set(stations.flatMap((s) => s.routes));

export function stationsOnLine(line: string, all: Station[] = stations): Station[] {
  return all.filter((s) => s.routes.includes(line));
}
