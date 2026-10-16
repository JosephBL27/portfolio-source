// Unit 14D: scripted interaction checks on the Blender-authored models. One shared-lock browser, closed in finally.
//   hub: the GLB hardware is in (mesh 'band'), the dial is hit-testable and a real drag around it changes the channel, both buttons hit-test and press
//   records: the GLB deck is in, a record drops (api.load(0)) and the phase walks sleeve -> drop -> ready, the arm group still holds the new arm meshes
//   knight: the GLB frame is in, a real click on the brass NEXT button steps one move and the pieces move
// usage: node scripts/model-check.mjs --port 5417 [--noglb]   (--noglb checks the procedural fallback with the same script)
import { withBrowser } from './lib/browser.mjs'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const port = opt('port', '5417'), noglb = args.includes('--noglb')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const res = []
const ok = (name, pass, info = '') => { res.push([name, !!pass]); console.log(pass ? 'PASS' : 'FAIL', name, info) }
await withBrowser(async browser => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage()
  await page.addInitScript(() => {
    const WS = window.WebSocket
    window.WebSocket = function (url, protocols) { if (String(protocols).includes('vite-hmr')) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 }; return new WS(url, protocols) }
    window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
  })
  const logs = []
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('[glb]')) logs.push(`[${m.type()}] ${m.text()}`) })
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  await page.goto(`http://localhost:${port}/?extras=-pov${noglb ? '&noglb' : ''}`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.__v3 && window.__v3.field, null, { timeout: 60000 })
  await sleep(800)
  const gate = page.getByText('Enter silently', { exact: false }).first()
  if (await gate.count()) { await gate.click({ timeout: 8000 }).catch(() => {}); await sleep(2500) }
  const goto = async id => { await page.evaluate(async i => { const f = await import('/src/v3/world/flight.ts'); window.__v3.goto(f.waypointP(f.waypointIndex(i))) }, id); await sleep(4500) }
  const hasMesh = name => page.evaluate(n => { let hit = false; window.__v3.field.scene?.traverse?.(o => { if (o.name === n && o.isMesh && o.visible) hit = true }); return hit }, name)

  // ---- hub
  await goto('world'); await sleep(2500)
  const sceneOk = await page.evaluate(() => !!window.__v3.field.scene)
  if (!sceneOk) console.log('note: field.scene not exposed; GLB presence is judged from the world root')
  const hubGlb = await page.evaluate(() => { let n = 0; window.__v3.world.root.traverse(o => { if (o.isMesh && ['band', 'bezel', 'controls'].includes(o.name)) n++ }); return n })
  ok('hub: GLB parts present', noglb ? hubGlb === 0 : hubGlb === 3, `meshes=${hubGlb}`)
  const dial = await page.evaluate(() => window.__v3.world.partScreen('hub', 'dial'))
  ok('hub: dial on screen', !!dial, JSON.stringify(dial))
  if (dial) {
    const hit = await page.evaluate(([x, y]) => window.__v3.world.hitTest(x, y), [dial.x, dial.y])
    ok('hub: dial hit-tests as dial', hit && hit.part === 'dial', JSON.stringify(hit))
    const p0 = await page.evaluate(() => window.__v3.world.hubProject)
    await page.mouse.move(dial.x, dial.y - dial.r * 0.7); await page.mouse.down()
    const R = dial.r * 0.7
    for (let k = 0; k <= 20; k++) { const a = -Math.PI / 2 + (k / 20) * 1.7; await page.mouse.move(dial.x + Math.cos(a) * R, dial.y + Math.sin(a) * R); await sleep(30) }
    await page.mouse.up(); await sleep(1800)
    const p1 = await page.evaluate(() => window.__v3.world.hubProject)
    ok('hub: dial drag changes the channel', p0 !== p1, `${p0} -> ${p1}`)
  }
  for (const part of ['btnA', 'btnB']) {
    const b = await page.evaluate(p => window.__v3.world.partScreen('hub', p), part)
    const hit = b && await page.evaluate(([x, y]) => window.__v3.world.hitTest(x, y), [b.x, b.y])
    ok(`hub: ${part} hit-tests`, hit && hit.part === part, JSON.stringify(hit))
  }
  const bA = await page.evaluate(() => window.__v3.world.partScreen('hub', 'btnA'))
  if (bA) {
    const g0 = await page.evaluate(() => window.__v3.world.glow().length)
    await page.mouse.click(bA.x, bA.y); await sleep(1800)
    const g1 = await page.evaluate(() => window.__v3.world.glow().length)
    ok('hub: button A (power) acts on a real click', g0 !== g1, `glow sources ${g0} -> ${g1}`)
    await page.mouse.click(bA.x, bA.y); await sleep(800)
  }

  // ---- records
  await goto('records'); await sleep(1500)
  const recGlb = await page.evaluate(() => { const s = window.__cab?.stages?.records; if (!s) return -1; let n = 0; s.root.traverse(o => { if (o.isMesh && ['plinth', 'plate', 'arm_metal', 'arm_cart'].includes(o.name)) n++ }); return n })
  ok('records: GLB deck present', noglb ? recGlb === 0 : recGlb === 4, `meshes=${recGlb}`)
  const phase0 = await page.evaluate(() => window.__cab.stages.records.api.user.phase)
  await page.evaluate(() => window.__cab.stages.records.api.load(0))
  const seen = new Set()
  for (let k = 0; k < 40; k++) { seen.add(await page.evaluate(() => window.__cab.stages.records.api.user.phase)); await sleep(150) }
  const user = await page.evaluate(() => { const u = window.__cab.stages.records.api.user; return { userMode: u.userMode, phase: u.phase, omega: u.omega } })
  ok('records: a record drops (sleeve -> drop -> ready, platter turns)', user.userMode && user.phase === 'ready' && user.omega > 0.5, `${phase0} -> ${[...seen].join(',')}  ${JSON.stringify(user)}`)
  const armKids = await page.evaluate(() => { const s = window.__cab.stages.records; let n = 0; s.root.traverse(o => { if (o.isMesh && o.name.startsWith('arm_')) n++ }); const spin = (() => { let r = null; s.root.traverse(o => { if (o.name === 'platter_body') r = o.parent.rotation.y }); return r })(); return { n, spin } })
  ok('records: platter group spinning, arm parts under the lifting group', noglb || (armKids.n === 3 && armKids.spin !== 0), JSON.stringify(armKids))

  // ---- chess
  await goto('knight'); await sleep(1500)
  const chGlb = await page.evaluate(() => { const s = window.__cab?.stages?.knight; if (!s) return -1; let n = 0; s.root.traverse(o => { if (o.isMesh && ['slab', 'brass', 'base'].includes(o.name)) n++ }); return n })
  ok('knight: GLB frame present', noglb ? chGlb === 0 : chGlb === 3, `meshes=${chGlb}`)
  const t0 = await page.evaluate(() => window.__cab.stages.knight.api.manualTarget)
  const nb = await page.evaluate(() => { const s = window.__cab.stages.knight, b = s.api.btns[1], v = b.getWorldPosition(new b.position.constructor()); const cam = window.__v3.field.camera; v.project(cam); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight } })
  const before = await page.evaluate(() => window.__cab.stages.knight.api.pieces.map(p => p.pivot.position.x.toFixed(2) + ',' + p.pivot.position.z.toFixed(2)).join('|'))
  await page.mouse.move(nb.x, nb.y); await sleep(200); await page.mouse.click(nb.x, nb.y); await sleep(2500)
  const t1 = await page.evaluate(() => window.__cab.stages.knight.api.manualTarget)
  const after = await page.evaluate(() => window.__cab.stages.knight.api.pieces.map(p => p.pivot.position.x.toFixed(2) + ',' + p.pivot.position.z.toFixed(2)).join('|'))
  ok('knight: a click on the brass NEXT button steps a move', t1 !== t0 && before !== after, `manualTarget ${t0} -> ${t1}, pieces moved=${before !== after}`)

  // ---- chalkboard (Education, 'mathecon'): the GLB parts are in the stage and the board is ready (no GLB: the stage stays empty, the form keeps the frame)
  await goto('mathecon'); await sleep(2500)
  const cb = await page.evaluate(() => { const want = ['board_face', 'frame_h', 'frame_v', 'ledge', 'chalk_white', 'chalk_pink', 'chalk_blue', 'eraser_body', 'eraser_felt', 'wall']; const have = window.__chalkboard?.parts?.() ?? []; return { n: want.filter(w => have.includes(w)).length, info: window.__chalkboard?.info?.() ?? null } })
  ok('chalkboard: GLB parts present', noglb ? cb.n === 0 : cb.n === 10, `meshes=${cb.n}`)
  ok('chalkboard: stage ready', noglb ? !cb.info?.ready : !!cb.info?.ready, JSON.stringify(cb.info && { ready: cb.info.ready, lines: cb.info.lines, canvas: cb.info.canvas }))
  console.log(logs.length ? logs.join('\n') : 'no console errors / glb warnings')
  ok('zero console errors', !logs.some(l => l.startsWith('[error]') || l.startsWith('[pageerror]')), '')
})
const bad = res.filter(r => !r[1])
console.log(bad.length ? `FAILED ${bad.length}/${res.length}` : `ALL PASS ${res.length}`)
process.exit(bad.length ? 1 : 0)
