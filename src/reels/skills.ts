import { mk } from './_g'
// Skills: a constellation of skill nodes. Every six seconds a request lights one node and a bright wavefront routes outward along the edges,
// leaving a fading lit path behind it, then the chart resets for the next request.
export default mk('skills', 'skills', 'Skills', 'Generative constellation of skills with requests routing along lit paths', { bg: '#050914', ink: '#E8EEFF', accent: '#8FB8FF' }, /* glsl */ `
const float S = 0.17;
vec2 np(vec2 c) { return (c + 0.5 + (h22(c) - 0.5) * 0.72) * S; }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  float cyc = floor(t / 6.0), ph = fract(t / 6.0);
  vec2 sc = vec2(floor(h11(cyc * 3.1 + 1.0) * 7.0) - 3.0, floor(h11(cyc * 7.7 + 2.0) * 5.0) - 2.0);
  vec2 src = np(sc);
  float R = ph * 2.1 + 0.02;
  float live = ss(0.0, 0.03, ph) * (1.0 - ss(0.86, 1.0, ph));
  vec3 col = mix(vec3(0.012, 0.02, 0.045), vec3(0.03, 0.05, 0.1), 1.0 - ss(0.1, 1.0, length(p)));
  col += vec3(0.1, 0.12, 0.22) * 0.5 * fbm(p * 3.0 + t * 0.02) * 0.4;
  vec2 cc = floor(p / S);
  vec3 cool = vec3(0.56, 0.72, 1.0), hot = vec3(0.85, 0.95, 1.0), amb = vec3(1.0, 0.78, 0.4);
  for (int jy = -1; jy <= 1; jy++) {
    for (int jx = -1; jx <= 1; jx++) {
      vec2 c = cc + vec2(float(jx), float(jy));
      vec2 a = np(c);
      float hn = h21(c + 3.7), big = step(0.8, hn);
      float da = length(a - src);
      float tr = step(da, R) * exp(-(R - da) * 1.1) * live;
      float fr = exp(-pow((R - da) * 8.0, 2.0)) * live;
      float dn = length(p - a);
      float nr = mix(0.0055, 0.0115, big);
      col += cool * aa(dn - nr, px) * (0.35 + 0.65 * tr) + hot * aa(dn - nr * 0.6, px) * fr;
      col += cool * exp(-dn * 38.0) * (0.12 + 0.55 * tr + 0.9 * fr);
      col += cool * big * aa(abs(dn - nr * 2.3) - px * 0.7, px) * (0.18 + 0.6 * tr);
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 off = vec2(1.0, 0.0);
        if (k == 1) off = vec2(0.0, 1.0);
        if (k == 2) off = vec2(1.0, 1.0);
        if (h21(c * 1.7 + fk * 5.3 + 11.0) < 0.4) continue;
        vec2 b = np(c + off);
        vec2 ba = b - a;
        vec2 qq = a + ba * clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
        float dq = length(qq - src);
        float e = step(dq, R) * exp(-(R - dq) * 1.0) * live;
        float f = exp(-pow((R - dq) * 9.0, 2.0)) * live;
        float d = length(p - qq);
        col += cool * aa(d - px * 0.55, px) * (0.14 + 1.1 * e) + hot * aa(d - px * 0.9, px) * f * 1.3;
        col += cool * exp(-d * 90.0) * 0.5 * f;
      }
    }
  }
  float ds = length(p - src);
  col += amb * (aa(abs(ds - (0.02 + 0.012 * sin(t * 6.0))) - px * 0.9, px) * 0.8 + exp(-ds * 30.0) * 0.5) * live;
  col *= 1.0 - 0.5 * dot(p, p);
  gl_FragColor = vec4(col, 1.0);
}`)
