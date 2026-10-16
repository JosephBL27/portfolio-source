// The room itself (unit 10H), in hall-local units: x across (+x on the left as you face the windows), y up from the floor, z = depth into the hall (the door is z = 0,
// the end wall with the five lancets is z = HALL.len). One merged mesh of tagged geometry (stone, oak, iron, brass, floor, cloth, lamp glass, flame) so the whole room
// is one draw call; the glass is a second mesh (the atlas), the side panes a third.
//   a nave with six bays: clustered wall shafts, a pointed transverse arch and a pair of diagonal ribs per bay under a ribbed barrel vault, oak wainscot,
//   maroon banners on the shafts, a runner down the middle, two long oak tables a side with dark-brass lamps, iron-and-candle chandeliers. The nave runs clear to the end wall: five lancets
//   (the interests) and, below the middle one, the far doors (w11; the interests no longer stand in the hall).
import * as THREE from 'three'
import { HALL, hallStopX } from '../../layout'
import { KIND, box, cyl, extrude, lathe, merge, pointedArch, sph, tag, xf } from '../transitions/common'
import { WIN } from './material'

// w11: the lancets rose to 9.2 (sill 6.0), so the outer ones (lx +-6.2) need a vault that clears 15.4 over their tips: the nave is 9.0 to a side (HALL.hw 7.6 was only the layout's clearance estimate)
export const HW = Math.max(HALL.hw, 9.0), L = HALL.len, WALL = 0.9
/** the far doors in the end wall, centred at lx = 0 below the middle lancet: a pointed-arch opening 3.2 wide, 5.4 tall (hall-local) */
export const DOOR = { hw: 1.6, h: 5.4, base: 0.22 }
export const SPRING = 8.8, RV = HW * 1.12
export const BAYS = 6, BAY = L / BAYS
/** apex height of the vault */
export const APEX = SPRING + Math.sqrt(RV * RV - (RV - HW) * (RV - HW))
/** height of the vault's inner surface at lateral x (off = radial offset) */
export function archY(x: number, off = 0): number {
  // the left arc is centred at (RV - HW, SPRING) with radius RV (+ off); by symmetry the height at x is the same as at -|x|
  return SPRING + Math.sqrt(Math.max(0, (RV + off) * (RV + off) - Math.pow(-Math.abs(x) - (-HW + RV), 2)))
}
const bandShape = (offOut: number, offIn: number): THREE.Shape => {
  const o = pointedArch(HW, SPRING, RV, offOut, 20).pts, i = pointedArch(HW, SPRING, RV, offIn, 20).pts.slice().reverse()
  const s = new THREE.Shape(); s.moveTo(o[0].x, o[0].y); for (const p of o) s.lineTo(p.x, p.y); for (const p of i) s.lineTo(p.x, p.y); s.closePath(); return s
}
/** a lancet outline (same curve as the texture): left foot, spring, arch, right foot; origin at the foot centre */
export function lancetPts(hw: number, h: number, grow = 0): THREE.Vector2[] {
  const R = hw * 1.9, rise = Math.sqrt(R * R - (R - hw) * (R - hw))
  const arch = pointedArch(hw + grow, h - rise, R + grow * 0, 0, 14).pts
  return [new THREE.Vector2(-hw - grow, -grow), ...arch, new THREE.Vector2(hw + grow, -grow)]
}
export const lancetRise = (hw: number) => { const R = hw * 1.9; return Math.sqrt(R * R - (R - hw) * (R - hw)) }
const shapeOf = (pts: THREE.Vector2[]) => { const s = new THREE.Shape(); s.moveTo(pts[0].x, pts[0].y); for (const p of pts) s.lineTo(p.x, p.y); s.closePath(); return s }

export interface Shell { stone: THREE.Mesh; glass: THREE.Mesh; side: THREE.Mesh; proxies: THREE.Mesh[]; winC: THREE.Vector3[] }

export function buildShell(mat: THREE.Material, glassMat: THREE.Material, sideMat: THREE.Material): Shell {
  const g: THREE.BufferGeometry[] = []
  const zs = Array.from({ length: BAYS + 1 }, (_, j) => j * BAY)

  // ---- floor, side walls, end wall (five lancet holes), the vault
  g.push(tag(xf(new THREE.PlaneGeometry(2 * (HW + WALL), L + 0.4), [0, 0, L / 2 - 0.1], [-Math.PI / 2, 0, 0]), KIND.floor))
  for (const sg of [-1, 1]) g.push(box(WALL, SPRING + 0.2, L, [sg * (HW + WALL / 2), (SPRING + 0.2) / 2, L / 2], KIND.stone, undefined, 0))
  {
    const o = pointedArch(HW, SPRING, RV, WALL, 20).pts
    const s = new THREE.Shape(); s.moveTo(-HW - WALL, 0)
    s.lineTo(-HW - WALL, SPRING); for (const p of o) s.lineTo(p.x, p.y); s.lineTo(HW + WALL, 0); s.closePath()
    const ys = WIN.sill + WIN.h - lancetRise(WIN.w / 2)
    for (let i = 0; i < 5; i++) {
      const xc = hallStopX(i), hole = new THREE.Path(), hw = WIN.w / 2
      const arch = pointedArch(hw, ys, hw * 1.9, 0, 14).pts
      hole.moveTo(xc - hw, WIN.sill); hole.lineTo(xc - hw, ys); for (const p of arch) hole.lineTo(xc + p.x, p.y); hole.lineTo(xc + hw, WIN.sill); hole.closePath()
      s.holes.push(hole)
    }
    {
      const dh = new THREE.Path(), dys = DOOR.h - lancetRise(DOOR.hw), da = pointedArch(DOOR.hw, dys, DOOR.hw * 1.9, 0, 14).pts
      dh.moveTo(-DOOR.hw, 0); dh.lineTo(-DOOR.hw, dys); for (const p of da) dh.lineTo(p.x, p.y); dh.lineTo(DOOR.hw, 0); dh.closePath()
      s.holes.push(dh)
    }
    g.push(extrude(s, 1.0, 0.01, KIND.stone, [0, 0, L - 1.0], [0, 0, 0], 8))
  }
  g.push(extrude(bandShape(WALL, 0), L, 0.01, KIND.stone, [0, 0, 0], [0, 0, 0], 8))
  // a moulding round every lancet of the end wall, standing proud of the wall face
  for (let i = 0; i < 5; i++) {
    const xc = hallStopX(i), hw = WIN.w / 2
    const outer = lancetPts(hw, WIN.h, 0.22), inner = lancetPts(hw, WIN.h, 0)
    const s = shapeOf(outer), hole = new THREE.Path(); hole.moveTo(inner[0].x, inner[0].y); for (const p of inner) hole.lineTo(p.x, p.y); hole.closePath(); s.holes.push(hole)
    g.push(extrude(s, 0.14, 0.01, KIND.stone, [xc, WIN.sill, L - 1.14], [0, 0, 0], 8))
    g.push(box(WIN.w + 0.7, 0.16, 0.44, [xc, WIN.sill - 0.06, L - 1.1], KIND.stone, undefined, 0.02)) // sill
  }
  // the far doors: a stone surround proud of the wall, a threshold, and an oak tympanum above the leaves (the leaves themselves are hall/fardoor.ts)
  {
    const outer = lancetPts(DOOR.hw, DOOR.h, 0.3), inner = lancetPts(DOOR.hw, DOOR.h, 0)
    const sh = shapeOf(outer), hole = new THREE.Path(); hole.moveTo(inner[0].x, inner[0].y); for (const p of inner) hole.lineTo(p.x, p.y); hole.closePath(); sh.holes.push(hole)
    g.push(extrude(sh, 0.16, 0.01, KIND.stone, [0, 0, L - 1.16], [0, 0, 0], 8))
    g.push(box(2 * DOOR.hw + 0.9, 0.12, 1.1, [0, 0.06, L - 0.5], KIND.stone, undefined, 0.02))
    const dys = DOOR.h - lancetRise(DOOR.hw), da = pointedArch(DOOR.hw + 0.01, dys, DOOR.hw * 1.9, 0, 14).pts, ty = dys + 0.2
    const t = new THREE.Shape(); t.moveTo(-DOOR.hw - 0.01, ty)
    for (const p of da) if (p.y >= ty) t.lineTo(p.x, p.y)
    t.lineTo(DOOR.hw + 0.01, ty); t.closePath()
    g.push(extrude(t, 0.22, 0.01, KIND.wood, [0, 0, L - 0.66], [0, 0, 0], 8))
    g.push(box(2 * DOOR.hw + 0.1, 0.2, 0.3, [0, ty - 0.02, L - 0.62], KIND.iron, undefined, 0.01))
    g.push(sph(0.22, [0, ty + 1.0, L - 0.7], KIND.brass, 14, 10))
  }
  // the dais before the windows
  g.push(box(2 * HW, 0.22, 3.6, [0, 0.11, L - 1.8 - 1.0], KIND.stone, undefined, 0.02))
  g.push(box(2 * HW - 0.8, 0.22, 0.7, [0, 0.11, L - 4.7 - 0.2], KIND.stone, undefined, 0.02))

  // ---- wall shafts, capitals, transverse arches, diagonal ribs
  for (let j = 1; j < BAYS; j++) {
    const z = zs[j]
    for (const sg of [-1, 1]) {
      const x = sg * (HW - 0.14)
      g.push(lathe([[0.001, 0], [0.78, 0], [0.78, 0.2], [0.62, 0.34], [0.5, 0.46], [0.001, 0.46]], [x, 0, z], KIND.stone, 14))
      g.push(cyl(0.4, 0.44, SPRING - 0.5, [x, 0.46 + (SPRING - 0.5 - 0.46) / 2, z], KIND.stone, 14))
      for (const dz of [-0.6, 0.6]) { g.push(cyl(0.17, 0.19, SPRING - 0.3, [x - sg * 0.06, 0.3 + (SPRING - 0.3) / 2, z + dz], KIND.stone, 10)); g.push(lathe([[0.001, 0], [0.26, 0], [0.26, 0.12], [0.17, 0.16], [0.001, 0.16]], [x - sg * 0.06, 0.2, z + dz], KIND.stone, 10)) }
      for (const r of [2.2, 4.4, 6.6]) g.push(lathe([[0.4, 0], [0.5, 0], [0.5, 0.08], [0.4, 0.1]], [x, r, z], KIND.stone, 14))
      g.push(lathe([[0.001, 0], [0.42, 0], [0.55, 0.18], [0.74, 0.34], [0.78, 0.6], [0.001, 0.6]], [x, SPRING - 0.55, z], KIND.stone, 14))
      for (const dz of [-0.6, 0.6]) g.push(lathe([[0.001, 0], [0.2, 0], [0.3, 0.12], [0.36, 0.3], [0.001, 0.3]], [x - sg * 0.06, SPRING - 0.3, z + dz], KIND.stone, 10))
    }
    g.push(extrude(bandShape(0, -0.62), 0.5, 0.02, KIND.stone, [0, 0, z - 0.25], [0, 0, 0], 8))
  }
  for (let j = 0; j < BAYS; j++) {
    const z0 = zs[j], z1 = zs[j + 1]
    for (const dir of [0, 1]) {
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 16; k++) { const t = k / 16, x = -HW + 2 * HW * t, zz = dir ? z0 + (z1 - z0) * t : z1 - (z1 - z0) * t; pts.push(new THREE.Vector3(x, archY(x, -0.02) - 0.07, zz)) }
      g.push(tag(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.1, 6, false), KIND.stone))
    }
    g.push(sph(0.24, [0, APEX - 0.1, (z0 + z1) / 2], KIND.brass, 12, 8))
  }
  g.push(tag(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, APEX - 0.06, 0), new THREE.Vector3(0, APEX - 0.06, L)), 6, 0.09, 6, false), KIND.stone))

  // ---- oak wainscot, a cap rail, a string course
  for (const sg of [-1, 1]) {
    g.push(box(0.14, 2.3, L - 0.4, [sg * (HW - 0.07), 1.15, L / 2], KIND.wood, undefined, 0.01))
    g.push(box(0.26, 0.12, L - 0.4, [sg * (HW - 0.13), 2.36, L / 2], KIND.wood, undefined, 0.01))
    g.push(box(0.2, 0.14, L, [sg * (HW - 0.1), 8.0, L / 2], KIND.stone, undefined, 0.01))
  }

  // ---- long oak tables with green lamps, benches, a few books
  for (const sg of [-1, 1]) for (const [z0, z1] of [[8.0, 14.6], [16.0, 22.0]]) {
    const cx = sg * 5.6, zc = (z0 + z1) / 2, len = z1 - z0
    g.push(box(1.7, 0.1, len, [cx, 1.05, zc], KIND.wood, undefined, 0.02))
    for (const z of [z0 + 0.9, z1 - 0.9]) { g.push(box(0.14, 1.0, 1.3, [cx - 0.55, 0.5, z], KIND.wood, undefined, 0.01)); g.push(box(0.14, 1.0, 1.3, [cx + 0.55, 0.5, z], KIND.wood, undefined, 0.01)) }
    g.push(box(1.2, 0.08, len - 1.6, [cx, 0.3, zc], KIND.wood, undefined, 0.01))
    for (const sx of [-1.45, 1.45]) g.push(box(0.5, 0.08, len - 0.3, [cx + sx, 0.62, zc], KIND.wood, undefined, 0.01), box(0.4, 0.6, len - 1.0, [cx + sx, 0.3, zc], KIND.wood, undefined, 0.01))
    const nL = Math.floor((len - 1.6) / 2.0)
    for (let k = 0; k <= nL; k++) {
      const lz = z0 + 0.9 + k * ((len - 1.8) / nL), lx = cx + sg * -0.3
      g.push(cyl(0.16, 0.18, 0.04, [lx, 1.12, lz], KIND.brass, 14))
      g.push(cyl(0.025, 0.025, 0.4, [lx, 1.34, lz], KIND.brass, 6))
      g.push(tag(xf(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), [lx, 1.5, lz], [0, 0, 0], [1, 0.7, 1]), 11))
      g.push(cyl(0.05, 0.05, 0.08, [lx, 1.8, lz], KIND.brass, 8))
    }
    for (let k = 0; k < 3; k++) g.push(box(0.34, 0.1 + 0.03 * k, 0.5, [cx + sg * 0.5, 1.15 + 0.06 * k, z0 + 2.4 + k * 2.2 + (k & 1) * 0.1], KIND.cloth, [0, 0.2 * k, 0], 0.01))
  }

  // ---- banners (plain maroon cloth with a gold border and lozenge) hang on the shafts; a runner down the nave
  for (let j = 1; j < BAYS; j++) for (const sg of [-1, 1]) {
    g.push(tag(xf(new THREE.PlaneGeometry(1.0, 3.7), [sg * (HW - 0.78), 5.6, zs[j]], [0, -sg * Math.PI / 2, 0]), KIND.cloth))
    g.push(cyl(0.035, 0.035, 1.2, [sg * (HW - 0.74), 7.5, zs[j]], KIND.brass, 6, [Math.PI / 2, 0, 0]))
  }
  g.push(tag(xf(new THREE.PlaneGeometry(1.9, L - 2), [0, 0.012, L / 2], [-Math.PI / 2, 0, 0]), KIND.cloth))

  // ---- chandeliers: an iron ring, candles with flames, three chains
  for (const z of [6.5, 15.5, 24.5]) {
    const cy = APEX - 3.6, R = 1.3
    g.push(tag(xf(new THREE.TorusGeometry(R, 0.05, 8, 32), [0, cy, z], [Math.PI / 2, 0, 0]), KIND.iron))
    g.push(tag(xf(new THREE.TorusGeometry(R * 0.55, 0.035, 8, 28), [0, cy + 0.2, z], [Math.PI / 2, 0, 0]), KIND.iron))
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, x = Math.cos(a) * R, zz = Math.sin(a) * R
      g.push(cyl(0.04, 0.05, 0.3, [x, cy + 0.17, z + zz], KIND.paper, 8))
      g.push(sph(0.07, [x, cy + 0.42, z + zz], 12, 8, 6, [0.8, 1.7, 0.8]))
    }
    for (const a of [0, 2.1, 4.2]) g.push(cyl(0.015, 0.015, APEX - cy + 0.3, [Math.cos(a) * R * 0.5, cy + (APEX - cy + 0.3) / 2, z + Math.sin(a) * R * 0.5], KIND.iron, 4))
  }
  const stone = new THREE.Mesh(merge(g), mat)
  stone.name = 'hall-shell'; stone.frustumCulled = false

  // ---- the five picture windows (one mesh, atlas texture, per-window gain) and their pick proxies
  const gl: THREE.BufferGeometry[] = [], proxies: THREE.Mesh[] = [], winC: THREE.Vector3[] = []
  for (let i = 0; i < 5; i++) {
    const xc = hallStopX(i), hw = WIN.w / 2
    const gg = new THREE.ShapeGeometry(shapeOf(lancetPts(hw, WIN.h)), 10)
    const pos = gg.getAttribute('position'), uv = gg.getAttribute('uv') as THREE.BufferAttribute, win = new Float32Array(pos.count).fill(i)
    for (let k = 0; k < pos.count; k++) { const px = pos.getX(k), py = pos.getY(k); uv.setXY(k, 0.5 - px / WIN.w, py / WIN.h); pos.setXYZ(k, xc + px, WIN.sill + py, L - 0.55) }
    gg.setAttribute('aWin', new THREE.BufferAttribute(win, 1)); gl.push(gg)
    // the hit area is the full lancet plus 20%
    const px = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w * 1.2, WIN.h * 1.2), new THREE.MeshBasicMaterial({ visible: false }))
    px.position.set(xc, WIN.sill + WIN.h / 2, L - 0.5); px.rotation.y = Math.PI; px.userData.win = i; px.name = 'hall-pick-' + i; proxies.push(px)
    winC.push(new THREE.Vector3(xc, WIN.sill + WIN.h * 0.55, L - 3.5))
  }
  const glass = new THREE.Mesh(merge2(gl), glassMat); glass.name = 'hall-glass'; glass.frustumCulled = false

  // ---- side panes: ornamental lancets between the shafts, six a side
  const sp: THREE.BufferGeometry[] = [], sf: THREE.BufferGeometry[] = []
  for (let j = 0; j < BAYS; j++) for (const sg of [-1, 1]) {
    const zc = (zs[j] + zs[j + 1]) / 2, hw = 1.05, h = 5.9
    const gg = new THREE.ShapeGeometry(shapeOf(lancetPts(hw, h)), 8), pos = gg.getAttribute('position'), uv = gg.getAttribute('uv') as THREE.BufferAttribute
    for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + hw) / (2 * hw), pos.getY(k) / h)
    xf(gg, [sg * (HW - 0.1), 2.7, zc], [0, -sg * Math.PI / 2, 0]); sp.push(tag(gg, KIND.glow))
    const outer = lancetPts(hw, h, 0.2), inner = lancetPts(hw, h, 0), s = shapeOf(outer), hole = new THREE.Path()
    hole.moveTo(inner[0].x, inner[0].y); for (const p of inner) hole.lineTo(p.x, p.y); hole.closePath(); s.holes.push(hole)
    sf.push(extrude(s, 0.16, 0.01, KIND.stone, [sg * (HW - 0.26), 2.7, zc], [0, -sg * Math.PI / 2, 0], 6))
  }
  const sideStone = merge(sf)
  const side = new THREE.Mesh(merge(sp), sideMat); side.name = 'hall-side'; side.frustumCulled = false
  stone.geometry = merge([stone.geometry, sideStone])
  return { stone, glass, side, proxies, winC }
}

/** merge geometries that carry only position / uv / aWin (the picture windows) */
function merge2(list0: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = list0.map(g => (g.index ? g.toNonIndexed() : g))
  let n = 0; for (const g of list) n += g.getAttribute('position').count
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), win = new Float32Array(n)
  let o = 0
  for (const g of list) {
    const p = g.getAttribute('position'), t = g.getAttribute('uv'), w = g.getAttribute('aWin')
    for (let i = 0; i < p.count; i++) { pos.set([p.getX(i), p.getY(i), p.getZ(i)], (o + i) * 3); uv.set([t.getX(i), t.getY(i)], (o + i) * 2); win[o + i] = w.getX(i) }
    o += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('aWin', new THREE.BufferAttribute(win, 1))
  out.computeBoundingSphere()
  return out
}
