#!/usr/bin/env bash
# Downloads fresh map data for the play region into /data:
#   /data/osm/region.osm.bz2       OpenStreetMap data, imported by Overpass
#   /data/osm/far-places.osm.pbf   airports, cities and places up to ~300 km away
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
osmium cat --overwrite -f osm.bz2 -o /data/osm/region.osm.bz2.tmp /data/osm/region.osm.pbf
mv /data/osm/region.osm.bz2.tmp /data/osm/region.osm.bz2
rm /data/osm/merged.osm.pbf

# Airports, cities and other places up to ~300 km away, for "nearest X"
# questions (Milan's airport is the nearest one in parts of Ticino). They
# hardly change, so each big download is filtered to those places straight
# away and deleted; only the small result is kept. It's rebuilt only when
# missing, or with REFRESH_FAR=1.
FAR_BBOX="${FAR_BBOX:-2.0,43.1,14.4,50.5}"
FAR_REGIONS="${FAR_REGIONS:-europe/switzerland europe/liechtenstein europe/germany/baden-wuerttemberg europe/germany/bayern europe/germany/hessen europe/germany/rheinland-pfalz europe/germany/saarland europe/luxembourg europe/france/alsace europe/france/lorraine europe/france/champagne-ardenne europe/france/franche-comte europe/france/bourgogne europe/france/rhone-alpes europe/france/auvergne europe/france/provence-alpes-cote-d-azur europe/italy/nord-ovest europe/italy/nord-est europe/italy/centro europe/austria}"
FAR=/data/osm/far-places.osm.pbf
if [ ! -s "$FAR" ] || [ "${REFRESH_FAR:-0}" = 1 ]; then
    echo "Collecting airports, cities and places within ~300 km..."
    read -r -a filters <<< "$(node /app/build-datasets.mjs --print-far-filters)"
    rm -rf /data/osm/far && mkdir -p /data/osm/far/parts
    for region in $FAR_REGIONS; do
        name=$(basename "$region")
        source="/data/osm/downloads/${name}.osm.pbf"
        if [ ! -s "$source" ]; then
            source=/data/osm/far/download.osm.pbf
            curl -fL --retry 3 -o "$source" \
                "https://download.geofabrik.de/${region}-latest.osm.pbf"
        fi
        osmium tags-filter --overwrite -o "/data/osm/far/parts/${name}.osm.pbf" \
            "$source" "${filters[@]}"
        rm -f /data/osm/far/download.osm.pbf
    done
    osmium merge --overwrite -o /data/osm/far/merged.osm.pbf /data/osm/far/parts/*.osm.pbf
    osmium extract --bbox="$FAR_BBOX" --overwrite -o "$FAR.tmp" /data/osm/far/merged.osm.pbf
    mv "$FAR.tmp" "$FAR"
    rm -rf /data/osm/far
fi

echo "Building reference datasets..."
rm -rf /data/datasets.tmp
node /app/build-datasets.mjs --input /data/osm/region.osm.pbf --far "$FAR" \
    --output /data/datasets.tmp
rm -rf /data/datasets
mv /data/datasets.tmp /data/datasets

echo "Extracting basemap tiles..."
build=$(curl -fsSL https://build-metadata.protomaps.dev/builds.json | jq -r '.[-1].key')
pmtiles extract "https://build.protomaps.com/${build}" /data/tiles/basemap.pmtiles.tmp \
    --bbox="$BBOX" --maxzoom="$MAX_ZOOM"
mv /data/tiles/basemap.pmtiles.tmp /data/tiles/basemap.pmtiles

echo "Done: $(du -h /data/osm/region.osm.bz2 | cut -f1) of map data, $(du -h "$FAR" | cut -f1) of wider-area places and $(du -h /data/tiles/basemap.pmtiles | cut -f1) of tiles (build ${build})."
