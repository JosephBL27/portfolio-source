// "THE MOVEMENT" (wave 24, approach A: deep SVG + DOM + anime.js 4.5): a flying-tourbillon watch movement over the Job Watchdog scope.
// Every part stands for one of the jobs the watchdog checks; hover one and the tip names the part, then the job and its schedule word for word
// from src/data/nervous-system.json.
//
//   train     barrel 72 -> centre pinion 12 | centre 96 -> third pinion 8 | third 60 -> cage pinion 12: the cage turns once a minute and its arrow
//             reads the seconds; the escape pinion rolls round the fixed fourth wheel 48, so the escape wheel steps 12 degrees (half a tooth of 15)
//             relative to the cage on every beat. Balance 1 Hz, two beats a second: 120 beats a cage turn. The hands keep the visitor's real time.
//   beat      each beat is two anime.js keyframe animations on plain numbers: the train (unlock with a hair of recoil, impulse, drop, lock with a
//             rebound, draw home) and the pallet fork (leaves its banking pin, is carried across, runs to the other pin). Between beats the escape
//             wheel is locked (still). The balance amplitude follows the mainspring tension through a damped spring; the hairspring breathes.
//   anime     createAnimatable per rotating part (instant rotate setter, written by one createTimer); createAnimatable for the pointer tilt;
//             createDraggable for the crown (x mapped to rotate winds or sets the hands, y pulls it out with a detent); a createTimeline for the
//             explode (stack tilt, layers fanned along z from the centre) and svg.createDrawable leader lines for its labels; everything inside
//             one createScope; dispose() reverts it and removes the DOM.
//   loupe     an SVG clone of the whole movement (<use> of every part's art, re-posed each frame) at 3x inside a clipPath circle that follows the
//             pointer; built on first use and only updated while it is open. Filters stay on the static layers of the main view.
//   honesty   the root is data-proof="skip" and labelled Simulation; the only numerals shown are the schedules quoted from nervous-system.json.
//   reduced   (isRm) no timer, no tilt: the movement rests assembled; Step advances one beat; winding, the crown, explode and the loupe answer instantly.
//   perf      transforms and opacity only on moving parts; rotating parts carry no filter; no layout reads on pointer moves or per frame (centres measured on
//             grab, label anchors once when the explode settles, the tip and the controls once per content or viewport change); the timer pauses off-stop,
//             when hidden, off screen or under the site's Pause.
//   fit       frame() hands in a lane {top, floor}: the movement shrinks (and slides) until crown, case, controls and note all sit inside it, so nothing
//             lands on the scope's status strip (desktop) or under the copy (phone). The controls live in their own fixed layer (.mv-dock) above the copy.
//   touch     a finger on a wheel, the crown or (loupe on) anywhere on the movement belongs to the movement: touch-action none, and the site's swipe stepper
//             does not see the touch; a tap names the part for a moment (pointerleave after a touch is ignored).
//   annotate  while the movement shows it asks the blueprint tag to stand down (html.ann-quiet): the movement labels itself.
import { animate, createAnimatable, createDraggable, createScope, createTimeline, createTimer, spring, stagger, svg, utils, type Animatable, type Draggable, type JSAnimation, type Scope, type Timeline, type Timer } from 'animejs'
import NS from '../../../../../data/nervous-system.json'
import { state as appState } from '../../../../../state'
import { hairspring, mainspring, TAU } from './geom'
import { freeRegion } from '../../../layout'
import { buildParts, bridgesSvg, cageTop, CAGE, defs, dialSvg, fixedSvg, HAIR, LABELS, NAMES, plateSvg, SPRING, type Part } from './art'
import './movement.css'

const DEG = 180 / Math.PI
const BEAT_HZ = 2                 // beats per second (balance 1 Hz)
const ESC_STEP = 12               // escape wheel degrees per beat, relative to the cage (half a pitch of 15 teeth)
const ESC_REL = 240               // escape wheel degrees (cage frame) per centre-wheel degree
const CW_PER_BEAT = ESC_STEP / ESC_REL
const RUN_SECONDS = 90            // a full wind runs this long (simulation)
const CROWN_TO_RATCHET = 0.5      // ratchet degrees per crown degree
const CROWN_TO_SET = 0.25         // minute-hand degrees per crown degree when the crown is pulled
const FULL_WIND = 360             // ratchet degrees from empty to full
const PULL = 16                   // crown proxy travel (px) for the setting position
const LOUPE_X = 3                 // loupe magnification
const GAP = 10                    // px between the case and the controls
const MIN_S = 170                 // the smallest the fit may make the movement
const CROWN_UP = 0.085            // the crown rises this share of S above the case

type Rot = Animatable & { rotate(v: number, duration?: number): unknown }
type Job = { id: string; label: string; schedule: string; detail: string }
const JOBS = new Map<string, Job>((NS as { nodes: Job[] }).nodes.map(n => [n.id, n]))

export interface MovementFrame {
  /** 0..1 fade (the stage's presence) */ present: number
  /** the stop is fully in and held: interaction allowed */ held: boolean
  /** screen centre in client px */ x: number; y: number
  phone: boolean
  /** the band (viewport px) the movement may use: the crown rises no higher than `top`, the controls end above `floor` */
  lane?: { top: number; floor: number }
}
export interface MovementHandle { frame(f: MovementFrame): void; /** the stage went invisible: take everything down */ leave(): void; dispose(): void; info(): Record<string, unknown> }

const pctOf = (v: number, box: number) => `${((v / box) * 100).toFixed(3)}%`

// ------------------------------------------------------------------------------------------------ mount
export function mountMovement(opts: { emit(name: string, data?: unknown): void; reduced(): boolean }): MovementHandle {
  const rm0 = opts.reduced()
  const root = document.createElement('div')
  root.className = 'mv'; root.setAttribute('data-proof', 'skip'); root.setAttribute('role', 'group')
  root.setAttribute('aria-label', 'The Movement: a simulated flying-tourbillon watch movement. Each part is a job the watchdog checks.')
  root.innerHTML = defs() + `<div class="mv-scrim" aria-hidden="true"></div><div class="mv-catch" aria-hidden="true"></div><div class="mv-stage"><div class="mv-tilt"><div class="mv-stack"></div></div></div>`
    + `<div class="mv-labels" aria-hidden="true"><svg class="mv-leaders"></svg></div>`
    + `<div class="mv-loupe" aria-hidden="true"><svg class="mv-loupe-svg"><defs><clipPath id="mv-loupe-clip"><circle class="mv-loupe-c" r="10"/></clipPath></defs><g clip-path="url(#mv-loupe-clip)"><rect class="mv-loupe-bg" x="-500" y="-500" width="1000" height="1000" fill="#050506"/><g class="mv-loupe-world"></g></g></svg></div>`
    + `<div class="mv-crown"><span class="mv-crown-body"><span class="mv-crown-knurl"></span></span><span class="mv-crown-proxy" aria-hidden="true"></span><input class="mv-crown-key" type="range" min="0" max="100" step="1" value="62" aria-label="Mainspring: raise to wind the crown"></div>`
  // the controls and the note live in a second fixed layer with the root's own box, above the copy's scrim (z 41), so the copy never ghosts them
  const dock = document.createElement('div')
  dock.className = 'mv-dock'; dock.setAttribute('data-proof', 'skip')
  dock.innerHTML = `<div class="mv-ctl" role="group" aria-label="Movement controls"><button type="button" class="mv-btn mv-wind">Wind</button><button type="button" class="mv-btn mv-pull" aria-pressed="false">Pull crown</button>`
    + `<button type="button" class="mv-btn mv-loupe-btn" aria-pressed="false">Loupe</button><button type="button" class="mv-btn mv-explode" aria-pressed="false">Explode</button>${rm0 ? '<button type="button" class="mv-btn mv-step">Step</button>' : ''}</div>`
    + `<p class="mv-note">Simulation.<span class="mv-note-more"> Wind or pull the crown, drag any wheel.</span></p>`
  document.body.append(root, dock)
  const html = document.documentElement
  const ctl = dock.querySelector('.mv-ctl') as HTMLDivElement, note = dock.querySelector('.mv-note') as HTMLParagraphElement
  const stage = root.querySelector('.mv-stage') as HTMLDivElement, tiltEl = root.querySelector('.mv-tilt') as HTMLDivElement, stack = root.querySelector('.mv-stack') as HTMLDivElement
  const sizeOf = (phone: boolean) => Math.round(phone ? Math.min(innerWidth * 0.92, innerHeight * 0.46) : Math.max(320, Math.min(innerHeight * 0.68, innerWidth * 0.43, 680)))
  let S = sizeOf(innerWidth <= 760)
  root.style.setProperty('--S', S + 'px'); dock.style.setProperty('--S', S + 'px')
  let lastX = -1, lastY = -1, lastS = -1, lastO = -1, fitKey = '', ctlH = 33, noteH = 0, stacked = false, tlS = 0
  let touchTimer = 0, windTimer = 0
  const mountedAt = Date.now()
  const crownEl = root.querySelector('.mv-crown-proxy') as HTMLSpanElement, crownKey = root.querySelector('.mv-crown-key') as HTMLInputElement
  const knurl = root.querySelector('.mv-crown-knurl') as HTMLSpanElement, crownBody = root.querySelector('.mv-crown-body') as HTMLSpanElement

  // ---- layers (back to front): plate, barrel, centre, third, fixed wheel, bridges, keyless, tourbillon, motion works, dial and hands
  const layers: HTMLDivElement[] = []
  for (let i = 0; i < 10; i++) { const l = document.createElement('div'); l.className = 'mv-layer'; l.dataset.l = String(i); stack.append(l); layers.push(l) }
  layers[0].innerHTML = plateSvg(); layers[4].innerHTML = fixedSvg(); layers[5].innerHTML = bridgesSvg(); layers[9].innerHTML = dialSvg()
  layers[0].append(root.querySelector('.mv-crown') as HTMLDivElement)   // the crown rides with the case when the movement is exploded
  for (const [l, , x, y] of LABELS) { const a = document.createElement('i'); a.className = 'mv-anchor'; a.style.left = pctOf(x + 500, 1000); a.style.top = pctOf(y + 500, 1000); layers[l].append(a) }

  const parts = buildParts(new Date())
  const byId = new Map(parts.map(p => [p.id, p]))
  const top = parts.filter(p => !p.parent), kids = (id: string) => parts.filter(p => p.parent === id)
  const boxOf = (p: Part) => p.r * 2 + 8
  const mkPart = (p: Part, pbox: number, cx: number, cy: number) => {
    const el = document.createElement('div'); el.className = 'mv-part'; el.dataset.id = p.id
    const box = boxOf(p)
    el.style.left = pctOf(p.at[0] + cx - box / 2, pbox); el.style.top = pctOf(p.at[1] + cy - box / 2, pbox); el.style.width = pctOf(box, pbox); el.style.height = pctOf(box, pbox)
    let inner = ''
    if (p.shadow && !p.parent) inner += `<div class="mv-shadow" style="--k:${(p.r / 150).toFixed(2)}"></div>`
    if (p.blur) inner += `<div class="mv-blur"></div>`
    if (p.id === 'cage') inner += `<div class="mv-rot mv-cage-rot"><svg class="mv-cage-svg" viewBox="${-box / 2} ${-box / 2} ${box} ${box}"><g id="mvp-cage">${p.svg}</g></svg></div>`
    else inner += `<svg class="mv-rot" viewBox="${-box / 2} ${-box / 2} ${box} ${box}"><g id="mvp-${p.id}">${p.svg}</g></svg>`
    if (p.sheen && !p.parent) inner += `<div class="mv-sheen"></div>`
    if (p.job && p.drag) inner += `<div class="mv-hi"></div>`
    el.innerHTML = inner
    if (p.drag) el.classList.add('mv-drag')
    p.el = el; p.rot = el.querySelector('.mv-rot') as Element; p.hi = el.querySelector('.mv-hi') as HTMLDivElement | undefined ?? undefined
    p.blurEl = el.querySelector('.mv-blur') as HTMLDivElement | undefined ?? undefined
    return el
  }
  for (const p of top) {
    const el = mkPart(p, 1000, 500, 500)
    layers[p.layer].append(el)
    if (p.id === 'cage') {
      const rot = p.rot as HTMLDivElement, box = boxOf(p)
      for (const c of kids('cage')) rot.append(mkPart(c, box, box / 2, box / 2))
      rot.insertAdjacentHTML('beforeend', `<svg class="mv-cage-svg mv-cage-top" viewBox="${-box / 2} ${-box / 2} ${box} ${box}"><g id="mvc-top">${cageTop()}</g></svg>`)
    }
  }
  const springPath = root.querySelector('.mv-spring') as SVGPathElement | null, springHl = root.querySelector('.mv-spring-hl') as SVGPathElement | null
  const springSh = root.querySelector('.mv-spring-sh') as SVGPathElement | null, hairPath = root.querySelector('.mv-hair') as SVGPathElement | null

  // ---- simulation state
  const train = { cw: 0 }                     // centre-wheel degrees since mount
  const fork = { a: -CAGE.FORK }              // pallet fork angle; -FORK = entry stone locking
  const sim = { wind: 0, tension: 0.62, amp: 0, ampV: 0, phase: 0, side: -1, beats: 0, held: false, present: 0, dragging: null as Part | null, coast: { v: 0 },
    hovered: null as Part | null, hoveredKey: '', lastFrame: 0, running: false, onScreen: true, exploded: false, springLevel: -1, crown: 0, lastDetent: 0,
    pulled: false, setCW: 0, loupe: false, loupeOn: false, labels: false, tiltX: 0, tiltY: 0, low: false, quiet: false }
  // a touch tip (and any tip on a phone) keeps clear of the control dock and the note: it slides up or down past them, never over them
  const tip = tipEl(() => [ctl, note].map(e => e.getBoundingClientRect()))
  let scope: Scope | null = null, timer: Timer | null = null, tl: Timeline | null = null, crownDrag: Draggable | null = null
  let beatAnim: JSAnimation | null = null, forkAnim: JSAnimation | null = null, coastAnim: JSAnimation | null = null, snapAnim: JSAnimation | null = null
  let tilt: (Animatable & { rotateX(v: number): unknown; rotateY(v: number): unknown }) | null = null, stemAnim: (Animatable & { y(v: number): unknown }) | null = null
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { for (const e of es) sim.onScreen = e.isIntersecting }) : null
  io?.observe(root)

  const balAngle = () => opts.reduced() ? (sim.beats ? -sim.side * 38 : 0) : sim.amp * Math.sin(sim.phase)
  const angleOf = (p: Part): number => {
    switch (p.drive) {
      case 'wind': return p.phase - sim.wind
      case 'crownwheel': return p.phase + 2 * sim.wind
      case 'click': { const pitch = 360 / 48, u = (((sim.wind % pitch) + pitch) % pitch) / pitch; return 10 * u }   // the nose rides up a ramp, then drops behind the tooth
      case 'balance': return balAngle()
      case 'hair': return (p.k ?? 0) * balAngle()
      case 'pallet': return fork.a
      case 'reserve': return -150 + 120 * sim.tension
      case 'motion': case 'hand-m': case 'hand-h': return p.phase + p.ratio * (train.cw + sim.setCW)
      case 'stem': return 0
      default: return p.phase + p.ratio * train.cw
    }
  }
  // the mainspring: coils packed on the arbor when wound, let down against the drum wall when empty (re-drawn in 32 steps)
  const setSpring = () => {
    const lv = Math.round(Math.max(0, Math.min(1, sim.tension)) * 32)
    if (lv === sim.springLevel || !springPath) return
    sim.springLevel = lv
    const d = mainspring(SPRING.r0, SPRING.r1, 11, lv / 32)
    springPath.setAttribute('d', d); springHl?.setAttribute('d', d); springSh?.setAttribute('d', d)
  }

  // ---- the loupe: an SVG clone (uses) of every layer, re-posed each frame while open
  const loupeEl = root.querySelector('.mv-loupe') as HTMLDivElement, loupeSvg = root.querySelector('.mv-loupe-svg') as SVGSVGElement
  const loupeC = root.querySelector('.mv-loupe-c') as SVGCircleElement, loupeWorld = root.querySelector('.mv-loupe-world') as SVGGElement
  let loupeBuilt = false
  const buildLoupe = () => {
    if (loupeBuilt) return
    loupeBuilt = true
    const statics: Record<number, string> = { 0: 'mvs-plate', 4: 'mvs-fixed', 5: 'mvs-bridges', 9: 'mvs-dial' }
    let s = ''
    const g = (p: Part, body: string) => `<g transform="translate(${p.at[0]} ${p.at[1]})"><g data-r="${p.id}">${body}</g></g>`
    for (let i = 0; i < 10; i++) {
      if (statics[i]) s += `<use href="#${statics[i]}"/>`
      for (const p of top.filter(q => q.layer === i)) s += g(p, `<use href="#mvp-${p.id}"/>` + (p.id === 'cage' ? kids('cage').map(c => g(c, `<use href="#mvp-${c.id}"/>`)).join('') + `<use href="#mvc-top"/>` : ''))
    }
    loupeWorld.innerHTML = s
    for (const el of loupeWorld.querySelectorAll<SVGGElement>('g[data-r]')) { const p = byId.get(el.dataset.r ?? ''); if (p) { p.lg = el; p.llast = undefined } }
  }
  const LOUPE_PX = () => Math.round(Math.min(260, Math.max(150, S * 0.4)))
  const placeLoupe = (cx: number, cy: number) => {
    const L = LOUPE_PX()
    const lx = cx - lastX, ly = cy - lastY        // the root sits at (lastX, lastY): no getBoundingClientRect on a pointer move
    const u = (lx / S) * 1000 - 500, v = (ly / S) * 1000 - 500, w = (L / S) * 1000 / LOUPE_X
    loupeSvg.setAttribute('viewBox', `${(u - w / 2).toFixed(2)} ${(v - w / 2).toFixed(2)} ${w.toFixed(2)} ${w.toFixed(2)}`)
    loupeC.setAttribute('cx', u.toFixed(2)); loupeC.setAttribute('cy', v.toFixed(2)); loupeC.setAttribute('r', (w / 2).toFixed(2))
    loupeEl.style.width = loupeEl.style.height = L + 'px'
    loupeEl.style.transform = `translate3d(${Math.round(lx - L / 2)}px,${Math.round(ly - L / 2)}px,0)`
    const inside = Math.hypot(u, v) < 520
    if (inside !== sim.loupeOn) { sim.loupeOn = inside; loupeEl.classList.toggle('on', inside) }
  }

  const render = (dt: number) => {
    for (const p of parts) {
      if (p.drive === 'hair') {
        const a = balAngle()
        if (hairPath && (p.last === undefined || Math.abs(a - p.last) > 0.06)) { hairPath.setAttribute('d', hairspring(HAIR.r0, HAIR.pitch, HAIR.r1, a / DEG)); p.last = a }
        continue
      }
      if (!p.anim) continue
      const a = angleOf(p)
      if (p.last === undefined || Math.abs(a - p.last) > 0.004) {
        if (p.blurEl) { const w = p.last === undefined ? 0 : Math.abs(a - p.last) / Math.max(dt, 1 / 240); p.spd = (p.spd ?? 0) * 0.8 + w * 0.2; p.blurEl.style.opacity = String(Math.min(0.85, Math.max(0, (p.spd - 900) / 2600))) }
        p.anim.rotate(a)
        p.last = a
      } else if (p.blurEl && (p.spd ?? 0) > 1) { p.spd = (p.spd ?? 0) * 0.8; p.blurEl.style.opacity = String(Math.min(0.85, Math.max(0, (p.spd - 900) / 2600))) }
      if (sim.loupeOn && p.lg && (p.llast === undefined || Math.abs(a - p.llast) > 0.004)) { p.lg.setAttribute('transform', `rotate(${a.toFixed(3)})`); p.llast = a }
    }
    setSpring()
    const tv = String(Math.round(sim.tension * 100)); if (crownKey.value !== tv && document.activeElement !== crownKey) crownKey.value = tv
    // a nearly run-down mainspring asks to be wound: the crown's ring pulses again and the Wind button takes the accent
    const low = sim.tension < (sim.low ? 0.1 : 0.04)
    if (low !== sim.low) { sim.low = low; root.classList.toggle('is-low', low); dock.classList.toggle('is-low', low) }
  }
  const setFork = (side: number, ms = 0) => {
    sim.side = side
    forkAnim?.cancel()
    if (!ms) { fork.a = side * CAGE.FORK; return }
    forkAnim = animate(fork, { a: side * CAGE.FORK, duration: ms, ease: 'out(3)' })
  }
  // one beat of the Swiss lever: unlock (a hair of recoil), impulse, drop, lock (a small rebound), draw; the fork crosses to the other banking pin
  const beat = () => {
    if (sim.dragging || Math.abs(sim.coast.v) > 0.02 || sim.pulled || snapAnim) return
    sim.beats++
    const to = -sim.side, F = CAGE.FORK, st = CW_PER_BEAT, c0 = train.cw
    sim.side = to
    beatAnim?.cancel(); forkAnim?.cancel()
    if (opts.reduced()) { train.cw = c0 + st; fork.a = to * F; return }
    beatAnim = animate(train, { cw: [
      { to: c0 - st * 0.04, duration: 12, ease: 'out(2)' },
      { to: c0 + st * 0.7, duration: 40, ease: 'inOut(2)' },
      { to: c0 + st, duration: 8, ease: 'in(2)' },
      { to: c0 + st * 0.986, duration: 8, ease: 'out(2)' },
      { to: c0 + st, duration: 22, ease: 'out(3)' },
    ] })
    forkAnim = animate(fork, { a: [
      { to: -to * F * 0.55, duration: 12, ease: 'out(2)' },
      { to: to * F * 1.06, duration: 48, ease: 'inOut(2)' },
      { to: to * F, duration: 30, ease: 'out(3)' },
    ] })
    if (sim.hovered || sim.dragging) opts.emit('count:tick')
  }
  /** after a back-drive: settle the escape wheel onto the nearest lock (a lattice point whose parity matches the fork) */
  const settle = () => {
    const n = Math.round(train.cw / CW_PER_BEAT)
    const want = sim.side < 0 ? 0 : 1
    const k = ((n % 2) + 2) % 2 === want ? n : n + (train.cw / CW_PER_BEAT > n ? 1 : -1)
    snapAnim?.cancel()
    if (opts.reduced()) { train.cw = k * CW_PER_BEAT; render(1 / 60); return }
    snapAnim = animate(train, { cw: k * CW_PER_BEAT, duration: 180, ease: 'out(3)', onUpdate: () => { if (!timer || !sim.running) render(1 / 60) }, onComplete: () => { snapAnim = null } })
  }
  const parityFork = () => { const n = Math.floor(train.cw / CW_PER_BEAT + 1e-6); const side = ((n % 2) + 2) % 2 ? 1 : -1; if (side !== sim.side) { setFork(side, opts.reduced() ? 0 : 40); return true } return false }
  const wind = (dRatchet: number) => {
    if (dRatchet <= 0) return
    const room = (1 - sim.tension) * FULL_WIND, d = Math.min(dRatchet, room)
    if (d <= 0) return
    const pitch = 360 / 48, before = Math.floor(sim.wind / pitch)
    sim.wind += d; sim.tension = Math.min(1, sim.tension + d / FULL_WIND)
    root.classList.add('was-wound')
    const after = Math.floor(sim.wind / pitch)
    if (after !== before) opts.emit('hub:detent', { ch: after % 12 })
    if (!sim.running) render(1 / 60)
  }

  // ---- the timer: balance, escapement, coast, run-down
  const tick = (dtMs: number) => {
    const now = performance.now()
    if (now - sim.lastFrame > 250) { setRunning(false); return }
    const dt = Math.max(0, Math.min(0.05, (Number.isFinite(dtMs) ? dtMs : 0) / 1000))
    if (!opts.reduced() && !appState.paused) {
      // balance: amplitude follows the mainspring (a damped spring toward the target); the crown pulled stops it (hacking)
      const target = sim.pulled ? 0 : sim.tension > 0.02 ? 160 + 125 * Math.min(1, sim.tension / 0.45) : 0
      const k = sim.pulled ? 60 : 9, c = 2 * Math.sqrt(k) * 0.8
      sim.ampV += (k * (target - sim.amp) - c * sim.ampV) * dt; sim.amp = Math.max(0, sim.amp + sim.ampV * dt)
      if (!sim.pulled && sim.amp > 18) {
        const was = Math.floor(sim.phase / Math.PI)
        sim.phase += TAU * (BEAT_HZ / 2) * dt
        if (Math.floor(sim.phase / Math.PI) !== was) beat()
        sim.tension = Math.max(0, sim.tension - dt / RUN_SECONDS)
      }
    }
    // coast after a back-drive (visitor-initiated, so it plays under the site's Pause too)
    if (!opts.reduced() && Math.abs(sim.coast.v) > 0.02 && !sim.dragging) { train.cw += sim.coast.v * dt; parityFork() }
    render(dt)
  }
  const setRunning = (on: boolean) => {
    if (!timer || on === sim.running) return
    sim.running = on
    if (on) timer.play(); else timer.pause()
  }

  // ---- pointer: hover names the part and its job, drag back-drives (or winds, for the keyless works), the loupe follows, the stack tilts
  const keyOf = (e: Event): string => {
    const t = e.target as Element | null
    const sp = t?.closest?.('[data-part]') as HTMLElement | SVGElement | null
    if (sp && root.contains(sp)) return sp.getAttribute('data-part') ?? ''
    const pe = t?.closest?.('.mv-part') as HTMLElement | null
    return pe?.dataset.id ?? ''
  }
  const showTipFor = (key: string, x: number, y: number, touch = false) => {
    const n = NAMES[key] ?? (key.startsWith('hair-') ? NAMES['hair-0'] : undefined)
    if (!n) { tip.hide(); return }
    const j = n.job ? JOBS.get(n.job) : undefined
    // under the loupe the tip hangs below the lens (never on it); a finger's tip sits above the fingertip, a cursor's beside it
    if (sim.loupe && sim.loupeOn) tip.show(x, touch ? y + 44 : y + LOUPE_PX() / 2 + 16, n.name, j?.label, j?.schedule, 'centre')
    else tip.show(x, y, n.name, j?.label, j?.schedule, touch ? 'above' : 'cursor')
  }
  const hover = (key: string, x = 0, y = 0, touch = false) => {
    const p = byId.get(key) ?? null
    if (sim.hovered && sim.hovered !== p) sim.hovered.el?.classList.remove('is-hi')
    sim.hovered = p; sim.hoveredKey = key
    if (!key) { tip.hide(); return }
    p?.el?.classList.add('is-hi')
    showTipFor(key, x, y, touch)
  }
  /** a touch's tip goes by itself after `ms` (one timer: a later tap replaces an earlier one's countdown) */
  const hideSoon = (ms: number) => { window.clearTimeout(touchTimer); touchTimer = window.setTimeout(() => hover(''), ms) }
  const tiltTo = (x: number, y: number) => {
    if (!tilt) return
    if (x === sim.tiltX && y === sim.tiltY) return
    sim.tiltX = x; sim.tiltY = y; tilt.rotateX(y); tilt.rotateY(x)
  }
  let grab: { p: Part; cx: number; cy: number; a: number; id: number; hist: [number, number][] } | null = null
  const onMove = (e: PointerEvent) => {
    if (!sim.held) return
    const touch = e.pointerType === 'touch'
    if (sim.loupe && !sim.exploded) placeLoupe(e.clientX, touch ? e.clientY - 110 : e.clientY)
    if (grab && e.pointerId === grab.id) {
      const a = Math.atan2(e.clientY - grab.cy, e.clientX - grab.cx) * DEG
      let d = a - grab.a; if (d > 180) d -= 360; if (d < -180) d += 360
      grab.a = a
      const p = grab.p
      if (p.drag === 'wind') wind(d / (p.drive === 'crownwheel' ? 2 : -1))
      else {
        const parent = p.parent ? byId.get(p.parent) : undefined
        const ratio = p.drive === 'balance' || p.drive === 'pallet' ? 0 : (p.ratio || 1) + (parent ? parent.ratio : 0)
        if (ratio) {
          const before = Math.floor(train.cw / CW_PER_BEAT)
          train.cw += d / ratio
          if (parityFork() && Math.abs(Math.floor(train.cw / CW_PER_BEAT) - before) < 3) opts.emit('count:tick')
          const now = performance.now(); grab.hist.push([now, train.cw]); while (grab.hist.length > 2 && now - grab.hist[0][0] > 90) grab.hist.shift()
        }
      }
      if (!sim.running) render(1 / 60)
      showTipFor(sim.hoveredKey || p.id, e.clientX, e.clientY, touch)
      return
    }
    if (touch) return
    hover(keyOf(e), e.clientX, e.clientY)
  }
  // the stack tilts toward the pointer anywhere near the movement (a passive window listener; the root's place comes from frame(), no layout read)
  const onWinMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !sim.held || opts.reduced() || sim.exploded || sim.loupe || grab) return
    const nx = (e.clientX - (lastX + S / 2)) / (S / 2), ny = (e.clientY - (lastY + S / 2)) / (S / 2)
    if (Math.hypot(nx, ny) > 1.3) { tiltTo(0, 0); return }
    tiltTo(Math.round(Math.max(-1, Math.min(1, nx)) * 40) / 10, Math.round(-Math.max(-1, Math.min(1, ny)) * 34) / 10)
  }
  // a part that slides back under a still cursor (the train steps, the stack settles) names itself again
  const onOver = (e: PointerEvent) => { if (sim.held && !grab && e.pointerType !== 'touch') hover(keyOf(e), e.clientX, e.clientY) }
  const onDown = (e: PointerEvent) => {
    if (!sim.held || e.button !== 0) return
    const touch = e.pointerType === 'touch'
    window.clearTimeout(touchTimer)
    const key = keyOf(e), p = byId.get(key)
    if (sim.loupe && !sim.exploded) placeLoupe(e.clientX, touch ? e.clientY - 110 : e.clientY)
    if (!p || !p.drag || !p.el) { if (key) { hover(key, e.clientX, e.clientY, touch); if (touch) hideSoon(1600) } return }
    e.preventDefault(); e.stopPropagation()
    const r = p.el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    grab = { p, cx, cy, a: Math.atan2(e.clientY - cy, e.clientX - cx) * DEG, id: e.pointerId, hist: [[performance.now(), train.cw]] }
    sim.dragging = p; coastAnim?.cancel(); sim.coast.v = 0; beatAnim?.cancel(); snapAnim?.cancel(); snapAnim = null
    try { p.el.setPointerCapture(e.pointerId) } catch { /* gone */ }
    root.classList.add('is-grabbing')
    hover(key, e.clientX, e.clientY, touch)
    opts.emit('tv:grab')
  }
  const onUp = (e: PointerEvent) => {
    if (!grab || e.pointerId !== grab.id) return
    const g = grab; grab = null; sim.dragging = null
    root.classList.remove('is-grabbing')
    try { g.p.el?.releasePointerCapture(e.pointerId) } catch { /* released */ }
    if (g.p.drag === 'train') {
      const [t0, c0] = g.hist[0], [t1, c1] = g.hist[g.hist.length - 1]
      const v = t1 > t0 ? ((c1 - c0) / (t1 - t0)) * 1000 : 0
      if (!opts.reduced() && Math.abs(v) > 0.05) { sim.coast.v = v; coastAnim = animate(sim.coast, { v: 0, duration: 1800, ease: 'out(3)', onComplete: () => { sim.coast.v = 0; settle() } }) }
      else settle()
    }
    opts.emit('tv:release')
    if (e.pointerType === 'touch') hideSoon(1400)
  }
  // pointerleave also fires right after a finger lifts: a tap's tip must stay for its countdown, so touch pointers are ignored here
  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'touch') return; if (!grab) { hover(''); if (sim.loupeOn) { sim.loupeOn = false; loupeEl.classList.remove('on') } } }
  // a finger on a wheel, the crown, or anywhere on the movement while the loupe follows it, is the movement's: the site's swipe stepper must not see it
  const onTouchStart = (e: TouchEvent) => { if (sim.held && (sim.loupe || (e.target as Element | null)?.closest?.('.mv-drag, .mv-crown-proxy'))) e.stopPropagation() }
  const onTouchMove = (e: TouchEvent) => { if ((grab || sim.loupe) && e.cancelable) e.preventDefault() }
  window.addEventListener('pointermove', onWinMove, { passive: true })
  root.addEventListener('pointerover', onOver)
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp)
  root.addEventListener('pointerleave', onLeave)
  root.addEventListener('touchstart', onTouchStart, { passive: true })
  root.addEventListener('touchmove', onTouchMove, { passive: false })

  // ---- controls
  const explodeBtn = dock.querySelector('.mv-explode') as HTMLButtonElement, windBtn = dock.querySelector('.mv-wind') as HTMLButtonElement
  const pullBtn = dock.querySelector('.mv-pull') as HTMLButtonElement, loupeBtn = dock.querySelector('.mv-loupe-btn') as HTMLButtonElement
  const stepBtn = dock.querySelector('.mv-step') as HTMLButtonElement | null
  const turn = { deg: 0 }
  let windAnim: JSAnimation | null = null
  const windStep = () => {
    if (!crownDrag) return
    const to = crownDrag.x + 90
    turn.deg = crownDrag.x
    windAnim?.cancel(); windAnim = null
    if (opts.reduced()) { crownDrag.setX(to); onCrown(to); return }
    windAnim = animate(turn, { deg: to, duration: 520, ease: spring({ duration: 520, bounce: 0.14 }), onUpdate: () => { crownDrag?.setX(turn.deg); onCrown(turn.deg) } })
  }
  const onCrown = (deg: number) => {
    const d = deg - sim.crown
    sim.crown = deg
    knurl.style.transform = `translateX(${(((deg * 0.35) % 12) + 12) % 12 - 12}px)`
    if (Math.floor(deg / 15) !== sim.lastDetent) { sim.lastDetent = Math.floor(deg / 15); if (d < 0 || sim.pulled) opts.emit('hub:detent', { ch: 3 }) }
    if (sim.pulled) { sim.setCW += d * CROWN_TO_SET; if (!sim.running) render(1 / 60) }
    else if (d > 0) wind(d * CROWN_TO_RATCHET)
  }
  const setPulled = (on: boolean) => {
    if (on === sim.pulled) return
    sim.pulled = on
    root.classList.toggle('is-pulled', on)
    pullBtn.setAttribute('aria-pressed', String(on)); pullBtn.textContent = on ? 'Push crown' : 'Pull crown'
    windBtn.textContent = on ? 'Set hands' : 'Wind'
    crownBody.style.transform = `translateY(${on ? -PULL : 0}px)`
    stemAnim?.y(on ? -(S * 0.018) : 0)
    opts.emit('hub:detent', { ch: 5 })
    if (on) { beatAnim?.cancel(); forkAnim?.cancel(); fork.a = sim.side * CAGE.FORK }
  }
  const onPull = (y: number) => { crownBody.style.transform = `translateY(${Math.max(-PULL, Math.min(0, y))}px)`; setPulled(y < -PULL / 2) }
  const setExplode = (on: boolean) => {
    sim.exploded = on
    explodeBtn.setAttribute('aria-pressed', String(on)); explodeBtn.textContent = on ? 'Assemble' : 'Explode'
    root.classList.toggle('is-exploded', on)
    if (on) { tiltTo(0, 0); if (sim.loupe) setLoupe(false); if (tlS !== S) rebuildTl() }
    if (!tl) return
    if (!on) hideLabels()
    if (opts.reduced()) { tl.seek(on ? tl.duration : 0); if (on) showLabels(); return }
    if (on) tl.play(); else tl.reverse()
    opts.emit(on ? 'open' : 'close')
  }
  const setLoupe = (on: boolean) => {
    sim.loupe = on
    loupeBtn.setAttribute('aria-pressed', String(on))
    root.classList.toggle('is-loupe', on); html.classList.toggle('mv-loupe-on', on)      // the site's decorative cursor ring would sit on the lens: it steps aside
    if (on) { if (sim.exploded) setExplode(false); buildLoupe(); tiltTo(0, 0); for (const p of parts) p.llast = undefined; placeLoupe(lastX + S * 0.5, lastY + S * 0.75); render(1 / 60); tip.hide() }
    else { sim.loupeOn = false; loupeEl.classList.remove('on') }
  }

  // ---- explode labels: anchors measured once when the explode settles, leader lines drawn on with svg.createDrawable
  const labelsEl = root.querySelector('.mv-labels') as HTMLDivElement, leaders = root.querySelector('.mv-leaders') as SVGSVGElement
  let labelAnims: JSAnimation[] = []
  const showLabels = () => {
    if (!sim.exploded) return
    const rr = root.getBoundingClientRect()
    const pts = [...root.querySelectorAll<HTMLElement>('.mv-anchor')].map((a, i) => { const r = a.getBoundingClientRect(); return { i, x: r.left - rr.left, y: r.top - rr.top } })
    pts.sort((a, b) => a.y - b.y)
    const minX = Math.min(...pts.map(p => p.x)), colRoom = rr.left + minX
    const outside = colRoom > 190
    const colX = outside ? minX - 34 : 8 - rr.left
    let lastY = -1e9
    for (const p of pts) { (p as typeof p & { ly: number }).ly = Math.max(p.y, lastY + 21); lastY = (p as typeof p & { ly: number }).ly }
    leaders.setAttribute('viewBox', `0 0 ${S} ${S}`); leaders.setAttribute('width', String(S)); leaders.setAttribute('height', String(S))
    leaders.innerHTML = pts.map(p => { const ly = (p as typeof p & { ly: number }).ly; return `<path d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${(colX + 22).toFixed(1)} ${ly.toFixed(1)}${outside ? ` L${(colX + 4).toFixed(1)} ${ly.toFixed(1)}` : ''}"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2"/>` }).join('')
    labelsEl.querySelectorAll('.mv-label').forEach(n => n.remove())
    for (const p of pts) {
      const s = document.createElement('span'); s.className = 'mv-label' + (outside ? '' : ' is-in')
      s.textContent = LABELS[p.i][1]
      if (outside) s.style.right = `${(S - colX).toFixed(1)}px`; else s.style.left = `${(colX + 26).toFixed(1)}px`
      s.style.top = `${((p as typeof p & { ly: number }).ly - 8).toFixed(1)}px`
      labelsEl.append(s)
    }
    sim.labels = true; labelsEl.classList.add('on')
    labelAnims.forEach(a => a.cancel()); labelAnims = []
    const lines = svg.createDrawable(leaders.querySelectorAll('path'))
    const dur = opts.reduced() ? 0 : 520
    labelAnims.push(animate(lines, { draw: ['0 0', '0 1'], duration: dur, delay: opts.reduced() ? 0 : stagger(45), ease: 'inOut(2)' }))
    labelAnims.push(animate(labelsEl.querySelectorAll('.mv-label'), { opacity: [0, 1], x: [outside ? 8 : -8, 0], duration: opts.reduced() ? 0 : 360, delay: opts.reduced() ? 0 : stagger(45, { start: 240 }), ease: 'out(3)' }))
  }
  const hideLabels = () => {
    if (!sim.labels) return
    sim.labels = false; labelAnims.forEach(a => a.cancel()); labelAnims = []
    labelsEl.classList.remove('on')
  }

  const partEls = top.filter(p => p.layer > 0 && p.layer < 9 && p.id !== 'cage').map(p => p.el!)
  const buildTl = () => {
    tlS = S
    utils.set(layers, { z: (_el?: unknown, i = 0) => (i - 4.5) * S * 0.004 })
    tl = createTimeline({ autoplay: false, defaults: { ease: 'inOut(3)' }, onComplete: () => { if (sim.exploded) showLabels() } })
      .add(stack, { rotateX: 56, rotateZ: -24, scale: 0.72, duration: 950 }, 0)
      .add(layers, { z: (_el?: unknown, i = 0) => (i - 4.5) * S * 0.085, duration: 1100, ease: 'out(4)', delay: stagger(55, { from: 'center' }) }, 260)
      .add(partEls, {
        x: (el: unknown) => { const p = byId.get((el as HTMLElement).dataset.id ?? ''); return p ? (p.at[0] / 1000) * S * 0.12 : 0 },
        y: (el: unknown) => { const p = byId.get((el as HTMLElement).dataset.id ?? ''); return p ? (p.at[1] / 1000) * S * 0.12 : 0 },
        duration: 800, ease: 'out(3)', delay: stagger(24, { grid: true, from: 'center' }),
      }, 520)
  }
  const rebuildTl = () => { if (sim.exploded) return; tl?.revert(); tl = null; scope?.execute(buildTl) }

  scope = createScope({ root }).add(() => {
    for (const p of parts) if (p.rot) {
      if (p.drive === 'hair') continue
      if (p.drive === 'stem') { stemAnim = createAnimatable(p.rot as HTMLElement, { y: { duration: opts.reduced() ? 0 : 260, ease: 'out(3)' } }) as unknown as typeof stemAnim; continue }
      p.anim = createAnimatable(p.rot as HTMLElement, { rotate: 0, ease: 'linear' }) as unknown as Rot
    }
    tilt = createAnimatable(tiltEl, { rotateX: { duration: 900, ease: 'out(3)' }, rotateY: { duration: 900, ease: 'out(3)' } }) as unknown as typeof tilt
    // the crown: x mapped to rotate (winds, or sets the hands when pulled), y pulls it to the setting position; a fling, a spring release
    crownDrag = createDraggable(crownEl, {
      x: { mapTo: 'rotate', snap: 15 }, y: { snap: PULL },
      container: [-PULL, Infinity, 0, -Infinity],
      dragSpeed: 1.4,
      velocityMultiplier: opts.reduced() ? 0 : 0.6,
      releaseEase: opts.reduced() ? 'out(3)' : spring({ duration: 520, bounce: 0.16 }),
      onGrab: () => { root.classList.add('is-winding'); hover('') },
      onUpdate: d => { onCrown(d.x); onPull(d.y) },
      onSettle: d => { onCrown(d.x); onPull(d.y); root.classList.remove('is-winding') },
      onRelease: () => { window.clearTimeout(windTimer); windTimer = window.setTimeout(() => root.classList.remove('is-winding'), 700) },
    })
    // explode: tilt the stack, fan the layers along z from the centre layer outward, spread the going-train parts a little in-plane
    // (built for the size the movement has now; frame() rebuilds it when the fit changes S while the movement is assembled)
    buildTl()
    let failed = false
    if (!opts.reduced()) timer = createTimer({ autoplay: false, onUpdate: self => { if (failed) return; try { tick(self.deltaTime) } catch (e) { failed = true; console.warn('[movement] stopped', e); timer?.pause() } } })
    return () => { /* listeners are removed in dispose */ }
  })
  render(1 / 60)

  windBtn.addEventListener('click', windStep)
  explodeBtn.addEventListener('click', () => setExplode(!sim.exploded))
  loupeBtn.addEventListener('click', () => setLoupe(!sim.loupe))
  pullBtn.addEventListener('click', () => { const on = !sim.pulled; crownDrag?.setY(on ? -PULL : 0); onPull(on ? -PULL : 0) })
  stepBtn?.addEventListener('click', () => {
    // reduced motion: one beat by hand (the balance swings to the other bank, the fork crosses, the escape wheel drops half a tooth)
    if (sim.tension <= 0.01) { tip.show(stepBtn.getBoundingClientRect().left, stepBtn.getBoundingClientRect().top - 40, 'Wind it first', 'the mainspring is empty'); return }
    if (sim.pulled) return
    sim.tension = Math.max(0, sim.tension - 0.004)
    beat(); render(1 / 60)
  })
  // keyboard and screen readers: a native range (the flight and point-of-view keys ignore keys aimed at an input); raising it winds, lowering does nothing (the click holds)
  crownKey.addEventListener('input', () => {
    const want = Number(crownKey.value) / 100, d = want - sim.tension
    if (d > 0) { wind(d * FULL_WIND); const c = crownDrag; if (c) { const to = c.x + d * FULL_WIND / CROWN_TO_RATCHET; c.setX(to); sim.crown = to; knurl.style.transform = `translateX(${(((to * 0.35) % 12) + 12) % 12 - 12}px)` } }
    else crownKey.value = String(Math.round(sim.tension * 100))
    render(1 / 60)
  })
  crownEl.addEventListener('pointerenter', e => { if (sim.held && !grab) tip.show(e.clientX, e.clientY, 'The crown', sim.pulled ? 'turn it to set the hands' : 'drag sideways to wind', 'pull it up to set the hands') })
  crownEl.addEventListener('pointerleave', () => { if (!grab) tip.hide() })

  const info = () => ({ cw: +train.cw.toFixed(4), tension: +sim.tension.toFixed(3), amp: +sim.amp.toFixed(1), beats: sim.beats, wind: +sim.wind.toFixed(2), exploded: sim.exploded, running: sim.running,
    held: sim.held, pulled: sim.pulled, setCW: +sim.setCW.toFixed(3), loupe: sim.loupe, loupeOn: sim.loupeOn, labels: sim.labels, parts: parts.length, S, x: lastX, y: lastY, low: sim.low, quiet: sim.quiet,
    toothed: parts.filter(p => /pinion|wheel|barrel|centre|third|escape|ratchet|crownwheel|cannon/.test(p.id)).length + 1 })
  const angles = () => { const o: Record<string, number> = {}; for (const id of ['balance', 'pallet', 'escape', 'cage', 'third', 'centre', 'barrel', 'hand-m', 'hand-h', 'reserve', 'ratchet', 'hair-0', 'hair-3']) { const p = byId.get(id); if (p) o[id] = +angleOf(p).toFixed(4) } return o }
  ;(window as unknown as { __movement?: unknown }).__movement = {
    info, angles,
    partScreen: (id: string) => { const el = byId.get(id)?.el; const r = el?.getBoundingClientRect(); return el && r ? [r.left + r.width / 2, r.top + r.height / 2, el.offsetWidth / 2] : null },
    crownScreen: () => { const r = crownEl.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] },
    rootRect: () => { const r = root.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] },
  }

  // probes only: render the movement at another size, a movement point at the viewport centre (close-up shots at true vector detail)
  let dbg: { s: number; u: number; v: number } | null = null
  ;(window as unknown as { __movement: Record<string, unknown> }).__movement.debugZoom = (s: number, u = 0, v = 0) => { dbg = s ? { s, u, v } : null; fitKey = ''; lastS = -1 }

  // the blueprint tag stands down while the movement shows: it labels itself (hover any part), and the key figure is in the copy
  const setQuiet = (on: boolean) => { if (on === sim.quiet) return; sim.quiet = on; html.classList.toggle('ann-quiet', on) }
  /** a visit starts: the hands show the real time again, the crown is in, the movement is assembled and the spring is wound enough to run */
  const resync = () => {
    sim.setCW = ((Date.now() - mountedAt) / 60000) * 6 - train.cw
    if (sim.exploded) setExplode(false)
    if (sim.pulled) { crownDrag?.setY(0); onPull(0) }
    if (sim.tension < 0.62) sim.tension = 0.62
    for (const p of parts) p.last = undefined
    render(1 / 60)
  }
  /** the movement's box for this frame: the base size, shrunk (and slid) until crown, case, controls and note fit the lane */
  const fit = (f: MovementFrame): { s: number; cy: number; cx: number } => {
    let base = dbg ? dbg.s : sizeOf(f.phone)
    // wave 24: on a landscape window narrower than 1.55:1 the free region beside the copy lane (layout.ts freeRegion) is what the movement may use. The scope behind it stands 0.68 of
    // the window height wide, pulled back with the camera (fr.pull); the movement follows that size (sizeOf's 0.43 of the width assumed a wide window) but never outgrows the region,
    // and its centre is held inside it. The weight fr.t is 0 at 1.55:1 and wider, so those windows keep exactly the sizes and places above.
    const fr = dbg || f.phone ? null : freeRegion('watchdog')
    if (fr) base = Math.round(base + (Math.min(680, Math.round(innerHeight * 0.68 / fr.pull), Math.floor((fr.b - fr.a) * 0.96)) - base) * fr.t)
    const ln = f.lane
    if (dbg || !ln) return { s: base, cy: f.y, cx: f.x }
    const below = GAP + ctlH + noteH
    const s = Math.max(MIN_S, Math.min(base, Math.floor((ln.floor - ln.top - below) / (1 + CROWN_UP))))
    const lo = ln.top + (CROWN_UP + 0.5) * s, hi = ln.floor - below - 0.5 * s
    const cx = fr && fr.b - fr.a >= s ? f.x + (Math.min(fr.b - s / 2, Math.max(fr.a + s / 2, f.x)) - f.x) * fr.t : f.x
    return { s, cy: hi >= lo ? Math.min(hi, Math.max(lo, f.y)) : lo, cx }
  }
  return {
    info,
    frame(f) {
      sim.lastFrame = performance.now()
      sim.held = f.held; sim.present = f.present
      // the controls' and note's sizes: read once per viewport (or lane) change, never per frame
      const key = `${innerWidth}x${innerHeight}|${f.phone ? 1 : 0}|${f.lane ? Math.round(f.lane.top) + ':' + Math.round(f.lane.floor) : ''}`
      if (key !== fitKey) {
        fitKey = key; stacked = f.phone && innerWidth <= 760
        note.style.left = note.style.top = ''
        ctlH = ctl.offsetHeight || ctlH; noteH = stacked ? 0 : (note.offsetHeight || 15) + 8
        dock.style.setProperty('--ctlh', ctlH + 'px'); dock.classList.toggle('is-stacked', stacked)
        lastX = lastY = -1
      }
      const fb = fit(f), s = fb.s
      if (s !== lastS) {
        lastS = s; S = s; root.style.setProperty('--S', s + 'px'); dock.style.setProperty('--S', s + 'px')
        if (!sim.exploded && tl && tlS !== S) rebuildTl()
      }
      const x = Math.round(dbg ? innerWidth / 2 - (dbg.u / 1000 + 0.5) * S : fb.cx - S / 2), y = Math.round(dbg ? innerHeight / 2 - (dbg.v / 1000 + 0.5) * S : fb.cy - S / 2)
      if (Math.abs(x - lastX) > 0.5 || Math.abs(y - lastY) > 0.5) {
        lastX = x; lastY = y
        const tr = `translate3d(${x}px,${y}px,0)`
        root.style.transform = tr; dock.style.transform = tr
        // phone: the note hangs in the box's top-left corner, at the page margin (the controls fill the band under the case)
        if (stacked) { note.style.left = `${16 - x}px`; note.style.top = '6px' }
      }
      const o = Math.round(f.present * 100) / 100
      if (o !== lastO) {
        const wasOff = lastO <= 0.001
        lastO = o
        root.style.opacity = dock.style.opacity = String(o)
        root.style.visibility = dock.style.visibility = o > 0.001 ? 'visible' : 'hidden'
        if (wasOff && o > 0.001) resync()
        setQuiet(o > 0.02)
      }
      root.classList.toggle('is-held', f.held); dock.classList.toggle('is-held', f.held)
      if (!f.held && sim.hoveredKey) hover('')
      if (!f.held && sim.loupe) setLoupe(false)
      const run = o > 0.001 && sim.onScreen && !document.hidden && !opts.reduced()
      setRunning(run)
    },
    leave() {
      sim.held = false; sim.present = 0
      root.classList.remove('is-held'); dock.classList.remove('is-held')
      if (grab) { grab = null; sim.dragging = null; root.classList.remove('is-grabbing') }
      hover(''); if (sim.loupe) setLoupe(false)
      root.style.opacity = dock.style.opacity = '0'; root.style.visibility = dock.style.visibility = 'hidden'; lastO = 0
      setRunning(false); setQuiet(false); tip.hide()
    },
    dispose() {
      window.clearTimeout(touchTimer); window.clearTimeout(windTimer)
      timer?.pause(); scope?.revert(); crownDrag?.revert(); tl?.revert(); beatAnim?.cancel(); forkAnim?.cancel(); coastAnim?.cancel(); snapAnim?.cancel(); windAnim?.cancel(); labelAnims.forEach(a => a.cancel())
      io?.disconnect()
      root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onUp); root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerover', onOver); window.removeEventListener('pointermove', onWinMove)
      root.removeEventListener('touchstart', onTouchStart); root.removeEventListener('touchmove', onTouchMove)
      setQuiet(false); html.classList.remove('mv-loupe-on')
      tip.hide(); tipNode?.remove(); tipNode = null
      root.remove(); dock.remove()
      delete (window as unknown as { __movement?: unknown }).__movement
      void stage
    },
  }
}

// a tooltip in the stage-tip style (shared look), accent = Systems vermilion: the part's watch name, then the job, then its schedule.
// Its box is measured once per change of content (never on a pointer move). 'cursor' hangs it beside the pointer, 'above' over a fingertip, 'centre' centres it on x.
type TipMode = 'cursor' | 'above' | 'centre'
let tipNode: HTMLDivElement | null = null
function tipEl(avoid?: () => DOMRect[]) {
  if (!tipNode) { tipNode = document.createElement('div'); tipNode.className = 'mv-tip'; tipNode.setAttribute('data-proof', 'skip'); tipNode.setAttribute('aria-hidden', 'true'); document.body.append(tipNode) }
  const el = tipNode
  let w = 160, h = 34
  return {
    show(x: number, y: number, title: string, sub?: string, sched?: string, mode: TipMode = 'cursor') {
      const k = title + '|' + (sub ?? '') + '|' + (sched ?? '')
      if (el.dataset.k !== k) {
        el.dataset.k = k; el.innerHTML = '<b></b><span></span><i></i>'
        const [b, s, i] = el.children as unknown as HTMLElement[]
        b.textContent = title; s.textContent = sub ?? ''; i.textContent = sched ?? ''
        s.style.display = sub ? '' : 'none'; i.style.display = sched ? '' : 'none'
        w = el.offsetWidth || w; h = el.offsetHeight || h
      }
      const floor = innerWidth <= 760 ? innerHeight - 84 : innerHeight - 8
      const left = mode === 'cursor' ? x + 18 : x - w / 2
      const top = mode === 'above' ? y - h - 28 : mode === 'centre' ? y : y + 20
      const L = Math.round(Math.max(8, Math.min(innerWidth - w - 8, left)))
      let T = Math.round(Math.max(8, Math.min(floor - h, top)))
      // touch tips and phone tips: clear of the controls and the note. Over a rect, the tip moves to whichever side of it is nearer and still on screen
      if (avoid && (mode !== 'cursor' || innerWidth <= 760)) {
        const GAP = 8, rs = avoid().filter(r => r.width > 2 && r.height > 2 && r.right > 0 && r.left < innerWidth)
        for (let pass = 0; pass < 3; pass++) {
          const hit = rs.find(r => L < r.right + GAP && L + w > r.left - GAP && T < r.bottom + GAP && T + h > r.top - GAP)
          if (!hit) break
          const up = hit.top - GAP - h, down = hit.bottom + GAP
          const okUp = up >= 8, okDown = down + h <= floor
          T = okUp && (!okDown || Math.abs(up - T) <= Math.abs(down - T)) ? up : okDown ? down : Math.max(8, Math.min(floor - h, up))
        }
      }
      el.style.transform = `translate(${L}px,${Math.round(T)}px)`
      el.classList.add('on')
    },
    hide() { el.classList.remove('on') },
  }
}
