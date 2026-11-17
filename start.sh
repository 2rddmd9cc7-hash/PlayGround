#!/usr/bin/env bash
# Build the project and serve the static output in the foreground.
#
# Static output always lives inside PROJECT_DIR (dist/ when built, or the
# project root for a plain static site). Worker metadata such as the
# deployment descriptor stays in OPENCODE_WEB_DIR.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT

RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
BUILD_DIR="$PROJECT_DIR/dist"

/usr/bin/time -p mkdir -p "$WEB_DIR"

STATIC_DIR=""
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
  if /usr/bin/time -p node -e 'const p=require("./package.json");process.exit(p.scripts && p.scripts.build ? 0 : 1)'; then
    /usr/bin/time -p npm run build
  fi
  if [[ -f "$BUILD_DIR/index.html" ]]; then
    STATIC_DIR="$BUILD_DIR"
  elif [[ -f "$PROJECT_DIR/index.html" ]]; then
    STATIC_DIR="$PROJECT_DIR"
  else
    echo "Build did not produce $BUILD_DIR/index.html" >&2
    exit 1
  fi
elif [[ -f "$PROJECT_DIR/index.html" ]]; then
  STATIC_DIR="$PROJECT_DIR"
else
  # No application source in the repository: publish a minimal placeholder so
  # the deployment has a valid static entry point instead of failing.
  /usr/bin/time -p mkdir -p "$BUILD_DIR"
  /usr/bin/time -p cat > "$BUILD_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0b1220" />
  <title>PlayGround</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #e8eefc;
      background: radial-gradient(circle at 20% 10%, #1d3557, #0b1220 62%);
    }
    main {
      width: min(560px, 100%);
      padding: 40px 32px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }
    .mark {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 22px;
      background: linear-gradient(135deg, #5b8cff, #9d6bff);
    }
    h1 { margin: 20px 0 10px; font-size: clamp(1.6rem, 5vw, 2.2rem); letter-spacing: -0.02em; }
    p { margin: 0; line-height: 1.6; color: #a9b8d4; }
    code { padding: 2px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); color: #d7e2ff; }
    .tag {
      display: inline-block;
      margin-top: 26px;
      padding: 7px 13px;
      border-radius: 999px;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #c9d6f5;
      background: rgba(120, 160, 255, 0.12);
      border: 1px solid rgba(120, 160, 255, 0.25);
    }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">✦</div>
    <h1>PlayGround</h1>
    <p>O projeto está vazio e pronto para um novo build. Adicione um <code>index.html</code> ou um <code>package.json</code> com script de build para publicar seu app.</p>
    <span class="tag">aguardando novo projeto</span>
  </main>
</body>
</html>
HTML
  STATIC_DIR="$BUILD_DIR"
fi

/usr/bin/time -p printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$STATIC_DIR" > "$WEB_DIR/deployment-output.json"

STATIC_DIR="$STATIC_DIR" node -e 'process.stdout.write(`static output: ${process.env.STATIC_DIR}\n`)'
export STATIC_DIR

# Keep the server in the foreground; the controller reuses it while healthy.
exec /usr/bin/time -p node "$PROJECT_DIR/serve.mjs"
