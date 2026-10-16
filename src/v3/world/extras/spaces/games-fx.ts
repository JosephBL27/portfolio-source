// Shared by the three games rooms (unit 15B): a tiny signal bus the stages write and the rooms read (a die was thrown, a chess move was made), the lazy
// loader of the Blender props (public/models/glb/games-props.glb, null when it is missing: every room then keeps a procedural stand-in), a bokeh ring, and
// a one-shot burst of sparks / chalk / embers that is a pure function of its age.
import * as THREE from 'three'
import { loadGLB, meshesByName } from '../../glbmodel'
import type { SpaceKit, Vec3 } from './common'

/** seconds on performance.now()'s clock; stages stamp, rooms compare. Nothing else is shared. */
export const sig = { rollAt: -1e9, moveAt: -1e9, hoverAt: -1e9, pressAt: -1e9 }
export const nowS = () => performance.now() / 1000
export const stamp = (k: keyof typeof sig) => { sig[k] = nowS() }
/** 1 at the moment of the stamp, decaying to 0 over `life` seconds */
export const since = (k: keyof typeof sig, life: number) => Math.max(0, 1 - (nowS() - sig[k]) / life)

let props: Promise<Map<string, THREE.Mesh> | null> | null = null
/** the named parts of games-props.glb (one mesh each, at the origin), or null */
export const gameProps = () => (props ??= loadGLB('games-props').then(g => (g ? meshesByName(g) : null)))

export interface Bokeh { points: THREE.Points; set(alpha: number, pulse: number, t: number): void; dispose(): void }
/** a ring of large, soft, out-of-focus lights far behind a room: additive discs that breathe and drift a little */
export function bokeh(k: SpaceKit, o: { n: number; rMin: number; rMax: number; yMin: number; yMax: number; cols: Vec3[]; size: number; seed?: number; arc?: [number, number] }): Bokeh {
  const n = Math.round(o.n * (k.phone ? 0.6 : 1))
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4), col = new Float32Array(n * 3)
  let s = (o.seed ?? 3) >>> 0
  const R = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  const [a0, a1] = o.arc ?? [0, Math.PI * 2]
  for (let i = 0; i < n; i++) {
    const a = a0 + R() * (a1 - a0), r = o.rMin + R() * (o.rMax - o.rMin)
    pos[i * 3] = Math.sin(a) * r; pos[i * 3 + 1] = o.yMin + R() * (o.yMax - o.yMin); pos[i * 3 + 2] = -Math.cos(a) * r
    for (let c = 0; c < 4; c++) rnd[i * 4 + c] = R()
    const cc = o.cols[Math.floor(R() * o.cols.length)]; col.set(cc, i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rnd, 4)); g.setAttribute('aC', new THREE.BufferAttribute(col, 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), o.rMax * 2)
  const u = { uTime: k.fog.time, uPres: k.fog.pres, uPx: k.fog.px, uSize: { value: o.size }, uA: { value: 1 }, uPulse: { value: 0 } }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec4 aR; attribute vec3 aC; uniform float uTime, uPx, uSize, uPulse; varying vec3 vC; varying float vB;
      void main() {
        vec3 p = position; p.y += sin(uTime * 0.12 * (0.4 + aR.x) + aR.y * 30.0) * 0.35; p.x += cos(uTime * 0.09 + aR.z * 20.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float br = 0.55 + 0.45 * sin(uTime * (0.25 + aR.w * 0.7) + aR.x * 50.0);
        vB = br * (0.6 + 0.8 * aR.z) * (1.0 + uPulse * (0.8 + aR.y));
        vC = aC;
        gl_PointSize = clamp(uSize * uPx * (0.45 + aR.y * 1.1) * (1.0 + 0.25 * uPulse) * (26.0 / max(1.0, -mv.z)), 3.0, 190.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform float uPres, uA; varying vec3 vC; varying float vB;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float disc = smoothstep(1.0, 0.86, d);                            // a lens aperture: a flat disc with a brighter rim
        float rim = smoothstep(0.55, 0.95, d) * disc * 0.55;
        gl_FragColor = vec4(vC * (0.5 + rim) * disc * vB * uA * uPres * 0.2, 1.0);
      }`,
  })
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 2; points.name = 'bokeh'
  return { points, set(a, pulse) { u.uA.value = a; u.uPulse.value = pulse }, dispose() { g.dispose(); mat.dispose() } }
}

export interface Burst { points: THREE.Points; fire(origin: Vec3): void; update(): void; dispose(): void }
/** a one-shot burst: n particles leave `origin` with random velocities, gravity g (negative floats up), grow, then fade. Pure function of its age; invisible when idle. */
export function burst(k: SpaceKit, o: { n: number; speed: number; up: number; g: number; life: number; size: number; grow?: number; col: Vec3; alpha: number; seed?: number }): Burst {
  const n = Math.round(o.n * (k.phone ? 0.6 : 1))
  const v = new Float32Array(n * 3), rnd = new Float32Array(n * 3), pos = new Float32Array(n * 3)
  let s = (o.seed ?? 11) >>> 0
  const R = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * o.speed
    v[i * 3] = Math.cos(a) * r; v[i * 3 + 1] = o.up * (0.4 + R() * 0.9); v[i * 3 + 2] = Math.sin(a) * r
    for (let c = 0; c < 3; c++) rnd[i * 3 + c] = R()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aV', new THREE.BufferAttribute(v, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rnd, 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  const u = { uAge: { value: 99 }, uO: { value: new THREE.Vector3() }, uG: { value: o.g }, uLife: { value: o.life }, uSize: { value: o.size }, uGrow: { value: o.grow ?? 0 }, uCol: { value: new THREE.Color(...o.col) }, uAlpha: { value: o.alpha }, uPx: k.fog.px, uPres: k.fog.pres }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec3 aV; attribute vec3 aR; uniform float uAge, uG, uLife, uSize, uGrow, uPx; uniform vec3 uO; varying float vA;
      void main() {
        float a = uAge * (0.75 + 0.5 * aR.x);
        vec3 p = uO + aV * (1.0 - exp(-a * 2.2)) / 2.2 * 2.0; p.y -= 0.5 * uG * a * a;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float f = clamp(a / uLife, 0.0, 1.0); vA = (1.0 - f) * (1.0 - f) * smoothstep(0.0, 0.04, a) * step(a, uLife) * (0.6 + 0.4 * sin(a * 30.0 + aR.y * 40.0));
        gl_PointSize = clamp(uSize * uPx * (0.5 + aR.z) * (1.0 + uGrow * a) * (9.0 / max(1.0, -mv.z)), 1.0, 70.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform vec3 uCol; uniform float uAlpha, uPres; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0); gl_FragColor = vec4(uCol, a * vA * uAlpha * uPres); }`,
  })
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 7; points.visible = false; points.name = 'burst'
  let t0 = -1e9
  return {
    points,
    fire(origin) { u.uO.value.set(...origin); t0 = nowS(); u.uAge.value = 0; points.visible = true },
    update() { const age = nowS() - t0; if (age > o.life * 1.5) { points.visible = false; return } u.uAge.value = age },
    dispose() { g.dispose(); mat.dispose() },
  }
}
