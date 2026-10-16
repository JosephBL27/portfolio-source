// Lab page for the glass brain. Full-viewport drafting paper, the globe large and centred,
// a halftone shadow + caustic on the wall (lab-only stand-in for ground.ts), drag to turn,
// scroll to dolly, legend buttons per folder, pulse and night shift.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import {
  CapsuleGeometry, CatmullRomCurve3, Color, Mesh, MeshBasicMaterial, PerspectiveCamera, TubeGeometry, PlaneGeometry, PMREMGenerator, Scene, ShaderMaterial, Vector2, Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createBrain } from '../src/gl/brain'
import { createGlassMaterial } from '../src/gl/glassMaterial'
import { graph } from '../src/data'
import { DAY, NIGHT, palette } from '../src/theme'
import { state, setNight } from '../src/state'
import { bus } from '../src/bus'

const css = /* css */ `
:root { --paper:${DAY.paper}; --ink:${DAY.ink}; --graphite:${DAY.graphite}; --rule:${DAY.rule}; --brain:${DAY.brain}; --raised:${DAY.paperRaised}; }
[data-theme="night"] { --paper:${NIGHT.paper}; --ink:${NIGHT.ink}; --graphite:${NIGHT.graphite}; --rule:${NIGHT.rule}; --brain:${NIGHT.brain}; --raised:${NIGHT.paperRaised}; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--paper); color: var(--ink); overflow: hidden;
  font-family: 'Archivo Variable', system-ui, sans-serif; transition: background-color .6s, color .6s; }
#gl { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; touch-action: none; cursor: grab; }
#gl.drag { cursor: grabbing; }
#drafting { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; }
#drafting * { vector-effect: non-scaling-stroke; }
.lab { position: fixed; inset: 0; pointer-events: none; }
.lab > * { pointer-events: auto; }
.mono, .kicker, .legend, .controls, .titleblock, #tip { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
.lab-head { position: absolute; left: clamp(20px, 3.4vw, 56px); top: clamp(20px, 4.4vh, 52px); max-width: 30rem; pointer-events: none; }
.kicker { margin: 0 0 18px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--graphite); font-weight: 500; }
.kicker .sep { color: var(--rule); margin: 0 .4em; }
h2 { margin: 0; font-variation-settings: 'wdth' 112; font-weight: 560; font-size: clamp(34px, 3.7vw, 60px); letter-spacing: -.025em; line-height: .96; text-wrap: balance; }
.lede { margin: 18px 0 0; font-size: 16px; line-height: 1.55; color: var(--graphite); max-width: 21rem; font-variation-settings: 'wdth' 100; }
.legend { position: absolute; left: clamp(20px, 3.4vw, 56px); bottom: clamp(20px, 4.4vh, 48px); }
.legend ol { background: var(--paper); transition: background-color .6s; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; width: 23rem; border-top: 1px solid var(--ink); }
.legend li { border-bottom: 1px solid var(--rule); }
.legend button { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 10px; width: 100%;
  padding: 8px 2px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; color: var(--ink); transition: color .2s; }
.legend button .sw { width: 9px; height: 9px; border: 1px solid currentColor; border-radius: 50%; transition: background .2s, border-color .2s; }
.legend button .n { color: var(--graphite); font-variant-numeric: tabular-nums; }
.legend button:hover .sw { background: currentColor; }
.legend button[aria-pressed="true"] .sw { background: var(--brain); border-color: var(--brain); }
.legend button[aria-pressed="true"] { color: var(--ink); }
.legend button:disabled { color: var(--rule); cursor: default; }
.legend button:disabled .n { color: var(--rule); }
.legend button:focus-visible, .controls button:focus-visible { outline: 2px solid var(--brain); outline-offset: 2px; }
.controls { position: absolute; right: clamp(20px, 3.4vw, 56px); top: clamp(20px, 4.4vh, 52px); display: flex; gap: 8px; }
.controls button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px;
  border: 1px solid var(--ink); border-radius: 17px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer;
  background: var(--paper); transition: background .2s, color .2s, transform .12s; }
.controls button:hover { background: var(--ink); color: var(--paper); }
.controls button:active { transform: translateY(1px) scale(.98); }
.controls .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brain); display: inline-block; }
.controls button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.titleblock { position: absolute; right: clamp(20px, 3.4vw, 56px); bottom: clamp(20px, 4.4vh, 48px); display: grid; grid-template-columns: repeat(3, auto);
  border: 1px solid var(--ink); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; background: color-mix(in srgb, var(--paper) 86%, transparent); }
.titleblock div { padding: 7px 12px 8px; border-right: 1px solid var(--rule); display: grid; gap: 3px; min-width: 92px; }
.titleblock div:nth-child(3) { border-right: 0; }
.titleblock .tb-wide { grid-column: 1 / -1; border-top: 1px solid var(--rule); border-right: 0; display: flex; justify-content: space-between; }
.titleblock span { color: var(--graphite); font-size: 9.5px; }
.titleblock b { font-weight: 500; font-variant-numeric: tabular-nums; }
.titleblock .tb-wide b { color: var(--graphite); font-weight: 400; font-size: 9.5px; }
#tip { position: fixed; left: 0; top: 0; padding: 5px 9px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; background: var(--ink); color: var(--paper);
  pointer-events: none; opacity: 0; transform: translate(-50%, calc(-100% - 12px)); transition: opacity .15s; white-space: nowrap; }
#tip.on { opacity: 1; }
@media (max-width: 760px) {
  .legend ol { width: calc(100vw - 40px); gap: 0 16px; }
  .titleblock { display: none; }
  .controls { top: auto; bottom: calc(clamp(20px, 4.4vh, 48px) + 214px); right: 20px; left: 20px; justify-content: flex-start; }
  .controls button { height: 30px; padding: 0 11px; font-size: 10px; }
  .legend button { padding: 6px 2px; font-size: 10px; }
  .lab-head { right: 20px; }
  .kicker { margin-bottom: 10px; }
  h2 { font-size: 30px; }
  .lede { font-size: 14px; }
}
`
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)
{
  const q = new URLSearchParams(location.search).get('night')
  if (q === '1') state.night = true
  else if (q === '0') state.night = false
}
document.documentElement.dataset.theme = state.night ? 'night' : 'day'

// ---------------------------------------------------------------- copy from data
const stats = graph.stats as { notes: number; links: number; generated: string }
const fmt = (n: number) => n.toLocaleString('en-US')
const gen = new Date(stats.generated + 'T12:00:00')
const genLong = gen.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
document.getElementById('brain-h')!.textContent = `${fmt(stats.notes)} notes, etched in glass.`
document.querySelector('.lede')!.textContent =
  `My vault's link graph on ${genLong}: ${fmt(stats.notes)} notes and ${fmt(stats.links)} links. Each layer is a folder. Turn it.`
document.getElementById('tb-notes')!.textContent = fmt(stats.notes)
document.getElementById('tb-links')!.textContent = fmt(stats.links)
document.getElementById('tb-gen')!.textContent = stats.generated

// ---------------------------------------------------------------- three
const canvas = document.getElementById('gl') as HTMLCanvasElement
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
const dpr = Math.min(window.devicePixelRatio || 1, 2)
renderer.setPixelRatio(dpr)
const scene = new Scene()
const camera = new PerspectiveCamera(28, 1, 0.1, 50)
let BASE = 3.45
let dist = 3.45, distTarget = 3.45

const pmrem = new PMREMGenerator(renderer)
const room = new RoomEnvironment()
const envRT = pmrem.fromScene(room, 0.04)
room.dispose(); pmrem.dispose()

const useEnv = new URLSearchParams(location.search).get("env") !== "0"
const brain = createBrain({ radius: 0.62, envMap: useEnv ? envRT.texture : null })
scene.add(brain.group)

// wall: drafting grid + halftone shadow of a glass ball (dark annulus, bright caustic)
const WALL_Z = -0.72
const wallMat = new ShaderMaterial({
  uniforms: {
    uPaper: { value: new Color(DAY.paper) }, uInk: { value: new Color(DAY.ink) }, uRule: { value: new Color(DAY.rule) },
    uBrain: { value: new Color(DAY.brain) }, uNight: { value: 0 }, uDpr: { value: dpr },
    uL: { value: new Vector3(-3, 4, 5).normalize() }, uC: { value: new Vector3() }, uR: { value: 0.62 }, uCore: { value: 1 },
    uRes: { value: new Vector2(1, 1) }, uCentrePx: { value: new Vector2() }, uRadiusPx: { value: 300 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vP;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uPaper, uInk, uRule, uBrain, uL, uC;
    uniform float uNight, uDpr, uR, uCore, uRadiusPx;
    uniform vec2 uRes, uCentrePx;
    varying vec3 vP;
    float screen(float cov, float cellPx, float ang) {
      float cell = cellPx * uDpr;
      vec2 p = gl_FragCoord.xy;
      float c = cos(ang), s = sin(ang);
      vec2 r = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) / cell;
      vec2 g = (fract(r) - 0.5) * cell;
      float rad = sqrt(clamp(cov, 0.0, 1.0)) * 0.6 * cell;
      return (1.0 - smoothstep(rad - 0.75, rad + 0.75, length(g))) * smoothstep(0.0, 0.06, cov);
    }
    float gridLine(float v, float period) {
      float d = abs(fract(v / period + 0.5) - 0.5) * period;
      return 1.0 - smoothstep(0.0, 1.0, d);
    }
    void main() {
      vec3 v = uC - vP;
      float tca = dot(v, uL);
      float d = length(v - uL * tca) / uR;
      float inShadow = step(0.0, tca);
      // glass ball shadow: light passes the middle, the rim bends it away (dark annulus)
      float annulus = smoothstep(0.42, 0.93, d) * (1.0 - smoothstep(0.93, 1.04, d));
      float body = (1.0 - smoothstep(0.9, 1.04, d)) * 0.07;
      float shade = clamp(annulus * 0.27 + body, 0.0, 1.0) * inShadow;
      float caustic = exp(-pow(d / 0.15, 2.0)) * inShadow * (0.7 + 0.3 * uCore);
      // drafting grid in screen px, faint, with a major line every 5
      vec2 px = gl_FragCoord.xy / uDpr;
      float minor = max(gridLine(px.x, 24.0), gridLine(px.y, 24.0));
      float major = max(gridLine(px.x, 120.0), gridLine(px.y, 120.0));
      vec3 col = uPaper;
      float gridA = mix(0.22, 0.5, uNight) * minor + mix(0.45, 0.8, uNight) * major;
      // keep the grid out from under the globe so the glass reads clean
      float r = length(gl_FragCoord.xy - uCentrePx) / (uRadiusPx * uDpr);
      gridA *= smoothstep(0.98, 1.12, r) * 0.9 + 0.1;
      col = mix(col, uRule, clamp(gridA, 0.0, 1.0) * mix(0.55, 0.5, uNight));
      // halftone: ink dots by day, paper-light dots at night (the shadow inverts into a glow)
      // seen through a ball lens the wall is inverted, so the shadow is not visible behind the
      // globe: keep the inside of the disc clean paper for the etch
      float behind = smoothstep(0.9, 1.0, r);
      shade *= behind; caustic *= mix(0.25, 1.0, behind);
      float dotsShade = screen(shade * mix(1.0, 0.0, uNight), 7.0, 0.7853982);
      vec3 dotCol = uInk;
      col = mix(col, dotCol, dotsShade * 0.92);
      float ringGlow = annulus * behind * inShadow * 0.16 * uNight;
      float glowCov = mix(caustic * 0.85, caustic * 0.9 + ringGlow, uNight);
      float dotsGlow = screen(glowCov, 7.0, 0.7853982);
      float cw = clamp(caustic / max(caustic + ringGlow, 1e-4), 0.0, 1.0);
      vec3 glowCol = mix(uInk, mix(uBrain, vec3(1.0, 0.86, 0.72), 0.25 * uNight), cw);
      col = mix(col, glowCol, dotsGlow);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
  toneMapped: false,
})
const wall = new Mesh(new PlaneGeometry(16, 10), wallMat)
wall.position.z = WALL_Z
wall.renderOrder = 0
scene.add(wall)

// ---------------------------------------------------------------- a feeder tube + capsule
// (exercises createGlassMaterial on thin geometry and setGlow; the network module owns the real ones)
const feed = new CatmullRomCurve3([
  new Vector3(-3.2, -0.34, 0), new Vector3(-1.7, -0.34, 0), new Vector3(-1.22, -0.26, 0),
  new Vector3(-0.92, -0.05, 0), new Vector3(-0.6, 0, 0),
], false, 'centripetal')
const tubeMat = createGlassMaterial({ tint: DAY.glassTint, rim: DAY.ink, rimPower: 3, bodyAlpha: 0.1, rimAlpha: 0.55, innerLine: 0.3 })
const tube = new Mesh(new TubeGeometry(feed, 200, 0.02, 14, false), tubeMat)
tube.renderOrder = 5
scene.add(tube)
const capMat = createGlassMaterial({ tint: DAY.glassTint, rim: DAY.ink, rimPower: 2.4, bodyAlpha: 0.35, rimAlpha: 0.6, innerLine: 0 })
const capsule = new Mesh(new CapsuleGeometry(0.015, 0.07, 4, 14), capMat)
const band = new Mesh(new CapsuleGeometry(0.0153, 0.022, 2, 14), new MeshBasicMaterial({ color: DAY.inbound, toneMapped: false }))
capsule.add(band); capsule.renderOrder = 6
scene.add(capsule)
const glow = new Float32Array(24 * 4)
let capT = 0
const tan = new Vector3(), up = new Vector3(0, 1, 0)
function stepCapsule(dt: number) {
  if (state.reduced) { capsule.visible = false; return }
  capT += dt / 2.2
  if (capT >= 1) { capT = 0; brain.pulseAt(feed.getPointAt(1)) }
  const u = capT < 0.5 ? 2 * capT * capT : 1 - Math.pow(-2 * capT + 2, 2) / 2
  const p = feed.getPointAt(u)
  feed.getTangentAt(u, tan)
  capsule.position.copy(p)
  capsule.quaternion.setFromUnitVectors(up, tan)
  const inGlobe = Math.max(0, 1 - p.length() / 0.75)
  glow[0] = p.x; glow[1] = p.y; glow[2] = p.z; glow[3] = 0.7
  tubeMat.setGlow(glow); brain.setGlow(glow)
  capsule.visible = u < 0.985
  band.visible = true
  void inGlobe
}

// ---------------------------------------------------------------- drafting overlay (SVG)
const svg = document.getElementById('drafting') as unknown as SVGSVGElement
function drawDrafting(cx: number, cy: number, r: number) {
  const W = innerWidth, H = innerHeight
  const ink = 'var(--ink)', rule = 'var(--graphite)'
  const ext = r * 1.16
  const ticks: string[] = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const big = i % 6 === 0
    const r0 = r * 1.045, r1 = r * (big ? 1.085 : 1.065)
    ticks.push(`M${cx + Math.cos(a) * r0},${cy + Math.sin(a) * r0}L${cx + Math.cos(a) * r1},${cy + Math.sin(a) * r1}`)
  }
  const m = 14
  const crop = (x: number, y: number, sx: number, sy: number) => `M${x + sx * m},${y}L${x + sx * (m + 18)},${y}M${x},${y + sy * m}L${x},${y + sy * (m + 18)}`
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.innerHTML = `
    <g fill="none" stroke-width="1">
      <path d="${crop(10, 10, 1, 1)}${crop(W - 10, 10, -1, 1)}${crop(10, H - 10, 1, -1)}${crop(W - 10, H - 10, -1, -1)}" stroke="${ink}" opacity=".7"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.045}" stroke="${rule}" opacity=".55"/>
      <path d="${ticks.join('')}" stroke="${rule}" opacity=".55"/>
      <path d="M${cx - ext - 26},${cy}L${cx - r * 1.1},${cy}M${cx + r * 1.1},${cy}L${cx + ext + 26},${cy}M${cx},${cy - ext - 18}L${cx},${cy - r * 1.1}M${cx},${cy + r * 1.1}L${cx},${cy + ext + 18}" stroke="${rule}" stroke-dasharray="10 3 2 3" opacity=".7"/>
      <path d="M${cx - 7},${cy}L${cx + 7},${cy}M${cx},${cy - 7}L${cx},${cy + 7}" stroke="${ink}" opacity=".0"/>
    </g>
    `
}

// ---------------------------------------------------------------- legend + controls
const ol = document.getElementById('folders')!
const buttons: HTMLButtonElement[] = []
brain.folders.forEach((f, i) => {
  const li = document.createElement('li')
  const b = document.createElement('button')
  b.type = 'button'
  b.setAttribute('aria-pressed', 'false')
  b.innerHTML = `<i class="sw"></i><span>${f.name}</span><span class="n">${f.count}</span>`
  if (f.count === 0) b.disabled = true
  b.addEventListener('click', () => focus(i === focused ? null : i))
  li.appendChild(b); ol.appendChild(li); buttons.push(b)
})
let focused: number | null = null
function focus(i: number | null) {
  focused = i
  buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
  brain.focusFolder(i)
  if (i !== null) { userYaw = 0; userPitch = 0 }
}
document.getElementById('pulse')!.addEventListener('click', () => bus.emit('pulse', {}))
bus.on('pulse', (e) => brain.pulse(e.node))
const nightBtn = document.getElementById('night')!
nightBtn.addEventListener('click', () => setNight(!state.night))
bus.on('theme', ({ night }) => applyTheme(night))
document.getElementById('reset')!.addEventListener('click', () => { focus(null); userYaw = 0; userPitch = 0; distTarget = BASE })

function applyTheme(night: boolean) {
  nightBtn.setAttribute('aria-pressed', String(night))
  brain.setNight(night)
  tubeMat.setNight(night); capMat.setNight(night)
  ;(band.material as MeshBasicMaterial).color.set(palette(night).inbound)
  const p = palette(night)
  wallTarget = { paper: new Color(p.paper), ink: new Color(p.ink), rule: new Color(p.rule), brain: new Color(p.brain), night: night ? 1 : 0 }
  if (state.reduced) wallK = 1
  else wallK = 0
}
let wallTarget = { paper: new Color(DAY.paper), ink: new Color(DAY.ink), rule: new Color(DAY.rule), brain: new Color(DAY.brain), night: 0 }
let wallK = 1
{
  const p = palette(state.night)
  wallMat.uniforms.uPaper.value.set(p.paper); wallMat.uniforms.uInk.value.set(p.ink)
  wallMat.uniforms.uRule.value.set(p.rule); wallMat.uniforms.uBrain.value.set(p.brain)
  wallMat.uniforms.uNight.value = state.night ? 1 : 0
  nightBtn.setAttribute('aria-pressed', String(state.night))
}

// ---------------------------------------------------------------- input
let userYaw = 0, userPitch = 0, dragging = false, lastX = 0, lastY = 0, lastInput = -1e9
const ndc = new Vector2(), tip = document.getElementById('tip')!
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag') })
canvas.addEventListener('pointerup', (e) => { dragging = false; canvas.releasePointerCapture(e.pointerId); canvas.classList.remove('drag'); lastInput = performance.now() })
canvas.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
  if (dragging) {
    userYaw = Math.max(-1.3, Math.min(1.3, userYaw + (e.clientX - lastX) * 0.006))
    userPitch = Math.max(-0.9, Math.min(0.9, userPitch + (e.clientY - lastY) * 0.006))
    lastX = e.clientX; lastY = e.clientY; lastInput = performance.now()
    tip.classList.remove('on')
    return
  }
  const hit = brain.pick(ndc, camera, 9, innerHeight)
  if (hit) {
    tip.textContent = `${hit.folder} · ${hit.degree} ${hit.degree === 1 ? 'link' : 'links'}`
    tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'
    tip.classList.add('on')
  } else tip.classList.remove('on')
})
canvas.addEventListener('pointerleave', () => tip.classList.remove('on'))
addEventListener('wheel', (e) => { distTarget = Math.max(BASE * 0.6, Math.min(BASE * 1.35, distTarget + e.deltaY * 0.0016)); lastInput = performance.now() }, { passive: true })

// ---------------------------------------------------------------- frame
let cx = 0, cy = 0, rPx = 0
function resize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  // portrait: back the camera off until the globe fits the width
  const fitW = 0.62 / (0.86 * Math.tan((14 * Math.PI) / 180) * camera.aspect)
  const nb = Math.max(3.45, fitW)
  distTarget += nb - BASE; BASE = nb
  if (!dist || Math.abs(dist - nb) > 2) dist = distTarget
}
addEventListener('resize', resize)
resize()

function layoutOverlay() {
  const w = innerWidth, h = innerHeight
  const ang = Math.asin(Math.min(0.99, 0.62 / dist))
  const r = (Math.tan(ang) / Math.tan((camera.fov * Math.PI) / 360)) * (h / 2)
  const c = new Vector3(0, 0, 0).project(camera)
  const ncx = (c.x * 0.5 + 0.5) * w, ncy = (-c.y * 0.5 + 0.5) * h
  if (Math.abs(ncx - cx) + Math.abs(ncy - cy) + Math.abs(r - rPx) > 0.5) {
    cx = ncx; cy = ncy; rPx = r
    drawDrafting(cx, cy, rPx)
  }
  wallMat.uniforms.uCentrePx.value.set(cx * dpr, (h - cy) * dpr)
  wallMat.uniforms.uRadiusPx.value = rPx
}

let prev = performance.now()
const t0 = prev
function frame(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now
  const t = (now - t0) / 1000
  // ease back to the front view a few seconds after the last drag
  if (!dragging && now - lastInput > 3500 && !state.reduced) {
    const k = 1 - Math.exp(-dt * 0.9)
    userYaw += (0 - userYaw) * k; userPitch += (0 - userPitch) * k
  }
  brain.setTurn(userYaw, userPitch)
  dist += (distTarget - dist) * (state.reduced ? 1 : 1 - Math.exp(-dt * 6))
  camera.position.set(0, 0, dist)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  if (!state.paused) stepCapsule(dt)
  brain.update(dt, t)
  // wall theme crossfade
  if (wallK < 1) {
    wallK = Math.min(1, wallK + dt / 0.6)
    const u = wallMat.uniforms
    u.uPaper.value.lerp(wallTarget.paper, wallK); u.uInk.value.lerp(wallTarget.ink, wallK)
    u.uRule.value.lerp(wallTarget.rule, wallK); u.uBrain.value.lerp(wallTarget.brain, wallK)
    u.uNight.value += (wallTarget.night - u.uNight.value) * wallK
  }
  layoutOverlay()
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// auto pulse every few seconds so the page is always moving
let auto = 0
setInterval(() => {
  if (state.paused || document.hidden) return
  auto++
  if (focused === null) brain.pulse(auto % 3 === 0 ? undefined : Math.floor(Math.random() * graph.nodes.length))
}, 4200)

// test hooks for scripts/shot.mjs
;(window as unknown as Record<string, unknown>).__lab = {
  brain, focus, pulse: (n?: number) => brain.pulse(n), night: (n: boolean) => setNight(n),
  turn: (y: number, p: number) => { userYaw = y; userPitch = p; lastInput = performance.now() + 1e6 },
  dolly: (d: number) => { distTarget = d },
  capsule: () => ({ p: capsule.position.toArray(), v: capsule.visible, t: capT }),
}
