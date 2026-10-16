import { mk } from './_g'
// Odyssey: a living reckoning. A ship traces the voyage as a dotted track across a wine-dark sea under a low gold sun; five landfalls ring as it
// passes, and a four-ring reckoning wheel turns faintly behind it. Track and wake reset at the end of each voyage.
export default mk('odyssey', 'odyssey', 'Odyssey', 'Generative wine-dark sea, a ship on the route and a four-ring reckoning wheel', { bg: '#12060C', ink: '#F2DDB0', accent: '#D9A441' }, /* glsl */ `
vec2 P(float s) { return vec2(mix(-0.62, 0.62, s) + 0.05 * sin(s * 14.0), 0.125 + 0.035 * sin(s * 9.0 + 0.6) - 0.02 * s); }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  float ct = mod(t, 20.0);
  float head = clamp(ct / 16.0, 0.0, 1.0);
  float fade = 1.0 - ss(18.0, 19.8, ct);
  float hz = 0.2;
  vec3 col;
  vec2 sun = vec2(0.3, hz + 0.045);
  if (p.y > hz) {
    float k = (p.y - hz) / 0.4;
    col = mix(vec3(0.62, 0.27, 0.17), vec3(0.06, 0.025, 0.06), ss(0.0, 1.0, k));
    float ds = length(p - sun);
    col = mix(col, vec3(1.0, 0.74, 0.4), aa(ds - 0.06, px) * 0.85);
    col += vec3(1.0, 0.6, 0.3) * exp(-ds * 6.0) * 0.4;
    col += vec3(0.9, 0.5, 0.3) * 0.12 * fbm(vec2(p.x * 3.0 + t * 0.01, p.y * 14.0)) * (1.0 - k);
  } else {
    float k = (hz - p.y) / 0.75;
    col = mix(vec3(0.2, 0.05, 0.1), vec3(0.06, 0.012, 0.035), ss(0.0, 1.0, k));
    float persp = 1.0 + k * 5.0;
    float wv = sin(p.y * 90.0 / (0.4 + k) + sin(p.x * 9.0 * persp * 0.3 + t * 0.7) * 1.6 - t * 0.9);
    col += vec3(0.28, 0.07, 0.14) * ss(0.55, 1.0, wv) * (0.4 + 0.3 * (1.0 - k));
    float sx = (p.x - sun.x) / (0.03 + 0.16 * (hz - p.y));
    float glit = exp(-sx * sx) * ss(0.5, 0.95, sin(p.y * 170.0 + sin(p.x * 22.0 + t) * 2.0 - t * 2.4)) * (1.0 - k);
    col += vec3(1.0, 0.7, 0.33) * glit * 0.85;
    col += vec3(1.0, 0.7, 0.4) * exp(-(hz - p.y) * 60.0) * 0.18;
  }
  // reckoning wheel
  vec2 wc = vec2(0.0, 0.17), q = p - wc; float r = length(q), a = atan(q.y, q.x);
  vec3 gold = vec3(0.95, 0.77, 0.4);
  float wheel = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i), R = 0.13 + 0.07 * fi;
    float dirn = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float n = 18.0 + 6.0 * fi;
    float tk = abs(fract(a / TAU * n + dirn * t * (0.012 + 0.006 * fi)) - 0.5) * TAU * R / n;
    wheel += aa(abs(r - R) - px * 0.7, px) * 0.5 + aa(tk - px * 0.8, px) * step(abs(r - R), 0.011) * 0.8;
  }
  wheel += aa(abs(r - 0.43) - px * 0.6, px) * 0.3 + aa(sdSeg(q, vec2(0.0, 0.405), vec2(0.0, 0.45)) - 0.004, px);
  col += gold * wheel * 0.3 * fade;
  // route
  float best = 9.0, bu = 0.0;
  for (int i = 0; i < 28; i++) {
    float s0 = float(i) / 28.0;
    vec2 a0 = P(s0), b0 = P(s0 + 1.0 / 28.0), ba = b0 - a0;
    float h = clamp(dot(p - a0, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(p - a0 - ba * h);
    if (d < best) { best = d; bu = s0 + h / 28.0; }
  }
  float dash = ss(0.55, 0.45, abs(fract(bu * 85.0) - 0.5) + 0.0);
  float on = step(bu, head) * fade;
  col += vec3(1.0, 0.86, 0.5) * (aa(best - px * 1.1, px) * dash * 0.85 + exp(-best * 90.0) * 0.12) * on;
  for (int i = 0; i < 5; i++) {
    float s = 0.14 + 0.18 * float(i);
    vec2 lp = P(s); float d = length(p - lp);
    float since = (head - s) * 16.0;
    float got = step(0.0, since) * fade;
    col += vec3(1.0, 0.82, 0.45) * got * (aa(d - 0.006, px) + aa(abs(d - 0.016 - 0.03 * clamp(since, 0.0, 1.6) * 0.0) - px * 0.8, px) * 0.8 + exp(-pow((d - since * 0.045) * 40.0, 2.0)) * exp(-since * 1.2) * 0.8);
  }
  // ship
  vec2 sp = P(head), tp = P(min(head + 0.01, 1.0)) - P(max(head - 0.01, 0.0));
  float bob = sin(t * 1.4) * 0.005;
  vec2 sq = rot(-sin(t * 1.4) * 0.07) * (p - sp - vec2(0.0, 0.016 + bob));
  float hull = sdBox(sq - vec2(0.0, 0.0), vec2(0.034, 0.006)) - 0.003;
  float sy = (sq.y - 0.012) / 0.05;
  float sail = max(abs(sq.x - 0.003 * sin(sy * 3.0 + t)) - 0.026 * (1.0 - 0.45 * sy), max(-sy, sy - 1.0) * 0.04);
  float mast = sdSeg(sq, vec2(0.0, 0.004), vec2(0.0, 0.068)) - 0.0013;
  float sd = min(min(hull, sail), mast);
  float vis = step(0.001, head) * fade;
  col = mix(col, vec3(0.1, 0.03, 0.05), aa(sd - 0.0025, px) * vis);
  col = mix(col, mix(vec3(1.0, 0.86, 0.55), vec3(1.0, 0.95, 0.8), sy), aa(sd, px) * vis);
  float wk = sdSeg(p, sp + vec2(-0.02, 0.0), sp + vec2(-0.11, 0.0));
  col += vec3(1.0, 0.7, 0.4) * exp(-wk * 160.0) * 0.4 * vis * ss(hz, hz - 0.01, p.y);
  col *= 1.0 - 0.4 * dot(p, p);
  gl_FragColor = vec4(col, 1.0);
}`)
