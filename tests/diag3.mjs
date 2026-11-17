import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', e => console.log('PAGEERROR:', e.message)); p.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()) })
await p.goto('http://127.0.0.1:3010', { waitUntil: 'load' })
await p.waitForTimeout(1200)
await p.click('text=Novo Jogo')
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(120)
  const st = await p.evaluate(() => {
    const G = window.__AETHERIA__, pl = G.player
    const h = G.worldApi.heightAt(0, 12)
    return {
      t: performance.now().toFixed(0),
      pos: [pl.pos.x, pl.pos.y, pl.pos.z],
      ground: h,
      vy: pl.vy, yaw: pl.yaw, cam: [G.camera.position.x, G.camera.position.y, G.camera.position.z],
      rigS: [pl.rig.position.x, pl.rig.position.y, pl.rig.position.z],
      state: pl.state, moving: pl.moving,
    }
  })
  console.log(JSON.stringify(st))
}
const h2 = await p.evaluate(() => {
  const G = window.__AETHERIA__
  const pl = G.player
  pl.pos.set(0, G.worldApi.heightAt(0, 12), 12)
  return [pl.pos.x, pl.pos.y, pl.pos.z]
})
console.log('after fix set:', h2)
await p.waitForTimeout(800)
console.log(await p.evaluate(() => { const pl = window.__AETHERIA__.player; return [pl.pos.x, pl.pos.y, pl.pos.z, window.__AETHERIA__.camera.position.toArray()] }))
await b.close()
