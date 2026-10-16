// SET PIECE (w11): the far doors.  leg hall > hold.
// From the middle of the nave the camera walks down it toward the end wall (u 0 - 0.4); the far oak doors under the middle window swing OUT on their hinge springs
// (0.15 - 0.5, hall/fardoor.ts, driven by the same u); the camera passes through the doorway at lx 0, about 2.4 up (0.5 - 0.65) into the dark, then eases onto the flight's own
// pose at the first interest, the hold (a Hermite arc that leaves the doorway at the speed it entered it, and arrives at rest). The room fades out once the camera is past the
// doors (u > 0.7, extras/hall.ts) and the particle field comes back (alpha >= 0.3 from u 0.7) so the first interest's form and space can appear.
// A pure function of u: scrolling back replays it (the doors close, you walk back in). Cue: tr:exit at u 0.18 (the leaves let go).
import * as THREE from 'three'
import { type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, keys, lerp, sstep } from './common'
import { getRig, type HallEnv } from '../hall/rig'
import { L } from '../hall/shell'

const M4 = new THREE.Matrix4()
const AIM_LOCAL = new THREE.Vector3(0, 2.9, L + 12)     // down the axis of the nave, through the doorway

export function createExit(leg: Leg): Piece & { visible: boolean } {
  const rig = getRig()
  const toLocal = (p: [number, number, number], out = new THREE.Vector3()) => out.set(p[0], p[1], p[2]).applyMatrix4(M4.copy(rig.root.matrixWorld).invert())
  let sp: { px: (u: number) => number; py: (u: number) => number; pz: (u: number) => number; fov: (u: number) => number; t0: THREE.Vector3; QW: THREE.Vector3; mW: THREE.Vector3; HW: THREE.Vector3; htW: THREE.Vector3; fovEnd: number } | null = null
  const U1 = 0.65
  const make = (env: Env) => {
    rig.root.updateMatrixWorld(true)
    const S = env.flightCam(0), E = env.flightCam(1)
    const s0 = toLocal(S.pos), t0 = toLocal(S.target)
    // in the hall: from the hall pose, straight down the axis, through the doorway at about 2.4
    const px = keys([[0, s0.x], [0.4, 0], [1, 0]])
    const py = keys([[0, s0.y], [0.4, 3.1], [0.5, 2.8], [U1, 2.4], [1, 2.4]])
    const pz = keys([[0, s0.z], [0.3, L - 10.5], [0.4, L - 5.8], [0.5, L - 2.4], [0.56, L + 0.2], [U1, L + 4.6], [1, L + 12]])
    const fov = keys([[0, S.fov], [0.4, 52], [0.6, 54], [1, 54]])
    const w = rig.root.matrixWorld
    const QW = new THREE.Vector3(px(U1), py(U1), pz(U1)).applyMatrix4(w)
    const Q2 = new THREE.Vector3(px(U1 + 0.01), py(U1 + 0.01), pz(U1 + 0.01)).applyMatrix4(w)
    const mW = Q2.sub(QW).multiplyScalar(100 * (1 - U1))  // the doorway's velocity, scaled to the remaining arc
    sp = { px, py, pz, fov, t0, QW, mW, HW: new THREE.Vector3(...E.pos), htW: new THREE.Vector3(...E.target), fovEnd: E.fov }
  }
  const piece: Piece & { visible: boolean } = {
    leg, visible: false,
    cues: [{ at: 0.18, name: 'tr:exit' }],
    build(env) { rig.build(env as unknown as HallEnv) },
    setVisible(v) { piece.visible = v },
    frame(inp: FrameIn, out: FrameOut) {
      // the particles come back once the room is behind you
      out.field = lerp(0.4, 1, sstep(0.62, 0.95, inp.u))
      out.flash = 0; out.flashCol = [1, 0.74, 0.42]
    },
    camera(u, _base, env): CamPose | null {
      if (!rig.built) return null
      if (!sp) make(env)
      const s = sp!, w = rig.root.matrixWorld
      const pos = new THREE.Vector3(), tgt = new THREE.Vector3()
      const aim = AIM_LOCAL.clone().applyMatrix4(w)
      if (u <= U1) {
        pos.set(s.px(u), s.py(u), s.pz(u)).applyMatrix4(w)
        tgt.copy(s.t0).lerp(AIM_LOCAL, sstep(0, 0.38, u)).applyMatrix4(w)
      } else {
        // a Hermite arc from the doorway (leaving at the speed it arrived) to the hold pose (arriving at rest)
        const t = (u - U1) / (1 - U1), t2 = t * t, t3 = t2 * t
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2
        pos.copy(s.QW).multiplyScalar(h00).addScaledVector(s.mW, h10).addScaledVector(s.HW, h01)
        tgt.copy(aim).lerp(s.htW, sstep(0, 1, t))
      }
      const fov = u <= U1 ? s.fov(u) : lerp(s.fov(U1), s.fovEnd, sstep(0, 1, (u - U1) / (1 - U1)))
      return { pos: [pos.x, pos.y, pos.z], target: [tgt.x, tgt.y, tgt.z], fov }
    },
    dispose() { /* the rig belongs to the doors piece */ },
  }
  return piece
}
