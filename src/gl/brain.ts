// The glass brain (concept 3.3, 4.2, 4.3): a clear glass globe with the vault's link graph
// laser-etched inside it. From the front the etching reads as the 2D graph; turned, the folders
// separate into stacked strata. A vermilion core sits at the centre. pulse() sends a BFS hop wave
// along the real links; focusFolder() fades the other folders to 15%.
//
// Draw calls: far wall, links, nodes, halos, near wall = 5.
import {
  BufferAttribute, BufferGeometry, Color, CustomBlending, BackSide, FrontSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, LineSegments, Mesh, Object3D, OneFactor,
  OneMinusSrcAlphaFactor, PlaneGeometry, Points, ShaderMaterial, SphereGeometry, Vector2, Vector3, Vector4,
  type Camera, type Texture,
} from 'three'
import { graph } from '../data'
import { DAY, NIGHT } from '../theme'
import { state } from '../state'
import { createGlassMaterial, type GlassMaterial } from './glassMaterial'
import { loadBrainMesh, layoutVault, linkControl, poseVec, regionAt, FOLDER_REGION, REGIONS } from './brainShape'
import { brainMode, OBSIDIAN_COLORS, MODE_NAMES } from './brainColor'
import { etchNodes, etchLinks, shellMaterial } from './brainEtch'

export interface Brain {
  group: Group
  update(dt: number, t: number): void
  pulse(fromNode?: number): void
  focusFolder(i: number | null): void
  setNight(night: boolean): void
  setTurn(yaw: number, pitch: number): void
  corePoint(): Vector3
  dispose(): void
  /** extras */
  pick(ndc: Vector2, camera: Camera, maxPx?: number, viewportH?: number): BrainPick | null
  /** pulse from the etched node nearest a world point (a capsule's entry port) */
  pulseAt(world: Vector3): void
  /** folder names in stratum order and their note counts (from brain-graph.json) */
  folders: { name: string; count: number }[]
  /** pass through capsule glow to both glass walls (same layout as GlassMaterial.setGlow) */
  setGlow(caps: Float32Array): void
  /** anatomical brain only: colour mode (0 folders, 1 thermal, 2 ivory, 3 spectral; see brainColor.ts). The state is shared with the particle form. */
  setMode?(m: number, instant?: boolean): void
  nextMode?(): void
  readonly mode?: number
  /** the world position of the brain's outline centre and its half-size, for click tests */
  readonly anatomical?: boolean
}
export interface BrainPick { index: number; folder: string; degree: number; world: Vector3 }

const SLOTS = 4
const GROUPS = 10

// ------------------------------------------------------------------ helpers
const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const lin = (hex: string) => new Color(hex)

const etchCommon = /* glsl */ `
uniform vec4 uPulseT;
uniform vec4 uPulseA;
uniform float uGroupAlpha[${GROUPS}];
uniform float uSpread;
uniform float uNight;
uniform float uCenterZ;
uniform float uFocus;
uniform float uK;
uniform vec3 uGroupColor[${GROUPS}];
attribute vec4 aHop;
attribute float aGroup;
float pulseAt(vec4 hop) {
  float p = 0.0;
  for (int k = 0; k < ${SLOTS}; k++) {
    float h = hop[k];
    float t = uPulseT[k];
    float front = exp(-pow(h - t, 2.0) * 2.0);
    float tail = h < t ? exp(-(t - h) * 0.75) * 0.42 : 0.0;
    p = max(p, (front + tail) * uPulseA[k]);
  }
  return clamp(p, 0.0, 1.0);
}
vec3 strata(vec3 p) { return vec3(p.xy, p.z * uSpread); }
float isFocus() { return uFocus >= 0.0 && abs(aGroup - uFocus) < 0.5 ? 1.0 : 0.0; }
float depthFade(vec4 mv) { return mix(0.5, 1.0, smoothstep(-0.42, 0.36, (mv.z - uCenterZ) / uK)); }
`

const etchFrag = /* glsl */ `
uniform float uFolderK;
varying vec3 vGC;
uniform vec3 uEtch;
uniform vec3 uEtchNight;
uniform vec3 uBrain;
uniform float uNight;
vec4 premul(vec3 lin, float a, float add) {
  vec3 enc = linearToOutputTexel(vec4(max(lin, 0.0), 1.0)).rgb;
  return vec4(enc * a, a * (1.0 - add));
}
`

function etchMaterial(kind: 'points' | 'lines', dpr: number): ShaderMaterial {
  const uniforms = {
    uPulseT: { value: new Vector4() },
    uPulseA: { value: new Vector4() },
    uGroupAlpha: { value: new Array(GROUPS).fill(1) },
    uSpread: { value: 1 },
    uNight: { value: 0 },
    uCenterZ: { value: -3 },
    uEtch: { value: lin(DAY.ink) },
    uEtchNight: { value: lin('#FFFFFF') },
    uBrain: { value: lin(DAY.brain) },
    uDpr: { value: dpr },
    uScale: { value: 4.4 },
    uRing: { value: 0.2 },
    uFocus: { value: -1 },
    uK: { value: 1 },
    uFolderK: { value: 0 },
    uGroupColor: { value: Array.from({ length: GROUPS }, () => new Color('#9aa3a8')) },
  }
  const vertexShader = kind === 'points' ? /* glsl */ `
    ${etchCommon}
    uniform float uDpr;
    uniform float uScale;
    attribute float aDegree;
    varying float vP;
    varying float vA;
    varying float vHub;
    varying float vSize;
    varying vec3 vGC;
    void main() {
      vec4 mv = modelViewMatrix * vec4(strata(position), 1.0);
      gl_Position = projectionMatrix * mv;
      float p = pulseAt(aHop);
      vP = p;
      vGC = uGroupColor[int(aGroup + 0.5)];
      float g = uGroupAlpha[int(aGroup + 0.5)];
      vA = g * depthFade(mv);
      vHub = smoothstep(14.0, 30.0, aDegree);
      float s = (1.5 + 1.1 * sqrt(aDegree)) * uDpr * uScale / -mv.z;
      s *= (1.0 + p * 0.55) * (1.0 + 0.35 * isFocus());
      vA *= 1.0 + 0.25 * isFocus();
      vSize = s;
      gl_PointSize = clamp(s, 1.0, 64.0);
    }` : /* glsl */ `
    ${etchCommon}
    uniform float uRing;
    attribute float aKind;
    varying float vP;
    varying float vA;
    varying vec3 vGC;
    void main() {
      vec4 mv = modelViewMatrix * vec4(strata(position), 1.0);
      gl_Position = projectionMatrix * mv;
      vP = pulseAt(aHop);
      vGC = uGroupColor[int(aGroup + 0.5)];
      vA = uGroupAlpha[int(aGroup + 0.5)] * depthFade(mv) * mix(1.0 + 1.6 * isFocus(), uRing, aKind);
    }`
  const fragmentShader = kind === 'points' ? /* glsl */ `
    ${etchFrag}
    varying float vP;
    varying float vA;
    varying float vHub;
    varying float vSize;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float r = length(q);
      float aa = 1.2 / max(vSize, 1.0);
      float disc = 1.0 - smoothstep(0.42 - aa, 0.42 + aa * 0.5, r);
      // hubs are drawn as a technical node symbol: open ring with a centre dot
      float ring = (1.0 - smoothstep(0.46 - aa, 0.46, r)) * smoothstep(0.30, 0.30 + aa * 1.5, r);
      float dot_ = 1.0 - smoothstep(0.17, 0.17 + aa * 1.5, r);
      float shape = mix(disc, max(ring, dot_), vHub);
      if (shape < 0.01) discard;
      vec3 base = mix(mix(uEtch, uEtchNight, uNight), vGC, uFolderK);
      vec3 col = mix(base, uBrain, vP);
      float a = shape * vA * mix(mix(0.92, 0.7, uNight), 1.0, vP);
      // night: the etch is light in the crystal
      gl_FragColor = premul(col * mix(1.0, 1.25, uNight), a, uNight);
    }` : /* glsl */ `
    ${etchFrag}
    varying float vP;
    varying float vA;
    void main() {
      vec3 base = mix(mix(uEtch, uEtchNight, uNight), vGC, uFolderK);
      vec3 col = mix(base, uBrain, vP);
      float a = vA * (mix(0.13, 0.10, uNight) + 0.55 * vP);
      gl_FragColor = premul(col, a, uNight);
    }`
  return new ShaderMaterial({
    name: kind === 'points' ? 'EtchPoints' : 'EtchLines',
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
  })
}

// Halos: camera-facing billboards. Day = halftone print glow + solid vermilion heart (normal
// "ink"), night = smooth additive light. Kind 0 = heart, 1 = wide glow, 2..5 = pulse rings.
function haloMaterial(dpr: number): ShaderMaterial {
  return new ShaderMaterial({
    name: 'BrainHalos',
    uniforms: {
      uNight: { value: 0 },
      uDpr: { value: dpr },
      uBrain: { value: lin(DAY.brain) },
      uBrainNight: { value: lin(NIGHT.brain) },
      uHot: { value: lin('#FFE3C8') },
      uCore: { value: 1 },
      uRings: { value: [0, 0, 0, 0] as unknown },   // ring phase 0..1 per slot (0 = off)
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aSize;
      varying vec2 vUv;
      varying float vKind;
      void main() {
        vUv = position.xy * 2.0;             // -1..1
        vKind = aKind;
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        c.xy += position.xy * aSize;
        c.z += 0.02;                         // keep the heart in front of the etch plane
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      uniform float uDpr;
      uniform vec3 uBrain;
      uniform vec3 uBrainNight;
      uniform vec3 uHot;
      uniform float uCore;
      uniform float uRings[4];
      uniform float uTime;
      varying vec2 vUv;
      varying float vKind;
      vec4 premul(vec3 lin, float a, float add) {
        vec3 enc = linearToOutputTexel(vec4(max(lin, 0.0), 1.0)).rgb;
        return vec4(enc * a, a * (1.0 - add));
      }
      // 45 deg halftone screen in device px, dot radius from coverage
      float screen(float cov, float cellPx) {
        float cell = cellPx * uDpr;
        vec2 p = gl_FragCoord.xy;
        vec2 r = vec2(p.x + p.y, p.x - p.y) * 0.70710678 / cell;
        vec2 g = (fract(r) - 0.5) * cell;
        float d = length(g);
        float rad = sqrt(clamp(cov, 0.0, 1.0)) * 0.62 * cell;
        return (1.0 - smoothstep(rad - 0.7, rad + 0.7, d)) * smoothstep(0.0, 0.06, cov);
      }
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        vec3 brain = mix(uBrain, uBrainNight, uNight);
        int k = int(vKind + 0.5);
        if (k == 0) {
          // the heart: a small vermilion sphere drawn like a technical illustration (flat shade,
          // crisp edge, one highlight), with a print-dot corona by day and real light by night
          float R0 = 0.2;
          float edge = fwidth(r) * 1.2;
          float heart = 1.0 - smoothstep(R0 - edge, R0, r);
          vec2 q = vUv / R0;
          float z = sqrt(max(1.0 - dot(q, q), 0.0));
          vec3 n = vec3(q, z);
          float lam = clamp(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);
          float spot = smoothstep(0.93, 0.97, dot(n, normalize(vec3(-0.5, 0.55, 0.67))));
          vec3 deep = brain * vec3(0.55, 0.42, 0.40);
          vec3 shaded = mix(deep, brain, smoothstep(0.05, 0.75, lam));
          shaded = mix(shaded, vec3(1.0), spot * 0.9);
          float corona = 1.0 - smoothstep(R0 * 1.05, 0.62, r);
          corona = corona * corona * (0.5 + 0.5 * uCore);
          float dots = screen(corona * 0.85, 3.6) * step(R0 + edge, r);
          vec3 dayCol = mix(brain, shaded, heart);
          float dayA = max(heart, dots * 0.95);
          float hot = exp(-r * r * 60.0);
          vec3 nightCol = mix(brain, uHot, clamp(hot * 1.6, 0.0, 1.0));
          float glowS = exp(-r * r * 10.0) * uCore;
          float nightA = clamp(heart + glowS * 0.85, 0.0, 1.0);
          vec3 col = mix(dayCol, nightCol, uNight);
          float a = mix(dayA, nightA, uNight);
          gl_FragColor = premul(col, a, uNight * 0.85 * (1.0 - heart * 0.4));
        } else if (k == 1) {
          // wide soft glow, mostly a night thing; by day a whisper of warm dots
          float g = exp(-r * r * 4.0) * (0.35 + 0.65 * uCore);
          float dayA = screen(g * 0.13 * smoothstep(0.3, 0.55, r), 4.5) * 0.45;
          float nightA = g * 0.32;
          float a = mix(dayA, nightA, uNight);
          gl_FragColor = premul(brain, a, uNight);
        } else {
          float ph = uRings[k - 2];
          if (ph <= 0.0) discard;
          float rr = ph;                      // ring radius in billboard units
          float w = 0.035 + 0.06 * ph;
          float ring = exp(-pow((r - rr) / w, 2.0)) * (1.0 - ph) * 1.2;
          float fill = (1.0 - smoothstep(0.0, 0.18, r)) * (1.0 - ph);
          float a = clamp(ring + fill * 0.8, 0.0, 1.0);
          gl_FragColor = premul(brain, a * mix(0.9, 1.0, uNight), uNight);
        }
      }`,
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
  })
}

// ------------------------------------------------------------------ factory
export interface BrainOptions {
  radius?: number
  envMap?: Texture | null
  /** colour the etched graph per vault folder: keys are graph.groups names ('10 Projects', ..., 'other') */
  folderColors?: Record<string, string>
  /** keep the etch's node size and depth fade proportional to a radius other than 0.62 (world-scale brains) */
  worldScale?: boolean
  /** v10: an anatomically shaped brain (src/gl/brainShape.ts) instead of the glass globe: lobes, fissures, gyri, cerebellum, brainstem; the vault sits in its lobes */
  anatomical?: boolean
}
export function createBrain(opts: BrainOptions = {}): Brain {
  const R = opts.radius ?? 0.62
  const ana = !!opts.anatomical
  const k = R / 0.62                       // everything below is authored at 0.62
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const group = new Group(); group.name = 'brain'
  const turn = new Group(); turn.name = 'brain-turn'
  group.add(turn)

  // ---------- data -> positions
  const nodes = graph.nodes
  const N = nodes.length
  // robust scale: the dense body of the graph fills most of the disc, outliers are eased in
  const radii = nodes.map((n) => Math.hypot(n[0], n[1])).sort((a, b) => a - b)
  const r90 = radii[Math.floor(radii.length * 0.9)] || 1
  const discR = 0.5 * k
  const soft = (r: number) => { const u = r / r90; return u <= 0.82 ? u * 0.78 : 0.78 * 0.82 + (1 - 0.78 * 0.82) * Math.tanh((u - 0.82) * 0.78 / (1 - 0.78 * 0.82)) }
  const pos = new Float32Array(N * 3)
  const deg = new Float32Array(N)
  const grp = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const [x, y, g, d] = nodes[i]
    const r = Math.hypot(x, y)
    const s = r > 1e-6 ? (soft(r) * discR) / r : 0
    pos[i * 3] = x * s
    pos[i * 3 + 1] = y * s
    pos[i * 3 + 2] = ((g - 4.5) * 0.06 + (hash(i) - 0.5) * 0.015) * k
    deg[i] = d; grp[i] = g
  }
  // anatomical: every note sits inside its folder's lobe (brainShape.layoutVault), posed and scaled to the world brain
  const SC = R * 1.06
  let unit: Float32Array = new Float32Array(0)
  if (ana) {
    unit = layoutVault(nodes as [number, number, number, number][], graph.groups)
    const t3: [number, number, number] = [0, 0, 0]
    for (let i = 0; i < N; i++) { poseVec(unit[i * 3], unit[i * 3 + 1], unit[i * 3 + 2], t3); pos[i * 3] = t3[0] * SC; pos[i * 3 + 1] = t3[1] * SC; pos[i * 3 + 2] = t3[2] * SC }
  }
  // the strata may spread apart when turned, but never through the glass
  let maxSpread = 2.2
  const lim = 0.575 * k
  for (let i = 0; i < N; i++) {
    const xy2 = pos[i * 3] ** 2 + pos[i * 3 + 1] ** 2
    const z = Math.abs(pos[i * 3 + 2])
    if (z < 1e-4) continue
    const s = Math.sqrt(Math.max(lim * lim - xy2, 0)) / z
    maxSpread = Math.min(maxSpread, s)
  }
  maxSpread = ana ? 1 : Math.max(1, maxSpread)

  const adj: number[][] = Array.from({ length: N }, () => [])
  for (const [a, b] of graph.links) { adj[a].push(b); adj[b].push(a) }
  let topNode = 0
  for (let i = 1; i < N; i++) if (deg[i] > deg[topNode]) topNode = i
  const topOfFolder = new Array<number>(GROUPS).fill(-1)
  for (let i = 0; i < N; i++) { const g = grp[i]; if (topOfFolder[g] < 0 || deg[i] > deg[topOfFolder[g]]) topOfFolder[g] = i }

  const counts = graph.stats?.folders ?? {}
  const folders = graph.groups.map((name) => ({
    name: name === 'other' ? 'Root' : name,
    count: Number(counts[name] ?? 0),
  }))

  // ---------- glass
  const sphere: BufferGeometry = ana ? new BufferGeometry() : new SphereGeometry(R, 96, 64)
  const glassOpts = {
    tint: DAY.glassTint, rim: DAY.ink, rimPower: 2.2, bodyAlpha: 0.42, rimAlpha: 0.55,
    envMap: opts.envMap ?? null, glowColor: '#FFF1E6', innerLine: 0.16, hatch: 1, caustic: 1, dpr,
  }
  const backMat = (ana ? shellMaterial(BackSide, dpr, opts.envMap ?? null) : createGlassMaterial({ ...glassOpts, side: BackSide })) as unknown as GlassMaterial
  const frontMat = (ana ? shellMaterial(FrontSide, dpr, opts.envMap ?? null) : createGlassMaterial({ ...glassOpts, side: FrontSide })) as unknown as GlassMaterial
  if (!ana) for (const m of [frontMat]) {
    m.uniforms.uCoreStrength.value = 1
    m.uniforms.uCoreRadius.value = 0.26 * k
    m.uniforms.uCoreColor.value = lin(DAY.brain)
  }
  const back = new Mesh(sphere, backMat); back.renderOrder = 10; back.name = 'brain-glass-back'
  const front = new Mesh(sphere, frontMat); front.renderOrder = 40; front.name = 'brain-glass-front'
  group.add(back, front)
  let disposed = false
  const maxDegAll = Math.max(...Array.from(deg), 1)
  const heatOf = (d: number) => Math.pow(d / maxDegAll, 0.42)
  if (ana) {
    // region tints for the glass: the colour (and mean heat) of the folder that lives in each lobe
    const fcol = opts.folderColors ?? OBSIDIAN_COLORS
    const regCol: Color[] = REGIONS.map(() => new Color('#9aa3a8')), regHeat: number[] = REGIONS.map(() => 0.4)
    const best = new Array(REGIONS.length).fill(-1)
    graph.groups.forEach((name, g) => {
      const r = FOLDER_REGION[name]; const n = folders[g]?.count ?? 0
      if (r == null || n <= best[r]) return
      best[r] = n
      regCol[r] = new Color(fcol[name] ?? fcol.other ?? '#9aa3a8')
      let sum = 0, c = 0; for (let i = 0; i < N; i++) if (grp[i] === g) { sum += heatOf(deg[i]); c++ }
      regHeat[r] = c ? Math.min(1, (sum / c) * 1.5) : 0.3
    })
    ;(frontMat as unknown as { setRegionColors(c: Color[], h: number[]): void }).setRegionColors(regCol, regHeat)
    ;(backMat as unknown as { setRegionColors(c: Color[], h: number[]): void }).setRegionColors(regCol, regHeat)
    // the cortex mesh (baked brain.bin, shared with the particle form), posed and scaled like the notes
    void loadBrainMesh().then(m => {
      if (disposed) return
      const nv = m.pos.length / 3
      const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Zn = new Float32Array(nv), t3: [number, number, number] = [0, 0, 0]
      for (let i = 0; i < nv; i++) {
        poseVec(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2], t3); P[i * 3] = t3[0] * SC; P[i * 3 + 1] = t3[1] * SC; P[i * 3 + 2] = t3[2] * SC
        poseVec(m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2], t3); Nn[i * 3] = t3[0]; Nn[i * 3 + 1] = t3[1]; Nn[i * 3 + 2] = t3[2]
        Zn[i] = m.pos[i * 3 + 2] * 0.5 + 0.5
      }
      sphere.setAttribute('position', new Float32BufferAttribute(P, 3)); sphere.setAttribute('normal', new Float32BufferAttribute(Nn, 3))
      sphere.setAttribute('aFold', new Float32BufferAttribute(m.fold, 1)); sphere.setAttribute('aRegion', new Float32BufferAttribute(Float32Array.from(m.region), 1))
      sphere.setAttribute('aZn', new Float32BufferAttribute(Zn, 1))
      sphere.setIndex(new BufferAttribute(m.idx, 1))
      sphere.computeBoundingSphere()
    })
  }

  // ---------- etched nodes
  const hopPts = new Float32Array(N * 4).fill(1e3)
  const pGeo = new BufferGeometry()
  pGeo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  pGeo.setAttribute('aDegree', new Float32BufferAttribute(deg, 1))
  pGeo.setAttribute('aGroup', new Float32BufferAttribute(grp, 1))
  const aHopP = new BufferAttribute(hopPts, 4); pGeo.setAttribute('aHop', aHopP)
  if (ana) {
    pGeo.setAttribute('aHeat', new Float32BufferAttribute(Float32Array.from(deg, heatOf), 1))
    pGeo.setAttribute('aZn', new Float32BufferAttribute(Float32Array.from({ length: N }, (_, i) => unit[i * 3 + 2] * 0.5 + 0.5), 1))
    pGeo.setAttribute('aPh', new Float32BufferAttribute(Float32Array.from({ length: N }, (_, i) => hash(i + 0.5)), 1))
  } else pGeo.boundingSphere = sphere.boundingSphere?.clone() ?? null
  const pMat = ana ? etchNodes(dpr) : etchMaterial('points', dpr)
  const points = new Points(pGeo, pMat); points.renderOrder = 30; points.name = 'brain-etch-nodes'
  points.frustumCulled = false

  // ---------- etched links (the globe adds one hairline ring per folder stratum in the same draw call; the anatomical brain draws each link as a curved chain)
  const L = graph.links.length
  const SEG = 8
  const RING_SEG = 120
  const ringGroups = ana ? [] : folders.map((f, g) => (f.count > 0 ? g : -1)).filter((g) => g >= 0)
  const RV = ringGroups.length * RING_SEG * 2
  const V = ana ? L * SEG * 2 : L * 2 + RV
  const lPos = new Float32Array(V * 3)
  const lGrp = new Float32Array(V)
  const lKind = new Float32Array(ana ? 0 : V)
  const hopLines = new Float32Array(V * 4).fill(1e3)
  const lGeo = new BufferGeometry()
  if (ana) {
    const lGrpB = new Float32Array(V), lS = new Float32Array(V), lHeat = new Float32Array(V), lZn = new Float32Array(V), lPh = new Float32Array(V)
    const t3: [number, number, number] = [0, 0, 0]
    graph.links.forEach(([a, b], j) => {
      const A: [number, number, number] = [unit[a * 3], unit[a * 3 + 1], unit[a * 3 + 2]], B: [number, number, number] = [unit[b * 3], unit[b * 3 + 1], unit[b * 3 + 2]]
      const C = linkControl(A, B, grp[a] !== grp[b], hash(j * 1.7 + 0.2))
      const ph = hash(j + 0.31), ha = heatOf(deg[a]), hb = heatOf(deg[b])
      for (let sg = 0; sg < SEG; sg++) for (let e = 0; e < 2; e++) {
        const s1 = (sg + e) / SEG, u = 1 - s1, vi = (j * SEG + sg) * 2 + e
        const x = u * u * A[0] + 2 * u * s1 * C[0] + s1 * s1 * B[0], y = u * u * A[1] + 2 * u * s1 * C[1] + s1 * s1 * B[1], z = u * u * A[2] + 2 * u * s1 * C[2] + s1 * s1 * B[2]
        poseVec(x, y, z, t3)
        lPos[vi * 3] = t3[0] * SC; lPos[vi * 3 + 1] = t3[1] * SC; lPos[vi * 3 + 2] = t3[2] * SC
        lGrp[vi] = grp[a]; lGrpB[vi] = grp[b]; lS[vi] = s1; lHeat[vi] = ha + (hb - ha) * s1; lZn[vi] = z * 0.5 + 0.5; lPh[vi] = ph
      }
    })
    lGeo.setAttribute('position', new Float32BufferAttribute(lPos, 3))
    lGeo.setAttribute('aGroup', new Float32BufferAttribute(lGrp, 1)); lGeo.setAttribute('aGroupB', new Float32BufferAttribute(lGrpB, 1))
    lGeo.setAttribute('aS', new Float32BufferAttribute(lS, 1)); lGeo.setAttribute('aHeat', new Float32BufferAttribute(lHeat, 1))
    lGeo.setAttribute('aZn', new Float32BufferAttribute(lZn, 1)); lGeo.setAttribute('aPh', new Float32BufferAttribute(lPh, 1))
  } else {
    graph.links.forEach(([a, b], j) => {
      lPos.set(pos.subarray(a * 3, a * 3 + 3), j * 6)
      lPos.set(pos.subarray(b * 3, b * 3 + 3), j * 6 + 3)
      lGrp[j * 2] = grp[a]; lGrp[j * 2 + 1] = grp[b]
    })
    const ringR = discR * 1.04
    let vi = L * 2
    for (const g of ringGroups) {
      const z = (g - 4.5) * 0.06 * k
      for (let s2 = 0; s2 < RING_SEG; s2++) {
        for (const e of [s2, s2 + 1]) {
          const a = (e / RING_SEG) * Math.PI * 2
          lPos[vi * 3] = Math.cos(a) * ringR; lPos[vi * 3 + 1] = Math.sin(a) * ringR; lPos[vi * 3 + 2] = z
          lGrp[vi] = g; lKind[vi] = 1; vi++
        }
      }
    }
    lGeo.setAttribute('position', new Float32BufferAttribute(lPos, 3))
    lGeo.setAttribute('aGroup', new Float32BufferAttribute(lGrp, 1))
    lGeo.setAttribute('aKind', new Float32BufferAttribute(lKind, 1))
  }
  const aHopL = new BufferAttribute(hopLines, 4); lGeo.setAttribute('aHop', aHopL)
  const lMat = ana ? etchLinks(dpr) : etchMaterial('lines', dpr)
  if (opts.worldScale || ana) { for (const m of [pMat, lMat]) m.uniforms.uK.value = k; pMat.uniforms.uScale.value = 4.4 * k }
  if (opts.folderColors) {
    const fc = opts.folderColors
    const cols = graph.groups.map((name) => new Color(fc[name] ?? fc.other ?? '#9aa3a8'))
    for (const m of [pMat, lMat]) { m.uniforms.uGroupColor.value = cols; if (!ana) m.uniforms.uFolderK.value = 1 }
  }
  const lines = new LineSegments(lGeo, lMat); lines.renderOrder = 20; lines.name = 'brain-etch-links'
  lines.frustumCulled = false
  turn.add(lines, points)

  // ---------- halos (fake bloom)
  const haloGeo = new PlaneGeometry(1, 1)
  const HALOS = 2 + SLOTS
  const kinds = new Float32Array(HALOS), sizes = new Float32Array(HALOS)
  kinds[0] = 0; sizes[0] = 0.5 * k    // heart: solid radius 0.2 * 0.25 = 0.05
  kinds[1] = 1; sizes[1] = 1.5 * k
  for (let s = 0; s < SLOTS; s++) { kinds[2 + s] = 2 + s; sizes[2 + s] = 0.34 * k }
  haloGeo.setAttribute('aKind', new InstancedBufferAttribute(kinds, 1))
  haloGeo.setAttribute('aSize', new InstancedBufferAttribute(sizes, 1))
  const hMat = haloMaterial(dpr)
  const halos = new InstancedMesh(haloGeo, hMat, HALOS); halos.renderOrder = 35; halos.name = 'brain-halos'
  halos.frustumCulled = false
  const dummy = new Object3D()
  for (let i = 0; i < HALOS; i++) { dummy.position.set(0, 0, 0); dummy.updateMatrix(); halos.setMatrixAt(i, dummy.matrix) }
  // the heart and its glow live in the (unturned) group so they stay centred; rings ride the etch
  const coreHalos = halos
  turn.add(coreHalos)

  // ---------- state
  const pulseT = [0, 0, 0, 0]
  const pulseA = [0, 0, 0, 0]
  const pulseOrigin = [-1, -1, -1, -1]
  const pulseMax = [8, 8, 8, 8]
  const ringPh = [0, 0, 0, 0]
  let slot = 0
  let corePulse = 0
  const groupAlpha = new Array(GROUPS).fill(1)
  const groupTarget = new Array(GROUPS).fill(1)
  let nightK = 0, nightTarget = 0
  let yawIn = 0, pitchIn = 0          // driven by setTurn
  let yaw = 0, pitch = 0, vyaw = 0, vpitch = 0
  let focusYaw = 0, focusPitch = 0
  let idleT = 0
  let spread = 1, spreadTarget = 1
  let focused: number | null = null

  const bfs = (from: number): { hop: Int32Array; max: number } => {
    const hop = new Int32Array(N).fill(-1)
    const q = new Int32Array(N); let h = 0, t = 0
    hop[from] = 0; q[t++] = from
    let max = 0
    while (h < t) {
      const u = q[h++]
      for (const v of adj[u]) if (hop[v] < 0) { hop[v] = hop[u] + 1; max = Math.max(max, hop[v]); q[t++] = v }
    }
    return { hop, max }
  }

  function pulse(fromNode?: number) {
    const from = fromNode != null && fromNode >= 0 && fromNode < N ? fromNode : topNode
    const { hop, max } = bfs(from)
    const s = slot; slot = (slot + 1) % SLOTS
    for (let i = 0; i < N; i++) hopPts[i * 4 + s] = hop[i] < 0 ? 1e3 : hop[i]
    if (ana) {
      // each link is a chain of segments: the hop value runs along it, so the wave visibly travels down the strand
      graph.links.forEach(([a, b], j) => {
        const ok = hop[a] >= 0 && hop[b] >= 0
        for (let sg = 0; sg < SEG; sg++) for (let e = 0; e < 2; e++) {
          const t = (sg + e) / SEG
          hopLines[((j * SEG + sg) * 2 + e) * 4 + s] = ok ? hop[a] + (hop[b] - hop[a]) * t : 1e3
        }
      })
    } else graph.links.forEach(([a, b], j) => {
      hopLines[j * 8 + s] = hop[a] < 0 ? 1e3 : hop[a]
      hopLines[j * 8 + 4 + s] = hop[b] < 0 ? 1e3 : hop[b]
    })
    aHopP.needsUpdate = true; aHopL.needsUpdate = true
    pulseOrigin[s] = from
    pulseMax[s] = max
    pulseA[s] = 1
    // reduced motion: no travelling wave, show the whole reached set lit, then fade
    pulseT[s] = state.reduced ? max + 0.5 : -0.5
    ringPh[s] = state.reduced ? 0 : 0.001
    dummy.position.set(pos[from * 3], pos[from * 3 + 1], pos[from * 3 + 2] * spread)
    dummy.updateMatrix(); halos.setMatrixAt(2 + s, dummy.matrix); halos.instanceMatrix.needsUpdate = true
    corePulse = 1
  }

  function focusFolder(i: number | null) {
    focused = i != null && i >= 0 && i < GROUPS ? i : null
    pMat.uniforms.uFocus.value = lMat.uniforms.uFocus.value = focused ?? -1
    for (let g = 0; g < GROUPS; g++) groupTarget[g] = focused == null || g === focused ? 1 : 0.15
    if (focused == null) { focusYaw = 0; focusPitch = 0; spreadTarget = 1; return }
    if (ana) { if (topOfFolder[focused] >= 0) pulse(topOfFolder[focused]); return }
    // turn so the strata separate and the chosen layer sits toward the viewer
    const z = (focused - 4.5) * 0.06
    focusYaw = z >= 0 ? -0.55 : 0.55
    focusPitch = -0.22
    spreadTarget = maxSpread
    if (topOfFolder[focused] >= 0) pulse(topOfFolder[focused])
  }

  function setNight(night: boolean) {
    nightTarget = night ? 1 : 0
    if (state.reduced) nightK = nightTarget
    applyNight()
  }
  function applyNight() {
    hMat.uniforms.uNight.value = nightK
    if (ana) return
    for (const m of [frontMat, backMat]) m.uniforms.uNight.value = nightK
    pMat.uniforms.uNight.value = nightK; lMat.uniforms.uNight.value = nightK
    const brain = lin(DAY.brain).lerp(lin(NIGHT.brain), nightK)
    pMat.uniforms.uBrain.value.copy(brain); lMat.uniforms.uBrain.value.copy(brain)
    frontMat.uniforms.uCoreColor.value.copy(brain)
    const tint = lin(DAY.glassTint).lerp(lin(DAY.paperRaised), 0.4).lerp(lin(NIGHT.glassTint), nightK)
    for (const m of [frontMat, backMat]) m.uniforms.uTint.value.copy(tint)
  }

  function setTurn(y: number, p: number) { yawIn = y; pitchIn = p }

  const tmpV = new Vector3()
  function update(dt: number, t: number) {
    dt = Math.min(Math.max(dt, 0), 0.1)
    const reduced = state.reduced
    const paused = state.paused
    if (!paused && !reduced) idleT += dt
    const mdt = paused ? 0 : dt   // pause freezes pulses and breathing; turning still follows input

    // night crossfade
    if (nightK !== nightTarget) {
      const step = dt / 0.6
      nightK = nightTarget > nightK ? Math.min(nightTarget, nightK + step) : Math.max(nightTarget, nightK - step)
      applyNight()
    }

    // turning: idle sway + lead input + folder focus, through a critically damped spring
    const idleYaw = reduced ? 0 : Math.sin(idleT * 0.16) * 0.38 + Math.sin(idleT * 0.051) * 0.12
    const idlePitch = reduced ? 0 : Math.sin(idleT * 0.11 + 1.3) * 0.08
    const ty = yawIn + idleYaw * (focused == null ? 1 : 0.25) + focusYaw
    const tp = pitchIn + idlePitch + focusPitch
    if (reduced) { yaw = ty; pitch = tp; vyaw = vpitch = 0 }
    else {
      const w = 7.5 // spring stiffness (rad/s)
      const ay = w * w * (ty - yaw) - 2 * w * vyaw
      const ap = w * w * (tp - pitch) - 2 * w * vpitch
      vyaw += ay * dt; vpitch += ap * dt
      yaw += vyaw * dt; pitch += vpitch * dt
    }
    turn.rotation.set(pitch, yaw, 0, 'YXZ')

    // strata separate with how far the globe is turned away from the front
    const turnAmt = Math.min(1, Math.hypot(yaw, pitch * 1.4) / 0.7)
    const autoSpread = 1 + (maxSpread - 1) * turnAmt * turnAmt
    const st = Math.max(spreadTarget, autoSpread)
    spread += (st - spread) * (reduced ? 1 : 1 - Math.exp(-dt * 5))
    if (!ana) {
      pMat.uniforms.uSpread.value = spread; lMat.uniforms.uSpread.value = spread
      // stratum rings: a whisper from the front (they coincide), drawn plates once turned
      lMat.uniforms.uRing.value = 0.12 + 1.9 * Math.min(1, turnAmt * 1.3)
    }

    // folder alpha
    for (let g = 0; g < GROUPS; g++) {
      groupAlpha[g] += (groupTarget[g] - groupAlpha[g]) * (reduced ? 1 : 1 - Math.exp(-dt * 8))
    }
    pMat.uniforms.uGroupAlpha.value = groupAlpha; lMat.uniforms.uGroupAlpha.value = groupAlpha

    // pulses: 8 hops per 900 ms
    const hopsPerSec = 8 / 0.9
    for (let s = 0; s < SLOTS; s++) {
      if (pulseA[s] <= 0) continue
      if (!reduced) pulseT[s] += mdt * hopsPerSec
      if (pulseT[s] > pulseMax[s] + 1.5 || reduced) pulseA[s] = Math.max(0, pulseA[s] - mdt / (reduced ? 1.4 : 0.9))
      if (ringPh[s] > 0) { ringPh[s] += mdt / 0.75; if (ringPh[s] >= 1) ringPh[s] = 0 }
    }
    for (const m of [pMat, lMat]) {
      ;(m.uniforms.uPulseT.value as Vector4).fromArray(pulseT)
      ;(m.uniforms.uPulseA.value as Vector4).fromArray(pulseA)
    }
    hMat.uniforms.uRings.value = ringPh

    // core breathing + pulse kick
    corePulse = Math.max(0, corePulse - mdt / 1.1)
    const breathe = reduced ? 0 : 0.08 * Math.sin(idleT * 1.7)
    const core = (0.82 + breathe + corePulse * 0.6) * (ana ? 0.42 : 1)
    hMat.uniforms.uCore.value = core
    if (ana) {
      // colour mode (shared with the particle form), the sweep of a mode change, and the time for waves and film
      const sw = state.reduced ? 2 : brainMode.sweep()
      for (const m of [pMat, lMat, frontMat, backMat]) { (m.uniforms.uMode.value as Vector2).set(brainMode.cur, brainMode.prev); m.uniforms.uSweep.value = sw; m.uniforms.uTime.value = t }
      frontMat.uniforms.uPulse.value = corePulse * 0.6
    } else frontMat.uniforms.uCoreStrength.value = 0.65 + corePulse * 0.8

    // view-space centre depth for the depth fade, and world core for the glass
    group.updateWorldMatrix(true, false)
    tmpV.setFromMatrixPosition(group.matrixWorld)
    if (!ana) frontMat.uniforms.uCoreCenter.value.copy(tmpV)
  }

  // the camera is only known at render time: grab it for view-space depth
  points.onBeforeRender = (_r, _s, camera) => {
    tmpV.setFromMatrixPosition(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
    pMat.uniforms.uCenterZ.value = tmpV.z
    lMat.uniforms.uCenterZ.value = tmpV.z
  }
  lines.onBeforeRender = points.onBeforeRender

  function corePoint(): Vector3 {
    group.updateWorldMatrix(true, false)
    return new Vector3().setFromMatrixPosition(group.matrixWorld)
  }

  const pv = new Vector3()
  function pick(ndc: Vector2, camera: Camera, maxPx = 10, viewportH = window.innerHeight): BrainPick | null {
    turn.updateWorldMatrix(true, false)
    let best = -1, bestD = Infinity
    const tol = (maxPx / viewportH) * 2
    for (let i = 0; i < N; i++) {
      if (groupAlpha[grp[i]] < 0.5) continue
      pv.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2] * spread).applyMatrix4(turn.matrixWorld).project(camera)
      const d = Math.hypot(pv.x - ndc.x, (pv.y - ndc.y))
      if (d < tol && d < bestD) { bestD = d; best = i }
    }
    if (best < 0) return null
    const world = new Vector3(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2] * spread).applyMatrix4(turn.matrixWorld)
    return { index: best, folder: folders[grp[best]].name, degree: deg[best], world }
  }

  const inv = new Vector3()
  function pulseAt(world: Vector3) {
    turn.updateWorldMatrix(true, false)
    inv.copy(world).applyMatrix4(turn.matrixWorld.clone().invert())
    let best = topNode, bd = Infinity
    for (let i = 0; i < N; i++) {
      if (adj[i].length === 0) continue
      const dx = pos[i * 3] - inv.x, dy = pos[i * 3 + 1] - inv.y, dz = pos[i * 3 + 2] * spread - inv.z
      const d = dx * dx + dy * dy + dz * dz
      if (d < bd) { bd = d; best = i }
    }
    pulse(best)
  }

  function setGlow(caps: Float32Array) { if (ana) return; frontMat.setGlow(caps); backMat.setGlow(caps) }

  function dispose() {
    disposed = true
    sphere.dispose(); pGeo.dispose(); lGeo.dispose(); haloGeo.dispose()
    frontMat.dispose(); backMat.dispose(); pMat.dispose(); lMat.dispose(); hMat.dispose()
    halos.dispose()
    group.removeFromParent()
  }

  setNight(state.night)
  nightK = nightTarget; applyNight()

  return {
    group, update, pulse, focusFolder, setNight, setTurn, corePoint, dispose, pick, pulseAt, folders, setGlow,
    anatomical: ana,
    get mode() { return brainMode.cur },
    setMode(m: number, instant = false) { brainMode.set(m, instant || state.reduced) },
    nextMode() { brainMode.next(state.reduced) },
  }
}

export type { GlassMaterial }
