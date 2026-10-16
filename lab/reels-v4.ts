// Lab: the v4 reels (cloudflare, appfolio, chomchom, secretary, watchdog); same modes as reels-v3. Modes (query string):
//   (none)            contact sheet: every reel once at time ?t (default 6), tiles ?w x ?h (default 480x300), ?cols
//   ?id=<reel>        one reel fullscreen, frozen at ?t (add &live=1 to let it run)
//   ?strip=<reel>     one reel at ?n moments, ?t + k*?dt
//   ?check=1          compile every reel through three.js ShaderMaterial and RawShaderMaterial, log errors
//   ?perf=<reel>      run the reel live for 3 s and log the average frame time
// Other params: ?i=<intensity 0..1>, ?seed=<0..1>, ?mouse=x,y (0..1), ?dpr=<n>, ?bare (no captions)
import type { ReelDef } from '../src/reels/types'
import { createReelCanvas } from '../src/reels/mini'
import { setNight, setPaused } from '../src/state'

const mods = import.meta.glob<{ default: ReelDef }>(['../src/reels/*.ts', '!../src/reels/{index,mini,test,types,font}.ts'], { eager: true })
const ORDER = ['cloudflare', 'appfolio', 'chomchom', 'secretary', 'watchdog']
const ALL: ReelDef[] = Object.values(mods).map(m => m.default).filter(r => r && ORDER.includes(r.id))
ALL.sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99)

const qp = new URLSearchParams(location.search)
const num = (k: string, d: number) => (qp.has(k) ? +qp.get(k)! : d)
const t0 = num('t', 6), dt = num('dt', 1.2)
const inten = num('i', 1), seed = num('seed', 0.3), dpr = num('dpr', 1)
const mouse = qp.get('mouse')?.split(',').map(Number)
const log = document.getElementById('log')!
const grid = document.getElementById('grid')!
if (qp.has('bare')) document.body.classList.add('bare')
setNight(true)

const realNow = performance.now.bind(performance)
const realRandom = Math.random

function tile(r: ReelDef, t: number, w: number | null, h: number | null, cap: string, i = inten, live = false) {
  const f = document.createElement('figure')
  if (w) { f.style.width = w + 'px'; f.style.height = h + 'px' }
  f.innerHTML = `<canvas></canvas><figcaption>${cap}</figcaption>`
  grid.append(f)
  Math.random = () => seed
  // frozen clock: every draw sees now = 1e6, so uTime is exactly t (live modes use the real clock)
  performance.now = live ? () => realNow() - t * 1000 : () => 1e6 - t * 1000
  const hd = createReelCanvas(f.querySelector('canvas')!, r, { intensity: i, dpr })
  performance.now = live ? realNow : () => 1e6
  Math.random = realRandom
  if (mouse) hd.setMouse(mouse[0], mouse[1])
  return hd
}

if (qp.has('check')) {
  import('three').then(THREE => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const renderer = new THREE.WebGLRenderer({ canvas: c })
    const errs: string[] = []
    renderer.debug.onShaderError = (gl, prog, vs, fs) => { errs.push(String(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog))) }
    const rt = new THREE.WebGLRenderTarget(64, 64)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const out: string[] = []
    const uniforms = () => ({ uTime: { value: 3 }, uRes: { value: new THREE.Vector2(64, 64) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uNight: { value: 1 }, uSeed: { value: 0.3 }, uIntensity: { value: 1 } })
    for (const r of ALL) {
      for (const kind of ['shader', 'raw'] as const) {
        errs.length = 0
        const mat = kind === 'shader'
          ? new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: r.frag, uniforms: uniforms() })
          : new THREE.RawShaderMaterial({ vertexShader: 'precision highp float;\nattribute vec3 position;\nvoid main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: r.frag, uniforms: uniforms(), depthTest: false, depthWrite: false })
        const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))
        renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null)
        const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 32, 32, 1, 1, px)
        out.push(`${r.id}/${kind}: ${errs.length ? 'ERROR ' + errs.join(' | ').slice(0, 600) : 'ok'} px=${Array.from(px).join(',')}`)
      }
    }
    log.textContent = 'three.js check\n' + out.join('\n')
    console.log('[check]', out.join(' ; '))
    ;(window as any).__done = true
  })
} else if (qp.has('perf')) {
  const r = ALL.find(x => x.id === qp.get('perf'))!
  document.body.classList.add('single', 'bare')
  const hd = tile(r, 0, null, null, '', 1, true)
  void hd
  setTimeout(() => {
    let n = 0, t = 0
    const cv = grid.querySelector('canvas')!
    const gl = (hd as any).gl as WebGL2RenderingContext
    const pix = new Uint8Array(4)
    const t1 = performance.now()
    const step = () => {
      const a = performance.now()
      hd.draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix)
      t += performance.now() - a; n++
      if (performance.now() - t1 < 3000) requestAnimationFrame(step)
      else { log.textContent = `${r.id}: ${(t / n).toFixed(2)} ms/frame (draw+readback) over ${n} frames at ${cv.width}x${cv.height}`; (window as any).__done = true }
    }
    step()
  }, 500)
} else if (qp.has('id')) {
  const r = ALL.find(x => x.id === qp.get('id'))!
  document.body.classList.add('single', 'bare')
  if (!qp.has('live')) setPaused(true)
  tile(r, t0, null, null, r.id, inten, qp.has('live'))
} else if (qp.has('strip')) {
  const r = ALL.find(x => x.id === qp.get('strip'))!
  const n = num('n', 6), w = num('w', 480), h = num('h', 300)
  const cols = num('cols', Math.min(n, 3))
  grid.style.gridTemplateColumns = `repeat(${cols}, ${w}px)`
  setPaused(true)
  for (let k = 0; k < n; k++) tile(r, t0 + k * dt, w, h, `${r.id} · t ${(t0 + k * dt).toFixed(1)}`)
} else {
  const w = num('w', 480), h = num('h', 300)
  const cols = num('cols', 3)
  grid.style.gridTemplateColumns = `repeat(${cols}, ${w}px)`
  setPaused(true)
  for (const r of ALL) tile(r, t0, w, h, `${r.id} · ${r.projectId} · t ${t0}`)
}
;(window as any).__lab = { ALL }
