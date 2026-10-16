// Post-processing for the particle field:
//   RenderPass (HalfFloat target + depth, so TV meshes occlude correctly) -> UnrealBloomPass (half
//   res, soft-knee threshold so only dense highlights glow) -> one final ShaderPass that does, in
//   this order: highlight shoulder (hot cores roll off to white instead of clipping), the near-black
//   ground (#050506) with a faint warm radial haze, a subtle vignette, a whisper of film grain /
//   dither, and the intro fade.
//
// v4 clarity: NO global barrel warp and NO chromatic aberration. CRT looks (scanlines, curvature,
// fringing) belong only on the TV screens themselves (src/gl/crt.ts); type and particles stay sharp.
// `settings.aberration` / `settings.warp` still exist for old callers (lab/engine.ts) but are ignored.
//
// v8 selective bloom: TV shells, chains, screens and the glass brain are opaque meshes that write depth; the particles
// are additive and do not. The bloom's high-pass reads that depth and drops every mesh pixel from the bloom input, so
// metal rims and CRT screens never halo the titles that sit on top of them (their own pixels are untouched).
//
// w12 render pass: (1) the scene is drawn into a 4x MSAA HalfFloat target (colour + depth texture, resolved by three.js with a
// blit) and then copied into the composer's ping-pong targets by the pre-bloom soft clip, so meshes (TVs, hall tracery, stages)
// are antialiased while the rest of the chain stays single-sampled; SMAA is the fallback (?aa=smaa) and phones / low tiers
// stay at 0 samples (?aa=0 = none). (2) a per-area lift / gamma / gain + saturation grade in the final pass (?grade=0 off).
// (3) a softer shoulder + a final soft limiter so hot cores roll off instead of clipping (?post=old = the pre-w12 chain).
// (4) a mesh-only rack-focus blur (half-res, depth-aware, CoC <= 3 px, desktop only, ?dof=0 off).
//
// Colour: particle colours are display-referred (what you see in lab/formview.html), so the final
// pass writes them as-is after the shoulder: the canvas is sRGB and there is no extra transfer
// function (a second gamma would blow out every form that was tuned in the lab).
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { isPhone } from './quality'
import type { AreaId } from '../world/layout'
import { WAYPOINTS } from '../world/layout'
import { LOOKS, OLD_LOOKS, NEUTRAL_VEC, N as GN, I as GI, pack, type LookId } from './grade'

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
/** URL switches (measurement + safety): ?aa=0|smaa|<samples>, ?grade=0|old, ?dof=0, ?post=old */
export const FLAGS = { aa: qs.get('aa'), grade: qs.get('grade') !== '0', gradeOld: qs.get('grade') === 'old', dof: qs.get('dof') !== '0', old: qs.get('post') === 'old', prof: qs.get('prof') === '1' }

export const GROUND = [5 / 255, 5 / 255, 6 / 255] as const // #050506

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime, uGrain, uVig, uExposure, uFade, uHaze, uKnee, uAsym, uBurn, uLimit, uGradeOn, uLookK;
// v20 grade (all blended along the flight on the CPU, see grade.ts): lift (legacy only) / white-balance gain / gamma, contrast / sat / vibrance / film,
// halation + streak (amounts only: they take the colour of the picture they come from), vignette depth, grain multiplier. No tint, no mixer, no hue replacement: a hue can only be kept.
uniform vec3 uLift, uGain, uGamma;
uniform vec4 uCSVF; uniform float uHal, uStr, uVigK; uniform vec2 uGB;
uniform vec3 uGround;
// ---- vibe (music-driven look). uVibe = 0 skips every branch below, so the default costs one compare.
uniform float uVibe, uWash, uGradeAmt, uSat, uPulse, uRain, uSpark, uGlowMode;
uniform vec4 uRip[4];            // xy origin (uv), z age (s), w amplitude
uniform vec3 uPA, uPB, uPC, uGrade, uFlCol, uRainCol, uSparkCol, uGlowCol;
uniform vec4 uFl;                // xy uv, z intensity, w streak length
uniform vec4 uGlow; uniform vec2 uGlowR;   // xy uv, z intensity, w radius (uv.y) | ellipse radii for the sheen
varying vec2 vUv;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

// roll the highlights off the top of the range, keep hue, let the overflow burn toward white
vec3 shoulder(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  if (m <= uKnee) return c;
  float o = uKnee + (uAsym - uKnee) * (1.0 - exp(-(m - uKnee) / (uAsym - uKnee)));
  vec3 s = c * (o / m);
  float burn = smoothstep(0.9, 3.2, m) * uBurn;
  return mix(s, vec3(o), burn);
}

// v20 per-area grade: a gentle filmic shoulder, white balance, contrast about a mid pivot, gamma, saturation + vibrance (>= 1). Nothing here can replace a hue.
float lum3(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 acesFit(vec3 x) { return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); }
vec3 grade(vec3 c) {
  // 1.486 = 1 / aces(0.6): white stays white and the darks toe down, but the fit also lifts the mids by ~30%; the (1 - 0.17 w) takes most of that back.
  if (uCSVF.w > 0.001) c = mix(c, acesFit(c * 0.6) * 1.486, uCSVF.w) * (1.0 - 0.17 * uCSVF.w);
  c *= uGain;                                                                        // white balance: a few percent warm or cool, multiplicative, hue kept
  c = mix(0.3 * pow(max(c, vec3(1e-4)) / 0.3, vec3(uCSVF.x)), c, smoothstep(0.5, 1.1, c)); // contrast about a 0.3 pivot, fading out above 0.5 so hot cores never get hotter
  c += uLift * (1.0 - clamp(c, 0.0, 1.0));                                           // legacy ?grade=old only: every v20 look has a zero lift, so the blacks stay black
  c = pow(max(c, vec3(0.0)), uGamma);
  float l2 = lum3(c), mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = 1.0 + (max(uCSVF.y, 1.0) * (1.0 + max(uCSVF.z, 0.0) * (1.0 - (mx - mn) / (mx + 1e-3))) - 1.0) * (1.0 - smoothstep(0.5, 0.85, mx)); // never below 1: a look adds colour (more to the dull pixels) and the boost fades out toward the hot cores, which keep their own saturation (a boosted gold core clips to a flat amber slab)
  c = max(mix(vec3(l2), c, sat), 0.0);
  float mc = max(c.r, max(c.g, c.b));                                                // roll the largest channel off (knee 0.84, asymptote 0.97), hue kept
  if (mc > 0.84) c *= (0.84 + 0.13 * (1.0 - exp(-(mc - 0.84) / 0.13))) / mc;
  return c;
}

// final soft limiter: nothing the chain makes may reach clip white (the ceiling is 248/255), whatever the ground, haze, flare and grain add
vec3 limiter(vec3 c) {
  const float s0 = 0.9;
  vec3 o = vec3(s0) + (uLimit - s0) * (1.0 - exp(-(max(c, vec3(s0)) - s0) / (uLimit - s0)));
  return mix(c, o, step(vec3(s0), c));
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 d = vUv - 0.5;
  vec2 q = d * vec2(asp, 1.0);
  float r = length(q) / (0.5 * length(vec2(asp, 1.0))); // 0 centre .. 1 corner

  vec2 suv = vUv; float ringLift = 0.0;
  if (uVibe > 0.001) {
    for (int i = 0; i < 4; i++) {
      vec4 rp = uRip[i];
      if (rp.w > 0.001) {
        vec2 dv = (vUv - rp.xy) * vec2(asp, 1.0); float dd = length(dv) + 1e-4;
        float x = (dd - rp.z * 0.5) / 0.07;
        float e = exp(-x * x) * rp.w * exp(-rp.z * 1.4) * smoothstep(0.0, 0.05, rp.z);
        suv += (dv / dd) * vec2(1.0 / asp, 1.0) * e * 0.014; ringLift += e;
      }
    }
  }
  vec3 col = shoulder(textureLod(tDiffuse, suv, 0.0).rgb * uExposure);

  // ground + warm haze (additive under the particles, a touch above centre)
  vec2 hc = vUv - vec2(0.5, 0.56);
  float h = exp(-dot(hc * vec2(asp * 0.8, 1.0), hc * vec2(asp * 0.8, 1.0)) * 3.2);
  vec3 ground = uGround + vec3(1.0, 0.58, 0.34) * uHaze * h;
  if (uVibe > 0.001) {
    // the song's colour: a graded wash in the dark (sky / fog), a grade on what is lit, a slow saturation swell, and the mids breathing
    float hh = exp(-dot(hc * vec2(asp * 0.7, 1.0), hc * vec2(asp * 0.7, 1.0)) * 2.2);
    vec3 wash = mix(uPB, uPA, smoothstep(0.0, 1.0, vUv.y));
    wash = mix(wash, uPC, hh * 0.55);
    ground += wash * uWash * (0.45 + 0.55 * hh) * uVibe;
    col = mix(col, col * uGrade, uGradeAmt * uVibe);
    float l0 = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l0), col, mix(1.0, uSat, uVibe));
    col *= 1.0 + uPulse + ringLift * 0.35;
  }
  col = ground + col;
  if (uVibe > 0.001) {
    if (uFl.z > 0.001) {                      // soft anamorphic flare: a long horizontal streak with a small core
      vec2 fd = (vUv - uFl.xy) * vec2(asp, 1.0);
      float st = exp(-abs(fd.y) * 85.0) * exp(-abs(fd.x) * uFl.w) * 0.55, core = exp(-dot(fd, fd) * 340.0) * 0.7;
      col += uFlCol * uFl.z * (st + core);
    }
    if (uRain > 0.001) {                      // thin falling streaks (about 70 columns, a third of them lit)
      float cx = vUv.x * asp * 70.0, id = floor(cx), hr = hash12(vec2(id, 3.7));
      float line = smoothstep(0.09, 0.0, abs(fract(cx) - 0.5)) * step(0.66, hr);
      float tail = pow(fract(vUv.y + uTime * (0.35 + hr * 0.5) + hr * 9.0), 14.0);
      col += uRainCol * line * tail * uRain;
    }
    if (uSpark > 0.001) {                     // sparkles: one in ten cells, each a slow 2.5 s twinkle
      vec2 cs = gl_FragCoord.xy / (uRes.y / 20.0), gi = floor(cs), gf = fract(cs) - 0.5;
      float hs = hash12(gi), ph = fract(uTime * 0.4 + hs * 3.1);
      float sp = step(0.9, hs) * smoothstep(0.0, 0.1, ph) * smoothstep(0.45, 0.12, ph) * smoothstep(0.16, 0.0, length(gf - (vec2(hash12(gi + 3.0), hash12(gi + 9.0)) - 0.5) * 0.5));
      col += uSparkCol * sp * uSpark;
    }
    if (uGlow.z > 0.001) {
      if (uGlowMode < 0.5) {                  // a warm radial pool (candle light)
        vec2 gd = (vUv - uGlow.xy) * vec2(asp, 1.0); col += uGlowCol * uGlow.z * exp(-dot(gd, gd) / (uGlow.w * uGlow.w));
      } else {                                // a slow groove sheen: two opposed lobes sweeping round the record's ellipse
        vec2 q = (vUv - uGlow.xy) / uGlowR; float dq = length(q), an = atan(q.y, q.x);
        col += uGlowCol * uGlow.z * exp(-pow((dq - 0.62) / 0.3, 2.0)) * pow(0.5 + 0.5 * cos(2.0 * (an - uTime * 0.3)), 5.0);
      }
    }
  }

  if (uGradeOn > 0.001) {
    // halation: the blurred hot areas (the composer's mip chain, so four taps and one) minus the sharp picture leave a fringe just outside bright edges, in the colour of what is blooming (hue kept)
    if (uHal > 0.001) {
      vec2 px = 1.0 / uRes, o = px * 11.0;
      vec3 bl = (textureLod(tDiffuse, vUv + vec2(o.x, o.y), 3.0).rgb + textureLod(tDiffuse, vUv + vec2(-o.x, o.y), 3.0).rgb
               + textureLod(tDiffuse, vUv + vec2(o.x, -o.y), 3.0).rgb + textureLod(tDiffuse, vUv + vec2(-o.x, -o.y), 3.0).rgb) * 0.25;
      float lb = lum3(bl), ls = lum3(textureLod(tDiffuse, vUv, 1.0).rgb);
      col += bl / max(lb, 1e-3) * max(lb - 0.22 - 0.5 * ls, 0.0) * uHal * 1.6 * uLookK;
    }
    // a faint anamorphic streak: only the hottest highlights, smeared sideways over six taps, in their own colour
    if (uStr > 0.001) {
      float sx = uRes.y / 900.0 * 26.0 / uRes.x; vec3 acc = vec3(0.0);
      for (int i = 1; i <= 3; i++) {
        float fi = float(i), w = exp(-fi * 0.55);
        vec3 s1 = textureLod(tDiffuse, vUv + vec2(fi * sx, 0.0), 2.0).rgb, s2 = textureLod(tDiffuse, vUv - vec2(fi * sx, 0.0), 2.0).rgb;
        acc += w * (s1 / max(lum3(s1), 1e-3) * max(lum3(s1) - 0.7, 0.0) + s2 / max(lum3(s2), 1e-3) * max(lum3(s2) - 0.7, 0.0));
      }
      col += acc * uStr * 0.5 * uLookK;
    }
    col = mix(col, grade(col), uGradeOn * uLookK);
  }

  // vignette (v20: neutral, the corners darken and keep their hue)
  col *= 1.0 - smoothstep(0.38, 1.08, r) * uVig * uVigK;

  // film grain (24 fps, triangular, strongest in the dark-mids) doubles as dither for the haze
  float ft = floor(uTime * 24.0);
  vec2 fc = gl_FragCoord.xy + vec2(ft * 17.13, ft * 31.77);
  float n = hash12(fc) + hash12(fc + 71.3) - 1.0;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += n * uGrain * uGB.y * (0.55 + 0.9 * smoothstep(0.0, 0.25, lum) * (1.0 - smoothstep(0.35, 0.95, lum)));

  if (uLimit < 1.0) col = limiter(col);
  col *= uFade;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`

// v4: soft-clip the HDR particle sum BEFORE bloom. Dense forms stack tens of additive particles per pixel; fed raw
// into the bloom they turn into a white slab. Clipping the ceiling to `ceil` (hue kept) keeps the glow proportional
// to the picture, so bloom only lifts dense highlights and never blows a form out.
const COMPRESS_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse; uniform float uCeil, uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  // one NaN / Inf pixel (a stage shader that raises a negative to a power, say) would spread through the bloom and black the whole frame: drop it here
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  float m = max(c.r, max(c.g, c.b));
  if (uCeil > 0.0 && m > uKnee) { float o = uKnee + (uCeil - uKnee) * (1.0 - exp(-(m - uKnee) / (uCeil - uKnee))); c *= o / m; }
  gl_FragColor = vec4(c, 1.0);
}`

// Exposure meter: the composer's targets carry a mip chain, so the top mip is the mean of the whole frame.
// It is written to one RGBA8 pixel (sqrt-encoded, range 0..4) and read back asynchronously.
const METER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec3 m = textureLod(tDiffuse, vec2(0.5), 14.0).rgb;
  float l = dot(m, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(sqrt(clamp(l * 0.25, 0.0, 1.0)), 0.0, 0.0, 1.0);
}`
class MeterPass extends Pass {
  private quad: FullScreenQuad
  constructor(private mat: THREE.ShaderMaterial, private target: THREE.WebGLRenderTarget) {
    super(); this.needsSwap = false; this.quad = new FullScreenQuad(mat)
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    this.mat.uniforms.tDiffuse.value = read.texture
    renderer.setRenderTarget(this.target); this.quad.render(renderer)
  }
  dispose() { this.quad.dispose() }
}

// the stock luminosity high-pass plus the mesh mask (depth < 1 means a mesh was drawn there)
const HIGHPASS_FRAG = /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform vec3 defaultColor; uniform float defaultOpacity, luminosityThreshold, smoothWidth, uMask;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  float v = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  float a = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
  float solid = 1.0 - step(0.999999, texture2D(tDepth, vUv).r);
  a *= 1.0 - uMask * solid;
  gl_FragColor = mix(vec4(defaultColor.rgb, defaultOpacity), texel, a);
}`

/** The scene pass. Draws the scene into the (multisampled) scene target, then resolves it into the composer's write buffer through the
 *  pre-bloom soft clip (one full-screen draw, the same one the old standalone compress pass made). The scene target keeps its depth
 *  texture (three.js blits the multisampled depth into it), which the bloom mask and the focus blur read. */
class ScenePass extends Pass {
  private quad: FullScreenQuad
  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private target: THREE.WebGLRenderTarget, private mat: THREE.ShaderMaterial) {
    super(); this.needsSwap = true; this.quad = new FullScreenQuad(mat)
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha(), ac = renderer.autoClear
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 1); renderer.autoClear = true
    renderer.render(this.scene, this.camera)
    renderer.setClearColor(cc, ca); renderer.autoClear = ac
    this.mat.uniforms.tDiffuse.value = this.target.texture
    renderer.setRenderTarget(writeBuffer); this.quad.render(renderer)
  }
  dispose() { this.quad.dispose() }
}

// Mesh-only rack focus. Pass 1 (half resolution): for each pixel whose nearest surface is a mesh (depth < 1) and lies beyond 1.6x the focus
// distance, a 12-tap disc blur of radius uMaxPx * coc (<= 3 px of the full-resolution frame), ignoring taps that are non-mesh or nearer than
// the pixel by more than 8 percent (so the subject never bleeds onto the far surface). Pass 2 (full resolution): the blurred colour is mixed
// in by the same coc, so a pixel at or in front of the focus band is bit-identical to the sharp frame. Particles keep their own focus (uFocus).
const DOF_BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor, tDepth; uniform vec2 uTexel;
uniform float uNear, uFar, uFocus, uMaxPx;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  float d0 = texture2D(tDepth, vUv).r;
  vec3 c0 = textureLod(tColor, vUv, 0.0).rgb;
  float L0 = lin(d0);
  float coc = d0 < 0.999999 ? smoothstep(1.6 * uFocus, 2.6 * uFocus, L0) : 0.0;
  if (coc < 0.01) { gl_FragColor = vec4(c0, 0.0); return; }
  float R = uMaxPx * coc;
  vec3 acc = c0; float ws = 1.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 12.0);
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * R * uTexel;
    float d = texture2D(tDepth, uv).r;
    float w = (d < 0.999999 && lin(d) > L0 * 0.92) ? 1.0 : 0.0;
    acc += textureLod(tColor, uv, 0.0).rgb * w; ws += w;
  }
  gl_FragColor = vec4(acc / ws, coc);
}`
const DOF_COMP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor, tDepth, tBlur;
uniform float uNear, uFar, uFocus;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  vec4 c = textureLod(tColor, vUv, 0.0);
  float d = texture2D(tDepth, vUv).r;
  float coc = d < 0.999999 ? smoothstep(1.6 * uFocus, 2.6 * uFocus, lin(d)) : 0.0;
  if (coc > 0.01) c.rgb = mix(c.rgb, texture2D(tBlur, vUv).rgb, coc);
  gl_FragColor = vec4(c.rgb, 1.0);
}`
class DofPass extends Pass {
  private quad: FullScreenQuad
  readonly blurRT: THREE.WebGLRenderTarget
  private blurMat: THREE.ShaderMaterial; private compMat: THREE.ShaderMaterial
  constructor(private camera: THREE.PerspectiveCamera, private depthU: { value: THREE.Texture | null }, w: number, h: number) {
    super(); this.needsSwap = true
    this.blurRT = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { type: THREE.HalfFloatType, depthBuffer: false })
    const shared = { uNear: { value: 0.05 }, uFar: { value: 120 }, uFocus: { value: 9 } }
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: DOF_BLUR_FRAG, depthTest: false, depthWrite: false, uniforms: { tColor: { value: null }, tDepth: this.depthU, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uMaxPx: { value: 3 }, ...shared } })
    this.compMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: DOF_COMP_FRAG, depthTest: false, depthWrite: false, uniforms: { tColor: { value: null }, tDepth: this.depthU, tBlur: { value: this.blurRT.texture }, ...shared } })
    this.quad = new FullScreenQuad(this.blurMat)
  }
  focus = 9
  setSize(w: number, h: number) { this.blurRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.blurMat.uniforms.uTexel.value.set(1 / w, 1 / h) }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    for (const m of [this.blurMat, this.compMat]) { m.uniforms.uNear.value = this.camera.near; m.uniforms.uFar.value = this.camera.far; m.uniforms.uFocus.value = this.focus }
    this.blurMat.uniforms.tColor.value = readBuffer.texture; this.compMat.uniforms.tColor.value = readBuffer.texture
    this.quad.material = this.blurMat; renderer.setRenderTarget(this.blurRT); this.quad.render(renderer)
    this.quad.material = this.compMat; renderer.setRenderTarget(writeBuffer); this.quad.render(renderer)
  }
  dispose() { this.quad.dispose(); this.blurRT.dispose(); this.blurMat.dispose(); this.compMat.dispose() }
}

export { OLD_GRADES as GRADES, LOOKS, type GradeSpec } from './grade'

/** the cheapest GPU timer there is: EXT_disjoint_timer_query_webgl2 around named blocks, polled a frame or two later (null when the context has no timer) */
export class GpuTimer {
  readonly ms: Record<string, number> = {}
  private gl: WebGL2RenderingContext; private ext: any; private open: { q: WebGLQuery; name: string }[] = []; private cur: WebGLQuery | null = null
  constructor(renderer: THREE.WebGLRenderer) { this.gl = renderer.getContext() as WebGL2RenderingContext; this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') }
  get supported() { return !!this.ext }
  begin(name: string) {
    if (!this.ext || this.cur || this.open.length > 24) return
    const q = this.gl.createQuery()!; this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.cur = q; this.open.push({ q, name })
  }
  end() { if (this.cur) { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.cur = null } }
  poll() {
    if (!this.ext) return
    const gl = this.gl, disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT)
    while (this.open.length && this.open[0].q !== this.cur) {
      const o = this.open[0]
      if (!gl.getQueryParameter(o.q, gl.QUERY_RESULT_AVAILABLE)) break
      this.open.shift()
      if (!disjoint) { const v = gl.getQueryParameter(o.q, gl.QUERY_RESULT) / 1e6; this.ms[o.name] = this.ms[o.name] === undefined ? v : this.ms[o.name] * 0.9 + v * 0.1 }
      gl.deleteQuery(o.q)
    }
  }
}

export interface PostSettings {
  bloomStrength: number; bloomRadius: number; bloomThreshold: number; bloomKnee: number
  grain: number; vignette: number; /** @deprecated ignored since v4 (no global CA) */ aberration: number; /** @deprecated ignored since v4 (no global barrel warp) */ warp: number; haze: number; exposure: number; knee: number
  /** auto-exposure: hold the frame mean luminance at `target` by scaling the particles (never below `min`, never above `max`) */
  autoExposure: boolean; target: number; min: number; max: number
  /** v4: ceiling of the pre-bloom soft clip (HDR units; 0 = off) */
  preCeil: number
  /** v8: 0..1, how much of the bloom input is removed where a mesh (TV, chain, glass) is the nearest surface */
  bloomMask: number
  /** w12: asymptote of the highlight shoulder (1 = the old curve), how far overflow burns toward neutral, and the ceiling of the final limiter (1 = off) */
  asym: number; burn: number; limit: number
}
/** the pre-w12 chain (?post=old): the "before" of every before / after measurement */
export const OLD_POST: PostSettings = {
  bloomStrength: 0.7, bloomRadius: 0.7, bloomThreshold: 0.7, bloomKnee: 0.6,
  grain: 0.01, vignette: 0.36, aberration: 0, warp: 0, haze: 0, exposure: 1.0, knee: 0.7,
  autoExposure: true, target: 0.15, min: 0.15, max: 1.5, preCeil: 2.0, bloomMask: 0.92, asym: 1, burn: 0.55, limit: 1,
}
export const DEFAULT_POST: PostSettings = {
  ...OLD_POST,
  // w12: a higher, wider bloom threshold so only truly hot cores glow, a slightly lower strength, a lower shoulder knee that settles at 0.93,
  // and a limiter whose ceiling (0.972 = 248/255) nothing can pass
  bloomStrength: 0.62, bloomThreshold: 0.78, bloomKnee: 0.75, knee: 0.62, asym: 0.93, burn: 0.35, limit: 0.972,
}

export interface Post {
  composer: EffectComposer
  bloom: UnrealBloomPass
  final: ShaderPass
  settings: PostSettings
  /** 0..1 intro fade */
  setFade(v: number): void
  /** multiplier on the final exposure (1 = none); the field dims mid-morph with it */
  setDim(v: number): void
  /** the music-driven look (src/v3/world/extras/vibe.ts): uniforms of the final pass, uVibe 0 = off (the default) */
  readonly vibe: { [k: string]: { value: any } }
  /** the frame-mean luminance (before the final pass) as a 1x1 RGBA8 texture: r = sqrt(mean / 4). The field's GPU auto-exposure samples it; it is NEVER read back to the CPU
   *  (readRenderTargetPixelsAsync ends in a synchronous getBufferSubData round trip to Chrome's GPU process, ~16 ms each, every 3rd frame). */
  readonly meterTexture: THREE.Texture
  /** true once the meter pass has drawn at least once (before that the texture is empty) */
  readonly meterReady: boolean
  /** the frame meter is only needed when the field is not metering its particles itself (the world mode does); off = the pass is skipped */
  setMeterOn(on: boolean): void
  /** w12: the multisampled scene target (colour + depth texture); `samples` 0 means the SMAA fallback or no antialiasing */
  readonly sceneTarget: THREE.WebGLRenderTarget
  readonly aa: 'msaa' | 'smaa' | 'none'
  /** w12: the area grade. Call every frame with the origin area, the destination area and the leg's eased progress (0 while dwelling). */
  setGrade(a: AreaId, b: AreaId, t: number): void
  readonly gradeState: { enabled: boolean; area: string; lift: number[]; gain: number[]; sat: number }
  /** w12: mesh rack focus. `subject` is the camera-to-subject distance of the stop, `arrived` is true while the camera stands at it. Call every frame. */
  setSubject(subject: number, arrived: boolean, dt: number, stop?: number): void
  readonly dof: { enabled: boolean; focus: number; subject: number }
  /** w12: quality tier from the field's governor: tier >= 2 (and phones) drop MSAA and the focus blur */
  setTier(tier: number): void
  /** per-pass GPU milliseconds (EXT_disjoint_timer_query_webgl2; empty when unavailable). Only filled with ?prof=1 or after profile(true). */
  readonly gpu: GpuTimer
  profile(on: boolean): void
  /** test hooks: switch a w12 feature at run time */
  debug: { setSamples(n: number): void; dof(on: boolean): void; grade(on: boolean): void; look(id: string | null): void; repack(): void; /** the live look table (same objects the packed vectors are built from) */ looks: typeof LOOKS }
  setSize(w: number, h: number, dpr: number): void
  render(dt: number, time: number): void
  apply(): void
  dispose(): void
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number, dpr: number): Post {
  const settings = { ...(FLAGS.old ? OLD_POST : DEFAULT_POST) }
  const phone = isPhone()
  const W = () => Math.max(1, Math.round(w * dpr)), H = () => Math.max(1, Math.round(h * dpr))
  // the composer's ping-pong targets: HalfFloat, no depth (the scene target owns it), a mip chain for the meter and the half-res bloom input
  const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, depthBuffer: false })
  const composer = new EffectComposer(renderer, rt)
  composer.setPixelRatio(dpr)
  composer.setSize(w, h)
  for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.texture.generateMipmaps = true; t.texture.minFilter = THREE.LinearMipmapLinearFilter }

  // ---- antialiasing: 4x MSAA scene target on desktop; SMAA if multisampling is unavailable (or ?aa=smaa); nothing on phones / low tiers / ?aa=0
  const maxSamples = (renderer.capabilities as { maxSamples?: number }).maxSamples ?? 0
  const wantAA = FLAGS.old ? '0' : FLAGS.aa
  const asked = wantAA === '0' || wantAA === 'none' ? 0 : wantAA === 'smaa' ? -1 : wantAA && +wantAA > 0 ? Math.min(maxSamples, +wantAA) : 4
  // 4x at 1x pixel density; at 1.4x and up (a retina screen already has twice the edge samples) 2x, which keeps the particle blend cost in budget
  const wantSamples = () => phone ? 0 : asked === -1 ? 0 : Math.min(maxSamples, asked === 4 && dpr >= 1.4 ? 2 : asked)
  const smaaWanted = !phone && (asked === -1 || (asked > 0 && maxSamples < 1))
  let samples = wantSamples()
  const sceneRT = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, depthBuffer: true, samples })
  sceneRT.depthTexture = new THREE.DepthTexture(W(), H())
  const depthU: { value: THREE.Texture | null } = { value: sceneRT.depthTexture }

  // ---- passes
  const cmat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: COMPRESS_FRAG, depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null }, uCeil: { value: settings.preCeil }, uKnee: { value: 0.8 } } })
  const scenePass = new ScenePass(scene, camera, sceneRT, cmat)
  const dofPass = new DofPass(camera, depthU, W(), H())
  const dof = { enabled: false, focus: 9, subject: 9 }
  const dofAllowed = () => !phone && FLAGS.dof && !FLAGS.old && tierOK
  let tierOK = true, dofOff = false
  dofPass.enabled = false
  const bloom = new UnrealBloomPass(new THREE.Vector2(w * dpr, h * dpr), settings.bloomStrength, settings.bloomRadius, settings.bloomThreshold)
  ;(bloom.highPassUniforms as any).smoothWidth.value = settings.bloomKnee // wide knee: no hard pop at the threshold
  const hp = bloom.materialHighPassFilter
  hp.uniforms.tDepth = depthU; hp.uniforms.uMask = { value: settings.bloomMask }
  hp.fragmentShader = HIGHPASS_FRAG; hp.needsUpdate = true
  const smaa = smaaWanted ? new SMAAPass() : null
  if (smaa) smaa.setSize(W(), H())

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(w * dpr, h * dpr) },
      uTime: { value: 0 }, uGrain: { value: settings.grain }, uVig: { value: settings.vignette },
      uExposure: { value: settings.exposure }, uFade: { value: 0 }, uHaze: { value: settings.haze },
      uKnee: { value: settings.knee }, uAsym: { value: settings.asym }, uBurn: { value: settings.burn }, uLimit: { value: settings.limit },
      uGradeOn: { value: 0 }, uLookK: { value: 1 }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uGamma: { value: new THREE.Vector3(1, 1, 1) },
      uCSVF: { value: new THREE.Vector4(1, 1, 0, 0) },
      uHal: { value: 0 }, uStr: { value: 0 }, uVigK: { value: 1 }, uGB: { value: new THREE.Vector2(0, 1) },
      uGround: { value: new THREE.Vector3(...GROUND) },
      uVibe: { value: 0 }, uWash: { value: 0 }, uGradeAmt: { value: 0 }, uSat: { value: 1 }, uPulse: { value: 0 }, uRain: { value: 0 }, uSpark: { value: 0 }, uGlowMode: { value: 0 },
      uRip: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0.5, 0.5, 0, 0)) },
      uPA: { value: new THREE.Vector3() }, uPB: { value: new THREE.Vector3() }, uPC: { value: new THREE.Vector3() }, uGrade: { value: new THREE.Vector3(1, 1, 1) },
      uFlCol: { value: new THREE.Vector3(1, 1, 1) }, uRainCol: { value: new THREE.Vector3(0.6, 0.65, 0.75) }, uSparkCol: { value: new THREE.Vector3(0.7, 0.85, 1) }, uGlowCol: { value: new THREE.Vector3(1, 0.6, 0.3) },
      uFl: { value: new THREE.Vector4(0.5, 0.5, 0, 14) }, uGlow: { value: new THREE.Vector4(0.5, 0.5, 0, 0.1) }, uGlowR: { value: new THREE.Vector2(0.2, 0.1) },
    },
  })
  const meterRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
  const meterMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: METER_FRAG, depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null } } })
  const meter = new MeterPass(meterMat, meterRT); meter.enabled = false
  const final = new ShaderPass(mat, 'tDiffuse')
  composer.addPass(scenePass); composer.addPass(dofPass); composer.addPass(bloom)
  if (smaa) composer.addPass(smaa)
  composer.addPass(meter); composer.addPass(final)
  let metered = false, meterOn = true, frameNo = 0

  const u = mat.uniforms
  let dim = 1
  const apply = () => {
    bloom.strength = settings.bloomStrength; bloom.radius = settings.bloomRadius; bloom.threshold = settings.bloomThreshold
    ;(bloom.highPassUniforms as any).smoothWidth.value = settings.bloomKnee
    hp.uniforms.uMask.value = settings.bloomMask
    u.uGrain.value = settings.grain; u.uVig.value = settings.vignette
    cmat.uniforms.uCeil.value = settings.preCeil > 0 ? Math.max(0.9, settings.preCeil) : 0
    u.uHaze.value = settings.haze; u.uExposure.value = settings.exposure * dim; u.uKnee.value = settings.knee
    u.uAsym.value = settings.asym; u.uBurn.value = settings.burn; u.uLimit.value = settings.limit
  }
  apply()

  // ---- per-area grade (v17): every look is a packed parameter vector (grade.ts); the target is the lerp of two looks along the leg, the live vector follows it damped, so a rail jump never pops
  const gOn = { v: FLAGS.grade && !FLAGS.old }
  const looks = FLAGS.gradeOld ? OLD_LOOKS : LOOKS
  const packed = Object.fromEntries((Object.keys(looks) as LookId[]).map(k => [k, pack(looks[k]) as Float32Array])) as Record<LookId, Float32Array>
  const gcur = new Float32Array(NEUTRAL_VEC as Float32Array), gtgt = new Float32Array(NEUTRAL_VEC as Float32Array)
  let gArea: string = 'hub'
  const gradeState = { enabled: gOn.v, area: 'hub', lift: [0, 0, 0] as number[], gain: [1, 1, 1] as number[], sat: 1 }
  const sm01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }
  let gSnap = false, lastStop = -1
  const epi = WAYPOINTS.findIndex(w => w.id === 'epilogue')
  let forced: LookId | null = null
  // the night-sky finale shares the hub's area id; it is told apart by the stop the flight reports through setSubject (the leg into it starts at the stop before)
  const lookOf = (a: AreaId, isDst: boolean): LookId => {
    if (a === 'hub' && epi >= 0 && (lastStop === epi || (isDst && lastStop === epi - 1))) return 'finale'
    return a
  }
  function setGrade(a: AreaId, b: AreaId, t: number) {
    const k = sm01(t), la = forced ?? lookOf(a, false), lb = forced ?? lookOf(b, true)
    const A = packed[la] ?? packed.hub, B = packed[lb] ?? packed.hub
    gArea = k < 0.5 ? la : lb
    for (let i = 0; i < GN; i++) gtgt[i] = A[i] + (B[i] - A[i]) * k
  }

  // ---- rack focus (mesh DoF). In flight the focus plane tracks 2.2x the subject distance (so beyond-1.6x blur has nothing to bite); on arrival it eases to the
  // subject over 0.6 s. The arrival is the camera standing at a stop, or the stop changing while it stands (teleports, rail jumps).
  const LEG_K = 2.2, ARRIVE = 0.6
  let wasArrived = false, arrT = 1, arrFrom = 9, lastDofStop = -1
  const gradeStop = (n: number) => { lastStop = n }
  function setSubject(subject: number, arrived: boolean, dt: number, stop = -1) {
    if (stop >= 0) gradeStop(stop)
    if (!(subject > 0.2)) return
    dof.subject = subject
    if (!arrived) { dof.focus = subject * LEG_K; wasArrived = false; arrT = 1; return }
    if (!wasArrived || stop !== lastDofStop) { arrT = 0; arrFrom = subject * LEG_K }
    wasArrived = true; lastDofStop = stop
    arrT = Math.min(1, arrT + dt / ARRIVE)
    dof.focus = arrFrom + (subject - arrFrom) * sm01(arrT)
  }

  // ---- GPU timing (?prof=1)
  const gpu = new GpuTimer(renderer)
  let prof = FLAGS.prof
  const wrapped = new Set<Pass>()
  function profile(on: boolean) {
    prof = on
    if (!on || !gpu.supported) return
    for (const p of composer.passes) {
      if (wrapped.has(p)) continue
      wrapped.add(p)
      const name = p === scenePass ? 'scene+msaa+compress' : p === dofPass ? 'dof' : p === bloom ? 'bloom' : p === final ? 'final' : p === meter ? 'meter' : p === smaa ? 'smaa' : p.constructor.name
      const r = p.render.bind(p) as (...a: unknown[]) => void
      ;(p as unknown as { render: (...a: unknown[]) => void }).render = (...a) => { if (prof) gpu.begin(name); r(...a); if (prof) gpu.end() }
    }
  }
  if (prof) profile(true)

  function setSamples(n: number) {
    n = Math.max(0, Math.min(maxSamples, n))
    if (n === samples) return
    samples = n; sceneRT.samples = n; sceneRT.dispose() // rebuilds the framebuffers (and the depth texture's) on the next render
  }
  const sizeAll = (W_: number, H_: number, D: number) => {
    w = W_; h = H_; dpr = D
    composer.setPixelRatio(D); composer.setSize(W_, H_)
    sceneRT.setSize(W(), H()); dofPass.setSize(W(), H()); smaa?.setSize(W(), H())
    setSamples(tierOK ? wantSamples() : 0)
    u.uRes.value.set(W_ * D, H_ * D)
  }
  return {
    composer, bloom, final, settings, apply, vibe: u as any, gpu, profile,
    get sceneTarget() { return sceneRT },
    get aa() { return samples > 0 ? 'msaa' as const : smaa ? 'smaa' as const : 'none' as const },
    setGrade, gradeState, dof, setSubject,
    debug: { setSamples: (n: number) => setSamples(n), dof(on) { dofOff = !on }, grade(on) { gOn.v = on; gradeState.enabled = on; gSnap = true }, look(id) { forced = (id as LookId | null); gSnap = true },
      /** re-read LOOKS (mutated live from the console / grade-check) into the packed vectors */
      repack() { for (const k of Object.keys(looks) as LookId[]) pack(looks[k], packed[k]); gSnap = true }, looks },
    setTier(tier) {
      tierOK = tier <= 1
      setSamples(tierOK ? wantSamples() : 0)
      if (smaa) smaa.enabled = !phone
    },
    setFade(v) { u.uFade.value = v },
    setDim(v) { dim = v; u.uExposure.value = settings.exposure * dim },
    setSize(W_, H_, D) { sizeAll(W_, H_, D) },
    get meterTexture() { return meterRT.texture },
    get meterReady() { return metered },
    setMeterOn(on) { meterOn = on },
    render(dt, time) {
      u.uTime.value = time
      // grade: damp the live vector toward the blended target (tau 0.3 s), then write the uniforms
      {
        const on = gOn.v, k = gSnap ? 1 : 1 - Math.exp(-Math.min(0.1, dt) / 0.3); gSnap = false
        let away = 0
        for (let i = 0; i < GN; i++) { gcur[i] += ((on ? gtgt[i] : (NEUTRAL_VEC as Float32Array)[i]) - gcur[i]) * k; away += Math.abs(gcur[i] - (NEUTRAL_VEC as Float32Array)[i]) }
        u.uGradeOn.value = away > 2e-3 ? 1 : 0
        if (u.uGradeOn.value) {
          const g = gcur
          u.uLift.value.set(g[0], g[1], g[2]); u.uGain.value.set(g[3], g[4], g[5]); u.uGamma.value.set(g[6], g[6], g[6])
          u.uCSVF.value.set(g[GI.contrast], g[GI.sat], g[GI.vibrance], g[GI.film])
          u.uHal.value = g[GI.halation]; u.uStr.value = g[GI.streak]; u.uVigK.value = g[GI.vig]
          u.uGB.value.set(0, g[GI.grain])
          if (phone || !tierOK) { u.uHal.value = 0; u.uStr.value = 0 } // halation + streak (11 extra taps) are for desktop tiers 0-1 only
        } else { u.uVigK.value = 1; u.uGB.value.set(0, 1) }
        gradeState.area = gArea; gradeState.sat = gcur[GI.sat]; for (let i = 0; i < 3; i++) { gradeState.lift[i] = gcur[i]; gradeState.gain[i] = gcur[3 + i] }
      }
      // focus blur: on only while a subject is set, on desktop, in tiers 0-1
      dofPass.enabled = dof.enabled = !dofOff && dofAllowed() && dof.subject > 0.2 && dof.focus < 80
      dofPass.focus = dof.focus
      const due = meterOn && (++frameNo % 3 === 0)
      meter.enabled = due
      composer.render(dt)
      if (prof) gpu.poll()
      if (due) metered = true
    },
    dispose() { cmat.dispose(); composer.dispose(); bloom.dispose(); mat.dispose(); rt.dispose(); sceneRT.dispose(); scenePass.dispose(); dofPass.dispose(); smaa?.dispose(); meterRT.dispose(); meterMat.dispose(); meter.dispose() },
  }
}
