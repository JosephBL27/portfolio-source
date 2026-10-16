// COMPASS: Metamorphoses: A Living Chronology. The reading instrument as a particle wheel in 3/4 view:
// four concentric rings (six mythic eras, the 15 books with engraved LIBER numerals, the episodes of
// book I, its themes) around a sun, with a fine-ticked bezel, segment dividers, a pointer arm and a
// gold reading window at the top. anim_compass counter-rotates the rings at different speeds, sways the
// pointer, pulses the sun, and lights whatever passes under the window.
// pos.w classes: 0 fixed (bezel, window, halo), 1 eras, 2 books, 3 episodes, 4 themes, 5 inner motto,
// 6 sun rays, 7 sun face, 8 pointer arm, 9 dust. pos.xyz = disc-local (x, y, z-relief); tilt is applied in GLSL.
import type { FormDef } from './types'
import { H } from './ctx'

const TAU = Math.PI * 2, D = Math.PI / 180
const R = { bez: 2.62, bez2: 2.585, bezIn: 2.5, eras: 2.24, books: 1.84, eps: 1.4, themes: 0.98, motto: 0.86, mottoIn: 0.7, rays: 0.64, face: 0.34 }
const BOOK = 24 * D
const ERAS: [string, number, number][] = [['PRIMORDIAL AGE', 0, 3], ['EARLY HEROIC AGE', 3, 8], ['MATURE HEROIC AGE', 8, 11], ['TROJAN WAR', 11, 13], ['TROY TO ROME', 13, 14], ['ROMAN HISTORY', 14, 15]]
const EPISODES = ['Creation', 'The Four Ages', 'Lycaon', 'The Great Flood', 'Deucalion & Pyrrha', 'Apollo & Daphne', 'Io', 'Pan & Syrinx']
const THEMES = ['Order & recurrence', 'Power and the body', 'Speech under pressure', 'Predation & escape']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']
const MOTTO = 'OMNIA MUTANTUR · NIHIL INTERIT · ALL THINGS CHANGE · NOTHING PERISHES · '
const RATE = [0, 0.022, -0.032, 0.05, -0.075, 0.11, 0.16, 0, 0, 0]

interface Label { img: ImageData; x0: number; x1: number; y0: number; y1: number }

const form: FormDef = {
  id: 'compass',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    const GOLD = H.hex('#D9A441'), IV = H.hex('#F1E9D4')
    const TINT = { eras: [0.9, 0.68, 0.3], books: [0.86, 0.9, 0.98], eps: [0.9, 0.5, 0.34], themes: [0.55, 0.82, 0.55] }
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))

    // ---- engraved text: render masks (parallel), find ink boxes ----
    const mk = async (text: string, font: string, w: number, h: number): Promise<Label> => {
      const img = await ctx.textMask(text, { font, width: w, height: h, align: 'center' })
      let x0 = w, x1 = 0, y0 = h, y1 = 0
      const d = img.data
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 <= x0) { x0 = 0; x1 = w; y0 = 0; y1 = h }
      return { img, x0, x1: x1 + 1, y0, y1: y1 + 1 }
    }
    const SANS = '"Archivo Variable", "Helvetica Neue", Arial, sans-serif', SERIF = '"Bodoni Moda Variable", "Didot", Georgia, serif'
    const [eraL, romL, liberL, epL, thL, mottoL] = await Promise.all([
      Promise.all(ERAS.map(e => mk(e[0], `600 64px ${SANS}`, 1024, 96))),
      Promise.all(ROMAN.map(r => mk(r, `700 100px ${SERIF}`, 320, 140))),
      mk('LIBER', `600 56px ${SANS}`, 360, 80),
      Promise.all(EPISODES.map(e => mk(e, `500 60px ${SERIF}`, 1024, 96))),
      Promise.all(THEMES.map(e => mk(e, `500 60px ${SERIF}`, 1024, 96))),
      mk(MOTTO, `600 40px ${SANS}`, 3072, 64),
    ])
    // sample a label onto an arc. size: cap height wanted (units), fit: max arc length (units)
    const arcText = (cls: number, lab: Label, thC: number, rMid: number, capH: number, fit: number, n: number, c: number[], al: number, z: number, vOff = 0) => {
      const inkW = lab.x1 - lab.x0, inkH = lab.y1 - lab.y0
      const sc = Math.min(capH / inkH, fit / inkW)
      const cx = (lab.x0 + lab.x1) / 2, cy = (lab.y0 + lab.y1) / 2
      const pts = H.sampleMask(lab.img, n, rand)
      for (const q of pts) {
        const s = (q[0] - cx) * sc, v = (cy - q[1]) * sc + vOff
        const th = thC - s / rMid, r = rMid + v
        put(r * Math.cos(th), r * Math.sin(th), z + (rand() - 0.5) * 0.012, cls, c, al)
      }
      return sc
    }
    // ---- primitives ----
    const wash = (cls: number, r0: number, r1: number, th0: number, th1: number, n: number, c: number[], al: number, z: number) => {
      for (let i = 0; i < n; i++) { const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0)), th = th0 + rand() * (th1 - th0); put(r * Math.cos(th), r * Math.sin(th), z + (rand() - 0.5) * 0.02, cls, c, al) }
    }
    const circle = (cls: number, r: number, n: number, c: number[], al: number, z: number, th0 = 0, th1 = TAU) => {
      for (let i = 0; i < n; i++) { const th = th0 + rand() * (th1 - th0), rr = r + (rand() - 0.5) * 0.006; put(rr * Math.cos(th), rr * Math.sin(th), z, cls, c, al) }
    }
    const radial = (cls: number, th: number, r0: number, r1: number, n: number, c: number[], al: number, z: number) => {
      const co = Math.cos(th), si = Math.sin(th)
      for (let i = 0; i < n; i++) { const r = r0 + rand() * (r1 - r0), o = (rand() - 0.5) * 0.007; put(r * co - o * si, r * si + o * co, z, cls, c, al) }
    }
    const thBook = (i: number) => Math.PI / 2 - i * BOOK // clockwise from the top

    // ---- sun: face, features, rays ----
    const nFace = take(0.03)
    for (let i = 0; i < nFace; i++) { const r = R.face * Math.sqrt(rand()), th = rand() * TAU; put(r * Math.cos(th), r * Math.sin(th), 0.1, 7, GOLD, 0.34) }
    circle(7, R.face, take(0.012), GOLD, 0.8, 0.1); circle(7, R.face * 1.12, take(0.005), IV, 0.4, 0.1)
    const feat = (cx: number, cy: number, r: number, a0: number, a1: number, n: number, al = 0.95) => { for (let i = 0; i < n; i++) { const a = a0 + rand() * (a1 - a0); put(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.11, 7, IV, al) } }
    const nF = take(0.0035)
    feat(-0.115, 0.07, 0.04, 0, TAU, nF); feat(0.115, 0.07, 0.04, 0, TAU, nF)              // eyes
    feat(-0.115, 0.115, 0.07, 55 * D, 125 * D, nF); feat(0.115, 0.115, 0.07, 55 * D, 125 * D, nF) // brows
    for (let i = 0; i < nF; i++) { const u = rand(); put(0.01 * u, 0.045 - 0.14 * u, 0.11, 7, IV, 0.95) } // nose
    feat(0, 0.03, 0.15, 240 * D, 300 * D, nF)                                              // mouth
    const nRay = take(0.03), RAYS = 24
    for (let i = 0; i < nRay; i++) {
      const k = i % RAYS, long = k % 2 === 0, th = (k / RAYS) * TAU, rLen = long ? R.rays : R.rays * 0.78
      let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v }
      const r = R.face * 1.2 + (rLen - R.face * 1.2) * u, hw = (long ? 0.085 : 0.07) * (1 - u) * (v * 2 - 1) * 0.5
      const co = Math.cos(th), si = Math.sin(th)
      put(r * co - hw * si, r * si + hw * co, 0.06, 6, long ? GOLD : [0.95, 0.78, 0.4], 0.5)
    }
    // ---- inner motto ring ----
    circle(5, R.motto + 0.075, take(0.006), GOLD, 0.5, -0.03); circle(5, R.mottoIn, take(0.006), GOLD, 0.5, -0.03)
    wash(5, R.mottoIn, R.motto + 0.075, 0, TAU, take(0.012), TINT.themes, 0.14, -0.03)
    arcText(5, mottoL, Math.PI / 2, R.motto + 0.002, 0.062, TAU * (R.motto + 0.002) * 0.985, take(0.032), IV, 0.5, -0.03, 0)
    // ---- themes ring: wash, edges, 4 dividers, fine ticks, engraved themes ----
    wash(4, R.themes, R.eps, 0, TAU, take(0.06), TINT.themes, 0.2, -0.02)
    circle(4, R.themes, take(0.014), GOLD, 0.8, -0.02)
    for (let k = 0; k < 4; k++) radial(4, thBook(0) - k * 90 * D, R.themes, R.eps, 110, GOLD, 0.8, -0.02)
    for (let k = 0; k < 60; k++) radial(4, thBook(0) - k * 6 * D, R.themes, R.themes + (k % 5 ? 0.04 : 0.08), 9, IV, 0.5, -0.02)
    THEMES.forEach((_, k) => arcText(4, thL[k], thBook(0) - (k + 0.5) * 90 * D, (R.themes + R.eps) / 2, 0.105, 1.55, take(0.0125), [0.8, 0.95, 0.75], 0.55, -0.02))
    // ---- episodes ring ----
    wash(3, R.eps, R.books, 0, TAU, take(0.07), TINT.eps, 0.2, 0)
    circle(3, R.eps, take(0.014), GOLD, 0.8, 0)
    for (let k = 0; k < 8; k++) radial(3, thBook(0) - k * 45 * D, R.eps, R.books, 110, GOLD, 0.8, 0)
    for (let k = 0; k < 120; k++) radial(3, thBook(0) - k * 3 * D, R.books - (k % 5 ? 0.04 : 0.08), R.books, 9, IV, 0.45, 0)
    EPISODES.forEach((_, k) => arcText(3, epL[k], thBook(0) - (k + 0.5) * 45 * D, (R.eps + R.books) / 2 - 0.01, 0.115, 1.05, take(0.0075), [1.0, 0.82, 0.62], 0.55, 0))
    // ---- books ring: the 15 numerals ----
    wash(2, R.books, R.eras, 0, TAU, take(0.075), TINT.books, 0.17, 0.02)
    circle(2, R.books, take(0.014), GOLD, 0.85, 0.02)
    for (let k = 0; k < 15; k++) radial(2, thBook(k), R.books, R.eras, 90, GOLD, 0.8, 0.02)
    for (let k = 0; k < 15; k++) {
      const th = thBook(k + 0.5), fit = (R.books + R.eras) / 2 * BOOK * 0.8
      arcText(2, romL[k], th, 1.99, 0.19, fit, take(0.0075), IV, 0.6, 0.02, -0.01)
      arcText(2, liberL, th, 2.165, 0.045, BOOK * 2.16 * 0.5, take(0.0016), GOLD, 0.6, 0.02)
    }
    // ---- eras ring ----
    wash(1, R.eras, R.bezIn, 0, TAU, take(0.035), TINT.eras, 0.2, 0.04)
    circle(1, R.eras, take(0.012), GOLD, 0.8, 0.04); circle(1, R.bezIn, take(0.014), GOLD, 0.85, 0.04)
    ERAS.forEach(([, b0, b1], k) => {
      radial(1, thBook(b0), R.eras, R.bezIn, 100, GOLD, 0.85, 0.04)
      const arc = (b1 - b0) * BOOK * (R.eras + R.bezIn) / 2
      arcText(1, eraL[k], thBook((b0 + b1) / 2), (R.eras + R.bezIn) / 2, 0.075, arc * 0.84, take(0.0075), [1.0, 0.84, 0.5], 0.6, 0.04)
    })
    // ---- bezel: double rim, 240 fine ticks ----
    circle(0, R.bez, take(0.011), GOLD, 0.8, 0.06); circle(0, R.bez2, take(0.007), IV, 0.4, 0.06)
    wash(0, R.bezIn, R.bez, 0, TAU, take(0.02), GOLD, 0.12, 0.06)
    for (let k = 0; k < 240; k++) radial(0, k * (TAU / 240), R.bezIn + 0.01, k % 5 ? R.bezIn + 0.06 : R.bezIn + 0.11, k % 5 ? 7 : 11, k % 5 ? GOLD : IV, 0.6, 0.06)
    // ---- reading window (fixed, top) ----
    const w0 = Math.PI / 2 - 12 * D, w1 = Math.PI / 2 + 12 * D
    wash(0, R.books, R.eras, w0, w1, take(0.012), GOLD, 0.16, 0.05)
    circle(0, R.books, take(0.004), IV, 0.8, 0.05, w0, w1); circle(0, R.eras, take(0.004), IV, 0.8, 0.05, w0, w1)
    radial(0, w0, R.books, R.eras, 60, IV, 0.8, 0.05); radial(0, w1, R.books, R.eras, 60, IV, 0.8, 0.05)
    // ---- pointer arm: tapered shaft, diamond head, counterweight ring ----
    const nSh = take(0.016)
    for (let i = 0; i < nSh; i++) { const u = rand(), r = R.rays + u * (R.bez2 - R.rays), hw = 0.008 * (1 - 0.7 * u); put((rand() * 2 - 1) * hw, r, 0.16, 8, IV, 0.42) }
    const nHd = take(0.006)
    for (let i = 0; i < nHd; i++) { let u = rand() * 2 - 1, v = rand() * 2 - 1; if (Math.abs(u) + Math.abs(v) > 1) { u = Math.sign(u) * (1 - Math.abs(u)); v = Math.sign(v) * (1 - Math.abs(v)) }; put(u * 0.045, R.bez2 + 0.11 + v * 0.11, 0.17, 8, GOLD, 0.9) }
    for (let i = 0; i < take(0.004); i++) { const a = rand() * TAU; put(0.1 * Math.cos(a), -0.88 + 0.1 * Math.sin(a), 0.16, 8, GOLD, 0.8) }
    for (let i = 0; i < take(0.003); i++) { const u = rand(); put((rand() - 0.5) * 0.02, -R.rays - u * (0.88 - 0.1 - R.rays), 0.16, 8, IV, 0.6) }
    // ---- halo behind the instrument ----
    const nHalo = take(0.04)
    for (let i = 0; i < nHalo; i++) { const r = 3.4 * Math.pow(rand(), 0.7), th = rand() * TAU; put(r * Math.cos(th), r * Math.sin(th), -0.3 - rand() * 0.2, 0, GOLD, 0.03) }
    // ---- dust: the rest ----
    H.dust(pos, col, idx, N, rand, 6.6, 0.07 * boost, [0.95, 0.84, 0.6])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 9
  },
  glsl: /* glsl */ `
const float CP_TX = -0.50;
const float CP_TY = 0.22;
float cp_ang(float cl, float t) {
  if (cl < 0.5) return 0.0;
  if (cl < 1.5) return t * 0.022;
  if (cl < 2.5) return -t * 0.032;
  if (cl < 3.5) return t * 0.05;
  if (cl < 4.5) return -t * 0.075;
  if (cl < 5.5) return t * 0.11;
  if (cl < 6.5) return t * 0.16;
  if (cl > 7.5 && cl < 8.5) return 0.035 * sin(t * 0.6) + 0.012 * sin(t * 2.3);
  return 0.0;
}
vec3 cp_tilt(vec3 q) {
  float ca = cos(CP_TX), sa = sin(CP_TX);
  q = vec3(q.x, q.y * ca - q.z * sa, q.y * sa + q.z * ca);
  float cb = cos(CP_TY), sb = sin(CP_TY);
  return vec3(q.x * cb + q.z * sb, q.y, -q.x * sb + q.z * cb);
}
vec3 anim_compass(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 8.5) return p + 0.04 * vec3(sin(t * 0.13 + r.x * 40.0), sin(t * 0.11 + r.y * 40.0), sin(t * 0.09 + r.z * 40.0));
  float a = cp_ang(cl, t);
  float c = cos(a), s = sin(a);
  vec3 q = vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  if (cl > 5.5 && cl < 6.5) q.xy *= 1.0 + 0.05 * sin(t * 2.4 + atan(p.y, p.x) * 12.0);
  if (cl > 6.5 && cl < 7.5) q.xy *= 1.0 + 0.02 * sin(t * 1.6);
  return cp_tilt(q);
}
float size_compass(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 8.5) return 1.0;
  if (cl > 7.5) return 1.3;
  if (cl > 5.5 && cl < 6.5) return 1.2;
  return 0.95;
}
vec4 color_compass(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 8.5) return c;
  vec3 rgb = c.rgb; float a = c.a;
  if (cl > 1.5 && cl < 4.5) {
    float th = atan(d.y, d.x) + cp_ang(cl, t);
    float dd = abs(mod(th - 1.5707963 + 3.1415927, 6.2831853) - 3.1415927);
    float w = exp(-dd * dd / (2.0 * 0.16 * 0.16));
    float k = cl < 2.5 ? 1.6 : (cl < 3.5 ? 0.8 : 0.4);
    a *= 1.0 + k * w;
    rgb = mix(rgb, vec3(1.0, 0.95, 0.82), clamp(0.5 * w * k, 0.0, 0.8));
  }
  if (cl < 0.5) a *= 0.8 + 0.2 * sin(t * (0.8 + r.x * 1.6) + r.y * 30.0);
  if (cl > 5.5 && cl < 6.5) a *= 0.8 + 0.4 * sin(t * 2.4 + atan(d.y, d.x) * 12.0);
  if (cl > 6.5 && cl < 7.5) a *= 0.9 + 0.2 * sin(t * 1.6);
  return vec4(rgb, a);
}`,
  camera: { pos: [0.3, 0.9, 11.3], target: [0.3, 0.5, 0], fov: 35 },
  pointSize: 1.9,
  drift: 0.012,
}
export default form
