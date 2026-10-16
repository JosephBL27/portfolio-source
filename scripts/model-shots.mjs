// Unit 14D: before/after shots of the hub TV, the turntable and the chess set at their stops (1440x900), plus the scripted interaction checks.
// usage: node scripts/model-shots.mjs --port 5417 --out shots/v18-model-before [--only hub,records,knight] [--noglb]
import { withBrowser } from './lib/browser.mjs'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const port = opt('port', '5417'), out = opt('out', 'shots/v18-model-x'), only = opt('only', 'hub,records,knight').split(',')
const extra = opt('q', '')
const sleep = ms => new Promise(r => setTimeout(r, ms))
await withBrowser(async browser => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage()
  await page.addInitScript(() => {
    const WS = window.WebSocket
    window.WebSocket = function (url, protocols) { if (String(protocols).includes('vite-hmr')) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 }; return new WS(url, protocols) }
    window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
  })
  const logs = []
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('[glb]')) logs.push(`[error] ${m.text()}`) })
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  await page.goto(`http://localhost:${port}/?extras=-pov${extra}`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.__v3 && window.__v3.field, null, { timeout: 60000 })
  await sleep(800)
  const gate = page.getByText('Enter silently', { exact: false }).first()
  if (await gate.count()) { await gate.click({ timeout: 8000 }).catch(() => {}); await sleep(2500) }
  const wid = { hub: 'world', hubclose: 'world', guitar: 'guitar', records: 'records', knight: 'knight' }
  for (const k of only) {
    if (k === 'hubclose') await page.evaluate(async () => { const l = await import('/src/v3/world/layout.ts'); const w = l.WAYPOINTS.find(x => x.id === 'world'); w.cam.pos = [2.5, 1.0, 14.5]; w.cam.target = [-3.6, 0, 0]; w.cam.fov = 38 })
    await page.evaluate(async id => { const f = await import('/src/v3/world/flight.ts'); window.__v3.goto(f.waypointP(f.waypointIndex(id))) }, wid[k]); await sleep(+opt('settle', 5000))
    const clip = opt('clip', null); await page.screenshot({ path: `${out}-${k}.png`, ...(clip ? { clip: Object.fromEntries(['x', 'y', 'width', 'height'].map((n, i) => [n, +clip.split(',')[i]])) } : {}) }); console.log('shot', `${out}-${k}.png`)
  }
  console.log(logs.join('\n') || 'no console errors')
})
