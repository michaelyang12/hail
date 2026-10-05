import { expect, test } from "bun:test";
import { handle, type Deps } from "../src/app";
import { clearBusCache, getBusArrivals } from "../src/bus/feed";
import { FeedError, orFeedError } from "../src/errors";
import { createLogger, scrub, withLogger } from "../src/log";
import { errorAnswer } from "../src/model";

function capture(level = "debug") {
  const lines: Record<string, any>[] = [];
  const logger = createLogger({ write: (s: string) => void lines.push(JSON.parse(s)) }, level);
  return { logger, lines };
}

const deps: Deps = {
  subway: async () => errorAnswer("stop", 'no A stop like "zz"'),
  bus: async () => errorAnswer(null, "bus stub"),
};
const get = (path: string, logger: ReturnType<typeof capture>["logger"], headers?: HeadersInit) =>
  handle(new Request(`http://x${path}`, { headers }), deps, logger);

test("each request ends with one info line carrying the query and outcome", async () => {
  const { logger, lines } = capture();
  await get("/?q=A+zz&partial", logger);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ level: 30, msg: "request", service: "hail", method: "GET", path: "/", status: 200, q: "A zz", mode: "subway", kind: "error", error: 'no A stop like "zz"', partial: true });
  expect(typeof lines[0]!.ms).toBe("number");
  expect(lines[0]!.reqId).toHaveLength(8);
});

test("the Cloudflare ray id becomes the request id", async () => {
  const { logger, lines } = capture();
  await get("/?q=A+zz", logger, { "cf-ray": "8c1f2a3b4c5d6e7f-EWR" });
  expect(lines[0]!.reqId).toBe("8c1f2a3b4c5d6e7f-EWR");
});

test("the empty page (healthcheck) logs at debug, not info", async () => {
  const { logger, lines } = capture("info");
  await get("/", logger);
  expect(lines).toHaveLength(0);
});

test("a throwing handler is logged as an error and answered with 500", async () => {
  const { logger, lines } = capture();
  const res = await handle(new Request("http://x/?q=A+14"), { ...deps, subway: async () => { throw new Error("boom"); } }, logger);
  expect(res.status).toBe(500);
  expect(lines[0]).toMatchObject({ level: 50, msg: "request failed", status: 500, err: { message: "boom" } });
});

test("feed errors are logged at warn with their cause, riders see only the message", async () => {
  const { logger, lines } = capture();
  const a = await withLogger(logger, () =>
    orFeedError(Promise.reject(new FeedError("MTA feed unavailable, try again", { cause: new Error("gtfs-ace: HTTP 503") }))),
  );
  expect(a).toEqual(errorAnswer(null, "MTA feed unavailable, try again"));
  // Pino folds the cause into the logged message and stack.
  expect(lines[0]).toMatchObject({ level: 40, msg: "feed error", err: { type: "FeedError", message: "MTA feed unavailable, try again: gtfs-ace: HTTP 503" } });
});

test("the Bus Time key never reaches an error, even when fetch quotes the URL", async () => {
  clearBusCache();
  const key = "sekrit-key-123";
  const fetcher = async (url: string) => { throw new Error(`connect failed for ${url}`); };
  const err = await getBusArrivals("401687", ["MTA NYCT_M15"], 0, fetcher, key).catch((e) => e);
  expect(err).toBeInstanceOf(FeedError);
  expect(String(err.cause.message)).toContain("[redacted]");
  expect(String(err.cause.message)).not.toContain(key);
});

test("objects carrying a key are censored", () => {
  const { logger, lines } = capture();
  logger.info({ key: "sekrit", upstream: { key: "sekrit" } }, "x");
  expect(JSON.stringify(lines[0])).not.toContain("sekrit");
  expect(scrub("a sekrit b", "sekrit")).toBe("a [redacted] b");
  expect(scrub("unchanged", undefined)).toBe("unchanged");
});
