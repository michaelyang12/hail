import { log } from "./log";

// A per-key promise cache for feed responses. Entries just expire: they are
// swept when a new key is loaded, and a failed load is dropped so the next
// request retries. Hits log at debug; each upstream load logs once at info,
// in the context of the request that triggered it.
export function ttlCache<T>(name: string, ttlSecs: number) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, now: number, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now - hit.at < ttlSecs) {
        log().debug({ cache: name, cacheKey: key, ageSecs: Math.round(now - hit.at) }, "cache hit");
        return hit.value;
      }
      for (const [k, e] of entries) if (now - e.at >= ttlSecs) entries.delete(k);
      const started = performance.now();
      const value = load();
      entries.set(key, { at: now, value });
      value.then(
        () => log().info({ upstream: name, cacheKey: key, ms: Math.round(performance.now() - started) }, "upstream fetch"),
        () => entries.delete(key),
      );
      return value;
    },
    clear: () => entries.clear(),
  };
}
