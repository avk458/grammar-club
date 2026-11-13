#!/bin/bash
# Theme-set hook: repaint the Grammar Club web app in the current Omarchy theme.
#
# Writes ~/.local/share/grammar-club/omarchy-theme.css from the theme's
# colors.toml. An open app polls that file, so it follows a theme change without
# a reload. Do nothing when the app is not installed.

set -u

APP_DIR="$HOME/.local/share/grammar-club"
CSS="$APP_DIR/omarchy-theme.css"
COLORS="$HOME/.local/state/omarchy/current/theme/colors.toml"

[[ -d $APP_DIR ]] || exit 0
[[ -f $COLORS ]] || exit 0
command -v omarchy-theme-color >/dev/null || exit 0

color() { omarchy-theme-color --file "$COLORS" "$1" "$2"; }

background=$(color background "#1e1e2e")
foreground=$(color foreground "#cdd6f4")
accent=$(color accent "#89b4fa")
mode=$(color mode "dark")
# A theme without darker_background keeps its code blocks in the page colour
# rather than falling back to another theme's.
deep=$(color darker_background "$background")

cat >"$CSS.tmp" <<EOF
/* Generated from the Omarchy theme "${1:-unknown}". Do not edit. */
:root {
  color-scheme: $mode;
  --om-background: $background;
  --om-foreground: $foreground;
  --om-accent: $accent;
  --om-surface: color-mix(in srgb, $foreground 5%, $background);
  --om-surface-strong: color-mix(in srgb, $foreground 10%, $background);
  --om-border: color-mix(in srgb, $foreground 16%, $background);
  --om-muted: color-mix(in srgb, $foreground 55%, $background);
  --om-accent-foreground: $background;
  --om-code-background: $deep;
  --om-quote-background: color-mix(in srgb, $accent 14%, $background);
  --om-selection: color-mix(in srgb, $accent 28%, $background);
}
EOF

mv "$CSS.tmp" "$CSS"
