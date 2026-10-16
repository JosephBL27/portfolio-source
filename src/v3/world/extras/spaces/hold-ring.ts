// The crag ring of the "hold" space: a 360 degree ring of Poly Haven CC0 photoscans (Namaqualand sandstone, the same rock as the hero boulder) with their light BAKED in Cycles
// under the same dusk HDRI as the backdrop (scripts/blender/crag_ring.py -> public/models/glb/crag-ring.glb, Draco + WebP, one mesh per piece), and a scanned ground: ambientCG
// "Ground 111" (CC0) tiled over a baked lightmap (public/media/crag/ground-light.webp, planar uv). Everything is UNLIT at runtime (MeshBasicMaterial: no lights, no shadow map,
// no PMREM, no read-back); the baked images are display-referred (the repo's hue-preserving shoulder + sRGB, scripts/hdri-prep.mjs), so every map is read raw (NoColorSpace) and
// the output goes to the canvas as is, exactly like the backdrop. Two programs in all (rock, ground): both share one patch that adds the space's fade-up (fog.pres), a gain, and
// a depth haze toward the dusk sky colour (aerial perspective: the far cliffs sink into the backdrop instead of standing on it).
// Space-local axes: x right, y up, z toward the arriving camera; the boulder stands on the origin. ?noring=1 (or any failure) leaves the previous scene: dome + boulder.
import * as THREE from 'three'
import { loadGLB } from '../../glbmodel'
import type { Fog } from './common'

const BASE = import.meta.env.BASE_URL
/** ground radius in metres; the same number as GROUND_R in scripts/blender/crag_ring.py (the lightmap is planar over [-R, R]) */
export const RING_R = 40
const TILE_M = 2.8                         // ambientCG Ground111 is 280 cm across
const TILE_MEAN = '0.573, 0.471, 0.392'       // mean colour of the tile (measured), so the second, larger-scale sample only modulates it
const GAIN_ROCK = 1.0, GAIN_GROUND = 0.85   // display-space multipliers on the baked images (the lightmap is lighting only; the tile carries the albedo)

export interface Ring { group: THREE.Group; info(): Record<string, unknown>; dispose(): void }

function loadTex(url: string, repeat = false): Promise<THREE.Texture> {
  return new Promise((ok, no) => new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.NoColorSpace                   // display-referred: read raw
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 }
    ok(t)
  }, undefined, () => no(new Error('missing ' + url))))
}

interface Shared { pres: { value: number }; haze: { value: THREE.Color }; hazeR: { value: THREE.Vector2 }; hazeK: { value: number } }

/** fade-up with the space, gain, depth haze; the ground variant also tiles (two scales) and multiplies the baked lightmap and fades out at its rim */
function patch(m: THREE.MeshBasicMaterial, sh: Shared, gain: number, ground?: { lm: THREE.Texture }) {
  m.onBeforeCompile = s => {
    s.uniforms.uRPres = sh.pres; s.uniforms.uRHaze = sh.haze; s.uniforms.uRHazeR = sh.hazeR; s.uniforms.uRHazeK = { value: sh.hazeK.value }; s.uniforms.uRGain = { value: gain }
    s.vertexShader = 'varying float vRD;\n' + (ground ? 'varying vec2 vLm;\n' : '') + s.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvRD = length(mvPosition.xyz);' + (ground ? `\nvLm = vec2(position.x, -position.z) / ${(2 * RING_R).toFixed(1)} + 0.5;` : ''))
    let fs = 'varying float vRD; uniform float uRPres, uRHazeK, uRGain; uniform vec3 uRHaze; uniform vec2 uRHazeR;\n' + s.fragmentShader
    if (ground) {
      s.uniforms.uLm = { value: ground.lm }
      fs = 'varying vec2 vLm; uniform sampler2D uLm;\n' + fs
      fs = fs.replace('#include <map_fragment>', `
        vec2 gUv = vMapUv;
        vec3 ta = texture2D(map, gUv).rgb;
        vec3 tb = texture2D(map, mat2(0.80, 0.60, -0.60, 0.80) * gUv * 0.173 + vec2(0.37, 0.11)).rgb;
        vec3 tile = ta * mix(vec3(1.0), clamp(tb / vec3(${TILE_MEAN}), 0.55, 1.6), 0.6);
        diffuseColor.rgb *= tile * texture2D(uLm, vLm).rgb;`)
    }
    fs = fs.replace('#include <dithering_fragment>', `
      gl_FragColor.rgb *= uRGain;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uRHaze, uRHazeK * smoothstep(uRHazeR.x, uRHazeR.y, vRD)) * uRPres;
      ${ground ? 'gl_FragColor.a = 1.0 - smoothstep(0.4, 0.92, length(vLm - 0.5) * 2.0);' : ''}
      #include <dithering_fragment>`)
    s.fragmentShader = fs
  }
  m.customProgramCacheKey = () => (ground ? 'ring-ground-v1' : 'ring-rock-v1')
}

function groundGeo(): THREE.BufferGeometry {
  const SEG = 96, RINGS = 28, pos: number[] = [], uv: number[] = [], idx: number[] = []
  pos.push(0, 0, 0); uv.push(0.5, 0.5)
  for (let j = 1; j <= RINGS; j++) {
    const r = RING_R * Math.pow(j / RINGS, 1.15)
    for (let i = 0; i < SEG; i++) { const a = (i / SEG) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, 0, z); uv.push(x / TILE_M, z / TILE_M) }
  }
  uv[0] = 0; uv[1] = 0
  for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i)
  for (let j = 1; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = 1 + (j - 1) * SEG + i, b = 1 + (j - 1) * SEG + ((i + 1) % SEG), c = a + SEG, d = b + SEG
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx)
  // the centre vertex is never seen through the fade, but its uv must agree with the tile grid (origin = 0, 0)
  return g
}

export async function loadRing(fog: Fog): Promise<Ring> {
  const t0 = performance.now()
  const [gltf, lm, tile] = await Promise.all([loadGLB('crag-ring'), loadTex(`${BASE}media/crag/ground-light.webp`), loadTex(`${BASE}media/crag/ground111-color.webp`, true)])
  if (!gltf) { lm.dispose(); tile.dispose(); throw new Error('crag-ring.glb unavailable') }
  const sh: Shared = { pres: fog.pres, haze: { value: new THREE.Color(0.16, 0.17, 0.23) }, hazeR: { value: new THREE.Vector2(14, 78) }, hazeK: { value: 0.62 } }
  const group = new THREE.Group(); group.name = 'crag-ring'
  const mats: THREE.Material[] = [], maps: THREE.Texture[] = [lm, tile]
  let tris = 0, calls = 0
  const pieces: THREE.Mesh[] = []
  gltf.traverse(o => { if ((o as THREE.Mesh).isMesh) pieces.push(o as THREE.Mesh) })
  for (const src of pieces) {
    const old = src.material as THREE.MeshStandardMaterial
    const map = old.map
    if (map) { map.colorSpace = THREE.NoColorSpace; map.anisotropy = 8; maps.push(map) }
    const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false })
    patch(mat, sh, GAIN_ROCK); mats.push(mat); old.dispose()
    const mesh = new THREE.Mesh(src.geometry, mat); mesh.name = src.name; mesh.matrixAutoUpdate = false; src.updateWorldMatrix(true, false); mesh.matrix.copy(src.matrixWorld)
    group.add(mesh)
    const g = src.geometry; tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3; calls++
  }
  const gm = new THREE.MeshBasicMaterial({ map: tile, transparent: true, depthWrite: true, toneMapped: false, side: THREE.DoubleSide })
  patch(gm, sh, GAIN_GROUND, { lm }); mats.push(gm)
  const ground = new THREE.Mesh(groundGeo(), gm); ground.position.y = -0.02; ground.renderOrder = -8; ground.name = 'ring-ground'; ground.frustumCulled = false
  group.add(ground); calls++
  return {
    group,
    info: () => ({ ring: true, pieces: pieces.length, tris: Math.round(tris), calls, ms: Math.round(performance.now() - t0), gainRock: GAIN_ROCK, gainGround: GAIN_GROUND }),
    dispose() { for (const o of pieces) o.geometry.dispose(); ground.geometry.dispose(); for (const m of mats) m.dispose(); for (const t of maps) t.dispose() },
  }
}
