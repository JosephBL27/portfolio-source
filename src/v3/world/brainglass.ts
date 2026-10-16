// The glass brain at the Mind area: src/gl/brain.ts (anatomical) scaled up to world size. Two hemispheres with the longitudinal
// fissure, frontal / parietal / temporal / occipital lobes, the lateral fissure, gyri and sulci, a cerebellum with folia and the
// brainstem, in glass; the vault's real link graph is etched inside it, every folder in its own lobe. It turns toward the camera,
// pulses along the real links, and changes colour: Obsidian's folder colours, a thermal look, monochrome ivory, a spectral sweep.
// The mode changes on pulses (every fourth), slowly while you dwell near it, and when you click it. Refraction-style glass lives
// here and nowhere else in the world (clarity rule).
import * as THREE from 'three'
import { createBrain, type Brain } from '../../gl/brain'
import { brainMode, MODE_NAMES, OBSIDIAN_COLORS } from '../../gl/brainColor'
import { displayReferred } from './tvset'

/** Obsidian graph-view folder colours for the vault's ten groups. Anything not listed is grey. */
export { OBSIDIAN_COLORS }

export interface BrainGlass {
  group: THREE.Group
  brain: Brain
  radius: number
  /** presence 0..1 (scale + glass opacity); camera is used to turn the face of the graph toward the viewer */
  update(t: number, dt: number, camera: THREE.Camera, presence: number): void
  pulse(fromNode?: number): void
  focusFolder(i: number | null): void
  dispose(): void
  /** v10: colour mode 0 folders, 1 thermal, 2 ivory, 3 spectral (state shared with the particle form) */
  readonly mode: number
  readonly modeName: string
  setMode(m: number, instant?: boolean): void
  /** advance to the next mode and send a pulse (what a click does) */
  nextMode(): void
  /** is the screen point (NDC) on the brain? Returns the world point of the hit, or null. */
  hit(ndcX: number, ndcY: number, camera: THREE.Camera): THREE.Vector3 | null
  /** a click on the brain: next colour mode and a pulse from the note nearest the hit */
  click(ndcX: number, ndcY: number, camera: THREE.Camera): boolean
  /** called whenever the colour mode changes (any cause) */
  onMode(cb: (mode: number, name: string) => void): () => void
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function createBrainGlass(opts: { envMap?: THREE.Texture | null; radius?: number; at: [number, number, number]; display?: boolean; onPulse?: () => void }): BrainGlass {
  const radius = opts.radius ?? 3.5
  const brain = createBrain({ radius, envMap: opts.envMap ?? null, folderColors: OBSIDIAN_COLORS, worldScale: true, anatomical: true })
  brain.setNight(true)
  const group = new THREE.Group(); group.name = 'brain-glass'
  group.position.set(...opts.at)
  group.add(brain.group)
  group.visible = false

  const fades: THREE.IUniform[] = []
  brain.group.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
    if (!m || !(m as THREE.ShaderMaterial).isShaderMaterial) return
    if (opts.display !== false) displayReferred(m)
    if (m.uniforms.uOpacity) fades.push(m.uniforms.uOpacity)
  })

  let yaw = 0, yawV = 0, shown = 0, nextPulse = 1.2, seed = 7, pulses = 0, lastModeAt = 0
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const tmp = new THREE.Vector3()
  const ray = new THREE.Ray(), sph = new THREE.Sphere(), hitP = new THREE.Vector3(), wpos = new THREE.Vector3()
  const caster = new THREE.Raycaster()
  let nowT = 0

  const setMode = (m: number, instant = false) => { lastModeAt = nowT; brainMode.set(m, instant) }

  const hit = (nx: number, ny: number, camera: THREE.Camera): THREE.Vector3 | null => {
    if (!group.visible) return null
    caster.setFromCamera(new THREE.Vector2(nx, ny), camera)
    ray.copy(caster.ray)
    group.getWorldPosition(wpos)
    // the brain is about 2.1 R long and 1.7 R tall: a sphere of 0.98 R catches the body, a flattened second test catches the lobes at the ends
    sph.set(wpos, radius * 0.98 * group.scale.x)
    if (ray.intersectSphere(sph, hitP)) return hitP.clone()
    sph.set(wpos.clone().add(new THREE.Vector3(1.4 * radius * group.scale.x, 0.1 * radius, 0).applyQuaternion(group.quaternion)), radius * 0.62 * group.scale.x)
    return ray.intersectSphere(sph, hitP) ? hitP.clone() : null
  }

  return {
    group, brain, radius,
    get mode() { return brainMode.cur },
    get modeName() { return MODE_NAMES[brainMode.cur] },
    setMode,
    nextMode() { setMode(brainMode.cur + 1); brain.pulse(); opts.onPulse?.() },
    hit,
    click(nx, ny, camera) {
      const p = hit(nx, ny, camera)
      if (!p) return false
      setMode(brainMode.cur + 1)
      brain.pulseAt(p)
      opts.onPulse?.()
      return true
    },
    onMode: cb => brainMode.onChange((m, n) => cb(m, n)),
    update(t, dt, camera, presence) {
      nowT = t
      group.visible = presence > 0.004
      if (!group.visible) { shown = 0; return }
      const s = presence * presence * (3 - 2 * presence)
      group.scale.setScalar(0.62 + 0.38 * s)
      for (const u of fades) u.value = s * 0.8
      // the face of the etched graph looks at the camera, with a slow sway of its own
      camera.getWorldPosition(tmp)
      const want = Math.atan2(tmp.x - group.position.x, tmp.z - group.position.z)
      const w = 4.2
      yawV += (w * w * wrapPi(want - yaw) - 2 * w * yawV) * dt
      yaw += yawV * dt
      brain.group.rotation.y = yaw
      brain.setTurn(0.5 * Math.sin(t * 0.11) + 0.08, 0.05 * Math.sin(t * 0.07 + 1.1) + 0.04)
      const near = tmp.distanceTo(group.position) < 22
      // pulses: one on arrival, then along the real links from a random note every few seconds; every fourth one changes the colour mode
      if (shown < 0.5 && s >= 0.5) { brain.pulse(); nextPulse = t + 3.4; lastModeAt = t; opts.onPulse?.() }
      else if (s > 0.9 && t >= nextPulse) {
        brain.pulse(Math.floor(rnd() * 478)); nextPulse = t + 2.6 + rnd() * 2.4; opts.onPulse?.()
        if (near && ++pulses % 4 === 0) setMode(brainMode.cur + 1)
      }
      // dwelling near it: a slow change of its own if nothing else has changed the colour for a while
      else if (s > 0.9 && near && t - lastModeAt > 20) setMode(brainMode.cur + 1)
      shown = s
      brain.update(dt, t)
    },
    pulse: n => brain.pulse(n),
    focusFolder: i => brain.focusFolder(i),
    dispose() { brain.dispose(); group.removeFromParent() },
  }
}
