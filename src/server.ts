import { handle } from "./app";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

const server = Bun.serve({
  port,
  hostname,
  fetch: (req) => handle(req),
  error(err) {
    console.error(err);
    return new Response("internal error", { status: 500 });
  },
});

console.log(`hail listening on http://${server.hostname}:${server.port}`);

// As PID 1 in a container, signals without a handler are ignored, so `docker stop` would hang until SIGKILL.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    server.stop();
    process.exit(0);
  });
}
