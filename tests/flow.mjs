/* Teste de fluxo completo: vila → ancião → castelo → teste → invasão → mundo aberto. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.TEST_URL || 'http://127.0.0.1:3010'
mkdirSync('/tmp/opencode/shots', { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
const ev = (fn, arg) => page.evaluate(fn, arg)

await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(1200)
await page.click('text=Novo Jogo')
await page.waitForTimeout(1500)

// ---- 1) conversar com o ancião ----
await ev(() => window.__AETHERIA_TEST__.teleport(-2, -6))
await page.waitForTimeout(600)
console.log('perto do ancião:', await ev(() => window.__AETHERIA_TEST__.interact()))
await ev(() => window.__AETHERIA__.uiApi.advanceDialog())
await ev(() => window.__AETHERIA__.uiApi.advanceDialog())
await ev(() => window.__AETHERIA__.uiApi.advanceDialog())
await ev(() => window.__AETHERIA__.uiApi.advanceDialog())
await page.waitForTimeout(400)
let st = await ev(() => ({ phase: window.__AETHERIA__.story.phase, quests: window.__AETHERIA__.quests.active.map(a => a.id), done: window.__AETHERIA__.quests.done }))
console.log('após ancião:', st)
await page.screenshot({ path: '/tmp/opencode/shots/05-quest.png' })

// ---- 2) ir ao castelo, completar 'test' e tocar o cristal ----
await ev(() => window.__AETHERIA_TEST__.teleport(150, -44))
await page.waitForTimeout(1200)
st = await ev(() => ({ quests: window.__AETHERIA__.quests.active.map(a => a.id), done: window.__AETHERIA__.quests.done }))
console.log('no castelo:', st)
await ev(() => window.__AETHERIA_TEST__.teleport(150, -53))
await page.waitForTimeout(500)
await ev(() => window.__AETHERIA_TEST__.interact())
await page.waitForTimeout(3500)
await page.screenshot({ path: '/tmp/opencode/shots/06-crystal.png' })
st = await ev(() => ({ cine: window.__AETHERIA__.storyApi.cineActive, element: window.__AETHERIA__.player.element, el: window.__AETHERIA__.storyApi.chosen }))
console.log('durante o teste:', st)
await page.waitForTimeout(4500)
st = await ev(() => ({ cine: window.__AETHERIA__.storyApi.cineActive, element: window.__AETHERIA__.player.element, grim: window.__AETHERIA__.grimoireApi.granted, magic: window.__AETHERIA__.player.spellsUnlocked }))
console.log('fim do teste:', st)
await page.screenshot({ path: '/tmp/opencode/shots/07-element.png' })

// ---- 3) abrir grimório ----
await page.keyboard.press('KeyG')
await page.waitForTimeout(700)
console.log('grimório aberto:', await page.locator('.grim-spell').count())
await page.screenshot({ path: '/tmp/opencode/shots/08-grimoire.png' })
await page.keyboard.press('KeyG')
await page.waitForTimeout(400)

// ---- 4) invasão ----
await page.waitForTimeout(5000)
st = await ev(() => ({ invasion: window.__AETHERIA__.story.flags.invasion, wave: window.__AETHERIA__.storyApi.wave, enemies: window.__AETHERIA_TEST__.enemies.length, hp: window.__AETHERIA__.player.hp }))
console.log('invasão:', JSON.stringify({ invasion: st.invasion, wave: st.wave && { n: st.wave.n, spawned: st.wave.spawned }, enemies: st.enemies, hp: st.hp }))
await page.screenshot({ path: '/tmp/opencode/shots/09-invasion.png' })

// ataca um inimigo próximo
await ev(() => {
  const t = window.__AETHERIA_TEST__
  const p = window.__AETHERIA__.player
  const e = t.enemies.find((x) => !x.dead)
  if (e) { p.pos.x = e.pos.x - 1.6; p.pos.z = e.pos.z + 1.6; p.yaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); }
})
await page.waitForTimeout(300)
const before = await ev(() => window.__AETHERIA_TEST__.enemies.filter(e => !e.dead).map(e => e.hp))
for (let i = 0; i < 4; i++) { await page.mouse.click(640, 360); await page.waitForTimeout(450) }
const after = await ev(() => window.__AETHERIA_TEST__.enemies.filter(e => !e.dead).map(e => e.hp))
console.log('vida inimigos antes/depois:', before.slice(0, 4), after.slice(0, 4))
await page.screenshot({ path: '/tmp/opencode/shots/10-combat.png' })

// ---- 5) derrubar todas as ondas via dano ----
await ev(() => {
  const t = window.__AETHERIA_TEST__
  const p = window.__AETHERIA__.player
  for (let i = 0; i < 200; i++) {
    const alive = t.enemies.filter((e) => !e.dead)
    if (!alive.length) break
    for (const e of alive) t.damageEnemy(e, 9999, { silent: true })
  }
})
await page.waitForTimeout(14000)
st = await ev(() => ({ invasion: window.__AETHERIA__.story.flags.invasion, phase: window.__AETHERIA__.story.phase, quests: window.__AETHERIA__.quests.active.map(a => a.id), done: window.__AETHERIA__.quests.done }))
console.log('pós-invasão:', JSON.stringify(st))
await page.screenshot({ path: '/tmp/opencode/shots/11-openworld.png' })

// ---- 6) magia ----
const mpBefore = await ev(() => window.__AETHERIA__.player.mp)
await page.keyboard.press('Digit1')
await page.waitForTimeout(500)
const mpAfter = await ev(() => window.__AETHERIA__.player.mp)
console.log('magia: mana', mpBefore, '→', mpAfter)
await page.screenshot({ path: '/tmp/opencode/shots/12-magic.png' })

// ---- 7) save/load ----
const saved = await ev(() => { const ok = window.__AETHERIA_TEST__.saveApi.save(); return { ok, has: window.__AETHERIA_TEST__.saveApi.hasSave(), level: window.__AETHERIA__.player.level } })
console.log('save:', saved)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(1800)
await page.screenshot({ path: '/tmp/opencode/shots/13-reload.png' })
const contDisabled = await page.locator('[data-act="continue"]').isDisabled()
console.log('continuar habilitado:', !contDisabled)
await page.click('text=Continuar')
await page.waitForTimeout(1500)
st = await ev(() => ({ phase: window.__AETHERIA__.story.phase, element: window.__AETHERIA__.player.element, level: window.__AETHERIA__.player.level, grim: window.__AETHERIA__.grimoireApi.granted }))
console.log('após load:', st)
await page.screenshot({ path: '/tmp/opencode/shots/14-continue.png' })

console.log('erros:', errs.length ? errs : 'nenhum')
await browser.close()
if (errs.length) process.exitCode = 1
