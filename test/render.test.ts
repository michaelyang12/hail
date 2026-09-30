import { expect, test } from "bun:test";
import { fmtMins, renderAnswer, renderPage, type Answer, type BusAnswer } from "../src/render";
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

test("bus answer: badge, headsign, minutes plus stops away", () => {
  const html = renderAnswer(bus);
  expect(html).toContain(`class="badge" style="--c:#006CB7;--t:#FFFFFF">M15<`);
  expect(html).toContain("↓ South Ferry");
  expect(html).toContain("2 Av/E 22 St");
  expect(html).toMatch(/at stop<\/span><span class="eta now">now</);
  expect(html).toMatch(/2 stops<\/span><span class="eta">3 min</);
});

test("bus without a prediction shows distance, not a time", () => {
  const g = { ...bus.groups[0]!, arrivals: [{ dir: 1 as const, route: "M15", secs: null, stopsAway: 31, proximity: "4.1 miles away" }] };
  const html = renderAnswer({ ...bus, groups: [g] });
  expect(html).toContain("4.1 miles away");
  expect(html).toContain(`class="eta far">—`);
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
  expect(html).toContain("↑ East Harlem 125 St · 1 Av/E 23 St");
  expect(html).toContain("no M15 buses on the way");
  expect(html).toContain(`href="/?q=M15%202%20Av%2FE%2025%20St"`);
});

test("hint row shows a train and a bus example", () => {
  const html = renderPage("", null);
  expect(html).toContain(`<span class="ex">A</span>`);
  expect(html).toContain(`<span class="ex">M15</span>`);
  expect(html).toContain("nyc subway · bus");
});
