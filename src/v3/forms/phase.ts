// PHASE: Love Island Dynamics. A 3D phase portrait of a coupled linear system: thousands of particles
// stream along analytic trajectories that spiral into a stable focus (anim_phase evaluates
// exp(A s) p0 per particle and wraps), two bright "couple" comets with trails orbit each other joined
// by a vibrating thread, and faint axes, nullclines and a plot box frame the figure.
//   state (u, v, w): (u, v) rotate and contract (focus, alpha < 0), w decays on its own (the public)
//   world = (u + 0.28 v, 0.82 v, w)
// pos.w classes: 1 streamline (1 + phase*0.999), 6 flow mote (6 + phase*0.999), 2 comet trail
// (2 + 0.5*id), 3 coupling thread, 4 hairline figure (axes / nullclines / box), 5 dust.
// pos.xyz of classes 1, 2, 6 = initial condition (u0, v0, w0); of 4 and 5 = world position.
import type { FormDef } from './types'
import { H } from './ctx'

const ALPHA = -0.24, OMEGA = 1.55, MU = 0.30
const COMET_A: [number, number, number] = [2.9, 0.4, 1.1]
const COMET_B: [number, number, number] = [-2.7, -0.7, -1.0]

const form: FormDef = {
  id: 'phase',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    const ACC = H.hex('#FF6A8A'), IV = H.hex('#EDE6D6')
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { H.set(pos, col, idx++, x, y, z, w, r, g, b, a) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))

    // ---- streamlines: NT trajectories, stratified along time so spacing along each curve is even ----
    const NT = 110
    const strN = take(0.60), per = Math.ceil(strN / NT)
    const ics: [number, number, number, number, number][] = []
    for (let j = 0; j < NT; j++) {
      const th = j * 2.399963, R = 1.0 + 2.25 * Math.sqrt((j + 0.5) / NT), w0 = 1.9 * (2 * ((j * 0.618034) % 1) - 1)
      const hero = rand() < 0.14 ? 1.7 : 1, tint = rand()
      ics.push([R * Math.cos(th), R * Math.sin(th), w0, tint, hero])
    }
    for (let i = 0; i < strN; i++) {
      const j = i % NT, k = Math.floor(i / NT), ic = ics[j]
      const ph = Math.min(0.998, (k + rand()) / per)
      put(ic[0], ic[1], ic[2], 1 + ph * 0.999, ic[3], ic[4], 0, 0.22 * boost)
    }

    // ---- flow motes: a haze of faint particles on random initial conditions (the surrounding audience) ----
    const moteN = take(0.10)
    for (let i = 0; i < moteN; i++) {
      const th = rand() * 6.2832, R = 0.8 + 3.6 * Math.sqrt(rand()), w0 = (rand() * 2 - 1) * 2.2
      put(R * Math.cos(th), R * Math.sin(th), w0, 6 + rand() * 0.999, rand(), 1, 0, 0.075 * boost)
    }

    // ---- comets: heads and trails (the pair); trail offset comes from the per-particle random r.y ----
    const cometN = take(0.04)
    for (let c = 0; c < 2; c++) {
      const ic = c === 0 ? COMET_A : COMET_B
      for (let i = 0; i < cometN; i++) put(ic[0], ic[1], ic[2], 2 + c * 0.5, c, 1, 0, 0.5 * boost)
    }

    // ---- core: a pulsing warm glow at the focus ----
    const coreN = take(0.025)
    for (let i = 0; i < coreN; i++) {
      const g = () => (rand() + rand() + rand() - 1.5) * 0.7
      put(g() * 0.20, g() * 0.16, g() * 0.14, 7, 1.0, 0.82, 0.74, 0.30 * boost)
    }

    // ---- coupling thread between the two heads ----
    const thrN = take(0.012)
    for (let i = 0; i < thrN; i++) put(0, 0, 0, 3, ACC[0], ACC[1], ACC[2], 0.35 * boost)

    // ---- hairline figure: axes + ticks, nullclines, plot box ----
    const figN = take(0.085)
    // world-plane matrix A_w = M A M^-1 with M = [[1, .28], [0, .82]], A = [[a, -w], [w, a]]
    const M = [[1, 0.28], [0, 0.82]], Mi = [[1, -0.28 / 0.82], [0, 1 / 0.82]], A = [[ALPHA, -OMEGA], [OMEGA, ALPHA]]
    const mm = (X: number[][], Y: number[][]) => [[X[0][0] * Y[0][0] + X[0][1] * Y[1][0], X[0][0] * Y[0][1] + X[0][1] * Y[1][1]], [X[1][0] * Y[0][0] + X[1][1] * Y[1][0], X[1][0] * Y[0][1] + X[1][1] * Y[1][1]]]
    const Aw = mm(mm(M, A), Mi)
    const nulls = [[-Aw[0][1], Aw[0][0]], [-Aw[1][1], Aw[1][0]]].map(v => { const m = Math.hypot(v[0], v[1]); return [v[0] / m, v[1] / m] })
    const BX = 3.9, BY = 2.35, BZ = 2.0
    const figure = (): [number, number, number, number, number] => {
      const k = rand()
      if (k < 0.20) { // axes
        const ax = Math.floor(rand() * 3), u = (rand() * 2 - 1)
        const L = [BX, BY, BZ][ax]
        return [ax === 0 ? u * L : 0, ax === 1 ? u * L : 0, ax === 2 ? u * L : 0, 0.85, 4.0]
      }
      if (k < 0.30) { // ticks every 0.7
        const ax = Math.floor(rand() * 3), n = Math.floor(rand() * 2 * (ax === 0 ? 6 : ax === 1 ? 3 : 3)) - (ax === 0 ? 6 : 3)
        const tk = n * 0.7 + 0.35 * 0, off = (rand() * 2 - 1) * 0.07
        return [ax === 0 ? tk : off, ax === 1 ? tk : (ax === 0 ? off : 0), ax === 2 ? tk : (ax === 1 ? off : 0), 0.7, 4.1]
      }
      if (k < 0.34) { // arrow heads at +ends
        const ax = Math.floor(rand() * 3), u = rand() * 0.22, s = (rand() < 0.5 ? -1 : 1) * u * 0.38, L = [BX, BY, BZ][ax]
        return [ax === 0 ? L - u : s, ax === 1 ? L - u : (ax === 0 ? s : 0), ax === 2 ? L - u : (ax === 1 ? s : 0), 0.9, 4.0]
      }
      if (k < 0.52) { // nullclines in the z = 0 plane, dashed
        const c = Math.floor(rand() * 2), tt = (rand() * 2 - 1) * 4.6, x = nulls[c][0] * tt, y = nulls[c][1] * tt
        if (Math.abs(x) > BX || Math.abs(y) > BY) return [x * 0.001, y * 0.001, 0, 0, 4.3]
        const dash = Math.sin(tt * 7) > -0.1 ? 1 : 0.12
        return [x, y, 0, 0.55 * dash, 4.2 + c * 0.05]
      }
      // plot box edges
      const e = Math.floor(rand() * 12), u = rand() * 2 - 1
      const sx = e & 1 ? 1 : -1, sy = e & 2 ? 1 : -1, sz = e & 4 ? 1 : -1
      let p: [number, number, number]
      if (e < 4) p = [u * BX, sx * BY, sy * BZ]; else if (e < 8) p = [sx * BX, u * BY, sy * BZ]; else p = [sx * BX, sy * BY, u * BZ]
      void sz
      return [p[0], p[1], p[2], 0.22, 4.4]
    }
    for (let i = 0; i < figN; i++) {
      const [x, y, z, a, w] = figure()
      put(x + (rand() - 0.5) * 0.006, y + (rand() - 0.5) * 0.006, z, w, IV[0], IV[1], IV[2], a * boost)
    }

    // ---- dust: the rest ----
    H.dust(pos, col, idx, N, rand, 6.4, 0.08 * boost, [1.0, 0.8, 0.82])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 5
  },
  glsl: /* glsl */ `
const float PH_A = ${ALPHA.toFixed(3)};
const float PH_W = ${OMEGA.toFixed(3)};
const float PH_MU = ${MU.toFixed(3)};
const float PH_TMAX = 8.5;
const float PH_SP = 0.9;
const float PH_TC = 9.0;
const float PH_TRAIL = 1.9;
vec3 ph_flow(vec3 p0, float s) {
  float e = exp(PH_A * s), c = cos(PH_W * s), sn = sin(PH_W * s);
  float u = e * (p0.x * c - p0.y * sn), v = e * (p0.x * sn + p0.y * c);
  return vec3(u + 0.28 * v, 0.82 * v, p0.z * exp(-PH_MU * s));
}
float ph_tau(float ph, float t) { return pow(mod(t * PH_SP / PH_TMAX + ph, 1.0), 1.8); }
float ph_head(float t) { return mod(t * 0.85, PH_TC); }
float ph_hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 anim_phase(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 1.5 || (cl > 5.5 && cl < 6.5)) {
    float ph = fract(d.w) / 0.999;
    return ph_flow(p, PH_TMAX * ph_tau(ph, t));
  }
  if (cl < 2.9) {
    float id = fract(d.w) * 2.0;
    float sh = ph_head(t);
    float dl = pow(r.y, 1.7) * PH_TRAIL;
    float s = max(0.0, sh - dl);
    vec3 q = ph_flow(p, s);
    return q + 0.012 * vec3(sin(t * 7.0 + r.x * 40.0), cos(t * 6.0 + r.z * 40.0), sin(t * 5.0 + r.w * 40.0)) * (0.2 + dl);
  }
  if (cl < 3.5) {
    float sh = ph_head(t);
    vec3 a = ph_flow(vec3(${COMET_A.map(v => v.toFixed(2)).join(', ')}), sh);
    vec3 b = ph_flow(vec3(${COMET_B.map(v => v.toFixed(2)).join(', ')}), sh);
    float u = r.y;
    vec3 q = mix(a, b, u);
    float wv = sin(u * 3.14159265);
    q.z += 0.10 * wv * sin(u * 26.0 - t * 7.0 + r.x * 0.6);
    q.y += 0.10 * wv * sin(u * 19.0 + t * 5.0 + r.z);
    return q;
  }
  if (cl > 6.5 && cl < 7.5) return p * (1.0 + 0.22 * sin(t * 2.2 + r.x * 6.283) * r.y);
  return p;
}
float size_phase(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 1.5) { float ph = fract(d.w) / 0.999; float x = ph_tau(ph, t); return mix(1.9, 0.85, smoothstep(0.0, 0.8, x)); }
  if (cl > 5.5 && cl < 6.5) return 2.3;
  if (cl < 2.9) { float dl = pow(r.y, 1.7); return mix(4.2, 0.55, smoothstep(0.0, 0.45, dl)); }
  if (cl < 3.5) return 0.9;
  if (cl < 4.5) return 0.8;
  if (cl > 6.5 && cl < 7.5) return 1.7;
  return 1.0;
}
vec4 color_phase(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  vec3 acc = vec3(1.0, 0.42, 0.54);
  vec3 ivo = vec3(0.95, 0.90, 0.83);
  if (cl < 1.5 || (cl > 5.5 && cl < 6.5)) {
    float ph = fract(d.w) / 0.999;
    float x = ph_tau(ph, t);
    vec3 base = mix(acc, vec3(0.78, 0.60, 1.0), 0.28 * c.r);
    vec3 rgb = mix(base, ivo, smoothstep(0.05, 0.6, x));
    rgb = mix(rgb, vec3(1.0, 0.86, 0.70), smoothstep(0.7, 1.0, x));
    float a = c.a * smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.96, 1.0, x)) * mix(1.0, 0.42, smoothstep(0.3, 1.0, x));
    if (cl > 5.5) a *= 0.9 + 0.1 * sin(t + d.x);
    return vec4(rgb, a * (cl < 1.5 ? c.g : 1.0));
  }
  if (cl < 2.9) {
    float id = fract(d.w) * 2.0;
    float sh = ph_head(t);
    float dl = pow(r.y, 1.7) * PH_TRAIL;
    float live = step(0.0, sh - dl);
    float fade = smoothstep(0.0, 0.6, sh) * (1.0 - smoothstep(PH_TC - 1.4, PH_TC, sh));
    float tail = pow(1.0 - dl / PH_TRAIL, 2.6) + 0.9 * exp(-dl * 9.0);
    vec3 hot = mix(vec3(1.0, 0.36, 0.52), vec3(1.0, 0.70, 0.46), id);
    vec3 rgb = mix(hot, vec3(1.0, 0.97, 0.92), smoothstep(0.35, 0.0, dl));
    return vec4(rgb, c.a * live * fade * tail * (1.0 + 2.2 * smoothstep(0.12, 0.0, dl)));
  }
  if (cl < 3.5) {
    float sh = ph_head(t);
    float fade = smoothstep(0.0, 0.6, sh) * (1.0 - smoothstep(PH_TC - 1.4, PH_TC, sh));
    float u = r.y;
    return vec4(c.rgb, c.a * fade * (0.5 + 0.5 * sin(u * 40.0 - t * 5.0)) * (0.4 + 0.6 * sin(u * 3.14159265)));
  }
  return c;
}`,
  camera: { pos: [4.6, 1.5, 9.4], target: [0, -0.05, 0], fov: 36 },
  pointSize: 1.7,
  drift: 0.012,
  anchors: [
    { id: 'x', label: 'one partner', pos: [4.15, 0, 0] },
    { id: 'y', label: 'the other', pos: [0, 2.6, 0] },
    { id: 'z', label: 'the public', pos: [0, 0, 2.25] },
  ],
}
export default form
