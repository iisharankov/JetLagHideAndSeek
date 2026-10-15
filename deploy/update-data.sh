#!/usr/bin/env bash
# Downloads fresh map data for the play region into /data:
#   /data/osm/region.osm.pbf       the OpenStreetMap extract the data is built from
#   /data/elevation/               elevation tiles (downloaded once, ~100 MB)
#   /data/datasets/                places, stations and borders, served by `web`
#   /data/tiles/basemap.pmtiles    vector basemap tiles, served by `web`
# Runs inside the `updater` container; see refresh-data.sh.
set -euo pipefail

# Switzerland plus about 30 km into each neighbouring country.
BBOX="${BBOX:-5.5,45.6,11.0,48.1}" # min lon, min lat, max lon, max lat
MAX_ZOOM="${MAX_ZOOM:-15}"
# Geofabrik extracts covering the box.
REGIONS="${REGIONS:-europe/switzerland europe/liechtenstein europe/germany/baden-wuerttemberg europe/germany/bayern/schwaben europe/france/alsace europe/france/franche-comte europe/france/rhone-alpes europe/italy/nord-ovest europe/italy/nord-est europe/austria}"

mkdir -p /data/osm/downloads /data/tiles

echo "Downloading OpenStreetMap extracts..."
for region in $REGIONS; do
    file="/data/osm/downloads/$(basename "$region").osm.pbf"
    # -z: skip the download if our copy is already up to date.
    curl -fL --retry 3 -z "$file" -o "$file" \
        "https://download.geofabrik.de/${region}-latest.osm.pbf"
done

echo "Merging and cutting to ${BBOX}..."
osmium merge --overwrite -o /data/osm/merged.osm.pbf /data/osm/downloads/*.osm.pbf
# "smart" keeps admin boundaries and multipolygons that cross the box complete.
osmium extract --strategy=smart -S types=multipolygon,boundary \
    --bbox="$BBOX" --overwrite -o /data/osm/region.osm.pbf /data/osm/merged.osm.pbf
rm /data/osm/merged.osm.pbf

echo "Building reference datasets..."
rm -rf /data/datasets.tmp
node /app/build-datasets.mjs --input /data/osm/region.osm.pbf \
    --elevation /data/elevation --output /data/datasets.tmp
# Replace the folder's contents, not the folder: `web` has it mounted, and a
# new folder put in its place would stay invisible to it until a restart.
mkdir -p /data/datasets
find /data/datasets -mindepth 1 -delete
find /data/datasets.tmp -mindepth 1 -maxdepth 1 -exec mv -t /data/datasets/ {} +
rmdir /data/datasets.tmp

echo "Extracting basemap tiles..."
build=$(curl -fsSL https://build-metadata.protomaps.dev/builds.json | jq -r '.[-1].key')
pmtiles extract "https://build.protomaps.com/${build}" /data/tiles/basemap.pmtiles.tmp \
    --bbox="$BBOX" --maxzoom="$MAX_ZOOM"
mv /data/tiles/basemap.pmtiles.tmp /data/tiles/basemap.pmtiles

echo "Done: $(du -h /data/osm/region.osm.pbf | cut -f1) of map data and $(du -h /data/tiles/basemap.pmtiles | cut -f1) of tiles (build ${build})."
