// What a classroom slate looks like before anyone writes on it today: a near-black green slate with a fine grain, a soft mottle, the cloudy residue of
// years of erasures (Poly Haven "Standing Chalkboard 01" wipe streaks, CC0, ParzivalCG: public/media/chalk/slate-wipes.webp), the faint ghosts of old
// writing, a few felt-pad arcs, and the frame's shadow along the inside edge. Drawn once into two canvases: the colour (the live chalk is composited
// over a copy of it) and the roughness (G channel: residue is chalkier and duller than clean slate). A small tileable grain height becomes the normal
// map, so the classroom's raking key light picks the slate's tooth out. Deterministic (seeded); nothing here is text a visitor could read.
import { mulberry32, type HandFont } from './hand'

export interface SlateBase { albedo: HTMLCanvasElement; rough: HTMLCanvasElement; /** the longest stretch the main thread was held, in ms (the probes read it) */ maxChunkMs: number }
const tick = () => new Promise<void>(res => setTimeout(res, 0))

const BASE = import.meta.env.BASE_URL
let wipesP: Promise<HTMLImageElement | null> | null = null
/** the wipe-streak photograph (grey, 1016 x 1512); null if it fails (the slate is then drawn without it) */
export function loadWipes(): Promise<HTMLImageElement | null> {
  return (wipesP ??= new Promise(res => {
    const im = new Image(); im.decoding = 'async'
    im.onload = () => res(im); im.onerror = () => res(null)
    im.src = `${BASE}media/chalk/slate-wipes.webp`
  }))
}

export async function paintSlate(w: number, h: number, bw: number, font: HandFont, wipes: HTMLImageElement | null, seed = 11): Promise<SlateBase> {
  const k = w / bw, rnd = mulberry32(seed)
  // painted in slices with a yield between them (the whole is about 70 ms of main-thread work, in one piece it would be a long task as the stop is approached)
  let last = performance.now(), maxChunkMs = 0
  const lap = async () => { const t = performance.now(); maxChunkMs = Math.max(maxChunkMs, t - last); await tick(); last = performance.now() }
  /** run fn over [0, n) in `parts` slices, yielding between them (the order is unchanged, so a seeded loop gives the same pixels) */
  const sliced = async (n: number, parts: number, fn: (a: number, b: number) => void) => { for (let p = 0; p < parts; p++) { fn(Math.floor(n * p / parts), Math.floor(n * (p + 1) / parts)); await lap() } }
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const albedo = mk(), rough = mk()
  const a = albedo.getContext('2d')!, r = rough.getContext('2d')!
  // slate: very dark green-black (display-referred; the material adds no tint), satin (roughness 0.62)
  a.fillStyle = '#1d2521'; a.fillRect(0, 0, w, h)
  r.fillStyle = 'rgb(0, 158, 0)'; r.fillRect(0, 0, w, h)

  // 1. a soft mottle: big, faint blobs a shade lighter and darker (real slate is never one flat colour)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, rad = (0.25 + rnd() * 0.6) * k, lighter = rnd() < 0.5
    const gr = a.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, lighter ? 'rgba(54, 64, 58, 0.16)' : 'rgba(8, 12, 10, 0.2)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)')
    a.fillStyle = gr; a.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  await lap()

  // 2. the residue of old erasures: the photographed wipe streaks, levelled to a chalk-dust alpha (rotated a quarter turn onto a wide board)
  if (wipes) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d')!
    g.save()
    if (w > h) { g.translate(w, 0); g.rotate(Math.PI / 2); g.drawImage(wipes, 0, 0, h, w) } else g.drawImage(wipes, 0, 0, w, h)
    g.restore()
    await lap()
    const im = g.getImageData(0, 0, w, h), d = im.data
    // levels: the photograph's grey runs about 185..250; the brighter (rougher) streaks are chalk dust
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++
    const pct = (q: number) => { let s = 0; const n = d.length / 4; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= q * n) return v } return 255 }
    const lo = pct(0.35), hi = Math.max(lo + 8, pct(0.995))
    await sliced(d.length / 4, 4, (p0, p1) => {
      for (let j = p0; j < p1; j++) {
        const i = j * 4, t = Math.max(0, Math.min(1, (d[i] - lo) / (hi - lo)))
        const al = Math.pow(t, 1.6)
        d[i] = 196; d[i + 1] = 204; d[i + 2] = 196; d[i + 3] = Math.round(al * 255)
      }
    })
    g.putImageData(im, 0, 0)
    await lap()
    a.save(); a.globalAlpha = 0.13; a.drawImage(c, 0, 0); a.restore()
    // residue is chalkier: rougher
    r.save(); r.globalAlpha = 0.5; r.globalCompositeOperation = 'lighter'
    const rc = document.createElement('canvas'); rc.width = w; rc.height = h
    const rg = rc.getContext('2d')!; rg.drawImage(c, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgb(0, 80, 0)'; rg.fillRect(0, 0, w, h)
    r.drawImage(rc, 0, 0); r.restore()
    await lap()
  }

  // the shadow-only trick: the shape is drawn far off the canvas and only its blurred shadow lands (works in every browser, unlike ctx.filter)
  const ghost = (g: CanvasRenderingContext2D, colour: string, blur: number, fn: () => void) => {
    g.save(); g.shadowColor = colour; g.shadowBlur = blur; g.shadowOffsetX = 20000; g.translate(-20000, 0); g.strokeStyle = colour; g.lineCap = 'round'; g.lineJoin = 'round'
    fn(); g.restore()
  }
  // 3. felt-pad arcs: the broad cloudy sweeps an eraser leaves, a few parallel streaks each
  for (let i = 0; i < 9; i++) {
    const y = rnd() * h, x0 = (rnd() * 0.5 - 0.1) * w, x1 = x0 + (0.45 + rnd() * 0.6) * w, bow = (rnd() - 0.5) * 0.3 * h, wd = (0.08 + rnd() * 0.1) * k, drift = (rnd() - 0.5) * 0.14 * h
    for (let j = 0; j < 5; j++) {
      const off = (j - 2) * wd * 0.24 + (rnd() - 0.5) * wd * 0.1, al = 0.018 + rnd() * 0.026
      ghost(a, `rgba(205, 212, 204, ${al})`, wd * 0.22, () => { a.lineWidth = wd * 0.3; a.beginPath(); a.moveTo(x0, y + off); a.quadraticCurveTo((x0 + x1) / 2, y + off + bow, x1, y + off + drift); a.stroke() })
    }
    await lap()      // a blurred shadow is the costly part of a canvas: one arc (five of them) per slice
  }
  await lap()
  // 4. ghosts of old writing: lines of letters in chalk white, blurred and nearly gone
  const chars = 'abcdefghiklmnoprstuxyACDEFILMPQRSTU'.split('').filter(ch => font.glyphs[ch])
  for (let li = 0; li < 9; li++) {
    const em = (0.1 + rnd() * 0.1) * k, x0 = (0.1 + rnd() * (bw - 1.2)) * k, y0 = (0.25 + (li + rnd() * 0.6) * (h / k - 0.3) / 9) * k, rot = (rnd() - 0.5) * 0.08, n = 5 + Math.floor(rnd() * 12)
    const al = 0.035 + rnd() * 0.04
    let x = 0
    const strokes: number[][] = []
    for (let c = 0; c < n; c++) {
      const g = font.glyphs[chars[Math.floor(rnd() * chars.length)]]
      if (!g) continue
      if (rnd() < 0.14) { x += 0.4 * em; continue }
      const kk = em / font.upm
      for (const st of g.strokes) { const p: number[] = []; for (let i = 0; i < st.length; i += 2) p.push(x + st[i] * kk, -st[i + 1] * kk); strokes.push(p) }
      x += g.adv * kk
    }
    ghost(a, `rgba(214, 220, 212, ${al})`, 4 * (w / 2048), () => {
      a.lineWidth = 0.011 * k
      a.save(); a.translate(x0, y0); a.rotate(rot)
      for (const p of strokes) { a.beginPath(); a.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) a.lineTo(p[i], p[i + 1]); a.stroke() }
      a.restore()
    })
    if (li % 3 === 2) await lap()
  }

  await lap()
  // 5. the grain: per-pixel speckle a hair lighter and darker (the slate's tooth), a few chips of permanent dust
  {
    const im = a.getImageData(0, 0, w, h), d = im.data, rr = mulberry32(seed * 3 + 1)
    await lap()
    await sliced(d.length / 4, 4, (p0, p1) => {
      for (let j = p0; j < p1; j++) {
        const i = j * 4, n = (rr() + rr() - 1) * 3.5
        d[i] = Math.max(0, d[i] + n); d[i + 1] = Math.max(0, d[i + 1] + n); d[i + 2] = Math.max(0, d[i + 2] + n)
      }
    })
    a.putImageData(im, 0, 0)
    await lap()
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = rnd() * h, rad = (0.0015 + rnd() * 0.003) * k
    a.fillStyle = `rgba(210, 214, 206, ${0.12 + rnd() * 0.2})`; a.beginPath(); a.arc(x, y, rad, 0, Math.PI * 2); a.fill()
  }

  // 6. the frame's soft shadow along the inside edge (the rails stand proud of the slate), heavier along the top (the key comes from above)
  const edge = 0.045 * k
  for (const [x0, y0, x1, y1, rx, ry, rw, rh, al] of [[0, 0, 0, edge * 1.4, 0, 0, w, edge * 1.4, 0.5], [0, h, 0, h - edge, 0, h - edge, w, edge, 0.3], [0, 0, edge, 0, 0, 0, edge, h, 0.42], [w, 0, w - edge, 0, w - edge, 0, edge, h, 0.32]] as number[][]) {
    const gr = a.createLinearGradient(x0, y0, x1, y1)
    gr.addColorStop(0, `rgba(4, 6, 5, ${al})`); gr.addColorStop(1, 'rgba(4, 6, 5, 0)')
    a.fillStyle = gr; a.fillRect(rx, ry, rw, rh)
  }
  await lap()
  return { albedo, rough, maxChunkMs }
}

/** a tileable grain height (value noise at two scales) turned into a tangent-space normal map, RGB, n x n */
export function grainNormal(n = 256, seed = 5, strength = 2.2): HTMLCanvasElement {
  const rnd = mulberry32(seed)
  const grid = (cells: number) => { const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = rnd(); return g }
  const sample = (g: Float32Array, cells: number, x: number, y: number) => {
    const fx = x * cells / n, fy = y * cells / n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    const at = (i: number, j: number) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)]
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy
  }
  const g1 = grid(64), g2 = grid(128), g3 = grid(16)
  const hgt = new Float32Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) hgt[y * n + x] = sample(g1, 64, x, y) * 0.55 + sample(g2, 128, x, y) * 0.3 + sample(g3, 16, x, y) * 0.15
  const c = document.createElement('canvas'); c.width = c.height = n
  const g = c.getContext('2d')!, im = g.createImageData(n, n), d = im.data
  const H = (x: number, y: number) => hgt[((y + n) % n) * n + ((x + n) % n)]
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4
    d[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); d[i + 1] = Math.round((dy / l * 0.5 + 0.5) * 255); d[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); d[i + 3] = 255
  }
  g.putImageData(im, 0, 0)
  return c
}
