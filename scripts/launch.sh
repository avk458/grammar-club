#!/bin/bash
# Open the Grammar Club web app in the current Omarchy palette and resume the
# last chapter that was open.
#
# The app is hosted on GitHub Pages, so nothing here serves it. The palette and
# the resume request travel in the URL: the page cannot read the theme itself.

set -uo pipefail

PAGES_URL="https://avk458.github.io/grammar-club/"
COLORS="$HOME/.local/state/omarchy/current/theme/colors.toml"

# colors.toml holds "#rrggbb"; the app takes the digits only, dash separated.
hex() {
  local value
  value=$(omarchy-theme-color --file "$COLORS" "$1" "$2" 2>/dev/null) || value=$2
  printf '%s' "${value#\#}"
}

url="$PAGES_URL?resume"
if [[ -f $COLORS ]] && command -v omarchy-theme-color >/dev/null; then
  background=$(hex background 1e1e2e)
  palette="$background-$(hex foreground cdd6f4)-$(hex accent 89b4fa)"
  palette="$palette-$(hex darker_background "$background")-$(hex mode dark)"

  if [[ $palette =~ ^[0-9a-fA-F]{6}(-[0-9a-fA-F]{6}){3}-(dark|light)$ ]]; then
    url="$PAGES_URL?om=$palette&resume"
  fi
fi

exec omarchy-launch-webapp "$url"
