// W11 SPACES: the five interests (bouldering, board games, records, guitar, chess) do not stand in the gothic hall. Each gets its own space beyond the hall's far doors,
// a gallery along the nave axis that alternates sides (layout.ts INTEREST_SPACES): hold = a dusk crag, meeple = a candlelit library corner, records = a listening room,
// guitar = a small stage, knight = a moonlit court. The cabinet's objects stand in them as heroes (extras/cabinet.ts; stages stand at their waypoint's place).
//   * every space has a black ground that fades out at its radius, ONE key light and ONE rim light in its window's colour, depth fog, and keeps its backdrop on the -z side
//   * presence follows the cabinet's curve: rising sstep(0.42, 0.92, t) when arriving, 1 at the dwell, sinking 1 - sstep(0.04, 0.5, t) when leaving, invisible otherwise
//   * a space is built when the flight is within 3 waypoints (one per frame, nearest first) and its programs are compiled before the camera arrives
//   * the two lights are SHARED: a light added per space would recompile every lit material in the world each time, so the manager keeps one SpotLight and one PointLight,
//     created here once, and moves them (intensity 0 when no space is present, the lights themselves never leave the scene)
//   * between two neighbouring interests a veil sweeps the frame at t 0.35..0.65: a camera-facing fog wall in the NEXT window's colour (the Igloo fog-wall swap), a pure function of t
// Contract: install(ctx) -> { update }. ?extras=-spaces switches it off. ?nocrag=1 forces the procedural crag. window.__spaces for tests.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import * as L from '../layout'
import { WAYPOINTS } from '../layout'
import type { FlightState } from '../flight'
import { extraOn, isOn, isPhone, reducedMotion, sstep, timed } from './lib/flags'
import { sharedEnv } from './env'
import { destinationWp, jumpRoute, precompile } from './cabinet/kit'
import { INTERESTS } from './hall/rig'
import { makeFog, type Fog, type Space, type SpaceDef, type SpaceKit } from './spaces/common'

const IDS = ['hold', 'meeple', 'records', 'guitar', 'knight'] as const
type Make = () => Promise<() => Space>
const MAKERS: Record<string, Make> = {
  hold: async () => (await import('./spaces/hold')).createHoldSpace,
  meeple: async () => (await import('./spaces/meeple')).createMeepleSpace,
  records: async () => (await import('./spaces/records')).createRecordsSpace,
  guitar: async () => (await import('./spaces/guitar')).createGuitarSpace,
  knight: async () => (await import('./spaces/knight')).createKnightSpace,
}

/** layout's INTEREST_SPACES (read through the namespace: a missing named export would kill the page), or one derived from the waypoints' places */
function spacesOf(): SpaceDef[] {
  const given = (L as unknown as { INTEREST_SPACES?: SpaceDef[] | Record<string, SpaceDef> }).INTEREST_SPACES
  const list = Array.isArray(given) ? given : given ? Object.values(given) : null
  return IDS.map((id, i) => {
    const hit = list?.find(s => s.id === id)
    if (hit) return { id, i: hit.i ?? i, at: hit.at, yaw: hit.yaw, radius: hit.radius ?? 8 }
    const w = WAYPOINTS.find(x => x.id === id)!
    return { id, i, at: [w.place.at[0], L.HALL.at[1], w.place.at[2]], yaw: w.place.yaw ?? 0, radius: 8 }
  })
}

interface Entry { def: SpaceDef; wp: number; space: Space | null; state: 'idle' | 'building' | 'ready' | 'failed'; r: number; ms: number; fog: Fog; kit: SpaceKit | null }

const VEIL_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
const VEIL_F = /* glsl */ `
precision highp float; varying vec2 vUv; uniform float uU, uDir, uSeed, uAsp; uniform vec3 uCol;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main() {
  float x = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
  float c = mix(-0.6, 1.6, uU);
  float n = fbm(vec2(vUv.y * 2.4 * uAsp * 0.6 + uSeed, x * 3.2 - uU * 6.0));
  float edge = x - c + (n - 0.5) * 0.5 + 0.06 * sin(vUv.y * 7.0 + uSeed * 3.0);
  float wall = exp(-pow(edge / 0.22, 2.0));
  float haze = exp(-pow(edge / 0.7, 2.0));
  float a = (wall * 0.8 + haze * 0.14) * (0.5 + 0.5 * n * 2.0);
  gl_FragColor = vec4(uCol, a * 0.5);
}`

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('spaces') || !ctx.field?.scene) return
  const field = ctx.field, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera, scene: THREE.Scene = field.scene
  const nocrag = new URLSearchParams(location.search).has('nocrag')
  const defs = spacesOf()
  const entries: Entry[] = []
  for (const d of defs) {
    const wp = WAYPOINTS.findIndex(w => w.id === d.id)
    if (wp >= 0 && MAKERS[d.id]) entries.push({ def: d, wp, space: null, state: 'idle', r: 0, ms: 0, fog: makeFog(), kit: null })
  }
  if (!entries.length) return
  const first = entries[0].wp, last = entries[entries.length - 1].wp

  // ---- the two shared lights
  const key = new THREE.SpotLight(0xffffff, 0, 30, 0.5, 0.6, 2); key.name = 'spaces-key'
  const rim = new THREE.PointLight(0xffffff, 0, 14, 2); rim.name = 'spaces-rim'
  const fill = new THREE.HemisphereLight(0xffffff, 0x000000, 0); fill.name = 'spaces-fill'
  scene.add(key, key.target, rim, fill)
  const v = new THREE.Vector3()

  // ---- the veil
  const veilMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: VEIL_V, fragmentShader: VEIL_F,
    uniforms: { uU: { value: 0 }, uDir: { value: 1 }, uSeed: { value: 0 }, uAsp: { value: 1.6 }, uCol: { value: new THREE.Color(1, 1, 1) } },
  })
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat); veil.frustumCulled = false; veil.renderOrder = 98; veil.visible = false; veil.name = 'spaces-veil'; veil.userData.noReflect = true
  scene.add(veil)

  let jr: ReturnType<typeof jumpRoute> = null          // this frame's rail jump: the space at the destination rises, the one at the origin sinks, nothing between shows
  const presence = (i: number, st: FlightState): number => {
    if (jr) return i === jr.to ? sstep(0.45, 0.95, jr.k) : i === jr.from ? 1 - sstep(0.05, 0.5, jr.k) : 0
    if (st.dwelling) return st.wp === i ? 1 : 0
    if (st.next === i) return sstep(0.42, 0.92, st.t)
    if (st.wp === i) return 1 - sstep(0.04, 0.5, st.t)
    return 0
  }
  const wpF = (st: FlightState) => (st.dwelling ? st.wp : st.wp + st.t)

  // ---- build: one space per frame, nearest first, within three waypoints (or at once when a jump lands on it)
  let building = 0
  const startBuild = async (e: Entry) => {
    e.state = 'building'; building++
    const t0 = performance.now()
    try {
      const make = await MAKERS[e.def.id]()
      const space = make()
      const w = WAYPOINTS[e.wp]
      const kit: SpaceKit = {
        renderer, camera, scene, env: sharedEnv(renderer), phone: isPhone(), reduced: reducedMotion, win: INTERESTS[e.def.i]?.light ?? [1, 1, 1],
        fog: e.fog, def: e.def, nocrag, stageYaw: (w.place.yaw ?? e.def.yaw) - e.def.yaw,
      }
      e.kit = kit
      space.root.position.set(e.def.at[0], e.def.at[1], e.def.at[2]); space.root.rotation.y = e.def.yaw
      space.root.visible = false
      await space.build(kit)
      scene.add(space.root)
      precompile(kit as unknown as Parameters<typeof precompile>[0], space.root)
      e.space = space; e.state = 'ready'; e.ms = performance.now() - t0
    } catch (err) { e.state = 'failed'; console.warn('[spaces] build failed', e.def.id, err) }
    building = Math.max(0, building - 1)
  }

  let lit = false
  const setLight = (e: Entry | null, r: number) => {
    if (!e?.space) { if (lit) { key.intensity = 0; rim.intensity = 0; fill.intensity = 0; lit = false } return }
    const c = e.space.light, root = e.space.root
    root.updateWorldMatrix(true, false)
    key.position.copy(root.localToWorld(v.set(...c.keyPos))); key.target.position.copy(root.localToWorld(v.set(...c.keyAim))); key.target.updateMatrixWorld()
    key.color.setRGB(...c.keyCol); key.intensity = c.keyI * r; key.angle = c.keyAngle; key.penumbra = c.keyPen; key.distance = c.keyDist
    rim.position.copy(root.localToWorld(v.set(...c.rimPos))); rim.color.setRGB(...c.rimCol); rim.intensity = c.rimI * r; rim.distance = c.rimDist
    fill.color.setRGB(...(c.fillSky ?? [0, 0, 0])); fill.groundColor.setRGB(...(c.fillGround ?? [0, 0, 0])); fill.intensity = (c.fillI ?? 0) * r
    lit = true
  }

  const update = (t: number, dt: number, st: FlightState) => {
    const rm = reducedMotion()
    jr = jumpRoute()
    const dest = entries.find(e => e.wp === destinationWp(st))
    if (dest && dest.state === 'idle') void startBuild(dest)
    if (!building) {
      let best: Entry | null = null, bd = 1e9
      for (const e of entries) { if (e.state !== 'idle') continue; const d = Math.abs(wpF(st) - e.wp); if (d < bd) { bd = d; best = e } }
      if (best && bd <= 3.5) void startBuild(best)
    }
    const px = renderer.getPixelRatio() * Math.max(0.6, Math.min(1.5, innerHeight / 900))
    let top: Entry | null = null, topR = 0
    for (const e of entries) {
      let r = presence(e.wp, st)
      if (rm) r = st.dwelling && st.wp === e.wp ? 1 : 0
      e.r = r
      if (!e.space || e.state !== 'ready') { if (r > 0.5 && e.state === 'idle' && !building) void startBuild(e); continue }
      const vis = r > 0.001
      e.space.root.visible = vis
      if (!vis) continue
      e.fog.pres.value = r; e.fog.time.value = rm ? 0 : t; e.fog.px.value = px
      e.space.update(t, dt, r, st.dwelling && st.wp === e.wp)
      if (r > topR) { topR = r; top = e }
    }
    setLight(top, topR)
    // ---- the veil: between two neighbouring interests, t 0.35..0.65, in the NEXT window's colour
    const a = st.wp, b = st.next
    const between = !st.dwelling && a >= first && a <= last && b >= first && b <= last && Math.abs(a - b) === 1 && !rm
    if (between) {
      const u = sstep(0, 1, Math.min(1, Math.max(0, (st.t - 0.35) / 0.3)))
      const ent = entries.find(e => e.wp === b)!, cur = entries.find(e => e.wp === a)!
      const col = INTERESTS[ent.def.i]?.light ?? [1, 1, 1]
      veilMat.uniforms.uU.value = u; veilMat.uniforms.uCol.value.setRGB(col[0] * 0.85 + 0.12, col[1] * 0.85 + 0.12, col[2] * 0.85 + 0.12)
      camera.updateMatrixWorld()
      const e = camera.matrixWorld.elements, dx = ent.def.at[0] - cur.def.at[0], dz = ent.def.at[2] - cur.def.at[2]
      veilMat.uniforms.uDir.value = dx * e[0] + dz * e[2] > 0 ? -1 : 1               // the wall slides against the camera's travel
      veilMat.uniforms.uSeed.value = ent.def.i * 3.7; veilMat.uniforms.uAsp.value = camera.aspect
      veil.visible = u > 0.002 && u < 0.998
    } else if (veil.visible) veil.visible = false
  }
  const timedUpdate = timed('spaces', update)
  const win = window as unknown as { __spaces?: unknown }
  win.__spaces = {
    entries, key, rim, fill, veil, defs, nocrag,
    report: () => entries.map(e => ({ id: e.def.id, state: e.state, r: +e.r.toFixed(3), buildMs: Math.round(e.ms), ...(e.space?.info?.() ?? {}) })),
  }
  return {
    update(t, dt, st) {
      if (!isOn('spaces')) { if (lit) setLight(null, 0); veil.visible = false; for (const e of entries) if (e.space) e.space.root.visible = false; return }
      timedUpdate(t, dt, st)
    },
  }
}
