#!/usr/bin/env bash
# Copies the games (SQLite), the photos and the push keys into
# deploy/backups/<date>/ and keeps the last 14 days. The database is copied
# consistently (VACUUM INTO) through the running api container; the rest are
# plain files.
#
#   deploy/backup.sh
#
# Cron (03:30 every night):
#   30 3 * * * /path/to/repo/deploy/backup.sh >> /var/log/jetlag-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
# The same settings docker compose reads (DATA_DIR).
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

DATA="${DATA_DIR:-./data}/api"
BACKUPS="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OUT="$BACKUPS/$(date +%F)"
mkdir -p "$OUT"

# A copy left behind by an interrupted run would make VACUUM INTO fail.
rm -f "$DATA/backup-tmp.db"
docker compose exec -T api node --no-warnings -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('/data/jetlag.db');
    db.exec(\"VACUUM INTO '/data/backup-tmp.db'\");
    db.close();
"
mv "$DATA/backup-tmp.db" "$OUT/jetlag.db"
# Without the push keys every phone has to opt in to notifications again.
if [ -f "$DATA/vapid.json" ]; then
    cp -p "$DATA/vapid.json" "$OUT/vapid.json"
fi
if [ -d "$DATA/photos" ]; then
    rsync -a --delete "$DATA/photos/" "$OUT/photos/"
fi
# Older copies go.
find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "Backed up to $OUT ($(du -sh "$OUT" | cut -f1)); $(find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d | wc -l) copies kept."
