// UNIT 7D: the monumental name. "JOSEPH" over "BLUMBERG" as real extruded Bodoni letters (baked by scripts/build-type.mjs, Bodoni Moda
// wght 900 opsz 96, OFL), polished chrome faces with smoked-glass edges, lit by the shared PMREM studio (env.ts) and a fresnel rim, standing
// exactly where the particle name stands (forms/name.ts), so the dust that forms the name IS the skin of these letters.
//   arrival  (clouds > name)  the camera leaves the fog, swings in along the row of letters (a wide lens, the nearest letter bigger than the
//                             frame, the rest receding out of it) and arcs round to the composed shot; the letters condense out of the
//                             particles, one by one, spiralling in from where the dust was (dissolve with a hot edge)
//   dwell    (name)           whole name, sways with the particle name, chrome faces catch the moving studio; particles dim to a shimmer
//   departure (name > world)  the letters break apart as rigid bodies: outward, toward the lens, spinning, gravity, a bounce on the mirror
//                             floor, then they crumble back to dust as the flight takes the picture away. The portal set piece's camera
//                             (transitions.ts) dives through the gap they leave.
// Every pose is a closed-form function of the scroll state (ballistic arcs with drag and a floor bounce, damped spin), so scrolling back
// replays the leg exactly in reverse. Reduced motion: letters static at the name waypoint, nothing else.
// Contract: install(ctx) -> { update, adjustCam }. Hides the DOM name twin through <html data-hero3d>. ?extras=-hero3d switches it off.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import type { FlightState } from '../flight'
import { WAYPOINTS } from '../layout'
import { clamp01, extraOn, isOn, isPhone, lerp, reducedMotion, rng, sstep, timed } from './lib/flags'
import { buildLayout, loadType, type TypeLayout } from './lib/type3d'
import { makeLetterU, patchLetter, type LetterU } from './lib/letterfx'
import { sharedEnv } from './env'
import '../../styles/hero3d.css'

const FRONT_Z = 0.52         // a hair in front of the particle front face (forms/name.ts DEPTH / 2 = 0.4, +-0.07 ripple): the dust skin hides behind the metal, only its rim glints
const WIDTH = 7.5            // forms/name.ts WIDTH (BLUMBERG)
const DEPTH = 0.2           // the particle extrusion is 0.8: the walls show when the camera swings past, but short enough that neighbours' walls never read as one band (was 0.9)
const FLOOR_Y = -6.6         // mirror.ts floor
const TRACK = 0.16           // extra space between neighbouring letters (type3d rescales the row so BLUMBERG stays WIDTH wide): the walls of neighbours no longer touch
const SWAY = 0.06            // rad, the whole name sways together (the particle name sways 0.3): a rigid sway, so neighbours never turn into each other
const WOBBLE = 0.04          // rad, at most, of per-letter yaw on top: the metal feels loose, the gaps (>= 0.1) stay open
const PARALLAX = [2.5, 2.0]  // degrees of yaw / pitch toward the pointer (mouse only, off with reduced motion, eased out as the name breaks)
const SPLIT_S = 0.5          // s, the arrival's RGB split / streak (letterfx uSplit)
const TTOT = 2.6             // s of simulated time across a departure
const G = 9.0
const RAD = Math.PI / 180
const dbg = (window as unknown as { __hero3d?: Record<string, unknown> })

interface Piece {
  mesh: THREE.Mesh; u: LetterU
  p0: THREE.Vector3                       // rest centre (name-local)
  rank: number                            // reading order 0..1
  off: THREE.Vector3; qOff: THREE.Quaternion   // arrival: where the dust was, how it was turned
  v: THREE.Vector3                        // departure: initial velocity
  axis: THREE.Vector3; omega: number      // departure spin
  rr: number                              // random 0..1 (stagger of the crumble)
  wob: number                             // this letter's share of WOBBLE (-1..1)
}

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('hero3d') || !ctx.field?.scene) return
  const iName = WAYPOINTS.findIndex(w => w.id === 'name')
  if (iName < 0) return
  const field = ctx.field, scene: THREE.Scene = field.scene, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera
  const html = document.documentElement
  const wpN = WAYPOINTS[iName]
  const AT = new THREE.Vector3(...wpN.place.at)
  const SC = wpN.place.scale ?? 1

  const root = new THREE.Group(); root.name = 'hero3d'; root.visible = false
  root.position.copy(AT); root.scale.setScalar(SC)
  let pieces: Piece[] = [], layout: TypeLayout | null = null, ready = false
  let owned = false, flagged = false, wantA = 1, active = false, handBack = false
  // one soft raking key from the upper left, low across the faces: the hairline walls and serifs take a thin edge of light (intensity 0 while the name is away)
  const key = new THREE.SpotLight(0xfff0d8, 0, 40, 0.55, 0.9, 1.4); key.name = 'hero3d-key'
  key.position.set(-9, 5, 5); key.target.position.set(0, 0, 0); root.add(key, key.target)
  field.addObject(root)
  let px = 0, py = 0, splitArmed = true, splitT0 = -1e9
  const par = { x: 0, y: 0 }
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; px = (e.clientX / Math.max(1, innerWidth)) * 2 - 1; py = 1 - (e.clientY / Math.max(1, innerHeight)) * 2 }, { passive: true })
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), qSway = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0)

  // ------------------------------------------------------------------ build (async: one small JSON)
  const url = `${import.meta.env.BASE_URL}models/type-bodoni-ed.json`
  loadType(url).then(json => {
    const phone = isPhone()
    layout = buildLayout(json, { width: WIDTH, depth: DEPTH, front: FRONT_Z, curveSegments: phone ? 6 : 10, bevelSegments: 1, tracking: TRACK, bevelScale: 0.22 })
    const env = sharedEnv(renderer)
    const n = layout.letters.length
    pieces = layout.letters.map((L, i) => {
      const r = rng(0x7d0 + i * 977)
      const u = makeLetterU(r() * 40)
      // matte warm-ivory letters, like ink-on-stone type on a museum wall: no metal, no clearcoat, no thin-film colour
      const face = patchLetter(new THREE.MeshPhysicalMaterial({ color: 0xe8dcc2, metalness: 0, roughness: 0.78, envMap: env, envMapIntensity: 0.32 }), u)
      const side = patchLetter(new THREE.MeshPhysicalMaterial({ color: 0x9a8e78, metalness: 0, roughness: 0.9, envMap: env, envMapIntensity: 0.2 }), u, true, 0.8)
      u.glow.value.set(0.55, 0.46, 0.32); u.rim.value = 0.1; u.rimCol.value.set(1, 0.93, 0.8); u.sheen.value = 0; u.warp.value = 0
      const mesh = new THREE.Mesh(L.geo, [face, side]); mesh.frustumCulled = false; mesh.visible = false; mesh.matrixAutoUpdate = true
      root.add(mesh)
      // dust: where this letter condenses from, and how it breaks
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, -0.2 - 0.9 * r()).normalize()
      const off = dir.multiplyScalar(2.6 + 4.2 * r())
      const qOff = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (1.2 + 2.4 * r()) * (r() < 0.5 ? -1 : 1))
      const p0 = new THREE.Vector3(L.x, L.y, L.z)
      const out = new THREE.Vector2(p0.x, p0.y - 0.05).normalize()
      const sp = 2.0 + 2.0 * r()
      const v = new THREE.Vector3(out.x * sp * (0.6 + 0.8 * r()) + (r() - 0.5) * 2.2, out.y * sp * 0.8 + 1.5 + (r() - 0.3) * 2.0, (r() < 0.78 ? 1 : -0.6) * (0.8 + 2.4 * r()))
      return { mesh, u, p0, rank: i / Math.max(1, n - 1), off, qOff, v, axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), omega: (1.1 + 1.6 * r()) * (r() < 0.5 ? -1 : 1), rr: r(), wob: 0 }
    })
    ready = true
    // compile the (heavy: clearcoat + iridescence) programs now, off the main path, so the first arrival does not stall on them
    try { void (renderer as THREE.WebGLRenderer & { compileAsync?: (o: THREE.Object3D, c: THREE.Camera, s?: THREE.Scene) => Promise<unknown> }).compileAsync?.(root, camera, scene) } catch { /* the first frame compiles them */ }
    pieces.forEach((p, i) => { p.u.gx.value = p.p0.x; p.wob = (0.5 + 0.5 * ((i * 0.618) % 1)) * (i % 2 ? 1 : -1) })
    // measurement hook: the clear space between neighbouring letters of a line (bounding boxes, name units), smallest first
    const gaps = () => { const L = layout!.letters, out: { pair: string; gap: number }[] = []; for (let i = 0; i + 1 < L.length; i++) if (L[i].line === L[i + 1].line) out.push({ pair: L[i].ch + L[i + 1].ch, gap: +((L[i + 1].x - L[i + 1].w / 2) - (L[i].x + L[i].w / 2)).toFixed(4) }); return out.sort((a, b) => a.gap - b.gap) }
    dbg.__hero3d = { layout, pieces, root, tris: layout.tris, gaps, width: () => { const L = layout!.letters.filter(l => l.line === layout!.letters[layout!.letters.length - 1].line); return +((L[L.length - 1].x + L[L.length - 1].w / 2) - (L[0].x - L[0].w / 2)).toFixed(3) } }
    // the environment arrives with the letters: nothing is visible until the scroll brings them
  }).catch(e => console.warn('[hero3d] type failed, the DOM name stays', e))

  // ------------------------------------------------------------------ scroll state -> arrival / departure progress
  interface Ph { arrive: number; dep: number }
  const phase = (st: FlightState): Ph => {
    if (st.dwelling) return st.wp < iName ? { arrive: 0, dep: 0 } : st.wp === iName ? { arrive: 1, dep: 0 } : { arrive: 1, dep: 1 }
    if (st.next === iName) return { arrive: st.t, dep: 0 }
    if (st.wp === iName) return { arrive: 1, dep: st.raw }
    return st.wp > iName ? { arrive: 1, dep: 1 } : { arrive: 0, dep: 0 }
  }
  const smooth = (x: number) => x * x * (3 - 2 * x)

  /** y of a falling body that bounces on the floor: closed form, up to three bounces (restitution 0.38) */
  const fall = (y0: number, vy0: number, T: number, floor: number): number => {
    let y = Math.max(y0, floor), vy = vy0, t = 0
    for (let b = 0; b < 3; b++) {
      const s = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * (y - floor)))) / G     // time to the next touch
      if (T - t <= s) { const d = T - t; return y + vy * d - 0.5 * G * d * d }
      t += s; vy = 0.38 * (vy - G * s) * -1; y = floor
      if (vy < 0.5) return floor
    }
    return floor
  }

  const KD = 0.3, KR = 0.55
  const place = (p: Piece, arr: number, dep: number, sway: number, wob: number) => {
    // arrival: from the dust, turning in
    const e = smooth(arr), k = (1 - e) * (1 - e)
    tmpV.copy(p.p0).addScaledVector(p.off, k)
    tmpQ.identity().slerp(p.qOff, k)
    // rest: the yaw sway of the particle name (forms/name.ts anim_name)
    qSway.setFromAxisAngle(UP, sway)
    tmpV.applyQuaternion(qSway)                       // the whole name turns together: positions ride the same rotation as the faces
    qSway.setFromAxisAngle(UP, sway + wob * p.wob)    // each letter adds its own small yaw about its own middle
    tmpQ.premultiply(qSway)
    if (dep > 0.03) {
      const T = ((dep - 0.03) / 0.97) * TTOT           // the first 3% of the leg is a dead zone: a nudge of the wheel does not break the name
      const dx = (1 - Math.exp(-KD * T)) / KD
      const ang = p.omega * (1 - Math.exp(-KR * T)) / KR
      qSpin.setFromAxisAngle(p.axis, ang)
      tmpQ.premultiply(qSpin)
      const wy = (AT.y + tmpV.y * SC)
      const floor = FLOOR_Y + 0.5 + 0.35 * p.rr
      const y = fall(wy, p.v.y, T, floor)
      tmpV.x += p.v.x * dx / SC; tmpV.z += p.v.z * dx / SC; tmpV.y = (y - AT.y) / SC
    }
    p.mesh.position.copy(tmpV); p.mesh.quaternion.copy(tmpQ)
  }

  const setFlag = (on: boolean) => { if (on !== flagged) { flagged = on; if (on) html.dataset.hero3d = '1'; else delete html.dataset.hero3d } }
  const hideU = (field.points?.material as THREE.ShaderMaterial | undefined)?.uniforms?.uFieldHide as THREE.IUniform<number> | undefined
  const curAlpha = () => (hideU ? 1 - hideU.value : 1)
  const release = () => {
    if (root.visible) root.visible = false
    key.intensity = 0
    setFlag(false)
    active = false; wantA = 1
    // hand the particles back. The arbiter (main.ts) applies the LOWEST request of a frame, so a 1 can never override another owner (the portal): no check needed.
    // This 1 can lose to the value the late hook below queued last frame (0 while the letters stand), and a snap or a jump from the first two stops releases
    // right then; the hook repeats the 1 once so it is the only request of the next frame. Without it the particles stayed hidden through Work (surface .. chomchom)
    // until stages.ts first wrote an alpha at Systems (the arbiter latches the last applied value when nobody writes).
    if (owned) { field.setFieldAlpha?.(1); handBack = true; owned = false }
  }

  const step = (t: number, dt: number, st: FlightState) => {
    if (!ready) return
    const rm = reducedMotion()
    const ph = phase(st)
    const arrive = rm ? (ph.arrive >= 1 ? 1 : 0) : ph.arrive
    const dep = rm ? 0 : ph.dep
    const gone = rm ? !(st.dwelling && st.wp === iName) : dep >= 0.995
    if (arrive <= 0.001 || gone) { release(); return }
    root.visible = true; active = true
    if (owned) field.setFieldAlpha?.(1)                 // start the frame from 'untouched': whoever owns the alpha (the portal) writes over it, the late hook below takes the lower of the two
    const sway = rm ? 0 : SWAY * Math.sin(t * 0.23)
    const wobK = rm ? 0 : WOBBLE
    // pointer parallax: the whole name leans a couple of degrees toward the pointer, eased, and let go as the name breaks apart
    {
      const k = rm ? 0 : 1 - sstep(0, 0.1, dep)
      const f = 1 - Math.exp(-dt / 0.35)
      par.x += (px * PARALLAX[0] * k - par.x) * f; par.y += (py * PARALLAX[1] * k - par.y) * f
      root.rotation.set(-par.y * RAD, par.x * RAD, 0)
    }
    // arrival: the RGB split / streak runs once, SPLIT_S long, when the letters have condensed (and again only after the visitor has left and come back)
    if (rm || arrive < 0.4) { splitArmed = true; splitT0 = -1e9 }
    else if (splitArmed && arrive >= 0.72 && dep <= 0) { splitArmed = false; splitT0 = t }
    const sTau = clamp01((t - splitT0) / SPLIT_S)
    const sAmp = 0 * (rm || sTau >= 1 ? 0 : sstep(0, 0.1, sTau) * Math.pow(1 - sTau, 1.5))
    let solid = 0, any = false
    for (const p of pieces) {
      const a = rm ? arrive : clamp01((arrive - (0.1 + 0.22 * p.rank)) / 0.34)
      const crumble = dep > 0 ? sstep(0.26 + 0.14 * p.rr, 0.66 + 0.14 * p.rr, dep) : 0
      const rev = rm ? a : sstep(0, 0.8, a) * (1 - crumble)
      p.u.reveal.value = rev; p.u.time.value = rm ? 0 : t
      p.u.edge.value = rm ? 0 : 1
      p.u.split.value = sAmp; p.u.splitT.value = sTau
      p.mesh.visible = rev > 0.004
      if (p.mesh.visible) { any = true; place(p, rm ? 1 : a, dep, sway, wobK) }
      solid += rev
    }
    solid /= pieces.length
    key.intensity = 520 * smooth(clamp01(solid)) * (1 - sstep(0, 0.4, dep))
    // hide the DOM twin while the letters read as letters
    setFlag(any && solid > 0.12)
    // the particles dim to a shimmer behind the solid letters (the field's global alpha; transitions.ts owns it during name>world and wins there)
    wantA = 1 - smooth(clamp01(solid)) * (1 - sstep(0, 0.12, dep))     // the dust is fully gone while the letters are solid (no grey ghost), and comes back as they leave
    owned = true
    // the portal's destination render and the floor reflection must not see letters that are mid-flight
    root.userData.noReflect = !isPhone() && dep > 0.1
  }
  const timedStep = timed('hero3d', step)
  // late hook: field.onBeforeRender callbacks run in registration order and main.ts registered its own (world + every extra's update) first,
  // so by now transitions.ts has had its say: the particles get the LOWER of its alpha and ours
  field.onBeforeRender?.(() => {
    if (handBack) { handBack = false; field.setFieldAlpha?.(1) }   // see release()
    if (!active || !owned) return
    const a = Math.min(curAlpha(), wantA)
    field.setFieldAlpha?.(a)
  })

  // ------------------------------------------------------------------ the arrival arc (the leg clouds > name)
  const C = new THREE.Vector3(AT.x, AT.y, AT.z + 0.1)
  const P1 = new THREE.Vector3(), T1 = new THREE.Vector3(), pos = new THREE.Vector3(), tgt = new THREE.Vector3()
  let tPrev = 0, tVel = 0
  const CAM_LEAD = 0.115
  const arc = (cam: FlightState['cam'], t: number): FlightState['cam'] => {
    P1.set(...wpN.cam.pos); T1.set(...wpN.cam.target)
    const kS = P1.distanceTo(C) / 10                                   // portrait pulls the camera back: scale the whole move with it
    const w1 = sstep(0.14, 0.44, t) * (1 - sstep(0.93, 1, t))
    if (w1 <= 0) return cam
    const th = 74 * RAD * Math.pow(1 - sstep(0.4, 1.0, t), 1.25)
    const rho = kS * (34 + (5.6 - 34) * sstep(0.14, 0.46, t) + (10 - 5.6) * sstep(0.46, 1, t))
    const low = -1.2 * Math.sin(Math.PI * sstep(0.22, 0.92, t)) * Math.sqrt(kS)
    pos.set(C.x + rho * Math.sin(th), P1.y + low, C.z + rho * Math.cos(th))
    tgt.lerpVectors(C, T1, sstep(0.55, 1, t))
    tgt.y += 0.1 * (1 - sstep(0.55, 1, t))
    const bump = sstep(0.28, 0.5, t) * (1 - sstep(0.62, 0.95, t))
    return {
      pos: [lerp(cam.pos[0], pos.x, w1), lerp(cam.pos[1], pos.y, w1), lerp(cam.pos[2], pos.z, w1)],
      target: [lerp(cam.target[0], tgt.x, w1), lerp(cam.target[1], tgt.y, w1), lerp(cam.target[2], tgt.z, w1)],
      fov: cam.fov + 16 * bump,
    }
  }

  return {
    update(t, dt, st) { if (!isOn('hero3d')) { release(); return } timedStep(t, dt, st) },
    adjustCam(cam, dt, st) {
      if (!ready || !isOn('hero3d') || reducedMotion() || st.dwelling || st.next !== iName) { tPrev = st.next === iName ? st.t : 0; return cam }
      if (dt > 0) tVel += (((st.t - tPrev) / Math.max(1e-3, dt)) - tVel) * (1 - Math.exp(-dt / 0.05))
      tPrev = st.t
      return arc(cam, clamp01(st.t + tVel * CAM_LEAD))
    },
  }
}
