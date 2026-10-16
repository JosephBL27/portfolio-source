// One-pass "technical glass" (concept 4.3). Not transmission: on paper real refraction reads as
// invisible, so glass is drawn the way an illustrator draws it. Day: faint tinted body, an ink
// hairline contour, a fainter inner contour for wall thickness, a hard window highlight and
// optional engraver's hatching on the shadow side. Night: the same object as a light guide (paper
// coloured rims at 35%, partly additive, capsule glow doubled).
//
// Blending is premultiplied (ONE, ONE_MINUS_SRC_ALPHA). The shader writes alpha * (1 - add), so
// one blend state covers both "ink over paper" (add = 0) and "light on a dark wall" (add -> 1).
// Brand colours stay exact: no tone mapping, sRGB encode done in-shader before premultiplying.
import {
  Color, CustomBlending, FrontSide, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector3, Vector4,
  type Side, type Texture,
} from 'three'

export const MAX_CAPS = 24

export interface GlassOptions {
  tint: string
  rim: string
  rimPower?: number
  bodyAlpha?: number
  rimAlpha?: number
  envMap?: Texture | null
  /** extras (all optional) */
  glowColor?: string
  /** contour width in CSS px (scaled by uDpr) */
  line?: number
  /** inner wall-thickness contour position in N.V (0 disables) */
  innerLine?: number
  /** engraver's hatching on the shadow side, 0..1 (globe 1, tubes 0) */
  hatch?: number
  /** caustic crescent on the far wall (back faces only), 0..1 */
  caustic?: number
  side?: Side
  dpr?: number
}

export type GlassMaterial = ShaderMaterial & {
  setNight(n: boolean): void
  setGlow(caps: Float32Array): void
}

const vert = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
  #endif
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const frag = /* glsl */ `
#ifdef HAS_ENV
  #define ENVMAP_TYPE_CUBE_UV
  #include <cube_uv_reflection_fragment>
  uniform sampler2D uEnv;
#endif
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec3 uRimNight;
uniform vec3 uGlowColor;
uniform vec3 uLightDir;
uniform float uRimPower;
uniform float uBodyAlpha;
uniform float uRimAlpha;
uniform float uNight;
uniform float uLine;
uniform float uInner;
uniform float uHatch;
uniform float uCaustic;
uniform float uDpr;
uniform float uOpacity;
uniform vec4 uCaps[${MAX_CAPS}];
// optional inner core (globe variant)
uniform vec3 uCoreCenter;
uniform float uCoreRadius;
uniform vec3 uCoreColor;
uniform float uCoreStrength;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

float aaLine(float v, float at, float widthPx) {
  float w = max(fwidth(v), 1e-5);
  return 1.0 - smoothstep(widthPx * 0.5 * w, (widthPx * 0.5 + 1.0) * w, abs(v - at));
}

void main() {
  // facing from geometry, not gl_FrontFacing: three flips the winding for BackSide materials
  vec3 Ng = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  bool front = dot(Ng, V) >= 0.0;
  vec3 N = front ? Ng : -Ng;
  vec3 L = normalize(uLightDir);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float f = 1.0 - ndv;
  float rim = pow(f, uRimPower);
  float night = uNight;

  // ---- capsule glow (both faces)
  float glow = 0.0;
  for (int i = 0; i < ${MAX_CAPS}; i++) {
    vec4 c = uCaps[i];
    if (c.w <= 0.0) break;
    vec3 d = vWorldPos - c.xyz;
    glow += c.w * exp(-dot(d, d) / 0.018);
  }
  glow *= mix(1.0, 2.0, night);

  vec3 rimCol = mix(uRim, uRimNight, night);
  vec3 col;
  float a;
  float add; // 0 = ink over paper, 1 = pure light

  if (front) {
    // body + soft fresnel shading. The body thickens toward the rim (you look through more glass)
    col = uTint;
    a = uBodyAlpha * mix(1.0, 0.7, night) * (0.75 + 0.5 * smoothstep(0.0, 0.9, f));
    float soft = rim * uRimAlpha * mix(0.42, 0.35, night);
    col = mix(col, rimCol, clamp(soft / max(a + soft, 1e-4), 0.0, 1.0));
    a += soft;

    // hairline contour at the silhouette, inner wall contour
    float px = uLine * uDpr;
    float contour = aaLine(ndv, 0.0, px * 1.6) * mix(0.92, 0.55, night);
    float inner = uInner > 0.0 ? aaLine(ndv, uInner, px * 0.75) * mix(0.30, 0.22, night) : 0.0;

    // engraver's hatching on the shadow side, 45 deg in screen space
    float hatch = 0.0;
    if (uHatch > 0.0) {
      float shadow = smoothstep(-0.05, -0.8, dot(N, L));
      float m = shadow * smoothstep(0.25, 0.85, f) * uHatch * (1.0 - night * 0.6);
      float cell = 5.0 * uDpr;
      float u = (gl_FragCoord.x + gl_FragCoord.y) / cell;
      float dist = abs(fract(u) - 0.5) * cell;          // px from the stroke centre
      float halfW = m * 0.5 * cell * 0.62;
      float fw = 0.75;
      hatch = (1.0 - smoothstep(halfW - fw, halfW + fw, dist)) * smoothstep(0.02, 0.3, m) * 0.55;
    }
    float ink = max(max(contour, inner), hatch);
    col = mix(col, rimCol, ink);
    a = max(a, ink);

    // reflections: a hard key highlight plus a softbox window
    vec3 R = reflect(-V, N);
    float key = max(dot(reflect(-L, N), V), 0.0);
    float spec = smoothstep(0.9955, 0.9975, key) + pow(key, 260.0) * 0.35;
    vec3 wdir = normalize(vec3(-0.78, 0.55, 0.22));
    vec3 wx = normalize(cross(vec3(0.0, 1.0, 0.0), wdir));
    vec3 wy = cross(wdir, wx);
    float rd = dot(R, wdir);
    vec2 wp = vec2(dot(R, wx), dot(R, wy)) / max(rd, 1e-3);
    vec2 box = abs(wp) - vec2(0.36, 0.2);
    float wd = max(box.x, box.y);
    float windowHi = (1.0 - smoothstep(-0.012, 0.012, wd)) * step(0.0, rd) * (1.0 - smoothstep(0.94, 0.995, f));
    // two upright mullions: three tall panes of a studio window, drawn by hand
    float bar = 1.0 - smoothstep(0.016, 0.03, abs(abs(wp.x) - 0.12));
    windowHi *= 1.0 - bar * 0.92;
    // reflected light: a thin bright arc just inside the contour on the shadow side
    float shadowSide = smoothstep(0.1, -0.6, dot(Ng, L));
    float bounce = aaLine(ndv, 0.075, uLine * uDpr * 2.2) * shadowSide * 0.85;
    float hi = clamp(spec + windowHi * mix(0.9, 0.75, night) + bounce, 0.0, 1.0);

    #ifdef HAS_ENV
      // studio env only brightens the fresnel band: glass on paper must stay clear
      vec3 env = min(textureCubeUV(uEnv, R, 0.12).rgb, vec3(1.6));
      float envL = dot(env, vec3(0.2126, 0.7152, 0.0722));
      float envAmt = rim * mix(0.22, 0.5, night) * smoothstep(0.35, 1.2, envL);
      col = mix(col, vec3(1.0), clamp(envAmt, 0.0, 1.0));
      a = max(a, envAmt * 0.6);
    #endif

    col = mix(col, vec3(1.0), hi);
    a = max(a, hi);

    // optional vermilion core seen through the wall
    if (uCoreStrength > 0.0) {
      vec3 rdv = -V;
      vec3 oc = uCoreCenter - cameraPosition;
      float tca = dot(oc, rdv);
      float d2 = max(dot(oc, oc) - tca * tca, 0.0);
      float core = smoothstep(uCoreRadius, 0.0, sqrt(d2));
      core = core * core * uCoreStrength;
      col = mix(col, uCoreColor * mix(1.0, 1.6, night), clamp(core * (1.0 - hi), 0.0, 1.0) * mix(0.5, 0.8, night));
      a = max(a, core * mix(0.18, 0.2, night));
    }
    add = mix(0.0, 0.55, night);
  } else {
    // far wall: almost nothing, plus the caustic crescent opposite the light
    col = uTint;
    a = uBodyAlpha * 0.35;
    float cz = pow(max(dot(Ng, -L), 0.0), 2.5) * smoothstep(0.25, 0.85, f);
    float caus = cz * uCaustic;
    col = mix(col, vec3(1.0), clamp(caus * 1.4, 0.0, 1.0));
    a = max(a, caus * 0.85);
    float back = pow(f, 4.0) * uRimAlpha * 0.25;
    col = mix(col, rimCol, back / max(a + back, 1e-4));
    a += back;
    add = mix(0.0, 0.8, night);
  }

  col += glow * uGlowColor;
  a += glow * 0.6;
  a = clamp(a * uOpacity, 0.0, 1.0);
  vec3 enc = linearToOutputTexel(vec4(max(col, 0.0), 1.0)).rgb;
  gl_FragColor = vec4(enc * a, a * (1.0 - add));
}`

/** Size defines for a PMREM (CubeUV) texture, mirroring three's WebGLProgram.generateCubeUVSize. */
function cubeUVDefines(tex: Texture): Record<string, string> | null {
  const h = (tex.image as { height?: number } | undefined)?.height
  if (!h) return null
  const maxMip = Math.log2(h) - 2
  return {
    HAS_ENV: '',
    CUBEUV_TEXEL_WIDTH: String(1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16))),
    CUBEUV_TEXEL_HEIGHT: String(1 / h),
    CUBEUV_MAX_MIP: maxMip.toFixed(1),
  }
}

export function createGlassMaterial(opts: GlassOptions): GlassMaterial {
  const caps: Vector4[] = Array.from({ length: MAX_CAPS }, () => new Vector4(0, 0, 0, 0))
  const rimDay = new Color(opts.rim)
  const env = opts.envMap ?? null
  const defines = env ? cubeUVDefines(env) ?? {} : {}
  const mat = new ShaderMaterial({
    name: 'TechnicalGlass',
    defines,
    uniforms: {
      uTint: { value: new Color(opts.tint) },
      uRim: { value: rimDay },
      uRimNight: { value: new Color('#ECEAE3') },
      uGlowColor: { value: new Color(opts.glowColor ?? '#FFF4E0') },
      uLightDir: { value: new Vector3(-3, 4, 5).normalize() },
      uRimPower: { value: opts.rimPower ?? 3.0 },
      uBodyAlpha: { value: opts.bodyAlpha ?? 0.1 },
      uRimAlpha: { value: opts.rimAlpha ?? 0.55 },
      uNight: { value: 0 },
      uLine: { value: opts.line ?? 1.0 },
      uInner: { value: opts.innerLine ?? 0.22 },
      uHatch: { value: opts.hatch ?? 0 },
      uCaustic: { value: opts.caustic ?? 0 },
      uDpr: { value: opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: 1 },
      uCaps: { value: caps },
      uEnv: { value: env },
      uCoreCenter: { value: new Vector3() },
      uCoreRadius: { value: 0.3 },
      uCoreColor: { value: new Color('#E0442B') },
      uCoreStrength: { value: 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    side: opts.side ?? FrontSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    toneMapped: false,
  }) as GlassMaterial
  mat.setNight = (n: boolean) => { mat.uniforms.uNight.value = n ? 1 : 0 }
  mat.setGlow = (arr: Float32Array) => {
    for (let i = 0; i < MAX_CAPS; i++) {
      const o = i * 4
      if (o + 3 < arr.length) caps[i].set(arr[o], arr[o + 1], arr[o + 2], arr[o + 3])
      else caps[i].set(0, 0, 0, 0)
    }
  }
  return mat
}
