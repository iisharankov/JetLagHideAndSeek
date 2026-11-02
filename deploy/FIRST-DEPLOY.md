# First deploy to the server (without Authelia)

A step-by-step for getting `https://jetlag.sharankov.com` running on your
Hetzner server, open to anyone with the link (Authelia comes later). The
general reference is [README.md](README.md).

## How code and data travel

**Code goes through git; map data never does.** Everything large is
gitignored (`data/`, `public/data/`, `deploy/data/`), so GitHub only ever sees
the code.

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
./update-data.sh
```

It ends with a line like "Done: … of map data and … of tiles". It's safe to
run again if it stops halfway: finished downloads are reused.

## 6. Start everything

```bash
docker compose up -d
```

The app works as soon as `web` and `api` are up: questions and place search
come from the reference data.

Check from the server (the public-site checks fail until step 7):

```bash
./check.sh
```

A failing container check means it isn't up yet: look at
`docker compose logs --tail=50 <service>`.

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
~/jetlag/deploy/deploy.sh    # then, a minute later:
~/jetlag/deploy/check.sh
```

It pulls, rebuilds the images and restarts the app; map data, games and
photos are kept. Phones get the new version the next time the app is opened.
If a change touched the reference data builder (`server/datasets/` or
`src/maps/datasets/`, e.g. the airport list), `deploy.sh` says so: also run
`~/jetlag/deploy/update-data.sh`.

**Developing on the server.** Work in the same `~/jetlag` checkout or a
second clone, commit and push from there as usual. Don't leave `pnpm dev`
running on a public port.

**Refreshing the map data** (monthly is plenty; not on a game day):

```bash
~/jetlag/deploy/update-data.sh    # extracts, tiles, reference data
```

**Backups** (nightly) and the refresh (monthly) belong in the crontab; the
two lines are in [README.md](README.md#first-time-setup).

**Storage:** expect about 6 GB in `deploy/data/` in total.

## If something goes wrong

- **502 Bad Gateway**: nginx is up but the container behind that address
  isn't answering. `docker compose ps` shows which one (look for
  "Restarting" or "unhealthy"), `docker compose logs --tail=50 api` (or
  `web`) shows why.
- **`check.sh` says the API isn't answering**: the container is restarting;
  `docker compose logs api` says why (once it was the data folder's
  permissions, which `api-entrypoint.sh` now fixes on start).
- **The updater fails on a download**: run it again; Geofabrik sometimes
  hiccups. If one region's address changed, edit `REGIONS` in
  `update-data.sh`.
- **`nginx -t` complains about the certificate**: the two `ssl_certificate`
  lines must point at an existing one (`ls /etc/letsencrypt/live/`).
- **"No map data for this area" on a question**: the play area is outside
  the box the data was built for (`BBOX`), or the data isn't built yet.
- **Search finds nothing**: the reference data isn't built yet (`check.sh`
  says so); run `update-data.sh`.
- **A panel shows "ran into a problem"**: press "Reset its settings"; if it
  comes back, send me the message shown.
