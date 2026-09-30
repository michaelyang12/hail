import type { Compass } from "./bus/data";
import type { BusArrival } from "./bus/feed";
import type { Arrival } from "./feed";
import type { Dir } from "./parse";
import type { Station } from "./stations";

export type Group = { dir: Dir; label: string; arrivals: Arrival[]; running: boolean };
export type BusGroup = { dir: Compass | null; label: string; stop: string; arrivals: BusArrival[] };
export type BusRouteInfo = { key: string; name: string; color: string; text: string };
export type SubwayAnswer = { kind: "ok"; line: string; station: Station; also: Station[]; groups: Group[]; ageSecs: number };
export type BusAnswer = { kind: "bus"; route: BusRouteInfo; groups: BusGroup[]; also: string[]; ageSecs: number };
export type ErrorAnswer = { kind: "error"; slot: "line" | "stop" | null; message: string };
export type Answer = SubwayAnswer | BusAnswer | ErrorAnswer;

const STALE_SECS = 120;

const css = await Bun.file(new URL("./style.css", import.meta.url)).text();
const js = await Bun.file(new URL("./client.js", import.meta.url)).text();

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const COLORS: Record<string, [bg: string, fg?: string]> = {
  A: ["#0039a6"], C: ["#0039a6"], E: ["#0039a6"],
  B: ["#ff6319"], D: ["#ff6319"], F: ["#ff6319"], M: ["#ff6319"],
  G: ["#6cbe45"], J: ["#996633"], Z: ["#996633"], L: ["#a7a9ac"],
  N: ["#fccc0a", "#111"], Q: ["#fccc0a", "#111"], R: ["#fccc0a", "#111"], W: ["#fccc0a", "#111"],
  "1": ["#ee352e"], "2": ["#ee352e"], "3": ["#ee352e"],
  "4": ["#00933c"], "5": ["#00933c"], "6": ["#00933c"],
  "7": ["#b933ad"], S: ["#808183"], SIR: ["#0039a6"],
};

// Feed route ids (6X, GS, SI...) back to the names riders use.
function displayRoute(route: string): { name: string; express: boolean } {
  if (route === "GS" || route === "FS" || route === "H") return { name: "S", express: false };
  if (route === "SI" || route === "SS") return { name: "SIR", express: false };
  if (/^[0-9A-Z]X$/.test(route)) return { name: route[0]!, express: true };
  return { name: route, express: false };
}

function bullet(route: string): string {
  const { name, express } = displayRoute(route);
  const [bg, fg] = COLORS[name] ?? ["#808183"];
  const cls = ["bullet", express && "x", name === "SIR" && "sir"].filter(Boolean).join(" ");
  return `<span class="${cls}" style="--c:${bg}${fg ? `;--t:${fg}` : ""}">${esc(name)}</span>`;
}

export function fmtMins(secs: number): string {
  return secs < 30 ? "now" : `${Math.max(1, Math.floor(secs / 60))} min`;
}

// "7 min" -> <b>7</b> min, so the number carries the weight and the unit recedes.
function time(secs: number, sub = "", far = false): string {
  const t = fmtMins(secs);
  const now = t === "now";
  const body = far ? "<b>—</b>" : now ? "<b>now</b>" : `<b>${t.slice(0, -4)}</b> min`;
  const cls = ["t", now && !far && "now", far && "far"].filter(Boolean).join(" ");
  return `<span class="${cls}"><span>${body}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</span>`;
}

const stale = (ageSecs: number) => (ageSecs > STALE_SECS ? `<div class="stale">data ${Math.floor(ageSecs / 60)}m old</div>` : "");

const ARROW: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
const hex = (c: string, fallback: string) => (/^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback);

function badge(r: BusRouteInfo): string {
  return `<span class="badge" style="--c:${hex(r.color, "#0039a6")};--t:${hex(r.text, "#fff")}">${esc(r.name)}</span>`;
}

const grp = (dir: string, times: string) => `<div class="grp"><div class="dir">${dir}</div><div class="times">${times}</div></div>`;

const alsoLinks = (prefix: string, names: string[]) =>
  names.length
    ? `<div class="also">also: ${names.map((n) => `<a href="/?q=${encodeURIComponent(`${prefix} ${n}`)}">${esc(n)}</a>`).join(", ")}</div>`
    : "";

// Bus predictions are rougher than train ones, so distance rides along with the time.
function busTime(b: BusArrival): string {
  const at = b.proximity === "at stop";
  // Stop counts read better than Bus Time's text, except near the stop ("< 1 stop away") or with no prediction ("4.1 miles away").
  const counted = b.secs !== null && !!b.stopsAway && !at && b.proximity !== "approaching";
  const away = counted ? `${b.stopsAway} stop${b.stopsAway === 1 ? "" : "s"}` : b.proximity;
  if (b.secs === null) return time(0, away, true);
  return time(at ? 0 : b.secs, away);
}

// Stop names are cross streets ("1 Av/E 14 St"). Opposite sides of one corner are
// separate stops, often spelled differently ("E 23 St / Park Av South").
const streets = (stop: string) => stop.split("/").map((p) => p.trim().toLowerCase());
const corner = (stop: string) => streets(stop).toSorted().join("/");

// When the directions stop at different corners, the street they share names the place, like a station name.
function place(stops: string[]): string {
  const parts = stops.map(streets);
  const i = parts[0]!.findIndex((p) => parts.every((ps) => ps.includes(p)));
  return i < 0 ? stops[0]! : stops[0]!.split("/")[i]!.trim();
}

// Riders know a bus by where it's headed, so the headsign leads and the compass arrow trails.
function renderBus(a: BusAnswer): string {
  const stops = a.groups.map((g) => g.stop);
  const shared = new Set(stops.map(corner)).size === 1;
  const groups = a.groups
    .map((g) => {
      const times = g.arrivals.length ? g.arrivals.map(busTime).join("") : `<span class="none">no ${esc(a.route.name)} buses on the way</span>`;
      const where = shared ? "" : `<span class="where">${esc(g.stop)}</span>`;
      const arrow = g.dir ? `<span class="cmp">${ARROW[g.dir]}</span>` : "";
      return grp(`<span class="to">${esc(g.label)}</span>${arrow}${where}`, times);
    })
    .join("");
  return `<div class="stn">${badge(a.route)}<span>${esc(shared ? stops[0]! : place(stops))}</span></div>` + groups + alsoLinks(a.route.name, a.also) + stale(a.ageSecs);
}

export function renderAnswer(a: Answer): string {
  if (a.kind === "error") return `<div class="err">${esc(a.message)}</div>`;
  if (a.kind === "bus") return renderBus(a);
  // Per-train bullets only earn their space when trains differ (6 vs 6X express).
  const mixed = new Set(a.groups.flatMap((g) => g.arrivals.map((t) => t.route))).size > 1;
  const groups = a.groups
    .map((g) => {
      // The feed only covers trips already under way, so "running" can't tell a skipped
      // stop from a train that just passed; the wording stays true for both.
      const empty = g.running ? `no ${esc(a.line)} trains coming here right now` : `no ${esc(a.line)} trains running right now`;
      const times = g.arrivals.length
        ? g.arrivals.map((t) => (mixed ? bullet(t.route) : "") + time(t.secs)).join("")
        : `<span class="none">${empty}</span>`;
      return grp(`<span class="arr">${g.dir === "N" ? "↑" : "↓"}</span><span class="to">${esc(g.label)}</span>`, times);
    })
    .join("");
  return (
    `<div class="stn">${bullet(a.line)}<span>${esc(a.station.name)}</span></div>` +
    groups + alsoLinks(a.line, a.also.map((s) => s.name)) + stale(a.ageSecs)
  );
}

// Each example shows one feature of the grammar; all are plain links so they work without JS.
const EXAMPLES = ["A downtown 14 st", "L bedford", "7 queens times sq", "M15 south ferry", "Q 86"];

export function renderHint(slot: "line" | "stop" | null): string {
  const s = (name: string, on: boolean, extra = "") => `<span class="slot${on ? " on" : ""}${extra}">${name}</span>`;
  const links = EXAMPLES.map((q) => `<a href="/?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join("");
  return (
    `<div class="gram">${s("line", slot === "line")}${s("direction", false, " opt")}${s("stop", slot === "stop")}</div>` +
    `<div class="note">direction is optional: up / down, n / s, a borough, or where the bus is headed</div>` +
    `<div class="ex"><span class="lbl">try</span>${links}</div>`
  );
}

export function hintState(a: Answer | null): { html: string; compact: boolean } {
  return { html: renderHint(a?.kind === "error" ? a.slot : null), compact: a?.kind === "ok" || a?.kind === "bus" };
}

export function renderPage(q: string, a: Answer | null): string {
  const hint = hintState(a);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#161615">
<title>hail</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%227%22 fill=%22%23ff5b14%22/%3E%3C/svg%3E">
<style>${css}</style>
</head>
<body>
<form class="device" action="/" method="get" autocomplete="off">
<div class="top"><span class="brand"><span class="led"></span>hail</span></div>
<div class="screen">
<label class="prompt"><b>&gt;</b><input name="q" value="${esc(q)}" placeholder="A downtown 14th st" aria-label="query" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"${a ? "" : " autofocus"}></label>
<div id="ans" class="ans">${a ? renderAnswer(a) : ""}</div>
</div>
<div id="hint" class="hint${hint.compact ? " compact" : ""}">${hint.html}</div>
</form>
<script>${js}</script>
</body>
</html>`;
}
