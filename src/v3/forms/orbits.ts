// FORM "orbits" — the establishing shot (waypoint 'world'). Authored in WORLD units, placed at the origin,
// scale 1: the hub is empty (the central TV hangs there), six bright area markers sit on the ring of radius
// RING at the exact AREAS positions, tinted with each area's accent, joined to the hub by faint spokes that
// carry slow outward pulses. Around them: the ring itself (it rises and dips through the area heights, with a
// comet circling it), faint wavy orbit trails with their own comets, a dust disk that sways in differential
// shear, a few satellites per marker (one per project: counts come from layout.ts, not invented), and distant
// stars for depth.
//
// d.w encodes the particle kind (read by the shader):
//   -2 star   -1 dust disk   0 marker core/halo   0.5 main ring   0.75 spoke
//   1+s orbit trail (s = rad/s; +0.5 = clockwise)   2+s satellite (s = rad/s)
import type { FormDef } from './types'
import { H } from './ctx'
import { AREAS, RING } from '../world/layout'

const TAU = Math.PI * 2
const R_HUB = 7                      // nothing closer than this to the centre
const R_DISK_OUT = 44
const TRAILS: { r: number; amp: number; m: number; ph: number; speed: number; share: number }[] = [
  { r: 9.5, amp: 0.35, m: 2, ph: 0.4, speed: 0.11, share: 0.8 },
  { r: 13.5, amp: 0.5, m: 3, ph: 1.9, speed: -0.08, share: 1.0 },
  { r: 18.5, amp: 0.7, m: 2, ph: 3.1, speed: 0.06, share: 1.3 },
  { r: 31, amp: 0.9, m: 3, ph: 0.9, speed: -0.045, share: 1.8 },
  { r: 38, amp: 1.1, m: 2, ph: 2.4, speed: 0.035, share: 2.1 },
  { r: 46, amp: 1.4, m: 3, ph: 5.0, speed: -0.028, share: 2.4 },
]
const LABELS: Record<string, string> = { work: 'I · Work', systems: 'II · Systems', research: 'III · Research', mind: 'IV · Second Brain', education: 'V · Education', about: 'VI · About' }

const f = (n: number) => n.toFixed(5)
const A0 = (AREAS[0].angle * Math.PI) / 180
const STEP = ((AREAS[1].angle - AREAS[0].angle) * Math.PI) / 180

/** periodic Catmull-Rom through the six area heights so the ring passes through every marker */
function ringHeight(a: number): number {
  const n = AREAS.length
  let u = (((a - A0) / STEP) % n + n) % n
  const i = Math.floor(u), t = u - i
  const h = (k: number) => AREAS[((k % n) + n) % n].height
  const p0 = h(i - 1), p1 = h(i), p2 = h(i + 1), p3 = h(i + 2)
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
}
const hexOf = (c: string) => H.hex(c)

const form: FormDef = {
  id: 'orbits',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    const gauss = () => { let u = 0; while (u < 1e-6) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand()) }
    const ivory: [number, number, number] = [0.95, 0.92, 0.84]
    const mix = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    const scale = N / 262144
    const acc = AREAS.map(a => hexOf(a.accent))

    // ---- area markers: core, hoop facing the hub, satellites (one per project)
    AREAS.forEach((a, i) => {
      const [cx, cy, cz] = a.center
      const ar = (a.angle * Math.PI) / 180
      const rx = Math.sin(ar), rz = Math.cos(ar)                 // radial (outward) direction
      const tx = rz, tz = -rx                                    // tangent
      const hot = mix(acc[i], [1, 1, 1], 0.3)
      const nCore = Math.floor(N * 0.0072), nHoop = Math.floor(N * 0.0042)
      for (let q = 0; q < nCore; q++) {
        const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), rad = 0.3 * Math.pow(rand(), 0.6)
        put(cx + Math.cos(th) * s * rad, cy + u * rad, cz + Math.sin(th) * s * rad, 0, hot[0], hot[1], hot[2], 0.28 + 0.5 * (1 - rad / 0.3))
      }
      for (let q = 0; q < nHoop; q++) {
        const th = rand() * TAU, rad = 1.15 + gauss() * 0.025, vy = Math.sin(th) * rad, hz = Math.cos(th) * rad
        put(cx + tx * hz + gauss() * 0.02, cy + vy, cz + tz * hz + gauss() * 0.02, 0, acc[i][0], acc[i][1], acc[i][2], 0.7 + 0.4 * rand())
      }
      // a soft glow around the core (a wide gaussian), so the marker reads from the far side of the ring
      const nGlow = Math.floor(N * 0.0035)
      for (let q = 0; q < nGlow; q++) {
        const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), rad = 0.5 + Math.abs(gauss()) * 0.55
        put(cx + Math.cos(th) * s * rad, cy + u * rad * 0.8, cz + Math.sin(th) * s * rad, 0, acc[i][0], acc[i][1], acc[i][2], 0.22 * rand())
      }
      // satellites: one bright speck per project, on a flat ring around the marker
      const np = a.projects.length
      for (let j = 0; j < np; j++) {
        const th = (j / np) * TAU + i, rad = 1.95, sp = 0.35 + 0.05 * j
        const per = Math.max(20, Math.floor(70 * scale))
        for (let q = 0; q < per; q++) {
          const g = gauss() * 0.035
          put(cx + Math.sin(th) * rad + g, cy + 0.15 * Math.sin(th * 2) + gauss() * 0.03, cz + Math.cos(th) * rad + gauss() * 0.035, 2 + sp, hot[0], hot[1], hot[2], 0.3 + 0.35 * rand())
        }
      }
    })

    // ---- stems and footprints: each marker drops a thin stem to the disk plane and leaves a faint ring there
    AREAS.forEach((a, i) => {
      const [cx, cy, cz] = a.center
      const nStem = Math.floor(N * 0.0032), nFoot = Math.floor(N * 0.0028)
      for (let q = 0; q < nStem; q++) {
        const u = rand()
        put(cx + gauss() * 0.02, cy * (1 - u) + gauss() * 0.02, cz + gauss() * 0.02, 0, acc[i][0], acc[i][1], acc[i][2], 0.22 * (1 - u * 0.7))
      }
      for (let q = 0; q < nFoot; q++) {
        const th = rand() * TAU, rad = 0.9 + gauss() * 0.03
        put(cx + Math.cos(th) * rad, gauss() * 0.02, cz + Math.sin(th) * rad, 0, acc[i][0], acc[i][1], acc[i][2], 0.3)
      }
    })

    // ---- main ring: passes through every marker, tinted near each
    const nRing = Math.floor(N * 0.1)
    for (let q = 0; q < nRing; q++) {
      const ang = rand() * TAU
      let wBest = 0, bi = 0
      for (let i = 0; i < AREAS.length; i++) {
        let d = Math.abs(((ang - (AREAS[i].angle * Math.PI) / 180 + Math.PI * 3) % TAU) - Math.PI)
        const wgt = Math.exp(-(d * d) / (2 * 0.2 * 0.2))
        if (wgt > wBest) { wBest = wgt; bi = i }
      }
      const tint = mix(ivory, acc[bi], 0.15 + 0.85 * wBest)
      const rr = RING + gauss() * 0.07
      put(Math.sin(ang) * rr, ringHeight(ang) + gauss() * 0.05, Math.cos(ang) * rr, 0.5, tint[0], tint[1], tint[2], 0.32 + 0.35 * wBest)
    }

    const nBand = Math.floor(N * 0.03)
    for (let q = 0; q < nBand; q++) {
      const ang = rand() * TAU, rr = RING + gauss() * 0.9
      put(Math.sin(ang) * rr, ringHeight(ang) * (0.9 - 0.9 * Math.abs(rr - RING) * 0.1) + gauss() * 0.18, Math.cos(ang) * rr, 0, ivory[0], ivory[1], ivory[2], 0.08 + 0.06 * rand())
    }

    // ---- spokes: hub -> marker, faint dotted line, outward pulses in the shader
    const nSpoke = Math.floor(N * 0.012)
    AREAS.forEach((a, i) => {
      const ar = (a.angle * Math.PI) / 180
      const rx = Math.sin(ar), rz = Math.cos(ar)
      for (let q = 0; q < nSpoke; q++) {
        const u = rand(), r = R_HUB + u * (RING - 1.5 - R_HUB)
        const y = a.height * (u * u * (3 - 2 * u))                // smoothstep climb to the marker height
        const tint = mix(ivory, acc[i], 0.35 + 0.5 * u)
        put(rx * r + gauss() * 0.025, y + gauss() * 0.025, rz * r + gauss() * 0.025, 0.75, tint[0], tint[1], tint[2], 0.07 + 0.13 * u)
      }
    })

    // ---- orbit trails: wavy rings, each rotating rigidly about the hub axis, with a bright head and fading tail
    const totalShare = TRAILS.reduce((s, t) => s + t.share, 0)
    const nTrails = Math.floor(N * 0.16)
    for (const tr of TRAILS) {
      const n = Math.floor((nTrails * tr.share) / totalShare)
      const cool = mix([0.72, 0.8, 1.0], ivory, tr.r < 20 ? 0.55 : 0.1)
      for (let q = 0; q < n; q++) {
        const ang = rand() * TAU
        const rr = tr.r + gauss() * 0.08
        const y = tr.amp * Math.sin(tr.m * ang + tr.ph) + gauss() * 0.05
        put(Math.sin(ang) * rr, y, Math.cos(ang) * rr, 1 + (tr.speed < 0 ? 0.5 : 0) + Math.abs(tr.speed), cool[0], cool[1], cool[2], 0.16 + 0.12 * rand())
      }
    }

    // ---- distant stars (static)
    const nStar = Math.floor(N * 0.04)
    for (let q = 0; q < nStar; q++) {
      const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), rad = 58 + rand() * 60
      put(Math.cos(th) * s * rad, u * rad * 0.55, Math.sin(th) * s * rad, -2, 0.85, 0.9, 1.0, 0.05 + 0.2 * Math.pow(rand(), 3))
    }

    // ---- dust disk fills the rest: surface density ~ r^-1.5, two soft spiral arms, warm inside, cool outside
    const a2 = Math.sqrt(R_HUB), b2 = Math.sqrt(R_DISK_OUT)
    while (k < N) {
      const rr = Math.pow(a2 + rand() * (b2 - a2), 2)
      const ang = rand() * TAU
      const arm = 0.5 + 0.5 * Math.cos(2 * (ang - 1.35 * Math.log(rr / R_HUB)))
      if (rand() > 0.35 + 0.65 * arm) continue
      const taper = Math.min(1, (rr - R_HUB) / 3)               // soft inner edge
      const warm = Math.max(0, 1 - (rr - R_HUB) / 26)
      const c = mix([0.66, 0.74, 1.0], [1.0, 0.86, 0.62], warm)
      put(Math.sin(ang) * rr, gauss() * (0.1 + 0.022 * rr), Math.cos(ang) * rr, -1, c[0], c[1], c[2], (0.07 + 0.2 * rand()) * taper * (0.5 + 0.5 * arm))
    }
  },
  glsl: /* glsl */ `
vec3 anim_orbits(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w < -1.5) return p;
  if (w < -0.5) {                                   // dust disk: bounded differential sway, never winds up
    float rr = max(length(p.xz), ${f(R_HUB)});
    float a = 0.5 * (9.0 / rr) * sin(t * 0.05);
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y + 0.05 * sin(t * 0.25 + r.y * 40.0), -s * p.x + c * p.z);
  }
  if (w >= 2.0) {                                   // satellite: circles its marker about the vertical axis
    float ang = atan(p.x, p.z);
    float kk = floor((ang - ${f(A0)}) / ${f(STEP)} + 0.5);
    float ac = ${f(A0)} + kk * ${f(STEP)};
    vec2 c0 = vec2(sin(ac), cos(ac)) * ${f(RING)};
    vec2 q = p.xz - c0;
    float a = (w - 2.0) * t, c = cos(a), s = sin(a);
    return vec3(c0.x + c * q.x + s * q.y, p.y, c0.y - s * q.x + c * q.y);
  }
  if (w >= 1.0) {                                   // orbit trail: rigid rotation about the hub axis (sign = direction)
    float sw = w - 1.0;
    float dir = sw > 0.3 ? -1.0 : 1.0;
    float sp = sw - (sw > 0.3 ? 0.5 : 0.0);
    float a = dir * sp * t, c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
  return p;
}
float size_orbits(vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w < -1.5) return 0.7;
  if (w < -0.5) return 0.62;
  if (w >= 2.0) return 1.5;
  if (w >= 1.0) return 0.8;
  if (w > 0.7) return 0.7;
  if (w > 0.4) return 0.85;
  return 1.0;
}
vec4 color_orbits(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w > 0.4 && w < 0.6) {                         // main ring: a comet circles it
    float ang = atan(d.x, d.z) / 6.2831853 + 0.5;
    float q = fract(t * 0.028 - ang);
    c.a *= 1.0 + 2.4 * exp(-11.0 * q);
  } else if (w > 0.7 && w < 0.8) {                  // spokes: pulses run outward from the hub
    float u = (length(d.xz) - ${f(R_HUB)}) / ${f(RING - 1.5 - R_HUB)};
    float ph = fract(sin(atan(d.x, d.z) * 12.9898) * 43758.5);
    float q = fract(ph + t * 0.09 - u);
    c.a *= 1.0 + 3.2 * exp(-16.0 * q);
  } else if (w >= 1.0 && w < 2.0) {                 // trails: bright head, long fading tail (rides with the rotation)
    float ang = atan(d.x, d.z) / 6.2831853 + 0.5;
    float ph = fract(length(d.xz) * 0.37);
    float q = fract(ang - ph);
    c.a *= 0.5 + 2.6 * exp(-5.5 * q);
  } else if (w > -0.1 && w < 0.1) {                 // markers: slow breathing, each out of step
    float ang = atan(d.x, d.z);
    float kk = floor((ang - ${f(A0)}) / ${f(STEP)} + 0.5);
    c.a *= 0.86 + 0.14 * sin(t * 1.3 + kk * 1.7);
  } else if (w >= 2.0) {
    c.a *= 0.9 + 0.1 * sin(t * 3.0 + r.x * 6.0);
  }
  return c;
}`,
  camera: { pos: [0, 16, 58], target: [0, -1, 0], fov: 38 },
  pointSize: 11,
  drift: 0.012,
  anchors: AREAS.map(a => ({ id: a.id, label: LABELS[a.id] ?? a.id, pos: [a.center[0], a.center[1] + 1.8, a.center[2]] as [number, number, number] })),
}
export default form
