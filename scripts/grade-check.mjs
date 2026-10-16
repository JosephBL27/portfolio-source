// Regression check for the colour grade (src/v3/engine/grade.ts + post.ts), the black background and the cosmos name screen (v20).
//   node scripts/grade-check.mjs [--url http://localhost:5173/] [--save dir] [--qs '&x=1'] [--baseline docs/review/w20-measure-fidelity.json] [--json]
// Canvas-only frames (the DOM overlay is hidden), the same method as scripts/colour-metrics.mjs: 1440x900, camera pinned at the stop, 2.5 s settle. Checks:
//   1. the looks are barely there (read from grade.ts): saturation >= 1, vibrance >= 0, zero lift, white-balance gain within +-6 percent, film <= 0.3;
//   2. COLOUR IS KEPT (targets 1): at every project stop except name / world, meanSat (HSV S over V > 0.15) is >= 0.95 x the c30f977 baseline (stored) AND >= 0.95 x the
//      working tree's own ?grade=0 measured LIVE in this run (a second page load, same stops, same method, no cap; median of three frames, 2.5 / 4.5 / 6.5 s, because several
//      forms are animated and one frame catches a sweep half-way); the stored committed-HEAD ?grade=0 is reported only (it was a lit-everywhere wash);
//      the 12-bin hue histogram keeps its shape: intersection with the baseline >= 0.30 at every stop (a one-hue wash collapses it), and the top-3 hue bins equal the baseline's
//      at ANY of the baseline's sampled phases (docs/review/w20-measure-fidelity.json basePhases: secretary, recruiting, mind, chomchom and watchdog are animated, so c30f977
//      itself shows two or three different top-3 sets): a stop passes when any of the run's three frames shows a set the baseline shows at some phase; >= 14 of 18 (15-16 measured,
//      18 with ?grade=0; the misses are surface and mind, where the hue of the picture itself sits ~10 degrees off c30f977's even with the grade, the extras and the post chain all off).
//      The strict count against the single stored 2.5 s baseline frame is reported next to it;
//   3. BLACK STAYS BLACK (target 2): 5th-percentile luma of the top 20 percent of rows <= 0.03 at name, world, hall and two mid-flight legs, with stars (bright small
//      points) and a subtle sky (mean sky luma above the black) still present at name;
//   4. COSMOS (target 3): at clouds and name there is no hub TV, chain or type rings (scene visibility, world.stats().hubShow, tvRects) and the pixels agree (the frame with the TV
//      force-hidden equals the natural frame, the frame with it force-shown does not); at world the TV is present, on, and its dial / buttons / power / channel work;
//   5. wiring: gradeState.area is the area of the stop, the grade is enabled, the crossfade along a leg is monotone;
//   6. zero console / page errors while stepping all the waypoints.
// The browser comes from scripts/lib/browser.mjs (shared slots, always closed). Needs a dev server (or preview) that serves the site.
import { withBrowser } from './lib/browser.mjs'
import { analyse } from './colour-metrics.mjs'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const URL = (opt('url', process.env.GRADE_URL || 'http://localhost:5173/')).replace(/\/?$/, '/')
const SAVE = opt('save', null)
const SKIP = new Set((opt('skip', '') || '').split(',').filter(Boolean))   // --skip colour,black: leave a stage out while iterating (a full run must skip nothing)
const QS = opt('qs', '')
const BASELINE = JSON.parse(fs.readFileSync(opt('baseline', fileURLToPath(new globalThis.URL('../docs/review/w20-measure-fidelity.json', import.meta.url))), 'utf8'))
if (SAVE) fs.mkdirSync(SAVE, { recursive: true })

const COLOUR_STOPS = ['secretary', 'watchdog', 'alarm', 'drill', 'table', 'market', 'record', 'pair', 'surface', 'cloudflare', 'appfolio', 'recruiting', 'chomchom', 'mind', 'school', 'mathecon', 'instrument', 'hall']
const AREA_OF = { secretary: 'systems', surface: 'work', appfolio: 'work', market: 'research', mind: 'mind', school: 'education', hall: 'about', name: 'hub', world: 'hub' }
const BLACK_STOPS = ['name', 'world', 'hall', 'mid:world', 'mid:school', 'mid:hall']   // p5 <= 0.03 (mid:<id> = halfway along the leg into <id>)
const P5 = 0.03, SAT_RATIO = 0.95, HUE_INTERSECTION = 0.30, TOP3_ANY_MIN = 14
const SAMPLES_MS = [2500, 2000, 2000]

const fails = [], notes = []
const fail = m => fails.push(m)
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const top3 = h => new Set(h.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]))
const HIDE = 'body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} html,body{background:#050506 !important}'
const errs = []
const out = { colour: {}, black: {}, cosmos: {}, looks: null }

// extra in-page metrics: stars (bright points in the top 20 percent of rows) and the mean luma of the sky (top 20 percent of rows)
const skyStats = (b64) => (async () => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height
  let stars = 0, sky = 0, n = 0
  for (let y = 0; y < Math.floor(H * 0.2); y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 4, l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    if (l > 0.4) stars++
    sky += l; n++
  }
  return { stars, sky: sky / Math.max(1, n) }
})()
// the hub chain hangs straight down the middle of the frame from the top: bright metal pixels in a narrow centre band over the upper quarter (stars are the only other thing there)
const chainPx = (b64) => (async () => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode()
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0)
  const W = c.width, H = c.height, d = x.getImageData(Math.floor(W / 2) - 10, 0, 20, Math.floor(H * 0.22)).data; let n = 0
  for (let i = 0; i < d.length; i += 4) if ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255 > 0.25) n++
  return n
})()

await withBrowser(async browser => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', e => errs.push('pageerror ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)) })
  for (let attempt = 0; ; attempt++) {   // a cold Vite dep optimiser can fail the first dynamic import: reload and retry
    await page.goto(`${URL}?gate=0${QS}`, { waitUntil: 'load', timeout: 90000 })
    try { await page.waitForFunction(() => window.__v3 && window.__v3.goto && window.__v3.field?.post?.gradeState, null, { timeout: attempt < 2 ? 60000 : 150000 }); break } catch (e) { if (attempt >= 2) throw e }
  }
  await page.waitForTimeout(3500)
  await page.evaluate(css => { const st = document.createElement('style'); st.id = 'gc-style'; st.textContent = css; document.head.append(st); document.getElementById('loader')?.remove() }, HIDE)
  const fly = (id, frac) => page.evaluate(async ([id, frac]) => {
    const f = await import('/src/v3/world/flight.ts'), L = await import('/src/v3/world/layout.ts')
    const leg = id.startsWith('mid:'), name = leg ? id.slice(4) : id, i = L.WAYPOINTS.findIndex(w => w.id === name)
    if (i < 0) throw new Error('no waypoint ' + name)
    if (leg) { const r = f.legRange(i); window.__v3.goto(r[0] + (r[1] - r[0]) * (frac ?? 0.5)) } else window.__v3.goto(f.waypointP(i))
  }, [id, frac ?? null])
  const shot = async (name) => { const b = await page.screenshot(); if (SAVE && name) fs.writeFileSync(`${SAVE}/${name}.png`, b); return b }
  const an = b => page.evaluate(analyse, b.toString('base64'))
  const gstate = () => page.evaluate(() => { const g = window.__v3.field.post.gradeState; return { area: g.area, enabled: g.enabled, sat: g.sat, gain: [...g.gain] } })

  // 1. the looks themselves
  const looks = await page.evaluate(async () => { const g = await import('/src/v3/engine/grade.ts'); return JSON.parse(JSON.stringify(g.LOOKS)) })
  out.looks = Object.fromEntries(Object.entries(looks).map(([k, l]) => [k, { sat: l.sat, vibrance: l.vibrance, film: l.film, gain: l.gain }]))
  for (const [k, l] of Object.entries(looks)) {
    if (!(l.sat >= 1)) fail(`look ${k}: saturation ${l.sat} < 1`)
    if (!(l.vibrance >= 0)) fail(`look ${k}: vibrance ${l.vibrance} < 0`)
    if (l.lift.some(v => v !== 0)) fail(`look ${k}: lift ${l.lift} is not zero (the blacks must stay black)`)
    if (l.gain.some(v => Math.abs(v - 1) > 0.06)) fail(`look ${k}: white-balance gain ${l.gain} is more than 6 percent off`)
    if (!(l.film <= 0.3)) fail(`look ${k}: film ${l.film} > 0.3`)
    for (const bad of ['shadow', 'mid', 'high', 'mixer', 'colour', 'accent']) if (bad in l) fail(`look ${k}: has a '${bad}' (a tint / mixer / hue replacement)`)
  }

  // 2a. the same stops with ?grade=0 (the working tree's own ungraded picture), measured live with the same method: the reference the grade is held against
  const g0Live = {}
  if (!SKIP.has('colour')) {
    const pg0 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    pg0.on('pageerror', e => errs.push('pageerror (grade=0) ' + e.message))
    for (let attempt = 0; ; attempt++) {
      await pg0.goto(`${URL}?gate=0&grade=0${QS}`, { waitUntil: 'load', timeout: 90000 })
      try { await pg0.waitForFunction(() => window.__v3 && window.__v3.goto && window.__v3.field, null, { timeout: attempt < 2 ? 60000 : 150000 }); break } catch (e) { if (attempt >= 2) throw e }
    }
    await pg0.waitForTimeout(3500)
    await pg0.evaluate(css => { const st = document.createElement('style'); st.id = 'gc-style'; st.textContent = css; document.head.append(st); document.getElementById('loader')?.remove() }, HIDE)
    for (const id of COLOUR_STOPS) {
      await pg0.evaluate(async id => { const f = await import('/src/v3/world/flight.ts'), L = await import('/src/v3/world/layout.ts'); window.__v3.goto(f.waypointP(L.WAYPOINTS.findIndex(w => w.id === id))) }, id)
      const sm = []
      for (const ms of SAMPLES_MS) { await pg0.waitForTimeout(ms); sm.push((await pg0.evaluate(analyse, (await pg0.screenshot()).toString('base64'))).meanSat) }
      g0Live[id] = med(sm)
    }
    await pg0.close()
  }
  out.g0Live = g0Live

  // 2. colour kept, three frames per stop
  await fly(COLOUR_STOPS[0]); await page.waitForTimeout(500)
  let top3Hits = 0, top3Any = 0
  for (const id of SKIP.has('colour') ? [] : COLOUR_STOPS) {
    await fly(id)
    const fr = []
    for (const ms of SAMPLES_MS) { await page.waitForTimeout(ms); const b = await shot(fr.length === 0 ? `colour-${id}` : null); fr.push(await an(b)) }
    const sat = med(fr.map(f => f.meanSat)), hist = fr[0].hueHist.map((_, i) => med(fr.map(f => f.hueHist[i])))
    const sum = hist.reduce((a, b) => a + b, 0) || 1, hn = hist.map(v => v / sum)
    const B = BASELINE.stops[id].base, G = BASELINE.stops[id]['head-g0']
    const inter = hn.reduce((a, v, i) => a + Math.min(v, B.hueHist[i]), 0)
    const same = [...top3(hn)].every(i => top3(B.hueHist).has(i)); if (same) top3Hits++
    const phases = [B.hueHist, ...((BASELINE.basePhases || {})[id] || []).map(p => p.hueHist)].map(top3)
    const sameAny = [hn, ...fr.map(f => f.hueHist)].some(h => phases.some(set => [...top3(h)].every(i => set.has(i)))); if (sameAny) top3Any++   // support overlap: any of this run's three frames (or their median) shows a top-3 set that c30f977 itself shows at some phase
    const rB = sat / B.meanSat, gRef = g0Live[id], rG = sat / gRef
    out.colour[id] = { meanSat: +sat.toFixed(3), base: B.meanSat, g0: G.meanSat, ratioBase: +rB.toFixed(2), ratioG0: +rG.toFixed(2), ratioG0Raw: +(sat / G.meanSat).toFixed(2), hueIntersection: +inter.toFixed(2), top3: [...top3(hn)].sort((a, b) => a - b), top3Base: [...top3(B.hueHist)].sort((a, b) => a - b), top3Same: same, top3SameAnyPhase: sameAny, g0Live: +gRef.toFixed(3), samples: fr.map(f => f.meanSat), black: fr[0].black, litFrac: fr[0].litFrac }
    if (rB < SAT_RATIO) fail(`${id}: meanSat ${sat.toFixed(3)} is ${rB.toFixed(2)}x the baseline ${B.meanSat.toFixed(3)} (< ${SAT_RATIO})`)
    if (rG < SAT_RATIO) fail(`${id}: meanSat ${sat.toFixed(3)} is ${rG.toFixed(2)}x this tree's ?grade=0 ${gRef.toFixed(3)} (< ${SAT_RATIO})`)
    if (inter < HUE_INTERSECTION) fail(`${id}: hue histogram intersection with the baseline ${inter.toFixed(2)} < ${HUE_INTERSECTION} (a one-hue wash?)`)
    const g = await gstate()
    if (AREA_OF[id] && g.area !== AREA_OF[id]) fail(`${id}: grade area is ${g.area}, expected ${AREA_OF[id]}`)
    if (!g.enabled) fail(`${id}: the grade is disabled`)
  }
  out.top3Same = top3Hits; out.top3Any = top3Any
  if (!SKIP.has('colour') && top3Any < TOP3_ANY_MIN) fail(`top-3 hue bins equal the baseline's (at any sampled baseline phase) at only ${top3Any} of ${COLOUR_STOPS.length} stops (< ${TOP3_ANY_MIN}; strict single-frame count ${top3Hits})`)

  // 3. black stays black
  for (const id of SKIP.has('black') ? [] : BLACK_STOPS) {
    await fly(id); await page.waitForTimeout(id === 'name' ? 9000 : 3500)
    const b = await shot(`black-${id.replace(':', '-')}`), m = await an(b), s = await page.evaluate(skyStats, b.toString('base64'))
    out.black[id] = { black: m.black, meanLuma: m.meanLuma, litFrac: m.litFrac, stars: s.stars, sky: +s.sky.toFixed(4) }
    if (!(m.black <= P5)) fail(`${id}: sky black level ${m.black.toFixed(3)} > ${P5}`)
    if (id === 'name') {
      if (s.stars < 8) fail(`name: only ${s.stars} bright star pixels in the upper frame (< 8): the stars are gone`)
      if (!(s.sky >= 0.02)) fail(`name: the sky is empty (mean luma ${s.sky.toFixed(4)} < 0.02): the Milky Way / nebula are gone`)
    }
  }

  // 4. cosmos: no hub TV / chain / rings at clouds and name; the TV with its controls at world
  const hubState = () => page.evaluate(() => {
    const w = window.__v3.world, sc = window.__v3.field.scene, s = w.stats()
    const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
    const tv = sc.getObjectByName('hub-tv'), rings = sc.getObjectByName('atmos-rings')
    return { hubShow: s.hubShow, hubOn: s.hubOn, tv: tv ? vis(tv) : null, rings: rings ? vis(rings) : false, rects: w.tvRects().filter(r => r.id === 'hub' || r.id === 'hub-chain').map(r => ({ id: r.id, shown: r.shown })) }
  })
  for (const id of ['clouds', 'name']) {
    await fly(id); await page.waitForTimeout(id === 'name' ? 9000 : 3500)
    const st = await hubState(), natural = await shot(`cosmos-${id}`)
    const rec = { ...st }
    if (st.hubShow !== 0) fail(`${id}: hubShow ${st.hubShow} (the TV must not be brought in)`)
    if (st.tv) fail(`${id}: the hub TV group is visible`)
    if (st.rings) fail(`${id}: the type rings are visible`)
    if (st.rects.some(r => r.shown > 0)) fail(`${id}: tvRects reports the hub / chain (${JSON.stringify(st.rects)})`)
    // pixels: the chain column of the natural frame is empty; with the TV forced on (scale 3, as at world) the same column is full of metal, so the test can see a TV
    const natPx = await page.evaluate(chainPx, natural.toString('base64'))
    // (the world re-asserts the TV's visibility and scale every frame, so the override rides the same hook, after it)
    await page.evaluate(() => { const tv = window.__v3.field.scene.getObjectByName('hub-tv'); window.__gcOff = window.__v3.field.onBeforeRender(() => { tv.visible = true; tv.scale.setScalar(3) }) })
    await page.waitForTimeout(600); const forced = await page.screenshot(); const onPx = await page.evaluate(chainPx, forced.toString('base64'))
    await page.evaluate(() => { window.__gcOff() })
    rec.chainPixels = natPx; rec.chainPixelsForcedOn = onPx   // clouds: the camera looks away from the hub and the fog form fills the centre column, so only the scene / tvRects checks apply there
    if (id === 'name' && natPx > 40) fail(`${id}: ${natPx} bright pixels in the chain column (a hanging chain / TV is drawn)`)
    if (id === 'name' && onPx < 150) fail(`name: forcing the TV on lights only ${onPx} pixels in the chain column: the pixel test cannot see a TV, so it proves nothing`)
    out.cosmos[id] = rec
  }
  // world: present, powered on, controls work
  await fly('world'); await page.waitForTimeout(5000)
  {
    const st = await hubState(); out.cosmos.world = { ...st }
    if (st.hubShow !== 1) fail(`world: hubShow ${st.hubShow} != 1`)
    if (!st.tv) fail('world: the hub TV is not visible')
    if (!st.rings) fail('world: the type rings are not visible')
    if (!(st.hubOn > 0.9)) fail(`world: the TV did not power on (hubOn ${st.hubOn})`)
    if (!st.rects.some(r => r.id === 'hub' && r.shown > 0.5)) fail('world: tvRects does not report the hub')
    const c = await page.evaluate(() => { const w = window.__v3.world; const o = {}; for (const p of ['dial', 'btnA', 'btnB', 'screen', 'body']) o[p] = w.partScreen('hub', p); return o })
    out.cosmos.world.parts = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, !!v]))
    for (const p of ['dial', 'btnA', 'btnB']) if (!c[p]) fail(`world: partScreen('hub', '${p}') is null (the control is not on screen)`)
    // hit test through the real pointer path: the point of each control must resolve to it
    for (const p of ['dial', 'btnA', 'btnB']) if (c[p]) {
      const hit = await page.evaluate(([x, y]) => window.__v3.world.hitTest(x, y), [c[p].x, c[p].y])
      if (!hit || hit.id !== 'hub' || hit.part !== p) fail(`world: hitTest at the ${p} gave ${JSON.stringify(hit)}`)
    }
    // the dial: the keyboard channel step, then the power button
    const ch0 = await page.evaluate(() => window.__v3.world.stats().hubChannel)
    await page.evaluate(() => window.__v3.world.nudgeChannel(1)); await page.waitForTimeout(900)
    const ch1 = await page.evaluate(() => window.__v3.world.stats().hubChannel)
    out.cosmos.world.channel = [ch0, ch1]
    if (ch0 === ch1) fail(`world: nudgeChannel did not change the channel (${ch0})`)
    // a real click on button A (power), then the keyboard power toggle: each flips the TV and the pair returns it
    const hubOnNow = () => page.evaluate(() => window.__v3.world.stats().hubOn)
    if (c.btnA) {
      // two real clicks 1.8 s apart, each at the button's position read just before it (the set sways a few px, and the dial sits next to the button: a stale point lands on the dial)
      const clickA = async () => { const q = await page.evaluate(() => window.__v3.world.partScreen('hub', 'btnA')); if (!q) return null; await page.mouse.click(q.x, q.y); await page.waitForTimeout(1800); return hubOnNow() }
      const on0 = await hubOnNow(), on1 = await clickA(), on2 = await clickA(); out.cosmos.world.btnA = [on0, on1, on2]
      if (on1 == null || Math.abs(on1 - on0) < 0.5) fail(`world: a click on button A did not toggle the TV (${on0} -> ${on1})`)
      else if (on2 == null || Math.abs(on2 - on0) > 0.1) fail(`world: the second click on button A did not return the TV (${on0} -> ${on1} -> ${on2})`)
    }
    const p0 = await hubOnNow()
    await page.evaluate(() => window.__v3.world.togglePower()); await page.waitForTimeout(1600)
    const p1 = await hubOnNow()
    await page.evaluate(() => window.__v3.world.togglePower()); await page.waitForTimeout(1800)
    const p2 = await hubOnNow()
    out.cosmos.world.power = [p0, p1, p2]
    if (Math.abs(p1 - p0) < 0.5 || Math.abs(p2 - p0) > 0.1) fail(`world: the power toggle did not cycle (${p0} -> ${p1} -> ${p2})`)
  }

  // 5. the crossfade along the leg into 'school': saturation and gain move monotonically between the two looks
  const fade = []
  for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) { await fly('mid:school', t); await page.waitForTimeout(1600); fade.push({ t, ...(await gstate()) }) }
  out.fade = fade
  {
    const mono = (name, get, tol) => {
      const v = fade.map(get), d = Math.sign(v[4] - v[0]) || 1
      for (let i = 1; i < v.length; i++) if (d * (v[i] - v[i - 1]) < -tol) { fail(`crossfade: ${name} is not monotone (${v.map(x => x.toFixed(3)).join(' -> ')})`); return }
      const lo = Math.min(v[0], v[4]) - tol, hi = Math.max(v[0], v[4]) + tol
      if (v.some(x => x < lo || x > hi)) fail(`crossfade: ${name} overshoots the two looks (${v.map(x => x.toFixed(3)).join(' -> ')})`)
    }
    mono('sat', s => s.sat, 0.02); mono('gain.b', s => s.gain[2], 0.01)
    if (fade[0].area === fade[4].area) fail('crossfade: the area did not change along the leg')
  }

  // 6. step every waypoint: no console errors
  const ids = await page.evaluate(async () => (await import('/src/v3/world/layout.ts')).WAYPOINTS.map(w => w.id))
  for (const id of ids) { await fly(id); await page.waitForTimeout(1300) }
  out.stepped = ids.length
  if (ids.length !== 28) fail(`expected 28 waypoints, found ${ids.length}`)
  await page.close()
})
if (errs.length) fail('console errors: ' + [...new Set(errs)].slice(0, 4).join(' | '))

for (const [id, r] of Object.entries(out.colour)) notes.push(`${id.padEnd(11)} sat ${r.meanSat.toFixed(3)}  x${r.ratioBase.toFixed(2)} base  x${r.ratioG0.toFixed(2)} g0(live)  hue-int ${r.hueIntersection.toFixed(2)}  top3 ${r.top3.join(',')} vs ${r.top3Base.join(',')}${r.top3Same ? '' : r.top3SameAnyPhase ? ' (other baseline phase)' : ' *'}  black ${r.black.toFixed(3)}`)
for (const [id, r] of Object.entries(out.black)) notes.push(`black ${id.padEnd(10)} p5 ${r.black.toFixed(3)}  luma ${r.meanLuma.toFixed(3)}  lit ${r.litFrac.toFixed(2)}  stars ${r.stars}  sky ${r.sky}`)
console.log(notes.join('\n'))
console.log(`top-3 hue bins equal the baseline at ${out.top3Any} of ${COLOUR_STOPS.length} stops at some baseline phase (${out.top3Same} against the single stored 2.5 s frame)`)
if (args.includes('--json')) console.log(JSON.stringify(out))
if (fails.length) { console.log('\nGRADE CHECK FAILED'); for (const f of fails) console.log(' - ' + f); process.exit(1) }
console.log(`\ngrade-check: ok (${COLOUR_STOPS.length} colour stops, ${BLACK_STOPS.length} black stops, cosmos clouds/name/world, ${out.stepped} waypoints stepped, 0 console errors)`)
