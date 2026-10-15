#!/usr/bin/env bash
# Monthly map refresh: downloads new OpenStreetMap extracts and basemap tiles,
# rebuilds the reference data, then the Overpass database. Questions keep
# working from the reference data, but the Overpass fallback is down while it
# re-imports (about an hour), so don't run this on a game day.
#
# Cron example (04:00 on the 1st of each month):
#   0 4 1 * * /path/to/repo/deploy/refresh-data.sh >> /var/log/jetlag-refresh.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

docker compose run --rm updater

echo "Re-importing Overpass from the new extract..."
docker compose stop overpass
docker compose run --rm --no-deps --entrypoint sh overpass -c 'rm -rf /db/*'
docker compose up -d overpass

echo "Started. Follow the import with: docker compose logs -f overpass"
