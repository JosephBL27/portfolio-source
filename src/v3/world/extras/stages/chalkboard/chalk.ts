// Chalk on slate, drawn into a transparent canvas layer that the stage composites over the slate. What makes a line read as chalk and not as a
// vector stroke:
//   - pressure: every stroke is cut into short, fixed pieces along its length; each piece gets its own pressure (heavier where the stick lands, lighter
//     where it lifts, a slow wander, the odd skip where the stick barely touches), which sets its width and how much chalk it leaves
//   - translucency and a dusty edge: a wide faint pass under a narrower dense one, never fully opaque
//   - the slate's tooth: after each piece, the pits of a fixed binary grain are cut back out of the layer (destination-out), so the same pits stay
//     empty under every stroke, as on a real board; cutting twice changes nothing, so drawing a stroke in many frames or at once looks the same
//   - broken grain: small random holes punched along the piece (the technique of 0xmmo/chalkboard by Mohamed Moustafa, MIT, ported: clearRect specks
//     along the stroke), seeded per piece so a redraw is identical
//   - dots (a full stop, the top of a semicolon, an i): one pressed-and-turned dab with a dense core and no tooth or holes cut into it, so it stays a
//     point at the 4 px it is on a phone, where a stroke-sized hole would eat it
// The felt eraser (wipe) takes most of the chalk off a band and smears a haze of it along the stroke of the pad; haze() leaves what a wiped board keeps.
import { CHALK, mulberry32, pointAt, type ChalkStroke } from './hand'

const PIECE = 0.014     // board units per pressure piece

export class ChalkLayer {
  readonly canvas: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private tooth: CanvasPattern
  private felt: CanvasPattern
  /** pixels per board unit */
  constructor(w: number, h: number, readonly k: number, seed = 3) {
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h
    this.g = this.canvas.getContext('2d')!
    // the tooth: binary pits (about a quarter of the surface), clustered 1..3 px, tileable 192 px
    const n = 192, tc = document.createElement('canvas'); tc.width = tc.height = n
    const tg = tc.getContext('2d')!, im = tg.createImageData(n, n), d = im.data, rnd = mulberry32(seed)
    const cells = 64, grid = new Float32Array(cells * cells).map(() => rnd())
    const at = (i: number, j: number) => grid[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)]
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x * cells / n, fy = y * cells / n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
      const v = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
      const pit = v + (rnd() - 0.5) * 0.28 > 0.66
      d[(y * n + x) * 4 + 3] = pit ? 255 : 0
    }
    tg.putImageData(im, 0, 0)
    this.tooth = this.g.createPattern(tc, 'repeat')!
    // the felt: horizontal streaks of uneven pressure (what a felt pad leaves when it drags chalk across)
    const fc = document.createElement('canvas'); fc.width = 256; fc.height = 64
    const fg = fc.getContext('2d')!
    for (let y = 0; y < 64; y++) { const a = 0.6 + rnd() * 0.28; fg.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; fg.fillRect(0, y, 256, 1) }
    this.felt = this.g.createPattern(fc, 'repeat')!
  }

  clear() { this.g.clearRect(0, 0, this.canvas.width, this.canvas.height) }

  /** the pressure of piece i of a stroke (0.15..1.25): the landing, the lift, a slow wander, the odd skip */
  private pressure(s: ChalkStroke, i: number, n: number) {
    const r = mulberry32(s.seed + i * 131)
    const u = (i + 0.5) / n
    let p = s.press * (0.9 + 0.12 * Math.sin(i * 0.9 + s.seed) + 0.08 * Math.sin(i * 2.3 + s.seed * 0.37))
    if (u < 0.08) p *= 1.15                // the stick lands
    if (u > 0.88) p *= 0.72 + (1 - u) * 2  // and lifts
    if (r() < 0.05) p *= 0.22              // a skip
    return Math.max(0.15, Math.min(1.25, p))
  }

  /** one dab of the stick: two or three soft ellipses a little off one another, a dense core (the first call of a dot's stroke only) */
  private dab(s: ChalkStroke, f0: number, f1: number): [number, number] | null {
    if (f1 <= f0 || f0 > 0) return null
    const g = this.g, k = this.k, x = s.pts[0] * k, y = s.pts[1] * k, r = mulberry32(s.seed * 29 + 5)
    const R = s.w * k * 1.05 * (0.92 + 0.16 * s.press), [cr, cg, cb] = CHALK[s.chalk]
    const col = (a: number) => `rgba(${cr},${cg},${cb},${a})`
    g.save()
    for (let i = 0; i < 3; i++) {
      const rx = R * (0.78 + 0.25 * r()), ry = R * (0.7 + 0.25 * r()), ox = (r() - 0.5) * R * 0.5, oy = (r() - 0.5) * R * 0.5
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, Math.max(rx, ry))
      gr.addColorStop(0, col(0.96)); gr.addColorStop(0.6, col(0.86)); gr.addColorStop(1, col(0))
      g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, r() * Math.PI, 0, Math.PI * 2); g.fill()
    }
    g.restore()
    return [s.pts[0], s.pts[1]]
  }

  /** lay down the part of stroke s between fractions f0 and f1 of its length. Returns the board position of the tip (for the dust), or null. */
  span(s: ChalkStroke, f0: number, f1: number): [number, number] | null {
    if (f1 <= f0) return null
    if (s.dot) return this.dab(s, f0, f1)
    const g = this.g, k = this.k, a0 = s.len * f0, a1 = s.len * f1
    const n = Math.max(1, Math.ceil(s.len / PIECE))
    const [cr, cg, cb] = CHALK[s.chalk]
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
    g.save()
    g.lineJoin = 'round'
    const first = Math.floor(a0 / s.len * n), last = Math.min(n - 1, Math.floor(a1 / s.len * n - 1e-9))
    let tip: [number, number] | null = null
    for (let i = first; i <= last; i++) {
      const pa = Math.max(a0, (i / n) * s.len), pb = Math.min(a1, ((i + 1) / n) * s.len)
      if (pb <= pa) continue
      const p = this.pressure(s, i, n), wpx = s.w * k * (0.78 + 0.3 * p), al = Math.min(0.92, 0.42 + 0.42 * p)
      const [x0, y0, i0] = pointAt(s, pa), [x1, y1, i1] = pointAt(s, pb)
      const path = () => { g.beginPath(); g.moveTo(x0 * k, y0 * k); for (let j = i0; j < i1; j++) g.lineTo(s.pts[j * 2] * k, s.pts[j * 2 + 1] * k); g.lineTo(x1 * k, y1 * k) }
      // the stroke's ends are round, the joins between pieces butt (no bead where two pieces meet)
      const cap: CanvasLineCap = (pa <= 0 || pb >= s.len - 1e-6) ? 'round' : 'butt'
      g.lineCap = cap
      g.strokeStyle = `rgba(${cr},${cg},${cb},${(al * 0.28).toFixed(3)})`; g.lineWidth = wpx * 1.45; path(); g.stroke()
      g.strokeStyle = `rgba(${cr},${cg},${cb},${al.toFixed(3)})`; g.lineWidth = wpx; path(); g.stroke()
      // broken grain: specks punched out along the piece (seeded: a redraw is identical)
      const r = mulberry32(s.seed * 17 + i), len = (pb - pa) * k, holes = Math.round(len * (0.5 + (1.2 - p) * 0.9) * (wpx / 6))
      for (let h = 0; h < holes; h++) {
        const t = r(), hx = (x0 + (x1 - x0) * t) * k + (r() - 0.5) * wpx * 1.2, hy = (y0 + (y1 - y0) * t) * k + (r() - 0.5) * wpx * 1.2
        g.clearRect(hx, hy, (r() * 1.6 + 1) * (k / 600), (r() * 0.9 + 0.6) * (k / 600))
      }
      bx0 = Math.min(bx0, x0, x1); by0 = Math.min(by0, y0, y1); bx1 = Math.max(bx1, x0, x1); by1 = Math.max(by1, y0, y1)
      for (let j = i0; j < i1; j++) { bx0 = Math.min(bx0, s.pts[j * 2]); bx1 = Math.max(bx1, s.pts[j * 2]); by0 = Math.min(by0, s.pts[j * 2 + 1]); by1 = Math.max(by1, s.pts[j * 2 + 1]) }
      tip = [x1, y1]
    }
    // the tooth: cut the pits back out of everything just drawn
    if (bx0 < Infinity) {
      const pad = s.w * k * 1.2
      g.globalCompositeOperation = 'destination-out'
      g.fillStyle = this.tooth
      g.fillRect(bx0 * k - pad, by0 * k - pad, (bx1 - bx0) * k + pad * 2, (by1 - by0) * k + pad * 2)
    }
    g.restore()
    return tip
  }

  /** what a wiped board keeps: broad, faint, soft-ended smears of chalk dust lying along the pad's path (a haze, not a ghost of the writing). Laid over rows y0..y1
   *  (board units, y down) once the pad has crossed them; the hand then writes over it, and the next wipe takes most of it off again */
  haze(seed: number, y0 = 0, y1 = this.canvas.height / this.k) {
    const g = this.g, k = this.k, r = mulberry32(seed), w = this.canvas.width
    const n = Math.max(1, Math.round((y1 - y0) * 13))
    g.save()
    g.globalCompositeOperation = 'source-over'
    for (let i = 0; i < n; i++) {
      const cx = (0.1 + r() * 0.8) * w, cy = (y0 + (0.1 + r() * 0.8) * (y1 - y0)) * k, rx = (0.28 + r() * 0.5) * w * 0.5, ry = (0.05 + r() * 0.09) * k, a = 0.07 + r() * 0.08
      g.save(); g.translate(cx, cy); g.scale(rx / ry, 1); g.rotate((r() - 0.5) * 0.05)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry)
      gr.addColorStop(0, `rgba(226,230,222,${a.toFixed(3)})`); gr.addColorStop(0.55, `rgba(226,230,222,${(a * 0.55).toFixed(3)})`); gr.addColorStop(1, 'rgba(226,230,222,0)')
      g.fillStyle = gr; g.fillRect(-ry, -ry, ry * 2, ry * 2)
      g.restore()
    }
    g.restore()
  }

  /** the felt eraser crossed a band (board units, y down): take most of the chalk off it and smear a faint haze of it along the pad's path */
  wipe(x0: number, x1: number, y0: number, y1: number, seed: number) {
    const g = this.g, k = this.k
    const px = Math.min(x0, x1) * k, pw = Math.abs(x1 - x0) * k, py = Math.min(y0, y1) * k, ph = Math.abs(y1 - y0) * k
    if (pw <= 0 || ph <= 0) return
    g.save()
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = this.felt
    g.fillRect(px, py, pw, ph)
    g.globalCompositeOperation = 'source-over'
    const r = mulberry32(seed)
    for (let i = 0; i < 4; i++) {
      const y = py + r() * ph
      g.fillStyle = `rgba(226,230,222,${(0.02 + r() * 0.03).toFixed(3)})`
      g.fillRect(px, y, pw, (0.004 + r() * 0.012) * k)
    }
    g.restore()
  }
}
