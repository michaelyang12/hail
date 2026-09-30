import type { BusArrival } from "./bus/feed";
import { STALE_SECS } from "./config";
import { ARROW } from "./directions";
import { DEFAULT_COLOR, displayRoute, LINES } from "./lines";
import type { Answer, BusAnswer, BusRouteInfo, Slot } from "./model";

const css = await Bun.file(new URL("./style.css", import.meta.url)).text();
const js = await Bun.file(new URL("./client.js", import.meta.url)).text();

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

function bullet(route: string): string {
  const { name, express } = displayRoute(route);
  const line = LINES[name];
  const [bg, fg] = [line?.color ?? DEFAULT_COLOR, line?.text];
  const cls = ["bullet", express && "x", name === "SIR" && "sir"].filter(Boolean).join(" ");
  return `<span class="${cls}" style="--c:${bg}${fg ? `;--t:${fg}` : ""}">${esc(name)}</span>`;
}

export function fmtMins(secs: number): string {
  return secs < 30 ? "now" : `${Math.max(1, Math.floor(secs / 60))} min`;
}

// "7 min" -> <b>7</b> min, so the number carries the weight and the unit recedes.
function time(secs: number): string {
  const t = fmtMins(secs);
  if (t === "now") return `<span class="t now"><b>now</b></span>`;
  return `<span class="t"><b>${t.slice(0, -4)}</b> min</span>`;
}

const stale = (ageSecs: number) => (ageSecs > STALE_SECS ? `<div class="stale">data ${Math.floor(ageSecs / 60)}m old</div>` : "");

const hex = (c: string, fallback: string) => (/^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback);

function badge(r: BusRouteInfo): string {
  return `<span class="badge" style="--c:${hex(r.color, "#0039a6")};--t:${hex(r.text, "#fff")}">${esc(r.name)}</span>`;
}

const grp = (dir: string, times: string) => `<div class="grp"><div class="dir">${dir}</div><div class="times">${times}</div></div>`;

const alsoLinks = (prefix: string, names: string[]) =>
  names.length
    ? `<div class="also">also: ${names.map((n) => `<a href="/?q=${encodeURIComponent(`${prefix} ${n}`)}">${esc(n)}</a>`).join(", ")}</div>`
    : "";

// Bus Time says "at stop" a little before the predicted time runs out.
const busTime = (b: BusArrival) => time(b.proximity === "at stop" ? 0 : b.secs!);

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
      return grp(`<span class="arr">${ARROW[g.dir]}</span><span class="to">${esc(g.label)}</span>`, times);
    })
    .join("");
  return (
    `<div class="stn">${bullet(a.line)}<span>${esc(a.station.name)}</span></div>` +
    groups + alsoLinks(a.line, a.also.map((s) => s.name)) + stale(a.ageSecs)
  );
}

// Each example shows one feature of the grammar; all are plain links so they work without JS.
const EXAMPLES = ["A downtown 14 st", "L bedford", "7 queens times sq", "M15 south ferry", "Q 86"];

export function renderHint(slot: Slot | null): string {
  const s = (name: string, on: boolean, extra = "") => `<span class="slot${on ? " on" : ""}${extra}">${name}</span>`;
  const links = EXAMPLES.map((q) => `<a href="/?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join("");
  return (
    `<div class="gram">${s("line", slot === "line")}${s("direction", false, " opt")}${s("stop", slot === "stop")}</div>` +
    `<div class="note">direction is optional: up / down, n / s, a borough, or where the bus is headed</div>` +
    `<div class="ex"><span class="lbl">try</span>${links}</div>`
  );
}

export function hintState(a: Answer | null): { html: string; compact: boolean } {
  return { html: renderHint(a?.kind === "error" ? a.slot : null), compact: a?.kind === "subway" || a?.kind === "bus" };
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
