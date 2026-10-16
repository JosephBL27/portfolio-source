// BRAIN: an anatomically shaped human brain made of light, and the same brain the glass at the Mind area is made of
// (src/gl/brainShape.ts: two hemispheres and the longitudinal fissure, frontal / parietal / temporal / occipital lobes, the lateral
// fissure, gyri and sulci, cerebellum with folia, brainstem). The cortex is a stipple of particles on the very mesh the glass uses; inside it
// the real vault graph (src/data/brain-graph.json) is laid out lobe by lobe (every folder in its own region), notes are blobs sized by
// degree, links are fine strands bundled through the core, with pulses of light travelling along them. Three small sparks orbit the
// core (the three agents that boot from the vault). No note titles anywhere.
// Colour modes (folders / thermal / ivory / spectral) are shared with the glass through src/gl/brainColor.ts: a change sweeps from the back of
// the brain to the front, and colour waves run along the links.
import * as THREE from 'three'
import type { FormDef } from './types'
import { H } from './ctx'
import graph from '../../data/brain-graph.json'
import { loadBrainMesh, layoutVault, linkControl, poseVec, FOLDER_REGION, REGIONS } from '../../gl/brainShape'
import { BRAIN_COLOR_GLSL, brainMode, folderColor } from '../../gl/brainColor'

const G = graph as unknown as { groups: string[]; nodes: [number, number, number, number][]; links: [number, number][] }
/** half the brain's length in world units (the glass uses radius * 1.06 = 2.86; this one fits the form box) */
const SC = 2.8
const tex = new THREE.DataTexture(new Float32Array(2048), 2048, 1, THREE.RedFormat, THREE.FloatType)
tex.minFilter = tex.magFilter = THREE.NearestFilter
const uniforms = {
  u_brain_mode: { value: new THREE.Vector2(0, 0) },
  u_brain_sweep: { value: 2 },
  u_brain_rheat: { value: new Array(9).fill(0.5) as number[] },
  u_brain_lheat: { value: tex },
}
const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
// lab: ?brainmode=0..3 pins a colour mode in the form viewer
if (typeof location !== 'undefined') { const m = new URLSearchParams(location.search).get('brainmode'); if (m != null) brainMode.set(+m, true) }

const form: FormDef = {
  id: 'brain',
  async build(ctx, pos, col) {
    const n = ctx.count, rand = ctx.rand
    form.pointSize = 1.8 * Math.min(1.6, Math.pow(262144 / n, 0.35))
    const mesh = await loadBrainMesh()
    const nShell = Math.floor(n * 0.5), nNode = Math.floor(n * 0.1), nLink = Math.floor(n * 0.2), nNeb = Math.floor(n * 0.04), nCore = Math.floor(n * 0.025), nHalo = Math.floor(n * 0.015), nAgent = Math.floor(n * 0.02)
    const N = G.nodes.length
    const maxDeg = Math.max(...G.nodes.map(d => d[3]), 1)
    const heatOf = (d: number) => Math.pow(d / maxDeg, 0.42)
    const t3: [number, number, number] = [0, 0, 0]
    const pose = (x: number, y: number, z: number): [number, number, number] => { poseVec(x, y, z, t3); return [t3[0] * SC, t3[1] * SC, t3[2] * SC] }

    // per-region tint and heat (the folder that lives in each lobe), the same table the glass uses
    const regCol: [number, number, number][] = REGIONS.map(() => [0.6, 0.64, 0.66]), regHeat = REGIONS.map(() => 0.4), best = REGIONS.map(() => -1)
    const cnt: Record<number, number> = {}; G.nodes.forEach(nd => { cnt[nd[2]] = (cnt[nd[2]] ?? 0) + 1 })
    G.groups.forEach((name, g) => {
      const r = FOLDER_REGION[name]; const c = cnt[g] ?? 0
      if (r == null || c <= best[r]) return
      best[r] = c
      const k = folderColor(name); regCol[r] = [k.r, k.g, k.b]
      let sum = 0; for (const nd of G.nodes) if (nd[2] === g) sum += heatOf(nd[3])
      regHeat[r] = Math.min(1, (sum / c) * 1.5)
    })
    uniforms.u_brain_rheat.value = regHeat

    let w = 0
    const gauss = () => (rand() + rand() + rand() - 1.5) * 1.6
    // 1) the cortex: area-weighted samples on the glass's own mesh. Sulci are brighter (light caught in the creases), crowns quieter.
    const nt = mesh.idx.length / 3, cum = new Float64Array(nt)
    let acc = 0
    for (let t = 0; t < nt; t++) {
      const a = mesh.idx[t * 3] * 3, b = mesh.idx[t * 3 + 1] * 3, c = mesh.idx[t * 3 + 2] * 3
      const ux = mesh.pos[b] - mesh.pos[a], uy = mesh.pos[b + 1] - mesh.pos[a + 1], uz = mesh.pos[b + 2] - mesh.pos[a + 2], vx = mesh.pos[c] - mesh.pos[a], vy = mesh.pos[c + 1] - mesh.pos[a + 1], vz = mesh.pos[c + 2] - mesh.pos[a + 2]
      acc += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); cum[t] = acc
    }
    for (let k = 0; k < nShell; k++) {
      const r = rand() * acc
      let lo = 0, hi = nt - 1
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid }
      const ia = mesh.idx[lo * 3], ib = mesh.idx[lo * 3 + 1], ic = mesh.idx[lo * 3 + 2]
      let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v }
      const wA = 1 - u - v
      const x = mesh.pos[ia * 3] * wA + mesh.pos[ib * 3] * u + mesh.pos[ic * 3] * v, y = mesh.pos[ia * 3 + 1] * wA + mesh.pos[ib * 3 + 1] * u + mesh.pos[ic * 3 + 1] * v, z = mesh.pos[ia * 3 + 2] * wA + mesh.pos[ib * 3 + 2] * u + mesh.pos[ic * 3 + 2] * v
      const fold = mesh.fold[ia] * wA + mesh.fold[ib] * u + mesh.fold[ic] * v, reg = mesh.region[ia]
      const p = pose(x, y, z), tint = regCol[reg]
      H.set(pos, col, w++, p[0], p[1], p[2], -10 - reg,
        tint[0] * 0.5 + 0.5, tint[1] * 0.5 + 0.52, tint[2] * 0.5 + 0.56, (0.17 + 0.44 * Math.pow(fold, 1.1)) * (0.6 + 0.8 * rand()))
    }
    // 2) notes, placed in their folder's lobe
    const lay = layoutVault(G.nodes, G.groups)
    const NP = G.nodes.map((_, i) => pose(lay[i * 3], lay[i * 3 + 1], lay[i * 3 + 2]))
    const wp = (d: number) => Math.pow(1 + d, 0.72)
    const wsum = G.nodes.reduce((a, d) => a + wp(d[3]), 0)
    const end1 = w + nNode
    for (let i = 0; i < N && w < end1; i++) {
      const nd = G.nodes[i], deg01 = nd[3] / maxDeg, tint = folderColor(G.groups[nd[2]])
      const c = Math.max(3, Math.round(nNode * wp(nd[3]) / wsum)), rn = 0.016 + 0.045 * Math.sqrt(deg01)
      for (let k = 0; k < c && w < end1; k++) {
        const hot = 0.55 + 0.45 * deg01
        H.set(pos, col, w++, NP[i][0] + gauss() * rn, NP[i][1] + gauss() * rn, NP[i][2] + gauss() * rn, -1 - deg01,
          tint.r * 0.55 + 0.45, tint.g * 0.55 + 0.45, tint.b * 0.55 + 0.45, (0.3 + 0.2 * hot - 0.2 * deg01 * deg01) * (0.6 + 0.4 * rand()))
      }
    }
    while (w < end1) { const j = Math.floor(rand() * w); H.set(pos, col, w++, pos[j * 4] + gauss() * 0.02, pos[j * 4 + 1] + gauss() * 0.02, pos[j * 4 + 2] + gauss() * 0.02, pos[j * 4 + 3], col[j * 4], col[j * 4 + 1], col[j * 4 + 2], col[j * 4 + 3]) }
    // 3) links: strands. Quadratic Bezier in brain space, bundled through the core between lobes, posed with the rest.
    const L = G.links.length
    const lens = new Float32Array(L), ctrl = new Float32Array(L * 3)
    let lsum = 0
    const lh = tex.image.data as Float32Array
    for (let j = 0; j < L; j++) {
      const [a, b] = G.links[j]
      const A: [number, number, number] = [lay[a * 3], lay[a * 3 + 1], lay[a * 3 + 2]], B: [number, number, number] = [lay[b * 3], lay[b * 3 + 1], lay[b * 3 + 2]]
      const C = linkControl(A, B, G.nodes[a][2] !== G.nodes[b][2], hash(j * 1.7 + 0.2))
      ctrl[j * 3] = C[0]; ctrl[j * 3 + 1] = C[1]; ctrl[j * 3 + 2] = C[2]
      lens[j] = Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]) + Math.hypot(B[0] - C[0], B[1] - C[1], B[2] - C[2]) + 0.05; lsum += lens[j]
      lh[j] = (heatOf(G.nodes[a][3]) + heatOf(G.nodes[b][3])) * 0.5
    }
    tex.needsUpdate = true
    const end2 = w + nLink
    for (let j = 0; j < L; j++) {
      const [a, b] = G.links[j], ca = folderColor(G.groups[G.nodes[a][2]]), cb = folderColor(G.groups[G.nodes[b][2]]), cross = G.nodes[a][2] !== G.nodes[b][2]
      const A = [lay[a * 3], lay[a * 3 + 1], lay[a * 3 + 2]], B = [lay[b * 3], lay[b * 3 + 1], lay[b * 3 + 2]], C = [ctrl[j * 3], ctrl[j * 3 + 1], ctrl[j * 3 + 2]]
      const c = Math.max(5, Math.round((nLink * lens[j]) / lsum))
      for (let k = 0; k < c && w < end2; k++) {
        const s = (k + rand()) / c, u = 1 - s
        const p = pose(u * u * A[0] + 2 * u * s * C[0] + s * s * B[0], u * u * A[1] + 2 * u * s * C[1] + s * s * B[1], u * u * A[2] + 2 * u * s * C[2] + s * s * B[2])
        const jit = 0.0045
        const r = ca.r * u + cb.r * s, g = ca.g * u + cb.g * s, bl = ca.b * u + cb.b * s
        H.set(pos, col, w++, p[0] + (rand() - 0.5) * jit, p[1] + (rand() - 0.5) * jit, p[2] + (rand() - 0.5) * jit, j + Math.min(s, 0.9995), r * 0.7 + 0.3, g * 0.7 + 0.3, bl * 0.7 + 0.3, cross ? 0.13 : 0.24)
      }
    }
    while (w < end2) { const j = end1 + Math.floor(rand() * (w - end1)); H.set(pos, col, w++, pos[j * 4] + (rand() - 0.5) * 0.01, pos[j * 4 + 1], pos[j * 4 + 2], pos[j * 4 + 3], col[j * 4], col[j * 4 + 1], col[j * 4 + 2], col[j * 4 + 3]) }
    // 4) a soft folder-tinted glow in each lobe, behind its notes
    const byG = new Map<number, number[]>(); G.nodes.forEach((nd, i) => { if (!byG.has(nd[2])) byG.set(nd[2], []); byG.get(nd[2])!.push(i) })
    const end3 = w + nNeb
    for (const [g, ids] of byG) {
      const tint = folderColor(G.groups[g])
      const cx = ids.reduce((a, i) => a + NP[i][0], 0) / ids.length, cy = ids.reduce((a, i) => a + NP[i][1], 0) / ids.length, cz = ids.reduce((a, i) => a + NP[i][2], 0) / ids.length
      const rr = 0.3 + 0.03 * Math.sqrt(ids.length)
      const c = Math.round((nNeb * (ids.length + 20)) / (N + 20 * byG.size))
      for (let k = 0; k < c && w < end3; k++) H.set(pos, col, w++, cx + gauss() * rr * 0.6, cy + gauss() * rr * 0.6, cz + gauss() * rr * 0.6, -0.25, tint.r, tint.g, tint.b, 0.035 + 0.03 * rand())
    }
    while (w < end3) { const j = end2 + Math.floor(rand() * (w - end2)); H.set(pos, col, w++, pos[j * 4] + gauss() * 0.02, pos[j * 4 + 1], pos[j * 4 + 2], -0.25, col[j * 4], col[j * 4 + 1], col[j * 4 + 2], 0.03) }
    // 5) the core: a bright seed where the bundled strands converge, with a soft halo
    const core = pose(0, -0.06, -0.04)
    for (let k = 0; k < nCore; k++) {
      const u = rand() * 2 - 1, th = rand() * 6.2832, s = Math.sqrt(1 - u * u), r = 0.15 * Math.pow(rand(), 0.7)
      H.set(pos, col, w++, core[0] + Math.cos(th) * s * r, core[1] + u * r, core[2] + Math.sin(th) * s * r, -3, 1.0, 0.97, 0.9, 0.12 + 0.12 * rand())
    }
    for (let k = 0; k < nHalo; k++) H.set(pos, col, w++, core[0] + gauss() * 0.34, core[1] + gauss() * 0.34, core[2] + gauss() * 0.34, -3.5, 0.75, 0.85, 1.0, 0.015 + 0.02 * rand())
    // 6) three agent sparks orbit the core, each dragging a comet tail (w = 3000 + 2*id + lag)
    for (let k = 0; k < nAgent; k++) {
      const id = k % 3, lag = Math.pow(rand(), 1.7), r = 0.02 * (1 - 0.6 * lag)
      const tints = [[1.0, 0.8, 0.55], [0.6, 0.85, 1.0], [0.85, 0.75, 1.0]][id]
      H.set(pos, col, w++, core[0] + gauss() * r, core[1] + gauss() * r, core[2] + gauss() * r, 3000 + id * 2 + lag, tints[0], tints[1], tints[2], (1 - lag) * 0.6 + 0.05)
    }
    // 7) faint dust shell for depth
    H.dust(pos, col, w, n, rand, 6.2, 0.07, [0.7, 0.8, 1.0])
    for (let i = w; i < n; i++) pos[i * 4 + 3] = -0.5
  },
  uniforms,
  glsl: /* glsl */ `
uniform vec2 u_brain_mode; uniform float u_brain_sweep; uniform float u_brain_rheat[9]; uniform sampler2D u_brain_lheat;
${BRAIN_COLOR_GLSL}
float bh_h(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
vec3 bh_orbit(float id, float ang) {
  float rad = 0.5 + 0.14 * id;
  vec3 q = vec3(cos(ang), 0.0, sin(ang)) * rad;
  float tl = 0.5 + 0.75 * id, c = cos(tl), s = sin(tl);
  q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  float c2 = cos(id * 2.1), s2 = sin(id * 2.1);
  q.xz = vec2(c2 * q.x - s2 * q.z, s2 * q.x + c2 * q.z);
  return q;
}
float bh_pulse(vec4 d, float t) {
  float lid = floor(d.w), s = d.w - lid;
  float sp = 0.14 + 0.2 * bh_h(lid + 7.3);
  float ph = fract(t * sp + bh_h(lid)) * 1.9 - 0.3;
  float q = ph - s;
  return step(0.0, q) * exp(-q * 15.0) * smoothstep(0.0, 0.012, q);
}
vec3 anim_brain(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 2999.0) {
    float v = w - 3000.0, id = floor(v * 0.5), lag = v - id * 2.0;
    p += bh_orbit(id, t * (0.8 + 0.28 * id) - lag * 1.3 + id * 2.0);
  } else if (w <= -2.9 && w > -3.6) {
    float sw = 1.0 + 0.1 * sin(t * 1.4 + r.x * 6.0);
    p = (p - vec3(-0.112, -0.165, -0.033)) * sw + vec3(-0.112, -0.165, -0.033);
  } else if (w < 0.0 && w > -2.1) {
    p += 0.004 * vec3(sin(t * 1.3 + r.x * 40.0), sin(t * 1.1 + r.y * 40.0), sin(t * 1.5 + r.z * 40.0));
  } else if (w < -9.0) {
    p += 0.0025 * vec3(sin(t * 0.9 + r.x * 50.0), sin(t * 0.8 + r.y * 50.0), sin(t * 1.0 + r.z * 50.0));
  }
  float yaw = 0.34 * sin(t * 0.13);
  float c = cos(yaw), s = sin(yaw);
  p.xz = vec2(c * p.x + s * p.z, -s * p.x + c * p.z);
  return p;
}
float size_brain(vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w < -9.0) return 0.95;
  if (w >= 2999.0) { float v = w - 3000.0; float lag = v - floor(v * 0.5) * 2.0; return 1.9 - 1.3 * lag; }
  if (w >= 0.0) return 1.1 + 1.9 * bh_pulse(d, t);
  if (w > -0.3) return 3.6;
  if (w > -2.05 && w <= -0.9) return 0.85 + 1.5 * (-w - 1.0);
  if (w <= -3.4 && w > -3.6) return 2.2;
  if (w <= -2.9) return 1.3;
  return 0.8;
}
vec4 color_brain(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w;
  float zn = clamp(d.x / ${(2 * SC).toFixed(3)} + 0.5, 0.0, 1.0);
  if (w < -9.0) {
    // the cortex: tinted by its lobe's folder, recoloured by the mode, with a slow shimmer
    float heat = u_brain_rheat[int(clamp(-w - 10.0 + 0.5, 0.0, 8.0))];
    c.rgb = bc(u_brain_mode, u_brain_sweep, c.rgb, heat, zn, r.w, 0.0, t);
    c.a *= 0.85 + 0.15 * sin(t * 0.7 + r.y * 30.0);
  } else if (w >= 0.0 && w < 2500.0) {
    float lid = floor(w), s = w - lid;
    float heat = texture2D(u_brain_lheat, vec2((lid + 0.5) / 2048.0, 0.5)).r;
    float wave = bc_wave(s, bh_h(lid + 0.31), t);
    c.rgb = bc(u_brain_mode, u_brain_sweep, c.rgb, heat, zn, bh_h(lid), wave, t);
    float p = bh_pulse(d, t);
    c.rgb = mix(c.rgb, vec3(1.0, 0.98, 0.92), clamp(p * 0.8, 0.0, 1.0));
    c.a *= (1.0 + 6.0 * p) * (0.7 + 0.9 * wave);
    c.a *= 0.8 + 0.2 * sin(t * 0.6 + lid * 0.37);
  } else if (w < 0.0 && w > -2.1 && w <= -0.9) {
    float heat = pow(clamp(-w - 1.0, 0.0, 1.0), 0.42);
    c.rgb = bc(u_brain_mode, u_brain_sweep, c.rgb, heat, zn, r.w, 0.35 * pow(0.5 + 0.5 * sin(t * 1.3 + r.w * 40.0), 6.0), t);
    c.a *= 0.8 + 0.2 * sin(t * 1.7 + r.x * 30.0);
  } else if (w < 0.0 && w > -0.3) {
    c.rgb = bc(u_brain_mode, u_brain_sweep, c.rgb, 0.5, zn, r.w, 0.0, t);
  } else if (w <= -2.9 && w > -3.6) {
    c.a *= 0.85 + 0.15 * sin(t * 2.1 + r.y * 20.0);
  }
  return c;
}`,
  camera: { pos: [0, 0.6, 11.2], target: [0, -0.1, 0], fov: 35 },
  pointSize: 1.8,
  drift: 0.015,
  update() {
    uniforms.u_brain_mode.value.set(brainMode.cur, brainMode.prev)
    uniforms.u_brain_sweep.value = brainMode.sweep()
  },
}
export default form
