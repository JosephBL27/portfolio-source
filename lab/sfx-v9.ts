// Lab: audition board for the v9 sound additions. One button per row of src/audio/cuetable.ts, plus the continuous gestures
// (point-of-view drag, TV spin, lab slider, odometer, dial) played with the pointer, and the per-area music bed.
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { sfx, AREA_KEYS } from '../src/audio/sfx'
import { CUE_TABLE } from '../src/audio/cuetable'

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const enable = async () => { if (!sfx.enabled) { await sfx.init(); $('#enable').textContent = 'Sound is on' } }
$('#enable').addEventListener('click', () => void enable())
$('#music').addEventListener('click', async e => { await enable(); const b = e.currentTarget as HTMLElement, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Music bed on' : 'Music bed off'; sfx.setMusic(on) })
$('#reduced').addEventListener('click', async e => { await enable(); const b = e.currentTarget as HTMLElement, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); sfx.forceReduced(on) })

// the cue buttons, grouped like the table
const groups = $('#groups'), seen = new Map<string, HTMLElement>()
for (const r of CUE_TABLE) {
  let row = seen.get(r.group)
  if (!row) { const h = document.createElement('h2'); h.textContent = r.group; row = document.createElement('div'); row.className = 'row'; groups.append(h, row); seen.set(r.group, row) }
  const b = document.createElement('button')
  const tag = r.opts ? ` ${Object.entries(r.opts).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''
  b.textContent = r.id + tag; b.title = r.desc
  b.addEventListener('click', async () => { await enable(); sfx.cue(r.id, r.opts) })
  row.append(b)
}

// the music bed: feed the flight state every frame while "dwell" is on
const areaSel = $<HTMLSelectElement>('#area')
for (const a of AREA_KEYS) { const o = document.createElement('option'); o.value = a; o.textContent = a; areaSel.append(o) }
areaSel.value = 'mind'
let dwell = false
$('#dwell').addEventListener('click', async e => { await enable(); dwell = !dwell; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(dwell)) })
const loop = (now: number) => { if (dwell) sfx.setFlight({ speed: 0, area: areaSel.value, mix: 1, wp: 3, t: now / 1000 }); requestAnimationFrame(loop) }
requestAnimationFrame(loop)

// pov:drag from the pointer: speed = pointer speed (px/s over 1800), dir = sign of the horizontal motion, one event every 90 ms like the real extra
{
  const pad = $('#pad'); let last: { x: number; y: number; t: number } | null = null, emitAt = 0
  pad.addEventListener('pointerdown', async e => { await enable(); pad.setPointerCapture(e.pointerId); pad.classList.add('on'); last = { x: e.clientX, y: e.clientY, t: performance.now() }; sfx.cue('pov:grab') })
  pad.addEventListener('pointermove', e => {
    if (!last) return
    const now = performance.now(), dt = Math.max(1, now - last.t), vx = ((e.clientX - last.x) / dt) * 1000, vy = ((e.clientY - last.y) / dt) * 1000
    last = { x: e.clientX, y: e.clientY, t: now }
    if (now - emitAt > 90) { emitAt = now; sfx.cue('pov:drag', { speed: Math.min(1, Math.hypot(vx, vy) / 1800), dir: Math.sign(vx) }) }
  })
  const up = () => { if (!last) return; last = null; pad.classList.remove('on'); sfx.cue('pov:release', { speed: 0.6 }); setTimeout(() => sfx.cue('pov:return'), 700) }
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up)
}
// tv:grab / spin / release
{
  const pad = $('#spin'); let last: { x: number; t: number } | null = null, emitAt = 0, sp = 0
  pad.addEventListener('pointerdown', async e => { await enable(); pad.setPointerCapture(e.pointerId); last = { x: e.clientX, t: performance.now() }; sfx.cue('tv:grab', { id: 'qvr' }) })
  pad.addEventListener('pointermove', e => {
    if (!last) return
    const now = performance.now(), dt = Math.max(1, now - last.t); sp = Math.min(1, (Math.abs(e.clientX - last.x) / dt) * 1000 / 1400); last = { x: e.clientX, t: now }
    if (now - emitAt > 90) { emitAt = now; sfx.cue('tv:spin', { id: 'qvr', speed: sp }) }
  })
  const up = () => { if (!last) return; last = null; sfx.cue('tv:release', { id: 'qvr', speed: sp }) }
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up)
}
$('#slider').addEventListener('input', async e => { await enable(); const v = +(e.target as HTMLInputElement).value; $('#sliderv').textContent = v.toFixed(2); sfx.cue('lab:drag', { param: 'sigma', value: v }) })
$('#odo').addEventListener('click', async () => { await enable(); for (let i = 0; i < 24; i++) setTimeout(() => sfx.cue('count:tick'), i * 60) })
$('#dial').addEventListener('click', async () => { await enable(); for (let i = 0; i < 5; i++) setTimeout(() => { sfx.cue('hub:detent', { ch: i }); sfx.cue('hub:channel', { i }) }, i * 320) })
