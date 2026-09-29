import { expect, test } from "bun:test";
import { fmtMins, renderAnswer, renderPage, type Answer } from "../src/render";
import { stations } from "../src/stations";

const a31 = stations.find((s) => s.stopId === "A31")!;
const ok: Answer = {
  kind: "ok",
  line: "A",
  station: a31,
  also: [],
  groups: [{ dir: "S", label: "Downtown", arrivals: [{ dir: "S", route: "A", secs: 70 }, { dir: "S", route: "A", secs: 610 }] }],
  ageSecs: 10,
};

test("minute formatting", () => {
  expect(fmtMins(-10)).toBe("now");
  expect(fmtMins(20)).toBe("now");
  expect(fmtMins(45)).toBe("1 min");
  expect(fmtMins(89)).toBe("1 min");
  expect(fmtMins(600)).toBe("10 min");
});

test("answer shows station, direction, arrivals", () => {
  const html = renderAnswer(ok);
  expect(html).toContain("14 St");
  expect(html).toContain("Downtown");
  expect(html).toContain("1 min");
  expect(html).toContain("10 min");
  expect(html).not.toContain("old");
});

test("stale data is flagged", () => {
  expect(renderAnswer({ ...ok, ageSecs: 180 })).toContain("data 3m old");
});

test("empty direction says so", () => {
  const html = renderAnswer({ ...ok, groups: [{ dir: "N", label: "Uptown", arrivals: [] }] });
  expect(html).toContain("no A trains scheduled");
});

test("user input is escaped", () => {
  const html = renderPage('<script>alert(1)</script>', { kind: "error", slot: "stop", message: 'no A stop like "<b>"' });
  expect(html).not.toContain("<script>alert(1)");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain('"<b>"');
});

test("error highlights the failing template slot", () => {
  const html = renderPage("X 14", { kind: "error", slot: "line", message: 'line "X" not found' });
  expect(html).toMatch(/class="slot on"[^>]*>LINE/);
  expect(html).not.toMatch(/class="slot on"[^>]*>STOP/);
});

test("empty page has placeholder and no answer", () => {
  const html = renderPage("", null);
  expect(html).toContain('placeholder="A downtown 14th st"');
  expect(html).toContain(`id="hint" class="hint"`);
});
