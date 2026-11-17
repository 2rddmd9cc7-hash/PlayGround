import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const logs = []
p.on('console', m => logs.push(m.type() + ': ' + m.text()))
p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
await p.goto('http://127.0.0.1:3010', { waitUntil: 'load' })
await p.waitForTimeout(1500)
await p.click('text=Novo Jogo')
await p.waitForTimeout(2500)
const st = await p.evaluate(() => {
  const G = window.__AETHERIA__
  const p = G.player
  return {
    phase: G.story.phase, paused: G.paused,
    player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw },
    camera: { x: G.camera.position.x, y: G.camera.position.y, z: G.camera.position.z },
    rig: { yaw: G.cameraRig.yaw, pitch: G.cameraRig.pitch, dist: G.cameraRig.dist, pos: G.cameraRig.pos.toArray() },
    sceneChildren: G.scene.children.length,
    region: G.region, hour: G.hour,
    colliders: G.colliders.length,
    fog: G.scene.fog ? [G.scene.fog.near, G.scene.fog.far, '#' + G.scene.fog.color.getHexString()] : null,
    bg: '#' + G.scene.background.getHexString(),
    enemies: G.enemies.length,
    npcs: G.npcs.length,
    rigVisible: p.rig.visible,
  }
})
console.log(JSON.stringify(st, null, 2))
console.log('LOGS:', logs.filter(l => l.startsWith('error') || l.startsWith('PAGEERROR')).join('\n') || 'ok')
await p.screenshot({ path: '/tmp/opencode/shots/diag2.png' })
await b.close()
