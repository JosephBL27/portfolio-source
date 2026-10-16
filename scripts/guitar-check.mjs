// Check of the v16 guitar voice (src/audio/guitar.ts) and the tr:exit cue, in ONE headless Chromium against a running dev server.
//   node scripts/guitar-check.mjs [--url http://localhost:5924] [--wav docs/research/audio] [--shots shots] [--skip-app] [--skip-wav]
//
// Offline (an OfflineAudioContext on the audio-only lab page, guitar.ts imported straight from the dev server):
//   1  f0 of every open string within +-3 cents of its tuned target (TUNED_HZ = TUNING_HZ + the seeded detune), autocorrelation over 0.4-1.2 s
//   2  A2: T60 of partial 1 / T60 of partial 8 >= 3
//   3  E2 partial 12 sharp by +2..+20 cents against 12 f0 (dispersion); E4 within +-2 cents
//   4  A2 with the commuted body vs without: band energy 85-125 Hz and 190-250 Hz each >= +2 dB
//   5  strum onsets 8-30 ms apart (envelope detector on each string's own buffer at the time the engine schedules it); low to high for
//      dir 1, E4 first for dir -1; the plan itself over thousands of draws
//   6  peaks through the real engine graph (sfx.renderCue): guitar:pluck -14, guitar:strum -12 (+-1.5 dBFS), tr:exit -24 (+-2 dBFS)
//   7  cost: the first render of one pluck buffer <= 30 ms, a cached second call <= 1 ms
//   8  WAVs for the ear: v16-guitar-new-{pluck-e2,pluck-a2,pluck-e4,strum-down,strum-up}.wav and the same five from the previous voice
//      (git HEAD:src/audio/guitar.ts) as v16-guitar-old-*.wav, with peak and RMS
// In the app (?gate=0, sound on):
//   7b no pre-render before the flight is within 2 stops of 'guitar' (prints when it starts and how long its slices were)
//   9  a scripted pointer sweep at the guitar dwell logs 6 'guitar:pluck' events in order with velocity rising with speed; screenshots
//      shots/v16-guitar-strings.png (1440x900, strings mid-vibration) and shots/v16-guitar-390.png (phone dwell)
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const flag = k => args.includes('--' + k)
const BASE = opt('url', 'http://localhost:5924')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WAVDIR = path.resolve(ROOT, opt('wav', 'docs/research/audio'))
const SHOTS = path.resolve(ROOT, opt('shots', 'shots'))
const SR = 48000
const NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
const results = []
const check = (id, ok, text) => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${text}`) }
const f2 = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v))

// ------------------------------------------------------------------ analysis helpers (Node side)
const b64f32 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4) }
const cents = (a, b) => 1200 * Math.log2(a / b)
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } }
  }
}
function bandEnergy(y, sr, secs, f1, f2b) {
  const n = 1 << 17, re = new Float64Array(n), im = new Float64Array(n), L = Math.min(y.length, Math.round(sr * secs))
  for (let i = 0; i < L; i++) re[i] = y[i]
  fft(re, im)
  let e = 0; for (let k = Math.floor(f1 * n / sr); k <= Math.ceil(f2b * n / sr); k++) e += re[k] * re[k] + im[k] * im[k]
  return e
}
/** magnitude of the Hann-windowed DFT of y[t0 .. t0+dur] at frequency f */
function dftMag(y, sr, t0, dur, f) {
  const a = Math.round(t0 * sr), L = Math.round(dur * sr), w = 2 * Math.PI * f / sr
  let re = 0, im = 0
  const cr = Math.cos(w), ci = Math.sin(w)
  let pr = Math.cos(w * a), pi = Math.sin(w * a)
  for (let i = 0; i < L; i++) {
    const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (L - 1)), v = y[a + i] * hw
    re += v * pr; im -= v * pi
    const t = pr * cr - pi * ci; pi = pr * ci + pi * cr; pr = t
  }
  return Math.hypot(re, im)
}
/** the frequency of the spectral peak near f (search +-span cents), refined by parabola */
function peakFreq(y, sr, t0, dur, f, span = 60) {
  let best = -1, bf = f
  for (let c = -span; c <= span; c += 1) { const ff = f * Math.pow(2, c / 1200), m = dftMag(y, sr, t0, dur, ff); if (m > best) { best = m; bf = ff } }
  let b2 = -1, bf2 = bf
  const step = 0.1
  for (let c = -1.6; c <= 1.6; c += step) { const ff = bf * Math.pow(2, c / 1200), m = dftMag(y, sr, t0, dur, ff); if (m > b2) { b2 = m; bf2 = ff } }
  const m0 = dftMag(y, sr, t0, dur, bf2 * Math.pow(2, -step / 1200)), m1 = b2, m2 = dftMag(y, sr, t0, dur, bf2 * Math.pow(2, step / 1200))
  const d = m0 - 2 * m1 + m2
  return bf2 * Math.pow(2, (d !== 0 ? 0.5 * (m0 - m2) / d * step : 0) / 1200)
}
/** f0 by autocorrelation over y[0.4 s .. 1.2 s] at a lag of m periods, parabolic peak */
function acF0(y, sr, fTarget) {
  const a = Math.round(0.4 * sr), L = Math.round(0.8 * sr)
  const m = Math.max(1, Math.floor(0.06 * fTarget)), T = sr / fTarget, lag0 = Math.round(m * T)
  const r = lag => { let s = 0; for (let i = a; i < a + L - 2 * lag0; i++) s += y[i] * y[i + lag]; return s }
  let best = -Infinity, bl = lag0
  for (let l = lag0 - 4; l <= lag0 + 4; l++) { const v = r(l); if (v > best) { best = v; bl = l } }
  const r0 = r(bl - 1), r1 = r(bl), r2 = r(bl + 1), d = r0 - 2 * r1 + r2
  const lag = bl + (d !== 0 ? 0.5 * (r0 - r2) / d : 0)
  return sr * m / lag
}
/** T60 of the partial at f: slope of its Hann-windowed amplitude (dB) from 0.15 s until 40 dB down or the fade-out */
function t60Of(y, sr, f, tEnd) {
  const win = 0.08, hop = 0.02, pts = []
  for (let t = 0.1; t + win < tEnd; t += hop) pts.push([t + win / 2, 20 * Math.log10(dftMag(y, sr, t, win, f) + 1e-12)])
  const top = Math.max(...pts.map(p => p[1]))
  const use = pts.filter(p => p[0] >= 0.15 && p[1] > top - 40)
  const n = use.length, mx = use.reduce((s, p) => s + p[0], 0) / n, my = use.reduce((s, p) => s + p[1], 0) / n
  let sxy = 0, sxx = 0; for (const [x, v] of use) { sxy += (x - mx) * (v - my); sxx += (x - mx) ** 2 }
  return -60 / (sxy / sxx)
}
function onsetOf(y, sr) {
  const env = new Float64Array(y.length); let z = 0; const a = Math.exp(-1 / (0.0005 * sr))
  for (let i = 0; i < y.length; i++) { z = a * z + (1 - a) * Math.abs(y[i]); env[i] = z }
  let ref = 0; for (let i = 0; i < Math.min(env.length, Math.round(0.025 * sr)); i++) ref = Math.max(ref, env[i])
  for (let i = 0; i < env.length; i++) if (env[i] > 0.1 * ref) return i / sr
  return 0
}
const dBs = x => (x > 0 ? 20 * Math.log10(x) : -999)
function wavBytes(L, R, sr) {
  const n = L.length, pcm = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 4 * i); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 4 * i + 2) }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22)
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

// the previous voice, rewired to import from the dev server's absolute paths
const OLD_PATH = path.join(ROOT, 'docs/research/audio/_old-guitar.ts')
if (!flag('skip-wav')) {
  fs.mkdirSync(path.dirname(OLD_PATH), { recursive: true })
  const src = execSync('git show HEAD:src/audio/guitar.ts', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 })
  fs.writeFileSync(OLD_PATH, src.replace("from './kit'", "from '/src/audio/kit.ts'").replace("import('./sfx')", "import('/src/audio/sfx.ts')"))
}

const browser = await chromium.launch({
  channel: 'chromium', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
})
const logs = []
try {
  // ================================================================== offline
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx1.newPage()
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`) })
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  await page.goto(`${BASE}/lab/sfx.html`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(1200)
  const evalRetry = async (fn, arg) => {
    for (let i = 0; ; i++) {
      try { return await page.evaluate(fn, arg) } catch (err) {
        if (i < 3 && /context was destroyed|navigation/i.test(String(err))) { await page.waitForLoadState('load').catch(() => {}); await page.waitForTimeout(2500); continue }
        throw err
      }
    }
  }

  // ---- 7 cost, measured first on a fresh module (cold: includes the body IR and the string designs)
  const cost = await evalRetry(async () => {
    const G = await import('/src/audio/guitar.ts')
    const ctx = new OfflineAudioContext(1, 1, 48000)
    let t0 = performance.now(); G.pluckBuffer(ctx, 1, 0.7, 1); const first = performance.now() - t0
    t0 = performance.now(); G.pluckBuffer(ctx, 1, 0.7, 1); const second = performance.now() - t0
    const all = []
    for (let si = 0; si < 6; si++) for (let vi = 0; vi < 6; vi++) { t0 = performance.now(); G.pluckBuffer(ctx, si, 0.1 + 0.17 * vi, 1); all.push(performance.now() - t0) }
    return { first, second, worst: Math.max(...all), mean: all.reduce((a, b) => a + b, 0) / all.length }
  })
  check('7 cost', cost.first <= 30 && cost.second <= 1, `first A2 render ${f2(cost.first, 1)} ms (cold, body IR and design included; <= 30), cached repeat ${f2(cost.second, 3)} ms (<= 1); the 36 down-stroke buffers average ${f2(cost.mean, 1)} ms, worst ${f2(cost.worst, 1)} ms`)

  // ---- samples for the analyses
  const data = await evalRetry(async () => {
    const G = await import('/src/audio/guitar.ts')
    const sr = 48000, ctx = new OfflineAudioContext(1, 1, sr)
    const enc = y => { const u = new Uint8Array(y.buffer, y.byteOffset, y.byteLength); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s) }
    const o = { tuned: [...G.TUNED_HZ], tuning: [...G.TUNING_HZ], detune: [...G.DETUNE_CENTS], plucks: [], model: [] }
    for (let si = 0; si < 6; si++) { o.plucks.push(enc(G.pluckBuffer(ctx, si, 0.78, 1).getChannelData(0))); o.model.push(G.modelPartialCents(sr, si, 12)) }
    o.bright = enc(G.pluckBuffer(ctx, 5, 0.95, 1).getChannelData(0))
    o.brightE2 = enc(G.pluckBuffer(ctx, 0, 0.95, 1).getChannelData(0))
    o.bodyOn = enc(G.pluckSamples(sr, 1, 0.7, 1, { raw: true })); o.bodyOff = enc(G.pluckSamples(sr, 1, 0.7, 1, { raw: true, body: false }))
    o.a2 = enc(G.pluckBuffer(ctx, 1, 0.7, 1).getChannelData(0))
    return o
  })
  const tuned = data.tuned
  // 1 f0
  {
    const rows = []; let ok = true
    for (let si = 0; si < 6; si++) {
      const y = b64f32(data.plucks[si]), f = acF0(y, SR, tuned[si]), c = cents(f, tuned[si])
      rows.push(`${NAMES[si]} ${f2(f, 3)} Hz (${c >= 0 ? '+' : ''}${f2(c)} c vs ${f2(tuned[si], 3)}; detune ${data.detune[si] >= 0 ? '+' : ''}${data.detune[si]} c)`)
      if (Math.abs(c) > 3) ok = false
    }
    check('1 f0 within +-3 cents', ok, rows.join('; '))
  }
  // 2 T60 A2 partial 1 vs 8
  {
    const y = b64f32(data.a2), f1 = peakFreq(y, SR, 0.15, 0.5, tuned[1]), f8 = peakFreq(y, SR, 0.15, 0.4, 8 * f1 * 1.0004)
    const end = y.length / SR - 0.32
    const t1 = t60Of(y, SR, f1, end), t8 = t60Of(y, SR, f8, end)
    check('2 A2 T60 partial 1 / partial 8 >= 3', t1 / t8 >= 3, `partial 1 (${f2(f1, 2)} Hz) T60 ${f2(t1, 2)} s, partial 8 (${f2(f8, 1)} Hz) T60 ${f2(t8, 2)} s, ratio ${f2(t1 / t8, 2)}`)
  }
  // 3 inharmonicity: partial 12 of E2 and E4
  {
    const out = []
    for (const [si, lo, hi, key] of [[0, 2, 20, 'brightE2'], [5, -2, 2, 'bright']]) {
      const y = b64f32(data[key]), f1 = peakFreq(y, SR, 0.06, 0.45, tuned[si], 25), f12 = peakFreq(y, SR, 0.06, 0.4, 12 * f1, 90)
      const c = cents(f12, 12 * f1), cT = cents(f12, 12 * tuned[si])
      out.push({ si, ok: c >= lo && c <= hi, text: `${NAMES[si]} partial 12 ${f2(f12, 2)} Hz is ${c >= 0 ? '+' : ''}${f2(c)} c against 12 x measured f0 (${cT >= 0 ? '+' : ''}${f2(cT)} c against 12 x tuned; model ${f2(data.model[si])} c; want ${lo}..${hi})` })
    }
    check('3 E2 partial 12 sharp +2..+20 c, E4 within +-2 c', out.every(o => o.ok), out.map(o => o.text).join('; '))
  }
  // 4 body vs none
  {
    const on = b64f32(data.bodyOn), off = b64f32(data.bodyOff)
    const d = (f1, f2b) => 10 * Math.log10(bandEnergy(on, SR, 1.0, f1, f2b) / bandEnergy(off, SR, 1.0, f1, f2b))
    const d1 = d(85, 125), d2 = d(190, 250)
    check('4 body IR band energy >= +2 dB', d1 >= 2 && d2 >= 2, `A2 with the commuted body vs without: 85-125 Hz ${d1 >= 0 ? '+' : ''}${f2(d1, 1)} dB, 190-250 Hz ${d2 >= 0 ? '+' : ''}${f2(d2, 1)} dB`)
  }

  // ---- 5 strum timing: what the engine schedules, and the onset of each string's own buffer
  const strum = await evalRetry(async () => {
    const G = await import('/src/audio/guitar.ts'), K = await import('/src/audio/kit.ts')
    const sr = 48000, res = {}
    // the plan: gaps over many draws at the extreme sweep speeds and every direction
    let gmin = 1, gmax = 0, skipE2 = 0, firstE4 = 0, n = 0, falls = []
    for (const speed of [0, 0.25, 0.5, 0.75, 1]) for (const dir of [1, -1]) for (let i = 0; i < 400; i++) {
      const p = G.strumPlan(0.7, dir, speed)
      for (let k = 1; k < p.length; k++) { const g = p[k].dt - p[k - 1].dt; gmin = Math.min(gmin, g); gmax = Math.max(gmax, g) }
      if (dir < 0) { n++; if (p[0].string === 5) firstE4++; if (!p.some(q => q.string === 0)) skipE2++ } else falls.push(p[p.length - 1].v / p[0].v)
    }
    res.plan = { gmin, gmax, skipE2: skipE2 / n, firstE4: firstE4 / n, fall: falls.reduce((a, b) => a + b, 0) / falls.length }
    // engine: instrument start() while vGuitarStrum schedules, keeping the first 60 ms of each buffer
    const orig = AudioBufferSourceNode.prototype.start
    const logs = []
    AudioBufferSourceNode.prototype.start = function (when, ...rest) { const b = this.buffer; if (b) logs.push({ when, len: b.length, head: Array.from(b.getChannelData(0).subarray(0, Math.round(sr * 0.06))) }); return orig.call(this, when, ...rest) }
    try {
      for (const dir of [1, -1]) {
        const ctx = new OfflineAudioContext(2, sr, sr), e = K.buildEngine(ctx, ctx.destination, K.MASTER)
        logs.length = 0
        G.vGuitarStrum(e, 0.1, 0.3, 0, dir, 0.7, 0.5)
        res[dir] = logs.map(l => ({ when: l.when, len: l.len, head: l.head }))
      }
    } finally { AudioBufferSourceNode.prototype.start = orig }
    res.lens = [0, 1, 2, 3, 4, 5].map(si => Math.floor(sr * (3.4 - 0.25 * si)))
    return res
  })
  {
    const strOf = len => strum.lens.indexOf(len)
    const lines = []; let ok = true
    for (const dir of [1, -1]) {
      const ev = strum[dir].filter(l => strOf(l.len) >= 0).map(l => ({ si: strOf(l.len), t: l.when + onsetOf(Float32Array.from(l.head), SR) }))
      const order = ev.map(e => NAMES[e.si]).join(' ')
      const gaps = ev.slice(1).map((e, i) => (e.t - ev[i].t) * 1000)
      const inOrder = ev.every((e, i) => !i || (dir > 0 ? e.si > ev[i - 1].si : e.si < ev[i - 1].si))
      const startOk = dir > 0 ? ev[0].si === 0 : ev[0].si === 5
      const gapsOk = gaps.every(g => g >= 7.5 && g <= 30.5)
      if (!(inOrder && startOk && gapsOk)) ok = false
      lines.push(`dir ${dir}: ${order}; onset gaps ${gaps.map(g => f2(g, 1)).join(', ')} ms`)
    }
    const pl = strum.plan
    const planOk = pl.gmin >= 0.008 - 1e-9 && pl.gmax <= 0.03 + 1e-9 && pl.firstE4 === 1
    check('5 strum order and 8-30 ms onset gaps', ok && planOk, `${lines.join('; ')}; plan over 4000 draws at every speed: gaps ${f2(pl.gmin * 1000, 2)}..${f2(pl.gmax * 1000, 2)} ms, up-strum starts at E4 ${f2(pl.firstE4 * 100, 0)}% and skips E2 ${f2(pl.skipE2 * 100, 0)}% of the time, the last string is ${f2((1 - pl.fall) * 100, 0)}% softer than the first`)
  }

  // ---- 6 engine peaks, 8 WAVs
  const eng = await evalRetry(async ([wantWav]) => {
    const S = await import('/src/audio/sfx.ts'), T = await import('/src/audio/cuetable.ts')
    const sr = 48000
    const enc = y => { const u = new Uint8Array(y.buffer, y.byteOffset, y.byteLength); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s) }
    const stats = b => { let pk = 0; for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) pk = Math.max(pk, Math.abs(v)); return pk }
    const o = { peaks: {}, rows: {}, wav: {} }
    for (const id of ['guitar:pluck', 'guitar:strum', 'tr:exit']) {
      const row = T.CUE_TABLE.find(r => r.id === id)
      const b = await S.renderCue(id, row.opts, row.secs)
      o.peaks[id] = stats(b); o.rows[id] = { opts: row.opts, secs: row.secs, desc: row.desc }
    }
    const trimmed = S.TRIM['guitar:pluck'], trimS = S.TRIM['guitar:strum']
    o.trims = { pluck: trimmed, strum: trimS, exit: S.TRIM['tr:exit'], sigGuitar: S.TRIM['sig.guitar'] }
    // aliases the old engine path used
    if (wantWav) {
      const cues = { 'pluck-e2': ['guitar:pluck', { string: 0, velocity: 0.7 }, 4.2], 'pluck-a2': ['guitar:pluck', { string: 1, velocity: 0.7 }, 4.2], 'pluck-e4': ['guitar:pluck', { string: 5, velocity: 0.7 }, 3.2],
        'strum-down': ['guitar:strum', { velocity: 0.6, dir: 1 }, 4.0], 'strum-up': ['guitar:strum', { velocity: 0.6, dir: -1 }, 4.0] }
      for (const [k, [id, op, secs]] of Object.entries(cues)) { const b = await S.renderCue(id, op, secs); o.wav['new-' + k] = [enc(b.getChannelData(0)), enc(b.getChannelData(1))] }
      // the previous voice through the same master chain, called the way the old router did
      const OLD = await import('/docs/research/audio/_old-guitar.ts'), K = await import('/src/audio/kit.ts')
      const old = {
        'pluck-e2': [e => OLD.vGuitarPluck(e, 0.05, 0, 0.7, 0), 4.2], 'pluck-a2': [e => OLD.vGuitarPluck(e, 0.05, 1, 0.7, 0), 4.2], 'pluck-e4': [e => OLD.vGuitarPluck(e, 0.05, 5, 0.7, 0), 3.2],
        'strum-down': [e => OLD.vGuitarStrum(e, 0.05, 0.3, 0, 1, 0.6), 4.0], 'strum-up': [e => OLD.vGuitarStrum(e, 0.05, 0.3, 0, -1, 0.6), 4.0],
      }
      for (const [k, [fn, secs]] of Object.entries(old)) {
        const ctx = new OfflineAudioContext(2, Math.floor(secs * sr), sr), e = K.buildEngine(ctx, ctx.destination, K.MASTER)
        fn(e); const b = await ctx.startRendering(); o.wav['old-' + k] = [enc(b.getChannelData(0)), enc(b.getChannelData(1))]
      }
    }
    return o
  }, [!flag('skip-wav')])
  {
    const want = { 'guitar:pluck': -14, 'guitar:strum': -12, 'tr:exit': -24 }, tol = { 'guitar:pluck': 1.5, 'guitar:strum': 1.5, 'tr:exit': 2 }
    const parts = []; let ok = true
    for (const id of Object.keys(want)) { const d = dBs(eng.peaks[id]); parts.push(`${id} ${f2(d, 1)} dBFS (want ${want[id]} +-${tol[id]})`); if (Math.abs(d - want[id]) > tol[id]) ok = false }
    check('6 engine-graph peaks', ok, parts.join('; ') + `; trims ${JSON.stringify(eng.trims)}`)
  }
  if (!flag('skip-wav')) {
    fs.mkdirSync(WAVDIR, { recursive: true })
    const lines = []
    for (const gen of ['new', 'old']) for (const k of ['pluck-e2', 'pluck-a2', 'pluck-e4', 'strum-down', 'strum-up']) {
      const [Lb, Rb] = eng.wav[`${gen}-${k}`].map(b64f32)
      fs.writeFileSync(path.join(WAVDIR, `v16-guitar-${gen}-${k}.wav`), wavBytes(Lb, Rb, SR))
      let pk = 0, sq = 0; for (let i = 0; i < Lb.length; i++) { pk = Math.max(pk, Math.abs(Lb[i]), Math.abs(Rb[i])); sq += (Lb[i] * Lb[i] + Rb[i] * Rb[i]) / 2 }
      lines.push(`${gen}-${k}: peak ${f2(dBs(pk), 1)} dBFS, RMS ${f2(dBs(Math.sqrt(sq / Lb.length)), 1)} dBFS`)
    }
    check('8 WAVs written', true, `${WAVDIR}\n      ${lines.join('\n      ')}`)
  }
  await ctx1.close()

  // ================================================================== in the app
  if (!flag('skip-app')) {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const app = await ctx2.newPage()
    app.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) logs.push(`[app ${m.type()}] ${m.text()}`) })
    app.on('pageerror', e => logs.push(`[app pageerror] ${e.message}`))
    const ev = async (fn, a) => { for (let i = 0; ; i++) { try { return await app.evaluate(fn, a) } catch (err) { if (i < 3 && /context was destroyed|navigation/i.test(String(err))) { await app.waitForLoadState('load').catch(() => {}); await app.waitForTimeout(3000); continue } throw err } } }
    await app.goto(`${BASE}/?gate=0`, { waitUntil: 'load', timeout: 60000 })
    await app.waitForFunction(() => window.__v3 && window.__v3.goto && !document.documentElement.classList.contains('is-loading'), null, { timeout: 90000 })
    await app.waitForTimeout(1500)
    const G = await ev(async () => { const { WAYPOINTS } = await import('/src/v3/world/layout.ts'); return WAYPOINTS.findIndex(w => w.id === 'guitar') })
    await ev(async () => { await window.__v3.sfx.init() })
    const goTo = async i => { await ev(async i => { const { waypointP } = await import('/src/v3/world/flight.ts'); window.__v3.goto(waypointP(i)) }, i); }
    const warmState = () => ev(async () => (await import('/src/audio/guitar.ts')).guitarWarmState())
    // 7b: nowhere near, then 4 and 3 stops away: nothing; then 2 stops: it starts
    const pre = []
    for (const d of [G, 5, 4, 3]) { await goTo(G - d >= 0 ? G - d : 0); await app.waitForTimeout(d === 3 ? 3000 : 1200); const s = await warmState(); pre.push(`${d} stops away: started ${s.started === null ? 'no' : 'YES'}`); if (s.started !== null) break }
    const quiet = pre.every(p => /started no/.test(p))
    await goTo(G - 2)
    let st = null, t0 = Date.now()
    while (Date.now() - t0 < 8000) { st = await warmState(); if (st.started !== null) break; await app.waitForTimeout(100) }
    const startedAfter = Date.now() - t0
    while (Date.now() - t0 < 40000) { st = await warmState(); if (st.done) break; await app.waitForTimeout(250) }
    check('7b pre-render only within 2 stops of the guitar', quiet && st.started !== null && st.done, `${pre.join('; ')}; at 2 stops it started ${startedAfter} ms after arriving (page time ${f2(st.started, 0)} ms), built ${st.built} of ${st.total} buffers in ${st.slices} idle slices, longest slice ${f2(st.maxSliceMs, 1)} ms (<= 6), sample rate ${st.sr}`)
    check('7c idle slices stay within 6 ms', st.over6 <= Math.ceil(st.slices * 0.02), `${st.over6} of ${st.slices} slices ran over 6 ms (wall time, so a busy machine counts too), longest ${f2(st.maxSliceMs, 1)} ms`)

    // 9: the dwell and the sweep
    await goTo(G); await app.waitForTimeout(3500)
    const ready = await ev(async () => { const a = window.__cab?.stages?.guitar?.api; return a ? { armed: a.armed, present: a.present, segs: a.segs.map(s => ({ ...s })) } : null })
    if (!ready) check('9 sweep', false, 'the guitar stage never built')
    else {
      await ev(() => {
        window.__gl = []
        const cue = window.__v3.sfx.cue.bind(window.__v3.sfx)
        window.__v3.sfx.cue = (id, o) => { if (id === 'guitar:pluck') window.__gl.push({ t: Math.round(performance.now()), string: o.string, velocity: +o.velocity.toFixed(3), dir: o.dir, delay: o.delay }); return cue(id, o) }
      })
      const segs = ready.segs
      const mid = segs.map(s => [(s.ax + s.bx) / 2, (s.ay + s.by) / 2])
      const yMid = mid.reduce((s, m) => s + m[1], 0) / 6
      const xs = mid.map(m => m[0]), left = Math.min(...xs) - 70, right = Math.max(...xs) + 70
      const lowOnRight = xs[0] > xs[5]
      const run = async (label, fromX, toX, fnSrc) => {
        await ev(() => { window.__gl.length = 0 })
        await ev(async ([fromX, toX, y, fnSrc]) => {
          const stepsPx = eval(fnSrc), dirn = Math.sign(toX - fromX); let x = fromX
          const fire = cx => window.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: y, pointerType: 'mouse', bubbles: true }))
          fire(x); await new Promise(r => setTimeout(r, 60))
          let i = 0
          while ((toX - x) * dirn > 0) { x += dirn * stepsPx(i++, Math.min(1, Math.abs(x - fromX) / Math.abs(toX - fromX))); fire(x); await new Promise(r => setTimeout(r, 16)) }
          fire(x + dirn * 4)
        }, [fromX, toX, yMid, fnSrc])
        await app.waitForTimeout(80)
        return await ev(() => window.__gl.slice())
      }
      const [hiX, loX] = lowOnRight ? [left, right] : [right, left]
      const slow = await run('slow', loX, hiX, '() => 3')                              // ~0.25 px/ms
      await app.waitForTimeout(500)
      const med = await run('medium', hiX, loX, '() => 9')
      await app.waitForTimeout(500)
      await app.waitForTimeout(500)
      const fast = await run('fast', loX, hiX, '() => 22')
      await app.waitForTimeout(500)
      const veryFast = await run('very fast', hiX, loX, '() => 240')
      const fmt = l => l.map(p => `${NAMES[p.string]}@${p.velocity}${p.dir < 0 ? 'u' : 'd'}`).join(' ')
      const delays = l => l.map(p => f2((p.delay ?? 0) * 1000, 1)).join('/')
      const inOrder = l => l.length === 6 && l.every((p, i) => !i || (p.string - l[i - 1].string) === (l[0].string === 5 ? -1 : 1))
      const mean = l => l.reduce((s, p) => s + p.velocity, 0) / Math.max(1, l.length)
      const sweeps = [['slow', slow], ['medium', med], ['fast', fast], ['very fast', veryFast]]
      const ok9 = sweeps.every(([, l]) => inOrder(l)) && mean(slow) < mean(med) && mean(med) < mean(fast) && mean(fast) < mean(veryFast) && slow[0].dir === 1 && veryFast[0].dir === -1
      check('9 sweep plucks six strings in order, velocity rising with speed', ok9,
        sweeps.map(([n, l]) => `${n} (${l[0]?.dir === 1 ? 'low to high, down-stroke' : 'high to low, up-stroke'}): mean velocity ${f2(mean(l), 2)}, ${fmt(l)}, spacing ${delays(l)} ms`).join('; '))
      // shot: a fast sweep, then the strings mid-vibration
      fs.mkdirSync(SHOTS, { recursive: true })
      await app.waitForTimeout(700)
      await run('shot', loX, hiX, '() => 40')
      await app.waitForTimeout(180)
      await app.screenshot({ path: path.join(SHOTS, 'v16-guitar-strings.png') })
      console.log(`      ${path.join(SHOTS, 'v16-guitar-strings.png')}`)
    }
    await ctx2.close()

    // phone dwell
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const ph = await ctx3.newPage()
    ph.on('pageerror', e => logs.push(`[phone pageerror] ${e.message}`))
    await ph.goto(`${BASE}/?gate=0`, { waitUntil: 'load', timeout: 60000 })
    await ph.waitForFunction(() => window.__v3 && window.__v3.goto && !document.documentElement.classList.contains('is-loading'), null, { timeout: 90000 })
    await ph.waitForTimeout(1500)
    await ph.evaluate(async i => { const { waypointP } = await import('/src/v3/world/flight.ts'); window.__v3.goto(waypointP(i)) }, G)
    await ph.waitForTimeout(4500)
    await ph.evaluate(() => { const a = window.__cab?.stages?.guitar?.api; if (a) for (let i = 0; i < 6; i++) a.vibrate(i, 0.9, 0.3 + 0.05 * i, i * 0.03) })
    await ph.waitForTimeout(220)
    await ph.screenshot({ path: path.join(SHOTS, 'v16-guitar-390.png') })
    console.log(`      ${path.join(SHOTS, 'v16-guitar-390.png')}`)
    await ctx3.close()
  }
  check('10 no console errors', logs.length === 0, logs.length ? logs.slice(0, 6).join(' | ') : 'none')
} finally {
  await browser.close()
}
const failed = results.filter(r => !r.ok)
console.log(`\n${failed.length ? 'FAIL' : 'PASS'}: ${results.length - failed.length} of ${results.length} checks${failed.length ? ' (failing: ' + failed.map(r => r.id).join(', ') + ')' : ''}`)
process.exit(failed.length ? 1 : 0)
