# Ledger

Current state of hail. Update this in the same PR as any feature change. It records what is true now, not a changelog; `git log` has the history.

_Last updated: 2026-09-29_

## Working

- Query grammar `LINE [DIR] STOP`. Directions: up/down/n/s/north/south/nb/sb, or a borough word matched against the station's own direction labels. `SI` maps to `SIR`.
- Fuzzy stop matching: aliases (street→st, avenue→av…), ordinals stripped, numbers must match exactly, prefix and edit-distance scoring. Close ties are listed as "also:" links.
- All subway lines, including express variants (6X, 7X, FX), the three S shuttles, and SIR.
- Next 2 arrivals per direction. Sub-30s shows "now". At terminals the "Last Stop" side is hidden unless asked for explicitly.
- Stale-data notice when the feed is more than 2 min old. Friendly error when the MTA feed is down (3s timeout).
- Per-feed 20s in-memory cache, filled only on request.
- Works without JS; with JS, submits use `?partial=1` and keep up/down-arrow query history in localStorage (last 10).
- The UI scales with the viewport (phone and desktop).
- Deploy: Dockerfile (graceful SIGTERM) or systemd user unit (`deploy/hail.service`), both behind a Cloudflare Tunnel.

## Known gaps

- No service alerts, and no handling of planned work or reroutes (non-goal for now).
- No CI. Tests and typecheck run locally only.
- `data/stations.csv` is refreshed by hand.

## Ideas / next

- ?
