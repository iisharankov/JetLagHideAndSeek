#!/usr/bin/env bash
# Monthly map refresh: downloads new OpenStreetMap extracts and basemap tiles,
# rebuilds the reference data, then the Overpass and place-search databases.
# Questions keep working from the reference data, but place search and the
# Overpass fallback are down while they re-import (about an hour), so don't
# run this on a game day. REFRESH_FAR=1 also renews the places up to ~300 km
# away (otherwise kept from the first run).
#
# Cron example (04:00 on the 1st of each month):
#   0 4 1 * * /path/to/repo/deploy/refresh-data.sh >> /var/log/jetlag-refresh.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

docker compose run --rm -e REFRESH_FAR="${REFRESH_FAR:-0}" updater

echo "Re-importing Overpass from the new extract..."
docker compose stop overpass
docker compose run --rm --no-deps --entrypoint sh overpass -c 'rm -rf /db/*'
docker compose up -d overpass

echo "Re-importing place search..."
docker compose stop photon
docker compose run --rm --no-deps --entrypoint sh photon -c 'rm -rf /photon/*'
docker compose up -d photon

echo "Started. Follow the imports with: docker compose logs -f overpass photon"
