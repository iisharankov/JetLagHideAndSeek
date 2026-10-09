#!/usr/bin/env bash
# Builds the reference datasets (places, stations, borders) that `pnpm dev`
# serves from public/data/, from a Geofabrik extract (Switzerland by default:
# REGION=europe/austria scripts/build-dev-data.sh for another one).
#
# FAR=1 also collects airports, cities and places up to ~300 km around (like
# the server does): it downloads the neighbouring regions one at a time
# (several GB in total), keeps only those places and deletes each download.
# The result, data/osm/far-places.osm.pbf, is reused until you delete it.
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

far_args=()
FAR_FILE=data/osm/far-places.osm.pbf
if [ "${FAR:-0}" = 1 ] && [ ! -s "$FAR_FILE" ]; then
    FAR_BBOX="${FAR_BBOX:-2.0,43.1,14.4,50.5}"
    FAR_REGIONS="${FAR_REGIONS:-europe/germany/baden-wuerttemberg europe/germany/bayern europe/germany/hessen europe/germany/rheinland-pfalz europe/germany/saarland europe/luxembourg europe/france/alsace europe/france/lorraine europe/france/champagne-ardenne europe/france/franche-comte europe/france/bourgogne europe/france/rhone-alpes europe/france/auvergne europe/france/provence-alpes-cote-d-azur europe/italy/nord-ovest europe/italy/nord-est europe/italy/centro europe/austria}"
    read -r -a filters <<< "$(node server/dist/build-datasets.mjs --print-far-filters)"
    rm -rf data/osm/far && mkdir -p data/osm/far/parts
    "$OSMIUM" tags-filter --overwrite -o data/osm/far/parts/main.osm.pbf "$file" "${filters[@]}"
    for region in $FAR_REGIONS; do
        echo "Collecting places from ${region}..."
        curl -fL --retry 3 -o data/osm/far/download.osm.pbf \
            "https://download.geofabrik.de/${region}-latest.osm.pbf"
        "$OSMIUM" tags-filter --overwrite \
            -o "data/osm/far/parts/$(basename "$region").osm.pbf" \
            data/osm/far/download.osm.pbf "${filters[@]}"
        rm -f data/osm/far/download.osm.pbf
    done
    "$OSMIUM" merge --overwrite -o data/osm/far/merged.osm.pbf data/osm/far/parts/*.osm.pbf
    "$OSMIUM" extract --bbox="$FAR_BBOX" --overwrite -o "$FAR_FILE" data/osm/far/merged.osm.pbf
    rm -rf data/osm/far
fi
if [ -s "$FAR_FILE" ]; then far_args=(--far "$FAR_FILE"); fi

node server/dist/build-datasets.mjs --input "$file" "${far_args[@]}" \
    --elevation data/elevation --output public/data.tmp
rm -rf public/data
mv public/data.tmp public/data
echo "Reference data ready in public/data/ (restart pnpm dev if it's running)."
