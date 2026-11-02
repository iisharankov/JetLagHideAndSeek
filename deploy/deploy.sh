#!/usr/bin/env bash
# Deploys the latest code on the server: pulls, rebuilds the app images and
# restarts the app. Map data, the games database and the photos are kept.
#
#   deploy/deploy.sh            pull, rebuild web + api (+ updater), restart
#   deploy/deploy.sh --no-pull  rebuild and restart what is checked out
#
# Afterwards give the containers a minute, then run deploy/check.sh. If the
# change touched the reference data builder (server/datasets/ or
# src/maps/datasets/), also run deploy/update-data.sh.
set -euo pipefail
cd "$(dirname "$0")"

pull=1
for arg in "$@"; do
    case "$arg" in
        --no-pull) pull=0 ;;
        -h | --help)
            sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 2
            ;;
    esac
done

[ -f .env ] || echo "Note: deploy/.env is missing, the defaults apply (cp .env.example .env)."

before=$(git rev-parse --short HEAD)
if [ "$pull" -eq 1 ]; then
    git pull --ff-only
fi
after=$(git rev-parse --short HEAD)

# The updater image is rebuilt too, so update-data.sh always runs the code
# that is checked out.
docker compose --profile tools build web api updater
# --remove-orphans drops containers of services no longer in the compose file.
docker compose up -d --remove-orphans web api
docker image prune -f >/dev/null

if [ "$before" = "$after" ]; then
    echo "Deployed $after (no new commits)."
else
    echo "Deployed $after (was $before):"
    git log --oneline "$before..$after" | sed 's/^/  /'
    if git diff --name-only "$before" "$after" | grep -qE '^(server/datasets/|src/maps/datasets/)'; then
        echo "The reference data builder changed: run deploy/update-data.sh too."
    fi
fi
echo "Give the containers a minute, then run deploy/check.sh."
