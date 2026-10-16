// STAGE "alarm" (SELFORGE). Style: product-render PBR. A real modelled iPhone (bevelled titanium frame, glass, camera plateau with three lenses)
// lies on a lacquered walnut nightstand that is tipped toward the camera. It is lit by its own screen: a red pool of light spills over the
// wood and breathes with the siren, the phone buzzes, and the screen counts pushups (a ring of ten ticks lighting one by one, a numeral,
// Ember the flame flaring on every rep). At ten the siren stops; then it starts again.
//   entrance  the nightstand rises from below while the phone drops in back-up (camera plateau showing), tumbles over and lands screen-up
//             with a bounce; the screen wakes on the landing
//   exit      the phone shakes, lifts off and flips away; the nightstand tips forward and falls
// Everything is a closed-form function of (arrive, depart) plus the idle clock, so it reverses exactly with the scroll.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { bboxUV, canvasTex, clamp01, srAction, stageTip, tryMark, easeInCubic, easeInOutCubic, easeOutCubic, glowMat, lerp, lit, radialTexture, roundedRectShape, sstep, type StageBuildCtx, type StageDef, type StageFrame } from './common'

// phone, in table units (a 6.1" phone is 71.5 x 147.6 x 7.8 mm: ratio 1 : 2.06 : 0.11)
const W = 1.9, H = 3.9, T = 0.23, R = 0.38
const SW = W - 0.1, SH = H - 0.1, SR = R - 0.05
const TABLE = { w: 4.2, d: 4.9, t: 0.26 }
const REP_SECS = 0.9, REPS = 10, DONE_SECS = 2.6, CYCLE = REPS * REP_SECS + DONE_SECS
const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'

const woodTexture = () => canvasTex(512, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b160a'); gr.addColorStop(0.5, '#1f0f06'); gr.addColorStop(1, '#2a1509')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  let s = 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < 190; i++) {
    const y0 = r() * h, amp = 2 + r() * 9, f = 0.004 + r() * 0.01, ph = r() * 6.28
    g.strokeStyle = `rgba(${r() < 0.5 ? '6,2,1' : '120,70,34'},${(0.08 + r() * 0.2).toFixed(3)})`; g.lineWidth = 0.6 + r() * 1.8
    g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.25; x ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke()
  }
}, { aniso: 8 })

/** the screen's static layer: dark-red wash, dynamic island, labels */
function drawScreenBase(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#190606'); gr.addColorStop(0.55, '#0b0303'); gr.addColorStop(1, '#030101')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  const rg = g.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, w * 0.8); rg.addColorStop(0, 'rgba(255,74,43,0.2)'); rg.addColorStop(1, 'rgba(255,74,43,0)')
  g.fillStyle = rg; g.fillRect(0, 0, w, h)
  // dynamic island
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(w / 2 - 62, 26, 124, 36, 18); g.fill()
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = '#FF6A3D'; g.font = `700 24px ${MONO}`; g.letterSpacing = '6px'; g.fillText('ALARM', w / 2, 118)
  g.letterSpacing = '0px'
  // pushups pill + camera hint
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.roundRect(w / 2 - 150, h - 218, 300, 64, 32); g.fill()
  g.fillStyle = '#F4EBDD'; g.font = `700 28px ${FONT}`; g.fillText('Pushups', w / 2 + 14, h - 186)
  g.fillStyle = '#FF4A2B'; g.beginPath(); g.arc(w / 2 - 92, h - 186, 9, 0, 6.2832); g.fill()
  g.fillStyle = 'rgba(244,235,221,0.5)'; g.font = `500 21px ${MONO}`; g.fillText('camera is counting', w / 2, h - 118)
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.roundRect(w / 2 - 70, h - 40, 140, 6, 3); g.fill()
}

export default {
  id: 'alarm',
  build(c: StageBuildCtx) {
    const { env, phone, view } = c
    const root = new THREE.Group()
    // the table faces the camera: yaw to the camera's azimuth, tipped so its normal is ~38 deg off the line of sight
    const az = Math.atan2(view.dir.x, view.dir.z)
    const elev = Math.asin(THREE.MathUtils.clamp(view.dir.y, -1, 1))
    const TILT = THREE.MathUtils.clamp(Math.PI / 2 - (elev + THREE.MathUtils.degToRad(40)), 0.55, 1.2)
    const yawG = new THREE.Group(); yawG.rotation.y = az * 0.7 + 0.1; root.add(yawG)
    const rig = new THREE.Group(); yawG.add(rig)                 // slides / tips as a whole
    const tab = new THREE.Group(); rig.add(tab)                  // table space: x right, y = surface normal, z toward the front edge

    // ---------------------------------------------------------------- the nightstand
    const wood = woodTexture(); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(1.4, 1.4)
    const woodMat = lit(new THREE.MeshPhysicalMaterial({ map: wood.tex, color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.55 }), 'wood')
    const top = new THREE.Mesh(new RoundedBoxGeometry(TABLE.w, TABLE.t, TABLE.d, phone ? 2 : 4, 0.09), woodMat)
    top.position.y = -TABLE.t / 2
    tab.add(top)
    const body = new THREE.Mesh(new RoundedBoxGeometry(TABLE.w - 0.34, 1.0, TABLE.d - 0.34, 2, 0.06), lit(new THREE.MeshStandardMaterial({ color: 0x120a05, roughness: 0.55, envMap: env, envMapIntensity: 0.45 }), 'wood-body'))
    body.position.y = -TABLE.t - 0.5 + 0.02; tab.add(body)
    // drawer face and knob on the front
    const drawer = new THREE.Mesh(new RoundedBoxGeometry(TABLE.w - 0.7, 0.72, 0.1, 2, 0.04), woodMat)
    drawer.position.set(0, -TABLE.t - 0.42, TABLE.d / 2 - 0.12); tab.add(drawer)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), lit(new THREE.MeshStandardMaterial({ color: 0xb9955a, metalness: 1, roughness: 0.22, envMap: env, envMapIntensity: 1.5 }), 'brass'))
    knob.scale.set(1, 1, 0.7); knob.position.set(0, -TABLE.t - 0.42, TABLE.d / 2 - 0.04); tab.add(knob)


    // ---------------------------------------------------------------- props that say "nightstand": two books and a mug
    const book = (w: number, h: number, d: number, col: number, x: number, z: number, yaw: number, y0 = 0) => {
      const g = new THREE.Group(); g.position.set(x, y0 + h / 2, z); g.rotation.y = yaw
      const cover = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.025), lit(new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, envMap: env, envMapIntensity: 0.7 }), 'book'))
      const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.1, d - 0.02), lit(new THREE.MeshStandardMaterial({ color: 0xcfc3a6, roughness: 0.9, envMap: env, envMapIntensity: 0.3 }), 'pages'))
      pages.position.x = 0.03; g.add(pages, cover); tab.add(g); return g
    }
    book(1.0, 0.13, 0.74, 0x2c3a2a, -1.45, -1.55, 0.35); book(0.86, 0.1, 0.62, 0x5a1d1d, -1.4, -1.5, -0.18, 0.13)
    const mugPts: THREE.Vector2[] = [[0, 0], [0.26, 0], [0.3, 0.04], [0.31, 0.38], [0.29, 0.4], [0.26, 0.38], [0.255, 0.06], [0, 0.06]].map(([x, y]) => new THREE.Vector2(x, y))
    const mug = new THREE.Mesh(new THREE.LatheGeometry(mugPts, phone ? 20 : 36), lit(new THREE.MeshStandardMaterial({ color: 0xe8e1d4, roughness: 0.28, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide }), 'mug'))
    mug.position.set(1.5, 0, -1.6); tab.add(mug)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.034, 8, 20, Math.PI), mug.material); handle.rotation.z = -Math.PI / 2; handle.position.set(0.33, 0.2, 0); mug.add(handle)
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.255, 24), lit(new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.2, envMap: env, envMapIntensity: 1.2 }), 'coffee')); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.33; mug.add(coffee)

    // ---------------------------------------------------------------- the glow the phone throws on the wood (additive, so it blooms)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 7.2), glowMat(radialTexture(), 0xff3a1c, 0)); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004; tab.add(pool)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.9), glowMat(radialTexture(), 0xff6a3d, 0)); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.006; tab.add(halo)
    // a soft contact shadow under the phone
    const sh = canvasTex(128, 256, (g, w, h) => { g.filter = 'blur(10px)'; g.fillStyle = '#000'; g.beginPath(); g.roundRect(26, 26, w - 52, h - 52, 24); g.fill() }, { mips: false })
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, H + 0.6), new THREE.MeshBasicMaterial({ map: sh.tex, transparent: true, opacity: 0.8, depthWrite: false }))
    lit(shadow.material as THREE.MeshBasicMaterial, 'shadow'); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = 1; tab.add(shadow)

    // ---------------------------------------------------------------- the phone
    const ph = new THREE.Group(); ph.rotation.order = 'YXZ'; tab.add(ph)
    const frameMat = lit(new THREE.MeshStandardMaterial({ color: 0x34363b, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.5 }), 'ti')
    const bev = 0.035, ex = new THREE.ExtrudeGeometry(roundedRectShape(W - 2 * bev, H - 2 * bev, R - bev), { depth: T - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: phone ? 3 : 5, curveSegments: phone ? 12 : 22 })
    // ExtrudeGeometry runs from z = -bev to depth + bev; after rotateX(-90) that is y in [-bev, depth+bev]: centre it on 0
    ex.rotateX(-Math.PI / 2); ex.computeBoundingBox(); ex.translate(0, -(ex.boundingBox!.min.y + ex.boundingBox!.max.y) / 2, 0)
    const bodyM = new THREE.Mesh(ex, frameMat); ph.add(bodyM)
    // black glass front under the screen, frosted glass back
    const blackGlass = lit(new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0, roughness: 0.08, envMap: env, envMapIntensity: 1.6 }), 'glass-black')
    const front = new THREE.Mesh(bboxUV(new THREE.ShapeGeometry(roundedRectShape(W - 0.05, H - 0.05, R - 0.03), 20)), blackGlass)
    front.rotation.x = -Math.PI / 2; front.position.y = T / 2 + 0.0015; ph.add(front)
    const back = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(W - 0.05, H - 0.05, R - 0.03), 20), lit(new THREE.MeshStandardMaterial({ color: 0x2c2d32, metalness: 0.25, roughness: 0.42, envMap: env, envMapIntensity: 1.3 }), 'glass-back'))
    back.rotation.x = Math.PI / 2; back.position.y = -T / 2 - 0.0015; ph.add(back)
    // camera plateau (seen from behind: top-left = front top-right), three lenses, flash, mic
    const plat = new THREE.Group(); plat.position.set(0.37, -T / 2 - 0.0015, -H / 2 + 0.62); ph.add(plat)
    const platMesh = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.045, 0.86, 2, 0.02), lit(new THREE.MeshStandardMaterial({ color: 0x1d1e22, metalness: 0.5, roughness: 0.2, envMap: env, envMapIntensity: 1.6 }), 'plateau'))
    platMesh.position.y = -0.0225; plat.add(platMesh)
    const ringMat = lit(new THREE.MeshStandardMaterial({ color: 0x9a9ca3, metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.8 }), 'lens-ring')
    const lensMat = lit(new THREE.MeshStandardMaterial({ color: 0x07080d, metalness: 0, roughness: 0.04, envMap: env, envMapIntensity: 2.4 }), 'lens')
    for (const [lx, lz] of [[-0.18, -0.2], [0.18, -0.2], [0, 0.2]] as const) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 28), ringMat); ring.position.set(lx, -0.07, lz); plat.add(ring)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), lensMat); lens.position.set(lx, -0.099, lz); plat.add(lens)
    }
    const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16), lit(new THREE.MeshStandardMaterial({ color: 0xe9dfc8, metalness: 0.2, roughness: 0.3, envMap: env }), 'flash')); flash.position.set(-0.3, -0.05, 0.26); plat.add(flash)

    // ---------------------------------------------------------------- the screen: base layer, numeral, ten rep ticks, Ember, glass glare
    const scr = new THREE.Group(); scr.position.y = T / 2 + 0.004; scr.rotation.x = -Math.PI / 2; ph.add(scr)     // screen space: x right, y up the phone, z out of the glass
    const PXW = 512, PXH = Math.round(512 * SH / SW)
    const base = canvasTex(PXW, PXH, drawScreenBase, { aniso: 8 })
    const screenGeo = bboxUV(new THREE.ShapeGeometry(roundedRectShape(SW, SH, SR), 20))
    const screenMat = lit(new THREE.MeshBasicMaterial({ map: base.tex, toneMapped: false, color: 0x000000 }), 'screen')
    const screen = new THREE.Mesh(screenGeo, screenMat); scr.add(screen)
    document.fonts?.ready.then(() => { drawScreenBase(base.g, PXW, PXH); base.tex.needsUpdate = true; drawCount(Math.max(0, reps), done, snoozeT > 0) }).catch(() => {})
    // numeral
    const CN = 512
    const cnt = canvasTex(CN, CN, () => {}, { mips: false })
    const drawCount = (n: number, done: boolean, snz = false) => {
      const g = cnt.g; g.clearRect(0, 0, CN, CN); g.textAlign = 'center'; g.textBaseline = 'middle'
      if (done) {
        g.strokeStyle = '#FFD9A0'; g.lineWidth = 34; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(150, 270); g.lineTo(226, 346); g.lineTo(366, 186); g.stroke()
        g.fillStyle = 'rgba(244,235,221,0.78)'; g.font = `600 34px ${MONO}`; g.letterSpacing = '6px'; g.fillText('SIREN OFF', CN / 2, 440); g.letterSpacing = '0px'
      } else {
        g.fillStyle = '#FFF4E8'; g.font = `800 ${n >= 10 ? 270 : 330}px ${FONT}`; g.fillText(String(n), CN / 2, CN / 2 + 8)
        g.fillStyle = 'rgba(255,106,61,0.9)'; g.font = `600 34px ${MONO}`; g.letterSpacing = '8px'; g.fillText(snz ? 'SNOOZED' : 'REPS', CN / 2, 452); g.letterSpacing = '0px'
      }
      cnt.tex.needsUpdate = true
    }
    drawCount(0, false)
    const CY = 0.46
    const numeral = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: cnt.tex, transparent: true, toneMapped: false, depthWrite: false })); lit(numeral.material as THREE.MeshBasicMaterial, 'num')
    numeral.position.set(0, CY, 0.002); scr.add(numeral)
    const ticks: THREE.Mesh[] = [], tickMats: THREE.MeshBasicMaterial[] = []
    for (let i = 0; i < REPS; i++) {
      const a = (i / REPS) * Math.PI * 2, m = lit(new THREE.MeshBasicMaterial({ color: 0x3a1410, toneMapped: false }), 'tick')
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.17, 0.012, 1, 0.012), m)
      mesh.position.set(Math.sin(a) * 0.66, CY + Math.cos(a) * 0.66, 0.0035); mesh.rotation.z = -a; scr.add(mesh); ticks.push(mesh); tickMats.push(m)
    }
    // Ember: a flame drawn entirely in code
    const emberMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uT: { value: 0 }, uK: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uT, uK;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float h = clamp((p.y + 0.88) / 1.62, 0.0, 1.0);
        float sway = (0.06 + 0.05 * uK) * sin(uT * 7.0 + h * 5.5) * h;
        float w = 0.56 * pow(1.0 - h, 1.15) * (0.3 + 0.7 * smoothstep(0.0, 0.3, h)) * (1.0 + 0.1 * sin(uT * 11.0 + h * 9.0));
        float d = abs(p.x - sway) - w;
        float body = smoothstep(0.06, -0.04, d) * step(0.0, h) * smoothstep(1.0, 0.82, h);
        float core = smoothstep(0.0, -0.2, d + 0.1) * smoothstep(0.75, 0.08, h);
        vec3 col = mix(vec3(1.0, 0.24, 0.08), vec3(1.0, 0.7, 0.26), core);
        col = mix(col, vec3(1.0, 0.95, 0.75), core * core * 0.75);
        gl_FragColor = vec4(col * (0.92 + 0.3 * uK), body);
      }`,
    })
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.88), emberMat); ember.position.set(0, -0.62, 0.003); ember.renderOrder = 3; scr.add(ember)
    // glass glare: two soft diagonal bands, additive, drifting a hair with the phone's tilt
    const glare = canvasTex(256, 512, (g, w, h) => {
      g.translate(w / 2, h / 2); g.rotate(-0.46)
      for (const [x, wd, a] of [[-0.18, 0.1, 0.5], [0.12, 0.036, 0.8]] as const) {
        const gr = g.createLinearGradient((x - wd) * w, 0, (x + wd) * w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = gr; g.fillRect((x - wd) * w, -h, wd * 2 * w, h * 2)
      }
    }, { mips: false })
    const glareMat = glowMat(glare.tex, 0xffffff, 0.2)
    const glareMesh = new THREE.Mesh(screenGeo, glareMat); glareMesh.position.z = 0.0045; scr.add(glareMesh)

    // ---------------------------------------------------------------- state
    let reps = -1, done = false, kick = 0, landed = false, lastRep = -1, lastSnz = false
    let skew = 0, snoozeT = 0, dip = 0, hov = 0, rmReps = 6, hovering = false
    const emberKick = () => { kick = 1 }
    const tmpC = new THREE.Color()

    let lastTin = 0, emitFn: (n: string) => void = () => {}, reducedNow = false
    const reduced = () => reducedNow
    let uiTick: (f: StageFrame) => void = () => {}
    const update = (f: StageFrame) => {
      uiTick(f)
      lastTin = f.tIn; emitFn = n => f.emit(n); reducedNow = f.reduced
      const rm = f.reduced
      const a = f.arrive, d = f.depart
      const sa = rm ? 1 : sstep(0.2, 0.98, a)
      const sd = rm ? 0 : sstep(0.0, 0.92, d)
      const sd2 = rm ? 0 : sstep(0.3, 1, d)
      // ---- the nightstand: rises from below on the way in, tips forward and drops on the way out
      const rise = 1 - easeOutCubic(sstep(0, 0.72, sa))
      rig.position.set(0, -6.4 * rise - 9 * easeInCubic(sd2), 1.2 * rise)
      rig.rotation.x = 0.55 * rise + 0.9 * easeInCubic(sd2)
      tab.rotation.x = TILT
      // ---- the phone: drops in back-up, tumbles, lands screen-up with a bounce; on the way out it shakes, lifts and flips away
      const u = clamp01(sa / 0.74), tb = clamp01((sa - 0.74) / 0.26)
      let y = T / 2 + 0.003, flip = 0, yaw = -0.16, pitch = 0, px = 0.04, pz = 0.12
      if (sa < 1) {
        y += u < 1 ? 3.6 * (1 - u * u) : 0.3 * Math.exp(-3.6 * tb) * Math.abs(Math.sin(Math.PI * 2.1 * tb))
        flip = u < 1 ? Math.PI * (1 - Math.pow(u, 1.5)) : 0
        yaw += u < 1 ? 1.1 * (1 - easeOutCubic(u)) : 0
        pitch = u < 1 ? 0.2 * Math.sin(Math.PI * u) : 0.07 * Math.exp(-4 * tb) * Math.sin(Math.PI * 6 * tb)
        if (u >= 1 && !landed) { landed = true; f.emit('land') } else if (u < 0.9) landed = false
      }
      if (sd > 0) {
        const v = sstep(0.12, 0.95, sd)
        y += 2.6 * easeInCubic(v); flip = -Math.PI * easeInOutCubic(v); yaw += 1.1 * v; pitch += 0.3 * Math.sin(Math.PI * v)
        px += 0.3 * v; pz += -2.6 * v
        const sh2 = Math.sin(sd * 90) * 0.02 * (1 - v); px += sh2
      }
      // ---- the alarm clock: reps tick up, the phone buzzes in bursts while it rings, the siren stops at ten
      const wake = rm ? 1 : sstep(0.82, 0.98, sa) * (1 - sstep(0.05, 0.4, sd))
      let nReps = 6, isDone = false, ringing = 1
      if (rm) { nReps = Math.min(REPS, rmReps); isDone = rmReps >= REPS }
      if (!rm) {
        const tau = (f.tIn + skew) % CYCLE
        nReps = Math.min(REPS, Math.floor(tau / REP_SECS)); isDone = tau >= REPS * REP_SECS
        if (f.tIn <= 0) { nReps = 0; isDone = false }
        ringing = isDone || snoozeT > 0 ? 0 : 1
      }
      snoozeT = Math.max(0, snoozeT - f.dt); dip = Math.max(0, dip - f.dt * 4.5); hov += ((hovering ? 1 : 0) - hov) * Math.min(1, f.dt * 12)
      const snz = snoozeT > 0
      if (nReps !== reps || isDone !== done || snz !== lastSnz) {
        lastSnz = snz
        if (nReps > reps && nReps > 0 && !isDone) { emberKick(); if (f.tIn > 0.3) f.emit('count:tick') }
        reps = nReps; done = isDone; drawCount(reps, done, snz)
      }
      lastRep = reps
      const gate = ringing * wake * (rm ? 0 : sstep(0.35, 0.55, ((f.tIn + skew) % REP_SECS) / REP_SECS) * (1 - sstep(0.85, 1.0, ((f.tIn + skew) % REP_SECS) / REP_SECS)))
      px += Math.sin(f.t * 240) * 0.011 * gate; pz += Math.sin(f.t * 199) * 0.008 * gate; yaw += Math.sin(f.t * 171) * 0.006 * gate
      ph.position.set(px, y - 0.05 * dip * sa, pz); ph.rotation.set(pitch + 0.025 * dip, yaw, flip)
      // ---- screen + light
      screenMat.color.setScalar(wake * (1 + 0.14 * hov + 0.25 * dip) * (snz ? 0.62 : 1))
      for (let i = 0; i < REPS; i++) tickMats[i].color.set(i < reps || done ? (done ? 0xffd9a0 : 0xff6a3d) : 0x3a1410).multiplyScalar(wake)
      numeral.visible = wake > 0.01; ember.visible = wake > 0.01 && !done; for (const t of ticks) t.visible = wake > 0.01
      kick = Math.max(0, kick - f.dt * 3.2)
      emberMat.uniforms.uT.value = f.t; emberMat.uniforms.uK.value = kick
      ember.scale.setScalar(1 + 0.22 * kick)
      numeral.scale.setScalar(1 + 0.05 * kick)
      const pulse = rm ? 0.8 : 0.5 + 0.5 * Math.sin(f.t * 8.2)
      const glow = wake * (done ? 0.5 : snz ? 0.28 : 0.6 + 0.4 * pulse)
      tmpC.set(done ? 0xffb35a : 0xff3a1c); (pool.material as THREE.MeshBasicMaterial).color.copy(tmpC); (pool.material as THREE.MeshBasicMaterial).opacity = 0.55 * glow
      tmpC.set(done ? 0xffc27a : 0xff6a3d); (halo.material as THREE.MeshBasicMaterial).color.copy(tmpC); (halo.material as THREE.MeshBasicMaterial).opacity = 0.34 * glow
      glareMat.opacity = (0.2 + 0.2 * hov) * wake
      glareMesh.position.x = Math.sin(f.t * 0.4) * 0.02
      ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - clamp01(y - T / 2) * 0.8)
      shadow.scale.setScalar(1 + 0.5 * clamp01((y - T / 2) / 3))
      pool.visible = halo.visible = glow > 0.01
    }
    void lerp; void lastRep
    // ---- interaction: tap the screen to snooze. The siren stops for a couple of seconds ("SNOOZED"), the glass dips under the finger, and the counter
    // ticks up one rep (the rep boundary arrives early). Reduced motion: the same tap steps the count, nothing moves.
    const tip = stageTip(), rc = new THREE.Raycaster()
    const onScreen = (ray: THREE.Raycaster) => { screen.updateWorldMatrix(true, false); return ray.intersectObject(screen, false).length > 0 && screenMat.color.r > 0.4 }
    let tipX = 0, tipY = 0
    const tipNow = () => { if (hovering) tip.show(tipX, tipY, snoozeT > 0 ? 'Snoozed' : 'Tap to snooze', 'one more rep ticks', '#FF6A3D') }
    const snooze = () => {
      dip = 1; kick = 1; snoozeT = 2.4
      if (reduced()) rmReps = rmReps >= REPS ? 0 : rmReps + 1
      else skew += REP_SECS - (((lastTin + skew) % REP_SECS) + REP_SECS) % REP_SECS + 0.001
      emitFn('obj:snooze'); emitFn('count:tick')
    }
    const pointer = {
      hover(ray: THREE.Raycaster, x: number, y: number) {
        hovering = onScreen(ray); tipX = x; tipY = y
        if (hovering) tipNow(); else tip.hide()
        return hovering ? 'pointer' as const : null
      },
      down(ray: THREE.Raycaster) {
        if (!onScreen(ray)) return null
        mark.dismiss(); snooze()
        return 'tap' as const
      },
      leave() { hovering = false; tip.hide() },
      // keyboard: Enter (with the page or the canvas focused, not a button or link: those activate themselves) does what a tap does
      key(e: KeyboardEvent) {
        if (e.key !== 'Enter' || e.repeat || (e.target as HTMLElement | null)?.closest?.('button, a[href], input, textarea, select, summary, [role="button"]')) return false
        mark.dismiss(); snooze(); return true
      },
    }
    // the try-me ring on the screen, and the keyboard / screen-reader twin of the tap
    const mark = tryMark('alarm', 'Tap to snooze', screen, c.camera, '#FF6A3D')
    const snoozeBtn = srAction('Snooze the alarm', () => snooze())
    uiTick = (f: StageFrame) => {
      const held = f.arrive > 0.97 && f.depart < 0.02
      mark.update(held && f.tIn > 0.6, f.dt, f.reduced)
      snoozeBtn.setActive(held && screenMat.color.r > 0.4)
      tipNow()
    }
    void rc
    return { root, update, dust: 0.07, size: [4.6, 4.7] as [number, number], pointer, hint: ['Tap to snooze', 'one more rep ticks'] as [string, string], debug: () => ({ reps, done, snoozeT: +snoozeT.toFixed(2), skew: +skew.toFixed(2) }) }
  },
} satisfies StageDef
