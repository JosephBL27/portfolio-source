// The five stained-glass windows of the hall (unit 10H): one lancet per interest, painted procedurally on a canvas atlas (no image files).
//   1. a flat "mask" of the picture is drawn with region codes (0 field, 1 border, 2 hero, 3 second hero colour, 4 light, 5 dark, 6 second field, 7 trim, 8 halo, 9 accent)
//   2. a jittered grid of seeds cuts the plane into glass pieces; every piece gets a jewel colour from its region's palette
//   3. lead came runs on every piece edge and wherever two regions meet; horizontal saddle bars cross the lancet every quarter
//   4. pieces are shaded (lighter at the heart, darker at the lead) and streaked, like pot-metal glass with the sun behind it
// The atlas is 5 lancets side by side, 320 x 1200 each. Colours are display-referred (the world writes straight to the canvas).
import { rng } from '../transitions/common'

export const WIN_W = 320, WIN_H = 1200
export type RGB = [number, number, number]
export interface Interest {
  /** waypoint id of the stop this window opens (layout.ts HALL_STOPS) */
  id: string
  /** window name in the caption */
  label: string
  /** the figure in the caption, read from site.json offBoard (null if the text moved) */
  fact: string | null
  /** the short figure under the window ("V8", "80+", "400+", "16 years", "1750"), read from the same line */
  short: string | null
  /** the colour its light throws on the floor */
  light: RGB
}

/** site.json offBoard: "guitar (16 years), bouldering (V8 at my peak), 80+ board games, 400+ records and CDs, 1750 on Chess.com." */
export function interestsFrom(offBoard: string): Interest[] {
  const m = (re: RegExp) => offBoard.match(re)?.[1] ?? null
  const v8 = m(/\((V\d+) at my peak\)/), games = m(/(\d+\+) board games/), recs = m(/(\d+\+) records/), yrs = m(/guitar \((\d+) years\)/), elo = m(/(\d+) on Chess\.com/)
  return [
    { id: 'hold', label: 'Bouldering', fact: v8 && `${v8} at my peak`, short: v8, light: [0.32, 0.62, 1.0] },
    { id: 'meeple', label: 'Board games', fact: games && `${games} games`, short: games, light: [0.3, 0.95, 0.5] },
    { id: 'records', label: 'Records', fact: recs && `${recs} records and CDs`, short: recs, light: [1.0, 0.3, 0.68] },
    { id: 'guitar', label: 'Guitar', fact: yrs && `${yrs} years`, short: yrs && `${yrs} years`, light: [1.0, 0.7, 0.24] },
    { id: 'knight', label: 'Chess', fact: elo && `${elo} on Chess.com`, short: elo, light: [0.66, 0.46, 1.0] },
  ]
}

// ------------------------------------------------------------------------------------------ palettes (jewel glass, display-referred)
const J = {
  ruby: [0.82, 0.07, 0.14], garnet: [0.62, 0.04, 0.12], rose: [0.95, 0.32, 0.52], coral: [1.0, 0.42, 0.3], orange: [1.0, 0.46, 0.08], amber: [1.0, 0.68, 0.12], gold: [1.0, 0.82, 0.3],
  pale: [1.0, 0.93, 0.62], ivory: [0.99, 0.96, 0.84], lime: [0.62, 0.9, 0.2], emerald: [0.05, 0.62, 0.3], green: [0.1, 0.72, 0.38], jade: [0.1, 0.55, 0.45], teal: [0.0, 0.62, 0.64],
  cyan: [0.2, 0.82, 0.98], sky: [0.4, 0.78, 1.0], sapphire: [0.08, 0.3, 0.88], cobalt: [0.06, 0.2, 0.7], navy: [0.04, 0.08, 0.36], indigo: [0.2, 0.14, 0.62], violet: [0.5, 0.24, 0.85],
  amethyst: [0.62, 0.3, 0.8], plum: [0.38, 0.08, 0.42], magenta: [0.9, 0.18, 0.62], night: [0.1, 0.07, 0.2], slate: [0.16, 0.18, 0.34], brown: [0.5, 0.26, 0.08], walnut: [0.34, 0.16, 0.06],
} satisfies Record<string, RGB>

type Pal = Record<number, RGB[]>
interface Spec { pal: Pal; paint(g: CanvasRenderingContext2D): void }

const K = 16 // mask code -> red channel
const code = (g: CanvasRenderingContext2D, c: number) => { g.fillStyle = g.strokeStyle = `rgb(${c * K},0,0)` }

/** the lancet outline in texture pixels, inset from the edge: straight sides up to the spring line, then a two-centre pointed arch (the same curve as the window geometry in shell.ts) */
function arch(g: CanvasRenderingContext2D, inset: number) {
  const hw = WIN_W / 2 - inset, R = hw * 1.9, cx = WIN_W / 2, cl = R - hw
  const ys = Math.sqrt(R * R - cl * cl) + inset, n = 28, aEnd = Math.acos(-cl / R)
  g.beginPath(); g.moveTo(cx - hw, WIN_H + 4); g.lineTo(cx - hw, ys)
  for (let i = 1; i <= n; i++) { const a = Math.PI + (aEnd - Math.PI) * (i / n); g.lineTo(cx - hw + R + R * Math.cos(a), ys - R * Math.sin(a)) }
  for (let i = n - 1; i >= 0; i--) { const a = Math.PI + (aEnd - Math.PI) * (i / n); g.lineTo(cx + hw - R - R * Math.cos(a), ys - R * Math.sin(a)) }
  g.lineTo(cx + hw, WIN_H + 4); g.closePath()
}

const poly = (g: CanvasRenderingContext2D, pts: [number, number][], ox = 0, oy = 0, s = 1, rot = 0) => {
  const c = Math.cos(rot), sn = Math.sin(rot)
  g.beginPath()
  pts.forEach(([x, y], i) => { const X = ox + (x * c - y * sn) * s, Y = oy + (x * sn + y * c) * s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y) })
  g.closePath(); g.fill()
}
const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill() }
const ring = (g: CanvasRenderingContext2D, x: number, y: number, r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke() }

/** rays from a point, alternating two region codes, clipped to the lancet */
function sunburst(g: CanvasRenderingContext2D, x: number, y: number, n: number, a: number, b: number, rot = 0) {
  for (let i = 0; i < n; i++) {
    code(g, i % 2 ? a : b)
    const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2, R = 1800
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); g.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R); g.closePath(); g.fill()
  }
}
function hexGrid(g: CanvasRenderingContext2D, r: number, codes: number[]) {
  const w = Math.sqrt(3) * r, h = 1.5 * r
  for (let j = -1; j < WIN_H / h + 1; j++) for (let i = -1; i < WIN_W / w + 2; i++) {
    const x = i * w + (j & 1 ? w / 2 : 0), y = j * h
    code(g, codes[(((i + (j >> 1)) % codes.length) + codes.length) % codes.length])
    g.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(an) * (r - 1.5), y + Math.sin(an) * (r - 1.5)) } g.closePath(); g.fill()
  }
}
/** a trefoil of three discs and a ring: the tracery head every lancet carries above its picture */
function rose(g: CanvasRenderingContext2D, x: number, y: number, r: number, cPetal: number, cHeart: number, cRing: number) {
  code(g, cRing); ring(g, x, y, r, 12)
  code(g, cPetal)
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ell(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.3, r * 0.17, a) }
  code(g, cHeart); disc(g, x, y, r * 0.24)
}
const MEEPLE: [number, number][] = [[-0.16, -0.42], [0.16, -0.42], [0.2, -0.3], [0.64, -0.18], [0.64, 0.02], [0.3, 0.08], [0.36, 0.5], [0.04, 0.5], [0, 0.26], [-0.04, 0.5], [-0.36, 0.5], [-0.3, 0.08], [-0.64, 0.02], [-0.64, -0.18], [-0.2, -0.3]]
const KNIGHT: [number, number][] = [[0.18, 1], [0.84, 1], [0.84, 0.9], [0.78, 0.86], [0.76, 0.7], [0.78, 0.54], [0.72, 0.38], [0.64, 0.22], [0.58, 0.1], [0.55, 0.01], [0.48, 0.1], [0.44, 0.14], [0.36, 0.2], [0.3, 0.28], [0.14, 0.43], [0.05, 0.51], [0.04, 0.59], [0.1, 0.65], [0.18, 0.63], [0.28, 0.59], [0.34, 0.54], [0.4, 0.6], [0.44, 0.68], [0.36, 0.76], [0.28, 0.83], [0.24, 0.88], [0.16, 0.9]]

// ------------------------------------------------------------------------------------------ the five pictures
// w11: one bold pictogram per lancet, a LIGHT glyph (ivory / pale gold, code 4 and 2) on a jewel-tone field (codes 0 and 6) with dark leading and dark inner detail (code 5).
// Every glyph is at least 60% of the lancet's width, so it reads from the far end of the nave.
const crest = (g: CanvasRenderingContext2D, petal: number, heart: number) => {
  rose(g, 160, 228, 74, petal, heart, 7)
  code(g, 1); g.lineWidth = 34; arch(g, 17); g.stroke()
  code(g, 7); g.lineWidth = 8; arch(g, 40); g.stroke()
}
/** a stroke through points with round joins (limbs, strings, arms) */
const limb = (g: CanvasRenderingContext2D, pts: [number, number][], w: number, c: number) => {
  code(g, c); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
}

const hold: Spec = {
  pal: {
    0: [J.sapphire, J.cobalt, [0.1, 0.42, 0.95]], 6: [J.indigo, [0.28, 0.22, 0.74], J.navy], 8: [J.sky, J.cyan, [0.7, 0.92, 1.0]], 1: [J.navy, J.gold], 7: [J.gold, J.amber],
    2: [J.orange, [0.95, 0.3, 0.05], [1.0, 0.6, 0.14]], 3: [J.gold, J.amber], 4: [J.ivory, J.pale], 5: [J.night, J.navy, [0.06, 0.06, 0.2]], 9: [J.amber, J.gold],
  },
  paint(g) {
    code(g, 0); g.fillRect(0, 0, WIN_W, WIN_H)
    sunburst(g, 160, 820, 18, 0, 6, 0.1)
    // the overhang: a dark slab of rock, its top edge a roof that juts out over the climber, haloed in sky blue so it stands off the field
    code(g, 8); poly(g, [[44, 584], [286, 536], [286, 1086], [44, 1112]], 0, 0, 1)
    code(g, 5); poly(g, [[52, 596], [278, 550], [278, 1076], [52, 1102]], 0, 0, 1)
    code(g, 6); poly(g, [[44, 556], [286, 494], [286, 604], [160, 650], [44, 626]]); code(g, 8); g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); g.moveTo(44, 626); g.lineTo(160, 650); g.lineTo(286, 604); g.stroke()
    // holds on the rock (orange), the ones the climber is on
    for (const [x, y, r] of [[226, 676, 19], [92, 752, 18], [236, 1010, 18], [86, 1040, 17]] as [number, number, number][]) { code(g, 2); ell(g, x, y, r, r * 0.76, 0.3) }
    // the climber, one bold pale silhouette: reaching up to the right hold, left hand on the lower hold, one leg bent out, one foot on the low hold
    limb(g, [[170, 800], [210, 742], [228, 684]], 30, 4)           // reaching arm
    limb(g, [[140, 806], [112, 782], [96, 758]], 28, 4)            // other arm
    limb(g, [[156, 790], [146, 868], [136, 930]], 62, 4)           // torso
    limb(g, [[136, 930], [190, 960], [232, 1006]], 34, 4)         // leg out to the right
    limb(g, [[136, 930], [108, 986], [90, 1034]], 34, 4)          // leg down to the left
    code(g, 4); disc(g, 148, 742, 33)                              // head
    crest(g, 9, 4)
  },
}

const meeple: Spec = {
  pal: {
    0: [J.emerald, J.green, [0.04, 0.5, 0.26]], 6: [J.jade, [0.08, 0.42, 0.34], J.teal], 8: [J.lime, [0.45, 0.82, 0.3]], 1: [J.garnet, J.gold], 7: [J.gold, J.pale],
    2: [J.ruby, [0.9, 0.12, 0.18], J.garnet], 3: [J.amber, J.gold, J.orange], 4: [J.ivory, J.pale], 5: [J.night, J.slate], 9: [J.cyan, J.sapphire, J.sky],
  },
  paint(g) {
    code(g, 0); g.fillRect(0, 0, WIN_W, WIN_H)
    sunburst(g, 160, 800, 24, 0, 6, 0.2)
    // ONE meeple, big: a pale body, the head a full disc, a warm shaded flank
    const S = 172, cx = 160, cy = 820
    code(g, 5); disc(g, cx, cy - 6, 134)
    code(g, 8); ring(g, cx, cy - 6, 134, 10)
    code(g, 4); poly(g, MEEPLE, cx, cy, S); disc(g, cx, cy - S * 0.7, S * 0.3)
    code(g, 3); poly(g, [[-0.2, -0.36], [-0.05, -0.36], [-0.12, 0.46], [-0.32, 0.46]], cx, cy, S)
    crest(g, 3, 2)
  },
}

const records: Spec = {
  pal: {
    0: [J.magenta, [0.78, 0.14, 0.58], J.plum], 6: [J.violet, J.amethyst, [0.42, 0.2, 0.74]], 8: [J.rose, [1.0, 0.55, 0.7]], 1: [J.night, J.gold], 7: [J.gold, J.pale],
    2: [J.coral, [1.0, 0.36, 0.22], J.orange], 3: [J.gold, J.amber], 4: [J.ivory, J.pale], 5: [J.night, [0.14, 0.08, 0.26], [0.08, 0.05, 0.18]], 9: [[0.2, 0.12, 0.38], J.plum, J.indigo],
  },
  paint(g) {
    code(g, 0); g.fillRect(0, 0, WIN_W, WIN_H)
    sunburst(g, 150, 830, 26, 0, 6, 0.05)
    const cx = 150, cy = 836
    code(g, 5); disc(g, cx, cy, 112)                                  // the record: a dark disc ringed in pale, so the tonearm and the label read against it
    code(g, 4); ring(g, cx, cy, 108, 12)
    code(g, 8); ring(g, cx, cy, 76, 6)
    code(g, 8); ring(g, cx, cy, 56, 5)
    code(g, 2); disc(g, cx, cy, 36)
    code(g, 4); disc(g, cx, cy, 10)
    code(g, 4); for (const a0 of [-2.5, 0.65]) { g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, 90, a0, a0 + 0.8); g.stroke() }   // two sheens on the grooves
    // the tonearm: a pivot post, a long gold arm that bends, a headshell resting on the grooves
    limb(g, [[248, 618], [246, 726], [196, 806]], 22, 3)
    code(g, 3); disc(g, 248, 618, 30); code(g, 5); disc(g, 248, 618, 11)
    code(g, 4); poly(g, [[-22, -12], [22, -12], [22, 12], [-22, 12]], 190, 812, 1, 0.64)
    crest(g, 8, 3)
  },
}

const guitar: Spec = {
  pal: {
    0: [J.ruby, J.garnet, [0.7, 0.08, 0.2]], 6: [J.coral, [0.92, 0.3, 0.16], J.orange], 8: [J.pale, J.gold], 1: [J.walnut, J.gold], 7: [J.gold, J.pale],
    2: [J.amber, J.gold, [1.0, 0.76, 0.28], J.orange], 3: [J.walnut, [0.34, 0.14, 0.05]], 4: [J.ivory, J.pale], 5: [J.night, [0.18, 0.09, 0.08]], 9: [J.ruby, J.garnet],
  },
  paint(g) {
    code(g, 0); g.fillRect(0, 0, WIN_W, WIN_H)
    sunburst(g, 160, 800, 20, 0, 6, 0.2)
    g.save(); g.translate(158, 790); g.rotate(0.34); g.scale(0.8, 0.8)
    // neck and headstock first (behind the body)
    code(g, 2); g.fillRect(-19, -360, 38, 400)
    code(g, 4); g.beginPath(); g.moveTo(-30, -360); g.lineTo(30, -360); g.lineTo(26, -470); g.lineTo(-26, -470); g.closePath(); g.fill()
    code(g, 5); for (const [px, py] of [[-14, -440], [-14, -408], [-14, -376], [14, -440], [14, -408], [14, -376]]) disc(g, px, py, 6)
    // body: a big pale waisted silhouette with a dark sound hole in a gold rosette
    code(g, 5); ell(g, 0, 70, 114, 118); ell(g, 0, 214, 146, 146)
    code(g, 4); ell(g, 0, 70, 104, 108); ell(g, 0, 214, 136, 136); g.fillRect(-84, 100, 168, 90)
    code(g, 2); ring(g, 0, 180, 62, 16)
    code(g, 5); disc(g, 0, 180, 44)
    code(g, 3); g.fillRect(-62, 290, 124, 24)
    g.restore()
    crest(g, 8, 3)
  },
}

const knight: Spec = {
  pal: {
    0: [J.violet, J.amethyst, [0.4, 0.18, 0.78]], 6: [J.indigo, [0.28, 0.2, 0.74], J.plum], 8: [J.pale, J.gold, J.ivory], 1: [J.night, J.gold], 7: [J.gold, J.pale],
    2: [J.ivory, [0.95, 0.9, 0.8], J.pale], 3: [J.gold, J.amber], 4: [J.cyan, J.sky], 5: [J.night, [0.1, 0.06, 0.24]], 9: [J.ruby, J.garnet],
  },
  paint(g) {
    code(g, 0); g.fillRect(0, 0, WIN_W, WIN_H)
    for (let j = -1; j < 16; j++) for (let i = -1; i < 6; i++) { code(g, (i + j) % 2 ? 0 : 6); poly(g, [[0, -45], [45, 0], [0, 45], [-45, 0]], i * 90 + (j & 1 ? 45 : 0), j * 90 + 45) }
    const K0 = KNIGHT.map(([x, y]) => [x - 0.5, y - 0.5] as [number, number])
    code(g, 3); disc(g, 160, 810, 140); code(g, 5); disc(g, 160, 810, 128)   // a dark disc so the pale knight reads as a bold glyph
    code(g, 2); poly(g, K0, 168, 818, 262)                           // the chess knight, pale
    code(g, 5); disc(g, 168 + (0.4 - 0.5) * 262, 818 + (0.3 - 0.5) * 262, 9)  // eye
    code(g, 3); poly(g, [[0.6, 0.15], [0.76, 0.4], [0.72, 0.5], [0.62, 0.3], [0.5, 0.2]].map(([x, y]) => [x - 0.5, y - 0.5] as [number, number]), 168, 818, 262) // mane
    code(g, 3); poly(g, [[0.1, 0.92], [0.9, 0.92], [0.92, 0.99], [0.08, 0.99]].map(([x, y]) => [x - 0.5, y - 0.5] as [number, number]), 168, 818, 262)
    crest(g, 3, 9)
  },
}
const SPECS: Spec[] = [hold, meeple, records, guitar, knight]

// ------------------------------------------------------------------------------------------ glass: cells, lead, shading
const hash = (a: number, b: number, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s) }

/** paints one window into `out` (WIN_W x WIN_H) in row chunks: yields after every `chunk` rows so a caller can spread the work over frames */
function* glassGen(spec: Spec, seed: number, out: HTMLCanvasElement, chunk = 100): Generator<void> {
  const m = document.createElement('canvas'); m.width = WIN_W; m.height = WIN_H
  const mg = m.getContext('2d', { willReadFrequently: true })!
  mg.imageSmoothingEnabled = false
  spec.paint(mg)
  const md = mg.getImageData(0, 0, WIN_W, WIN_H).data
  const layer = new Uint8Array(WIN_W * WIN_H)
  for (let i = 0; i < layer.length; i++) layer[i] = Math.min(9, Math.round(md[i * 4] / K))
  yield
  const C = 26, gx = Math.ceil(WIN_W / C) + 2, gy = Math.ceil(WIN_H / C) + 2
  const sx = new Float32Array(gx * gy), sy = new Float32Array(gx * gy)
  const R = rng(seed)
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { sx[j * gx + i] = (i - 0.5 + 0.1 + R() * 0.8) * C; sy[j * gx + i] = (j - 0.5 + 0.1 + R() * 0.8) * C }
  const og = out.getContext('2d')!
  const grain = rng(seed * 7 + 1)
  for (let y0 = 0; y0 < WIN_H; y0 += chunk) {
    const rows = Math.min(chunk, WIN_H - y0)
    const img = og.createImageData(WIN_W, rows), od = img.data
    for (let y = y0; y < y0 + rows; y++) {
      const cj = Math.floor(y / C) + 1
      for (let x = 0; x < WIN_W; x++) {
        const ci = Math.floor(x / C) + 1
        let d1 = 1e9, d2 = 1e9, id = 0
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const k = (cj + dj) * gx + (ci + di)
          const dx = x - sx[k], dy = y - sy[k], d = dx * dx + dy * dy
          if (d < d1) { d2 = d1; d1 = d; id = k } else if (d < d2) d2 = d
        }
        const edge = (Math.sqrt(d2) - Math.sqrt(d1)) * 0.5
        const p = y * WIN_W + x, L = layer[p]
        const diff = (xx: number, yy: number) => layer[Math.min(WIN_H - 1, Math.max(0, yy)) * WIN_W + Math.min(WIN_W - 1, Math.max(0, xx))] !== L
        let lead = edge < 1.7 || diff(x + 2, y) || diff(x, y + 2) || diff(x - 2, y) || diff(x, y - 2)
        if ((y >= 538 && y < 542) || (y >= 1118 && y < 1122)) lead = true // saddle bars (clear of the glyph)
        const o = ((y - y0) * WIN_W + x) * 4
        if (lead) { od[o] = 10; od[o + 1] = 8; od[o + 2] = 12; od[o + 3] = 255; continue }
        const pal = spec.pal[L] ?? spec.pal[0], hp = hash(id, L, seed)
        const c = pal[Math.floor(hp * pal.length) % pal.length]
        const shade = (0.62 + 0.5 * Math.min(1, edge / 11)) * (0.84 + 0.3 * hash(id, L + 3, seed)) * (0.94 + 0.12 * grain())
        const streak = 0.92 + 0.12 * Math.sin((x * 0.5 + y * 0.9) * 0.05 + hp * 40)
        od[o] = Math.min(255, c[0] * shade * streak * 255); od[o + 1] = Math.min(255, c[1] * shade * streak * 255); od[o + 2] = Math.min(255, c[2] * shade * streak * 255); od[o + 3] = 255
      }
    }
    og.putImageData(img, 0, y0)
    yield
  }
  // the lancet is cut out by the window geometry; everything outside it is painted dark so the mip blur at the rim (and the floor's mirror) stays clean
  og.save(); arch(og, 0); og.rect(0, 0, WIN_W, WIN_H); og.clip('evenodd'); og.fillStyle = '#05040a'; og.fillRect(0, 0, WIN_W, WIN_H); og.restore()
}

/** the atlas, painted a little at a time: `next()` the generator; each `done` window is complete in `canvas` (the caller re-uploads the texture then) */
export function atlasPainter(): { canvas: HTMLCanvasElement; gen: Generator<number> } {
  const atlas = document.createElement('canvas'); atlas.width = WIN_W * 5; atlas.height = WIN_H
  const g = atlas.getContext('2d')!
  g.fillStyle = '#05040a'; g.fillRect(0, 0, atlas.width, atlas.height)
  function* run(): Generator<number> {
    for (let i = 0; i < 5; i++) {
      const w = document.createElement('canvas'); w.width = WIN_W; w.height = WIN_H
      for (const _ of glassGen(SPECS[i], 11 + i * 17, w)) yield -1
      g.drawImage(w, i * WIN_W, 0)
      yield i
    }
  }
  return { canvas: atlas, gen: run() }
}
