// Halftone cut-outs. Each shape is a small analytic model (height field + material) that is
// lit once into an offscreen density image, then screened every frame through a 45° dot lattice
// in the ink colour on a transparent canvas. The dot grid is fixed to the canvas; the shape turns
// beneath it, so the dots shimmer the way a rotating print would.
import { state } from '../state'
import { bus } from '../bus'
import { palette } from '../theme'

export type ShapeName = 'endcap' | 'elbow' | 'hold' | 'meeple' | 'record' | 'pawn'

export interface HalftoneOpts {
  ink?: string
  /** Dot pitch in CSS px (default 7). */
  cell?: number
  /** Seconds per full turn (default 70). Negative turns the other way. */
  turnSeconds?: number
  /** Hover makes the dot radius breathe between 0.92 and 1.0 (300 ms each way). */
  breathe?: boolean
  /** Halftone drop shadow on the paper (default true). */
  shadow?: boolean
  /** Element whose hover drives breathe (default: the canvas). */
  hoverTarget?: HTMLElement
  /** Swing ±sway degrees (one swing per |turnSeconds|) instead of a full turn. */
  sway?: number
  /** Starting angle in degrees (default: per-shape). */
  angle?: number
  /** Shape size as a fraction of min(width, height) (default 1). */
  fill?: number
}

export interface HalftoneHandle { setInk(c: string): void; setPaused(p: boolean): void; dispose(): void }

const TAU = Math.PI * 2
const N = 512 // bake resolution (px) for the analytic model
const C45 = Math.SQRT1_2
const DOT = 0.62 // dot radius at full density, as a fraction of the cell

// ---------------------------------------------------------------- noise
function hash(ix: number, iy: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, y: number, oct = 4): number {
  let s = 0, amp = 0.5, f = 1, n = 0
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f + i * 17.1, y * f - i * 9.3); n += amp; amp *= 0.5; f *= 2.03 }
  return s / n
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t) }
const dome = (d: number, r: number) => (d >= r ? 0 : Math.sqrt(1 - (d / r) * (d / r)))
function smin(a: number, b: number, k: number) { const h = clamp01(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h) }
function smax(a: number, b: number, k: number) { return -smin(-a, -b, k) }
function sdCapsule(px: number, py: number, ax: number, ay: number, bx: number, by: number, r: number) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h) - r
}
function sdRoundBox(px: number, py: number, cx: number, cy: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// ---------------------------------------------------------------- shapes
// f(x, y, s) gets model coords in [-1, 1] (y down) and fills s; returns false outside the shape.
// h = height (same units as x/y, drives the normals), a = ink of the material (0 white .. 1 black),
// g = gloss, e = extra light (sheen) added after shading.
interface Sm { h: number; a: number; g: number; e: number }
interface ShapeDef { shin: number; angle0: number; k?: number; f: (x: number, y: number, s: Sm) => boolean }

const LIGHT_ANG = Math.atan2(-0.62, -0.5)

const SHAPES: Record<ShapeName, ShapeDef> = {
  // Capsule end-cap seen head-on: rolled rim, machined flange, bolt circle, black gasket, glossy dome.
  endcap: {
    shin: 34, angle0: 8,
    f(x, y, s) {
      const r = Math.hypot(x, y)
      if (r > 0.95) return false
      const th = Math.atan2(y, x)
      if (r > 0.87) { // rolled outer rim
        s.h = 0.05 + 0.09 * dome(r - 0.87, 0.08); s.a = 0.28; s.g = 0.55; return true
      }
      if (r > 0.845) { s.h = 0.09; s.a = 0.92; s.g = 0; return true } // parting groove
      if (r > 0.655) { // flange face with bolt circle
        s.h = 0.12; s.g = 0.35
        // two turned rings on the face
        s.a = 0.1 + 0.6 * smooth(0.016, 0.004, Math.abs(r - 0.70)) + 0.6 * smooth(0.016, 0.004, Math.abs(r - 0.815))
        const k = Math.round((th / TAU) * 10)
        const bth = (k / 10) * TAU
        const bx = 0.758 * Math.cos(bth), by = 0.758 * Math.sin(bth)
        const d = Math.hypot(x - bx, y - by)
        if (d < 0.072) { // socket-head bolt
          s.h = 0.12 + 0.05 * dome(d, 0.072); s.a = 0.3; s.g = 0.8
          // hex socket
          const ang = Math.atan2(y - by, x - bx) - bth
          const hex = Math.cos(Math.PI / 6) / Math.cos(((ang % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6)
          if (d < 0.03 * hex) { s.h = 0.13; s.a = 1; s.g = 0 }
          if (d > 0.064) { s.a = 0.95; s.g = 0 }
        }
        return true
      }
      if (r > 0.635) { s.h = 0.07; s.a = 1; s.g = 0; return true } // gasket seat
      if (r > 0.55) { // rubber O-ring
        s.h = 0.07 + 0.045 * dome(r - 0.5925, 0.0425); s.a = 0.82; s.g = 0.25; return true
      }
      if (r > 0.53) { s.h = 0.06; s.a = 1; s.g = 0; return true }
      // glossy domed cap with machined bands and a centre boss
      s.h = 0.08 + 0.2 * (1 - (r / 0.53) * (r / 0.53))
      s.a = 0.36 + 0.14 * Math.sin((r / 0.53) * 22)
      s.g = 0.95
      if (r < 0.15) {
        if (r > 0.125) { s.a = 1; s.g = 0; s.h -= 0.01 }
        else { s.h += 0.02 + 0.02 * dome(r, 0.125); s.a = 0.12; s.g = 0.9 }
      }
      return true
    },
  },

  // 90° elbow fitting: two straight legs, a swept bend, weld beads, a flange and nuts at each end.
  elbow: {
    shin: 26, angle0: -18, k: 0.78,
    f(x, y, s) {
      const lx = x - 0.13, ly = y + 0.13
      const rt = 0.235
      let h = -1, a = 0.2, g = 0.7
      const tube = (d: number, r: number) => (d < r ? Math.sqrt(r * r - d * d) : -1)
      // centreline: leg A (y=-0.42, x -0.84..-0.1), bend about (-0.1, 0.1) radius 0.52, leg B (x=0.42, y 0.1..0.84)
      let d = 9, along = 0 // along: -1 leg A, 0 bend, 1 leg B
      if (lx <= -0.1 && lx >= -0.86) { d = Math.abs(ly + 0.42); along = -1 }
      if (ly >= 0.1 && ly <= 0.86) { const dd = Math.abs(lx - 0.42); if (dd < d) { d = dd; along = 1 } }
      if (lx > -0.1 && ly < 0.1) { const dd = Math.abs(Math.hypot(lx + 0.1, ly - 0.1) - 0.52); if (dd < d) { d = dd; along = 0 } }
      const th = tube(d, rt)
      if (th > h) h = th
      // weld beads where the bend meets each leg
      const bead = (u: number) => { const v = tube(d, rt + 0.022 * dome(u, 0.03)); if (v > h) { h = v; a = 0.55; g = 0.4 } }
      if (along !== 0 || d < rt + 0.03) { bead(Math.abs(lx + 0.1)); bead(Math.abs(ly - 0.1)) }
      // collars + flanges + nuts
      const flange = (u: number, w: number) => { // u along axis from end, w across axis
        if (u > 0 && u < 0.085) { const v = tube(Math.abs(w), 0.36) * (0.55 + 0.45 * dome(Math.abs(u - 0.0425), 0.05)); if (v > h) { h = v; a = 0.08; g = 0.75 } }
        if (u > 0.085 && u < 0.15) { const v = tube(Math.abs(w), 0.28); if (v > h) { h = v; a = 0.3; g = 0.55 } }
        for (const o of [-0.29, 0.29]) {
          const ww = w - o
          if (u > 0.085 && u < 0.14 && Math.abs(ww) < 0.05) { const v = 0.12 + 0.05 * dome(Math.abs(ww), 0.05); if (v > h) { h = v; a = 0.5; g = 0.5 } }
          if (u > -0.035 && u <= 0 && Math.abs(ww) < 0.02) { const v = 0.08 + 0.03 * dome(Math.abs(ww), 0.02); if (v > h) { h = v; a = 0.7; g = 0.4 } }
        }
      }
      flange(lx + 0.92, ly + 0.42)
      flange(0.92 - ly, lx - 0.42)
      if (h < 0) return false
      // seam stripe of darker metal along the outside of the bend
      s.h = h; s.a = a; s.g = g
      return true
    },
  },

  // Climbing hold: lumpy organic body, sandy grain, an incut lip and two countersunk bolt holes.
  hold: {
    shin: 9, angle0: 20,
    f(x, y, s) {
      const r = Math.hypot(x, y), th = Math.atan2(y, x)
      const R = 0.73 * (1 + 0.13 * Math.sin(2 * th + 0.6) + 0.07 * Math.sin(3 * th + 2.1) + 0.045 * Math.sin(5 * th + 0.9))
        * (1 + 0.05 * (fbm(Math.cos(th) * 2 + 3, Math.sin(th) * 2 + 3, 3) - 0.5))
      if (r > R) return false
      const u = r / R
      let h = 0.46 * Math.pow(1 - Math.pow(u, 2.4), 0.6)
      h += 0.11 * Math.exp(-((x + 0.3) ** 2 + (y + 0.12) ** 2) / 0.05)
      h += 0.09 * Math.exp(-((x - 0.25) ** 2 + (y + 0.3) ** 2) / 0.035)
      h += 0.07 * Math.exp(-((x - 0.05) ** 2 + (y - 0.38) ** 2) / 0.04)
      h -= 0.2 * Math.exp(-((x - 0.02) ** 2 + (y + 0.5) ** 2 * 2.2) / 0.03) // incut jug lip
      h += 0.012 * (fbm(x * 30, y * 30, 2) - 0.5) // sandy texture
      h = Math.max(0.02, h)
      s.a = 0.2 + 0.22 * (fbm(x * 9 + 5, y * 9 - 2, 2) - 0.5)
      s.g = 0.12
      for (const [cx, cy, R0] of [[-0.12, 0.08, 0.13], [0.36, 0.2, 0.085]] as const) {
        const d = Math.hypot(x - cx, y - cy)
        if (d < R0) {
          const bore = R0 * 0.45
          if (d < bore) { h = 0.01; s.a = 1; s.g = 0 }
          else { h = Math.min(h, 0.02 + (d - bore) * 2.2 + 0.1 * ((d - bore) / (R0 - bore)) ** 2); s.a = 0.4; s.g = 0.35 }
        }
      }
      s.h = h
      return true
    },
  },

  // Meeple: a wooden game piece, flat face, rounded-over edges, wood grain.
  meeple: {
    shin: 14, angle0: -6,
    f(x0, y0, s) {
      const x = x0 / 0.95, y = y0 / 0.95 + 0.06
      let d = Math.hypot(x, y + 0.5) - 0.27 // head
      d = smin(d, sdCapsule(x, y, -0.62, 0.02, -0.15, -0.1, 0.19), 0.1) // arms, tips dropped a touch
      d = smin(d, sdCapsule(x, y, 0.62, 0.02, 0.15, -0.1, 0.19), 0.1)
      d = smin(d, sdRoundBox(x, y, 0, 0.2, 0.31, 0.32, 0.12), 0.12) // body
      d = smin(d, sdCapsule(x, y, -0.18, 0.4, -0.5, 0.78, 0.22), 0.1)
      d = smin(d, sdCapsule(x, y, 0.18, 0.4, 0.5, 0.78, 0.22), 0.1)
      d = smax(d, -(Math.hypot(x, y - 1.02) - 0.3), 0.07) // gap between the legs
      if (d > 0) return false
      const inside = -d * 0.95, bev = 0.1
      s.h = 0.14 * (inside >= bev ? 1 : Math.sqrt(1 - (1 - inside / bev) ** 2))
      const grain = Math.sin(x * 26 + 4.5 * fbm(x * 1.6 + 2, y * 5, 3))
      s.a = 0.24 + 0.16 * grain + 0.08 * (fbm(x * 12, y * 3, 2) - 0.5)
      s.g = 0.2
      return true
    },
  },

  // 12-inch record: rolled rim, banded tracks with an anisotropic sheen, dead wax, printed label, spindle hole.
  record: {
    shin: 40, angle0: 30,
    f(x, y, s) {
      const r = Math.hypot(x, y)
      if (r > 0.95 || r < 0.045) return false
      const th = Math.atan2(y, x)
      s.h = 0.05; s.g = 0.25; s.e = 0
      if (r > 0.925) { s.h = 0.03 + 0.03 * dome(r - 0.925, 0.025); s.a = 0.85; s.g = 0.6; return true }
      if (r > 0.335) {
        s.a = 0.9
        const gaps = [0.5, 0.625, 0.745, 0.855]
        let land = 0
        for (const gr of gaps) land = Math.max(land, smooth(0.03, 0.016, Math.abs(r - gr)))
        const c = Math.abs(Math.cos(th - LIGHT_ANG))
        const bow = Math.pow(c, 46) * 0.85 + Math.pow(c, 6) * 0.12
        s.e = (1 - land) * bow * smooth(0.335, 0.4, r) * (0.75 + 0.25 * r)
        s.a = 0.92 - 0.58 * land
        s.g = 0.25 + 0.5 * land
        return true
      }
      // paper label (printed): light ground, a bold ring, a quarter band, title rules
      s.h = 0.045; s.g = 0.05
      s.a = 0.04
      if (r > 0.29 && r < 0.312) s.a = 0.9
      if (r > 0.075 && r < 0.092) s.a = 0.85
      const rel = ((th + TAU) % TAU) / TAU
      if (r > 0.12 && r < 0.27 && rel > 0.06 && rel < 0.31) s.a = 0.8
      if (r > 0.12 && r < 0.26 && Math.abs(y - 0.165) < 0.018 && x < 0.12) s.a = 0.7
      if (r > 0.12 && r < 0.26 && Math.abs(y - 0.215) < 0.012 && x < 0.04) s.a = 0.6
      return true
    },
  },

  // Chess pawn: a lathe-turned solid of revolution (head, collar, flared stem, ring, base).
  pawn: {
    shin: 60, angle0: 0,
    f(x, y, s) {
      let w = 0, a = 0.74
      const seg = (v: number, m = 0.74) => { if (v > w) { w = v; a = m } }
      seg(0.255 * dome(y + 0.6, 0.255)) // head
      seg(0.2 + 0.075 * dome(y + 0.305, 0.04), 0.6) // collar
      if (y > -0.33 && y < 0.46) { const t = (y + 0.33) / 0.79; seg(0.13 + 0.06 * t + 0.17 * Math.pow(t, 3.2)) } // flared stem
      seg(0.33 + 0.06 * dome(y - 0.475, 0.05), 0.6) // upper ring
      if (y > 0.51 && y < 0.58) seg(0.35, 0.9) // cove
      if (y > 0.56 && y < 0.88) { const t = Math.abs(y - 0.72) / 0.16; seg(0.49 * Math.pow(Math.max(0, 1 - Math.pow(t, 6)), 1 / 6), 0.66) } // base
      if (y > 0.84 && y < 0.9) seg(0.44 * dome(y - 0.84, 0.06) + 0.02, 0.6) // foot
      if (Math.abs(x) >= w) return false
      s.h = Math.sqrt(w * w - x * x)
      s.a = a + 0.06 * Math.sin(y * 90)
      s.g = 0.95
      return true
    },
  },
}

// ---------------------------------------------------------------- bake
interface Baked { dens: HTMLCanvasElement; mask: HTMLCanvasElement }
const baked = new Map<ShapeName, Baked>()

function bake(name: ShapeName): Baked {
  const hit = baked.get(name)
  if (hit) return hit
  const def = SHAPES[name]
  const H = new Float32Array(N * N), A = new Float32Array(N * N), G = new Float32Array(N * N), E = new Float32Array(N * N)
  const M = new Uint8Array(N * N)
  const s: Sm = { h: 0, a: 0.5, g: 0, e: 0 }
  for (let j = 0; j < N; j++) {
    const sk = def.k ?? 1
    const y = (((j + 0.5) / N) * 2 - 1) / sk
    for (let i = 0; i < N; i++) {
      const x = (((i + 0.5) / N) * 2 - 1) / sk
      s.h = 0; s.a = 0.5; s.g = 0; s.e = 0
      const k = j * N + i
      if (def.f(x, y, s)) { M[k] = 1; H[k] = s.h * sk; A[k] = s.a; G[k] = s.g; E[k] = s.e }
    }
  }
  let lx = -0.5, ly = -0.62, lz = 0.62
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll
  let hx = lx, hy = ly, hz = lz + 1
  const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl
  const step2 = 4 / N // 2 * pixel size in model units
  const mk = (w: number) => { const c = document.createElement('canvas'); c.width = c.height = w; return c }
  const dens = mk(N), mask = mk(N)
  const dImg = dens.getContext('2d')!.createImageData(N, N), mImg = mask.getContext('2d')!.createImageData(N, N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      if (!M[k]) continue
      const hl0 = i > 0 ? H[k - 1] : 0, hr = i < N - 1 ? H[k + 1] : 0
      const hu = j > 0 ? H[k - N] : 0, hd = j < N - 1 ? H[k + N] : 0
      let nx = -(hr - hl0) / step2, ny = -(hd - hu) / step2, nz = 1
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl
      const diff = Math.max(0, nx * lx + ny * ly + nz * lz)
      const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), def.shin)
      const rim = 1 - nz // edges darken a touch: keeps the silhouette crisp on paper
      const R = 1 - A[k]
      const radiance = R * (0.16 + 0.92 * diff) + G[k] * spec * 1.1 + E[k] - rim * rim * 0.42
      const dn = Math.pow(clamp01(1 - radiance), 1.22)
      dImg.data[k * 4 + 3] = Math.round(dn * 255)
      mImg.data[k * 4 + 3] = 255
    }
  }
  dens.getContext('2d')!.putImageData(dImg, 0, 0)
  mask.getContext('2d')!.putImageData(mImg, 0, 0)
  const b = { dens, mask }
  baked.set(name, b)
  return b
}

// Bake off the critical path: one shape per idle slice, deduped across mounts.
const pending = new Map<ShapeName, Promise<Baked>>()
function bakeLater(name: ShapeName): Promise<Baked> {
  const hit = baked.get(name)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(name)
  if (!p) {
    p = new Promise<Baked>(res => {
      const run = () => res(bake(name))
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined
      if (ric) ric(run, { timeout: 400 }); else setTimeout(run, 0)
    })
    pending.set(name, p)
  }
  return p
}

// Progressive downscale (box-ish) so the per-frame rotate is a ~2:1 bilinear fetch, not an aliased skip.
function downscale(src: HTMLCanvasElement, target: number): HTMLCanvasElement {
  let cur = src
  while (cur.width / 2 >= target) {
    const c = document.createElement('canvas'); c.width = c.height = Math.max(1, cur.width >> 1)
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height)
    cur = c
  }
  if (cur.width !== target) {
    const c = document.createElement('canvas'); c.width = c.height = Math.max(1, target)
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height)
    cur = c
  }
  return cur
}

// ---------------------------------------------------------------- mount
export function mountHalftone(canvas: HTMLCanvasElement, shape: ShapeName, opts: HalftoneOpts = {}): HalftoneHandle {
  const def = SHAPES[shape]
  const cell = opts.cell ?? 7
  const turn = opts.turnSeconds ?? 70
  const wantShadow = opts.shadow ?? true
  const fill = opts.fill ?? 1
  let ink = opts.ink ?? palette(state.night).ink
  const ctx = canvas.getContext('2d')!
  const lat = document.createElement('canvas')
  const lctx = lat.getContext('2d', { willReadFrequently: true })!
  let src: Baked | null = baked.get(shape) ?? null
  let densP: HTMLCanvasElement | null = null, maskP: HTMLCanvasElement | null = null
  let P = 0, L = 0, w = 0, h = 0, dpr = 1, objSize = 0
  let data: Uint8ClampedArray | null = null
  const base = ((opts.angle ?? def.angle0) * Math.PI) / 180
  let phase = 0 // radians of travel along the turn
  let localPaused = false, visible = true, hovering = false, disposed = false
  let raf = 0, last = 0, lastLattice = -1, hoverT0 = 0, breathK = 1
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reduced = () => state.reduced || reducedMq.matches

  const angle = () => (opts.sway ? base + ((opts.sway * Math.PI) / 180) * Math.sin(phase) : base + phase)

  function layout() {
    const rect = canvas.getBoundingClientRect()
    const nw = Math.max(1, Math.round(rect.width)), nh = Math.max(1, Math.round(rect.height))
    dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    w = nw; h = nh
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    objSize = Math.min(w, h) * fill
    L = Math.ceil(Math.hypot(w, h) / cell) + 3
    lat.width = lat.height = L
    const target = Math.max(16, Math.min(N, Math.round((objSize / cell) * 2)))
    if (src && target !== P) { P = target; densP = downscale(src.dens, P); maskP = downscale(src.mask, P) }
    lastLattice = -1
  }

  function lattice() {
    if (!densP || !maskP) return
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.globalCompositeOperation = 'source-over'
    lctx.clearRect(0, 0, L, L)
    const k = objSize / (P * cell)
    const t = angle() - Math.PI / 4
    const c = Math.cos(t) * k, sn = Math.sin(t) * k
    const e = L / 2 - (c * P / 2 - sn * P / 2), f = L / 2 - (sn * P / 2 + c * P / 2)
    lctx.imageSmoothingEnabled = true; lctx.imageSmoothingQuality = 'high'
    if (wantShadow) {
      const K = L * 4
      const sx = objSize * 0.035, sy = objSize * 0.05 // screen offset, light from the top left
      lctx.save()
      lctx.setTransform(c, sn, -sn, c, e + K, f)
      lctx.shadowOffsetX = -K + (sx * C45 + sy * C45) / cell
      lctx.shadowOffsetY = (-sx * C45 + sy * C45) / cell
      lctx.shadowBlur = Math.max(1, (objSize * 0.035) / cell)
      lctx.shadowColor = state.night ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)'
      lctx.drawImage(maskP, 0, 0)
      lctx.restore()
      lctx.globalCompositeOperation = 'destination-out'
      lctx.setTransform(c, sn, -sn, c, e, f)
      lctx.drawImage(maskP, 0, 0)
      lctx.globalCompositeOperation = 'source-over'
    }
    lctx.setTransform(c, sn, -sn, c, e, f)
    lctx.drawImage(densP, 0, 0)
    data = lctx.getImageData(0, 0, L, L).data
  }

  function dots(scale: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!data) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = ink
    ctx.beginPath()
    const rmax = cell * DOT * scale
    const cx = w / 2, cy = h / 2, half = L / 2
    const minR = 0.32 / Math.sqrt(dpr)
    for (let j = 0; j < L; j++) {
      const lj = j + 0.5 - half
      for (let i = 0; i < L; i++) {
        const d = data[(j * L + i) * 4 + 3]
        if (d < 4) continue
        const li = i + 0.5 - half
        const x = cx + (li - lj) * C45 * cell, y = cy + (li + lj) * C45 * cell
        const r = rmax * Math.sqrt(d / 255)
        if (r < minR || x < -r || y < -r || x > w + r || y > h + r) continue
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, TAU)
      }
    }
    ctx.fill()
  }

  function draw(now: number, forceLattice = false) {
    if (forceLattice || lastLattice < 0 || now - lastLattice >= 50) { lattice(); lastLattice = now }
    let sc = 1
    if (opts.breathe && !reduced()) {
      if (hovering) {
        const t = (now - hoverT0) / 1000
        sc = 0.96 + 0.04 * Math.cos((TAU * t) / 0.6) // 1.0 → 0.92 in 300 ms, back in 300 ms
        breathK = sc
      } else if (breathK < 1) {
        breathK = Math.min(1, breathK + 0.02); sc = breathK
      }
    }
    dots(sc)
  }

  const isPaused = () => localPaused || state.paused
  const spinning = () => visible && !isPaused() && !reduced()
  const breathing = () => !!opts.breathe && visible && !reduced() && (hovering || breathK < 1)

  function tick(now: number) {
    raf = 0
    if (disposed) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    const spin = spinning(), br = breathing()
    if (spin) phase += (dt * TAU) / (opts.sway ? Math.abs(turn) : turn)
    if (spin && now - lastLattice >= 50) draw(now, true)
    else if (br) draw(now)
    if (spin || br) raf = requestAnimationFrame(tick)
    else last = 0
  }
  function kick() { if (!raf && !disposed) { last = 0; raf = requestAnimationFrame(tick) } }
  function redrawNow() { if (w) draw(performance.now(), true) }

  layout(); redrawNow()
  if (!src) bakeLater(shape).then(b => { if (disposed) return; src = b; P = 0; layout(); redrawNow(); kick() })
  const ro = new ResizeObserver(() => { layout(); redrawNow(); kick() })
  ro.observe(canvas)
  const io = new IntersectionObserver(es => { for (const e of es) visible = e.isIntersecting; if (visible) kick() }, { rootMargin: '120px' })
  io.observe(canvas)
  const hoverEl = opts.hoverTarget ?? canvas
  const onEnter = () => { hovering = true; hoverT0 = performance.now(); kick() }
  const onLeave = () => { hovering = false; kick() }
  if (opts.breathe) { hoverEl.addEventListener('pointerenter', onEnter); hoverEl.addEventListener('pointerleave', onLeave) }
  const offPause = bus.on('pause', () => kick())
  const onMq = () => { redrawNow(); kick() }
  reducedMq.addEventListener('change', onMq)
  kick()

  return {
    setInk(c: string) { ink = c; if (data) dots(breathK) },
    setPaused(p: boolean) { localPaused = p; kick() },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect(); io.disconnect(); offPause()
      reducedMq.removeEventListener('change', onMq)
      hoverEl.removeEventListener('pointerenter', onEnter); hoverEl.removeEventListener('pointerleave', onLeave)
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
