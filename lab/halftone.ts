// Lab: hero corner rehearsal, all six cut-outs as a specimen sheet, and the "Off the board" section.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { mountHalftone, type ShapeName, type HalftoneHandle } from '../src/ui/halftone'
import { initOffBoard } from '../src/ui/offboard'
import { state, setNight, setPaused } from '../src/state'
import { bus } from '../src/bus'
import { palette } from '../src/theme'
import { site } from '../src/data'

const qp = new URLSearchParams(location.search)
if (qp.has('night')) setNight(qp.get('night') === '1')
document.documentElement.dataset.theme = state.night ? 'night' : 'day'

const ink = () => palette(state.night).ink
const handles: HalftoneHandle[] = []

// hero
const [first, last] = site.bio.name.split(' ')
const h1 = document.getElementById('h1')!
h1.innerHTML = `${first}<span class="slot" aria-hidden="true"></span>${last}.`
handles.push(mountHalftone(document.querySelector<HTMLCanvasElement>('.c-endcap')!, 'endcap', { ink: ink(), turnSeconds: 60 }))
handles.push(mountHalftone(document.querySelector<HTMLCanvasElement>('.c-elbow')!, 'elbow', { ink: ink(), turnSeconds: -80 }))

// specimens
const SPECS: [ShapeName, string, number, number?][] = [
  ['endcap', 'Capsule end-cap', 60], ['elbow', '90° elbow fitting', -80], ['hold', 'Climbing hold', 70],
  ['meeple', 'Meeple', 9, 9], ['record', '12-inch record', 40], ['pawn', 'Pawn', 11, 4],
]
const wrap = document.getElementById('specimens')!
for (const [shape, label, turn, sway] of SPECS) {
  const d = document.createElement('div'); d.className = 'spec'
  d.innerHTML = `<span>${label}<b>${shape}</b></span><div class="art"><canvas></canvas></div>`
  wrap.append(d)
  handles.push(mountHalftone(d.querySelector('canvas')!, shape, { ink: ink(), turnSeconds: turn, sway, breathe: true, hoverTarget: d, fill: 0.9 }))
}

initOffBoard(document.getElementById('offboard')!)

// toggles
const nightBtn = document.getElementById('night')!, pauseBtn = document.getElementById('pause')!
nightBtn.setAttribute('aria-pressed', String(state.night))
nightBtn.addEventListener('click', () => setNight(!state.night))
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
bus.on('theme', ({ night }) => { nightBtn.setAttribute('aria-pressed', String(night)); handles.forEach(h => h.setInk(ink())) })
bus.on('pause', ({ paused }) => pauseBtn.setAttribute('aria-pressed', String(paused)))
const tb = performance.now()
requestAnimationFrame(() => setTimeout(() => console.log('[lab] first tasks done', Math.round(performance.now() - tb), 'ms; long tasks:', JSON.stringify((performance as any).__lt ?? [])), 1500))
;(window as any).__lab = { setNight, setPaused, state }
