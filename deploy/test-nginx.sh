#!/usr/bin/env bash
# Checks the nginx configs in deploy/nginx/ with a real nginx, no Docker
# needed. The `web` container's config is run against the built app (dist/)
# and stand-in data files, and what it sends is checked: content types,
# caching, compression and range requests. The host site configs are
# syntax-checked with stand-in certificates.
#
#   pnpm build && deploy/test-nginx.sh
#
# Uses the nginx on the PATH, or NGINX_BIN=/path/to/nginx (any version from
# 1.18); MIME_TYPES=/path/to/mime.types if nginx's list isn't in
# /etc/nginx/. Nothing is installed and no service is touched: nginx runs
# from a temporary folder on ports 18790–18792 (PORT=... to change the
# first) and is stopped at the end.
set -euo pipefail
cd "$(dirname "$0")/.."

NGINX="${NGINX_BIN:-nginx}" # (nginx itself reads a variable called NGINX)
PORT="${PORT:-18790}"
MIME_TYPES="${MIME_TYPES:-/etc/nginx/mime.types}"
[ -f "$MIME_TYPES" ] || MIME_TYPES="$(dirname "$NGINX")/../../etc/nginx/mime.types"
[ -f "$MIME_TYPES" ] || { echo "nginx's mime.types not found; set MIME_TYPES=..."; exit 2; }
[ -f dist/index.html ] || { echo "Build the app first: pnpm build"; exit 2; }

work=$(mktemp -d)
pid=""
cleanup() {
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null
    rm -rf "$work"
}
trap cleanup EXIT

failures=0
fail() {
    echo "FAIL: $*"
    failures=$((failures + 1))
}

# nginx's compiled-in paths (logs, temp folders) aren't writable here; point
# everything at the temporary folder.
mkdir -p "$work/logs" "$work/tmp" "$work/snippets"
common() {
    cat <<EOF
daemon off;
pid $work/nginx.pid;
error_log $work/logs/error.log warn;
events { }
http {
    include $MIME_TYPES;
    default_type application/octet-stream;
    access_log off;
    client_body_temp_path $work/tmp/body;
    proxy_temp_path $work/tmp/proxy;
    fastcgi_temp_path $work/tmp/fastcgi;
    uwsgi_temp_path $work/tmp/uwsgi;
    scgi_temp_path $work/tmp/scgi;
    include $1;
}
EOF
}

# --- The web container's config, against dist/ and stand-in data files.
mkdir -p "$work/tiles" "$work/datasets/elevation/9/1"
head -c 100000 /dev/urandom > "$work/tiles/basemap.pmtiles"
echo '{"version":1,"files":{}}' > "$work/datasets/manifest.json"
head -c 131072 /dev/zero > "$work/datasets/elevation/9/1/1.i16"
sed -e "s#listen 8080;#listen 127.0.0.1:$PORT;#" \
    -e "s#root /usr/share/nginx/html;#root $PWD/dist;#" \
    -e "s#alias /tiles/;#alias $work/tiles/;#" \
    -e "s#alias /datasets/;#alias $work/datasets/;#" \
    deploy/nginx/web.conf > "$work/web.conf"
common "$work/web.conf" > "$work/nginx.conf"

"$NGINX" -p "$work" -c "$work/nginx.conf" 2> "$work/logs/start.log" &
pid=$!
for _ in $(seq 1 50); do
    curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
    sleep 0.1
done
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
    cat "$work/logs/start.log" "$work/logs/error.log" 2>/dev/null
    fail "nginx didn't start with deploy/nginx/web.conf"
    exit 1
fi

# headers URL [curl args...]: the response headers, lower-cased names.
headers() {
    local url=$1
    shift
    curl -s -o /dev/null -D - "$@" "http://127.0.0.1:$PORT$url" | tr -d '\r' |
        awk 'NR==1 {print "status: " $2; next} /:/ {h=tolower(substr($0,1,index($0,":")-1)); print h ":" substr($0,index($0,":")+1)}'
}
expect() {
    local what=$1 url=$2 pattern=$3
    shift 3
    local got
    got=$(headers "$url" "$@")
    if echo "$got" | grep -qiE "$pattern"; then
        echo "ok   $url: $what"
    else
        fail "$url: expected $what ($pattern), got:"
        echo "$got" | sed 's/^/       /'
    fi
}
expect_not() {
    local what=$1 url=$2 pattern=$3
    shift 3
    local got
    got=$(headers "$url" "$@")
    if echo "$got" | grep -qiE "$pattern"; then
        fail "$url: expected no $what ($pattern), got:"
        echo "$got" | sed 's/^/       /'
    else
        echo "ok   $url: no $what"
    fi
}

script=$(ls dist/_astro/*.js | head -1 | sed "s#^dist##")
style=$(ls dist/_astro/*.css | head -1 | sed "s#^dist##")
wasm=$(find dist -name "*.wasm" | head -1 | sed "s#^dist##")

expect "the app page" / "content-type: *text/html"
expect "html for a deep link" /reference/ "content-type: *text/html"
expect "html for a rules page" /rules/seeking/radar-questions/ "content-type: *text/html"
expect "javascript type" "$script" "content-type: *(application|text)/javascript"
expect "a year of caching" "$script" "cache-control:.*immutable"
expect "gzip for scripts" "$script" "content-encoding: *gzip" -H "Accept-Encoding: gzip"
expect "css type" "$style" "content-type: *text/css"
expect "javascript type for the service worker" /sw.js "content-type: *(application|text)/javascript"
expect "no caching of the service worker" /sw.js "cache-control: *no-cache"
expect "manifest type" /manifest.webmanifest "content-type: *application/manifest\+json"
[ -n "$wasm" ] && expect "wasm type" "$wasm" "content-type: *application/wasm"
expect "json type" /data/manifest.json "content-type: *application/json"
expect "gzip for reference data" /data/manifest.json "content-encoding: *gzip" -H "Accept-Encoding: gzip"
expect "gzip for elevation tiles" /data/elevation/9/1/1.i16 "content-encoding: *gzip" -H "Accept-Encoding: gzip"
expect "no caching of reference data" /data/manifest.json "cache-control: *no-cache"
expect "a piece of the basemap (206)" /tiles/basemap.pmtiles "status: 206" -H "Range: bytes=0-9" -H "Accept-Encoding: gzip"
expect "exactly the 10 bytes asked for" /tiles/basemap.pmtiles "content-length: *10" -H "Range: bytes=0-9" -H "Accept-Encoding: gzip"
expect_not "compression of the basemap" /tiles/basemap.pmtiles "content-encoding" -H "Range: bytes=0-9" -H "Accept-Encoding: gzip"
expect "404 for a missing tile" /data/elevation/9/9/9.i16 "status: 404"

kill "$pid" && wait "$pid" 2>/dev/null || true
pid=""
# (The 404 check above logs an expected "No such file" line.)
if grep -vE "could not open error log|No such file or directory" "$work/logs/error.log" | grep -qE "\[(warn|error|emerg)\]"; then
    fail "nginx logged warnings or errors:"
    grep -E "\[(warn|error|emerg)\]" "$work/logs/error.log" | sed 's/^/       /'
fi

# --- The host site configs: syntax, with stand-in certificates and snippets.
# (`nginx -t` also binds the ports listened on, so they're moved too.)
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=jetlag.sharankov.com" \
    -keyout "$work/key.pem" -out "$work/cert.pem" 2>/dev/null
: > "$work/snippets/authelia-location.conf"
: > "$work/snippets/authelia-authrequest.conf"
for conf in deploy/nginx/jetlag.sharankov.com.conf deploy/nginx/jetlag.sharankov.com.noauth.conf; do
    sed -e "s#/etc/letsencrypt/live/[^/]*/fullchain.pem#$work/cert.pem#" \
        -e "s#/etc/letsencrypt/live/[^/]*/privkey.pem#$work/key.pem#" \
        -e "s#listen 80;#listen 127.0.0.1:$((PORT + 1));#" \
        -e "s#listen 443 ssl http2;#listen 127.0.0.1:$((PORT + 2)) ssl http2;#" \
        -e "/listen \[::\]/d" \
        "$conf" > "$work/site.conf"
    common "$work/site.conf" > "$work/host.conf"
    set +e
    output=$("$NGINX" -t -p "$work" -c "$work/host.conf" 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
        echo "ok   $conf: syntax"
    else
        fail "$conf:"
        echo "$output" | grep -v "could not open error log" | sed 's/^/       /'
    fi
done

if [ "$failures" -gt 0 ]; then
    echo "$failures check(s) failed."
    exit 1
fi
echo "All nginx checks passed."
