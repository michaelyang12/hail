# Ledger

Current state of hail. Update this in the same PR as any feature change. It records what is true now, not a changelog; `git log` has the history.

_Last updated: 2026-09-29_

## Working

- Query grammar `LINE [DIR] STOP`. Directions: up/down/n/s/north/south/nb/sb, or a borough word matched against the station's own direction labels. `SI` maps to `SIR`.
- Fuzzy stop matching: aliases (street→st, avenue→av…), ordinals stripped, numbers must match exactly, prefix and edit-distance scoring. Close ties are listed as "also:" links.
- All subway lines, including express variants (6X, 7X, FX), the three S shuttles, and SIR.
- Next 2 arrivals per direction, one row per direction. Sub-30s shows "now". At terminals the "Last Stop" side is hidden unless asked for explicitly. An empty direction says either "no X trains running" (no trip of the line in that direction in the feed) or "no X trains coming here" (trips running but none due at this stop: skipped or just passed; the feed alone can't tell which).
- Per-train route bullets appear only when routes differ within an answer (6 vs 6X express). Bus directions lead with the headsign; the compass arrow trails. Buses show minutes only, like trains; buses with no prediction yet are left out. The bus header names the stop; when the two directions stop at different corners, it names their shared street and each direction lists its corner.
- Stale-data notice when the feed is more than 2 min old. Friendly error when the MTA feed is down (3s timeout).
- Per-feed 20s in-memory cache, filled only on request.
- A refresh link (↻) in the top bar re-runs the current query when there are times to refresh; it works without JS, and with JS it re-fetches in place and spins while loading.
- Hint shows the grammar (failing slot highlighted on errors) and tappable example queries, all plain GET links.
- Works without JS; with JS, submits and links use `?partial=1`, the old answer dims while loading, the card animates to its new height (off under reduced motion), and after an answer the examples are replaced by recent queries. Up/down-arrow history in localStorage (last 10).
- The UI scales with the viewport (phone and desktop).
- Deploy: Dockerfile (graceful SIGTERM) or systemd user unit (`deploy/hail.service`), both behind a Cloudflare Tunnel.

## Known gaps

- No service alerts, and no handling of planned work or reroutes (non-goal for now).
- No CI. Tests and typecheck run locally only.
- `data/stations.csv` is refreshed by hand.

## Ideas / next

- ?
