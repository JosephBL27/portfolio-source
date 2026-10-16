import type { ReelDef } from './types'
// Placeholder used only until the real reels exist.
export const TEST_REEL: ReelDef = {
  id: 'test', projectId: 'selforge', title: 'Test card', medium: 'Placeholder test card',
  colors: { bg: '#0b0b0c', ink: '#f2efe8', accent: '#ff5a3c' },
  frag: /* glsl */ `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float bars = floor(uv.x * 7.0);
  vec3 c = 0.5 + 0.5 * cos(6.2831 * (bars / 7.0 + vec3(0.0, 0.33, 0.67)));
  float r = length(p);
  c = mix(c, vec3(0.06), smoothstep(0.30, 0.31, r) * smoothstep(0.45, 0.44, r));
  c *= 0.85 + 0.15 * sin(uTime * 3.0 + uv.y * 40.0);
  gl_FragColor = vec4(c, 1.0);
}`,
}
