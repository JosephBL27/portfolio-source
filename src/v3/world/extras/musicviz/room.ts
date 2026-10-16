// The listening room's furniture and its show (unit 15M), built into the records space (spaces/records.ts):
//   hi-fi: a slatted walnut credenza under a lancet window, a valve amplifier on it with two backlit VU meters (true left / right, analog ballistics) and four glowing tubes,
//          a floor-standing speaker at each end whose woofer pumps on the bass; Blender models (public/models/glb/room-hifi.glb, room-window.glb), lazy, with a box fallback
//   window: a pointed-arch lancet in stone with tracery, a sill, wine velvet curtains that sway with the bass, brass rod; the pane is dusk (stars, a moon, rain on some
//           songs) that takes the song's colours; a pale shaft of window light falls across the floor with dust turning in it
//   show:  four light beams that sweep the record wall and snap to a new aim on hits (each leaves a soft pool on the shelves), the frequency landscape on the floor, and a
//          wall-wide equaliser: the spines themselves light up, one column per frequency (wallGlow patches the spine material)
// Everything reads the music bus; idle it is quiet static light. ?noglb=1 keeps the box fallbacks.
import * as THREE from 'three'
import { loadGLB, meshesByName, withAO } from '../../glbmodel'
import { bake, D, glowTexture } from '../cabinet/kit'
import { fogify, glowPlane, lightCone, motes, type Cone, type Motes, type SpaceKit } from '../spaces/common'
import { SPEC_N, type Music } from './bus'
import { createLandscape, type Landscape } from './landscape'

const DEG = Math.PI / 180
export const WALL_R = 6.8
export const WIN_A = 16.5 * DEG            // the window's angle round the wall (0 = straight behind the deck, + toward the right of the frame)

// ------------------------------------------------------------------------------------------------ the wall equaliser: the spines light up (a patch for the spine material)
export function wallGlow() {
  const data = new Uint8Array(SPEC_N), tex = new THREE.DataTexture(data, SPEC_N, 1, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true
  const U = { uWSpec: { value: tex }, uWK: { value: 0 }, uWA: { value: new THREE.Color() }, uWB: { value: new THREE.Color() } }
  return {
    patch<M extends THREE.Material>(mat: M): M {
      const base = mat.onBeforeCompile
      mat.onBeforeCompile = (sh, r) => {
        base.call(mat, sh, r); Object.assign(sh.uniforms, U)
        sh.vertexShader = 'uniform sampler2D uWSpec; uniform float uWK; varying float vWG; varying float vWR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 ip = instanceMatrix[3].xyz; float ang = atan(ip.x, -ip.z); float uu = clamp(abs(ang) / 1.15, 0.0, 1.0);
          float lv = texture2D(uWSpec, vec2(uu * 0.98 + 0.01, 0.5)).r; float row = clamp((ip.y - 0.3) / 6.2, 0.0, 1.0);
          float lane = 1.0 - 0.7 * smoothstep(0.38, 0.8, ang);                       // the right of the frame is the copy lane: the show steps back there
          vWG = uWK * lane * smoothstep(row - 0.06, row + 0.03, lv * 1.15); vWR = row;`)
        sh.fragmentShader = 'uniform vec3 uWA, uWB; varying float vWG; varying float vWR;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += mix(uWA, uWB, vWR) * vWG * 0.95;`)
      }
      mat.customProgramCacheKey = () => 'sp-fog-wall'
      return mat
    },
    update(M: Music, rm: boolean) {
      const on = M.k > 0.004
      if (on || U.uWK.value > 0.001) { for (let i = 0; i < SPEC_N; i++) data[i] = Math.min(255, Math.round(M.spec[i] * 255)); tex.needsUpdate = true }
      U.uWK.value = M.k * (rm ? 0.5 : 1); U.uWA.value.copy(M.pal[0]); U.uWB.value.copy(M.pal[2])
    },
    dispose() { tex.dispose() },
  }
}

// ------------------------------------------------------------------------------------------------ the VU face
function vuFace(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(128, 215, 20, 128, 160, 190); gr.addColorStop(0, '#fff4cf'); gr.addColorStop(0.7, '#f0d68c'); gr.addColorStop(1, '#c79a45')
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  const cx = 128, cy = 215, R = 150
  g.strokeStyle = '#2a1a0c'; g.lineCap = 'butt'
  g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2 - 0.82, -Math.PI / 2 + 0.82); g.stroke()
  g.strokeStyle = '#b3201c'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R - 6, -Math.PI / 2 + 0.38, -Math.PI / 2 + 0.82); g.stroke()
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 - 0.82 + (1.64 * i) / 20, major = i % 4 === 0, r0 = R - (major ? 22 : 12)
    g.strokeStyle = i >= 13 ? '#a31a16' : '#2a1a0c'; g.lineWidth = major ? 3 : 1.5
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke()
  }
  g.fillStyle = 'rgba(70,40,10,0.18)'; g.beginPath(); g.ellipse(cx, 252, 120, 36, 0, 0, Math.PI * 2); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t
}

// ------------------------------------------------------------------------------------------------ the room
export interface Room {
  update(t: number, dt: number, r: number, M: Music, rm: boolean): void
  info(): Record<string, unknown>
  dispose(): void
}
export async function createRoom(k: SpaceKit, root: THREE.Group, wall: ReturnType<typeof wallGlow>): Promise<Room> {
  const g = new THREE.Group(); g.name = 'room-rig'; root.add(g)
  const disposables: { dispose(): void }[] = []
  // ---- textures: walnut baked on the GPU, wool cloth for the baffles, velvet pile for the curtains
  const wood = bake(k.renderer, 512, 512, `void main() { vec2 q = vec2(vUv.x * 2.4, vUv.y * 2.4); vec3 c = wood(q, vec3(0.2, 0.1, 0.055), vec3(0.42, 0.22, 0.1), 6.0, 5.0); gl_FragColor = vec4(c * 1.1, 1.0); }`)
  const cloth = bake(k.renderer, 256, 256, `void main() { vec2 p = vUv * 90.0; float w = 0.5 + 0.25 * sin(p.x * 6.2831) + 0.25 * sin(p.y * 6.2831); float n = fbm(vUv * 30.0); gl_FragColor = vec4(vec3(0.07, 0.06, 0.07) * (0.55 + 0.7 * w) * (0.8 + 0.4 * n), 1.0); }`)
  disposables.push(wood, cloth)
  const std = <T extends THREE.MeshStandardMaterial>(m: T) => { m.envMap = k.env; return withAO(fogify(m, k.fog)) }
  const mats: Record<string, THREE.Material> = {
    walnut: std(new THREE.MeshStandardMaterial({ map: wood.texture, emissiveMap: wood.texture, emissive: D(0.3, 0.24, 0.18), roughness: 0.46, envMapIntensity: 0.55 })),
    walnutLite: std(new THREE.MeshStandardMaterial({ map: wood.texture, emissiveMap: wood.texture, emissive: D(0.34, 0.27, 0.2), color: D(1.25, 1.1, 1.0), roughness: 0.4, envMapIntensity: 0.6 })),
    cloth: std(new THREE.MeshStandardMaterial({ map: cloth.texture, emissiveMap: cloth.texture, emissive: D(0.5, 0.45, 0.45), roughness: 0.95, envMapIntensity: 0.15 })),
    brass: std(new THREE.MeshStandardMaterial({ color: D(0.78, 0.56, 0.26), metalness: 1, roughness: 0.3, envMapIntensity: 1.5 })),
    rubber: std(new THREE.MeshStandardMaterial({ color: D(0.025, 0.025, 0.03), roughness: 0.7, envMapIntensity: 0.4 })),
    steel: std(new THREE.MeshStandardMaterial({ color: D(0.62, 0.58, 0.5), metalness: 1, roughness: 0.34, envMapIntensity: 1.6 })),
    chassis: std(new THREE.MeshStandardMaterial({ color: D(0.07, 0.07, 0.075), emissive: D(0.03, 0.03, 0.032), metalness: 0.6, roughness: 0.45, envMapIntensity: 0.9 })),
    cone: std(new THREE.MeshStandardMaterial({ color: D(0.08, 0.075, 0.08), roughness: 0.55, envMapIntensity: 0.6, emissive: D(0, 0, 0) })),
    dome: std(new THREE.MeshStandardMaterial({ color: D(0.8, 0.7, 0.45), metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 })),
    glass: new THREE.MeshStandardMaterial({ color: D(0.55, 0.5, 0.45), transparent: true, opacity: 0.32, roughness: 0.1, envMap: k.env, envMapIntensity: 1.4, emissive: D(0.8, 0.35, 0.08), emissiveIntensity: 0.4, depthWrite: false }),
    stone: std(new THREE.MeshStandardMaterial({ color: D(0.3, 0.255, 0.215), emissive: D(0.1, 0.085, 0.07), roughness: 0.85, envMapIntensity: 0.35 })),
    velvet: std(new THREE.MeshPhysicalMaterial({ color: D(0.3, 0.05, 0.085), roughness: 0.9, sheen: 1, sheenColor: D(0.8, 0.25, 0.3), sheenRoughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.3, emissive: D(0.1, 0.012, 0.025) })),
  }
  fogify(mats.glass as THREE.MeshStandardMaterial, k.fog)
  const MAT: Record<string, string> = {
    speaker_body: 'walnut', speaker_baffle: 'cloth', speaker_trim: 'brass', speaker_dark: 'rubber', woofer: 'cone', tweeter: 'dome',
    credenza_body: 'walnut', credenza_slats: 'walnutLite', credenza_trim: 'brass',
    amp_body: 'chassis', amp_face: 'steel', amp_wood: 'walnut', amp_trim: 'brass', amp_tube: 'glass',
    win_frame: 'stone', win_tracery: 'stone', win_sill: 'stone', win_brass: 'brass', curtain_l: 'velvet', curtain_r: 'velvet',
  }
  const [hifi, win] = await Promise.all([loadGLB('room-hifi'), loadGLB('room-window')])
  const P = hifi ? meshesByName(hifi) : null, W = win ? meshesByName(win) : null
  const part = (m: Map<string, THREE.Mesh> | null, n: string): THREE.Mesh | null => { const o = m?.get(n); if (!o) return null; const c = o.clone(); c.material = mats[MAT[n]]; c.frustumCulled = false; return c }
  const box = (w: number, h: number, d: number, mat: THREE.Material, y = h / 2) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y; return m }
  const place = (o: THREE.Object3D, deg: number, radius: number, y = 0, yaw = 0) => { const a = deg * DEG; o.position.set(Math.sin(a) * radius, y, -Math.cos(a) * radius); o.rotation.y = -a + yaw; g.add(o) }

  // ---- the speakers (two clones), their woofers and baffle glows
  const speakers: { grp: THREE.Group; woofer: THREE.Mesh | null; z0: number; glow: THREE.Mesh; tw: THREE.Mesh | null }[] = []
  const makeSpeaker = (): THREE.Group => {
    const s = new THREE.Group()
    if (P) for (const n of ['speaker_body', 'speaker_baffle', 'speaker_trim', 'speaker_dark', 'woofer', 'tweeter']) { const m = part(P, n); if (m) s.add(m) }
    else { s.add(box(1.2, 2.9, 1.0, mats.walnut)); const b = box(1.04, 2.6, 0.03, mats.cloth, 1.55); b.position.z = 0.51; s.add(b) }
    return s
  }
  const glowTex = glowTexture(1, 1, 1)
  const speakerAt = (deg: number, radius: number) => {
    const grp = makeSpeaker(); place(grp, deg, radius, 0, deg > 20 ? -0.25 : 0.2)
    const woofer = (grp.children.find(c => c.name === 'woofer') as THREE.Mesh) ?? null, tw = (grp.children.find(c => c.name === 'tweeter') as THREE.Mesh) ?? null
    if (woofer) woofer.material = (mats.cone as THREE.MeshStandardMaterial).clone()
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    glow.position.set(0, 1.05, 0.62); glow.renderOrder = 4; grp.add(glow)
    speakers.push({ grp, woofer, z0: woofer?.position.z ?? 0, glow, tw })
  }
  speakerAt(-14, 5.9); speakerAt(46, 5.3)

  // ---- the credenza and the amplifier on it
  const cred = new THREE.Group(); place(cred, WIN_A / DEG, 5.75, 0); cred.scale.setScalar(1.3)
  if (P) for (const n of ['credenza_body', 'credenza_slats', 'credenza_trim']) { const m = part(P, n); if (m) cred.add(m) }
  else cred.add(box(3.4, 0.95, 0.85, mats.walnut))
  const amp = new THREE.Group(); amp.position.set(0, 0.975, -0.04); cred.add(amp)
  if (P) for (const n of ['amp_body', 'amp_face', 'amp_wood', 'amp_trim', 'amp_tube']) { const m = part(P, n); if (m) amp.add(m) }
  else amp.add(box(2.5, 0.54, 0.7, mats.chassis))
  // VU meters: a backlit face, a needle from a pivot below, a clip lamp
  const AD = 0.7, MY = 0.54 / 2 + 0.07, face = vuFace(); disposables.push(face)
  const meters = [-0.62, 0.62].map(mx => {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ map: face, toneMapped: false })); pl.position.set(mx, MY, AD / 2 + 0.022); amp.add(pl)
    const needleG = new THREE.BoxGeometry(0.012, 0.31, 0.004); needleG.translate(0, 0.155, 0)
    const pivot = new THREE.Group(); pivot.position.set(mx, MY - 0.178, AD / 2 + 0.028)
    const nd = new THREE.Mesh(needleG, new THREE.MeshBasicMaterial({ color: D(0.07, 0.03, 0.02), toneMapped: false })); pivot.add(nd); amp.add(pivot)
    const hub = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: D(0.05, 0.03, 0.02), toneMapped: false })); hub.position.set(0, 0, 0.003); pivot.add(hub)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: glowTexture(1, 0.72, 0.34), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    halo.position.set(mx, MY, AD / 2 + 0.05); halo.renderOrder = 4; amp.add(halo)
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: D(1, 0.1, 0.05), toneMapped: false })); lamp.position.set(mx + 0.2, MY + 0.2, AD / 2 + 0.03); amp.add(lamp)
    return { pl, pivot, halo, lamp, base: pl.material as THREE.MeshBasicMaterial }
  })
  // tubes: a warm glow in each, the glass lights with the mids
  const tubeGlow = [-0.6, -0.2, 0.2, 0.6].map(tx => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.55, 0.15), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.set(0.55, 0.7, 1); s.position.set(tx, 0.54 + 0.26, -0.12); amp.add(s); return s
  })
  const glassMat = mats.glass as THREE.MeshStandardMaterial

  // ---- the window: stone lancet, tracery, sill, curtains, brass; the pane is a dusk sky
  const wg = new THREE.Group(); place(wg, WIN_A / DEG, 6.55, 1.45)
  const curtains: THREE.Mesh[] = []
  if (W) for (const n of ['win_frame', 'win_tracery', 'win_sill', 'win_brass', 'curtain_l', 'curtain_r']) { const m = part(W, n); if (m) { wg.add(m); if (n.startsWith('curtain')) curtains.push(m) } }
  const archPts = (w: number, spring: number, n = 18): THREE.Vector2[] => {
    const p: THREE.Vector2[] = [new THREE.Vector2(-w / 2, 0), new THREE.Vector2(-w / 2, spring)]
    for (let i = 1; i <= n; i++) { const a = Math.PI - (Math.PI / 3) * i / n; p.push(new THREE.Vector2(w / 2 + w * Math.cos(a), spring + w * Math.sin(a))) }
    for (let i = 1; i < n; i++) { const a = (Math.PI / 3) * (1 - i / n); p.push(new THREE.Vector2(-w / 2 + w * Math.cos(a), spring + w * Math.sin(a))) }
    p.push(new THREE.Vector2(w / 2, spring), new THREE.Vector2(w / 2, 0)); return p
  }
  const paneGeo = new THREE.ShapeGeometry(new THREE.Shape(archPts(2.0, 1.7)))
  const paneU = { uTime: k.fog.time, uPres: k.fog.pres, uTop: { value: new THREE.Color(0.04, 0.05, 0.16) }, uHor: { value: new THREE.Color(0.62, 0.3, 0.2) }, uK: { value: 0 }, uRain: { value: 0 }, uBass: { value: 0 } }
  const pane = new THREE.Mesh(paneGeo, new THREE.ShaderMaterial({
    uniforms: paneU, toneMapped: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `precision highp float; varying vec2 vP; uniform float uTime, uPres, uK, uRain, uBass; uniform vec3 uTop, uHor;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        float y = clamp(vP.y / 3.4, 0.0, 1.0);
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.85, y));
        vec2 g = floor(vP * 34.0); float st = step(0.987, h21(g)) * (0.5 + 0.5 * sin(uTime * 2.0 + h21(g + 3.0) * 40.0)) * smoothstep(0.25, 0.7, y);
        c += vec3(0.9, 0.95, 1.0) * st * 0.9;
        float m = exp(-dot(vP - vec2(0.38, 2.5), vP - vec2(0.38, 2.5)) * 14.0); c += vec3(0.95, 0.92, 0.8) * m * 0.9;
        c += vec3(0.5, 0.55, 0.7) * exp(-dot(vP - vec2(0.38, 2.5), vP - vec2(0.38, 2.5)) * 2.2) * 0.18;
        float col = floor(vP.x * 26.0), fx = fract(vP.x * 26.0), sp = 0.6 + 1.2 * h21(vec2(col, 1.0));
        float yy = fract(vP.y * 0.55 + uTime * sp + h21(vec2(col, 2.0)));
        float streak = smoothstep(0.1, 0.0, abs(fx - 0.5) - 0.03) * smoothstep(0.0, 0.05, yy) * (1.0 - smoothstep(0.05, 0.3, yy)) * step(0.45, h21(vec2(col, 3.0)));
        c += vec3(0.7, 0.8, 0.95) * streak * uRain * 0.55;
        c *= (0.72 + 0.35 * uBass * uK);
        gl_FragColor = vec4(c * uPres, 1.0);
      }`,
  }))
  pane.position.set(0, 0, -0.15); wg.add(pane)
  if (!W) { const fr = box(2.6, 0.2, 0.3, mats.stone, 0); wg.add(fr) }
  g.add(wg)
  // the shaft of window light, dust in it, the lit patch on the floor
  const wp = new THREE.Vector3(Math.sin(WIN_A) * 6.4, 3.6, -Math.cos(WIN_A) * 6.4), target = new THREE.Vector3(-1.2, 0, -1.4)
  const shaft: Cone = lightCone(k, { h: 1, r: 1, col: [0.62, 0.7, 0.95], I: 0.2, seed: 5 })
  { const d = target.clone().sub(wp), len = d.length(); shaft.mesh.position.copy(wp); shaft.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()); shaft.mesh.scale.set(2.3, len, 2.3); g.add(shaft.mesh) }
  const dust: Motes = motes(k, { n: 80, at: [1.6, 0, -3.4], half: [2.6, 2.4], h: 5, col: [0.8, 0.85, 1.0], size: 1.9, speed: 0.05, sway: 0.5, seed: 9, alpha: 0.5 })
  g.add(dust.points)
  const patch = glowPlane(k, { col: [0.7, 0.78, 1], size: [3.6, 2.2], opacity: 0.2 }); patch.position.set(0.5, 0.014, -2.6); patch.rotation.z = 0.55; g.add(patch)

  // ---- four beams and their pools on the shelves
  const NB = 4
  const beams = Array.from({ length: NB }, (_, i) => {
    const a0 = (i < 2 ? -1 : 1) * (i % 2 ? 20 : 52) * DEG
    const cone = lightCone(k, { h: 1, r: 1, col: [1, 0.8, 0.5], I: 0, seed: 3 + i })
    const apex = new THREE.Vector3(Math.sin(a0) * 4.2, 9.2, -Math.cos(a0) * 4.2)
    const splash = glowPlane(k, { col: [1, 1, 1], size: [3.6, 3.6], opacity: 0, standing: true }); splash.renderOrder = 4
    g.add(cone.mesh, splash)
    return { cone, apex, splash, a: a0, av: 0, aT: a0, y: 3.4, yT: 3.4, a0, ph: i * 1.7, w: 1 }
  })
  const dirV = new THREE.Vector3(), tgtV = new THREE.Vector3(), UPN = new THREE.Vector3(0, -1, 0), tint = new THREE.Color()
  const seenHit = { b: 0, s: 0 }

  // ---- the landscape
  const land: Landscape = createLandscape({ r0: 4.7, r1: 6.35, pres: k.fog.pres })
  land.mesh.position.set(0, 0, 0.1); g.add(land.mesh)

  return {
    update(t, dt, r, M, rm) {
      const K = M.k, B = M.beat
      g.visible = r > 0.001
      // ---- the VU meters
      const jit = (a: number) => a > 0.02 ? 0.012 * Math.sin(t * 47 + a * 9) : 0
      for (let i = 0; i < 2; i++) {
        const v = Math.min(1.05, i ? M.vuR : M.vuL), m = meters[i]
        m.pivot.rotation.z = -(Math.min(1, v) - 0.5) * 1.56 + jit(v)
        m.base.color.setScalar(0.62 + 0.55 * v * K + 0.18 * Math.sin(t * 0.7 + i))
        ;(m.halo.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.7 * v * K
        ;(m.lamp.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.1, 0.05).multiplyScalar(v > 0.92 ? 1.8 : 0.12)
      }
      // ---- the tubes breathe with the mids
      for (let i = 0; i < 4; i++) (tubeGlow[i].material as THREE.SpriteMaterial).opacity = 0.32 + 0.5 * (0.5 * M.mid + 0.5 * M.level) * K + 0.06 * Math.sin(t * 1.3 + i * 1.9)
      glassMat.emissiveIntensity = 0.35 + 1.1 * M.mid * K
      // ---- the speakers: woofers pump, a glow breathes on the baffle, the whole cabinet leans a hair on a kick
      for (const s of speakers) {
        if (s.woofer) { s.woofer.position.z = s.z0 + (rm ? 0 : (0.035 * M.bass + 0.05 * B) * K); const em = (s.woofer.material as THREE.MeshStandardMaterial).emissive; em.copy(M.pal[0]).multiplyScalar(0.5 * M.bass * K) }
        if (s.tw) s.tw.position.z = (rm ? 0 : 0.006 * M.high * K) + (s.tw.userData.z0 ??= s.tw.position.z)
        const gm = s.glow.material as THREE.MeshBasicMaterial; gm.color.copy(M.pal[0]); gm.opacity = K * (0.12 + 0.55 * M.bass + 0.3 * B)
      }
      // ---- the curtains sway with the bass
      for (const c of curtains) { c.rotation.z = rm ? 0 : Math.sin(t * 0.6 + c.position.x) * 0.004 * (1 + 6 * M.bass * K); c.scale.x = 1 + 0.012 * M.bass * K }
      // ---- the pane takes the song's colours; rain for the songs that ask
      tint.copy(M.pal[1]).multiplyScalar(0.75).lerp(paneU.uTop.value.set(0.04, 0.05, 0.16), 1 - K); paneU.uTop.value.copy(tint)
      paneU.uHor.value.set(0.62, 0.3, 0.2).lerp(M.pal[0], K * 0.8)
      paneU.uK.value = K; paneU.uRain.value = Math.max(0.0, M.mood.rain * K); paneU.uBass.value = M.bass
      // ---- the shaft and the dust: pale moon, warming to the song
      shaft.set(0.2 + 0.12 * K + 0.22 * M.bass * K, [0.62 + (M.pal[2].r - 0.62) * K * 0.6, 0.7 + (M.pal[2].g - 0.7) * K * 0.6, 0.95 + (M.pal[2].b - 0.95) * K * 0.6])
      dust.set(r, rm ? 0 : 1 + 2.5 * K * M.mood.sparkle * (0.4 + M.high))
      ;(patch.material as THREE.MeshBasicMaterial).opacity = 0.2 * r * (1 + 0.8 * K * M.bass)
      // ---- the beams
      const hit = { beat: M.beats !== seenHit.b, snare: M.snares !== seenHit.s }; seenHit.b = M.beats; seenHit.s = M.snares
      const nOn = Math.min(NB, M.mood.beams)
      for (let i = 0; i < NB; i++) {
        const b = beams[i], on = i < nOn && K > 0.01 && !rm
        b.cone.mesh.visible = on; b.splash.visible = on
        if (!on) { b.cone.set(0); continue }
        const slow = Math.sin(t * (0.22 + 0.07 * i) + b.ph) * 0.55
        if ((hit.snare || (hit.beat && i % 2 === 0 && M.mood.snap > 0.6)) && Math.random() < M.mood.snap) { b.aT = Math.max(-1.0, Math.min(1.0, b.a0 + (Math.random() - 0.5) * 1.5 * M.mood.snap)); b.yT = 2.2 + Math.random() * 2.8; b.w = 1 + 0.5 * M.mood.snap }
        else if (hit.beat && Math.random() < M.mood.snap * 0.5) b.w = 1 + 0.4 * M.mood.snap
        else b.aT += (b.a0 + slow - b.aT) * Math.min(1, dt * 0.8)
        b.av += ((b.aT - b.a) * 60 - b.av * 9) * dt; b.a += b.av * dt
        b.y += (b.yT - b.y) * Math.min(1, dt * 4); b.w += (1 - b.w) * Math.min(1, dt * 2.5)
        tgtV.set(Math.sin(b.a) * 6.3, b.y, -Math.cos(b.a) * 6.3)
        dirV.copy(tgtV).sub(b.apex); const len = dirV.length()
        b.cone.mesh.position.copy(b.apex); b.cone.mesh.quaternion.setFromUnitVectors(UPN, dirV.normalize())
        const wd = (0.42 + 0.5 * M.mood.beamW) * b.w * (1 + 0.25 * B)
        b.cone.mesh.scale.set(wd, len, wd)
        const ci = i % 3 === 0 ? M.pal[0] : i % 3 === 1 ? M.pal[2] : tint.copy(M.pal[0]).lerp(M.pal[2], 0.5)
        const lvl = K * (0.1 + 0.45 * M.level + 0.7 * B * (i % 2 ? 0.6 : 1) + 0.25 * M.snare)
        b.cone.set(lvl * 1.15, [ci.r, ci.g, ci.b])
        b.splash.position.copy(tgtV).multiplyScalar(0.985); b.splash.rotation.y = -b.a
        const sm = b.splash.material as THREE.MeshBasicMaterial; sm.color.copy(ci); sm.opacity = Math.min(0.9, lvl * 0.95) * r
        b.splash.scale.setScalar(0.9 + 0.5 * b.w)
      }
      land.update(M, dt, t)
      wall.update(M, rm)
    },
    info: () => ({ speakers: speakers.length, glb: !!P, win: !!W, beams: NB, curtains: curtains.length }),
    dispose() { land.dispose(); dust.dispose(); for (const d of disposables) d.dispose(); g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !(m.geometry as THREE.BufferGeometry & { userData?: { shared?: boolean } }).userData?.shared) m.geometry.dispose() }); for (const m of Object.values(mats)) m.dispose(); face.dispose(); g.removeFromParent() },
  }
}
