#!/bin/bash
# Install the launcher and the desktop entry for the hosted Grammar Club app.
#
#   ./install.sh
#
# The app itself is served from GitHub Pages (see deploy.sh), so this only
# writes ~/.local/bin/grammar-club and the .desktop file.

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

APP_NAME="Grammar Club"
LAUNCHER="$HOME/.local/bin/grammar-club"
DESKTOP="$HOME/.local/share/applications/$APP_NAME.desktop"
URL="https://avk458.github.io/grammar-club/"

install -Dm 755 scripts/launch.sh "$LAUNCHER"

mkdir -p "${DESKTOP%/*}"
cat >"$DESKTOP" <<EOF
[Desktop Entry]
Version=1.0
Name=$APP_NAME
Comment=$APP_NAME
Exec=$LAUNCHER
StartupWMClass=$(omarchy-webapp-window-class "$URL")
Terminal=false
Type=Application
Icon=grammar-club
StartupNotify=true
EOF
chmod +x "$DESKTOP"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Installed $APP_NAME: $DESKTOP"
