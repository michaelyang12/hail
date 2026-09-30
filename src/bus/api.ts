import type { Answer } from "../render";

export const TIMEOUT_MS = 3000;

type Impl = (q: string) => Promise<Answer>;

async function lookup(_q: string): Promise<Answer> {
  return { kind: "error", slot: null, message: "bus arrivals not available yet" };
}

// Never throws and never takes longer than timeoutMs: every failure becomes an
// error answer, so a broken bus module can't take subway queries down with it.
export async function busAnswer(q: string, impl: Impl = lookup, timeoutMs = TIMEOUT_MS): Promise<Answer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Answer>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "error", slot: null, message: "bus data timed out, try again" }), timeoutMs);
  });
  try {
    return await Promise.race([impl(q), timeout]);
  } catch (e) {
    console.error("bus:", e);
    return { kind: "error", slot: null, message: "bus data unavailable, try again" };
  } finally {
    clearTimeout(timer);
  }
}
