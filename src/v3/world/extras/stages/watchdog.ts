// STAGE "watchdog" (Job Watchdog): a pointer layer over the radar form. It owns no meshes; the scope is particles (forms/watchdog.ts) and this file is only the hit test and the tip.
//   hover  within 22 px of a projected blip (30 px for a finger) the stage tip names that blip's state in plain words (no digits, no job names); the blip and its strip cell brighten
//   click  pings the blip: the shader re-fires its flash, ping ring and strip pulse from that moment, a DOM ripple spreads from it, and the stage emits 'sig.watchdog' once
//   touch  a tap is hover + ping (stages.ts shows the tip at the finger first, then calls down())
//   keys   a hidden button steps through the blips and pings each in turn, so the scope is not mouse-only
// The blip positions come from forms/watchdog.ts (blipWorld: the shader's tilt and placement, replayed in JS) and are projected with the engine's field.project every time they are needed.
// Reduced motion: the form's heartbeat is switched off (watchdogUniforms.pulse = 0); a click still answers, with a still ring that fades.
// THE MOVEMENT (wave 24, round 7): the stop is a watch, standing alone on deep black. By default it is the three.js movement (./movement3d/movement3d.ts: a skeleton
// movement with a flying tourbillon, MeshPhysicalMaterial finishes, anime.js kinematics) built into this stage's root as soon as the stage builds (two stops ahead) and
// compiled before arrival. It takes the pointer first (hover names a part and its job, a drag back-drives the train); a press it does not use falls through to the
// blips. The DOM + SVG movement (./movement/movement.ts) is the fallback: ?movement=svg, no WebGL2, or a failed 3D build. ?movement=0 turns both off.
// THE RADAR IS GONE while a movement is up: dust 0 hides the particle form (rings, sweep, blips, the green status strip, the heartbeat trace and the dust) the way the
// chalkboard hides its form; the copy and its numbers stay. With ?movement=0 (or if both movements fail) the scope is the picture again, with its blip layer.
// FIT: update() hands the movement a lane {top, floor}: on a desktop it runs from the HUD's foot to the bottom pill; on a phone it is the band between the copy's
// title and its info block, measured from the overlay once per viewport size. The movement shrinks and slides to fit, so the copy never lands on the controls.
import * as THREE from 'three'
import { WAYPOINTS } from '../../layout'
import { blipState, blipsLocal, blipWorld, watchdogUniforms, type Blip } from '../../../forms/watchdog'
import { sstep, srAction, stageTip, type StageBuildCtx, type StageDef, type StageFrame } from './common'
import type { MovementHandle } from './movement/movement'
import type { Mv3Handle } from './movement3d/movement3d'

const HOVER_PX = 22, TOUCH_PX = 30
const WANT_MOVEMENT = typeof location === 'undefined' || !/[?&]movement=0\b/.test(location.search)
const WANT_SVG = typeof location !== 'undefined' && /[?&]movement=svg\b/.test(location.search)
const ACCENT = { fresh: '#5dff8d', stale: '#ffb347', paused: '#8fa9d8', credential: '#9ad8ff' } as const

let rippleStyled = false
/** a ring that spreads from (x, y) and fades; a DOM node outside every proofread subtree */
function ripple(x: number, y: number, color: string, still: boolean) {
  if (!rippleStyled) {
    rippleStyled = true
    const st = document.createElement('style')
    st.textContent = '.wd-ripple{position:fixed;left:0;top:0;z-index:69;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:1.5px solid var(--rc,#5dff8d);box-shadow:0 0 14px var(--rc,#5dff8d),inset 0 0 10px var(--rc,#5dff8d);opacity:0;will-change:transform,opacity}'
    document.head.append(st)
  }
  const el = document.createElement('div'); el.className = 'wd-ripple'; el.setAttribute('data-proof', 'skip'); el.setAttribute('aria-hidden', 'true')
  el.style.setProperty('--rc', color); el.style.left = x + 'px'; el.style.top = y + 'px'
  document.body.append(el)
  const k = still
    ? [{ opacity: 0.9, transform: 'scale(1.1)' }, { opacity: 0, transform: 'scale(1.1)' }]
    : [{ opacity: 0.95, transform: 'scale(0.3)' }, { opacity: 0.55, transform: 'scale(1.5)', offset: 0.45 }, { opacity: 0, transform: 'scale(2.9)' }]
  const a = el.animate(k, { duration: still ? 380 : 820, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' })
  a.onfinish = () => el.remove()
  a.oncancel = () => el.remove()
}

export default {
  id: 'watchdog',
  build(c: StageBuildCtx) {
    const blips = blipsLocal()
    const wp = WAYPOINTS[c.wp], pl = wp.place
    const root = new THREE.Group()
    const tip = stageTip()
    const proj = new THREE.Vector3(), pt: [number, number, number] = [0, 0, 0]
    const fieldProject = (p: [number, number, number]): { x: number; y: number; visible: boolean } => {
      const f = (window as unknown as { __v3?: { field?: { project?(p: [number, number, number]): { x: number; y: number; visible: boolean } } } }).__v3?.field
      if (f?.project) return f.project(p)
      c.camera.updateMatrixWorld(); proj.set(p[0], p[1], p[2]).project(c.camera)
      const r = c.renderer.domElement.getBoundingClientRect()
      return { x: (proj.x * 0.5 + 0.5) * r.width, y: (-proj.y * 0.5 + 0.5) * r.height, visible: proj.z > -1 && proj.z < 1 }
    }
    // the canvas is fixed and fills the window: its place is read once per window size (a pointer move asks for 24 blips, every frame asks once)
    let rect = { left: 0, top: 0 }, rectKey = ''
    const canvasRect = () => {
      const k = innerWidth + 'x' + innerHeight
      if (k !== rectKey) { rectKey = k; const r = c.renderer.domElement.getBoundingClientRect(); rect = { left: r.left, top: r.top } }
      return rect
    }
    // client position of a blip (field.project is relative to the canvas's top-left corner)
    const screenOf = (b: Blip) => {
      const r = canvasRect()
      const q = fieldProject(blipWorld(b, pl, pt))
      return { x: r.left + q.x, y: r.top + q.y, visible: q.visible }
    }
    // the band the movement and its controls may use (see FIT above); measured once per window size
    let lane: { top: number; floor: number } | null = null, laneKey = ''
    const laneOf = () => {
      const k = innerWidth + 'x' + innerHeight
      if (lane && k === laneKey) return lane
      const W = innerWidth, H = innerHeight
      let top = 70, floor = H - 80, laid = true        // desktop: from the HUD's foot to above the bottom pill (no scope strip any more)
      if (W <= 760 || W < H * 0.85) {                 // a phone, or any portrait window: the copy stacks under the title (ui/overlays.ts), so the lane is the band between them
        const ov = document.getElementById('ov-watchdog')
        const head = ov?.querySelector<HTMLElement>('.head'), info = ov?.querySelector<HTMLElement>('.info')
        const t = head ? head.offsetTop + head.offsetHeight : 0, b = info ? info.offsetTop : 0
        laid = t > 0 && b > 0
        top = t > H * 0.15 && t < H * 0.5 ? t : Math.round(H * 0.27)
        floor = (b > H * 0.5 && b < H * 0.92 ? b : Math.round(H * 0.64)) - 8
      }
      lane = { top, floor }; laneKey = laid ? k : ''      // not laid out yet: measure again next frame
      return lane
    }
    let clock = 0, reduced = false, hovered: Blip | null = null, nextKey = 0
    let mv: MovementHandle | null = null, mvLoading = false
    // the 3D movement: start building now (lazy chunk, async, compiled when done); any failure falls back to the SVG movement
    let mv3: Mv3Handle | null = null, mv3State: 'off' | 'building' | 'ready' | 'failed' = 'off'
    const rmNow = () => reduced || document.documentElement.classList.contains('rm') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (WANT_MOVEMENT && !WANT_SVG && c.renderer.capabilities.isWebGL2) {
      mv3State = 'building'
      import('./movement3d/movement3d')
        .then(m => m.buildMovement3D({ renderer: c.renderer, camera: c.camera, scene: c.scene, env: c.env, root, view: c.view, emit: (n, d) => c.emit(n, d), reduced: rmNow, prewarm: o => c.prewarm(o) }))
        .then(h => { mv3 = h; mv3State = 'ready' })
        .catch(e => { mv3State = 'failed'; console.warn('[watchdog] 3D movement failed, using the SVG movement', e) })
    }
    /** the scope shows only when no movement is (going to be) up: ?movement=0, or both movements failed */
    const radarOn = () => !WANT_MOVEMENT || (mv3State === 'failed' && !mv && !mvLoading) || (mvFailed && !mv3)
    let mvFailed = false
    const nearest = (x: number, y: number, radius: number) => {
      let best: Blip | null = null, bd = radius
      for (const b of blips) { const s = screenOf(b); if (!s.visible) continue; const d = Math.hypot(s.x - x, s.y - y); if (d <= bd) { bd = d; best = b } }
      return best
    }
    const setHover = (b: Blip | null) => { hovered = b; watchdogUniforms.hi.value = b ? b.code : -1 }
    const showTip = (b: Blip, x: number, y: number) => { const st = blipState(b); tip.show(x, y, st.words, 'click to ping it', ACCENT[st.key]) }
    const ping = (b: Blip, x: number, y: number) => {
      const st = blipState(b)
      if (!reduced) { watchdogUniforms.pc.value = b.code; watchdogUniforms.pt.value = clock; watchdogUniforms.cx.value = (b.cell - 11.5) * 0.19 }
      ripple(x, y, ACCENT[st.key], reduced)
      c.emit('sig.watchdog')
    }
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    const pointer = {
      hover(ray: THREE.Raycaster, x: number, y: number) {
        if (mv3) { const k = mv3.hover(ray, x, y); if (k) { setHover(null); tip.hide(); return k } }
        if (!radarOn()) { setHover(null); tip.hide(); return null }
        const b = nearest(x, y, coarse ? TOUCH_PX : HOVER_PX)
        setHover(b)
        if (!b) { tip.hide(); return null }
        showTip(b, x, y)
        return 'pointer' as const
      },
      down(ray: THREE.Raycaster, x: number, y: number) {
        if (mv3) { const k = mv3.down(ray, x, y); if (k) return k }
        if (!radarOn()) return null
        const b = nearest(x, y, coarse ? TOUCH_PX : HOVER_PX)
        if (!b) return null
        setHover(b)
        const s = screenOf(b)
        ping(b, s.x, s.y)
        return 'tap' as const
      },
      move(ray: THREE.Raycaster, x: number, y: number) { if (mv3?.grabbing()) mv3.move(ray, x, y) },
      up(moved: boolean) { mv3?.up(moved) },
      leave() { setHover(null); tip.hide(); mv3?.leave() },
    }
    // keyboard / screen-reader twin: each activation pings the next blip in beam order and says what it is
    const order = [...blips].sort((p, q) => p.cell - q.cell)
    const live = document.createElement('div'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('data-proof', 'skip')
    live.style.cssText = 'position:fixed;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap'
    document.body.append(live)
    const pingNext = srAction('Ping the next check', () => {
      const b = order[nextKey++ % order.length], s = screenOf(b)
      setHover(b); ping(b, s.x, s.y)
      live.textContent = ''; window.setTimeout(() => { live.textContent = blipState(b).words }, 30)
      window.setTimeout(() => { if (hovered === b) setHover(null) }, 1600)
    })
    return {
      root,
      // no radar behind the watch: the particle form is hidden entirely while a movement is up (see the header)
      get dust() { return radarOn() ? 1 : 0 },
      size: [4, 4] as [number, number],
      pointer,
      /** the flight left the stop: the movement and its controls go with it (and the blueprint tag it silenced comes back) */
      leave() { mv3?.hide(); mv?.leave(); setHover(null); tip.hide() },
      hint: ['Touch a part', 'it names its job'] as [string, string],
      update(f: StageFrame) {
        clock = f.t; reduced = f.reduced
        const present = sstep(0.25, 0.85, f.arrive) * (1 - sstep(0.04, 0.5, f.depart))
        const heldNow = f.arrive > 0.97 && f.depart < 0.02
        if (mv3) {
          const html = document.documentElement
          const covered = html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
          mv3.frame({ present, held: heldNow, phone: f.phone, covered, visH: f.visH, portrait: f.aspect < 0.85, lane: laneOf() })
        }
        // the SVG movement: only when asked for (?movement=svg) or when the 3D one could not be built; lazily imported on the first frame the stage is visible
        if (WANT_MOVEMENT && (WANT_SVG || mv3State === 'failed' || mv3State === 'off') && !mv && !mvLoading) {
          mvLoading = true
          import('./movement/movement').then(m => { mv = m.mountMovement({ emit: (n, d) => c.emit(n, d), reduced: () => reduced || document.documentElement.classList.contains('rm') }) })
            .catch(e => { mvFailed = true; console.warn('[watchdog] movement failed', e) })
        }
        if (mv) {
          const r = canvasRect(), q = fieldProject([pl.at[0], pl.at[1], pl.at[2]])
          mv.frame({ present: q.visible ? present : 0, held: heldNow, x: r.left + q.x, y: r.top + q.y + (f.phone ? 0 : -0.012 * innerHeight), phone: f.phone, lane: laneOf() })
        }
        const scope = radarOn()
        watchdogUniforms.pulse.value = f.reduced ? 0 : 1
        pingNext.setActive(scope && heldNow)
      },
      debug: () => ({ blips: blips.length, hovered: hovered ? blipState(hovered).key : null, radar: radarOn(), movement: mv3?.info() ?? mv?.info() ?? null, movement3d: mv3State }),
    }
  },
} satisfies StageDef
