// The 3D name's geometry: loads the baked Bodoni typeface (public/models/type-bodoni.json, built by scripts/build-type.mjs), lays
// "JOSEPH" over "BLUMBERG" exactly as forms/name.ts lays the particle letters (BLUMBERG is WIDTH wide, the lines are centred on their ink,
// the gap is 0.3 of the taller line), and extrudes every letter into its own geometry, centred on itself so it can tumble about its middle.
// Glyph outlines are shared: the two B's and the two E's use one geometry.
import * as THREE from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface TypeJSON {
  resolution: number
  glyphs: Record<string, { ha: number; x_min: number; x_max: number; y_min: number; y_max: number; o: string }>
  lines: { text: string; x: number[]; advance: number }[]
}
export interface Letter {
  ch: string; line: number; index: number
  geo: THREE.BufferGeometry
  /** centre of the letter in the name's local frame (the placement point is the origin, +z toward the viewer) */
  x: number; y: number; z: number
  w: number; h: number
}
export interface TypeLayout { letters: Letter[]; width: number; height: number; depth: number; tris: number }
export interface TypeOpts {
  /** world width of the BLUMBERG line (forms/name.ts WIDTH) */
  width: number
  /** extrusion depth (world); the FRONT face sits at z = front */
  depth: number
  front: number
  /** polygon budget: curve segments per quadratic */
  curveSegments: number
  bevelSegments: number
  /** extra space between neighbouring letters, world units BEFORE the row is rescaled to `width`: the whole row (letters and gaps alike) is scaled down
   *  so BLUMBERG stays `width` wide, which keeps every pair of neighbours clear of each other (the bevelled walls no longer touch) */
  tracking?: number
  /** multiplier on the bevel (1 = the old polished-chrome bevel; ~0.25 = a hairline edge) */
  bevelScale?: number
}

export async function loadType(url: string): Promise<TypeJSON> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`type: ${url} ${r.status}`)
  return (await r.json()) as TypeJSON
}

export function buildLayout(json: TypeJSON, o: TypeOpts): TypeLayout {
  const font = new Font(json as never)
  const U = json.resolution            // font units per em
  const lines = json.lines
  const inkX = lines.map(L => {
    const g0 = json.glyphs[L.text[0]], gN = json.glyphs[L.text[L.text.length - 1]]
    return [L.x[0] + g0.x_min, L.x[L.x.length - 1] + gN.x_max] as [number, number]
  })
  // BLUMBERG (the last line) is the reference width, as in forms/name.ts
  const ref = inkX[inkX.length - 1]
  const nRef = lines[lines.length - 1].text.length
  const track0 = o.tracking ?? 0
  // the reference line grows by (nRef - 1) tracking gaps: shrink everything so it is `width` wide again
  const shrink = o.width / (o.width + (nRef - 1) * track0)
  const em = (o.width / ((ref[1] - ref[0]) / U)) * shrink  // world units per em
  const track = track0 * shrink
  const inkY = lines.map(L => {
    let lo = 1e9, hi = -1e9
    for (const ch of L.text) { const g = json.glyphs[ch]; lo = Math.min(lo, g.y_min); hi = Math.max(hi, g.y_max) }
    return [lo, hi] as [number, number]
  })
  const hLine = inkY.map(([lo, hi]) => ((hi - lo) / U) * em)
  const gap = 0.3 * Math.max(...hLine)
  const total = hLine.reduce((a, b) => a + b, 0) + gap * (lines.length - 1)
  // line tops (world y of the ink's top edge), first line on top
  const tops: number[] = []
  let yy = total / 2
  for (let k = 0; k < lines.length; k++) { tops.push(yy); yy -= hLine[k] + gap }

  // geometry per glyph (cached)
  const bk = o.bevelScale ?? 1
  const bevelT = 0.012 * em * bk, bevelS = 0.0025 * em * bk, bevelO = 0.0035 * em   // hairlines are 2/1000 em: the cap is grown a little so they survive at screen scale
  const cache = new Map<string, { geo: THREE.BufferGeometry; cx: number; cy: number; cz: number; w: number; h: number }>()
  let tris = 0
  const glyph = (ch: string) => {
    let c = cache.get(ch)
    if (c) return c
    const shapes = font.generateShapes(ch, em)
    const ex = new THREE.ExtrudeGeometry(shapes, { depth: o.depth - 2 * bevelT, steps: 1, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelOffset: bevelO, bevelSegments: o.bevelSegments, curveSegments: o.curveSegments })
    // ExtrudeGeometry is non-indexed with flat normals: re-smooth across the curved walls, keep the hard edges of the serifs
    const geo = toCreasedNormals(ex, (38 * Math.PI) / 180)
    ex.dispose()
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2
    geo.translate(-cx, -cy, -cz)
    c = { geo, cx, cy, cz, w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y }
    cache.set(ch, c)
    return c
  }

  const letters: Letter[] = []
  lines.forEach((L, k) => {
    const cxLine = (inkX[k][0] + inkX[k][1]) / 2
    const baseY = tops[k] - (inkY[k][1] / U) * em
    for (let j = 0; j < L.text.length; j++) {
      const ch = L.text[j]
      const g = glyph(ch)
      const ox = ((L.x[j] - cxLine) / U) * em + (j - (L.text.length - 1) / 2) * track
      // the geometry was centred on its bbox: put its centre back where the glyph's centre sits. The extrusion is o.depth thick, front at z = o.front.
      letters.push({ ch, line: k, index: j, geo: g.geo, x: ox + g.cx, y: baseY + g.cy, z: o.front - o.depth / 2, w: g.w, h: g.h })
    }
  })
  for (const g of cache.values()) tris += (g.geo.getAttribute('position').count / 3) | 0
  return { letters, width: o.width, height: total, depth: o.depth, tris }
}
