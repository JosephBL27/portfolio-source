// QA for the music-driven visuals (unit 10V): one browser. usage: node scripts/vibe-qa.mjs <base-url> [--reduced]
import { chromium } from 'playwright-core'
const base = process.argv[2], reduced = process.argv.includes('--reduced')
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] })
const out = { push: s => console.log(s) }
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()) }); page.on('pageerror', e => logs.push('pageerror ' + e.message))
  await page.goto(base + '/?gate=0', { waitUntil: 'load', timeout: 60000 }); await page.waitForFunction(() => window.__v3 && window.__cab, null, { timeout: 90000 }); await page.waitForTimeout(3000)
  const recIdx = await page.evaluate(async () => { window.__fl = await import('/src/v3/world/flight.ts'); return window.__fl.waypointIndex('records') })
  out.push('recIdx ' + recIdx)
  await page.evaluate(async () => { await window.__v3.sfx.init?.(); window.__v3.sfx.setEnabled?.(true) })
  const idx = recIdx >= 0 ? recIdx : 0
  await page.evaluate(i => window.__v3.goto(window.__fl.waypointP(i)), idx); await page.waitForFunction(() => window.__cab?.stages?.records?.api, null, { timeout: 60000 }); await page.waitForFunction(() => window.__cab.report().find(e => e.id === 'records')?.r > 0.97, null, { timeout: 60000 }); await page.waitForTimeout(1500); out.push(JSON.stringify(await page.evaluate(() => window.__cab.report().filter(e => e.id === 'records'))))
  for (const song of [2, 0]) {
    await page.evaluate(i => window.__cab.stages.records.api.load(i), song)
    await page.waitForTimeout(9000)
    const st = await page.evaluate(() => ({ a: window.__cab.stages.records.api.user.audio, v: window.__vibe.uniforms, k: window.__vibe.k, rip: window.__vibe.ripples, b: { ...window.__vibe.bands } }))
    out.push(`song ${song} ` + JSON.stringify(st))
    if (!reduced) for (let n = 0; n < 12; n++) { const r = await page.evaluate(() => window.__vibe.uniforms.rip.some(x => x[3] > 0.3 && x[2] < 0.6)); if (r) break; await page.waitForTimeout(150) }
    await page.screenshot({ timeout: 90000, path: `shots/v14-vibe-${reduced ? 'rm-' : ''}${song}.png` })
  }
  // frame p95 while playing
  const p95 = await page.evaluate(() => new Promise(res => { const d = []; let l = performance.now(), n = 0; const f = t => { d.push(t - l); l = t; if (++n < 240) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ p50: d[120], p95: d[Math.floor(d.length * 0.95)], cpu: window.__atmos.cpu.vibe }) } }; requestAnimationFrame(f) }))
  out.push('frames ' + JSON.stringify(p95))
  // fly on: music keeps playing
  await page.evaluate(i => window.__v3.goto(window.__fl.waypointP(i + 2)), idx); await page.waitForTimeout(4000)
  out.push('flown-on ' + JSON.stringify(await page.evaluate(() => ({ playing: window.__cab.stages.records.api.user.audio, k: window.__vibe.k, pill: document.querySelector('.np')?.className }))))
  await page.screenshot({ timeout: 90000, path: `shots/v14-vibe-${reduced ? 'rm-' : ''}flown.png` })
  await page.click('.np-stop'); await page.waitForTimeout(3500)
  out.push('stopped ' + JSON.stringify(await page.evaluate(() => ({ k: window.__vibe.k, vibe: window.__vibe.uniforms.vibe, wash: window.__vibe.uniforms.wash, pill: document.querySelector('.np')?.className }))))
  out.push('errors ' + JSON.stringify(logs))
} finally { await browser.close() }

