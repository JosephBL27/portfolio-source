import { mk } from './_g'
// Finder Organizer: loose files tumble in from the top, grey and unsorted, and turn the colour of their folder as they drop into the matching
// column, rotating flat and stacking. When the stacks are full the weekly sweep clears them and the run starts again.
export default mk('finder', 'finder-organizer', 'Finder Organizer', 'Generative files sorting themselves into folder columns', { bg: '#0D0907', ink: '#F4E6D6', accent: '#F2884A' }, /* glsl */ `
vec3 cf(float c) {
  if (c < 0.5) return vec3(0.95, 0.53, 0.29);
  if (c < 1.5) return vec3(0.45, 0.66, 0.96);
  if (c < 2.5) return vec3(0.5, 0.82, 0.56);
  if (c < 3.5) return vec3(0.92, 0.45, 0.52);
  return vec3(0.72, 0.62, 0.96);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; float px = 1.0 / uRes.y;
  float t = mod(uTime, 3600.0) + uSeed * 2.0;
  float ct = mod(t, 16.0);
  float y0 = -0.43, pitch = 0.036, cw = 0.27;
  vec3 col = mix(vec3(0.03, 0.02, 0.018), vec3(0.075, 0.05, 0.04), ss(-0.5, 0.5, p.y));
  float sweep = ss(13.4, 14.6, ct);
  float ci = clamp(floor(p.x / cw + 2.5), 0.0, 4.0), cx = (ci - 2.0) * cw, dx = p.x - cx;
  vec3 cc = cf(ci);
  // tray
  float trayTop = y0 + 9.0 * pitch;
  float inY = step(y0 - 0.012, p.y) * step(p.y, trayTop);
  float side = aa(abs(abs(dx) - 0.115) - px * 0.8, px) * inY;
  float bot = aa(abs(p.y - (y0 - 0.012)) - px * 0.8, px) * step(abs(dx), 0.117);
  float tab = aa(sdBox(vec2(dx + 0.07, p.y - trayTop - 0.004), vec2(0.05, 0.011)) - px * 0.2, px) * 0.0 + aa(abs(sdBox(vec2(dx + 0.07, p.y - trayTop - 0.004), vec2(0.05, 0.011))) - px * 0.8, px);
  col += cc * (side + bot + tab) * 0.5;
  col += cc * 0.035 * inY * step(abs(dx), 0.115);
  // stack
  float n = clamp(floor((ct - ci * 0.37) / 1.5), 0.0, 8.0);
  float ri = floor((p.y - y0) / pitch);
  if (ri >= 0.0 && ri < n) {
    float jx = (h21(vec2(ci, ri)) - 0.5) * 0.014;
    float d = sdBox(vec2(dx - jx, p.y - (y0 + (ri + 0.5) * pitch)), vec2(0.095, pitch * 0.4)) - 0.003;
    vec3 fc = cc * (0.65 + 0.35 * h21(vec2(ri, ci + 4.0)));
    col = mix(col, fc * (1.0 - 0.6 * sweep), aa(d, px));
    col += cc * 0.5 * aa(abs(p.y - (y0 + (ri + 0.5) * pitch)) - pitch * 0.4 + 0.01, px) * 0.0;
    col += vec3(1.0) * 0.12 * aa(abs(dx - jx + 0.06) - 0.012, px) * aa(d + 0.006, px) * (1.0 - sweep);
  }
  col += cc * exp(-abs(p.y - (y0 + 9.0 * pitch + 0.02)) * 40.0) * sweep * (1.0 - ss(14.4, 15.6, ct)) * 0.35 * step(abs(dx), 0.12);
  // sorter line
  col += vec3(1.0, 0.6, 0.3) * exp(-abs(p.y - 0.1) * 70.0) * 0.1;
  // falling files
  for (int c = 0; c < 5; c++) {
    float fc = float(c);
    float u = (ct - fc * 0.37) / 1.5, k = floor(u), f = fract(u);
    if (u < 0.0 || k >= 8.0) continue;
    float yt = y0 + (k + 0.5) * pitch;
    float e = f * f * 0.8 + f * 0.2;
    float y = mix(0.56, yt, e);
    float tx = (fc - 2.0) * cw;
    float hr = h21(vec2(fc, k) + 2.0);
    float xs = (hr - 0.5) * 1.3;
    float lat = ss(0.12, 0.62, f);
    float x = mix(xs, tx, lat);
    float ang = (h21(vec2(fc + 9.0, k)) - 0.5) * 3.0 * (1.0 - ss(0.25, 0.72, f)) + sin(t * 3.0 + fc) * 0.1 * (1.0 - lat);
    float scl = mix(0.55, 1.0, ss(0.2, 0.75, f));
    vec2 q = rot(ang) * (p - vec2(x, y));
    float d = sdBox(q, vec2(0.095, pitch * 0.4) * scl) - 0.003;
    vec3 fcol = mix(vec3(0.62, 0.6, 0.58), cf(fc), ss(0.28, 0.5, f));
    col = mix(col, fcol, aa(d, px));
    col += fcol * exp(-max(d, 0.0) * 40.0) * 0.22;
    float ring = exp(-pow((length(p - vec2(x, 0.1)) - (f - 0.3) * 0.5) * 30.0, 2.0)) * step(0.3, f) * (1.0 - ss(0.3, 0.55, f)) * 0.0;
    col += ring * fcol;
  }
  col *= (1.0 - 0.5 * dot(p, p)) * 1.35;
  gl_FragColor = vec4(col, 1.0);
}`)
