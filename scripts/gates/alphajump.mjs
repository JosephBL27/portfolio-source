// Gate: the particle field must not stay hidden after a jump out of the first two stops (the Work forms were blank: wave-22 r2-forms).
// Cause it guards: hero3d (the 3D name) released its hold on the particle alpha in a frame where the value its late hook had queued last frame (0) still won the
// arbiter's lowest-request rule, and nobody wrote again, so uFieldHide stayed 1 from the name through surface .. chomchom until stages.ts first wrote at Systems.
// Usage: node scripts/gates/alphajump.mjs --port 5321   (exit 1 when any Work stop has uFieldHide > 0.05 after a "1" jump from the clouds or the name stop)
// Pins the quality tier (?tier=0&adaptive=0) so a loaded machine cannot change the look; reads the shader uniform, no screenshot needed.
import { withBrowser } from '../lib/browser.mjs'
import { devUrl, flag, quietHmr } from './common.mjs'

const site = devUrl(), WORK = ['surface', 'cloudflare', 'appfolio', 'recruiting', 'chomchom'], LIMIT = +flag('limit', '0.05')
const results = []
await withBrowser(async (b) => {
  for (const from of [0, 1]) {                     // 0 = the clouds (first screen), 1 = the name
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    await quietHmr(p)
    await p.goto(site + '?gate=0&tier=0&adaptive=0', { waitUntil: 'load', timeout: 120000 })
    await p.waitForFunction(() => window.__v3?.goto && window.__v3Ready, null, { timeout: 150000 })
    await p.waitForTimeout(3000)
    const dwell = (i) => p.waitForFunction((i) => { const s = window.__v3.state(); return s.dwelling && s.wp === i }, i, { timeout: 40000 })
    const hide = () => p.evaluate(() => +window.__v3.field.points.material.uniforms.uFieldHide.value.toFixed(3))
    if (from === 1) { await p.keyboard.press('ArrowDown'); await dwell(1); await p.waitForTimeout(1500) }
    await p.keyboard.press('1')                    // the Work key: a jump across the name, the same as the menu and the Index
    await dwell(3); await p.waitForTimeout(1800)
    const row = { from: from === 0 ? 'clouds' : 'name', stops: {} }
    row.stops[WORK[0]] = await hide()
    for (let k = 1; k < WORK.length; k++) { await p.keyboard.press('ArrowDown'); await dwell(3 + k); await p.waitForTimeout(1500); row.stops[WORK[k]] = await hide() }
    results.push(row)
    await ctx.close()
  }
})
const bad = results.flatMap(r => Object.entries(r.stops).filter(([, h]) => !(h <= LIMIT)).map(([id, h]) => `${r.from} -> ${id}: uFieldHide ${h}`))
console.log(JSON.stringify({ results, limit: LIMIT, bad }, null, 1))
process.exitCode = bad.length ? 1 : 0
