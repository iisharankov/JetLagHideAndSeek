#!/bin/sh
# Starts the API as the `node` user. /data is a folder from the host (Docker
# creates it owned by root), so it's made the node user's first; otherwise
# the server can't write its database and restarts for ever.
set -e
data="${DATA_DIR:-/data}"
mkdir -p "$data"
chown -R node:node "$data"
exec su-exec node "$@"
