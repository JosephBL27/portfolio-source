// The photoreal hall (wave 22): the nave, the end wall with its five lancets, the vault, the shafts, the oak, the tables and the chairs, as ONE baked Blender scene
// (scripts/blender/hall_photoreal.py, all Poly Haven CC0: public/models/glb/hall-photoreal.glb, Draco + WebP, and the lightmap hall-photoreal-light.webp).
// It replaces the procedural stone shell (hall/shell.ts) once it has loaded and compiled; until then, or if anything fails (no network, ?hall=procedural), the procedural
// hall stands exactly as before. The windows, the doors, the beams, the dust, the labels and every interaction stay where they were: this only draws the stone.
//
// Materials: unlit MeshBasicMaterial. Architecture = tiling albedo (uv0, the photograph's own colours) x the baked lightmap (uv1: the five windows as real light sources,
// a sun through the coloured glass, candles, global illumination, in Cycles). Props (chandeliers, chairs, candle stands, books) = their own albedo x baked vertex light.
// Both factors are display-referred bytes (the site's colour pipeline writes straight to the canvas), so they multiply as plain numbers. 0 scene lights, 0 read-backs.
//
// The architecture also falls away into the dark toward the crown of the vault (HP_VAULT: x0.05 from y = 15 m, starting at 9 m): the site's black level (grade-check at the hall
// and mid-hall stops, p5 luma of the top rows <= 0.03) and its near-black ground hold, and the lit stone and the five windows stand out of it. The props keep their candle light.
// A small onBeforeCompile patch on top of the basic shader gives back what the procedural stone did: the dissolve in and out (the hall's `uDissolve`), the dimmed copy
// lane, the coloured lift of a hovered window on the stone near it, and on the floor the mirror image of the windows and the extra sun patch of a lit window.
import * as THREE from 'three'
import { HALL, HALL_PITCH } from '../../layout'
import { loadGLB } from '../../glbmodel'
import { LANE_GLSL } from '../lib/lane'
import { WIN } from './material'
import type { HallUniforms } from './material'
import type { Shared } from '../transitions/common'

export const PHOTOREAL_VERSION = 'hall-photoreal-1'

const GLSL_PARS = /* glsl */ `
uniform float uDissolve, uCopy, uHallLit, uHpGain;
uniform vec3 uEdge;
uniform vec3 uWinPos[5]; uniform vec3 uWinCol[5]; uniform float uWinX[5];
varying vec3 vHW; varying vec3 vHN; varying vec3 vHL;
${LANE_GLSL}
float hpH13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hpVn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hpH13(i), hpH13(i + vec3(1,0,0)), f.x), mix(hpH13(i + vec3(0,1,0)), hpH13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hpH13(i + vec3(0,0,1)), hpH13(i + vec3(1,0,1)), f.x), mix(hpH13(i + vec3(0,1,1)), hpH13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float hpFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * hpVn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`
const GLSL_FLOOR_PARS = /* glsl */ `
uniform float uGain[5]; uniform float uSunK[5]; uniform sampler2D tGlass; uniform vec3 uCamL; uniform float uProj;
const float HL_ = ${HALL.len.toFixed(2)}, WP_ = ${HALL_PITCH.toFixed(3)}, WW_ = ${WIN.w.toFixed(3)}, WH_ = ${WIN.h.toFixed(3)}, WS_ = ${WIN.sill.toFixed(3)};
vec3 hpGlassAt(vec2 hit, float lod, out int which) {
  which = 0;
  float fi = clamp(floor(2.5 - hit.x / WP_), 0.0, 4.0); which = int(fi);
  float xc = (2.0 - fi) * WP_;
  float u = 0.5 - (hit.x - xc) / WW_, v = (hit.y - WS_) / WH_;
  if (u <= 0.0 || u >= 1.0 || v <= 0.0 || v >= 1.0) return vec3(0.0);
  return textureLod(tGlass, vec2((fi + u) / 5.0, v), lod).rgb * uGain[which];
}
`
const GLSL_BODY = /* glsl */ `
{
  float hpRim = 0.0;
  if (uDissolve < 0.995) {
    float dn = hpFbm(vHW * 2.6 + vec3(3.0, 1.0, 7.0)) * 0.8 + 0.18 * hpVn(vHW * 13.0);
    float thr = uDissolve * 1.25 - 0.12;
    if (dn >= thr) discard;
    hpRim = smoothstep(thr - 0.05, thr, dn);
  }
  vec3 hpN = normalize(vHN); if (!gl_FrontFacing) hpN = -hpN;
  vec3 hpAcc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 Lv = uWinPos[i] - vHW; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(max(d2, 1e-3));
    float att = 1.0 / (1.0 + d2 * 0.012);          // the lift of a hovered window dies off with distance (the baked stone is far brighter than the old procedural stone: a wide lift washed the whole wall)
    hpAcc += uWinCol[i] * uWinX[i] * att * max(dot(hpN, L) * 0.7 + 0.3, 0.0);
  }
  outgoingLight = outgoingLight * uHpGain + diffuseColor.rgb * hpAcc * 1.1 * uHallLit;
  #ifdef HP_VAULT
  // the vault and the upper end wall fall away into the dark above the window tips: the hall keeps the site's near-black ground (grade-check: black level at the hall stop)
  outgoingLight *= 1.0 - 0.95 * smoothstep(9.0, 15.0, vHL.y);   // w22: 10..16.5 left mid:hall at 0.031 > 0.03
  #endif
  #ifdef HP_FLOOR
  {
    vec3 Pl = vHL; vec3 Vl = normalize(uCamL - Pl);
    float fr = 0.16 + 0.84 * pow(1.0 - clamp(Vl.y, 0.0, 1.0), 4.0);
    vec3 R = vec3(-Vl.x, Vl.y, -Vl.z);
    vec3 ex = vec3(0.0);
    if (R.z > 0.02) {
      float s = (HL_ - 0.5 - Pl.z) / R.z; vec2 hit = vec2(Pl.x + R.x * s, R.y * s); int w1;
      vec3 g = hpGlassAt(hit, 1.6 + s * 0.05, w1);
      ex += g * fr * 0.2 * 0.62 * (0.45 + 0.55 * uSunK[w1]) * smoothstep(0.0, 0.5, R.y);
    }
    float s2 = (HL_ - 0.5 - Pl.z) / 0.83; vec2 hp = vec2(Pl.x + s2 * 0.1, s2 * 0.55); int w2;
    vec3 sun = hpGlassAt(hp, 1.2 + s2 * 0.045, w2);
    ex += sun * uProj * 0.55 * clamp((uSunK[w2] - 0.35) / 0.65, 0.0, 1.0) * smoothstep(0.0, 1.5, s2);
    outgoingLight += ex * uHallLit;
  }
  #endif
  outgoingLight += uEdge * hpRim * 2.0;
  outgoingLight *= 1.0 - 0.72 * uCopy * (1.0 - laneMask());
}
`

export interface PhotorealUniforms {
  /** extra window lift (above what is baked), per window: 0 at rest, up to ~1.3 on a hovered or dived window */
  uWinX: { value: number[] }
  uHpGain: { value: number }
}

export interface PhotorealRoom {
  group: THREE.Group
  uniforms: PhotorealUniforms
  /** every material the room made (for dispose and compile) */
  materials: THREE.MeshBasicMaterial[]
  stats: { meshes: number; tris: number; ms: number }
  dispose(): void
}

interface Ctx { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; scene: THREE.Scene }

/** the tint of the flat (untextured) Blender materials: linear factors in the GLB -> the display-referred value the site multiplies */
const toDisplay = (c: THREE.Color) => { const d = c.clone(); d.convertLinearToSRGB(); return d }

export async function loadPhotoreal(ctx: Ctx, sh: Shared, hu: HallUniforms): Promise<PhotorealRoom | null> {
  const params = new URLSearchParams(location.search)
  if (params.get('hall') === 'procedural') return null
  const t0 = performance.now()
  const base = import.meta.env.BASE_URL
  const [scene, lm] = await Promise.all([
    loadGLB('hall-photoreal'),
    new THREE.TextureLoader().loadAsync(`${base}models/glb/hall-photoreal-light.webp`).catch((e) => { console.warn('[hall] photoreal lightmap unavailable', e); return null }),
  ])
  if (!scene || !lm) return null
  const maxAniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy())
  lm.flipY = false; lm.colorSpace = THREE.NoColorSpace; lm.channel = 1
  lm.wrapS = lm.wrapT = THREE.ClampToEdgeWrapping
  lm.generateMipmaps = true; lm.minFilter = THREE.LinearMipmapLinearFilter; lm.magFilter = THREE.LinearFilter
  lm.anisotropy = maxAniso
  lm.needsUpdate = true

  const uniforms: PhotorealUniforms = { uWinX: { value: [0, 0, 0, 0, 0] }, uHpGain: { value: 1 } }
  const group = new THREE.Group(); group.name = 'hall-photoreal'
  const materials: THREE.MeshBasicMaterial[] = []
  const cache = new Map<string, THREE.MeshBasicMaterial>()
  let tris = 0, meshes = 0

  const patch = (m: THREE.MeshBasicMaterial, floor: boolean, vault: boolean) => {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uDissolve: sh.uDissolve, uCopy: sh.uCopy, uHallLit: hu.uHallLit, uHpGain: uniforms.uHpGain, uEdge: sh.uEdge as THREE.IUniform,
        uWinPos: hu.uWinPos, uWinCol: hu.uWinCol, uWinX: uniforms.uWinX,
        uLane: sh.uLane, uRes: sh.uRes, uLaneOn: sh.uLaneOn,
        uGain: hu.uGain, uSunK: hu.uSunK, tGlass: hu.tGlass, uCamL: hu.uCamL, uProj: hu.uProj,
      })
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vHW; varying vec3 vHN; varying vec3 vHL;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vHW = (modelMatrix * vec4(transformed, 1.0)).xyz; vHN = normalize(mat3(modelMatrix) * normal); vHL = transformed;')
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', GLSL_PARS + (floor ? GLSL_FLOOR_PARS : '') + '\nvoid main() {')
        .replace('#include <opaque_fragment>', GLSL_BODY + '\n#include <opaque_fragment>')
      shader.defines = { ...(shader.defines ?? {}), ...(floor ? { HP_FLOOR: '' } : {}), ...(vault ? { HP_VAULT: '' } : {}) }
    }
    m.customProgramCacheKey = () => `hall-photoreal|${floor ? 'floor' : 'plain'}|${vault ? 'v' : 'p'}`
    return m
  }

  const make = (src: THREE.Material, hasLight: boolean, hasColour: boolean): THREE.MeshBasicMaterial => {
    const key = `${src.name}|${hasLight}|${hasColour}`
    const hit = cache.get(key)
    if (hit) return hit
    const s = src as THREE.MeshStandardMaterial
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, name: s.name })
    if (s.map) {
      s.map.colorSpace = THREE.NoColorSpace       // display-referred: the photograph's own bytes, no decode
      s.map.anisotropy = maxAniso
      m.map = s.map
    } else if (s.color) {
      m.color.copy(toDisplay(s.color))
    }
    if (s.name === 'hp_flame') m.color.setRGB(1.0, 0.8, 0.46)
    if (hasLight) { m.lightMap = lm; m.lightMapIntensity = Math.PI }
    if (hasColour) m.vertexColors = true
    patch(m, s.name === 'hp_floor', !hasColour && s.name !== 'hp_flame')      // the architecture (no vertex light) darkens toward the crown; the props keep their baked candle light
    cache.set(key, m); materials.push(m)
    return m
  }

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const g = mesh.geometry
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material
    if (!src || src.name === 'Material') { mesh.visible = false; return }   // the exporter's default material: a stray object, never drawn
    const hasLight = !!g.getAttribute('uv1'), hasColour = !!g.getAttribute('color')
    mesh.material = make(src, hasLight, hasColour)
    mesh.frustumCulled = false
    mesh.userData.noReflect = true
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3; meshes++
  })
  group.add(scene)
  const stats = { meshes, tris, ms: performance.now() - t0 }
  const dispose = () => {
    group.removeFromParent()
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() })
    for (const m of materials) { m.map?.dispose(); m.dispose() }
    lm.dispose()
  }
  return { group, uniforms, materials, stats, dispose }
}
