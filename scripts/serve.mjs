// Static file server for the built site. Serves DIST root in the foreground.
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

const DIST = resolve(process.env.DIST_DIR || 'dist')
const PORT = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (path === '/') path = '/index.html'
  const file = join(DIST, path)
  if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); res.end(); return }
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
  createReadStream(file).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[serve] serving ${DIST} on http://127.0.0.1:${PORT}/`)
})
server.on('error', (err) => { console.error('[serve] error:', err.message); process.exit(1) })
