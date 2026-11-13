#!/bin/bash
# Build Grammar Club and install it as an Omarchy web app that follows the theme.
#
#   ./install.sh
#
# Installs the built site to ~/.local/share/grammar-club, a theme-set hook that
# repaints it, and the desktop entry that launches it from localhost.

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

APP_NAME="Grammar Club"
APP_DIR="$HOME/.local/share/grammar-club"
HOOK="$HOME/.config/omarchy/hooks/theme-set.d/20-grammar-club"
DESKTOP="$HOME/.local/share/applications/$APP_NAME.desktop"
PORT=8788
URL="http://127.0.0.1:$PORT/content/Chapter01.html"

# VuePress 1 runs on webpack 4, which needs the legacy OpenSSL provider from
# Node 17 on.
if (( $(node -p 'process.versions.node.split(".")[0]') >= 17 )); then
  export NODE_OPTIONS=--openssl-legacy-provider
fi

[[ -d node_modules ]] || npm install --no-audit --no-fund
npm run build

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -a docs/.vuepress/dist/. "$APP_DIR/"
install -m 755 scripts/launch.sh "$APP_DIR/launch.sh"

install -Dm755 scripts/omarchy-theme.sh "$HOOK"
"$HOOK" "$(omarchy theme current)"

mkdir -p "${DESKTOP%/*}"
cat >"$DESKTOP" <<EOF
[Desktop Entry]
Version=1.0
Name=$APP_NAME
Comment=$APP_NAME
Exec=$APP_DIR/launch.sh
StartupWMClass=$(omarchy-webapp-window-class "$URL")
Terminal=false
Type=Application
Icon=grammar-club
StartupNotify=true
EOF
chmod +x "$DESKTOP"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Installed $APP_NAME to $APP_DIR"
echo "The web app listens on $URL"
