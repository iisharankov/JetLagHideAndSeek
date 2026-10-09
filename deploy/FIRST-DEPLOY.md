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

| Data | Size on the server | Where it comes from | First time |
| --- | --- | --- | --- |
| OpenStreetMap extracts for CH + neighbours | ~3.7 GB (kept for faster refreshes) | Geofabrik, downloaded by `updater` | ~5–10 min |
| Places up to ~300 km away (`far-places.osm.pbf`) | 22 MB (the 6.5 GB of downloads are deleted) | **copy yours from your PC** (step 3), or `updater` downloads it | copy: seconds; download: ~10–20 min |
| Reference data (places, borders, train lines, lakes…) | ~40–50 MB | built by `updater` from the above | ~2 min |
| Basemap tiles | ~1.5 GB | Protomaps, extracted by `updater` | ~5–15 min |
| Overpass database (fallback map queries) | ~10–20 GB | imported by the `overpass` container on first start | ~1 hour |
| Place search (Photon) | ~1–2 GB | downloaded and imported by `photon` on first start | ~15–30 min |

The only file worth copying from your PC is `data/osm/far-places.osm.pbf`:
it saves 6.5 GB of downloads. Your Swiss extract and `public/data/` are not
used by the server (it builds a wider area itself).

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

## 3. Optional shortcut: copy the far-places file from your PC

On **your PC**, from the repository folder (use your SSH host alias):

```bash
ssh <server> mkdir -p jetlag/deploy/data/osm
scp data/osm/far-places.osm.pbf <server>:jetlag/deploy/data/osm/
```

The server's updater sees the file and skips collecting it. Skip this step
and it just downloads the neighbouring regions instead (slower, same result).

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
docker compose logs -f overpass photon   # Ctrl-C to stop watching
```

Overpass imports the map data (~1 hour) and Photon the place search (~15–30
min). The app already works meanwhile: questions are answered from the
reference data; only place search and the Overpass fallback wait.

Check from the server:

```bash
curl -sI localhost:18780/ | head -1                          # 200 OK
curl -s localhost:18780/data/manifest.json | head -c 200     # reference data
curl -sI localhost:18780/tiles/basemap.pmtiles | head -1     # 200 OK
curl -s localhost:18787/api/health                           # {"ok":true}
curl -s 'localhost:18782/api?q=Zurich&limit=1' | head -c 200 # after Photon's import
curl -s 'localhost:18781/api/interpreter?data=[out:json];node(1);out;' | head -c 200  # after Overpass's import
```

## 7. HTTPS and nginx (no Authelia)

Get the certificate first (certbot answers the check through nginx), then
install the site:

```bash
sudo certbot certonly --nginx -d jetlag.sharankov.com
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

## If something goes wrong

- **The updater fails on a download**: run it again; Geofabrik sometimes
  hiccups. If one region's address changed, edit `REGIONS` / `FAR_REGIONS` in
  `update-data.sh`.
- **`nginx -t` complains about the certificate**: step 7's `certbot certonly`
  didn't finish; check that DNS points at this server and port 80 is open.
- **"Map data unavailable" on a question**: Overpass is still importing
  (`docker compose logs overpass`). Most questions don't need it.
- **Search finds nothing**: Photon is still importing (`docker compose logs
  photon`).
- **A panel shows "ran into a problem"**: press "Reset its settings"; if it
  comes back, send me the message shown.
