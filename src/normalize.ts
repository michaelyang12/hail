const ALIASES: Record<string, string> = {
  street: "st",
  avenue: "av",
  ave: "av",
  square: "sq",
  place: "pl",
  boulevard: "blvd",
  parkway: "pkwy",
  road: "rd",
  heights: "hts",
  junction: "jct",
  west: "w",
  east: "e",
};

// Shared by queries and station names so both sides tokenize identically.
export function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/^(\d+)(st|nd|rd|th)$/, "$1"))
    .map((t) => ALIASES[t] ?? t);
}
