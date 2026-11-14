#!/usr/bin/env bash
# Checks a deployed server: the containers, the app, the reference data, the
# basemap, the API, the public site, the backups. Run it a minute after
# deploy.sh (the containers need that long to report healthy), or any time.
#
#   deploy/check.sh
#
# Exits non-zero when a check fails. Nothing is changed.
set -uo pipefail
cd "$(dirname "$0")"
# The same settings docker compose reads.
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi
WEB="http://127.0.0.1:${WEB_PORT:-18780}"
API="http://127.0.0.1:${API_PORT:-18787}"
SITE="${SITE_URL:-https://jetlag.sharankov.com}"
DATA="${DATA_DIR:-./data}"
BACKUPS="${BACKUP_DIR:-./backups}"

failures=0
ok() { echo "ok    $*"; }
fail() {
    echo "FAIL  $*"
    failures=$((failures + 1))
}
warn() { echo "warn  $*"; }
# The status code of a request (000 when nothing answers).
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }
# A response header's value, lower-cased name.
header() {
    local name=$1
    shift
    curl -s -o /dev/null -D - --max-time 10 "$@" | tr -d '\r' |
        awk -v n="$name" 'tolower($1) == n ":" { $1 = ""; sub(/^ /, ""); print }' | head -1
}

echo "== Code"
echo "      $(git log -1 --format='%h %ad %s' --date=short)"
if git fetch --quiet origin 2>/dev/null; then
    behind=$(git rev-list --count HEAD..origin/master 2>/dev/null || echo "?")
    if [ "$behind" = "0" ]; then ok "up to date with origin/master"; else warn "$behind commit(s) behind origin/master: run deploy/deploy.sh"; fi
else
    warn "couldn't reach origin to compare (offline?)"
fi

echo "== Containers"
for service in web api; do
    state=$(docker compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null | awk -v s="$service" '$1 == s { print $2 " " $3 }')
    case "$state" in
        "running healthy") ok "$service running, healthy" ;;
        "running starting") warn "$service running, health check still starting: try again in a minute" ;;
        "") fail "$service is not running (docker compose ps)" ;;
        *) fail "$service: $state (docker compose logs --tail=50 $service)" ;;
    esac
done
if docker compose ps --format '{{.Service}}' 2>/dev/null | grep -qvE '^(web|api)$'; then
    warn "extra containers in the stack: $(docker compose ps --format '{{.Service}}' | grep -vE '^(web|api)$' | tr '\n' ' ')"
fi

echo "== The app (web container)"
if [ "$(status "$WEB/")" = "200" ]; then
    ct=$(header content-type "$WEB/")
    case "$ct" in text/html*) ok "/ is the app (text/html)" ;; *) fail "/ has content type '$ct', not text/html" ;; esac
else
    fail "/ answers $(status "$WEB/") on $WEB"
fi
[ "$(status "$WEB/sw.js")" = "200" ] && ok "service worker served" || fail "/sw.js answers $(status "$WEB/sw.js")"

echo "== Reference data"
manifest=$(curl -s --max-time 10 "$WEB/data/manifest.json")
if [ -n "$manifest" ] && [ "$(status "$WEB/data/manifest.json")" = "200" ]; then
    built=$(printf '%s' "$manifest" | sed -n 's/.*"built":"\([^"]*\)".*/\1/p')
    bbox=$(printf '%s' "$manifest" | sed -n 's/.*"bbox":\[\([^]]*\)\].*/\1/p')
    ok "manifest: built ${built:-?}, box ${bbox:-?}"
    if [ -n "$built" ]; then
        age=$((($(date +%s) - $(date -d "$built" +%s 2>/dev/null || echo 0)) / 86400))
        [ "$age" -gt 45 ] && warn "the reference data is $age days old: run deploy/update-data.sh"
    fi
    printf '%s' "$manifest" | grep -q '"elevation"' && ok "elevation tiles listed" || warn "no elevation tiles in the manifest (altitude question off)"
    for file in stations-rail admin-8 train-lines lakes; do
        [ "$(status "$WEB/data/$file.json")" = "200" ] && ok "/data/$file.json" || fail "/data/$file.json answers $(status "$WEB/data/$file.json")"
    done
    enc=$(header content-encoding -H 'Accept-Encoding: gzip' "$WEB/data/manifest.json")
    [ "$enc" = "gzip" ] && ok "reference data is compressed" || warn "reference data is not gzipped (got '${enc:-none}')"
else
    fail "/data/manifest.json answers $(status "$WEB/data/manifest.json"): no reference data (run deploy/update-data.sh)"
fi

echo "== Basemap"
tiles=$(status -I "$WEB/tiles/basemap.pmtiles")
if [ "$tiles" = "200" ]; then
    size=$(header content-length -I "$WEB/tiles/basemap.pmtiles")
    ok "basemap present ($((${size:-0} / 1048576)) MB)"
    range=$(status -H 'Range: bytes=0-9' "$WEB/tiles/basemap.pmtiles")
    [ "$range" = "206" ] && ok "range requests work (206)" || fail "a range request answers $range, not 206: the map can't read tiles"
else
    fail "/tiles/basemap.pmtiles answers $tiles (run deploy/update-data.sh)"
fi

# Far areas (round 49: AREA=munich deploy/update-data.sh and the like).
areas=$(curl -s --max-time 10 "$WEB/data/areas.json")
if [ "$(status "$WEB/data/areas.json")" = "200" ]; then
    for id in $(printf '%s' "$areas" | grep -o '"id":"[^"]*"' | cut -d'"' -f4); do
        [ "$(status "$WEB/data/areas/$id/manifest.json")" = "200" ] && ok "area $id: data" || fail "area $id is listed but /data/areas/$id/manifest.json is missing"
        [ "$(status -I "$WEB/tiles/$id.pmtiles")" = "200" ] && ok "area $id: basemap" || fail "area $id has no /tiles/$id.pmtiles"
    done
else
    ok "no far areas (only the main one)"
fi

echo "== API"
health=$(curl -s --max-time 10 "$API/api/health")
[ "$health" = '{"ok":true}' ] && ok "/api/health" || fail "/api/health answers '${health:-nothing}' on $API"
key=$(curl -s --max-time 10 "$API/api/push/key")
case "$key" in *'"key":"'*) ok "push notifications have a key" ;; *) warn "no push key ('${key:-nothing}'): notifications off" ;; esac
[ -f "$DATA/api/jetlag.db" ] && ok "database at $DATA/api/jetlag.db ($(du -h "$DATA/api/jetlag.db" | cut -f1))" || fail "no database at $DATA/api/jetlag.db"
[ -f "$DATA/api/vapid.json" ] && ok "push keys at $DATA/api/vapid.json" || warn "no $DATA/api/vapid.json yet (made on the API's first start)"
# Who may make games: the admin code (its length only; never printed).
if [ -z "${ADMIN_CODE:-}" ]; then
    warn "ADMIN_CODE is empty in deploy/.env: nobody can start a game (docs/deployment.md, Who may make games)"
elif [ "${#ADMIN_CODE}" -lt 12 ]; then
    warn "ADMIN_CODE is set but shorter than 12 characters: make it longer"
else
    ok "ADMIN_CODE is set (${#ADMIN_CODE} characters)"
fi
case "$(curl -s --max-time 10 "$API/api/codes/mine")" in
    *"no admin code set"*) fail "the API has no ADMIN_CODE: is it in deploy/.env, and did deploy.sh run since?" ;;
    *"creator code"*) ok "the API knows the admin code: games need a code" ;;
    *) warn "couldn't tell whether the API has the admin code (/api/codes/mine)" ;;
esac

echo "== The public site ($SITE)"
public=$(status "$SITE/")
if [ "$public" = "200" ]; then
    ok "$SITE/ answers 200"
    [ "$(status "$SITE/api/health")" = "200" ] && ok "$SITE/api/health through nginx" || fail "$SITE/api/health answers $(status "$SITE/api/health"): check the /api/ location in the nginx site"
    csp=$(header content-security-policy "$SITE/")
    [ -n "$csp" ] && ok "Content-Security-Policy is set" || fail "no Content-Security-Policy header: the nginx site file isn't the one in deploy/nginx/"
    [ "$(status -H 'Range: bytes=0-9' "$SITE/tiles/basemap.pmtiles")" = "206" ] && ok "basemap range requests through nginx" || fail "range requests don't reach the basemap through nginx"
elif [ "$public" = "000" ]; then
    warn "$SITE/ unreachable from here (DNS, firewall or offline); the checks above are the containers only"
else
    fail "$SITE/ answers $public"
fi

echo "== Backups"
if [ -d "$BACKUPS" ] && last=$(ls -1d "$BACKUPS"/*/ 2>/dev/null | sort | tail -1) && [ -n "$last" ]; then
    age=$((($(date +%s) - $(stat -c %Y "$last")) / 86400))
    [ "$age" -le 2 ] && ok "last backup $(basename "$last") ($(du -sh "$last" | cut -f1))" || warn "last backup is $age days old: schedule deploy/backup.sh (crontab)"
else
    warn "no backups in $BACKUPS yet: run deploy/backup.sh and schedule it"
fi
crontab -l 2>/dev/null | grep -q "backup.sh" && ok "backup.sh is in the crontab" || warn "backup.sh is not in this user's crontab"

echo "== Disk"
free=$(df -BG --output=avail . | tail -1 | tr -dc '0-9')
[ "${free:-0}" -ge 10 ] && ok "${free} GB free" || warn "only ${free} GB free: the data refresh needs about 6 GB"

echo
if [ "$failures" -gt 0 ]; then
    echo "$failures check(s) failed."
    exit 1
fi
echo "All checks passed."
