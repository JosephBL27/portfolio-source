// Poster reels (v11, unit 7C): the fallback for a work that has no generative reel. A poster is a calm, slowly drifting field of
// fine contour lines in the project's own accent, so the case view (src/ui/case.ts) opens for EVERY project and never as a no-op.
// Same contract as any reel (./types.ts): one fragment shader, runs in three.js and in the raw WebGL2 runner (./mini.ts).
// Lines carry no data: it is a typographic backdrop for the case view, not an illustration of the work. NEW (7C).
import type { ReelDef } from './types'

export interface PosterStyle { accent: string; bg?: string; ink?: string; variant?: number }

const vec3 = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => v.toFixed(4)).join(', ')
}

/** variant 0 fbm contours, 1 rings round a drifting centre, 2 ribbons, 3 spokes */
const frag = (s: Required<PosterStyle>) => /* glsl */ `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uSeed; uniform float uIntensity;
const vec3 BG = vec3(${vec3(s.bg)});
const vec3 INK = vec3(${vec3(s.ink)});
const vec3 ACC = vec3(${vec3(s.accent)});
const float VAR = ${s.variant.toFixed(1)};
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; } return s; }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.045 * (0.4 + 0.6 * uIntensity);
  vec2 q = p * 1.5 + uSeed * 9.0;
  float f = fbm(q + vec2(t, -0.7 * t) + 0.35 * fbm(q * 1.7 - t));
  float L;
  if (VAR < 0.5) L = f * 9.0;
  else if (VAR < 1.5) L = length(p - vec2(0.18 * sin(t * 3.0), 0.12 * cos(t * 2.3))) * 11.0 + f * 2.2;
  else if (VAR < 2.5) L = (p.y + (f - 0.5) * 0.9) * 12.0 + p.x * 1.2;
  else L = atan(p.y + 0.02, p.x - 0.1) * 5.0 + f * 3.0 + length(p) * 4.0;
  float d = abs(fract(L) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.07, d);
  float fine = 1.0 - smoothstep(0.0, 0.035, abs(fract(L * 4.0) - 0.5));
  float near = exp(-dot(p - m, p - m) * 5.0);
  vec3 c = BG + ACC * 0.05 * (1.0 - length(p) * 0.8);
  c = mix(c, ACC, line * (0.34 + 0.4 * near));
  c = mix(c, INK, fine * 0.05 + line * near * 0.26);
  c += ACC * near * 0.07;
  c *= 1.0 - smoothstep(0.55, 1.15, length(p * vec2(0.9, 1.1)));
  c += (h21(gl_FragCoord.xy + uTime) - 0.5) * 0.016;
  gl_FragColor = vec4(c, 1.0);
}`

export function posterReel(projectId: string, title: string, style: PosterStyle): ReelDef {
  const s: Required<PosterStyle> = { bg: '#07080A', ink: '#F2EFE8', variant: 0, ...style }
  return {
    id: `poster-${projectId}`, projectId, title,
    medium: 'A quiet poster in the work\'s own colour: it has no generative reel',
    colors: { bg: s.bg, ink: s.ink, accent: s.accent },
    frag: frag(s),
  }
}
