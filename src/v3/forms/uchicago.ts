// FORM "uchicago" — Education, the main beat. A gothic university at night, built from particles: a tall
// chapel tower (belfry lancets, parapet, four corner pinnacles, lantern and spire), a west front with a
// stained-glass rose window, a nave running back with buttresses, a low hall with a stair turret, and a
// cloistered quad arcade in front whose frieze carries the Latin motto CRESCAT SCIENTIA · VITA EXCOLATUR
// (textMask, Bodoni). Warm window light (gold, with maroon and amber cells) against moonlit stone; maroon
// banners hang from the arcade piers; autumn leaves drift through the whole scene; lamps glow on the quad.
// No logos. Words come from the university's own motto; nothing else is claimed.
//
// pos.w = class + phase (phase in [0, 0.98) is a per-particle random used for flicker):
//  0 stone wash · 1 stone line · 2 glass · 3 rose tracery (turns) · 4 motto · 5 leaf · 6 star · 7 moon ·
//  8 ground · 9 lamp / arcade glow · 10 banner · 11 mist · 12 belfry glass (flares as the bell tolls)
import type { FormDef } from './types'
import { H } from './ctx'

type V3 = [number, number, number]
type C3 = [number, number, number]
interface Fr { o: V3; ex: V3; ey: V3 }
const TAU = Math.PI * 2

const STONE: C3 = [0.8, 0.7, 0.56], STONE_HI: C3 = [1.0, 0.91, 0.76], STONE_LO: C3 = [0.56, 0.47, 0.38]   // warm limestone, lit from the quad
const GOLD: C3 = [1.0, 0.77, 0.34], PALE: C3 = [1.0, 0.9, 0.66], AMBER: C3 = [1.0, 0.52, 0.17]
const PHONE = typeof innerWidth === 'number' && innerWidth <= 760
const MAROON: C3 = [0.8, 0.06, 0.12], MAROON_D: C3 = [0.62, 0.04, 0.09]   // #800000 pushed up so it holds against the additive black
const LEAF: C3[] = [[0.9, 0.12, 0.16], [1.0, 0.76, 0.28], [1.0, 0.48, 0.13], [0.78, 0.26, 0.1]]
const PAL_GLASS: C3[] = [GOLD, MAROON, PALE, MAROON, AMBER, GOLD, MAROON, MAROON]
const PAL_DOOR: C3[] = [PALE, GOLD, PALE, GOLD, AMBER]
const MOTTO = 'CRESCAT SCIENTIA · VITA EXCOLATUR'

const sc = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const P = (f: Fr, s: number, t: number): V3 => add(add(f.o, sc(f.ex, s)), sc(f.ey, t))
const FRONT = (z: number, x0 = 0): Fr => ({ o: [x0, 0, z], ex: [1, 0, 0], ey: [0, 1, 0] })
// height of a pointed (two-centre) arch above its springing line at horizontal offset adx from the axis
const archY = (adx: number, hs: number, R: number) => Math.sqrt(Math.max(0, R * R - (adx + R - hs) * (adx + R - hs)))
const apexOf = (hs: number, R: number) => Math.sqrt(R * R - (R - hs) * (R - hs))
const hsh = (a: number, b: number, c: number) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }

const form: FormDef = {
  id: 'uchicago',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const S = N / 262144, B = Math.pow(1 / S, 0.8) * 0.72     // v15: +20% on the build gain (was 0.6); the style's gain below adds the rest, the size the last bit: about +45% in all
    const n = (x: number) => Math.max(1, Math.round(x * S))
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: C3, a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * B) }
    const emit = (p: V3, cls: number, c: C3, a: number) => put(p[0], p[1], p[2], cls + rand() * 0.98, c, cls === 1 ? a * 0.85 : a)
    const J = 0.0028                                  // v15: a tighter drawing (was 0.005): the strokes of stone read as lines, not fuzz

    // ---- primitives (counts are given for 262144 particles and scaled) -------------------------
    const seg = (a: V3, b: V3, cnt: number, cls: number, c: C3, al: number) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const u = (i + rand()) / m; emit([a[0] + (b[0] - a[0]) * u + (rand() - 0.5) * J, a[1] + (b[1] - a[1]) * u + (rand() - 0.5) * J, a[2] + (b[2] - a[2]) * u + (rand() - 0.5) * J], cls, c, al) }
    }
    const quad = (o: V3, du: V3, dv: V3, cnt: number, cls: number, c: C3, al: number) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const u = rand(), v = rand(); emit([o[0] + du[0] * u + dv[0] * v, o[1] + du[1] * u + dv[1] * v, o[2] + du[2] * u + dv[2] * v], cls, c, al) }
    }
    const seg2 = (f: Fr, s0: number, t0: number, s1: number, t1: number, cnt: number, cls: number, c: C3, al: number) => seg(P(f, s0, t0), P(f, s1, t1), cnt, cls, c, al)
    const rect2 = (f: Fr, s0: number, t0: number, s1: number, t1: number, cnt: number, cls: number, c: C3, al: number) => quad(P(f, s0, t0), sc(f.ex, s1 - s0), sc(f.ey, t1 - t0), cnt, cls, c, al)
    const ring = (cx: number, cy: number, cz: number, r: number, cnt: number, cls: number, c: C3, al: number, ax = 1) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const a = ((i + rand()) / m) * TAU; emit(ax === 1 ? [cx + r * Math.cos(a), cy + r * Math.sin(a), cz] : [cx + r * Math.cos(a), cy, cz + r * Math.sin(a)], cls, c, al) }
    }
    // outline of a pointed arch: springing at height y0, half span hs, radius R (a larger R is a sharper lancet)
    const archLine = (f: Fr, cs: number, y0: number, hs: number, R: number, cnt: number, cls: number, c: C3, al: number) => {
      const ta = Math.acos(-(R - hs) / R), m = Math.max(2, n(cnt) >> 1)
      for (let side = 0; side < 2; side++) for (let k = 0; k < m; k++) {
        const th = ta + (Math.PI - ta) * ((k + rand()) / m), dx = (R - hs) + R * Math.cos(th), y = y0 + R * Math.sin(th)
        emit(P(f, cs + (side ? -dx : dx), y), cls, c, al)
      }
    }
    // a lancet window: leaded stained glass + hood moulding, jambs, sill, mullion
    const lancet = (f: Fr, cs: number, yb: number, hs: number, R: number, Ht: number, glass: number, cls: number, pal: C3[], jambs = true) => {
      const ap = apexOf(hs, R), y0 = yb + Ht - ap, m = n(glass * 0.5), seed = Math.floor(cs * 100 + yb * 1000)
      const cw = Math.max(0.05, hs * 0.95), ch = 0.115
      for (let i = 0, tries = 0; i < m && tries < m * 8; tries++) {
        const s = (rand() * 2 - 1) * hs, t = yb + rand() * Ht
        if (t > y0 + archY(Math.abs(s), hs, R)) continue
        i++
        const cx = (s + hs) / cw, cy = (t - yb) / ch, fx = cx - Math.floor(cx), fy = cy - Math.floor(cy)
        const lead = fx < 0.08 || fx > 0.92 || fy < 0.1 || fy > 0.9
        const h = hsh(Math.floor(cx), Math.floor(cy), seed), c = pal[Math.floor(h * pal.length) % pal.length]
        const glow = 0.8 + 0.2 * (1 - (t - yb) / Ht)
        emit(P(f, cs + s, t), cls, c, lead ? 0.2 : 0.7 * glow)
      }
      archLine(f, cs, y0, hs + 0.012, R, 70 + hs * 500, 1, STONE_HI, 0.8)
      archLine(f, cs, y0, hs + 0.05, R * 1.05, 60 + hs * 400, 1, STONE, 0.45)
      if (jambs) {
        seg2(f, cs - hs - 0.012, yb, cs - hs - 0.012, y0, 40 + Ht * 60, 1, STONE_HI, 0.7); seg2(f, cs + hs + 0.012, yb, cs + hs + 0.012, y0, 40 + Ht * 60, 1, STONE_HI, 0.7)
        seg2(f, cs - hs - 0.05, yb - 0.02, cs + hs + 0.05, yb - 0.02, 30 + hs * 200, 1, STONE_HI, 0.7)
      }
      if (hs > 0.085) seg2(f, cs, yb, cs, y0 + ap * 0.45, 30 + Ht * 40, 1, STONE_HI, 0.7)
    }
    // a rose window: 12 sectors of leaded glass in three rings, petals, spokes, a fixed rim
    const rose = (f: Fr, cs: number, cy: number, r: number, glass: number) => {
      const pt = (rad: number, ang: number): V3 => P(f, cs + rad * Math.cos(ang), cy + rad * Math.sin(ang))
      const m = n(glass * 0.55), sec = TAU / 12
      for (let i = 0; i < m; i++) {
        const rad = r * 0.97 * Math.sqrt(rand()), ang = rand() * TAU, q = ang / sec, fr = q - Math.floor(q), sector = Math.floor(q), rr = rad / r
        const ringI = rr < 0.3 ? 0 : rr < 0.66 ? 1 : 2
        const lead = fr < 0.07 || fr > 0.93 || Math.abs(rr - 0.3) < 0.03 || Math.abs(rr - 0.66) < 0.03
        const c = ringI === 0 ? PALE : ((sector + ringI) & 1 ? (ringI === 1 ? MAROON : AMBER) : GOLD)
        emit(pt(rad, ang), 3, c, lead ? 0.2 : (ringI === 0 ? 1.0 : 0.75))
      }
      for (let k = 0; k < 12; k++) {
        const a = k * sec
        seg(pt(0.3 * r, a), pt(r, a), 34, 3, STONE_HI, 0.7)
        const pc = pt(0.8 * r, a + sec / 2), rp = 0.15 * r, mm = n(30)
        for (let i = 0; i < mm; i++) { const t = ((i + rand()) / mm) * TAU; emit(P(f, cs + 0.8 * r * Math.cos(a + sec / 2) + rp * Math.cos(t), cy + 0.8 * r * Math.sin(a + sec / 2) + rp * Math.sin(t)), 3, STONE_HI, 0.55) }
        void pc
      }
      for (const q of [0.3, 0.66]) { const mm = n(90 * q * 3); for (let i = 0; i < mm; i++) { const a = ((i + rand()) / mm) * TAU; emit(pt(q * r, a), 3, STONE_HI, 0.7) } }
      { const mm = n(260); for (let i = 0; i < mm; i++) { const a = ((i + rand()) / mm) * TAU; emit(pt(r + 0.012, a), 1, STONE_HI, 0.9); emit(pt(r + 0.05, a), 1, STONE, 0.5) } }
    }
    const courses = (f: Fr, s0: number, s1: number, t0: number, t1: number, step: number, cnt: number, al: number) => { for (let t = t0; t <= t1 + 1e-6; t += step) seg2(f, s0, t, s1, t, cnt, 1, STONE_LO, al) }
    const merlons = (f: Fr, s0: number, s1: number, t: number, w: number, hgt: number) => {
      for (let s = s0; s + w <= s1 + 1e-6; s += w * 2) { seg2(f, s, t, s, t + hgt, 12, 1, STONE_HI, 0.7); seg2(f, s + w, t, s + w, t + hgt, 12, 1, STONE_HI, 0.7); seg2(f, s, t + hgt, s + w, t + hgt, 12, 1, STONE_HI, 0.8) }
      seg2(f, s0, t, s1, t, 50, 1, STONE_HI, 0.7)
    }
    const pyramid = (cx: number, cz: number, y0: number, half: number, y1: number, cnt: number, c: C3, al: number, ringsN = 0) => {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg([cx + sx * half, y0, cz + sz * half], [cx, y1, cz], cnt, 1, c, al)
      for (let k = 1; k <= ringsN; k++) { const u = k / (ringsN + 1), hh = half * (1 - u), yy = y0 + (y1 - y0) * u; seg([cx - hh, yy, cz + hh], [cx + hh, yy, cz + hh], 16, 1, STONE, 0.5); seg([cx - hh, yy, cz - hh], [cx - hh, yy, cz + hh], 10, 1, STONE, 0.4); seg([cx + hh, yy, cz - hh], [cx + hh, yy, cz + hh], 10, 1, STONE, 0.4) }
    }
    const box = (cx: number, cz: number, y0: number, y1: number, half: number, cnt: number, al: number) => {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg([cx + sx * half, y0, cz + sz * half], [cx + sx * half, y1, cz + sz * half], cnt, 1, STONE_HI, al)
    }

    // ============ 1. THE MOTTO — an inscription UNDER the building (v15: a quiet caption on the plinth line, alpha 0.36; it used to be carved across the frieze at full strength and fought the windows) ============
    const mk = await ctx.textMask(MOTTO, { font: '700 128px "Bodoni Moda Variable", "Didot", Georgia, serif', width: 3400, height: 220, align: 'center' })
    {
      let x0 = 3400, x1 = 0, y0 = 220, y1 = 0; const dd = mk.data
      for (let y = 0; y < 220; y++) for (let x = 0; x < 3400; x++) if (dd[(y * 3400 + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 <= x0) { x0 = 0; x1 = 3400; y0 = 0; y1 = 220 }
      const inkW = x1 - x0 + 1, inkH = y1 - y0 + 1, k = Math.min(0.17 / inkH, 6.2 / inkW), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      for (const q of H.sampleMask(mk, n(24000), rand)) put((q[0] - cx) * k, -1.76 + (cy - q[1]) * k, 1.4 + (rand() - 0.5) * 0.012, 4 + rand() * 0.98, [1, 0.96, 0.82], 0.36)
    }

    // ============ 2. THE TOWER ============
    const T = { x0: 0.15, x1: 1.35, z0: -0.9, z1: 0.3 }, YB = -1.6, YT = 1.4, TW = 1.2
    const faces: Fr[] = [
      { o: [T.x0, 0, T.z1], ex: [1, 0, 0], ey: [0, 1, 0] }, { o: [T.x1, 0, T.z0], ex: [-1, 0, 0], ey: [0, 1, 0] },
      { o: [T.x0, 0, T.z0], ex: [0, 0, 1], ey: [0, 1, 0] }, { o: [T.x1, 0, T.z1], ex: [0, 0, -1], ey: [0, 1, 0] },
    ]
    faces.forEach((f, fi) => {
      rect2(f, 0, YB, TW, YT, 1100, 0, STONE, 0.06)
      courses(f, 0, TW, YB + 0.1, YT, 0.18, 50, 0.2)
      for (const y of [-0.58, 0.4, 1.28]) { seg2(f, -0.02, y, TW + 0.02, y, 90, 1, STONE_HI, 0.7); seg2(f, -0.02, y - 0.03, TW + 0.02, y - 0.03, 60, 1, STONE, 0.4) }
      // buttress strips at the corners
      for (const s of [0.0, TW]) { seg2(f, s, YB, s, YT + 0.12, 200, 1, STONE_HI, 0.75); seg2(f, s + (s ? 0.07 : -0.07), YB, s + (s ? 0.07 : -0.07), 0.2, 100, 1, STONE, 0.45); seg2(f, s + (s ? 0.07 : -0.07), 0.2, s, 0.35, 16, 1, STONE, 0.45) }
      lancet(f, 0.32, -0.5, 0.1, 0.26, 0.9, 900, 2, PAL_GLASS)
      lancet(f, 0.88, -0.5, 0.1, 0.26, 0.9, 900, 2, PAL_GLASS)
      if (fi === 0) lancet(f, 0.6, YB, 0.2, 0.5, 0.98, 1500, 2, PAL_DOOR)
      else seg2(f, 0.35, YB, 0.35, -0.7, 20, 1, STONE_LO, 0.3)
      for (const cs of [0.27, 0.6, 0.93]) lancet(f, cs, 0.5, 0.07, 0.22, 0.66, 420, 12, [GOLD, PALE, AMBER, GOLD])
      merlons(f, 0.0, TW, YT, 0.1, 0.1)
      seg2(f, 0, YT + 0.1, TW, YT + 0.1, 40, 1, STONE_HI, 0.4)
    })
    for (const [x, z] of [[T.x0, T.z0], [T.x1, T.z0], [T.x1, T.z1], [T.x0, T.z1]]) {
      box(x, z, YT, 1.98, 0.05, 90, 0.9); pyramid(x, z, 1.98, 0.065, 2.28, 60, STONE_HI, 0.9, 2)
      seg([x - 0.065, 1.98, z], [x + 0.065, 1.98, z], 14, 1, STONE_HI, 0.7)
      const mm = n(22); for (let i = 0; i < mm; i++) emit([x + (rand() - 0.5) * 0.02, 2.28 + rand() * 0.07, z + (rand() - 0.5) * 0.02], 1, PALE, 1.0)
    }
    // lantern and spire
    {
      const cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, lh = 0.27
      box(cx, cz, YT + 0.1, 2.02, lh, 160, 0.85)
      for (const y of [YT + 0.1, 1.72, 2.02]) { seg([cx - lh, y, cz + lh], [cx + lh, y, cz + lh], 70, 1, STONE_HI, 0.7); seg([cx - lh, y, cz - lh], [cx - lh, y, cz + lh], 50, 1, STONE_HI, 0.6); seg([cx + lh, y, cz - lh], [cx + lh, y, cz + lh], 50, 1, STONE_HI, 0.6) }
      const lf: Fr = { o: [cx - lh, 0, cz + lh], ex: [1, 0, 0], ey: [0, 1, 0] }
      lancet(lf, lh, 1.62, 0.07, 0.2, 0.34, 220, 12, [PALE, GOLD, AMBER]); lancet(lf, 0.09, 1.62, 0.04, 0.12, 0.28, 90, 12, [GOLD, PALE]); lancet(lf, lh * 2 - 0.09, 1.62, 0.04, 0.12, 0.28, 90, 12, [GOLD, PALE])
      rect2(lf, 0, YT + 0.1, lh * 2, 2.02, 500, 0, STONE, 0.08)
      pyramid(cx, cz, 2.02, lh + 0.02, 2.78, 190, STONE_HI, 0.95, 9)
      const mm = n(60); for (let i = 0; i < mm; i++) emit([cx + (rand() - 0.5) * 0.02, 2.74 + rand() * 0.14, cz + (rand() - 0.5) * 0.02], 1, PALE, 1.0)
    }

    // ============ 3. WEST FRONT with ROSE WINDOW (left of the tower) ============
    const GF = FRONT(0.0, -3.5), GW = 1.8, EV = 0.35, AP = 1.55
    rect2(GF, 0, YB, GW, EV, 1500, 0, STONE, 0.07)
    for (let i = 0, m = n(1700); i < m; i++) { const s = rand() * GW, hh = (AP - EV) * (1 - Math.abs(s - GW / 2) / (GW / 2)); emit(P(GF, s, EV + rand() * hh), 0, STONE, 0.07) }
    seg2(GF, 0, EV, GW / 2, AP, 150, 1, STONE_HI, 0.9); seg2(GF, GW, EV, GW / 2, AP, 150, 1, STONE_HI, 0.9)
    seg2(GF, 0.05, EV - 0.02, GW - 0.05, EV - 0.02, 90, 1, STONE_HI, 0.6)
    seg2(GF, -0.04, YB, -0.04, EV, 150, 1, STONE_HI, 0.8); seg2(GF, GW + 0.04, YB, GW + 0.04, EV, 150, 1, STONE_HI, 0.8)
    seg2(GF, -0.05, EV - 1e-3, 0.05, EV + 0.08, 12, 1, STONE_HI, 0.5)
    {
      const o = P(GF, GW / 2, AP); seg(o, [o[0], o[1] + 0.26, o[2]], 40, 1, PALE, 1.0); seg([o[0] - 0.08, o[1] + 0.17, o[2]], [o[0] + 0.08, o[1] + 0.17, o[2]], 18, 1, PALE, 1.0)
    }
    courses(GF, 0, GW, YB + 0.1, EV, 0.2, 40, 0.18)
    rose(GF, GW / 2, 0.8, 0.38, 6000)
    lancet(GF, 0.9, -0.55, 0.12, 0.3, 0.85, 1000, 2, PAL_GLASS); lancet(GF, 0.45, -0.55, 0.09, 0.24, 0.7, 640, 2, PAL_GLASS); lancet(GF, 1.35, -0.55, 0.09, 0.24, 0.7, 640, 2, PAL_GLASS)
    lancet(GF, 0.9, YB, 0.26, 0.62, 0.98, 1500, 2, PAL_DOOR)
    // nave: roof, side walls with clerestory lancets and buttresses
    const NZ = -3.0, NX0 = -3.5, NX1 = -1.7, RX = -2.6
    for (const [xe, xr] of [[NX0, RX], [NX1, RX]]) {
      quad([xe, EV, 0], [xr - xe, AP - EV, 0], [0, 0, NZ], 1500, 0, STONE, 0.06)
      for (let k = 0; k <= 10; k++) { const u = k / 10; seg([xe + (xr - xe) * u, EV + (AP - EV) * u, 0], [xe + (xr - xe) * u, EV + (AP - EV) * u, NZ], 60, 1, STONE_LO, 0.28) }
      for (let k = 0; k <= 12; k++) seg([xe, EV, -k * 0.25], [xr, AP, -k * 0.25], 40, 1, STONE_LO, 0.22)
    }
    seg([RX, AP, 0], [RX, AP, NZ], 130, 1, STONE_HI, 0.9); seg([NX0, EV, 0], [NX0, EV, NZ], 110, 1, STONE_HI, 0.7); seg([NX1, EV, 0], [NX1, EV, NZ], 110, 1, STONE_HI, 0.7)
    for (const [xw, dir] of [[NX0, 1], [NX1, -1]]) {
      const f: Fr = { o: [xw, 0, 0], ex: [0, 0, -1], ey: [0, 1, 0] }
      rect2(f, 0, YB, 3.0, EV, 1400, 0, STONE, 0.06)
      courses(f, 0, 3.0, YB + 0.1, EV, 0.22, 60, 0.16)
      for (let k = 0; k < 5; k++) lancet(f, 0.4 + k * 0.55, -0.55, 0.085, 0.24, 0.8, 560, 2, PAL_GLASS)
      for (let k = 0; k <= 5; k++) { const s = 0.125 + k * 0.55; const out: V3 = [dir * -0.12, 0, 0]; void out; seg2(f, s, YB, s, EV + 0.05, 90, 1, STONE_HI, 0.55); seg([f.o[0] + dir * -0.1, YB, -s], [f.o[0] + dir * -0.1, 0.1, -s], 60, 1, STONE, 0.4); seg([f.o[0] + dir * -0.1, 0.1, -s], [f.o[0], EV, -s], 14, 1, STONE, 0.4) }
    }
    // link block between nave and tower
    {
      const f = FRONT(-0.05, -1.7), W = 1.85
      rect2(f, 0, YB, W, -0.1, 800, 0, STONE, 0.06); courses(f, 0, W, YB + 0.1, -0.1, 0.2, 40, 0.16)
      lancet(f, 0.45, -1.0, 0.07, 0.2, 0.7, 420, 2, PAL_GLASS); lancet(f, 1.4, -1.0, 0.07, 0.2, 0.7, 420, 2, PAL_GLASS)
      merlons(f, 0, W, -0.1, 0.1, 0.09)
    }

    // ============ 4. HALL and stair turret (right of the tower) ============
    {
      const f = FRONT(-0.1, 1.35), W = 2.25
      rect2(f, 0, YB, W, 0.25, 1500, 0, STONE, 0.065); courses(f, 0, W, YB + 0.1, 0.25, 0.2, 60, 0.17)
      for (let k = 0; k < 4; k++) lancet(f, 0.34 + k * 0.52, -0.7, 0.1, 0.27, 0.85, 700, 2, PAL_GLASS)
      lancet(f, W - 0.18, -1.05, 0.04, 0.12, 0.5, 120, 2, [GOLD, PALE])
      merlons(f, 0, W - 0.4, 0.25, 0.1, 0.09)
      for (let k = 0; k <= 4; k++) seg2(f, 0.08 + k * 0.52, YB, 0.08 + k * 0.52, 0.28, 90, 1, STONE_HI, 0.5)
      seg([1.35, 0.25, -0.1], [1.35 + 1.0, 0.8, -0.5], 50, 1, STONE_HI, 0.8); seg([1.35 + 2.25 - 0.4, 0.25, -0.1], [1.35 + 1.2, 0.8, -0.5], 50, 1, STONE_HI, 0.8); seg([2.35, 0.8, -0.5], [2.55, 0.8, -0.5], 20, 1, STONE_HI, 0.8)
      // turret
      const tx = 3.45, tz = -0.15, tr = 0.2
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; seg([tx + tr * Math.cos(a), YB, tz + tr * Math.sin(a)], [tx + tr * Math.cos(a), 1.0, tz + tr * Math.sin(a)], 110, 1, k < 5 ? STONE_HI : STONE_LO, k < 5 ? 0.7 : 0.35) }
      for (let y = YB + 0.1; y <= 1.0; y += 0.2) ring(tx, y, tz, tr, 70, 1, STONE_LO, 0.3, 0)
      ring(tx, 1.0, tz, tr + 0.03, 120, 1, STONE_HI, 0.85, 0)
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; seg([tx + (tr + 0.03) * Math.cos(a), 1.0, tz + (tr + 0.03) * Math.sin(a)], [tx, 1.55, tz], 50, 1, STONE_HI, 0.8) }
      for (const y of [-0.4, 0.4]) lancet({ o: [tx, 0, tz + tr], ex: [1, 0, 0], ey: [0, 1, 0] }, 0, y, 0.035, 0.1, 0.34, 100, 2, [GOLD, AMBER])
      const mm = n(40); for (let i = 0; i < mm; i++) emit([tx + (rand() - 0.5) * 0.02, 1.55 + rand() * 0.12, tz + (rand() - 0.5) * 0.02], 1, PALE, 1.0)
    }

    // ============ 5. THE CLOISTER ARCADE (front, with returns) ============
    const arcade = (f: Fr, bays: number, withBanners: boolean) => {
      const BW = 0.8, hs = 0.31, R = 0.66, y0 = -1.32, W = bays * BW
      rect2(f, 0, YB, W, -0.74, bays * 380, 0, STONE, 0.06)
      for (let k = 0; k < bays; k++) {
        const cs = BW * (k + 0.5)
        archLine(f, cs, y0, hs, R, 320, 1, STONE_HI, 0.95); archLine(f, cs, y0, hs + 0.045, R * 1.04, 280, 1, STONE, 0.55)
        // lit interior of each bay: a warm gold wash that fades toward the arch
        const m = n(520)
        for (let i = 0, tries = 0; i < m && tries < m * 8; tries++) { const s = (rand() * 2 - 1) * hs, t = YB + rand() * (y0 + apexOf(hs, R) - YB); if (t > y0 + archY(Math.abs(s), hs, R)) continue; i++; emit(P(f, cs + s, t - 0.02 * 0 + 0), 9, AMBER, 0.05 + 0.1 * (1 - Math.min(1, (t - YB) / 1.0))) }
        // inner arch shadow-line (the vault soffit)
        archLine(f, cs, y0, hs - 0.04, R * 0.9, 200, 1, STONE_LO, 0.45)
      }
      for (let k = 0; k <= bays; k++) {
        const s = k * BW
        seg2(f, s - 0.07, YB, s - 0.07, y0, 90, 1, STONE_HI, 0.8); seg2(f, s + 0.07, YB, s + 0.07, y0, 90, 1, STONE_HI, 0.8)
        seg2(f, s - 0.1, y0 - 0.02, s + 0.1, y0 - 0.02, 18, 1, STONE_HI, 0.8); seg2(f, s - 0.1, YB + 0.03, s + 0.1, YB + 0.03, 18, 1, STONE_HI, 0.6)
        seg2(f, s - 0.07, y0, s - 0.07, -0.74, 40, 1, STONE, 0.4)
      }
      // frieze band: a maroon wash behind the lettering, gold rules, a crenellated cornice
      rect2(f, -0.05, -0.78, W + 0.05, -0.46, bays * 420, 10, MAROON_D, 0.26)
      for (const y of [-0.78, -0.46]) seg2(f, -0.05, y, W + 0.05, y, bays * 55, 1, GOLD, 0.7)
      seg2(f, -0.08, -0.43, W + 0.08, -0.43, bays * 50, 1, STONE_HI, 0.8)
      merlons(f, -0.05, W + 0.05, -0.42, 0.09, 0.08)
      if (withBanners) {
        for (const k of [1, 3, 7, 9]) {
          const s = k * BW
          for (let i = 0, m = n(900); i < m; i++) { const v = rand(), u = (rand() * 2 - 1) * 0.05, ty = -0.74 - v * 0.5, tail = v > 0.82 ? Math.abs(u) / 0.05 * 0.04 * (v - 0.82) / 0.18 * 4 : 0; emit(P(f, s + u, ty + tail * 0), 10, MAROON, 0.5 * (1 - 0.35 * v)) }
          seg2(f, s - 0.052, -0.74, s - 0.052, -1.24, 50, 10, GOLD, 0.7); seg2(f, s + 0.052, -0.74, s + 0.052, -1.24, 50, 10, GOLD, 0.7)
          seg2(f, s - 0.052, -1.24, s, -1.16, 14, 10, GOLD, 0.7); seg2(f, s + 0.052, -1.24, s, -1.16, 14, 10, GOLD, 0.7)
          seg2(f, s - 0.05, -0.78, s + 0.05, -0.78, 14, 10, GOLD, 0.8)
        }
      }
    }
    arcade(FRONT(1.3, -4.0), 10, true)
    arcade({ o: [-4.0, 0, 1.3], ex: [0, 0, -1], ey: [0, 1, 0] }, 2, false)
    arcade({ o: [4.0, 0, 1.3], ex: [0, 0, -1], ey: [0, 1, 0] }, 2, false)

    // ============ 6. GROUND, QUAD, LAMPS ============
    quad([-3.9, YB, -0.3], [7.8, 0, 0], [0, 0, 1.55], 5600, 8, [0.3, 0.55, 0.5], 0.06)           // the lawn
    for (const [a, b] of [[[-3.85, -0.25], [3.85, 1.25]], [[3.85, -0.25], [-3.85, 1.25]]] as [number, number][][]) {
      for (const o of [-0.045, 0.045]) seg([a[0], YB + 0.005, a[1] + o], [b[0], YB + 0.005, b[1] + o], 330, 8, STONE_HI, 0.4)
      quad([a[0], YB + 0.005, a[1] - 0.045], [b[0] - a[0], 0, b[1] - a[1]], [0, 0, 0.09], 350, 8, STONE, 0.1)
    }
    for (const rr of [0.5, 0.56]) { const m = n(260); for (let i = 0; i < m; i++) { const a = ((i + rand()) / m) * TAU; emit([rr * 1.9 * Math.cos(a), YB + 0.005, 0.5 + rr * 0.55 * Math.sin(a)], 8, STONE_HI, 0.4) } }
    quad([-6.5, YB - 0.01, -3.6], [13, 0, 0], [0, 0, 3.6], 3600, 8, STONE_LO, 0.025)          // outer ground, rear
    quad([-6.5, YB - 0.01, 1.4], [13, 0, 0], [0, 0, 1.6], 1800, 8, STONE_LO, 0.03)            // pavement in front of the arcade
    for (let k = 0; k < 8; k++) seg([-6.5, YB - 0.01, 1.5 + k * 0.18], [6.5, YB - 0.01, 1.5 + k * 0.18], 70, 8, STONE_LO, 0.12)
    for (const [lx, lz] of [[-2.7, 0.35], [-0.95, 0.95], [0.95, 0.95], [2.7, 0.35]]) {
      seg([lx, YB, lz], [lx, -1.18, lz], 50, 1, STONE_HI, 0.7)
      const mm = n(160); for (let i = 0; i < mm; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = 0.045 * Math.cbrt(rand()); emit([lx + Math.cos(th) * s * r, -1.14 + u * r * 1.3, lz + Math.sin(th) * s * r], 9, PALE, 0.9) }
      const hh = n(520); for (let i = 0; i < hh; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = 0.55 * Math.pow(rand(), 1.6); emit([lx + Math.cos(th) * s * r, -1.14 + u * r, lz + Math.sin(th) * s * r], 9, GOLD, 0.05) }
      const pp = n(450); for (let i = 0; i < pp; i++) { const th = rand() * TAU, r = 0.85 * Math.sqrt(rand()); emit([lx + Math.cos(th) * r, YB + 0.01, lz + Math.sin(th) * r * 0.6], 9, GOLD, 0.05 * (1 - r)) }
    }

    // ============ 7. SKY: stars, moon, mist ============
    for (let i = 0, m = n(4200); i < m; i++) { const th = rand() * Math.PI, ph = rand() * TAU, R = 14; emit([R * Math.sin(th) * Math.cos(ph) * 0.9, 0.3 + Math.abs(R * Math.cos(th)) * 0.34, -4.5 - rand() * 4 + Math.min(0, R * Math.sin(th) * Math.sin(ph) * 0.1)], 6, [0.82, 0.88, 1.0], 0.15 + 0.6 * Math.pow(rand(), 3)) }
    {
      const mx = -3.4, my = 2.45, mz = -2.6, mr = 0.28
      const craters: [number, number, number][] = [[0.1, 0.08, 0.07], [-0.12, -0.05, 0.09], [0.04, -0.16, 0.05], [-0.04, 0.17, 0.045]]
      for (let i = 0, m = n(3600); i < m; i++) {
        const r = mr * Math.sqrt(rand()), a = rand() * TAU, x = r * Math.cos(a), y = r * Math.sin(a)
        let dim = 1; for (const c of craters) if (Math.hypot(x - c[0], y - c[1]) < c[2]) dim = 0.5
        emit([mx + x, my + y, mz], 7, [0.95, 0.95, 0.88], 0.26 * dim * (0.75 + 0.5 * (x / mr)))
      }
      ring(mx, my, mz, mr, 260, 7, [1, 1, 0.92], 0.8)
      for (let i = 0, m = n(3200); i < m; i++) { const r = mr + 1.2 * Math.pow(rand(), 1.8), a = rand() * TAU; emit([mx + r * Math.cos(a), my + r * Math.sin(a), mz - 0.1], 7, [0.7, 0.8, 1.0], 0.05 * (1 - (r - mr) / 1.3)) }
    }
    for (let i = 0, m = n(3000); i < m; i++) emit([(rand() - 0.5) * 12, -1.58 + Math.pow(rand(), 1.6) * 0.75, -3 + rand() * 6.2], 11, [0.55, 0.65, 0.9], 0.02 + 0.04 * rand())

    // ============ 8. AUTUMN LEAVES ============
    for (let i = 0, m = n(2400); i < m; i++) {      // v15: half the leaves, smaller and fainter (they read as confetti against the brighter stone)
      const c = LEAF[Math.floor(rand() * LEAF.length)]
      put((rand() - 0.5) * 8.6, -1.7 + rand() * 4.7, -0.8 + rand() * 3.6, 5 + rand() * 0.98, c, 0.3 + 0.22 * rand())
    }

    // ============ 9. a halo behind the tower, then dust for whatever is left ============
    for (let i = 0, m = n(2000); i < m; i++) { const r = 2.6 * Math.pow(rand(), 0.8), a = rand() * TAU; emit([0.75 + r * Math.cos(a) * 1.2, 0.6 + r * Math.sin(a), -2.0], 11, [0.55, 0.62, 0.95], 0.025 * (1 - r / 2.7)) }
    for (let i = 0, m = n(1800); i < m; i++) { const r = 2.2 * Math.pow(rand(), 0.9), a = rand() * TAU; emit([0.75 + r * Math.cos(a) * 1.5, -0.2 + r * Math.sin(a) * 0.9, -2.2], 11, MAROON, 0.03 * (1 - r / 2.3)) }   // a maroon glow behind the skyline
    const used = idx
    H.dust(pos, col, idx, N, rand, 6.5, 0.05 * B, [0.6, 0.68, 0.95])
    for (let i = used; i < N; i++) pos[i * 4 + 3] = 6.5 // spare dust twinkles like stars
  },
  glsl: /* glsl */ `
const vec2 UC_ROSE = vec2(-2.6, 0.8);
float uc_leafY(vec4 d, vec4 r, float t) { return mod(d.y + 1.7 - t * (0.10 + 0.15 * r.y), 4.7) - 1.7; }
float uc_sweep(float x, float t) { float s = -6.5 + mod(t * 0.8, 17.0); float q = (x - s) / 0.7; return exp(-q * q); }
vec3 anim_uchicago(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 4.5 && cl < 5.5) {                       // leaves fall, sway and tumble
    float k = 0.5 + r.z * 0.9;
    return vec3(d.x + 0.32 * sin(t * k * 0.7 + r.x * 6.283) + 0.12 * t * 0.0, uc_leafY(d, r, t), d.z + 0.22 * cos(t * k * 0.6 + r.w * 6.283));
  }
  if (cl > 2.5 && cl < 3.5) {                       // the rose window turns
    vec2 q = p.xy - UC_ROSE; float a = t * 0.06; float c = cos(a), s = sin(a);
    return vec3(UC_ROSE + vec2(c * q.x - s * q.y, s * q.x + c * q.y), p.z);
  }
  if (cl > 9.5 && cl < 10.5) { p.x += sin(t * 1.3 + p.x * 3.0 + p.y * 2.0) * 0.022 * (-0.5 - p.y); p.z += sin(t * 1.1 + p.y * 4.0) * 0.012 * (-0.5 - p.y); return p; }
  if (cl > 10.5 && cl < 11.5) { p.x += sin(t * 0.07 + p.z * 0.9 + r.x * 3.0) * 0.5; p.y += sin(t * 0.2 + r.y * 20.0) * 0.03; return p; }
  return p;
}
float size_uchicago(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 4.5 && cl < 5.5) return 1.05;
  if (cl > 5.5 && cl < 6.5) return 0.7 + 0.8 * r.x;
  if (cl > 3.5 && cl < 4.5) return 0.9;
  if (cl > 6.5 && cl < 7.5) return 1.2;
  return 1.0;
}
vec4 color_uchicago(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), ph = fract(d.w);
  float a = c.a;
  vec3 rgb = c.rgb;
  float sw = uc_sweep(d.x, t);
  if (cl > 1.5 && cl < 3.5 || cl > 11.5) {          // lit glass: candle flicker, plus the passing sweep
    a *= 0.86 + 0.14 * sin(t * (1.1 + 2.0 * ph) + ph * 50.0);
    a *= 1.0 + 0.9 * sw;
    if (cl > 11.5) a *= 1.0 + 1.6 * exp(-mod(t, 9.0) * 1.1);   // the bell tolls: belfry flares then fades
  } else if (cl > 3.5 && cl < 4.5) {                // motto: the sweep reads the letters
    a *= 0.8 + 1.7 * sw;
    rgb = mix(rgb, vec3(1.0, 0.8, 0.45), 0.35 + 0.4 * sw);
  } else if (cl > 4.5 && cl < 5.5) {                // leaves flash as they turn
    float y = uc_leafY(d, r, t);
    a *= (0.45 + 0.55 * abs(sin(t * (1.2 + 2.0 * r.w) + r.x * 20.0))) * smoothstep(-1.7, -1.2, y) * (1.0 - smoothstep(2.3, 2.9, y));
  } else if (cl > 5.5 && cl < 6.5) {
    a *= 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.6 + 2.2 * r.y) + r.x * 90.0));
  } else if (cl > 8.5 && cl < 9.5) {
    a *= 0.85 + 0.15 * sin(t * 2.3 + ph * 60.0) * sin(t * 0.9 + ph * 13.0);
  } else if (cl > 10.5 && cl < 11.5) {
    a *= 0.7 + 0.3 * sin(t * 0.4 + r.x * 30.0);
  } else if (cl < 1.5 && cl > 0.5) {
    a *= 1.0 + 0.5 * sw;
  }
  // v15: a slow warm light climbs the chapel tower (stone, glass, belfry), lingers, and starts again from the foot
  if (d.x > 0.05 && d.x < 1.45 && d.z > -1.05 && d.z < 0.45 && (cl < 2.5 || cl > 11.5)) {
    float ty = -1.7 + mod(t * 0.3, 6.4);
    float q = (d.y - ty) / 0.34;
    float vs = exp(-q * q) + 0.22 * exp(-max(ty - d.y, 0.0) / 1.1) * step(d.y, ty);
    a *= 1.0 + 1.7 * vs;
    rgb = mix(rgb, vec3(1.0, 0.8, 0.46), clamp(0.55 * vs, 0.0, 0.6));
  }
  return vec4(rgb, a);
}`,
  camera: { pos: [0, 1.2, 9.9], target: [0, 0.55, 0], fov: 35 },
  pointSize: 2.0,
  // v15: the exterior was dim (a 0.5 gain on size 1.7 dots, 30% of them hidden): +15% size, +20% gain, fewer hidden, a crisper edge. With the build gain, about +45% overall.
  // w12: a phone has a quarter of the particles on a screen a quarter the width, and the stop read dim there (mean luma 35 against 49 for the market): +30% gain, +10% size on a phone only
  style: { solid: 1, size: PHONE ? 2.15 : 1.95, sharp: 0.5, opaque: 0.5, thin: 0.22, gain: PHONE ? 0.78 : 0.6 },
  drift: 0.004,
}
export default form
