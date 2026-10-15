#!/usr/bin/env bash
# Deploys the latest code on the server: pulls, rebuilds the app images and
# restarts the app. Map data, databases and share links are kept.
#
#   deploy/update-app.sh
#
# If the change touched the reference data builder (server/datasets/ or
# src/maps/datasets/), also rebuild the data: docker compose run --rm updater
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only
docker compose --profile tools build web api updater
# --remove-orphans drops containers of services no longer in the compose file
# (place search since round 18, Overpass since round 19).
docker compose up -d --remove-orphans web api
docker image prune -f >/dev/null
echo "Deployed $(git rev-parse --short HEAD)."
