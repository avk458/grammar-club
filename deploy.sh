#!/usr/bin/env bash
# Build the site for a GitHub Pages project page and push it to gh-pages.

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

REPO=${REPO:-avk458/grammar-club}

# VuePress 1 runs on webpack 4, which needs the legacy OpenSSL provider from
# Node 17 on.
if (( $(node -p 'process.versions.node.split(".")[0]') >= 17 )); then
  export NODE_OPTIONS=--openssl-legacy-provider
fi

[[ -d node_modules ]] || npm install --no-audit --no-fund
npm run github:build

cd docs/.vuepress/github
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-$(git config user.name || echo deploy)}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-$(git config user.email || echo deploy@localhost)}" \
    commit -q -m 'deploy'
git push -f "git@github.com:$REPO.git" gh-pages
