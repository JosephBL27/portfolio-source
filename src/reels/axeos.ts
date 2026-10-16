import { mk } from './_g'
// AXE_OS: a depth dial (five notches, R0 to R4) steps up as tasks queue at five gates, one lane per depth. A gate opens only when the dial
// reaches its lane; tasks pile up behind a closed gate and release when it opens. Every cycle the deepest lane trips its breaker.
export default mk('axeos', 'axe-os', 'AXE_OS', 'Generative gates and a depth dial, after the rules my agents follow', { bg: '#07060F', ink: '#E6E2FF', accent: '#B7A6FF' }, /* glsl */ `
vec3 lc(float k) { return mix(mix(vec3(0.45, 0.78, 1.0), vec3(0.74, 0.64, 1.0), clamp(k / 2.0, 0.0, 1.0)), vec3(1.0, 0.56, 0.38), clamp(k / 2.0 - 1.0, 0.0, 1.0)); }
float gear(vec2 q, float R, float n, float ph, float px) {
  float a = atan(q.y, q.x);
  float rg = R + R * 0.06 * smoothstep(-0.25, 0.25, sin(n * a + ph));
  return aa(abs(length(q) - rg) - px * 0.8, px);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 3.0;
  float bt = mod(t, 14.0);
  float L = ss(0.8, 1.4, bt) + ss(2.8, 3.4, bt) + ss(4.8, 5.4, bt) - 2.0 * ss(6.8, 7.4, bt) + 3.0 * ss(8.8, 9.4, bt);
  L *= 1.0 - ss(10.6, 10.9, bt);
  float trip = ss(10.6, 10.7, bt) * (1.0 - ss(12.6, 13.4, bt));
  float flash = step(10.6, bt) * exp(-(bt - 10.6) * 3.0);
  vec3 col = mix(vec3(0.018, 0.016, 0.04), vec3(0.05, 0.04, 0.1), 1.0 - ss(0.2, 0.95, length(p)));
  vec2 gp = fract(p * 22.0) - 0.5; col += vec3(0.5, 0.45, 0.8) * 0.05 * ss(0.07, 0.0, length(gp));

  // gears + dial
  vec2 dc = vec2(-0.5, 0.0), q = p - dc; float r = length(q);
  float g = gear(q, 0.29, 20.0, t * 0.4, px) * 0.5 + gear(p - dc - vec2(-0.17, -0.35), 0.1, 12.0, -t * 0.67 + 0.3, px) * 0.45;
  col += vec3(0.5, 0.46, 0.85) * g * 0.55;
  float an = atan(q.x, q.y);
  float arc = aa(abs(r - 0.19) - px * 0.8, px) * step(abs(an), 2.15);
  col += vec3(0.6, 0.55, 0.95) * arc * 0.5;
  float na = mix(-2.1, 2.1, L / 4.0);
  for (int k = 0; k < 5; k++) {
    float fk = float(k), ka = mix(-2.1, 2.1, fk / 4.0);
    vec2 dir = vec2(sin(ka), cos(ka));
    float d = sdSeg(q, dir * 0.205, dir * 0.255) - 0.006;
    float on = ss(fk - 0.1, fk + 0.05, L + 0.02);
    vec3 tc = lc(fk);
    col = mix(col, mix(vec3(0.13, 0.12, 0.2), tc, on), aa(d, px));
    col += tc * exp(-max(d, 0.0) * 55.0) * on * 0.45;
  }
  vec2 nd = vec2(sin(na), cos(na));
  float ndl = sdSeg(q, nd * 0.02, nd * 0.17) - 0.004;
  vec3 nc = lc(L);
  col = mix(col, nc * 1.2, aa(ndl, px)); col += nc * exp(-max(ndl, 0.0) * 40.0) * 0.4;
  col = mix(col, vec3(0.95), aa(r - 0.014, px));

  // lanes and gates
  float LY = 0.15, x0 = -0.18, x1 = 0.78, gx = 0.33, gS = (gx - x0) / (x1 - x0);
  float li = clamp(floor(p.y / LY + 2.5), 0.0, 4.0), yc = (li - 2.0) * LY, dy = p.y - yc;
  float inX = step(x0, p.x) * step(p.x, x1);
  vec3 lcol = lc(li);
  float open = ss(li - 0.55, li - 0.1, L) * (1.0 - trip * step(3.5, li));
  float tripL = trip * step(3.5, li);
  col += lcol * aa(abs(dy) - px * 0.7, px) * inX * 0.18;
  float gap = mix(0.0, 0.055, open);
  float cy = (gap + 0.07) * 0.5, hh = (0.07 - gap) * 0.5 + 0.0005;
  float gd = sdBox(vec2(p.x - gx, abs(dy) - cy), vec2(0.006, hh));
  vec3 gc = mix(mix(lcol, vec3(1.0), 0.35), vec3(1.0, 0.3, 0.25), max(tripL, trip * 0.7));
  col = mix(col, gc * (0.5 + 0.7 * open), aa(gd, px));
  col += gc * exp(-max(gd, 0.0) * 50.0) * (0.12 + 0.35 * open) * 0.6;
  float spd = 0.09 + 0.012 * li;
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float s = fract(t * spd + fj * 0.25 + h11(li + 3.0) * 0.5);
    float qs = gS - 0.03 - 0.035 * fj;
    float sc = (s < gS) ? min(s, qs) : s;
    s = mix(sc, s, open);
    vec2 tp = vec2(mix(x0, x1, s), yc);
    float d = length(p - tp);
    float qd = (s < gS) ? 1.0 : 0.0;
    vec3 tc = mix(lcol, vec3(1.0), 0.5 * (1.0 - qd));
    col += tc * (aa(d - 0.0095, px) * 0.9 + exp(-d * 55.0) * 0.4);
    float tr = sdSeg(p, tp - vec2(0.05, 0.0), tp);
    col += tc * exp(-tr * 140.0) * 0.18 * (1.0 - qd);
  }

  // breaker trip
  vec2 bp = p - vec2(gx, 2.0 * LY);
  float rr = length(bp), bR = max(bt - 10.6, 0.0) * 0.55;
  col += vec3(1.0, 0.35, 0.25) * exp(-pow((rr - bR) * 22.0, 2.0)) * step(10.6, bt) * exp(-(bt - 10.6) * 1.4) * 0.9;
  col += vec3(1.0, 0.2, 0.2) * flash * 0.16 * (1.0 - length(p) * 0.6);
  col *= 1.0 - 0.55 * trip * (1.0 - flash);
  col *= (1.0 - 0.35 * dot(p, p) * 1.4) * 1.2;
  gl_FragColor = vec4(col, 1.0);
}`)
