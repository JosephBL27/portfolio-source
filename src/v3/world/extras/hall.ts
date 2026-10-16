// UNIT 10H / w11: the hall. One gothic reading hall stands off the About ring, between Education and the interests: you arrive at its CLOSED doors (the gate), the doors
// piece (transitions/doors.ts) opens them and walks you in, and you stand mid-nave looking at five stained-glass windows. The windows ARE the interests (climbing, board games,
// records, guitar, chess):
//   * hover a window: it glows (its coloured shaft and floor patch strengthen), its label lifts, a caption appears
//   * click, tap or press Enter on it: the camera dives INTO its glass, a flood of its light expands, and at full cover the visit cuts to that interest's own space (hall/dive.ts)
//   * keep scrolling: the camera leaves through the far doors (transitions/exit.ts) to the interests, in order
// The interests are NOT in the hall any more: the hall draws nothing at the interest spaces (another package builds those).
//
// This extra owns WHEN the room shows (a pure function of the flight), the pointer, the labels under the windows, the caption, the hint, the keyboard route and the dive.
// The room itself is hall/rig.ts, built once and shared with the two set pieces. Contract: install(ctx) -> { update, adjustCam }. ?extras=-hall switches it off.
// window.__hall = { rig, state, hover, INTERESTS, dive(i) } for tests.
// Reduced motion: the room shows at its waypoints, the doors stand open, no drift in the dust or the shafts, the dive is a 0.25 s crossfade. Phones: no set pieces (the gate
// crossfades into the hall, the hall fades out), taps dive, the lens widens in portrait.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { WAYPOINTS, hallStopX } from '../layout'
import { monoCubic, waypointP, type FlightState } from '../flight'
import { extraOn, isOn, isPhone, reducedMotion, timed } from './lib/flags'
import { TIMING } from './transitions'
import { INTERESTS, getRig, type HallFrame } from './hall/rig'
import { Lane } from './lib/lane'
import { WIN } from './hall/material'
import { L } from './hall/shell'
import { DRAIN_S, FADE_S, HOLD_MAX_S, HOLD_MIN_S, PUSH_PHONE_S, PUSH_S, createFlood, easeInCubic, pushK, type DiveRun } from './hall/dive'
import './hall/hall.css'
import { installCapture } from './hall/capture'
import { hallWalk } from './hall/walk'

const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const idx = (id: string) => WAYPOINTS.findIndex(w => w.id === id)
type V3W = { __v3?: { follower?: { jump?: unknown; snap?(p: number): void }; state?(): FlightState; caseView?: { isOpen?(): boolean } }; __tr?: { pieces: Map<string, { built: boolean }> } }
const w3 = () => window as unknown as V3W
const HINT = 'Choose a window, or keep scrolling through the far doors'
const HINT_TOUCH = 'Tap a window to light it, tap again to step through'   // coarse pointers: a first tap lights the window (there is no hover), a second tap on it steps through

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('hall') || !ctx.field?.scene) return
  const hallMode = new URLSearchParams(location.search).get('hall')
  if (hallMode === 'capture') return installCapture(ctx)
  const iHall = idx('hall'), iHold = idx('hold'), iKnight = idx('knight'), iEpi = idx('epilogue')
  const iGate = idx('gate') >= 0 ? idx('gate') : idx('instrument')   // w11: the doors start at the gate; before the flow package lands, at the compass
  if (iHall < 0 || iHold < 0 || iKnight < 0 || iGate < 0) return
  const LEG_IN = `${WAYPOINTS[iGate].id}>hall`, LEG_OUT = 'hall>hold'
  const field = ctx.field, scene: THREE.Scene = field.scene, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera
  const rig = getRig(), html = document.documentElement
  const walk = ctx.canvas ? hallWalk(ctx.canvas, camera, rig, () => isOn('hall') && liveHall && !dive && !blocked()) : null
  if (walk) field.onAfterCamera(() => walk.apply())
  const lane = new Lane(), res = new THREE.Vector2(1440, 900)
  const warpOf = (key: string) => { const w = TIMING[key]?.warp; return w ? monoCubic(w.map(k => k[0]), w.map(k => k[1])) : (x: number) => x }
  const warpIn = warpOf(LEG_IN), warpOut = warpOf(LEG_OUT)
  const env = { scene, renderer, camera, lane, res, q: { shadows: true, dust: false, reflect: true } }

  // ---- DOM: the labels under the windows, the caption, the hint, the keyboard route, the flood
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string, cls?: string) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e }
  const cap = mk('div', 'hall-cap'); cap.setAttribute('aria-hidden', 'true')
  const capB = mk('b'), capS = mk('span'), capI = mk('i')
  cap.append(capB, capS, capI)
  // coarse pointer: the platform says so, or the device has a touch screen at all (a finger on the page sets it too); a hybrid laptop keeps the tap wording
  const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches
  let touchy = mq('(pointer: coarse)') || mq('(any-pointer: coarse)') || (navigator.maxTouchPoints ?? 0) > 0
  let litTouch = -1                    // the window a first tap has lit
  const hint = mk('div', 'hall-hint'); hint.textContent = touchy ? HINT_TOUCH : HINT; hint.setAttribute('aria-hidden', 'true')
  const labs = mk('div', 'hall-labs'); labs.setAttribute('aria-hidden', 'true'); labs.hidden = true
  const labEls = INTERESTS.map((it, i) => {
    const e = mk('div', undefined, 'hall-lab'), b = mk('b'), sep = mk('i'), v = mk('span')
    b.textContent = it.label; sep.textContent = ' · '; v.textContent = it.short ?? ''
    e.append(b, sep, v); e.dataset.i = String(i)
    const c = it.light; e.style.setProperty('--hc', `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`)
    labs.append(e); return e
  })
  // five visually hidden buttons: focusable only while the hall is live; Enter or Space starts the dive
  const keys = mk('div', 'hall-keys'); keys.hidden = true
  const keyEls = INTERESTS.map((it, i) => {
    const b = mk('button', undefined, 'hall-key'); b.type = 'button'; b.textContent = `Step through the ${it.label} window`
    b.addEventListener('focus', () => { focusIdx = i; lastAct = performance.now() })
    b.addEventListener('blur', () => { if (focusIdx === i) focusIdx = -1 })
    b.addEventListener('click', e => { e.preventDefault(); startDive(i) })
    keys.append(b); return b
  })
  const flood = createFlood()
  document.body.append(cap, hint, labs)
  // the keyboard route comes right after the skip link, so a Tab in the hall reaches the windows before the long project index (it is [hidden] outside the hall)
  const skip = document.querySelector('a.skip')
  if (skip?.parentNode === document.body) skip.after(keys); else document.body.prepend(keys)

  // ---- when does the room show? a pure function of the flight
  const piece = (key: string) => w3().__tr?.pieces.get(key)
  const live = (key: string) => extraOn('transitions') && isOn('transitions') && !reducedMotion() && !isPhone() && !w3().__v3?.follower?.jump && !!piece(key)?.built
  interface Pres { hallIn: number; facadeIn: number; u: number | null; exit: number | null; labels: number }
  const presence = (st: FlightState): Pres => {
    const a = st.wp, b = st.next
    if (st.dwelling) {
      if (a === iGate) return { hallIn: 0, facadeIn: 1, u: 0, exit: null, labels: 0 }
      if (a === iHall) return { hallIn: 1, facadeIn: extraOn('transitions') && !reducedMotion() && !isPhone() ? 1 : 0, u: 1, exit: null, labels: 1 }
      return { hallIn: 0, facadeIn: 0, u: null, exit: null, labels: 0 }
    }
    if (a === iGate - 1 && b === iGate) { const k = sstep(0.35, 0.85, st.t); return { hallIn: 0, facadeIn: k, u: 0, exit: null, labels: 0 } }
    if (a === iGate && b === iHall) {
      if (live(LEG_IN)) {
        const u = Math.min(1, Math.max(0, warpIn(st.raw)))
        // the interior stays hidden until the leaves part; the facade is whole all the way through
        return { hallIn: sstep(0.12, 0.42, u), facadeIn: 1, u, exit: null, labels: sstep(0.82, 0.98, u) }
      }
      const k = reducedMotion() ? 1 : sstep(0.4, 0.85, st.t)       // no set piece: the gate crossfades into the hall
      return { hallIn: k, facadeIn: 1 - k, u: 0, exit: null, labels: sstep(0.7, 0.95, st.t) }
    }
    if (a === iHall && b === iHold) {
      if (live(LEG_OUT)) {
        const u = Math.min(1, Math.max(0, warpOut(st.raw)))
        const k = 1 - sstep(0.7, 0.92, u)                           // the room fades out once the camera has passed the far doors
        return { hallIn: k, facadeIn: k, u: 1, exit: u, labels: 1 - sstep(0.02, 0.16, u) }
      }
      const k = 1 - sstep(0.15, 0.7, st.t)
      return { hallIn: k, facadeIn: 0, u: 1, exit: null, labels: 1 - sstep(0.02, 0.3, st.t) }
    }
    return { hallIn: 0, facadeIn: 0, u: null, exit: null, labels: 0 }
  }

  // ---- pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  let px = -1, py = -1, pdx = 0, pdy = 0, pt = 0, downOn = -1, hoverIdx = -1, focusIdx = -1, dirty = false, lastPick = 0, lastAct = performance.now()
  const hover = [0, 0, 0, 0, 0], active = [0, 0, 0, 0, 0], glint = [0, 0, 0, 0, 0]
  const canvas = ctx.canvas
  const blocked = () => html.classList.contains('in-index') || html.classList.contains('is-loading') || !!w3().__v3?.caseView?.isOpen?.()
  let liveHall = false // standing in the hall at its dwell, windows pickable
  let dive: DiveRun | null = null
  const pickAt = (x: number, y: number): number => {
    if (!canvas || !rig.built || !rig.root.visible) return -1
    const rc = canvas.getBoundingClientRect()
    if (x < rc.left || x > rc.right || y < rc.top || y > rc.bottom) return -1
    ndc.set(((x - rc.left) / rc.width) * 2 - 1, -(((y - rc.top) / rc.height) * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(rig.proxies, false)[0]
    return hit ? (hit.object.userData.win as number) : -1
  }
  window.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; px = e.clientX; py = e.clientY; dirty = true; lastAct = performance.now() }, { passive: true })
  document.addEventListener('pointerleave', () => { px = py = -1; dirty = true })
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchy = true; pdx = e.clientX; pdy = e.clientY; pt = performance.now(); downOn = liveHall && !dive && !blocked() ? pickAt(e.clientX, e.clientY) : -1 }, { passive: true })
  window.addEventListener('pointerup', e => {
    if (downOn < 0 || !liveHall || dive) { if (e.pointerType === 'touch' && downOn < 0) litTouch = -1; return }          // a tap on bare wall puts the light out
    const moved = Math.hypot(e.clientX - pdx, e.clientY - pdy), dt = performance.now() - pt
    const still = pickAt(e.clientX, e.clientY)
    if (moved < 9 && dt < 900 && still === downOn) {
      if (e.pointerType === 'touch' && litTouch !== downOn) { litTouch = downOn; lastAct = performance.now(); ctx.emit('hall:hover', { i: downOn, id: INTERESTS[downOn].id }) }   // first tap: light it
      else { litTouch = -1; startDive(downOn) }                                                                                                                         // mouse click, or the second tap: step through
    }
    downOn = -1
  }, { passive: true })

  // ---- the dive: push at the glass, flood, cut to the interest, drain
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3()
  const diveGoal = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }
  const screenOf = (w: THREE.Vector3, out: { x: number; y: number }) => { v3.copy(w).project(camera); out.x = (v3.x * 0.5 + 0.5) * innerWidth; out.y = (1 - (v3.y * 0.5 + 0.5)) * innerHeight }
  function startDive(i: number) {
    if (dive || !liveHall || blocked()) return
    const target = idx(INTERESTS[i].id)
    if (target < 0) return
    const rm = reducedMotion(), pt0 = { x: 0, y: 0 }
    rig.root.updateMatrixWorld(true)
    screenOf(rig.toWorld(hallStopX(i), WIN.sill + WIN.h * 0.35, L - 0.5, v3b), pt0)
    // the glass fills the frame: the camera stops two units before the window's picture, on its axis
    rig.toWorld(hallStopX(i), WIN.sill + WIN.h * 0.35, L - 2.1, diveGoal.pos); rig.toWorld(hallStopX(i), WIN.sill + WIN.h * 0.35, L, diveGoal.tgt)
    dive = { i, phase: 'push', t0: performance.now(), tCut: 0, tDrain: 0, push: rm ? FADE_S : isPhone() ? PUSH_PHONE_S : PUSH_S, x: pt0.x, y: pt0.y, reduced: rm, target }
    html.classList.add('hall-diving')
    keyEls[i].blur()
    ctx.emit('hall:dive', { i })
  }
  const cut = (d: DiveRun, now: number) => {
    d.phase = 'wait'; d.tCut = now
    ;(ctx.ui as { nav?: { go?: (t: string) => boolean } } | null)?.nav?.go?.(INTERESTS[d.i].id)
    w3().__v3?.follower?.snap?.(waypointP(d.target))
  }
  const diveStep = (now: number) => {
    const d = dive; if (!d) { if (flood.on) flood.hide(); return }
    const rgb = INTERESTS[d.i].light
    if (d.phase === 'push' && pushK(d, now) >= 1) cut(d, now)
    else if (d.phase === 'wait') {
      const st = w3().__v3?.state?.(), at = !!st && st.dwelling && st.wp === d.target, since = (now - d.tCut) / 1000
      if ((at && since >= HOLD_MIN_S) || since >= HOLD_MAX_S) { d.phase = 'drain'; d.tDrain = now }
    }
    if (d.phase === 'drain' && (now - d.tDrain) / 1000 >= (d.reduced ? FADE_S : DRAIN_S)) { dive = null; flood.hide(); html.classList.remove('hall-diving'); lastAct = now; return }
    flood.show(d, now, rgb)
  }

  // ---- labels, caption, hint: placed under the windows, projected every frame
  const lp = { x: 0, y: 0 }, labPos = [0, 0, 0, 0, 0].map(() => ({ x: 0, y: 0 })), labW = [0, 0, 0, 0, 0]
  let capIdx = -1, labA = 0, labBottom = 0
  const setCap = (i: number) => {
    if (i === capIdx) return
    capIdx = i
    if (i >= 0) {
      const it = INTERESTS[i]
      capB.textContent = it.label; capS.textContent = it.fact ?? ''
      const c = it.light; cap.style.setProperty('--hc', `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`)
    }
    cap.classList.toggle('on', i >= 0)
  }
  /** keep a caption clear of the copy lane (the side of the screen that carries the title and body): legibility first */
  const clearOfLane = (x: number, half: number) => {
    const sd = lane.u.x, edge = lane.u.y
    if (Math.abs(sd) < 0.5 || lane.u.w > 0.5) return x
    const px = ((sd < 0 ? edge : -edge) + 1) / 2 * innerWidth
    return sd < 0 ? Math.max(x, px + half) : Math.min(x, innerWidth - px - half)
  }
  const placeLabels = () => {
    const phone = innerWidth <= 760, W = innerWidth
    // x under each window, clamped into the screen, then spread so no two labels touch (a phone fits five two-line labels across 390 px)
    for (let i = 0; i < 5; i++) {
      screenOf(rig.toWorld(hallStopX(i), WIN.sill - 0.12, L - 0.62, v3b), lp)
      // A first-person turn can put a portal behind the eye; projected labels must not
      // reappear clamped to the opposite screen edge.
      labEls[i].style.visibility = v3.z < -1 || v3.z > 1 || lp.x < -60 || lp.x > W + 60 ? 'hidden' : ''
      labW[i] = labEls[i].offsetWidth || (phone ? 70 : 140)
      labPos[i].x = lp.x; labPos[i].y = Math.min(innerHeight - 160, Math.max(70, lp.y))
    }
    const gap = 4
    for (let i = 0; i < 5; i++) labPos[i].x = Math.min(W - labW[i] / 2 - gap, Math.max(labW[i] / 2 + gap, labPos[i].x))
    for (let i = 1; i < 5; i++) labPos[i].x = Math.max(labPos[i].x, labPos[i - 1].x + (labW[i - 1] + labW[i]) / 2 + gap)
    for (let i = 3; i >= 0; i--) labPos[i].x = Math.min(labPos[i].x, labPos[i + 1].x - (labW[i + 1] + labW[i]) / 2 - gap)
    let bottom = 0
    for (let i = 0; i < 5; i++) {
      labEls[i].style.transform = `translate(${labPos[i].x.toFixed(1)}px, ${labPos[i].y.toFixed(1)}px) translate(-50%, 0)`
      bottom = Math.max(bottom, labPos[i].y + (phone ? 34 : 22))
    }
    labBottom = bottom
    labs.style.opacity = labA.toFixed(3)
  }

  // ---- build: when the flight is within three waypoints of the gate, or at once if a jump lands here
  let building = false, owning = false, glintT0 = -1, glintKind: 'first' | 'idle' = 'first', glintDone = false
  const state = { hallIn: 0, facadeIn: 0, u: null as number | null, exit: null as number | null, hover: -1, live: false }
  const frame: HallFrame = { t: 0, dt: 0, copy: 0, hallIn: 0, facadeIn: 0, u: null, exit: null, hover, active, glint, dive: null, reduced: false }
  const camV = new THREE.Vector3()

  const step = (t: number, dt: number, st: FlightState) => {
    const now = performance.now()
    const wpF = st.dwelling ? st.wp : st.wp + st.t
    if (!rig.built && !building && wpF > iGate - 3.2 && wpF < iEpi + 0.5) {
      building = true
      try { rig.build(env); void renderer.compileAsync(scene, camera).catch(() => {}) } catch (e) { console.warn('[hall] build failed', e) }
    }
    if (!rig.built) return
    if (!rig.glassDone || rig.photoPending) rig.pump(3)
    renderer.getDrawingBufferSize(res); rig.viewH = res.y; lane.update(st, dt)
    const rm = reducedMotion()
    const p = presence(st)
    liveHall = st.dwelling && st.wp === iHall && p.hallIn > 0.97 && !blocked()
    if (liveHall && !glintDone) { glintDone = true; glintT0 = now; glintKind = 'first'; lastAct = now } // first arrival: one line of light from window to window
    // hover: from the pointer (moves, and the camera drifts), throttled
    if (dirty || (liveHall && t - lastPick > 0.05)) { dirty = false; lastPick = t; hoverIdx = liveHall && !dive && px >= 0 ? pickAt(px, py) : -1 }
    if (!liveHall || dive) hoverIdx = -1
    if (!liveHall || dive) litTouch = -1
    const shown = hoverIdx >= 0 ? hoverIdx : liveHall && !dive ? (litTouch >= 0 ? litTouch : focusIdx) : -1
    const want = touchy ? HINT_TOUCH : HINT; if (hint.textContent !== want) hint.textContent = want
    const k = 1 - Math.exp(-dt / 0.14)
    for (let i = 0; i < 5; i++) hover[i] += ((i === shown || (dive && dive.i === i) ? 1 : 0) - hover[i]) * k
    html.classList.toggle('hall-hover', hoverIdx >= 0)
    if (hoverIdx !== state.hover) { state.hover = hoverIdx; if (hoverIdx >= 0) { lastAct = now; ctx.emit('hall:hover', { i: hoverIdx, id: INTERESTS[hoverIdx].id }) } }
    if (keys.hidden === liveHall) keys.hidden = !liveHall
    // the travelling glint: a line of light from window to window once on first arrival, a slow shimmer across all five after ~7 s idle
    if (liveHall && !dive && glintT0 < 0 && shown < 0 && now - lastAct > 7000) { glintT0 = now; glintKind = 'idle' }
    for (let i = 0; i < 5; i++) glint[i] = 0
    if (glintT0 >= 0 && !rm) {
      const tt = (now - glintT0) / 1000, first = glintKind === 'first', step = first ? 0.26 : 0.42, wid = first ? 0.34 : 0.8, amp = first ? 1 : 0.7
      for (let i = 0; i < 5; i++) { const x = (tt - 0.15 - i * step) / wid; glint[i] = amp * Math.exp(-x * x * 2) }
      if (tt > 0.15 + 4 * step + wid * 3) { glintT0 = -1; lastAct = now }
    }
    // labels: always on at the hall dwell, projected every frame; the hovered one lifts
    const labTarget = blocked() ? 0 : p.labels
    labA += (labTarget - labA) * (1 - Math.exp(-dt / 0.2))
    labs.hidden = labA < 0.01
    if (!labs.hidden) {
      placeLabels()
      for (let i = 0; i < 5; i++) labEls[i].classList.toggle('hot', i === shown || (dive?.i === i))
    }
    setCap(shown >= 0 ? shown : -1)
    if (shown >= 0 && !labs.hidden) {
      const phone = innerWidth <= 760
      cap.style.transform = `translate(${(phone ? labPos[shown].x : clearOfLane(labPos[shown].x, 110)).toFixed(0)}px, ${(labPos[shown].y + (phone ? 40 : 26)).toFixed(0)}px) translate(-50%, 0)`
    }
    // the hint: a pill under the labels (below the windows on a phone), never over one
    const hintOn = liveHall && !dive && shown < 0 && st.local > 0.08 && !labs.hidden
    hint.classList.toggle('on', hintOn)
    if (hintOn || hint.classList.contains('on')) {
      const phone = innerWidth <= 760, safe = 0
      let y = labBottom + (phone ? 20 : 70)
      y = Math.min(y, innerHeight - (phone ? 72 + 56 + safe : 112))
      hint.style.top = Math.max(0, y).toFixed(0) + 'px'
    }
    const copy = st.dwelling ? 1 : st.t < 0.5 ? st.overlayOut : st.overlayIn
    const dk = dive && dive.phase === 'push' ? pushK(dive, now) : dive ? 1 : 0
    frame.t = t; frame.dt = dt; frame.copy = rm ? 1 : copy * (1 - 0.8 * dk); frame.hallIn = p.hallIn; frame.facadeIn = p.facadeIn; frame.u = p.u; frame.exit = p.exit; frame.reduced = rm
    frame.dive = dive ? { i: dive.i, k: dk } : null
    state.hallIn = p.hallIn; state.facadeIn = p.facadeIn; state.u = p.u; state.exit = p.exit; state.live = liveHall
    camV.copy(camera.position)
    rig.root.updateMatrixWorld(true)
    rig.frame(frame, camV)
    diveStep(now)
    // the particle dust behind the room dims while the room is present (the lowest request wins; one release when it leaves)
    const present = Math.max(p.hallIn, p.facadeIn) > 0.01
    if (present) { field.setFieldAlpha?.(1 - Math.max(p.hallIn, p.facadeIn)); owning = true } else if (owning) { field.setFieldAlpha?.(1); owning = false }
  }
  const timedStep = timed('hall', step)
  ;(window as unknown as { __hall?: unknown }).__hall = { rig, state, hover, glint, INTERESTS, walk, dive: (i: number) => startDive(i), get diving() { return dive } }
  // portrait: the five windows need a wider lens to stand in a phone's width (the waypoint's `back` can only move the camera, and behind it is the door)
  const fovW = (st: FlightState) => {
    if (st.dwelling) return st.wp === iHall ? 1 : 0
    if (st.wp === iHall) return 1 - sstep(0.15, 0.6, st.t)
    if (st.next === iHall) return sstep(0.4, 0.95, st.t)
    return 0
  }
  return {
    adjustCam(cam, dt, st) {
      if (!isOn('hall')) return
      const flightCam = cam
      cam = walk?.adjust(cam, dt, st, iHall) ?? cam
      let pos = cam.pos, target = cam.target, fov = cam.fov, changed = cam !== flightCam
      const a = innerWidth / Math.max(1, innerHeight)
      if (a < 0.95) {
        const k = Math.min(1, (0.95 - a) / 0.35) * fovW(st)
        if (k > 0.002) { fov = cam.fov + (84 - cam.fov) * k; changed = true }
      }
      const d = dive
      if (d && d.phase === 'push' && !d.reduced && rig.built) {
        const e = easeInCubic(pushK(d, performance.now()))
        pos = [pos[0] + (diveGoal.pos.x - pos[0]) * e, pos[1] + (diveGoal.pos.y - pos[1]) * e, pos[2] + (diveGoal.pos.z - pos[2]) * e]
        target = [target[0] + (diveGoal.tgt.x - target[0]) * e, target[1] + (diveGoal.tgt.y - target[1]) * e, target[2] + (diveGoal.tgt.z - target[2]) * e]
        fov -= 6 * e; changed = true
      }
      return changed ? { pos, target, fov } : undefined
    },
    update(t, dt, st) { if (!isOn('hall')) { if (rig.built) rig.root.visible = false; if (owning) { field.setFieldAlpha?.(1); owning = false } return } timedStep(t, dt, st) },
  }
}
