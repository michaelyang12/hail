import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { ttlCache } from "./cache";
import { FEED_TIMEOUT_MS, FEED_TTL_SECS } from "./config";
import type { Dir } from "./directions";
import { FeedError } from "./errors";
import { feedsFor, routeIdsFor } from "./lines";

type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type Arrival = { dir: Dir; route: string; secs: number };
// running: directions with any trip of the line still ahead of it, whether or not it stops here.
export type FeedResult = { arrivals: Arrival[]; running: Dir[]; ageSecs: number };

const BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F";

export function decode(buf: Uint8Array): FeedMessage {
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
}

export function extractArrivals(msg: FeedMessage, routeIds: Set<string>, stopId: string, now: number): Arrival[] {
  const out: Arrival[] = [];
  for (const e of msg.entity) {
    const tu = e.tripUpdate;
    const route = tu?.trip.routeId;
    if (!tu || !route || !routeIds.has(route)) continue;
    for (const st of tu.stopTimeUpdate ?? []) {
      const id = st.stopId ?? "";
      const dir = id.slice(-1);
      if (id.length !== stopId.length + 1 || !id.startsWith(stopId) || (dir !== "N" && dir !== "S")) continue;
      const time = Number(st.arrival?.time ?? st.departure?.time ?? 0);
      if (!time) continue;
      const secs = time - now;
      if (secs >= -30) out.push({ dir, route, secs });
    }
  }
  return out.sort((a, b) => a.secs - b.secs);
}

// A trip's direction is the N/S suffix on its stop ids. Past stops drop out of the
// feed, so a trip counts only while it still has a stop ahead.
export function runningDirs(msg: FeedMessage, routeIds: Set<string>, now: number): Set<Dir> {
  const out = new Set<Dir>();
  for (const e of msg.entity) {
    const tu = e.tripUpdate;
    const route = tu?.trip.routeId;
    if (!tu || !route || !routeIds.has(route)) continue;
    for (const st of tu.stopTimeUpdate ?? []) {
      const dir = (st.stopId ?? "").slice(-1);
      const time = Number(st.arrival?.time ?? st.departure?.time ?? 0);
      if ((dir === "N" || dir === "S") && time >= now - 30) {
        out.add(dir);
        break;
      }
    }
  }
  return out;
}

const cache = ttlCache<FeedMessage>(FEED_TTL_SECS);

async function fetchFeed(path: string, fetcher: Fetcher): Promise<FeedMessage> {
  let res: Response;
  try {
    res = await fetcher(BASE + path, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  } catch {
    throw new FeedError("MTA feed unavailable, try again");
  }
  if (!res.ok) throw new FeedError("MTA feed unavailable, try again");
  return decode(new Uint8Array(await res.arrayBuffer()));
}

export async function getArrivals(
  line: string,
  stopId: string,
  now = Date.now() / 1000,
  fetcher: Fetcher = fetch,
): Promise<FeedResult> {
  const msgs = await Promise.all(feedsFor(line).map((p) => cache.get(p, now, () => fetchFeed(p, fetcher))));
  const routeIds = routeIdsFor(line);
  const arrivals = msgs.flatMap((m) => extractArrivals(m, routeIds, stopId, now)).sort((a, b) => a.secs - b.secs);
  const running = [...new Set(msgs.flatMap((m) => [...runningDirs(m, routeIds, now)]))];
  const oldest = Math.min(...msgs.map((m) => Number(m.header.timestamp)));
  return { arrivals, running, ageSecs: Math.max(0, Math.round(now - oldest)) };
}
