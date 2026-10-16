// Deconstructable type (v4, unit 5B2). The huge Bodoni titles of the overlays are split into words and characters
// and driven by ONE paused anime.js timeline per title, scrubbed with seek():
//   0 .. A      assemble   letters condense from scattered 3D-rotated positions (translateZ + rotateX/Y/Z, blur -> sharp),
//                          staggered from the centre; a few letters decode through mono numerals on the way in
//   A .. S0     hold       (the dwell: the type is still; pointer + camera tilt only add parallax, never a transform on the glyphs)
//   S0 .. END   shatter    letters deconstruct ALONG THE CAMERA'S TRAVEL DIRECTION (screen-space heading of the next leg,
//                          lateral + dolly), a few flip into mono numerals before they vanish (ALCHE's glitch-decode)
// The playhead is a pure function of the flight window (ti / to from overlays.ts), so scrolling back reassembles the word.
// Letter state is anime-driven (per-letter progress proxies with stagger / easing); the final transform is composed per frame
// from those progress values, the travel direction and the per-letter seed, because the direction is only known at run time.
// Legibility rules: transforms + opacity only (blur on word wrappers, never at rest), nothing here touches body copy,
// reduced motion builds nothing (overlays.ts keeps its plain fades).
import { animate, createTimeline, scrambleText, stagger } from 'animejs'
import type { Waypoint } from '../world/layout'
import type { FlightState } from './types'
import { clamp, sstep } from './util'

/** timeline map in ms: assemble 0..A, hold A..S0, shatter S0..END */
export const TL = { A: 860, S0: 1160, END: 2020 }
/** playhead for a title: ti / to are the flight windows (0..1), clock is a wall-clock assemble (-1 = off) used for arrivals that were not scrubbed */
export const msFor = (ti: number, to: number, clock: number) => (to > 0.0005 ? TL.S0 + to * (TL.END - TL.S0) : clock < 0 ? ti * TL.A : Math.min(ti * TL.A, clock))

const GL = '0123456789/+=<>#%*'
const PERSP = 900

function seeded(seed: number) {
  let a = seed | 0
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

// ---------------------------------------------------------------------------------------------------- sfx (guarded)
type Cue = { cue(id: string, o?: unknown): void }
let sfx: Cue | null = null
let sfxAsked = false
/** type:assemble / type:shatter {n}: reaches the sfx engine through a guarded dynamic import (silent if the module or the cue is missing) */
export function cue(name: 'type:assemble' | 'type:shatter', n: number) {
  if (!sfxAsked) { sfxAsked = true; import('../../audio/sfx').then(m => { sfx = (m as { sfx?: Cue }).sfx ?? null }).catch(() => { /* optional */ }) }
  try { sfx?.cue(name, { n }) } catch { /* the engine may be asleep */ }
}

// ---------------------------------------------------------------------------------------------------- splitting
export interface Split { chars: HTMLElement[]; words: HTMLElement[]; wordOf: number[] }
/** one inline-block span per word (nowrap) holding one inline-block span per character; spaces stay plain text so lines still wrap and balance.
 *  (anime's splitText re-splits on every ResizeObserver tick, and fit() changes the font size: the references here would go stale.) */
export function splitChars(el: HTMLElement, text: string, into?: Split): Split {
  const out: Split = into ?? { chars: [], words: [], wordOf: [] }
  el.textContent = ''
  const ws = text.split(' ')
  ws.forEach((w, i) => {
    const wi = out.words.length
    const we = document.createElement('span'); we.className = 'dw'
    for (const ch of Array.from(w)) { const c = document.createElement('span'); c.className = 'dc'; c.textContent = ch; we.append(c); out.chars.push(c); out.wordOf.push(wi) }
    out.words.push(we); el.append(we)
    if (i < ws.length - 1) el.append(' ')
  })
  return out
}

// ---------------------------------------------------------------------------------------------------- the shared rig
/** per-frame inputs shared by every title: smoothed pointer, camera tilt away from the flight pose, travel direction of the next leg */
export class Rig {
  px = 0; py = 0            // smoothed pointer, -1..1
  yaw = 0; pitch = 0        // smoothed camera tilt in degrees (a POV drag), only while the flight is settled
  dirX = 0; dirY = 0; dirZ = 0   // heading of the leg being flown: screen x/y (content motion) and dolly (+ toward the lens)
  dirKey = ''
  dm = 600                  // shatter travel distance in px (set from the viewport)
  private tx = 0; private ty = 0; private t0 = 0
  private nomP = NaN; private nom: { pos: number[]; target: number[] } | null = null
  constructor() {
    if (typeof window === 'undefined') return
    addEventListener('pointermove', e => { this.tx = (e.clientX / Math.max(1, innerWidth)) * 2 - 1; this.ty = (e.clientY / Math.max(1, innerHeight)) * 2 - 1 }, { passive: true })
  }
  /** returns true when px / py / yaw / pitch moved enough to be worth a style write */
  step(st: FlightState, wps: Waypoint[], settle: number, now: number): boolean {
    const dt = this.t0 ? Math.min(0.1, (now - this.t0) / 1000) : 0.016
    this.t0 = now
    const v3 = (window as unknown as { __v3?: { field?: { camera?: any }; flightAt?: (p: number) => any } }).__v3
    const cam = v3?.field?.camera
    // pointer
    const kp = 1 - Math.exp(-dt / 0.14)
    const px0 = this.px, py0 = this.py, yw0 = this.yaw, pt0 = this.pitch
    this.px += (this.tx - this.px) * kp; this.py += (this.ty - this.py) * kp
    // camera tilt: how far the live camera sits from the flight's own pose, as an orbit around the flight target
    let ty = 0, tp = 0
    if (cam && v3?.flightAt && settle > 0.02 && st.p != null) {
      if (this.nomP !== st.p) { this.nomP = st.p; try { this.nom = v3.flightAt(st.p).cam } catch { this.nom = null } }
      const n = this.nom
      if (n) {
        const g = n.target, c = cam.position
        const ax = c.x - g[0], ay = c.y - g[1], az = c.z - g[2], bx = n.pos[0] - g[0], by = n.pos[1] - g[1], bz = n.pos[2] - g[2]
        let dy = (Math.atan2(ax, az) - Math.atan2(bx, bz)) * 57.29578
        if (dy > 180) dy -= 360; else if (dy < -180) dy += 360
        const dp = (Math.asin(clamp(ay / (Math.hypot(ax, ay, az) || 1), -1, 1)) - Math.asin(clamp(by / (Math.hypot(bx, by, bz) || 1), -1, 1))) * 57.29578
        const dz = (v: number) => (Math.abs(v) < 0.7 ? 0 : v - Math.sign(v) * 0.7)
        ty = clamp(dz(dy), -70, 70) * settle; tp = clamp(dz(dp), -30, 40) * settle
      }
    }
    const kt = 1 - Math.exp(-dt / 0.09)
    this.yaw += (ty - this.yaw) * kt; this.pitch += (tp - this.pitch) * kt
    // travel direction of the leg being flown: the screen heading of the content is the opposite of the camera's motion in the frame it
    // starts the leg in. Taken from the two waypoint poses (not the live camera), so it is the same going forward and coming back.
    if (st.next != null && st.wp != null && st.next !== st.wp) {
      const A = wps[st.wp]?.cam, B = wps[st.next]?.cam
      if (A && B) {
        let fx = A.target[0] - A.pos[0], fy = A.target[1] - A.pos[1], fz = A.target[2] - A.pos[2]
        const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl
        let rx = -fz, rz = fx                                           // right = forward x worldUp (horizontal)
        const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl
        const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy        // up = right x forward
        const d0 = B.pos[0] - A.pos[0], d1 = B.pos[1] - A.pos[1], d2 = B.pos[2] - A.pos[2], len = Math.hypot(d0, d1, d2) || 1
        const cr = (d0 * rx + d2 * rz) / len, cu = (d0 * ux + d1 * uy + d2 * uz) / len, cf = (d0 * fx + d1 * fy + d2 * fz) / len
        this.dirX = clamp(-cr * 1.35, -1, 1); this.dirY = clamp(cu * 1.35, -1, 1); this.dirZ = clamp(cf * 1.4, -1, 1)
        this.dirKey = Math.round(this.dirX * 8) + ':' + Math.round(this.dirY * 8) + ':' + Math.round(this.dirZ * 8)
      }
    }
    return Math.abs(this.px - px0) + Math.abs(this.py - py0) + (Math.abs(this.yaw - yw0) + Math.abs(this.pitch - pt0)) * 0.05 > 0.0008
  }
}

// ---------------------------------------------------------------------------------------------------- the deconstructable word group
export interface Geo { ox: number; oy: number; nx: number; ny: number }
export interface DecoOpts {
  /** the kicker's text element: decodes (anime scrambleText) while the letters assemble */
  kicker?: HTMLElement | null
  /** fill-alpha channel (--f) for outline type that solidifies while it flies (the hero name) */
  fill?: boolean
  /** glyph font size for the numeral flips (em of the letter) is set in CSS; this is only the scatter scale in px */
  size?: number
}

type Proxy = { v: number }

export class Deco {
  readonly n: number
  built = false
  size: number
  private tl: ReturnType<typeof createTimeline> | null = null
  private pa: Proxy[] = []; private ps: Proxy[] = []
  private r: Float32Array
  geo: Geo[]
  private rank: Int16Array; private rankKey = '#'
  private touched: Uint8Array
  private gl: string[]
  private wBlur: Float32Array
  private last = ''
  private kText = ''

  constructor(readonly chars: HTMLElement[], readonly words: HTMLElement[], readonly wordOf: number[], readonly seed: string, private opts: DecoOpts = {}) {
    this.n = chars.length
    this.size = opts.size ?? 100
    this.r = new Float32Array(this.n * 10)
    this.geo = chars.map((_, i) => ({ ox: 0, oy: 0, nx: (i / Math.max(1, this.n - 1)) * 2 - 1, ny: 0 }))
    this.rank = new Int16Array(this.n)
    this.touched = new Uint8Array(this.n)
    this.gl = chars.map(() => '')
    this.wBlur = new Float32Array(words.length)
    const rnd = seeded(hash(seed))
    for (let i = 0; i < this.n; i++) {
      const o = i * 10
      for (let k = 0; k < 10; k++) this.r[o + k] = rnd()
      this.r[o] = this.r[o] * 2 - 1; this.r[o + 1] = this.r[o + 1] * 2 - 1; this.r[o + 2] = this.r[o + 2] * 2 - 1
      this.r[o + 3] = this.r[o + 3] * 2 - 1; this.r[o + 4] = this.r[o + 4] * 2 - 1; this.r[o + 5] = this.r[o + 5] * 2 - 1
      this.r[o + 9] = this.r[o + 9] * 2 - 1
      chars[i].style.setProperty('--d', this.r[o + 9].toFixed(2))
    }
    this.kText = opts.kicker?.textContent ?? ''
  }

  /** build the paused timeline (idempotent). Cheap, but it is deferred to idle time by the layer. */
  build() {
    if (this.built) return
    this.built = true
    this.pa = this.chars.map(() => ({ v: 0 }))
    this.ps = this.chars.map(() => ({ v: 0 }))
    const tl = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })
    // assemble: from the centre outward
    tl.add(this.pa, { v: [0, 1], duration: 560, ease: 'out(3)', delay: stagger([0, 300], { from: 'center' }) }, 0)
    // shatter: by rank along the travel direction (rank is re-sorted when the heading changes)
    tl.add(this.ps, { v: [0, 1], duration: 580, ease: 'in(2)', delay: stagger([0, 280]) }, TL.S0)
    // the kicker decodes character by character while the letters condense
    const k = this.opts.kicker
    if (k && this.kText) {
      const text = this.kText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      tl.add(k, { innerHTML: scrambleText({ text, chars: 'A-Z0-9', seed: (hash(this.seed) % 9000) + 1, duration: 600, settleDuration: 220 }), ease: 'linear' }, 80)
    }
    this.tl = tl
    this.tl.seek(0)
    this.last = ''
  }

  /** (re)measure the letter centres relative to the block centre (read phase: no writes) */
  read(host: HTMLElement): { cx: number; cy: number; hw: number; hh: number; c: [number, number][] } {
    const c: [number, number][] = []
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9
    for (const el of this.chars) {
      let x = 0, y = 0, p: HTMLElement | null = el
      while (p && p !== host) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent as HTMLElement | null }
      const w = el.offsetWidth, h = el.offsetHeight
      c.push([x + w / 2, y + h / 2])
      if (x < l) l = x; if (x + w > r) r = x + w; if (y < t) t = y; if (y + h > b) b = y + h
    }
    return { cx: (l + r) / 2, cy: (t + b) / 2, hw: Math.max(1, (r - l) / 2), hh: Math.max(1, (b - t) / 2), c }
  }
  /** write phase of read() */
  write(m: ReturnType<Deco['read']>, size: number) {
    this.size = size
    m.c.forEach(([x, y], i) => { const g = this.geo[i]; g.ox = x - m.cx; g.oy = y - m.cy; g.nx = clamp((x - m.cx) / m.hw, -1, 1); g.ny = clamp((y - m.cy) / m.hh, -1, 1) })
    this.rankKey = '#'; this.last = ''
  }

  /** put every letter back at rest (reduced motion, or leaving the deconstructed mode) */
  rest() {
    for (let i = 0; i < this.n; i++) if (this.touched[i]) this.clear(i)
    for (const w of this.words) w.style.filter = ''
    this.wBlur.fill(0)
    const k = this.opts.kicker
    if (k && this.kText) k.textContent = this.kText
    this.last = ''
  }
  private clear(i: number) {
    const e = this.chars[i]
    e.style.transform = ''; e.style.opacity = ''
    if (this.opts.fill) e.style.removeProperty('--f')
    if (this.gl[i]) { this.gl[i] = ''; e.classList.remove('g'); e.removeAttribute('data-g') }
    this.touched[i] = 0
  }

  /** move the playhead to ms and paint (skips when nothing moved) */
  drive(ms: number, rig: Rig) {
    if (!this.built) this.build()
    const key = ms.toFixed(1) + '|' + (ms > TL.S0 ? rig.dirKey + '|' + Math.round(rig.dm) : '')
    if (key === this.last) return
    this.last = key
    this.tl!.seek(ms)
    this.paint(rig)
  }

  private resort(rig: Rig) {
    const idx = Array.from({ length: this.n }, (_, i) => i)
    const key = (i: number) => -(rig.dirX * this.geo[i].nx + rig.dirY * this.geo[i].ny)
    idx.sort((p, q) => key(p) - key(q))
    idx.forEach((ci, rk) => { this.rank[ci] = rk })
    this.rankKey = rig.dirKey
  }

  private paint(rig: Rig) {
    const dm = rig.dm
    if (this.rankKey !== rig.dirKey) this.resort(rig)
    const F = this.size, wn = this.words.length
    const wa = new Float32Array(wn), ws = new Float32Array(wn), wc = new Uint16Array(wn)
    const fill = !!this.opts.fill
    for (let i = 0; i < this.n; i++) {
      const a = this.pa[i].v, s = this.ps[this.rank[i]].v
      const wi = this.wordOf[i]
      wa[wi] += a; ws[wi] += s; wc[wi]++
      const e = this.chars[i]
      if (a > 0.999 && s < 0.001) { if (this.touched[i]) this.clear(i); continue }
      const o = i * 10, r = this.r, g = this.geo[i]
      const u = 1 - a
      let x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0
      if (u > 0) {
        const near = r[o + 2] > 0 ? 1 : -0.85
        x += r[o] * F * 2.3 * u; y += r[o + 1] * F * 1.4 * u
        z += near * (260 + 300 * Math.abs(r[o + 2])) * u
        rx += r[o + 3] * 75 * u; ry += r[o + 4] * 90 * u; rz += r[o + 5] * 24 * u
      }
      if (s > 0) {
        const m = (0.3 + 0.7 * r[o + 6]) * Math.pow(s, 1.12)
        const rad = (0.3 + Math.max(0, rig.dirZ)) * m * dm * 0.4
        x += rig.dirX * dm * m + g.nx * rad + r[o] * F * 0.45 * s
        y += rig.dirY * dm * m + g.ny * rad * 0.7 + r[o + 1] * F * 0.3 * s
        z += rig.dirZ * (360 + 380 * r[o + 6]) * s
        rx += r[o + 3] * 110 * s; ry += r[o + 4] * 140 * s; rz += r[o + 5] * 70 * s
      }
      z = clamp(z, -620, 740)
      // perspective with a shared vanishing point (the block centre): pull the letter's own centre to the block centre, project, push back
      e.style.transform = `translate(${(-g.ox).toFixed(1)}px,${(-g.oy).toFixed(1)}px) perspective(${PERSP}px) translate(${g.ox.toFixed(1)}px,${g.oy.toFixed(1)}px) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg)`
      e.style.opacity = (clamp(a * 1.7) * (1 - sstep(0.32, 1, s))).toFixed(3)
      if (fill) e.style.setProperty('--f', Math.max(0.92 * (1 - sstep(0.48, 1, a)), 0.9 * sstep(0, 0.22, s)).toFixed(3))
      this.touched[i] = 1
      // mono numeral flips (glitch decode): a few letters, only mid-way through their travel
      let gl = ''
      if (r[o + 7] < 0.24 && s > 0.05 && s < 0.64) gl = GL[(i * 7 + ((s * 20) | 0)) % GL.length]
      else if (r[o + 8] < 0.16 && a > 0.1 && a < 0.72) gl = GL[(i * 5 + ((a * 16) | 0)) % GL.length]
      if (gl !== this.gl[i]) {
        this.gl[i] = gl
        if (gl) { e.classList.add('g'); e.setAttribute('data-g', gl) } else { e.classList.remove('g'); e.removeAttribute('data-g') }
      }
    }
    // soft focus on the word wrappers only (a handful of filters, never on the letters, never at rest)
    for (let w = 0; w < wn; w++) {
      const c = wc[w] || 1
      const b = 6 * Math.pow(1 - wa[w] / c, 1.5) + 7.5 * Math.pow(ws[w] / c, 1.2)
      const bb = b < 0.35 ? 0 : Math.round(b * 2) / 2
      if (bb !== this.wBlur[w]) { this.wBlur[w] = bb; this.words[w].style.filter = bb ? `blur(${bb}px)` : '' }
    }
  }
}

// ---------------------------------------------------------------------------------------------------- the hero name
/** unit square -> quad (Heckbert) as a CSS matrix3d for a box of w x h px whose corners land on TL, TR, BR, BL */
export function quadMatrix(w: number, h: number, q: { x: number; y: number }[]): string {
  const [p0, p1, p2, p3] = q
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y
  let g = 0, hh = 0
  const det = dx1 * dy2 - dx2 * dy1
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) { g = (dx3 * dy2 - dx2 * dy3) / det; hh = (dx1 * dy3 - dx3 * dy1) / det }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + hh * p3.x, c = p0.x
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + hh * p3.y, f = p0.y
  const n = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v).toFixed(9)
  return `matrix3d(${n(a / w)},${n(d / w)},0,${n(g / w)},${n(b / h)},${n(e / h)},0,${n(hh / h)},0,0,1,0,${n(c)},${n(f)},0,1)`
}

const HERO_FAM = '"Bodoni Moda Variable", "Bodoni 72", Didot, serif'
const HERO_FONT = `900 340px ${HERO_FAM}`
/** mirrors src/v3/forms/name.ts: BLUMBERG is WIDTH wide in the world, the front face sits DEPTH/2 in front of the placement point */
const NAME_WIDTH = 7.5, NAME_DEPTH = 0.8, MASK_PAD = 2.5

/** The name, drawn twice: the particles spell it, and this DOM layer lies in the SAME world plane (a CSS homography through the live camera,
 *  so a POV drag tilts it exactly with the dust). At rest it is a cream hairline on the particle letters; while it arrives the letters are solid
 *  and condense out of the cloud; leaving, they deconstruct along the travel direction. aria-hidden: the overlay keeps its screen-reader title. */
export class Hero {
  readonly el: HTMLElement
  deco: Deco | null = null
  private local: [number, number][] = []        // plane corners in form space (x, y), TL TR BR BL
  private at: [number, number, number] = [0, 0, 0]; private k = 1; private z = 0
  private pw = 0; private ph = 0
  private lastM = ''
  constructor(private wp: Waypoint) {
    this.el = document.createElement('div'); this.el.className = 'hero'; this.el.setAttribute('aria-hidden', 'true')
  }
  get ready() { return !!this.deco }
  /** (re)build for the viewport; returns false when the font is not there yet */
  build(vw: number, vh: number): boolean {
    if (typeof document === 'undefined' || !document.fonts.check(HERO_FONT)) return false
    const cv = document.createElement('canvas').getContext('2d')
    if (!cv) return false
    cv.font = HERO_FONT; cv.textBaseline = 'alphabetic'
    const text = ['JOSEPH', 'BLUMBERG']
    const ink = text.map(t => { const m = cv.measureText(t); return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent } })
    const sc = NAME_WIDTH / (ink[1].l + ink[1].r + MASK_PAD)               // world units per canvas px at 340 px
    const hJ = (ink[0].a + ink[0].d + MASK_PAD) * sc, hB = (ink[1].a + ink[1].d + MASK_PAD) * sc, gap = 0.3 * Math.max(hJ, hB)
    const top = (hJ + gap + hB) / 2
    const cy = [top - hJ / 2, -top + hB / 2]                                // world y of each line's ink centre
    // screen scale at the dwell, so the plane's pixels are about screen pixels (crisp raster)
    const cam = this.wp.cam, at = this.wp.place.at
    const f = [cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]], fl = Math.hypot(f[0], f[1], f[2]) || 1
    const depth = Math.max(1, ((at[0] - cam.pos[0]) * f[0] + (at[1] - cam.pos[1]) * f[1] + (at[2] + NAME_DEPTH / 2 - cam.pos[2]) * f[2]) / fl)
    const S = clamp(vh / (2 * depth * Math.tan(((cam.fov ?? 35) * Math.PI) / 360)), 30, 600)
    const FS = 340 * sc * S
    const PW = 4, PH = top + 0.5                                              // plane: x in [-PW, PW], y in [-PH, PH] (world, form space)
    this.pw = 2 * PW * S; this.ph = 2 * PH * S
    this.z = NAME_DEPTH / 2; this.k = this.wp.place.scale ?? 1; this.at = [at[0], at[1], at[2]]
    this.local = [[-PW, PH], [PW, PH], [PW, -PH], [-PW, -PH]]
    this.el.style.cssText = `width:${this.pw.toFixed(1)}px;height:${this.ph.toFixed(1)}px;font-size:${FS.toFixed(2)}px`
    this.el.textContent = ''
    const chars: HTMLElement[] = [], words: HTMLElement[] = [], wordOf: number[] = [], geo: Geo[] = []
    const probes: HTMLElement[] = []
    const placed: { e: HTMLElement; base: number }[] = []
    text.forEach((t, li) => {
      const line = document.createElement('span'); line.className = 'hl'; words.push(line); this.el.append(line)
      const origin = -((ink[li].r - ink[li].l) / 2) * sc                      // world x of the text origin when the ink is centred
      const chs = Array.from(t)
      chs.forEach((ch, j) => {
        const e = document.createElement('span'); e.className = 'dc'; e.textContent = ch
        const left = j ? cv.measureText(t.slice(0, j + 1)).width - cv.measureText(ch).width : 0   // kerning-aware origin of this letter
        const adv = cv.measureText(ch).width
        const X = (PW + origin + left * sc) * S
        const baseline = cy[li] + ((ink[li].a + ink[li].d) / 2 - ink[li].a) * sc // world y of the baseline
        const Y = (PH - baseline) * S
        e.style.left = X.toFixed(2) + 'px'
        placed.push({ e, base: Y })
        line.append(e); chars.push(e); wordOf.push(li)
        const ccx = X + (adv * sc * S) / 2, ccy = (PH - cy[li]) * S
        geo.push({ ox: ccx - this.pw / 2, oy: ccy - this.ph / 2, nx: clamp((ccx - this.pw / 2) / (this.pw / 2), -1, 1), ny: clamp((ccy - this.ph / 2) / (this.ph / 2), -1, 1) })
        if (!probes.length) { const pr = document.createElement('i'); pr.className = 'bp'; e.append(pr); probes.push(pr) }
      })
    })
    const baseOff = probes.length ? probes[0].offsetTop : FS * 0.8
    for (const p of placed) p.e.style.top = (p.base - baseOff).toFixed(2) + 'px'
    probes.forEach(pr => pr.remove())
    this.deco?.rest()
    this.deco = new Deco(chars, words, wordOf, 'name', { fill: true, size: FS * 0.5 })
    this.deco.geo = geo
    this.lastM = ''
    return true
  }
  /** lay the plane over the particle name for this frame's camera. t = the field's shader time: the name form sways about its vertical axis
   *  (anim_name in forms/name.ts: yaw 0.3 sin(0.23 t)), and so does this plane, so the outline stays on the letters. */
  update(project: (p: number[]) => { x: number; y: number }, t: number) {
    if (!this.local.length) return
    const a = 0.3 * Math.sin(t * 0.23), ca = Math.cos(a), sa = Math.sin(a), { at, k, z } = this
    const q = this.local.map(([x, y]) => project([at[0] + (ca * x + sa * z) * k, at[1] + y * k, at[2] + (-sa * x + ca * z) * k]))
    const m = quadMatrix(this.pw, this.ph, q)
    if (m !== this.lastM) { this.lastM = m; this.el.style.transform = m }
  }
}

// ---------------------------------------------------------------------------------------------------- arrivals that were not scrubbed
/** a wall-clock assemble (0..A ms) for titles that appear without a scrubbed approach (first view after the gate, rail jumps) */
export class Clock {
  ms = -1
  private anim: ReturnType<typeof animate> | null = null
  /** delay and duration in ms: an arrival assembles over 1.5 s after 0.24 s; a rail jump starts it early and runs it in 0.76 s (w11) */
  start(delay = 240, duration = 1500) { this.stop(); this.ms = 0; this.anim = animate(this, { ms: TL.A, duration, delay, ease: 'linear', onComplete: () => { this.ms = -1 } }) }
  stop() { if (this.anim) { this.anim.cancel(); this.anim = null } this.ms = -1 }
}

/** run fn in idle time, one at a time (a title's timeline is cheap, but 20 at once is a long task) */
export function idle(fn: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(fn, { timeout: 1500 }); else setTimeout(fn, 60)
}
