// Shader patch for the 3D name's letters (MeshPhysicalMaterial + three chunks, so the PMREM reflections, clearcoat and iridescence stay
// stock). Adds, with per-letter uniforms and ONE shared program:
//   uReveal  0..1  noise-thresholded dissolve in object space: the letter condenses out of (or crumbles into) dust, a hot rim on the cut
//   uRim           a fresnel rim light (the studio's back light), cool-white, strongest where the surface turns edge-on to the viewer
//   uSheen         a slow travelling band of reflected light across the face (a moving softbox in the env), so the chrome is never static
//   uSplit  0..1   (arrival only, ~0.5 s, exactly 0 at rest and in reduced motion) an ALCHE-style RGB split: three offset bands (red leads, blue trails)
//                  run along the name with a horizontal streak smear behind them, and a few horizontal slices of each letter slip sideways; it resolves crisp
// The material is display-referred (src/v3/world/tvset.ts displayReferred): chain its onBeforeCompile first, then ours.
import * as THREE from 'three'
import { displayReferred } from '../../tvset'

export interface LetterU {
  reveal: THREE.IUniform<number>
  seed: THREE.IUniform<number>
  glow: THREE.IUniform<THREE.Color>
  edge: THREE.IUniform<number>
  rim: THREE.IUniform<number>
  rimCol: THREE.IUniform<THREE.Color>
  sheen: THREE.IUniform<number>
  warp: THREE.IUniform<number>
  time: THREE.IUniform<number>
  /** arrival glitch: amplitude 0..1 (0 = off, the shader branch is skipped), progress 0..1 of the glitch, this letter's centre x in the name's frame */
  split: THREE.IUniform<number>
  splitT: THREE.IUniform<number>
  gx: THREE.IUniform<number>
}
export const makeLetterU = (seed: number): LetterU => ({
  reveal: { value: 1 }, seed: { value: seed }, glow: { value: new THREE.Color(2.4, 1.55, 0.8) }, edge: { value: 1 },
  rim: { value: 0.55 }, rimCol: { value: new THREE.Color(0.72, 0.84, 1.0) }, sheen: { value: 0.5 }, warp: { value: 0.15 }, time: { value: 0 },
  split: { value: 0 }, splitT: { value: 0 }, gx: { value: 0 },
})

const VERT_DECL = /* glsl */ `uniform float uSplit, uSplitT, uSeed; varying vec3 vObjP; varying vec3 vObjN; varying vec3 vTX; varying vec3 vTY;\n`
const FRAG_DECL = /* glsl */ `
uniform float uReveal, uSeed, uEdge, uRim, uSheen, uWarp, uTime, uSplit, uSplitT, uGx; uniform vec3 uGlow, uRimCol;
varying vec3 vObjP; varying vec3 vObjN; varying vec3 vTX; varying vec3 vTY;
float lh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lh(i), lh(i + vec3(1,0,0)), f.x), mix(lh(i + vec3(0,1,0)), lh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lh(i + vec3(0,0,1)), lh(i + vec3(1,0,1)), f.x), mix(lh(i + vec3(0,1,1)), lh(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

/** wrap `m` (already created) with the dissolve / rim / sheen. `display` chains displayReferred first (the post stack wants display-referred colour). */
export function patchLetter(m: THREE.MeshPhysicalMaterial, u: LetterU, display = true, tone = 1) {
  if (display) displayReferred(m)
  const base = m.onBeforeCompile
  m.onBeforeCompile = function (shader, renderer) {
    base?.call(m, shader, renderer)
    shader.uniforms.uReveal = u.reveal; shader.uniforms.uSeed = u.seed; shader.uniforms.uGlow = u.glow; shader.uniforms.uEdge = u.edge
    shader.uniforms.uRim = u.rim; shader.uniforms.uRimCol = u.rimCol; shader.uniforms.uSheen = u.sheen; shader.uniforms.uWarp = u.warp; shader.uniforms.uTime = u.time
    shader.uniforms.uSplit = u.split; shader.uniforms.uSplitT = u.splitT; shader.uniforms.uGx = u.gx
    shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  if (uSplit > 0.001) { float sl = floor(position.y * 6.0 + 40.0); float jh = fract(sin((sl + uSeed) * 91.7 + floor(uSplitT * 7.0) * 13.1) * 437.58); transformed.x += step(0.62, jh) * (fract(jh * 7.3) - 0.5) * 0.16 * uSplit; }\n  vObjP = position; vObjN = normal; vTX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0)); vTY = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));')
    shader.fragmentShader = FRAG_DECL + shader.fragmentShader
      // the dissolve: visible where the noise is below the moving threshold; cut early, before any lighting work
      .replace('#include <clipping_planes_fragment>', /* glsl */ `#include <clipping_planes_fragment>
  float lvis = 1.0;
  if (uReveal < 0.999) {
    vec3 q = vObjP * 2.1 + uSeed;
    float n = 0.58 * lnoise(q * 2.3) + 0.30 * lnoise(q * 6.1) + 0.12 * lnoise(q * 15.0);
    // a sweep across the letter (bottom-left first) so it condenses as a front, not as static
    float sweep = 0.5 + 0.5 * dot(normalize(vec3(0.55, 0.8, 0.25)), clamp(vObjP * 1.1, -1.0, 1.0));
    n = mix(n, sweep, 0.3);
    lvis = mix(-0.2, 1.2, uReveal) - n;
    if (lvis < 0.0) discard;
  }`)
      // emissive: the hot cut edge of the dissolve, the rim light, and the travelling sheen
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
  {
    // liquid metal: a slow, large-scale ripple tilts the normal on the front faces only, so the studio's strips and bands run across each
    // letter instead of one flat tone (the walls and bevels keep their true normals)
    float fw = smoothstep(0.55, 0.92, vObjN.z) * uWarp;
    float ph = uTime * 0.11 + uSeed;
    vec2 dn = vec2(sin(vObjP.y * 2.6 + sin(vObjP.x * 1.9 + ph) * 1.2 + ph * 0.7), sin(vObjP.x * 2.3 + sin(vObjP.y * 1.7 - ph) * 1.1 + 1.7)) * fw;
    normal = normalize(normal + vTX * dn.x + vTY * dn.y);
    #ifdef USE_CLEARCOAT
      clearcoatNormal = normalize(clearcoatNormal + vTX * dn.x + vTY * dn.y);
    #endif
    if (uSplit > 0.001) {
      // RGB split: three gaussian bands of the same light, red ahead of green ahead of blue, riding a head that crosses the name left to right,
      // with a smear behind it that is broken into thin horizontal lines (the streak). Gone (uSplit = 0) the moment the arrival has settled.
      float gxp = vObjP.x + uGx;
      float head = mix(-5.4, 5.4, uSplitT);
      vec3 dd = vec3(-1.0, 0.0, 1.0) * (0.55 + 0.5 * uSplit);
      vec3 qb = (vec3(gxp - head) - dd) / 0.85;
      float lines = 0.45 + 0.55 * lnoise(vec3(vObjP.y * 11.0, uSeed, floor(uSplitT * 9.0)));
      float trail = (1.0 - smoothstep(0.0, 4.2, head - gxp)) * step(gxp, head + 0.4) * lines;
      totalEmissiveRadiance += (exp(-qb * qb) * 1.5 + vec3(0.9, 0.55, 0.45) * trail * 0.55 * vec3(1.0, 0.8, 1.3)) * uSplit;
      // and the lit metal itself picks up a channel-shifted tint while it lasts
      diffuseColor.rgb *= 1.0 + uSplit * vec3(0.22, -0.06, 0.28) * lines;
    }
    float cut = 1.0 - smoothstep(0.0, 0.04, lvis);
    totalEmissiveRadiance += uGlow * cut * cut * uEdge * step(lvis, 0.999);
    vec3 Vn = normalize(vViewPosition);
    float fr = 1.0 - clamp(dot(normal, Vn), 0.0, 1.0);
    totalEmissiveRadiance += uRimCol * pow(fr, 3.0) * uRim * 0.5;
    // a soft diagonal band of light sliding over the faces: a softbox that is not in the room's env, so the polish keeps moving
    float band = sin(dot(vObjP, vec3(0.9, 0.55, 0.0)) * 3.2 - uTime * 0.55);
    totalEmissiveRadiance += vec3(0.6, 0.7, 0.9) * smoothstep(0.78, 1.0, band) * uSheen * 0.12 * (0.35 + 0.65 * fr);
  }`)
      // a soft shoulder on the lit result: a polished face that turns to catch a softbox goes bright, never to a flat clipped white (legibility)
      .replace('#include <opaque_fragment>', /* glsl */ `{
    vec3 hi = max(outgoingLight - 0.62, vec3(0.0));
    outgoingLight = (outgoingLight - hi + hi / (1.0 + hi * 2.6)) * TONE;
  }
  #include <opaque_fragment>`).replace(/\bTONE\b/g, tone.toFixed(3))   // tone: the whole lit result of this material, 1 = as lit (the walls use less)
  }
  const key = `hero3d-letter-v3-${tone.toFixed(2)}`
  m.customProgramCacheKey = () => key
  m.needsUpdate = true
  return m
}
