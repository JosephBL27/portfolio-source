// Finder Organizer lab: the Sunday run as a Finder window you can play with.
// 225 anonymous sheets (the real totals: 175 moved, 50 quarantined) sit in a loose pile. Run = the five steps of the job
// (Scan, Classify, Gate, Apply, Audit, names and one-liners from src/data/projects.json); the sheets then fly into their folders on
// damped springs with a fake height, so each one lobs, lands and squashes the folder. Drag any sheet yourself and drop it on a folder:
// the script, not the drop, decides where it goes. Undo replays the log backwards (last in, first out).
// Honest by construction: no file names exist anywhere (the sheets are blank), nothing here is a claim beyond the two totals and the gates.
// Ported from ~/PORTFOLIO/src/sb/faces/face-finder-organizer.tsx (7 sheets, SVG + Motion) and rebuilt: canvas 2D, springs, drag, undo.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: evidence:flip (a sheet lands), lab:arb (the gate refuses a drop).
import './finder-organizer.css'
import projectsRaw from '../../data/projects.json'
import { TAU, clamp, esc, fitCanvas, frameLoop, gate, lerp, mulberry, onFirstView, sitePaused, spring, stepSpring, type LabHandle, type LabOpts, type Spring } from './lib/kit'

interface Proj { id: string; statusLabel: string; metrics: { value: string; label: string }[]; pipeline: { step: string; detail: string }[] }
const P = (projectsRaw as Proj[]).find(p => p.id === 'finder-organizer')!

// ---------------------------------------------------------------------------------------------------- data
const m = P.metrics.find(x => /moved/.test(x.label) && /quarantined/.test(x.label))
const MOVED = parseInt(m?.label.match(/(\d+)\s*moved/)?.[1] ?? '175', 10)
const QUAR = parseInt(m?.label.match(/(\d+)\s*quarantined/)?.[1] ?? '50', 10)
const N = MOVED + QUAR
const GATES = P.metrics.find(x => /confidence/.test(x.label))?.value ?? '0.75 / 0.90'
const STEPS = P.pipeline.map(s => ({ name: s.step, detail: s.detail }))
const FOLDER_NAME = ['Moved', 'Quarantined'] as const

// ---------------------------------------------------------------------------------------------------- timing (seconds)
const T_CLASSIFY = 0.7, T_GATE = 1.35, T_APPLY = 1.85
const APPLY_SPAN = 2.9          // launches are spread over this long
const UNDO_SPAN = 1.5
const VIS = 11                  // resting sheets drawn per folder

// sheet states
const PILE = 0, FLY = 1, LANDED = 2, HELD = 3, BACK = 4, HOP = 5

interface Sheet {
  id: number; fate: 0 | 1; seed: number; zi: number
  hx: number; hy: number; hr: number            // home pose in the pile (unit coords for x,y)
  u: number; v: number
  x: number; y: number; r: number; vx: number; vy: number; vr: number; z: number
  st: number; tx: number; ty: number; tr: number
  k: number; d0: number; zmax: number; born: number
  at: number; flash: number; tint: number; tintAt: number; al: number; alAt: number
  folder: number; hopT: number; hopTo: number
}
interface Folder {
  x: number; y: number; w: number; h: number; tabW: number; tabH: number; front: number; cx: number
  sq: Spring; open: Spring; glow: Spring; n: number; stack: Sheet[]
}
interface Geo { W: number; H: number; stacked: boolean; pile: { x: number; y: number; w: number; h: number }; f: [Folder, Folder]; gateAt: number; sw: number; sh: number }

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 105)
  const cueArb = gate(opts.emit, 400)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'fo'
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="fo-head">
    <div>
      <span class="fo-kicker">Interactive model, the Sunday run</span>
      <h3 class="fo-title">${N} loose files, one run</h3>
    </div>
    <p class="fo-note" role="note"><b>Blank sheets, no file names.</b> Only the totals are real: ${MOVED} moved, ${QUAR} quarantined.</p>
  </header>
  <div class="fo-tilt">
    <div class="fo-win" aria-label="A Finder-style window with a pile of loose sheets and two folders">
      <div class="fo-bar">
        <span class="fo-lights" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="fo-wt">Downloads and Desktop</span>
        <span class="fo-tools" role="group" aria-label="Run controls">
          <button type="button" class="fo-btn" data-act="run"><span>Run</span></button>
          <button type="button" class="fo-btn" data-act="one" title="Send one loose sheet to its folder">Send one</button>
          <button type="button" class="fo-btn" data-act="undo" title="Replay the log backwards" disabled>Undo</button>
        </span>
      </div>
      <div class="fo-body">
        <aside class="fo-side" aria-hidden="true">
          <p class="fo-sh">On this Mac</p>
          <ul>
            <li class="is-loose"><i></i><span>Loose</span><b data-n="loose">${N}</b></li>
            <li class="is-a"><i></i><span>Moved</span><b data-n="a">0</b></li>
            <li class="is-b"><i></i><span>Quarantined</span><b data-n="b">0</b></li>
          </ul>
          <p class="fo-sh">Gate</p>
          <p class="fo-gate"><b>${esc(GATES)}</b><span>minimum confidence, general / school, career and project folders</span></p>
        </aside>
        <div class="fo-main"><canvas class="fo-cv" role="img" aria-label="${N} blank sheets fly from a loose pile into two folders, Moved and Quarantined. Drag a sheet onto a folder, or use Run, Send one and Undo."></canvas><div class="fo-tip" hidden></div></div>
      </div>
      <div class="fo-steps" aria-hidden="true">${STEPS.map((s, i) => `<span class="fo-step" data-i="${i}"><b>${esc(s.name)}</b></span>`).join('<em></em>')}</div>
      <p class="fo-status"><span class="fo-status-t"></span></p>
      <div class="fo-glare" aria-hidden="true"></div>
    </div>
  </div>
  <p class="fo-hint">Drag a sheet to a folder, or press Run. The model only proposes, so the script files each sheet where its checks say, wherever you drop it.</p>
  <p class="fo-sr" aria-live="polite"></p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const cv = $<HTMLCanvasElement>('.fo-cv'), g = cv.getContext('2d')!
  const win = $('.fo-win'), tilt = $('.fo-tilt'), tip = $('.fo-tip'), sr = $('.fo-sr'), statusT = $('.fo-status-t')
  const btnRun = $<HTMLButtonElement>('[data-act="run"]'), btnOne = $<HTMLButtonElement>('[data-act="one"]'), btnUndo = $<HTMLButtonElement>('[data-act="undo"]')
  const nEl = { loose: $('[data-n="loose"]'), a: $('[data-n="a"]'), b: $('[data-n="b"]') }
  const side = $('.fo-side')
  const stepEls = Array.from(root.querySelectorAll<HTMLElement>('.fo-step'))

  // ------------------------------------------------------------------------------------------------ sheets
  const rnd = mulberry(0xf11d3a)
  const sheets: Sheet[] = []
  const pattern: (0 | 1)[] = []          // fate by launch order: the quarantined ones spread evenly through the run
  for (let i = 0; i < N; i++) pattern.push(Math.floor(((i + 1) * QUAR) / N) > Math.floor((i * QUAR) / N) ? 1 : 0)
  // home spots: a jittered grid over the pile rectangle, then shuffled, so the heap looks tossed but covers evenly
  const cols = Math.ceil(Math.sqrt(N * 1.7)), rows = Math.ceil(N / cols)
  const cells: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([(c + 0.5 + (rnd() - 0.5) * 0.9) / cols, (r + 0.5 + (rnd() - 0.5) * 0.9) / rows])
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]] }
  // launch order peels the pile from the folder side first; fates follow the even pattern in that order
  const byReach = cells.slice(0, N).map((c, i) => ({ i, key: c[0] + (rnd() - 0.5) * 0.35 })).sort((a, b) => b.key - a.key)
  const fateOf: (0 | 1)[] = new Array(N)
  byReach.forEach((e, rank) => { fateOf[e.i] = pattern[rank] })
  const orderOf: number[] = byReach.map(e => e.i)
  for (let i = 0; i < N; i++) {
    sheets.push({
      id: i, fate: fateOf[i], seed: Math.floor(rnd() * 1000), zi: rnd(), u: cells[i][0], v: cells[i][1], hx: 0, hy: 0, hr: (rnd() - 0.5) * 1.15,
      x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, z: 0, st: PILE, tx: 0, ty: 0, tr: 0, k: 70, d0: 1, zmax: 30, born: 0,
      at: 0, flash: 0, tint: 0, tintAt: 0.7 + rnd() * 0.5, al: 1, alAt: 0, folder: fateOf[i], hopT: 0, hopTo: 0,
    })
  }
  const zorder = sheets.slice().sort((a, b) => a.zi - b.zi)        // draw order for the pile; the last one is on top
  const launchOrder = orderOf.map(i => sheets[i])
  const pose = (f: Folder, rank: number, s: Sheet, sw: number, sh: number) => {
    const col = ((s.seed * 7 + rank * 3) % 7) - 3
    // the fan of sheets standing in the folder grows with how full it is
    const fill = clamp(f.stack.length / (N * 0.4), 0, 1) ** 0.7
    const peek = rank < VIS ? sh * (0.5 + 1.1 * fill) * (1 - rank / VIS) ** 1.1 - sh * 0.04 : -sh * 0.3
    return { x: f.cx + col * f.w * 0.078, y: f.y + f.tabH + f.front - peek + sh / 2, r: ((s.seed % 9) - 4) * 0.028 + col * 0.018 }
  }

  // ------------------------------------------------------------------------------------------------ geometry
  let geo: Geo
  let sideHidden = false
  const mkFolder = (): Folder => ({ x: 0, y: 0, w: 0, h: 0, tabW: 0, tabH: 0, front: 0, cx: 0, sq: spring(0, 170, 11), open: spring(0, 120, 17), glow: spring(0, 160, 20), n: 0, stack: [] })
  const folders: [Folder, Folder] = [mkFolder(), mkFolder()]
  let dpr = 1
  let sprites: HTMLCanvasElement[] = []
  function layout(W: number, H: number) {
    const stacked = W < 560
    let pile: Geo['pile']
    const A = folders[0], B = folders[1]
    if (!stacked) {
      pile = { x: W * 0.045, y: H * 0.09, w: W * 0.41, h: H * 0.82 }
      const fw = Math.min(W * 0.25, H * 0.5 * 1.3)
      A.w = fw; A.h = fw * 0.8; A.x = W * 0.5; B.w = fw * 0.62; B.h = B.w * 0.8; B.x = A.x + A.w + W * 0.035
      A.y = H * 0.7 - A.h; B.y = H * 0.7 - B.h
    } else {
      pile = { x: W * 0.05, y: H * 0.085, w: W * 0.9, h: H * 0.44 }
      A.w = W * 0.5; A.h = A.w * 0.72; A.x = W * 0.05; B.w = W * 0.31; B.h = B.w * 0.8; B.x = W * 0.64
      A.y = H * 0.915 - 26 - A.h; B.y = H * 0.915 - 26 - B.h
    }
    for (const f of folders) { f.tabH = f.h * 0.09; f.tabW = f.w * 0.36; f.front = f.h * 0.2; f.cx = f.x + f.w / 2 }
    const sw = clamp(Math.sqrt((pile.w * pile.h) / N * 0.78 / 1.3), 13, 30), sh = sw * 1.3
    const gateAt = stacked ? pile.y + pile.h + (A.y + A.tabH - sh - (pile.y + pile.h)) * 0.5 : pile.x + pile.w + (A.x - (pile.x + pile.w)) * 0.5
    geo = { W, H, stacked, pile, f: folders, gateAt, sw, sh }
    for (const s of sheets) { s.hx = pile.x + sw * 0.6 + s.u * (pile.w - sw * 1.2); s.hy = pile.y + sh * 0.6 + s.v * (pile.h - sh * 1.2) }
    cv.style.touchAction = stacked ? 'none' : 'pan-y'
    sideHidden = side.offsetWidth === 0
    makeSprites()
  }
  function makeSprites() {
    const { sw, sh } = geo
    const mk = (fill: string, edge: string, ink: string) => {
      const c = document.createElement('canvas'); c.width = Math.ceil((sw + 2) * dpr); c.height = Math.ceil((sh + 2) * dpr)
      const x = c.getContext('2d')!; x.scale(dpr, dpr); x.translate(1, 1)
      const r = Math.max(1.5, sw * 0.1), fold = sw * 0.3
      x.beginPath(); x.moveTo(r, 0); x.lineTo(sw - fold, 0); x.lineTo(sw, fold); x.lineTo(sw, sh - r); x.quadraticCurveTo(sw, sh, sw - r, sh); x.lineTo(r, sh); x.quadraticCurveTo(0, sh, 0, sh - r); x.lineTo(0, r); x.quadraticCurveTo(0, 0, r, 0); x.closePath()
      const gr = x.createLinearGradient(0, 0, sw, sh); gr.addColorStop(0, fill); gr.addColorStop(1, edge)
      x.fillStyle = gr; x.fill(); x.lineWidth = 0.8; x.strokeStyle = 'rgba(40,60,90,.42)'; x.stroke()
      x.beginPath(); x.moveTo(sw - fold, 0); x.lineTo(sw - fold, fold); x.lineTo(sw, fold); x.closePath(); x.fillStyle = 'rgba(40,70,110,.2)'; x.fill()
      x.strokeStyle = ink; x.lineWidth = Math.max(0.8, sw * 0.055); x.lineCap = 'round'
      for (let l = 0; l < 3; l++) { const yy = sh * (0.4 + l * 0.17); x.beginPath(); x.moveTo(sw * 0.17, yy); x.lineTo(sw * (l === 2 ? 0.52 : 0.82), yy); x.stroke() }
      return c
    }
    sprites = [mk('#fbfcff', '#e6ecf5', 'rgba(70,100,150,.38)'), mk('#d7ebff', '#9fcdf7', 'rgba(26,96,190,.62)'), mk('#e9e9e2', '#b9b8ad', 'rgba(104,98,80,.58)')]
  }

  // ------------------------------------------------------------------------------------------------ run state
  const run = { on: false, T: 0, apply: false, next: 0, undo: false, U: 0, ubuf: [] as Sheet[], unext: 0, step: -1, done: false }
  let held: Sheet | null = null, hover: Sheet | null = null
  let grabDX = 0, grabDY = 0, px = 0, py = 0, pvx = 0, pvy = 0, overF = -1
  const tiltS = { rx: spring(0, 90, 16), ry: spring(0, 90, 16) }
  let tiltTX = 0, tiltTY = 0, glx = 0.5, gly = 0.2, userMoved = false
  let beamX = -1, beamA = 0
  let gateA = 0, tipT = 0
  const landedLog: Sheet[] = []          // the manifest, in landing order

  const counts = () => ({ a: folders[0].stack.length, b: folders[1].stack.length })
  let lastShown = ''
  function syncDom() {
    const c = counts(), k = `${c.a}/${c.b}`
    if (k === lastShown) return
    lastShown = k
    nEl.a.textContent = String(c.a); nEl.b.textContent = String(c.b); nEl.loose.textContent = String(N - c.a - c.b)
    btnUndo.disabled = landedLog.length === 0 || run.undo
  }
  function setStep(i: number, text?: string) {
    run.step = i
    stepEls.forEach((e, k) => { e.classList.toggle('is-on', k === i); e.classList.toggle('is-past', k < i) })
    statusT.textContent = text ?? (i >= 0 ? STEPS[i].detail : 'Press Run to replay it, or drag a sheet to a folder.')
  }
  const say = (t: string) => { sr.textContent = t }

  function resetSheets(instant: boolean) {
    folders.forEach(f => { f.stack.length = 0; f.n = 0 })
    landedLog.length = 0
    held = null
    sheets.forEach((s, i) => {
      s.st = PILE; s.x = s.hx; s.y = s.hy; s.r = s.hr; s.vx = s.vy = s.vr = 0; s.z = 0; s.flash = 0; s.tint = 0; s.hopT = 0
      s.al = instant ? 1 : 0; s.alAt = instant ? 0 : rnd() * 0.45
    })
    lastShown = ''
  }
  function settleFinal() {
    resetSheets(true)
    for (const s of launchOrder) { dropIn(s, s.fate); s.tint = 1 }
    sheets.forEach(s => { const f = folders[s.folder]; const rk = f.stack.length - 1 - f.stack.indexOf(s); if (rk < VIS + 2) { const p = pose(f, rk, s, geo.sw, geo.sh); s.x = p.x; s.y = p.y; s.r = p.r } else { s.x = f.cx; s.y = f.y + f.h } })
    run.apply = false; run.on = false; run.done = true; run.undo = false
    setStep(4); syncDom(); btnUndo.disabled = false; setBtnLabel()
  }
  function dropIn(s: Sheet, folder: number) {   // land a sheet in a folder without flying (the instant paths)
    const f = folders[folder]; s.st = LANDED; s.folder = folder; s.z = 0; f.stack.push(s); landedLog.push(s)
  }
  function setBtnLabel() { btnRun.firstElementChild!.textContent = run.done || run.on ? 'Run again' : 'Run' }

  function start() {
    resetSheets(false)
    run.on = true; run.T = 0; run.apply = false; run.next = 0; run.undo = false; run.done = false
    gateA = 0; beamA = 1
    setStep(0); setBtnLabel(); btnUndo.disabled = true
    say('Run started: scan, classify, gate, apply, audit.')
    if (reduced) { settleFinal(); say(`Run finished: ${MOVED} moved, ${QUAR} quarantined.`); return }
    loop.wake()
  }
  function undoRun() {
    if (!landedLog.length || run.undo) return
    if (reduced) { resetSheets(true); run.done = false; run.on = false; setStep(-1); syncDom(); btnUndo.disabled = true; setBtnLabel(); say('Undone: all files are back where they were.'); return }
    run.undo = true; run.U = 0; run.unext = 0; run.on = false; run.apply = false
    for (const s of sheets) if (s.st === FLY || s.st === HOP) sendBack(s)      // what is still in the air turns round first
    run.ubuf = landedLog.slice().reverse()                       // last in, first out
    setStep(-1, 'Undo replays the log backwards: the last move is reversed first.')
    stepEls.forEach(e => e.classList.remove('is-on', 'is-past'))
    btnUndo.disabled = true; say('Undo: replaying the log backwards.')
    loop.wake()
  }
  function sendOne() {
    // keyboard path: the top-most loose sheet goes to its folder
    for (let i = zorder.length - 1; i >= 0; i--) { const s = zorder[i]; if (s.st === PILE) { launch(s); break } }
    loop.wake()
  }

  function launch(s: Sheet) {
    const f = folders[s.fate]
    if (reduced) { dropIn(s, s.fate); const rk = 0; const p = pose(f, rk, s, geo.sw, geo.sh); s.x = p.x; s.y = p.y; s.r = p.r; s.tint = 1; cue('evidence:flip'); syncDom(); return }
    const p = pose(f, 0, s, geo.sw, geo.sh)
    s.st = FLY; s.folder = s.fate; s.tx = p.x; s.ty = p.y; s.tr = p.r
    s.d0 = Math.hypot(p.x - s.x, p.y - s.y) + 1
    s.k = 52 + rnd() * 26; s.zmax = clamp(s.d0 * 0.2, 16, 64); s.born = performance.now()
    s.vx = (p.x - s.x) * 0.25 + (rnd() - 0.5) * 60; s.vy = -(80 + rnd() * 90); s.vr = (rnd() - 0.5) * 9
    if (s.tint < 1) s.tint = Math.max(s.tint, 0.001)
    s.tintAt = 0
  }
  function land(s: Sheet) {
    const f = folders[s.folder]
    s.st = LANDED; s.z = 0; f.stack.push(s); landedLog.push(s)
    f.sq.v -= 1.1; f.glow.v += 1.5
    s.tint = 1
    cue('evidence:flip')
    syncDom()
  }
  function sendBack(s: Sheet) {
    s.st = BACK; s.tx = s.hx; s.ty = s.hy; s.tr = s.hr
    s.d0 = Math.hypot(s.hx - s.x, s.hy - s.y) + 1; s.k = 60 + rnd() * 25; s.zmax = clamp(s.d0 * 0.16, 10, 46); s.born = performance.now()
    s.vy -= 40
  }

  // ------------------------------------------------------------------------------------------------ pointer
  const local = (e: PointerEvent) => {
    if (e.target === cv && Number.isFinite(e.offsetX)) return { x: e.offsetX, y: e.offsetY }
    const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * geo.W, y: ((e.clientY - r.top) / Math.max(1, r.height)) * geo.H }
  }
  function hit(x: number, y: number): Sheet | null {
    const { sw, sh } = geo
    for (let i = zorder.length - 1; i >= 0; i--) {
      const s = zorder[i]; if (s.st !== PILE || s.al < 0.5) continue
      const dx = x - s.x, dy = y - s.y + s.z, c = Math.cos(-s.r), n = Math.sin(-s.r)
      const lx = dx * c - dy * n, ly = dx * n + dy * c
      if (Math.abs(lx) <= sw * 0.58 && Math.abs(ly) <= sh * 0.58) return s
    }
    return null
  }
  const folderAt = (x: number, y: number) => {
    const { sh } = geo
    for (let i = 0; i < 2; i++) { const f = folders[i]; if (x > f.x - 10 && x < f.x + f.w + 10 && y > f.y - sh * 0.9 && y < f.y + f.h + 12) return i }
    return -1
  }
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    const p = local(e), s = hit(p.x, p.y)
    if (!s) return
    held = s; s.st = HELD; grabDX = s.x - p.x; grabDY = s.y - p.y; px = p.x; py = p.y; pvx = pvy = 0; overF = -1
    s.vx = s.vy = 0; s.born = performance.now()
    zorder.splice(zorder.indexOf(s), 1); zorder.push(s)          // a grabbed sheet goes on top of the heap
    try { cv.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    cv.style.cursor = 'grabbing'; tiltTX = tiltTY = 0
    e.preventDefault(); loop.wake()
  })
  cv.addEventListener('pointermove', e => {
    const p = local(e)
    if (held) { pvx = p.x - px; pvy = p.y - py; px = p.x; py = p.y; overF = folderAt(px + grabDX * 0, py + grabDY * 0); loop.wake(); return }
    const h = hit(p.x, p.y)
    if (h !== hover) { hover = h; cv.style.cursor = h ? 'grab' : 'default'; loop.wake() }
  })
  const release = (e: PointerEvent) => {
    const s = held; if (!s) return
    held = null; cv.style.cursor = hover ? 'grab' : 'default'
    try { cv.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    const into = overF; overF = -1
    if (into < 0) { reduced ? snapHome(s) : sendBack(s); loop.wake(); return }
    if (into === s.fate) { launch(s); loop.wake(); return }
    // dropped on the wrong folder: it settles at that folder's mouth, the gate says no, and it goes where the script files it
    if (reduced) { launch(s); showTip(into, `The script files this one under ${FOLDER_NAME[s.fate]}.`); return }
    const f = folders[into], p = pose(f, 0, s, geo.sw, geo.sh)
    s.st = HOP; s.hopTo = into; s.tx = p.x; s.ty = p.y - geo.sh * 0.2; s.tr = p.r; s.k = 90; s.d0 = Math.hypot(s.tx - s.x, s.ty - s.y) + 1; s.zmax = 22; s.hopT = 0; s.born = performance.now()
    loop.wake()
  }
  const snapHome = (s: Sheet) => { s.st = PILE; s.x = s.hx; s.y = s.hy; s.r = s.hr; s.z = 0 }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release)
  cv.addEventListener('pointerleave', () => { if (!held && hover) { hover = null; loop.wake() } })
  function showTip(fi: number, text: string) {
    const f = folders[fi]; tip.textContent = text; tip.hidden = false
    tip.style.left = `${clamp(f.cx, 90, geo.W - 90)}px`; tip.style.top = `${Math.max(8, f.y - geo.sh * 1.15)}px`
    tipT = 1.8
  }

  // window tilt: a few degrees toward the pointer, with a glare that follows it
  const onTiltMove = (e: PointerEvent) => {
    if (held || reduced) return
    const r = tilt.getBoundingClientRect(), nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
    tiltTY = nx * 4.6; tiltTX = -ny * 3.2; glx = (nx + 1) / 2; gly = (ny + 1) / 2; userMoved = true; loop.wake()
  }
  const onTiltLeave = () => { tiltTX = tiltTY = 0; glx = 0.5; gly = 0.2; loop.wake() }
  tilt.addEventListener('pointermove', onTiltMove); tilt.addEventListener('pointerleave', onTiltLeave)

  btnRun.addEventListener('click', () => start())
  btnOne.addEventListener('click', () => sendOne())
  btnUndo.addEventListener('click', () => undoRun())

  // ------------------------------------------------------------------------------------------------ step
  const SPD = (s: Sheet) => Math.hypot(s.vx, s.vy)
  function fly(s: Sheet, dt: number, kind: number) {
    if (kind === FLY) { const p = pose(folders[s.folder], 0, s, geo.sw, geo.sh); s.tx = p.x; s.ty = p.y; s.tr = p.r }
    // damped spring toward the target pose; the height is a parabola in the progress, so the sheet lobs and lands
    const c = 2 * 0.7 * Math.sqrt(s.k)
    const ax = s.k * (s.tx - s.x) - c * s.vx, ay = s.k * (s.ty - s.y) - c * s.vy, ar = 130 * (s.tr - s.r) - 15 * s.vr
    s.vx += ax * dt; s.vy += ay * dt; s.vr += ar * dt
    s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt
    const d = Math.hypot(s.tx - s.x, s.ty - s.y), u = clamp(1 - d / s.d0, 0, 1)
    s.z = s.zmax * 4 * u * (1 - u)
    const age = (performance.now() - s.born) / 1000
    if ((d < 2.2 && SPD(s) < 60) || age > 1.7) {
      s.x = s.tx; s.y = s.ty; s.r = s.tr; s.vx = s.vy = s.vr = 0
      if (kind === FLY) land(s)
      else if (kind === BACK) { s.st = PILE; s.z = 0; s.tint = 0; syncDom() }
      else { s.hopT = 0; s.vx = s.vy = 0; s.st = HOP; s.hopT = 0.0001; hopLand(s) }
    }
  }
  function hopLand(s: Sheet) {
    s.z = 0
    showTip(s.hopTo, `The script files this one under ${FOLDER_NAME[s.fate]}.`)
    cueArb('lab:arb', { on: true })
    folders[s.hopTo].glow.v += 5
  }

  function step(dt: number, now: number): boolean {
    let busy = false
    const { sw, sh, pile } = geo
    // ---- the run clock
    if (run.on) {
      busy = true; run.T += dt
      const T = run.T
      const ph = T < T_CLASSIFY ? 0 : T < T_GATE ? 1 : T < T_APPLY ? 2 : 3
      if (ph !== run.step && ph <= 3 && !(run.step === 3 && ph === 3)) { if (ph > run.step) setStep(ph) }
      beamX = lerp(pile.x - 8, pile.x + pile.w + 8, clamp(T / T_CLASSIFY, 0, 1)); beamA = T < T_CLASSIFY ? 1 : Math.max(0, beamA - dt * 4)
      if (T >= T_GATE) gateA = Math.min(1, gateA + dt * 4)
      if (T >= T_APPLY) {
        run.apply = true
        const t = T - T_APPLY
        while (run.next < launchOrder.length && run.next * (APPLY_SPAN / N) <= t) { const s = launchOrder[run.next++]; if (s.st === PILE) launch(s) }
        if (run.next >= launchOrder.length && !held) for (const s of launchOrder) if (s.st === PILE) launch(s)      // a sheet you dropped back on the heap goes too
        if (run.next >= launchOrder.length && sheets.every(s => s.st === LANDED)) {
          run.on = false; run.done = true; run.apply = false; setStep(4); setBtnLabel(); btnUndo.disabled = false
          say(`Run finished: ${MOVED} moved, ${QUAR} quarantined. Undo replays the log backwards.`)
        }
      }
    } else if (!run.undo) { beamA = Math.max(0, beamA - dt * 4); gateA = Math.max(0, gateA - dt * (run.done ? 1.2 : 3)) }
    // ---- undo clock
    if (run.undo) {
      busy = true; run.U += dt
      while (run.unext < run.ubuf.length && run.unext * (UNDO_SPAN / run.ubuf.length) <= run.U) {
        const s = run.ubuf[run.unext++]
        const f = folders[s.folder]; const ix = f.stack.indexOf(s); if (ix >= 0) f.stack.splice(ix, 1)
        const lx = landedLog.indexOf(s); if (lx >= 0) landedLog.splice(lx, 1)
        sendBack(s); s.tint = Math.min(s.tint, 0.99); syncDom()
        cue('evidence:flip')
      }
      if (run.unext >= run.ubuf.length && sheets.every(s => s.st === PILE)) {
        run.undo = false; run.done = false; setStep(-1); setBtnLabel(); btnUndo.disabled = true
        say('Undone: every file is back where it was.'); cueArb('lab:arb', { on: false })
      }
    }
    // ---- sheets
    for (const s of sheets) {
      if (s.al < 1) { busy = true; if (s.alAt > 0) s.alAt -= dt; else s.al = Math.min(1, s.al + dt * 4) }
      if (s.flash > 0) { s.flash = Math.max(0, s.flash - dt * 3); busy = true }
      // classify: tint rises once the beam has passed; flash as the scan beam crosses
      if (run.on && run.step <= 2 && s.st === PILE) {
        if (run.T < T_CLASSIFY && s.flash < 0.2 && beamX > s.x && beamX - s.x < 16 + sw && s.tint === 0) s.flash = 1
        if (run.T > s.tintAt && s.tint < 1) s.tint = Math.min(1, s.tint + dt * 5)
      }
      switch (s.st) {
        case FLY: case BACK: fly(s, dt, s.st); busy = true; if (s.st === FLY && s.x > geo.gateAt - 3 && s.x < geo.gateAt + 6 && !geo.stacked && s.flash < 0.3) s.flash = 0.7; break
        case HOP:
          if (s.hopT > 0) { s.hopT += dt; busy = true; s.z = 0; if (s.hopT > 0.62) { const f = folders[s.fate]; const p = pose(f, 0, s, sw, sh); s.st = FLY; s.folder = s.fate; s.tx = p.x; s.ty = p.y; s.tr = p.r; s.d0 = Math.hypot(p.x - s.x, p.y - s.y) + 1; s.k = 80; s.zmax = clamp(s.d0 * 0.3, 16, 50); s.born = performance.now(); s.vy = -160; s.hopT = 0 } }
          else { fly(s, dt, HOP); busy = true }
          break
        case HELD: {
          busy = true
          const k = 520, c = 36
          s.vx += (k * (px + grabDX - s.x) - c * s.vx) * dt; s.vy += (k * (py + grabDY - s.y) - c * s.vy) * dt
          s.x += s.vx * dt; s.y += s.vy * dt
          const tr = clamp(s.vx * 0.0011, -0.45, 0.45) + s.hr * 0.25
          s.vr += (140 * (tr - s.r) - 16 * s.vr) * dt; s.r += s.vr * dt
          s.z += (16 - s.z) * Math.min(1, dt * 14)
          break
        }
        case PILE:
          if (s === hover && !held) { s.z += (5 - s.z) * Math.min(1, dt * 16); if (Math.abs(5 - s.z) > 0.05) busy = true }
          else if (s.z > 0.02) { s.z *= 1 - Math.min(1, dt * 14); busy = true } else s.z = 0
          break
      }
    }
    // resting sheets in each folder: spring to their rank pose
    for (let fi = 0; fi < 2; fi++) {
      const f = folders[fi], n = f.stack.length
      for (let rk = 0; rk < Math.min(n, VIS + 2); rk++) {
        const s = f.stack[n - 1 - rk]; if (s.st !== LANDED) continue
        const p = pose(f, rk, s, sw, sh)
        const dx = p.x - s.x, dy = p.y - s.y, dr = p.r - s.r
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dr) * 10 + Math.abs(s.vx) + Math.abs(s.vy) < 0.02) { s.x = p.x; s.y = p.y; s.r = p.r; s.vx = s.vy = s.vr = 0; continue }
        busy = true
        s.vx += (170 * dx - 24 * s.vx) * dt; s.vy += (170 * dy - 24 * s.vy) * dt; s.vr += (150 * dr - 17 * s.vr) * dt
        s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt
      }
      // hover glow while a held sheet is over it; the mouth opens when sheets are about to land
      let near = 0
      for (const s of sheets) if ((s.st === FLY || s.st === HOP) && (s.st === FLY ? s.folder : s.hopTo) === fi && Math.hypot(s.tx - s.x, s.ty - s.y) < 150) { near = 1; break }
      stepSpring(f.open, near || overF === fi ? 1 : 0, dt); stepSpring(f.glow, overF === fi ? 1 : 0, dt); stepSpring(f.sq, 0, dt)
      if (Math.abs(f.open.x - (near ? 1 : 0)) > 0.01 || Math.abs(f.sq.x) > 0.002 || Math.abs(f.sq.v) > 0.05 || Math.abs(f.glow.x - (overF === fi ? 1 : 0)) > 0.01) busy = true
    }
    if (tipT > 0) { tipT -= dt; busy = true; if (tipT <= 0) tip.hidden = true }
    // window tilt (a little idle sway until the pointer has been over it)
    const sway = !reduced && !userMoved && !sitePaused() ? Math.sin(now * 0.6) * 1.3 : 0
    stepSpring(tiltS.rx, tiltTX, dt); stepSpring(tiltS.ry, tiltTY + sway, dt)
    if (Math.abs(tiltS.rx.x - tiltTX) > 0.02 || Math.abs(tiltS.ry.x - tiltTY - sway) > 0.02 || Math.abs(tiltS.ry.v) > 0.05) busy = true
    win.style.transform = `perspective(1300px) rotateX(${tiltS.rx.x.toFixed(2)}deg) rotateY(${tiltS.ry.x.toFixed(2)}deg)`
    win.style.setProperty('--gx', `${(glx * 100).toFixed(1)}%`); win.style.setProperty('--gy', `${(gly * 100).toFixed(1)}%`)
    if (held) busy = true
    draw()
    return busy || (!reduced && !userMoved && !sitePaused())
  }

  // ------------------------------------------------------------------------------------------------ draw
  const css = getComputedStyle(root)
  const FONT = `500 11px ${css.getPropertyValue('--fo-mono') || 'ui-monospace, Menlo, monospace'}`
  function folderPath(f: Folder, ctx: CanvasRenderingContext2D) {
    const x = f.x, y = f.y, w = f.w, h = f.h, tw = f.tabW, th = f.tabH, r = Math.min(8, w * 0.05)
    ctx.beginPath(); ctx.moveTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + tw, y); ctx.lineTo(x + tw + th * 1.1, y + th); ctx.lineTo(x + w - r, y + th); ctx.quadraticCurveTo(x + w, y + th, x + w, y + th + r)
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.closePath()
  }
  const PAL = [{ back: '#3a86dc', top: '#9fd6ff', bot: '#4f9bef', glow: '120,190,255', lab: '#cfe6ff' }, { back: '#7b93ae', top: '#dbe6f2', bot: '#9db3cb', glow: '190,205,225', lab: '#dfe6ee' }]
  function drawSheet(s: Sheet) {
    const { sw, sh } = geo
    if (s.al <= 0.01) return
    const z = s.z, sc = 1 + z / 115
    // shadow: contact shadow at rest, a longer softer one in the air
    g.save(); g.translate(s.x + z * 0.3, s.y + 0.9 + z * 0.55); g.rotate(s.r); g.scale(sc * 0.98, sc * 0.98)
    g.globalAlpha = (0.3 / (1 + z / 26)) * s.al; g.fillStyle = '#02060c'; g.beginPath(); g.roundRect(-sw / 2, -sh / 2, sw, sh, 2); g.fill(); g.restore()
    g.save(); g.translate(s.x, s.y - z); g.rotate(s.r); g.scale(sc, sc); g.globalAlpha = s.al
    g.drawImage(sprites[0], -sw / 2 - 1, -sh / 2 - 1, sw + 2, sh + 2)
    if (s.tint > 0.002) { g.globalAlpha = s.al * clamp(s.tint, 0, 1); g.drawImage(sprites[s.fate + 1], -sw / 2 - 1, -sh / 2 - 1, sw + 2, sh + 2) }
    if (s.flash > 0.01) { g.globalAlpha = s.flash * 0.7; g.fillStyle = '#9fd6ff'; g.beginPath(); g.roundRect(-sw / 2, -sh / 2, sw, sh, 2); g.fill() }
    if (s.st === HELD) { g.globalAlpha = 0.9; g.strokeStyle = '#8fd0ff'; g.lineWidth = 1.4; g.beginPath(); g.roundRect(-sw / 2 - 1.5, -sh / 2 - 1.5, sw + 3, sh + 3, 3); g.stroke() }
    g.restore()
  }
  function drawFolderBack(f: Folder, i: number) {
    const pal = PAL[i]
    // soft floor shadow
    g.save(); g.translate(f.cx, f.y + f.h + 3); g.scale(1, 0.14); const sg = g.createRadialGradient(0, 0, 0, 0, 0, f.w * 0.6); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.beginPath(); g.arc(0, 0, f.w * 0.6, 0, TAU); g.fill(); g.restore()
    if (f.glow.x > 0.02) { g.save(); g.shadowColor = `rgba(${pal.glow},${0.9 * clamp(f.glow.x, 0, 1)})`; g.shadowBlur = 26; folderPath(f, g); g.fillStyle = pal.back; g.fill(); g.restore() }
    folderPath(f, g); g.fillStyle = pal.back; g.fill()
    g.save(); folderPath(f, g); g.clip()
    const hl = g.createLinearGradient(0, f.y, 0, f.y + f.h); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(0.3, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(f.x, f.y, f.w, f.h)
    // the dark inside, behind the sheets
    g.fillStyle = 'rgba(8,24,52,.28)'; g.fillRect(f.x, f.y + f.tabH, f.w, f.front + 8)
    g.restore()
  }
  function drawFolderFront(f: Folder, i: number) {
    const pal = PAL[i], o = clamp(f.open.x, 0, 1.2), sq = clamp(f.sq.x, -0.6, 0.6)
    const top = f.y + f.tabH + f.front + o * 5, bot = f.y + f.h
    const spread = f.w * 0.03 * o
    g.save()
    // the front leaf hinges at its bottom edge: opening pulls its top edge toward the viewer (lower and a little wider); a landing squashes it
    g.translate(f.cx, bot); g.scale(1 + sq * -0.025, 1 + sq * 0.5 * 0.16); g.translate(-f.cx, -bot)
    const r = Math.min(8, f.w * 0.05)
    g.beginPath(); g.moveTo(f.x - spread, top + r); g.quadraticCurveTo(f.x - spread, top, f.x - spread + r, top); g.lineTo(f.x + f.w + spread - r, top); g.quadraticCurveTo(f.x + f.w + spread, top, f.x + f.w + spread, top + r)
    g.lineTo(f.x + f.w, bot - r); g.quadraticCurveTo(f.x + f.w, bot, f.x + f.w - r, bot); g.lineTo(f.x + r, bot); g.quadraticCurveTo(f.x, bot, f.x, bot - r); g.closePath()
    const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, pal.top); gr.addColorStop(1, pal.bot)
    g.fillStyle = gr; g.fill()
    g.strokeStyle = 'rgba(255,255,255,.72)'; g.lineWidth = 1; g.beginPath(); g.moveTo(f.x - spread + r, top + 0.7); g.lineTo(f.x + f.w + spread - r, top + 0.7); g.stroke()
    g.restore()
    // label and live count under the folder
    const n = f.stack.length
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'
    g.fillStyle = pal.lab; g.font = `600 ${Math.round(clamp(f.w * 0.15, 15, 24))}px ${css.getPropertyValue('--fo-sans') || 'system-ui, sans-serif'}`
    g.fillText(String(n), f.cx - f.w * 0.0, bot + Math.round(clamp(f.w * 0.15, 15, 24)) + 6)
    g.fillStyle = 'rgba(214,226,240,.72)'; g.font = FONT
    g.fillText(FOLDER_NAME[i].toUpperCase(), f.cx, bot + Math.round(clamp(f.w * 0.15, 15, 24)) + 22)
  }

  function draw() {
    const { W, H, pile, sw, sh } = geo
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    // the pile's desk: a faint inset so the heap reads as "Downloads and Desktop"
    g.save(); g.beginPath(); g.roundRect(pile.x - 8, pile.y - 8, pile.w + 16, pile.h + 16, 14); g.fillStyle = 'rgba(255,255,255,.035)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.setLineDash([5, 6]); g.lineWidth = 1; g.stroke(); g.restore()
    g.save(); g.fillStyle = 'rgba(214,226,240,.5)'; g.font = FONT; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    const loose = N - folders[0].stack.length - folders[1].stack.length
    g.fillText(sideHidden ? `LOOSE FILES  ${loose}` : 'LOOSE FILES', pile.x - 2, pile.y - 14 > 10 ? pile.y - 14 : pile.y + pile.h + 24); g.restore()
    // the gate between the pile and the folders
    if (gateA > 0.01) {
      g.save(); g.globalAlpha = gateA; const gx = geo.gateAt
      const lg = geo.stacked ? g.createLinearGradient(pile.x, 0, pile.x + pile.w, 0) : g.createLinearGradient(0, pile.y, 0, pile.y + pile.h)
      lg.addColorStop(0, 'rgba(120,190,255,0)'); lg.addColorStop(0.5, 'rgba(160,215,255,.95)'); lg.addColorStop(1, 'rgba(120,190,255,0)')
      g.strokeStyle = lg; g.lineWidth = 1.6; g.beginPath()
      if (geo.stacked) { g.moveTo(pile.x, gx); g.lineTo(pile.x + pile.w, gx) } else { g.moveTo(gx, pile.y); g.lineTo(gx, pile.y + pile.h) }
      g.stroke()
      g.fillStyle = 'rgba(190,225,255,.9)'; g.font = FONT; g.textAlign = 'center'
      if (geo.stacked) g.fillText(`GATE ${GATES}`, pile.x + pile.w / 2, gx - 6)
      else { g.translate(gx - 7, pile.y + pile.h / 2); g.rotate(-Math.PI / 2); g.fillText(`GATE ${GATES}`, 0, 0) }
      g.restore()
    }
    // pile sheets (and any sheet not in flight or held), bottom to top
    for (const s of zorder) if (s.st === PILE || s.st === BACK) drawSheet(s)
    // scan beam
    if (beamA > 0.02) {
      g.save(); g.globalAlpha = beamA; const bx = beamX
      const bg = g.createLinearGradient(bx - 26, 0, bx + 2, 0); bg.addColorStop(0, 'rgba(110,190,255,0)'); bg.addColorStop(1, 'rgba(150,215,255,.5)')
      g.fillStyle = bg; g.fillRect(bx - 26, pile.y - 8, 28, pile.h + 16)
      g.fillStyle = 'rgba(210,238,255,.95)'; g.fillRect(bx, pile.y - 8, 1.5, pile.h + 16); g.restore()
    }
    // folders: back, resting sheets, in-flight sheets that are entering, front
    for (let i = 0; i < 2; i++) {
      const f = folders[i]; drawFolderBack(f, i)
      const n = f.stack.length
      for (let rk = Math.min(n, VIS + 2) - 1; rk >= 0; rk--) drawSheet(f.stack[n - 1 - rk])
      for (const s of sheets) if ((s.st === FLY ? s.folder : s.st === HOP ? s.hopTo : -1) === i && s.x > f.x - 6 && s.x < f.x + f.w + 6 && s.y - s.z < f.y + f.tabH + f.front - sh * 0.1 && Math.hypot(s.tx - s.x, s.ty - s.y) < 80) drawSheet(s)
      drawFolderFront(f, i)
    }
    // sheets in the air, and the one in your hand, over everything
    for (const s of sheets) {
      if (s.st === FLY || s.st === HOP) {
        const fi = s.st === FLY ? s.folder : s.hopTo, f = folders[fi]
        const entering = s.x > f.x - 6 && s.x < f.x + f.w + 6 && s.y - s.z < f.y + f.tabH + f.front - sh * 0.1 && Math.hypot(s.tx - s.x, s.ty - s.y) < 80
        if (!entering) drawSheet(s)
      }
    }
    if (held) drawSheet(held)
    void sw
  }

  // ------------------------------------------------------------------------------------------------ boot
  const loop = frameLoop(host, step)
  const fit = fitCanvas(cv, (w, h, d) => { dpr = d; layout(w, h); if (!run.on && !run.undo && !held) { for (const s of sheets) if (s.st === PILE) { s.x = s.hx; s.y = s.hy; s.r = s.hr } } ; if (reduced && run.done) settleFinal(); draw(); loop.wake() })
  resetSheets(true)
  sheets.forEach(s => { s.x = s.hx; s.y = s.hy; s.r = s.hr })
  setStep(-1)
  if (reduced) settleFinal()
  else if (!sitePaused()) onFirstView(host, () => { if (!run.on && !run.done && !held) start() }, 0.4)
  else say('Press Run to replay the Sunday run.')
  draw(); loop.wake()

  return {
    dispose() {
      loop.dispose(); fit.dispose()
      tilt.removeEventListener('pointermove', onTiltMove); tilt.removeEventListener('pointerleave', onTiltLeave)
      host.innerHTML = ''
    },
  }
}
