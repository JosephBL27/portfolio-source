// Materials of the anatomical glass brain: the glass shell (both walls) and the etched vault graph inside it (nodes and links).
// Everything is premultiplied light on a dark wall (the world is dark); colours come from brainColor.ts so that the glass and the
// particle form always agree. The shell is drawn the way the rest of the site draws glass: no real refraction, but a fresnel rim,
// a thin-film tint that shifts with the view angle, the studio environment in the rim, and the folds of the cortex catching light.
import {
  Color, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector2, Vector3, Vector4, BackSide, FrontSide,
  type Side, type Texture,
} from 'three'
import { BRAIN_COLOR_GLSL } from './brainColor'

export const GROUPS = 10
const SLOTS = 4

const pulseGlsl = /* glsl */ `
uniform vec4 uPulseT;
uniform vec4 uPulseA;
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
}`

const common = /* glsl */ `
${pulseGlsl}
${BRAIN_COLOR_GLSL}
uniform float uGroupAlpha[${GROUPS}];
uniform vec3 uGroupColor[${GROUPS}];
uniform vec2 uMode;
uniform float uSweep;
uniform float uTime;
uniform float uCenterZ;
uniform float uFocus;
uniform float uK;
attribute vec4 aHop;
attribute float aGroup;
attribute float aHeat;
attribute float aZn;
attribute float aPh;
float isFocus() { return uFocus >= 0.0 && abs(aGroup - uFocus) < 0.5 ? 1.0 : 0.0; }
float depthFade(vec4 mv) { return mix(0.45, 1.0, smoothstep(-0.55, 0.45, (mv.z - uCenterZ) / uK)); }
`

const blend = {
  transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
} as const

const baseUniforms = (dpr: number) => ({
  uPulseT: { value: new Vector4() }, uPulseA: { value: new Vector4() },
  uGroupAlpha: { value: new Array(GROUPS).fill(1) },
  uGroupColor: { value: Array.from({ length: GROUPS }, () => new Color('#9aa3a8')) },
  uMode: { value: new Vector2(0, 0) }, uSweep: { value: 2 }, uTime: { value: 0 },
  uCenterZ: { value: -3 }, uFocus: { value: -1 }, uK: { value: 1 }, uDpr: { value: dpr }, uScale: { value: 4.4 },
  uPulseCol: { value: new Color(1, 0.94, 0.84) },
})

const premul = /* glsl */ `
vec4 premul(vec3 lin, float a, float add) {
  vec3 enc = linearToOutputTexel(vec4(max(lin, 0.0), 1.0)).rgb;
  return vec4(enc * a, a * (1.0 - add));
}`

/** the vault's notes: one round dot per note, hubs drawn as a ring with a centre dot */
export function etchNodes(dpr: number): ShaderMaterial {
  return new ShaderMaterial({
    name: 'BrainEtchNodes', uniforms: baseUniforms(dpr), ...blend,
    vertexShader: /* glsl */ `
      ${common}
      uniform float uDpr; uniform float uScale;
      attribute float aDegree;
      varying float vP; varying float vA; varying float vHub; varying float vSize; varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float p = pulseAt(aHop);
        vP = p;
        float g = uGroupAlpha[int(aGroup + 0.5)];
        vec3 fc = uGroupColor[int(aGroup + 0.5)];
        float wave = 0.5 + 0.5 * sin(uTime * 1.3 + aPh * 40.0);
        vC = bc(uMode, uSweep, fc, aHeat, aZn, aPh, pow(wave, 6.0) * 0.6, uTime);
        vA = g * depthFade(mv);
        vHub = smoothstep(14.0, 30.0, aDegree);
        float s = (1.5 + 1.1 * sqrt(aDegree)) * uDpr * uScale / -mv.z;
        s *= (1.0 + p * 0.55) * (1.0 + 0.35 * isFocus());
        vA *= 1.0 + 0.25 * isFocus();
        vSize = s;
        gl_PointSize = clamp(s, 1.0, 64.0);
      }`,
    fragmentShader: /* glsl */ `
      ${premul}
      uniform vec3 uPulseCol;
      varying float vP; varying float vA; varying float vHub; varying float vSize; varying vec3 vC;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q);
        float aa = 1.2 / max(vSize, 1.0);
        float disc = 1.0 - smoothstep(0.42 - aa, 0.42 + aa * 0.5, r);
        float ring = (1.0 - smoothstep(0.46 - aa, 0.46, r)) * smoothstep(0.30, 0.30 + aa * 1.5, r);
        float dot_ = 1.0 - smoothstep(0.17, 0.17 + aa * 1.5, r);
        float shape = mix(disc, max(ring, dot_), vHub);
        if (shape < 0.01) discard;
        vec3 col = mix(vC, uPulseCol, vP * 0.85) * 1.2;
        float a = shape * vA * mix(0.78, 1.0, vP);
        gl_FragColor = premul(col, a, 0.7);
      }`,
  })
}

/** the vault's links: fine strands, each a short chain of segments, with a colour wave passing along every one */
export function etchLinks(dpr: number): ShaderMaterial {
  return new ShaderMaterial({
    name: 'BrainEtchLinks', uniforms: baseUniforms(dpr), ...blend,
    vertexShader: /* glsl */ `
      ${common}
      attribute float aGroupB;
      attribute float aS;
      varying float vA; varying vec3 vC; varying float vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vP = pulseAt(aHop);
        vec3 fc = mix(uGroupColor[int(aGroup + 0.5)], uGroupColor[int(aGroupB + 0.5)], aS);
        float ga = mix(uGroupAlpha[int(aGroup + 0.5)], uGroupAlpha[int(aGroupB + 0.5)], aS);
        float w = bc_wave(aS, aPh, uTime);
        vC = bc(uMode, uSweep, fc, aHeat, aZn, aPh, w, uTime);
        vA = ga * depthFade(mv) * (0.5 + 1.3 * w);
      }`,
    fragmentShader: /* glsl */ `
      ${premul}
      uniform vec3 uPulseCol;
      varying float vA; varying vec3 vC; varying float vP;
      void main() {
        vec3 col = mix(vC, uPulseCol, vP * 0.85);
        float a = vA * (0.15 + 0.7 * vP);
        gl_FragColor = premul(col, a, 0.85);
      }`,
  })
}

/** Size defines for a PMREM (CubeUV) texture, mirroring three's WebGLProgram.generateCubeUVSize (as glassMaterial.ts does). */
function cubeUVDefines(tex: Texture): Record<string, string> | null {
  const h = (tex.image as { height?: number } | undefined)?.height
  if (!h) return null
  const maxMip = Math.log2(h) - 2
  return { HAS_ENV: '', CUBEUV_TEXEL_WIDTH: String(1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16))), CUBEUV_TEXEL_HEIGHT: String(1 / h), CUBEUV_MAX_MIP: maxMip.toFixed(1) }
}

export type ShellMaterial = ShaderMaterial & { setRegionColors(cols: Color[], heat: number[]): void }

/** the glass of the cortex. Two walls: BackSide (the far inner wall, faint) and FrontSide (rim, film, reflections, folds). */
export function shellMaterial(side: Side, dpr: number, env: Texture | null): ShellMaterial {
  const cu = env ? cubeUVDefines(env) : null
  const m = new ShaderMaterial({
    name: side === BackSide ? 'BrainShellBack' : 'BrainShellFront',
    defines: cu ?? {},
    uniforms: {
      uMode: { value: new Vector2(0, 0) }, uSweep: { value: 2 }, uTime: { value: 0 },
      uRegionCol: { value: Array.from({ length: 9 }, () => new Color('#9aa3a8')) },
      uRegionHeat: { value: new Array(9).fill(0.5) },
      uOpacity: { value: 1 }, uDpr: { value: dpr }, uEnv: { value: env },
      uLightDir: { value: new Vector3(-0.45, 0.7, 0.55).normalize() },
      uPulse: { value: 0 },
      uCenter: { value: new Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute float aFold; attribute float aRegion; attribute float aZn;
      varying vec3 vWorldPos; varying vec3 vWorldNormal; varying float vFold; varying float vRegion; varying float vZn;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz; vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vFold = aFold; vRegion = aRegion; vZn = aZn;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      #ifdef HAS_ENV
        #define ENVMAP_TYPE_CUBE_UV
        #include <cube_uv_reflection_fragment>
        uniform sampler2D uEnv;
      #endif
      ${BRAIN_COLOR_GLSL}
      ${premul}
      uniform vec2 uMode; uniform float uSweep; uniform float uTime;
      uniform vec3 uRegionCol[9]; uniform float uRegionHeat[9];
      uniform float uOpacity; uniform float uPulse;
      uniform vec3 uLightDir; uniform vec3 uCenter;
      varying vec3 vWorldPos; varying vec3 vWorldNormal; varying float vFold; varying float vRegion; varying float vZn;
      void main() {
        vec3 Ng = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        bool front = dot(Ng, V) >= 0.0;
        vec3 N = front ? Ng : -Ng;
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float f = 1.0 - ndv;
        int ri = int(vRegion + 0.5);
        vec3 rc = uRegionCol[ri]; float rh = uRegionHeat[ri];
        vec3 mc = bc(uMode, uSweep, rc, rh, vZn, 0.0, 0.0, uTime);
        float fold = vFold;
        vec3 col; float a; float add;
        if (front) {
          float fres = pow(f, 2.3);
          vec3 film = 0.5 + 0.5 * cos(6.28318 * (ndv * 1.5 + vec3(0.0, 0.33, 0.67) + vZn * 0.35 + uTime * 0.015));
          col = mix(mc * 0.55, film, 0.18 + 0.4 * fres);
          a = 0.035 + 0.55 * fres;
          // the folds catch light: bright creases, strongest toward the rim
          float crease = fold * (0.35 + 0.65 * smoothstep(0.0, 0.8, f));
          col = mix(col, mc * 1.5 + 0.12, crease * 0.75);
          a += 0.3 * crease + 0.05 * fold;
          // key light and a soft window highlight
          vec3 L = normalize(uLightDir);
          vec3 R = reflect(-V, N);
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 60.0);
          col += vec3(1.0, 0.97, 0.92) * spec * 0.9 * (1.0 - 0.6 * fold);
          a += spec * 0.5;
          #ifdef HAS_ENV
            vec3 env = min(textureCubeUV(uEnv, R, 0.2).rgb, vec3(1.6));
            float envL = dot(env, vec3(0.2126, 0.7152, 0.0722));
            float envAmt = fres * 0.55 * smoothstep(0.25, 1.1, envL);
            col = mix(col, vec3(1.0), clamp(envAmt, 0.0, 1.0));
            a = max(a, envAmt * 0.5);
          #endif
          col += mc * uPulse * 0.5; a += uPulse * 0.1;
          add = 0.72;
        } else {
          // far wall seen through the glass: just the creases, faint
          col = mc * 0.7;
          a = 0.012 + 0.09 * fold + 0.03 * pow(f, 3.0);
          add = 0.85;
        }
        a = clamp(a * uOpacity, 0.0, 1.0);
        gl_FragColor = premul(col, a, add);
      }`,
    ...blend,
  }) as unknown as ShellMaterial
  m.side = side
  m.setRegionColors = (cols, heat) => { m.uniforms.uRegionCol.value = cols; m.uniforms.uRegionHeat.value = heat }
  return m
}
export { BackSide, FrontSide }
