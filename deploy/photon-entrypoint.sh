#!/usr/bin/env bash
# Imports the place search index on first start (or after refresh-data.sh
# cleared it), then serves it on port 2322.
set -euo pipefail

DATA=/photon
DUMP_URL="${PHOTON_DUMP_URL:-https://download1.graphhopper.com/public/europe/switzerland-liechtenstein/photon-dump-switzerland-liechtenstein-1.0-latest.jsonl.zst}"

if [ ! -f "$DATA/import_done" ]; then
    echo "Importing place search data from ${DUMP_URL}..."
    rm -rf "${DATA:?}/photon_data"
    curl -fsSL "$DUMP_URL" | zstd --stdout -d |
        java ${JAVA_OPTS:-} -jar /photon.jar import -data-dir "$DATA" \
            -import-file - -languages en,de,fr,it
    touch "$DATA/import_done"
fi

exec java ${JAVA_OPTS:-} -jar /photon.jar serve -data-dir "$DATA" \
    -listen-ip 0.0.0.0 -listen-port 2322
