import { AsyncLocalStorage } from "node:async_hooks";
import pino, { type DestinationStream, type Logger } from "pino";

// JSON lines to stdout; systemd and Docker collect them. Pino's worker-thread
// transports are unreliable under Bun, so pretty output is a pipe (`bun run dev`).
// Tests run silent unless LOG_LEVEL says otherwise.
export function createLogger(dest?: DestinationStream, level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info")): Logger {
  return pino(
    {
      level,
      base: { service: "hail" },
      // Belt and braces: nothing should log the Bus Time key, but if an object carrying it does, it's censored.
      redact: { paths: ["key", "*.key", "apiKey", "*.apiKey"], censor: "[redacted]" },
    },
    dest,
  );
}

export const rootLogger = createLogger();

// Each request runs with a child logger (carrying its request id) in async context,
// so feed code deep in the call stack logs against the request without being passed it.
const context = new AsyncLocalStorage<Logger>();

export const log = (): Logger => context.getStore() ?? rootLogger;

export const withLogger = <T>(logger: Logger, fn: () => T): T => context.run(logger, fn);

// Error messages from fetch can include the request URL, which for Bus Time carries the key.
export const scrub = (text: string, secret: string | undefined) => (secret ? text.replaceAll(secret, "[redacted]") : text);
