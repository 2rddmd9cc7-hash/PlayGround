#!/usr/bin/env bash
# capture.sh — open CAPTURE_URL in a browser, wait for rendered content,
# and save final-desktop.png / final-mobile.png into CAPTURE_DIR.
# Exit codes: 0 ok · 75 temporary navigation/browser infrastructure failure · 1 script or rendering defect.
set -uo pipefail
cd "$(dirname "$0")"

: "${CAPTURE_URL:?Set CAPTURE_URL}" "${CAPTURE_DIR:?Set CAPTURE_DIR}"

# Per-command timing helper.
t() { /usr/bin/time -p "$@"; }

t mkdir -p "$CAPTURE_DIR"
t node scripts/capture.mjs
