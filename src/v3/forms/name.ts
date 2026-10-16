// NAME: "JOSEPH" over "BLUMBERG" in Bodoni Moda 900, extruded into depth. A dense front face with
// bright didone hairlines (rim-lit), sparser side walls, a faint back face, a soft bloom halo,
// floating motes, a slow light sweep and a shimmer.
import type { FormDef } from './types'
import { H } from './ctx'

const FONT = '900 340px "Bodoni Moda Variable", "Bodoni 72", Didot, serif'
const MW = 2800, MH = 520
const WIDTH = 7.5          // world width of BLUMBERG
const DEPTH = 0.8          // extrusion depth
const DIL = 1              // mask dilation in px (protects the hairlines)

interface Line { ink: Uint8Array; rim: Uint8Array; edge: number[]; ink0: number[]; x0: number; x1: number; y0: number; y1: number }

function analyse(img: ImageData): Line {
  const { width: w, height: h, data } = img
  // Didone hairlines are ~1 px in the mask (sub-pixel on screen): dilate by DIL px so they survive as thin bright lines
  const raw = new Uint8Array(w * h), tmp = new Uint8Array(w * h), ink = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) raw[i] = data[i * 4 + 3] > 40 ? 1 : 0
  for (let y = 0; y < h; y++) for (let x = DIL; x < w - DIL; x++) { let m = 0; for (let k = -DIL; k <= DIL; k++) m |= raw[y * w + x + k]; tmp[y * w + x] = m }
  for (let y = DIL; y < h - DIL; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = -DIL; k <= DIL; k++) m |= tmp[(y + k) * w + x]; ink[y * w + x] = m }
  let x0 = w, x1 = 0, y0 = h, y1 = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  const erode = (src: Uint8Array, r: number) => {
    const o = new Uint8Array(w * h)
    for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) { const i = y * w + x; if (src[i] && src[i - r] && src[i + r] && src[i - r * w] && src[i + r * w]) o[i] = 1 }
    return o
  }
  const e1 = erode(ink, 1), e3 = erode(ink, 3)
  const rim = new Uint8Array(w * h), edge: number[] = [], ink0: number[] = []
  for (let i = 0; i < w * h; i++) { if (!ink[i]) continue; ink0.push(i); if (!e3[i]) rim[i] = 1; if (!e1[i]) edge.push(i) }
  return { ink, rim, edge, ink0, x0, x1, y0, y1 }
}

const form: FormDef = {
  id: 'name',
  async build(ctx, pos, col) {
    const n = ctx.count, rand = ctx.rand
    form.pointSize = 1.9 * Math.min(1.55, Math.pow(262144 / n, 0.35))
    const [mJ, mB] = await Promise.all([
      ctx.textMask('JOSEPH', { font: FONT, width: MW, height: MH }),
      ctx.textMask('BLUMBERG', { font: FONT, width: MW, height: MH }),
    ])
    const A = analyse(mJ), B = analyse(mB)
    const sc = WIDTH / Math.max(1, B.x1 - B.x0)                       // world units per mask pixel
    const hJ = (A.y1 - A.y0) * sc, hB = (B.y1 - B.y0) * sc, gap = 0.3 * Math.max(hJ, hB)
    const top = (hJ + gap + hB) / 2
    // each line: where does mask pixel (px,py) land in the world
    const place = (L: Line, isTop: boolean) => {
      const cx = (L.x0 + L.x1) / 2, yTop = isTop ? top : top - hJ - gap, h = isTop ? hJ : hB
      return (px: number, py: number): [number, number] => [(px - cx) * sc, yTop - (py - L.y0) * sc - 0 * h]
    }
    const pJ = place(A, true), pB = place(B, false)
    const nFront = Math.floor(n * 0.5), nRim = Math.floor(n * 0.1), nSide = Math.floor(n * 0.13), nBack = Math.floor(n * 0.05), nHalo = Math.floor(n * 0.07), nMote = Math.floor(n * 0.07)
    const areaJ = A.ink0.length, areaB = B.ink0.length, areaAll = areaJ + areaB
    let w = 0
    const toW = (li: number, px: number, py: number): [number, number] => (li ? pB : pJ)(px, py)
    const lineOf = (li: number) => (li ? B : A)
    // front face: R2 low-discrepancy points rejected against the ink mask: even coverage, no clumps or gaps
    const G1 = 0.7548776662466927, G2 = 0.5698402909980532
    for (let li = 0; li < 2; li++) {
      const L = lineOf(li), quota = Math.round(nFront * (li ? areaB : areaJ) / areaAll)
      const bw = L.x1 - L.x0 + 1, bh = L.y1 - L.y0 + 1
      const cell = Math.sqrt((bw * bh) / (quota / (( li ? areaB : areaJ) / (bw * bh)) * 1)) // spacing of the underlying lattice
      let got = 0, k = 1 + li * 1000003
      while (got < quota && k < quota * 40) {
        const fx = (0.5 + k * G1) % 1, fy = (0.5 + k * G2) % 1; k++
        const px = L.x0 + fx * bw + (rand() - 0.5) * cell * 0.6, py = L.y0 + fy * bh + (rand() - 0.5) * cell * 0.6
        const ix = px | 0, iy = py | 0
        if (ix < 0 || iy < 0 || ix >= MW || iy >= MH) continue
        const i = iy * MW + ix
        if (!L.ink[i]) continue
        got++
        const [x, y] = toW(li, px, py)
        const rim = L.rim[i], up = 1 - (py - L.y0) / bh                      // lit from above: tops brighter
        const v = (0.82 + 0.18 * up) * (0.92 + 0.08 * rand())
        H.set(pos, col, w++, x, y, DEPTH / 2 + (rand() - 0.5) * 0.01, 0, 0.95 * v, 0.91 * v, 0.83 * v, rim ? 0.9 : 0.3 + 0.1 * up)
      }
      while (got < quota) { const i = L.ink0[Math.floor(rand() * L.ink0.length)]; const [x, y] = toW(li, (i % MW) + rand(), Math.floor(i / MW) + rand()); H.set(pos, col, w++, x, y, DEPTH / 2, 0, 0.9, 0.86, 0.78, 0.5); got++ }
    }
    // outline: systematic picks along the edge list put a bright, even line on every contour (the hairlines)
    for (let li = 0; li < 2; li++) {
      const L = lineOf(li), quota = Math.round(nRim * (li ? areaB : areaJ) / areaAll), step = L.edge.length / quota
      for (let k = 0; k < quota; k++) {
        const i = L.edge[Math.min(L.edge.length - 1, Math.floor((k + rand()) * step))], [x, y] = toW(li, (i % MW) + rand(), Math.floor(i / MW) + rand())
        H.set(pos, col, w++, x, y, DEPTH / 2 + 0.005, 0.2, 1.0, 0.96, 0.88, 1.0)
      }
    }
    // side walls: perimeter pixels extruded through the depth, darker and cooler towards the back
    for (let li = 0; li < 2; li++) {
      const L = lineOf(li), quota = Math.round(nSide * (li ? areaB : areaJ) / areaAll), step = L.edge.length / quota
      for (let k = 0; k < quota; k++) {
        const i = L.edge[Math.min(L.edge.length - 1, Math.floor((k + rand()) * step))], [x, y] = toW(li, (i % MW) + rand(), Math.floor(i / MW) + rand())
        const u = rand(), z = DEPTH / 2 - u * DEPTH, sh = 0.78 - 0.5 * u
        H.set(pos, col, w++, x, y, z, 1, 1.0 * sh + 0.06, 0.66 * sh + 0.06, 0.34 * sh + 0.06, 0.42 * (1 - 0.45 * u))
      }
    }
    // back face
    for (let k = 0; k < nBack; k++) {
      const li = rand() * areaAll < areaJ ? 0 : 1, L = lineOf(li)
      const i = L.ink0[Math.floor(rand() * L.ink0.length)], [x, y] = toW(li, (i % MW) + rand(), Math.floor(i / MW) + rand())
      H.set(pos, col, w++, x, y, -DEPTH / 2, 2, 0.5, 0.46, 0.4, 0.2)
    }
    // halo: soft bloom, ink pixels pushed outward by a random vector
    for (let k = 0; k < nHalo; k++) {
      const li = rand() * areaAll < areaJ ? 0 : 1, L = lineOf(li)
      const i = L.ink0[Math.floor(rand() * L.ink0.length)], [x, y] = toW(li, (i % MW) + rand(), Math.floor(i / MW) + rand())
      const a = rand() * 6.2832, r = 0.03 + 0.28 * Math.pow(rand(), 1.6)
      H.set(pos, col, w++, x + Math.cos(a) * r, y + Math.sin(a) * r, (rand() - 0.5) * DEPTH, 3, 0.9, 0.82, 0.68, 0.05 + 0.06 * (1 - r / 0.31))
    }
    // motes: slow specks drifting in a slab around the word
    for (let k = 0; k < nMote; k++) {
      const a = rand() * 6.2832, rr = Math.sqrt(rand())
      H.set(pos, col, w++, Math.cos(a) * rr * 6.2, Math.sin(a) * rr * 2.3, (rand() - 0.5) * 3.4, 4, 1.0, 0.9, 0.72, 0.08 + 0.5 * rand() * rand())
    }
    H.dust(pos, col, w, n, rand, 7.5, 0.06, [0.9, 0.86, 0.78])
    for (let i = w; i < n; i++) pos[i * 4 + 3] = 5
  },
  glsl: /* glsl */ `
vec3 anim_name(vec3 p, vec4 d, vec4 r, float t) {
  float k = d.w;
  if (k < 2.5) {
    // the word breathes: a slow travelling ripple in depth, plus a fine shimmer on the surface
    p.z += 0.07 * sin(p.x * 1.5 + p.y * 0.9 - t * 0.85) * (k < 1.5 ? 1.0 : 0.6);
    p.xy += 0.0055 * vec2(sin(t * 2.9 + r.x * 60.0), cos(t * 2.4 + r.y * 60.0));
    p.y += 0.02 * sin(p.x * 2.2 - t * 0.6);
    // sparks: a few particles lift off the letters and fall back (the form dissolves a little at its edges)
    float lift = pow(0.5 + 0.5 * sin(t * 0.8 + r.x * 53.0 + r.z * 7.0), 22.0) * step(0.78, r.y);
    p += lift * vec3((r.z - 0.5) * 0.5, 0.15 + r.w * 0.5, (r.x - 0.5) * 0.9);
    // a slow yaw sway so the extrusion and the side walls show
    float a = 0.3 * sin(t * 0.23);
    float ca = cos(a), sa = sin(a);
    p.xz = vec2(ca * p.x + sa * p.z, -sa * p.x + ca * p.z);
  } else if (k < 3.5) {
    p.xy += 0.05 * vec2(sin(t * 0.8 + r.x * 30.0), cos(t * 0.7 + r.y * 30.0));
  } else if (k < 4.5) {
    // motes rise and drift, wrapping vertically
    float sp = 0.03 + 0.07 * r.z;
    p.y = mod(p.y + 2.6 + t * sp, 5.2) - 2.6;
    p.x += 0.35 * sin(t * 0.3 + r.x * 20.0); p.z += 0.4 * sin(t * 0.22 + r.y * 20.0);
  } else {
    p.xy += 0.15 * vec2(sin(t * 0.2 + r.x * 25.0), cos(t * 0.17 + r.y * 25.0));
  }
  return p;
}
float size_name(vec4 d, vec4 r, float t) {
  float k = d.w;
  if (k < 0.1) return 1.55;
  if (k < 0.5) return 0.95;
  if (k < 1.5) return 0.85;
  if (k < 2.5) return 0.8;
  if (k < 3.5) return 3.4;
  if (k < 4.5) return 0.8 + 1.4 * r.w;
  return 0.8;
}
vec4 color_name(vec4 c, vec4 d, vec4 r, float t) {
  float k = d.w;
  // a slanted band of light sweeping across the word, and a slower return glint
  float s = d.x + 0.38 * d.y;
  float b1 = mix(-7.0, 7.0, fract(t * 0.085));
  float b2 = mix(7.0, -7.0, fract(t * 0.047 + 0.4));
  float g1 = exp(-pow(s - b1, 2.0) * 1.7), g2 = exp(-pow(s - b2, 2.0) * 3.0) * 0.5;
  float g = g1 + g2;
  if (k < 2.5) {
    float silk = 0.82 + 0.18 * sin(d.x * 2.3 + d.y * 3.1 + t * 0.9 + 1.7 * sin(d.x * 0.9 - t * 0.4));
    c.a *= silk;
    c.rgb = mix(c.rgb, vec3(1.0, 0.94, 0.8), clamp(g * 0.8, 0.0, 1.0));
    c.a *= 1.0 + g * 2.4;
    c.a *= 1.0 + 0.5 * pow(0.5 + 0.5 * sin(t * 2.2 + r.z * 90.0), 10.0);
    c.rgb += vec3(1.0, 0.6, 0.25) * 0.5 * pow(0.5 + 0.5 * sin(t * 0.8 + r.x * 53.0 + r.z * 7.0), 22.0) * step(0.78, r.y);   // sparse twinkle on the face
  } else if (k < 3.5) {
    c.a *= 0.75 + 0.25 * sin(t * 0.7 + d.x * 0.8) + g * 1.2;
  } else if (k < 4.5) {
    c.a *= 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * (0.8 + r.y * 1.6) + r.x * 40.0), 3.0);
  }
  return c;
}`,
  camera: { pos: [0.9, 0.45, 9.6], target: [0, 0, 0], fov: 35 },
  pointSize: 1.9,
  drift: 0.012,
}
export default form
