// ALCHE-style rings of type orbiting the hub TV: three tilted, counter-rotating bands (an armillary) of mono / serif text plus a thin
// bezel ring with tick marks and a comet that circles it. Strongest at the hub waypoints (clouds, name, world) and the epilogue, faded
// elsewhere. Spin follows scroll speed (st.speed), POV drags and TV spins; the bezel clicks one notch on every hub:detent; the whole set
// spins up when the TV powers on and collapses with it at the epilogue (world.stats().hubOn / hubOff).
// Honours ?extras=0 and ?extras=-rings. The rings are scene objects, so the mirror floor reflects them.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { HUB, WAYPOINTS } from '../layout'
import projects from '../../../data/projects.json'
import { damp, extraOn, isOn, lerp, reducedMotion, timed } from './lib/flags'
import { fontOf, loadFonts, type FontKind } from './lib/atlas'
import { LANE_GLSL, LANE_ON, Lane } from './lib/lane'
import { HOLES } from '../occlusion'
import { U as SIGU } from '../signals'

const IDENT = 'JOSEPH BLUMBERG · UNIVERSITY OF CHICAGO · ECONOMICS · COMPUTATIONAL AND APPLIED MATHEMATICS · '
const MOTTO = 'Crescat scientia · vita excolatur · In nova fert animus mutatas dicere formas corpora · '
// w12: priority order = the flight order of the work (QVR and the pitches first, the interests last)
const PROJECT_IDS = ['qvr', 'cloudflare', 'appfolio', 'recruiting-os', 'chomchom', 'secretary', 'watchdog', 'selforge', 'zeta', 'table-model', 'hand-compass', 'love-island', 'wwii', 'thrift', 'second-brain', 'metamorphoses', 'odyssey', 'liaozhai']
const projectLine = () => {
  const by = new Map((projects as { id: string; name: string }[]).map(p => [p.id, p.name]))
  return PROJECT_IDS.map(id => (by.get(id) ?? id).split(':')[0].toUpperCase()).join(' · ') + ' · '
}

/** per waypoint id: [strength 0..1, scale]. Hub waypoints are loud, areas are a faint sheen far behind the subject */
// v20: no type rings behind the name: the first two screens are the cosmos. They come in with the TV over the leg into 'world' (stats().hubShow gates them as well)
const AT: Record<string, [number, number]> = { clouds: [0, 2.1], name: [0, 1.0], world: [0.82, 1.8], epilogue: [0.8, 0.92] }
const REST: [number, number] = [0.07, 1.6]
const at = (i: number): [number, number] => AT[WAYPOINTS[Math.max(0, Math.min(WAYPOINTS.length - 1, i))].id] ?? REST

interface BandDef { text: string; kind: FontKind; px: number; R: number; tilt: [number, number, number]; spin: number; col: [number, number, number]; h0: number }
const bands = (): BandDef[] => [
  { text: IDENT, kind: 'mono', px: 50, R: 5.8, tilt: [0.36, 0, 0.2], spin: 0.2, col: [0.93, 0.9, 0.84], h0: 1.15 },
  { text: projectLine(), kind: 'mono', px: 40, R: 7.5, tilt: [-0.22, 0, 1.02], spin: -0.15, col: [0.62, 0.74, 1.0], h0: 1.0 },
  { text: MOTTO, kind: 'serif', px: 84, R: 9.3, tilt: [0.52, 0, -0.62], spin: 0.1, col: [1.0, 0.72, 0.5], h0: 1.25 },
]

/** one period of the text as a tileable single-channel mipmapped texture, with hairline rules along both edges */
function bandTexture(text: string, kind: FontKind, px: number, aniso: number, maxW: number) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true })!
  g.font = fontOf(kind, px)
  while (Math.ceil(g.measureText(text).width) > maxW && px > 18) { px -= 2; g.font = fontOf(kind, px) }
  const w = Math.ceil(g.measureText(text).width), h = Math.ceil(px * 2.1)
  cv.width = w; cv.height = h
  g.font = fontOf(kind, px); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'
  g.fillText(text, 0, h / 2 + px * 0.04)
  const rule = Math.max(2, Math.round(px * 0.05))
  g.fillRect(0, 3, w, rule); g.fillRect(0, h - 3 - rule, w, rule)
  const rgba = g.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h)
  for (let i = 0, j = 3; i < data.length; i++, j += 4) data[i] = rgba[j]
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType)
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true; tex.anisotropy = aniso; tex.unpackAlignment = 1; tex.flipY = false; tex.needsUpdate = true
  return { tex, aspect: w / h }
}

/** the copy-side third of the screen: where the overlay's title / lede / list stand. Type here is held at 0.15 (the lane mask is usually 0 there already; this keeps it true at any aspect or lane width) */
const THIRD_GLSL = /* glsl */ `
float copyThird() {
  if (uLaneOn < 0.5 || uLane.w > 0.5 || abs(uLane.x) < 0.001) return 1.0;
  vec2 nd = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float u = nd.x * -sign(uLane.x);                // < 0 on the copy side
  return mix(1.0, mix(0.15, 1.0, smoothstep(-0.36, -0.30, u)), abs(uLane.x));
}`
const BAND_V = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const BAND_F = /* glsl */ `
precision highp float;
uniform sampler2D tTex; uniform vec3 uCol; uniform float uReps, uAlpha, uSweep, uKick, uCap;
varying vec2 vUv;
${LANE_GLSL}
${THIRD_GLSL}
void main() {
  float cov = texture2D(tTex, vec2(vUv.x * uReps, vUv.y)).r;
  float ang = vUv.x * 6.2831853;
  float sw = 0.5 + 0.5 * cos(ang - uSweep);
  float glow = 0.5 + 0.5 * pow(sw, 3.0) + uKick;
  float face = gl_FrontFacing ? 1.0 : 0.3;
  float a = min(cov * uAlpha * glow * face * laneMask() * copyThird(), uCap);   // uCap: the dim while the 3D name owns the frame
  gl_FragColor = vec4(uCol * (0.85 + 0.9 * pow(sw, 5.0)), a);
}`
const BEZEL_V = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const BEZEL_F = /* glsl */ `
precision highp float;
uniform float uR0, uR1, uAlpha, uRot, uSweep, uKick, uCap;
varying vec2 vP;
${LANE_GLSL}
${THIRD_GLSL}
void main() {
  float rad = length(vP);
  float t = (rad - uR0) / (uR1 - uR0);
  float wu = max(max(fwidth(vP.x), fwidth(vP.y)), 1e-5);
  float degPx = degrees(wu / max(rad, 1e-3));
  float a = atan(vP.y, vP.x);
  float deg = degrees(a) - degrees(uRot);
  float d2 = abs(fract(deg / 2.0 + 0.5) - 0.5) * 2.0 / degPx;
  float d10 = abs(fract(deg / 10.0 + 0.5) - 0.5) * 10.0 / degPx;
  float d30 = abs(fract(deg / 30.0 + 0.5) - 0.5) * 30.0 / degPx;
  float minor = (1.0 - smoothstep(0.35, 1.2, d2)) * step(0.66, t);
  float mid = (1.0 - smoothstep(0.45, 1.4, d10)) * step(0.4, t);
  float major = (1.0 - smoothstep(0.55, 1.7, d30)) * step(0.06, t);
  float edge = 1.0 - smoothstep(0.0, 1.6, min(abs(rad - uR0), abs(rad - uR1)) / wu);
  float da = mod(a - uSweep + 3.14159265, 6.2831853) - 3.14159265;
  float tail = step(da, 0.0) * exp(da * 1.7);
  float head = exp(-da * da * 700.0);
  float onEdge = 1.0 - smoothstep(0.0, 2.4, abs(rad - uR0) / wu);
  float base = 0.5 * (minor * 0.5 + mid * 0.8 + major) + edge * 0.45;
  vec3 col = vec3(0.93, 0.9, 0.84) * (base * (0.55 + uKick)) + vec3(1.0, 0.55, 0.3) * (onEdge * (tail * 0.9 + head * 3.0) + major * head * 2.0);
  float a2 = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  if (a2 < 0.003) discard;
  gl_FragColor = vec4(col, min(uAlpha * laneMask() * copyThird(), uCap));
}`

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('rings') || !ctx.field?.scene) return
  const renderer: THREE.WebGLRenderer = ctx.field.renderer
  const root = new THREE.Group(); root.name = 'atmos-rings'; root.position.set(...HUB); root.visible = false
  const precess = new THREE.Group(); root.add(precess)
  type Ring = { tilt: THREE.Group; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; def: BandDef; spin: number; angle: number }
  const rings: Ring[] = []
  let bezel: THREE.Mesh | null = null, bezelMat: THREE.ShaderMaterial | null = null
  let ready = false
  // state
  let boost = 0, drag = 0, kick = 0, powerKick = 0, bezelAngle = 0, bezelVel = 0, sweep = 0, notch = 0, flash = 0
  let sNow = 0, scNow = 1, hubOn = 0, hubShow = 1, hubOff = 0, frame = 0
  const cam = ctx.field.camera as THREE.PerspectiveCamera
  const lane = new Lane(), res = new THREE.Vector2(1440, 900)
  // the dim while the 3D name (hero3d.ts) owns the frame: the compass text drops to alpha 0.25, the bezel to 0.3, so neither competes with the chrome letters
  const capU: THREE.IUniform<number> = { value: 1 }, bezCapU: THREE.IUniform<number> = { value: 1 }
  let heroK = 0

  ctx.on((name, data) => {
    switch (name) {
      case 'hub:detent': notch += 1; flash = Math.max(flash, 0.5); break
      case 'hub:channel': flash = Math.max(flash, 0.8); break
      case 'hub:poweron': powerKick = 1; break
      case 'pov:grab': drag = Math.max(drag, 0.3); break
      case 'pov:drag': drag = Math.max(drag, Math.min(1, data?.speed ?? 0.5)); break
      case 'pov:release': drag = Math.max(drag, Math.min(1, (data?.speed ?? 0.4))); break
      case 'tv:spin': drag = Math.max(drag, 0.35 * Math.min(1, data?.speed ?? 0.5)); break
      case 'tv:grab': flash = Math.max(flash, 0.3); break
      default: break
    }
  })

  const build = async () => {
    await loadFonts()
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()), maxW = Math.min(4096, renderer.capabilities.maxTextureSize || 4096)
    for (const def of bands()) {
      const { tex, aspect } = bandTexture(def.text, def.kind, def.px, aniso, maxW)
      const C = 2 * Math.PI * def.R
      const reps = Math.max(1, Math.round(C / (aspect * def.h0)))
      const H = C / (reps * aspect)
      const geo = new THREE.CylinderGeometry(def.R, def.R, H, 192, 1, true)
      const mat = new THREE.ShaderMaterial({
        vertexShader: BAND_V, fragmentShader: BAND_F, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { tTex: { value: tex }, uCol: { value: new THREE.Color(...def.col) }, uReps: { value: reps }, uAlpha: { value: 0 }, uSweep: { value: 0 }, uKick: { value: 0 }, uCap: capU, uLane: { value: lane.u }, uRes: { value: res }, uLaneOn: LANE_ON, uHole: HOLES },
      })
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 1
      const tilt = new THREE.Group(); tilt.rotation.set(def.tilt[0], def.tilt[1], def.tilt[2]); tilt.add(mesh); precess.add(tilt)
      rings.push({ tilt, mesh, mat, def, spin: def.spin, angle: Math.random() * 6.28 })
    }
    // the bezel: a flat ring that always faces the camera, with a comet on its inner edge
    const R0 = 4.35, R1 = 4.85
    bezelMat = new THREE.ShaderMaterial({
      vertexShader: BEZEL_V, fragmentShader: BEZEL_F, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uR0: { value: R0 }, uR1: { value: R1 }, uAlpha: { value: 0 }, uRot: { value: 0 }, uSweep: { value: 0 }, uKick: { value: 0 }, uCap: bezCapU, uLane: { value: lane.u }, uRes: { value: res }, uLaneOn: LANE_ON, uHole: HOLES },
    })
    bezel = new THREE.Mesh(new THREE.RingGeometry(R0 - 0.06, R1 + 0.06, 256, 1), bezelMat)
    bezel.frustumCulled = false; bezel.renderOrder = 1
    root.add(bezel)
    ctx.field.addObject(root)
    ready = true
  }
  build().catch(e => console.warn('[rings] build failed', e))

  const step = (_t: number, dt: number, st: Parameters<NonNullable<Extra['update']>>[2]) => {
    {
      if (!ready || !bezel || !bezelMat) return
      const rm = reducedMotion()
      // ---- how loud, how big: piecewise by waypoint index (eased leg progress between two waypoints)
      const a = at(st.wp), b = at(st.next), k = st.dwelling ? 0 : st.t
      const sGoal = lerp(a[0], b[0], k), scGoal = lerp(a[1], b[1], k)
      if (++frame % 3 === 0 && ctx.world?.stats) { const s = ctx.world.stats(); hubOn = s.hubOn ?? 0; hubShow = s.hubShow ?? 1; hubOff = s.hubOff ?? 0 }
      sNow = damp(sNow, sGoal, 0.35, dt); scNow = damp(scNow, scGoal, 0.5, dt)
      const power = 0.28 + 0.72 * Math.min(1, hubOn)
      const alive = (1 - hubOff) * (1 - hubOff)
      const strength = sNow * power * alive * hubShow
      root.visible = strength > 0.004
      if (!root.visible) return
      lane.update(st, dt); renderer.getDrawingBufferSize(res)
      heroK = damp(heroK, document.documentElement.dataset.hero3d ? 1 : 0, 0.3, dt)
      capU.value = lerp(1, 0.25, heroK); bezCapU.value = lerp(1, 0.3, heroK)
      root.scale.setScalar(Math.max(0.02, scNow * (1 - 0.9 * hubOff)))
      // ---- spin
      drag *= Math.exp(-dt / 0.7); powerKick *= Math.exp(-dt / 1.1); flash *= Math.exp(-dt / 0.35)
      const mus = SIGU.uSgMus.value
      const target = rm ? 0 : 1 + 5 * st.speed + 8 * drag + 7 * powerKick + 6 * hubOff + 2.5 * mus.w   // v19: a song speeds the rings up
      boost = damp(boost, target, target > boost ? 0.25 : 0.7, dt)
      for (const r of rings) { r.angle += r.spin * boost * dt; r.mesh.rotation.y = r.angle }
      precess.rotation.y += dt * (rm ? 0 : 0.05 + 0.04 * boost)
      sweep += dt * (rm ? 0.4 : 0.7 + 0.5 * boost)
      // the bezel clicks to a notch on every hub:detent (a spring), and drifts slowly otherwise
      bezelVel += notch * (15 * Math.PI / 180) * 7.5; notch = 0
      bezelVel *= Math.exp(-dt * 7.5)
      bezelAngle += bezelVel * dt + dt * 0.03 * (rm ? 0 : 1)
      for (const r of rings) {
        const u = r.mat.uniforms
        u.uAlpha.value = strength * 0.78; u.uSweep.value = sweep * (r.spin > 0 ? 1 : -1); u.uKick.value = flash * 0.5 + 0.45 * mus.x + 0.5 * SIGU.uSgRip.value.y   // v19: the bass and each beat ring light the bands
      }
      const bu = bezelMat.uniforms
      bu.uAlpha.value = Math.min(1, strength * 1.1); bu.uRot.value = bezelAngle; bu.uSweep.value = sweep * 1.3; bu.uKick.value = flash + 0.5 * mus.x + 0.6 * SIGU.uSgRip.value.y
      bezel.lookAt(cam.position) // the bezel always faces the camera
    }
  }
  const timedStep = timed('rings', step)
  return { update(t, dt, st) { if (!isOn('rings')) { root.visible = false; return } timedStep(t, dt, st) } }
}
