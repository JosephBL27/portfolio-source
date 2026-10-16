// Lab: reels A (ember, phase, rings) as large tiles, 240x150 thumbnails, and a fullscreen view.
// Query params (for screenshots): ?full=<id> opens fullscreen, ?t=<s> offsets reel time,
// ?mouse=x,y fixes the pointer (0..1), ?i=<0..1> forces tile intensity, ?bare hides chrome.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import ember from '../src/reels/ember'
import phase from '../src/reels/phase'
import rings from '../src/reels/rings'
import type { ReelDef } from '../src/reels/types'
import { createReelCanvas, type ReelCanvas } from '../src/reels/mini'
import { state, setNight, setPaused } from '../src/state'
import { bus } from '../src/bus'
import { projects } from '../src/data'

const qp = new URLSearchParams(location.search)
setNight(qp.has('night') ? qp.get('night') === '1' : true)
if (qp.has('bare')) document.body.classList.add('bare')

const REELS: ReelDef[] = [ember, phase, rings]
// fixed per-mount seed for repeatable shots (mini.ts draws it from Math.random at mount)
const seedQ = qp.has('seed') ? +qp.get('seed')! : null
const rnd = Math.random
if (seedQ !== null) Math.random = () => seedQ
const nameOf = (pid: string) => (projects as { id: string; name: string }[]).find(p => p.id === pid)?.name ?? pid
const forcedI = qp.has('i') ? +qp.get('i')! : null
const fixedMouse = qp.get('mouse')?.split(',').map(Number) as [number, number] | undefined

const tilesEl = document.getElementById('tiles')!
const thumbsEl = document.getElementById('thumbs')!
const handles: ReelCanvas[] = []

// tween intensity so hover never pops
function tweenIntensity(h: ReelCanvas, from: { v: number }, to: number) {
  const start = from.v, t0 = performance.now(), dur = state.reduced ? 1 : 420
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur)
    from.v = start + (to - start) * (1 - Math.pow(1 - k, 3))
    h.setIntensity(from.v)
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

REELS.forEach((reel, i) => {
  const fig = document.createElement('figure')
  fig.className = 'tile'
  fig.innerHTML = `<div class="screen"><canvas aria-label="${reel.title}: ${reel.medium}" role="img"></canvas>
    <button class="open" type="button">Fullscreen</button></div>
    <figcaption><span class="mono n">${String(i + 1).padStart(2, '0')} /</span><b>${reel.title}</b><span class="mono pid">${nameOf(reel.projectId)}</span>
    <span class="m">${reel.medium}</span></figcaption>`
  tilesEl.append(fig)
  const screen = fig.querySelector<HTMLElement>('.screen')!
  const h = createReelCanvas(fig.querySelector('canvas')!, reel, { intensity: forcedI ?? 0.6, dpr: 2 })
  handles.push(h)
  const iv = { v: forcedI ?? 0.6 }
  if (fixedMouse) h.setMouse(fixedMouse[0], fixedMouse[1])
  screen.addEventListener('pointermove', e => {
    const r = screen.getBoundingClientRect()
    h.setMouse((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
  })
  screen.addEventListener('pointerenter', () => forcedI === null && tweenIntensity(h, iv, 1))
  screen.addEventListener('pointerleave', () => { h.setMouse(0.5, 0.5); if (forcedI === null) tweenIntensity(h, iv, 0.6) })
  fig.querySelector('.open')!.addEventListener('click', () => openFull(i))

  const th = document.createElement('figure')
  th.className = 'thumb'
  th.innerHTML = `<div class="screen"><canvas role="img" aria-label="${reel.title}, thumbnail"></canvas></div><figcaption class="mono">${String(i + 1).padStart(2, '0')} · ${reel.title}</figcaption>`
  thumbsEl.append(th)
  handles.push(createReelCanvas(th.querySelector('canvas')!, reel, { intensity: 0.4, dpr: 2 }))
})

// fullscreen: one canvas, channel switching with setReel
const full = document.getElementById('full')!
const hudL = document.getElementById('hud-l')!
const fullH = createReelCanvas(full.querySelector('canvas')!, REELS[0], { intensity: 1, dpr: 1.5 })
handles.push(fullH)
let cur = -1
function openFull(i: number) {
  cur = (i + REELS.length) % REELS.length
  const r = REELS[cur]
  fullH.setReel(r)
  hudL.innerHTML = `${String(cur + 1).padStart(2, '0')} / ${String(REELS.length).padStart(2, '0')} · ${nameOf(r.projectId)}<b>${r.title}</b>`
  full.classList.add('on')
  fullH.setMouse(fixedMouse?.[0] ?? 0.5, fixedMouse?.[1] ?? 0.5)
  requestAnimationFrame(() => fullH.draw())
}
function closeFull() { full.classList.remove('on'); cur = -1 }
document.getElementById('close')!.addEventListener('click', closeFull)
full.addEventListener('pointermove', e => { if (!fixedMouse) fullH.setMouse(e.clientX / innerWidth, 1 - e.clientY / innerHeight) })
addEventListener('keydown', e => {
  if (cur < 0) return
  if (e.key === 'Escape') closeFull()
  if (e.key === 'ArrowRight') openFull(cur + 1)
  if (e.key === 'ArrowLeft') openFull(cur - 1)
})

if (seedQ !== null) Math.random = rnd
// time offset for deterministic screenshots: shift the clock after every runner has its t0
const off = qp.has('t') ? +qp.get('t')! * 1000 : 0
if (off) { const orig = performance.now.bind(performance); performance.now = () => orig() + off }

const fq = qp.get('full')
if (fq) { const i = REELS.findIndex(r => r.id === fq); if (i >= 0) openFull(i) }

// toggles
const nightBtn = document.getElementById('night')!, pauseBtn = document.getElementById('pause')!
nightBtn.setAttribute('aria-pressed', String(state.night))
nightBtn.addEventListener('click', () => setNight(!state.night))
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
bus.on('theme', ({ night }) => { nightBtn.setAttribute('aria-pressed', String(night)); handles.forEach(h => h.draw()) })
bus.on('pause', ({ paused }) => pauseBtn.setAttribute('aria-pressed', String(paused)))
;(window as any).__lab = { setNight, setPaused, state, handles, openFull, reels: REELS, full: fullH }
