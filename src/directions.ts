export type Dir = "N" | "S";
export type Compass = Dir | "E" | "W";

// Direction words riders type. Subway lines only use the N/S ones.
export const COMPASS_WORDS: Record<string, Compass> = {
  n: "N", nb: "N", north: "N", northbound: "N", up: "N", uptown: "N",
  s: "S", sb: "S", south: "S", southbound: "S", down: "S", downtown: "S",
  e: "E", eb: "E", east: "E", eastbound: "E",
  w: "W", wb: "W", west: "W", westbound: "W",
};

export const BOROUGHS = new Set(["bronx", "brooklyn", "queens", "manhattan"]);

export const ARROW: Record<Compass, string> = { N: "↑", S: "↓", E: "→", W: "←" };

export const OPPOSITE: Record<Compass, Compass> = { N: "S", S: "N", E: "W", W: "E" };
