// Shared parts of the five interest spaces (w11): the Space contract, the one fog every space shares, a black ground that fades at the radius with a warm contact
// pool, drifting motes, a cone of light, a soft glow plane. Everything here is a pure function of (time, presence): nothing remembers anything.
//  * depth fog: standard materials get it through `fogify` (distance from the camera mixes toward the haze colour, and the presence fades the whole object up out of
//    the dark); custom shaders include the same two lines. The scene itself has no fog, so nothing else in the world is touched.
//  * Light: the manager owns ONE spot (key) and ONE point light (rim) for all five spaces and moves them to the present space (a light added or removed per space would
//    recompile every lit material in the world each time). A space only describes where its two lights go (LightCfg, space-local).
import * as THREE from 'three'
import { glowTexture } from '../cabinet/kit'

export type Vec3 = [number, number, number]
export interface SpaceDef { id: string; i: number; at: Vec3; yaw: number; radius: number }
export interface LightCfg {
  keyPos: Vec3; keyAim: Vec3; keyCol: Vec3; keyI: number; keyAngle: number; keyPen: number; keyDist: number
  rimPos: Vec3; rimCol: Vec3; rimI: number; rimDist: number
  /** a faint sky / ground fill (one shared HemisphereLight) so the dark masses read as shapes, not holes */
  fillSky?: Vec3; fillGround?: Vec3; fillI?: number
}
/** uniforms every space material shares (by reference: one write per frame reaches all of them) */
export interface Fog { pres: { value: number }; col: { value: THREE.Color }; range: { value: THREE.Vector2 }; time: { value: number }; px: { value: number } }
export const makeFog = (col: Vec3 = [0.012, 0.012, 0.018], near = 11, far = 27): Fog => ({
  pres: { value: 0 }, col: { value: new THREE.Color(...col) }, range: { value: new THREE.Vector2(near, far) }, time: { value: 0 }, px: { value: 1 },
})
export interface SpaceKit {
  renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; scene: THREE.Scene; env: THREE.Texture
  phone: boolean; reduced(): boolean
  /** this interest's window colour (hall/rig INTERESTS[i].light), display-referred */
  win: Vec3
  fog: Fog; def: SpaceDef; nocrag: boolean
  /** the stage's yaw relative to the space's (layout place.yaw - space yaw): a space that builds something under its stage turns it by this */
  stageYaw: number
}
export interface Space {
  id: string
  root: THREE.Group
  light: LightCfg
  build(k: SpaceKit): void | Promise<void>
  /** r = presence 0..1 (the cabinet curve); dwell = standing at the waypoint */
  update(t: number, dt: number, r: number, dwell: boolean): void
  info?(): Record<string, unknown>
  dispose(): void
}

/** standard materials: depth fog toward the haze colour and the fade-up out of the dark. Safe to call once per material. */
export function fogify<M extends THREE.Material>(m: M, fog: Fog): M {
  m.onBeforeCompile = sh => {
    sh.uniforms.uSpPres = fog.pres; sh.uniforms.uSpFogC = fog.col; sh.uniforms.uSpFogR = fog.range
    sh.fragmentShader = 'uniform float uSpPres; uniform vec3 uSpFogC; uniform vec2 uSpFogR;\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      'gl_FragColor.rgb = mix(gl_FragColor.rgb, uSpFogC, smoothstep(uSpFogR.x, uSpFogR.y, length(vViewPosition))) * uSpPres;\n#include <dithering_fragment>')
  }
  m.customProgramCacheKey = () => 'sp-fog'
  return m
}

/** the GLSL the spaces' own shaders share */
export const NOISE = /* glsl */ `
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { s += a * vn(p); p = m * p; a *= 0.5; } return s; }
`

/** a black ground disc, opaque in the middle (so a stage rising out of it is hidden below) and fading to nothing at the radius.
 *  `frag` must define `vec4 ground(vec2 p, float r)` (p = position on the floor in space-local x, z; r = 0..1 across the radius) returning colour and a coverage multiplier. */
export function groundMesh(k: SpaceKit, o: { frag: string; uniforms?: Record<string, THREE.IUniform>; radius?: number }): THREE.Mesh {
  const R = o.radius ?? k.def.radius
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uR: { value: R }, uPres: k.fog.pres, uTime: k.fog.time, ...(o.uniforms ?? {}) },
    vertexShader: 'varying vec2 vP; void main() { vP = vec2(position.x, -position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vP; uniform float uR, uPres, uTime;\n${NOISE}\n${o.frag}\n` +
      'void main() { float r = length(vP) / uR; vec4 g = ground(vP, r); float edge = 1.0 - smoothstep(0.5, 1.0, r); gl_FragColor = vec4(g.rgb * uPres, g.a * edge * clamp(uPres * 2.5, 0.0, 1.0)); }',
  })
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 96), mat)
  // CircleGeometry lies in XY (normal +z): the mesh is turned flat, which maps local (x, y) to floor (x, -z), exactly what vP undoes
  m.rotation.x = -Math.PI / 2; m.renderOrder = -10; m.position.y = -0.02; m.name = 'ground'      // a hair under y = 0: the stages' own floors and pedestals are coplanar with y = 0
  return m
}

/** a soft additive pool / glow lying on the floor (plane in xz) or standing (plane in xy, set `standing`) */
export function glowPlane(k: SpaceKit, o: { col: Vec3; size: number | [number, number]; opacity?: number; standing?: boolean }): THREE.Mesh {
  const [w, h] = Array.isArray(o.size) ? o.size : [o.size, o.size]
  const mat = new THREE.MeshBasicMaterial({ map: glowTexture(o.col[0], o.col[1], o.col[2]), transparent: true, opacity: o.opacity ?? 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  if (!o.standing) m.rotation.x = -Math.PI / 2
  m.renderOrder = 3; m.userData.base = mat.opacity
  // fade with the space's presence: the manager multiplies `userData.base` by presence through `pulse`
  return m
}

export interface Motes { points: THREE.Points; set(alpha: number, speed?: number): void; dispose(): void }
/** drifting motes in a box (centre at `at`, half sizes x and z, height h): additive soft dots rising slowly with a gentle sway */
export function motes(k: SpaceKit, o: { n: number; at?: Vec3; half: [number, number]; h: number; col: Vec3; size: number; speed: number; sway?: number; seed?: number; alpha?: number }): Motes {
  const n = Math.round(o.n * (k.phone ? 0.55 : 1))
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4)
  let s = (o.seed ?? 7) >>> 0
  const R = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (o.at?.[0] ?? 0) + (R() * 2 - 1) * o.half[0]; pos[i * 3 + 1] = R() * o.h; pos[i * 3 + 2] = (o.at?.[2] ?? 0) + (R() * 2 - 1) * o.half[1]
    for (let c = 0; c < 4; c++) rnd[i * 4 + c] = R()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rnd, 4))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(o.at?.[0] ?? 0, (o.at?.[1] ?? 0) + o.h / 2, o.at?.[2] ?? 0), Math.max(o.half[0], o.half[1], o.h) * 1.6)
  const u = { uTime: k.fog.time, uPres: k.fog.pres, uPx: k.fog.px, uSize: { value: o.size }, uH: { value: o.h }, uSpeed: { value: o.speed }, uSway: { value: o.sway ?? 0.35 }, uCol: { value: new THREE.Color(...o.col) }, uAlpha: { value: o.alpha ?? 0.8 }, uY0: { value: o.at?.[1] ?? 0 } }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uTime, uPx, uSize, uH, uSpeed, uSway, uY0; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(position.y + uTime * uSpeed * (0.55 + 0.9 * aR.y), uH);
        p.x += sin(uTime * 0.23 * (0.5 + aR.x) + aR.x * 40.0) * uSway; p.z += cos(uTime * 0.19 * (0.5 + aR.y) + aR.y * 31.0) * uSway;
        p.y += uY0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float ph = (p.y - uY0) / uH;
        vA = smoothstep(0.0, 0.14, ph) * (1.0 - smoothstep(0.7, 1.0, ph)) * (0.5 + 0.5 * sin(uTime * (0.7 + aR.w * 1.8) + aR.x * 20.0));
        gl_PointSize = clamp(uSize * uPx * (0.5 + aR.z) * (9.0 / max(1.0, -mv.z)), 1.0, 24.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform vec3 uCol; uniform float uPres, uAlpha; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0); gl_FragColor = vec4(uCol, a * vA * uAlpha * uPres); }`,
  })
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 6; points.name = 'motes'
  return { points, set(a, sp) { u.uAlpha.value = (o.alpha ?? 0.8) * a; if (sp != null) u.uSpeed.value = o.speed * sp }, dispose() { g.dispose(); mat.dispose() } }
}

export interface Cone { mesh: THREE.Mesh; set(I: number, col?: Vec3): void }
/** a cone of light: apex at the mesh origin, opening downward over `h`, brightest near the source, soft at the silhouette (edge fade by view angle) */
export function lightCone(k: SpaceKit, o: { h: number; r: number; col: Vec3; I: number; seed?: number }): Cone {
  const g = new THREE.ConeGeometry(o.r, o.h, 64, 1, true); g.translate(0, -o.h / 2, 0)
  const u = { uTime: k.fog.time, uPres: k.fog.pres, uI: { value: o.I }, uCol: { value: new THREE.Color(...o.col) }, uH: { value: o.h }, uSeed: { value: o.seed ?? 1 } }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: u,
    vertexShader: /* glsl */ `
      uniform float uH; varying vec3 vN, vV; varying float vH; varying vec3 vL;
      void main() { vH = -position.y / uH; vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform vec3 uCol; uniform float uI, uPres, uTime, uSeed; varying vec3 vN, vV, vL; varying float vH;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        float along = (1.0 - 0.72 * vH) * smoothstep(0.0, 0.05, vH) * (1.0 - smoothstep(0.82, 1.0, vH));
        float ang = atan(vL.z, vL.x);
        float dust = 0.78 + 0.22 * vn(vec2(ang * 3.0 + uSeed, vH * 5.0 - uTime * 0.12));
        float a = e * along * dust * uI * uPres;
        gl_FragColor = vec4(uCol, a);
      }`,
  })
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 5; mesh.frustumCulled = false; mesh.name = 'cone'
  return { mesh, set(I, col) { u.uI.value = I; if (col) u.uCol.value.setRGB(...col) } }
}

export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
/** deterministic rng (mulberry-ish LCG) */
export function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
