import { beforeEach, expect, test } from "bun:test";
import { BusFeedError, clearBusCache, extractBusArrivals, getBusArrivals } from "../src/bus/feed";

// Built from the SIRI v2 StopMonitoring schema Bus Time documents, not recorded live.
const fixture = await Bun.file(new URL("./fixtures/siri-m15.json", import.meta.url)).json();
const errFixture = await Bun.file(new URL("./fixtures/siri-error.json", import.meta.url)).json();
const now = Date.parse("2026-09-29T08:30:10.000-04:00") / 1000;
const M15 = new Set(["MTA NYCT_M15"]);

beforeEach(clearBusCache);

test("extracts this route's buses, predicted first, then by distance", () => {
  const r = extractBusArrivals(fixture, M15, now);
  expect(r.ageSecs).toBe(5);
  expect(r.arrivals).toEqual([
    { dir: 1, route: "M15", secs: 10, stopsAway: 0, proximity: "at stop" },
    { dir: 1, route: "M15", secs: 360, stopsAway: 4, proximity: "4 stops away" },
    { dir: 1, route: "M15", secs: null, stopsAway: 31, proximity: "4.1 miles away" },
  ]);
});

test("reads SIRI v1 distances too", () => {
  const v1 = {
    Siri: {
      ServiceDelivery: {
        StopMonitoringDelivery: [
          {
            MonitoredStopVisit: [
              {
                MonitoredVehicleJourney: {
                  LineRef: "MTA NYCT_M15",
                  DirectionRef: "0",
                  PublishedLineName: "M15",
                  MonitoredCall: { Extensions: { Distances: { PresentableDistance: "approaching", StopsFromCall: 1 } } },
                },
              },
            ],
          },
        ],
      },
    },
  };
  expect(extractBusArrivals(v1, M15, now).arrivals).toEqual([{ dir: 0, route: "M15", secs: null, stopsAway: 1, proximity: "approaching" }]);
});

test("Bus Time error conditions become BusFeedError", () => {
  expect(() => extractBusArrivals(errFixture, M15, now)).toThrow("Bus Time: API key is not authorized.");
  expect(() => extractBusArrivals({} as never, M15, now)).toThrow(BusFeedError);
});

test("request parameters and 20s cache", async () => {
  const urls: string[] = [];
  const fetcher = async (url: string) => (urls.push(url), Response.json(fixture));
  await getBusArrivals("401739", ["MTA NYCT_M15"], now, fetcher, "k");
  await getBusArrivals("401739", ["MTA NYCT_M15"], now + 19, fetcher, "k");
  expect(urls).toHaveLength(1);
  const u = new URL(urls[0]!);
  expect(u.origin + u.pathname).toBe("https://bustime.mta.info/api/siri/stop-monitoring.json");
  expect(Object.fromEntries(u.searchParams)).toEqual({
    key: "k",
    version: "2",
    MonitoringRef: "401739",
    StopMonitoringDetailLevel: "normal",
    LineRef: "MTA NYCT_M15",
  });
  await getBusArrivals("401739", ["MTA NYCT_M15"], now + 20, fetcher, "k");
  expect(urls).toHaveLength(2);
});

test("routes with two operators are filtered locally", async () => {
  let url = "";
  await getBusArrivals("1", ["MTABC_Q06", "MTA NYCT_Q6"], now, async (u) => ((url = u), Response.json(fixture)), "k");
  expect(new URL(url).searchParams.has("LineRef")).toBe(false);
});

test("failures become BusFeedError and aren't cached", async () => {
  await expect(getBusArrivals("1", ["r"], now, async () => Response.json({}), "")).rejects.toThrow("BUSTIME_API_KEY");
  await expect(getBusArrivals("1", ["r"], now, async () => new Response("oops", { status: 503 }), "k")).rejects.toThrow("Bus Time error 503");
  await expect(getBusArrivals("1", ["r"], now, async () => { throw new TypeError("network"); }, "k")).rejects.toThrow("Bus Time unavailable");
  await expect(getBusArrivals("1", ["r"], now, async () => Response.json(errFixture, { status: 403 }), "k")).rejects.toThrow("not authorized");
  const ok = await getBusArrivals("1", ["MTA NYCT_M15"], now, async () => Response.json(fixture), "k");
  expect(ok.arrivals).toHaveLength(3);
});
