import { mk } from './_g'
// NotebookLM Study Loop: sources stream in from the left, become cards at the centre, and the cards circulate on four loops whose speeds
// slow outward (each ring is a longer review interval). One card spirals outward as it is recalled; the loop never closes on a number.
export default mk('studyloop', 'notebooklm-study-loop', 'Study Loop', 'Generative sources turning into cards on a spaced-review orbit', { bg: '#0A0807', ink: '#F4EBDD', accent: '#F2B441' }, /* glsl */ `
float card(vec2 q, float s) { return sdBox(q, vec2(0.027, 0.018) * s) - 0.004 * s; }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  vec3 amb = vec3(0.95, 0.72, 0.28), paperc = vec3(0.86, 0.9, 0.98);
  vec3 col = mix(vec3(0.02, 0.016, 0.014), vec3(0.075, 0.055, 0.04), 1.0 - ss(0.0, 0.9, length(p - vec2(0.14, 0.0))));
  vec2 C = vec2(0.14, 0.0), q = p - C;
  float r = length(q);
  float kf = clamp(floor((r - 0.115) / 0.085 + 0.5), 0.0, 3.0);
  float Rk = 0.115 + 0.085 * kf;
  float om = 1.1 / (1.0 + 1.5 * kf);
  col += amb * aa(abs(r - Rk) - px * 0.7, px) * 0.2;
  for (int i = 0; i < 4; i++) col += amb * aa(abs(r - (0.115 + 0.085 * float(i))) - px * 0.7, px) * 0.12;
  // ring cards
  for (int j = 0; j < 4; j++) {
    float a = om * t + float(j) * TAU / 4.0 + kf * 0.8;
    vec2 pos = Rk * vec2(cos(a), sin(a));
    vec2 l = rot(-(a + PI * 0.5)) * (q - pos);
    float d = card(l, 1.0);
    float k = kf / 3.0;
    vec3 cc = mix(vec3(1.0, 0.78, 0.3), vec3(0.72, 0.62, 0.55), k);
    col = mix(col, cc * (0.9 - 0.3 * k), aa(d, px));
    float ln = aa(abs(l.y) - 0.0016, px) * step(abs(l.x), 0.016) + aa(abs(l.y - 0.007) - 0.0014, px) * step(abs(l.x + 0.004), 0.012);
    col = mix(col, vec3(0.2, 0.12, 0.05), ln * aa(d + 0.004, px) * 0.6);
    col += cc * exp(-max(d, 0.0) * 40.0) * 0.12 * (1.0 - 0.5 * k);
  }
  // recalled card spiralling outward, with a trail
  float cyc = fract(t / 12.0);
  for (int i = 0; i < 12; i++) {
    float lag = float(i) * 0.12;
    float s = clamp(cyc - lag / 12.0, 0.0, 1.0);
    float rr = mix(0.115, 0.37, ss(0.0, 1.0, s));
    float a = PI - 4.0 * s * TAU * 0.5 - 0.4 * s * 6.0;
    vec2 pos = rr * vec2(cos(a), sin(a));
    float d = length(q - pos);
    float w = 1.0 - float(i) / 12.0;
    if (i == 0) {
      vec2 l = rot(-(a + PI * 0.5)) * (q - pos);
      float cd = card(l, 1.3);
      col = mix(col, vec3(1.0, 0.93, 0.7), aa(cd, px));
      col += amb * exp(-max(cd, 0.0) * 28.0) * 0.55;
    } else col += amb * aa(d - 0.0035 * w, px) * 0.5 * w;
  }
  // sources
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 sc = vec2(-0.66 + 0.012 * fi, (fi - 1.0) * 0.17);
    vec2 l = rot(0.05 * (fi - 1.0)) * (p - sc);
    float d = sdBox(l, vec2(0.05, 0.068)) - 0.004;
    col = mix(col, paperc * 0.78, aa(d, px));
    float lines = 0.0;
    for (int k = 0; k < 5; k++) lines += aa(abs(l.y - 0.045 + float(k) * 0.02) - 0.0017, px) * step(abs(l.x + 0.005 * float(k)), 0.034 - 0.003 * float(k));
    col = mix(col, vec3(0.2, 0.25, 0.35), lines * aa(d + 0.006, px) * 0.8);
    col += paperc * exp(-max(d, 0.0) * 30.0) * 0.07;
  }
  // stream: dots leave the sources and become cards at the first loop
  vec2 en = C + vec2(-0.115, 0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float u = fract(t * 0.25 + fi / 9.0);
    vec2 a = vec2(-0.58, (mod(fi, 3.0) - 1.0) * 0.17);
    float bump = sin(u * PI) * (h11(fi + 1.0) - 0.5) * 0.1;
    vec2 pos = mix(a, en, ss(0.0, 1.0, u)) + vec2(0.0, bump);
    vec2 l = p - pos;
    float form = ss(0.55, 0.95, u);
    float d = mix(length(l) - 0.006, card(rot(0.0) * l, 0.85), form);
    vec3 cc = mix(paperc, vec3(1.0, 0.78, 0.3), form);
    col += cc * (aa(d, px) * 0.9 + exp(-max(d, 0.0) * 55.0) * 0.25) * ss(0.0, 0.06, u) * (1.0 - ss(0.96, 1.0, u));
  }
  col += amb * exp(-r * 22.0) * 0.1 * (0.7 + 0.3 * sin(t * 2.0));
  col *= 1.0 - 0.35 * dot(p, p);
  gl_FragColor = vec4(col, 1.0);
}`)
