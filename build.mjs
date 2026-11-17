// Build: empacota src/main.js + CSS em dist/ via esbuild (three.js fica local, sem CDN).
import { build } from 'esbuild'
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/game.js',
  sourcemap: false,
  logLevel: 'info',
  alias: { three: './node_modules/three/build/three.module.js' },
})

if (existsSync('dist/game.css')) {
  console.log('css: dist/game.css ok')
} else {
  console.warn('css: nenhum CSS emitido')
}

copyFileSync('index.html', 'dist/index.html')
console.log('build ok → dist/')
