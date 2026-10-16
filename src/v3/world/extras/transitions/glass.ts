// SET PIECE 4: the glass shell breaks.  leg mind > school  (w12 re-key; was mind > secretary).
// The brain's glass globe is rebuilt as ~90 shards (a spherical Voronoi of the shell, each shard a little solid with thickness and walls).
// A crack runs round the shell from a point facing the camera and the etching pulses; then the shell bursts: every shard leaves on its own
// ballistic arc (shock delay by distance from the impact, outward + away-from-impact + upward velocity, gravity, a spin that decays, one
// bounce off the mirror floor), tumbling and catching light (a procedural studio reflected by each shard's own rotating normal, rim light on
// its edges). All of it is evaluated in the vertex shader as a closed-form function of the leg's progress, so scrubbing back flies the
// shards home and the crack closes. The particle field streams on to the UChicago form (the next stop round the ring, Education) as the shell goes: the camera holds the brain
// for the burst, then the flight carries it the short way round the ring to the school.
import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, clamp01, lerp, precompile, rng, sstep } from './common'

const SHARDS = 80
const THICK = 0.055          // shell thickness in radii
const FLOOR_Y = -6.6         // the mirror floor

const VERT = /* glsl */ `
attribute vec3 aCent; attribute vec4 aRnd; attribute vec3 aAx; attribute float aEdge;
uniform float uTau, uR, uG, uFloor; uniform vec3 uImp;
varying vec3 vRest; varying vec3 vWN; varying vec3 vWP; varying float vEdge; varying vec4 vRnd; varying float vMoved; varying float vOuter;
mat3 rotAxis(vec3 a, float t) {
  float s = sin(t), c = cos(t), k = 1.0 - c;
  return mat3(c + a.x * a.x * k, a.x * a.y * k + a.z * s, a.x * a.z * k - a.y * s,
              a.x * a.y * k - a.z * s, c + a.y * a.y * k, a.y * a.z * k + a.x * s,
              a.x * a.z * k + a.y * s, a.y * a.z * k - a.x * s, c + a.z * a.z * k);
}
void main() {
  vec3 c = aCent; vec3 dir = normalize(c + vec3(1e-5));
  float tau = max(0.0, uTau - aRnd.x);
  vec3 away = normalize(c - uImp * 0.96 + vec3(1e-4));
  vec3 v = dir * (0.8 + 1.7 * aRnd.y) + away * (0.6 + 0.7 * aRnd.z) + vec3(0.0, 0.8 + 1.0 * aRnd.z, 0.0) + aAx * 0.3;
  vec3 d = v * tau;
  float y0 = c.y, y = y0 + v.y * tau - 0.5 * uG * tau * tau;
  if (y < uFloor && tau > 0.0) {
    float t1 = (v.y + sqrt(max(v.y * v.y + 2.0 * uG * (y0 - uFloor), 0.0))) / uG;
    float vy1 = -0.3 * (v.y - uG * t1), t2 = max(0.0, tau - t1);
    y = max(uFloor + vy1 * t2 - 0.5 * uG * t2 * t2, uFloor);
    d.xz *= 1.0 - 0.45 * smoothstep(t1, t1 + 0.6, tau);
  }
  d.y = y - y0;
  float ang = (2.5 + 8.0 * aRnd.w) * 0.8 * (1.0 - exp(-tau / 0.8)) * 1.2;
  mat3 R = rotAxis(normalize(aAx), ang);
  vec3 local = R * position;
  vec3 p = (c + d + local) * uR;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * (R * normal)); vRest = c + position; vEdge = aEdge; vRnd = aRnd; vMoved = smoothstep(0.0, 0.05, tau);
  float od = dot(normal, normalize(c + position)); vOuter = od > 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSeed[${SHARDS}]; uniform vec3 uImp; uniform float uCrack, uShow, uFlash, uFade, uTime, uCrackFade; uniform vec3 uTint;
varying vec3 vRest; varying vec3 vWN; varying vec3 vWP; varying float vEdge; varying vec4 vRnd; varying float vMoved; varying float vOuter;
float h(float x) { return fract(sin(x * 91.3) * 43758.5); }
vec3 studio(vec3 R, float seed) {
  vec3 col = mix(vec3(0.01, 0.014, 0.03), vec3(0.08, 0.12, 0.22), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 k1 = normalize(vec3(-0.5, 0.75, 0.45)), k2 = normalize(vec3(0.8, 0.25, -0.5)), k3 = normalize(vec3(0.0, -0.5, 0.85));
  col += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, k1), 0.0), 18.0) * 2.4;
  col += vec3(1.0, 0.72, 0.45) * pow(max(dot(R, k2), 0.0), 10.0) * 1.2;
  col += vec3(0.4, 0.7, 1.0) * pow(max(dot(R, k3), 0.0), 6.0) * 0.5;
  col += vec3(1.0) * smoothstep(0.93, 0.99, sin(R.x * 7.0 + seed * 20.0) * sin(R.y * 5.0 + seed * 11.0)) * 0.6;   // window-pane sweeps
  return col;
}
void main() {
  vec3 V = normalize(cameraPosition - vWP);
  vec3 N0 = normalize(vWN), N = dot(N0, V) < 0.0 ? -N0 : N0;
  float ndv = max(dot(N, V), 0.0), fres = pow(1.0 - ndv, 3.0);
  vec3 R = reflect(-V, N);
  vec3 rest = normalize(vRest);
  // ---- cracks: thin lines on the borders of the Voronoi cells (nearest vs second nearest seed), growing out of the impact point
  float d1 = 9.0, d2 = 9.0;
  if (uCrackFade > 0.001) for (int i = 0; i < ${SHARDS}; i++) { float d = distance(rest, uSeed[i]); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  float edgeD = (d2 - d1) * 0.5;
  float ang = acos(clamp(dot(rest, uImp), -1.0, 1.0));
  float front = uCrack * 3.6;
  float inside = smoothstep(front, front - 0.35, ang);
  float hot0 = exp(-max(front - ang, 0.0) * 3.2);
  float lineW = 0.0026 + 0.0016 * hot0;
  float line = (1.0 - smoothstep(lineW, lineW * 2.6, edgeD)) * inside * vOuter * step(0.12, dot(N0, V));
  float hot = exp(-max(front - ang, 0.0) * 3.2);                      // the crack tip burns brightest
  vec3 crackC = mix(vec3(0.45, 0.72, 1.0), vec3(1.0, 0.95, 0.85), hot) * (0.5 + 1.5 * hot) * line * uCrackFade;
  // ---- the glass of the shards (only once they have left: before that the original globe is still drawn): clear body, bright rims, studio glints
  float rim = (1.0 - smoothstep(0.0, 0.2, vEdge));
  vec3 env = studio(R, vRnd.z);
  float glint = clamp(dot(env, vec3(0.33)) - 0.12, 0.0, 3.0);
  vec3 glassE = env * (0.05 + 0.8 * fres) * uTint * 0.45 + uTint * rim * (0.12 + 0.3 * fres) + vec3(0.8, 0.95, 1.0) * glint * 0.3;
  glassE += vec3(1.0, 0.95, 0.85) * uFlash * (0.15 + rim) * (1.0 - vMoved * 0.6);
  float glassA = clamp(0.05 + 0.3 * fres + rim * 0.22 + glint * 0.3, 0.0, 0.9);
  float calm = mix(0.3, 1.0, vMoved);
  vec3 col = crackC + glassE * uShow * calm;
  float a = clamp(max(glassA * uShow * calm, line * 0.8 * uCrackFade), 0.0, 1.0);
  col *= 1.0 - uFade; a *= 1.0 - uFade;
  gl_FragColor = vec4(col, a);
}`

/** a spherical Voronoi of the shell: the cells are the shards, straight-edged polygons (convex hull of the seeds -> circumcentres -> one polygon per seed) */
function buildShards(rand: () => number, imp: THREE.Vector3) {
  const seeds: THREE.Vector3[] = []
  for (let i = 0; i < SHARDS; i++) {
    const y = 1 - (2 * (i + 0.5)) / SHARDS, r = Math.sqrt(1 - y * y), a = i * 2.399963
    const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    p.add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.2)).normalize(); seeds.push(p)
  }
  const hull = new ConvexGeometry(seeds), hp = hull.getAttribute('position') as THREE.BufferAttribute
  const key = (x: number, y: number, z: number) => `${Math.round(x * 1e4)}_${Math.round(y * 1e4)}_${Math.round(z * 1e4)}`
  const idxOf = new Map<string, number>(); seeds.forEach((v, i) => idxOf.set(key(v.x, v.y, v.z), i))
  const around: THREE.Vector3[][] = Array.from({ length: SHARDS }, () => [])
  for (let f = 0; f < hp.count; f += 3) {
    const V = [0, 1, 2].map(k => new THREE.Vector3(hp.getX(f + k), hp.getY(f + k), hp.getZ(f + k)))
    const n = V[1].clone().sub(V[0]).cross(V[2].clone().sub(V[0])).normalize()
    if (n.dot(V[0].clone().add(V[1]).add(V[2])) < 0) n.negate()
    for (const v of V) { const i = idxOf.get(key(v.x, v.y, v.z)); if (i != null) around[i].push(n) }
  }
  const out = { p: [] as number[], n: [] as number[], c: [] as number[], r: [] as number[], a: [] as number[], e: [] as number[] }
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Vector3, r: number[], ax: THREE.Vector3, e: number) => {
    out.p.push(p.x - c.x, p.y - c.y, p.z - c.z); out.n.push(n.x, n.y, n.z); out.c.push(c.x, c.y, c.z); out.r.push(r[0], r[1], r[2], r[3]); out.a.push(ax.x, ax.y, ax.z); out.e.push(e)
  }
  const inner = 1 - THICK, NS = 3
  const tmpN = new THREE.Vector3()
  for (let s = 0; s < SHARDS; s++) {
    const S = seeds[s], poly = around[s]
    if (poly.length < 3) continue
    // order the circumcentres round the seed
    const e1 = new THREE.Vector3(0, 1, 0); if (Math.abs(S.y) > 0.9) e1.set(1, 0, 0)
    e1.sub(S.clone().multiplyScalar(e1.dot(S))).normalize(); const e2 = S.clone().cross(e1)
    poly.sort((a, b) => Math.atan2(a.dot(e2), a.dot(e1)) - Math.atan2(b.dot(e2), b.dot(e1)))
    const c = S.clone().multiplyScalar(1 - THICK / 2)
    const ang = Math.acos(Math.max(-1, Math.min(1, S.dot(imp))))
    const r = [clamp01(ang / Math.PI) * 0.34 + rand() * 0.03, rand(), rand(), rand()]
    const ax = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()
    const k = poly.length
    // outer + inner fans, each fan triangle subdivided NS x NS and projected onto the sphere
    const grid = (A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3) => {
      const pts: { p: THREE.Vector3; e: number }[][] = []
      for (let i = 0; i <= NS; i++) {
        const row: { p: THREE.Vector3; e: number }[] = []
        for (let j = 0; j <= NS - i; j++) {
          const a = (NS - i - j) / NS, b = i / NS, cc = j / NS
          row.push({ p: A.clone().multiplyScalar(a).addScaledVector(B, b).addScaledVector(C, cc).normalize(), e: a })
        }
        pts.push(row)
      }
      return pts
    }
    for (let q = 0; q < k; q++) {
      const B = poly[q], C = poly[(q + 1) % k], G = grid(S, B, C)
      const tri = (p0: { p: THREE.Vector3; e: number }, p1: typeof p0, p2: typeof p0) => {
        for (const [pp, scale, flip] of [[[p0, p1, p2], 1, false], [[p0, p2, p1], inner, true]] as [typeof p0[], number, boolean][]) for (const v of pp) {
          tmpN.copy(v.p); if (flip) tmpN.negate()
          push(v.p.clone().multiplyScalar(scale), tmpN.clone(), c, r, ax, v.e)
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NS - i; j++) {
        tri(G[i][j], G[i + 1][j], G[i][j + 1])
        if (j < NS - i - 1) tri(G[i + 1][j], G[i + 1][j + 1], G[i][j + 1])
      }
      // wall along the polygon edge B-C (G[NS-j][j] runs from B to C along the outside of the fan triangle)
      for (let j = 0; j < NS; j++) {
        const o0 = G[NS - j][j].p, o1 = G[NS - j - 1][j + 1].p, i0 = o0.clone().multiplyScalar(inner), i1 = o1.clone().multiplyScalar(inner)
        tmpN.copy(o1).sub(o0).cross(i0.clone().sub(o0)).normalize()
        const away = o0.clone().add(o1).multiplyScalar(0.5).sub(c); if (tmpN.dot(away) < 0) tmpN.negate()
        for (const qv of [o0, o1, i1, o0, i1, i0]) push(qv, tmpN.clone(), c, r, ax, 0)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3))
  g.setAttribute('aCent', new THREE.Float32BufferAttribute(out.c, 3)); g.setAttribute('aRnd', new THREE.Float32BufferAttribute(out.r, 4))
  g.setAttribute('aAx', new THREE.Float32BufferAttribute(out.a, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(out.e, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30)
  return { geo: g, seeds }
}

export function createGlass(leg: Leg): Piece {
  let built = false
  const group = new THREE.Group(); group.name = 'tr-glass'
  let mesh: THREE.Mesh | null = null
  const U = {
    uSeed: { value: [] as THREE.Vector3[] }, uImp: { value: new THREE.Vector3(0, 0, 1) }, uCrack: { value: 0 }, uShow: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 },
    uTime: { value: 0 }, uCrackFade: { value: 1 }, uTau: { value: 0 }, uR: { value: 2.7 }, uG: { value: 3.4 }, uFloor: { value: -3 }, uTint: { value: new THREE.Color(0.55, 0.78, 1.0) },
  }
  let glassMeshes: THREE.Object3D[] = []
  let brainPos = new THREE.Vector3(), R = 2.7
  const BURST = 0.3, T_SPAN = 3.0
  const tauOf = (u: number) => Math.max(0, u - BURST) * T_SPAN

  const piece: Piece = {
    leg,
    cues: [{ at: 0.1, name: 'tr:crack' }, { at: BURST, name: 'tr:shatter' }],
    build(env) {
      if (built) return
      built = true
      const brain = env.world?.brain
      if (!brain) return
      brainPos.copy(brain.group.position); R = brain.radius
      const S = env.flightCam(0)
      const toCam = new THREE.Vector3(S.pos[0] - brainPos.x, S.pos[1] - brainPos.y, S.pos[2] - brainPos.z).normalize()
      const right = new THREE.Vector3(0, 1, 0).cross(toCam).normalize()
      const imp = toCam.clone().add(right.multiplyScalar(0.34)).add(new THREE.Vector3(0, 0.5, 0)).normalize()
      U.uImp.value.copy(imp)
      const { geo, seeds } = buildShards(rng(2718), imp)
      U.uSeed.value = seeds
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms: U as unknown as Record<string, THREE.IUniform>, transparent: true, depthWrite: false, depthTest: true,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide,
      })
      mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 45
      group.add(mesh); group.visible = false
      if (!env.q.reflect) group.userData.noReflect = true
      env.scene.add(group)
      brain.group.traverse((o: THREE.Object3D) => { if (o.name === 'brain-glass-back' || o.name === 'brain-glass-front') glassMeshes.push(o) })
      precompile(env, group)
    },
    setVisible(v, env) {
      group.visible = v && !!mesh
      if (!v) for (const o of glassMeshes) o.visible = true
      void env
    },
    frame(inp: FrameIn, out: FrameOut, env: Env) {
      const { u, t } = inp
      const brain = env.world?.brain
      out.field = 1
      if (!mesh || !brain) return
      brainPos.copy(brain.group.position)
      R = brain.radius * brain.group.scale.x * 1.008
      group.position.copy(brainPos)
      U.uR.value = R; U.uTime.value = t
      U.uFloor.value = (FLOOR_Y - brainPos.y) / R
      U.uG.value = 3.1
      const crack = sstep(0.02, BURST, u)
      U.uCrack.value = crack
      U.uTau.value = tauOf(u)
      const burst = u >= BURST
      // before the burst: only the cracks (and a faint sheen) over the original glass; after: the shards are the glass
      U.uShow.value = burst ? 1 : 0.0
      U.uFlash.value = Math.exp(-tauOf(u) / 0.1) * (burst ? 0.5 : 0)
      U.uCrackFade.value = 1 - sstep(BURST, BURST + 0.12, u)
      U.uFade.value = sstep(0.8, 0.98, u)
      for (const o of glassMeshes) o.visible = !burst
      group.visible = u > 0.02 && u < 0.99
    },
    camera(u, base, env) {
      if (!mesh) return null
      // hold the opening pose (a slow push-in on the brain) while the shell cracks and bursts, then hand the camera back to the flight
      const S = env.flightCam(0)
      const w = 1 - sstep(0.34, 0.72, u)
      const push = 0.1 * sstep(0, 0.3, u), tau = tauOf(u), amp = Math.exp(-tau / 0.16) * 0.06 * (u >= BURST ? 1 : 0)
      const dx = brainPos.x - S.pos[0], dy = brainPos.y - S.pos[1], dz = brainPos.z - S.pos[2]
      const hold: CamPose = { pos: [S.pos[0] + dx * push + Math.sin(tau * 71) * amp, S.pos[1] + dy * push + Math.cos(tau * 83) * amp, S.pos[2] + dz * push], target: [S.target[0], S.target[1], S.target[2]], fov: S.fov - 1.5 * Math.exp(-tau / 0.2) * (u >= BURST ? 1 : 0) }
      return { pos: [lerp(base.pos[0], hold.pos[0], w), lerp(base.pos[1], hold.pos[1], w), lerp(base.pos[2], hold.pos[2], w)], target: [lerp(base.target[0], hold.target[0], w), lerp(base.target[1], hold.target[1], w), lerp(base.target[2], hold.target[2], w)], fov: lerp(base.fov, hold.fov, w) }
    },
    dispose() { group.removeFromParent() },
  }
  return piece
}
