// CHOMCHOM: learning and mindfulness games for young children. A soft pastel scene echoing the real
// app: a breathing bubble (8 s inhale/exhale, mist drawn in and out, a pacer ring) floats above the
// activity map, a mint field cut by a dark winding road with five stations (Daily Checkin, Mindfulness
// Challenge, Story, Games, Journaling). A little red car drives the road; each stop pings its station
// and pops a gold star plus confetti. Cycle = 14 s (CH_C); breath = 8 s (CH_BR).
//
// pos.w classes (frac*10 = station / cloud index where noted):
//   0 dust  1 field  2 flowers  3 curb  4 centre dashes  5 station disc+ring (k)  6 station icon (k)
//   7 tree (frac = height 0..0.9)  8 bush  9 cloud (i)  10 bubble shell  11 bubble glow  12 mist
//   13 pacer ring  14 rising motes  15 aura  16 star (k)  17 confetti (k)  18 car  19 car trail
import type { FormDef } from './types'
import { H } from './ctx'

const TAU = Math.PI * 2, D = Math.PI / 180
// ---- map plane -> world: the map lies back at 48 degrees, v runs up and away ----
const PHI = 48 * D, Y0 = -1.18, Z0 = -0.2
const EY: [number, number] = [Math.cos(PHI), -Math.sin(PHI)]   // (y, z) of the map's v axis
const EN: [number, number] = [Math.sin(PHI), Math.cos(PHI)]    // (y, z) of the map normal
const mapW = (u: number, v: number, h = 0): [number, number, number] => [u, Y0 + v * EY[0] + h * EN[0], Z0 + v * EY[1] + h * EN[1]]
// ---- road centreline: u across, v = A sin(F s + PH) ----
const U0 = -3.55, U1 = 3.55, PA = 1.0, PF = TAU * 1.15, PP = -1.35
const pu = (s: number) => U0 + (U1 - U0) * s
const pv = (s: number) => PA * Math.sin(PF * s + PP)
const pvd = (s: number) => PA * PF * Math.cos(PF * s + PP) / (U1 - U0)   // dv/du
const ROAD_HW = 0.27
const STS = [0.075, 0.275, 0.5, 0.725, 0.925]
const ST_COL: number[][] = [[0.4, 0.95, 0.9], [1.0, 0.6, 0.82], [1.0, 0.78, 0.42], [0.78, 0.72, 1.0], [0.5, 0.76, 1.0]]
const T0 = 1.0, GAP = 2.6, DWELL = 0.6, CYC = 14, BR = 8
const BC: [number, number, number] = [0, 1.62, -0.7]
const roadDist = (u: number, v: number) => { const s = (u - U0) / (U1 - U0); const sl = pvd(s); return Math.abs(v - pv(s)) / Math.sqrt(1 + sl * sl) }

type Icon = (a: number, b: number) => number[] | null
const dsc = (a: number, b: number, cx: number, cy: number, r: number) => (a - cx) * (a - cx) + (b - cy) * (b - cy) < r * r
const rct = (a: number, b: number, x0: number, y0: number, x1: number, y1: number) => a >= x0 && a <= x1 && b >= y0 && b <= y1
const ORANGE = [1.0, 0.62, 0.25], TEAL = [0.35, 0.95, 0.88], PINK = [1.0, 0.55, 0.8], LILAC = [0.7, 0.55, 1.0], BLUE = [0.45, 0.68, 1.0], WHITE = [0.95, 0.96, 1.0], YEL = [1.0, 0.88, 0.4]
const ICONS: Icon[] = [
  // clipboard with three rows (orange dot + teal line)
  (a, b) => {
    for (const y of [0.42, 0, -0.42]) { if (dsc(a, b, -0.42, y, 0.13)) return ORANGE; if (rct(a, b, -0.17, y - 0.05, 0.52, y + 0.05)) return TEAL }
    if (rct(a, b, -0.22, 0.8, 0.22, 1.0)) return TEAL
    return rct(a, b, -0.72, -0.84, 0.72, 0.88) && !rct(a, b, -0.64, -0.76, 0.64, 0.8) ? TEAL : null
  },
  // pink brain with a cleft, two eyes and a stem
  (a, b) => {
    if (rct(a, b, 0.0, -0.9, 0.24, -0.4)) return LILAC
    if (dsc(a, b, -0.2, 0.0, 0.09) || dsc(a, b, 0.2, 0.0, 0.09)) return null
    if (Math.abs(a) < 0.03 && b > 0.5) return null
    if (b < -0.16 && b > -0.34 && Math.abs(a) < 0.2 && Math.abs(b + 0.2 + 0.12 * a * a * 6) < 0.035) return null
    return dsc(a, b, -0.38, 0.22, 0.46) || dsc(a, b, 0.3, 0.3, 0.46) || dsc(a, b, 0, 0.5, 0.38) || dsc(a, b, -0.5, -0.18, 0.38) || dsc(a, b, 0.46, -0.12, 0.4) || dsc(a, b, 0, -0.2, 0.46) ? PINK : null
  },
  // orange fish reading a blue book
  (a, b) => {
    if (dsc(a, b, 0.35, 0.4, 0.07)) return null
    if (rct(a, b, -0.82, -0.88, -0.03, -0.18) || rct(a, b, 0.03, -0.88, 0.82, -0.18)) return (Math.abs(a) < 0.06) ? null : BLUE
    const e = ((a - 0.12) / 0.62) ** 2 + ((b - 0.3) / 0.4) ** 2 < 1
    const tail = a < -0.42 && a > -0.9 && Math.abs(b - 0.3) < (a + 0.9) * 0.55 * 0.9 + 0.0 && Math.abs(b - 0.3) < 0.38 * (1 - (-0.42 - a) / 0.48 * 0.0) && (a + 0.9) > Math.abs(b - 0.3) * 0.9
    return e || tail ? ORANGE : null
  },
  // gamepad
  (a, b) => {
    const body = ((a) / 0.92) ** 2 + ((b - 0.08) / 0.46) ** 2 < 1 || dsc(a, b, -0.6, -0.3, 0.3) || dsc(a, b, 0.6, -0.3, 0.3)
    if (!body) return null
    if ((Math.abs(a + 0.42) < 0.05 && Math.abs(b - 0.12) < 0.2) || (Math.abs(a + 0.42) < 0.2 && Math.abs(b - 0.12) < 0.05)) return null
    if (dsc(a, b, 0.38, 0.22, 0.09)) return PINK
    if (dsc(a, b, 0.56, 0.04, 0.09)) return YEL
    return WHITE
  },
  // blue notebook with a pencil
  (a, b) => {
    const dx = a - 0.08, dy = b + 0.62, al = dx * 0.5 + dy * 0.866, pe = -dx * 0.866 + dy * 0.5
    if (al > 0 && al < 1.15 && Math.abs(pe) < 0.075) return ORANGE
    if (al >= 1.15 && al < 1.38 && Math.abs(pe) < 0.075 * (1.38 - al) / 0.23) return YEL
    if (!rct(a, b, -0.62, -0.88, 0.4, 0.88)) return null
    for (const y of [0.5, 0.2, -0.1, -0.4]) if (rct(a, b, -0.4, y - 0.04, 0.2, y + 0.04)) return null
    return BLUE
  },
]

const form: FormDef = {
  id: 'chomchom',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const putM = (u: number, v: number, h: number, w: number, c: number[], a: number) => { const p = mapW(u, v, h); put(p[0], p[1], p[2], w, c, a) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const MINT = [0.55, 0.98, 0.64], MINT2 = [0.5, 0.92, 0.7], CREAM = [1.0, 0.96, 0.84]
    const PASTELS = [PINK, YEL, TEAL, LILAC, [1.0, 0.72, 0.5], WHITE]

    // ---- field: mint plane with diagonal stripes, soft rounded edge, carved by the road ----
    const nField = take(0.37)
    {
      const area = 7.9 * 4.24 * 0.66, sp = Math.sqrt(area / nField) * 0.92
      const cand: [number, number, number][] = []
      for (let gu = -3.95; gu < 3.95; gu += sp) for (let gv = -2.12; gv < 2.12; gv += sp) {
        const u = gu + rand() * sp, v = gv + rand() * sp
        if (u > 3.95 || v > 2.12 || v < -2.12) continue
        const q = Math.pow(Math.abs(u) / 3.95, 4) + Math.pow(Math.abs(v) / 2.12, 4)
        if (rand() > 1 - Math.pow(Math.min(1, Math.max(0, (q - 0.5) / 0.5)), 1.5) * 0.97) continue
        if (roadDist(u, v) < ROAD_HW + 0.07) continue
        cand.push([u, v, rand()])
      }
      const keep = Math.min(1, nField / cand.length)
      for (const [u, v, k] of cand) {
        if (k > keep) continue
        const stripe = Math.sin((u * 0.8 + v * 0.55) * 2.1) > 0
        putM(u, v, (rand() - 0.5) * 0.02, 1, stripe ? MINT : MINT2, (stripe ? 0.3 : 0.2) * (0.7 + 0.6 * rand()))
      }
    }
    // ---- flowers: pastel twinkles on the field ----
    for (let i = 0, g = 0; i < take(0.02) && g < 20000; g++) {
      const u = (rand() * 2 - 1) * 3.8, v = (rand() * 2 - 1) * 2.0
      if (roadDist(u, v) < ROAD_HW + 0.2) continue
      putM(u, v, 0.03, 2, PASTELS[Math.floor(rand() * PASTELS.length)], 0.55); i++
    }
    // ---- road curbs (two warm cream lines) and the centre dashes ----
    const nCurb = take(0.055)
    for (let i = 0; i < nCurb; i++) {
      const u = -3.9 + rand() * 7.8, s = (u - U0) / (U1 - U0), sl = pvd(s), nrm = 1 / Math.sqrt(1 + sl * sl)
      const side = rand() < 0.5 ? -1 : 1, off = ROAD_HW * (1 + (rand() - 0.5) * 0.06)
      putM(u + side * off * (-sl) * nrm, pv(s) + side * off * nrm, 0.01, 3, CREAM, 0.34)
    }
    const nDash = take(0.016)
    for (let i = 0; i < nDash; i++) {
      const u = -3.85 + rand() * 7.7, s = (u - U0) / (U1 - U0), arc = u * 1.18 // dash pattern in u-space, period 0.34
      if (((arc % 0.34) + 0.34) % 0.34 > 0.17) { i--; if (rand() < 0.0) break; continue }
      putM(u, pv(s) + (rand() - 0.5) * 0.026, 0.012, 4, WHITE, 0.62)
    }
    // ---- stations: soft halo, white ring, faint fill, icon ----
    STS.forEach((s, k) => {
      const cu = pu(s), cv = pv(s), wk = 0.1 * k, c = ST_COL[k]
      for (let i = 0; i < take(0.0045); i++) { const r = 0.4 + 0.3 * Math.pow(rand(), 1.6), a = rand() * TAU; putM(cu + r * Math.cos(a), cv + r * Math.sin(a), 0.01, 5 + wk, c, 0.07) }
      for (let i = 0; i < take(0.0045); i++) { const a = rand() * TAU; putM(cu + 0.42 * Math.cos(a), cv + 0.42 * Math.sin(a), 0.03, 5 + wk, [1, 1, 1], 0.8) }
      for (let i = 0; i < take(0.0035); i++) { const a = rand() * TAU; putM(cu + 0.455 * Math.cos(a), cv + 0.455 * Math.sin(a), 0.03, 5 + wk, c, 0.5) }
      for (let i = 0; i < take(0.007); i++) { const r = 0.4 * Math.sqrt(rand()), a = rand() * TAU; putM(cu + r * Math.cos(a), cv + r * Math.sin(a), 0.02, 5 + wk, [0.9, 0.92, 1.0], 0.07) }
      const ic = ICONS[k]
      for (let i = 0, g = 0; i < take(0.0075) && g < 200000; g++) {
        const a = rand() * 2 - 1, b = rand() * 2 - 1, cc = ic(a, b); if (!cc) continue
        putM(cu + a * 0.27, cv + b * 0.27, 0.05, 6 + wk, cc, 0.55); i++
      }
    })
    // ---- trees, bushes (upright billboards on the map) ----
    const spots: [number, number][] = [[-3.4, 1.55], [-2.6, -1.55], [-0.9, 1.6], [1.0, -1.65], [2.2, 1.55], [3.4, -1.4], [3.55, 0.9], [-1.3, -1.7], [0.35, 1.0], [-3.55, -0.3]]
    spots.forEach(([u, v], i) => {
      if (roadDist(u, v) < 0.6) return
      const b = mapW(u, v, 0.02), ch = 0.26 + 0.08 * (i % 3) / 2, cr = 0.2 + 0.04 * (i % 2)
      for (let j = 0; j < take(0.0018); j++) { const hh = rand(); put(b[0] + (rand() - 0.5) * 0.03, b[1] + hh * ch, b[2], 7 + 0.9 * hh * 0.5, [0.6, 0.45, 0.3], 0.2) }
      for (let j = 0; j < take(0.004); j++) { const r = cr * Math.sqrt(rand()), a = rand() * TAU, hh = (ch + r * Math.sin(a)) / (ch + cr); put(b[0] + r * Math.cos(a), b[1] + ch + r * Math.sin(a), b[2] + 0.02, 7 + 0.9 * Math.min(1, hh) * 0.9, [0.62, 1.0, 0.66], 0.36) }
    })
    ;([[-3.0, 0.2], [2.9, 0.4], [1.8, -0.35], [-0.2, -1.25], [-1.9, 1.3]] as [number, number][]).forEach(([u, v]) => {
      if (roadDist(u, v) < 0.55) return
      const b = mapW(u, v, 0.02)
      for (let j = 0; j < take(0.0032); j++) {
        const r = 0.17 * Math.sqrt(rand()), a = rand() * Math.PI, cx = [-0.15, 0.0, 0.15][j % 3], cy = [0, 0.08, 0][j % 3]
        put(b[0] + cx + r * Math.cos(a), b[1] + cy + r * Math.sin(a), b[2] + 0.01, 8, [0.3, 0.85, 0.5], 0.26)
      }
    })
    // ---- clouds: five puffs drifting across the map ----
    for (let i = 0; i < 5; i++) {
      const cu0 = -3.6 + i * 1.8 + (i % 2) * 0.3, cv0 = [1.2, -0.9, 0.5, -1.5, 1.7][i], hgt = 0.55 + 0.12 * (i % 3), b = mapW(cu0, cv0, hgt)
      const bl: [number, number, number][] = [[-0.2, 0, 0.12], [0, 0.07, 0.16], [0.2, 0.01, 0.12], [0.36, -0.02, 0.09], [-0.34, -0.03, 0.08]]
      for (let j = 0; j < take(0.0032); j++) {
        const [dx, dy, r] = bl[j % bl.length], rr = r * Math.sqrt(rand()), a = rand() * Math.PI
        put(b[0] + dx + rr * Math.cos(a), b[1] + dy + rr * Math.sin(a) - (rand() < 0.3 ? rand() * 0.04 : 0), b[2], 9 + 0.1 * i, [0.97, 0.97, 1.0], 0.62)
      }
    }
    // ---- aura behind the bubble ----
    for (let i = 0; i < take(0.03); i++) { const r = 2.6 * Math.pow(rand(), 0.8), a = rand() * TAU; put(BC[0] + r * Math.cos(a), BC[1] + r * Math.sin(a) * 0.9, BC[2] - 0.5 - rand() * 0.4, 15, r < 1.3 ? [1.0, 0.72, 0.9] : [0.7, 0.75, 1.0], 0.05) }
    // ---- the bubble: shell (fibonacci sphere with jitter), inner glow, mist, pacer ring ----
    const nShell = take(0.1), GA = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < nShell; i++) {
      const y = 1 - 2 * (i + 0.5) / nShell, rr = Math.sqrt(1 - y * y), th = i * GA
      put(Math.cos(th) * rr, y, Math.sin(th) * rr, 10, WHITE, 0.3 + 0.1 * rand())
    }
    for (let i = 0; i < take(0.035); i++) { const u = rand() * 2 - 1, th = rand() * TAU, rr = Math.cbrt(rand()) * 0.98, s = Math.sqrt(1 - u * u); put(Math.cos(th) * s * rr, u * rr, Math.sin(th) * s * rr, 11, [1.0, 0.82, 0.95], 0.1) }
    for (let i = 0; i < take(0.032); i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u); put(Math.cos(th) * s, u, Math.sin(th) * s, 12 + 0.0, [0.9, 0.85, 1.0], 0.2) }
    const nPace = take(0.012)
    for (let i = 0; i < nPace; i++) { const a = (i + rand()) / nPace * TAU; put(Math.cos(a) * 1.55, Math.sin(a) * 1.55, BC[2] + 0.05 - BC[2] * 0, 13, WHITE, 0.4) }
    // ---- motes drifting up from the Mindfulness station to the bubble ----
    for (let i = 0; i < take(0.012); i++) { const m = mapW(pu(STS[1]), pv(STS[1]), 0.1); put(m[0], m[1], m[2], 14, [1.0, 0.75, 0.9], 0.6) }
    // ---- stars (five-point, filled), confetti, car ----
    const star = (a: number, b: number) => { const r = Math.hypot(a, b), th = Math.atan2(b, a), seg = TAU / 5, ph = ((th - Math.PI / 2) % seg + seg) % seg - seg / 2; return r < 0.42 / (Math.cos(ph) + 1.55 * Math.abs(Math.sin(ph)) * 1.0) * 1.0 + 0.0 }
    STS.forEach((_, k) => {
      for (let i = 0, g = 0; i < take(0.0035) && g < 100000; g++) {
        const a = (rand() * 2 - 1) * 0.5, b = (rand() * 2 - 1) * 0.5; if (!star(a, b)) continue
        const m = Math.hypot(a, b); put(a, b, 0.02, 16 + 0.1 * k, m < 0.2 ? [1.0, 0.95, 0.7] : [1.0, 0.82, 0.3], 0.75); i++
      }
      for (let i = 0; i < take(0.0045); i++) put(0, 0, 0, 17 + 0.1 * k, PASTELS[Math.floor(rand() * PASTELS.length)], 0.9)
    })
    for (let i = 0; i < take(0.0035); i++) {
      const a = (rand() * 2 - 1) * 0.28, b = (rand() * 2 - 1) * 0.14
      put(a, b, 0, 18, a > 0.08 && Math.abs(b) < 0.09 ? [1.0, 0.9, 0.8] : [1.0, 0.32, 0.26], 1.1)
    }
    for (let i = 0; i < take(0.006); i++) put(0, 0, 0, 19, [1.0, 0.55, 0.45], 0.5)
    // ---- dust: the rest, pastel sparkles ----
    H.dust(pos, col, idx, N, rand, 6.4, 0.07 * boost, [0.95, 0.85, 1.0])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float CH_C = ${CYC.toFixed(1)};
const float CH_BR = ${BR.toFixed(1)};
const vec3 CH_BC = vec3(${BC.map(v => v.toFixed(3)).join(',')});
const float CH_TAU = 6.2831853;
float ch_ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float ch_breath(float t) { return 0.5 - 0.5 * cos(CH_TAU * t / CH_BR); }
vec3 ch_w(float u, float v, float h) { return vec3(u, ${Y0.toFixed(4)} + v * ${EY[0].toFixed(5)} + h * ${EN[0].toFixed(5)}, ${Z0.toFixed(4)} + v * ${EY[1].toFixed(5)} + h * ${EN[1].toFixed(5)}); }
vec2 ch_path(float s) { return vec2(${U0.toFixed(3)} + ${(U1 - U0).toFixed(3)} * s, ${PA.toFixed(3)} * sin(${PF.toFixed(5)} * s + ${PP.toFixed(3)})); }
vec2 ch_tan(float s) { return normalize(vec2(1.0, ${(PA * PF / (U1 - U0)).toFixed(5)} * cos(${PF.toFixed(5)} * s + ${PP.toFixed(3)}))); }
float ch_sts(float k) {
${STS.map((s, i) => `  if (k < ${i}.5) return ${s.toFixed(4)};`).join('\n')}
  return ${STS[4].toFixed(4)};
}
float ch_arr(float k) { return ${T0.toFixed(2)} + k * ${GAP.toFixed(2)}; }
float ch_age(float k, float tc) { return mod(tc - ch_arr(k), CH_C); }
float ch_s(float tc) {
  float s = mix(0.0, ${STS[0].toFixed(4)}, ch_ease(tc / ${T0.toFixed(2)}));
${STS.slice(0, 4).map((s, k) => {
    const a = T0 + k * GAP + DWELL, b = T0 + (k + 1) * GAP
    return `  s = tc > ${a.toFixed(2)} ? mix(${s.toFixed(4)}, ${STS[k + 1].toFixed(4)}, ch_ease((tc - ${a.toFixed(2)}) / ${(b - a).toFixed(2)})) : s;`
  }).join('\n')}
  float a4 = ${(T0 + 4 * GAP + DWELL).toFixed(2)};
  s = tc > a4 ? mix(${STS[4].toFixed(4)}, 1.04, ch_ease((tc - a4) / 1.6)) : s;
  return s;
}
float ch_carA(float tc) { return smoothstep(0.0, 0.3, tc) * (1.0 - smoothstep(${(T0 + 4 * GAP + DWELL + 1.1).toFixed(2)}, ${(T0 + 4 * GAP + DWELL + 1.6).toFixed(2)}, tc)); }
vec3 anim_chomchom(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001);
  float k = floor(fract(w) * 10.0 + 0.5);
  float tc = mod(t, CH_C), b = ch_breath(t);
  if (cl < 0.5) return p + 0.06 * vec3(sin(t * 0.21 + r.x * 40.0), sin(t * 0.17 + r.y * 40.0), sin(t * 0.13 + r.z * 40.0));
  if (cl < 1.5) return p + vec3(0.0, ${EN[0].toFixed(4)}, ${EN[1].toFixed(4)}) * 0.03 * sin(t * 0.7 + p.x * 1.7 + p.y * 2.3);
  if (cl < 2.5) return p + vec3(0.0, 0.025 * sin(t * 1.3 + r.x * 30.0), 0.0);
  if (cl > 4.5 && cl < 6.5) {
    vec2 st = ch_path(ch_sts(k)); vec3 c = ch_w(st.x, st.y, 0.0);
    float age = ch_age(k, tc), pu = age < 1.6 ? exp(-age * 3.0) : 0.0;
    vec3 q = c + (p - c) * (1.0 + 0.1 * pu);
    float bob = cl > 5.5 ? 0.012 * sin(t * 1.4 + k * 1.7) : 0.0;
    return q + vec3(0.0, ${EN[0].toFixed(4)}, ${EN[1].toFixed(4)}) * (0.07 * pu + bob);
  }
  if (cl > 6.5 && cl < 7.5) { float hf = fract(w) / 0.9; return p + vec3(0.03 * hf * sin(t * 1.1 + p.x * 2.0) + 0.012 * hf * sin(t * 2.3 + p.x * 5.0), 0.0, 0.0); }
  if (cl > 8.5 && cl < 9.5) {
    float sp = 0.045 + 0.018 * k, x = mod(p.x + t * sp + 4.6, 9.2) - 4.6;
    return vec3(x, p.y + 0.03 * sin(t * 0.5 + k * 2.0), p.z);
  }
  if (cl > 9.5 && cl < 10.5) {
    float R = 0.62 + 0.30 * b;
    float wob = 1.0 + 0.03 * sin(t * 1.3 + p.x * 3.1 + p.y * 2.3) + 0.02 * sin(t * 1.9 - p.z * 4.0 + p.y * 3.0);
    return CH_BC + p * R * wob;
  }
  if (cl > 10.5 && cl < 11.5) { float R = 0.62 + 0.30 * b; return CH_BC + p * R * 0.97; }
  if (cl > 11.5 && cl < 12.5) {
    float R = 0.62 + 0.30 * b;
    float rho = 1.28 + (0.35 + 1.1 * r.x) * (1.0 - b);
    float a = 0.55 * (1.0 - b) * (r.y - 0.5) + t * 0.05 * (r.z - 0.5);
    float ca = cos(a), sa = sin(a);
    vec3 q = vec3(p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca);
    return CH_BC + q * R * rho;
  }
  if (cl > 12.5 && cl < 13.5) return CH_BC + vec3(p.x, p.y, 0.0) * (0.93 + 0.1 * b) + vec3(0.0, 0.0, 0.05);
  if (cl > 13.5 && cl < 14.5) {
    vec2 st = ch_path(ch_sts(1.0)); vec3 A = ch_w(st.x, st.y, 0.35);
    vec3 B = CH_BC - vec3(0.0, 0.62 + 0.30 * b, 0.0);
    float f = fract(t * 0.11 + r.x);
    vec3 C = (A + B) * 0.5 + vec3(0.9, 0.2, 0.0);
    vec3 P = (1.0 - f) * (1.0 - f) * A + 2.0 * (1.0 - f) * f * C + f * f * B;
    return P + 0.09 * vec3(sin(t * 0.9 + r.y * 20.0 + f * 9.0), sin(t * 0.7 + r.z * 20.0), 0.5 * sin(t * 1.1 + r.w * 20.0));
  }
  if (cl > 14.5 && cl < 15.5) return p + vec3(0.05 * sin(t * 0.2 + r.x * 30.0), 0.05 * cos(t * 0.17 + r.y * 30.0), 0.0) + (p - CH_BC) * 0.04 * b;
  if (cl > 15.5 && cl < 17.5) {
    vec2 st = ch_path(ch_sts(k)); vec3 c = ch_w(st.x, st.y, 0.55);
    float age = ch_age(k, tc);
    if (cl < 16.5) {
      float q = age / 1.7, e = ch_ease(age / 0.35);
      float sc = (e + 0.18 * sin(3.14159 * min(1.0, age / 0.5))) * (1.0 - 0.5 * smoothstep(0.6, 1.0, q));
      float lift = 0.1 + 0.85 * (1.0 - pow(1.0 - clamp(q, 0.0, 1.0), 2.0));
      float a = age * 2.6, wb = 0.35 * sin(age * 4.0);
      vec2 l = vec2(p.x * cos(wb) - p.y * sin(wb), p.x * sin(wb) + p.y * cos(wb));
      return c + vec3(0.0, lift, 0.12) + vec3(l.x * cos(a), l.y, 0.0) * sc;
    }
    float ang = r.y * CH_TAU, sp = 0.45 + 1.15 * r.z;
    vec3 dir = vec3(cos(ang), 0.5 + 0.9 * abs(sin(ang)), 0.3 * (r.w - 0.5));
    return c + vec3(0.0, 0.2, 0.1) + dir * sp * age * (1.0 - 0.25 * age) + vec3(0.0, -0.9 * age * age, 0.0) + vec3(0.04 * sin(age * 9.0 + r.x * 20.0), 0.0, 0.0);
  }
  if (cl > 17.5 && cl < 18.5) {
    float s = ch_s(tc); vec2 pt = ch_path(s), tg = ch_tan(s);
    vec2 uv = pt + tg * p.x * 1.0 + vec2(-tg.y, tg.x) * p.y * 1.0;
    return ch_w(uv.x, uv.y, 0.08);
  }
  if (cl > 18.5 && cl < 19.5) {
    float lag = r.x * 0.55;
    float s = ch_s(max(0.0, tc - lag)); vec2 pt = ch_path(s), tg = ch_tan(s);
    vec2 uv = pt + vec2(-tg.y, tg.x) * (r.y - 0.5) * 0.1 * (0.4 + lag * 2.0);
    return ch_w(uv.x, uv.y, 0.07 + r.z * 0.08 * lag);
  }
  return p;
}
float size_chomchom(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5) return 1.0;
  if (cl < 1.5) return 1.5;
  if (cl < 2.5) return 1.6;
  if (cl > 15.5 && cl < 16.5) return 1.25;
  if (cl > 16.5 && cl < 17.5) return 0.9;
  if (cl > 17.5 && cl < 18.5) return 1.0;
  if (cl > 9.5 && cl < 11.5) return 1.0;
  return 1.0;
}
vec4 color_chomchom(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001), k = floor(fract(w) * 10.0 + 0.5);
  float tc = mod(t, CH_C), b = ch_breath(t);
  vec3 rgb = c.rgb; float a = c.a;
  if (cl < 0.5) return vec4(rgb, a * (0.6 + 0.4 * sin(t * (0.5 + r.x) + r.y * 30.0)));
  if (cl < 1.5) { a *= 0.82 + 0.18 * sin(t * 0.6 + d.x * 1.1 - d.y * 0.8); return vec4(rgb, a); }
  if (cl < 2.5) { a *= 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (1.0 + r.x * 1.6) + r.y * 40.0)); return vec4(rgb, a); }
  if (cl > 3.5 && cl < 4.5) {
    float s = (d.x - (${U0.toFixed(3)})) / ${(U1 - U0).toFixed(3)};
    float wv = smoothstep(0.55, 1.0, fract(s * 3.0 - t * 0.12));
    a *= 0.45 + 1.1 * wv; rgb = mix(rgb, vec3(1.0, 0.95, 0.7), wv * 0.5); return vec4(rgb, a);
  }
  if (cl > 4.5 && cl < 6.5) {
    float age = ch_age(k, tc), pu = age < 1.6 ? exp(-age * 3.0) : 0.0;
    a *= 1.0 + 1.5 * pu; rgb = mix(rgb, vec3(1.0), pu * 0.45); return vec4(rgb, a);
  }
  if (cl > 8.5 && cl < 9.5) {
    float x = mod(d.x + t * (0.045 + 0.018 * k) + 4.6, 9.2) - 4.6;
    a *= smoothstep(4.4, 3.3, abs(x)); return vec4(rgb, a);
  }
  if (cl > 9.5 && cl < 10.5) {
    vec3 n = d.xyz;
    float h = 0.5 * n.x + 0.35 * n.y + 0.15 * n.z + t * 0.04;
    vec3 iri = 0.5 + 0.5 * cos(CH_TAU * (h + vec3(0.0, 0.33, 0.67)));
    rgb = mix(vec3(0.82, 0.85, 1.0), iri * 0.85 + 0.25, 0.7);
    float hl = smoothstep(0.78, 0.95, dot(n, normalize(vec3(-0.5, 0.65, 0.55))));
    float hl2 = smoothstep(0.88, 0.97, dot(n, normalize(vec3(0.55, -0.6, 0.5))));
    a = 0.30 * (0.55 + 0.45 * b) + hl * 1.4 + hl2 * 0.4;
    rgb = mix(rgb, vec3(1.0), hl * 0.8);
    return vec4(rgb, a);
  }
  if (cl > 10.5 && cl < 11.5) { rgb = mix(vec3(1.0, 0.78, 0.92), vec3(0.8, 0.9, 1.0), b); return vec4(rgb, a * (0.35 + 1.2 * b)); }
  if (cl > 11.5 && cl < 12.5) { rgb = mix(vec3(0.75, 0.8, 1.0), vec3(1.0, 0.82, 0.95), b); return vec4(rgb, a * (0.3 + 1.1 * (1.0 - b) * (0.4 + r.w))); }
  if (cl > 12.5 && cl < 13.5) {
    float ph = fract(t / CH_BR);
    float ang = atan(d.x, d.y) / CH_TAU; ang = ang < 0.0 ? ang + 1.0 : ang;
    float behind = mod(ph - ang + 1.0, 1.0);
    float tr = exp(-behind * 7.0), head = exp(-behind * 90.0);
    vec3 base = ang < 0.5 ? vec3(0.55, 0.95, 0.85) : vec3(0.8, 0.7, 1.0);
    return vec4(mix(base, vec3(1.0), head), a * (0.3 + 3.0 * tr + 6.0 * head));
  }
  if (cl > 13.5 && cl < 14.5) { float f = fract(t * 0.11 + r.x); return vec4(rgb, a * sin(3.14159 * f) * (0.6 + 0.8 * r.w)); }
  if (cl > 14.5 && cl < 15.5) return vec4(mix(rgb, vec3(1.0, 0.8, 0.9), b * 0.5), a * (0.55 + 0.9 * b));
  if (cl > 15.5 && cl < 17.5) {
    float age = ch_age(k, tc);
    if (cl < 16.5) {
      float q = age / 1.7;
      float vis = age < 1.7 ? smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.62, 1.0, q)) : 0.0;
      float tw = 1.0 + 0.4 * sin(age * 20.0 + r.x * 6.0);
      return vec4(rgb, a * vis * tw);
    }
    float vis = age < 1.6 ? pow(1.0 - age / 1.6, 1.3) * smoothstep(0.0, 0.05, age) : 0.0;
    return vec4(rgb, a * vis * (0.7 + 0.5 * sin(age * 16.0 + r.x * 30.0)));
  }
  if (cl > 17.5 && cl < 18.5) return vec4(rgb, a * ch_carA(tc));
  if (cl > 18.5) return vec4(rgb, a * ch_carA(tc) * (1.0 - r.x) * 0.7);
  return vec4(rgb, a);
}`,
  camera: { pos: [0, 1.1, 10.3], target: [0, -0.05, -0.3], fov: 35 },
  pointSize: 1.9,
  drift: 0.012,
}
export default form
