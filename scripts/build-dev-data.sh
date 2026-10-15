#!/usr/bin/env bash
# Builds the reference datasets (places, stations, borders) that `pnpm dev`
# serves from public/data/, from a Geofabrik extract (Switzerland by default:
# REGION=europe/austria scripts/build-dev-data.sh for another one).
#
# Needs osmium-tool (sudo apt install osmium-tool), or OSMIUM=/path/to/osmium.
set -euo pipefail
cd "$(dirname "$0")/.."

OSMIUM="${OSMIUM:-osmium}"
export OSMIUM
REGION="${REGION:-europe/switzerland}"
file="data/osm/$(basename "$REGION")-latest.osm.pbf"
mkdir -p data/osm

echo "Downloading ${REGION} (skipped if already up to date)..."
curl -fL --retry 3 -z "$file" -o "$file" \
    "https://download.geofabrik.de/${REGION}-latest.osm.pbf"

npm run --silent build:datasets

node server/dist/build-datasets.mjs --input "$file" \
    --elevation data/elevation --output public/data.tmp
rm -rf public/data
mv public/data.tmp public/data
echo "Reference data ready in public/data/ (restart pnpm dev if it's running)."
