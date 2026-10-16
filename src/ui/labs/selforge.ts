// SELFORGE lab: the alarm that will not stop until the pushups are done.
// A phone alarm rings; the visitor does the reps by holding (pointer or Space) and releasing. A stick figure's elbow angle follows the
// press, and a rep counts only after a full up, down, up cycle with each phase held 0.18 s (the rule in projects.json: "2 frames per
// phase, 0.18 s minimum phase"). No camera is used. The target of 5 reps is a SIMULATION value: the app sets the count per alarm.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: count:tick (a rep), hub:poweroff (siren stops), hub:button (restart).
import './selforge.css'
import { clamp, gate, spring, stepSpring, type LabHandle, type LabOpts } from './lib/kit'
import { owner, shell } from './lib/prod-kit'

const TARGET = 5          // Simulation target
const MIN_PHASE = 0.18    // s, from the project's own pipeline
const DOWN_DEG = 100, UP_DEG = 155
const A = { x: 40, y: 165 }, W = { x: 250, y: 165 }, L = 216.5, ARM = 55
const H_UP = 107.5, H_DOWN = 62

/** the stick figure at shoulder height h: ankle fixed, body a rigid line, two-bone arm to the planted wrist */
function pose(h: number) {
  const S = { x: A.x + Math.sqrt(L * L - h * h), y: A.y - h }
  const dx = W.x - S.x, dy = W.y - S.y, d = Math.min(Math.hypot(dx, dy), ARM * 2 - 0.01)
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy), k = Math.sqrt(ARM * ARM - (d / 2) ** 2)
  const E = { x: S.x + dx / 2 - uy * k, y: S.y + dy / 2 + ux * k }
  const ang = (Math.acos(clamp((ARM * ARM * 2 - d * d) / (2 * ARM * ARM), -1, 1)) * 180) / Math.PI
  const bx = (S.x - A.x) / L, by = (S.y - A.y) / L
  const at = (t: number) => ({ x: A.x + (S.x - A.x) * t, y: A.y + (S.y - A.y) * t })
  return { S, E, ang, hip: at(0.55), knee: at(0.27), head: { x: S.x + bx * 30, y: S.y + by * 30 }, neck: { x: S.x + bx * 12, y: S.y + by * 12 } }
}
const goalFor = (down: boolean) => (down ? H_DOWN : H_UP)

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 60)
  const own = owner()
  const sh = shell(host, 'pl-sf', { acc: '#ff7a3d', acc2: '#ffc9a8', glow: '255, 122, 61' },
    'Interactive model, Simulation', 'The alarm that will not stop',
    `Simulation: the target is ${TARGET} reps here. In the app the count is set per alarm, and the camera does the counting. This demo uses no camera.`,
    'Hold the pad (or Space) to lower yourself, release to push back up. A rep only counts after a full up, down, up cycle, each phase held at least 0.18 s.')
  sh.body.innerHTML = `
  <div class="sf-grid">
    <div class="sf-phone" role="img" aria-label="An iPhone alarm screen, ringing">
      <div class="sf-notch"></div>
      <div class="sf-screen is-ring">
        <span class="sf-alarmlab pl-lab">Alarm &middot; pushups</span>
        <b class="sf-time">06:30</b>
        <div class="sf-ember"><i class="sf-ring"></i><i class="sf-ring r2"></i><i class="sf-ring r3"></i>
          <svg viewBox="0 0 60 80" aria-hidden="true"><path class="sf-flame" d="M30 4c4 14 20 22 20 44a20 20 0 0 1-40 0c0-10 6-14 8-22 4 4 6 8 8 10 0-12-2-20 4-32z"/><path class="sf-core" d="M30 36c2 8 10 12 10 22a10 10 0 0 1-20 0c0-6 4-8 5-14 3 2 4 4 5 6z"/></svg>
        </div>
        <div class="sf-bars" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
        <p class="sf-state" aria-live="polite">RINGING</p>
        <div class="sf-prog" aria-hidden="true">${Array.from({ length: TARGET }, () => '<i></i>').join('')}</div>
        <p class="sf-sub">Siren runs until the missions are done</p>
      </div>
    </div>
    <div class="sf-side pl-panel">
      <div class="sf-readouts">
        <div><span class="pl-lab">Reps</span><b class="sf-reps"><span class="sf-n">0</span><span class="sf-of"> / ${TARGET}</span></b></div>
        <div><span class="pl-lab">Elbow</span><b class="sf-deg">180&deg;</b></div>
        <div><span class="pl-lab">Phase</span><b class="sf-phase">UP</b></div>
      </div>
      <svg class="sf-fig" viewBox="0 0 320 200" aria-hidden="true">
        <line class="sf-ground" x1="10" y1="168" x2="310" y2="168"/>
        <g class="sf-limbs"><polyline class="sf-bone b-leg"/><polyline class="sf-bone b-body"/><polyline class="sf-bone b-arm"/></g>
        <circle class="sf-head" r="11"/>
        <g class="sf-joints"><circle class="j j-hip" r="3.5"/><circle class="j j-knee" r="3.5"/><circle class="j j-sh" r="4.5"/><circle class="j j-el" r="6.5"/><circle class="j j-wr" r="4.5"/><circle class="j j-an" r="4.5"/></g>
        <path class="sf-arc"/><text class="sf-arclab" text-anchor="end"></text>
      </svg>
      <p class="sf-toast" aria-live="polite">&nbsp;</p>
      <div class="sf-ctl">
        <button class="pl-btn sf-pad" type="button" aria-label="Hold to lower yourself, release to push up. Space works too.">HOLD to go down &middot; RELEASE to push up</button>
        <button class="pl-btn sf-again" type="button" hidden>Ring it again</button>
      </div>
    </div>
  </div>`
  const q = <T extends Element>(s: string) => sh.root.querySelector<T>(s)!
  const screen = q<HTMLElement>('.sf-screen'), nEl = q('.sf-n'), degEl = q('.sf-deg'), phaseEl = q('.sf-phase'), stateEl = q('.sf-state'), toast = q('.sf-toast')
  const pad = q<HTMLButtonElement>('.sf-pad'), again = q<HTMLButtonElement>('.sf-again'), dots = [...sh.root.querySelectorAll<HTMLElement>('.sf-prog i')]
  const pts = (...p: { x: number; y: number }[]) => p.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
  const set = (sel: string, p: { x: number; y: number }) => { const e = q<SVGCircleElement>(sel); e.setAttribute('cx', p.x.toFixed(1)); e.setAttribute('cy', p.y.toFixed(1)) }

  let pressed = false, reps = 0, phase: 'up' | 'down' = 'up', dwell = 0, done = false, toastT = 0, raf = 0, last = 0
  const sp = spring(H_UP, reduced ? 4000 : 150, reduced ? 120 : 17)
  let h = H_UP, running = false; void running

  const say = (s: string) => { toast.textContent = s; clearTimeout(toastT); toastT = window.setTimeout(() => { toast.innerHTML = '&nbsp;' }, 1800) }
  const draw = () => {
    const p = pose(h)
    q('.b-leg').setAttribute('points', pts(A, p.knee, p.hip)); q('.b-body').setAttribute('points', pts(p.hip, p.S, p.neck)); q('.b-arm').setAttribute('points', pts(p.S, p.E, W))
    const hd = q<SVGCircleElement>('.sf-head'); hd.setAttribute('cx', p.head.x.toFixed(1)); hd.setAttribute('cy', p.head.y.toFixed(1))
    set('.j-hip', p.hip); set('.j-knee', p.knee); set('.j-sh', p.S); set('.j-el', p.E); set('.j-wr', W); set('.j-an', A)
    // the angle arc at the elbow, drawn on the inside of the bend
    const a1 = Math.atan2(p.S.y - p.E.y, p.S.x - p.E.x), a2 = Math.atan2(W.y - p.E.y, W.x - p.E.x), r = 16
    const sx = p.E.x + Math.cos(a1) * r, sy = p.E.y + Math.sin(a1) * r, ex = p.E.x + Math.cos(a2) * r, ey = p.E.y + Math.sin(a2) * r
    q('.sf-arc').setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)} A${r} ${r} 0 0 ${Math.sin(a2 - a1) > 0 || Math.sin(a2 - a1) === 0 ? 1 : 0} ${ex.toFixed(1)} ${ey.toFixed(1)}`)
    const lab = q('.sf-arclab'); lab.setAttribute('x', (p.E.x - 12).toFixed(1)); lab.setAttribute('y', (p.E.y + 4).toFixed(1)); lab.textContent = `${Math.round(p.ang)}°`
    degEl.textContent = `${Math.round(p.ang)}°`
    return p.ang
  }
  const setPhase = (ph: 'up' | 'down') => { phase = ph; dwell = 0; phaseEl.textContent = ph.toUpperCase(); sh.root.dataset.phase = ph }
  const finish = () => {
    done = true; screen.classList.remove('is-ring'); screen.classList.add('is-off'); stateEl.textContent = 'ALARM OFF'; again.hidden = false; pad.disabled = true
    cue('hub:poweroff'); try { opts.emit('selforge:siren', { on: false }) } catch { /* sound never breaks the page */ }
    say(`Siren stopped after ${TARGET} reps`)
  }
  const step = (t: number) => {
    raf = 0
    const dt = Math.min(1 / 24, last ? t - last : 1 / 60); last = t
    sp.k = reduced ? 4000 : 150
    h = stepSpring(sp, goalFor(pressed), dt)
    const ang = draw()
    const goal = goalFor(pressed)
    if (!done) {
      if (phase === 'up') { if (ang < DOWN_DEG) { dwell += dt; if (dwell >= MIN_PHASE) { setPhase('down') } } else dwell = 0 }
      else if (ang > UP_DEG) { dwell += dt; if (dwell >= MIN_PHASE) { setPhase('up'); rep() } } else dwell = 0
    }
    const moving = Math.abs(sp.v) > 0.05 || Math.abs(sp.x - goal) > 0.05 || dwell > 0
    if (moving) raf = requestAnimationFrame(step); else { running = false; last = 0 }
  }
  const wake = () => { if (!raf) { running = true; raf = requestAnimationFrame(step) } }
  function rep() {
    reps++; nEl.textContent = String(reps); dots[reps - 1]?.classList.add('on')
    nEl.classList.remove('bump'); void (nEl as HTMLElement).offsetWidth; nEl.classList.add('bump')
    cue('count:tick', { rep: reps }); say(`Rep ${reps} counted`)
    if (reps >= TARGET) finish()
  }
  const press = (on: boolean) => {
    if (done || pressed === on) return
    pressed = on; pad.classList.toggle('is-held', on)
    if (!on && phase === 'up' && sp.x > 80) say('Go all the way down and hold it')
    wake()
  }
  own.on(pad, 'pointerdown', (e: PointerEvent) => { e.preventDefault(); pad.setPointerCapture?.(e.pointerId); press(true) })
  own.on(pad, 'pointerup', () => press(false)); own.on(pad, 'pointercancel', () => press(false)); own.on(pad, 'lostpointercapture', () => press(false))
  own.on(pad, 'keydown', (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) press(true) } })
  own.on(pad, 'keyup', (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); press(false) } })
  own.on(pad, 'blur', () => press(false))
  own.on(pad, 'contextmenu', (e: Event) => e.preventDefault())
  own.on(again, 'click', () => {
    reps = 0; done = false; pressed = false; nEl.textContent = '0'; dots.forEach(d => d.classList.remove('on'))
    screen.classList.add('is-ring'); screen.classList.remove('is-off'); stateEl.textContent = 'RINGING'; again.hidden = true; pad.disabled = false
    setPhase('up'); say('The alarm is ringing again'); cue('hub:button'); try { opts.emit('selforge:siren', { on: true }) } catch { /* ok */ }
    wake(); pad.focus({ preventScroll: true })
  })
  setPhase('up'); draw()
  if (reduced) screen.classList.add('is-still')
  const io = new IntersectionObserver(es => { if (es[0]?.isIntersecting) { wake(); try { opts.emit('selforge:siren', { on: !done }) } catch { /* ok */ } } else { try { opts.emit('selforge:siren', { on: false }) } catch { /* ok */ } } }, { threshold: 0.2 })
  io.observe(sh.root)
  return { dispose() { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(toastT); own.dispose(); try { opts.emit('selforge:siren', { on: false }) } catch { /* ok */ } host.innerHTML = '' } }
}
