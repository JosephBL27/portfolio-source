// Finishing for the 3D movement: procedural anisotropy maps (the direction a surface is brushed, three.js MeshPhysicalMaterial.anisotropyMap:
// RG = direction in tangent space, B = strength) for perlage, Côtes de Genève and circular graining; one "print" canvas in plate space for the
// ivory minute track, the seconds track round the tourbillon aperture, the power-reserve scale and the gold-filled bridge engraving (words only);
// and the metals: 18k gold, rhodium, ruthenium, polished and black-polished steel, heat-blued steel (thin-film iridescence), ruby, black lacquer.
// Every material is display-referred (common.ts lit()) and carries the shared studio PMREM itself (userData.ownEnv), turned to face the camera.
import * as THREE from 'three'
import { lit } from '../common'

const yieldNow = () => new Promise<void>(r => setTimeout(r, 0))
const fract = (x: number) => x - Math.floor(x)
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)

/** fill an RGBA anisotropy map row by row (yielding to the main thread every few rows), f(u, v) -> [angle, strength] with u, v in 0..1 */
async function anisoMap(size: number, f: (u: number, v: number) => [number, number]): Promise<THREE.DataTexture> {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [a, s] = f((x + 0.5) / size, (y + 0.5) / size), i = (y * size + x) * 4
      data[i] = Math.round((Math.cos(a) * 0.5 + 0.5) * 255); data[i + 1] = Math.round((Math.sin(a) * 0.5 + 0.5) * 255); data[i + 2] = Math.round(Math.max(0, Math.min(1, s)) * 255); data[i + 3] = 255
    }
    if ((y & 63) === 63) await yieldNow()
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** perlage: overlapping spots of circular graining on a staggered grid (spacing 24 units in the 1000-unit plate box), later spots over earlier ones */
export const perlageMap = (size = 1024) => {
  const S = 24 / 1000, R = 17 / 1000
  return anisoMap(size, (u, v) => {
    const gy = Math.round(v / (S * 0.86)), best = { k: -1, a: 0, s: 0 }
    for (let j = gy - 1; j <= gy + 1; j++) {
      const off = (j & 1) * 0.5, gx = Math.round(u / S - off)
      for (let i = gx - 1; i <= gx + 1; i++) {
        const cx = (i + off) * S, cy = j * S * 0.86, dx = u - cx, dy = v - cy, d = Math.hypot(dx, dy)
        const order = j * 4096 + i
        if (d < R && order > best.k) { best.k = order; best.a = Math.atan2(dy, dx) + Math.PI / 2; best.s = 0.55 + 0.45 * Math.abs(Math.sin((d / R) * 13 + hash(i, j) * 6)) }
      }
    }
    return [best.a, best.s]
  })
}
/** Côtes de Genève: parallel bands at 32 degrees, each brushed by a turning tool (arcs), a darker ridge where two bands overlap */
export const cotesMap = (size = 1024) => {
  const W = 30 / 1000, ang = (32 * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang)
  return anisoMap(size, (u, v) => {
    const x = (u - 0.5) * ca + (v - 0.5) * sa, y = -(u - 0.5) * sa + (v - 0.5) * ca
    const b = y / W, f = fract(b), along = x / W
    // inside a band the tool's arcs are centred a radius behind the band: direction bends from -0.55 to +0.55 rad across it
    const bend = (f - 0.5) * 1.1 + Math.sin(along * 0.4 + Math.floor(b)) * 0.05
    const ridge = Math.min(f, 1 - f)
    return [ang + bend, 0.5 + 0.5 * Math.min(1, ridge * 7)]
  })
}
/** circular graining around the centre of a part (uv 0.5, 0.5): the gold wheels, the ratchet's snailing, the barrel cover */
export const circularMap = (size = 512) => anisoMap(size, (u, v) => {
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy)
  return [Math.atan2(dy, dx) + Math.PI / 2, 0.6 + 0.4 * Math.abs(Math.sin(r * 160 + Math.sin(r * 23) * 2))]
})

// ------------------------------------------------------------------------------------------------ the print canvas (plate space, 1000 units)
export interface PrintSpec { cage: [number, number]; cageR: [number, number]; pr: [number, number]; prR: number; prSweep: number; words: { text: string; at: [number, number]; rot: number; size: number }[] }
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace'
const SERIF = '"Bodoni Moda Variable", "Bodoni Moda", Didot, serif'
/** ivory marks (emissive on lacquer and ruthenium) and gold-filled engraving (a colour map on the bridges, white elsewhere) */
export function printTextures(spec: PrintSpec, size = 2048): { ink: THREE.CanvasTexture; engrave: THREE.CanvasTexture } {
  const k = size / 1000, X = (x: number) => (x + 500) * k, Y = (y: number) => (500 - y) * k
  const ink = document.createElement('canvas'); ink.width = ink.height = size
  const g = ink.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size)
  g.strokeStyle = '#EDE6D6'; g.fillStyle = '#EDE6D6'; g.lineCap = 'butt'
  // minute track on the chapter ring (radius 408..450), a fine outer circle
  for (let i = 0; i < 60; i++) {
    const a = Math.PI / 2 - (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = big ? 412 : 430, r1 = 448
    g.lineWidth = (big ? 5.2 : 1.7) * k
    g.beginPath(); g.moveTo(X(r0 * Math.cos(a)), Y(r0 * Math.sin(a))); g.lineTo(X(r1 * Math.cos(a)), Y(r1 * Math.sin(a))); g.stroke()
  }
  g.lineWidth = 1.1 * k; g.beginPath(); g.arc(X(0), Y(0), 451 * k, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.arc(X(0), Y(0), 407 * k, 0, Math.PI * 2); g.stroke()
  // seconds track round the tourbillon aperture (ticks only)
  const [cx, cy] = spec.cage, [s0, s1] = spec.cageR
  for (let i = 0; i < 60; i++) {
    const a = Math.PI / 2 - (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = big ? s0 : s0 + (s1 - s0) * 0.45
    g.lineWidth = (big ? 2.6 : 1.1) * k
    g.beginPath(); g.moveTo(X(cx + r0 * Math.cos(a)), Y(cy + r0 * Math.sin(a))); g.lineTo(X(cx + s1 * Math.cos(a)), Y(cy + s1 * Math.sin(a))); g.stroke()
  }
  // power-reserve scale: an arc of ticks, UP at one end, DOWN at the other
  const [px, py] = spec.pr, R = spec.prR, sw = spec.prSweep
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + sw / 2 - (i / 12) * sw, big = i % 6 === 0
    g.lineWidth = (big ? 3 : 1.4) * k
    g.beginPath(); g.moveTo(X(px + (R - (big ? 15 : 9)) * Math.cos(a)), Y(py + (R - (big ? 15 : 9)) * Math.sin(a))); g.lineTo(X(px + R * Math.cos(a)), Y(py + R * Math.sin(a))); g.stroke()
  }
  g.lineWidth = 1 * k; g.beginPath(); g.arc(X(px), Y(py), R * k, -(Math.PI / 2 + sw / 2), -(Math.PI / 2 - sw / 2)); g.stroke()
  g.font = `600 ${12 * k}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  const lab = (t: string, a: number) => { const rr = R - 30; g.fillText(t, X(px + rr * Math.cos(a)), Y(py + rr * Math.sin(a))) }
  lab('UP', Math.PI / 2 - sw / 2 + 0.18); lab('DOWN', Math.PI / 2 + sw / 2 - 0.22)
  g.font = `italic 400 ${15 * k}px ${SERIF}`; g.fillText('reserve', X(px), Y(py - 22))
  const tex = new THREE.CanvasTexture(ink); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8

  // engraving: white field (the bridge's own colour), the letters gold-filled
  const en = document.createElement('canvas'); en.width = en.height = size
  const e = en.getContext('2d')!
  e.fillStyle = '#fff'; e.fillRect(0, 0, size, size)
  for (const w of spec.words) {
    e.save(); e.translate(X(w.at[0]), Y(w.at[1])); e.rotate(-w.rot)
    e.font = `600 ${w.size * k}px ${MONO}`; e.textAlign = 'center'; e.textBaseline = 'middle'
    // a dark cut edge, then the gold fill a hair up and left (the engraver's fill catches light on its top edge)
    e.fillStyle = '#3a2b12'; e.fillText(w.text, 0.6 * k, 0.8 * k)
    e.fillStyle = '#f3c76a'; e.fillText(w.text, 0, 0)
    e.restore()
  }
  const etex = new THREE.CanvasTexture(en); etex.colorSpace = THREE.SRGBColorSpace; etex.anisotropy = 8
  return { ink: tex, engrave: etex }
}

/** contact shadows baked in plate space: every bridge, wheel and dial casts a soft shadow down-right onto the plate (an aoMap: it darkens the
 *  studio's reflections where a real part would hide the room) */
export type AOShape = { pts: [number, number][]; blur: number; a: number } | { c: [number, number]; r: number; r0?: number; blur: number; a: number }
export function aoTexture(shapes: AOShape[], size = 1024): THREE.CanvasTexture {
  const k = size / 1000, X = (x: number) => (x + 500) * k, Y = (y: number) => (500 - y) * k
  const cv = document.createElement('canvas'); cv.width = cv.height = size
  const g = cv.getContext('2d')!
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size)
  const off = [6, -8]
  for (const s of shapes) {
    g.save(); g.filter = `blur(${(s.blur * k).toFixed(1)}px)`; g.fillStyle = `rgba(0,0,0,${s.a})`; g.beginPath()
    if ('pts' in s) { s.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x + off[0]), Y(y + off[1])) : g.moveTo(X(x + off[0]), Y(y + off[1])))); g.closePath(); g.fill() }
    else { g.arc(X(s.c[0] + off[0]), Y(s.c[1] + off[1]), s.r * k, 0, Math.PI * 2); if (s.r0) { g.arc(X(s.c[0] + off[0]), Y(s.c[1] + off[1]), s.r0 * k, 0, Math.PI * 2, true) } g.fill('evenodd') }
    g.restore()
  }
  // the chapter ring and the case wall shade the plate's rim
  g.save(); g.filter = `blur(${(16 * k).toFixed(1)}px)`; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 40 * k; g.beginPath(); g.arc(X(0), Y(0), 430 * k, 0, Math.PI * 2); g.stroke(); g.restore()
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace
  return t
}

// ------------------------------------------------------------------------------------------------ materials
export interface Mats { [k: string]: THREE.Material }
export function makeMats(o: { env: THREE.Texture; rotY: number; perl: THREE.Texture; cotes: THREE.Texture; circ: THREE.Texture; ink: THREE.Texture; engrave: THREE.Texture; ao: THREE.Texture }) {
  const list: THREE.Material[] = []
  const rot = new THREE.Euler(-0.12, o.rotY, 0)
  const own = <T extends THREE.MeshStandardMaterial>(m: T, k: number, key: string): T => {
    m.envMap = o.env; m.envMapIntensity = k; m.envMapRotation.copy(rot); m.userData.ownEnv = true
    lit(m, 'mv3-' + key); list.push(m); return m
  }
  const P = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)
  const gold = new THREE.Color(1.0, 0.68, 0.28), goldDeep = new THREE.Color(0.9, 0.56, 0.2)
  const m = {
    // 18k gold wheels: circular graining on the faces, mirror-polished flanks and chamfers
    goldFace: own(P({ color: gold, metalness: 1, roughness: 0.3, anisotropy: 0.8, anisotropyMap: o.circ }), 1.25, 'gold-face'),
    goldPolish: own(P({ color: goldDeep, metalness: 1, roughness: 0.07 }), 1.5, 'gold-polish'),
    // the barrel drum and the balance: warm gold, finer graining
    goldDrum: own(P({ color: new THREE.Color(0.95, 0.64, 0.26), metalness: 1, roughness: 0.22, anisotropy: 0.55, anisotropyMap: o.circ }), 1.3, 'gold-drum'),
    // rhodium bridges: Côtes de Genève on the faces (with the gold-filled engraving as a colour map), anglage polished to a mirror
    rhodFace: own(P({ color: new THREE.Color(0.56, 0.57, 0.6), metalness: 1, roughness: 0.32, anisotropy: 0.92, anisotropyMap: o.cotes, map: o.engrave }), 0.78, 'rhod-face'),
    rhodPolish: own(P({ color: new THREE.Color(0.9, 0.91, 0.93), metalness: 1, roughness: 0.03 }), 2.0, 'rhod-polish'),
    // smoked bronze-ruthenium main plate with perlage (warm, like the studio's champagne strips: the stop's grade is 'a hair warm', so warm metal keeps its colour);
    // the ivory print glows a little from inside (emissive), so it reads on the dark metal
    plate: own(P({ color: new THREE.Color(0.07, 0.056, 0.045), metalness: 1, roughness: 0.48, anisotropy: 0.92, anisotropyMap: o.perl, emissive: new THREE.Color(1, 1, 1), emissiveMap: o.ink, emissiveIntensity: 0.7, aoMap: o.ao, aoMapIntensity: 1 }), 0.85, 'plate'),
    plateEdge: own(P({ color: new THREE.Color(0.12, 0.12, 0.13), metalness: 1, roughness: 0.12 }), 1.0, 'plate-edge'),
    // black lacquer chapter ring and power-reserve dial, ivory print
    lacquer: own(P({ color: new THREE.Color(0.012, 0.012, 0.014), metalness: 0, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, emissive: new THREE.Color(1, 1, 1), emissiveMap: o.ink, emissiveIntensity: 0.9 }), 0.9, 'lacquer'),
    // steel: polished pinions and arbors, black-polished cage and escapement parts
    steel: own(P({ color: new THREE.Color(0.78, 0.79, 0.82), metalness: 1, roughness: 0.13 }), 1.35, 'steel'),
    steelBlack: own(P({ color: new THREE.Color(0.86, 0.87, 0.9), metalness: 1, roughness: 0.02 }), 1.5, 'steel-black'),
    // black polish: a perfect mirror that shows black where it faces the dark room, so only its bevels flash
    steelDark: own(P({ color: new THREE.Color(0.3, 0.31, 0.33), metalness: 1, roughness: 0.03 }), 0.8, 'steel-dark'),
    steelSatin: own(P({ color: new THREE.Color(0.66, 0.67, 0.7), metalness: 1, roughness: 0.3, anisotropy: 0.7, anisotropyMap: o.circ }), 1.25, 'steel-satin'),
    // heat-blued steel: a dark blue base, an oxide film that shifts toward violet and teal at grazing angles
    bluedBright: own(P({ color: new THREE.Color(0.02, 0.09, 0.62), metalness: 1, roughness: 0.2, iridescence: 0.2, iridescenceIOR: 2.0, iridescenceThicknessRange: [330, 430] }), 2.0, 'blued-bright'),
    blued: own(P({ color: new THREE.Color(0.006, 0.03, 0.36), metalness: 1, roughness: 0.14, iridescence: 0.22, iridescenceIOR: 2.0, iridescenceThicknessRange: [330, 430] }), 1.5, 'blued'),
    // ruby (corundum, ior 1.77): no transmission pass (it would redraw the scene); a glassy clearcoat over a deep red that lights itself a little
    ruby: own(P({ color: new THREE.Color(0.5, 0.004, 0.03), metalness: 0, roughness: 0.04, ior: 1.77, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, emissive: new THREE.Color(0.22, 0.0, 0.015), sheen: 0.4, sheenColor: new THREE.Color(1, 0.25, 0.3) }), 1.4, 'ruby'),
    // the case: polished white gold
    // the sapphire crystal: no body colour, only the studio's reflection added on top (see movement3d.ts); specular tinted toward an anti-reflective blue
    crystal: own(P({ color: new THREE.Color(0, 0, 0), metalness: 0, roughness: 0.02, ior: 1.5, specularIntensity: 1, specularColor: new THREE.Color(0.62, 0.78, 1.0), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }), 0.14, 'crystal'),
    case: own(P({ color: new THREE.Color(0.84, 0.84, 0.86), metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }), 1.3, 'case'),
    caseSatin: own(P({ color: new THREE.Color(0.74, 0.74, 0.76), metalness: 1, roughness: 0.24, anisotropy: 0.6, anisotropyMap: o.circ }), 1.2, 'case-satin'),
  }
  return { m, list }
}

/** the spring material (mainspring or hairspring): a flat ribbon placed in the vertex shader from (aU, aSide); uniforms are shared objects */
export function springMat(base: THREE.MeshPhysicalMaterial, key: string, glsl: string, uniforms: Record<string, THREE.IUniform>): THREE.MeshPhysicalMaterial {
  const m = base.clone()
  m.side = THREE.DoubleSide
  m.userData.ownEnv = true
  lit(m, 'mv3-spring-' + key, sh => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aU; attribute float aSide; attribute float aFix;\n${Object.keys(uniforms).map(k => `uniform float ${k};`).join('\n')}\n${glsl}`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = vec3(0.0, 0.0, 1.0); vec3 sp_p = position;\nif (aFix < 0.5) { vec3 sp_n; sp_p = springPos(aU, aSide, sp_n); objectNormal = sp_n; } else { objectNormal = normalize(vec3(0.0, 0.0, 1.0)); }\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = sp_p;')
  })
  return m
}
