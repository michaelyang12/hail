# AGENTS.md

hail: on-demand NYC subway arrivals. One text input (`A downtown 14th st`) → next two trains per direction. Bun + TypeScript, server-rendered HTML, no framework, self-hosted behind a Cloudflare Tunnel.

Current state, known gaps, and next ideas live in `LEDGER.md`. Read it first.

## Commands

```sh
bun install
bun run dev            # http://127.0.0.1:3000, reloads on change
bun test               # offline, uses fixtures in test/fixtures/
bun test test/answer.test.ts -t "borough"   # one file / tests matching a name
bun run typecheck      # tsc --noEmit, strict + noUncheckedIndexedAccess
```

Before finishing any change, run: `bun test && bun run typecheck`

UI changes: also run `bun run dev` and check the page at phone and desktop widths, with and without JS.

## Layout

| Path | What |
|---|---|
| `src/server.ts` | `Bun.serve` entry. Only `GET /`: full page, or JSON when `?partial=1` |
| `src/model.ts` | `Answer` types shared by the answer builders and the renderer; `Slot`, error helpers |
| `src/answer.ts` | Subway orchestration: parse → match → feed → `Answer`. Start here |
| `src/bus/` | Bus equivalent: `parse`, `match`, `feed` (Bus Time SIRI), `api` (orchestration), `data` (`data/bus.json`) |
| `src/lines.ts` | Per-line table: feeds, feed route ids, express ids, colors; `displayRoute()` |
| `src/directions.ts` | Direction words, boroughs, arrows |
| `src/config.ts`, `src/cache.ts`, `src/errors.ts` | Shared TTLs and timeouts; the per-key feed cache; `FeedError` and `orFeedError()` |
| `src/parse.ts` | Query → line + direction/stop variants |
| `src/normalize.ts`, `src/match.ts` | Tokenizer shared by queries and station names; fuzzy stop scoring |
| `src/feed.ts` | MTA GTFS-RT fetch and arrival extraction |
| `src/board.ts` | `Board`: the one display shape for train and bus answers. Mode-specific presentation decisions live here |
| `src/render.ts` | All HTML, built with `html```. Draws a `Board`, the hint, the page. Inlines `style.css` and `client.js` via text imports |
| `src/html.ts` | `html``` tagged template (auto-escapes), `raw()`, `queryHref()` |
| `src/style.css` | Theme variables on `:root` (colors, type scale, spacing); rows are one CSS grid with subgrid |
| `src/client.js` | Optional progressive-enhancement JS (plain JS, not typechecked) |
| `data/stations.csv` | MTA station list from data.ny.gov. Refresh command in README |
| `test/fixtures/*.pb` | Captured real GTFS-RT feeds |

## Conventions

- Expected failures are values, not throws. Parsers return a `Failure` (`{ ok: false, slot, message }`); answer builders return an `ErrorAnswer` via `errorAnswer()`. `Slot` (`"line" | "stop"`, or `null`) records which part of the query failed; the hint no longer highlights it. Only `FeedError` is thrown, and `orFeedError()` converts it.
- Error messages are lowercase, terse, and user-facing: `no A stop like "fultn"`, `MTA feed unavailable, try again`.
- Inject I/O through default parameters for tests: `answer(q, deps = { getArrivals })`, `getArrivals(line, stopId, now, fetcher = fetch)`. Tests pass fakes. Never hit the network in tests.
- Tests live in `test/<module>.test.ts`, use `bun:test`, and assert on real station data (for example `A31` = 14 St on the A). See `test/answer.test.ts`.
- `noUncheckedIndexedAccess` is on. Use `!` only where the index is known valid, as the existing code does.
- Build HTML with `html```; it escapes every interpolated value. Use `raw()` only for trusted markup. Guard conditionals with booleans (`xs.length > 0 && ...`), since a bare `0` renders as "0".
- Train and bus answers render through the same `Board`. Put mode-specific display logic in `board.ts`, not in `render.ts`, so the two stay visually identical.
- CSS: use the `:root` variables instead of literal colors or sizes, and let grid/flex size things from content. No hand-computed widths.
- The page must work without JavaScript. Every state is a GET URL (`/?q=...`); `client.js` only upgrades form submits and query links to `?partial=1` fetches (`PartialResponse` in `render.ts`).
- Comments explain *why* (MTA quirks, invariants), not what. Keep that density.
- Direction labels come from the station CSV (`northLabel`/`southLabel`), not hardcoded boroughs. Some are `"NaN"` or `"Last Stop"`; see `label()` and the terminal filter in `answer.ts`.

## Adding support for a line or route variant

1. Add or edit the line's entry in `LINES` (`src/lines.ts`): feeds, any feed route ids that differ from its name, express ids, and colors. `displayRoute()` and the renderer read from it.
2. If riders call it something else (like `SI`), add it to `LINE_ALIASES`.
3. If you need a new feed fixture, save it to `test/fixtures/` and add a test in `test/feed.test.ts`.

## Don'ts

- Don't add background polling, timers, or cache refreshers. Feeds are fetched only when a request comes in (keeps it free and idle). The cache in `cache.ts` just expires.
- Don't add a frontend framework or build step. Bun serves `src/` directly, and the Dockerfile copies only `src/` and `data/`.
- Don't add dependencies without asking. There is one runtime dep (`gtfs-realtime-bindings`) on purpose.
- Don't hand-edit `data/stations.csv`. Re-download it (README), then run tests, which pin known stop ids.
- Don't break the SIGTERM/SIGINT handlers in `server.ts`. As PID 1 in Docker, the process would otherwise ignore `docker stop`.

## Git

- Work in a worktree under `.worktrees/` on a `feature-<name>` or `bugfix-<name>` branch, never directly on `main`:
  `git worktree add .worktrees/feature-foo -b feature-foo`
- Inside those branches you may commit and push freely. When the work is complete, open a PR with `gh pr create`.
- Never merge to `main` or push to `main` unless the user explicitly says to.
- Update `LEDGER.md` in the same PR when you add, change, or remove a feature.
- Commit messages: imperative, sentence case, no prefix, several changes joined with `;` (for example `Fix sub-minute display and hide terminating side at terminals; add tsconfig`).
