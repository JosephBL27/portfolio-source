// Education chalkboard check (stage 'mathecon', src/v3/world/extras/stages/chalkboard.ts): a REAL flight from the stop before it ('school': goto(null),
// scroll to it, follower.snap, then PageDown, the way a visitor arrives), frames while the courses are written in chalk, the stage's own state, the
// felt-eraser click, the screen-reader copy, and the console.
//   node scripts/chalkboard-check.mjs [--port 5200] [--phone] [--both] [--dpr 2] [--rm] [--label name] [--frames 1,4,8,12,17] [--no-erase] [--pause] [--tilt]
//   --both    desktop 1440x900, then the phone 390x844 (touch), one after the other in the same browser launch (one slot)
//   --dpr n   device pixel ratio (default 1: a screenshot pixel is a CSS pixel, so a crop is a 100% crop); --phone-dpr n for the phone (default: the same)
//   --tilt    drag the board and assert it tilts, then springs back
// Writes out/frames/<label>-<tag>-t<sec>.png, out/compare/<label>-<tag>.png and out/frames/<label>-<tag>.json; prints PASS / FAIL lines and exits non-zero on a FAIL.
// Browser only through withBrowser() (the global slot lock). Check `sysctl vm.swapusage` and `memory_pressure` first.
import { withBrowser } from './lib/browser.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))   // not .pathname: the repo's folder has a space in its name
const args = process.argv.slice(2)
const flag = k => args.includes('--' + k)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const port = +opt('port', 5200), label = opt('label', 'cb')
const both = flag('both'), rm = flag('rm'), pauseTest = flag('pause'), tiltTest = flag('tilt'), dpr = +opt('dpr', 1), phoneDpr = +opt('phone-dpr', dpr)
const frames = opt('frames', '1,4,8,12,17').split(',').map(Number)
const outDir = `${root}out/compare`, frDir = `${root}out/frames`
mkdirSync(outDir, { recursive: true }); mkdirSync(frDir, { recursive: true })
const cw = JSON.parse(readFileSync(`${root}src/data/coursework.json`, 'utf8'))
const titles = cw.groups.flatMap(g => g.courses)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stub = () => {      // the dev server's HMR socket would reload the page mid-flight
  const Real = window.WebSocket
  window.WebSocket = function (url, proto) {
    if (proto === 'vite-hmr') return { readyState: 0, send() {}, close() {}, addEventListener() {}, removeEventListener() {}, set onmessage(_) {}, set onopen(_) {}, set onclose(_) {}, set onerror(_) {} }
    return new Real(url, proto)
  }
  window.WebSocket.prototype = Real.prototype
}
let fails = 0
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++ }
async function runView(browser, phone) {
  const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? phoneDpr : dpr, isMobile: phone, hasTouch: phone, reducedMotion: rm ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(stub)
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('pageerror ' + e.message))
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /chalkboard|three|THREE|WebGL|glb/i.test(m.text()))) errs.push(m.type() + ' ' + m.text().slice(0, 240)) })
  try {
    await page.goto(`http://localhost:${port}/?gate=0`, { waitUntil: 'load', timeout: 120000 })
    await page.waitForFunction(() => window.__v3 && window.__v3.goto, null, { timeout: 120000 })
    await sleep(2500)
    // the real flight: park at 'school' (unpinned), then one PageDown into 'mathecon'
    await page.evaluate(async () => {
      const l = await import('/src/v3/world/layout.ts'); const f = await import('/src/v3/world/flight.ts')
      const i = l.WAYPOINTS.findIndex(w => w.id === 'mathecon')
      const p = f.waypointP(i - 1), v = window.__v3; v.goto(null)
      const track = document.getElementById('track'); window.scrollTo(0, Math.round(p * Math.max(1, track.offsetHeight - innerHeight))); v.follower.snap(p)
    })
    await sleep(3500)
    await page.mouse.move(phone ? 20 : 720, phone ? 60 : 450)
    await page.keyboard.press('PageDown')
    const tag = (phone ? '390' : '1440') + (rm ? '-rm' : '')
    const t0 = Date.now(), log = []
    for (const t of frames) {
      const wait = t * 1000 - (Date.now() - t0)
      if (wait > 0) await sleep(wait)
      const info = await page.evaluate(() => ({ cb: window.__chalkboard?.info?.() ?? null, st: window.__v3?.state?.() ?? null, cpu: window.__atmos?.cpu?.stages ?? null }))
      log.push({ t, ...info })
      await page.screenshot({ path: `${frDir}/${label}-${tag}-t${String(t).replace('.', '_')}.png` })
    }
    await page.screenshot({ path: `${outDir}/${label}-${tag}.png` })
    const last = log[log.length - 1]
    check(last.st && last.st.wp >= 0 && last.st.a === 'mathecon', `arrived at mathecon by a real flight (wp ${last.st?.wp}, ${last.st?.a})`)
    check(!!last.cb && last.cb.ready, 'stage built and ready' + (last.cb ? ` (tall ${last.cb.tall}, canvas ${last.cb.canvas})` : ''))
    check(!!last.cb && last.cb.written, `courses fully written by ${frames[frames.length - 1]} s after arrival` + (last.cb ? ` (clock ${last.cb.wt}, ${last.cb.committed}/${last.cb.lines} lines, total ${last.cb.total} s)` : ''))
    if (!rm && log.length > 2) {
      const mid = log.find(l => l.t >= 6 && l.t <= 9)
      check(mid && mid.cb && !mid.cb.written && mid.cb.committed > 0, `mid write-on frame is partly written (${mid?.cb?.committed}/${mid?.cb?.lines} lines at ${mid?.t} s)`)
    }
    const txt = await page.evaluate(() => document.querySelector('.cb-sr')?.textContent ?? '')
    check(titles.every(t => txt.includes(t)) && txt.includes(cw.program.school) && !/\b(GPA|credits?|grades?)\b/i.test(txt), `screen-reader copy lists all ${titles.length} titles and the program, no grades or credits`)
    if (tiltTest && last.cb?.ready) {
      // drag the board: it tilts (yaw follows the pointer, clamped), then an anime.js spring brings it back
      const c = await page.evaluate(() => window.__chalkboard.board())
      if (Array.isArray(c)) {
        await page.mouse.move(c[0], c[1], { steps: 4 }); await sleep(200)
        await page.mouse.down(); await page.mouse.move(c[0] + 110, c[1] + 20, { steps: 10 }); await sleep(250)
        const held = await page.evaluate(() => window.__chalkboard.info())
        await page.screenshot({ path: `${frDir}/${label}-${tag}-tilt.png` })
        await page.mouse.up(); await sleep(rm ? 300 : 1900)
        const back = await page.evaluate(() => window.__chalkboard.info())
        check(Math.abs(held.yaw) > 0.1, `dragging the board tilts it (yaw ${held.yaw})`)
        check(Math.abs(back.yaw) < 0.03, `the board springs back after the drag (yaw ${back.yaw})`)
      } else check(false, 'the board has a screen position')
    }
    if (pauseTest && !rm) {
      // Pause in the middle of a write-on: the clock, the strokes and the dust hold where they are
      await page.evaluate(() => window.__chalkboard.erase())
      await page.waitForFunction(() => { const i = window.__chalkboard.info(); return !i.wiping && i.wt > 3.5 && !i.written }, null, { timeout: 30000 })
      await page.evaluate(async () => (await import('/src/state.ts')).setPaused(true)); await sleep(300)
      const a = await page.evaluate(() => window.__chalkboard.info()); await sleep(1500)
      const b = await page.evaluate(() => window.__chalkboard.info())
      check(!a.written && a.wt > 3.5, `Pause lands in the middle of the write-on (clock ${a.wt} of ${a.total})`)
      check(a.wt === b.wt && a.committed === b.committed && a.dust === b.dust, `Pause holds the write-on and the dust (clock ${a.wt} -> ${b.wt}, dust ${a.dust} -> ${b.dust})`)
      await page.evaluate(async () => (await import('/src/state.ts')).setPaused(false))
      await page.waitForFunction(() => window.__chalkboard.info().written, null, { timeout: 30000 })
    }
    if (!flag('no-erase') && last.cb?.ready) {
      const xy = await page.evaluate(() => window.__chalkboard.eraser())
      check(Array.isArray(xy), 'eraser has a screen position ' + JSON.stringify(xy?.map?.(Math.round)))
      if (Array.isArray(xy)) {
        await page.mouse.move(xy[0], xy[1], { steps: 6 }); await sleep(300)
        await page.mouse.click(xy[0], xy[1]); await sleep(rm ? 600 : 1500)
        const mid = await page.evaluate(() => window.__chalkboard.info())
        check(rm ? mid.written : mid.wiping, rm ? 'clicking the eraser wipes and writes again at once' : 'clicking the eraser starts the wipe')
        await page.screenshot({ path: `${frDir}/${label}-${tag}-wipe.png` })
        if (!rm) {
          await sleep(3200); await page.screenshot({ path: `${frDir}/${label}-${tag}-haze.png` })
          await sleep(15500)
          const end = await page.evaluate(() => window.__chalkboard.info())
          check(!end.wiping && end.written, 'the board is written again after the wipe')
          await page.screenshot({ path: `${frDir}/${label}-${tag}-rewritten.png` })
        }
      }
    }
    console.log('draw calls (whole scene)', last.cb?.calls, 'stage cpu', JSON.stringify(last.cpu))
    const bad = errs.filter(e => !/favicon/i.test(e))
    check(bad.length === 0, `console clean (${bad.length})` + (bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''))
    writeFileSync(`${frDir}/${label}-${tag}.json`, JSON.stringify({ log, errs }))
  } finally { await ctx.close() }
}
await withBrowser(async browser => {
  if (both) { await runView(browser, false); await runView(browser, true) } else await runView(browser, flag('phone'))
})
process.exit(fails ? 1 : 0)
