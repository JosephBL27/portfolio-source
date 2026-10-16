// The front of the hall (unit 10H): a gothic portal in a gabled stone front. Stepped pointed archivolt of voussoirs on jamb colonnettes, a carved rose in the
// tympanum, two oak leaves with iron straps, studs and a ring (hinged, built to swing inward), a glowing rose in the gable, two lit lancets either side,
// buttresses with pinnacles, steps. Built in facade units (portal opening 2.5 wide), +z toward the visitor; the rig scales it by FACADE_K and turns it to the door.
import * as THREE from 'three'
import { KIND, box, cyl, extrude, lathe, merge, pointedArch, sph, stageMaterial as stageMat, tag, voussoirs, xf, type Shared, type MatOpts } from '../transitions/common'
import { laneSafe } from './material'
const stageMaterial = (sh: Shared, o?: MatOpts) => laneSafe(stageMat(sh, o))

export const HW = 1.25, YS = 2.9, RA = 2.1       // opening half width, spring line, arch radius
export const FW = 5.6, EH = 8.6, AP = 11.0       // wall half width, eaves, gable apex
export const ORD = 0.3
export const FACADE_K = 1.6
/** the wall's inner face sits at z = -0.75: the rig puts it on the hall's door plane */
export const WALL_BACK = -0.75

const lancet = (hw: number, h: number): THREE.Shape => {
  const R = hw * 1.9, rise = Math.sqrt(R * R - (R - hw) * (R - hw)), a = pointedArch(hw, h - rise, R, 0, 12).pts
  const s = new THREE.Shape(); s.moveTo(-hw, 0); s.lineTo(-hw, h - rise); for (const p of a) s.lineTo(p.x, p.y); s.lineTo(hw, 0); s.closePath(); return s
}

/** an oak leaf on iron straps, hinge at the origin, extending +x; `face` = which side carries the straps, studs, ring and boss (+1: +z, -1: -z). Details are laid out for the facade's 1.235 x 2.7 leaf and stretched to W x H (w11: the far doors reuse it). */
export function leafGeometry(W: number, H: number, face: 1 | -1 = 1): THREE.BufferGeometry {
  const T = 0.14, kx = W / 1.235, ky = H / 2.7
  const leafParts: THREE.BufferGeometry[] = [box(W, H, T, [W / 2, H / 2, 0], KIND.wood, undefined, 0.012)]
  const sd = face * (T / 2 + 0.014)
  for (const y0 of [0.42, 1.32, 2.22]) {
    const y = y0 * ky
    leafParts.push(box(W * 0.94, 0.15, 0.028, [W * 0.47, y, sd], KIND.iron, undefined, 0.006))
    leafParts.push(box(0.18, 0.2, 0.03, [W * 0.94 + 0.02, y, sd], KIND.iron, [0, 0, Math.PI / 4], 0.004))
    leafParts.push(cyl(0.085, 0.085, 0.032, [0.09, y, sd], KIND.iron, 10, [Math.PI / 2, 0, 0]))
    for (let i = 0; i < 6; i++) leafParts.push(sph(0.027, [(0.25 + i * 0.185) * kx, y, sd + face * 0.012], KIND.iron, 7, 5, [1, 1, 0.6]))
    leafParts.push(box(W * 0.94, 0.15, 0.028, [W * 0.47, y, -sd], KIND.iron, undefined, 0.006))
  }
  leafParts.push(box(0.08, H, 0.028, [W - 0.05, H / 2, sd], KIND.iron, undefined, 0.005))
  leafParts.push(box(0.08, H, 0.028, [0.05, H / 2, sd], KIND.iron, undefined, 0.005))
  const nS = Math.round(10 * ky)
  for (let i = 0; i < nS; i++) { const y = 0.18 + i * ((H - 0.3) / Math.max(1, nS - 1)); leafParts.push(sph(0.024, [W - 0.05, y, sd + face * 0.012], KIND.iron, 7, 5, [1, 1, 0.6])); leafParts.push(sph(0.024, [0.05, y, sd + face * 0.012], KIND.iron, 7, 5, [1, 1, 0.6])) }
  leafParts.push(cyl(0.12, 0.13, 0.04, [W - 0.2, 1.3 * ky, sd + face * 0.02], KIND.brass, 16, [Math.PI / 2, 0, 0]))
  leafParts.push(tag(xf(new THREE.TorusGeometry(0.115, 0.017, 8, 20), [W - 0.2, 1.17 * ky, sd + face * 0.07], [0.2 * face, 0, 0]), KIND.iron))
  return merge(leafParts)
}

/** a thin vertical light seam (additive): a hard core with a soft halo. Quad lives in x -w/2..w/2, y 0..h. */
export const SEAM_F = /* glsl */ `
precision highp float; uniform float uI; uniform vec3 uCol; varying vec2 vUv;
void main() { float x = abs(vUv.x - 0.5) * 2.0; float core = exp(-x * x * 120.0), halo = exp(-x * x * 7.0) * 0.2;
  float v = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y)); float a = (core + halo) * v * uI; gl_FragColor = vec4(uCol * a, a); }`
export const SEAM_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
export function seamMaterial(col: [number, number, number]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: SEAM_V, fragmentShader: SEAM_F, uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(col[0], col[1], col[2]) } }, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
}

export function buildFacade(sh: Shared): { stone: THREE.Mesh; leafL: THREE.Group; leafR: THREE.Group; steps: THREE.Mesh; glow: THREE.Mesh } {
  const stone: THREE.BufferGeometry[] = []
  // ---- wall with the pointed passage cut through it, gable on top
  {
    const s = new THREE.Shape()
    s.moveTo(-FW, -0.5); s.lineTo(FW, -0.5); s.lineTo(FW, EH); s.lineTo(0, AP); s.lineTo(-FW, EH); s.closePath()
    const hole = new THREE.Path(), a = pointedArch(HW, YS, RA, 0, 12).pts
    hole.moveTo(-HW, -0.5); hole.lineTo(-HW, YS); for (const p of a) hole.lineTo(p.x, p.y); hole.lineTo(HW, -0.5); hole.closePath()
    s.holes.push(hole)
    stone.push(extrude(s, 0.6, 0.02, KIND.stone, [0, 0, -0.75], [0, 0, 0], 8))
  }
  // ---- the archivolt: three orders of voussoirs, jamb stones, colonnettes with bases and capitals
  const front = [0.12, 0.36, 0.6]
  for (let k = 0; k < 3; k++) {
    const r0 = RA + ORD * k, r1 = RA + ORD * (k + 1)
    for (const g of voussoirs(HW, YS, RA, r0, r1, -0.7, front[k], 8, KIND.stone)) stone.push(g)
    for (const sgn of [-1, 1]) {
      const x0 = HW + ORD * k, x1 = HW + ORD * (k + 1), cx = sgn * (x0 + x1) / 2, n = 6, h = YS / n
      for (let j = 0; j < n; j++) stone.push(box(ORD - 0.012, h - 0.014, front[k] + 0.7 - 0.01, [cx, h * (j + 0.5), (front[k] - 0.7) / 2], KIND.stone, undefined, 0.012))
      const colR = 0.062, colX = sgn * (x1 - 0.085)
      stone.push(cyl(colR, colR, YS - 0.22, [colX, 0.12 + (YS - 0.22) / 2, front[k] - 0.03], KIND.stone, 12))
      stone.push(lathe([[0.001, 0], [0.12, 0], [0.12, 0.05], [0.085, 0.09], [0.07, 0.12], [0.001, 0.12]], [colX, 0, front[k] - 0.03], KIND.stone, 12))
      stone.push(lathe([[0.001, 0], [0.065, 0], [0.075, 0.05], [0.11, 0.1], [0.12, 0.17], [0.001, 0.17]], [colX, YS - 0.1, front[k] - 0.03], KIND.stone, 12))
    }
  }
  for (const g of voussoirs(HW, YS, RA, RA + ORD * 3, RA + ORD * 3 + 0.1, -0.7, 0.68, 14, KIND.stone)) stone.push(g)
  // ---- buttresses: four setbacks and a pinnacle either side, and a string course across the front
  for (const sgn of [-1, 1]) {
    const x = sgn * (FW + 0.3)
    stone.push(box(1.0, 2.4, 1.9, [x, 0.7, 0.1], KIND.stone, undefined, 0.03))
    stone.push(box(0.86, 2.3, 1.7, [x, 3.0, 0.0], KIND.stone, undefined, 0.03))
    stone.push(box(0.72, 2.3, 1.5, [x, 5.3, -0.1], KIND.stone, undefined, 0.03))
    stone.push(box(0.6, 2.3, 1.3, [x, 7.6, -0.2], KIND.stone, undefined, 0.03))
    stone.push(box(0.74, 0.14, 0.9, [x, 8.85, -0.2], KIND.stone, undefined, 0.02))
    stone.push(cyl(0.02, 0.4, 1.9, [x, 9.9, -0.2], KIND.stone, 4, [0, Math.PI / 4, 0]))
    stone.push(sph(0.08, [x, 10.9, -0.2], KIND.stone, 8, 6))
    for (let c = 0; c < 4; c++) stone.push(sph(0.055, [x + Math.cos(c * Math.PI / 2) * 0.18, 9.3, -0.2 + Math.sin(c * Math.PI / 2) * 0.18], KIND.stone, 6, 5))
  }
  stone.push(box(2 * FW + 0.2, 0.16, 0.5, [0, 5.9, -0.2], KIND.stone, undefined, 0.02))
  stone.push(box(2 * FW + 0.2, 0.16, 0.5, [0, EH - 0.4, -0.2], KIND.stone, undefined, 0.02))
  // ---- plinth, steps, lintel, the carved tympanum
  stone.push(box(2 * FW + 1.8, 0.7, 2.7, [0, -0.35, 0.3], KIND.stone, undefined, 0.03))
  const stepG: THREE.BufferGeometry[] = []
  for (let j = 1; j <= 3; j++) stepG.push(box(5.4 + 0.5 * j, 0.19, 0.62, [0, -0.7 + 0.19 * (4 - j) - 0.095, 1.65 + 0.5 * j - 0.18], KIND.stone, undefined, 0.02))
  stone.push(box(HW * 2 + 0.1, 0.22, 0.34, [0, YS - 0.11, -0.45], KIND.stone, undefined, 0.02))
  {
    const sp = pointedArch(HW, YS, RA, 0, 12).pts
    const t = new THREE.Shape(); t.moveTo(-HW, YS); for (const p of sp) t.lineTo(p.x, p.y); t.lineTo(HW, YS); t.closePath()
    stone.push(extrude(t, 0.16, 0.012, KIND.carved, [0, 0, -0.52], [0, 0, 0], 8))
  }
  // ---- the glow: a rose in the gable and two lancets either side of the portal (lit from the hall behind), each in a stone frame
  const glow: THREE.BufferGeometry[] = []
  {
    const rose = new THREE.CircleGeometry(1.25, 40), uv = rose.getAttribute('uv') as THREE.BufferAttribute, pos = rose.getAttribute('position')
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2.5 + 0.5, pos.getY(i) / 2.5 + 0.5)
    glow.push(tag(xf(rose, [0, 7.35, -0.12]), KIND.glow))
    stone.push(tag(xf(new THREE.TorusGeometry(1.3, 0.1, 8, 40), [0, 7.35, -0.12]), KIND.stone))
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; stone.push(box(0.05, 1.2, 0.07, [Math.cos(a) * 0.62, 7.35 + Math.sin(a) * 0.62, -0.1], KIND.stone, [0, 0, a - Math.PI / 2], 0.01)) }
    stone.push(tag(xf(new THREE.TorusGeometry(0.34, 0.06, 8, 24), [0, 7.35, -0.1]), KIND.stone))
    for (const sgn of [-1, 1]) {
      const gg = new THREE.ShapeGeometry(lancet(0.62, 4.4), 8), p2 = gg.getAttribute('position'), u2 = gg.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < p2.count; i++) u2.setXY(i, (p2.getX(i) + 0.62) / 1.24, p2.getY(i) / 4.4)
      glow.push(tag(xf(gg, [sgn * 3.9, 1.1, -0.12]), KIND.glow))
      const outer = lancet(0.62 + 0.14, 4.4 + 0.14), hole = new THREE.Path(), inner = lancet(0.62, 4.4).getPoints(12)
      hole.moveTo(inner[0].x, inner[0].y); for (const p of inner) hole.lineTo(p.x, p.y); hole.closePath(); outer.holes.push(hole)
      stone.push(extrude(outer, 0.16, 0.01, KIND.stone, [sgn * 3.9, 1.0, -0.2], [0, 0, 0], 8))
    }
  }
  const stoneMesh = new THREE.Mesh(merge(stone), stageMaterial(sh, { tint: 0xc4b497 })); stoneMesh.name = 'hall-facade'
  const glowMesh = new THREE.Mesh(merge(glow), stageMaterial(sh, { side: THREE.DoubleSide })); glowMesh.name = 'hall-facade-glow'

  // ---- the leaves: oak, iron straps, studs, a ring and a boss; built hinge-at-origin for the left leaf, the right is its mirror
  const W = HW - 0.015, H = YS - 0.2
  const leafGeo = leafGeometry(W, H, 1)
  const mkLeaf = (sgn: number) => {
    const g = new THREE.Group(), m = new THREE.Mesh(leafGeo, stageMaterial(sh, { tint: 0x8a6a48 }))
    m.name = 'hall-leaf'; g.add(m); g.position.set(sgn * HW, 0, -0.48); g.scale.x = -sgn
    return g
  }
  const steps = new THREE.Mesh(merge(stepG), stageMaterial(sh, { tint: 0xb2a488 })); steps.name = 'hall-steps'
  return { stone: stoneMesh, leafL: mkLeaf(-1), leafR: mkLeaf(1), steps, glow: glowMesh }
}
