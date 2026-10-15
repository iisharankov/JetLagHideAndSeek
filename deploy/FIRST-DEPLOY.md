# First deploy to the server (without Authelia)

A step-by-step for getting `https://jetlag.sharankov.com` running on your
Hetzner server, open to anyone with the link (Authelia comes later). The
general reference is [README.md](README.md).

> **Not run on your server yet.** Times and sizes below are estimates. Keep
> the output of any step that fails.

## How code and data travel

**Code goes through git; map data never does.** Everything large is
gitignored (`data/`, `public/data/`, `deploy/data/`), so GitHub only ever sees
the code (the new files from rounds 1–3 add about 1.5 MB).

The server **downloads and builds its own map data**. That's the simplest and
fastest option: a Hetzner server downloads at hundreds of MB/s, so the whole
first setup takes **roughly 1–2 hours**, and most of that is importing, not
downloading.

| Data                                                  | Size on the server                  | Where it comes from                                  | First time |
| ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | ---------- |
| OpenStreetMap extracts for CH + neighbours            | ~3.7 GB (kept for faster refreshes) | Geofabrik, downloaded by `updater`                   | ~5–10 min  |
| Reference data (places, borders, train lines, lakes…) | ~40–50 MB                           | built by `updater` from the above                    | ~2 min     |
| Elevation tiles (altitude question)                   | ~100 MB                             | free AWS Terrain Tiles, downloaded once by `updater` | ~1–2 min   |
| Basemap tiles                                         | ~1.5 GB                             | Protomaps, extracted by `updater`                    | ~5–15 min  |

Nothing needs copying from your PC: your Swiss extract and `public/data/`
are not used by the server (it builds a wider area itself).

## 0. On your PC: commit and push

Nothing from rounds 1–3 is committed yet. Check `git status` shows no large
files (it shouldn't: the data folders are ignored), then:

```bash
git add -A
git commit -m "Self-hosted Jet Lag Hide and Seek: rounds 1–3"
git push
```

## 1. On the server: check the basics

```bash
dig +short jetlag.sharankov.com   # should print this server's IP
docker --version && docker compose version
nginx -v && certbot --version
df -h /                           # you need ~30 GB free
```

Install whatever is missing (`sudo apt install docker.io docker-compose-v2
nginx certbot python3-certbot-nginx`, or Docker's own packages if you already
use those). Your user should be in the `docker` group.

## 2. Get the code

```bash
git clone git@github.com:iisharankov/JetLagHideAndSeek.git ~/jetlag
cd ~/jetlag/deploy
cp .env.example .env    # the defaults are fine
```

If ports 18780–18787 are already used on the server, change them in `.env`
and in the nginx site file (step 7).

## 3. Nothing to copy from your PC

Earlier versions copied a file of far-away places here. Places outside the
play area don't count any more (the rulebook), so there's nothing to copy;
go on to step 4.

## 4. Build the images (~5–10 min)

```bash
cd ~/jetlag/deploy
docker compose --profile tools build
```

## 5. Download and build the map data (~20–40 min)

```bash
docker compose run --rm updater
```

It ends with a line like "Done: … of map data, … of wider-area places and …
of tiles". It's safe to run again if it stops halfway: finished downloads are
reused.

## 6. Start everything

```bash
docker compose up -d
```

The app works as soon as `web` and `api` are up: questions and place search
come from the reference data.

Check from the server:

```bash
docker compose ps                                            # web, api "healthy"; nothing "Restarting"
curl -sI localhost:18780/ | grep -iE "^HTTP|content-type"    # 200, text/html
curl -s localhost:18780/data/manifest.json | head -c 200     # reference data
curl -sI localhost:18780/tiles/basemap.pmtiles | head -1     # 200 OK
curl -s localhost:18787/api/health                           # {"ok":true}
```

A `curl` that prints nothing means nothing is listening on that port yet:
look at `docker compose logs --tail=50 <service>`.

## 7. HTTPS and nginx (no Authelia)

The site file expects your server's shared certificate at
`/etc/letsencrypt/live/main_cert/`, which covers this name. (If you ever
need a separate one: `sudo certbot certonly --nginx -d jetlag.sharankov.com`,
then change the two `ssl_certificate` lines.)

```bash
sudo cp ~/jetlag/deploy/nginx/jetlag.sharankov.com.noauth.conf /etc/nginx/sites-available/jetlag.sharankov.com
sudo ln -s /etc/nginx/sites-available/jetlag.sharankov.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Open `https://jetlag.sharankov.com`. Install it on phones with "Add to Home
screen" / "Install app".

### Without Authelia, the site is public

Anyone with the address can use the app, the place search, the map queries
and create share links. The nginx file rate-limits those per visitor, which
is enough to stop casual abuse. If you want a lock without Authelia, a shared
password takes a minute:

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/jetlag.htpasswd friends   # choose a password
# uncomment the two auth_basic lines in the site file, then:
sudo nginx -t && sudo systemctl reload nginx
```

**Later, with Authelia** (`auth.jetlag.sharankov.com` is already in DNS): set
up Authelia for that name, then replace the site file with
`deploy/nginx/jetlag.sharankov.com.conf` and adjust its `include` lines to
your Authelia snippets.

## Day to day

**Deploying a change.** Develop on your PC (or on the server), push, then on
the server:

```bash
~/jetlag/deploy/update-app.sh
```

It pulls, rebuilds the app images and restarts the app; map data and share
links are kept. Phones get the new version the next time the app is opened.
If a change touched the reference data builder (`server/datasets/` or
`src/maps/datasets/`, e.g. the airport list), also run
`docker compose run --rm updater`.

**Developing on the server.** Work in the same `~/jetlag` checkout or a
second clone, commit and push from there as usual. Don't leave `pnpm dev`
running on a public port.

**Refreshing the map data** (monthly is plenty; not on a game day):

```bash
~/jetlag/deploy/refresh-data.sh                 # extracts, tiles, reference data, re-imports
REFRESH_FAR=1 ~/jetlag/deploy/refresh-data.sh   # also renew the 300 km places (yearly)
```

**Storage:** expect 20–30 GB in `deploy/data/` in total.

## Already deployed? Do this now

The first version on the server had two bugs found on your first run:

- the `web` container labelled every file as a download
  (`application/octet-stream`), so the browser saved the page instead of
  showing it;
- the API couldn't write to `deploy/data/api/` (Docker creates that folder
  owned by root), so it restarted for ever, and `/api/…` answered 502.

Both are fixed in the code. The server gets fixes only through GitHub, so
**first, on your PC**, commit and push (nothing happens on the server
otherwise: `git pull` finds nothing and rebuilds the same images):

```bash
git add -A && git commit -m "Shared games, altitude question, server fixes" && git push
```

Then, on the server:

```bash
cd ~/jetlag && git pull
# 1. Host nginx. The file in the repo points at your shared certificate
#    (main_cert), so copying it over is safe. What changed: photos up to
#    5 MB need the bigger upload limit; everything else works either way.
sudo cp deploy/nginx/jetlag.sharankov.com.noauth.conf /etc/nginx/sites-available/jetlag.sharankov.com
sudo nginx -t && sudo systemctl reload nginx
# 2. New images, restart the app.
cd deploy
docker compose --profile tools build
docker compose up -d
# 3. Check (web and api say "healthy" after a minute).
docker compose ps
curl -sI localhost:18780/ | grep -i content-type   # text/html
curl -s localhost:18787/api/health                 # {"ok":true}
# 4. Elevation data and the airport list (20–40 min; the app works meanwhile).
docker compose run --rm updater
```

Until the new image runs, this one line makes the old API start (it only
lacked permission to write its folder):

```bash
chown -R 1000:1000 ~/jetlag/deploy/data/api && docker compose restart api
```

Photos are stored with the games in `deploy/data/api/photos/`.

## If something goes wrong

- **502 Bad Gateway**: nginx is up but the container behind that address
  isn't answering. `docker compose ps` shows which one (look for
  "Restarting" or "unhealthy"), `docker compose logs --tail=50 api` (or
  `web`) shows why.
- **The browser downloads a file instead of showing the app**: the `web`
  image is from before the fix above; `docker compose build web &&
docker compose up -d web`.
- **`curl localhost:18787/api/health` prints nothing**: the API container is
  restarting. Before the fix above it couldn't write to `deploy/data/api/`;
  `docker compose logs api` says what's wrong now.
- **The updater fails on a download**: run it again; Geofabrik sometimes
  hiccups. If one region's address changed, edit `REGIONS` in
  `update-data.sh`.
- **`nginx -t` complains about the certificate**: the two `ssl_certificate`
  lines must point at an existing one (`ls /etc/letsencrypt/live/`).
- **"No map data for this area" on a question**: the play area is outside
  the box the data was built for (`BBOX`), or the data isn't built yet.
- **Search finds nothing**: the reference data isn't built yet (`curl
localhost:18780/data/manifest.json`); run the updater.
- **A panel shows "ran into a problem"**: press "Reset its settings"; if it
  comes back, send me the message shown.
