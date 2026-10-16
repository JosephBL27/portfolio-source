// SECRETARY: four inboxes in, one register out. Gmail, university Outlook, iMessage and WhatsApp feed
// four curved streams of tiny envelope / message glyphs from the four corners into a ledger (the
// register: ten rows, each with a priority chip in one of four tiers); a calendar of tentative holds
// sits to its right. The Secretary runs four times a day, so every 14 s cycle has FOUR pulses: each pulse
// surges all four streams, launches a flight of glyphs, types rows into the ledger left to right and
// drops one amber hold onto the calendar. The header's four pips show which run it is.
//
// pos.w classes: 0 dust  1 ledger frame/header  2 row outline (+0.01*row)  3 row content (+0.01*row)
//   4 glyph (+0.1*stream +0.001*j)  5 flow dot (+0.1*stream)  6 calendar frame  7 hold block (+0.1*m)
//   8 header pip (+0.1*m)  9 source tray (+0.1*stream)  11 pulse ring (+0.1*m)  12 ledger sheet wash
//
// POINTER (w12): the four streams are separable (class 4 / 5 / 9 carry the stream index in the tenths of pos.w), so the pointer layer
// (world/extras/stages/secretary.ts) can hover one: u_secretary_hi (0..3, or -1) lifts that stream's glyphs, flow dots and source tray.
// secretaryStreams() hands it each stream's path in world space (the same Bezier and tilt the shader uses).
import type { FormDef } from './types'
import { H } from './ctx'

const CYC = 14, FL = 1.9, TP = [0.5, 3.7, 6.9, 10.1]
const LX0 = -1.45, LX1 = 1.35, LY0 = -1.75, LY1 = 1.75, HDR = 1.38
const ROWS = 10, RY0 = 1.28, RH = 0.3
const TIER = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3]
const TIERC = [[1.0, 0.4, 0.34], [1.0, 0.76, 0.3], [0.4, 0.86, 1.0], [0.68, 0.68, 0.9]]
const SRC = [[1.0, 0.42, 0.34], [0.3, 0.74, 1.0], [0.62, 0.56, 1.0], [0.36, 0.95, 0.56]]
// quadratic Beziers: source corner -> ledger entry
const BEZ: [number, number][][] = [
  [[-3.75, 2.05], [-2.7, 1.1], [-1.5, 0.78]],
  [[3.7, 2.35], [1.3, 2.6], [0.25, 1.82]],
  [[-3.75, -2.05], [-2.7, -1.0], [-1.5, -0.62]],
  [[3.7, -2.35], [1.3, -2.6], [0.25, -1.82]],
]
const CAL = { x0: 1.85, x1: 3.5, y0: -1.25, y1: 1.75, cols: 5, rows: 8, head: 0.3 }
// holds: [col, row0, rows]
const HOLDS: [number, number, number][] = [[1, 1, 2], [3, 4, 2], [0, 5, 2], [4, 2, 2]]
const holdRect = (m: number) => {
  const cw = (CAL.x1 - CAL.x0) / CAL.cols, rh = (CAL.y1 - CAL.head - CAL.y0) / CAL.rows, [c, r, n] = HOLDS[m]
  const x0 = CAL.x0 + c * cw + 0.03, x1 = CAL.x0 + (c + 1) * cw - 0.03, y1 = CAL.y1 - CAL.head - r * rh - 0.03, y0 = CAL.y1 - CAL.head - (r + n) * rh + 0.03
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}
const rowTime = (r: number) => { const m = r < 3 ? 0 : r < 5 ? 1 : r < 8 ? 2 : 3, j = r < 3 ? r : r < 5 ? r - 3 : r < 8 ? r - 5 : r - 8; return TP[m] + 2.1 + 0.2 * j }

/** the four sources, in stream order, as projects.json's secretary line names them */
export const SECRETARY_SOURCES = ['Gmail', 'University Outlook', 'iMessage', 'WhatsApp'] as const
/** live uniform (a shared object: the pointer layer writes .value): the hovered stream index, or -1 */
export const secretaryUniforms = { hi: { value: -1 } }
const quad = (k: number, s: number): [number, number] => {
  const [a, b, c] = BEZ[k], u = 1 - s
  return [u * u * a[0] + 2 * u * s * b[0] + s * s * c[0], u * u * a[1] + 2 * u * s * b[1] + s * s * c[1]]
}
/** each stream's path through the world for a waypoint placement ({ at, yaw, scale }): what the shader's sc_tilt and place() do to a point on its Bezier (z 0.06: the glyphs' height) */
export function secretaryStreams(pl: { at: readonly number[]; yaw?: number; scale?: number }, n = 20): { name: string; k: number; path: [number, number, number][] }[] {
  const cy = Math.cos(0.24), sy = Math.sin(0.24), cp = Math.cos(-0.07), sp = Math.sin(-0.07)
  const sc = pl.scale ?? 1, yaw = pl.yaw ?? 0, c = Math.cos(yaw), q = Math.sin(yaw)
  return SECRETARY_SOURCES.map((name, k) => ({
    name, k,
    path: Array.from({ length: n + 1 }, (_, i) => {
      const [x0, y0] = quad(k, i / n), z0 = 0.06
      const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy, y1 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp
      const x = x1 * sc, y = y1 * sc, z = z2 * sc
      return [c * x + q * z + pl.at[0], y + pl.at[1], -q * x + c * z + pl.at[2]] as [number, number, number]
    }),
  }))
}

const form: FormDef = {
  id: 'secretary',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const IV = [0.95, 0.93, 0.85], GOLD = [1.0, 0.8, 0.4], COOL = [0.55, 0.75, 1.0]
    const rectO = (x0: number, y0: number, x1: number, y1: number, n: number, w: number, c: number[], a: number, z = 0) => {
      const W = x1 - x0, Hh = y1 - y0, per = 2 * (W + Hh)
      for (let i = 0; i < n; i++) { const u = rand() * per; let x: number, y: number
        if (u < W) { x = x0 + u; y = y0 } else if (u < W + Hh) { x = x1; y = y0 + u - W } else if (u < 2 * W + Hh) { x = x1 - (u - W - Hh); y = y1 } else { x = x0; y = y1 - (u - 2 * W - Hh) }
        put(x, y, z, w, c, a) }
    }
    const rectF = (x0: number, y0: number, x1: number, y1: number, n: number, w: number, c: number[], a: number, z = 0) => { for (let i = 0; i < n; i++) put(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), z, w, c, a) }
    const line = (x0: number, y0: number, x1: number, y1: number, n: number, w: number, c: number[], a: number, z = 0) => { for (let i = 0; i < n; i++) { const u = rand(); put(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z, w, c, a) } }

    // ---- ledger: frame, header bar, sheet wash ----
    rectO(LX0, LY0, LX1, LY1, take(0.016), 1, IV, 0.5)
    rectO(LX0 - 0.03, LY0 - 0.03, LX1 + 0.03, LY1 + 0.03, take(0.006), 1, COOL, 0.3, -0.02)
    rectF(LX0, HDR, LX1, LY1, take(0.012), 1, COOL, 0.1)
    line(LX0, HDR, LX1, HDR, take(0.004), 1, IV, 0.6)
    for (let i = 0; i < take(0.0045); i++) put(LX0 + 0.1 + rand() * 0.9, 1.56 + (rand() - 0.5) * 0.04, 0.01, 1, IV, 0.4)
    for (let i = 0; i < take(0.003); i++) put(LX0 + 0.1 + rand() * 0.55, 1.49 + (rand() - 0.5) * 0.025, 0.01, 1, [0.6, 0.7, 0.9], 0.3)
    rectF(LX0, LY0, LX1, HDR, take(0.045), 12, [0.45, 0.65, 1.0], 0.026, -0.03)
    // ---- ledger rows ----
    for (let r = 0; r < ROWS; r++) {
      const cy = RY0 - (r + 0.5) * RH, wr = 0.01 * r, tc = TIERC[TIER[r]]
      line(LX0, RY0 - (r + 1) * RH, LX1, RY0 - (r + 1) * RH, take(0.0018), 2 + wr, [0.55, 0.65, 0.85], 0.22)
      rectF(LX0 + 0.07, cy - 0.085, LX0 + 0.18, cy + 0.085, take(0.0016), 3 + wr, tc, 0.55)
      rectO(LX0 + 0.07, cy - 0.085, LX0 + 0.18, cy + 0.085, take(0.0008), 3 + wr, tc, 0.7)
      const w1 = 0.7 + 0.65 * rand(), w2 = w1 * (0.35 + 0.3 * rand())
      rectF(LX0 + 0.3, cy + 0.02, LX0 + 0.3 + w1, cy + 0.06, take(0.0024), 3 + wr, IV, 0.42)
      rectF(LX0 + 0.3, cy - 0.065, LX0 + 0.3 + w2, cy - 0.035, take(0.0014), 3 + wr, [0.65, 0.75, 0.95], 0.3)
      rectO(LX1 - 0.4, cy - 0.075, LX1 - 0.08, cy + 0.075, take(0.0012), 3 + wr, [0.7, 0.8, 1.0], 0.45)
      rectF(LX1 - 0.35, cy - 0.015, LX1 - 0.35 + 0.1 + 0.1 * rand(), cy + 0.015, take(0.0007), 3 + wr, [0.8, 0.88, 1.0], 0.4)
    }
    // ---- calendar: frame, day columns, hour rows, ghost holds ----
    rectO(CAL.x0, CAL.y0, CAL.x1, CAL.y1, take(0.012), 6, IV, 0.45)
    const cw = (CAL.x1 - CAL.x0) / CAL.cols, rh = (CAL.y1 - CAL.head - CAL.y0) / CAL.rows
    line(CAL.x0, CAL.y1 - CAL.head, CAL.x1, CAL.y1 - CAL.head, take(0.003), 6, IV, 0.5)
    for (let c = 1; c < CAL.cols; c++) line(CAL.x0 + c * cw, CAL.y0, CAL.x0 + c * cw, CAL.y1, take(0.0022), 6, COOL, 0.2)
    for (let r = 1; r < CAL.rows; r++) line(CAL.x0, CAL.y1 - CAL.head - r * rh, CAL.x1, CAL.y1 - CAL.head - r * rh, take(0.0022), 6, COOL, 0.16)
    for (let c = 0; c < CAL.cols; c++) rectF(CAL.x0 + c * cw + 0.1, CAL.y1 - 0.18, CAL.x0 + (c + 1) * cw - 0.1, CAL.y1 - 0.13, take(0.0009), 6, IV, 0.4)
    HOLDS.forEach((_, m) => {
      const h = holdRect(m)
      rectO(h.x0, h.y0, h.x1, h.y1, take(0.0042), 7 + 0.1 * m, GOLD, 0.7)
      rectF(h.x0, h.y0, h.x1, h.y1, take(0.0062), 7 + 0.1 * m, [1.0, 0.7, 0.28], 0.18)
      rectF(h.x0 + 0.05, h.y1 - 0.09, h.x0 + 0.05 + 0.18, h.y1 - 0.06, take(0.0009), 7 + 0.1 * m, [1.0, 0.92, 0.7], 0.6)
    })
    // ---- header pips (four runs a day) ----
    for (let m = 0; m < 4; m++) {
      const cx = 0.6 + m * 0.2, cy = 1.565
      for (let i = 0; i < take(0.0008); i++) { const a = rand() * 6.2832; put(cx + 0.045 * Math.cos(a), cy + 0.045 * Math.sin(a), 0.02, 8 + 0.1 * m, IV, 0.8) }
      for (let i = 0; i < take(0.0008); i++) { const a = rand() * 6.2832, r = 0.03 * Math.sqrt(rand()); put(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.02, 8 + 0.1 * m, [0.5, 0.95, 1.0], 0.9) }
    }
    // ---- glyphs: 12 per stream (3 per pulse); envelopes for the mail streams, bubbles for the chats ----
    const per = Math.floor(take(0.125) / 48)
    for (let k = 0; k < 4; k++) for (let j = 0; j < 12; j++) {
      const w = 4 + 0.1 * k + 0.001 * j, c = SRC[k]
      if (k < 2) {
        const hw = 0.15, hh = 0.105
        for (let i = 0; i < per; i++) {
          const q = rand()
          if (q < 0.45) { const e = Math.floor(rand() * 4); const t = rand(); let x = 0, y = 0
            if (e === 0) { x = -hw + 2 * hw * t; y = -hh } else if (e === 1) { x = hw; y = -hh + 2 * hh * t } else if (e === 2) { x = hw - 2 * hw * t; y = hh } else { x = -hw; y = hh - 2 * hh * t }
            put(x, y, 0, w, c, 0.7) }
          else if (q < 0.7) { const t = rand(), s = rand() < 0.5 ? -1 : 1; put(s * hw * (1 - t), hh - t * hh * 1.0, 0.01, w, [1, 1, 1], 0.6) }
          else put((rand() * 2 - 1) * hw, (rand() * 2 - 1) * hh, 0, w, c, 0.2)
        }
      } else {
        const hw = 0.15, hh = 0.1
        for (let i = 0; i < per; i++) {
          const q = rand()
          if (q < 0.4) { const e = Math.floor(rand() * 4), t = rand(); let x = 0, y = 0
            if (e === 0) { x = -hw + 2 * hw * t; y = -hh } else if (e === 1) { x = hw; y = -hh + 2 * hh * t } else if (e === 2) { x = hw - 2 * hw * t; y = hh } else { x = -hw; y = hh - 2 * hh * t }
            put(x, y, 0, w, c, 0.7) }
          else if (q < 0.5) { const t = rand(); put(-hw * 0.7 - t * 0.06, -hh - t * 0.07, 0.01, w, c, 0.7) }
          else if (q < 0.68) { const d = Math.floor(rand() * 3); const a = rand() * 6.2832, r = 0.018 * Math.sqrt(rand()); put((d - 1) * 0.07 + r * Math.cos(a), r * Math.sin(a), 0.01, w, [1, 1, 1], 0.9) }
          else put((rand() * 2 - 1) * hw, (rand() * 2 - 1) * hh, 0, w, c, 0.22)
        }
      }
    }
    // ---- flow dots along each Bezier ----
    for (let k = 0; k < 4; k++) for (let i = 0; i < take(0.075); i++) put(0, 0, 0, 5 + 0.1 * k, SRC[k], 0.34)
    // ---- source trays: a stack of three outlined glyphs ----
    for (let k = 0; k < 4; k++) {
      const [x, y] = BEZ[k][0], sx = k % 2 === 0 ? 1 : -1
      for (let s = 0; s < 3; s++) {
        const ox = x - sx * 0.0 + s * 0.05 * sx, oy = y - s * 0.05 * (y > 0 ? 1 : -1) * -1 * 0 + s * 0.05
        rectO(ox - 0.17, oy - 0.12, ox + 0.17, oy + 0.12, take(0.0042), 9 + 0.1 * k, SRC[k], 0.55 - s * 0.12)
      }
      for (let i = 0; i < take(0.004); i++) { const a = rand() * 6.2832, r = 0.34 * (0.8 + 0.2 * rand()); put(x + 0.05 * sx + r * Math.cos(a), y + 0.05 + r * Math.sin(a) * 0.9, -0.01, 9 + 0.1 * k, SRC[k], 0.22) }
    }
    // ---- pulse rings ----
    for (let m = 0; m < 4; m++) for (let i = 0; i < take(0.011); i++) { const a = rand() * 6.2832; put(Math.cos(a), Math.sin(a), -0.08, 11 + 0.1 * m, [0.6, 0.85, 1.0], 0.6) }
    // ---- dust ----
    H.dust(pos, col, idx, N, rand, 6.2, 0.07 * boost, [0.7, 0.8, 1.0])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float SC_C = ${CYC.toFixed(1)};
const float SC_FL = ${FL.toFixed(2)};
const float SC_PI = 3.14159265;
uniform float u_secretary_hi;
float sc_tp(float m) { ${TP.map((t, i) => `if (m < ${i}.5) return ${t.toFixed(2)};`).join(' ')} return ${TP[3].toFixed(2)}; }
vec2 sc_bz(float k, float s) {
  vec2 a, b, c;
${BEZ.map((b, i) => `  ${i ? 'else ' : ''}if (k < ${i}.5) { a = vec2(${b[0][0]}, ${b[0][1]}); b = vec2(${b[1][0]}, ${b[1][1]}); c = vec2(${b[2][0]}, ${b[2][1]}); }`).join('\n')}
  float u = 1.0 - s;
  return u * u * a + 2.0 * u * s * b + s * s * c;
}
vec2 sc_hold(float m) {
${HOLDS.map((_, i) => { const h = holdRect(i); return `  if (m < ${i}.5) return vec2(${h.cx.toFixed(4)}, ${h.cy.toFixed(4)});` }).join('\n')}
  return vec2(0.0);
}
float sc_rowt(float r) {
${Array.from({ length: ROWS }, (_, i) => `  if (r < ${i}.5) return ${rowTime(i).toFixed(2)};`).join('\n')}
  return ${rowTime(ROWS - 1).toFixed(2)};
}
vec3 sc_tilt(vec3 q) {
  float cy = cos(0.24), sy = sin(0.24);
  q = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy);
  float cp = cos(-0.07), sp = sin(-0.07);
  return vec3(q.x, q.y * cp - q.z * sp, q.y * sp + q.z * cp);
}
float sc_ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// glyph timing: stream k, glyph j -> age in flight (q 0..1)
float sc_q(float k, float j, float tc) {
  float m = floor(j / 3.0), g = j - m * 3.0;
  float L = sc_tp(m) + 0.12 * g + 0.06 * k;
  return (tc - L) / SC_FL;
}
vec3 anim_secretary(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001), tc = mod(t, SC_C);
  float kf = fract(w) * 10.0, k = floor(kf + 0.0001);
  if (cl < 0.5) return sc_tilt(p + 0.06 * vec3(sin(t * 0.21 + r.x * 40.0), sin(t * 0.17 + r.y * 40.0), sin(t * 0.13 + r.z * 40.0)));
  if (cl > 3.5 && cl < 4.5) {
    float j = floor((kf - k) * 100.0 + 0.5);
    float q = sc_q(k, j, tc), e = sc_ease(q);
    vec2 B = sc_bz(k, e);
    float sc = mix(0.55, 1.0, smoothstep(0.0, 0.25, q)) * (1.0 - 0.5 * smoothstep(0.78, 1.0, q));
    float a = 0.3 * sin(q * 5.0 + k * 1.7 + j);
    vec2 l = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a)) * sc;
    return sc_tilt(vec3(B + l, 0.08 + 0.04 * sin(q * SC_PI)));
  }
  if (cl > 4.5 && cl < 5.5) {
    float s = fract(r.x + t * 0.11), e = s;
    vec2 B = sc_bz(k, e);
    float jit = 0.05 * (1.0 - 0.55 * s);
    return sc_tilt(vec3(B + jit * vec2(r.y * 2.0 - 1.0, r.z * 2.0 - 1.0), 0.02 * (r.w - 0.5)));
  }
  if (cl > 6.5 && cl < 7.5) {
    vec2 c = sc_hold(k); float w0 = sc_tp(k) + 2.6;
    float pop = tc > w0 ? 1.0 + 0.16 * exp(-(tc - w0) * 6.0) * cos((tc - w0) * 18.0) : 1.0;
    float on = smoothstep(w0 - 0.01, w0 + 0.01, tc);
    return sc_tilt(vec3(c + (p.xy - c) * mix(0.96, pop, on), p.z + 0.05 * on));
  }
  if (cl > 10.5 && cl < 11.5) {
    float age = tc - sc_tp(k);
    float rad = 0.35 + max(age, 0.0) * 1.9;
    return sc_tilt(vec3(p.xy * rad * vec2(1.0, 1.0) + vec2(-0.05, 0.0), p.z));
  }
  if (cl > 2.5 && cl < 3.5) {
    float row = floor(fract(w) * 100.0 + 0.5), wt = sc_rowt(row);
    float lift = (tc > wt && tc < wt + 0.6) ? 0.04 * exp(-(tc - wt) * 5.0) : 0.0;
    return sc_tilt(p + vec3(0.0, 0.0, lift));
  }
  if (cl > 8.5 && cl < 9.5) return sc_tilt(p + vec3(0.0, 0.012 * sin(t * 1.4 + k * 2.0), 0.0));
  return sc_tilt(p);
}
float size_secretary(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  float hk = floor(fract(d.w) * 10.0 + 0.0001), on = (cl > 3.5 && cl < 5.5) || (cl > 8.5 && cl < 9.5) ? step(abs(hk - u_secretary_hi), 0.5) : 0.0;
  if (cl < 0.5) return 1.3;
  if (cl > 4.5 && cl < 5.5) return 0.85 * (1.0 + 0.45 * on);
  if (cl > 3.5 && cl < 4.5) return 0.9 * (1.0 + 0.3 * on);
  if (cl > 11.5) return 3.0;
  return 1.0;
}
vec4 color_secretary_base(vec4 c, vec4 d, vec4 r, float t);
vec4 color_secretary(vec4 c, vec4 d, vec4 r, float t) {
  vec4 o = color_secretary_base(c, d, r, t);
  float cl = floor(d.w + 0.001), hk = floor(fract(d.w) * 10.0 + 0.0001);
  float on = (cl > 3.5 && cl < 5.5) || (cl > 8.5 && cl < 9.5) ? step(abs(hk - u_secretary_hi), 0.5) : 0.0;
  return vec4(mix(o.rgb, vec3(1.0), 0.28 * on), o.a * (1.0 + 1.5 * on));
}
vec4 color_secretary_base(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001), tc = mod(t, SC_C);
  float kf = fract(w) * 10.0, k = floor(kf + 0.0001);
  vec3 rgb = c.rgb; float a = c.a;
  if (cl < 0.5) return vec4(rgb, a * (0.6 + 0.4 * sin(t * (0.5 + r.x) + r.y * 30.0)));
  if (cl < 1.5) { a *= 0.88 + 0.12 * sin(t * 0.9 + d.y * 2.0); return vec4(rgb, a); }
  if (cl > 11.5 && cl < 12.5) { float b = 0.0; for (int m = 0; m < 4; m++) { float ag = tc - sc_tp(float(m)) - 1.9; b += ag > 0.0 && ag < 1.2 ? exp(-ag * 3.0) : 0.0; } return vec4(rgb, a * (0.7 + 2.0 * b)); }
  if (cl > 1.5 && cl < 3.5) {
    float row = floor(fract(w) * 100.0 + 0.5), wt = sc_rowt(row);
    float f = clamp((tc - wt) / 0.55, 0.0, 1.0);
    float xn = (d.x - ${(LX0).toFixed(3)}) / ${(LX1 - LX0).toFixed(3)};
    float on = step(xn, f) * (1.0 - smoothstep(13.0, 13.7, tc)) * step(wt, tc + 0.0001);
    float head = exp(-pow((xn - f) / 0.035, 2.0)) * step(0.001, f) * step(f, 0.999);
    if (cl < 2.5) return vec4(rgb, a * (0.6 + 0.8 * on + 1.0 * head));
    float flash = (tc > wt + 0.5 && tc < wt + 1.4) ? exp(-(tc - wt - 0.5) * 3.0) : 0.0;
    return vec4(mix(rgb, vec3(1.0), head * 0.7 + flash * 0.25), a * (0.2 + 1.2 * on + 2.4 * head + 0.5 * flash));
  }
  if (cl > 3.5 && cl < 4.5) {
    float j = floor((kf - k) * 100.0 + 0.5), q = sc_q(k, j, tc);
    float vis = (q > 0.0 && q < 1.0) ? smoothstep(0.0, 0.06, q) * (1.0 - smoothstep(0.86, 1.0, q)) : 0.0;
    return vec4(rgb, a * vis * 1.2);
  }
  if (cl > 4.5 && cl < 5.5) {
    float s = fract(r.x + t * 0.11);
    float surge = 0.0;
    for (int m = 0; m < 4; m++) { float sp = (tc - sc_tp(float(m)) - 0.06 * k) / SC_FL; surge += exp(-pow((s - sp) / 0.2, 2.0)); }
    float env = sin(SC_PI * s);
    return vec4(mix(rgb, vec3(1.0), clamp(surge * 0.35, 0.0, 0.6)), a * env * (0.45 + 2.6 * surge));
  }
  if (cl > 5.5 && cl < 6.5) return vec4(rgb, a);
  if (cl > 6.5 && cl < 7.5) {
    float w0 = sc_tp(k) + 2.6, on = smoothstep(w0 - 0.01, w0 + 0.3, tc) * (1.0 - smoothstep(13.0, 13.7, tc));
    float glow = (tc > w0 && tc < w0 + 1.4) ? exp(-(tc - w0) * 2.4) : 0.0;
    return vec4(mix(rgb, vec3(1.0, 0.95, 0.8), glow * 0.5), a * (0.2 + 1.4 * on + 1.6 * glow + 0.2 * on * sin(t * 2.0 + k)));
  }
  if (cl > 7.5 && cl < 8.5) {
    float cur = tc >= sc_tp(k) ? (k > 2.5 ? 1.0 : (tc < sc_tp(k + 1.0) ? 1.0 : 0.0)) : 0.0;
    float done = tc >= sc_tp(k) ? 1.0 : 0.0;
    return vec4(rgb, a * (0.18 + 0.45 * done + 1.2 * cur * (0.8 + 0.2 * sin(t * 4.0))));
  }
  if (cl > 8.5 && cl < 9.5) {
    float ag = 100.0; for (int m = 0; m < 4; m++) { float x = tc - sc_tp(float(m)); if (x >= 0.0 && x < ag) ag = x; }
    return vec4(rgb, a * (0.85 + 2.0 * exp(-ag * 2.5)));
  }
  if (cl > 10.5 && cl < 11.5) {
    float age = tc - sc_tp(k);
    float vis = (age > 0.0 && age < 2.4) ? exp(-age * 1.5) * smoothstep(0.0, 0.1, age) : 0.0;
    return vec4(rgb, a * vis * 1.4);
  }
  return vec4(rgb, a);
}`,
  uniforms: { u_secretary_hi: secretaryUniforms.hi },
  camera: { pos: [0.05, 0.1, 10.2], target: [0.0, 0.0, 0], fov: 35 },
  pointSize: 1.9,
  drift: 0.006,
}
export default form
