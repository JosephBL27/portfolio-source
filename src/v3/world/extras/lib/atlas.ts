// A crisp text atlas: lines of type rasterised once into a canvas, packed on shelves, converted to a single-channel
// (R8) mipmapped texture. Sampled with trilinear + anisotropy it stays sharp at every distance (no pixel noise).
// Monospace lines are drawn cell by cell (each glyph centred in a fixed cell), so a shader can address character i
// exactly (typing, decode-from-scramble) even when a glyph falls back to another font.
import * as THREE from 'three'

export type FontKind = 'mono' | 'serif' | 'roman'
export interface LineSpec { key: string; text: string; kind: FontKind; px: number }
/** a packed line: the uv rectangle of its text area (v0 = top row, v1 = bottom row; DataTexture rows run top to bottom), size in atlas px, and the cell grid */
export interface Slot { u0: number; v0: number; u1: number; v1: number; w: number; h: number; n: number; cell: number }

const MATH = '"STIX Two Text", "STIX Two Math", "Cambria Math", "Apple Symbols", "Times New Roman", serif'
export const fontOf = (kind: FontKind, px: number) =>
  kind === 'mono' ? `500 ${px}px "IBM Plex Mono", "Apple Symbols", Menlo, ui-monospace, monospace`
    : kind === 'serif' ? `italic 400 ${px}px "Instrument Serif", ${MATH}`
      : `400 ${px}px "Instrument Serif", ${MATH}`

/** make sure the web fonts the atlas draws with are really loaded (a canvas draws a fallback face otherwise); never waits more than `ms` */
export async function loadFonts(ms = 4500) {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const jobs = [
    document.fonts.load('500 48px "IBM Plex Mono"', '0123456789×÷−ABC'),
    document.fonts.load('400 48px "Instrument Serif"', 'Aa0'),
    document.fonts.load('italic 400 48px "Instrument Serif"', 'Aa0'),
  ]
  await Promise.race([Promise.allSettled(jobs), new Promise(r => setTimeout(r, ms))])
}

const PAD = 12
export function buildAtlas(W: number, H: number, specs: LineSpec[], anisotropy = 8, opts: { cellW?: number } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#fff'; g.textBaseline = 'middle'
  const slots = new Map<string, Slot>()
  let x = PAD, y = PAD, shelf = 0, dropped = 0
  for (const s of specs) {
    if (slots.has(s.key)) continue
    const font = fontOf(s.kind, s.px); g.font = font
    const h = Math.ceil(s.px * 1.5)
    let w: number, cell = 0, n = Math.max(1, [...s.text].length)
    if (s.kind === 'mono') { cell = Math.ceil(g.measureText('0').width); w = n * cell } else { w = Math.ceil(g.measureText(s.text).width) + 4; cell = w / n }
    if (x + w + PAD > W) { x = PAD; y += shelf + PAD * 2; shelf = 0 }
    if (y + h + PAD > H) { dropped++; continue }
    if (s.kind === 'mono') {
      g.textAlign = 'center'
      let i = 0
      for (const ch of s.text) { if (ch !== ' ') g.fillText(ch, x + (i + 0.5) * cell, y + h / 2); i++ }
    } else { g.textAlign = 'left'; g.fillText(s.text, x + 2, y + h / 2) }
    slots.set(s.key, { u0: x / W, v0: y / H, u1: (x + w) / W, v1: (y + h) / H, w, h, n, cell })
    x += w + PAD * 2; shelf = Math.max(shelf, h)
  }
  if (dropped) console.warn(`[atlas] ${dropped} lines did not fit in ${W}x${H}`)
  const rgba = g.getImageData(0, 0, W, H).data
  const data = new Uint8Array(W * H)
  for (let i = 0, j = 3; i < data.length; i++, j += 4) data[i] = rgba[j]
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType)
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = anisotropy; tex.flipY = false; tex.unpackAlignment = 1
  tex.needsUpdate = true
  return { tex, slots, canvas: cv }
}
