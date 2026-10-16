// Unit 15F: a small GPU "stable fluids" ink (Jos Stam; after Pavel Dobryakov's WebGL-Fluid-Simulation, rewritten, no code copied).
// One shared WebGL2 context and one canvas serve every host that mounts it (Overview, case header, finale), because only one is on screen
// at a time. Velocity runs on a coarse grid, the ink (dye) on a half-resolution texture that the canvas shows. The pointer stirs it, the
// record on the turntable pushes it (bass lifts, beats burst), and when nothing has touched it for a while it writes a faint signature
// with a smile under it. Pauses when the host is off screen or the tab is hidden. Reduced motion or no WebGL2: a still gradient instead.
import './fluid.css'
import { turntable } from '../../audio/turntable'

export interface FluidOpts {
  /** css colours the ink drifts between */
  tints: string[]
  /** 0..1, how strong the ink shows (default .7) */
  strength?: number
  /** write the idle signature (default false) */
  signature?: boolean
  /** where the signature sits (0..1 of the host, y down) and how wide it is (fraction of the host width) */
  sigAt?: [number, number]; sigWidth?: number
  /** cover the whole viewport instead of the host box (the Overview scrolls) */
  fixed?: boolean
}
export interface FluidHandle { setTints(t: string[]): void; unmount(): void }

const rm = () => document.documentElement.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- colour ----------
let cctx: CanvasRenderingContext2D | null = null
function rgb(css: string): [number, number, number] {
  cctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!cctx) return [1, 1, 1]
  cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = '#fff'; cctx.fillStyle = css; cctx.fillRect(0, 0, 1, 1)
  const d = cctx.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

// ---------- shaders ----------
const VS = `#version 300 es
precision highp float;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 tx;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p; vL = p - vec2(tx.x, 0.); vR = p + vec2(tx.x, 0.); vT = p + vec2(0., tx.y); vB = p - vec2(0., tx.y);
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`
const H = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 o;`
const FS = {
  splat: `${H}
uniform sampler2D uT; uniform float asp; uniform vec3 col; uniform vec2 pt; uniform float rad;
void main(){ vec2 p = vUv - pt; p.x *= asp; vec3 s = exp(-dot(p, p) / rad) * col; o = vec4(texture(uT, vUv).xyz + s, 1.); }`,
  advect: `${H}
uniform sampler2D uV; uniform sampler2D uS; uniform vec2 tx; uniform float dt; uniform float diss;
void main(){ vec2 c = vUv - dt * texture(uV, vUv).xy * tx; o = diss * texture(uS, c); }`,
  div: `${H}
uniform sampler2D uV;
void main(){
  float L = texture(uV, vL).x, R = texture(uV, vR).x, T = texture(uV, vT).y, B = texture(uV, vB).y;
  vec2 c = texture(uV, vUv).xy;
  if (vL.x < 0.) L = -c.x; if (vR.x > 1.) R = -c.x; if (vT.y > 1.) T = -c.y; if (vB.y < 0.) B = -c.y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
}`,
  curl: `${H}
uniform sampler2D uV;
void main(){ float L = texture(uV, vL).y, R = texture(uV, vR).y, T = texture(uV, vT).x, B = texture(uV, vB).x; o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`,
  vort: `${H}
uniform sampler2D uV; uniform sampler2D uC; uniform float curl; uniform float dt;
void main(){
  float L = texture(uC, vL).x, R = texture(uC, vR).x, T = texture(uC, vT).x, B = texture(uC, vB).x, C = texture(uC, vUv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= curl * C; f.y *= -1.;
  vec2 v = texture(uV, vUv).xy + f * dt; o = vec4(clamp(v, -1000., 1000.), 0., 1.);
}`,
  press: `${H}
uniform sampler2D uP; uniform sampler2D uD;
void main(){
  float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
  o = vec4((L + R + B + T - texture(uD, vUv).x) * .25, 0., 0., 1.);
}`,
  clear: `${H}
uniform sampler2D uT; uniform float v;
void main(){ o = v * texture(uT, vUv); }`,
  grad: `${H}
uniform sampler2D uP; uniform sampler2D uV;
void main(){
  float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x;
  vec2 v = texture(uV, vUv).xy - vec2(R - L, T - B); o = vec4(v, 0., 1.);
}`,
  // the ink on screen: the dye is lit like a thin wet film (its own gradient is the surface normal) and written premultiplied
  show: `${H}
uniform sampler2D uD; uniform float k;
void main(){
  vec3 c = texture(uD, vUv).rgb;
  float l = dot(c, vec3(.3, .5, .2));
  float lx = dot(texture(uD, vR).rgb - texture(uD, vL).rgb, vec3(.3, .5, .2)), ly = dot(texture(uD, vT).rgb - texture(uD, vB).rgb, vec3(.3, .5, .2));
  vec3 n = normalize(vec3(-lx * 6., -ly * 6., 1.));
  float spec = pow(max(dot(n, normalize(vec3(-.4, .6, .7))), 0.), 28.) * smoothstep(.02, .3, l);
  float m = max(c.r, max(c.g, c.b));
  float a = clamp(m * 2.4, 0., 1.) * k;
  vec3 hue = c / max(m, 1e-3);
  vec3 rgb = (hue * (.78 + .5 * smoothstep(0., .6, l)) + spec * .6) * a;
  o = vec4(min(rgb, vec3(1.)), min(1., a + spec * .12 * a));
}`,
}

interface FBO { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }
interface DFBO { r: FBO; w: FBO; swap(): void }

// ---------- the idle signature: hand-authored cubic segments in a 100 x 40 box (x right, y down), then a smile ----------
const SIG: number[][] = [
  [6, 6, 16, 2, 22, 12, 19, 24], [19, 24, 17, 34, 6, 36, 5, 28],       // J: hook and tail
  [24, 20, 30, 8, 36, 6, 37, 16], [37, 16, 38, 26, 32, 28, 30, 24],     // o
  [30, 24, 40, 30, 42, 12, 46, 8], [46, 8, 50, 12, 48, 24, 52, 24],     // flick up to a B-like loop
  [52, 24, 60, 26, 62, 14, 55, 14], [55, 14, 62, 14, 66, 26, 58, 30],
  // the smile: an underline that curls up at both ends
  [10, 34, 30, 44, 62, 44, 84, 31], [84, 31, 87, 29, 89, 27, 90, 24],
]
const DOTS: [number, number][] = [[70, 12], [80, 12]] // two small eyes (ink drops) after the smile is drawn
const bez = (s: number[], t: number): [number, number] => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [a * s[0] + b * s[2] + c * s[4] + d * s[6], a * s[1] + b * s[3] + c * s[5] + d * s[7]]
}

// ---------- the shared engine ----------
interface Mount { host: HTMLElement; wrap: HTMLElement; opts: Required<Pick<FluidOpts, 'strength'>> & FluidOpts; tints: [number, number, number][]; vis: boolean; io: IntersectionObserver; ro: ResizeObserver; still: boolean }
let gl: WebGL2RenderingContext | null = null
let canvas: HTMLCanvasElement | null = null
let failed = false
const stack: Mount[] = []
let raf = 0, last = 0
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
let progs: Record<keyof typeof FS, Prog>
let vel: DFBO, dye: DFBO, prs: DFBO, divT: FBO, curlT: FBO
let cw = 0, ch = 0, sw = 0, sh = 0
// pointer
let px = -1, py = -1, pvx = 0, pvy = 0, lastMove = 0, hue = 0
// idle signature
let sigT = -1, lastSig = 0
// the cost of the last frame's draw calls, in ms (read by the check scripts)
const stat = { ms: 0, avg: 0, frames: 0 }
;(window as unknown as { __fluid: typeof stat }).__fluid = stat

function compile(src: string, type: number): WebGLShader { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s); if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) || 'shader'); return s }
function program(fs: string): Prog {
  const g = gl!, p = g.createProgram()!
  g.attachShader(p, compile(VS, g.VERTEX_SHADER)); g.attachShader(p, compile(fs, g.FRAGMENT_SHADER)); g.linkProgram(p)
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) || 'link')
  const u: Record<string, WebGLUniformLocation | null> = {}
  const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) { const nm = g.getActiveUniform(p, i)!.name; u[nm] = g.getUniformLocation(p, nm) }
  return { p, u }
}
function fbo(w: number, h: number, filter: number): FBO {
  const g = gl!, tex = g.createTexture()!
  g.bindTexture(g.TEXTURE_2D, tex)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filter); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filter)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null)
  const fb = g.createFramebuffer()!
  g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
  g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT)
  return { tex, fb, w, h }
}
function dbl(w: number, h: number): DFBO { const d = { r: fbo(w, h, gl!.LINEAR), w: fbo(w, h, gl!.LINEAR), swap() { const t = d.r; d.r = d.w; d.w = t } }; return d }
function free(...l: (FBO | DFBO)[]) { for (const f of l) for (const x of 'r' in f ? [f.r, f.w] : [f]) { gl!.deleteTexture(x.tex); gl!.deleteFramebuffer(x.fb) } }

function initGL(): boolean {
  if (gl) return true
  if (failed) return false
  try {
    canvas = document.createElement('canvas')
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl || !gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('no float targets')
    gl.getExtension('OES_texture_float_linear')
    progs = Object.fromEntries(Object.entries(FS).map(([k, v]) => [k, program(v)])) as typeof progs
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); teardownGL() })
    return true
  } catch (e) { console.warn('[fluid] off:', (e as Error).message); failed = true; gl = null; canvas = null; return false }
}
function teardownGL() { cancelAnimationFrame(raf); raf = 0; gl = null; canvas?.remove(); canvas = null; cw = ch = 0; if (stack.length) failed = true; for (const m of stack) stillify(m) }

function size(m: Mount) {
  const r = m.opts.fixed ? { width: innerWidth, height: innerHeight } : m.host.getBoundingClientRect()
  const k = Math.min(1, 960 / Math.max(r.width, r.height, 1)) * 0.5
  const w = Math.max(48, Math.round(r.width * k * 2 * 0.5) * 1), h = Math.max(32, Math.round(r.height * k * 2 * 0.5) * 1)
  if (w === cw && h === ch) return
  if (cw) free(vel, dye, prs, divT, curlT)
  cw = w; ch = h; canvas!.width = w; canvas!.height = h
  const s = 112, a = w / h
  sw = a >= 1 ? Math.round(s * a) : s; sh = a >= 1 ? s : Math.round(s / a)
  vel = dbl(sw, sh); prs = dbl(sw, sh); divT = fbo(sw, sh, gl!.NEAREST); curlT = fbo(sw, sh, gl!.NEAREST); dye = dbl(w, h)
}

function blit(t: FBO | null, p: Prog) {
  const g = gl!
  g.bindFramebuffer(g.FRAMEBUFFER, t ? t.fb : null); g.viewport(0, 0, t ? t.w : cw, t ? t.h : ch)
  g.drawArrays(g.TRIANGLES, 0, 3)
  void p
}
function use(p: Prog, tx?: FBO) { gl!.useProgram(p.p); if (tx) gl!.uniform2f(p.u.tx, 1 / tx.w, 1 / tx.h) }
function bind(unit: number, f: FBO, loc: WebGLUniformLocation | null) { gl!.activeTexture(gl!.TEXTURE0 + unit); gl!.bindTexture(gl!.TEXTURE_2D, f.tex); gl!.uniform1i(loc, unit) }

function splat(x: number, y: number, dx: number, dy: number, c: [number, number, number], radius = 0.0016, force = 1) {
  const g = gl!, p = progs.splat
  use(p, vel.r); g.uniform1f(p.u.asp, cw / ch); g.uniform1f(p.u.rad, radius); g.uniform2f(p.u.pt, x, y)
  bind(0, vel.r, p.u.uT); g.uniform3f(p.u.col, dx * force, dy * force, 0); blit(vel.w, p); vel.swap()
  use(p, dye.r); bind(0, dye.r, p.u.uT); g.uniform3f(p.u.col, c[0], c[1], c[2]); g.uniform1f(p.u.rad, radius * 1.4); blit(dye.w, p); dye.swap()
}

function step(dt: number, ink = 0.6) {
  const g = gl!
  g.disable(g.BLEND)
  // curl + vorticity confinement keep the swirls alive
  let p = progs.curl; use(p, vel.r); bind(0, vel.r, p.u.uV); blit(curlT, p)
  p = progs.vort; use(p, vel.r); bind(0, vel.r, p.u.uV); bind(1, curlT, p.u.uC); g.uniform1f(p.u.curl, 24); g.uniform1f(p.u.dt, dt); blit(vel.w, p); vel.swap()
  p = progs.div; use(p, vel.r); bind(0, vel.r, p.u.uV); blit(divT, p)
  p = progs.clear; use(p, prs.r); bind(0, prs.r, p.u.uT); g.uniform1f(p.u.v, 0.8); blit(prs.w, p); prs.swap()
  p = progs.press; use(p, vel.r); bind(1, divT, p.u.uD)
  for (let i = 0; i < 14; i++) { bind(0, prs.r, p.u.uP); blit(prs.w, p); prs.swap() }
  p = progs.grad; use(p, vel.r); bind(0, prs.r, p.u.uP); bind(1, vel.r, p.u.uV); blit(vel.w, p); vel.swap()
  p = progs.advect; use(p, vel.r); g.uniform1f(p.u.dt, dt); bind(0, vel.r, p.u.uV); bind(1, vel.r, p.u.uS); g.uniform1f(p.u.diss, Math.pow(0.2, dt)); blit(vel.w, p); vel.swap()
  use(p, vel.r); g.uniform2f(p.u.tx, 1 / sw, 1 / sh); bind(0, vel.r, p.u.uV); bind(1, dye.r, p.u.uS); g.uniform1f(p.u.diss, Math.pow(ink, dt)); g.uniform1f(p.u.dt, dt)
  g.viewport(0, 0, cw, ch); g.bindFramebuffer(g.FRAMEBUFFER, dye.w.fb); g.drawArrays(g.TRIANGLES, 0, 3); dye.swap()
}

function show(k: number) {
  const g = gl!, p = progs.show
  g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
  g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, cw, ch); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT)
  use(p, dye.r); bind(0, dye.r, p.u.uD); g.uniform1f(p.u.k, k)
  g.drawArrays(g.TRIANGLES, 0, 3); g.disable(g.BLEND)
}

const tintAt = (m: Mount, u: number): [number, number, number] => {
  const n = m.tints.length, f = ((u % n) + n) % n, i = Math.floor(f), a = m.tints[i], b = m.tints[(i + 1) % n], t = f - i
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function frame(now: number) {
  raf = 0
  const m = stack[stack.length - 1]
  if (!m || !gl || document.hidden) { last = 0; return }
  if (!m.vis) { last = 0; return } // IntersectionObserver restarts the loop
  const t0 = performance.now()
  const dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016; last = now
  size(m)
  const r = m.opts.fixed ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : m.host.getBoundingClientRect()
  const s = m.opts.strength
  // pointer stir
  if (now - lastMove < 80 && px >= 0 && (Math.abs(pvx) + Math.abs(pvy)) > 0.4) {
    const u = (px - r.left) / r.width, v = 1 - (py - r.top) / r.height
    if (u > -0.05 && u < 1.05 && v > -0.05 && v < 1.05) {
      hue += Math.hypot(pvx, pvy) * 0.0012
      const c = tintAt(m, hue), amt = Math.min(1, Math.hypot(pvx, pvy) * 0.012) * 0.42 * s
      splat(u, v, pvx * 0.9, -pvy * 0.9, [c[0] * amt, c[1] * amt, c[2] * amt], 0.0011 + amt * 0.002, 1)
    }
    pvx *= 0.6; pvy *= 0.6
  }
  // music: bass lifts a column of ink from the bottom, a beat bursts, the highs shimmer
  let playing = false
  try {
    const b = turntable.bands(now)
    playing = b.level > 0.04
    if (playing) {
      const c = tintAt(m, hue + b.mid * 2)
      if (b.bass > 0.25) splat(0.12 + Math.random() * 0.76, 0.02, (Math.random() - 0.5) * 30, 90 * b.bass, c.map(x => x * 0.16 * b.bass * s) as [number, number, number], 0.0028, 1)
      if (b.beat > 0.55) { const x = 0.15 + Math.random() * 0.7, y = 0.3 + Math.random() * 0.5; for (let i = 0; i < 4; i++) { const a = Math.PI * 0.5 * i + b.beat; splat(x, y, Math.cos(a) * 110 * b.beat, Math.sin(a) * 110 * b.beat, c.map(q => q * 0.2 * s) as [number, number, number], 0.0018, 1) } }
      if (b.snare > 0.5) splat(Math.random(), 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 140, -40, tintAt(m, hue + 1).map(q => q * 0.14 * s) as [number, number, number], 0.0012, 1)
    }
  } catch { /* no audio module state yet */ }
  // idle signature: after a quiet moment with no pointer and no music, the ink writes its mark and smiles
  if (m.opts.signature) {
    if (sigT < 0 && !playing && now - Math.max(lastMove, lastSig) > 4200) { sigT = 0; hue += 0.5 }
    if (sigT >= 0) {
      if (playing || now - lastMove < 120) sigT = -1, lastSig = now
      else {
        const T = 5.2, a = sigT / T; sigT += dt
        const segs = SIG.length, f = Math.min(0.9999, a) * segs, si = Math.floor(f), pt = bez(SIG[si], f - si), pt2 = bez(SIG[si], Math.min(1, f - si + 0.03))
        // box: centred, a third of the width wide, kept inside the host
        const cx = m.opts.sigAt?.[0] ?? 0.5, cy = 1 - (m.opts.sigAt?.[1] ?? 0.5)
        const box = Math.min(r.width * (m.opts.sigWidth ?? 0.42), r.height * 1.5), bw = box / r.width, bh = box * 0.4 / r.height, ox = cx - bw / 2, oy = cy + bh / 2
        const X = (q: [number, number]) => ox + q[0] / 100 * bw, Y = (q: [number, number]) => oy - q[1] / 40 * bh
        const dx = (X(pt2) - X(pt)) * 900, dy = (Y(pt2) - Y(pt)) * 900
        const c = tintAt(m, hue + a * 1.5), q = 0.3 * s
        if (a < 1) splat(X(pt), Y(pt), dx, dy, [c[0] * q, c[1] * q, c[2] * q], 0.00012, 0.05)
        else {
          // two eyes, one drop each, then rest
          DOTS.forEach((d, i) => { if (!(sigT > T + i * 0.35 && sigT < T + i * 0.35 + dt * 1.6)) return; splat(X(d), Y(d), 0, 0, [c[0] * 0.5 * s, c[1] * 0.5 * s, c[2] * 0.5 * s], 0.0007, 0) })
          if (sigT > T + 1.4) { sigT = -1; lastSig = now }
        }
      }
    }
  }
  step(dt, sigT >= 0 ? 0.85 : 0.6)
  show(Math.min(1, s * 1.15))
  const ms = performance.now() - t0
  stat.ms = ms; stat.frames++; stat.avg += (ms - stat.avg) * 0.05
  raf = requestAnimationFrame(frame)
}
const kick = () => { if (!raf && stack.length && gl) raf = requestAnimationFrame(frame) }

addEventListener('pointermove', e => {
  if (px >= 0) { pvx = e.clientX - px; pvy = e.clientY - py }
  px = e.clientX; py = e.clientY; lastMove = performance.now()
}, { passive: true })
document.addEventListener('visibilitychange', () => { last = 0; if (!document.hidden) kick() })

function stillify(m: Mount) {
  m.still = true; m.wrap.classList.add('fx-fluid--still')
  const c = m.tints[0] ?? [1, 1, 1], d = m.tints[1] ?? c, q = (x: number[], a: number) => `rgb(${x.map(v => Math.round(v * 255)).join(' ')} / ${a})`
  m.wrap.style.background = `radial-gradient(60% 55% at 30% 40%, ${q(c, 0.2 * m.opts.strength)}, transparent 70%), radial-gradient(50% 60% at 72% 62%, ${q(d, 0.16 * m.opts.strength)}, transparent 72%)`
  m.wrap.querySelector('canvas')?.remove()
}

/** put the ink behind `host`; returns null never: when the GPU path is unavailable it mounts a still gradient instead */
export function mountFluid(host: HTMLElement, opts: FluidOpts): FluidHandle {
  const wrap = document.createElement('i'); wrap.className = 'fx-fluid' + (opts.fixed ? ' fx-fluid--fixed' : ''); wrap.setAttribute('aria-hidden', 'true')
  host.prepend(wrap)
  const m: Mount = {
    host, wrap, opts: { strength: 0.7, ...opts }, tints: opts.tints.map(rgb), vis: true, still: false,
    io: new IntersectionObserver(es => { m.vis = es.some(e => e.isIntersecting); if (m.vis) kick() }),
    ro: new ResizeObserver(() => { if (stack[stack.length - 1] === m) cw = 0 }),
  }
  if (rm() || !initGL()) { stillify(m); return { setTints(t) { m.tints = t.map(rgb); stillify(m) }, unmount() { wrap.remove() } } }
  m.io.observe(host); m.ro.observe(host)
  stack.push(m)
  // the active mount owns the canvas
  wrap.append(canvas!); cw = 0; last = 0; sigT = -1; lastSig = performance.now()
  if (stack.length > 1) stack[stack.length - 2].wrap.classList.add('fx-fluid--idle')
  kick()
  return {
    setTints(t) { m.tints = t.map(rgb); if (m.still) stillify(m) },
    unmount() {
      m.io.disconnect(); m.ro.disconnect()
      const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1)
      m.wrap.remove()
      const top = stack[stack.length - 1]
      if (top && canvas) { top.wrap.classList.remove('fx-fluid--idle'); top.wrap.append(canvas); cw = 0; last = 0; kick() }
    },
  }
}
