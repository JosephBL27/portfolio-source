// Lab: a frozen contact sheet. One reel at N moments (?id=deadlines&t=4&dt=0.4&n=6&cols=3&w=480&h=300&i=1),
// or every reel once at the same moment (?id=all&t=8). Each canvas is built with a faked clock so its uTime
// starts at t + k*dt, then the page is paused so every cell draws exactly one frame.
// ?bare hides the captions; ?mouse=x,y fixes the pointer (0..1) for every cell; ?seed=<0..1> fixes uSeed.
import ember from '../src/reels/ember'
import phase from '../src/reels/phase'
import rings from '../src/reels/rings'
import digits from '../src/reels/digits'
import synapse from '../src/reels/synapse'
import deadlines from '../src/reels/deadlines'
import type { ReelDef } from '../src/reels/types'
import { createReelCanvas } from '../src/reels/mini'
import { setNight, setPaused } from '../src/state'

const ALL: ReelDef[] = [ember, phase, rings, digits, synapse, deadlines]
const qp = new URLSearchParams(location.search)
const id = qp.get('id') ?? 'all'
const t0 = +(qp.get('t') ?? 4), dt = +(qp.get('dt') ?? 0.4)
const w = +(qp.get('w') ?? 480), h = +(qp.get('h') ?? 300)
const inten = +(qp.get('i') ?? 1)
const dpr = +(qp.get('dpr') ?? 1)
const mouse = qp.get('mouse')?.split(',').map(Number)
const seed = +(qp.get('seed') ?? 0.3)
const cells: { reel: ReelDef; t: number; i: number }[] = []
if (id === 'all') ALL.forEach((r, k) => cells.push({ reel: r, t: t0, i: inten }))
else { const r = ALL.find(x => x.id === id)!; const n = +(qp.get('n') ?? 6); for (let k = 0; k < n; k++) cells.push({ reel: r, t: t0 + k * dt, i: inten }) }
if (qp.has('bare')) document.body.classList.add('bare')
const cols = +(qp.get('cols') ?? (cells.length <= 3 ? cells.length : 3))
setNight(true)
setPaused(true)
const grid = document.getElementById('grid')!
grid.style.gridTemplateColumns = `repeat(${cols}, ${w}px)`
const realNow = performance.now.bind(performance)
const realRandom = Math.random
Math.random = () => seed
for (const c of cells) {
  const f = document.createElement('figure'); f.style.width = w + 'px'; f.style.height = h + 'px'
  f.innerHTML = `<canvas></canvas><figcaption>${c.reel.id} · t ${c.t.toFixed(2)} · i ${c.i}</figcaption>`
  grid.append(f)
  const cv = f.querySelector('canvas')!
  performance.now = () => realNow() - c.t * 1000
  const h2 = createReelCanvas(cv, c.reel, { intensity: c.i, dpr })
  performance.now = realNow
  if (mouse) h2.setMouse(mouse[0], mouse[1])
}
Math.random = realRandom
;(window as any).__sheet = { cells }
