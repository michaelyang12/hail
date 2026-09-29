import { answer } from "./answer";
import { hintState, renderAnswer, renderPage } from "./render";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";
const headers = { "Cache-Control": "no-store" };

const server = Bun.serve({
  port,
  hostname,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method !== "GET" || url.pathname !== "/") return new Response("not found", { status: 404 });

    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const a = q ? await answer(q) : null;

    if (url.searchParams.has("partial")) {
      const hint = hintState(a);
      return Response.json({ ans: a ? renderAnswer(a) : "", hint: hint.html, compact: hint.compact }, { headers });
    }
    return new Response(renderPage(q, a), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  },
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
