import type { Arrival } from "./feed";
import type { Dir } from "./parse";
import type { Station } from "./stations";

export type Group = { dir: Dir; label: string; arrivals: Arrival[] };
export type Answer =
  | { kind: "ok"; line: string; station: Station; also: Station[]; groups: Group[]; ageSecs: number }
  | { kind: "error"; slot: "line" | "stop" | null; message: string };

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

export function renderAnswer(a: Answer): string {
  if (a.kind === "error") return `<div class="err">${esc(a.message)}</div>`;
  const groups = a.groups
    .map((g) => {
      const rows = g.arrivals.length
        ? g.arrivals
            .map((t) => `<div class="row">${bullet(t.route)}<span class="eta${t.secs < 30 ? " now" : ""}">${fmtMins(t.secs)}</span></div>`)
            .join("")
        : `<div class="none">no ${esc(a.line)} trains scheduled</div>`;
      return `<div class="grp"><div class="dir">${g.dir === "N" ? "↑" : "↓"} ${esc(g.label)}</div>${rows}</div>`;
    })
    .join("");
  const also = a.also.length
    ? `<div class="also">also: ${a.also
        .map((s) => `<a href="/?q=${encodeURIComponent(`${a.line} ${s.name}`)}">${esc(s.name)}</a>`)
        .join(", ")}</div>`
    : "";
  const stale = a.ageSecs > STALE_SECS ? `<div class="stale">data ${Math.floor(a.ageSecs / 60)}m old</div>` : "";
  return (
    `<div class="stn"><span>${esc(a.station.name)}</span><span class="routes">${a.station.routes.map(bullet).join("")}</span></div>` +
    groups + also + stale
  );
}

export function renderHint(slot: "line" | "stop" | null): string {
  const s = (name: string, on: boolean, extra = "") => `<span class="slot${on ? " on" : ""}${extra}">${name}</span>`;
  return (
    s("LINE", slot === "line") + s("[DIR]", false, " opt") + s("STOP", slot === "stop") +
    `<span class="ex">A</span><span class="ex">up / down</span><span class="ex">14th st</span>` +
    `<span class="ex more"></span><span class="ex more">n / s · bronx / brooklyn / queens / manhattan</span><span class="ex more"></span>`
  );
}

export function hintState(a: Answer | null): { html: string; compact: boolean } {
  return { html: renderHint(a?.kind === "error" ? a.slot : null), compact: a?.kind === "ok" };
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
<div class="top"><span class="brand"><span class="led"></span>hail</span><span>nyc subway</span></div>
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
