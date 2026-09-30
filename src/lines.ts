// Everything hail knows about each subway line: which GTFS-RT feeds carry it,
// the feed route ids it appears under, and its signage colors.
export type Line = {
  feeds: string[];
  routeIds?: string[]; // defaults to [line]
  express?: string[]; // feed route ids for its express variant, shown as a diamond
  color: string;
  text?: string; // bullet text color when white is unreadable
};

const BLUE = "#0039a6";
const ORANGE = "#ff6319";
const YELLOW = "#fccc0a";
const RED = "#ee352e";
const GREEN = "#00933c";
const BROWN = "#996633";
const GREY = "#808183";

export const DEFAULT_COLOR = GREY;

export const LINES: Record<string, Line> = {
  A: { feeds: ["gtfs-ace"], color: BLUE },
  C: { feeds: ["gtfs-ace"], color: BLUE },
  E: { feeds: ["gtfs-ace"], color: BLUE },
  B: { feeds: ["gtfs-bdfm"], color: ORANGE },
  D: { feeds: ["gtfs-bdfm"], color: ORANGE },
  F: { feeds: ["gtfs-bdfm"], express: ["FX"], color: ORANGE },
  M: { feeds: ["gtfs-bdfm"], color: ORANGE },
  G: { feeds: ["gtfs-g"], color: "#6cbe45" },
  J: { feeds: ["gtfs-jz"], color: BROWN },
  Z: { feeds: ["gtfs-jz"], color: BROWN },
  L: { feeds: ["gtfs-l"], color: "#a7a9ac" },
  N: { feeds: ["gtfs-nqrw"], color: YELLOW, text: "#111" },
  Q: { feeds: ["gtfs-nqrw"], color: YELLOW, text: "#111" },
  R: { feeds: ["gtfs-nqrw"], color: YELLOW, text: "#111" },
  W: { feeds: ["gtfs-nqrw"], color: YELLOW, text: "#111" },
  "1": { feeds: ["gtfs"], color: RED },
  "2": { feeds: ["gtfs"], color: RED },
  "3": { feeds: ["gtfs"], color: RED },
  "4": { feeds: ["gtfs"], color: GREEN },
  "5": { feeds: ["gtfs"], color: GREEN },
  "6": { feeds: ["gtfs"], express: ["6X"], color: GREEN },
  "7": { feeds: ["gtfs"], express: ["7X"], color: "#b933ad" },
  // The three shuttles (42 St, Franklin Av, Rockaway Park) live in different feeds.
  S: { feeds: ["gtfs", "gtfs-bdfm", "gtfs-ace"], routeIds: ["GS", "FS", "H"], color: GREY },
  SIR: { feeds: ["gtfs-si"], routeIds: ["SI", "SS"], color: BLUE },
};

// What riders type that isn't the line's own name.
export const LINE_ALIASES: Record<string, string> = { SI: "SIR" };

export const feedsFor = (line: string): string[] => LINES[line]?.feeds ?? [];

export function routeIdsFor(line: string): Set<string> {
  const l = LINES[line];
  return new Set([...(l?.routeIds ?? [line]), ...(l?.express ?? [])]);
}

// Feed route ids (6X, GS, SI...) back to the names riders use.
export function displayRoute(route: string): { name: string; express: boolean } {
  for (const [name, l] of Object.entries(LINES)) {
    if (l.express?.includes(route)) return { name, express: true };
    if ((l.routeIds ?? [name]).includes(route)) return { name, express: false };
  }
  return { name: route, express: false };
}
