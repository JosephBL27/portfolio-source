// FORM "bust": a white marble portrait bust of Homer, lit per frame so it keeps real light as it turns.
// Source: SMK Open scan KAS210 (plaster cast of a Greek portrait of Homer, Royal Cast Collection,
// Statens Museum for Kunst, Public Domain Mark 1.0). Provenance + pipeline: docs/research/bust-source.md.
// Rebuild: scripts/spline/stl2recv.mjs, then scripts/spline/sample.mjs (--rot -90,0,0 --weld --n 262144).
// This file also hosts the shared SCULPT factory used by knight3d / hold3d / turntable3d:
// a .bin (see docs/research/spline.md, format SPT1) of area-weighted surface samples with
// normals and baked ambient occlusion, lit per frame in the vertex shader so the object
// keeps real light as it turns (key + fill + rim + marble wrap, back faces culled).
import type { FormDef } from './types'
import { H } from './ctx'

export interface SculptOpts {
  id: string
  url: string                              // /models/<name>.bin
  /** world scale: the model's largest dimension becomes 2*size world units */
  size: number
  offset?: [number, number, number]        // world-space offset of the model centre
  yaw0?: number                            // static yaw (radians)
  tilt?: number                            // pitch toward the camera (radians), applied after the yaw so the object still turns about its own vertical axis
  sway?: number                            // idle yaw swing amplitude (radians)
  spin?: number                            // continuous yaw speed (radians / s)
  albedo?: [number, number, number]        // base surface colour
  key?: [number, number, number]           // key light colour (upper left, front)
  fill?: [number, number, number]          // fill light colour (right)
  rim?: [number, number, number]           // rim light colour (grazing angles)
  spec?: number                            // specular strength 0..1
  shine?: number                           // specular exponent
  alpha?: number                           // body particle alpha
  back?: number                            // alpha multiplier on back faces (0 hides them)
  dust?: number                            // fraction of particles used as faint ambient dust
  dustTint?: [number, number, number]
  pointSize?: number
  drift?: number
  camera?: FormDef['camera']
  /** extra GLSL appended inside color_<id> after `col` (vec3 lit colour), `n` (world normal), `wp` (world pos), `ao`, `r` are in scope */
  tweak?: string
}

const f = (n: number) => n.toFixed(5)
const v3 = (a: number[]) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`

/** w12 latency: a sculpt's .bin (turntable3d is 1.3 MB) waits for the loader gate ('v3:ready') or 6 s, so it never delays the gate; see brainShape.ts */
function afterGate(): Promise<void> {
  const w = window as unknown as { __v3Gate?: boolean; __v3Ready?: boolean }
  if (!w.__v3Gate || w.__v3Ready) return Promise.resolve()
  return new Promise<void>(res => { const t = setTimeout(res, 6000); window.addEventListener('v3:ready', () => { clearTimeout(t); res() }, { once: true }) })
}

export function sculpt(o: SculptOpts): FormDef {
  const id = o.id
  const off = o.offset ?? [0, 0, 0]
  const albedo = o.albedo ?? [0.93, 0.89, 0.8], key = o.key ?? [1.0, 0.93, 0.82], fill = o.fill ?? [0.55, 0.65, 0.9], rim = o.rim ?? [0.7, 0.8, 1.0]
  const dust = o.dust ?? 0.05
  return {
    id,
    async build(ctx, pos, col) {
      await afterGate()
      const buf = await (await fetch(o.url, { priority: 'low' })).arrayBuffer()
      const dv = new DataView(buf)
      if (dv.getUint32(0, true) !== 0x31545053) throw new Error(`[${id}] ${o.url} is not an SPT1 file`) // 'SPT1' little endian
      const count = dv.getUint32(4, true), peak = dv.getFloat32(8, true)
      const P = new Int16Array(buf, 16, count * 3), Nn = new Int8Array(buf, 16 + count * 6, count * 3), AO = new Uint8Array(buf, 16 + count * 9, count)
      const body = Math.floor(ctx.count * (1 - dust))
      const k = (peak / 32767) * o.size
      const jit = 0.0075 * o.size
      for (let i = 0; i < body; i++) {
        const s = i % count, rep = i >= count ? 1 : 0
        const jx = rep ? (ctx.rand() - 0.5) * jit : 0, jy = rep ? (ctx.rand() - 0.5) * jit : 0, jz = rep ? (ctx.rand() - 0.5) * jit : 0
        H.set(pos, col, i,
          P[s * 3] * k + jx, P[s * 3 + 1] * k + jy, P[s * 3 + 2] * k + jz, AO[s] / 255,
          Nn[s * 3] / 254 + 0.5, Nn[s * 3 + 1] / 254 + 0.5, Nn[s * 3 + 2] / 254 + 0.5, 1)
      }
      // dust: faint motes around the object, flagged with pos.w = -1
      const dt = o.dustTint ?? albedo
      for (let i = body; i < ctx.count; i++) {
        const u = ctx.rand() * 2 - 1, th = ctx.rand() * Math.PI * 2, rr = o.size * (1.1 + 1.3 * Math.cbrt(ctx.rand())), q = Math.sqrt(1 - u * u)
        H.set(pos, col, i, Math.cos(th) * q * rr * 1.25, u * rr, Math.sin(th) * q * rr, -1, dt[0], dt[1], dt[2], 0.05 + 0.1 * ctx.rand())
      }
    },
    uniforms: { [`u_${id}_yaw`]: { value: 0 } },
    glsl: /* glsl */ `
uniform float u_${id}_yaw;
mat3 rot_${id}(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 tilt_${id}() { float c = cos(${f(o.tilt ?? 0)}), s = sin(${f(o.tilt ?? 0)}); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float yaw_${id}(float t) { return u_${id}_yaw + ${f(o.yaw0 ?? 0)} + ${f(o.sway ?? 0.3)} * sin(t * 0.37) + ${f(o.spin ?? 0)} * t; }
vec3 anim_${id}(vec3 p, vec4 d, vec4 r, float t) {
  if (d.w < 0.0) return p;
  return tilt_${id}() * (rot_${id}(yaw_${id}(t)) * p) + ${v3(off)};
}
float size_${id}(vec4 d, vec4 r, float t) {
  if (d.w < 0.0) return 0.8 + 0.6 * r.y;
  return 1.0;
}
vec4 color_${id}(vec4 c, vec4 d, vec4 r, float t) {
  if (d.w < 0.0) return c;
  mat3 R = tilt_${id}() * rot_${id}(yaw_${id}(t));
  vec3 n = normalize(R * (c.rgb * 2.0 - 1.0));
  vec3 wp = R * d.xyz + ${v3(off)};
  vec3 V = normalize(cameraPosition - wp);
  float ao = d.w;
  vec3 L1 = normalize(vec3(-0.55, 0.7, 0.62));
  vec3 L2 = normalize(vec3(0.85, 0.05, 0.3));
  float nl = dot(n, L1);
  float lam = max(nl, 0.0);
  float wrap = pow(clamp(nl * 0.5 + 0.5, 0.0, 1.0), 2.0);         // soft marble wrap-around
  float fl = max(dot(n, L2), 0.0);
  float nv = max(dot(n, V), 0.0);
  float rimF = pow(1.0 - nv, 3.0);
  float spec = pow(max(dot(reflect(-L1, n), V), 0.0), ${f(o.shine ?? 28)});
  vec3 col = ${v3(key)} * (0.62 * lam + 0.2 * wrap) + ${v3(fill)} * 0.24 * fl + ${v3(rim)} * rimF * 0.5 + ${v3(key)} * spec * ${f(o.spec ?? 0.5)};
  col *= mix(0.18, 1.0, ao * ao);
  col += ${v3(fill)} * 0.035;
  float glint = step(0.996, fract(r.w * 173.0 + t * 0.07)) * lam * 0.9;   // a few glinting grains
  col += glint;
  ${o.tweak ?? ''}
  float facing = smoothstep(-0.1, 0.2, dot(n, V));
  float a = ${f(o.alpha ?? 0.34)} * mix(${f(o.back ?? 0.05)}, 1.0, facing);
  return vec4(${v3(albedo)} * col, a);
}`,
    update(_t, _dt) {},
    camera: o.camera ?? { pos: [0, 0.2, 9], target: [0, 0, 0] },
    pointSize: o.pointSize ?? 1.7,
    drift: o.drift ?? 0.012,
  }
}

const form: FormDef = sculpt({
  id: 'bust',
  url: '/models/bust.bin',
  size: 1.6,
  albedo: [0.96, 0.93, 0.86],
  sway: 0.18,
  alpha: 0.7,
  pointSize: 2.1,
  shine: 34,
  spec: 0.42,
  // marble: cool shadows, warm lights, and a few faint grey veins (object-space, so they ride the stone)
  tweak: `
  col = col * 1.22 + vec3(0.03, 0.032, 0.04);
  col *= mix(vec3(0.86, 0.92, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.05, 0.75, lam));
  float vein = smoothstep(0.94, 1.0, sin(d.x * 9.0 + sin(d.y * 7.0 + d.z * 5.0) * 2.2 + sin(d.z * 11.0) * 0.9));
  col *= 1.0 - 0.11 * vein;`,
})
export default form
