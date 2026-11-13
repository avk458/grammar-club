#!/bin/bash
# Serve the installed copy from localhost and open it as a web app.
# A file:// page cannot route between chapters, so the book needs a server.

set -euo pipefail

APP_DIR=$(dirname "$(readlink -f "$0")")
PORT=8788
BASE="http://127.0.0.1:$PORT"
URL="$BASE/content/Chapter01.html"

if ! curl -fsS -o /dev/null "$BASE/"; then
  setsid python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$APP_DIR" \
    >/dev/null 2>&1 8>&- &
  for _ in {1..50}; do
    curl -fsS -o /dev/null "$BASE/" && break
    sleep 0.1
  done
fi

exec omarchy-launch-webapp "$URL"
