// Gate: parks the camera at each of the 28 waypoints (waypointP(i)) on a dev server with ?gate=0, opens five case views, and reports console/page errors.
// Usage: node scripts/gates/stepall2.mjs [--url http://localhost:5490/ | --port 5490]   (start `npx vite --port 5490 --strictPort` first; exit 1 on any error)
// Source: copied 2026-10-11 from the wave-22 scratch copy of stepall2.mjs (volatile /tmp path); flags, quiet HMR, exit code and the browser via withBrowser() added.
import { withBrowser } from '../lib/browser.mjs'
import { devUrl, quietHmr } from './common.mjs'

const base = devUrl()
const result = await withBrowser(async (b) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 180)))
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)) })
  await quietHmr(p)
  await p.goto(base + '?gate=0', { waitUntil: 'load', timeout: 90000 })
  await p.waitForFunction(() => window.__v3?.goto, null, { timeout: 120000 })
  const ids = await p.evaluate(async () => { const L = await import('/src/v3/world/layout.ts'); return L.WAYPOINTS.map(w => w.id) })
  for (let i = 0; i < ids.length; i++) {
    await p.evaluate(async (i) => { const F = await import('/src/v3/world/flight.ts'); window.__v3.goto(F.waypointP(i)) }, i)
    await p.waitForTimeout(900)
  }
  const ids2 = ['axe-os', 'qvr', 'second-brain', 'table-model', 'thrift']
  for (const id of ids2) { await p.evaluate(id => { window.__v3.caseView?.close?.(); window.__v3.openWork(id) }, id); await p.waitForTimeout(1500) }
  return { waypoints: ids.length, ids: ids.join(' '), errs: [...new Set(errs)].slice(0, 10) }
})
console.log(JSON.stringify(result))
process.exitCode = result.errs.length ? 1 : 0
