// Engine lab: /lab/engine.html
// Scrubs through ALL registered forms (A -> B pairs) through the real createField(): morph shader,
// camera rig, post stack, quality governor. Query:
//   ?s=<0..n-1>   scrub position (integer = a form at rest)        ?turb=<v>   turbulence
//   ?t=<sec>      freeze the shader clock (screenshots)            ?n=<count>  base particle count
//   ?tier=<i>     pin a quality tier   ?noadapt   no governor      ?hud=0      hide the HUD
//   ?sync=1       block on the GPU each frame (use with --disable-gpu-vsync to measure real GPU cost)
//   ?auto=1       autoplay the scrub   ?synth=1   add 3 synthetic test forms   ?bench=1  run the bench on load
//   ?bloom=<s>&grain=<g>&vig=<v>&ca=<c>&haze=<h>&warp=<w>&exp=<e>&thr=<t>  override post settings
// window.__engine = { field, post, bench(), scrub(s), forms }
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import type { FormDef } from '../src/v3/forms/types'
import { FORMS } from '../src/v3/forms'
import { H } from '../src/v3/forms/ctx'
import { createField } from '../src/v3/engine/field'

const q = new URLSearchParams(location.search)
const forms: FormDef[] = Object.values(FORMS)

// ---- synthetic forms so the lab works before the real ones land ----
const synth: FormDef[] = [
  {
    id: 'lab_torus',
    build(ctx, pos, col) {
      const ivory = H.hex('#EDE6D6'), hot = H.hex('#FF4A2B')
      for (let i = 0; i < ctx.count; i++) {
        const u = ctx.rand() * Math.PI * 2, v = ctx.rand() * Math.PI * 2, R = 2.0, r = 0.75
        const x = (R + r * Math.cos(v)) * Math.cos(u), y = r * Math.sin(v) * 1.1, z = (R + r * Math.cos(v)) * Math.sin(u)
        const c = i % 11 === 0 ? hot : ivory
        H.set(pos, col, i, x, y, z, 0, c[0], c[1], c[2], i % 11 === 0 ? 0.85 : 0.32)
      }
    },
    glsl: `vec3 anim_lab_torus(vec3 p, vec4 d, vec4 r, float t) { float a = t * 0.25; float c = cos(a), s = sin(a); return vec3(p.x * c - p.z * s, p.y + 0.06 * sin(t + p.x * 2.0), p.x * s + p.z * c); }`,
    camera: { pos: [0, 2.2, 8.2], target: [0, 0, 0], fov: 35 },
  },
  {
    id: 'lab_galaxy',
    build(ctx, pos, col) {
      const a = H.hex('#8FB8FF'), b = H.hex('#EDE6D6')
      for (let i = 0; i < ctx.count; i++) {
        const arm = Math.floor(ctx.rand() * 3), rad = Math.pow(ctx.rand(), 0.6) * 3.6, ang = arm * 2.094 + rad * 1.5 + (ctx.rand() - 0.5) * 0.5 / (0.3 + rad * 0.3)
        const y = (ctx.rand() - 0.5) * 0.3 * (1.2 - rad / 4)
        const k = Math.min(1, rad / 3.6)
        H.set(pos, col, i, Math.cos(ang) * rad, y, Math.sin(ang) * rad, 0, a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k, a[2] * (1 - k) + b[2] * k, 0.12 + 0.5 * (1 - k) * ctx.rand())
      }
    },
    glsl: `vec3 anim_lab_galaxy(vec3 p, vec4 d, vec4 r, float t) { float rad = length(p.xz); float a = t * 0.35 / (0.6 + rad); float c = cos(a), s = sin(a); return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c); }`,
    camera: { pos: [0, 3.4, 7.4], target: [0, 0, 0], fov: 38 },
  },
  {
    id: 'lab_wave',
    build(ctx, pos, col) {
      const g = H.hex('#3FBF8A'), w = H.hex('#EDE6D6')
      const S = Math.floor(Math.sqrt(ctx.count))
      for (let i = 0; i < ctx.count; i++) {
        const gx = (i % S) / S - 0.5, gz = Math.floor(i / S) / S - 0.5
        const x = gx * 8.4, z = gz * 5.2 - 0.5
        const m = Math.abs(gx * 2)
        H.set(pos, col, i, x, 0, z, 0, g[0] * (1 - m) + w[0] * m, g[1] * (1 - m) + w[1] * m, g[2] * (1 - m) + w[2] * m, 0.34)
      }
    },
    glsl: `vec3 anim_lab_wave(vec3 p, vec4 d, vec4 r, float t) { p.y = 0.45 * sin(p.x * 1.4 + t * 1.1) * cos(p.z * 1.7 - t * 0.8) - 0.9; return p; }`,
    camera: { pos: [0, 2.0, 8.6], target: [0, -0.3, 0], fov: 35 },
  },
]
if (forms.length < 3 || q.has('synth')) forms.push(...synth)
const ids = forms.map(f => f.id)

document.documentElement.classList.toggle('hide', q.get('hud') === '0')
const canvas = document.getElementById('c') as HTMLCanvasElement
const statsEl = document.getElementById('stats')!, label = document.getElementById('label')!
const scrub = document.getElementById('scrub') as HTMLInputElement
scrub.max = String(Math.max(1, ids.length - 1))

const field = createField(canvas, {
  forms,
  count: q.has('n') ? +q.get('n')! : undefined,
  adaptive: !q.has('noadapt') && !q.has('tier'),
  tier: q.has('tier') ? +q.get('tier')! : undefined,
  onProgress: p => { if (p < 1) label.textContent = `building forms ${(p * 100) | 0}%` },
})
{
  const o = (k: string, f: (v: number) => void) => { if (q.has(k)) f(+q.get(k)!) }
  const S = field.post.settings
  o('bloom', v => (S.bloomStrength = v)); o('grain', v => (S.grain = v)); o('vig', v => (S.vignette = v)); o('ca', v => (S.aberration = v))
  o('haze', v => (S.haze = v)); o('warp', v => (S.warp = v)); o('exp', v => (S.exposure = v)); o('thr', v => (S.bloomThreshold = v)); o('rad', v => (S.bloomRadius = v)); o('knee', v => (S.knee = v)); o('bknee', v => (S.bloomKnee = v)); o('tgt', v => (S.target = v)); o('emin', v => (S.min = v)); o('emax', v => (S.max = v)); if (q.get('ae') === '0') S.autoExposure = false
  field.post.apply()
}
let s = q.has('s') ? +q.get('s')! : 0
if (q.has('form')) { // ?form=<id>[&to=<id2>&mix=<0..1>] : absolute addressing, stable while other forms land
  const a = Math.max(0, ids.indexOf(q.get('form')!)), b = q.has('to') ? ids.indexOf(q.get('to')!) : a
  s = b > a ? a + (q.has('mix') ? +q.get('mix')! : 0.5) : a
}
function apply(v: number) {
  s = Math.max(0, Math.min(ids.length - 1, v))
  const a = Math.min(ids.length - 1, Math.floor(s)), b = Math.min(ids.length - 1, a + 1), m = ids.length > 1 && a < ids.length - 1 ? s - a : 0
  field.setState(ids[a], ids[b], m)
  scrub.value = String(s)
  label.textContent = a === b || m === 0 ? ids[a] : `${ids[a]}  ->  ${ids[b]}   ${(m * 100).toFixed(0)}%`
  document.querySelectorAll('#marks button').forEach(el => el.classList.toggle('on', (el as HTMLElement).dataset.i === String(Math.round(s))))
}
scrub.addEventListener('input', () => apply(+scrub.value))
// jump buttons per form
const marks = document.getElementById('marks')!
ids.forEach((id, i) => { const b = document.createElement('button'); b.textContent = id; b.dataset.i = String(i); b.onclick = () => apply(i); marks.appendChild(b) })
// turbulence
const turbs = document.getElementById('turbs')!
for (const v of [0, 0.6, 1.2, 2.4, 4]) { const b = document.createElement('button'); b.textContent = String(v); b.onclick = () => { field.setTurbulence(v); turbs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)) }; turbs.appendChild(b) }
if (q.has('turb')) field.setTurbulence(+q.get('turb')!)
// pause
let paused = false
const pauseBtn = document.getElementById('pause')!
pauseBtn.onclick = () => { paused = !paused; field.setPaused(paused); pauseBtn.classList.toggle('on', paused); pauseBtn.textContent = paused ? 'paused' : 'pause' }
// play
let playing = q.get('auto') === '1', speed = 0.42
const playBtn = document.getElementById('play')!
const setPlay = (p: boolean) => { playing = p; playBtn.classList.toggle('on', p); playBtn.textContent = p ? 'stop' : 'play' }
playBtn.onclick = () => setPlay(!playing); setPlay(playing)
let lastT = performance.now()
function tick(now: number) {
  requestAnimationFrame(tick)
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now
  if (playing) { let ns = s + dt * speed; if (ns > ids.length - 1) ns = 0; apply(ns) }
}
requestAnimationFrame(tick)
// scroll-kick demo: wheel feeds velocity
let vel = 0
addEventListener('wheel', e => { vel += e.deltaY * 0.0012 }, { passive: true })
setInterval(() => { vel *= 0.8; field.setVelocity?.(vel) }, 33)
// lose / restore the context to test recovery
document.getElementById('lose')!.onclick = () => {
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
  const ext = gl?.getExtension('WEBGL_lose_context'); if (!ext) return
  ext.loseContext(); setTimeout(() => ext.restoreContext(), 700)
}

// ?sync=1 : block on the GPU every frame (readPixels) so frame intervals measure real GPU cost even without vsync
if (q.has('sync')) {
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext, px = new Uint8Array(4)
  field.onFrame(() => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) })
}

// ---- benchmark: sweep every pair, record raw rAF intervals ----
interface Seg { seg: string; frames: number; fps: number; avgMs: number; median: number; p95: number; max: number; tier: number; particles: number }
async function bench(secPerPair = 2.2, holdSec = 0.8): Promise<Seg[]> {
  await field.ready
  setPlay(false)
  const out: Seg[] = []
  const frames: number[] = []
  let on = false, prev = performance.now()
  const loop = () => { requestAnimationFrame(loop); const now = performance.now(); if (on) frames.push(now - prev); prev = now }
  requestAnimationFrame(loop)
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
  const run = async (name: string, step: (u: number) => void, sec: number) => {
    frames.length = 0; on = true
    const t0 = performance.now()
    await new Promise<void>(res => { const f = () => { const u = (performance.now() - t0) / (sec * 1000); step(Math.min(1, u)); if (u >= 1) res(); else requestAnimationFrame(f) }; f() })
    on = false
    const dur = performance.now() - t0, nf = frames.length
    const sorted = frames.slice(1).sort((a, b) => a - b)
    if (!sorted.length) return
    const med = sorted[(sorted.length - 1) >> 1], p95 = sorted[Math.floor(sorted.length * 0.95)], mx = sorted[sorted.length - 1]
    out.push({ seg: name, frames: sorted.length, avgMs: +(dur / Math.max(1, nf)).toFixed(2), fps: +(1000 / med).toFixed(1), median: +med.toFixed(2), p95: +p95.toFixed(2), max: +mx.toFixed(2), tier: field.stats.tier, particles: field.count })
  }
  for (let i = 0; i < ids.length; i++) {
    await run(`${ids[i]} (rest)`, () => apply(i), holdSec)
    if (i < ids.length - 1) await run(`${ids[i]} -> ${ids[i + 1]}`, u => apply(i + u), secPerPair)
  }
  await wait(50)
  const all = out.map(o => o.median).sort((a, b) => a - b)
  const sum = { worstAvgMs: Math.max(...out.map(o => o.avgMs)), meanAvgMs: +(out.reduce((a, o) => a + o.avgMs, 0) / out.length).toFixed(2), worstMedianMs: Math.max(...out.map(o => o.median)), worstP95Ms: Math.max(...out.map(o => o.p95)), worstMaxMs: Math.max(...out.map(o => o.max)), minFps: Math.min(...out.map(o => o.fps)), medianOfMedians: all[(all.length - 1) >> 1], finalTier: field.stats.tier, particles: field.count }
  console.log('[bench] ' + JSON.stringify(sum))
  for (const o of out) console.log(`[bench] ${o.seg.padEnd(34)} avg ${o.avgMs}ms ${o.fps}fps  med ${o.median}ms  p95 ${o.p95}ms  max ${o.max}ms  tier ${o.tier}`)
  ;(window as any).__bench = { sum, out }
  return out
}

function hud() {
  const st = field.stats
  statsEl.textContent =
    `${st.fps.toFixed(0)} fps   frame ${st.frameMs.toFixed(1)} ms   median ${st.medianMs.toFixed(1)}   p95 ${st.p95Ms.toFixed(1)}   max ${st.maxMs.toFixed(0)}\n` +
    `draw calls ${st.drawCalls}   particles ${st.particles.toLocaleString()} / ${st.baseParticles.toLocaleString()}   tier ${st.tier}/${st.tiers - 1}   dpr ${st.dpr.toFixed(2)}\n` +
    `forms built ${st.built}/${st.total}   ${st.rendering ? 'rendering' : 'idle (stopped)'}${st.paused ? '  [paused]' : ''}`
}
setInterval(hud, 200)
document.getElementById('bench')!.onclick = () => { bench() }

field.ready.then(() => {
  apply(s)
  if (q.has('t')) field.setTime!(+q.get('t')!)
  if (q.get('bench') === '1') setTimeout(() => bench(), 600)
})
apply(s)
if (q.has('t')) { field.setTime!(+q.get('t')!); field.setPaused(true) }
;(window as any).__engine = { field, post: field.post, forms, bench, scrub: apply, ids }
