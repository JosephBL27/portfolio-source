// Real input, actual rendered camera bounds, and crag integration. One shared-lock browser.
import { withBrowser } from '../lib/browser.mjs'
import fs from 'node:fs'
const OUT = 'docs/review/hall-explore'; fs.mkdirSync(OUT, { recursive: true })
const checks = {}, errors = []
const check = (name, pass, info) => { checks[name] = { pass: !!pass, info }; console.log(name, pass, JSON.stringify(info ?? '')) }
await withBrowser(async browser => {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', e => errors.push(e.message))
  const start = async (q, id, qs = '') => {
    await q.goto('http://localhost:5490/?gate=0' + qs)
    await q.waitForFunction(() => window.__v3?.goto)
    await q.evaluate(async id => { const f = await import('/src/v3/world/flight.ts'); window.__v3.goto(null); window.__v3.ui.nav.go(id); window.__v3.follower.snap(f.waypointP(f.waypointIndex(id))); document.getElementById('loader')?.remove() }, id)
    await q.waitForFunction(id => id === 'hall' ? window.__hall?.state.live && window.__hall.rig.photoState === 'ready' : window.__spaces?.report().find(e => e.id === id)?.state === 'ready', id, { timeout: 30000 })
    await q.waitForTimeout(1400)
  }
  const state = () => p.evaluate(() => window.__hall.walk.state())
  const inBounds = s => Math.abs(s.local[0]) <= s.bounds.x + .001 && s.local[2] >= s.bounds.near - .001 && s.local[2] <= s.bounds.far + .001 && Math.abs(s.local[1] - 3.6) < .001
  await start(p, 'hall'); await p.screenshot({ path: OUT + '/hall-front.png' })
  const at = await state(); check('initial camera inside', inBounds(at), at)
  await p.mouse.move(700, 560); await p.mouse.down(); await p.mouse.move(1200, 560, { steps: 20 }); await p.mouse.move(220, 560, { steps: 25 }); await p.mouse.up(); await p.waitForTimeout(250)
  const turned = await state(); check('look rotates at fixed eye', turned.engaged && Math.abs(turned.yaw - at.yaw) > .5 && Math.hypot(...turned.local.map((v, i) => v - at.local[i])) < .3, turned)
  await p.waitForTimeout(1900); const stayed = await state(); check('look persists', Math.abs(stayed.yaw - turned.yaw) < .001, stayed)
  await p.screenshot({ path: OUT + '/hall-turned.png' })
  for (let i = 0; i < 3; i++) { await p.mouse.move(1100, 420); await p.mouse.down(); await p.mouse.move(180, 420, { steps: 25 }); await p.mouse.up() }
  const fullTurn = await state(); check('unrestricted full turn inside room', Math.abs(fullTurn.yaw - turned.yaw) > Math.PI * 2 && inBounds(fullTurn), fullTurn)
  await p.screenshot({ path: OUT + '/hall-full-turn.png' })
  await p.locator('#hall-walk > button').click()
  const samples = []
  for (const key of ['w', 'a', 's', 'd']) {
    await p.keyboard.down(key)
    for (let i = 0; i < (key === 's' ? 16 : 9); i++) { await p.waitForTimeout(500); samples.push(await state()) }
    await p.keyboard.up(key)
  }
  check('all four walls constrain rendered eye', samples.every(inBounds) && samples.some(s => s.local[2] > 33) && samples.some(s => s.local[2] < 2) && samples.some(s => s.local[0] > 7) && samples.some(s => s.local[0] < -7), samples.map(s => s.local))
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(300); await p.keyboard.up('ArrowUp'); check('arrow walk keeps hall waypoint', await p.evaluate(() => window.__v3.state().wp === 21))
  // Dive from the walked position, rather than resetting to the original waypoint camera.
  const walkOrigin = await p.evaluate(() => window.__v3.field.camera.position.toArray())
  await p.locator('.hall-key').nth(0).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(2300)
  check('portal still leaves exploration', await p.evaluate(() => window.__v3.state().wp === 22 && !window.__hall.walk.state().live), { walkOrigin })
  await start(p, 'hold', '&noring=1'); await p.screenshot({ path: OUT + '/boulder-before.png' })
  await start(p, 'hold'); const ring = await p.evaluate(() => window.__spaces.report().find(e => e.id === 'hold'))
  check('baked scans integrated', ring.mode === 'ring' && ring.pieces === 13 && ring.tris <= 350000, ring)
  await p.screenshot({ path: OUT + '/boulder-after.png' })
  for (let i = 0; i < 26; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(45) }
  await p.waitForTimeout(2200); const look = await p.evaluate(() => window.__pov.state())
  check('crag full turn persists', look.look && look.yawDeg > 160, look)
  await p.screenshot({ path: OUT + '/boulder-rear.png' })
  await p.close()
  const q = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); q.on('pageerror', e => errors.push(e.message))
  await start(q, 'hall'); await q.screenshot({ path: OUT + '/hall-phone.png' })
  const before = await q.evaluate(() => window.__hall.walk.state().local)
  const forward = q.getByRole('button', { name: 'Walk forward', exact: true }), box = await forward.boundingBox()
  const input = await q.context().newCDPSession(q)
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 20, y: box.y + 20 }] })
  await q.waitForTimeout(70); const first = await q.evaluate(() => window.__hall.walk.state().local)
  check('phone first input does not jump', Math.hypot(...first.map((v, i) => v - before[i])) < .7, { before, first })
  await q.waitForTimeout(830); await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await input.detach()
  const after = await q.evaluate(() => window.__hall.walk.state().local)
  check('phone walk control', after[2] > before[2] + 1, { before, after })
  check('phone no overflow', await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await start(q, 'hold'); await q.screenshot({ path: OUT + '/boulder-phone.png' }); await q.close()
  const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await fallback.route('**/crag-ring.glb', route => route.abort()); await start(fallback, 'hold')
  const f = await fallback.evaluate(() => window.__spaces.report().find(e => e.id === 'hold')); check('failed crag retains old boulder space', f.mode === 'hdri' && f.ring === false, f)
  await fallback.close()
})
checks.errors = errors; fs.writeFileSync(OUT + '/checks.json', JSON.stringify(checks, null, 2))
if (errors.length || Object.values(checks).some(c => c?.pass === false)) process.exitCode = 1
