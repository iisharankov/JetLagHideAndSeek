# Self-hosting on your server

**First time?** Follow [FIRST-DEPLOY.md](FIRST-DEPLOY.md): a step-by-step
setup without Authelia, including how map data gets onto the server.

Everything the app needs runs on your server, behind your nginx and Authelia.
Players' phones only ever talk to `jetlag.sharankov.com`.

> **Not yet run for real.** These files were written and checked without Docker
> access: the API, the basemap file and the security policy were tested
> locally, but the containers and the first import have not been run. Expect
> to adjust small things on the first run, and keep the logs if something
> fails.

## What runs

| Service    | What it does                                                                 | Port on 127.0.0.1 | Data in `deploy/data/`               |
| ---------- | ---------------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| `web`      | The app, the basemap at `/tiles/` and the reference data at `/data/`         | 18780             | `tiles/`, `datasets/`                |
| `api`      | Share links and shared games (live updates, photos)                          | 18787             | `api/` (SQLite, `photos/`)           |
| `overpass` | OpenStreetMap queries (which canton, museums…)                               | 18781             | `overpass/`, `osm/`                  |
| `photon`   | Place search                                                                 | 18782             | `photon/`                            |
| `updater`  | Downloads fresh map data and builds the reference data, only when you run it | –                 | writes `osm/`, `datasets/`, `tiles/` |

The map covers Switzerland plus about 30 km into each neighbour, from
Geofabrik extracts (about 3.7 GB to download). The basemap is about 1.5 GB.
Expect the databases to need a few tens of GB in total.

**Reference data:** the updater also turns the extract into small files of
every zoo, museum, airport, city, station, train line, big lake, admin border
and so on, plus pre-computed "which place is nearest" maps (about 30–40 MB,
served compressed). The app answers every question type from these files,
with no live query, and only falls back to Overpass outside the covered area.
Overpass stays as that fallback.

**Places further away:** for "nearest airport / city / museum" questions,
places up to about 300 km away count too (Milan's airports are the nearest
ones in parts of Ticino). The first refresh downloads the neighbouring regions
one at a time (about 6.5 GB in total), keeps only those places
(`osm/far-places.osm.pbf`, small) and deletes each download. Later refreshes
reuse that file; run `REFRESH_FAR=1 deploy/refresh-data.sh` to renew it, e.g.
once a year.

**Which airports count** as commercial is a hand-made list you can edit:
`src/maps/datasets/airports.ts`. After changing it, rebuild (`docker compose
--profile tools build`) and refresh the data.

## First-time setup

1. **DNS:** point `jetlag.sharankov.com` at the server.
2. **Code and settings:** clone this repository on the server, then:
    ```bash
    cd deploy
    cp .env.example .env   # defaults are fine; change ports if they clash
    ```
3. **Build the images:**
    ```bash
    docker compose --profile tools build
    ```
4. **Download the map data** (about 30–60 minutes the first time):
    ```bash
    docker compose run --rm updater
    ```
5. **Start everything:**
    ```bash
    docker compose up -d
    docker compose logs -f overpass photon   # Ctrl-C to stop watching
    ```
    On the first start Overpass imports the map data (roughly an hour) and
    Photon imports the place-search data (around 15 minutes). The app works
    meanwhile, but questions and search fail until the imports finish.
6. **Check each service from the server:**
    ```bash
    curl -s localhost:18787/api/health                                   # {"ok":true}
    curl -s 'localhost:18781/api/interpreter?data=[out:json];node(1);out;' # JSON, not an error
    curl -s 'localhost:18782/api?q=Zurich&limit=1'                       # a place in Zürich
    curl -sI localhost:18780/tiles/basemap.pmtiles                       # 200 OK
    ```
7. **nginx:** copy `nginx/jetlag.sharankov.com.conf` to
   `/etc/nginx/sites-available/`, change its Authelia `include` lines to match
   your other sites, and link it into `sites-enabled/`. Get a certificate the
   way you do for your other sites (e.g. `certbot --nginx -d jetlag.sharankov.com`),
   then `sudo nginx -t && sudo systemctl reload nginx`.
8. **Authelia:** add an access-control rule for `jetlag.sharankov.com` that
   lets your friends in.
9. Open `https://jetlag.sharankov.com`, log in, and install it to the home
   screen ("Add to Home screen" / "Install app").

## Monthly map refresh

```bash
deploy/refresh-data.sh
```

It downloads new extracts and rebuilds the reference data and the databases.
Questions keep working from the reference data, but place search and the
Overpass fallback are down for about an hour: don't run it on a game day. To schedule it (04:00 on the
1st of each month), add this to your crontab:

```
0 4 1 * * /path/to/repo/deploy/refresh-data.sh >> /var/log/jetlag-refresh.log 2>&1
```

## Updating the app

```bash
deploy/update-app.sh   # git pull, rebuild and restart the app; data is kept
```

Phones pick up the new version the next time the app is opened.

## Changing the region

Set `BBOX` (and the Geofabrik `REGIONS` list in `update-data.sh`) to cover the
new area, then run `refresh-data.sh`. Place search uses one Photon dump,
set by `PHOTON_DUMP_URL` in `photon-entrypoint.sh`.

## The privacy policy and external services

The nginx config sends a Content-Security-Policy that lets the browser contact
only this server. That's what guarantees no tracking, but it also blocks the
optional external services in Options ("public Overpass fallback" and the
OpenStreetMap base map). To allow one, add its host to `connect-src`
(Overpass) or `img-src` (base map) in the nginx config.

## Troubleshooting

- **"Map data unavailable"**: Overpass is still importing or has stopped.
  Check `docker compose logs overpass`.
- **Search finds nothing**: Photon is still importing; check
  `docker compose logs photon`.
- **The installed app keeps showing the login page**: the Authelia session
  expired. Log in once in the browser, then reopen the app.
