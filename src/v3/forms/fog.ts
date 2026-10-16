// FOG: the prologue. A volumetric cloud bank flown through, reference 1/2 (cumulus billows,
// cream tops, cool grey shadows, bright rims). Density comes from a baked 3D noise grid;
// particles are sampled in proportion to density (systematic resampling over the grid CDF) and
// lit by a baked optical-depth sweep towards the sun, so the billows carry real light and shade.
import type { FormDef } from './types'
import { H } from './ctx'

// ---------- value noise (seeded, table based) ----------
const PERM = new Uint8Array(512)
;(() => { let s = 90210; const a = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t } for (let i = 0; i < 512; i++) PERM[i] = a[i & 255] })()
const L3 = (x: number, y: number, z: number) => PERM[PERM[PERM[x & 255] + (y & 255)] + (z & 255)] / 255
function vn(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz)
  const a = L3(ix, iy, iz), b = L3(ix + 1, iy, iz), c = L3(ix, iy + 1, iz), d = L3(ix + 1, iy + 1, iz)
  const e = L3(ix, iy, iz + 1), f = L3(ix + 1, iy, iz + 1), g = L3(ix, iy + 1, iz + 1), h = L3(ix + 1, iy + 1, iz + 1)
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy
  return y0 + (y1 - y0) * fz
}
const fbm = (x: number, y: number, z: number, oct = 4) => {
  let a = 0.5, s = 0, f = 1
  for (let i = 0; i < oct; i++) { s += a * vn(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7); a *= 0.5; f *= 2.02 }
  return s / (1 - Math.pow(0.5, oct))
}
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// ---------- grid ----------
const NX = 84, NY = 42, NZ = 48
const X0 = -9.6, X1 = 9.6, Y0 = -3.8, Y1 = 3.4, Z0 = -10.4, Z1 = 0
const DX = (X1 - X0) / NX, DY = (Y1 - Y0) / NY, DZ = (Z1 - Z0) / NZ
const gi = (ix: number, iy: number, iz: number) => (iz * NY + iy) * NX + ix
const SUN = (() => { const l = Math.hypot(-0.45, 0.82, 0.38); return [-0.45 / l, 0.82 / l, 0.38 / l] })()

const wobble = (x: number, y: number, z: number) => 1 + 0.3 * (vn(x * 2.1 + 3, y * 2.1, z * 2.1 - 5) - 0.5)

/** a cumulus: big base lobes, then fractal child billows biased upward (cauliflower) */
function makePuffs(rand: () => number): number[][] {
  const out: number[][] = []
  const grow = (x: number, y: number, z: number, r: number, level: number) => {
    out.push([x, y, z, r])
    if (level >= 3 || r < 0.3) return
    const kids = level === 0 ? 6 : level === 1 ? 5 : 3
    for (let k = 0; k < kids; k++) {
      let dx = rand() * 2 - 1, dy = rand() * 2 - 1, dz = rand() * 2 - 1
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l
      if (dy < -0.12) dy = -dy * 0.55
      const rr = r * (0.5 + 0.17 * rand()), off = r * (0.74 + 0.2 * rand())
      const cy = y + dy * off
      if (cy < -3.3) continue
      grow(x + dx * off, cy, z + dz * off, rr, level + 1)
    }
  }
  const nBase = 15
  for (let i = 0; i < nBase; i++) {
    const u = (i + rand()) / nBase
    const x = -8.2 + 16.4 * u, z = -9 + rand() * 6.2
    const hump = 1 - Math.abs(Math.sin(u * 3.1 + 0.4)) * 0.0
    grow(x, -2.5 + rand() * 1.5 * hump, z, 1.5 + rand() * 0.9 + 0.08 * (-z), 0)
  }
  // a few tall towers and a free-floating cumulus
  grow(-5.2, -0.6, -6.8, 1.9, 0); grow(4.9, -0.3, -7.6, 2.1, 0); grow(0.8, -1.3, -9.2, 2.2, 0)
  grow(-6.8, 1.9, -9.6, 1.1, 1); grow(7.6, 1.5, -9.4, 1.0, 1)
  return out
}

const form: FormDef = {
  id: 'fog',
  build(ctx, pos, col) {
    const n = ctx.count, rand = ctx.rand
    form.pointSize = 5.6 * Math.min(1.7, Math.pow(262144 / n, 0.4)) // phones: fewer, bigger, softer sprites
    const nSkin = Math.floor(n * 0.56), nFill = Math.floor(n * 0.22), nMain = nSkin + nFill, nWisp = Math.floor(n * 0.08), nHaze = Math.floor(n * 0.06), nStar = n - nMain - nWisp - nHaze
    // 1) density grid: union of noisy spheres
    const dens = new Float32Array(NX * NY * NZ)
    const puffs = makePuffs(rand)
    for (const [cx, cy, cz, R] of puffs) {
      const rr = R * 1.3
      const ix0 = Math.max(0, Math.floor((cx - rr - X0) / DX)), ix1 = Math.min(NX - 1, Math.ceil((cx + rr - X0) / DX))
      const iy0 = Math.max(0, Math.floor((cy - rr - Y0) / DY)), iy1 = Math.min(NY - 1, Math.ceil((cy + rr - Y0) / DY))
      const iz0 = Math.max(0, Math.floor((cz - rr - Z0) / DZ)), iz1 = Math.min(NZ - 1, Math.ceil((cz + rr - Z0) / DZ))
      for (let iz = iz0; iz <= iz1; iz++) for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
        const x = X0 + (ix + 0.5) * DX, y = Y0 + (iy + 0.5) * DY, z = Z0 + (iz + 0.5) * DZ
        const ex = x - cx, ey = y - cy, ez = z - cz
        const q = Math.sqrt(ex * ex + ey * ey + ez * ez) / R
        if (q > 1.3) continue
        const wob = wobble(x, y, z)
        const f = 1 - (q * wob) * (q * wob)
        if (f > dens[gi(ix, iy, iz)]) dens[gi(ix, iy, iz)] = f
      }
    }
    for (let iz = 0; iz < NZ; iz++) for (let iy = 0; iy < NY; iy++) {
      const y = Y0 + (iy + 0.5) * DY, fy = sstep(-3.8, -2.3, y)
      for (let ix = 0; ix < NX; ix++) { const k = gi(ix, iy, iz); if (dens[k] > 0) dens[k] *= fy }
    }
    // 2) optical depth towards the sun (sweep top to bottom, sun leans to -x, +z)
    const lx = SUN[0] / SUN[1], lz = SUN[2] / SUN[1]
    const od = new Float32Array(NX * NY * NZ)
    const shx = (lx * DY) / DX, shz = (lz * DY) / DZ
    for (let iy = NY - 1; iy >= 0; iy--) {
      const dx = Math.round(shx * (NY - 1 - iy)) - Math.round(shx * (NY - iy)), dz = Math.round(shz * (NY - 1 - iy)) - Math.round(shz * (NY - iy))
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        let prev = 0
        if (iy < NY - 1) { const jx = ix + dx, jz = iz + dz; if (jx >= 0 && jx < NX && jz >= 0 && jz < NZ) prev = od[gi(jx, iy + 1, jz)] }
        od[gi(ix, iy, iz)] = prev * 0.97 + dens[gi(ix, iy, iz)] * DY
      }
    }
    // 3) particles live ON the skin of every puff (additive points do not occlude, so the light must sit on the surface)
    const sample = (g: Float32Array, x: number, y: number, z: number) => {
      const fx = (x - X0) / DX - 0.5, fy = (y - Y0) / DY - 0.5, fz = (z - Z0) / DZ - 0.5
      const ix = Math.max(0, Math.min(NX - 2, Math.floor(fx))), iy = Math.max(0, Math.min(NY - 2, Math.floor(fy))), iz = Math.max(0, Math.min(NZ - 2, Math.floor(fz)))
      const tx = Math.min(1, Math.max(0, fx - ix)), ty = Math.min(1, Math.max(0, fy - iy)), tz = Math.min(1, Math.max(0, fz - iz))
      const b = gi(ix, iy, iz), o = NX * NY
      const c00 = g[b] * (1 - tx) + g[b + 1] * tx, c10 = g[b + NX] * (1 - tx) + g[b + NX + 1] * tx
      const c01 = g[b + o] * (1 - tx) + g[b + o + 1] * tx, c11 = g[b + o + NX] * (1 - tx) + g[b + o + NX + 1] * tx
      return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz
    }
    let w = 0
    // exposure pre-pass: which puffs actually show skin to the lens (cheap), so the main loop rarely rejects
    const surf = (c: number[], dx: number, dy: number, dz: number) => {
      const R = c[3], wob = wobble(c[0] + dx * R, c[1] + dy * R, c[2] + dz * R), rad = R / wob
      const x = c[0] + dx * rad, y = c[1] + dy * rad, z = c[2] + dz * rad
      if (y < Y0 + 0.05 || x < X0 || x > X1 || z < Z0 || z > Z1) return -1
      return sample(dens, x, y, z) > 0.2 ? -1 : rad
    }
    const rdir = (): [number, number, number] | null => {
      const dx = rand() * 2 - 1, dy = rand() * 2 - 1, dz = rand() * 2 - 1
      const l2 = dx * dx + dy * dy + dz * dz; if (l2 > 1 || l2 < 0.0025) return null
      const l = Math.sqrt(l2); if (dz / l < -0.55) return null
      return [dx / l, dy / l, dz / l]
    }
    const live: number[][] = [], cum: number[] = []; let tot = 0
    for (const c of puffs) {
      let ok = 0, tr = 0
      while (tr < 10) { const d = rdir(); if (!d) continue; tr++; if (surf(c, d[0], d[1], d[2]) > 0) ok++ }
      if (ok === 0) continue
      tot += c[3] * c[3] * (ok / 10); live.push(c); cum.push(tot)
    }
    const pick = () => { const u = rand() * tot; let lo = 0, hi = live.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m } return live[lo] }
    const lit: [number, number, number] = [1.0, 0.965, 0.87], shade: [number, number, number] = [0.30, 0.38, 0.56]
    let tries = 0
    while (w < nSkin && tries < nSkin * 8) {
      tries++
      const c = pick(); const d = rdir(); if (!d) continue
      const rad = surf(c, d[0], d[1], d[2]); if (rad < 0) continue   // buried inside another puff
      const dx = d[0], dy = d[1], dz = d[2], r2 = rad * (1 - 0.14 * Math.pow(rand(), 2))
      const x = c[0] + dx * r2, y = c[1] + dy * r2, z = c[2] + dz * r2
      const lam = 0.5 + 0.5 * (dx * SUN[0] + dy * SUN[1] + dz * SUN[2])   // wrapped lambert: soft terminator, like scattering
      const o = sample(od, x, y, z)
      const occl = Math.exp(-o * 1.1)
      const sky = 0.2 + 0.16 * Math.max(0, dz) + 0.1 * Math.max(0, dy)       // sky fill so camera-facing skin never goes black
      const k = Math.min(1, (sky + 0.8 * Math.pow(lam, 1.6)) * (0.4 + 0.6 * occl) * 1.15)
      const fade = sstep(-1.5, -9.5, z)                          // aerial perspective
      const hz = sstep(-3.8, -1.0, y)                            // the base melts into haze
      const rr = (shade[0] + (lit[0] - shade[0]) * k) * (1 - 0.3 * fade) + 0.114 * fade
      const gg = (shade[1] + (lit[1] - shade[1]) * k) * (1 - 0.3 * fade) + 0.15 * fade
      const bb = (shade[2] + (lit[2] - shade[2]) * k) * (1 - 0.3 * fade) + 0.216 * fade
      const a = (0.1 + 0.9 * k) * (1 - 0.45 * fade) * hz * (0.9 + 0.2 * rand()) * 0.4
      H.set(pos, col, w, x, y, z, 0, rr, gg, bb, a)
      w++
    }
    // 3b) volume fill: soft, large, faint sprites inside the puffs so each billow is a fluffy mass, not a shell
    while (w < nMain) {
      const c = pick(); const d = rdir(); if (!d) continue
      const f = 0.82 * Math.cbrt(rand()), R = c[3]
      const x = c[0] + d[0] * R * f, y = c[1] + d[1] * R * f, z = c[2] + d[2] * R * f
      if (y < Y0 + 0.05 || x < X0 || x > X1 || z < Z0 || z > Z1) continue
      const lam = 0.5 + 0.5 * (d[0] * SUN[0] + d[1] * SUN[1] + d[2] * SUN[2])
      const occl = Math.exp(-sample(od, x, y, z) * 1.1)
      const k = Math.min(1, (0.22 + 0.55 * Math.pow(lam, 1.4)) * (0.35 + 0.65 * occl) * (0.7 + 0.3 * f))
      const fade = sstep(-1.5, -9.5, z), hz = sstep(-3.8, -1.0, y)
      const rr = (shade[0] + (lit[0] - shade[0]) * k) * (1 - 0.3 * fade) + 0.114 * fade
      const gg = (shade[1] + (lit[1] - shade[1]) * k) * (1 - 0.3 * fade) + 0.15 * fade
      const bb = (shade[2] + (lit[2] - shade[2]) * k) * (1 - 0.3 * fade) + 0.216 * fade
      H.set(pos, col, w, x, y, z, 4, rr, gg, bb, (0.05 + 0.1 * k) * (1 - 0.45 * fade) * hz)
      w++
    }
    while (w < nMain) { const j = Math.floor(rand() * w); const x = pos[j * 4] + (rand() - 0.5) * 0.12, y = pos[j * 4 + 1] + (rand() - 0.5) * 0.12, z = pos[j * 4 + 2] + (rand() - 0.5) * 0.12; H.set(pos, col, w, x, y, z, 0, col[j * 4], col[j * 4 + 1], col[j * 4 + 2], col[j * 4 + 3]); w++ }
    // 4) foreground wisps (large soft shreds drifting past the lens, flagged by w = 1)
    for (let i = 0; i < nWisp; i++) {
      let x = 0, y = 0, z = 0, d = 0
      for (let tries = 0; tries < 12; tries++) {
        x = (rand() * 2 - 1) * 5.5; y = -2.6 + rand() * 3.3; z = 0.2 + rand() * 4.0
        d = fbm(x * 0.55, y * 0.9, z * 0.55 + 20, 3) - 0.46 - 0.35 * Math.max(0, y)
        if (d > 0 && rand() < d * 3) break
      }
      const k = sstep(-2.6, 0.5, y)
      H.set(pos, col, w++, x, y, z, 1, 0.92 - 0.2 * (1 - k), 0.92 - 0.14 * (1 - k), 0.94, 0.05 + 0.05 * Math.max(0, d))
    }
    // 5) distant haze band (cool, very faint) + horizon glow
    for (let i = 0; i < nHaze; i++) {
      const x = (rand() * 2 - 1) * 15, y = -2.4 + Math.pow(rand(), 1.5) * 3.2 + (rand() - 0.5) * 0.3, z = -14 + rand() * 3
      const e = 1 - Math.abs(y + 0.2) / 2.4
      H.set(pos, col, w++, x, y, z, 2, 0.55, 0.64, 0.8, 0.03 + 0.06 * Math.max(0, e) * rand())
    }
    // 6) stars / ice motes in the clear air above the bank
    for (let i = 0; i < nStar; i++) {
      const x = (rand() * 2 - 1) * 12, y = 1.0 + rand() * 4.5, z = -14 + rand() * 12
      H.set(pos, col, w++, x, y, z, 3, 0.95, 0.93, 0.88, 0.1 + 0.5 * rand() * rand())
    }
  },
  glsl: /* glsl */ `
uniform float u_fog_cam;
vec3 anim_fog(vec3 p, vec4 d, vec4 r, float t) {
  vec3 q = p * vec3(0.5, 0.8, 0.5);
  // slow coherent billowing: neighbouring particles move together
  p.x += 0.16 * sin(q.y * 2.3 + q.z * 1.1 + t * 0.21) + 0.08 * sin(q.z * 3.1 - t * 0.17);
  p.y += 0.09 * sin(q.x * 2.7 + q.z * 1.7 + t * 0.27) + 0.05 * sin(q.x * 5.0 - t * 0.31);
  p.z += 0.13 * sin(q.x * 2.1 + q.y * 2.6 - t * 0.19);
  if (d.w > 0.5 && d.w < 1.5) { p.x += 0.7 * sin(t * 0.085 + p.z * 0.9 + p.y * 0.4); p.y += 0.12 * sin(t * 0.2 + p.x * 0.8); }
  if (d.w > 2.5 && d.w < 3.5) { p.y += 0.04 * sin(t * 0.5 + r.x * 40.0); }
  return p;
}
float size_fog(vec4 d, vec4 r, float t) {
  if (d.w > 3.5) return 2.5;
  if (d.w > 2.5) return 0.3;
  if (d.w > 0.5 && d.w < 1.5) return 2.4;
  if (d.w > 1.5) return 3.0;
  return 0.9 + 0.5 * smoothstep(-1.0, -9.0, d.z);
}
vec4 color_fog(vec4 c, vec4 d, vec4 r, float t) {
  float near = smoothstep(0.35, 1.9, u_fog_cam - d.z);                  // nothing pops in the lens
  float breathe = 0.93 + 0.07 * sin(t * 0.35 + d.x * 0.6 + d.z * 0.4);
  // a slow warm glint of sun travelling across the bank tops
  float glint = exp(-pow((d.x * 0.5 + d.z * 0.35) - (mod(t * 0.35, 18.0) - 9.0), 2.0) * 0.12) * smoothstep(-0.8, 1.6, d.y);
  c.rgb += vec3(0.5, 0.36, 0.16) * glint * 0.35 * step(d.w, 0.5);
  if (d.w > 2.5 && d.w < 3.5) c.a *= 0.6 + 0.4 * sin(t * (1.0 + r.y * 2.0) + r.x * 30.0);
  c.a *= near * breathe;
  return c;
}`,
  uniforms: { u_fog_cam: { value: 5.8 } },
  camera: { pos: [0, 0.4, 5.8], target: [0, 0.4, -3], fov: 40 },
  pointSize: 5.6,
  drift: 0.05,
}
export default form
