# Self-hosting on your server

**First time?** Follow [FIRST-DEPLOY.md](FIRST-DEPLOY.md): a step-by-step
setup without Authelia, including how map data gets onto the server.

Everything the app needs runs on your server, behind your nginx. Players'
phones only ever talk to `jetlag.sharankov.com`.

## The four scripts

| Script                  | What it does                                                                                                      | When                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `deploy/deploy.sh`      | `git pull`, rebuild the images, restart `web` and `api`. Data, games and photos are kept                          | after every push                           |
| `deploy/check.sh`       | Checks the containers, the app, the reference data, the basemap, the API, the public site, the backups            | a minute after `deploy.sh`, or any time    |
| `deploy/backup.sh`      | Copies the games database (consistently), the photos and the push keys to `deploy/backups/<date>/`, keeps 14 days | nightly, from cron                         |
| `deploy/update-data.sh` | Downloads fresh OpenStreetMap extracts and basemap tiles and rebuilds the reference data (the app keeps working)  | monthly, from cron; after a builder change |

`deploy/test-nginx.sh` is a developer check of the nginx configs (CI runs it);
`deploy/api-entrypoint.sh` is the `api` container's entrypoint.

## What runs

| Service   | What it does                                                                      | Port on 127.0.0.1 | Data in `deploy/data/`                   |
| --------- | --------------------------------------------------------------------------------- | ----------------- | ---------------------------------------- |
| `web`     | The app, the basemap at `/tiles/` and the reference data at `/data/`              | 18780             | `tiles/`, `datasets/`                    |
| `api`     | Shared games (live updates, photos, push notifications)                           | 18787             | `api/` (SQLite, `photos/`, `vapid.json`) |
| `updater` | Downloads map data and builds the reference data, only when `update-data.sh` runs | –                 | writes `osm/`, `datasets/`, `tiles/`     |

The map covers Switzerland plus about 30 km into each neighbour, from
Geofabrik extracts (about 3.7 GB to download, kept for faster refreshes).
The basemap is about 1.5 GB. Expect `deploy/data/` to need about 6 GB.

**Reference data:** the updater turns the extract into small files of every
zoo, museum, airport, city, station, train line, big lake, admin border and
so on (about 20 MB of JSON, served compressed, plus the elevation tiles). The
app answers every question and every place search from these files, with no
live query; a play area outside the box isn't possible.

**Only the play area counts:** the rulebook says places outside it don't
exist, so the pack holds only what's inside the box.

**Which airports count** as commercial is a hand-made list you can edit:
`src/maps/datasets/airports.ts`. After changing it, `deploy.sh` (it rebuilds
the updater image too) and then `update-data.sh`.

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
    ./update-data.sh
    ```
5. **Start everything:**
    ```bash
    docker compose up -d
    ```
6. **Check:** `./check.sh` (the public-site checks fail until step 7).
7. **nginx:** copy `nginx/jetlag.sharankov.com.noauth.conf` (or the Authelia
   version, `nginx/jetlag.sharankov.com.conf`, with its `include` lines
   changed to match your other sites) to `/etc/nginx/sites-available/`, link
   it into `sites-enabled/`, make sure the certificate lines point at an
   existing certificate, then `sudo nginx -t && sudo systemctl reload nginx`.
8. **Cron:** nightly backups and the monthly data refresh (`crontab -e`):
    ```
    30 3 * * * /path/to/repo/deploy/backup.sh >> /var/log/jetlag-backup.log 2>&1
    0 4 1 * * /path/to/repo/deploy/update-data.sh >> /var/log/jetlag-refresh.log 2>&1
    ```
    (`/var/log` needs to be writable by the user, or log somewhere else.)
9. Open `https://jetlag.sharankov.com` and install it to the home screen
   ("Add to Home screen" / "Install app"). `./check.sh` once more.

## Updating the app

```bash
deploy/deploy.sh    # git pull, rebuild and restart the app; data is kept
deploy/check.sh     # a minute later
```

Phones pick up the new version the next time the app is opened. If the
change touched the reference data builder (`server/datasets/` or
`src/maps/datasets/`), `deploy.sh` says so: run `deploy/update-data.sh` too.

## Backups

`deploy/backup.sh` writes `deploy/backups/<date>/` with `jetlag.db` (a
consistent copy made by SQLite inside the running `api` container),
`photos/` and `vapid.json` (the push keys: without them every phone has to
opt in to notifications again), and deletes copies older than 14 days
(`KEEP_DAYS`, `BACKUP_DIR` in the environment change that). `check.sh` warns
when the newest copy is more than two days old. To restore: stop `api`, put
the files back into `deploy/data/api/`, start it.

The script needs to move a file the container wrote (owned by uid 1000) out
of `deploy/data/api/`, so run it as the user that owns that folder.

## Monthly map refresh

```bash
deploy/update-data.sh
```

It downloads new extracts and rebuilds the reference data inside the
`updater` container; the app keeps working throughout, so any day will do.
`check.sh` warns when the data is more than 45 days old.

## Changing the region

Set `BBOX` in `.env` (and the Geofabrik `REGIONS` list in `update-data.sh`)
to cover the new area, then run `update-data.sh`. Place search comes from
the reference data, so it follows the box. What Bern and Munich need, step
by step: [docs/areas.md](../docs/areas.md).

## The privacy policy and external services

The nginx config sends a Content-Security-Policy that lets the browser contact
only this server. That's what guarantees no tracking; it also blocks the
OpenStreetMap base map that development uses. To allow it, add its host to
`img-src` in the nginx config.

## Troubleshooting

- **`check.sh` fails a container check**: `docker compose ps` shows which
  one, `docker compose logs --tail=50 api` (or `web`) shows why.
- **"No map data for this area"**: the play area is outside the box the
  data was built for (`BBOX`), or the reference data isn't built yet
  (`check.sh` says so); run `update-data.sh`.
- **Search finds nothing**: the reference data isn't built yet; run
  `update-data.sh`.
- **502 Bad Gateway**: nginx is up but the container behind that address
  isn't answering; see the first point.
- **The installed app keeps showing the login page** (with Authelia): the
  session expired. Log in once in the browser, then reopen the app.

## Push notifications

The API signs push notifications with its own keys, made on its first start
and kept in the data folder (`data/api/vapid.json`; `backup.sh` copies it).
Two settings in `docker-compose.yml`: `SITE_URL` (where a tap on a
notification opens the app) and `PUSH_CONTACT`, a `mailto:` the browsers'
push services may write to about this server (the site's address by
default). The phones opt in when they join a game or under Settings → Alerts;
the push services (Mozilla's, Google's, Apple's) only ever see encrypted
messages and the fact that one arrived.
