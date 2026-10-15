#!/usr/bin/env bash
# Nightly copy of the games (SQLite) and photos into deploy/backups/<date>/,
# keeping the last 14 days. The database is copied consistently (VACUUM INTO)
# through the running api container; photos are plain files.
#
#   deploy/backup.sh
#
# Cron example (03:30 every night):
#   30 3 * * * /path/to/repo/deploy/backup.sh >> /var/log/jetlag-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

DATA="${DATA_DIR:-./data}/api"
OUT="${BACKUP_DIR:-./backups}/$(date +%F)"
mkdir -p "$OUT"

docker compose exec -T api node --no-warnings -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('/data/jetlag.db');
    db.exec(\"VACUUM INTO '/data/backup-tmp.db'\");
"
mv "$DATA/backup-tmp.db" "$OUT/jetlag.db"
if [ -d "$DATA/photos" ]; then
    rsync -a --delete "$DATA/photos/" "$OUT/photos/"
fi
# Older copies go.
find "${BACKUP_DIR:-./backups}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "Backed up to $OUT ($(du -sh "$OUT" | cut -f1))."
