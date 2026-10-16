import { C } from './font'

// Shared GLSL for reels that draw playing cards and chips (felt, spots). Include AFTER FONT_GLSL.
//   card(q, W, flip, vec2(rank 0..12, suit 0..3), px) -> vec4(rgb, alpha)   q in the card's own frame (centre origin)
//   cardShadow(q, W, soft)    soft blob under a card
//   chip(q, R, type 0..5, px) -> vec4(rgb, alpha)
//   sdSuit(p, 0 spade | 1 heart | 2 diamond | 3 club)  rank code via rankCode(r)
export const CARD_GLSL = /* glsl */ `
#ifndef PI
#define PI 3.14159265
#endif
#ifndef TAU
#define TAU 6.2831853
#endif
float d2(vec2 v) { return dot(v, v); }
float sdBox(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float sdHeart0(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(d2(p - vec2(0.25, 0.75))) - 0.35355;
  return sqrt(min(d2(p - vec2(0.0, 1.0)), d2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float sdSuit(vec2 p, float s) {
  if (s < 0.5) {            // spade
    float b = sdHeart0(vec2(p.x, 0.46 - p.y) / 0.80) * 0.80;
    vec2 q = p - vec2(0.0, -0.33);
    float st = max(abs(q.x) - (0.04 + 0.11 * (-q.y - 0.02) * 1.5), abs(q.y) - 0.15);
    return min(b, st);
  } else if (s < 1.5) {     // heart
    return sdHeart0(vec2(p.x, p.y + 0.46) / 0.80) * 0.80;
  } else if (s < 2.5) {     // diamond
    return (abs(p.x) * 0.60 + abs(p.y) * 0.42 - 0.24) / 0.73;
  }
  float c1 = length(p - vec2(0.0, 0.21)) - 0.22;
  float c2 = length(p - vec2(-0.23, -0.10)) - 0.22;
  float c3 = length(p - vec2(0.23, -0.10)) - 0.22;
  vec2 q = p - vec2(0.0, -0.30);
  float st = max(abs(q.x) - (0.035 + 0.12 * (-q.y - 0.02) * 1.6), abs(q.y) - 0.16);
  return min(min(c1, min(c2, c3)), st);
}
float rankCode(float r) {
  if (r < 0.5) return ${C('A')};
  if (r < 8.5) return ${C('2')} + r - 1.0;
  if (r < 9.5) return ${C('T')};
  if (r < 10.5) return ${C('J')};
  if (r < 11.5) return ${C('Q')};
  return ${C('K')};
}

// a card in its own frame (centre origin, world units); W = width; flip 0 = back .. 1 = face
vec4 card(vec2 q, float W, float flip, vec2 rs, float px) {
  float Hh = W * 1.4;
  float sx = max(abs(cos(PI * flip)), 0.02);
  q.x /= sx;
  float d = sdBox(q, vec2(W, Hh) * 0.5, W * 0.09);
  float a = smoothstep(px * 1.2, -px * 0.4, d);
  if (a <= 0.0) return vec4(0.0);
  vec3 c;
  if (flip < 0.5) {
    vec2 u = q / W;
    float lat = min(abs(fract((u.x + u.y) * 7.0) - 0.5), abs(fract((u.x - u.y) * 7.0) - 0.5));
    c = mix(vec3(0.46, 0.06, 0.10), vec3(0.64, 0.10, 0.15), smoothstep(0.0, 0.5, lat));
    c += vec3(0.85, 0.62, 0.28) * smoothstep(0.045, 0.0, lat) * 0.55;
    float fr = abs(sdBox(q, vec2(W, Hh) * 0.5 - W * 0.09, W * 0.04));
    c = mix(c, vec3(0.93, 0.88, 0.76), smoothstep(W * 0.012 + px, W * 0.012 - px, fr) * 0.9);
  } else {
    vec3 ink = (rs.y > 0.5 && rs.y < 2.5) ? vec3(0.80, 0.11, 0.17) : vec3(0.06, 0.065, 0.085);
    c = mix(vec3(0.985, 0.965, 0.92), vec3(0.90, 0.87, 0.80), smoothstep(Hh * 0.5, -Hh * 0.5, q.y) * 0.35);
    float pd = sdSuit(q / (W * 0.58) - vec2(0.0, -0.05), rs.y) * W * 0.58;
    c = mix(c, ink, smoothstep(px * 1.2, -px * 0.4, pd));
    float k = W * 0.0425;
    vec2 tq = (q - vec2(-W * 0.5 + W * 0.09, Hh * 0.5 - W * 0.09 - 7.0 * k)) / k;
    c = mix(c, ink, fChar(tq, rankCode(rs.x), k / px) * 0.95);
    float pp = sdSuit((q - vec2(-W * 0.5 + W * 0.20, Hh * 0.5 - W * 0.09 - 7.0 * k - W * 0.11)) / (W * 0.15), rs.y) * W * 0.15;
    c = mix(c, ink, smoothstep(px * 1.2, -px * 0.4, pp));
    c *= 1.0 - (1.0 - sx) * 0.55;
  }
  c *= 0.96 + 0.06 * smoothstep(-Hh * 0.5, Hh * 0.5, q.y);
  c = mix(c, vec3(0.05), smoothstep(px * 2.0, 0.0, abs(d + px * 0.5)) * 0.35);
  return vec4(c, a);
}
float cardShadow(vec2 q, float W, float soft) {
  float d = sdBox(q, vec2(W, W * 1.4) * 0.5, W * 0.09);
  return exp(-max(d, 0.0) / soft) * smoothstep(soft * 3.0, 0.0, d) * 0.6;
}

// ---------- chips ----------
vec3 chipCol(float t) {
  if (t < 0.5) return vec3(0.88, 0.86, 0.80);
  if (t < 1.5) return vec3(0.78, 0.17, 0.16);
  if (t < 2.5) return vec3(0.16, 0.34, 0.80);
  if (t < 3.5) return vec3(0.07, 0.07, 0.08);
  if (t < 4.5) return vec3(0.15, 0.55, 0.36);
  return vec3(0.86, 0.64, 0.24);
}
vec4 chip(vec2 q, float R, float typ, float px) {
  float r = length(q);
  float a = smoothstep(px * 1.2, -px * 0.4, r - R);
  if (a <= 0.0) return vec4(0.0);
  vec3 body = chipCol(typ);
  float ang = atan(q.y, q.x);
  float stripe = step(0.5, fract(ang / TAU * 8.0 + 0.5));
  float rim = smoothstep(R * 0.80, R * 0.86, r);
  vec3 sc = typ > 2.5 && typ < 3.5 ? vec3(0.9) : vec3(0.95, 0.93, 0.88);
  vec3 c = body * (0.92 + 0.1 * smoothstep(R, 0.0, r));
  c = mix(c, sc, rim * stripe * 0.9);
  c = mix(c, c * 0.55, rim * (1.0 - stripe));
  c = mix(c, sc, smoothstep(px * 1.0, 0.0, abs(r - R * 0.62)) * 0.55);
  c *= 0.78 + 0.35 * smoothstep(R * 1.0, R * 0.2, length(q - vec2(-0.3, 0.4) * R));
  c = mix(c, vec3(0.04), smoothstep(px * 1.6, 0.0, abs(r - R + px * 0.5)) * 0.45);
  return vec4(c, a);
}


`
