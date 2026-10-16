// The particle field: ONE THREE.Points drawn with the composed morph shader (compose.ts), a camera
// rig, and the post stack (post.ts). The site calls setState(a, b, mix) from scroll; everything else
// (time, pointer, camera spring, quality, pause) lives in here.
//
//   const field = createField(canvas, { forms: Object.values(FORMS), onProgress })
//   await field.ready
//   field.setState('brain', 'pushup', 0.37)
//
// v4 (continuous world): the site calls setWorld({ a, b, mix, placeA, placeB, cam }) every frame from the
// flight (src/v3/world/flight.ts). The camera is driven directly (light damping, so it never trails the
// morph), each bound form sits at its own world placement, and a morph can never complete faster than
// 0.9 s however hard the scroll is thrown. Scene objects (the TVs) are added with addObject(); anything
// that must render before the frame (TV render targets) hooks onBeforeRender().
// Colour note for scene meshes: the post stack writes display-referred colour, so author mesh colours that way.
//
// Coordinates for project(): CSS pixels relative to the canvas's top-left corner.
import * as THREE from 'three'
import type { Placement } from '../world/layout'
import type { FormDef } from '../forms/types'
import { makeCtx, H } from '../forms/ctx'
import { composeVertex, FRAGMENT, particleAttributes, FORM_STYLE, packFormStyle, morphStyleId, FLOOR_Y, HUB_AIM } from './compose'
import { CameraRig, smoothDamp } from './camera'
import { createPost, type Post } from './post'
import { Governor, planQuality, prefersReducedMotion } from './quality'

export interface Field {
  /** resolves when every form's textures are built and uploaded */
  ready: Promise<void>
  /** w12: resolves when the forms of the first waypoints (opts.firstIds, default the first three forms) are built: the loader's gate. `ready` still waits for every form. */
  readyFirst: Promise<void>
  /** bind form ids a -> b at morph position mix (0..1). Unbuilt forms are prioritised and swapped in when ready. */
  setState(a: string, b: string, mix: number): void
  /** strength of the curl swirl a particle gets in flight (default 1.2); eased */
  setTurbulence(v: number): void
  /** depth-of-field focus distance in world units; pass 0 / NaN to return to auto (camera-to-target) */
  setFocus?(d: number): void
  /** scroll velocity in viewport-heights per second (+ = down); drives the dolly kick */
  setVelocity?(v: number): void
  /** force the shader clock (seconds); for screenshots */
  setTime?(t: number): void
  /** v4: bind the whole world for this frame (forms a -> b at mix, their placements, the camera pose). Call every frame; cheap. */
  setWorld(s: WorldGoal): void
  /** v4: add a scene object (TV, bezel, glass...) drawn with the particles; returns a remover */
  addObject(o: THREE.Object3D): () => void
  /** v4: called at the start of every rendered frame (before the camera and morph step); use it to render TV targets or move scene objects. Returns an unsubscribe. */
  onBeforeRender(cb: (t: number, dt: number) => void): () => void
  /** Called after framing, parallax and the camera spring, before drawing; scene-local camera constraints belong here. */
  onAfterCamera(cb: () => void): () => void
  /** w14: compile the materials under `obj` (default: the whole scene, hidden objects included) for the scene pass without stalling a frame (KHR_parallel_shader_compile).
   *  The scene is drawn into the post pipeline's render target, whose programs differ from a draw to the canvas (colour space, tone mapping), so the compile is bound to that target;
   *  a plain renderer.compileAsync() builds programs the frame never uses. Resolves when the programs are linked; never rejects. */
  compileAhead(obj?: THREE.Object3D): Promise<void>
  /** r7: the auto-exposure runs on the GPU and is never read back; this reads it once, on demand (tests, debugging), and also stores it in stats.exposure */
  readExposure(): Promise<number>
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  /** v10: the particle THREE.Points (for visibility toggles / custom passes). Its material is the morph shader; do not replace it. */
  readonly points: THREE.Points
  /** v10: global particle opacity: 0 hides every particle, 1 = normal. A cheap uniform (no re-bind); safe to set every frame. The auto-exposure keeps metering the particles while they are hidden. */
  setFieldAlpha(a: number): void
  /** v10: light sources that tint the particles near them (world.glow() output: hub screen first, then live TVs; the first 4 are used).
   *  position = world point, color = linear rgb, intensity 0..1, radius = world units. The first source is also the key light of 'solid' forms. Set every frame; the extra world/extras/pdyn.ts does. */
  setLights(list: { position: { x: number; y: number; z: number } | ArrayLike<number>; color: { r: number; g: number; b: number } | ArrayLike<number>; intensity: number; radius: number }[]): void
  /** v10: motion-streak strength (default 1, 0 = off; reduced motion forces 0). Points stretch along their screen-space velocity while a morph is moving. */
  setStreak(k: number): void
  /** v10 mirror hook: a decimated copy of the particles (every round(1/frac)-th) as its own THREE.Points that shares the morph material and
   *  geometry, so it follows every choreography and style for free. It lives in a private scene (not `scene`); use drawSubset to draw it. */
  subset(frac: number): THREE.Points
  /** v10 mirror hook: draw ONLY a decimated particle subset (fraction `frac` of the field) with `camera` into the CURRENT render target,
   *  on top of whatever it holds (no clear). `dprScale` shrinks/enlarges the dots (a half-resolution target wants ~0.5..0.7), `gain` brightens
   *  them (fewer dots, same energy). Cost is the subset's vertex count only, e.g. 1/36 of the field is ~7k points. */
  drawSubset(renderer: THREE.WebGLRenderer, camera: THREE.Camera, frac: number, opts?: { dprScale?: number; gain?: number }): void
  /** morph amount actually on screen (follows the goal with the 0.9 s floor) and the displayed pair */
  readonly shown: { a: string; b: string; mix: number }
  project(p: [number, number, number]): { x: number; y: number; visible: boolean }
  /** pause: freezes time and stops rendering once the frame has settled; any state change wakes it */
  setPaused(p: boolean): void
  /** per-frame hook (t = shader time in seconds, dt = real frame delta, clamped). Returns an unsubscribe. */
  onFrame(cb: (t: number, dt: number) => void): () => void
  /** particles drawn right now (drops when the adaptive governor steps down a tier) */
  readonly count: number
  readonly camera: THREE.PerspectiveCamera
  readonly stats: FieldStats
  /** the post stack (bloom / grain / vignette / ... settings live in post.settings; call post.apply() after editing) */
  readonly post: Post
  dispose(): void
}
export interface WorldGoal {
  a: string; b: string; mix: number
  placeA: Placement; placeB: Placement
  cam: { pos: ArrayLike<number>; target: ArrayLike<number>; fov?: number }
}
export interface FieldStats {
  fps: number; frameMs: number; medianMs: number; p95Ms: number; maxMs: number
  tier: number; tiers: number; particles: number; baseParticles: number; dpr: number
  drawCalls: number; exposure: number; meanLum: number; /** v4: mean luminance of the particles alone (what the auto-exposure follows in world mode) and of the whole frame */ particleLum?: number; frameLum?: number; built: number; total: number; paused: boolean; rendering: boolean
}
export interface FieldOptions {
  forms: FormDef[]
  /** base particle count (perfect square). Default 262144 desktop / 65536 phone. */
  count?: number
  onProgress?(p: number): void
  /** called after the governor steps down a tier */
  onQuality?(s: FieldStats): void
  /** set false to pin the quality tier (benchmarks) */
  adaptive?: boolean
  /** start at a given tier (0 = best) */
  tier?: number
  /** w12: form ids that gate `readyFirst` (the forms of waypoints 0-2). Default: the first three forms. */
  firstIds?: string[]
}

interface Built { pos: THREE.DataTexture; col: THREE.DataTexture; /** (ymin, ymax, xmin, xmax) of the visible particles in form space: the choreographies use it (print layers, the sweep front, the pour) */ bnd: [number, number, number, number] }

/** 1.5 %..98.5 % extent of the visible (alpha > 0.25) particles, so a stray dust particle never stretches the box */
function boundsOf(pos: Float32Array, col: Float32Array): [number, number, number, number] {
  const n = col.length >> 2
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, cnt = 0
  for (let i = 0; i < n; i++) {
    const k = i * 4; if (col[k + 3] <= 0.25) continue
    const x = pos[k], y = pos[k + 1]
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; cnt++
  }
  if (cnt < 200 || !(y1 > y0) || !(x1 > x0)) return [-2.6, 2.6, -2.9, 2.9]
  const B = 256, hy = new Uint32Array(B), hx = new Uint32Array(B), sy = (B - 1) / (y1 - y0), sx = (B - 1) / (x1 - x0)
  for (let i = 0; i < n; i++) { const k = i * 4; if (col[k + 3] <= 0.25) continue; hy[((pos[k + 1] - y0) * sy) | 0]++; hx[((pos[k] - x0) * sx) | 0]++ }
  const q = (h: Uint32Array, lo: number, hi: number, f: number): [number, number] => {
    let a = lo, b = hi, c = 0, ta = cnt * 0.015, tb = cnt * 0.985
    for (let i = 0; i < B; i++) { c += h[i]; if (c >= ta) { a = lo + (i / (B - 1)) * (hi - lo); break } }
    c = 0; for (let i = 0; i < B; i++) { c += h[i]; if (c >= tb) { b = lo + ((i + 1) / (B - 1)) * (hi - lo); break } }
    return [a, Math.min(b, hi)]
  }
  const [ya, yb] = q(hy, y0, y1, sy), [xa, xb] = q(hx, x0, x1, sx)
  return [ya, Math.max(yb, ya + 0.1), xa, Math.max(xb, xa + 0.1)]
}

const yieldToMain = () => new Promise<void>(r => setTimeout(r, 0))
const damp = (cur: number, goal: number, tau: number, dt: number) => goal + (cur - goal) * Math.exp(-dt / Math.max(1e-4, tau))

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions): Field {
  const forms = opts.forms
  if (!forms.length) throw new Error('createField: no forms')
  const plan = planQuality(opts.count)
  const N = plan.base, W = Math.round(Math.sqrt(N))
  const reduced = { v: prefersReducedMotion() }
  const mql = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const onMql = () => { reduced.v = mql!.matches; rig.reducedMotion = reduced.v; wake() }
  mql?.addEventListener?.('change', onMql)

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false })
  // three reads each new program's info log on its first draw (checkShaderErrors); on ANGLE/Metal that read waits for the driver to finish the link: 60-100 ms tasks mid-flight.
  // Production skips it (a broken shader is a build-time matter); dev keeps the logs. ?shadercheck=0 turns it off in dev too (measurement switch).
  if (import.meta.env.PROD || /[?&]shadercheck=0\b/.test(location.search)) renderer.debug.checkShaderErrors = false
  renderer.setClearColor(0x000000, 1)
  renderer.autoClear = true
  renderer.info.autoReset = false // we count draw calls per frame ourselves (the composer renders many passes)
  const scene = new THREE.Scene()
  const rig = new CameraRig(); rig.reducedMotion = reduced.v
  const camera = rig.camera

  // ---------- geometry ----------
  const { ref, rnd } = particleAttributes(N, W)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
  geo.setAttribute('ref', new THREE.BufferAttribute(ref, 2))
  geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4))
  const indexCache = new Map<number, THREE.BufferAttribute>()
  const indexFor = (stride: number) => {
    let a = indexCache.get(stride)
    if (!a) { const n = Math.floor(N / stride), idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i * stride; a = new THREE.BufferAttribute(idx, 1); indexCache.set(stride, a) }
    return a
  }

  // ---------- material ----------
  const ids = forms.map(f => f.id)
  const index = new Map(ids.map((id, i) => [id, i]))
  const uniforms: Record<string, THREE.IUniform> = {
    uPosA: { value: null }, uPosB: { value: null }, uColA: { value: null }, uColB: { value: null },
    uIdA: { value: 0 }, uIdB: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uTurb: { value: 1.2 },
    uDriftA: { value: 0.04 }, uDriftB: { value: 0.04 }, uSizeA: { value: 1 }, uSizeB: { value: 1 },
    uPointSize: { value: 2 }, uDpr: { value: 1 }, uMinPx: { value: 0 }, uSpread: { value: 0.4 },
    uPlaceA: { value: new THREE.Vector4(0, 0, 0, 0) }, uPlaceB: { value: new THREE.Vector4(0, 0, 0, 0) }, uScaleA: { value: 1 }, uScaleB: { value: 1 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseR: { value: 0.6 }, uMouseK: { value: 0 },
    uFocus: { value: 9 }, uBokeh: { value: 0.15 }, uGainX: { value: 0 }, uFieldHide: { value: 0 }, uAlphaBlend: { value: 1 },
    // v10 dynamics
    uStyle: { value: 0 }, uBndA: { value: new THREE.Vector4(-2.6, 2.6, -2.9, 2.9) }, uBndB: { value: new THREE.Vector4(-2.6, 2.6, -2.9, 2.9) }, uCenA: { value: new THREE.Vector3() }, uCenB: { value: new THREE.Vector3() },
    uFloorY: { value: FLOOR_Y }, uHub: { value: new THREE.Vector3(...HUB_AIM) }, uTexW: { value: 512 },
    uS1A: { value: new THREE.Vector4(0, 0, 1, 0) }, uS1B: { value: new THREE.Vector4(0, 0, 1, 0) }, uS2A: { value: new THREE.Vector4(0, 0, 1, 0) }, uS2B: { value: new THREE.Vector4(0, 0, 1, 0) },
    uLight: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) }, uLightCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, 0, 0)) }, uTintK: { value: 0.7 },
    uMixV: { value: 0 }, uStreakK: { value: 1 }, uRes: { value: new THREE.Vector2(1440, 900) },
  }
  for (const f of forms) Object.assign(uniforms, f.uniforms ?? {})
  const mat = new THREE.ShaderMaterial({
    vertexShader: composeVertex(forms), fragmentShader: FRAGMENT, uniforms,
    transparent: true, depthTest: true, depthWrite: false, // depth-tested so TV meshes occlude particles behind them
    // v10: dst = src.rgb + dst * (1 - src.a). The fragment shader writes alpha = the form's "opaque" amount (0 for most forms = pure additive, as before),
    // so a 'solid' form darkens what is behind a dot instead of only adding (an alpha-blended feel without sorting)
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  })
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.visible = false
  scene.add(points)
  // v10: decimated subsets for the mirror (own private scene; they share the geometry attributes and the material)
  const subScene = new THREE.Scene(), subCache = new Map<number, THREE.Points>()
  function subsetPoints(frac: number): THREE.Points {
    const stride = Math.max(1, Math.min(512, Math.round(1 / Math.max(1e-3, frac))))
    let sp = subCache.get(stride)
    if (!sp) {
      const g = new THREE.BufferGeometry()
      for (const k of ['position', 'ref', 'rnd']) g.setAttribute(k, geo.getAttribute(k))
      const n = Math.floor(N / stride), idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i * stride
      g.setIndex(new THREE.BufferAttribute(idx, 1))
      sp = new THREE.Points(g, mat); sp.frustumCulled = false; sp.visible = false; sp.name = `particles-subset-${stride}`
      subScene.add(sp); subCache.set(stride, sp)
    }
    return sp
  }

  // ---------- post + sizing ----------
  let tier = Math.max(0, Math.min(plan.tiers.length - 1, opts.tier ?? 0))
  let dpr = 1, cssW = 1, cssH = 1
  const computeDpr = () => Math.max(0.5, Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, plan.dprCap) * plan.tiers[tier].dprMul)
  const measure = () => {
    const r = canvas.getBoundingClientRect()
    cssW = Math.max(1, Math.round(r.width || canvas.clientWidth || innerWidth))
    cssH = Math.max(1, Math.round(r.height || canvas.clientHeight || innerHeight))
    uniforms.uRes.value.set(cssW, cssH)
  }
  measure(); dpr = computeDpr()
  renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false)
  rig.setAspect(cssW / cssH)
  uniforms.uDpr.value = dpr; uniforms.uTexW.value = W
  const post: Post = createPost(renderer, scene, camera, cssW, cssH, dpr)
  const resize = () => {
    measure(); dpr = computeDpr()
    renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false)
    post.setSize(cssW, cssH, dpr); rig.setAspect(cssW / cssH)
    uniforms.uDpr.value = dpr; stats.dpr = dpr
    wake()
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null
  ro?.observe(canvas)
  addEventListener('resize', resize)

  const applyTier = (t: number) => {
    tier = t
    const T = plan.tiers[t]
    if (T.stride === 1) geo.setIndex(null); else geo.setIndex(indexFor(T.stride))
    geo.setDrawRange(0, Infinity)
    uniforms.uPointSize.value = 2 * T.sizeMul
    stats.tier = t; stats.particles = Math.floor(N / T.stride)
    post.setTier(t)
    resize()
  }

  // ---------- particle-only exposure meter (v4), GPU side (r7) ----------
  // TV screens and the glass brain live in the same scene and are far brighter than the particles; metering the whole frame would dim the particles to nothing in front of a lit
  // TV. So every 3rd frame the particles alone are drawn into a tiny float target (scene objects hidden) and its mean luminance feeds the auto-exposure.
  // The mean used to be read back to the CPU (readRenderTargetPixelsAsync: ~30 reads a second across the site, each ending in a synchronous getBufferSubData round trip to Chrome's GPU
  // process, ~16 ms: the flight long tasks). Now nothing is read: a one-pixel pass (EXPO_FRAG) averages the meter target, runs the same damped controller the CPU ran, and writes the
  // exposure into a 1x1 float texture (ping-pong); the particle vertex shader samples it (uExpo). Same maths, same constants, no GPU->CPU traffic.
  const MW = 64, MH = 36
  const meterRT = new THREE.WebGLRenderTarget(MW, MH, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
  let meterFrame = 0, particleMetered = false
  const METER_K = 1.0 // particles-only mean (pre-bloom) -> the post meter's scale (post-bloom); calibrated in lab/flight
  function meterParticles() {
    if (!points.visible) return
    const hidden: THREE.Object3D[] = []
    for (const c of scene.children) if (c !== points && c.visible) { c.visible = false; hidden.push(c) }
    const prev = renderer.getRenderTarget()
    // same particle density per target pixel as the real frame: sizes scale with the target, the minimum stays 1 px (energy-exact)
    const hide0 = uniforms.uFieldHide.value
    uniforms.uDpr.value = MW / Math.max(1, cssW); uniforms.uMinPx.value = 1; uniforms.uFieldHide.value = 0
    renderer.setRenderTarget(meterRT); renderer.render(scene, camera); renderer.setRenderTarget(prev)
    uniforms.uDpr.value = dpr; uniforms.uMinPx.value = 0; uniforms.uFieldHide.value = hide0
    for (const c of hidden) c.visible = true
    particleMetered = true
  }
  // the controller (was CPU code in frame()): raw = the mean at gain 1; the goal holds the mean at S.target between S.min and S.max (S.max falls 30 percent mid-morph); darken fast,
  // recover quickly when far under the goal (a jump out of a bright form must not leave the next one dim for seconds), gently near it so it never pumps.
  const EXPO_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tPrev; uniform sampler2D tParticles; uniform sampler2D tFrame;
uniform float uDt; uniform float uMax; uniform float uMin; uniform float uTarget; uniform float uSin; uniform float uAuto; uniform float uFixed; uniform float uSrc; uniform float uK; uniform float uInit;
void main() {
  if (uInit > 0.5) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
  float expo = texelFetch(tPrev, ivec2(0), 0).r;
  float goal = uFixed, tau = 0.3;
  if (uAuto > 0.5) {
    float m;
    if (uSrc < 0.5) {
      float s = 0.0;
      for (int y = 0; y < ${MH}; y++) for (int x = 0; x < ${MW}; x++) s += dot(texelFetch(tParticles, ivec2(x, y), 0).rgb, vec3(0.299, 0.587, 0.114));
      m = s / ${MW * MH}.0 * uK;
    } else { float r = texelFetch(tFrame, ivec2(0), 0).r; m = r * r * 4.0; }
    float raw = max(1e-4, m / max(1e-3, expo));
    goal = min(uMax * (1.0 - 0.3 * uSin), max(uMin, uTarget / raw));
    tau = goal < expo ? 0.25 : (goal - expo > 0.2 ? 0.28 : 0.7);
  }
  gl_FragColor = vec4(goal + (expo - goal) * exp(-uDt / max(1e-4, tau)), 0.0, 0.0, 1.0);
}`
  const expoRT = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }))
  const expoMat = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: EXPO_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tPrev: { value: null }, tParticles: { value: meterRT.texture }, tFrame: { value: post.meterTexture },
      uDt: { value: 0 }, uMax: { value: 1.5 }, uMin: { value: 0.15 }, uTarget: { value: 0.15 }, uSin: { value: 0 }, uAuto: { value: 1 }, uFixed: { value: 1 }, uSrc: { value: 0 }, uK: { value: METER_K }, uInit: { value: 0 },
    },
  })
  const expoScene = new THREE.Scene(), expoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), expoMat); q.frustumCulled = false; expoScene.add(q) }
  let expoI = 0
  uniforms.uExpo = { value: expoRT[0].texture }; uniforms.uExpoOn = { value: 0 }
  function runExpo(init: boolean) {
    const prev = renderer.getRenderTarget(), U = expoMat.uniforms
    U.uInit.value = init ? 1 : 0; U.tPrev.value = expoRT[expoI].texture
    renderer.setRenderTarget(expoRT[1 - expoI]); renderer.render(expoScene, expoCam); renderer.setRenderTarget(prev)
    expoI = 1 - expoI; uniforms.uExpo.value = expoRT[expoI].texture
  }
  /** (re)start the exposure at 1 (the lab's look): both ping-pong targets, so the first real step reads a defined value */
  function initExpo() { runExpo(true); runExpo(true); uniforms.uExpoOn.value = 1 }
  initExpo()
  /** one controller step, on the GPU. Runs every frame like the CPU version did; the meter it reads is refreshed every 3rd frame. */
  function stepExposure(dt: number, flightSin: number) {
    const S = post.settings, U = expoMat.uniforms
    const fromParticles = worldMode && particleMetered
    if (S.autoExposure && !fromParticles && !(!worldMode && post.meterReady)) return    // nothing metered yet: hold the starting exposure
    U.uDt.value = dt; U.uMax.value = S.max; U.uMin.value = S.min; U.uTarget.value = S.target; U.uSin.value = flightSin
    U.uAuto.value = S.autoExposure ? 1 : 0; U.uFixed.value = 1 + plan.tiers[tier].gain; U.uSrc.value = fromParticles ? 0 : 1
    runExpo(false)
  }

  // ---------- state ----------
  const state = { a: ids[0], b: ids[0], mix: 0 }
  // v4 world: the goal (from the flight) and what is actually displayed (a pair + placements + a mix that follows with a time floor)
  interface Disp { a: string; b: string; mix: number; pa: Placement; pb: Placement }
  let goal: WorldGoal | null = null, disp: Disp | null = null, worldMode = false
  let hwNow = 2.9
  let styleId = 0, mixSpeed = 0, mixPrevV = 0, streakK = 1
  const lightsN = { n: 0 }
  const preCbs = new Set<(t: number, dt: number) => void>()
  const cameraCbs = new Set<() => void>()
  let dirty = true
  let snapped = false

  // ---------- forms: progressive build ----------
  const built = new Map<string, Built>()
  const want: string[] = []                 // ids requested by setState while unbuilt (built first)
  let doneCount = 0
  const progress = () => opts.onProgress?.(doneCount / forms.length)
  const mkTex = (data: Float32Array) => {
    const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.FloatType)
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false; t.needsUpdate = true
    return t
  }
  async function buildOne(f: FormDef) {
    const pos = new Float32Array(N * 4), col = new Float32Array(N * 4)
    const t0 = performance.now()
    try {
      await f.build(makeCtx(f.id, N), pos, col)
    } catch (e) {
      console.error(`[field] form "${f.id}" failed to build, using a dust shell`, e)
      pos.fill(0); col.fill(0)
      H.dust(pos, col, 0, N, makeCtx(f.id, N).rand, 6, 0.18)
    }
    const b: Built = { pos: mkTex(pos), col: mkTex(col), bnd: boundsOf(pos, col) }
    // upload now, between frames, instead of stalling the first morph that needs it
    try { renderer.initTexture(b.pos); renderer.initTexture(b.col) } catch {}
    built.set(f.id, b)
    stats.built = built.size
    if (typeof console !== 'undefined') console.debug(`[field] built ${f.id} in ${(performance.now() - t0).toFixed(0)} ms`)
  }
  const firstSet = new Set(opts.firstIds?.length ? opts.firstIds : forms.slice(0, 3).map(f => f.id))
  let resolveFirst: () => void = () => {}
  const readyFirst = new Promise<void>(r => { resolveFirst = r })
  let firstDone = false
  const checkFirst = () => { if (firstDone) return; for (const id of firstSet) if (index.has(id) && !built.has(id)) return; firstDone = true; resolveFirst() }
  const ready = (async () => {
    const queue = forms.slice()
    // the form shown first goes first
    const first = queue.findIndex(f => f.id === state.a); if (first > 0) queue.unshift(...queue.splice(first, 1))
    while (queue.length) {
      // the gate's forms go first (a deep link's wanted form may wait on 'v3:ready', which waits on them), then whatever the view wants, then waypoint order
      let k = firstDone ? -1 : queue.findIndex(f => firstSet.has(f.id)); if (k < 0) k = queue.findIndex(f => want.includes(f.id)); if (k < 0) k = 0
      const f = queue.splice(k, 1)[0]
      await buildOne(f)
      doneCount++; progress(); dirty = true; wake(); checkFirst()
      await yieldToMain()
    }
    checkFirst()
  })()

  const resolve = (id: string): string | null => {
    if (built.has(id)) return id
    return null
  }
  function bind() {
    dirty = false
    let ra = resolve(state.a), rb = resolve(state.b)
    if (!ra && !rb) { // nothing wanted is ready: show whatever is, else nothing
      const any = built.keys().next().value as string | undefined
      if (!any) { points.visible = false; return }
      ra = rb = any
    } else if (!ra) ra = rb; else if (!rb) rb = ra
    const A = built.get(ra!)!, B = built.get(rb!)!, fa = forms[index.get(ra!)!], fb = forms[index.get(rb!)!]
    uniforms.uPosA.value = A.pos; uniforms.uColA.value = A.col; uniforms.uIdA.value = index.get(ra!)!
    uniforms.uPosB.value = B.pos; uniforms.uColB.value = B.col; uniforms.uIdB.value = index.get(rb!)!
    uniforms.uDriftA.value = fa.drift ?? 0.04; uniforms.uDriftB.value = fb.drift ?? 0.04
    const sa = packFormStyle(fa.style ?? FORM_STYLE[fa.id]), sb = packFormStyle(fb.style ?? FORM_STYLE[fb.id])
    uniforms.uSizeA.value = ((fa.pointSize ?? 2) / 2) * sa.size; uniforms.uSizeB.value = ((fb.pointSize ?? 2) / 2) * sb.size
    ;(uniforms.uS1A.value as THREE.Vector4).set(...sa.s1); (uniforms.uS2A.value as THREE.Vector4).set(...sa.s2)
    ;(uniforms.uS1B.value as THREE.Vector4).set(...sb.s1); (uniforms.uS2B.value as THREE.Vector4).set(...sb.s2)
    ;(uniforms.uBndA.value as THREE.Vector4).set(...A.bnd); (uniforms.uBndB.value as THREE.Vector4).set(...B.bnd)
    styleId = fa === fb ? 0 : morphStyleId(fb.id) // the choreography of a leg follows its DESTINATION form
    active = fa === fb ? [fa] : [fa, fb]
    camA = camOf(fa); camB = camOf(fb)
    if (!snapped) { snapped = true; rig.snap() }
    points.visible = true
  }
  // forms wider than the default 2.9 half-extent about their target (phones back the camera off to keep this much in frame)
  const FIT_HALF: Record<string, number> = { epilogue: 5.0 }
  const camOf = (f: FormDef): FormDef['camera'] => { const c = f.camera, hw = (c as { halfWidth?: number } | undefined)?.halfWidth ?? FIT_HALF[f.id]; return c && hw ? { ...c, halfWidth: hw } as FormDef['camera'] : c }
  let active: FormDef[] = [], camA: FormDef['camera'], camB: FormDef['camera']
  const warned = new Set<string>()
  const lookup = (id: string) => {
    if (index.has(id)) return id
    if (!warned.has(id)) { warned.add(id); console.warn(`[field] unknown form "${id}"`) }
    return ids[0]
  }

  // ---------- v4 world step ----------
  const MORPH_FLOOR = 0.9 // seconds: no morph completes faster than this
  const samePl = (x: Placement, y: Placement) => x === y || (x.at[0] === y.at[0] && x.at[1] === y.at[1] && x.at[2] === y.at[2] && (x.yaw ?? 0) === (y.yaw ?? 0) && (x.scale ?? 1) === (y.scale ?? 1))
  const matches = (id: string, pl: Placement, g: WorldGoal) => (id === g.a && samePl(pl, g.placeA)) || (id === g.b && samePl(pl, g.placeB))
  const hwOf = (id: string, pl: Placement) => { const f = forms[index.get(id) ?? 0]; const c = f && camOf(f); return (((c as { halfWidth?: number } | undefined)?.halfWidth) ?? 2.9) * (pl.scale ?? 1) }
  /** world centre of a form: its bounds centre (xmin..xmax, ymin..ymax) put through the placement (the shader's place()) */
  function centreOf(bnd: THREE.Vector4, pl: Placement, out: THREE.Vector3) {
    const s = pl.scale ?? 1, yaw = pl.yaw ?? 0, c = Math.cos(yaw), q = Math.sin(yaw), x = 0.5 * (bnd.z + bnd.w) * s, y = 0.5 * (bnd.x + bnd.y) * s
    out.set(c * x + pl.at[0], y + pl.at[1], -q * x + pl.at[2])
  }
  function stepWorld(dt: number) {
    const g = goal; if (!g) return
    if (!disp) {
      disp = { a: g.a, b: g.b, mix: g.a === g.b ? 0 : g.mix, pa: g.placeA, pb: g.placeB }
      state.a = disp.a; state.b = disp.b; dirty = true
    }
    const d = disp
    const flat = d.a === d.b
    let target: number
    const same = g.a === d.a && g.b === d.b && samePl(g.placeA, d.pa) && samePl(g.placeB, d.pb)
    if (same) target = g.a === g.b ? 0 : g.mix
    else {
      const atA = flat || d.mix <= 0.002, atB = flat || d.mix >= 0.998
      if (atA || atB) {
        // settled on one form: join the goal's pair if that form is part of it, else catch up with a fresh morph toward what the goal shows
        const E = atA ? { id: d.a, pl: d.pa } : { id: d.b, pl: d.pb }
        const gl: Disp | null = matches(E.id, E.pl, g) ? { a: g.a, b: g.b, mix: g.a === g.b ? 0 : (E.id === g.a && samePl(E.pl, g.placeA) ? 0 : 1), pa: g.placeA, pb: g.placeB } : null
        if (gl) { disp = gl; target = g.a === g.b ? 0 : g.mix }
        else {
          const toB = g.mix >= 0.5 && g.a !== g.b
          disp = { a: E.id, b: toB ? g.b : g.a, mix: 0, pa: E.pl, pb: toB ? g.placeB : g.placeA }
          target = 1
        }
        state.a = disp.a; state.b = disp.b; dirty = true
      } else {
        // mid-morph on a different pair: finish this morph toward the end the goal wants, then switch
        target = matches(d.b, d.pb, g) ? 1 : matches(d.a, d.pa, g) ? 0 : d.mix > 0.5 ? 1 : 0
      }
    }
    const D = disp!
    if (D.a === D.b) D.mix = 0
    else {
      const floor = reduced.v ? 0.35 : MORPH_FLOOR
      const next = damp(D.mix, target, 0.07, dt)
      const maxStep = dt / floor
      D.mix += Math.max(-maxStep, Math.min(maxStep, next - D.mix))
      if (Math.abs(D.mix - target) < 0.002) D.mix = target
      D.mix = Math.max(0, Math.min(1, D.mix))
    }
    state.mix = D.mix
    // placements
    const pa = D.pa, pb = D.pb
    uniforms.uPlaceA.value.set(pa.at[0], pa.at[1], pa.at[2], pa.yaw ?? 0); uniforms.uScaleA.value = pa.scale ?? 1
    uniforms.uPlaceB.value.set(pb.at[0], pb.at[1], pb.at[2], pb.yaw ?? 0); uniforms.uScaleB.value = pb.scale ?? 1
    hwNow = hwOf(D.a, pa) + (hwOf(D.b, pb) - hwOf(D.a, pa)) * D.mix
    centreOf(uniforms.uBndA.value as THREE.Vector4, pa, uniforms.uCenA.value as THREE.Vector3); centreOf(uniforms.uBndB.value as THREE.Vector4, pb, uniforms.uCenB.value as THREE.Vector3)
  }

  // ---------- loop ----------
  let raf = 0, running = false, lost = false, disposed = false
  let paused = false, hidden = typeof document !== 'undefined' && document.hidden
  let time = 0, last = 0, mixV = 0, mixPrev = 0, calm = 0, framesSinceWake = 0, fade = 0
  let turb = 1.2, turbGoal = 1.2, focusManual = 0, velSet = 0
  let ndcX = 0, ndcY = 0, havePointer = false, lastMove = -9, mouseK = 0
  const cbs = new Set<(t: number, dt: number) => void>()
  const gov = new Governor()
  const adaptive = opts.adaptive !== false
  const ring = new Float32Array(120); let ringN = 0, ringI = 0

  const stats: FieldStats = {
    fps: 0, frameMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, tier, tiers: plan.tiers.length, particles: Math.floor(N / plan.tiers[tier].stride),
    baseParticles: N, dpr, drawCalls: 0, exposure: 1, meanLum: 0, built: 0, total: forms.length, paused: false, rendering: false,
  }

  const v3 = new THREE.Vector3()
  function pointerToPlane() {
    // unproject the pointer onto the z = 0 plane (the plane the forms are authored on)
    v3.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position)
    if (Math.abs(v3.z) < 1e-4) return
    const tz = -camera.position.z / v3.z
    uniforms.uMouse.value.set(camera.position.x + v3.x * tz, camera.position.y + v3.y * tz, 0)
  }

  function frame(now: number) {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const raw = last ? (now - last) / 1000 : 1 / 60
    last = now
    const dt = Math.min(0.05, Math.max(0, raw))
    const effPaused = paused || hidden
    framesSinceWake++
    if (!effPaused) time += dt

    // quality governor (only while really animating)
    ring[ringI] = raw * 1000; ringI = (ringI + 1) % ring.length; ringN = Math.min(ring.length, ringN + 1)
    if (!effPaused && framesSinceWake > 8 && points.visible) {
      if (adaptive && gov.push(raw * 1000) && tier < plan.tiers.length - 1) {
        const med = gov.median()
        applyTier(tier + 1); gov.reset(); opts.onQuality?.(stats)
        console.info(`[field] median frame ${med.toFixed(1)} ms: quality tier ${tier}/${plan.tiers.length - 1} (${stats.particles} particles, dpr ${dpr.toFixed(2)})`)
      }
    }

    // v4: per-frame hooks (flight/world update, TV render targets), then the morph step
    for (const cb of preCbs) { try { cb(time, dt) } catch (e) { console.error(e) } }
    if (worldMode) stepWorld(dt)
    else { const I: Placement = { at: [0, 0, 0] }; centreOf(uniforms.uBndA.value as THREE.Vector4, I, uniforms.uCenA.value as THREE.Vector3); centreOf(uniforms.uBndB.value as THREE.Vector4, I, uniforms.uCenB.value as THREE.Vector3) }

    // pending state
    if (dirty) bind()
    uniforms.uMix.value = state.mix
    uniforms.uTime.value = time
    // v10: the choreography of this leg, and the motion-streak speed (|d mix / dt|, smoothed). Reduced motion: plain swirl, no streaks.
    uniforms.uStyle.value = reduced.v ? 0 : styleId
    if (dt > 0) { mixSpeed = damp(mixSpeed, Math.abs(state.mix - mixPrevV) / dt, 0.05, dt); if (mixSpeed < 0.004) mixSpeed = 0 } // runs while paused too, so a paused frame never keeps a stale streak
    mixPrevV = state.mix
    uniforms.uMixV.value = mixSpeed; uniforms.uStreakK.value = reduced.v ? 0 : streakK
    for (const f of active) f.update?.(time, effPaused ? 0 : dt)

    // camera
    if (worldMode && goal) rig.setDirect(goal.cam.pos, goal.cam.target, goal.cam.fov ?? 35, hwNow)
    else rig.setTargets(camA, camB, state.mix)
    rig.update(dt, time)
    for (const cb of cameraCbs) { try { cb() } catch (e) { console.error(e) } }
    uniforms.uFocus.value = focusManual > 0 ? focusManual : rig.distance
    uniforms.uBokeh.value = 0.15 * Math.min(1, 9 / Math.max(1, uniforms.uFocus.value)) // a far shot keeps its whole depth in focus
    uniforms.uPointSize.value = 2 * plan.tiers[tier].sizeMul

    // turbulence + pointer
    turb = damp(turb, turbGoal, 0.14, dt); uniforms.uTurb.value = turb
    const moving = performance.now() / 1000 - lastMove < 0.14
    mouseK = damp(mouseK, havePointer && moving ? (reduced.v ? 0.18 : 0.35) : 0, moving ? 0.07 : 0.45, dt)
    uniforms.uMouseK.value = mouseK
    pointerToPlane()

    // intro fade, then draw
    fade = Math.min(1, fade + dt / 1.1); post.setFade(points.visible ? fade * fade * (3 - 2 * fade) : 0)
    // auto-exposure, on the GPU: scale the particles at the source so bloom and the shoulder see a sane range (1 = the lab's look). Mid-morph the particles dim a little and the cap falls,
    // so the overlap of two forms never blows out. No read-back: see the exposure section above.
    const flightSin = Math.sin(Math.PI * Math.min(1, Math.max(0, state.mix)))
    post.setDim(1 - 0.35 * flightSin)
    keepLightCount()
    post.setMeterOn(!worldMode)                                    // the world meters its particles itself (the frame meter would only be drawn to be ignored)
    stepExposure(dt, flightSin)
    renderer.info.reset()
    if (worldMode && ++meterFrame % 3 === 0) meterParticles()
    post.render(dt, time)
    stats.drawCalls = renderer.info.render.calls

    for (const cb of cbs) { try { cb(time, dt) } catch (e) { console.error(e) } }

    // stats
    stats.frameMs = stats.frameMs ? stats.frameMs * 0.9 + raw * 1000 * 0.1 : raw * 1000
    stats.fps = 1000 / Math.max(1, stats.frameMs)
    if (ringN >= 30 && framesSinceWake % 10 === 0) {
      const s = Float32Array.from(ring.subarray(0, ringN)).sort()
      stats.medianMs = s[(s.length - 1) >> 1]; stats.p95Ms = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; stats.maxMs = s[s.length - 1]
    }

    // settle: when paused (or hidden), stop once nothing is moving any more
    const dMix = Math.abs(state.mix - mixPrev); mixPrev = state.mix
    const busy = rig.energy > 0.002 || dMix > 1e-5 || mixSpeed > 0.004 || mouseK > 0.002 || Math.abs(turb - turbGoal) > 1e-3 || fade < 1 || dirty || !points.visible && built.size === 0
    calm = busy ? 0 : calm + 1
    if (effPaused && calm > 12) stop()
  }

  function start() {
    if (running || lost || disposed) return
    running = true; last = 0; framesSinceWake = 0; calm = 0; gov.reset(30)
    stats.rendering = true
    raf = requestAnimationFrame(frame)
  }
  function stop() { running = false; cancelAnimationFrame(raf); stats.rendering = false }
  function wake() { if (!running && !lost && !disposed) start(); calm = 0 }

  // ---------- events ----------
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return
    ndcX = ((e.clientX - r.left) / r.width) * 2 - 1; ndcY = -((e.clientY - r.top) / r.height) * 2 + 1
    rig.setPointer(Math.max(-1, Math.min(1, ndcX)), Math.max(-1, Math.min(1, ndcY)))
    havePointer = true; lastMove = performance.now() / 1000
    wake()
  }
  const onLeave = () => { rig.setPointer(0, 0); havePointer = false; wake() }
  const onVis = () => { hidden = document.hidden; last = 0; if (!hidden) wake() }
  const onLost = (e: Event) => { e.preventDefault(); lost = true; stop(); console.warn('[field] webgl context lost') }
  const onRestored = () => { lost = false; dirty = true; gov.reset(); initExpo(); console.info('[field] webgl context restored'); start() }
  addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', onVis)
  canvas.addEventListener('webglcontextlost', onLost as EventListener, false)
  canvas.addEventListener('webglcontextrestored', onRestored, false)

  applyTier(tier)
  progress()
  start()


  // ---- w14: compile ahead. Programs are keyed on the render target they draw into, so compiling against the canvas builds programs the frame never uses.
  // every compileAsync on this renderer (the stages, the hall, the transitions and the world's own prewarms all call it) is bound to the scene target unless the caller
  // already bound one: before this they compiled against the canvas, built programs the frame never used, and the real draw compiled them again on the arrival frame.
  // Second fix: compileAsync(root, camera, scene) counts the lights of the target scene AND of root. When root is already in the scene its lights are counted twice (a stage's one
  // light compiled as two: a different program key from the frame's, so the first draw compiled everything again). A stand-in that offers only root's materials counts them once.
  const compileAsync0 = renderer.compileAsync.bind(renderer)
  const inScene = (o: THREE.Object3D, s: THREE.Object3D) => { for (let p = o.parent; p; p = p.parent) if (p === s) return true; return false }
  renderer.compileAsync = (obj, cam, target) => {
    const prev = renderer.getRenderTarget()
    if (prev === null) renderer.setRenderTarget(post.sceneTarget)  // the synchronous half of compileAsync reads the bound target for the program keys
    let o: THREE.Object3D = obj
    if (target && obj !== target && inScene(obj, target)) { const root = obj; o = new THREE.Object3D(); o.traverseVisible = () => {}; o.traverse = (cb: (x: THREE.Object3D) => unknown) => root.traverse(cb) }
    try { return compileAsync0(o, cam, target) } finally { if (prev === null) renderer.setRenderTarget(null) }
  }
  // ---- r7: light-count governor. A program key includes the number of VISIBLE lights of each type (three counts a light only when it and all its parents are visible), so every
  // time an owner hides or shows a light (the hub TV's screen light with the hub, the 3D name's key spot with the name) every lit program in the scene is rebuilt on the next draw:
  // ~15-25 programs, 40-120 ms stalls mid-flight. Each light gets a stand-in at the scene root (same type, intensity 0) that is visible exactly when the real one is not, so the
  // counts compiled into the programs never change; the owner's own switching (visible, intensity) is untouched.
  const ghostOf = new Map<THREE.Light, THREE.Light>(), ghostSet = new WeakSet<THREE.Object3D>()
  const makeGhost = (L: THREE.Light): THREE.Light | null => {
    const l = L as THREE.Light & { isPointLight?: boolean; isSpotLight?: boolean; isDirectionalLight?: boolean; isHemisphereLight?: boolean; isAmbientLight?: boolean }
    const g = l.isSpotLight ? new THREE.SpotLight(0xffffff, 0) : l.isPointLight ? new THREE.PointLight(0xffffff, 0) : l.isDirectionalLight ? new THREE.DirectionalLight(0xffffff, 0)
      : l.isHemisphereLight ? new THREE.HemisphereLight(0xffffff, 0x000000, 0) : l.isAmbientLight ? new THREE.AmbientLight(0xffffff, 0) : null
    if (g) { g.name = 'ghost:' + L.name; g.visible = false; ghostSet.add(g) }
    return g
  }
  const scanLights = (root: THREE.Object3D) => {
    root.traverse(o => {
      const L = o as THREE.Light
      if (!L.isLight || ghostOf.has(L) || ghostSet.has(L)) return
      const g = makeGhost(L); if (!g) return
      ghostOf.set(L, g); add0(g)
    })
  }
  // the world, the extras and the spaces add their lights straight to the scene: catch them the moment they arrive, not on the next periodic scan
  const add0 = scene.add.bind(scene)
  scene.add = (...objs: THREE.Object3D[]) => { add0(...objs); for (const o of objs) scanLights(o); return scene }
  const hiddenNow = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return true; return false }
  let ghostFrame = 0
  const keepLightCount = () => {
    if (++ghostFrame % 120 === 0) scanLights(scene)            // lights an owner adds to an object that is already in the scene
    for (const [L, g] of ghostOf) { const h = hiddenNow(L); if (g.visible !== h) g.visible = h }
  }
  scanLights(scene)
  const compileAhead = (obj?: THREE.Object3D): Promise<void> => {
    try { return renderer.compileAsync(obj ?? scene, camera, scene).then(() => undefined, () => undefined) } catch { return Promise.resolve() }
  }

  const proj = new THREE.Vector3()
  return {
    ready, readyFirst,
    setState(a, b, mix) {
      if (worldMode) { worldMode = false; goal = null; disp = null; rig.clearDirect() }
      a = lookup(a); b = lookup(b)
      mix = Math.max(0, Math.min(1, mix))
      if (a !== state.a || b !== state.b) {
        dirty = true
        for (const id of [a, b]) if (!built.has(id) && !want.includes(id)) want.push(id)
      }
      if (a !== state.a || b !== state.b || mix !== state.mix) { state.a = a; state.b = b; state.mix = mix; wake() }
    },
    setWorld(w) {
      const a = lookup(w.a), b = lookup(w.b)
      worldMode = true
      for (const id of [a, b]) if (!built.has(id) && !want.includes(id)) want.push(id)
      const mix = Math.max(0, Math.min(1, w.mix)), c = w.cam
      // only wake the loop when something actually changed (a paused field must be able to go to sleep)
      const changed = !goal || goal.a !== a || goal.b !== b || Math.abs(goal.mix - mix) > 1e-6 || goal.placeA !== w.placeA || goal.placeB !== w.placeB ||
        Math.abs(goal.cam.pos[0] - c.pos[0]) + Math.abs(goal.cam.pos[1] - c.pos[1]) + Math.abs(goal.cam.pos[2] - c.pos[2]) + Math.abs(goal.cam.target[0] - c.target[0]) + Math.abs(goal.cam.target[1] - c.target[1]) + Math.abs(goal.cam.target[2] - c.target[2]) + Math.abs((goal.cam.fov ?? 35) - (c.fov ?? 35)) > 1e-5
      goal = { a, b, mix, placeA: w.placeA, placeB: w.placeB, cam: { pos: [c.pos[0], c.pos[1], c.pos[2]], target: [c.target[0], c.target[1], c.target[2]], fov: c.fov } }
      if (changed) wake()
    },
    addObject(o) { scene.add(o); scanLights(o); wake(); return () => { scene.remove(o) } },
    onBeforeRender(cb) { preCbs.add(cb); wake(); return () => { preCbs.delete(cb) } },
    onAfterCamera(cb) { cameraCbs.add(cb); wake(); return () => { cameraCbs.delete(cb) } },
    renderer, scene, points,
    compileAhead,
    async readExposure() {
      try { const b = new Float32Array(4); await renderer.readRenderTargetPixelsAsync(expoRT[expoI], 0, 0, 1, 1, b); stats.exposure = b[0]; return b[0] } catch { return NaN }
    },
    setFieldAlpha(a) { const h = 1 - Math.max(0, Math.min(1, isFinite(a) ? a : 1)); if (Math.abs(h - (uniforms.uFieldHide.value as number)) < 1e-4) return; uniforms.uFieldHide.value = h; wake() },
    setLights(list) {
      const P = uniforms.uLight.value as THREE.Vector4[], C = uniforms.uLightCol.value as THREE.Vector3[]
      let n = 0
      for (const l of list) {
        if (n >= 4) break
        const p = l.position as any, c = l.color as any, I = Math.max(0, Math.min(1, l.intensity))
        if (!(l.radius > 0) || I <= 0.001) continue
        P[n].set(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2], l.radius); C[n].set((c.r ?? c[0]) * I, (c.g ?? c[1]) * I, (c.b ?? c[2]) * I); n++
      }
      for (let i = n; i < 4; i++) { P[i].w = 0; C[i].set(0, 0, 0) }
      if (n !== lightsN.n) { lightsN.n = n; wake() }
    },
    setStreak(k) { streakK = Math.max(0, k); wake() },
    subset: subsetPoints,
    drawSubset(r, cam, frac, o) {
      if (!points.visible) return
      const sp = subsetPoints(frac), pu = uniforms, dpr0 = pu.uDpr.value, gx0 = pu.uGainX.value
      pu.uDpr.value = dpr0 * (o?.dprScale ?? 1); pu.uGainX.value = (1 + gx0) * (o?.gain ?? 1) - 1
      sp.visible = true
      const ac = r.autoClear; r.autoClear = false
      try { r.render(subScene, cam) } finally { r.autoClear = ac; sp.visible = false; pu.uDpr.value = dpr0; pu.uGainX.value = gx0 }
    },
    get shown() { return { a: state.a, b: state.b, mix: state.mix } },
    setTurbulence(v) { v = Math.max(0, v); if (Math.abs(v - turbGoal) < 1e-4) return; turbGoal = v; wake() },
    setFocus(d) { focusManual = d > 0 && isFinite(d) ? d : 0; wake() },
    setVelocity(v) { if (Math.abs(v - velSet) > 2e-3) { velSet = v; rig.setVelocity(v); wake() } },
    setTime(t) { time = t; wake() },
    project(p) {
      camera.updateMatrixWorld()
      proj.set(p[0], p[1], p[2]).project(camera)
      const x = (proj.x * 0.5 + 0.5) * cssW, y = (-proj.y * 0.5 + 0.5) * cssH
      return { x, y, visible: proj.z > -1 && proj.z < 1 && Math.abs(proj.x) < 1.15 && Math.abs(proj.y) < 1.15 }
    },
    setPaused(p) { paused = p; stats.paused = p; if (!p) { last = 0; gov.reset(20) } wake() },
    onFrame(cb) { cbs.add(cb); wake(); return () => { cbs.delete(cb) } },
    get count() { return stats.particles },
    camera,
    stats,
    post,
    dispose() {
      disposed = true; stop()
      removeEventListener('pointermove', onMove); removeEventListener('resize', resize)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('webglcontextlost', onLost as EventListener); canvas.removeEventListener('webglcontextrestored', onRestored)
      mql?.removeEventListener?.('change', onMql); ro?.disconnect()
      for (const b of built.values()) { b.pos.dispose(); b.col.dispose() }
      built.clear(); for (const sp of subCache.values()) sp.geometry.dispose(); geo.dispose(); mat.dispose(); post.dispose(); meterRT.dispose(); expoRT.forEach(t => t.dispose()); expoMat.dispose(); renderer.dispose()
    },
  }
}
