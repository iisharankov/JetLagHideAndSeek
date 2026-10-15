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

| Service   | What it does                                                                 | Port on 127.0.0.1 | Data in `deploy/data/`               |
| --------- | ---------------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| `web`     | The app, the basemap at `/tiles/` and the reference data at `/data/`         | 18780             | `tiles/`, `datasets/`                |
| `api`     | Share links and shared games (live updates, photos)                          | 18787             | `api/` (SQLite, `photos/`)           |
| `updater` | Downloads fresh map data and builds the reference data, only when you run it | –                 | writes `osm/`, `datasets/`, `tiles/` |

The map covers Switzerland plus about 30 km into each neighbour, from
Geofabrik extracts (about 3.7 GB to download). The basemap is about 1.5 GB.
Expect the databases to need a few tens of GB in total.

**Reference data:** the updater turns the extract into small files of every
zoo, museum, airport, city, station, train line, big lake, admin border and
so on (about 20 MB of JSON, served compressed, plus the elevation tiles). The
app answers every question and every place search from these files, with no
live query; a play area outside the box isn't possible.

**Only the play area counts:** the rulebook says places outside it don't
exist, so the pack holds only what's inside the box and nothing from further
away is downloaded.

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
    ```
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

It downloads new extracts and rebuilds the reference data; the app keeps
working throughout. To schedule it (04:00 on the 1st of each month), add
this to your crontab:

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
new area, then run `refresh-data.sh`. Place search comes from the reference
data, so it follows the box. What Bern and Munich need, step by step:
[docs/areas.md](../docs/areas.md).

## The privacy policy and external services

The nginx config sends a Content-Security-Policy that lets the browser contact
only this server. That's what guarantees no tracking; it also blocks the
OpenStreetMap base map that development uses. To allow it, add its host to
`img-src` in the nginx config.

## Troubleshooting

- **"No map data for this area"**: the play area is outside the box the
  data was built for (`BBOX`), or the reference data isn't built yet
  (`curl localhost:18780/data/manifest.json`).
- **Search finds nothing**: the reference data isn't built yet
  (`curl localhost:18780/data/manifest.json`); run the updater.
- **The installed app keeps showing the login page**: the Authelia session
  expired. Log in once in the browser, then reopen the app.

## Push notifications

The API signs push notifications with its own keys, made on its first start
and kept in the data folder (`data/api/vapid.json`; back it up with the
database, or the phones have to opt in again). Two settings in
`docker-compose.yml`: `SITE_URL` (where a tap on a notification opens the
app) and `PUSH_CONTACT`, a `mailto:` the browsers' push services may write
to about this server. The phones opt in when they join a game or under
Settings → Alerts; the push services (Mozilla's, Google's, Apple's) only
ever see encrypted messages and the fact that one arrived.
