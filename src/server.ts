import { handle } from "./app";
import { rootLogger as log } from "./log";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

const server = Bun.serve({
  port,
  hostname,
  fetch: (req) => handle(req),
  // Last resort; handle() already catches and logs its own failures.
  error(err) {
    log.error({ err }, "unhandled server error");
    return new Response("internal error", { status: 500 });
  },
});

log.info({ host: server.hostname, port: server.port, logLevel: log.level }, "listening");

// As PID 1 in a container, signals without a handler are ignored, so `docker stop` would hang until SIGKILL.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    log.info({ signal: sig }, "shutting down");
    server.stop();
    process.exit(0);
  });
}
