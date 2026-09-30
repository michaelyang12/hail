import { expect, test } from "bun:test";
import { fmtMins, renderAnswer, renderPage, type Answer, type BusAnswer } from "../src/render";
import { stations } from "../src/stations";

const a31 = stations.find((s) => s.stopId === "A31")!;
const ok: Answer = {
  kind: "ok",
  line: "A",
  station: a31,
  also: [],
  groups: [{ dir: "S", label: "Downtown", running: true, arrivals: [{ dir: "S", route: "A", secs: 70 }, { dir: "S", route: "A", secs: 610 }] }],
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
  expect(html).toContain("<b>1</b> min");
  expect(html).toContain("<b>10</b> min");
  expect(html).not.toContain("old");
});

test("per-train bullets only when routes differ", () => {
  expect(renderAnswer(ok).match(/class="bullet/g)).toHaveLength(1);
  const g = { ...ok.groups[0]!, arrivals: [{ dir: "S" as const, route: "6X", secs: 70 }, { dir: "S" as const, route: "6", secs: 300 }] };
  const html = renderAnswer({ ...ok, line: "6", groups: [g] });
  expect(html).toContain(`class="bullet x"`);
  expect(html.match(/class="bullet/g)).toHaveLength(3);
});

test("stale data is flagged", () => {
  expect(renderAnswer({ ...ok, ageSecs: 180 })).toContain("data 3m old");
});

test("empty direction says whether the line is running at all", () => {
  const empty = (running: boolean) => renderAnswer({ ...ok, groups: [{ dir: "N", label: "Uptown", running, arrivals: [] }] });
  expect(empty(true)).toContain("no A trains coming here right now");
  expect(empty(false)).toContain("no A trains running right now");
});

test("user input is escaped", () => {
  const html = renderPage('<script>alert(1)</script>', { kind: "error", slot: "stop", message: 'no A stop like "<b>"' });
  expect(html).not.toContain("<script>alert(1)");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain('"<b>"');
});

test("error highlights the failing template slot", () => {
  const html = renderPage("X 14", { kind: "error", slot: "line", message: 'line "X" not found' });
  expect(html).toMatch(/class="slot on"[^>]*>line/);
  expect(html).not.toMatch(/class="slot on"[^>]*>stop/);
});

test("empty page has placeholder and no answer", () => {
  const html = renderPage("", null);
  expect(html).toContain('placeholder="A downtown 14th st"');
  expect(html).toContain(`id="hint" class="hint"`);
});

const bus: BusAnswer = {
  kind: "bus",
  route: { key: "M15", name: "M15", color: "006CB7", text: "FFFFFF" },
  groups: [
    {
      dir: "S",
      label: "South Ferry",
      stop: "2 Av/E 22 St",
      arrivals: [
        { dir: 1, route: "M15", secs: 10, stopsAway: 0, proximity: "at stop" },
        { dir: 1, route: "M15", secs: 190, stopsAway: 2, proximity: "2 stops away" },
      ],
    },
  ],
  also: [],
  ageSecs: 5,
};

test("bus answer: badge, headsign before arrow, minutes plus stops away", () => {
  const html = renderAnswer(bus);
  expect(html).toContain(`class="badge" style="--c:#006CB7;--t:#FFFFFF">M15<`);
  expect(html).toContain(`<span class="to">South Ferry</span><span class="cmp">↓</span>`);
  expect(html).toContain("2 Av/E 22 St");
  expect(html).toContain(`<span class="t now"><span><b>now</b></span><small>at stop</small>`);
  expect(html).toContain(`<span class="t"><span><b>3</b> min</span><small>2 stops</small>`);
});

test("bus without a prediction shows distance, not a time", () => {
  const g = { ...bus.groups[0]!, arrivals: [{ dir: 1 as const, route: "M15", secs: null, stopsAway: 31, proximity: "4.1 miles away" }] };
  const html = renderAnswer({ ...bus, groups: [g] });
  expect(html).toContain("4.1 miles away");
  expect(html).toContain(`class="t far"><span><b>—</b>`);
});

test("bus groups at different corners name their stop", () => {
  const html = renderAnswer({
    ...bus,
    groups: [
      { dir: "N", label: "East Harlem 125 St", stop: "1 Av/E 23 St", arrivals: [] },
      { ...bus.groups[0]!, arrivals: [] },
    ],
    also: ["2 Av/E 25 St"],
  });
  expect(html).toContain(`East Harlem 125 St</span><span class="cmp">↑</span><span class="where">1 Av/E 23 St</span>`);
  expect(html).toContain("no M15 buses on the way");
  expect(html).toContain(`href="/?q=M15%202%20Av%2FE%2025%20St"`);
});

test("hint examples are links that work without JS", () => {
  const html = renderPage("", null);
  expect(html).toContain(`<a href="/?q=A%20downtown%2014%20st">A downtown 14 st</a>`);
  expect(html).toContain(`<a href="/?q=M15%20south%20ferry">M15 south ferry</a>`);
});
