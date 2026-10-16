// v11 declutter: where the picture's SUBJECT, the COPY and the HUD are on screen, so the TVs and the atmosphere (glyphs, rings, mirror) can keep out.
//
//   subject: the projected bounds of the particle form(s) on screen. Read from the morph shader's own bound state (uPosA / uPosB / uPlaceA / uPlaceB /
//            uScaleA / uScaleB: exactly what is drawn), a sample of each form's visible particles projected through the camera, the 1.5..98.5 percentile
//            box of that cloud, padded. Forms that ARE the hub (the clouds, the name, the orbits, the closing line) are not subjects: the hub TV may sit with them.
//   copy:    boxes of the visible overlays: landscape = the lane (header + info as one column), a centred overlay or a phone = its header and info separately.
//   hud:     the identity, nav, toggles, readout, counter, area rail, the ring radar (bottom-left), the next-stop cue and the brain's colour key
//            (used only when placing the featured TV, and by the label tags in ui/anchors.ts and the hall's walk panel as their own keep-clear list).
//
//   zones = subject + copy: nothing solid (a TV) and nothing glowing (a ring, a line of type) may sit inside a zone.
//   findSlot(): the one place a featured TV may sit at an area waypoint: a small reserved spot, lower corner on the side opposite the copy, clear of every zone.
//   HOLES: the same zones as a shader uniform (client px -> gl_FragCoord uv), for the extras' fragment shaders (`holeMask(uv)`).
import * as THREE from 'three'

export interface Box { l: number; t: number; r: number; b: number }
export interface Slot { x: number; y: number; r: number; box: Box }

/** forms whose point is the hub TV itself: no subject zone while one of these is on screen */
export const HUB_OWNED = new Set(['fog', 'name', 'orbits', 'epilogue'])

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/** intersection area (px^2) of two boxes, `m` px of margin added to the first */
export function overlap(a: Box, b: Box, m = 0): number {
  const w = Math.min(a.r + m, b.r) - Math.max(a.l - m, b.l), h = Math.min(a.b + m, b.b) - Math.max(a.t - m, b.t)
  return w > 0 && h > 0 ? w * h : 0
}
export const hitsAny = (a: Box, list: readonly Box[], m = 0) => { for (const z of list) if (overlap(a, z, m) > 0) return true; return false }

// ---------------------------------------------------------------------------------------------- subject
const K = 2400
const samples = new WeakMap<object, Float32Array>()
/** xyz triples of ~K visible particles of a form (rest positions), cached per position texture (a rebuilt form is a new texture) */
function samplesOf(pos: THREE.Texture, col: THREE.Texture): Float32Array | null {
  const hit = samples.get(pos); if (hit) return hit
  const P = (pos.image as { data?: Float32Array } | undefined)?.data, C = (col.image as { data?: Float32Array } | undefined)?.data
  if (!P || !C) return null
  const n = P.length >> 2, stride = Math.max(1, Math.floor(n / K))
  const out: number[] = []
  for (let i = 0; i < n; i += stride) { const k = i * 4; if (C[k + 3] > 0.25) out.push(P[k], P[k + 1], P[k + 2]) }
  if (out.length < 90) return null
  const f = new Float32Array(out); samples.set(pos, f); return f
}
const bx = new Float32Array(K + 8), by = new Float32Array(K + 8)
/** 1.5..98.5 percentile box (client px) of the form's samples placed in the world and projected; null if too few are in front of the camera */
function projectForm(s: Float32Array, pl: THREE.Vector4, sc: number, pv: THREE.Matrix4, cr: DOMRect, out: Box): boolean {
  const e = pv.elements, c = Math.cos(pl.w), q = Math.sin(pl.w)
  let n = 0
  for (let i = 0; i < s.length; i += 3) {
    const px = s[i] * sc, py = s[i + 1] * sc, pz = s[i + 2] * sc
    const wx = c * px + q * pz + pl.x, wy = py + pl.y, wz = -q * px + c * pz + pl.z
    const w = e[3] * wx + e[7] * wy + e[11] * wz + e[15]
    if (w < 0.3) continue
    const cx = e[0] * wx + e[4] * wy + e[8] * wz + e[12], cy = e[1] * wx + e[5] * wy + e[9] * wz + e[13]
    bx[n] = cr.left + (cx / w * 0.5 + 0.5) * cr.width; by[n] = cr.top + (-cy / w * 0.5 + 0.5) * cr.height; n++
  }
  if (n < 60) return false
  const X = bx.subarray(0, n).sort(), Y = by.subarray(0, n).sort()
  const lo = Math.floor(n * 0.015), hi = Math.min(n - 1, Math.ceil(n * 0.985))
  const w = X[hi] - X[lo], h = Y[hi] - Y[lo], pad = 0.02 * Math.max(w, h) + 8
  out.l = X[lo] - pad; out.r = X[hi] + pad; out.t = Y[lo] - pad; out.b = Y[hi] + pad
  return true
}

// ---------------------------------------------------------------------------------------------- DOM
const boxOf = (e: Element | null): Box | null => {
  if (!(e instanceof HTMLElement) || !e.offsetWidth || !e.offsetHeight) return null
  const r = e.getBoundingClientRect()
  return r.width * r.height < 16 ? null : { l: r.left, t: r.top, r: r.right, b: r.bottom }
}
const unite = (a: Box | null, b: Box | null): Box | null => (!a ? b : !b ? a : { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) })

export interface OccCtx { camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; points: THREE.Points; shown: { a: string; b: string; mix: number } }

class Occlusion {
  subject: Box[] = []
  copy: Box[] = []
  hud: Box[] = []
  /** subject + copy */
  zones: Box[] = []
  /** side of the screen the copy sits on: -1 left, +1 right, 0 none / centred */
  copySide = 0
  private domAt = -1e9; private subjAt = -1e9; private vw = 0; private vh = 0
  private pv = new THREE.Matrix4()
  private tA = new THREE.Vector4(); private tB = new THREE.Vector4()

  update(c: OccCtx, now: number) {
    const vw = innerWidth, vh = innerHeight
    const resized = vw !== this.vw || vh !== this.vh
    if (resized || now - this.domAt > 140) { this.domAt = now; this.vw = vw; this.vh = vh; this.readDom(vw) }
    if (resized || now - this.subjAt > 45) { this.subjAt = now; this.readSubject(c) }
    this.zones.length = 0
    for (const b of this.subject) this.zones.push(b)
    for (const b of this.copy) this.zones.push(b)
  }

  private readDom(vw: number) {
    this.copy.length = 0; this.hud.length = 0
    let left = 0, right = 0
    document.querySelectorAll<HTMLElement>('.ov.vis').forEach(ov => {
      const h = boxOf(ov.querySelector('.head')), i = boxOf(ov.querySelector('.info')), u = unite(h, i)
      // landscape: a lane (header + info are one column). A centred overlay, or a phone: the two blocks on their own
      const lane = !(ov.classList.contains('k-epilogue') || ov.classList.contains('k-name') || ov.classList.contains('k-prologue'))   // the closing, the name and the epigraph are blocks, not a lane
      if (lane && vw > 760 && u && u.r - u.l < vw * 0.62) { this.copy.push(u); if ((u.l + u.r) / 2 < vw / 2) left++; else right++ }
      else { if (h) this.copy.push(h); if (i) this.copy.push(i) }
    })
    this.copySide = left > right ? -1 : right > left ? 1 : 0
    // wave 24: the ring radar (.mm-hud, 88 px, bottom-left) and the next-stop cue (.next) are HUD too: the featured TV and its "<NAME> OPEN" label used to land on the radar
    // at six stops. The brain's colour key counts only while it is shown (.on).
    document.querySelectorAll<HTMLElement>('#hud .id, #hud .rt, #hud .ct, #hud .ro, #hud .rail, #hud .tg, #hud .mm-hud, #hud .next, .brain-key.on').forEach(e => { const b = boxOf(e); if (b) this.hud.push(b) })
  }

  private readSubject(c: OccCtx) {
    this.subject.length = 0
    const m = c.points.material as THREE.ShaderMaterial, u = m.uniforms
    if (!u.uPosA) return
    c.camera.updateMatrixWorld()
    this.pv.multiplyMatrices(c.camera.projectionMatrix, c.camera.matrixWorldInverse)
    const cr = c.canvas.getBoundingClientRect(), mix = c.shown.mix
    const sides = [
      { id: c.shown.a, w: 1 - sstep(0.8, 1, mix), pos: u.uPosA.value, col: u.uColA.value, pl: u.uPlaceA.value, sc: u.uScaleA.value },
      { id: c.shown.b, w: sstep(0, 0.2, mix), pos: u.uPosB.value, col: u.uColB.value, pl: u.uPlaceB.value, sc: u.uScaleB.value },
    ]
    for (let i = 0; i < 2; i++) {
      const s = sides[i]
      if (s.w < 0.02 || HUB_OWNED.has(s.id) || (i === 1 && c.shown.a === c.shown.b)) continue
      const smp = samplesOf(s.pos, s.col); if (!smp) continue
      const box: Box = { l: 0, t: 0, r: 0, b: 0 }
      if (projectForm(smp, s.pl, s.sc, this.pv, cr, box)) this.subject.push(box)
    }
  }
}
export const occ = new Occlusion()

// ---------------------------------------------------------------------------------------------- the featured TV's slot
/** Width in px of the tag ui/anchors.ts hangs under a TV: `name` + "OPEN ↗" in the 11.5 px mono at 0.13em (8.4 px a character), 10 px padding a side, a 12 px gap.
 *  A phone drops the "OPEN ↗" (hud.css hides .op) and keeps 8 px padding. Measured: "Cloudflare (NET) Pitch" is 268 px on a desktop. */
export function labelWidth(name: string, phone: boolean): number { return Math.ceil(name.length * 8.4 + (phone ? 18 : 22 + 12 + 6 * 8.4)) }
/** half-width of the keep-clear box of a featured TV: its label ("PROJECT  OPEN ↗") hangs under it */
export function slotBox(x: number, y: number, r: number, hw: number): Box { return { l: x - hw, r: x + hw, t: y - r - 4, b: y + r + 68 } }
/**
 * The spot for the featured TV: a small circle (radius r px) in the lower corner on the side opposite the copy, clear of every zone, the HUD and `extra`
 * (the hub TV while it shows). Keeps `prev` while it is still clear (no hopping; an upper spot is re-searched). null when the screen has no clear spot: then no TV is shown.
 */
export function findSlot(vw: number, vh: number, rMax: number, zones: readonly Box[], hud: readonly Box[], extra: readonly Box[], copySide: number, prev: Slot | null, labelW = 0): Slot | null {
  const phone = vw <= 760, pad = phone ? 12 : 22, top0 = phone ? 76 : 84, bot0 = vh - 20
  const wantR = copySide <= 0 ? 1 : 0
  // the box is as wide as the tag under the TV (a long name is wider than the old fixed 128 px half-width, and its tag ran past the box onto the radar)
  const hwMin = Math.max(phone ? 96 : 128, Math.ceil(labelW / 2) + 6)
  const ok = (x: number, y: number, r: number, mz: number, mh: number): Slot | null => {
    const hw = Math.max(r + 6, hwMin)
    const box = slotBox(x, y, r, hw)
    if (box.l < pad || box.r > vw - pad || box.t < top0 || box.b > bot0) return null
    if (hitsAny(box, zones, mz) || hitsAny(box, hud, mh) || hitsAny(box, extra, mz)) return null
    return { x, y, r, box }
  }
  // keep the old spot while it is still clear (no hopping), unless it is an upper spot found while the zones were still settling: that one is re-searched, and a lower spot wins if there is one
  if (prev && prev.y >= vh * 0.45) { const s = ok(prev.x, prev.y, prev.r, 4, 2); if (s) return s }
  // the biggest radius that fits wins: 100 %, 85 %, 72 %, 62 % of rMax (never under 26 px). Wave 24: the first pass looks only at the lower half of the screen (the slot's
  // intent: a lower corner), so a long name's wide tag that no longer fits beside the ring radar gets a smaller orb in the lower corner, not a big one under the identity at the top;
  // the second pass is the old whole-screen search.
  for (const lowerOnly of [true, false]) for (const k of [1, 0.85, 0.72, 0.62]) {
    const r = Math.max(26, Math.round(rMax * k)), hw = Math.max(r + 6, hwMin)
    // preferred corner: lower corner on the side opposite the copy (the subject's side); no copy side: lower right
    const px = wantR ? vw - pad - hw : pad + hw, py = bot0 - 68 - r
    const y0 = lowerOnly ? Math.max(top0 + r + 4, vh * 0.45) : top0 + r + 4
    let best: Slot | null = null, bc = Infinity
    for (let x = pad + hw; x <= vw - pad - hw + 0.5; x += 22) {
      for (let y = y0; y <= bot0 - 68 - r + 0.5; y += 22) {
        const d = (x - px) * (x - px) + (y - py) * (y - py)
        if (d >= bc) continue
        const s = ok(x, y, r, 14, 8); if (s) { best = s; bc = d }
      }
    }
    if (best) return best
  }
  return null
}

// ---------------------------------------------------------------------------------------------- shader holes (for the extras)
export const MAX_HOLES = 8
/** (u0, v0, u1, v1) in gl_FragCoord / resolution uv (v up); zero-size = unused. Shared by every extra material: `uHole: HOLES`. */
export const HOLES = { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) }
/** GLSL: needs `uniform vec4 uHole[8];` (HOLES_GLSL declares it); 0 inside a zone, 1 clear, soft 12 px edges at 1440 */
export const HOLES_GLSL = /* glsl */ `
uniform vec4 uHole[${MAX_HOLES}];
float holeMask(vec2 uv) {
  float m = 1.0;
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    vec4 h = uHole[i];
    if (h.z <= h.x) continue;
    vec2 a = smoothstep(h.xy - 0.01, h.xy + 0.01, uv) * (1.0 - smoothstep(h.zw - 0.01, h.zw + 0.01, uv));
    m *= 1.0 - a.x * a.y;
  }
  return m;
}`
/** write the current zones into HOLES (call once per frame after occ.update). `pad` px of margin around each zone */
export function writeHoles(vw: number, vh: number, pad = 10) {
  const H = HOLES.value, z = occ.zones
  for (let i = 0; i < MAX_HOLES; i++) {
    const b = z[i]
    if (!b) { H[i].set(0, 0, 0, 0); continue }
    H[i].set((b.l - pad) / vw, 1 - (b.b + pad) / vh, (b.r + pad) / vw, 1 - (b.t - pad) / vh)
  }
}
