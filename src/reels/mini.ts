// Minimal raw-WebGL2 runner for a reel fragment shader on its own <canvas>.
// Used for DOM-side previews and the case view background. One context per canvas;
// it renders only while visible (IntersectionObserver) and not paused.
import type { ReelDef } from './types'
import { state } from '../state'
import { bus } from '../bus'

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

export interface ReelCanvas {
  setReel(r: ReelDef): void
  setIntensity(v: number): void
  setMouse(x: number, y: number): void
  /** render one frame now (e.g. while paused or reduced motion) */
  draw(): void
  dispose(): void
  readonly gl: WebGL2RenderingContext | WebGLRenderingContext | null
}

export function createReelCanvas(canvas: HTMLCanvasElement, reel: ReelDef, opts: { dpr?: number; intensity?: number; scale?: number } = {}): ReelCanvas {
  const gl = (canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false }) ||
    canvas.getContext('webgl', { antialias: false, alpha: false })) as WebGL2RenderingContext | null
  const noop: ReelCanvas = { setReel() {}, setIntensity() {}, setMouse() {}, draw() {}, dispose() {}, gl: null }
  if (!gl) return noop
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  let prog: WebGLProgram | null = null
  let U: Record<string, WebGLUniformLocation | null> = {}
  const t0 = performance.now()
  const seed = Math.random()
  let intensity = opts.intensity ?? 1
  const mouse = [0.5, 0.5]
  function compile(src: string, type: number) {
    const s = gl!.createShader(type)!
    gl!.shaderSource(s, src); gl!.compileShader(s)
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { console.warn('[reel] shader error', gl!.getShaderInfoLog(s)); return null }
    return s
  }
  function setReel(r: ReelDef) {
    const vs = compile(VERT, gl!.VERTEX_SHADER), fs = compile(r.frag, gl!.FRAGMENT_SHADER)
    if (!vs || !fs) return
    const p = gl!.createProgram()!
    gl!.attachShader(p, vs); gl!.attachShader(p, fs); gl!.bindAttribLocation(p, 0, 'p'); gl!.linkProgram(p)
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) { console.warn('[reel] link error', gl!.getProgramInfoLog(p)); return }
    if (prog) gl!.deleteProgram(prog)
    prog = p
    U = {}
    for (const n of ['uTime', 'uRes', 'uMouse', 'uNight', 'uSeed', 'uIntensity']) U[n] = gl!.getUniformLocation(p, n)
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio, opts.dpr ?? 1.5) * (opts.scale ?? 1)
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  }
  function draw() {
    if (!prog) return
    resize()
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.useProgram(prog)
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
    gl!.enableVertexAttribArray(0)
    gl!.vertexAttribPointer(0, 2, gl!.FLOAT, false, 0, 0)
    gl!.uniform1f(U.uTime, (performance.now() - t0) / 1000)
    gl!.uniform2f(U.uRes, canvas.width, canvas.height)
    gl!.uniform2f(U.uMouse, mouse[0], mouse[1])
    gl!.uniform1f(U.uNight, state.night ? 1 : 0)
    gl!.uniform1f(U.uSeed, seed)
    gl!.uniform1f(U.uIntensity, intensity)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }
  let visible = true, raf = 0, alive = true
  const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; kick() })
  io.observe(canvas)
  const offPause = bus.on('pause', () => kick())
  function loop() {
    raf = 0
    if (!alive || !visible || document.hidden) return
    draw()
    if (!state.paused && !state.reduced) raf = requestAnimationFrame(loop)
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop) }
  document.addEventListener('visibilitychange', kick)
  setReel(reel)
  kick()
  return {
    gl,
    setReel(r) { setReel(r); kick() },
    setIntensity(v) { intensity = v; kick() },
    setMouse(x, y) { mouse[0] = x; mouse[1] = y },
    draw,
    dispose() { alive = false; cancelAnimationFrame(raf); io.disconnect(); offPause(); document.removeEventListener('visibilitychange', kick); gl.getExtension('WEBGL_lose_context')?.loseContext() },
  }
}
