// Offline + live check of the v9 sound engine, in a real Chromium against the running dev server.
//   node scripts/sfx-check.mjs [--url http://localhost:5200] [--json out.json] [--doc] [--only substring] [--quiet]
//
// 1. OFFLINE: renders every row of src/audio/cuetable.ts (every cue id the engine implements, with its payload) and the scripted
//    gestures (pov drag, tv spin, slider sweep, odometer, hub dial, one music-bed scene per area) through the real master chain in an
//    OfflineAudioContext at 48 kHz, and reports peak dBFS, RMS (whole render and active part) and tail per row.
//    PASS needs: no NaN, peak <= -1 dBFS, peak above the row's audibility floor (non-silent). Also checked: reduced motion (continuous
//    sounds silent, discrete ones audible), unknown ids are no-ops, every alias plays.
// 2. LIVE: the page's own engine (window.__v3.sfx): init, a burst of 300 rapid events must be throttled, an event stream must make sound
//    through the live master chain (AnalyserNode peak), and nothing may throw.
// --doc rewrites the table between the CUE-TABLE markers in docs/research/sfx-v9.md.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const flag = k => args.includes('--' + k)
const BASE = opt('url', 'http://localhost:5200')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ONLY = opt('only', '')
const WAV = opt('wav', '')   // --wav dir: also write each rendered row (after --only) as a 16-bit stereo WAV, to audition or to draw spectrograms

const browser = await chromium.launch({
  channel: 'chromium', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
// The offline and live-engine checks run on the lab page, which imports only the audio engine: the dev server hot-reloads the main page
// whenever anyone saves any source file, and that would tear down a long evaluate. The app page (?gate=0) gets a short wiring check at the end.
await page.goto(`${BASE}/lab/sfx.html`, { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(1500)
// the dev server hot-reloads the page when a source file has just changed: retry an evaluate that lands in the middle of a reload
const evalRetry = async (fn, arg) => {
  for (let i = 0; ; i++) {
    try { return await page.evaluate(fn, arg) } catch (err) {
      if (i < 3 && /context was destroyed|navigation/i.test(String(err))) { await page.waitForLoadState('load').catch(() => {}); await page.waitForTimeout(2500); continue }
      throw err
    }
  }
}

// ------------------------------------------------------------------ offline
const offline = await evalRetry(async ([only, wantWav]) => {
  const S = await import('/src/audio/sfx.ts')
  const T = await import('/src/audio/cuetable.ts')
  const NEG = -999
  const dB = x => (x > 0 ? 20 * Math.log10(x) : NEG)
  // ITU-R BS.1770 K-weighting (48 kHz coefficients), as in lab/sfx.ts
  const K1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] }
  const K2 = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] }
  const biquad = (x, c) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = c.b[0] * x[i] + c.b[1] * x1 + c.b[2] * x2 - c.a[1] * y1 - c.a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v } return y }
  // 2nd-order Butterworth high-pass at 6 kHz (48 kHz): how much of the energy is shrill
  const HP = (() => { const w = 2 * Math.PI * 6000 / 48000, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al; return { b: [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], a: [1, -2 * c / a0, (1 - al) / a0] } })()
  const lufsMax = (L, R) => {
    const kl = biquad(biquad(L, K1), K2), kr = biquad(biquad(R, K1), K2), win = 19200, hop = 4800
    let best = NEG
    for (let s0 = 0; s0 + win <= kl.length; s0 += hop) { let m = 0; for (let i = s0; i < s0 + win; i++) m += kl[i] * kl[i] + kr[i] * kr[i]; best = Math.max(best, -0.691 + 10 * Math.log10(m / win + 1e-20)) }
    return best
  }
  function analyse(buf, from = 0) {
    const sr = buf.sampleRate, a = Math.floor(from * sr)
    const L = buf.getChannelData(0).subarray(a), R = buf.getChannelData(Math.min(1, buf.numberOfChannels - 1)).subarray(a)
    let peak = 0, sq = 0, nan = false, first = -1, last = -1
    const thr = Math.pow(10, -60 / 20)
    for (let i = 0; i < L.length; i++) {
      const l = L[i], r = R[i]
      if (!Number.isFinite(l) || !Number.isFinite(r)) { nan = true; continue }
      const m = Math.max(Math.abs(l), Math.abs(r))
      if (m > peak) peak = m
      sq += (l * l + r * r) / 2
      if (m > thr) { if (first < 0) first = i; last = i }
    }
    let sqA = 0
    if (first >= 0) for (let i = first; i <= last; i++) sqA += (L[i] * L[i] + R[i] * R[i]) / 2
    const nA = first >= 0 ? last - first + 1 : 1
    let hf = 0; { const h = biquad(L, HP); let e6 = 0, e0 = 1e-20; for (let i = 0; i < L.length; i++) { e6 += h[i] * h[i]; e0 += L[i] * L[i] } hf = 10 * Math.log10(e6 / e0 + 1e-12) }
    return { peak: dB(peak), rms: dB(Math.sqrt(sq / Math.max(1, L.length))), rmsA: dB(Math.sqrt(sqA / nA)), lufs: lufsMax(L, R), hf, tail: first >= 0 ? (last - first) / sr : 0, nan }
  }
  const render = (r, o = {}) => {
    if (r.script) {
      const ev = r.script.map(e => ({ t: e.t, cue: e.cue, flight: e.flight ? { ...e.flight, t: e.t } : undefined }))
      return S.renderScene(ev, r.secs, o)
    }
    return S.renderCue(r.id, r.opts, r.secs, o)
  }
  const judge = (a, min) => (a.nan ? 'NAN' : a.peak > -1 ? 'CLIP' : a.peak < min ? 'SILENT' : 'OK')
  const rows = []
  const all = [...T.CUE_TABLE, ...T.SCENES].filter(r => !only || only.split('|').some(o => r.id.includes(o)))
  for (const r of all) {
    const isMusic = r.group === 'music'
    const buf = await render(r)
    const a = analyse(buf, isMusic ? 4 : 0)
    const row = { id: r.id, group: r.group, opts: r.opts ?? null, secs: r.secs, desc: r.desc, ...a, status: judge(a, r.min) }
    if (a.lufs > -13.5 && r.group !== 'legacy') row.status = 'LOUD'
    if (r.group === 'music' && row.status === 'OK' && a.lufs > -27) row.status = 'LOUD' // a bed sits 10+ LU under the cues
    if (isMusic) { // the pad on its own: bed with music minus the bed without it
      const off = analyse(await render(r, { music: false }), 4)
      row.drone = off.rmsA
      row.musicDelta = a.rmsA - off.rmsA
    }
    if (wantWav) { // 16-bit interleaved stereo, base64
      const L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(L.length * 2)
      for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767 }
      let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192))
      row.wav = btoa(bin)
    }
    rows.push(row)
  }
  const extra = []
  // reduced motion: continuous / animated sounds silent, discrete ones audible
  const RED_SILENT = ['tv:spin', 'pov:grab', 'pov:drag', 'pov:release', 'pov:return', 'type:assemble', 'type:shatter', 'glyph:burst', 'count:tick']
  const RED_SOUND = ['hub:detent', 'hub:channel', 'hub:button', 'hub:poweron', 'hub:poweroff', 'tv:grab', 'tv:release', 'lab:drag', 'lab:arb', 'evidence:flip', 'evidence:zoom', 'sig.table', 'sig.mind']
  const opts = { 'hub:button': { which: 'A', down: true }, 'tv:spin': { id: 'x', speed: 0.6 }, 'pov:drag': { speed: 0.6 }, 'tv:release': { speed: 0.5 }, 'type:assemble': { n: 8 }, 'type:shatter': { n: 8 }, 'lab:drag': { param: 'p', value: 0.4 } }
  for (const id of RED_SILENT) { const a = analyse(await S.renderCue(id, opts[id], 1.6, { reduced: true })); extra.push({ check: `reduced: ${id} silent`, ...a, status: !a.nan && a.peak < -70 ? 'OK' : 'NOT SILENT' }) }
  for (const id of RED_SOUND) { const a = analyse(await S.renderCue(id, opts[id], 1.6, { reduced: true })); extra.push({ check: `reduced: ${id} audible`, ...a, status: judge(a, -45) }) }
  { const a = analyse(await S.renderScene([{ t: 0, flight: { speed: 0, area: 'mind', mix: 1, wp: 3, t: 0 } }], 12, { reduced: true }), 3); extra.push({ check: 'reduced: music bed silent', ...a, status: a.peak < -70 ? 'OK' : 'NOT SILENT' }) }
  // unknown ids are no-ops
  for (const id of ['zzz', 'foo:bar', 'hub:detentx', 'pov', 'sig']) { const a = analyse(await S.renderCue(id, undefined, 1.0)); extra.push({ check: `unknown id "${id}" is a no-op`, ...a, status: a.peak < -80 ? 'OK' : (id === 'sig' ? judge(a, -40) : 'NOT SILENT') }) }
  // pov:drag with a direction sits on that side of the stereo field, opposite directions mirror each other
  { const lr = async dir => { const b = await S.renderCue('pov:drag', { speed: 0.7, dir }, 1.2); const L = b.getChannelData(0), R = b.getChannelData(1); let sl = 0, sr2 = 0; for (let i = 0; i < L.length; i++) { sl += L[i] * L[i]; sr2 += R[i] * R[i] } return 10 * Math.log10((sl + 1e-20) / (sr2 + 1e-20)) }
    const left = await lr(-1), right = await lr(1)
    extra.push({ check: `pov:drag dir -1 / +1 pans left / right (L-R ${left.toFixed(1)} dB / ${right.toFixed(1)} dB)`, peak: -999, nan: false, status: left > 2 && right < -2 ? 'OK' : 'NO PAN' }) }
  // every waypoint in src/v3/world/layout.ts: its signature plays, and so does the cue named in its `sound` field
  { const W = (await import('/src/v3/world/layout.ts')).WAYPOINTS
    for (const w of W) {
      const a = analyse(await S.renderCue(`sig.${w.id}`, undefined, 3.4)); extra.push({ check: `waypoint ${w.id}: sig.${w.id} audible`, ...a, status: judge(a, -40) })
      if (w.sound) { const b = analyse(await S.renderCue(w.sound, undefined, 3.4)); extra.push({ check: `waypoint ${w.id}: sound "${w.sound}" audible`, ...b, status: judge(b, -40) }) }
    } }
  // aliases and unknown sig ids play
  for (const al of T.SIG_ALIASES) { const a = analyse(await S.renderCue(`sig.${al}`, undefined, 3.0)); extra.push({ check: `alias sig.${al} audible`, ...a, status: judge(a, -40) }) }
  // intensity and pan options still work on the new cues (pan hard left: right channel much quieter)
  { const b = await S.renderCue('sig.table', { pan: -1 }, 2.0); const L = b.getChannelData(0), R = b.getChannelData(1); let pl = 0, pr = 0, sl = 0, sr2 = 0; for (let i = 0; i < L.length; i++) { pl = Math.max(pl, Math.abs(L[i])); pr = Math.max(pr, Math.abs(R[i])); sl += L[i] * L[i]; sr2 += R[i] * R[i] }
    const d = 10 * Math.log10(sl / (sr2 + 1e-20))
    extra.push({ check: `sig.table pan -1: left louder than right by > 3 dB RMS (${d.toFixed(1)} dB)`, peak: dB(pl), nan: false, status: d > 3 ? 'OK' : 'NO PAN' }) }
  // current trims and calibration targets, for --trims
  const cal = []
  for (const r of rows) {
    if (r.group === 'music' || r.id.startsWith('scene') || r.group === 'legacy') continue
    const tk = S.trimKey(r.id, r.opts ?? {})
    const tg = T.TARGETS[tk] ?? (tk.startsWith('sig.') && !['sig.clouds', 'sig.name', 'sig.world', 'sig.hold', 'sig.epilogue'].includes(tk) ? T.SIG_TARGET : null)
    if (!tg) continue
    const cur = S.TRIM[tk] ?? 1
    const d = Math.min(tg.peak !== undefined ? tg.peak - r.peak : 99, tg.lufs !== undefined ? tg.lufs - r.lufs : 99)
    cal.push({ key: tk, cur, delta: d, next: cur * Math.pow(10, d / 20), peak: r.peak, lufs: r.lufs, tg })
  }
  return { rows, extra, cal, ids: S.ALL_CUE_IDS }
}, [ONLY, !!WAV])

if (WAV) {
  fs.mkdirSync(WAV, { recursive: true })
  for (const r of offline.rows) {
    if (!r.wav) continue
    const pcm = Buffer.from(r.wav, 'base64'), sr = 48000, h = Buffer.alloc(44)
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22)
    h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
    fs.writeFileSync(path.join(WAV, r.id.replace(/[^a-z0-9.]+/gi, '_').slice(0, 60) + '.wav'), Buffer.concat([h, pcm]))
    delete r.wav
  }
}
// ------------------------------------------------------------------ live
const live = await evalRetry(async () => {
  const S = await import('/src/audio/sfx.ts')
  const sfx = S.sfx
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const out = { source: 'sfx.ts singleton on the lab page' }
  await sfx.init()
  await wait(400)
  out.status = sfx.status()
  const traced = []
  sfx.trace(ev => traced.push(ev.id))
  const count = id => traced.filter(x => x === id).length
  // throttling: a tight loop of 300 events passes only the first (the gap is >= 22 ms)
  for (let i = 0; i < 300; i++) sfx.cue('pov:drag', { speed: 0.5 })
  for (let i = 0; i < 300; i++) sfx.cue('tv:spin', { id: 'a', speed: 0.5 })
  for (let i = 0; i < 300; i++) sfx.cue('lab:drag', { param: 'sigma', value: i / 299 })
  for (let i = 0; i < 300; i++) sfx.cue('count:tick')
  for (let i = 0; i < 300; i++) sfx.cue('hub:detent', { ch: i })
  out.burst = { 'pov:drag': count('pov:drag'), 'tv:spin': count('tv:spin'), 'lab:drag': count('lab:drag'), 'count:tick': count('count:tick'), 'hub:detent': count('hub:detent') }
  // distinct payloads do not block each other: A down, A up, B down and a second slider all pass in one tick
  traced.length = 0
  sfx.cue('hub:button', { which: 'A', down: true }); sfx.cue('hub:button', { which: 'A', down: false }); sfx.cue('hub:button', { which: 'B', down: true })
  sfx.cue('lab:drag', { param: 'other', value: 0.2 })
  out.distinct = { button: count('hub:button'), lab: count('lab:drag') }
  await wait(300)
  // after the gap the same event passes again
  traced.length = 0
  sfx.cue('pov:drag', { speed: 0.5 }); out.afterGap = count('pov:drag')
  await wait(1200)
  // level through the live master chain (the analyser sits after the limiter and clip)
  const peakDuring = async (ms, fn) => { let m = -200; const t0 = performance.now(); fn(); while (performance.now() - t0 < ms) { m = Math.max(m, sfx.level()); await wait(8) } return m }
  out.level = {}
  out.level.rest = await peakDuring(150, () => {})
  out.level['hub:button down'] = await peakDuring(350, () => sfx.cue('hub:button', { which: 'A', down: true }))
  await wait(300)
  out.level['hub:detent'] = await peakDuring(250, () => sfx.cue('hub:detent', { ch: 4 }))
  await wait(300)
  out.level['sig.school'] = await peakDuring(900, () => sfx.cue('sig.school'))
  await wait(1500)
  // a drag stream: 12 events 90 ms apart; the wind must be there during it and gone after
  let during = -200
  for (let i = 0; i < 12; i++) { sfx.cue('pov:drag', { speed: 0.3 + 0.05 * i }); const t0 = performance.now(); while (performance.now() - t0 < 90) { during = Math.max(during, sfx.level()); await wait(8) } }
  out.level['pov:drag stream'] = during
  await wait(1400)
  out.level['after drag'] = await peakDuring(200, () => {})
  // the music bed live: dwell in an area for 7 s with the flight state fed at 30 Hz
  let mus = -200
  const t0 = performance.now()
  while (performance.now() - t0 < 7000) { sfx.setFlight({ speed: 0, area: 'education', mix: 1, wp: 20, t: performance.now() / 1000 }); mus = Math.max(mus, sfx.level()); await wait(33) }
  out.level['bed education (7 s dwell)'] = mus
  sfx.trace(null)
  sfx.setEnabled(false)
  await wait(500)
  out.afterOff = sfx.status()
  return out
})

// ------------------------------------------------------------------ the app page: is the engine wired in?
let smoke = { ok: false, note: 'not run' }
for (let attempt = 0; attempt < 4 && !smoke.ok; attempt++) {
  try {
    await page.goto(`${BASE}/?gate=0`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(3500)
    smoke = await page.evaluate(async () => {
      const v = window.__v3
      if (!v?.sfx) return { ok: false, note: 'window.__v3.sfx missing' }
      const wait = ms => new Promise(r => setTimeout(r, ms))
      await v.sfx.init(); await wait(300)
      const seen = []
      v.sfx.trace(ev => seen.push(ev.id))
      for (const [n, d] of [['hub:detent', { ch: 2 }], ['hub:channel', { i: 2 }], ['hub:button', { which: 'B', down: true }], ['sig.table', undefined], ['not:a:cue', undefined]]) { v.sfx.cue(n, d); await wait(120) }
      let peak = -200; for (let i = 0; i < 20; i++) { peak = Math.max(peak, v.sfx.level()); await wait(10) }
      v.sfx.trace(null); v.sfx.setEnabled(false)
      return { ok: seen.length === 5 && v.sfx.status().ctx !== 'none', note: `traced ${seen.join(', ')}; analyser peak ${peak.toFixed(1)} dB; world events reach sfx.cue by name via main.ts` }
    })
  } catch (err) { smoke = { ok: false, note: `attempt ${attempt + 1}: ${String(err).split('\n')[0]}` }; await page.waitForTimeout(2500) }
}
await browser.close()

// ------------------------------------------------------------------ report
const f1 = v => (v <= -900 ? '-inf' : v.toFixed(1))
const bad = []
const lines = []
lines.push('id | group | peak dBFS | RMS dBFS (active) | LUFS-M | HF>6k dB | tail s | status')
for (const r of offline.rows) {
  lines.push(`${r.id}${r.opts ? ' ' + JSON.stringify(r.opts) : ''} | ${r.group} | ${f1(r.peak)} | ${f1(r.rmsA)} | ${f1(r.lufs)} | ${r.hf.toFixed(1)} | ${r.tail.toFixed(2)} | ${r.status}${r.musicDelta !== undefined ? `  (pad vs drone ${r.musicDelta >= 0 ? '+' : ''}${r.musicDelta.toFixed(1)} dB, drone ${f1(r.drone)})` : ''}`)
  if (r.status !== 'OK') bad.push(`${r.id}: ${r.status} (peak ${f1(r.peak)})`)
}
for (const x of offline.extra) { lines.push(`[check] ${x.check} | peak ${f1(x.peak)} | ${x.status}`); if (x.status !== 'OK') bad.push(`${x.check}: ${x.status} (peak ${f1(x.peak)})`) }
const liveBad = []
if (live.status.ctx !== 'running') liveBad.push(`live AudioContext is ${live.status.ctx}`)
for (const [k, v] of Object.entries(live.burst)) if (v > 3) liveBad.push(`throttle: ${k} let ${v} of 300 rapid events through`)
if (live.distinct.button !== 3 || live.distinct.lab !== 1) liveBad.push(`distinct payloads were blocked: ${JSON.stringify(live.distinct)}`)
if (live.afterGap !== 1) liveBad.push(`event after the gap did not pass (${live.afterGap})`)
for (const k of ['hub:button down', 'hub:detent', 'sig.school', 'pov:drag stream', 'bed education (7 s dwell)']) if (!(live.level[k] > -75)) liveBad.push(`live level too low: ${k} ${f1(live.level[k])} dB`)
if (live.level['after drag'] > Math.max(live.level.rest + 4, -50)) liveBad.push(`wind still audible after the drag stopped (${f1(live.level['after drag'])} dB against ${f1(live.level.rest)} at rest)`)
for (const k of Object.keys(live.level)) if (live.level[k] > -0.9) liveBad.push(`live level clips: ${k} ${f1(live.level[k])} dB`)
if (live.afterOff.enabled) liveBad.push('sound did not turn off')
if (!smoke.ok) liveBad.push(`app page: ${smoke.note}`)
const sfxLogs = logs.filter(l => /\[sfx\]|pageerror|Uncaught/.test(l))
for (const l of sfxLogs) liveBad.push(`console: ${l}`)

const missing = []
const have = new Set([...offline.rows.map(r => r.id)])
for (const id of offline.ids) if (!have.has(id) && !offline.rows.some(r => r.id === id)) missing.push(id)
// ids with several rows (hub:button, lab:arb, glyph:burst) count as covered by any row; sig aliases are covered by the alias checks
const aliasCovered = id => id.startsWith('sig.') && offline.extra.some(x => x.check === `alias ${id} audible`)
const uncovered = missing.filter(id => !aliasCovered(id))
if (uncovered.length) bad.push(`ids with no row in the cue table: ${uncovered.join(', ')}`)

const pass = bad.length === 0 && liveBad.length === 0
if (!flag('quiet')) console.log(lines.join('\n'))
console.log('\nLIVE', JSON.stringify(live))
console.log('APP', JSON.stringify(smoke))
console.log(`\n${pass ? 'PASS' : 'FAIL'}: ${offline.rows.length} rows + ${offline.extra.length} checks offline, live ${liveBad.length ? 'FAILED' : 'ok'}`)
for (const b of bad) console.log('  offline: ' + b)
for (const b of liveBad) console.log('  live: ' + b)
if (opt('trims', null)) {
  const o = {}
  for (const c of offline.cal) o[c.key] = o[c.key] === undefined ? +c.next.toFixed(3) : Math.min(o[c.key], +c.next.toFixed(3)) // rows sharing a key (glyph areas): the most conservative
  fs.writeFileSync(opt('trims'), JSON.stringify(o, null, 1))
  const off = offline.cal.filter(c => Math.abs(c.delta) > 1.5)
  console.log(`\ncalibration: ${offline.cal.length} cues with targets, ${off.length} more than 1.5 dB off`)
  for (const c of off) console.log(`  ${c.key}: peak ${f1(c.peak)} lufs ${f1(c.lufs)} -> ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(1)} dB, trim ${c.cur} -> ${c.next.toFixed(3)}`)
}
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ pass, offline, live, bad, liveBad }, null, 1))

if (flag('doc')) {
  const docPath = path.join(ROOT, 'docs/research/sfx-v9.md')
  let doc = fs.readFileSync(docPath, 'utf8')
  const esc = s => s.replace(/\|/g, '\\|')
  const body = ['| Cue | Payload | What you hear | Peak dBFS | RMS dBFS (active) | Tail s |', '|---|---|---|---|---|---|']
  const groups = ['legacy', 'hub', 'tv', 'pov', 'type', 'glyph', 'brain', 'lab', 'evidence', 'count', 'sig', 'trans', 'obj', 'music']
  const names = { legacy: 'v4 palette (unchanged)', hub: 'Hub TV', tv: 'Small TVs', pov: 'Point of view', type: 'Type', glyph: 'Glyph bursts', brain: 'Glass brain', lab: 'Labs', evidence: 'Evidence', count: 'Odometer', sig: 'Arrival signatures', trans: 'Transitions', obj: 'Objects', music: 'Music bed (one scene per area, measured after 4 s; peak and RMS are the whole bed, pad plus the drone under it)' }
  const parts = []
  for (const g of groups) {
    const rs = offline.rows.filter(r => r.group === g)
    if (!rs.length) continue
    parts.push(`\n**${names[g]}**\n`, '| Cue | Payload | What you hear | Peak dBFS | RMS dBFS (active) | Tail s |', '|---|---|---|---|---|---|')
    for (const r of rs) parts.push(`| \`${esc(r.id)}\` | ${r.opts ? '`' + esc(JSON.stringify(r.opts)) + '`' : ''} | ${esc(r.desc)}${r.musicDelta !== undefined ? ` (drone plus pad is ${r.musicDelta >= 0 ? '+' : ''}${r.musicDelta.toFixed(1)} dB over the drone alone)` : ''} | ${f1(r.peak)} | ${f1(r.rmsA)} | ${r.tail.toFixed(2)} |`)
  }
  void body
  const table = parts.join('\n')
  const a = '<!-- CUE-TABLE:BEGIN -->', b = '<!-- CUE-TABLE:END -->'
  const i = doc.indexOf(a), j = doc.indexOf(b)
  if (i < 0 || j < 0) { console.log('doc markers missing; table not written'); process.exit(pass ? 0 : 1) }
  const stamp = `Rendered ${new Date().toISOString().slice(0, 10)} by \`node scripts/sfx-check.mjs --doc\`: ${offline.rows.length} rows, ${offline.extra.length} extra checks, ${pass ? 'all pass' : 'FAILING'}.`
  const checks = ['', '**Extra checks**', '', '| Check | Peak dBFS | Result |', '|---|---|---|', ...offline.extra.map(x => `| ${esc(x.check)} | ${f1(x.peak)} | ${x.status} |`)]
  const liveT = ['', '**Live engine (the sfx singleton on lab/sfx.html)**', '', '| Measure | Value |', '|---|---|',
    `| AudioContext | ${live.status.ctx} |`,
    ...Object.entries(live.burst).map(([k, v]) => `| 300 rapid \`${k}\` events let through | ${v} |`),
    `| distinct payloads (A down, A up, B down, 2nd slider) | ${live.distinct.button} + ${live.distinct.lab} |`,
    ...Object.entries(live.level).map(([k, v]) => `| analyser peak: ${esc(k)} | ${f1(v)} dBFS |`)]
  doc = doc.slice(0, i + a.length) + '\n' + stamp + '\n' + table + '\n' + checks.join('\n') + '\n' + liveT.join('\n') + '\n' + doc.slice(j)
  fs.writeFileSync(docPath, doc)
  console.log('wrote ' + docPath)
}
process.exit(pass ? 0 : 1)
