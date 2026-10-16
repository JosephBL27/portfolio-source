// Shared GLSL head + factory for the v14 reels (axeos, skills, finder, carta, odyssey, liaozhai, studyloop). GLSL ES 1.00.
import type { ReelDef } from './types'

export const HEAD = /* glsl */ `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uSeed; uniform float uIntensity;
#define TAU 6.2831853
#define PI 3.1415927
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p) { return vec2(h21(p), h21(p + vec2(17.3, 5.1))); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; } return s; }
float ss(float a, float b, float x) { return smoothstep(a, b, x); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdEl(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float aa(float d, float px) { return smoothstep(px, -px, d); }
`

export function mk(id: string, projectId: string, title: string, medium: string, colors: ReelDef['colors'], body: string): ReelDef {
  return { id, projectId, title, medium, colors, frag: HEAD + body }
}
