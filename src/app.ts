import type { Logger } from "pino";
import { answer } from "./answer";
import { busAnswer } from "./bus/api";
import { rootLogger, withLogger } from "./log";
import type { Answer } from "./model";
import { renderPage, renderPartial } from "./render";
import { modeOf } from "./route";

export type Deps = { subway: (q: string) => Promise<Answer>; bus: (q: string) => Promise<Answer> };

const headers = { "Cache-Control": "no-store" };
const defaults: Deps = { subway: (q) => answer(q), bus: (q) => busAnswer(q) };

const queryOf = (url: URL) => (url.searchParams.get("q") ?? "").trim().slice(0, 100);

type Outcome = { res: Response; fields?: Record<string, unknown> };

const notFound = (): Outcome => ({ res: new Response("not found", { status: 404 }) });

async function route(req: Request, url: URL, deps: Deps): Promise<Outcome> {
  if (req.method !== "GET") return notFound();

  // Bus-only JSON, for debugging and scripts.
  if (url.pathname === "/bus") {
    const q = queryOf(url);
    const a = q ? await deps.bus(q) : null;
    return { res: Response.json(a, { headers }), fields: { q, mode: "bus", kind: a?.kind } };
  }
  if (url.pathname !== "/") return notFound();

  const q = queryOf(url);
  const mode = q ? modeOf(q) : undefined;
  const a = q ? await (mode === "bus" ? deps.bus : deps.subway)(q) : null;
  const partial = url.searchParams.has("partial");
  const fields = { q, mode, kind: a?.kind, error: a?.kind === "error" ? a.message : undefined, partial };

  if (partial) return { res: Response.json(renderPartial(q, a), { headers }), fields };
  return { res: new Response(renderPage(q, a), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } }), fields };
}

// Every request runs under a child logger tagged with an id (Cloudflare's ray id when
// behind the tunnel, so a log line can be matched to the edge), and ends with one line.
export async function handle(req: Request, deps: Deps = defaults, logger: Logger = rootLogger): Promise<Response> {
  const started = performance.now();
  const url = new URL(req.url);
  const reqLog = logger.child({ reqId: req.headers.get("cf-ray") ?? crypto.randomUUID().slice(0, 8) });
  const base = () => ({ method: req.method, path: url.pathname, ms: Math.round(performance.now() - started) });

  return withLogger(reqLog, async () => {
    try {
      const { res, fields } = await route(req, url, deps);
      const line = { ...base(), status: res.status, ...fields };
      // The Docker healthcheck loads the empty page every 30s; keep that out of info.
      if (url.pathname === "/" && !fields?.q) reqLog.debug(line, "request");
      else reqLog.info(line, "request");
      return res;
    } catch (err) {
      reqLog.error({ ...base(), status: 500, err }, "request failed");
      return new Response("internal error", { status: 500 });
    }
  });
}
