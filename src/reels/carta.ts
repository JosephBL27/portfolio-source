import { mk } from './_g'
// Carta del Cervello: a portolan chart inking itself in. Territories of coast (size = note count, wash = staleness), rhumb lines fanning from two
// compass roses, ports as dots with rings on the most-linked. Ink spreads from the middle, holds, fades, and is redrawn.
export default mk('carta', 'carta', 'Carta del Cervello', 'Generative portolan chart: coasts, rhumb lines and ports inking in', { bg: '#120F0A', ink: '#EBDDB8', accent: '#D9B779' }, /* glsl */ `
const float G = 0.3;
vec2 pt(vec2 c) { return (c + 0.15 + h22(c) * 0.7) * G; }
float rhumb(vec2 q, float px) {
  float a = atan(q.y, q.x), seg = TAU / 16.0;
  float da = (fract(a / seg + 0.5) - 0.5) * seg;
  return aa(abs(sin(da)) * length(q) - px * 0.5, px);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  float ct = mod(t, 18.0);
  float grow = ss(0.0, 11.0, ct);
  float fade = 1.0 - ss(16.0, 17.8, ct);
  vec2 w = p + 0.035 * (vec2(fbm(p * 5.0 + 3.0), fbm(p * 5.0 + 9.0)) - 0.5);
  vec2 cc = floor(w / G);
  float f1 = 9.0; vec2 id = vec2(0.0), pn = vec2(0.0);
  for (int jy = -1; jy <= 1; jy++) for (int jx = -1; jx <= 1; jx++) {
    vec2 c = cc + vec2(float(jy), float(jx)).yx;
    vec2 q = pt(c); float d = length(w - q);
    if (d < f1) { f1 = d; id = c; pn = q; }
  }
  float hn = h21(id + 5.1), stale = h21(id + 17.7);
  float land = step(0.28, hn);
  float rad = G * (0.17 + 0.3 * hn);
  float reach = grow * 1.5 - length(p * vec2(0.8, 1.0)) + (fbm(p * 4.0) - 0.5) * 0.3;
  float vis = ss(0.0, 0.14, reach) * fade;
  vec3 paper = vec3(0.075, 0.06, 0.042) + 0.02 * fbm(p * 30.0);
  vec3 ink = vec3(0.86, 0.72, 0.46);
  vec3 col = paper * (1.0 - 0.35 * dot(p, p));
  float cd = f1 - rad;
  // wash + hatch on land
  vec3 wash = mix(vec3(0.16, 0.5, 0.5), vec3(0.8, 0.38, 0.2), stale);
  float inland = land * aa(cd, px);
  col = mix(col, col + wash * 0.3, inland * vis);
  float hatch = ss(0.35, 0.5, abs(fract((p.x + p.y) * 70.0) - 0.5) * 2.0) * 0.0 + ss(0.46, 0.5, abs(fract((p.x + p.y) * 60.0) - 0.5));
  col += ink * hatch * 0.1 * inland * vis * (0.5 + 0.5 * (1.0 - stale));
  // coast line + offshore water lines
  float coast = land * aa(abs(cd) - px * 0.9, px);
  col += ink * coast * vis * 0.95;
  float off = cd * 60.0;
  float wl = land * step(0.0, cd) * aa(abs(fract(off) - 0.5) - 0.5 + 0.06, px * 0.0 + 0.04) * exp(-cd * 14.0);
  col += ink * wl * vis * 0.22;
  // rhumb lines from two roses
  vec2 h0 = vec2(-0.25, 0.06), h1 = vec2(0.36, -0.1);
  float rl = rhumb(p - h0, px) * (1.0 - ss(0.2, 0.9, length(p - h0))) + rhumb(p - h1, px) * (1.0 - ss(0.2, 0.9, length(p - h1)));
  col += vec3(0.55, 0.62, 0.7) * rl * vis * 0.4 * (1.0 - 0.6 * inland);
  // rose
  vec2 q = p - h0; float rr = length(q), an = atan(q.y, q.x);
  float star = 0.075 * (0.3 + 0.7 * pow(abs(cos(4.0 * an)), 4.0));
  col += ink * (aa(abs(rr - star) - px * 0.9, px) * 0.9 + aa(abs(rr - 0.082) - px * 0.8, px) * 0.6 + aa(abs(rr - 0.095) - px * 0.6, px) * 0.4) * vis;
  col = mix(col, ink * 1.1, aa(rr - 0.012, px) * vis);
  // ports
  float pd = length(w - pn);
  float port = land * aa(pd - mix(0.0045, 0.0085, hn), px);
  col = mix(col, vec3(1.0, 0.9, 0.62), port * vis);
  float hubP = step(0.78, hn) * land;
  float pulse = 0.5 + 0.5 * sin(t * 2.0 + hn * 20.0);
  col += vec3(1.0, 0.82, 0.5) * hubP * (aa(abs(pd - 0.019 - 0.004 * pulse) - px * 0.8, px) * 0.8 + exp(-pd * 30.0) * 0.3) * vis;
  // drafting pen at the ink front
  float pen = exp(-pow(reach * 14.0, 2.0)) * (1.0 - fade * 0.0) * step(ct, 12.0);
  col += vec3(1.0, 0.85, 0.55) * pen * 0.18;
  gl_FragColor = vec4(col, 1.0);
}`)
