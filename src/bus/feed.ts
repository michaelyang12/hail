type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type BusArrival = {
  dir: 0 | 1 | null;
  route: string; // published name, e.g. "M15-SBS"
  secs: number | null; // null when Bus Time has no prediction yet (bus still far out or on layover)
  stopsAway: number | null;
  proximity: string; // "approaching", "2 stops away", "1.3 miles away", "at stop"
};
export type BusFeedResult = { arrivals: BusArrival[]; ageSecs: number };

export class BusFeedError extends Error {}

const BASE = "https://bustime.mta.info/api/siri/stop-monitoring.json";
const CACHE_TTL = 20;
const TIMEOUT_MS = 3000;

// The parts of a SIRI v2 StopMonitoring response we read. v1 puts the distances
// under MonitoredCall.Extensions.Distances instead, so both are accepted.
type Call = {
  ExpectedArrivalTime?: string;
  AimedArrivalTime?: string;
  ArrivalProximityText?: string;
  NumberOfStopsAway?: number;
  Extensions?: { Distances?: { PresentableDistance?: string; StopsFromCall?: number } };
};
type Journey = {
  LineRef?: string;
  DirectionRef?: string;
  PublishedLineName?: string | string[];
  MonitoredCall?: Call;
};
type Siri = {
  Siri?: {
    ServiceDelivery?: {
      ResponseTimestamp?: string;
      StopMonitoringDelivery?: {
        MonitoredStopVisit?: { MonitoredVehicleJourney?: Journey }[];
        ErrorCondition?: { Description?: string; OtherError?: { ErrorText?: string } };
      }[];
    };
  };
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function extractBusArrivals(body: Siri, refs: Set<string>, now: number): BusFeedResult {
  const sd = body.Siri?.ServiceDelivery;
  const delivery = sd?.StopMonitoringDelivery?.[0];
  if (!sd || !delivery) throw new BusFeedError("unexpected Bus Time response");
  const err = delivery.ErrorCondition;
  if (err) throw new BusFeedError(`Bus Time: ${err.Description ?? err.OtherError?.ErrorText ?? "error"}`);

  const arrivals: BusArrival[] = [];
  for (const visit of delivery.MonitoredStopVisit ?? []) {
    const j = visit.MonitoredVehicleJourney;
    const call = j?.MonitoredCall;
    if (!j || !call || !j.LineRef || !refs.has(j.LineRef)) continue;
    const when = call.ExpectedArrivalTime ?? call.AimedArrivalTime;
    const dist = call.Extensions?.Distances;
    const dir = j.DirectionRef === "0" ? 0 : j.DirectionRef === "1" ? 1 : null;
    arrivals.push({
      dir,
      route: one(j.PublishedLineName) || j.LineRef.replace(/^.*_/, ""),
      secs: when ? Math.max(0, Math.round(Date.parse(when) / 1000 - now)) : null,
      stopsAway: call.NumberOfStopsAway ?? dist?.StopsFromCall ?? null,
      proximity: call.ArrivalProximityText ?? dist?.PresentableDistance ?? "",
    });
  }
  // Predicted arrivals first, then buses without a prediction by how far away they are.
  arrivals.sort((a, b) => (a.secs ?? Infinity) - (b.secs ?? Infinity) || (a.stopsAway ?? Infinity) - (b.stopsAway ?? Infinity));
  const stamp = sd.ResponseTimestamp ? Date.parse(sd.ResponseTimestamp) / 1000 : now;
  return { arrivals, ageSecs: Math.max(0, Math.round(now - stamp)) };
}

async function fetchStop(stopId: string, refs: string[], key: string, fetcher: Fetcher): Promise<Siri> {
  const url = new URL(BASE);
  url.searchParams.set("key", key);
  url.searchParams.set("version", "2");
  url.searchParams.set("MonitoringRef", stopId);
  url.searchParams.set("StopMonitoringDetailLevel", "minimum");
  // A route run by both NYCT and MTA Bus has two refs; then filter locally instead.
  if (refs.length === 1) url.searchParams.set("LineRef", refs[0]!);
  let res: Response;
  try {
    res = await fetcher(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new BusFeedError("Bus Time unavailable, try again");
  }
  // Bus Time reports a bad key as JSON with an ErrorCondition, sometimes with a 4xx status.
  const body = (await res.json().catch(() => null)) as Siri | null;
  if (body?.Siri) return body;
  throw new BusFeedError(res.ok ? "unexpected Bus Time response" : `Bus Time error ${res.status}`);
}

const cache = new Map<string, { at: number; body: Promise<Siri> }>();

export async function getBusArrivals(
  stopId: string,
  refs: string[],
  now = Date.now() / 1000,
  fetcher: Fetcher = fetch,
  key = process.env.BUSTIME_API_KEY,
): Promise<BusFeedResult> {
  if (!key) throw new BusFeedError("bus arrivals aren't set up (BUSTIME_API_KEY missing)");
  const ck = `${stopId}|${refs.join(",")}`;
  let hit = cache.get(ck);
  if (!hit || now - hit.at >= CACHE_TTL) {
    for (const [k, v] of cache) if (now - v.at >= CACHE_TTL) cache.delete(k);
    const body = fetchStop(stopId, refs, key, fetcher);
    hit = { at: now, body };
    cache.set(ck, hit);
    body.catch(() => cache.delete(ck));
  }
  return extractBusArrivals(await hit.body, new Set(refs), now);
}

export const clearBusCache = () => cache.clear();
