// Lab: the v4 sound palette. Buttons for every cue, flight controls (area / speed / mix / wp), a contract test that
// flies every WAYPOINT and fires its sound cue, and an offline level check (peak / RMS / LUFS) through the real master chain.
//   ?report=1  run the level check on load and publish it as window.__sfxReport (for scripted checks)
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { sfx, renderScene, renderCue, CUE_IDS, AREA_KEYS, type SceneEvent, type CueOpts } from '../src/audio/sfx'
import { WAYPOINTS } from '../src/v3/world/layout'

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const log = (m: string) => { const p = $('#log'); p.textContent = `${m}\n${p.textContent}`.slice(0, 4000) }

// ---------------------------------------------------------------- controls

const fl = { area: 'mind', speed: 0, mix: 1, wp: 3, rev: false, auto: false }
let demoRaf = 0

async function play(id: string, o?: CueOpts) {
  if (!sfx.enabled) await enable()
  sfx.cue(id, o)
  log(`cue ${id}`)
}
async function enable() {
  await sfx.init()
  $('#enable').textContent = 'Sound is on'
  $('#mute').setAttribute('aria-pressed', 'true'); $('#mute').textContent = 'Sound on'
  sfx.forceReduced($('#reduced').getAttribute('aria-pressed') === 'true')
}
function group(id: string, items: [string, string][]) {
  const el = $(`#${id}`)
  for (const [label, cue] of items) {
    const b = document.createElement('button'); b.textContent = label
    b.addEventListener('click', () => void play(cue))
    el.append(b)
  }
}
group('g-tv', [['poweron', 'poweron'], ['poweroff', 'poweroff'], ['channel', 'channel'], ['wind', 'wind']])
group('g-flight', [['whoosh', 'whoosh'], ['whoosh (reverse)', 'whoosh.rev'], ['land', 'land'], ['morph (current area)', 'morph']])
group('g-area', AREA_KEYS.map(a => [a, a]))
group('g-morph', [...AREA_KEYS.map(a => [a, `morph.${a}`] as [string, string]), ...AREA_KEYS.slice(1).map(a => [`${a} rev`, `morph.${a}.rev`] as [string, string])])
group('g-ui', [['hover', 'hover'], ['click', 'click'], ['open', 'open'], ['close', 'close']])

const areaSel = $<HTMLSelectElement>('#area')
for (const a of AREA_KEYS) { const o = document.createElement('option'); o.value = a; o.textContent = a; areaSel.append(o) }
areaSel.value = fl.area
areaSel.addEventListener('change', () => { fl.area = areaSel.value })
const slider = (id: string, key: 'speed' | 'mix' | 'wp') => {
  const el = $<HTMLInputElement>(`#${id}`), out = $(`#${id}v`)
  el.addEventListener('input', () => { fl[key] = +el.value; out.textContent = (+el.value).toFixed(2) })
}
slider('speed', 'speed'); slider('mix', 'mix'); slider('wp', 'wp')
$('#dir').addEventListener('click', e => { fl.rev = !fl.rev; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(fl.rev)) })
$('#auto').addEventListener('click', e => { fl.auto = !fl.auto; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(fl.auto)) })
$('#enable').addEventListener('click', () => void enable())
$('#mute').addEventListener('click', async () => {
  if (sfx.enabled) { sfx.setEnabled(false); $('#mute').setAttribute('aria-pressed', 'false'); $('#mute').textContent = 'Sound off' } else await enable()
})
$('#reduced').addEventListener('click', e => {
  const b = e.currentTarget as HTMLElement, on = b.getAttribute('aria-pressed') !== 'true'
  b.setAttribute('aria-pressed', String(on)); sfx.forceReduced(on)
})

// one frame loop feeds the engine, exactly like the site's master rAF will
let last = performance.now()
let demo: { events: SceneEvent[]; i: number; t0: number } | null = null
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  if (demo) {
    const t = (now - demo.t0) / 1000
    while (demo.i < demo.events.length && demo.events[demo.i].t <= t) {
      const ev = demo.events[demo.i++]
      if (ev.cue) { sfx.cue(ev.cue[0], ev.cue[1]); log(`arrive ${ev.cue[0]}`) }
      if (ev.flight) {
        fl.area = ev.flight.area; fl.speed = Math.abs(ev.flight.speed); fl.mix = ev.flight.mix; fl.wp = ev.flight.wp; fl.rev = ev.flight.speed < 0
        areaSel.value = fl.area; syncSliders()
        sfx.setFlight(ev.flight)
      }
    }
    if (demo.i >= demo.events.length) { demo = null; log('demo done') }
  } else {
    if (fl.auto) { fl.wp = Math.max(0, Math.min(18, fl.wp + (fl.rev ? -1 : 1) * fl.speed * dt * 1.4)); ($('#wp') as HTMLInputElement).value = String(fl.wp); $('#wpv').textContent = fl.wp.toFixed(2) }
    sfx.setFlight({ speed: fl.rev ? -fl.speed : fl.speed, area: fl.area, mix: fl.mix, wp: fl.wp, t: now / 1000 })
  }
  const lv = sfx.level()
  $('#meter i').style.width = `${Math.max(0, Math.min(100, ((lv + 60) / 60) * 100))}%`
  $('#meterv').textContent = Number.isFinite(lv) ? `${lv.toFixed(1)} dB` : '-inf dB'
  demoRaf = requestAnimationFrame(frame)
}
function syncSliders() {
  ;($('#speed') as HTMLInputElement).value = String(fl.speed); $('#speedv').textContent = fl.speed.toFixed(2)
  ;($('#mix') as HTMLInputElement).value = String(fl.mix); $('#mixv').textContent = fl.mix.toFixed(2)
  ;($('#wp') as HTMLInputElement).value = String(fl.wp); $('#wpv').textContent = fl.wp.toFixed(2)
}
demoRaf = requestAnimationFrame(frame)

// ---------------------------------------------------------------- the contract test: fly every WAYPOINT

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
/** Timeline built from WAYPOINTS: bell speed profile per leg, arrival cue (WAYPOINTS[].sound) at p = 1, then a dwell. */
export function buildTimeline(legScale = 1): SceneEvent[] {
  const ev: SceneEvent[] = [], step = 1 / 30
  let t = 0.2
  WAYPOINTS.forEach((wp, i) => {
    if (i > 0) {
      const prev = WAYPOINTS[i - 1], dur = (1.0 + 0.9 * wp.travel) * legScale
      const n = Math.round(dur / step)
      for (let k = 0; k <= n; k++) {
        const p = k / n, tt = t + p * dur
        const speed = Math.pow(Math.sin(Math.PI * p), 1.1)
        ev.push({ t: tt, flight: { speed, area: p < 0.4 ? prev.area : wp.area, mix: p < 0.85 ? 0.1 : 0.1 + ((p - 0.85) / 0.15) * 0.4, wp: i - 1 + ease(p), t: tt } })
      }
      t += dur
    }
    if (wp.sound) ev.push({ t, cue: [wp.sound] })
    const dwell = 0.9 * wp.dwell, n = Math.round(dwell / step)
    for (let k = 1; k <= n; k++) { const tt = t + (k / n) * dwell; ev.push({ t: tt, flight: { speed: 0, area: wp.area, mix: Math.min(1, 0.5 + (k / n) * 0.6), wp: i, t: tt } }) }
    t += dwell
  })
  return ev
}
$('#demo').addEventListener('click', async () => {
  if (!sfx.enabled) await enable()
  const events = buildTimeline()
  demo = { events, i: 0, t0: performance.now() }
  log(`demo: ${WAYPOINTS.length} waypoints, ${events[events.length - 1].t.toFixed(1)} s`)
})
$('#demo-stop').addEventListener('click', () => { demo = null; fl.speed = 0; syncSliders() })

// ---------------------------------------------------------------- level analysis

// ITU-R BS.1770 K-weighting biquads (48 kHz coefficients)
const K1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] }
const K2 = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] }
function biquad(x: Float32Array | Float64Array, c: { b: number[]; a: number[] }): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = c.b[0] * x[i] + c.b[1] * x1 + c.b[2] * x2 - c.a[1] * y1 - c.a[2] * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v
  }
  return y
}
const dB = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity)
interface Stats { peakDb: number; rmsDb: number; rmsActiveDb: number; lufsI: number; lufsM: number; tailS: number; nan: boolean }
function analyse(buf: AudioBuffer, from = 0, to = buf.duration): Stats {
  const sr = buf.sampleRate, a = Math.floor(from * sr), b = Math.min(buf.length, Math.floor(to * sr))
  const L = buf.getChannelData(0).subarray(a, b), R = buf.getChannelData(Math.min(1, buf.numberOfChannels - 1)).subarray(a, b)
  let peak = 0, sq = 0, nan = false
  const thr = Math.pow(10, -60 / 20)
  let first = -1, lastI = -1
  for (let i = 0; i < L.length; i++) {
    const l = L[i], r = R[i]
    if (!Number.isFinite(l) || !Number.isFinite(r)) nan = true
    const m = Math.max(Math.abs(l), Math.abs(r))
    peak = Math.max(peak, m); sq += (l * l + r * r) / 2
    if (m > thr) { if (first < 0) first = i; lastI = i }
  }
  let sqA = 0
  if (first >= 0) for (let i = first; i <= lastI; i++) sqA += (L[i] * L[i] + R[i] * R[i]) / 2
  const nA = first >= 0 ? lastI - first + 1 : 1
  // K-weighted block loudness: 400 ms blocks, 100 ms hop
  const kl = biquad(biquad(L, K1), K2), kr = biquad(biquad(R, K1), K2)
  const win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr), blocks: number[] = []
  for (let s = 0; s + win <= kl.length; s += hop) {
    let m = 0; for (let i = s; i < s + win; i++) m += kl[i] * kl[i] + kr[i] * kr[i]
    blocks.push(-0.691 + 10 * Math.log10(m / win + 1e-20))
  }
  const abs = blocks.filter(v => v > -70)
  const meanE = (arr: number[]) => 10 * Math.log10(arr.reduce((s, v) => s + Math.pow(10, v / 10), 0) / arr.length)
  let lufsI = -Infinity
  if (abs.length) { const rel = meanE(abs) - 10; const g = abs.filter(v => v > rel); lufsI = g.length ? meanE(g) : -Infinity }
  return {
    peakDb: dB(peak), rmsDb: dB(Math.sqrt(sq / Math.max(1, L.length))), rmsActiveDb: dB(Math.sqrt(sqA / nA)),
    lufsI, lufsM: blocks.length ? Math.max(...blocks) : -Infinity, tailS: first >= 0 ? (lastI - first) / sr : 0, nan,
  }
}

// ---------------------------------------------------------------- the report

interface Row extends Stats { name: string; kind: 'cue' | 'scene'; expect: 'sound' | 'silent'; status: string; secs: number }
const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-inf')
function judge(r: Omit<Row, 'status'>, min: number): string {
  if (r.nan) return 'NAN'
  if (r.expect === 'silent') return r.peakDb < -55 ? 'OK' : 'NOT SILENT'
  if (r.peakDb < min) return 'SILENT'
  if (r.peakDb > -1.5) return 'CLIP'
  if (r.lufsM > -13.5) return 'LOUD'
  return 'OK'
}
export async function runReport() {
  const rows: Row[] = []
  const add = (name: string, kind: Row['kind'], expect: Row['expect'], secs: number, s: Stats, min: number) => {
    const base = { name, kind, expect, secs, ...s }
    rows.push({ ...base, status: judge(base, min) })
  }
  const stat = $('#runstat')
  const cues: [string, number, number][] = [
    ['poweron', 3.4, -30], ['poweroff', 3.2, -30], ['channel', 1.2, -40], ['wind', 4.4, -45], ['whoosh', 1.6, -40], ['whoosh.rev', 1.6, -40], ['land', 1.2, -40],
    ['hover', 0.5, -50], ['click', 0.8, -40], ['open', 1.6, -40], ['close', 1.4, -40],
    ...AREA_KEYS.map(a => [a, 3.2, -40] as [string, number, number]),
    ...AREA_KEYS.map(a => [`morph.${a}`, 2.4, -50] as [string, number, number]),
    ['morph.mind.rev', 2.4, -50], ['morph.education.rev', 2.4, -50], ['morph.work.rev', 2.4, -50],
  ]
  for (const [id, secs, min] of cues) {
    stat.textContent = `rendering ${id} ...`
    add(id, 'cue', 'sound', secs, analyse(await renderCue(id, undefined, secs)), min)
  }
  // reduced motion: arrival cue is a plain tick, morph / wind / whoosh must be silent
  add('mind [reduced]', 'cue', 'sound', 1.6, analyse(await renderCue('mind', undefined, 1.6, { reduced: true })), -40)
  for (const id of ['morph.mind', 'wind', 'whoosh']) add(`${id} [reduced]`, 'cue', 'silent', 2, analyse(await renderCue(id, undefined, 2, { reduced: true })), -50)
  // beds at rest: TV on, dwelling in each area (measured after the 4 s fade-in)
  for (const a of AREA_KEYS) {
    stat.textContent = `rendering bed ${a} ...`
    const ev: SceneEvent[] = [{ t: 0, flight: { speed: 0, area: a, mix: 1, wp: 3, t: 0 } }]
    add(`bed ${a} (rest)`, 'scene', 'sound', 9, analyse(await renderScene(ev, 9), 5, 9), -75)
  }
  add('air bed, speed 1', 'scene', 'sound', 6, analyse(await renderScene([{ t: 0, flight: { speed: 1, area: 'mind', mix: 0, wp: 3, t: 0 } }], 6), 2, 6), -50)
  add('air bed, speed 0.5', 'scene', 'sound', 6, analyse(await renderScene([{ t: 0, flight: { speed: 0.5, area: 'mind', mix: 0, wp: 3, t: 0 } }], 6), 2, 6), -60)
  add('air bed, rest (prologue)', 'scene', 'sound', 6, analyse(await renderScene([{ t: 0, flight: { speed: 0, area: 'hub', mix: 0, wp: 0, t: 0 } }], 6), 2, 6), -80)
  add('beds [reduced]', 'scene', 'silent', 7, analyse(await renderScene([{ t: 0, flight: { speed: 1, area: 'mind', mix: 1, wp: 3, t: 0 } }], 7, { reduced: true }), 3, 7), -80)
  // the whole site: every waypoint, with its arrival cue
  stat.textContent = 'rendering full flight ...'
  const tl = buildTimeline(), len = tl[tl.length - 1].t + 2.5
  add(`full flight (${WAYPOINTS.length} waypoints)`, 'scene', 'sound', len, analyse(await renderScene(tl, len)), -40)
  stat.textContent = ''

  const cueIds = new Set<string>(CUE_IDS)
  const missing = WAYPOINTS.filter(w => w.sound && !cueIds.has(w.sound)).map(w => `${w.id}:${w.sound}`)
  const pass = rows.every(r => r.status === 'OK') && missing.length === 0
  const report = { pass, missing, waypointSounds: WAYPOINTS.filter(w => w.sound).map(w => `${w.id}:${w.sound}`), rows }
  ;(window as unknown as { __sfxReport: unknown }).__sfxReport = report

  const head = ['name', 'secs', 'peak dBFS', 'RMS dBFS', 'RMS active', 'LUFS-M max', 'LUFS-I', 'tail s', 'status']
  const html = [`<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>`]
  for (const r of rows) {
    html.push(`<tr><td>${r.name}</td><td>${r.secs.toFixed(1)}</td><td>${fmt(r.peakDb)}</td><td>${fmt(r.rmsDb)}</td><td>${fmt(r.rmsActiveDb)}</td><td>${fmt(r.lufsM)}</td><td>${fmt(r.lufsI)}</td><td>${r.tailS.toFixed(2)}</td><td class="${r.status === 'OK' ? 'ok' : 'bad'}">${r.status}</td></tr>`)
  }
  html.push('</table>')
  html.push(`<p>${pass ? 'PASS' : 'FAIL'}: ${rows.filter(r => r.status !== 'OK').length} row(s) out of range. WAYPOINTS sound ids: ${report.waypointSounds.join(', ')}${missing.length ? `. MISSING cues: ${missing.join(', ')}` : '. All registered.'}</p>`)
  $('#report').innerHTML = html.join('')
  console.log('SFX_REPORT ' + JSON.stringify({ pass, missing, rows: rows.map(r => ({ n: r.name, peak: +fmt(r.peakDb), rms: +fmt(r.rmsDb), rmsA: +fmt(r.rmsActiveDb), lufsM: +fmt(r.lufsM), lufsI: +fmt(r.lufsI), s: r.status })) }))
  return report
}
$('#run').addEventListener('click', () => void runReport())
if (new URLSearchParams(location.search).get('report') === '1') void runReport()
