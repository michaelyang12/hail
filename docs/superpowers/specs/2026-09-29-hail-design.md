# hail — design

On-demand NYC subway arrivals. Type `A downtown 14th st`, get the next two trains. A single-input website served from a home server via Cloudflare Tunnel. Free to run.

## Goals

- One text input, one answer. Nothing else.
- Fetch MTA data only when a query arrives. No background polling.
- Minimal page weight: server-rendered HTML, no framework, works without JS.
- Teenage Engineering aesthetic: off-white panel, monospace/dot-matrix type, single orange accent, LCD-style readout.

## Non-goals

- Pinned/live-updating displays, accounts, persistence, service alerts, multi-leg trips, buses.

## Stack

- Bun + TypeScript, `Bun.serve`.
- One dependency: `gtfs-realtime-bindings` (protobuf decode).
- Station data: MTA `Stations.csv` (data.ny.gov), committed at `data/stations.csv`.
- Realtime data: MTA GTFS-Realtime subway feeds (no API key), e.g. `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace`.

## Architecture

```
src/
  server.ts    Bun.serve; GET / renders page; GET /?q=... renders page with answer
  parse.ts     query -> { line, dir?, stopText }
  stations.ts  load stations.csv once at startup; stations serving a line
  match.ts     fuzzy match stopText against a line's stations
  feed.ts      line -> feed URL; fetch, decode, filter, next arrivals
  render.ts    HTML page (template hint, answer, errors)
data/
  stations.csv
```

Request flow:

```
q -> parse -> stations on line -> fuzzy match -> fetch line's feed
  -> filter stop_id + dir (e.g. A31S) -> next 2 arrivals -> render
```

### Caching

Per-feed in-memory cache with ~20s TTL, populated only on request. Collapses rapid refreshes into one MTA fetch. No timers, no background work.

## Query parsing (`parse.ts`)

1. First token is always the line (case-insensitive; validated against known routes). Anchoring avoids ambiguity with stop names like `7 av`.
2. Direction is any token from:
   - north: `up`, `uptown`, `north`, `n`, `nb`
   - south: `down`, `downtown`, `south`, `s`, `sb`
   - borough words: `bronx`, `brooklyn`, `queens`, `manhattan` — deferred; resolved after station match against that station's North/South direction labels in `stations.csv`.
3. Remaining tokens form `stopText`.
4. Direction is optional. If omitted, show both directions.

## Normalization (applied to query and station names)

- lowercase
- ordinals: `14th` -> `14`
- `street` -> `st`; `avenue`, `ave` -> `av`
- `&` -> `and`
- strip punctuation

## Fuzzy match (`match.ts`)

- Candidates: only stations whose routes include the parsed line.
- Score each candidate; highest wins. Scoring combines token-prefix overlap (abbreviations) with edit distance (typos).
- Ties: show the winner plus `also: <other names>`.
- No candidate above threshold: error.

## Output

```
> A downtown 14th st
  14 ST · A C E
  ↓ DOWNTOWN & BROOKLYN
  A    1 min
  A   10 min
```

- Direction label from `stations.csv`.
- Minutes rounded down; under 30s shows `now`.
- Route shown per row (feeds include other lines sharing the stop).
- No direction given: both directions, two arrivals each.

## Template hint

Always visible beneath the input (shrinks once an answer is shown):

```
LINE   [DIR]          STOP
A      up / down      14th st
       n / s · bronx / brooklyn / queens
```

- Input placeholder: `A downtown 14th st`.
- On error, the failing slot (`LINE` or `STOP`) is highlighted in the accent color.

## Errors

| Case | Message |
|---|---|
| Unknown line | `line "X" not found` (highlight LINE) |
| No stop match | `no A stop like "fultn"` (highlight STOP) |
| No upcoming trips | `no A trains scheduled` |
| Feed timeout (3s) / error | `MTA feed unavailable, try again` |
| Feed header timestamp > ~2 min old | answer plus `data Nm old` tag |

## Client JS (optional, ~15 lines)

- Progressive enhancement: intercept submit, fetch `/?q=...`, swap the answer region without full reload.
- Up-arrow recalls recent queries (localStorage, wrapped in try/catch).
- Page works fully without it; `/?q=...` URLs are bookmarkable favorites.

## Testing

- `bun test`, no network:
  - `parse.test.ts`: line detection, direction keywords, `A 7 av` style cases.
  - `match.test.ts`: fixed table of real query -> expected stop ID pairs (regression net for the scoring function).
  - `feed.test.ts`: decode a committed protobuf fixture; filtering, staleness, minute rounding with injected clock.
- `bun run dev` (`bun --watch src/server.ts`) on `localhost:3000` against live feeds for manual testing.

## Deployment (after local validation)

- Clone to home server, `bun install`.
- systemd service running `bun src/server.ts`, bound to `127.0.0.1:3000`, restart on failure.
- Cloudflare Tunnel ingress: `hail.<domain>` -> `http://localhost:3000`.
- Optional: Cloudflare Access for privacy.
