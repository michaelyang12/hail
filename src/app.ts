import { answer } from "./answer";
import { busAnswer } from "./bus/api";
import type { Answer } from "./render";
import { hintState, renderAnswer, renderPage } from "./render";
import { modeOf } from "./route";

export type Deps = { subway: (q: string) => Promise<Answer>; bus: (q: string) => Promise<Answer> };

const headers = { "Cache-Control": "no-store" };
const defaults: Deps = { subway: (q) => answer(q), bus: (q) => busAnswer(q) };

const queryOf = (url: URL) => (url.searchParams.get("q") ?? "").trim().slice(0, 100);

export async function handle(req: Request, deps: Deps = defaults): Promise<Response> {
  const url = new URL(req.url);
  if (req.method !== "GET") return new Response("not found", { status: 404 });

  // Bus-only JSON, for debugging and scripts.
  if (url.pathname === "/bus") {
    const q = queryOf(url);
    return Response.json(q ? await deps.bus(q) : null, { headers });
  }
  if (url.pathname !== "/") return new Response("not found", { status: 404 });

  const q = queryOf(url);
  const a = q ? await (modeOf(q) === "bus" ? deps.bus : deps.subway)(q) : null;

  if (url.searchParams.has("partial")) {
    const hint = hintState(a);
    return Response.json({ ans: a ? renderAnswer(a) : "", hint: hint.html, compact: hint.compact }, { headers });
  }
  return new Response(renderPage(q, a), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
