// STAGE "secretary": a pointer layer over the four-inbox form. It owns no meshes. The form (forms/secretary.ts) draws four curved streams of mail and chat glyphs, one
// per source, from the four corners into the ledger; hovering a stream (within 26 px of its projected path, 36 px for a finger) lifts that stream (glyphs, flow dots and its source tray)
// and the stage tip names its source: Gmail, University Outlook, iMessage or WhatsApp, in the order projects.json's secretary line gives them. Words only, nothing to press.
import * as THREE from 'three'
import { WAYPOINTS } from '../../layout'
import { SECRETARY_SOURCES, secretaryStreams, secretaryUniforms } from '../../../forms/secretary'
import { stageTip, type StageBuildCtx, type StageDef } from './common'

const SRC_ACCENT = ['#ff6b57', '#4dbdff', '#9f8fff', '#5cf28f']
const NOTE = ['mail, read four times a day', 'mail, read four times a day', 'texts, read four times a day', 'chats, read four times a day']
const HOVER_PX = 26, TOUCH_PX = 36

export default {
  id: 'secretary',
  build(c: StageBuildCtx) {
    const pl = WAYPOINTS[c.wp].place
    const root = new THREE.Group()
    const tip = stageTip()
    const streams = secretaryStreams(pl)
    const proj = new THREE.Vector3()
    const project = (p: [number, number, number]) => {
      const f = (window as unknown as { __v3?: { field?: { project?(p: [number, number, number]): { x: number; y: number; visible: boolean } } } }).__v3?.field
      if (f?.project) return f.project(p)
      c.camera.updateMatrixWorld(); proj.set(p[0], p[1], p[2]).project(c.camera)
      const r = c.renderer.domElement.getBoundingClientRect()
      return { x: (proj.x * 0.5 + 0.5) * r.width, y: (-proj.y * 0.5 + 0.5) * r.height, visible: proj.z > -1 && proj.z < 1 }
    }
    const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    }
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    let hovered = -1
    const find = (x: number, y: number): number => {
      const r = c.renderer.domElement.getBoundingClientRect(), lx = x - r.left, ly = y - r.top
      let best = -1, bd = coarse ? TOUCH_PX : HOVER_PX
      for (const s of streams) {
        const pts = s.path.map(project)
        for (let i = 0; i + 1 < pts.length; i++) {
          if (!pts[i].visible || !pts[i + 1].visible) continue
          const d = segDist(lx, ly, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
          if (d < bd) { bd = d; best = s.k }
        }
      }
      return best
    }
    const set = (k: number) => { hovered = k; secretaryUniforms.hi.value = k }
    const pointer = {
      hover(_ray: THREE.Raycaster, x: number, y: number) {
        const k = find(x, y); set(k)
        if (k < 0) { tip.hide(); return null }
        tip.show(x, y, SECRETARY_SOURCES[k], NOTE[k], SRC_ACCENT[k])
        return 'pointer' as const
      },
      // nothing to press: a press passes through to the point-of-view drag
      down() { return null },
      leave() { set(-1); tip.hide() },
    }
    return {
      root,
      dust: 1,                      // the form is the picture: never dimmed
      size: [4, 4] as [number, number],
      pointer,
      hint: ['Touch a stream', 'it names its inbox'] as [string, string],
      update() {},
      debug: () => ({ hovered: hovered >= 0 ? SECRETARY_SOURCES[hovered] : null }),
    }
  },
} satisfies StageDef
