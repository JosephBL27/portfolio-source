// The hall's surface material (unit 10H): the shared procedural stage material (transitions/common.ts: limestone courses, oak planks, iron, brass, polished
// flags, cloth, stained glass) with the room's own lighting patched in, so the hall costs one shader and no extra scene lights:
//   * five coloured window lights (one per interest) that wash columns and walls, and brighten when their window is hovered or is the stop you are at
//   * the polished floor shows the real windows twice, analytically: the sun patches they throw down the nave (the window picture projected on the flags)
//     and their mirror image in the floor (fresnel, blurred by roughness through the atlas mips). No render target, no extra pass.
//   * new surface kinds: 11 green banker's-lamp glass, 12 candle flame
//   * the copy lane DIMS the stone instead of cutting holes in it (a room with holes in its walls is not a room)
import * as THREE from 'three'
import { stageMaterial, type MatOpts, type Shared } from '../transitions/common'
import { HALL, HALL_PITCH } from '../../layout'

export const WIN = { w: 2.5, h: 9.2, sill: 6.0 } // a lancet, hall-local units (w11: raised to read from the door); the end wall plane is d = HALL.len
export interface HallUniforms {
  uWinPos: { value: THREE.Vector3[] }
  uWinCol: { value: THREE.Color[] }
  uWinI: { value: number[] }
  uGain: { value: number[] }
  tGlass: { value: THREE.Texture | null }
  uCamL: { value: THREE.Vector3 }
  uHallLit: { value: number }
  uProj: { value: number }
  uLamp: { value: THREE.Color }
  /** per-window share of the room's colour: 1 under the pointer, ~0.35 otherwise (the floor patch and the mirror image scale with it) */
  uSunK: { value: number[] }
}
export function makeHallUniforms(): HallUniforms {
  return {
    uWinPos: { value: Array.from({ length: 5 }, () => new THREE.Vector3()) }, uWinCol: { value: Array.from({ length: 5 }, () => new THREE.Color(1, 1, 1)) },
    uWinI: { value: [1, 1, 1, 1, 1] }, uGain: { value: [1, 1, 1, 1, 1] }, tGlass: { value: null }, uCamL: { value: new THREE.Vector3(0, 2.4, 8) },
    uHallLit: { value: 1 }, uProj: { value: 1 }, uLamp: { value: new THREE.Color(1.0, 0.56, 0.18) }, uSunK: { value: [0.35, 0.35, 0.35, 0.35, 0.35] },
  }
}

const EXTRA = /* glsl */ `
uniform vec3 uWinPos[5]; uniform vec3 uWinCol[5]; uniform float uWinI[5]; uniform float uGain[5]; uniform float uSunK[5];
uniform sampler2D tGlass; uniform vec3 uCamL, uLamp; uniform float uHallLit, uProj;
const float HL = ${HALL.len.toFixed(2)}, WP = ${HALL_PITCH.toFixed(3)}, WW = ${WIN.w.toFixed(3)}, WH = ${WIN.h.toFixed(3)}, WS = ${WIN.sill.toFixed(3)};
// the window picture at a point of the end-wall plane (hall-local x, y): rgb, 0 outside every lancet
vec3 glassAt(vec2 hit, float lod, out int which) {
  which = 0;
  float fi = clamp(floor(2.5 - hit.x / WP), 0.0, 4.0); which = int(fi);
  float xc = (2.0 - fi) * WP;
  float u = 0.5 - (hit.x - xc) / WW, v = (hit.y - WS) / WH;
  if (u <= 0.0 || u >= 1.0 || v <= 0.0 || v >= 1.0) return vec3(0.0);
  return textureLod(tGlass, vec2((fi + u) / 5.0, v), lod).rgb * uGain[which];
}
vec3 hallExtra(vec3 alb, float rough, float metal, vec3 N, vec3 V, int k) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 Lv = uWinPos[i] - vW; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(max(d2, 1e-3));
    float att = 1.0 / (1.0 + d2 * 0.0042);
    float nl = max(dot(N, L) * 0.7 + 0.3, 0.0);
    vec3 H = normalize(L + V); float sp = pow(max(dot(N, H), 0.0), mix(110.0, 8.0, rough)) * (1.0 - rough * 0.7);
    acc += uWinCol[i] * uWinI[i] * att * (alb * (1.0 - metal) * nl * 1.9 + vec3(sp) * 0.3);
  }
  if (k == 4) {
    // polished flags: the sun patches and the mirror image of the end wall
    vec3 Pl = vL; vec3 Vl = normalize(uCamL - Pl);
    float fr = 0.16 + 0.84 * pow(1.0 - clamp(Vl.y, 0.0, 1.0), 4.0);
    vec3 R = vec3(-Vl.x, Vl.y, -Vl.z);
    if (R.z > 0.02) {
      float s = (HL - 0.5 - Pl.z) / R.z; vec2 hit = vec2(Pl.x + R.x * s, R.y * s); int w1;
      vec3 g = glassAt(hit, 1.4 + rough * 5.0 + s * 0.05, w1);
      acc += g * fr * (1.0 - rough * 0.8) * 0.62 * (0.45 + 0.55 * uSunK[w1]) * smoothstep(0.0, 0.5, R.y);
    }
    float s2 = (HL - 0.5 - Pl.z) / 0.83; vec2 hp = vec2(Pl.x + s2 * 0.1, s2 * 0.55); int w2;
    vec3 sun = glassAt(hp, 1.2 + s2 * 0.045, w2);
    acc += sun * uProj * 0.55 * uSunK[w2] * smoothstep(0.0, 1.5, s2);
  }
  return acc * uHallLit;
}
`

/** a stage material with the hall's lighting; `u` is shared by every hall material */
export function hallMaterial(sh: Shared, u: HallUniforms, o: MatOpts = {}): THREE.ShaderMaterial {
  const m = stageMaterial(sh, o)
  let f = m.fragmentShader
  const swap = (a: string, b: string) => { if (!f.includes(a)) console.warn('[hall] shader patch missed:', a.slice(0, 40)); f = f.replace(a, b) }
  swap('void main() {', EXTRA + '\nvoid main() {')
  swap('    if (dn >= thr - uCopy * inLane * 1.5) discard;\n', '')
  swap('if (uDissolve < 0.995 || uCopy > 0.002) {', 'if (uDissolve < 0.995) {')
  swap('float n1 = fbm(P * 2.6), n2 = vn(P * 15.0), n3 = vn(P * 40.0);', 'float n1 = fbm2(P * 2.6), n2 = vn(P * 15.0), n3 = 0.5;')
  // w11: the site's idiom is a black ground with light-built forms: the stone sits ~25% darker, the joints are anti-aliased (fwidth), the bump and the
  // specular are cut (they shimmered on the floor and the walls), and the lamp domes are dark brass with a warm amber glow instead of saturated green glass
  swap('float joint = 1.0 - smoothstep(0.010, 0.034, e);', 'float jw = fwidth(e); float joint = 1.0 - smoothstep(0.010, 0.034 + jw * 1.2, e); joint = mix(joint, 0.07, smoothstep(0.03, 0.14, jw));')
  swap('s.ao = 1.0 - 0.4 * joint - 0.12 * (1.0 - bevel); s.bump = 0.7;', 's.ao = 1.0 - 0.4 * joint - 0.12 * (1.0 - bevel); s.bump = 0.5 * (1.0 - smoothstep(0.02, 0.1, jw));')
  swap('float joint = 1.0 - smoothstep(0.012, 0.04, e);', 'float jw = fwidth(e); float joint = 1.0 - smoothstep(0.012, 0.04 + jw * 1.2, e); joint = mix(joint, 0.1, smoothstep(0.03, 0.14, jw));')
  swap('s.ao = 1.0 - 0.5 * joint; s.bump = 0.35;', 's.ao = 1.0 - 0.5 * joint; s.bump = 0.2 * (1.0 - smoothstep(0.02, 0.1, jw));')
  swap('F0 * sp * 2.2', 'F0 * sp * 1.0')
  swap('grad * s.bump * 0.2', 'grad * s.bump * 0.14')
  swap('  else if (k == 9) carvedS(P, N, s);', `  else if (k == 9) carvedS(P, N, s);
  else if (k == 11) { s.alb = vec3(0.3, 0.18, 0.07); s.rough = 0.34; s.metal = 0.85; s.h = 0.0; s.ao = 1.0; s.bump = 0.0; s.emis = uLamp * (0.12 + 0.62 * pow(max(dot(N, V), 0.0), 1.6)) * (0.94 + 0.06 * vn(P * 3.0 + uTime * 0.3)); }
  else if (k == 12) { s.alb = vec3(0.0); s.rough = 1.0; s.metal = 0.0; s.h = 0.0; s.ao = 1.0; s.bump = 0.0; s.emis = vec3(1.0, 0.72, 0.34) * (2.2 + 0.7 * vn(P * 9.0 + uTime * 5.0)); }`)
  swap('  col *= s.ao;', '  col += hallExtra(s.alb, s.rough, s.metal, N, V, k);\n  col *= s.ao;')
  swap('  gl_FragColor = vec4(max(col, 0.0), 1.0);', '  col *= 1.0 - 0.72 * uCopy * (1.0 - laneMask());\n  gl_FragColor = vec4(max(col, 0.0), 1.0);')
  m.fragmentShader = f
  Object.assign(m.uniforms, u)
  return m
}

/** the copy lane dims a stage material instead of cutting holes in it (a front with holes in it is not a front) */
export function laneSafe(m: THREE.ShaderMaterial): THREE.ShaderMaterial {
  let f = m.fragmentShader
  const a = '    if (dn >= thr - uCopy * inLane * 1.5) discard;\n', b = '  col *= s.ao;'
  if (!f.includes(a) || !f.includes(b)) { console.warn('[hall] lane patch missed'); return m }
  f = f.replace(a, '').replace('if (uDissolve < 0.995 || uCopy > 0.002) {', 'if (uDissolve < 0.995) {').replace('  gl_FragColor = vec4(max(col, 0.0), 1.0);', '  col *= 1.0 - 0.6 * uCopy * (1.0 - laneMask());\n  gl_FragColor = vec4(max(col, 0.0), 1.0);')
  m.fragmentShader = f
  return m
}
