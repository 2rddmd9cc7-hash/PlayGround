#!/usr/bin/env bash
# start.sh — install deps, build the static site into PROJECT_DIR/dist,
# publish deployment metadata, and serve it in the foreground on PORT (default 3000).
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
DIST="$PROJECT_DIR/dist"
WEB_META="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
export PORT DIST_DIR="$DIST"

# Per-command timing helper.
t() { /usr/bin/time -p "$@"; }

echo '[start] installing dependencies (if needed)'
if [[ ! -d node_modules/puppeteer-core ]]; then
  t npm ci --no-audit --no-fund || t npm install --no-audit --no-fund
else
  echo '[start] node_modules already present, skipping install'
fi

echo '[start] building static output into dist/'
t rm -rf "$DIST"
t mkdir -p "$DIST"
t cp -r index.html src vendor "$DIST/"
t test -f "$DIST/index.html"

echo '[start] writing deployment metadata'
t mkdir -p "$WEB_META"
t node -e "const f=process.argv[1];const d={project:process.argv[2],directory:process.argv[3]};require('fs').writeFileSync(f,JSON.stringify(d,null,2)+'\n')" \
  "$WEB_META/deployment-output.json" "$PROJECT_DIR" "$DIST"
t cat "$WEB_META/deployment-output.json"

echo "[start] serving $DIST in the foreground on port $PORT"
exec /usr/bin/time -p node scripts/serve.mjs
