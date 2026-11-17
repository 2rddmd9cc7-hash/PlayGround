/* Teste headless: inicialização, menu, novo jogo, HUD e jogabilidade. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.TEST_URL || 'http://127.0.0.1:3010'
mkdirSync('/tmp/opencode/shots', { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/opencode/shots/01-menu.png' })

const menuVisible = await page.locator('#menu-root .menu-btn', { hasText: 'Novo Jogo' }).count()
console.log('menu visível:', menuVisible > 0)

await page.click('text=Novo Jogo')
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/opencode/shots/02-village.png' })

const hudVisible = await page.locator('#hud').isVisible()
console.log('hud visível:', hudVisible)
console.log('element chip oculto:', await page.locator('#element-chip').isHidden())

// movimenta e olha em volta
await page.keyboard.down('KeyW')
await page.waitForTimeout(1200)
await page.keyboard.up('KeyW')
await page.mouse.move(640, 360)
await page.mouse.down({ button: 'right' })
await page.mouse.move(760, 340, { steps: 8 })
await page.mouse.up({ button: 'right' })
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/opencode/shots/03-walk.png' })

// ataque
await page.mouse.click(640, 360)
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/opencode/shots/04-attack.png' })

// teleporta para o castelo (via estado interno, se exposto) — usa caminhada longa alternativa
const state = await page.evaluate(() => {
  const w = window
  return {
    hasG: !!w.__AETHERIA__,
  }
})
console.log('debug exposto:', state.hasG)

// verifica contadores de FPS aproximados
const perf = await page.evaluate(() => new Promise((res) => {
  let frames = 0
  const t0 = performance.now()
  function f() { frames++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(frames) }
  requestAnimationFrame(f)
}))
console.log('fps aprox:', perf)

console.log('erros:', errors.length ? errors : 'nenhum')
await browser.close()
if (errors.length) process.exitCode = 1
