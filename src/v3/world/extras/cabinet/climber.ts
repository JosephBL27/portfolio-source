// The climber of the "hold" stage (w23): Quaternius "Woman in Tank Top" (Ultimate Animated Character pack, CC0, poly.pizza/m/XqzeZGB7iU), a rigged, skinned figure
// (public/models/glb/climber.glb, 2k triangles, 11 clips). Climbing has no clip in the pack, so the limbs are posed by analytic two-bone IK every frame:
//   hands  UpperArm -> LowerArm -> Palm, the palm then turned so the fingers wrap over the hold
//   feet   UpperLeg -> LowerLeg -> ankle; the rig's Foot bones are IK controllers parented to the root (Blender rig), so they are carried to the ankle
//   pelvis solved from the four contacts (hips off the wall, every limb within reach), plus an offset the stage animates (the pump and drive of a dyno, a fall)
// The stage (cabinet/boulder.ts) animates the four targets and the offset with anime.js; this file only turns them into bones. A clip (the pack's "Clapping") can take
// over the skeleton (clip(): IK off) for the celebration on the pad. Lit like the boulder: MeshStandardMaterial on the hold PMREM + the space's key; colours from the pack.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const HEIGHT = 1.66                    // metres, the boulder is 3.3 high
type Limb = 'lh' | 'rh' | 'lf' | 'rf'
/** four contacts, the pelvis offset while on the wall (pump, drive) and the free pelvis position used off the wall (all in the stage frame) */
export interface Pose { lh: THREE.Vector3; rh: THREE.Vector3; lf: THREE.Vector3; rf: THREE.Vector3; off: THREE.Vector3; free: THREE.Vector3 }

export interface Climber {
  root: THREE.Group
  pose: Pose
  /** wall normal (outward, toward the camera) and the climber's facing; set by the stage */
  normal: THREE.Vector3
  /** 0..1: 1 = the pelvis is solved from the contacts (+ pose.off), 0 = the pelvis is pose.free (falling, on the pad) */
  wall: { k: number }
  /** extra yaw of the whole figure (turning round on the pad) */
  turn: { a: number }
  /** the pelvis drawn last frame (stage frame) */
  pelvis(): THREE.Vector3
  update(dt: number): void
  clip(name: string | null): void
  info(): Record<string, unknown>
  dispose(): void
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3()
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion()
const s_n = new THREE.Vector3(), s_up = new THREE.Vector3(0, 1, 0), s_r = new THREE.Vector3(), s_t = new THREE.Vector3(), s_p = new THREE.Vector3(), s_a = new THREE.Vector3(), s_b = new THREE.Vector3(), s_q = new THREE.Quaternion(), I4 = new THREE.Matrix4()
const debug = typeof location !== 'undefined' ? new URLSearchParams(location.search).has('climbdebug') || new URLSearchParams(location.search).has('gate') : true

/** turn `bone` (world-space delta) so that the direction `from` (world) becomes `to` */
function aim(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, k = 1) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return
  _q.setFromUnitVectors(_e.copy(from).normalize(), _f.copy(to).normalize())
  if (k < 1) _q.slerp(_q3.identity(), 1 - k)
  bone.getWorldQuaternion(_q2)
  const parentW = bone.parent!.getWorldQuaternion(_q3)
  bone.quaternion.copy(parentW.invert().multiply(_q).multiply(_q2))
  bone.updateMatrixWorld(true)
}

/** analytic two-bone IK: a (root joint), b (middle), c (end) reach `target`, bending toward `pole` */
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _el = new THREE.Vector3(), _t2 = new THREE.Vector3()
function twoBone(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) {
  const pa = a.getWorldPosition(_pa), pb = b.getWorldPosition(_pb), pc = c.getWorldPosition(_pc)
  const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc)
  const toT = _a.copy(target).sub(pa), dist = THREE.MathUtils.clamp(toT.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
  const dir = toT.normalize()
  const ca = THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sa = Math.sqrt(1 - ca * ca)
  const pd = _b.copy(pole).sub(pa); pd.addScaledVector(dir, -pd.dot(dir))
  if (pd.lengthSq() < 1e-8) pd.set(0, -1, 0)
  pd.normalize()
  const elbow = _c.copy(pa).addScaledVector(dir, l1 * ca).addScaledVector(pd, l1 * sa)
  aim(a, _d.copy(pb).sub(pa), _el.copy(elbow).sub(pa))
  b.getWorldPosition(pb); c.getWorldPosition(pc)
  aim(b, _d.copy(pc).sub(pb), _t2.copy(pa).addScaledVector(dir, dist).sub(pb))      // its own scratch: aim() works in _e / _f
}

export async function loadClimber(env: THREE.Texture): Promise<Climber> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/glb/climber.glb`)
  const model = gltf.scene
  const root = new THREE.Group(); root.name = 'climber'
  const fig = new THREE.Group(); fig.add(model); root.add(fig)
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model), s = HEIGHT / (box.max.y - box.min.y)
  model.scale.setScalar(s); model.position.y = -box.min.y * s
  // climbing clothes: the pack's colours, a fabric roughness, the boulder's environment; smooth normals (the pack is flat shaded)
  const tone: Record<string, [number, number]> = { Shirt: [0.9, 0], Pants: [0.92, 0], Shoes: [0.7, 0], Skin: [0.62, 0], Hair: [0.55, 0], HairBase: [0.6, 0], Eyes: [0.4, 0] }
  const bones: Record<string, THREE.Bone> = {}
  const mats: THREE.Material[] = []
  model.traverse(o => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone
    const m = o as THREE.SkinnedMesh
    if (m.isSkinnedMesh) {
      m.frustumCulled = false; m.castShadow = false
      const g = m.geometry; g.deleteAttribute('normal'); const mg = mergeVertices(g, 1e-4); mg.computeVertexNormals(); m.geometry = mg; g.dispose()
      const src = m.material as THREE.MeshStandardMaterial
      const [rough, metal] = tone[src.name] ?? [0.8, 0]
      // the site is display-referred (materials are written straight to the canvas): the pack's linear factors go in as their display values
      const mat = new THREE.MeshStandardMaterial({ color: src.color.clone().convertLinearToSRGB(), roughness: rough, metalness: metal, envMap: env, envMapIntensity: 0.9, name: src.name })
      if (src.name === 'Shirt') mat.color.setRGB(0.66, 0.24, 0.12, THREE.LinearSRGBColorSpace)        // a rust tank top (display values): reads against moss and sandstone
      if (src.name === 'Pants') mat.color.setRGB(0.2, 0.21, 0.24, THREE.LinearSRGBColorSpace)
      src.dispose(); m.material = mat; mats.push(mat)
    }
  })
  const need = ['Body', 'Hips', 'Torso', 'Neck', 'Head', 'UpperArmL', 'LowerArmL', 'PalmL', 'MiddleHandL', 'UpperArmR', 'LowerArmR', 'PalmR', 'MiddleHandR', 'UpperLegL', 'LowerLegL', 'UpperLegR', 'LowerLegR', 'FootL', 'FootR']
  for (const n of need) if (!bones[n]) throw new Error('climber rig: no bone ' + n)
  const ankleOf = (b: THREE.Bone) => b.children.find(c => /_end$/.test(c.name)) ?? b
  const ankL = ankleOf(bones.LowerLegL), ankR = ankleOf(bones.LowerLegR)
  const rest = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion]>()
  for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()])
  // rest offsets in the figure's frame (metres): pelvis -> shoulders / hips; ankle -> foot bone
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(fig.matrixWorld).invert()
  const P = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)
  const pelvis0 = P(bones.Body), shL = P(bones.UpperArmL).sub(pelvis0), shR = P(bones.UpperArmR).sub(pelvis0), hipL = P(bones.UpperLegL).sub(pelvis0), hipR = P(bones.UpperLegR).sub(pelvis0)
  const footOffL = P(bones.FootL).sub(P(ankL)), footOffR = P(bones.FootR).sub(P(ankR))
  const armLen = P(bones.UpperArmL).distanceTo(P(bones.LowerArmL)) + P(bones.LowerArmL).distanceTo(P(bones.PalmL))
  const legLen = P(bones.UpperLegL).distanceTo(P(bones.LowerLegL)) + P(bones.LowerLegL).distanceTo(P(ankL))

  const mixer = new THREE.AnimationMixer(model)
  let action: THREE.AnimationAction | null = null
  const pose: Pose = { lh: new THREE.Vector3(), rh: new THREE.Vector3(), lf: new THREE.Vector3(), rf: new THREE.Vector3(), off: new THREE.Vector3(), free: new THREE.Vector3() }
  const normal = new THREE.Vector3(0, 0, 1), wall = { k: 1 }, turn = { a: 0 }
  const H = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), tmp = new THREE.Vector3(), w2l = new THREE.Matrix4()
  const reachFix = (h: THREE.Vector3, off: THREE.Vector3, t: THREE.Vector3, len: number) => {
    const j = tmp.copy(h).add(off), d = j.distanceTo(t)
    if (d > len) h.addScaledVector(j.sub(t).normalize(), -(d - len) * 0.55)
  }
  let lastInfo = { reachMiss: 0 }
  const lastH = new THREE.Vector3()

  function solvePelvis(): THREE.Vector3 {
    // in the stage frame (the climber group's parent): the figure faces the wall, its right is the camera's right
    const n = normal
    const hands = _a.copy(pose.lh).add(pose.rh).multiplyScalar(0.5), feet = _b.copy(pose.lf).add(pose.rf).multiplyScalar(0.5)
    H.copy(hands).add(feet).multiplyScalar(0.5)
    H.y = THREE.MathUtils.clamp(Math.min(hands.y - 0.86, feet.y + legLen * 0.86), feet.y + 0.18, hands.y + 0.2)
    H.addScaledVector(n, 0.3)
    const R = (v: THREE.Vector3) => _c.set(0, 0, 0).addScaledVector(side, -v.x).addScaledVector(up, v.y).addScaledVector(fwd, v.z)   // figure frame (+x its left, +z its front) -> stage
    for (let i = 0; i < 4; i++) {
      reachFix(H, R(shL), pose.lh, armLen * 0.985); reachFix(H, R(shR), pose.rh, armLen * 0.985)
      reachFix(H, R(hipL), pose.lf, legLen * 0.98); reachFix(H, R(hipR), pose.rf, legLen * 0.98)
    }
    return H
  }

  function update(dt: number) {
    if (action) { mixer.update(dt); fig.rotation.set(0, Math.atan2(-normal.x, -normal.z) + turn.a, 0); fig.position.copy(pose.free); root.updateMatrixWorld(true); return }   // a clip: pose.free is the floor point under the figure
    for (const [b, [p, q]] of rest) { b.position.copy(p); b.quaternion.copy(q) }
    fwd.copy(normal).negate(); fwd.y = 0; fwd.normalize()
    side.crossVectors(fwd, up).normalize()                              // the figure's right (= screen right from behind)
    // place the figure: faces the wall (its +z toward -normal), pelvis at the solved point (blended with the free offset while off the wall)
    const yaw = Math.atan2(-normal.x, -normal.z) + turn.a
    fig.rotation.set(0, yaw, 0)
    const h = wall.k >= 1 ? solvePelvis().add(pose.off) : wall.k <= 0 ? _d.copy(pose.free) : solvePelvis().add(pose.off).lerp(pose.free, 1 - wall.k)
    lastH.copy(h); tmp.copy(pelvis0).applyEuler(fig.rotation)
    fig.position.copy(h).sub(tmp)
    root.updateMatrixWorld(true)
    // targets are in the stage frame (root's parent); bones work in world space (scratch objects only: this runs every frame)
    const PW = root.parent ? root.parent.matrixWorld : I4
    const toW = (v: THREE.Vector3, out: THREE.Vector3) => out.copy(v).applyMatrix4(PW)
    const nW = s_n.copy(normal).transformDirection(PW), upW = s_up, rightW = s_r.copy(side).transformDirection(PW)
    const sh = (b: THREE.Object3D, out: THREE.Vector3) => b.getWorldPosition(out)
    fig.getWorldQuaternion(s_q)
    // arms: wrist a little below and off the hold, elbows down and out
    const arm = (u: THREE.Bone, l: THREE.Bone, p: THREE.Bone, mid: THREE.Bone, t: THREE.Vector3, sgn: number) => {
      const tw = toW(t, s_t).addScaledVector(nW, 0.05).addScaledVector(upW, -0.07)
      const pole = sh(u, s_p).addScaledVector(rightW, 0.6 * sgn).addScaledVector(upW, -0.7).addScaledVector(nW, 0.35)
      aim(u, sh(l, s_a).sub(sh(u, s_b)), _f.copy(rightW).multiplyScalar(sgn).addScaledVector(nW, -0.2))      // first out to the side: overhead from hanging is a 180 degree turn, unstable
      twoBone(u, l, p, tw, pole)
      const pw = sh(p, s_a), mw = sh(mid, s_b)
      aim(p, mw.sub(pw), _f.copy(upW).multiplyScalar(0.75).addScaledVector(nW, -0.55), 0.85)       // fingers up and over the edge
    }
    arm(bones.UpperArmL, bones.LowerArmL, bones.PalmL, bones.MiddleHandL, pose.lh, -1)
    arm(bones.UpperArmR, bones.LowerArmR, bones.PalmR, bones.MiddleHandR, pose.rh, 1)
    // legs: knees out and off the wall, then the foot controllers follow the ankles
    const leg = (u: THREE.Bone, l: THREE.Bone, ank: THREE.Object3D, foot: THREE.Bone, off: THREE.Vector3, t: THREE.Vector3, sgn: number) => {
      const tw = toW(t, s_t).addScaledVector(nW, 0.07).addScaledVector(upW, 0.07)
      const pole = sh(u, s_p).addScaledVector(rightW, 0.55 * sgn).addScaledVector(nW, 0.75).addScaledVector(upW, 0.1)
      twoBone(u, l, ank, tw, pole)
      const aw = ank.getWorldPosition(s_a), ow = s_b.copy(off).applyQuaternion(s_q)
      w2l.copy(foot.parent!.matrixWorld).invert()
      foot.position.copy(aw.add(ow).applyMatrix4(w2l)); foot.updateMatrixWorld(true)
    }
    leg(bones.UpperLegL, bones.LowerLegL, ankL, bones.FootL, footOffL, pose.lf, -1)
    leg(bones.UpperLegR, bones.LowerLegR, ankR, bones.FootR, footOffR, pose.rf, 1)
    // the head looks up the wall toward the hands
    const neck = sh(bones.Neck, s_p), mid = toW(_a.copy(pose.lh).add(pose.rh).multiplyScalar(0.5), s_t).addScaledVector(upW, 0.35)
    aim(bones.Neck, sh(bones.Head, s_a).sub(neck), mid.sub(neck), 0.45)
    if (debug) lastInfo = { reachMiss: +(sh(bones.PalmL, s_a).distanceTo(toW(pose.lh, s_t)) + sh(bones.PalmR, s_b).distanceTo(toW(pose.rh, s_t))).toFixed(3) }
  }

  return {
    root, pose, normal, wall, turn, update, pelvis: () => lastH.clone(),
    clip(name) {
      if (action) { action.stop(); action = null }
      if (!name) return
      const c = gltf.animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
      if (!c) return
      for (const [b, [p, q]] of rest) { b.position.copy(p); b.quaternion.copy(q) }
      action = mixer.clipAction(c); action.reset().fadeIn(0.25).play()
    },
    info: () => ({ height: HEIGHT, armLen: +armLen.toFixed(3), legLen: +legLen.toFixed(3), clip: action?.getClip().name ?? null, ...lastInfo }),
    dispose() { mixer.stopAllAction(); model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() }); for (const m of mats) m.dispose() },
  }
}
