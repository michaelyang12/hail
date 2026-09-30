import { toBoard, type Board, type Chip } from "./board";
import { STALE_SECS } from "./config";
import { html, queryHref, raw, type Html } from "./html";
import type { Answer } from "./model";
// Text imports, so `bun --watch` reloads when either changes.
import css from "./style.css" with { type: "text" };
import js from "./client.js" with { type: "text" };

// Mirrors of --screen and --accent in style.css, for the places CSS can't reach.
const SCREEN = "#161615";
const ACCENT = "#ff5b14";

// Whole minutes, or null once a train is under 30s out and shown as "now".
export function minutes(secs: number): number | null {
  return secs < 30 ? null : Math.max(1, Math.floor(secs / 60));
}

const chip = (c: Chip) =>
  html`<span class="chip ${c.shape}" style="${`--c:${c.color}` + (c.textColor ? `;--t:${c.textColor}` : "")}">${c.text}</span>`;

function time(secs: number, c?: Chip): Html {
  const m = minutes(secs);
  return html`<span class="t${m === null ? " now" : ""}">${c && chip(c)}${m === null ? html`<b>now</b>` : html`<b>${m}</b> min`}</span>`;
}

function board(b: Board): Html {
  const rows = b.rows.map(
    (r) => html`<div class="row"><div class="label caps">${r.lead && html`<span class="arrow">${r.lead}</span>`}<span class="to">${r.label}</span>${
      r.trail && html`<span class="arrow">${r.trail}</span>`
    }${r.where && html`<span class="where">${r.where}</span>`}</div>${
      r.times.length ? r.times.map((t) => time(t.secs, t.chip)) : html`<span class="none">${r.empty}</span>`
    }</div>`,
  );
  const also = b.also.length > 0 && html`<div class="also">also: ${b.also.map((a, i) => html`${i ? ", " : ""}<a href="${queryHref(a.q)}">${a.text}</a>`)}</div>`;
  const stale = b.ageSecs > STALE_SECS && html`<div class="stale">data ${Math.floor(b.ageSecs / 60)}m old</div>`;
  return html`<div class="stn">${chip(b.chip)}<span>${b.place}</span></div><div class="rows">${rows}</div>${also}${stale}`;
}

export function renderAnswer(a: Answer): string {
  return (a.kind === "error" ? html`<div class="err">${a.message}</div>` : board(toBoard(a))).value;
}

// Each example shows one feature of the grammar; all are plain links so they work without JS.
const EXAMPLES = ["A downtown 14 st", "L bedford", "7 queens times sq", "M15 south ferry", "Q 86"];

function hint(a: Answer | null): Html {
  const s = (name: string, opt = false) => html`<span class="slot${opt ? " opt" : ""}">${name}</span>`;
  // With an answer showing, the grammar steps back; client.js swaps the examples for recent queries.
  const compact = a !== null && a.kind !== "error";
  return html`<div id="hint" class="hint${compact ? " compact" : ""}"><div class="gram caps">${s("line")}${s("direction", true)}${s("stop")}</div><div class="note">direction is optional: up / down, n / s, a borough, or where the bus is headed</div><div class="ex"><span class="lbl caps">try</span>${EXAMPLES.map(
    (q) => html`<a href="${queryHref(q)}">${q}</a>`,
  )}</div></div>`;
}

// What client.js receives for a ?partial=1 request.
export type PartialResponse = { ans: string; hint: string };

export const renderPartial = (a: Answer | null): PartialResponse => ({ ans: a ? renderAnswer(a) : "", hint: hint(a).value });

export function renderPage(q: string, a: Answer | null): string {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${SCREEN}">
<title>hail</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%227%22 fill=%22${encodeURIComponent(ACCENT)}%22/%3E%3C/svg%3E">
<style>${raw(css)}</style>
</head>
<body>
<form class="device" action="/" method="get" autocomplete="off">
<div class="top caps"><span class="brand"><span class="led"></span>hail</span></div>
<div class="screen">
<label class="prompt"><b>&gt;</b><input name="q" value="${q}" placeholder="A downtown 14th st" aria-label="query" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"${a ? "" : raw(" autofocus")}></label>
<div id="ans" class="ans">${a && raw(renderAnswer(a))}</div>
</div>
${hint(a)}
</form>
<script>${raw(js)}</script>
</body>
</html>`.value;
}
