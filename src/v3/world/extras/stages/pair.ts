// STAGE "pair" (Shopping Together or Searching Separately?). Style: a cut-paper collage, flat and printed, after the reference reels' halftone
// cut-outs. Shopping bags, price tags, a T-shirt on a hanger, a receipt, a magnifying glass and two silhouettes (the pair) are each their own
// card: a paper silhouette with a halftone-screened fill, a cream cut border, and a soft drop shadow that tightens as the card lands. The cards
// fly in from the edges and slap down one after another on a cream board held by tape; they leave the same way, swept off in turn.
// No findings and no numbers (the study is a design: its estimates are not presented as results). The look is drawn entirely in code.
//   entrance  cards arrive in order, easing out with a little overshoot and a slap (shadow snaps tight, a hair of squash)
//   exit      the cards are swept off the board in the reverse order, spinning; the board goes last
import * as THREE from 'three'
import { canvasTex, clamp01, easeInCubic, easeOutBack, easeOutCubic, lit, rayPlaneLocal, sstep, stageTip, tryMark, type StageBuildCtx, type StageDef, type StageFrame } from './common'

const CREAM = '#f4eddc', INK = '#1b1712'
const TEAL = '#7fd1c7', TEAL_D = '#3a9a8e', CORAL = '#f2755c', CORAL_D = '#b8472f', MUST = '#f2b441', MUST_D = '#c0841a'
const DENIM = '#4b6a8c', DENIM_D = '#27405c', SAGE = '#a8c09a', SAGE_D = '#5f8258', KRAFT = '#cfa56f', KRAFT_D = '#94703f'
const SKIN_A = '#e8b894', SKIN_B = '#a8704e'
const PAD = 16, BORDER = 5

type G = CanvasRenderingContext2D
type Painter = (g: G, u: number) => void
interface Spec { id: string; w: number; h: number; paint: Painter; x: number; y: number; rot: number; start: [number, number]; spin: number; border?: boolean; shadow?: number; flutter?: number; alpha?: number }

// ---------------------------------------------------------------------------------------------------------------- halftone helpers
/** dots on a rotated grid across [-ext, ext]^2 in the current (clipped) space; radius from rFn(x, y) in px (<= 0: no dot) */
function dots(g: G, ext: number, pitch: number, ang: number, color: string, rFn: (x: number, y: number) => number) {
  g.save(); g.fillStyle = color; g.rotate(ang)
  const n = Math.ceil(ext / pitch) + 1
  g.beginPath()
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const x = i * pitch + (j & 1 ? pitch / 2 : 0), y = j * pitch * 0.866
    // rFn works in unrotated space: rotate the point back
    const c = Math.cos(ang), s = Math.sin(ang), ux = x * c - y * s, uy = x * s + y * c
    const r = rFn(ux, uy); if (r > 0.35) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832) }
  }
  g.fill(); g.restore()
}
/** linear ramp 0..1 from point a to b */
const ramp = (ax: number, ay: number, bx: number, by: number) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; return (x: number, y: number) => clamp01(((x - ax) * dx + (y - ay) * dy) / l2) }
const shade = (g: G, path: Path2D, base: string, dark: string, u: number, a: [number, number], b: [number, number], pitch = 0.07, amount = 0.62, ang = 0.5) => {
  g.fillStyle = base; g.fill(path)
  g.save(); g.clip(path)
  const t = ramp(a[0] * u, a[1] * u, b[0] * u, b[1] * u)
  dots(g, 4 * u, pitch * u, ang, dark, (x, y) => pitch * u * 0.5 * amount * 1.5 * Math.pow(t(x, y), 1.1))
  g.restore()
}
const P = (u: number, f: (p: Path2D, s: (v: number) => number) => void) => { const p = new Path2D(); f(p, v => v * u); return p }

// ---------------------------------------------------------------------------------------------------------------- painters (centred on the origin, y down, 1 unit = u px)
const flower: Painter = (g, u) => {
  g.fillStyle = TEAL
  for (let k = 1; k <= 11; k++) {
    const R = k * 0.19, n = Math.floor((Math.PI * 2 * R) / 0.105)
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2, petal = 0.35 + 0.65 * Math.pow(Math.abs(Math.cos(th * 4 + k * 0.2)), 1.5)
      const r = 0.052 * petal * (1 - (k / 12) * 0.5)
      g.beginPath(); g.arc(Math.cos(th) * R * u, Math.sin(th) * R * u, r * u, 0, 6.2832); g.fill()
    }
  }
}
const sun: Painter = (g, u) => {
  const p = P(u, (p, s) => { const n = 18; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 0.86 : 1.0; i ? p.lineTo(Math.cos(a) * s(r), Math.sin(a) * s(r)) : p.moveTo(s(r), 0) } p.closePath() })
  shade(g, p, MUST, MUST_D, u, [-0.4, -0.5], [0.8, 0.9], 0.075, 0.9)
}
function person(coat: string, coatD: string, hair: string, skin: string, kind: 'a' | 'b'): Painter {
  return (g, u) => {
    const body = P(u, (p, s) => {
      p.moveTo(s(-0.4), s(-0.78)); p.quadraticCurveTo(s(0), s(-0.9), s(0.4), s(-0.78))                  // shoulders
      p.lineTo(s(0.52), s(0.62)); p.lineTo(s(-0.52), s(0.62)); p.closePath()                             // coat
      p.rect(s(-0.36), s(0.6), s(0.27), s(0.95)); p.rect(s(0.09), s(0.6), s(0.27), s(0.95))                // legs
    })
    shade(g, body, coat, coatD, u, [-0.45, -0.7], [0.55, 0.65], 0.07, 0.9, 0.5)
    // shoes
    g.fillStyle = INK; g.beginPath(); g.roundRect(-0.4 * u, 1.46 * u, 0.33 * u, 0.12 * u, 0.05 * u); g.roundRect(0.07 * u, 1.46 * u, 0.33 * u, 0.12 * u, 0.05 * u); g.fill()
    // neck, head
    g.fillStyle = skin; g.beginPath(); g.roundRect(-0.07 * u, -0.98 * u, 0.14 * u, 0.2 * u, 0.04 * u); g.fill()
    g.beginPath(); g.ellipse(0, -1.14 * u, 0.2 * u, 0.24 * u, 0, 0, 6.2832); g.fill()
    // hair
    g.fillStyle = hair; g.beginPath()
    if (kind === 'a') { g.moveTo(-0.24 * u, -1.1 * u); g.quadraticCurveTo(-0.3 * u, -1.52 * u, 0.02 * u, -1.46 * u); g.quadraticCurveTo(0.3 * u, -1.46 * u, 0.24 * u, -1.0 * u); g.quadraticCurveTo(0.12 * u, -1.22 * u, -0.06 * u, -1.26 * u); g.quadraticCurveTo(-0.2 * u, -1.2 * u, -0.24 * u, -1.1 * u) }
    else { g.moveTo(-0.22 * u, -1.15 * u); g.quadraticCurveTo(-0.2 * u, -1.48 * u, 0.04 * u, -1.46 * u); g.quadraticCurveTo(0.26 * u, -1.46 * u, 0.22 * u, -1.15 * u); g.quadraticCurveTo(0.1 * u, -1.28 * u, -0.22 * u, -1.15 * u) }
    g.fill()
    // arms
    g.strokeStyle = coat; g.lineCap = 'round'; g.lineWidth = 0.17 * u
    g.beginPath(); g.moveTo(-0.4 * u, -0.7 * u); g.lineTo(kind === 'a' ? -0.52 * u : -0.5 * u, 0.1 * u); g.stroke()
    g.beginPath(); g.moveTo(0.4 * u, -0.7 * u); g.lineTo(kind === 'a' ? 0.5 * u : 0.62 * u, kind === 'a' ? 0.1 * u : -0.3 * u); g.stroke()
    g.fillStyle = skin; g.beginPath(); g.arc(kind === 'a' ? -0.52 * u : -0.5 * u, 0.14 * u, 0.085 * u, 0, 6.2832); g.arc(kind === 'a' ? 0.5 * u : 0.62 * u, kind === 'a' ? 0.14 * u : -0.34 * u, 0.085 * u, 0, 6.2832); g.fill()
    // a scarf for the second figure
    if (kind === 'b') { g.fillStyle = MUST; g.beginPath(); g.roundRect(-0.28 * u, -0.9 * u, 0.56 * u, 0.15 * u, 0.06 * u); g.fill(); g.beginPath(); g.roundRect(0.1 * u, -0.8 * u, 0.15 * u, 0.4 * u, 0.05 * u); g.fill() }
  }
}
function bag(color: string, dark: string, mark: string): Painter {
  return (g, u) => {
    // handles first (behind)
    g.strokeStyle = INK; g.lineWidth = 0.05 * u; g.lineCap = 'round'
    for (const x of [-0.2, 0.2]) { g.beginPath(); g.moveTo(x * u, -0.45 * u); g.bezierCurveTo((x - 0.22) * u, -0.95 * u, (x + 0.22) * u, -0.95 * u, x * u, -0.45 * u); g.stroke() }
    const body = P(u, (p, s) => { p.moveTo(s(-0.52), s(-0.5)); p.lineTo(s(0.52), s(-0.5)); p.lineTo(s(0.58), s(0.7)); p.lineTo(s(-0.58), s(0.7)); p.closePath() })
    shade(g, body, color, dark, u, [-0.5, -0.4], [0.6, 0.7], 0.06, 0.95, 0.4)
    g.fillStyle = dark; g.fillRect(-0.52 * u, -0.5 * u, 1.04 * u, 0.1 * u)                      // folded top band
    g.fillStyle = CREAM; g.beginPath(); g.arc(0, 0.1 * u, 0.2 * u, 0, 6.2832); g.fill()          // a mark, no words
    g.fillStyle = mark; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.2832 - 1.5708, r = i % 2 ? 0.07 : 0.15; g.lineTo(Math.cos(a) * r * u, 0.1 * u + Math.sin(a) * r * u) } g.closePath(); g.fill()
  }
}
function tag(color: string, dark: string): Painter {
  return (g, u) => {
    g.strokeStyle = INK; g.lineWidth = 0.025 * u; g.lineCap = 'round'
    g.beginPath(); g.moveTo(0, -0.5 * u); g.bezierCurveTo(0.3 * u, -0.9 * u, 0.7 * u, -0.7 * u, 0.55 * u, -1.1 * u); g.stroke()      // string
    const p = P(u, (p, s) => { p.moveTo(s(-0.3), s(-0.3)); p.lineTo(s(-0.12), s(-0.52)); p.lineTo(s(0.12), s(-0.52)); p.lineTo(s(0.3), s(-0.3)); p.lineTo(s(0.3), s(0.5)); p.lineTo(s(-0.3), s(0.5)); p.closePath() })
    shade(g, p, color, dark, u, [-0.3, -0.4], [0.3, 0.55], 0.055, 0.9, 0.7)
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, -0.37 * u, 0.055 * u, 0, 6.2832); g.fill(); g.restore()
    g.fillStyle = 'rgba(27,23,18,0.78)'; for (const [y, w] of [[0.0, 0.34], [0.14, 0.24], [0.28, 0.3]] as const) { g.beginPath(); g.roundRect(-0.17 * u, y * u - 0.02 * u, w * u, 0.04 * u, 0.02 * u); g.fill() }
  }
}
const tee: Painter = (g, u) => {
  // hanger
  g.strokeStyle = INK; g.lineWidth = 0.04 * u; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(0, -0.62 * u); g.bezierCurveTo(0, -0.84 * u, 0.14 * u, -0.9 * u, 0.14 * u, -1.0 * u); g.bezierCurveTo(0.14 * u, -1.12 * u, 0.0, -1.14 * u, -0.08 * u, -1.06 * u); g.stroke()
  g.beginPath(); g.moveTo(-0.62 * u, -0.34 * u); g.lineTo(0, -0.62 * u); g.lineTo(0.62 * u, -0.34 * u); g.stroke()
  const p = P(u, (p, s) => {
    p.moveTo(s(-0.2), s(-0.5)); p.lineTo(s(-0.62), s(-0.32)); p.lineTo(s(-0.74), s(-0.02)); p.lineTo(s(-0.48), s(0.1)); p.lineTo(s(-0.42), s(-0.06)); p.lineTo(s(-0.42), s(0.62))
    p.lineTo(s(0.42), s(0.62)); p.lineTo(s(0.42), s(-0.06)); p.lineTo(s(0.48), s(0.1)); p.lineTo(s(0.74), s(-0.02)); p.lineTo(s(0.62), s(-0.32)); p.lineTo(s(0.2), s(-0.5))
    p.quadraticCurveTo(s(0), s(-0.28), s(-0.2), s(-0.5)); p.closePath()
  })
  shade(g, p, SAGE, SAGE_D, u, [-0.5, -0.5], [0.6, 0.65], 0.065, 0.9, 0.3)
  g.fillStyle = CREAM; for (const y of [0.18, 0.3]) { g.fillRect(-0.42 * u, y * u, 0.84 * u, 0.045 * u) }
}
const receipt: Painter = (g, u) => {
  const p = P(u, (p, s) => { p.moveTo(s(-0.4), s(-0.9)); p.lineTo(s(0.4), s(-0.9)); p.lineTo(s(0.4), s(0.9)); for (let i = 0; i < 8; i++) { p.lineTo(s(0.4 - (i + 0.5) * 0.1), s(0.9 + (i % 2 ? 0 : 0.07))) } ; p.lineTo(s(-0.4), s(0.9)); p.closePath() })
  g.fillStyle = '#fbf7ec'; g.fill(p)
  g.save(); g.clip(p)
  dots(g, 3 * u, 0.06 * u, 0.4, 'rgba(120,100,70,0.35)', (x, y) => 0.03 * u * clamp01((x + 0.4 * u) / (0.8 * u)) + 0 * y)
  g.fillStyle = 'rgba(27,23,18,0.78)'
  let y = -0.72
  for (const w of [0.56, 0.4, 0.62, 0.3, 0.5, 0.44, 0.58, 0.36]) { g.fillRect(-0.3 * u, y * u, w * u, 0.04 * u); y += 0.13 }
  g.fillStyle = INK; for (let i = 0; i < 18; i++) g.fillRect((-0.28 + i * 0.032) * u, 0.5 * u, (i % 3 ? 0.012 : 0.022) * u, 0.26 * u)
  g.restore()
}
const star = (color: string): Painter => (g, u) => {
  g.fillStyle = color; g.beginPath()
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832 - 1.5708, r = i % 2 ? 0.1 : 0.34; g.lineTo(Math.cos(a) * r * u, Math.sin(a) * r * u) }
  g.closePath(); g.fill()
}
const magnifier: Painter = (g, u) => {
  g.lineCap = 'round'
  g.strokeStyle = INK; g.lineWidth = 0.13 * u; g.beginPath(); g.moveTo(0.22 * u, 0.22 * u); g.lineTo(0.62 * u, 0.62 * u); g.stroke()
  g.fillStyle = 'rgba(127,209,199,0.55)'; g.beginPath(); g.arc(-0.1 * u, -0.1 * u, 0.36 * u, 0, 6.2832); g.fill()
  g.strokeStyle = MUST; g.lineWidth = 0.1 * u; g.beginPath(); g.arc(-0.1 * u, -0.1 * u, 0.36 * u, 0, 6.2832); g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.035 * u; g.beginPath(); g.arc(-0.1 * u, -0.1 * u, 0.24 * u, 3.6, 4.5); g.stroke()
}
const tape: Painter = (g, u) => {
  g.fillStyle = 'rgba(226,206,160,0.78)'; g.beginPath(); g.moveTo(-0.42 * u, -0.13 * u)
  for (let i = 0; i <= 8; i++) g.lineTo((-0.42 + i * 0.105) * u, (i % 2 ? -0.15 : -0.12) * u)
  g.lineTo(0.42 * u, 0.13 * u); for (let i = 8; i >= 0; i--) g.lineTo((-0.42 + i * 0.105) * u, (i % 2 ? 0.15 : 0.12) * u); g.closePath(); g.fill()
}
const board: Painter = (g, u) => {
  g.fillStyle = '#ece3cd'; g.beginPath(); g.roundRect(-2.75 * u, -2.25 * u, 5.5 * u, 4.5 * u, 0.06 * u); g.fill()
  g.save(); g.clip()
  const edge = (x: number, y: number) => { const dx = Math.max(0, Math.abs(x) / u - 2.0), dy = Math.max(0, Math.abs(y) / u - 1.5); return Math.hypot(dx, dy) }
  dots(g, 4 * u, 0.09 * u, 0.26, 'rgba(160,130,90,0.34)', (x, y) => 0.045 * u * clamp01(edge(x, y) / 0.7))
  g.restore()
}

export default {
  id: 'pair',
  build(c: StageBuildCtx) {
    const { phone, view } = c
    const root = new THREE.Group()
    const az = Math.atan2(view.dir.x, view.dir.z), elev = Math.asin(THREE.MathUtils.clamp(view.dir.y, -1, 1))
    const face = new THREE.Group(); face.rotation.set(-elev, az, 0, 'YXZ'); root.add(face)             // the board faces the camera
    const U = phone ? 100 : 150
    const SPECS: Spec[] = [
      { id: 'board', w: 5.5, h: 4.5, paint: board, x: 0, y: 0, rot: -0.02, start: [0, -7], spin: 0.05, border: false, shadow: 0.55 },
      { id: 'flower', w: 4.2, h: 4.2, paint: flower, x: -0.9, y: 0.25, rot: 0, start: [-6, 0], spin: 0.8, border: false, shadow: 0, flutter: 0 },
      { id: 'sun', w: 2.2, h: 2.2, paint: sun, x: -0.9, y: 0.45, rot: 0.1, start: [0, 6], spin: -1.2 },
      { id: 'figA', w: 1.4, h: 3.3, paint: person(CORAL, CORAL_D, INK, SKIN_A, 'a'), x: -1.5, y: -0.25, rot: -0.03, start: [-7, -3], spin: -0.5 },
      { id: 'figB', w: 1.6, h: 3.3, paint: person(DENIM, DENIM_D, '#3b2a1f', SKIN_B, 'b'), x: -0.35, y: -0.15, rot: 0.03, start: [7, -2], spin: 0.5 },
      { id: 'lens', w: 1.3, h: 1.3, paint: magnifier, x: 0.5, y: 0.75, rot: 0.2, start: [6, 4], spin: 2.2 },
      { id: 'bagC', w: 1.5, h: 2.1, paint: bag(CORAL, CORAL_D, MUST), x: 1.55, y: -1.0, rot: -0.15, start: [7, -5], spin: -0.9 },
      { id: 'bagK', w: 1.5, h: 2.1, paint: bag(KRAFT, KRAFT_D, INK), x: 0.75, y: -1.2, rot: 0.12, start: [-2, -7], spin: 0.8 },
      { id: 'tagM', w: 1.1, h: 1.9, paint: tag(MUST, MUST_D), x: 0.75, y: 1.35, rot: 0.34, start: [3, 7], spin: 1.6 },
      { id: 'tagT', w: 1.1, h: 1.9, paint: tag(TEAL, TEAL_D), x: 2.15, y: 0.45, rot: -0.25, start: [8, 1], spin: -1.4 },
      { id: 'tee', w: 1.8, h: 2.2, paint: tee, x: 1.75, y: 1.45, rot: 0.08, start: [7, 6], spin: 0.6 },
      { id: 'rcpt', w: 1.0, h: 2.1, paint: receipt, x: -2.2, y: 0.35, rot: -0.1, start: [-8, 2], spin: -1.1 },
      { id: 's1', w: 0.8, h: 0.8, paint: star(MUST), x: -2.15, y: 1.65, rot: 0.2, start: [-6, 6], spin: 3 },
      { id: 's2', w: 0.8, h: 0.8, paint: star(INK), x: 0.15, y: 1.85, rot: -0.2, start: [0, 8], spin: -3 },
      { id: 's3', w: 0.8, h: 0.8, paint: star(TEAL_D), x: 2.4, y: -1.55, rot: 0.1, start: [8, -6], spin: 3 },
      { id: 'tp1', w: 1.0, h: 0.4, paint: tape, x: -2.5, y: 1.9, rot: 0.7, start: [-5, 6], spin: 1, border: false, shadow: 0.25, flutter: 0 },
      { id: 'tp2', w: 1.0, h: 0.4, paint: tape, x: 2.5, y: 1.9, rot: -0.7, start: [5, 6], spin: -1, border: false, shadow: 0.25, flutter: 0 },
      { id: 'tp3', w: 1.0, h: 0.4, paint: tape, x: -2.5, y: -1.9, rot: -0.7, start: [-5, -6], spin: -1, border: false, shadow: 0.25, flutter: 0 },
      { id: 'tp4', w: 1.0, h: 0.4, paint: tape, x: 2.5, y: -1.9, rot: 0.7, start: [5, -6], spin: 1, border: false, shadow: 0.25, flutter: 0 },
    ]
    interface Card { spec: Spec; grp: THREE.Group; mesh: THREE.Mesh; shadow: THREE.Mesh | null; delay: number; leave: number; ph: number; out: [number, number]; alpha: CanvasRenderingContext2D; cw: number; ch: number; ox: number; oy: number; vx: number; vy: number; hov: number; grabbed: boolean; ro: number }
    const cards: Card[] = []
    SPECS.forEach((spec, i) => {
      const cw = Math.ceil(spec.w * U + 2 * PAD), ch = Math.ceil(spec.h * U + 2 * PAD)
      const art = document.createElement('canvas'); art.width = cw; art.height = ch
      const ag = art.getContext('2d', { willReadFrequently: true })!; ag.translate(cw / 2, ch / 2); spec.paint(ag, U)
      let finalCanvas = art
      if (spec.border !== false) {
        const out = document.createElement('canvas'); out.width = cw; out.height = ch
        const og = out.getContext('2d', { willReadFrequently: true })!
        for (let k = 0; k < 20; k++) { const a = (k / 20) * 6.2832; og.drawImage(art, Math.cos(a) * BORDER, Math.sin(a) * BORDER) }
        og.globalCompositeOperation = 'source-in'; og.fillStyle = CREAM; og.fillRect(0, 0, cw, ch)
        og.globalCompositeOperation = 'source-over'; og.drawImage(art, 0, 0)
        finalCanvas = out
      }
      const tex = new THREE.CanvasTexture(finalCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter
      const wU = cw / U, hU = ch / U
      const mat = lit(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: 0.03, color: 0xe6e6e6, toneMapped: false }), 'card')
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), mat); mesh.renderOrder = 20 + i * 2 + 1
      const grp = new THREE.Group(); grp.add(mesh); mesh.position.z = 0.012 * i; face.add(grp)
      let shadow: THREE.Mesh | null = null
      if (spec.shadow !== 0) {
        const sc = document.createElement('canvas'); sc.width = Math.ceil(cw / 2); sc.height = Math.ceil(ch / 2)
        const sg = sc.getContext('2d')!; sg.filter = `blur(${phone ? 3 : 5}px)`; sg.drawImage(finalCanvas, 4, 4, sc.width - 8, sc.height - 8)
        sg.filter = 'none'; sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, sc.width, sc.height)
        const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace
        shadow = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), lit(new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: true, alphaTest: 0.02, opacity: 0, toneMapped: false }), 'card-shadow'))
        shadow.renderOrder = 20 + i * 2; shadow.userData.z = 0.012 * i - 0.006; grp.add(shadow)
      }
      const dir = Math.atan2(spec.y, spec.x) + (i % 2 ? 0.4 : -0.4)
      cards.push({ spec, grp, mesh, shadow, alpha: finalCanvas.getContext('2d')!, cw, ch, ox: 0, oy: 0, vx: 0, vy: 0, hov: 0, grabbed: false, ro: mesh.renderOrder, delay: 0.04 + 0.64 * Math.pow(i / (SPECS.length - 1), 0.85), leave: 0.04 + 0.5 * (1 - i / (SPECS.length - 1)), ph: i * 1.37, out: [Math.cos(dir) * 11, Math.sin(dir) * 8] })
    })
    // the tape goes on last (it holds the board) and comes off first: re-time it
    for (const cd of cards) if (cd.spec.id.startsWith('tp')) { cd.delay = 0.6 + 0.012 * (cards.indexOf(cd) - 14); cd.leave = 0.0 }
    // ---- interaction: the cut-outs are loose on the board. Drag one (it lifts, its shadow lets go of the paper) and release it: it springs back to its place with a
    // little overshoot. The backdrop, the flower print and the tape stay put. Reduced motion: it drops straight back, no spring.
    const loose = cards.filter(cd => !['board', 'flower'].includes(cd.spec.id) && !cd.spec.id.startsWith('tp'))
    const lbl = stageTip(), N_Z = new THREE.Vector3(0, 0, 1), O3 = new THREE.Vector3(), hp = new THREE.Vector3()
    let held: Card | null = null, hot: Card | null = null, gx = 0, gy = 0, emitP = (_n: string) => {}, rmNow = false
    const cardAt = (ray: THREE.Raycaster): Card | null => {
      face.updateWorldMatrix(true, true)
      let best: Card | null = null, bro = -1
      for (const cd of loose) {
        if (!cd.mesh.visible) continue
        const h = ray.intersectObject(cd.mesh, false)[0]; if (!h?.uv) continue
        const a = cd.alpha.getImageData(Math.min(cd.cw - 1, Math.max(0, Math.floor(h.uv.x * cd.cw))), Math.min(cd.ch - 1, Math.max(0, Math.floor((1 - h.uv.y) * cd.ch))), 1, 1).data[3]
        if (a > 40 && cd.ro > bro) { bro = cd.ro; best = cd }
      }
      return best
    }
    const pointer = {
      hover(ray: THREE.Raycaster, x: number, y: number) {
        hot = cardAt(ray)
        if (hot) lbl.show(x, y, 'Drag it', 'it springs back', '#f2b441'); else lbl.hide()
        return hot ? 'grab' as const : null
      },
      down(ray: THREE.Raycaster) {
        const cd = cardAt(ray); if (!cd) return null
        mark.dismiss()
        if (!rayPlaneLocal(face, ray.ray, N_Z, O3, hp)) return null
        held = cd; cd.grabbed = true; gx = hp.x - cd.ox; gy = hp.y - cd.oy; cd.vx = cd.vy = 0
        cd.mesh.renderOrder = 300; if (cd.shadow) cd.shadow.renderOrder = 299
        emitP('obj:lift'); return 'drag' as const
      },
      move(ray: THREE.Raycaster) {
        const cd = held; if (!cd || !rayPlaneLocal(face, ray.ray, N_Z, O3, hp)) return
        const nx = Math.max(-4.2, Math.min(4.2, hp.x - gx)), ny = Math.max(-3.4, Math.min(3.4, hp.y - gy))
        cd.vx = (nx - cd.ox) * 40; cd.vy = (ny - cd.oy) * 40; cd.ox = nx; cd.oy = ny
      },
      up() { const cd = held; held = null; if (!cd) return; cd.grabbed = false; if (rmNow) { cd.ox = cd.oy = cd.vx = cd.vy = 0; cd.mesh.renderOrder = cd.ro; if (cd.shadow) cd.shadow.renderOrder = cd.ro - 1 }; emitP('obj:drop') },
      leave() { hot = null; lbl.hide() },
    }
    const markCard = loose.find(cd => cd.spec.id === 'tee') ?? loose[0]
    const mark = tryMark('pair', 'Pull a cut-out', markCard.mesh, c.camera, '#f2b441')
    const settleCards = (dt: number) => {
      for (const cd of loose) {
        cd.hov += ((cd === hot || cd === held ? 1 : 0) - cd.hov) * Math.min(1, dt * 14)
        if (cd.grabbed) continue
        if (cd.ox === 0 && cd.oy === 0 && cd.vx === 0 && cd.vy === 0) continue
        const n = Math.max(1, Math.ceil(dt / 0.005)), h = dt / n
        for (let i = 0; i < n; i++) { cd.vx += (-130 * cd.ox - 11 * cd.vx) * h; cd.vy += (-130 * cd.oy - 11 * cd.vy) * h; cd.ox += cd.vx * h; cd.oy += cd.vy * h }
        if (Math.abs(cd.ox) + Math.abs(cd.oy) + Math.abs(cd.vx) * 0.05 + Math.abs(cd.vy) * 0.05 < 0.002) { cd.ox = cd.oy = cd.vx = cd.vy = 0; cd.mesh.renderOrder = cd.ro; if (cd.shadow) cd.shadow.renderOrder = cd.ro - 1; emitP('obj:land') }
      }
    }
    let asm = false
    const update = (f: StageFrame) => {
      emitP = n => f.emit(n); rmNow = f.reduced; settleCards(Math.min(f.dt, 0.05))
      mark.update(f.arrive > 0.97 && f.depart < 0.02 && f.tIn > 0.6 && !held, f.dt, f.reduced)
      const rm = f.reduced
      const sa = rm ? 1 : clamp01((f.arrive - 0.1) / 0.9), sd = rm ? 0 : sstep(0, 0.95, f.depart)
      if (!rm && sa > 0.2 && !asm) { asm = true; f.emit('type:assemble') } else if (sa < 0.1) asm = false
      for (const cd of cards) {
        const s = cd.spec
        const p = rm ? 1 : clamp01((sa - cd.delay) / 0.3), q = rm ? 0 : clamp01((sd - cd.leave) / 0.45)
        const e = easeOutBack(p, 1.2), lift = (1 - easeOutCubic(p))
        let x = s.x + s.start[0] * 0.6 * (1 - e), y = s.y + s.start[1] * 0.6 * (1 - e), rot = s.rot + s.spin * (1 - easeOutCubic(p)), scale = 1 + 0.14 * lift * lift
        // the slap: a hair of squash as it lands
        scale -= 0.025 * Math.sin(Math.PI * clamp01((p - 0.82) / 0.18))
        if (q > 0) { const k = easeInCubic(q); x += cd.out[0] * k; y += cd.out[1] * k; rot += s.spin * 1.5 * k; scale += 0.12 * k }
        const fl = rm || s.flutter === 0 ? 0 : 1
        rot += fl * 0.012 * Math.sin(f.t * 0.9 + cd.ph) * sstep(0.9, 1, p)
        const up = cd.hov * (cd === held ? 1 : 0.35)
        x += cd.ox; y += cd.oy; rot += Math.max(-0.2, Math.min(0.2, cd.vx * 0.02)); scale += 0.07 * up
        cd.grp.position.set(x, y, 0.02 * cd.hov + (cd.grabbed || cd.ox !== 0 || cd.oy !== 0 ? 0.3 : 0)); cd.grp.rotation.z = rot; cd.grp.scale.setScalar(scale)
        cd.mesh.visible = p > 0.001 && q < 0.999
        if (cd.shadow) {
          const sh = s.shadow ?? 1, o = (0.5 * sh) * clamp01(p * 1.4) * (1 - q * 0.6)
          ;(cd.shadow.material as THREE.MeshBasicMaterial).opacity = o * (1 - 0.55 * lift)
          const off = 0.05 + 0.5 * lift * lift + 0.2 * up + 0.12 * (cd.grabbed ? 1 : 0)
          cd.shadow.position.set(off * 0.7, -off, cd.shadow.userData.z as number); cd.shadow.scale.setScalar(1 + 0.12 * lift)
          cd.shadow.visible = cd.mesh.visible
        }
      }
      // the sun breathes, the halo turns
      const fl = cards[1], sn = cards[2]
      if (!rm) { fl.mesh.rotation.z = f.t * 0.06; sn.mesh.rotation.z = Math.sin(f.t * 0.5) * 0.04 }
    }
    return { root, update, dust: 0.1, size: [5.8, 5.2] as [number, number], pointer, hint: ['Drag it', 'it springs back'] as [string, string], debug: () => ({ cards: loose.map(c => [c.spec.id, +c.ox.toFixed(2), +c.oy.toFixed(2), c.grabbed, c.mesh.getWorldPosition(new THREE.Vector3()).toArray()]) }) }
  },
} satisfies StageDef
