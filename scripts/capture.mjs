// Capture final desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
// Exit codes: 0 ok · 75 temporary navigation/browser infrastructure failure · 1 script or rendering defect.
import puppeteer from 'puppeteer-core'

const url = process.env.CAPTURE_URL
const out = process.env.CAPTURE_DIR
if (!url || !out) { console.error('capture: CAPTURE_URL and CAPTURE_DIR are required'); process.exit(1) }
const CHROME = process.env.CAPTURE_BROWSER || '/usr/bin/chromium'
const t0 = Date.now()
const since = (label) => console.log(`[capture] ${label} took ${Date.now() - t0}ms (total)`)

const transient = (err) => Object.assign(err, { exitCode: 75 })

let browser
try {
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: 'new',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'],
      protocolTimeout: 120000, timeout: 30000,
    })
  } catch (e) { throw transient(new Error(`browser launch failed: ${e.message}`)) }
  since('browser launch')

  const failures = []
  for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const tView = Date.now()
    const page = await browser.newPage()
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile })
    page.setDefaultTimeout(30000)
    page.on('pageerror', (e) => { console.error(`[capture] pageerror: ${e.message}`); failures.push(e.message) })
    page.on('response', (r) => {
      if (r.status() >= 400 && new URL(r.url()).origin === new URL(url).origin) failures.push(`HTTP ${r.status()}: ${r.url()}`)
    })
    try {
      const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
      if (!resp || !resp.ok()) {
        const status = resp ? resp.status() : 0
        throw Object.assign(new Error(`load failed (HTTP ${status})`),
          { exitCode: !resp || [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1 })
      }
    } catch (e) {
      if (e.exitCode) throw e
      // navigation-level failure (connection refused, DNS, timeout) → transient
      throw transient(e)
    }
    // wait for rendered content: menu screen becomes visible after the game boots
    try {
      await page.waitForSelector(process.env.CAPTURE_READY_SELECTOR || '#menu-screen', { visible: true, timeout: 45000 })
    } catch (e) {
      if (e.message.includes('TimeoutError') || e.message.includes('timeout')) throw transient(e)
      throw e
    }
    await page.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 1200))
    try {
      await page.screenshot({ path: `${out}/final-${name}.png`, type: 'png', timeout: 30000 })
    } catch (e) {
      if (!browser.connected || e.message.includes('timeout')) throw transient(e)
      throw e
    }
    if (process.env.CAPTURE_STRICT === '1' && failures.length) {
      throw new Error(`rendering defects: ${failures.join('; ')}`)
    }
    console.log(`[capture] ${name} view captured${failures.length ? ` (with ${failures.length} console/network notes)` : ''} in ${Date.now() - tView}ms`)
    await page.close()
  }
  since('all captures')
} catch (err) {
  console.error(`[capture] ERROR: ${err.message}`)
  process.exitCode = err.exitCode || 1
} finally {
  if (browser) { try { await browser.close() } catch (e) { console.error('[capture] browser close failed'); process.exitCode ||= 75 } }
}
