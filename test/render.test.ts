import { expect, test } from "bun:test";
import { html, raw } from "../src/html";
import { minutes, renderAnswer, renderPage, renderPartial } from "../src/render";
import { bus, subway } from "./samples";

test("minutes", () => {
  expect(minutes(-10)).toBeNull();
  expect(minutes(20)).toBeNull();
  expect(minutes(45)).toBe(1);
  expect(minutes(89)).toBe(1);
  expect(minutes(600)).toBe(10);
});

test("html escapes interpolations but not nested html or raw", () => {
  expect(html`<b>${'<i>"x"</i>'}</b>`.value).toBe("<b>&lt;i&gt;&quot;x&quot;&lt;/i&gt;</b>");
  expect(html`<b>${html`<i>${"&"}</i>`}${raw("<br>")}</b>`.value).toBe("<b><i>&amp;</i><br></b>");
  expect(html`${[1, false, null, "a"]}`.value).toBe("1a");
});

test("trains and buses render the same row markup", () => {
  const row = /<div class="row"><div class="label caps">.*?<\/div>(<span class="t( now)?">.*?<\/span>)+<\/div>/;
  expect(renderAnswer(subway)).toMatch(row);
  expect(renderAnswer(bus)).toMatch(row);
  expect(renderAnswer(subway)).toContain(`<span class="t"><b>1</b> min</span><span class="t"><b>10</b> min</span>`);
  expect(renderAnswer(bus)).toContain(`<span class="t now"><b>now</b></span><span class="t"><b>3</b> min</span>`);
});

test("empty row spans the time columns", () => {
  expect(renderAnswer({ ...subway, groups: [{ dir: "N", label: "Uptown", running: false, arrivals: [] }] })).toContain(
    `<span class="none">no A trains running right now</span>`,
  );
});

test("no also links renders nothing, not a count", () => {
  expect(renderAnswer(subway)).not.toMatch(/<\/div>0/);
});

test("stale data is flagged", () => {
  expect(renderAnswer(subway)).not.toContain("old");
  expect(renderAnswer({ ...subway, ageSecs: 180 })).toContain("data 3m old");
});

test("user input is escaped", () => {
  const page = renderPage('<script>alert(1)</script>', { kind: "error", slot: "stop", message: 'no A stop like "<b>"' });
  expect(page).not.toContain("<script>alert(1)");
  expect(page).toContain("&lt;script&gt;");
  expect(page).not.toContain('"<b>"');
});

test("error highlights the failing template slot", () => {
  const page = renderPage("X 14", { kind: "error", slot: "line", message: 'line "X" not found' });
  expect(page).toMatch(/class="slot on"[^>]*>line/);
  expect(page).not.toMatch(/class="slot on"[^>]*>stop/);
});

test("empty page has placeholder, full hint, example links that work without JS", () => {
  const page = renderPage("", null);
  expect(page).toContain('placeholder="A downtown 14th st"');
  expect(page).toContain(`id="hint" class="hint"`);
  expect(page).toContain(`<a href="/?q=A%20downtown%2014%20st">A downtown 14 st</a>`);
  expect(page).toContain(`<a href="/?q=M15%20south%20ferry">M15 south ferry</a>`);
});

test("partial response carries the whole hint element, compact after an answer", () => {
  expect(renderPartial(subway).hint).toStartWith(`<div id="hint" class="hint compact">`);
  expect(renderPartial(null)).toMatchObject({ ans: "" });
  expect(renderPartial(null).hint).toStartWith(`<div id="hint" class="hint">`);
});
