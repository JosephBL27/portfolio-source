import { mk } from './_g'
// Liaozhai: ink-wash fox spirits on paper. A three-tailed fox condenses out of mist, a fainter one follows, strokes of unreadable brush
// calligraphy are laid down column by column, and a vermilion seal is pressed. Then the paper breathes out and the sheet resets.
export default mk('liaozhai', 'liaozhai', 'Liaozhai', 'Generative ink-wash fox spirits and brush strokes on paper', { bg: '#E6DCC4', ink: '#17130F', accent: '#C23B30' }, /* glsl */ `
float sdFox(vec2 p, float t) {
  float d = sdEl(rot(-0.12) * (p - vec2(-0.01, -0.03)), vec2(0.115, 0.062));
  d = min(d, sdEl(p - vec2(0.09, 0.035), vec2(0.045, 0.04)));
  d = min(d, sdSeg(p, vec2(0.115, 0.03), vec2(0.17, 0.012)) - 0.012);
  d = min(d, sdSeg(p, vec2(0.085, 0.065), vec2(0.074, 0.118)) - 0.008);
  d = min(d, sdSeg(p, vec2(0.106, 0.065), vec2(0.122, 0.114)) - 0.007);
  d = min(d, sdSeg(p, vec2(0.06, -0.04), vec2(0.07, -0.1)) - 0.011);
  d = min(d, sdSeg(p, vec2(-0.07, -0.05), vec2(-0.078, -0.1)) - 0.012);
  vec2 root = vec2(-0.1, -0.03);
  for (int j = 0; j < 3; j++) {
    float fj = float(j) - 1.0;
    mat2 R = rot(fj * 0.42);
    for (int i = 0; i < 16; i++) {
      float s = float(i) / 15.0;
      vec2 c = vec2(-0.15 * s - 0.01, 0.02 * s + 0.1 * sin(s * 2.2) + 0.012 * s * sin(t * 0.8 + s * 3.0 + fj));
      float rd = 0.008 + 0.021 * sin(s * 3.0 + 0.3);
      d = min(d, length(p - root - R * c) - rd * (1.0 - 0.18 * abs(fj)));
    }
  }
  return d;
}
float ink(float d, vec2 p, float a) {
  float n = fbm(p * 22.0);
  float body = (1.0 - ss(-0.002, 0.007, d)) * (0.62 + 0.5 * n);
  float halo = exp(-max(d, 0.0) * 70.0) * 0.2 * fbm(p * 9.0 + 4.0);
  float m = ss(0.0, 0.12, a + 0.55 - fbm(p * 5.0 + 11.0) * 1.1);
  return clamp((body + halo) * m, 0.0, 1.0);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  float ct = mod(t, 18.0);
  float fade = 1.0 - ss(15.5, 17.6, ct);
  vec3 paper = vec3(0.9, 0.86, 0.76) - 0.07 * fbm(p * 8.0) - 0.04 * fbm(p * 60.0);
  paper *= 1.0 - 0.28 * smoothstep(0.35, 1.0, length(p * vec2(0.8, 1.1)));
  vec3 col = paper;
  vec3 inkc = vec3(0.075, 0.065, 0.06);
  // dial rings (reading paths), faint
  vec2 dq = p - vec2(-0.05, 0.02); float dr = length(dq);
  float dials = aa(abs(dr - 0.36) - px * 0.7, px) + aa(abs(dr - 0.3) - px * 0.6, px) * 0.6 + aa(abs(dr - 0.44) - px * 0.5, px) * 0.5;
  col = mix(col, inkc, dials * 0.13 * fade);
  // moon wash
  float mo = length(p - vec2(-0.02, 0.24));
  col = mix(col, vec3(0.5, 0.46, 0.42), (1.0 - ss(0.09, 0.115, mo)) * 0.18 * (0.6 + 0.8 * fbm(p * 14.0)) * fade);
  // foxes
  // the first fox's ink-wash phase is clamped: whatever the clock says (the cycle's first seconds, or the breath-out at its end), a silhouette layer is always there
  float a1 = max(ss(0.2, 3.2, ct), 0.82) * max(fade, 0.82), a2 = ss(4.0, 7.5, ct) * fade;
  vec2 f1 = vec2(-0.3 + 0.01 * sin(t * 0.3), -0.02);
  float s1 = 1.3;
  float d1 = sdFox((p - f1) / s1, t) * s1;
  col = mix(col, inkc, ink(d1, p, a1 * 1.1 - 0.3 * 0.0) * a1 * 0.92);
  vec2 f2 = vec2(0.1, 0.17); float s2 = 0.62;
  float d2 = sdFox(vec2(-(p.x - f2.x), p.y - f2.y) / s2, t + 2.0) * s2;
  col = mix(col, vec3(0.2, 0.18, 0.17), ink(d2, p + 3.0, a2) * a2 * 0.5);
  // mist band
  float mist = fbm(vec2(p.x * 2.0 + t * 0.03, p.y * 9.0)) * exp(-pow((p.y + 0.2) * 5.0, 2.0));
  col = mix(col, paper * 1.04, mist * 0.45);
  // calligraphy: two columns of five unreadable glyphs
  vec2 cell = vec2(floor((p.x - 0.44) / 0.12), floor((0.37 - p.y) / 0.125));
  if (cell.x >= 0.0 && cell.x < 2.0 && cell.y >= 0.0 && cell.y < 5.0) {
    vec2 cen = vec2(0.5 + 0.12 * cell.x, 0.3 - 0.125 * cell.y);
    vec2 l = (p - cen) / 0.05;
    float gi = cell.x * 5.0 + cell.y, ts = gi * 0.5 + 0.6, dm = 9.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float prog = clamp((ct - ts - fk * 0.32) / 0.4, 0.0, 1.0);
      vec2 ha = h22(vec2(gi * 3.1, fk * 1.7)), hb = h22(vec2(gi * 5.3 + 9.0, fk * 2.9));
      vec2 a = (ha - 0.5) * 1.5;
      vec2 b = a + (hb - 0.5) * 1.1 + (mod(fk, 2.0) < 0.5 ? vec2(0.8, 0.0) : vec2(0.0, -0.8));
      vec2 e = mix(a, b, prog);
      vec2 ba = e - a;
      float hh = clamp(dot(l - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float d = length(l - a - ba * hh) - (0.07 * (1.3 - 0.7 * hh)) * step(0.001, prog);
      dm = min(dm, d);
    }
    float st = (1.0 - ss(-0.006, 0.014, dm)) * (0.65 + 0.35 * vn(p * 300.0));
    col = mix(col, inkc, st * fade * 0.95);
  }
  // seal
  vec2 sq = p - vec2(0.62, -0.36);
  float seal = sdBox(sq, vec2(0.034)) - 0.004;
  float sa = ss(8.5, 9.2, ct) * fade;
  float notch = step(0.2, vn(sq * 140.0 + 4.0));
  col = mix(col, vec3(0.78, 0.2, 0.16) * (0.9 + 0.1 * vn(p * 90.0)), aa(seal, px) * sa * (0.55 + 0.45 * notch));
  col = mix(col, paper, aa(abs(sdBox(sq, vec2(0.02, 0.012))) - 0.003, px) * sa * 0.0);
  gl_FragColor = vec4(col, 1.0);
}`)
