import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const logs = []
p.on('console', m => logs.push(m.type() + ': ' + m.text()))
p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack))
await p.goto('http://127.0.0.1:3010', { waitUntil: 'load' })
await p.waitForTimeout(3000)
console.log(logs.join('\n').slice(0, 4000))
console.log('err msg:', await p.locator('#err-msg').textContent().catch(()=>''))
await p.screenshot({ path: '/tmp/opencode/shots/diag.png' })
await b.close()
