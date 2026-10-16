// SET PIECE 1 (unit 10H / w11): the doors of the university.  leg gate > hall.
// The visitor stands outside a gothic portal (stepped pointed archivolt, carved rose, a glowing gable rose) with its oak leaves SHUT and a thin seam of warm light between them
// (that is the gate dwell, hall/rig.ts). Scrolling on: the leaves swing in on damped hinge springs (u 0.1 - 0.45), the camera crosses the threshold (0.45 - 0.6, a soft warm bloom,
// never a white-out), and walks up the nave to the hall pose: it ends at least 15 units past the sill, the doorway behind it. The real, persistent hall of extras/hall.ts is what
// you walk into; nothing here fades away. Scroll back and you walk out, the doors close.
// This piece owns the CAMERA PATH, the particle alpha, the sound cues and the soft bloom at the threshold; the stone, the hinges and the light are hall/rig.ts, driven by the same
// closed-form functions of the leg's progress (extras/hall.ts reads the leg's clock from TIMING). A pure function of leg progress.
import * as THREE from 'three'
import { type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, keys, lerp, sstep } from './common'
import { getRig, type HallEnv } from '../hall/rig'

const M4 = new THREE.Matrix4()

export function createDoors(leg: Leg): Piece {
  const rig = getRig()
  const toLocal = (p: [number, number, number], out = new THREE.Vector3()) => out.set(p[0], p[1], p[2]).applyMatrix4(M4.copy(rig.root.matrixWorld).invert())
  // the camera's spine in hall-local space (x across, y up, z = depth into the hall; the door is z = 0), built once from the flight's own two end poses:
  // it STARTS at the gate pose (front-on to the shut doors) and ENDS at the hall pose
  let spine: { px: (u: number) => number; py: (u: number) => number; pz: (u: number) => number; fov: (u: number) => number; t0: THREE.Vector3; end: THREE.Vector3; endT: THREE.Vector3 } | null = null
  const DOOR_AIM = new THREE.Vector3(0, 3.3, 14)       // while the doors open the eye rests on the passage and the nave beyond it
  const make = (env: Env) => {
    rig.root.updateMatrixWorld(true)
    const S = env.flightCam(0), M = env.flightCam(1)
    const s0 = toLocal(S.pos), t0 = toLocal(S.target), m = toLocal(M.pos), mt = toLocal(M.target)
    const zs = Math.min(s0.z, -9)
    const px = keys([[0, s0.x], [0.12, s0.x * 0.86], [0.45, s0.x * 0.1], [0.56, 0], [0.76, m.x * 0.5], [1, m.x]])
    const py = keys([[0, s0.y], [0.12, s0.y], [0.45, lerp(s0.y, 3.1, 0.75)], [0.6, 2.9], [0.8, lerp(2.9, m.y, 0.65)], [1, m.y]])
    const pz = keys([[0, s0.z], [0.12, s0.z + 0.05 * (-zs)], [0.45, -5.2], [0.6, 3.0], [0.8, lerp(3.0, m.z, 0.62)], [1, m.z]])
    const fov = keys([[0, S.fov], [0.3, lerp(S.fov, 40, 0.5)], [0.5, 44], [0.62, 50], [0.82, 49], [1, M.fov]])
    spine = { px, py, pz, fov, t0, end: m.clone(), endT: mt.clone() }
  }
  const piece: Piece = {
    leg,
    cues: [{ at: 0.18, name: 'tr:doors' }, { at: 0.52, name: 'tr:flood' }],
    build(env) { rig.build(env as unknown as HallEnv) },
    setVisible(v) { if (!v) rig.flood.uA.value = 0 },
    frame(inp: FrameIn, out: FrameOut) {
      const u = inp.u
      // the soft warm bloom as the camera crosses the threshold: never a white-out and never black
      const pulse = sstep(0.45, 0.53, u) * (1 - sstep(0.56, 0.68, u))
      rig.flood.uA.value = 0.5 * pulse
      out.field = lerp(1, 0.36, sstep(0.12, 0.4, u))
      out.flash = 0; out.flashCol = [1, 0.74, 0.42]
    },
    camera(u, _base, env): CamPose | null {
      if (!rig.built) return null
      if (!spine) make(env)
      const s = spine!
      const pos = new THREE.Vector3(s.px(u), s.py(u), s.pz(u))
      // looking: from the gate pose's own aim, round to the passage as the leaves part (u 0 - 0.3), hold there through the threshold, then up the nave to the hall pose's aim
      const a = sstep(0, 0.3, u), b = sstep(0.5, 1, u)
      const tgt = new THREE.Vector3().lerpVectors(s.t0, DOOR_AIM, a).lerp(s.endT, b)
      const w = rig.root.matrixWorld
      pos.applyMatrix4(w); tgt.applyMatrix4(w)
      return { pos: [pos.x, pos.y, pos.z], target: [tgt.x, tgt.y, tgt.z], fov: s.fov(u) }
    },
    dispose() { rig.dispose() },
  }
  return piece
}
