// SET PIECE (unit 8M): the curtain.  leg chomchom > secretary  (work -> systems; re-keyed w12).
// ALCHE's white sheet with a curved top edge, as a heavy stage curtain: a band of oxblood velvet taller than the screen climbs the frame from below. Its top edge is
// a valance of five scallops with a gold cord and rosettes at the cusps; its hem carries a gold braid and fringe and drags (a lateral sway that lags the climb).
// Deep folds hang down the cloth, sheen at the grazing edges, a travelling ripple while it moves. It covers the frame (a held, creeping beat), then lifts off the top.
// The particle world swaps behind it, and as the hem rises the page INKS INVERT: a strip of the new frame under the hem is shown as its negative (cream on dark
// becomes ink on paper) and bleeds back to the normal page over about a quarter of the screen, so the Systems area arrives out of a developing negative: the end of the Work chapter (a quant internship, two equity pitches, the recruiting build) hands over to the builds behind it.
// Everything is a pure function of leg progress u (the cloth is evaluated in the fragment shader from u; the inversion strip is a DOM element whose position and
// opacity are set from u), so scrolling back lowers the curtain and re-inks the frame in reverse. Reduced motion never flies (host): none of this shows.
//   u 0.06-0.42  the climb: the top edge rises from below the frame to the top; 0.42-0.58 the held beat (fully covered, creeping); 0.58-0.92 the hem leaves the top
// Cue: tr:curtain at u 0.18, the cloth lifts off the floor.
import * as THREE from 'three'
import { type Env, type FrameIn, type FrameOut, type Leg, type Piece, keys, precompile, sstep } from './common'
import { overlayBlend } from './collage'
import { LANE_GLSL, LANE_ON } from '../lib/lane'

const BAND = 3.6                         // the band is this tall in NDC (the screen is 2)
const TOP = keys([[0, -1.3], [0.06, -1.3], [0.2, -0.45], [0.42, 1.25], [0.58, 2.1], [0.76, 3.55], [0.92, 4.95], [1, 4.95]])

const VERT = /* glsl */ `
varying vec2 vN;
void main() { vN = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const FRAG = /* glsl */ `
precision highp float;
uniform float uU, uYT, uYB, uSpd, uCopy;
varying vec2 vN;
${LANE_GLSL}
const float PI = 3.14159265;
float h11(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
void main() {
  float asp = uRes.x / uRes.y, px = 2.0 / uRes.y;
  vec2 q = vN;
  float x = q.x + 0.04 * uSpd * sin(q.y * 1.7 - uU * 9.0);                    // the cloth lags sideways as it climbs
  // silhouette: a valance of five scallops on top, a wavering hem below
  float ph = fract((x * 0.5 + 0.5) * 5.0), sw = sin(PI * ph);
  float top = uYT - 0.17 * pow(sw, 0.85);
  float bot = uYB + 0.055 * uSpd * sin(x * 6.0 + uU * 11.0) + 0.016 * sin(x * 21.0 + 1.3);
  float inside = smoothstep(0.0, px * 1.5, top - q.y) * smoothstep(0.0, px * 1.5, q.y - bot);
  float v = clamp((top - q.y) / max(0.2, top - bot), 0.0, 1.0);                // 0 at the valance .. 1 at the hem
  // folds: deeper toward the hem, a ripple that travels up the cloth while it moves
  float A = 0.03 + 0.07 * v;
  float fph = 2.0 * PI * (4.2 * (x + 1.0) + 0.5 * sin(q.y * 1.9 + uU * 6.0) * (0.4 + uSpd) + 0.16 * sin(q.y * 5.0 - uU * 14.0) * uSpd + 0.22 * sin(x * 3.1 + q.y * 0.8));
  float sl = A * cos(fph) * 2.0 * PI * 4.2;
  vec3 n = normalize(vec3(-sl * 0.5, -0.12 * sin(fph * 0.5 + q.y * 3.0) * (0.5 + uSpd), 1.0));
  float crest = 0.5 + 0.5 * sin(fph);
  vec3 L = normalize(vec3(-0.45, 0.5, 0.75));
  float diff = max(dot(n, L), 0.0), graze = pow(1.0 - max(n.z, 0.0), 2.2);
  vec3 base = mix(vec3(0.15, 0.010, 0.026), vec3(0.34, 0.032, 0.058), crest);
  vec3 col = base * (0.30 + 1.0 * diff) * (0.58 + 0.42 * crest);
  col += vec3(0.95, 0.30, 0.34) * graze * 0.34;                                // velvet: the fibres catch light edge-on
  col += vec3(1.0, 0.7, 0.6) * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0) * 0.16;
  col *= 1.0 - 0.45 * pow(1.0 - v, 5.0);                                       // the cloth is gathered, darker, under the valance
  float a = inside;
  // gold: a cord along the valance, rosettes at the cusps, a braid above the hem, a fringe below it
  vec3 gold = vec3(0.86, 0.62, 0.22) * (0.55 + 0.7 * max(n.x * 0.3 + n.y * 0.4 + 0.7, 0.0));
  float cord = (1.0 - smoothstep(0.0, 0.007, abs(q.y - (top - 0.022)))) * step(q.y, top + 0.002);
  float rx = (floor((x * 0.5 + 0.5) * 5.0 + 0.5) / 5.0) * 2.0 - 1.0;
  float ros = 1.0 - smoothstep(0.02, 0.032, length((vec2(x, q.y) - vec2(rx, uYT - 0.003)) * vec2(asp, 1.0)));
  float braidB = smoothstep(0.0, px, q.y - bot) * (1.0 - smoothstep(0.034, 0.034 + px, q.y - bot));
  float braid = braidB * (0.65 + 0.35 * sin(x * asp * 95.0 + q.y * 80.0));
  col = mix(col, gold * 1.05, clamp(cord * 0.9 + ros + braid, 0.0, 1.0));
  // the fringe: strands of different lengths hanging from the hem
  float sid = floor(x * asp * 46.0), sf = fract(x * asp * 46.0);
  float len = 0.045 + 0.04 * h11(sid);
  float strand = (1.0 - smoothstep(0.1, 0.2, abs(sf - 0.5))) * smoothstep(0.0, px, bot - q.y) * (1.0 - smoothstep(len - px, len, bot - q.y));
  vec3 fcol = gold * (0.6 + 0.5 * h11(sid + 3.0));
  // the hem's shadow on the page below it
  float shade = 0.5 * exp(-max(bot - q.y, 0.0) * 8.0) * step(q.y, bot) * (1.0 - strand);
  float lm = 1.0 - uCopy * (1.0 - laneMask()) * 0.94;                          // the copy lane stays clear while copy is on screen
  float aa = a, ca = clamp(strand * 0.95, 0.0, 1.0);
  vec3 outc = col * aa + fcol * ca * (1.0 - aa);
  float outa = clamp(aa + ca * (1.0 - aa) + shade * (1.0 - aa) * (1.0 - ca), 0.0, 1.0);
  gl_FragColor = vec4(outc * lm, outa * lm);
}`

export function createCurtain(leg: Leg): Piece {
  let ok = false
  let mesh: THREE.Mesh | null = null
  let ink: HTMLDivElement | null = null
  const U = { uU: { value: 0 }, uYT: { value: -2 }, uYB: { value: -5 }, uSpd: { value: 0 }, uCopy: { value: 0 }, uLane: { value: null as THREE.Vector4 | null }, uRes: { value: null as THREE.Vector2 | null }, uLaneOn: LANE_ON }
  const piece: Piece = {
    leg,
    cues: [{ at: 0.18, name: 'tr:curtain' }],
    build(env: Env) {
      if (ok) return
      U.uLane.value = env.lane.u; U.uRes.value = env.res
      const g = new THREE.PlaneGeometry(2, 2)
      const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U as unknown as Record<string, THREE.IUniform> })
      overlayBlend(m, false)
      mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 100; mesh.visible = false; mesh.name = 'tr-curtain'; mesh.userData.noReflect = true
      env.scene.add(mesh)
      precompile(env, mesh)
      // the page-ink inversion: white under mix-blend-mode difference is the exact negative of whatever is beneath it (canvas and chrome alike)
      ink = document.createElement('div')
      ink.id = 'tr-ink'; ink.setAttribute('aria-hidden', 'true'); ink.setAttribute('data-proof', 'skip')
      const mask = 'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 16%, rgba(0,0,0,0.2) 48%, transparent 100%)'
      Object.assign(ink.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '28vh', pointerEvents: 'none', zIndex: '70', mixBlendMode: 'difference', background: '#fff', display: 'none', willChange: 'transform', maskImage: mask, webkitMaskImage: mask })
      document.body.appendChild(ink)
      ok = true
    },
    setVisible(v) { if (!v) { if (mesh) mesh.visible = false; if (ink) ink.style.display = 'none' } },
    frame(inp: FrameIn, out: FrameOut, env: Env) {
      if (!ok || !mesh) return
      const { u } = inp
      env.renderer.getDrawingBufferSize(env.res)
      const yT = TOP(u), yB = yT - BAND
      const spd = Math.min(1, Math.abs(TOP(Math.min(1, u + 0.01)) - TOP(Math.max(0, u - 0.01))) / 0.02 / 12)
      U.uU.value = u; U.uYT.value = yT; U.uYB.value = yB; U.uSpd.value = spd; U.uCopy.value = inp.copy
      mesh.visible = yT > -1.45 && yB < 1.2
      // the world is hidden while the cloth covers the whole frame (the swap happens behind it)
      const cov = sstep(0, 0.12, yT - 1.32) * sstep(0, 0.12, -1.32 - yB)
      out.field = 1 - cov; out.flash = 0
      // the inverted strip rides under the hem; it is only there once the hem is on screen
      if (ink) {
        const py = (1 - yB) / 2 * innerHeight
        const show = yB > -1 && yB < 1.35 && u < 0.96
        ink.style.display = show ? 'block' : 'none'
        if (show) { ink.style.transform = `translate3d(0, ${py.toFixed(1)}px, 0)`; ink.style.opacity = (sstep(-1.0, -0.78, yB) * (1 - sstep(1.05, 1.35, yB))).toFixed(3) }
      }
    },
    camera() { return null },
    dispose() { mesh?.removeFromParent(); mesh?.geometry.dispose(); ink?.remove() },
  }
  return piece
}
