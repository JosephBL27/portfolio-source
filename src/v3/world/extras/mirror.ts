// A dark glossy floor under the hub and the ring of areas (Igloo / ALCHE): a planar reflection of the TV meshes, the glass brain and the
// type rings, drawn at half resolution, blurred, with fresnel and a slowly drifting roughness noise. The 262k particles are NOT drawn in
// the reflection pass; a decimated, enlarged subset stands in for them. Added on top of the picture (additive), so it can only add a
// glossy sheen: it is also faded inside the copy lane and at the centred-copy waypoints, never washes the type.
// Also draws faint floor markings: the ring the areas hang on, a pad under each area (the current area's pad lights up).
// Desktop only (off on phones). Skips the reflection pass entirely when no floor pixel can be on screen. Honours ?extras=0 / ?extras=-mirror.
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import type { Extra, ExtraCtx } from '../../main'
import { AREAS, HUB, RING, WAYPOINTS } from '../layout'
import { damp, extraOn, isOn, isPhone, lerp, timed } from './lib/flags'
import { LANE_ON, Lane } from './lib/lane'
import { HOLES, HOLES_GLSL } from '../occlusion'

const FLOOR_Y = -6.6, RADIUS = 96
// tuning / measurement switches (?mirror=noproxy,noworld,nomips,res=0.35)
const MX = new Set((typeof location !== 'undefined' ? new URLSearchParams(location.search).get('mirror') ?? '' : '').split(',').filter(Boolean))
const mx = (k: string, d: number) => Number([...MX].find(x => x.startsWith(k + '='))?.slice(k.length + 1) ?? 0) || d
const MRES = mx('res', 0.5)
/** per waypoint id: [reflection, floor markings]. Centred-copy waypoints (the name, the clouds) are zero (v20: they are the cosmos, no floor, no reflection) */
const STRENGTH: Record<string, [number, number]> = { clouds: [0, 0], name: [0, 0], world: [1.0, 1.0], epilogue: [0.55, 0.6] }
const STRENGTH_REST: [number, number] = [0.35, 0.9]
const strengthAt = (i: number) => STRENGTH[WAYPOINTS[Math.max(0, Math.min(WAYPOINTS.length - 1, i))].id] ?? STRENGTH_REST

const VERT = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv; varying vec3 vW;
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse; uniform vec3 color;
uniform float uTime, uRefl, uMark, uGain, uHubOn;
uniform vec2 uRes; uniform vec4 uLane;
${HOLES_GLSL}
uniform vec4 uPad[6]; uniform vec3 uPadCol[6]; uniform float uPadOn[6];
varying vec4 vUv; varying vec3 vW;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec3 Vv = cameraPosition - vW; float dist = length(Vv); vec3 V = Vv / dist;
  float ndv = clamp(V.y, 0.0, 1.0);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 3.6);
  // roughness: slow warped noise nudges the lookup, blur grows with distance (a wet, dark stone floor)
  vec2 n1 = vec2(vn(vW.xz * 0.21 + uTime * 0.02), vn(vW.xz * 0.21 + 17.3 - uTime * 0.017)) - 0.5;
  float jit = h21(gl_FragCoord.xy) * 6.2831853;
  // roughness varies across the floor: polished patches (sharp, bright) beside matte, dusty ones; the blur grows with distance and
  // stretches vertically (a wet floor smears a reflection along the view direction)
  float polish = smoothstep(0.25, 0.75, vn(vW.xz * 0.065 + 3.1)) * 0.6 + 0.4 * vn(vW.xz * 0.45);
  float rough = (0.45 + 0.85 * smoothstep(8.0, 70.0, dist)) * mix(0.55, 1.45, polish);
  vec2 uv = vUv.xy / vUv.w + n1 * 0.05 * rough;
  float lod = 0.6 + 1.9 * rough;
  vec2 px = 1.0 / vec2(textureSize(tDiffuse, 0));
  vec3 acc = vec3(0.0);
  float stretch = 1.0 + 2.4 * (1.0 - ndv);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 2.39996 + jit, rr = sqrt((float(i) + 0.5) / 8.0);
    acc += textureLod(tDiffuse, uv + vec2(cos(a), sin(a) * stretch) * rr * px * (1.5 + 5.0 * rough), lod).rgb;
  }
  vec3 refl = acc / 8.0;
  float rad = length(vW.xz);
  float fade = 1.0 - smoothstep(36.0, 92.0, rad);
  vec3 c = refl * fres * uGain * fade * uRefl;
  // ---- markings: the ring the areas hang on (with a tick every 2.5 deg), and a pad under each area
  float aa = max(fwidth(rad), 1e-3), aaFade = 1.0 - smoothstep(0.25, 0.9, aa);
  float ang = atan(vW.z, vW.x);
  float ringLine = (1.0 - smoothstep(0.0, aa * 1.5, abs(rad - ${RING.toFixed(1)}) - 0.035));
  float tick = (1.0 - smoothstep(0.0, aa * 1.5, abs(fract(ang / 6.2831853 * 144.0 + 0.5) - 0.5) * 6.2831853 / 144.0 * rad - 0.018)) * step(abs(rad - ${RING.toFixed(1)}), 0.42);
  vec3 mk = vec3(0.95, 0.88, 0.76) * (ringLine * 0.2 + tick * 0.16) * aaFade;
  for (int i = 0; i < 6; i++) {
    vec2 d = vW.xz - uPad[i].xy; float r2 = dot(d, d), pr = uPad[i].z;
    if (r2 > pr * pr * 16.0) continue;
    float r = sqrt(r2), w = aa * 1.4 + 0.02;
    float line = 1.0 - smoothstep(0.0, w, abs(r - uPad[i].z));
    float line2 = 1.0 - smoothstep(0.0, w, abs(r - uPad[i].z * 0.62));
    float glow = exp(-r * r / (uPad[i].z * uPad[i].z * 0.7));
    mk += uPadCol[i] * ((line * 0.34 + line2 * 0.14) * (0.35 + 0.9 * uPadOn[i]) + glow * (0.05 + 0.24 * uPadOn[i])) * aaFade;
  }
  // the pool of light under the hub screen
  mk += vec3(1.0, 0.66, 0.42) * exp(-dot(vW.xz, vW.xz) / 52.0) * 0.07 * uHubOn;
  c += mk * uMark;
  // the copy lane stays clean: calmer, never washing
  vec2 nd = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float lane = 1.0;
  if (uLane.w > 0.5) lane = smoothstep(-0.34, -0.04, nd.y);
  else if (abs(uLane.x) > 0.001) { float u = nd.x * -sign(uLane.x); lane = mix(1.0, smoothstep(uLane.y, uLane.y + uLane.z, u), abs(uLane.x)); }
  c *= mix(0.16, 1.0, lane);
  c *= mix(0.22, 1.0, holeMask(gl_FragCoord.xy / uRes));   // v11: calm under the subject and the copy
  c = c / (1.0 + c * 1.1);              // soft ceiling: a reflection can glow, never blow out
  c = min(c, vec3(0.42));
  gl_FragColor = vec4(c, 1.0);
}`

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('mirror') || !ctx.field?.scene || isPhone()) return
  const field = ctx.field, scene: THREE.Scene = field.scene, renderer: THREE.WebGLRenderer = field.renderer, cam: THREE.PerspectiveCamera = field.camera
  const pts = scene.children.find(o => (o as THREE.Points).isPoints) as THREE.Points | undefined
  const lane = new Lane()
  const bs = new THREE.Vector2()
  const halfSize = () => {
    renderer.getDrawingBufferSize(bs)
    const k = Math.min(MRES, 1100 / Math.max(1, bs.x))
    return [Math.max(64, Math.round(bs.x * k)), Math.max(64, Math.round(bs.y * k))] as const
  }
  let [tw, th] = halfSize()
  const padU = Array.from({ length: 6 }, () => new THREE.Vector4())
  const padC = Array.from({ length: 6 }, () => new THREE.Color())
  AREAS.slice(0, 6).forEach((a, i) => { padU[i].set(a.center[0], a.center[2], 5.2, 0); padC[i].set(a.accent).multiplyScalar(0.9) })
  const shader = {
    name: 'AtmosMirror',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uTime: { value: 0 }, uRefl: { value: 0 }, uMark: { value: 0 }, uGain: { value: 6.5 }, uHubOn: { value: 0 }, uRes: { value: new THREE.Vector2(1440, 900) }, uLane: { value: lane.u }, uHole: HOLES,
      uPad: { value: padU }, uPadCol: { value: padC }, uPadOn: { value: new Float32Array(6) },
    },
    vertexShader: VERT, fragmentShader: MX.has('flat') ? 'void main() { gl_FragColor = vec4(0.0); }' : FRAG,
  }
  const refl = new Reflector(new THREE.CircleGeometry(RADIUS, 160), { textureWidth: tw, textureHeight: th, clipBias: 0.003, multisample: 0, shader, color: 0x000000 })
  refl.rotation.x = -Math.PI / 2; refl.position.set(HUB[0], FLOOR_Y, HUB[2]); refl.name = 'atmos-mirror'; refl.renderOrder = -1
  const mat = refl.material as THREE.ShaderMaterial
  mat.transparent = true; mat.depthWrite = false; mat.depthTest = true; mat.blending = THREE.AdditiveBlending
  const rt = refl.getRenderTarget()
  if (!MX.has('nomips')) { rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter } else { rt.texture.generateMipmaps = false; rt.texture.minFilter = THREE.LinearFilter }
  rt.texture.magFilter = THREE.LinearFilter
  const u = mat.uniforms
  u.uHole = HOLES   // the Reflector clones the shader's uniforms: share the zones' holes by reference again
  field.addObject(refl)

  // a decimated, enlarged copy of the particle field stands in for the 262k points in the reflection pass
  let proxy: THREE.Points | null = null
  const STRIDE = mx('stride', 36), SIZE_K = mx('size', 0.7), PGAIN = mx('pgain', 10)
  if (pts) {
    const src = pts.geometry as THREE.BufferGeometry, n = src.getAttribute('position').count
    const g = new THREE.BufferGeometry()
    for (const k of ['position', 'ref', 'rnd']) { const a = src.getAttribute(k); if (a) g.setAttribute(k, a) }
    const idx = new Uint32Array(Math.floor(n / STRIDE)); for (let i = 0; i < idx.length; i++) idx[i] = i * STRIDE
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    proxy = new THREE.Points(g, pts.material); proxy.frustumCulled = false; proxy.visible = false; proxy.name = 'atmos-mirror-proxy'
    scene.add(proxy)
  }

  let active = false, reflOn = false, wasActive = false, frame = 0, stride = 1, sRefl = 0, sMark = 0, cover = 0, hubOn = 0, hold = 0
  // The reflection is drawn HERE, in the pre-render hook, as its own pass BEFORE the composer's main pass (Reflector would nest it inside the
  // main RenderPass, which splits that pass: costly on a tile GPU). It uses last frame's camera: a one-frame lag nobody can see through the blur.
  const orig = refl.onBeforeRender as unknown as (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera) => void
  refl.onBeforeRender = () => {}
  const renderReflection = () => {
    const hidden: THREE.Object3D[] = []
    for (const ch of scene.children) if (ch !== refl && ch.visible && (ch === pts || ch.userData.noReflect)) { ch.visible = false; hidden.push(ch) }
    const pu = pts ? (pts.material as THREE.ShaderMaterial).uniforms : null
    const dpr0 = pu?.uDpr.value, gx0 = pu?.uGainX.value ?? 0
    if (MX.has('noworld') && ctx.world?.root) { ctx.world.root.visible = false; hidden.push(ctx.world.root) }
    if (proxy && pu && !MX.has('noproxy')) { proxy.visible = true; pu.uDpr.value = dpr0 * (tw / Math.max(1, bs.x)) * SIZE_K; pu.uGainX.value = (1 + gx0) * PGAIN - 1 }
    LANE_ON.value = 0
    try { orig.call(refl, renderer, scene, cam) } finally {
      LANE_ON.value = 1
      if (proxy) proxy.visible = false
      if (pu) { pu.uDpr.value = dpr0; pu.uGainX.value = gx0 }
      for (const ch of hidden) ch.visible = true
    }
  }

  const fwd = new THREE.Vector3()
  const step = (t: number, dt: number, st: Parameters<NonNullable<Extra['update']>>[2]) => {
    {
      frame++
      // ---- is any floor pixel on screen? (lowest view ray must dip below the horizon far enough to meet the floor inside its fade radius)
      cam.getWorldDirection(fwd)
      const h = cam.position.y - FLOOR_Y, pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)))
      const half = THREE.MathUtils.degToRad(cam.fov * 0.5), aFar = Math.atan(h / (RADIUS * 0.95))
      const low = pitch - half * 1.15
      const need = h > 0.3 && low < -aFar
      // how much of the screen height the floor covers (angular): the reflection pass only runs when it is worth it
      cover = h > 0.3 ? Math.max(0, Math.min(1, (aFar - (pitch - half)) / (2 * half))) : 0
      hold = need ? 14 : Math.max(0, hold - 1)
      active = need || hold > 0
      refl.visible = active
      if (!active) { wasActive = false; return }
      if (!wasActive) { wasActive = true }
      // ---- keep the reflection target matched to the window (half resolution, capped)
      if (frame % 30 === 0) {
        const [w, hh] = halfSize()
        if (w !== tw || hh !== th) { tw = w; th = hh; rt.setSize(tw, th) }
      }
      renderer.getDrawingBufferSize(bs); u.uRes.value.copy(bs)
      // ---- strength by waypoint, the active area's pad
      const k = st.dwelling ? 0 : st.t
      const sa = strengthAt(st.wp), sb = strengthAt(st.next)
      sRefl = damp(sRefl, lerp(sa[0], sb[0], k), 0.4, dt); sMark = damp(sMark, lerp(sa[1], sb[1], k), 0.4, dt)
      reflOn = cover > 0.06
      if (frame % 3 === 0 && ctx.world?.stats) hubOn = ctx.world.stats().hubOn ?? 0
      const ramp = Math.min(1, Math.max(0, (cover - 0.06) / 0.14)); u.uRefl.value = sRefl * ramp * ramp * (3 - 2 * ramp); u.uMark.value = sMark; u.uHubOn.value = Math.min(1, hubOn); u.uTime.value = t
      const a0 = AREAS.findIndex(a => a.id === st.area)
      const dst = WAYPOINTS[Math.max(0, Math.min(WAYPOINTS.length - 1, st.next))].area, a1 = AREAS.findIndex(a => a.id === dst)
      const on = u.uPadOn.value as Float32Array
      for (let i = 0; i < 6; i++) on[i] = damp(on[i], (i === a0 ? 1 - k : 0) + (i === a1 ? k : 0), 0.3, dt)
      u.uLane.value.copy(lane.update(st, dt))
      // the reflection is cheap to skip on alternate frames when the machine is struggling
      const med = field.stats?.medianMs ?? 0
      stride = !MX.has('nostride') && (st.dwelling || med > 17.5) ? 2 : 1   // at rest the blurred reflection refreshes every other frame
      if (reflOn && !MX.has('norefl') && (stride === 1 || frame % stride === 0)) renderReflection()
    }
  }
  const timedStep = timed('mirror', step)
  return { update(t, dt, st) { if (!isOn('mirror')) { active = false; refl.visible = false; return } timedStep(t, dt, st) } }
}
