// Lab: reels B (digits, synapse, deadlines) as large tiles, 240x150 thumbnails, and a fullscreen view.
// Debug query params (lab only): ?full=<id> opens fullscreen, ?t=<s> offsets reel time, ?seed=<0..1> fixes uSeed,
// ?only=<id> mounts one reel, ?check=1 compiles every reel through three.js ShaderMaterial and logs the result.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import digits from '../src/reels/digits'
import synapse from '../src/reels/synapse'
import deadlines from '../src/reels/deadlines'
import ember from '../src/reels/ember'
import phase from '../src/reels/phase'
import rings from '../src/reels/rings'
import type { ReelDef } from '../src/reels/types'
import { createReelCanvas, type ReelCanvas } from '../src/reels/mini'
import { state, setNight, setPaused } from '../src/state'
import { bus } from '../src/bus'

const qp = new URLSearchParams(location.search)
const ALL: ReelDef[] = [digits, synapse, deadlines]
const only = qp.get('only')
const REELS = only ? ALL.filter(r => r.id === only) : ALL
const CHANNEL: Record<string, number> = { digits: 4, synapse: 5, deadlines: 6 }
document.documentElement.dataset.theme = 'night'
if (!state.night) setNight(true)

// lab-only determinism: fixed seed during mount, time offset after mount
const seedQ = qp.get('seed')
const realRandom = Math.random
if (seedQ !== null) Math.random = () => +seedQ
const handles: ReelCanvas[] = []
const log = document.getElementById('log')!

function wireMouse(el: HTMLElement, h: ReelCanvas) {
  el.addEventListener('pointermove', e => {
    const b = el.getBoundingClientRect()
    h.setMouse((e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height)
  })
  el.addEventListener('pointerleave', () => h.setMouse(0.5, 0.5))
}

const tiles = document.getElementById('tiles')!
for (const r of REELS) {
  const f = document.createElement('figure'); f.className = 'tile'; f.dataset.id = r.id
  f.innerHTML = `<div class="scr"><canvas aria-label="${r.title}: ${r.medium}" role="img"></canvas><button type="button">Fullscreen</button></div>
    <figcaption><b>${String(CHANNEL[r.id] ?? 0).padStart(2, '0')} / ${r.title}</b><span class="mono">${r.medium}</span></figcaption>`
  tiles.append(f)
  const h = createReelCanvas(f.querySelector('canvas')!, r, { intensity: 1, dpr: 1.5 })
  handles.push(h); wireMouse(f.querySelector('.scr')!, h)
  f.querySelector('button')!.addEventListener('click', () => openFull(r.id))
}
const thumbs = document.getElementById('thumbs')!
for (const r of REELS) {
  const d = document.createElement('div'); d.className = 'thumb'; d.dataset.id = r.id
  d.innerHTML = `<canvas aria-label="${r.title} preview" role="img"></canvas>`
  thumbs.append(d)
  const h = createReelCanvas(d.querySelector('canvas')!, r, { intensity: 0.35, dpr: 2 })
  handles.push(h); wireMouse(d, h)
}

// fullscreen
const full = document.getElementById('full')!
let fullH: ReelCanvas | null = null
let fullIdx = 0
function openFull(id?: string) {
  fullIdx = Math.max(0, REELS.findIndex(r => r.id === id))
  const r = REELS[fullIdx]
  full.classList.add('on')
  if (!fullH) { fullH = createReelCanvas(full.querySelector('canvas')!, r, { intensity: 1, dpr: 1.5 }); wireMouse(full, fullH); applyOffset() }
  else fullH.setReel(r)
  document.getElementById('fn')!.textContent = `${String(CHANNEL[r.id] ?? 0).padStart(2, '0')} / 06`
  document.getElementById('ft')!.textContent = r.title
  document.getElementById('fm')!.textContent = r.medium
  history.replaceState(null, '', `?${new URLSearchParams({ ...Object.fromEntries(qp), full: r.id })}`)
}
function closeFull() { full.classList.remove('on'); fullH?.dispose(); fullH = null; qp.delete('full'); history.replaceState(null, '', `?${qp}`) }
document.getElementById('fs')!.addEventListener('click', () => openFull(REELS[0].id))
document.getElementById('fx')!.addEventListener('click', closeFull)
addEventListener('keydown', e => {
  if (!full.classList.contains('on')) { if (e.key === 'f') openFull(REELS[0].id); return }
  if (e.key === 'Escape') closeFull()
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') openFull(REELS[(fullIdx + (e.key === 'ArrowRight' ? 1 : REELS.length - 1)) % REELS.length].id)
})
if (qp.get('full')) openFull(qp.get('full')!)

// time offset for screenshots: uTime = elapsed + t
function applyOffset() {
  const t = +(qp.get('t') ?? 0)
  if (!t) return
  const base = performance.now.bind(performance)
  const off = t * 1000
  if (!(performance as any).__patched) { (performance as any).__patched = true; performance.now = () => base() + off }
}
applyOffset()
Math.random = realRandom

// toggles
const nightBtn = document.getElementById('night')!, pauseBtn = document.getElementById('pause')!
nightBtn.addEventListener('click', () => setNight(!state.night))
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
bus.on('theme', ({ night }) => { nightBtn.setAttribute('aria-pressed', String(night)); document.documentElement.dataset.theme = night ? 'night' : 'day' })
bus.on('pause', ({ paused }) => pauseBtn.setAttribute('aria-pressed', String(paused)))

// three.js compile check for all six reels, both ways: ShaderMaterial (GLSL 3.00 conversion) and the
// RawShaderMaterial path the TV actually uses (plain GLSL ES 1.00). Reads back the centre pixel too.
if (qp.has('check')) {
  import('three').then(THREE => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const renderer = new THREE.WebGLRenderer({ canvas: c })
    const errs: string[] = []
    renderer.debug.onShaderError = (gl, prog, vs, fs) => { errs.push(String(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog))) }
    const rt = new THREE.WebGLRenderTarget(64, 64)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const out: string[] = []
    const uniforms = () => ({ uTime: { value: 3 }, uRes: { value: new THREE.Vector2(64, 64) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uNight: { value: 1 }, uSeed: { value: 0.3 }, uIntensity: { value: 1 } })
    for (const r of [ember, phase, rings, digits, synapse, deadlines]) {
      for (const kind of ['shader', 'raw'] as const) {
        errs.length = 0
        const mat = kind === 'shader'
          ? new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: r.frag, uniforms: uniforms() })
          : new THREE.RawShaderMaterial({ vertexShader: 'precision highp float;\nattribute vec3 position;\nvoid main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: r.frag, uniforms: uniforms(), depthTest: false, depthWrite: false })
        const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))
        renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null)
        const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 32, 32, 1, 1, px)
        out.push(`${r.id}/${kind}: ${errs.length ? 'ERROR ' + errs.join(' | ') : 'ok'} px=${Array.from(px).join(',')}`)
      }
    }
    log.textContent = 'three.js check\n' + out.join('\n')
    console.log('[check]', out.join(' ; '))
  })
}
;(window as any).__lab = { setNight, setPaused, state, handles, get full() { return fullH }, reels: ALL }
