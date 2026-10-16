// Ambient motion that needs no music: chalk dust drifting and puffing off the holds (climbing), candle light at the chessboard, a slow sheen
// sweeping the record's grooves. The dust is a small additive Points cloud parented to the climbing wall; the candle and the sheen are the
// post pass's single glow slot. Everything is slow (no flicker above 3 Hz) and reduced motion leaves only static light.
import * as THREE from 'three'
import type { ExtraCtx } from '../../../main'
import type { FlightState } from '../../flight'
import { WAYPOINTS } from '../../layout'
import { clamp01, reducedMotion, sstep } from '../lib/flags'

type Stages = Record<string, { root: THREE.Object3D; api?: Record<string, any> }>
const N = 72
const idx = (id: string) => WAYPOINTS.findIndex(w => w.id === id)

export interface Glow { x: number; y: number; z: number; w: number; mode: 0 | 1; rx: number; ry: number; col: [number, number, number] }

export function createAmbient(ctx: ExtraCtx) {
  const stages = () => ((window as unknown as { __cab?: { stages?: Stages } }).__cab?.stages ?? {})
  const iHold = idx('hold'), iKnight = idx('knight'), iRec = idx('records')
  const near = (st: FlightState, i: number) => { const p = st.dwelling ? st.wp : st.wp + (st.next - st.wp) * st.t; return 1 - sstep(0.15, 0.95, Math.abs(p - i)) }

  // ---- chalk dust
  let pts: THREE.Points | null = null, pos: Float32Array, vel: Float32Array, life: Float32Array, alpha: THREE.BufferAttribute | null = null, cursor = 0, acc = 0, tried = false
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!; const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,250,240,1)'); r.addColorStop(0.4, 'rgba(255,248,236,.45)'); r.addColorStop(1, 'rgba(255,245,230,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return t })()
  const build = () => {
    tried = true
    const s = stages().hold; if (!s) { tried = false; return }
    const wall = s.root.children.find(c => (c as THREE.Group).isGroup && Math.abs(c.rotation.x - 0.52) < 0.02)
    if (!wall) return
    pos = new Float32Array(N * 3); vel = new Float32Array(N * 3); life = new Float32Array(N).fill(0)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const col = new Float32Array(N * 3); alpha = new THREE.BufferAttribute(col, 3); g.setAttribute('color', alpha)
    const m = new THREE.PointsMaterial({ map: tex, size: 0.2, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 7; wall.add(pts)
    for (let i = 0; i < N; i++) pos[i * 3 + 2] = -50
  }
  const spawn = (x: number, y: number, strong: boolean) => {
    if (!pts) return
    const i = cursor++ % N, k = strong ? 1 : 0.5
    pos[i * 3] = x + (Math.random() - 0.5) * 0.18; pos[i * 3 + 1] = y + 0.1 + Math.random() * 0.15; pos[i * 3 + 2] = 0.5 + Math.random() * 0.15
    vel[i * 3] = (Math.random() - 0.5) * 0.16 * k; vel[i * 3 + 1] = (0.04 + Math.random() * 0.1) * k; vel[i * 3 + 2] = 0.05 + Math.random() * 0.12
    life[i] = 2.2 + Math.random() * 1.8
  }
  const holdAt = (i: number) => { const a = stages().hold?.api as { holds?: { spec: { x: number; y: number } }[]; route?: number[] } | undefined; const h = a?.holds?.[a.route?.[i] ?? i]?.spec; return h ? { x: h.x, y: h.y } : null }
  ctx.on((name, d) => { if ((name === 'cab:grab' || name === 'obj:move') && d && typeof d.i === 'number') { const h = holdAt(d.i); if (h && !reducedMotion()) for (let k = 0; k < 7; k++) spawn(h.x, h.y, true) } })

  const v = new THREE.Vector3()
  const toUv = (o: THREE.Object3D, dy: number, cam: THREE.Camera) => {
    o.updateWorldMatrix(true, false); v.setFromMatrixPosition(o.matrixWorld); v.y += dy; v.project(cam)
    return { x: v.x * 0.5 + 0.5, y: v.y * 0.5 + 0.5, behind: v.z > 1 }
  }

  return {
    /** returns the glow the post pass should draw (or null) */
    update(t: number, dt: number, st: FlightState, cam: THREE.Camera): Glow | null {
      const rm = reducedMotion()
      // dust
      const hn = near(st, iHold)
      if (!tried && hn > 0.2) build()
      if (pts) {
        pts.visible = hn > 0.02 && !rm
        if (pts.visible) {
          if (hn > 0.5) { acc += dt; if (acc > 0.45) { acc = 0; const h = holdAt(Math.floor(Math.random() * 20)); if (h) spawn(h.x, h.y, false) } }
          const c = alpha!.array as Float32Array
          for (let i = 0; i < N; i++) {
            if (life[i] <= 0) { c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 0; continue }
            life[i] -= dt
            vel[i * 3] += Math.sin(t * 0.9 + i * 1.7) * 0.05 * dt; vel[i * 3 + 1] -= 0.035 * dt
            pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt
            const a = Math.min(1, life[i] / 1.2) * Math.min(1, (4 - life[i]) * 2 + 0.2) * 0.5 * hn
            c[i * 3] = a; c[i * 3 + 1] = a * 0.97; c[i * 3 + 2] = a * 0.92
          }
          alpha!.needsUpdate = true; ;(pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
        }
      }
      // light
      const kn = near(st, iKnight), rc = near(st, iRec)
      if (kn > 0.02) {
        const s = stages().knight; if (!s) return null
        const p = toUv(s.root, 1.0, cam); if (p.behind) return null
        const fl = rm ? 1 : 1 + 0.12 * Math.sin(t * 1.9) + 0.08 * Math.sin(t * 2.7 + 1.3) + 0.05 * Math.sin(t * 1.1 + 4.0)
        return { x: p.x, y: p.y, z: 0.05 * kn * fl, w: 0.34, mode: 0, rx: 0, ry: 0, col: [1.0, 0.62, 0.3] }
      }
      if (rc > 0.02) {
        const api = stages().records?.api as { platterBox?: () => { x: number; y: number; rx: number; ry: number } | null } | undefined
        const b = api?.platterBox?.(); if (!b) return null
        const cv = ctx.canvas!.getBoundingClientRect()
        return { x: (b.x - cv.left) / cv.width, y: 1 - (b.y - cv.top) / cv.height, z: (rm ? 0.03 : 0.045) * clamp01(rc * 1.2), w: 0, mode: 1, rx: (b.rx * 1.05) / cv.width, ry: (b.ry * 1.05) / cv.height, col: [1.0, 0.86, 0.66] }
      }
      return null
    },
    dispose() { pts?.removeFromParent(); pts?.geometry.dispose(); tex.dispose() },
  }
}
