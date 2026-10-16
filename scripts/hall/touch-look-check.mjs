import { withBrowser } from '../lib/browser.mjs'
import fs from 'node:fs'
const report = {}, errors = [], check = (name, pass, info) => { report[name] = { pass: !!pass, info }; console.log(name, pass, JSON.stringify(info ?? '')) }
await withBrowser(async b => {
  const q = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); q.on('pageerror', e => errors.push(e.message))
  await q.goto('http://localhost:5490/?gate=0'); await q.waitForFunction(() => window.__v3?.goto)
  await q.evaluate(async () => { const f = await import('/src/v3/world/flight.ts'); window.__v3.goto(null); window.__v3.ui.nav.go('hall'); window.__v3.follower.snap(f.waypointP(21)); document.getElementById('loader')?.remove() })
  await q.waitForFunction(() => window.__hall?.state.live && window.__hall.rig.glassState === 'ready'); await q.waitForTimeout(1500)
  const before = await q.evaluate(() => window.__hall.walk.state()), input = await q.context().newCDPSession(q)
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 250, y: 410 }] })
  for (let i = 1; i <= 8; i++) { await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 250, y: 410 - i * 12 }] }); await q.waitForTimeout(45) }
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(750)
  const after = await q.evaluate(() => ({ ...window.__hall.walk.state(), wp: window.__v3.state().wp }))
  check('vertical phone drag looks and stays in hall', after.wp === 21 && after.engaged && Math.abs(after.pitch - before.pitch) > .15, { before, after })
  check('phone look keeps fixed eye', Math.hypot(...after.local.map((v, i) => v - before.local[i])) < .1)
  await q.getByRole('button', { name: 'Center view', exact: true }).click(); await q.waitForTimeout(200)
  check('center restores framed entry eye', await q.evaluate(before => Math.hypot(...window.__hall.walk.state().local.map((v, i) => v - before[i])) < .1, before.local))
  const point = await q.evaluate(async () => { const T = await import('/node_modules/three/build/three.module.js'); const v = new T.Vector3(); new T.Box3().setFromObject(window.__hall.rig.proxies[2]).getCenter(v); v.project(window.__v3.field.camera); return { x: (v.x * .5 + .5) * innerWidth, y: (1 - (v.y * .5 + .5)) * innerHeight } })
  await q.touchscreen.tap(point.x, point.y); await q.waitForTimeout(300); check('phone first portal tap still lights', await q.evaluate(() => !window.__hall.diving && window.__hall.hover[2] > .7))
  await q.touchscreen.tap(point.x, point.y); await q.waitForTimeout(2300); check('phone second tap still dives', await q.evaluate(() => window.__v3.state().wp === 24))
  await input.detach(); await q.close()
})
report.errors = errors; fs.writeFileSync('docs/review/hall-explore/touch-checks.json', JSON.stringify(report, null, 2)); if (errors.length || Object.values(report).some(x => x?.pass === false)) process.exitCode = 1
