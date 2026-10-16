// RECRUITING: Recruiting OS, a departure board for 447 programs. 447 particle cells sit in firm lanes
// (rows) x weeks (columns); colour = deadline confidence (official green, estimated amber, secondary
// blue). A bright NOW line scans left to right over a 20 s cycle: cells ahead of it brighten as they
// approach and lift off the board, cells behind it dim to ash, and each cell snaps like a split-flap as
// the line crosses. At the start of each cycle a quick refresh wave flips every cell back to live.
// Layout is stylised (which cell sits in which lane and week is not data); only the count (447) is real, and it is printed by the overlay, not drawn here.
//
// pos.w classes: 0 dust  1 cell fill  2 cell outline (+0.1*status: 0 official, 1 estimated, 2 secondary)
//   3 lane label  4 week ticks/month dividers  5 NOW line  6 NOW glow wash  7 header text
//   8 lane stripes  9 NOW marker (local offsets)  10 legend swatch  11 sparks
import type { FormDef } from './types'
import { H } from './ctx'

const ROWS = 24, COLS = 28, CELLS = 447
const GX0 = -2.85, GX1 = 3.9, GY0 = -1.98, GY1 = 1.98
const PX = (GX1 - GX0) / COLS, PY = (GY1 - GY0) / ROWS
const CW = PX * 0.8, CH = PY * 0.7
const X0 = GX0 - 0.05, X1 = GX1 + 0.05
const XC = (GX0 + GX1) / 2
const CYC = 20, T0 = 1.4, T1 = 18.6
const YAW = 0.3

interface Mask { img: ImageData; x0: number; x1: number; y0: number; y1: number }

const form: FormDef = {
  id: 'recruiting',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const GREEN = [0.3, 0.95, 0.58], AMBER = [1.0, 0.72, 0.26], BLUE = [0.5, 0.7, 1.0], WHITE = [0.92, 0.96, 1.0], CYAN = [0.55, 0.92, 1.0]
    const STATUS = [GREEN, AMBER, BLUE]

    // ---- text masks (header) ----
    const SANS = '"Archivo Variable", "Helvetica Neue", Arial, sans-serif'
    const mk = async (text: string, font: string, w: number, h: number): Promise<Mask> => {
      const img = await ctx.textMask(text, { font, width: w, height: h, align: 'center' })
      let x0 = w, x1 = 0, y0 = h, y1 = 0
      const dd = img.data
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dd[(y * w + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 <= x0) { x0 = 0; x1 = w; y0 = 0; y1 = h }
      return { img, x0, x1: x1 + 1, y0, y1: y1 + 1 }
    }
    const [mOff, mEst, mSec, mNow] = await Promise.all([
      mk('OFFICIAL', `600 56px ${SANS}`, 520, 90), mk('ESTIMATED', `600 56px ${SANS}`, 620, 90), mk('SECONDARY', `600 56px ${SANS}`, 640, 90), mk('NOW', `700 70px ${SANS}`, 300, 100),
    ])
    // place a mask: left edge at x, vertical centre y, cap height capH
    const text = (m: Mask, x: number, y: number, capH: number, n: number, c: number[], a: number, w: number) => {
      const sc = capH / (m.y1 - m.y0), cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2
      for (const q of H.sampleMask(m.img, n, rand)) put(x + (q[0] - m.x0) * sc, y + (cy - q[1]) * sc, 0.02, w, c, a)
      return (m.x1 - m.x0) * sc
    }

    // ---- choose the 447 filled slots (weighted: deadlines cluster early in the window) ----
    const keys: [number, number][] = []
    const rowW = Array.from({ length: ROWS }, () => 0.7 + 0.6 * rand())
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const wk = 0.42 + 0.6 * Math.exp(-(((c - 7) / 6) ** 2)) + 0.22 * Math.exp(-(((c - 20) / 3) ** 2))
      keys.push([Math.pow(rand(), 1 / (wk * rowW[r])), r * COLS + c])
    }
    keys.sort((a, b) => b[0] - a[0])
    const slots = keys.slice(0, CELLS).map(k => k[1])
    const nFill = Math.floor(take(0.47) / CELLS), nOut = Math.floor(take(0.2) / CELLS)
    for (const s of slots) {
      const r = Math.floor(s / COLS), c = s % COLS
      const cx = GX0 + (c + 0.5) * PX, cy = GY0 + (r + 0.5) * PY
      const q = rand(), st = q < 0.56 ? 0 : q < 0.86 ? 1 : 2, w = 0.1 * st
      for (let i = 0; i < nFill; i++) put(cx + (rand() - 0.5) * CW, cy + (rand() - 0.5) * CH, 0, 1 + w, STATUS[st], 0.11)
      for (let i = 0; i < nOut; i++) {
        const per = 2 * (CW + CH), u = rand() * per; let x: number, y: number
        if (u < CW) { x = u - CW / 2; y = -CH / 2 } else if (u < CW + CH) { x = CW / 2; y = u - CW - CH / 2 } else if (u < 2 * CW + CH) { x = CW / 2 - (u - CW - CH); y = CH / 2 } else { x = -CW / 2; y = CH / 2 - (u - 2 * CW - CH) }
        put(cx + x, cy + y, 0, 2 + w, STATUS[st], 0.3)
      }
    }
    // ---- lane stripes (alternate rows), lane labels (greeked firm marks) ----
    for (let r = 0; r < ROWS; r++) {
      const cy = GY0 + (r + 0.5) * PY
      if (r % 2 === 0) for (let i = 0; i < take(0.0016); i++) put(-3.95 + rand() * (GX1 + 3.95), cy + (rand() - 0.5) * PY * 0.94, -0.03, 8, [0.5, 0.6, 0.8], 0.028)
      const sq = 0.075, x0 = -3.95
      for (let i = 0; i < take(0.00045); i++) put(x0 + rand() * sq, cy + (rand() - 0.5) * sq, 0.01, 3, CYAN, 0.35)
      const wd = [0.3 + rand() * 0.45, 0.14 + rand() * 0.25]
      for (let i = 0; i < take(0.00075); i++) put(x0 + 0.12 + rand() * wd[0], cy + 0.012 + (rand() - 0.5) * 0.026, 0.01, 3, WHITE, 0.3)
      for (let i = 0; i < take(0.0005); i++) put(x0 + 0.12 + rand() * wd[1], cy - 0.032 + (rand() - 0.5) * 0.02, 0.01, 3, [0.6, 0.7, 0.9], 0.22)
    }
    // ---- week ticks and month dividers ----
    for (let c = 0; c <= COLS; c++) {
      const x = GX0 + c * PX, month = c % 4 === 0
      for (let i = 0; i < take(month ? 0.0014 : 0.0005); i++) { const y = GY1 + 0.05 + rand() * (month ? 0.12 : 0.06); put(x, y, 0, 4, month ? WHITE : [0.55, 0.65, 0.85], month ? 0.5 : 0.34) }
      for (let i = 0; i < take(0.0005); i++) { const y = GY0 - 0.05 - rand() * (month ? 0.12 : 0.06); put(x, y, 0, 4, [0.55, 0.65, 0.85], 0.3) }
      if (month) for (let i = 0; i < take(0.0011); i++) put(x, GY0 + rand() * (GY1 - GY0), -0.02, 4, [0.55, 0.7, 0.95], 0.085)
    }
    // ---- footer: the legend (the header band is left to the NOW tag). v15: the in-world '447' numeral and its caption are gone: bloom smeared the numeral
    // into a grey blur and the overlay already prints a crisp 447. The legend moved left by 8% of the grid width, so its right edge no longer clips on a narrow window. ----
    let lx = 0.5 - 0.08 * (GX1 - GX0)
    ;([[mOff, GREEN], [mEst, AMBER], [mSec, BLUE]] as [Mask, number[]][]).forEach(([m, c]) => {
      for (let i = 0; i < take(0.0012); i++) put(lx + rand() * 0.11, -2.5 + (rand() - 0.5) * 0.08, 0, 10, c, 0.5)
      const wl = text(m, lx + 0.18, -2.5, 0.07, take(0.0034), [0.75, 0.82, 0.95], 0.5, 7)
      lx += 0.18 + wl + 0.22
    })
    // ---- NOW line, glow wash, marker + NOW tag, sparks ----
    const nLine = take(0.014)
    for (let i = 0; i < nLine; i++) put(0, GY0 - 0.12 + rand() * (GY1 - GY0 + 0.24), 0.05, 5, [0.8, 0.97, 1.0], 0.75)
    for (let i = 0; i < take(0.065); i++) put(GX0 - 0.1 + rand() * (GX1 - GX0 + 0.2), GY0 - 0.05 + rand() * (GY1 - GY0 + 0.1), -0.01, 6, [0.45, 0.85, 1.0], 0.1)
    for (let i = 0; i < take(0.004); i++) { let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v } put((u - v) * 0.07, GY1 + 0.17 - (u + v) * 0.1, 0.05, 9, WHITE, 0.9) }
    for (let i = 0; i < take(0.004); i++) { let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v } put((u - v) * 0.07, GY0 - 0.17 + (u + v) * 0.1, 0.05, 9, WHITE, 0.9) }
    { const sc = 0.085 / (mNow.y1 - mNow.y0), cx = (mNow.x0 + mNow.x1) / 2, cy = (mNow.y0 + mNow.y1) / 2
      for (const q of H.sampleMask(mNow.img, take(0.0045), rand)) put((q[0] - cx) * sc, GY1 + 0.34 + (cy - q[1]) * sc, 0.05, 9, [0.85, 0.98, 1.0], 0.75) }
    for (let i = 0; i < take(0.025); i++) put(0, GY0 + rand() * (GY1 - GY0), 0.04, 11, [0.7, 0.95, 1.0], 0.6)
    // ---- dust ----
    H.dust(pos, col, idx, N, rand, 6.4, 0.06 * boost, [0.6, 0.78, 1.0])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float RC_C = ${CYC.toFixed(1)};
const float RC_T0 = ${T0.toFixed(2)};
const float RC_T1 = ${T1.toFixed(2)};
const float RC_PI = 3.14159265;
float rc_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float rc_nowx(float tc) { return mix(${X0.toFixed(3)}, ${X1.toFixed(3)}, clamp((tc - RC_T0) / (RC_T1 - RC_T0), 0.0, 1.0)); }
float rc_lineA(float tc) { return smoothstep(0.9, 1.6, tc) * (1.0 - smoothstep(18.4, 19.4, tc)); }
vec3 rc_tilt(vec3 q) {
  float c = cos(${YAW.toFixed(3)}), s = sin(${YAW.toFixed(3)}); float x = q.x - ${XC.toFixed(3)};
  return vec3(x * c + q.z * s + ${XC.toFixed(3)}, q.y, -x * s + q.z * c);
}
// per-cell timing from the cell grid
vec2 rc_cell(vec3 p) { return floor(vec2((p.x - ${GX0.toFixed(3)}) / ${PX.toFixed(5)}, (p.y - ${GY0.toFixed(3)}) / ${PY.toFixed(5)})); }
vec3 anim_recruiting(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), tc = mod(t, RC_C);
  float nx = rc_nowx(tc), la = rc_lineA(tc);
  if (cl < 0.5) return rc_tilt(p + 0.06 * vec3(sin(t * 0.21 + r.x * 40.0), sin(t * 0.17 + r.y * 40.0), sin(t * 0.13 + r.z * 40.0)));
  if (cl < 2.5) {
    vec2 cell = rc_cell(p);
    float cx = ${GX0.toFixed(3)} + (cell.x + 0.5) * ${PX.toFixed(5)}, cy = ${GY0.toFixed(3)} + (cell.y + 0.5) * ${PY.toFixed(5)};
    float h = rc_h(cell), fx = (cx - ${X0.toFixed(3)}) / ${(X1 - X0).toFixed(3)};
    float tw = fx * (RC_T0 - 0.3) + h * 0.25, tl = RC_T0 + fx * (RC_T1 - RC_T0);
    float u1 = (tc - tw) / 0.32, u2 = (tc - tl) / 0.32;
    float sy = 1.0, lift = 0.0;
    if (u1 > 0.0 && u1 < 1.0) { sy *= abs(cos(RC_PI * u1)); lift += 0.1 * sin(RC_PI * u1); }
    if (u2 > 0.0 && u2 < 1.0) { sy *= abs(cos(RC_PI * u2)); lift += 0.1 * sin(RC_PI * u2); }
    float dx = cx - nx, imm = step(0.0, dx) * (1.0 - smoothstep(0.0, 1.7, dx)) * la;
    lift += 0.16 * imm * imm + 0.012 * sin(t * 1.3 + h * 20.0) * imm;
    return rc_tilt(vec3(p.x, cy + (p.y - cy) * max(sy, 0.04), p.z + lift));
  }
  if (cl > 4.5 && cl < 5.5) return rc_tilt(vec3(nx + 0.003 * sin(t * 9.0 + p.y * 6.0), p.y, p.z));
  if (cl > 8.5 && cl < 9.5) return rc_tilt(vec3(nx + p.x, p.y, p.z));
  if (cl > 10.5) {
    float age = fract(t * 0.7 + r.z);
    return rc_tilt(vec3(nx - (0.03 + 0.55 * age * (0.25 + r.x)), p.y + (r.y - 0.5) * 0.04 * age, p.z + (r.w - 0.5) * 0.05));
  }
  return rc_tilt(p);
}
float size_recruiting(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5) return 1.3;
  if (cl > 0.5 && cl < 1.5) return 1.1;
  if (cl > 4.5 && cl < 5.5) return 1.5;
  if (cl > 10.5) return 1.2;
  return 1.0;
}
vec4 color_recruiting(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), tc = mod(t, RC_C);
  float nx = rc_nowx(tc), la = rc_lineA(tc);
  vec3 rgb = c.rgb; float a = c.a;
  if (cl < 0.5) return vec4(rgb, a * (0.6 + 0.4 * sin(t * (0.5 + r.x) + r.y * 30.0)));
  if (cl < 2.5) {
    vec2 cell = rc_cell(d.xyz);
    float cx = ${GX0.toFixed(3)} + (cell.x + 0.5) * ${PX.toFixed(5)};
    float h = rc_h(cell), fx = (cx - ${X0.toFixed(3)}) / ${(X1 - X0).toFixed(3)};
    float tw = fx * (RC_T0 - 0.3) + h * 0.25, tl = RC_T0 + fx * (RC_T1 - RC_T0);
    float dx = cx - nx;
    float passed = tc < RC_T0 ? 1.0 - smoothstep(tw, tw + 0.12, tc) : 1.0 - smoothstep(0.0, 0.1, dx);
    float imm = step(0.0, dx) * (1.0 - smoothstep(0.0, 1.7, dx)) * la;
    float fl1 = (tc > tw && tc < tw + 1.0) ? exp(-(tc - tw) * 4.0) : 0.0;
    float fl2 = (tc > tl && tc < tl + 1.2) ? exp(-(tc - tl) * 2.6) : 0.0;
    rgb = mix(rgb, vec3(0.46, 0.52, 0.64), passed * 0.7);
    a *= mix(1.0, 0.36, passed);
    a *= 1.0 + imm * (0.9 + 0.5 * sin(t * 5.0 + h * 6.28));
    rgb = mix(rgb, vec3(1.0, 0.95, 0.8), imm * 0.28);
    rgb += vec3(0.9, 0.95, 1.0) * (fl1 * 0.5 + fl2 * 0.8);
    a *= 1.0 + 1.8 * fl1 + 2.6 * fl2;
    return vec4(rgb, a);
  }
  if (cl > 3.5 && cl < 4.5) return vec4(rgb, a * (0.8 + 0.2 * sin(t * 0.8 + d.x * 3.0)));
  if (cl > 4.5 && cl < 5.5) return vec4(rgb, a * la * (0.65 + 0.5 * sin(d.y * 9.0 - t * 7.0) * sin(d.y * 3.0 + t)));
  if (cl > 5.5 && cl < 6.5) {
    float dxl = nx - d.x;
    float g = dxl > 0.0 ? exp(-dxl / 0.55) : exp(dxl / 0.06);
    return vec4(rgb, a * la * g * 2.0);
  }
  if (cl > 8.5 && cl < 9.5) return vec4(rgb, a * la);
  if (cl > 10.5) { float age = fract(t * 0.7 + r.z); return vec4(rgb, a * la * pow(1.0 - age, 2.0)); }
  return vec4(rgb, a);
}`,
  camera: { pos: [0.1, 0.0, 10.9], target: [0.05, 0.0, 0], fov: 35 },
  pointSize: 1.8,
  drift: 0.004,
}
export default form
