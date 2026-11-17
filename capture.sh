#!/usr/bin/env bash
# Capture desktop and mobile screenshots of the deployed app.
#
# Required environment:
#   CAPTURE_URL  exact page URL to open
#   CAPTURE_DIR  output directory (kept outside the project source)
#
# Exit codes: 0 success, 75 temporary navigation/browser infrastructure
# failure, 1 script or rendering defect. The app server is left running.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"

if [[ -z "${CAPTURE_URL:-}" ]]; then
  echo 'CAPTURE_URL is required.' >&2
  exit 1
fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then
  echo 'CAPTURE_DIR is required.' >&2
  exit 1
fi

case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "CAPTURE_URL must be an http(s) URL: $CAPTURE_URL" >&2; exit 1 ;;
esac

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"

set +e
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
status=$?
set -e

if [[ "$status" -eq 75 ]]; then
  echo 'Capture failed due to a temporary browser or navigation failure.' >&2
  exit 75
fi
if [[ "$status" -ne 0 ]]; then
  echo "Capture failed (exit $status)." >&2
  exit 1
fi

for view in desktop mobile; do
  screenshot="$CAPTURE_DIR/final-$view.png"
  if [[ ! -s "$screenshot" ]]; then
    echo "Rendering defect: missing screenshot $screenshot" >&2
    exit 1
  fi
  size="$(/usr/bin/time -p stat -c %s "$screenshot")"
  if [[ "$size" -lt 1024 ]]; then
    echo "Rendering defect: screenshot $screenshot is only $size bytes" >&2
    exit 1
  fi
  /usr/bin/time -p printf 'captured %s (%s bytes)\n' "$screenshot" "$size"
done
