# hail

On-demand NYC subway arrivals. Type `A downtown 14th st`, get the next two trains.

Single-input page, server-rendered by Bun. MTA realtime feeds are fetched only when a query comes in (cached 20s). Works without JavaScript; every query is a bookmarkable URL like `/?q=A+downtown+14th+st`.

## Query

```
LINE   [DIR]                                  STOP
A      up / down / n / s / bronx / brooklyn   14th st
```

Direction is optional (omit it for both directions). Borough words are matched against each station's own direction labels.

## Develop

```sh
bun install
bun run dev        # http://127.0.0.1:3000, reloads on change
bun test
bun run typecheck
```

`PORT` and `HOST` env vars override the defaults (`3000`, `127.0.0.1`).

## Deploy (systemd user service + Cloudflare Tunnel)

```sh
git clone git@github.com:michaelyang12/hail.git ~/hail && cd ~/hail && bun install --production
mkdir -p ~/.config/systemd/user && cp deploy/hail.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now hail
loginctl enable-linger "$USER"   # keep running when logged out
```

Then add a tunnel ingress rule, e.g. in `~/.cloudflared/config.yml`:

```yaml
- hostname: hail.example.com
  service: http://localhost:3000
```

## Data

`data/stations.csv` is the MTA station list from [data.ny.gov](https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f). Refresh occasionally:

```sh
curl -L -o data/stations.csv "https://data.ny.gov/api/views/39hk-dx4f/rows.csv?accessType=DOWNLOAD"
```
