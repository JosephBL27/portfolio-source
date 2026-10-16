// CRT face shader for the TV. One ShaderMaterial on the bulged visor disc does everything the
// glass does: the picture (barrel warp, aperture grille, scanlines, RGB split, halation,
// vignette), the dark smoked glass around it with the picture's halo bleeding into it, the
// channel-change tear / static / roll, the power-on slit, the on-screen display, and an
// analytic studio reflection (softbox + strip) with Fresnel so the glass reads as glass.
// The reel texture holds sRGB-encoded values (reels write display colour), so we decode here
// and let three's colorspace chunk re-encode for the canvas.
import * as THREE from 'three'

export interface CRTUniforms {
  uTex: { value: THREE.Texture | null }
  uOSD: { value: THREE.Texture | null }
  uTime: { value: number }
  uPower: { value: number }   // 0 off .. 1 fully on (power-on slit animation)
  uTear: { value: number }    // 0..1 horizontal tear envelope (channel change)
  uStatic: { value: number }  // 0..1 static burst
  uRoll: { value: number }    // vertical roll offset, 0 = locked
  uFlash: { value: number }   // extra brightness, 0..1
  uOSDa: { value: number }    // channel banner alpha (top half of the OSD canvas)
  uHover: { value: number }   // hover hint alpha (bottom half) + slight brighten
  uNight: { value: number }
  uRefl: { value: number }    // studio reflection strength
  uGain: { value: number }    // emissive gain
  uPic: { value: THREE.Vector2 } // picture half extents in disc-uv units
  uTint: { value: THREE.Color }  // linear average screen colour (glass halo fallback)
  uFade: { value: number }    // whole-face multiplier: the afterglow of a power-off (1 = normal)
  uCrt: { value: number }     // 0..1 strength of scanlines + aperture grille (fade out when a screen fills the frame)
}

export type CRTMaterial = THREE.ShaderMaterial & { uniforms: CRTUniforms }

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uOSD;
uniform float uTime, uPower, uTear, uStatic, uRoll, uFlash, uOSDa, uHover, uNight, uRefl, uGain, uFade, uCrt;
uniform vec2 uPic;
uniform vec3 uTint;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 dec(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
float sel(vec2 q) { vec2 a = abs(q); vec2 a2 = a * a; return a2.x * a2.x * a.x + a2.y * a2.y * a.y; } // |x|^5+|y|^5
float box(vec2 p, vec2 c, vec2 h, float soft) { vec2 d = abs(p - c) - h; return 1.0 - smoothstep(-soft, soft, max(d.x, d.y)); }

// Glass reflection, kept honest: a very wide low-contrast sheen plus one crescent glint hugging the
// upper-left rim. Both ride the reflected direction, so they drift and fade as the set turns away
// from the key light (no window frame, no mullions: those read as a smear across the picture).
float wrapA(float a) { return a - 6.2831853 * floor((a + 3.1415927) / 6.2831853); }
vec3 glint(vec2 c, float rr, vec3 R) {
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float lobe = dot(R, L);
  float lit = mix(0.3, 1.0, smoothstep(0.15, 0.92, lobe));
  float sheen = pow(clamp(lobe * 0.5 + 0.5, 0.0, 1.0), 7.0);
  float want = 2.42 + clamp(R.x + 0.72, -0.7, 0.7) * 0.55;
  float da = abs(wrapA(atan(c.y, c.x) - want));
  float taper = pow(smoothstep(0.95, 0.0, da), 1.4);
  float w = 0.004 + 0.03 * taper;
  float ring = (1.0 - smoothstep(0.0, w, abs(rr - 0.885 + 0.02 * taper))) * taper;
  // a faint second arc inside the first, like the inner face of thick glass
  float ring2 = (1.0 - smoothstep(0.0, w * 0.6, abs(rr - 0.815 + 0.02 * taper))) * taper * 0.28;
  return vec3(1.0, 0.985, 0.96) * ((ring + ring2) * 0.2 * lit + sheen * 0.03);
}

void main() {
  // picture space: -1..1 at the picture edge
  vec2 q = (vUv - 0.5) / uPic;
  vec2 qa = q * vec2(1.0, 0.75);
  float r2 = dot(qa, qa);
  vec2 sE = q * (1.0 + 0.055 * r2 + 0.025 * r2 * r2); // barrel: edges bow, content pinches
  float e = sel(sE);
  float aa = fwidth(e) * 1.5 + 1e-4;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, e);

  // power-on: a dot that becomes a line that opens into the picture
  float p = uPower;
  float hx = mix(0.015, 1.06, smoothstep(0.0, 0.3, p));
  float vy = mix(0.006, 1.06, pow(smoothstep(0.26, 1.0, p), 0.55));
  float pw = fwidth(sE.y) * 1.5 + 1e-4;
  float pm = (1.0 - smoothstep(hx - 0.02, hx, abs(sE.x))) * (1.0 - smoothstep(vy - pw, vy + pw, abs(sE.y)));
  pm *= step(0.0005, p);

  // content coordinates: tear and roll move the signal, not the tube
  vec2 s = sE;
  float row = floor((s.y * 0.5 + 0.5) * 120.0);
  float tj = hash(vec2(row, floor(uTime * 50.0))) - 0.5;
  float band = smoothstep(0.6, 1.0, sin(s.y * 5.0 - uTime * 23.0) * 0.5 + 0.5);
  s.x += uTear * (tj * 0.16 * (0.4 + band) + 0.07 * sin(s.y * 11.0 + uTime * 41.0));
  float yy = s.y * 0.5 + 0.5 + uRoll;
  float seam = abs(uRoll) > 1e-4 ? fract(yy) : clamp(yy, 0.0, 1.0);
  vec2 uv = vec2(s.x * 0.5 + 0.5, seam);
  // gradients from the unwrapped coordinate so the roll seam never drops to a tiny mip
  vec2 gx = dFdx(sE * 0.5), gy = dFdy(sE * 0.5);

  vec2 ca = (uv - 0.5) * (0.0035 + uTear * 0.02) + vec2(uTear * 0.012, 0.0);
  vec3 col;
  col.r = textureGrad(uTex, uv + ca, gx, gy).r;
  col.g = textureGrad(uTex, uv, gx, gy).g;
  col.b = textureGrad(uTex, uv - ca, gx, gy).b;
  col = dec(col);
  if (uv.x < 0.0 || uv.x > 1.0) col = vec3(0.0);
  vec3 blur = dec(textureLod(uTex, clamp(uv, 0.0, 1.0), 4.5).rgb);
  col += blur * 0.26;

  // vertical blanking bar while rolling
  float bar = smoothstep(0.0, 0.035, seam) * smoothstep(1.0, 0.965, seam);
  col *= mix(1.0, bar, clamp(abs(uRoll) * 25.0, 0.0, 1.0));

  // on-screen display, burnt in by the set, not the signal
  vec4 o = texture2D(uOSD, clamp(sE * 0.5 + 0.5, 0.0, 1.0));
  float oa = o.a * (sE.y > 0.0 ? uOSDa : uHover);
  col = mix(col, dec(o.rgb) * 1.25, oa);

  // static burst
  float n = hash(floor(sE * vec2(230.0, 172.0)) + fract(uTime * 7.13) * vec2(91.7, 37.3));
  float n2 = hash(vec2(row, floor(uTime * 60.0)));
  col = mix(col, vec3(n * n * 1.3 + n2 * 0.15), clamp(uStatic, 0.0, 1.0));

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // scanlines (fade out when finer than the display can show)
  float ph = (sE.y * 0.5 + 0.5) * 228.0;
  float fw = fwidth(ph);
  float beam = 0.5 + 0.5 * cos(6.2831853 * ph);
  float sAmt = 0.42 * uCrt * (1.0 - smoothstep(0.32, 0.7, fw));
  col *= (1.0 - sAmt * (1.0 - beam) * (1.0 - 0.55 * clamp(lum, 0.0, 1.0))) * (1.0 + sAmt * 0.45);
  // aperture grille triads
  float xp = (sE.x * 0.5 + 0.5) * 3.0 * 300.0;
  float fx = fwidth(xp);
  vec3 tri = 0.5 + 0.5 * cos(6.2831853 * (xp / 3.0 - vec3(0.0, 1.0 / 3.0, 2.0 / 3.0)));
  float mAmt = 0.32 * uCrt * (1.0 - smoothstep(0.28, 0.65, fx));
  col *= mix(vec3(1.0), 0.4 + 1.2 * tri, mAmt);

  float vig = 1.0 - 0.5 * pow(clamp(e, 0.0, 1.0), 1.6);
  col *= vig;
  float flick = 1.0 + 0.012 * sin(uTime * 113.0) + 0.006 * sin(uTime * 7.0);
  col *= uGain * flick * (1.0 + uFlash * 1.5) * (1.0 + uHover * 0.08);

  float hp = smoothstep(0.0, 0.6, p);
  // power-on overdrive: the slit is white-hot
  float hot = 1.0 - smoothstep(0.22, 0.85, p);
  col = mix(col, vec3(1.6, 1.55, 1.5), hot * 0.9);

  vec3 blackLevel = vec3(0.010, 0.012, 0.0145) * hp + vec3(0.002);
  vec3 pic = blackLevel + col;

  // smoked glass around the picture with the picture's halo scattering into it
  vec3 halo = dec(textureLod(uTex, clamp(sE * 0.5 + 0.5, 0.0, 1.0), 6.5).rgb);
  float outside = max(e - 1.0, 0.0);
  vec3 glass = vec3(0.006, 0.007, 0.008) + (halo * 0.55 + uTint * 0.15) * exp(-outside * 3.2) * 0.42 * hp;

  vec3 base = mix(glass, pic, inside * pm) * uFade;
  // glass edge falloff toward the bezel
  float rr = length(vUv - 0.5) * 2.0;
  base *= 1.0 - 0.6 * smoothstep(0.82, 1.0, rr);

  // glass reflection
  vec3 N = normalize(vN);
  vec3 V = normalize(vP - cameraPosition);
  if (dot(N, V) > 0.0) N = -N;
  vec3 R = reflect(V, N);
  vec3 refl = glint(vUv - 0.5, rr, R) * uRefl;
  refl *= 1.0 - 0.5 * smoothstep(0.9, 1.0, rr);

  gl_FragColor = vec4(base + refl, 1.0);
  #include <colorspace_fragment>
}`

export function createCRTMaterial(o: { tex: THREE.Texture; osd: THREE.Texture; pic: THREE.Vector2 }): CRTMaterial {
  const uniforms: CRTUniforms = {
    uTex: { value: o.tex }, uOSD: { value: o.osd },
    uTime: { value: 0 }, uPower: { value: 0 }, uTear: { value: 0 }, uStatic: { value: 0 }, uRoll: { value: 0 },
    uFlash: { value: 0 }, uOSDa: { value: 0 }, uHover: { value: 0 }, uNight: { value: 1 }, uRefl: { value: 1 },
    uGain: { value: 1.5 }, uPic: { value: o.pic }, uTint: { value: new THREE.Color(0, 0, 0) }, uFade: { value: 1 }, uCrt: { value: 1 },
  }
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms as any, toneMapped: false })
  return m as CRTMaterial
}
