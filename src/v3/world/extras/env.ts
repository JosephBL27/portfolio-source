// ONE shared PMREM environment for everything that is meant to shine: the TV chrome and gloss, the chain, the glass-brain shells and the
// 3D name (hero3d.ts). Before this each owner baked its own near-black studio (tvset.makeTVEnv: four dim softboxes in a 0.035 grey room), so
// chrome mostly reflected black and the glass had nothing to refract. This studio is a dark room that has real light in it:
//   long bright strips across a dark front hemisphere (a polished face shows bands of light and dark that slide as it turns, never one flat
//   tone), a hard diagonal strip (the moving highlight), cool and warm back strips (rim light on edges and walls), an overhead softbox, and a
//   low amber kicker that stands for the hub TV's own glow. Values are HDR (the PMREM target is half float).
// Applied by walking the whole field scene (w12: not only world.root): any MeshStandard/Physical material that already had an envMap gets the
// shared one, and one that had none gets it at envMapIntensity 0.35 (so nothing jumps in brightness but nothing is left reflecting black); any
// ShaderMaterial with a `uEnv` sampler (the brain shells) too. Re-applied whenever field.addObject runs and by a 1 s sweep for objects added
// to a group later. Exposed as window.__v3.env { texture, enabled, gain, set(on), adopted, bare }.
// ?extras=-env keeps the old per-owner environments (the "before" of the before/after).
import * as THREE from 'three'
import { extraOn } from './lib/flags'
import type { Extra, ExtraCtx } from '../../main'

let shared: THREE.Texture | null = null
let sharedFor: THREE.WebGLRenderer | null = null

const dome = () => new THREE.Mesh(
  new THREE.SphereGeometry(40, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec3 vP; void main() {
      float h = vP.y;
      vec3 zen = vec3(0.020, 0.027, 0.046), hor = vec3(0.050, 0.043, 0.040), nad = vec3(0.006, 0.006, 0.008);
      vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, nad, pow(-h, 0.45));
      gl_FragColor = vec4(c, 1.0);
    }`,
  }))

/** a lit rectangle `d` away from the origin, facing it, spun `roll` rad about its own axis */
function card(scene: THREE.Scene, pos: [number, number, number], w: number, h: number, rgb: [number, number, number], k: number, roll = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0] * k, rgb[1] * k, rgb[2] * k), side: THREE.DoubleSide, toneMapped: false }))
  m.position.set(...pos); m.lookAt(0, 0, 0); m.rotateZ(roll)
  scene.add(m)
  return m
}
export function buildStudio(): THREE.Scene {
  const s = new THREE.Scene()
  s.add(dome())
  // front hemisphere (what a face looking at the viewer reflects): mostly dark, crossed by long strips, so a polished letter shows bands of
  // light and dark that slide as it turns, instead of one pale tone
  card(s, [0, 3.4, 11], 20, 1.7, [1.0, 0.98, 0.95], 2.1)                          // high strip, neutral white
  card(s, [0, -1.5, 11], 20, 0.8, [1.0, 0.78, 0.55], 1.3)                         // low strip, champagne
  card(s, [-6.2, 0.6, 9.4], 2.6, 10, [0.78, 0.88, 1.0], 1.9)                      // tall cool softbox, front left
  card(s, [-1.5, 2.0, 9.5], 0.55, 12, [1.0, 1.0, 1.0], 8.0, 0.5)                  // hard diagonal strip: the highlight that slides across a face
  card(s, [6.0, 0.8, 8.4], 1.3, 9, [1.0, 0.86, 0.7], 3.4)                         // warm strip, front right
  card(s, [-5.5, 4.6, 5.5], 6.5, 3.8, [1.0, 0.96, 0.9], 2.8)                      // key softbox, high left
  card(s, [0, 10.2, 1.5], 10, 5.5, [1.0, 0.98, 0.95], 2.6)                        // overhead
  card(s, [8.6, 0.4, 3.5], 1.5, 9.5, [0.86, 0.92, 1.0], 3.2)                      // cool fill strip, right
  card(s, [-9.5, 0.8, -5.5], 1.1, 9, [0.82, 0.9, 1.0], 7.0)                       // back rim, cool, left
  card(s, [9.5, 1.0, -5.0], 1.1, 9, [1.0, 0.64, 0.38], 5.5)                       // back rim, warm, right
  card(s, [0, -2.8, 7.0], 11, 1.0, [1.0, 0.56, 0.3], 1.6)                         // low amber kicker: the hub screen's glow
  card(s, [0, 1.5, -10], 14, 3.0, [0.7, 0.8, 1.0], 0.9)                           // dim far wall so the backs of things are not black
  return s
}

/** the shared environment texture (PMREM, built once per renderer) */
export function sharedEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (shared && sharedFor === renderer) return shared
  const pm = new THREE.PMREMGenerator(renderer)
  const studio = buildStudio()
  const prev = renderer.getRenderTarget()
  shared = pm.fromScene(studio, 0.035, 0.1, 80).texture
  renderer.setRenderTarget(prev)
  studio.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
  pm.dispose()
  sharedFor = renderer
  return shared
}

/** envMapIntensity of a material that had no environment of its own */
const BARE_K = 0.35
interface Held { env: THREE.Texture | null; k: number }
export interface EnvApi { texture: THREE.Texture | null; enabled: boolean; gain: number; set(on: boolean): void; adopted: number; /** how many of the adopted materials had no envMap before */ bare: number; scan(): void }

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('env') || !ctx.field?.renderer || !ctx.field?.scene) return
  const renderer: THREE.WebGLRenderer = ctx.field.renderer, root: THREE.Object3D = ctx.field.scene
  const tex = sharedEnv(renderer)
  const held = new Map<THREE.Material, Held>()                       // standard materials: their original envMap + envMapIntensity
  const heldU = new Map<THREE.IUniform, THREE.Texture | null>()      // brain shells: their original uEnv
  const api: EnvApi = {
    texture: tex, enabled: true, gain: 1, adopted: 0, bare: 0,
    set(on) { api.enabled = on; apply() },
    scan() { scan() },
  }
  const GAIN = 1.0
  function apply() {
    for (const [m, h] of held) {
      const sm = m as THREE.MeshStandardMaterial
      sm.envMap = api.enabled ? tex : h.env
      sm.envMapIntensity = api.enabled ? (h.env ? h.k : BARE_K) * api.gain * GAIN : h.k
      sm.needsUpdate = true
    }
    for (const [u, orig] of heldU) u.value = api.enabled ? tex : orig
  }
  const scan = () => {
    let fresh = 0
    root.traverse(o => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        const sm = m as THREE.MeshStandardMaterial
        if (sm.userData?.ownEnv) continue                             // a stage that brings its own studio (stages/qvr.ts: a Poly Haven HDRI) keeps it
        if (sm.isMeshStandardMaterial && !held.has(m)) { held.set(m, { env: sm.envMap, k: sm.envMapIntensity }); if (!sm.envMap) api.bare++; fresh++ }
        const u = (m as THREE.ShaderMaterial).uniforms?.uEnv as THREE.IUniform<THREE.Texture | null> | undefined
        if ((m as THREE.ShaderMaterial).isShaderMaterial && u && !heldU.has(u)) { heldU.set(u, u.value); fresh++ }
      }
    })
    if (fresh) { api.adopted = held.size + heldU.size; apply() }
  }
  scan()
  const addObject0 = ctx.field.addObject?.bind(ctx.field)
  if (addObject0) ctx.field.addObject = (o: THREE.Object3D) => { const rm = addObject0(o); scan(); return rm }
  // publish on window.__v3 (main.ts creates it right after the extras are installed)
  const publish = () => { const v = (window as unknown as { __v3?: Record<string, unknown> }).__v3; if (v) v.env = api; else requestAnimationFrame(publish) }
  publish()
  let n = 0
  return { update() { if ((++n & 63) === 0) scan() } }   // anything added to a group after its addObject (TVs the world builds lazily, spaces) is picked up within ~1 s
}
