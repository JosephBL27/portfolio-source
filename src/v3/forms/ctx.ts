import type { BuildCtx } from './types'
// mulberry32
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export function makeCtx(id: string, count: number): BuildCtx {
  return {
    count,
    rand: seeded(hashStr(id)),
    async image(url, maxSide = 512) {
      const img = new Image(); img.decoding = 'async'; img.src = url
      await img.decode()
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0, w, h)
      return g.getImageData(0, 0, w, h)
    },
    async textMask(text, { font, width, height, align = 'center' }) {
      try { await document.fonts.load(font) } catch {}
      const c = document.createElement('canvas'); c.width = width; c.height = height
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.fillStyle = '#fff'; g.font = font; g.textAlign = align; g.textBaseline = 'middle'
      const lines = text.split('\n'), lh = height / lines.length
      lines.forEach((ln, i) => g.fillText(ln, align === 'center' ? width / 2 : align === 'right' ? width : 0, lh * (i + 0.5)))
      return g.getImageData(0, 0, width, height)
    },
  }
}
/** Helpers forms commonly need */
export const H = {
  /** set particle i: position + data w, colour rgba */
  set(pos: Float32Array, col: Float32Array, i: number, x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) {
    const k = i * 4; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; pos[k + 3] = w; col[k] = r; col[k + 1] = g; col[k + 2] = b; col[k + 3] = a
  },
  hex(c: string): [number, number, number] { const n = parseInt(c.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] },
  /** fill particles [from, count) with a faint dust shell so unused particles never pile up */
  dust(pos: Float32Array, col: Float32Array, from: number, count: number, rand: () => number, radius = 7, alpha = 0.08, tint: [number, number, number] = [0.9, 0.88, 0.82]) {
    for (let i = from; i < count; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, r = radius * (0.55 + 0.45 * Math.cbrt(rand()))
      const s = Math.sqrt(1 - u * u)
      H.set(pos, col, i, Math.cos(th) * s * r, u * r * 0.6, Math.sin(th) * s * r - 2, 0, tint[0], tint[1], tint[2], alpha * rand())
    }
  },
  /** sample N points from a mask (ImageData alpha or luminance), returns pixel coords */
  sampleMask(img: ImageData, n: number, rand: () => number, useLuma = false, threshold = 0.5): [number, number, number][] {
    const out: [number, number, number][] = []
    const { width: w, height: h, data } = img
    const ok: number[] = []
    for (let i = 0; i < w * h; i++) { const v = useLuma ? (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255 : data[i * 4 + 3] / 255; if (v >= threshold) ok.push(i) }
    if (!ok.length) return out
    for (let k = 0; k < n; k++) { const i = ok[Math.floor(rand() * ok.length)]; out.push([(i % w) + rand(), Math.floor(i / w) + rand(), i]) }
    return out
  },
}
