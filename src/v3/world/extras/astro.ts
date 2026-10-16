// UNIT 13A: the sky the whole flight lives under. Replaces the old finale-only star shell + dome (finale/sky.ts now only keeps its clouds and beacons).
//   stars.ts           three parallax star layers (twinkle, colour by temperature), bright stars with diffraction spikes, a shooting star every 20-40 s
//   sky.ts             the Milky Way (NASA SVS Deep Star Maps 2020, 4096 px webp, lazy-loaded after first paint, slow turn), a nebula behind each area in its colour,
//                      a faint aurora curtain over the education / hall horizon
//   constellations.ts  at the establishing shot each area's stops light up as stars joined by lines that draw on; hover near one for its name
// All additive, depth-tested and drawn before everything (renderOrder < 0, no depth write), so nothing washes the copy. ?extras=-astro switches it off;
// window.__atmos.on.astro = false flips it live (measurement); window.__astro exposes { shoot(), stats }.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import type { FlightState } from '../flight'
import { AREAS, WAYPOINTS } from '../layout'
import { damp, extraOn, isOn, isPhone, reducedMotion, sstep, timed } from './lib/flags'
import { createStars } from './astro/stars'
import { createSkyBits } from './astro/sky'
import { U as SIGU } from '../signals'
import { createConstellations, AREA_NAME } from './astro/constellations'
import { nameW } from './lib/cosmos'

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('astro') || !ctx.field?.scene) return
  const scene: THREE.Scene = ctx.field.scene, camera: THREE.PerspectiveCamera = ctx.field.camera
  const phone = isPhone(), dpr = Math.min(2, devicePixelRatio || 1)
  const stars = createStars(phone, dpr), bits = createSkyBits(phone), cons = createConstellations(dpr)
  for (const l of stars.layers) { l.userData.noReflect = true; l.name = 'astro-stars'; scene.add(l) }
  bits.group.userData.noReflect = true; bits.group.name = 'astro-sky'; scene.add(bits.group)
  cons.group.userData.noReflect = true; cons.group.name = 'astro-constellations'; scene.add(cons.group)

  const LAST = WAYPOINTS.length - 1, WORLD = WAYPOINTS.findIndex(w => w.id === 'world'), HUB = AREAS.length
  // v20: the name screen is the cosmos (no TV behind the name): the Milky Way is at full strength by the 'name' stop, turned a quarter so its band crosses the view behind the letters
  const NAME = Math.max(1, WAYPOINTS.findIndex(w => w.id === 'name'))
  const QUIET = { gain: 0.05, hot: 0.02, neb: 0.05, aur: 0.2 }, NAMEK = { gain: 0.3, hot: 0.08, neb: 1.0 }   // v20 project stops: a barely-there sky behind each form (a brown Milky Way lifts the form's colour mix); the name screen: the whole sky
  const idx = (id: string) => { const i = AREAS.findIndex(a => a.id === id); return i < 0 ? HUB : i }
  const NAMEN = AREAS.length + 1   // the nebula slot of the name screen
  const neb = new Array(AREAS.length + 2).fill(0), nebGoal = new Array(AREAS.length + 2).fill(0)
  let aur = 0, load = 0, clock = 0, conVis = 0, hover = -1, mx = -1e4, my = -1e4, loadAt = -1

  // the map comes after first paint: once the page has had a moment (or the browser is idle), never before the flight is interactive
  const start = () => { loadAt = 0; bits.loadMap() }
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const kick = () => { if (idle) idle(start, { timeout: 5000 }); else setTimeout(start, 2500) }
  // w14: not before the loader's gate is up (v3:ready): the 2.6 MB map shared the pipe with the boot's chunks and delayed the gate by seconds on a slow link
  const afterReady = (f: () => void) => (window as unknown as { __v3Ready?: boolean }).__v3Ready ? f() : addEventListener('v3:ready', f, { once: true })
  afterReady(() => setTimeout(kick, 1200))

  // hover label (no pointer events; the native cursor is never touched)
  const label = document.createElement('div'); label.setAttribute('aria-hidden', 'true')
  Object.assign(label.style, { position: 'fixed', left: '0', top: '0', zIndex: '7', pointerEvents: 'none', opacity: '0', transition: 'opacity .35s ease, transform .35s cubic-bezier(.2,.8,.2,1)',
    font: "500 11px/1 'IBM Plex Mono', ui-monospace, monospace", letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', textShadow: '0 0 12px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.9)', whiteSpace: 'nowrap' })
  label.dataset.proof = 'skip'
  document.body.append(label)
  if (!phone) addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY }, { passive: true })

  const v = new THREE.Vector3(), tint = new THREE.Color(), tmpC = new THREE.Color()
  ;(window as unknown as { __astro: unknown }).__astro = { shoot: () => stars.shoot(camera), constellations: cons, sky: bits }

  const finOf = (st: FlightState) => (st.dwelling ? (st.wp === LAST ? 1 : 0) : st.next === LAST ? st.t : 0)
  /** 1 on the establishing shot, easing in and out over the legs on either side of it */
  const worldOf = (st: FlightState) => st.dwelling ? (st.wp === WORLD ? 1 : 0) : st.next === WORLD ? sstep(0.45, 1, st.t) : st.wp === WORLD ? 1 - sstep(0, 0.4, st.t) : 0

  return {
    update: timed('astro', (t, dt, st) => {
      const on = isOn('astro'), rm = reducedMotion()
      for (const l of stars.layers) l.visible = on
      bits.group.visible = on; cons.group.visible = on && cons.group.visible
      if (!on) { label.style.opacity = '0'; return }
      clock += Math.min(dt, 0.1)
      const fin = finOf(st), cam = camera.position
      // shells: the far ones ride with the camera, the near ones lag (parallax)
      stars.layers.forEach((l, i) => l.position.copy(cam).multiplyScalar(stars.follow[i]))
      bits.group.position.copy(cam)
      const k = rm ? 1 : sstep(0, 2.2, clock)   // the stars arrive first, then the rest
      stars.update(t, k, rm, camera, Math.min(dt, 0.1))
      // the map fades in over 3 s once it has loaded
      load = loadAt >= 0 ? Math.min(1, load + Math.min(dt, 0.1) / 3) : 0
      // nebula weights: the area we stand in, crossfading into the next one over the middle of a leg
      nebGoal.fill(0)
      const A = idx(WAYPOINTS[st.wp]?.area ?? 'hub'), B = idx(WAYPOINTS[st.next]?.area ?? WAYPOINTS[st.wp]?.area ?? 'hub'), q = st.dwelling ? 0 : sstep(0.3, 0.7, st.t)
      nebGoal[A] += (1 - q) * (A === HUB ? 0.5 : 1); nebGoal[B] += q * (B === HUB ? 0.5 : 1)
      const wf = st.wp + (st.dwelling ? 0 : st.t), nw = nameW(st)   // nw: 1 at the name stop. The prologue's particle cloud is the picture: the sky waits behind it, stars only
      nebGoal[HUB] += fin * 0.45   // the finale: a violet glow over the whole map
      nebGoal[NAMEN] += Number.isFinite(nw) ? nw : 0   // v20: the nebula that hangs in front of the name camera (sky.ts): the one coloured thing on the cosmos screen
      for (let i = 0; i < neb.length; i++) neb[i] = rm ? nebGoal[i] : damp(neb[i], nebGoal[i], 1.1, dt)
      const aw = (nebGoal[idx('education')] + 0.55 * fin)   // v22: no aurora over the about stops (hall, climbing hold)
      aur = rm ? aw : damp(aur, aw, 1.4, dt)
      tint.set(1, 1, 1); { const tv = SIGU.uSgTv.value; tint.lerp(tmpC.setRGB(0.3 + 0.7 * tv.x, 0.3 + 0.7 * tv.y, 0.3 + 0.7 * tv.z), 0.3 * tv.w) }   // v20: the Milky Way keeps the map's own colour (the hub TV's channel colour tints it only while the TV is on)
      // v20: the sky is a quiet backdrop behind every form (sky light adds to a form's own pixels and greys them, so it stays under V 0.15 at the project stops) and the whole picture
      // on the name screen (nw = 1: the band crosses behind the letters). The finale (fin) keeps its night sky.
      const wv = worldOf(st)
      const nameYaw = -0.25 * (1 - sstep(NAME + 0.1, Math.max(NAME + 0.9, WORLD - 0.1), wf))   // 1 turn = the whole map; back to the designed orientation by the establishing shot (a static offset, so it holds under reduced motion too)
      const gain = (QUIET.gain + (NAMEK.gain - QUIET.gain) * nw + 0.05 * wv) * (1 - fin) + 0.42 * fin, hot = (QUIET.hot + (NAMEK.hot - QUIET.hot) * nw) * (1 - fin) + 0.6 * fin
      bits.update(t, { yaw: nameYaw, tint, gain, hot, neb: neb.map(x => x * (QUIET.neb + (NAMEK.neb - QUIET.neb) * nw)), aur: QUIET.aur * Math.min(1, aur), rm, load })
      // constellations
      conVis = rm ? wv : damp(conVis, wv, 0.35, dt)
      cons.update(t, dt, conVis, hover, rm)
      // hover: the nearest constellation centre within 120 px of the pointer
      let best = -1, bd = 120, bx = 0, by = 0
      if (conVis > 0.6 && mx > -1e3) {
        camera.updateMatrixWorld()
        cons.centers.forEach((c, i) => {
          v.copy(c).project(camera); if (v.z >= 1) return
          const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight, d = Math.hypot(sx - mx, sy - my)
          if (d < bd) { bd = d; best = i; bx = sx; by = sy }
        })
      }
      hover = best
      if (best >= 0) { if (label.textContent !== AREA_NAME[AREAS[best].id]) label.textContent = AREA_NAME[AREAS[best].id]; label.style.color = AREAS[best].accent; label.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by + 34)}px) translateX(-50%)`; label.style.opacity = '1' }
      else label.style.opacity = '0'
    }),
  }
}
