// SET PIECE (unit 8M, re-keyed w12): the curved panels.  leg world > surface  (the establishing shot -> Work, the first area).
// The Awwwards / ALCHE bent panels, made physical: the camera is leaving the whole-world shot (the ring of areas round the hub TV), and the work area's five projects arrive on tall, convex, glossy panels that come round from BEHIND the
// camera and whip past it in an arc (closest at the sides, a chromatic fringe and a tighter bend while they move), then settle edge to edge as a curved wall
// that fills the frame. The wall parts: the side panels swing away, the QVR panel lifts off the top, and the implied-volatility surface is standing behind it.
// Each panel is a cylinder section built straight in VIEW space (the vertex shader multiplies by the projection only), so it is locked to the screen with no
// lag behind the camera. Faces are painted from src/data (name, type, year, role and the project's own media; QVR has none, so a wireframe surface).
// The piece is locked to the view, so it does not depend on either neighbour's camera: it reads the same from the world shot as it did from the old pair camera.
// A pure function of leg progress u, so scrolling back replays the leg in reverse. The particle field dims while the wall owns the frame (setFieldAlpha via out.field).
//   u 0.04-0.54  the sweep: the train of panels eases from 135 degrees round to rest, 22 degrees apart (leader on the left); nearer than rest while it swings
//   u 0.54-0.60  the wall holds, edge to edge
//   u 0.60-0.84  the sides part (ease-in, outward); u 0.66-0.92 the centre panel lifts out through the top
// Cue: tr:panels at u 0.14, the first panel crosses the lens.
import * as THREE from 'three'
import projects from '../../../../data/projects.json'
import media from '../../../../data/media.json'
import { type Env, type FrameIn, type FrameOut, type Leg, type Piece, clamp01, easeIn, easeInOut, precompile, sstep } from './common'
import { overlayBlend } from './collage'
import { LANE_GLSL, LANE_ON } from '../lib/lane'

const DEG = Math.PI / 180
const SPACING = 22 * DEG, REST_D = 7.2, PANEL_W = 2.8, PANEL_H = 6.4
const SWEEP0 = 0.04, SWEEP1 = 0.54, PART0 = 0.6

// slot -2..2 along the arc, leader (left) first; the destination's own project stands in the middle
const SLOTS: { slot: number; id: string; accent: string; img?: string }[] = [
  { slot: -2, id: 'recruiting-os', accent: '#FF4A2B', img: 'jobs-mobile' },
  { slot: -1, id: 'cloudflare', accent: '#8FB8FF', img: 'page-1-title' },
  { slot: 0, id: 'qvr', accent: '#B48CFF' },
  { slot: 1, id: 'appfolio', accent: '#D9A441', img: 'page-1-title' },
  { slot: 2, id: 'chomchom', accent: '#FF6A8A', img: 'story-details' },
]

interface Proj { id: string; name: string; type: string; year: string; role: string }
interface MediaItem { slug: string; sm: string; width: number; height: number }
const proj = (id: string) => (projects as unknown as Proj[]).find(p => p.id === id)
const short = (n: string) => n.replace(/\s*\(.*?\)/g, '').replace(/:.*$/, '').replace(/\s+Pitch$/, '').trim()

// ------------------------------------------------------------------------------------------ the painted faces
function wrap(g: CanvasRenderingContext2D, text: string, w: number): string[] {
  const out: string[] = []; let line = ''
  for (const word of text.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > w && line) { out.push(line); line = word } else line = t }
  if (line) out.push(line)
  return out
}
function drawPoster(cv: HTMLCanvasElement, p: Proj, accent: string, img: HTMLImageElement | null) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d')!
  const ac = new THREE.Color(accent)
  const mixc = (k: number) => `rgb(${Math.round((ac.r * k + 0.03 * (1 - k)) * 255)},${Math.round((ac.g * k + 0.03 * (1 - k)) * 255)},${Math.round((ac.b * k + 0.04 * (1 - k)) * 255)})`
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, mixc(0.2)); bg.addColorStop(0.55, '#0b0b11'); bg.addColorStop(1, '#060609')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(237,230,214,0.05)'; g.lineWidth = 1
  for (let x = 64; x < W; x += 64) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke() }
  const glow = g.createRadialGradient(W * 0.5, H * 0.36, 10, W * 0.5, H * 0.36, W * 0.8); glow.addColorStop(0, mixc(0.34).replace('rgb', 'rgba').replace(')', ',0.5)')); glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  // header: type left, year right
  g.font = "500 21px 'IBM Plex Mono', ui-monospace, monospace"; g.textBaseline = 'alphabetic'
  g.fillStyle = accent; g.textAlign = 'left'; g.fillText(p.type.toUpperCase(), 40, 172)
  g.fillStyle = 'rgba(237,230,214,0.7)'; g.textAlign = 'right'; g.fillText(p.year, W - 40, 172)
  g.strokeStyle = accent; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(40, 190.5); g.lineTo(W - 40, 190.5); g.stroke(); g.globalAlpha = 1
  // the picture: the project's own media in a framed card, or a wireframe surface for QVR (role level only, no imagery)
  const ax = 40, ay = 222, aw = W - 80, ah = 520
  if (img && img.naturalWidth) {
    const r = img.naturalHeight / img.naturalWidth
    let w = aw, h = w * r; if (h > ah) { h = ah; w = h / r }
    const x = ax + (aw - w) / 2, y = ay + (ah - h) / 2
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 36; g.shadowOffsetY = 14; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.restore()
    g.drawImage(img, x, y, w, h)
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y, w, h)               // a bright slide must not blow the panel out
    g.strokeStyle = 'rgba(237,230,214,0.42)'; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, w + 2, h + 2)
  } else if (p.id === 'qvr') {
    g.strokeStyle = accent; g.lineWidth = 1.6; const cx = W / 2, cy = ay + ah * 0.55, n = 18
    const surf = (i: number, j: number) => {
      const x = (i / n - 0.5) * 2, y = (j / n - 0.5) * 2
      const z = 0.42 * (1 - 0.8 * Math.exp(-3.2 * (x * x + 0.6 * y * y))) + 0.28 * (x * x) - 0.18 * y * 0.6 + 0.09 * Math.sin(3.4 * y + 1.2) * (1 - Math.abs(x) * 0.5)
      return [cx + (x - y * 0.52) * (aw * 0.38), cy + (x * 0.12 + y * 0.36) * (aw * 0.42) - z * (aw * 0.4)] as const
    }
    for (let j = 0; j <= n; j++) { g.globalAlpha = 0.3 + 0.7 * (j / n); g.beginPath(); for (let i = 0; i <= n; i++) { const [px, py] = surf(i, j); if (i) g.lineTo(px, py); else g.moveTo(px, py) } g.stroke() }
    for (let i = 0; i <= n; i++) { g.globalAlpha = 0.25 + 0.55 * (i / n); g.beginPath(); for (let j = 0; j <= n; j++) { const [px, py] = surf(i, j); if (j) g.lineTo(px, py); else g.moveTo(px, py) } g.stroke() }
    g.globalAlpha = 1
  }
  // corner ticks (the idle plus markers of the reference's grid)
  g.strokeStyle = 'rgba(237,230,214,0.5)'; g.lineWidth = 1.5
  for (const [x, y] of [[26, 140], [W - 26, 140], [26, H - 140], [W - 26, H - 140]]) { g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke() }
  // the name, then the role
  g.fillStyle = '#EDE6D6'; g.textAlign = 'left'
  let size = 72; g.font = `600 ${size}px 'Bodoni Moda Variable', 'Bodoni Moda', Didot, serif`
  const name = short(p.name); let lines = wrap(g, name, W - 96)
  while (lines.length > 2 && size > 52) { size -= 6; g.font = `600 ${size}px 'Bodoni Moda Variable', 'Bodoni Moda', Didot, serif`; lines = wrap(g, name, W - 96) }
  const y0 = 834 + (lines.length > 1 ? 0 : 34)
  lines.forEach((l, i) => g.fillText(l, 40, y0 + i * size * 0.98))
  g.font = "400 22px 'IBM Plex Mono', ui-monospace, monospace"; g.fillStyle = 'rgba(237,230,214,0.78)'
  const rl = wrap(g, p.role, W - 80); rl.slice(0, 2).forEach((l, i) => g.fillText(l, 40, y0 + lines.length * size * 0.98 + 18 + i * 30))
}

// ------------------------------------------------------------------------------------------ shaders (view space)
const VERT = /* glsl */ `
uniform vec3 uC, uT, uO; uniform float uRb, uW, uH, uLift;
attribute vec2 aP;
varying vec3 vP; varying vec3 vN; varying vec2 vUv;
void main() {
  float x = aP.x * uW * 0.5, a = x / uRb;
  vec3 P = uC + uT * (uRb * sin(a)) + uO * (uRb * (1.0 - cos(a)));
  P.y += aP.y * uH * 0.5 + uLift;
  vP = P; vN = normalize(-uO * cos(a) + uT * sin(a)); vUv = aP * 0.5 + 0.5;
  gl_Position = projectionMatrix * vec4(P, 1.0);
}`
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex; uniform vec3 uAccent; uniform float uSpeed, uCopy, uGlint;
varying vec3 vP; varying vec3 vN; varying vec2 vUv;
${LANE_GLSL}
// a dark studio behind the camera (a panel that faces the lens reflects what stands behind it): tall softboxes at fixed azimuths, a wide overhead, a warm kicker;
// the reflection slides across a panel as it swings and fans across it where it curves
vec3 studio(vec3 R) {
  float az = atan(R.x, R.z), el = R.y;
  vec3 c = vec3(0.012, 0.013, 0.02) + vec3(0.04, 0.05, 0.08) * smoothstep(-0.2, 0.9, el);
  c += vec3(1.0, 0.97, 0.92) * 2.6 * smoothstep(0.12, 0.0, abs(az - 0.34)) * smoothstep(-0.7, 0.1, el);
  c += vec3(0.78, 0.88, 1.0) * 2.0 * smoothstep(0.2, 0.0, abs(az + 0.62));
  c += vec3(1.0, 0.8, 0.6) * 1.7 * smoothstep(0.12, 0.0, abs(az - 1.05));
  c += vec3(0.9, 0.95, 1.0) * 1.2 * smoothstep(0.09, 0.0, abs(abs(az) - 2.1));
  c += vec3(1.0, 0.98, 0.95) * 1.4 * smoothstep(0.35, 0.95, el);
  return c;
}
void main() {
  vec3 V = normalize(-vP), N = normalize(vN);
  bool back = dot(N, V) < 0.0; if (back) N = -N;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  // the picture, with a chromatic fringe along the sweep (zero at rest)
  float k = 0.010 * uSpeed;
  vec3 tex = vec3(texture2D(uTex, vUv + vec2(k, 0.0)).r, texture2D(uTex, vUv).g, texture2D(uTex, vUv - vec2(k, 0.0)).b);
  vec3 col = tex * (0.74 + 0.26 * max(dot(N, V), 0.0));
  vec3 R = reflect(-V, N);
  col += studio(R) * (0.10 + 1.0 * (0.04 + 0.96 * fr)) * (0.6 + 0.4 * uGlint);   // the glossy coat: faint head-on, strong at the grazing edges
  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  col += vec3(1.0, 0.96, 0.9) * (1.0 - smoothstep(0.0, 0.008, e)) * 0.55;               // lit glass edge
  col *= mix(1.0, 0.55, float(back));
  float a = 1.0 - uCopy * (1.0 - laneMask()) * 0.95;                                       // the copy lane stays clear while copy is on screen
  gl_FragColor = vec4(col * a, a);
}`

export function createPanels(leg: Leg): Piece {
  let ok = false
  const grp = new THREE.Group(); grp.name = 'tr-panels'; grp.userData.noReflect = true; grp.frustumCulled = false
  interface P { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; slot: number; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; p: Proj; accent: string; img: HTMLImageElement | null }
  const panels: P[] = []

  const repaint = (x: P) => { drawPoster(x.cv, x.p, x.accent, x.img); x.tex.needsUpdate = true }
  const piece: Piece = {
    leg,
    cues: [{ at: 0.14, name: 'tr:panels' }],
    build(env) {
      if (ok) return
      const gx = 28, pos = new Float32Array((gx + 1) * 2 * 3), aP = new Float32Array((gx + 1) * 2 * 2), idx: number[] = []
      for (let i = 0; i <= gx; i++) for (let j = 0; j < 2; j++) { const v = i * 2 + j; aP[v * 2] = (i / gx) * 2 - 1; aP[v * 2 + 1] = j * 2 - 1 }
      for (let i = 0; i < gx; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d) }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aP', new THREE.BufferAttribute(aP, 2)); geo.setIndex(idx)
      for (const s of SLOTS) {
        const p = proj(s.id); if (!p) continue
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1150
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
          uniforms: {
            uC: { value: new THREE.Vector3() }, uT: { value: new THREE.Vector3(1, 0, 0) }, uO: { value: new THREE.Vector3(0, 0, -1) }, uRb: { value: 5 }, uW: { value: PANEL_W }, uH: { value: PANEL_H }, uLift: { value: 0 },
            uTex: { value: tex }, uAccent: { value: new THREE.Color(s.accent) }, uSpeed: { value: 0 }, uCopy: { value: 0 }, uGlint: { value: 1 },
            uLane: { value: env.lane.u }, uRes: { value: env.res }, uLaneOn: LANE_ON,
          },
        })
        overlayBlend(mat, false)
        const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 100
        grp.add(mesh)
        const rec: P = { mesh, mat, slot: s.slot, cv, tex, p, accent: s.accent, img: null }
        panels.push(rec)
        repaint(rec)
        const it = s.img ? (media as unknown as Record<string, MediaItem[]>)[s.id]?.find(m => m.slug === s.img) : undefined
        if (it) { const im = new Image(); im.onload = () => { rec.img = im; repaint(rec) }; im.src = import.meta.env.BASE_URL + it.sm }
      }
      // the faces use the display fonts: repaint once they are in
      void Promise.all([document.fonts.load("600 80px 'Bodoni Moda Variable'"), document.fonts.load("500 20px 'IBM Plex Mono'")]).then(() => panels.forEach(repaint)).catch(() => {})
      grp.visible = false
      env.scene.add(grp)
      precompile(env, grp)
      ok = true
    },
    setVisible(v) { if (!v) grp.visible = false },
    frame(inp: FrameIn, out: FrameOut) {
      if (!ok) return
      const { u } = inp
      const a = clamp01((u - SWEEP0) / (SWEEP1 - SWEEP0))
      const delta = 135 * DEG * Math.pow(1 - a, 2.2)
      const speed = u > SWEEP0 && u < SWEEP1 + 0.02 ? Math.pow(1 - a, 1.2) : 0
      const ptS = easeIn(clamp01((u - PART0) / 0.24)), ptC = easeInOut(clamp01((u - 0.66) / 0.26))
      let any = false
      for (const p of panels) {
        const c = p.slot
        const phi = c * SPACING + delta + (c !== 0 ? Math.sign(c) * 62 * DEG * ptS : 0)
        const af = Math.abs(phi)
        const d = REST_D - 2.6 * sstep(8 * DEG, 36 * DEG, af) * (1 - sstep(70 * DEG, 110 * DEG, af))
        const vis = Math.cos(phi) > -0.12 && u > 0.02 && u < 0.94 && !(c === 0 && ptC >= 1)
        p.mesh.visible = vis; if (!vis) continue
        any = true
        const s = Math.sin(phi), co = Math.cos(phi), U = p.mat.uniforms
        U.uC.value.set(d * s, 0, -d * co); U.uO.value.set(s, 0, -co); U.uT.value.set(co, 0, s)
        U.uRb.value = 6.2 - 3.0 * speed
        U.uLift.value = c === 0 ? PANEL_H * 1.02 * ptC : 0
        U.uSpeed.value = speed; U.uCopy.value = inp.copy
        U.uGlint.value = 0.7 + 0.5 * Math.sin(phi * 1.3 + 1.0)
        p.mesh.renderOrder = 100 + Math.round((12 - d) * 100)
      }
      grp.visible = any
      // the field dims while the wall owns the frame and comes back as it parts
      out.field = 1 - 0.9 * sstep(0.3, 0.5, u) * (1 - sstep(0.66, 0.86, u))
      out.flash = 0
    },
    camera() { return null },
    dispose() { grp.removeFromParent(); for (const p of panels) { p.mat.dispose(); p.tex.dispose() } },
  }
  return piece
}
