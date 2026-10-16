// FORM "pushup" (chapter II, The Alarm). A particle figure, seen from the side, does pushups on the floor of an
// iPhone screen. The figure is a forward-kinematics skeleton: update() computes ~10 joints from a 1.6 s up/down
// cycle (u_pushup_j[12]) and every body particle stores (distance along its bone, offset, depth) so anim_pushup
// can hang it on the moving bones. Above the figure a ring of 10 rep ticks lights one per completed rep and
// resets, and a vermilion Ember (a small flame at the ring's centre) flares on each rep.
import * as THREE from 'three'
import type { FormDef } from './types'
import { H } from './ctx'

// ---- geometry, phone space (y up, +z toward the camera) ----------------------------------------
const HW = 1.22, HH = 2.5, RC = 0.36            // phone half width / half height / corner radius
const FLOOR = -0.95                              // the floor the figure works on
const RING = { cx: 0, cy: 1.0, r: 0.66, len: 0.16 }
const FLAME_BASE = RING.cy - 0.4
const T_CYC = 1.6
const XT = -0.9                                  // toe x
const XW = 0.355                                 // planted wrist x
const L_FOOT = 0.17, L_SHIN = 0.4, L_THIGH = 0.42, L_TORSO = 0.52, L_NECK = 0.26, L_UP = 0.28, L_FORE = 0.27, L_HAND = 0.11
const TH_UP = 0.3, TH_DN = 0.075                 // body angle at the top / bottom of a rep
const ANK = new THREE.Vector2(XT + 0.085, FLOOR + 0.15)

const smooth = (x: number) => x * x * (3 - 2 * x)

/** skeleton joints, FLOOR-relative world: 0 toe, 1 ankle, 2 knee, 3 hip, 4 shoulder, 5 head, 6 elbow, 7 wrist, 8 fingertip */
function pose(t: number, J: THREE.Vector3[]) {
  const ph = (t / T_CYC) % 1
  const e = smooth(0.5 + 0.5 * Math.cos(ph * Math.PI * 2))            // 1 at the top, 0 at the bottom
  const th = TH_DN + (TH_UP - TH_DN) * e
  const cx = Math.cos(th), sx = Math.sin(th)
  J[0].set(XT, FLOOR + 0.035, 0)
  J[1].set(ANK.x, ANK.y, 0)
  J[2].set(ANK.x + L_SHIN * cx, ANK.y + L_SHIN * sx, 0)
  J[3].set(J[2].x + L_THIGH * cx, J[2].y + L_THIGH * sx, 0)
  J[4].set(J[3].x + L_TORSO * cx, J[3].y + L_TORSO * sx, 0)
  J[5].set(J[4].x + L_NECK * Math.cos(th + 0.42), J[4].y + L_NECK * Math.sin(th + 0.42), 0)
  // two-bone IK: elbow flares back toward the feet
  const wy = FLOOR + 0.045
  const dx = XW - J[4].x, dy = wy - J[4].y
  const d = Math.min(Math.hypot(dx, dy), L_UP + L_FORE - 1e-3)
  const a = (L_UP * L_UP - L_FORE * L_FORE + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, L_UP * L_UP - a * a))
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy)
  const mx = J[4].x + ux * a, my = J[4].y + uy * a
  let nx = -uy, ny = ux
  if (nx > 0) { nx = -nx; ny = -ny }
  J[6].set(mx + nx * h, my + ny * h, 0)
  J[7].set(XW, wy, 0)
  J[8].set(XW + L_HAND, FLOOR + 0.035, 0)
  J[9].set(RING.cx, RING.cy, 0); J[10].set(0, 0, 0); J[11].set(0, 0, 0)
}

// ---- bone specs -----------------------------------------------------------------------------------
interface Bone { id: number; len: number; r0: number; r1: number; bulge: number; ez: number; z: number; a: number }
const BONES: Bone[] = [
  { id: 0, len: L_FOOT, r0: 0.045, r1: 0.03, bulge: 0, ez: 1, z: 0.065, a: 1 }, { id: 0, len: L_FOOT, r0: 0.045, r1: 0.03, bulge: 0, ez: 1, z: -0.065, a: 0.6 },
  { id: 1, len: L_SHIN, r0: 0.045, r1: 0.062, bulge: 0.014, ez: 1, z: 0.065, a: 1 }, { id: 1, len: L_SHIN, r0: 0.045, r1: 0.062, bulge: 0.014, ez: 1, z: -0.065, a: 0.6 },
  { id: 2, len: L_THIGH, r0: 0.062, r1: 0.095, bulge: 0.008, ez: 1, z: 0.065, a: 1 }, { id: 2, len: L_THIGH, r0: 0.062, r1: 0.095, bulge: 0.008, ez: 1, z: -0.065, a: 0.6 },
  { id: 3, len: L_TORSO, r0: 0.1, r1: 0.115, bulge: 0.02, ez: 1.4, z: 0, a: 1 },
  { id: 4, len: L_NECK, r0: 0.045, r1: 0.04, bulge: 0, ez: 1, z: 0, a: 1 },
  { id: 5, len: 0, r0: 0.105, r1: 0.105, bulge: 0, ez: 1, z: 0, a: 1.15 },
  { id: 6, len: L_UP, r0: 0.056, r1: 0.042, bulge: 0.004, ez: 1, z: 0.15, a: 1 }, { id: 6, len: L_UP, r0: 0.056, r1: 0.042, bulge: 0.004, ez: 1, z: -0.15, a: 0.55 },
  { id: 7, len: L_FORE, r0: 0.042, r1: 0.032, bulge: 0.004, ez: 1, z: 0.15, a: 1 }, { id: 7, len: L_FORE, r0: 0.042, r1: 0.032, bulge: 0.004, ez: 1, z: -0.15, a: 0.55 },
  { id: 8, len: L_HAND, r0: 0.032, r1: 0.026, bulge: 0, ez: 1.3, z: 0.15, a: 1 }, { id: 8, len: L_HAND, r0: 0.032, r1: 0.026, bulge: 0, ez: 1.3, z: -0.15, a: 0.55 },
]
const boneWeight = (b: Bone) => { const R = (b.r0 + b.r1) / 2; return (2 * Math.PI * R * b.len + 4 * Math.PI * R * R) * Math.pow(b.ez, 0.5) * (b.a < 0.7 ? 0.6 : 1) }
const TOTAL_W = BONES.reduce((s, b) => s + boneWeight(b), 0)

const rrPoint = (s: number, hw: number, hh: number, rc: number): [number, number, number, number] => {
  const sx = 2 * (hw - rc), sy = 2 * (hh - rc), arc = (Math.PI * rc) / 2
  const per = 2 * sx + 2 * sy + 4 * arc
  s = ((s % per) + per) % per
  const ax = hw - rc, ay = hh - rc
  if (s < sx) return [-ax + s, -hh, 0, -1]; s -= sx
  if (s < arc) { const a = -Math.PI / 2 + s / rc; return [ax + Math.cos(a) * rc, -ay + Math.sin(a) * rc, Math.cos(a), Math.sin(a)] } s -= arc
  if (s < sy) return [hw, -ay + s, 1, 0]; s -= sy
  if (s < arc) { const a = s / rc; return [ax + Math.cos(a) * rc, ay + Math.sin(a) * rc, Math.cos(a), Math.sin(a)] } s -= arc
  if (s < sx) return [ax - s, hh, 0, 1]; s -= sx
  if (s < arc) { const a = Math.PI / 2 + s / rc; return [-ax + Math.cos(a) * rc, ay + Math.sin(a) * rc, Math.cos(a), Math.sin(a)] } s -= arc
  if (s < sy) return [-hw, ay - s, -1, 0]; s -= sy
  const a = Math.PI + s / rc
  return [-ax + Math.cos(a) * rc, -ay + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]
}
const inRR = (x: number, y: number, hw: number, hh: number, rc: number) => {
  const qx = Math.max(0, Math.abs(x) - (hw - rc)), qy = Math.max(0, Math.abs(y) - (hh - rc))
  return qx * qx + qy * qy <= rc * rc
}

const J: THREE.Vector3[] = Array.from({ length: 12 }, () => new THREE.Vector3())
pose(0, J)
const U = { j: { value: J }, rep: { value: 0 }, flare: { value: 0 }, ph: { value: 0 } }

const form: FormDef = {
  id: 'pushup',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const W = (kind: number, id: number) => kind + 16 * id
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    const ivory = H.hex('#EDE6D6'), verm = H.hex('#FF4A2B'), cool = [0.62, 0.7, 0.9]
    const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

    // ---- figure (kind 1) and its floor reflection (kind 6) --------------------------------------
    const sampleBody = (nTot: number, kind: number, alphaMul: number) => {
      for (const b of BONES) {
        const n = Math.round((nTot * boneWeight(b)) / TOTAL_W)
        const Rm = (b.r0 + b.r1) / 2, aCyl = 2 * Math.PI * Rm * b.len, aCap = 4 * Math.PI * Rm * Rm
        for (let i = 0; i < n; i++) {
          const shell = rand() < 0.6
          let s: number, ly: number, lz: number
          if (rand() * (aCyl + aCap) < aCyl) {
            const u = rand(), R = b.r0 + (b.r1 - b.r0) * u + b.bulge * Math.sin(Math.PI * u), ph = rand() * Math.PI * 2
            const rho = shell ? 1 - 0.05 * rand() : Math.sqrt(rand()) * 0.95
            s = u * b.len; ly = R * rho * Math.cos(ph); lz = R * rho * Math.sin(ph) * b.ez
          } else {
            const th = rand() * Math.PI * 2, u = rand() * 2 - 1, sn = Math.sqrt(1 - u * u)
            const vx = u, vy = Math.cos(th) * sn, vz = Math.sin(th) * sn
            const rho = shell ? 1 - 0.05 * rand() : Math.cbrt(rand()) * 0.95
            const R = vx < 0 ? b.r0 : b.r1
            s = (vx < 0 ? 0 : b.len) + vx * R * rho; ly = vy * R * rho; lz = vz * R * rho * b.ez
          }
          const c = mix3(ivory, [1, 0.96, 0.9], 0.3)
          put(s, ly, lz + b.z, W(kind, b.id), c[0], c[1], c[2], 0.062 * b.a * alphaMul)
        }
      }
    }
    sampleBody(Math.floor(N * 0.37), 1, 1)
    sampleBody(Math.floor(N * 0.03), 6, 0.3)

    // ---- phone frame (kind 0, id 0), bezel line + buttons (id 1), island (id 2), home bar (id 3) ----
    const per = 2 * (2 * (HW - RC)) + 2 * (2 * (HH - RC)) + 2 * Math.PI * RC
    const nFrame = Math.floor(N * 0.07)
    for (let i = 0; i < nFrame; i++) {
      const [x, y, nx, ny] = rrPoint(rand() * per, HW, HH, RC)
      const dep = rand() * 0.028, z = (rand() * 2 - 1) * 0.045
      put(x - nx * dep, y - ny * dep, z, W(0, 0), 0.95, 0.92, 0.84, 0.3)
    }
    const nBezel = Math.floor(N * 0.012)
    for (let i = 0; i < nBezel; i++) {
      const [x, y, nx, ny] = rrPoint(rand() * per * 0.95, HW - 0.075, HH - 0.075, RC - 0.07)
      put(x - nx * rand() * 0.01, y - ny * rand() * 0.01, -0.02 + (rand() - 0.5) * 0.01, W(0, 1), 0.8, 0.85, 1, 0.16)
    }
    const nBtn = Math.floor(N * 0.004)
    const btns: [number, number, number][] = [[-1, 1.62, 1.82], [-1, 1.2, 1.5], [-1, 0.78, 1.08], [1, 1.1, 1.62]]
    for (let i = 0; i < nBtn; i++) {
      const [sd, y0, y1] = btns[i % btns.length]
      put(sd * (HW + 0.012 + rand() * 0.022), y0 + (y1 - y0) * rand(), (rand() - 0.5) * 0.05, W(0, 1), 0.95, 0.92, 0.84, 0.5)
    }
    // dynamic island: pill outline + camera lens
    const IY = HH - 0.2, IWH = 0.3, IHH = 0.072
    const nIsl = Math.floor(N * 0.006)
    for (let i = 0; i < nIsl; i++) {
      const [x, y] = rrPoint(rand() * (4 * (IWH - IHH) + 2 * Math.PI * IHH), IWH, IHH, IHH)
      put(x, IY + y, (rand() - 0.5) * 0.015, W(0, 2), 0.85, 0.88, 0.95, 0.3)
    }
    for (let i = 0; i < Math.floor(nIsl * 0.25); i++) {
      const a = rand() * Math.PI * 2, r = 0.03 * Math.sqrt(rand())
      put(IWH - 0.12 + Math.cos(a) * r, IY + Math.sin(a) * r, 0, W(0, 2), 0.7, 0.8, 1, 0.45)
    }
    const nHome = Math.floor(N * 0.005)
    for (let i = 0; i < nHome; i++) put((rand() * 2 - 1) * 0.42, -HH + 0.17 + (rand() - 0.5) * 0.014, (rand() - 0.5) * 0.01, W(0, 3), 0.95, 0.92, 0.85, 0.34)

    // a locked 'slide to stop' pill near the bottom: the alarm will not let go until the pushups are counted
    const PY = -HH + 0.62, PWH = 0.78, PHH = 0.15
    const nPill = Math.floor(N * 0.01)
    for (let i = 0; i < nPill; i++) {
      const [x, y] = rrPoint(rand() * (4 * (PWH - PHH) + 2 * Math.PI * PHH), PWH, PHH, PHH)
      put(x, PY + y, (rand() - 0.5) * 0.015, W(0, 6), 0.9, 0.9, 0.95, 0.12)
    }
    for (let i = 0; i < Math.floor(nPill * 0.8); i++) {
      const a = rand() * Math.PI * 2, r = 0.115 * Math.sqrt(rand())
      put(-PWH + PHH + Math.cos(a) * r, PY + Math.sin(a) * r, 0, W(0, 6), 1, 0.45, 0.3, 0.09)
    }
    // ---- screen glow: a faint sheet whose alpha sculpts the light (id 4) --------------------------
    const nGlow = Math.floor(N * 0.11)
    for (let i = 0; i < nGlow; i++) {
      let x = 0, y = 0
      for (let tries = 0; tries < 8; tries++) {
        x = (rand() * 2 - 1) * (HW - 0.07); y = (rand() * 2 - 1) * (HH - 0.07)
        if (inRR(x, y, HW - 0.07, HH - 0.07, RC - 0.07) && !(Math.abs(x) < IWH + 0.03 && Math.abs(y - IY) < IHH + 0.03)) break
      }
      const dr = Math.hypot(x - RING.cx, (y - RING.cy) * 0.8)
      const flame = Math.exp(-(dr * dr) / 0.55), floor = Math.exp(-((y - FLOOR) * (y - FLOOR)) / 0.28) * Math.exp(-(x * x) / 2.2)
      const c = mix3(cool, verm, Math.min(1, flame * 1.4))
      put(x, y, -0.05 + (rand() - 0.5) * 0.02, W(0, 4), c[0], c[1], c[2], 0.022 + 0.16 * flame * flame + 0.06 * flame + 0.06 * floor)
    }
    // ---- floor: a bright contact line and a soft shadow pool (id 5) ---------------------------------
    const nFloor = Math.floor(N * 0.022)
    for (let i = 0; i < nFloor; i++) {
      const x = (rand() * 2 - 1) * 1.08, edge = Math.exp(-Math.pow(Math.abs(x) / 1.08, 4) * 2.5)
      if (rand() < 0.45) put(x, FLOOR - 0.012 * rand(), (rand() * 2 - 1) * 0.3, W(0, 5), 0.95, 0.9, 0.82, 0.2 * edge)
      else put(x, FLOOR - 0.01, (rand() * 2 - 1) * 0.38, W(0, 5), 0.75, 0.8, 0.95, 0.07 * edge)
    }

    // ---- ring of 10 rep ticks (kind 2, id 0..9) + a continuous progress arc (id 15) -----------------
    const nTick = Math.floor(N * 0.03)
    for (let i = 0; i < nTick; i++) {
      const kTick = i % 10, a = Math.PI / 2 - (kTick * Math.PI * 2) / 10
      const dx = Math.cos(a), dy = Math.sin(a), rr = RING.r + RING.len * rand(), off = (rand() * 2 - 1) * 0.017
      put(RING.cx + dx * rr - dy * off, RING.cy + dy * rr + dx * off, (rand() * 2 - 1) * 0.022, W(2, kTick), 0.95, 0.92, 0.85, 0.12)
    }
    const nArc = Math.floor(N * 0.012)
    for (let i = 0; i < nArc; i++) {
      const a = rand() * Math.PI * 2, rr = RING.r - 0.065 + (rand() - 0.5) * 0.014
      put(RING.cx + Math.cos(a) * rr, RING.cy + Math.sin(a) * rr, (rand() - 0.5) * 0.02, W(2, 15), 0.95, 0.92, 0.85, 0.16)
    }

    // ---- the Ember (kind 3): a flame that flares on every rep -----------------------------------------
    const nFlame = Math.floor(N * 0.04)
    for (let i = 0; i < nFlame; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand())
      put(Math.cos(a) * r, 0, Math.sin(a) * r, W(3, 0), verm[0], verm[1], verm[2], 0.075)
    }

    // ---- dust: the room behind the phone (kind 4) --------------------------------------------------------
    while (k < N) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = Math.cbrt(rand())
      const x = Math.cos(th) * s * r * 4.6, y = u * r * 3.4, z = Math.sin(th) * s * r * 2.6 - 0.8
      const insidePhone = Math.abs(x) < HW + 0.1 && Math.abs(y) < HH + 0.1 && z > -0.3
      put(x, y, z, W(4, 0), 0.9, 0.86, 0.8, (insidePhone ? 0.01 : 0.03) + 0.1 * Math.pow(rand(), 3))
    }
  },
  uniforms: { u_pushup_j: U.j, u_pushup_rep: U.rep, u_pushup_flare: U.flare, u_pushup_ph: U.ph },
  update(t) {
    pose(t, J)
    const n = Math.floor(t / T_CYC), ph = (t / T_CYC) % 1
    U.rep.value = n % 11
    U.ph.value = ph
    U.flare.value = Math.exp(-ph * T_CYC * 3.2) * (n % 11 === 10 ? 1.6 : 1)
  },
  glsl: /* glsl */ `
uniform vec3 u_pushup_j[12];
uniform float u_pushup_rep, u_pushup_flare, u_pushup_ph;
const float PU_FLOOR = ${FLOOR.toFixed(3)};
const vec2 PU_RING = vec2(${RING.cx.toFixed(3)}, ${RING.cy.toFixed(3)});
const float PU_FLAME_BASE = ${FLAME_BASE.toFixed(3)};
void pu_bone(int b, out vec3 A, out vec3 B, out float len) {
  if (b == 0) { A = u_pushup_j[1]; B = u_pushup_j[0]; len = ${L_FOOT}; }
  else if (b == 1) { A = u_pushup_j[1]; B = u_pushup_j[2]; len = ${L_SHIN}; }
  else if (b == 2) { A = u_pushup_j[2]; B = u_pushup_j[3]; len = ${L_THIGH}; }
  else if (b == 3) { A = u_pushup_j[3]; B = u_pushup_j[4]; len = ${L_TORSO}; }
  else if (b == 4) { A = u_pushup_j[4]; B = u_pushup_j[5]; len = ${L_NECK}; }
  else if (b == 5) { A = u_pushup_j[5]; B = u_pushup_j[5] + vec3(1.0, 0.0, 0.0); len = 0.0; }
  else if (b == 6) { A = u_pushup_j[4]; B = u_pushup_j[6]; len = ${L_UP}; }
  else if (b == 7) { A = u_pushup_j[6]; B = u_pushup_j[7]; len = ${L_FORE}; }
  else { A = u_pushup_j[7]; B = u_pushup_j[8]; len = ${L_HAND}; }
}
vec3 pu_sway(vec3 q, float t) {
  float a = 0.2 * sin(t * 0.42) + 0.05 * sin(t * 0.9 + 1.0);
  float c = cos(a), s = sin(a);
  return vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
}
vec3 anim_pushup(vec3 p, vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0); float id = floor(d.w / 16.0 + 0.001);
  vec3 q = p;
  if (kind < 0.5) { /* phone: already in phone space */ }
  else if (kind < 1.5 || (kind > 5.5 && kind < 6.5)) {
    vec3 A, B; float len; pu_bone(int(id + 0.5), A, B, len);
    vec2 T = normalize(B.xy - A.xy + vec2(1e-5, 0.0)); vec2 N = vec2(-T.y, T.x);
    q = vec3(A.xy + T * p.x + N * p.y, p.z);
    if (kind > 5.5) q.y = 2.0 * PU_FLOOR - q.y;
  } else if (kind < 2.5) {
    float pop = abs(id - (u_pushup_rep - 1.0)) < 0.5 ? u_pushup_flare : 0.0;
    vec2 dir = normalize(p.xy - PU_RING + vec2(1e-5));
    q.xy += dir * 0.045 * pop;
  } else if (kind < 3.5) {
    float fl = u_pushup_flare;
    float ph = fract(r.x + t * (0.5 + 0.55 * r.y));
    float hgt = 0.56 * (1.0 + 0.4 * fl);
    float w = 0.23 * pow(1.0 - ph, 1.15) * (0.35 + 0.65 * smoothstep(0.0, 0.22, ph)) * (1.0 + 0.2 * fl);
    float wob = (sin(t * 7.0 + ph * 8.0 + r.z * 20.0) * 0.04 + sin(t * 3.3 + r.w * 30.0) * 0.025) * ph;
    q = vec3(PU_RING.x + p.x * w + wob, PU_FLAME_BASE + ph * hgt, p.z * w * 0.8);
  } else if (kind < 4.5) {
    float a = r.x * 6.2831 + t * (0.05 + 0.08 * r.y);
    q = p + vec3(sin(a) * 0.15, sin(t * 0.2 + r.z * 30.0) * 0.12 + 0.05 * t * (0.3 + r.w), cos(a) * 0.1);
    q.y = mod(q.y + 3.4, 6.8) - 3.4;
    return q;
  }
  return pu_sway(q, t);
}
float size_pushup(vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0), id = floor(d.w / 16.0 + 0.001);
  if (kind < 0.5) return id > 3.5 && id < 4.5 ? 1.7 : (id > 4.5 ? 1.2 : 0.9);
  if (kind < 1.5) return 0.95;
  if (kind < 2.5) return 1.25;
  if (kind < 3.5) return 1.0 + 0.5 * r.y;
  if (kind < 4.5) return 0.8;
  return 0.8;
}
vec4 color_pushup(vec4 c, vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0), id = floor(d.w / 16.0 + 0.001);
  float fl = u_pushup_flare;
  vec3 verm = vec3(1.0, 0.29, 0.17);
  if (kind < 0.5) {
    if (id < 0.5) {
      float ang = atan(d.y, d.x);
      float g = pow(max(0.0, cos(ang - t * 0.7)), 26.0) + 0.6 * pow(max(0.0, cos(ang + 2.4 - t * 0.7 * 0.5)), 40.0);
      c.rgb += vec3(1.0, 0.9, 0.75) * g * 0.9; c.a *= 1.0 + 0.5 * g;
    } else if (id > 3.5 && id < 4.5) {
      float dr = length(vec2(d.x - PU_RING.x, (d.y - PU_RING.y) * 0.8));
      float pulse = exp(-dr * dr / 0.8) * fl;
      c.rgb += verm * pulse * 0.6; c.a *= 1.0 + 1.6 * pulse + 0.1 * sin(t * 1.7 + r.w * 40.0);
    } else if (id > 5.5) { c.a *= 0.7 + 0.3 * sin(t * 2.2); }
    else if (id > 4.5) { c.a *= 1.0 + 0.5 * fl; }
    return c;
  }
  if (kind < 1.5 || (kind > 5.5 && kind < 6.5)) {
    vec3 A, B; float len; pu_bone(int(id + 0.5), A, B, len);
    vec2 T = normalize(B.xy - A.xy + vec2(1e-5, 0.0)); vec2 N = vec2(-T.y, T.x);
    float cap = d.x - clamp(d.x, 0.0, len);
    vec3 nl = normalize(vec3(cap, d.y, d.z) + vec3(1e-4));
    vec3 n = vec3(T * nl.x + N * nl.y, nl.z);
    if (id > 4.5 && id < 5.5) n = normalize(vec3(d.x, d.y, d.z) + vec3(1e-4));
    if (kind > 5.5) n.y = -n.y;
    vec3 L = normalize(vec3(-0.4, 0.8, 0.55));
    float dif = max(dot(n, L), 0.0);
    float rim = pow(1.0 - abs(n.z), 2.0);
    float up = max(n.y, 0.0);
    vec3 rgb = c.rgb * (0.3 + 1.05 * dif) + vec3(0.6, 0.7, 1.0) * rim * 0.18;
    rgb += verm * up * (0.22 + 0.9 * fl) * (0.55 + 0.45 * n.z);
    c.a *= 1.0 + 0.5 * fl;
    return vec4(rgb, c.a);
  }
  if (kind < 2.5) {
    if (id > 14.5) {
      float dy = d.y - PU_RING.y, dx = d.x - PU_RING.x;
      float f = fract((1.5707963 - atan(dy, dx)) / 6.2831853);
      float prog = (u_pushup_rep + u_pushup_ph) / 10.0;
      float lit = smoothstep(prog + 0.003, prog - 0.003, f);
      float head = exp(-abs(f - prog) * 90.0) * step(0.001, prog);
      c.rgb = mix(c.rgb * 0.7, verm * 1.2, lit); c.a *= 0.55 + 0.9 * lit + 2.0 * head * (1.0 - lit * 0.0);
      c.rgb += vec3(1.0, 0.8, 0.55) * head * 0.8;
      return c;
    }
    float lit = step(id + 0.5, u_pushup_rep);
    float newest = step(abs(id - (u_pushup_rep - 1.0)), 0.5);
    vec3 rgb = mix(c.rgb * 0.55, verm * 1.35, lit);
    rgb += vec3(1.0, 0.75, 0.5) * newest * fl * 1.1;
    float a = c.a * (0.5 + 1.1 * lit + 1.2 * newest * fl);
    return vec4(rgb, a);
  }
  if (kind < 3.5) {
    float ph = fract(r.x + t * (0.5 + 0.55 * r.y));
    float heat = pow(1.0 - ph, 2.0);
    vec3 rgb = mix(verm, vec3(1.0, 0.86, 0.6), heat);
    float a = c.a * (0.35 + 1.6 * pow(1.0 - ph, 0.7)) * (1.0 + 0.45 * fl);
    return vec4(rgb * (1.0 + 0.1 * fl), a);
  }
  c.a *= 0.65 + 0.35 * sin(t * 1.3 + r.w * 40.0);
  return c;
}`,
  camera: { pos: [1.75, 0.1, 9.8], target: [1.75, 0.1, 0], fov: 35 },
  pointSize: 1.7,
  drift: 0.004,
}
export default form
