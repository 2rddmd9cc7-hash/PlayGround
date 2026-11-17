// Minimal static file server for the built output.
// Static root and port come from STATIC_DIR and PORT (set by start.sh).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve(process.env.STATIC_DIR || 'dist')
const port = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
}

async function fileFor(pathname) {
  const candidate = resolve(root, '.' + decodeURIComponent(pathname))
  if (candidate !== root && !candidate.startsWith(root + sep)) return null
  const info = await stat(candidate).catch(() => null)
  if (!info) return null
  if (info.isDirectory()) {
    const index = resolve(candidate, 'index.html')
    return (await stat(index).catch(() => null))?.isFile() ? index : null
  }
  return info.isFile() ? candidate : null
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost')
    let file = await fileFor(url.pathname)
    // Serve the app shell for extension-less routes (SPA fallback).
    if (!file && !extname(url.pathname)) file = await fileFor('/index.html')
    if (!file) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    const body = await readFile(file)
    response.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': url.searchParams.has('omgithub_live') ? 'no-store' : 'no-cache',
      'Content-Length': body.length
    })
    response.end(body)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
