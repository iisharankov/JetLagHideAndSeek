#!/usr/bin/env bash
# Downloads fresh map data for the play region and rebuilds the reference
# data. The app keeps working throughout (the files are swapped in at the
# end), so any day will do; monthly is plenty.
#
#   deploy/update-data.sh                 the main area (Switzerland and around)
#   AREA=munich deploy/update-data.sh     a far area's own pack (round 49):
#   AREA=toronto deploy/update-data.sh    munich, toronto (the list below)
#   AREA=list deploy/update-data.sh       just rewrite the list of areas
#
# A far area's pack goes to /data/datasets/areas/<area>/ and its tiles to
# /data/tiles/<area>.pmtiles; /data/datasets/areas.json lists them, and the
# app reads each question's answer from the pack covering it. To drop an
# area: delete those two, then AREA=list.
#
# Cron (04:00 on the 1st of each month):
#   0 4 1 * * /path/to/repo/deploy/update-data.sh >> /var/log/jetlag-refresh.log 2>&1
#
# On the server this runs itself inside the `updater` container (built by
# deploy.sh), where it writes to /data:
#   /data/osm/region.osm.pbf       the OpenStreetMap extract the data is built from
#   /data/elevation/               elevation tiles (downloaded once, ~100 MB)
#   /data/datasets/                places, stations and borders, served by `web`
#   /data/tiles/basemap.pmtiles    vector basemap tiles, served by `web`
set -euo pipefail

# Outside the container: run this script inside it.
if [ ! -f /app/build-datasets.mjs ]; then
    cd "$(dirname "$0")"
    exec docker compose run --rm -e AREA="${AREA:-}" updater
fi

AREA="${AREA:-}"

# /data/datasets/areas.json: every far area built, with its name and box.
write_area_list() {
    mkdir -p /data/datasets/areas
    {
        for dir in /data/datasets/areas/*/; do
            [ -f "${dir}manifest.json" ] || continue
            jq -c --arg id "$(basename "$dir")" \
                --arg name "$(cat "${dir}name.txt" 2>/dev/null || basename "$dir")" \
                --arg country "$(cat "${dir}country.txt" 2>/dev/null)" \
                '{id: $id, name: $name, bbox: .bbox} + (if $country == "" then {} else {country: $country} end)' "${dir}manifest.json"
        done
    } | jq -s '{areas: .}' > /data/datasets/areas.json.tmp
    mv /data/datasets/areas.json.tmp /data/datasets/areas.json
    echo "Areas: $(jq -r '[.areas[].name] | join(", ") | if . == "" then "none" else . end' /data/datasets/areas.json)"
}

MAX_ZOOM="${MAX_ZOOM:-15}"
case "$AREA" in
    "")
        # Switzerland plus about 30 km into each neighbouring country.
        BBOX="${BBOX:-5.5,45.6,11.0,48.1}" # min lon, min lat, max lon, max lat
        # Geofabrik extracts covering the box.
        REGIONS="${REGIONS:-europe/switzerland europe/liechtenstein europe/germany/baden-wuerttemberg europe/germany/bayern/schwaben europe/france/alsace europe/france/franche-comte europe/france/rhone-alpes europe/italy/nord-ovest europe/italy/nord-est europe/austria}"
        OSM=/data/osm
        DEST=/data/datasets
        TILES=/data/tiles/basemap.pmtiles
        ;;
    munich)
        # The city and its edge (S-Bahn core), for a small game; MUC
        # airport is outside, so "nearest airport" questions leave it out.
        NAME="Munich"
        COUNTRY="DE"
        BBOX="11.25,48.00,11.85,48.30"
        REGIONS="europe/germany/bayern/oberbayern"
        ;;
    toronto)
        # The City of Toronto and a little beyond (Pearson and the island
        # airport inside), for a small game downtown.
        NAME="Toronto"
        COUNTRY="CA"
        BBOX="-79.70,43.55,-79.05,43.90"
        REGIONS="north-america/canada/ontario"
        ;;
    list)
        write_area_list
        exit 0
        ;;
    *)
        echo "Unknown AREA '$AREA': munich, toronto, or list (or none for the main area)." >&2
        exit 1
        ;;
esac
if [ -n "$AREA" ]; then
    OSM="/data/osm/areas/$AREA"
    DEST="/data/datasets/areas/$AREA"
    TILES="/data/tiles/$AREA.pmtiles"
fi

mkdir -p "$OSM/downloads" /data/tiles

echo "Downloading OpenStreetMap extracts (${AREA:-main area})..."
for region in $REGIONS; do
    file="$OSM/downloads/$(basename "$region").osm.pbf"
    # -z: skip the download if our copy is already up to date.
    curl -fL --retry 3 -z "$file" -o "$file" \
        "https://download.geofabrik.de/${region}-latest.osm.pbf"
done

echo "Merging and cutting to ${BBOX}..."
osmium merge --overwrite -o "$OSM/merged.osm.pbf" "$OSM"/downloads/*.osm.pbf
# "smart" keeps admin boundaries and multipolygons that cross the box complete.
osmium extract --strategy=smart -S types=multipolygon,boundary \
    --bbox="$BBOX" --overwrite -o "$OSM/region.osm.pbf" "$OSM/merged.osm.pbf"
rm "$OSM/merged.osm.pbf"

echo "Building reference datasets..."
rm -rf "$DEST.tmp"
node /app/build-datasets.mjs --input "$OSM/region.osm.pbf" \
    --elevation /data/elevation --output "$DEST.tmp"
# A city's extract can't hold whole country outlines: the app takes the
# country from here when the pack can't say.
if [ -n "$AREA" ]; then
    printf '%s' "$NAME" > "$DEST.tmp/name.txt"
    printf '%s' "$COUNTRY" > "$DEST.tmp/country.txt"
fi
# Replace the folder's contents, not the folder: `web` has it mounted, and a
# new folder put in its place would stay invisible to it until a restart.
# The main area keeps the far areas' packs (areas/, areas.json) beside it.
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 ! -name areas ! -name areas.json -exec rm -rf {} +
find "$DEST.tmp" -mindepth 1 -maxdepth 1 -exec mv -t "$DEST/" {} +
rmdir "$DEST.tmp"

echo "Extracting basemap tiles..."
build=$(curl -fsSL https://build-metadata.protomaps.dev/builds.json | jq -r '.[-1].key')
pmtiles extract "https://build.protomaps.com/${build}" "$TILES.tmp" \
    --bbox="$BBOX" --maxzoom="$MAX_ZOOM"
mv "$TILES.tmp" "$TILES"

write_area_list
echo "Done (${AREA:-main area}): $(du -h "$OSM/region.osm.pbf" | cut -f1) of map data and $(du -h "$TILES" | cut -f1) of tiles (build ${build})."
