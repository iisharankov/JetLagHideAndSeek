#!/usr/bin/env bash
# Monthly map refresh: downloads new OpenStreetMap extracts and basemap tiles
# and rebuilds the reference data. The app keeps working throughout (the
# files are swapped in at the end), so any day will do.
#
# Cron example (04:00 on the 1st of each month):
#   0 4 1 * * /path/to/repo/deploy/refresh-data.sh >> /var/log/jetlag-refresh.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

docker compose run --rm updater
echo "Done."
