// hold-stop shots + frame time: node scripts/hold-shot.mjs <base-url> <tag> [extra-query]   -> shots/v21-hold-<tag>-{desk,mob}.png and a JSON line
import { withBrowser } from './lib/browser.mjs'
const base = process.argv[2], tag = process.argv[3], q = process.argv[4] || ''
await withBrowser(async (b) => {
  const out = {}
  for (const [name, vp, mob] of [['desk', { width: 1440, height: 900 }, false], ['mob', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob })
    const p = await ctx.newPage(); const errs = []
    p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)) })
    await p.goto(base + '?gate=0' + q, { waitUntil: 'load', timeout: 90000 })
    await p.waitForFunction(() => window.__v3?.goto, null, { timeout: 120000 })
    await p.evaluate(async () => { const F = await import('/src/v3/world/flight.ts'); const L = await import('/src/v3/world/layout.ts'); const i = L.WAYPOINTS.findIndex(w => w.id === 'hold'); window.__v3.goto(F.waypointP(i - 1)) })
    await p.waitForTimeout(1500)
    await p.evaluate(async () => { const F = await import('/src/v3/world/flight.ts'); const L = await import('/src/v3/world/layout.ts'); const i = L.WAYPOINTS.findIndex(w => w.id === 'hold'); window.__v3.goto(F.waypointP(i)) })
    await p.waitForTimeout(6000)
    await p.screenshot({ path: `shots/v21-hold-${tag}-${name}.png` })
    const ft = await p.evaluate(() => new Promise(res => { const a = []; let l = performance.now(), n = 0; const f = t => { a.push(t - l); l = t; if (++n < 180) requestAnimationFrame(f); else { a.sort((x, y) => x - y); res({ avg: a.reduce((s, x) => s + x, 0) / a.length, p95: a[Math.floor(a.length * 0.95)] }) } }; requestAnimationFrame(f) }))
    out[name] = { ft, errs: [...new Set(errs)].slice(0, 6) }
    await ctx.close()
  }
  console.log(JSON.stringify(out))
})
