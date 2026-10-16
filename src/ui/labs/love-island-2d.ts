// The original Love Island lab (restored 2026-10-14 at Joseph's request): the 2D phase plane where you move the sliders and watch
// the couple settle, swing or run away. love-island.ts mounts it first, above the full villa demo.
// Love Island lab: the couple model's phase portrait. Two coupled differential equations, one for each partner's affection; drag the
// start point, move the six parameters, and press a public-vote shock to kick the appeal term mid-run. Model only: the parameters are
// illustrative (as the paper's own limitations say) and nothing here describes any season or any real couple.
// Ported from ~/PORTFOLIO/src/components/LoveModel.tsx (eqs. 1-2), extended with the 2D phase plane, fixed points and the vote shock.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:drag { param: 'start', value 0..1 } while the start point moves.
import './lib/model-base.css'
import './love-island-2d.css'
import { animate } from 'animejs'
import { CAP, DEFAULTS, TAU, appeal, field, fixedPoints, rk4, trajectory, type Params, type Shock } from './lib/model-ode'
import { clamp, fitCanvas, frameLoop, gate, sitePaused, type LabHandle, type LabOpts } from './lib/kit'

const V0 = -0.5, V1 = 4.5
const SL: { k: keyof Params; n: string; min: number; max: number; step: number }[] = [
  { k: 'aA', n: 'Partner A forgets', min: 0.2, max: 1.2, step: 0.01 }, { k: 'aB', n: 'Partner B forgets', min: 0.2, max: 1.2, step: 0.01 },
  { k: 'bA', n: 'A responds to B', min: 0, max: 0.9, step: 0.01 }, { k: 'bB', n: 'B responds to A', min: 0, max: 0.9, step: 0.01 },
  { k: 'g', n: 'Appeal of each to the other', min: 0.1, max: 1, step: 0.01 }, { k: 'd', n: 'Synergy (affection feeds on itself)', min: 0, max: 0.5, step: 0.01 },
]
const PRESETS: [string, Params][] = [
  ['Settles', { ...DEFAULTS }],
  ['Fragile', { aA: 0.6, aB: 0.5, bA: 0.25, bB: 0.3, g: 0.5, d: 0.12 }],
  ['Over-responsive', { aA: 0.45, aB: 0.45, bA: 0.7, bB: 0.7, g: 0.5, d: 0 }],
]

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 90)
  host.innerHTML = ''
  const root = document.createElement('div'); root.className = 'ml li' + (reduced ? ' is-reduced' : ''); root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Model only</span></span><h3 class="ml-title">Two partners, one phase plane</h3></div>
    <p class="ml-note" role="note">Drag the start point, then move a slider or press a public vote. The path is the couple's affection over time. Parameters are illustrative, not fitted to any season.</p>
  </header>
  <div class="ml-cols">
    <div>
      <section class="ml-p li-plane" aria-label="Phase portrait">
        <div class="li-cv"><canvas class="li-phase" aria-hidden="true"></canvas><button class="li-handle" type="button" aria-label="Start point. Arrow keys move it." ></button><span class="li-ax li-ax--x">Partner A affection</span><span class="li-ax li-ax--y">Partner B</span></div>
      </section>
      <section class="ml-p" aria-label="Affection over time"><span class="ml-lab">Affection over time <b class="li-lg li-lg--a">A</b> <b class="li-lg li-lg--b">B</b></span><canvas class="li-ts" aria-hidden="true"></canvas></section>
    </div>
    <div>
      <section class="ml-p" aria-label="Verdict" aria-live="polite">
        <span class="ml-lab">What the equations say</span>
        <div class="li-verdict"></div><p class="ml-small li-detail"></p>
      </section>
      <section class="ml-p" aria-label="Public vote">
        <span class="ml-lab">Public vote shock</span>
        <div class="ml-row"><button class="ml-btn ml-btn--acc" data-act="up" type="button">Vote for them</button><button class="ml-btn" data-act="down" type="button">Vote against</button><button class="ml-btn" data-act="restart" type="button">Restart run</button></div>
        <p class="ml-small" style="margin-top:8px">A vote adds a pulse to the appeal term that fades over a few days. Appeal now: <b class="li-appeal ml-mono"></b></p>
      </section>
      <section class="ml-p" aria-label="Parameters">
        <span class="ml-lab">Parameters</span>
        <div class="ml-row li-presets" role="group" aria-label="Presets" style="margin-bottom:12px"></div>
        <div class="li-sliders"></div>
      </section>
    </div>
  </div>`
  host.appendChild(root)
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T
  const cvP = $('.li-phase') as unknown as HTMLCanvasElement, cvT = $('.li-ts') as unknown as HTMLCanvasElement, handle = $('.li-handle'), box = $('.li-cv')
  const css = getComputedStyle(root)
  const acc = () => css.getPropertyValue('--ml-acc').trim() || '#ff6a4d'

  const p: Params = { ...DEFAULTS }
  const start = { A: 3.6, B: 0.4 }
  let shocks: Shock[] = [], t = 0, A = start.A, B = start.B, trail: [number, number][] = [[A, B]], series: [number, number, number][] = [[0, A, B]], away = false, fp = fixedPoints(p)
  let ghosts: [number, number][][] = [], W = 0, H = 0, w2 = 0, h2 = 0, pulse = 0

  // sliders + presets
  const slEl = $('.li-sliders'); const outs: Record<string, HTMLOutputElement> = {}, ins: Record<string, HTMLInputElement> = {}
  for (const s of SL) {
    const l = document.createElement('label'); l.className = 'ml-sl'
    l.innerHTML = `<span>${s.n}</span><output></output><input type="range" min="${s.min}" max="${s.max}" step="${s.step}">`
    slEl.appendChild(l); outs[s.k] = l.querySelector('output')!; ins[s.k] = l.querySelector('input')!
    ins[s.k].addEventListener('input', () => { p[s.k] = +ins[s.k].value; paramsChanged() })
  }
  const preEl = $('.li-presets'); PRESETS.forEach(([n], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ml-chip'; b.textContent = n; b.dataset.k = String(i); preEl.appendChild(b) })
  const syncControls = () => {
    for (const s of SL) { ins[s.k].value = String(p[s.k]); outs[s.k].textContent = p[s.k].toFixed(2) }
    ;[...preEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(SL.every(s => Math.abs(PRESETS[i][1][s.k] - p[s.k]) < 0.005))))
  }

  // geometry
  const sx = (a: number) => ((a - V0) / (V1 - V0)) * w2, sy = (b: number) => h2 - ((b - V0) / (V1 - V0)) * h2
  const ux = (px: number) => V0 + (px / w2) * (V1 - V0), uy = (py: number) => V0 + ((h2 - py) / h2) * (V1 - V0)
  const fitP = fitCanvas(cvP, (w, h) => { w2 = w; h2 = h; placeHandle(); draw() })
  const fitT = fitCanvas(cvT, (w, h) => { W = w; H = h; draw() })
  function placeHandle() { handle.style.transform = `translate(${sx(start.A).toFixed(1)}px, ${sy(start.B).toFixed(1)}px)` }

  // ---- run control
  function restart(keepShocks = false) {
    if (!keepShocks) shocks = []
    t = 0; A = start.A; B = start.B; trail = [[A, B]]; series = [[0, A, B]]; away = false
    if (reduced) { for (let i = 0; i < 400; i++) advance(0.1) }
    paintReadouts(); draw(); loop.wake()
  }
  function advance(dt: number) {
    if (away) return
    ;[A, B] = rk4(p, shocks, t, A, B, dt); t += dt
    if (!(Math.abs(A) < CAP && Math.abs(B) < CAP)) { away = true; A = clamp(A, -CAP, CAP); B = clamp(B, -CAP, CAP) }
    trail.push([A, B]); series.push([t, A, B]); if (trail.length > 900) trail.shift(); if (series.length > 900) series.shift()
  }
  function paramsChanged() {
    fp = fixedPoints(p); ghosts = []
    for (const a of [-0.2, 1.6, 3.2, 4.4]) for (const b of [-0.2, 4.2]) ghosts.push(trajectory(p, a, b))
    for (const b of [1.2, 2.8]) { ghosts.push(trajectory(p, -0.2, b)); ghosts.push(trajectory(p, 4.4, b)) }
    away = false; syncControls(); paintReadouts()
    if (reduced) restart(true); else { draw(); loop.wake() }
  }
  function paintReadouts() {
    const stable = fp.filter(f => f.stable), v = $('.li-verdict'), d = $('.li-detail')
    const cls = away ? 'is-bad' : stable.length ? 'is-good' : 'is-warn'
    v.className = 'li-verdict ' + cls
    v.textContent = away ? 'Runs away' : stable.length ? 'Settles' : 'No resting state'
    const s0 = stable[0]
    d.innerHTML = away ? 'The path left the plane: with synergy on, a start past the open ring grows without limit.' :
      s0 ? `It heads for a resting state near (${s0.A.toFixed(2)}, ${s0.B.toFixed(2)}). At that point the trace is ${s0.tr.toFixed(2)} (negative) and the determinant is ${s0.det.toFixed(2)} (positive), so small swings die out.${fp.length > 1 ? ' The open ring is a tipping point: start beyond it and the couple runs away.' : ''}` :
      `No stable resting state exists for these values: responding to each other outweighs forgetting, so affection keeps growing.`
    ;($('.li-appeal') as HTMLElement).textContent = appeal(t, shocks).toFixed(2)
  }

  // ---- drawing
  function draw() {
    if (!w2) return
    const c = cvP.getContext('2d')!, dpr = cvP.width / w2; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w2, h2)
    const A_ = acc()
    // grid + axes
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.07)'
    for (let g = 0; g <= 4; g++) { c.beginPath(); c.moveTo(sx(g), 0); c.lineTo(sx(g), h2); c.moveTo(0, sy(g)); c.lineTo(w2, sy(g)); c.stroke() }
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.moveTo(sx(0), 0); c.lineTo(sx(0), h2); c.moveTo(0, sy(0)); c.lineTo(w2, sy(0)); c.stroke()
    // flow field
    c.strokeStyle = 'rgba(241,237,226,0.22)'; c.lineWidth = 1.2; c.lineCap = 'round'
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const a = V0 + (i + 0.5) * (V1 - V0) / 12, b = V0 + (j + 0.5) * (V1 - V0) / 12, [da, db] = field(p, a, b), m = Math.hypot(da / (V1 - V0), db / (V1 - V0)) || 1, len = Math.min(0.28, 0.1 + m * 0.2)
      const dx = (da / (Math.hypot(da, db) || 1)) * len * w2 / 5, dy = -(db / (Math.hypot(da, db) || 1)) * len * h2 / 5, x0 = sx(a), y0 = sy(b)
      c.beginPath(); c.moveTo(x0 - dx, y0 - dy); c.lineTo(x0 + dx, y0 + dy); c.stroke()
      c.beginPath(); c.moveTo(x0 + dx, y0 + dy); c.lineTo(x0 + dx - (dx * 0.7 - dy * 0.5) * 0.5, y0 + dy - (dy * 0.7 + dx * 0.5) * 0.5); c.moveTo(x0 + dx, y0 + dy); c.lineTo(x0 + dx - (dx * 0.7 + dy * 0.5) * 0.5, y0 + dy - (dy * 0.7 - dx * 0.5) * 0.5); c.stroke()
    }
    // flow lines
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(241,237,226,0.16)'
    for (const g of ghosts) { c.beginPath(); g.forEach(([a, b], i) => (i ? c.lineTo(sx(a), sy(b)) : c.moveTo(sx(a), sy(b)))); c.stroke() }
    // fixed points
    for (const f of fp) { const x = sx(f.A), y = sy(f.B); if (x < -10 || x > w2 + 10 || y < -10 || y > h2 + 10) continue
      c.beginPath(); c.arc(x, y, 7, 0, 6.2832); if (f.stable) { c.fillStyle = '#fff'; c.fill() } else { c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke() } }
    // live trail, fading toward its tail
    const n = trail.length
    c.lineWidth = 3; c.lineJoin = 'round'
    for (let i = 1; i < n; i++) { c.strokeStyle = A_; c.globalAlpha = 0.15 + 0.85 * (i / n); c.beginPath(); c.moveTo(sx(trail[i - 1][0]), sy(trail[i - 1][1])); c.lineTo(sx(trail[i][0]), sy(trail[i][1])); c.stroke() }
    c.globalAlpha = 1
    const hx = sx(A), hy = sy(B)
    if (pulse > 0) { c.strokeStyle = A_; c.globalAlpha = pulse; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, 8 + (1 - pulse) * 40, 0, 6.2832); c.stroke(); c.globalAlpha = 1 }
    c.fillStyle = A_; c.beginPath(); c.arc(hx, hy, 6, 0, 6.2832); c.fill(); c.strokeStyle = '#0b0e0d'; c.lineWidth = 2; c.stroke()
    drawTS()
  }
  function drawTS() {
    if (!W) return
    const c = cvT.getContext('2d')!, dpr = cvT.width / W; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H)
    const win = 40, t1 = Math.max(win, t), t0 = t1 - win, X = (tt: number) => 6 + ((tt - t0) / win) * (W - 12), Y = (v: number) => H - 6 - ((clamp(v, V0, V1) - V0) / (V1 - V0)) * (H - 12)
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; for (const g of [0, 2, 4]) { c.beginPath(); c.moveTo(0, Y(g)); c.lineTo(W, Y(g)); c.stroke() }
    c.setLineDash([3, 4]); c.strokeStyle = 'rgba(255,255,255,0.35)'; for (const s of shocks) if (s.t0 >= t0) { c.beginPath(); c.moveTo(X(s.t0), 0); c.lineTo(X(s.t0), H); c.stroke() } ; c.setLineDash([])
    for (const [k, col] of [[1, acc()], [2, '#f1ede2']] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = 2.2; c.lineJoin = 'round'; c.beginPath(); let first = true
      for (const s of series) { if (s[0] < t0) continue; const x = X(s[0]), y = Y(s[k]); if (first) { c.moveTo(x, y); first = false } else c.lineTo(x, y) }
      c.stroke()
    }
  }

  // ---- loop
  const loop = frameLoop(host, dt => {
    if (pulse > 0) pulse = Math.max(0, pulse - dt * 1.6)
    if (!reduced && !sitePaused() && !away && !drag && t < 400) { const sub = 3; for (let i = 0; i < sub; i++) advance(dt * 3 / sub) }
    paintReadouts(); draw()
    return (!reduced && !away && !drag && !sitePaused() && t < 400) || pulse > 0
  })

  // ---- dragging the start point
  let drag = false
  const setStart = (px: number, py: number) => { start.A = clamp(ux(px), V0 + 0.05, V1 - 0.05); start.B = clamp(uy(py), V0 + 0.05, V1 - 0.05); placeHandle(); restart(true); cue('lab:drag', { param: 'start', value: (start.A - V0) / (V1 - V0) }) }
  const local = (e: PointerEvent) => { const r = cvP.getBoundingClientRect(); return [(e.clientX - r.left) * (w2 / r.width), (e.clientY - r.top) * (h2 / r.height)] as const }
  const down = (e: PointerEvent) => { drag = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); const [x, y] = local(e); setStart(x, y); handle.classList.add('is-drag'); e.preventDefault() }
  const move = (e: PointerEvent) => { if (!drag) return; const [x, y] = local(e); setStart(x, y) }
  const up = () => { if (!drag) return; drag = false; handle.classList.remove('is-drag'); loop.wake() }
  handle.addEventListener('pointerdown', down); handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up)
  cvP.addEventListener('pointerdown', down); cvP.addEventListener('pointermove', move); cvP.addEventListener('pointerup', up); cvP.addEventListener('pointercancel', up)
  handle.addEventListener('keydown', e => {
    const d = e.shiftKey ? 0.5 : 0.15, m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }
    const v = m[e.key]; if (!v) return; e.preventDefault(); start.A = clamp(start.A + v[0], V0 + 0.05, V1 - 0.05); start.B = clamp(start.B + v[1], V0 + 0.05, V1 - 0.05); placeHandle(); restart(true)
  })
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act],.ml-chip'); if (!b) return
    if (b.dataset.act === 'restart') { restart(); return }
    if (b.dataset.act === 'up' || b.dataset.act === 'down') {
      const s = b.dataset.act === 'up' ? 1.2 : -1.2
      if (reduced) { const tt = Math.max(t, 8); shocks = [{ t0: tt, s }]; restart(true); return }
      shocks.push({ t0: t, s }); pulse = 1; cue('lab:click'); animate(b, { scale: [0.94, 1], duration: 240, ease: 'outBack' }); loop.wake(); return
    }
    if (b.classList.contains('ml-chip')) { Object.assign(p, PRESETS[+b.dataset.k!][1]); paramsChanged(); restart() }
  })

  syncControls(); paramsChanged(); restart()
  return { dispose() { loop.dispose(); fitP.dispose(); fitT.dispose(); host.innerHTML = '' } }
}
void TAU
