// A per-key promise cache for feed responses. Entries just expire: they are
// swept when a new key is loaded, and a failed load is dropped so the next
// request retries.
export function ttlCache<T>(ttlSecs: number) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, now: number, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now - hit.at < ttlSecs) return hit.value;
      for (const [k, e] of entries) if (now - e.at >= ttlSecs) entries.delete(k);
      const value = load();
      entries.set(key, { at: now, value });
      value.catch(() => entries.delete(key));
      return value;
    },
    clear: () => entries.clear(),
  };
}
