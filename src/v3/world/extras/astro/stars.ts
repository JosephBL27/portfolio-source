// Astro 1/3: depth. Three parallax star layers (GPU points that twinkle, coloured by temperature), a few bright stars with diffraction spikes,
// and the rare shooting star. All of it lives on shells that ride with the camera (the far one fully, the near ones lag, so the sky has depth).
import * as THREE from 'three'
import { rng } from '../lib/flags'
import { S as SIG, U as SIGU } from '../../signals'

/** blackbody-ish ramp: 0 = 3000 K orange ... 1 = 12000 K blue-white */
const RAMP: [number, number, number][] = [[1, 0.6, 0.34], [1, 0.84, 0.66], [1, 0.96, 0.9], [0.84, 0.9, 1], [0.62, 0.76, 1]]
export function tempColor(k: number, out: number[] = [0, 0, 0]) {
  const x = Math.min(0.9999, Math.max(0, k)) * (RAMP.length - 1), i = Math.floor(x), f = x - i
  for (let c = 0; c < 3; c++) out[c] = RAMP[i][c] + (RAMP[i + 1][c] - RAMP[i][c]) * f
  return out
}

const VERT = /* glsl */ `attribute float aSize; attribute float aPh; attribute float aF; attribute vec3 aCol;
uniform float uT, uVis, uDpr, uTw, uBase, uMax, uAmp; varying vec3 vC; varying float vA;
uniform vec4 uSgPtr, uSgHead, uSgMus;   // v19 signal bus: pointer ray (w presence), flight heading (w fan-out), music bands
void main(){
  float s = 0.5 + 0.5 * sin(uT * aF + aPh), s2 = 0.5 + 0.5 * sin(uT * aF * 2.7 + aPh * 1.9);
  float tw = 1.0 - uTw * (1.0 - 0.45 * s - 0.55 * s * s2);   // scintillation: fast and shallow on the dim ones, slow on the bright
  vA = uVis * tw * (uBase + 0.16 * aSize); vC = aCol;
  vec3 pos = position; float lift = 0.0;
  if (uSgHead.w > 0.001 || uSgPtr.w > 0.001) {
    float Rl = length(pos); vec3 d = pos / Rl;
    if (uSgHead.w > 0.001) {   // flight speed warps the sky: the stars fan out around the heading (the aberration of fast travel, run backwards so the sky streams past)
      float ca = dot(d, uSgHead.xyz), cb = (ca - uSgHead.w) / (1.0 - uSgHead.w * ca);
      vec3 pp = d - uSgHead.xyz * ca; float sa = length(pp);
      if (sa > 1e-4) d = uSgHead.xyz * cb + pp / sa * sqrt(max(0.0, 1.0 - cb * cb));
      lift += 1.1 * uSgHead.w * smoothstep(0.1, 1.0, ca);
    }
    if (uSgPtr.w > 0.001) {    // the pointer is a small lens: nearby stars lean toward it and brighten
      float g = exp(-(1.0 - dot(d, uSgPtr.xyz)) * 70.0) * uSgPtr.w;
      d = normalize(d + (uSgPtr.xyz - d) * g * 0.5); lift += 1.6 * g;
    }
    pos = d * Rl;
  }
  lift += 0.55 * uSgMus.x;     // the bass lifts the whole sky
  vA = min(vA * (1.0 + lift), uAmp);   // wave 24: a ceiling on the star's brightness. Past ~6 the core and halo clip to one white blob that bloom smears into a big soft star (the hero layer, 19 at 118 px)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(uMax, aSize * uDpr * (0.9 + 0.2 * tw) * (1.0 + 0.35 * lift));
}`
const FRAG_DOT = /* glsl */ `varying vec3 vC; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 1.5) * vA; gl_FragColor = vec4(vC * a, 1.0); }`
// a bright star: tight core, soft halo, four long spikes with a faint 45 degree pair (the telescope look)
const FRAG_SPIKE = /* glsl */ `varying vec3 vC; varying float vA;
void main(){
  vec2 p = (gl_PointCoord - 0.5) * 2.0; float r = length(p);
  float core = exp(-r * 18.0) * 1.4 + exp(-r * 5.0) * 0.28;
  float sp = exp(-abs(p.x) * 55.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 55.0) * exp(-abs(p.x) * 2.6);
  vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071;
  float sp2 = (exp(-abs(q.x) * 90.0) * exp(-abs(q.y) * 4.5) + exp(-abs(q.y) * 90.0) * exp(-abs(q.x) * 4.5)) * 0.35;
  float a = (core + sp * 0.9 + sp2) * vA * smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(vC * a, 1.0);
}`

export interface Stars {
  layers: THREE.Group[]   // one group per shell; astro.ts positions them (cam * follow)
  follow: number[]
  update(t: number, vis: number, rm: boolean, cam: THREE.Camera, dt: number): void
  shoot(cam: THREE.Camera): void
  dispose(): void
}

export function createStars(phone: boolean, dpr: number): Stars {
  const r = rng(0x5a17), root: THREE.Object3D[] = [], mats: THREE.ShaderMaterial[] = [], twBase: number[] = [], geos: THREE.BufferGeometry[] = []
  const mk = (n: number, R: number, sizeMin: number, sizeMax: number, pow: number, base: number, tw: number, spike: boolean, maxPx: number, ampCap = 1e4) => {
    const pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n), fq = new Float32Array(n), col = new Float32Array(n * 3), tmp = [0, 0, 0]
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = R * (0.96 + 0.08 * r())
      pos.set([Math.cos(th) * s * rr, u * rr, Math.sin(th) * s * rr], i * 3)
      const m = Math.pow(r(), pow); sz[i] = sizeMin + (sizeMax - sizeMin) * m; ph[i] = r() * 100
      fq[i] = spike ? 0.35 + r() * 0.6 : 1.1 + r() * 3.2 * (1 - m)
      // most stars are cool-white to orange dwarfs; a minority blue-white giants: the dim ones skew warm, the bright ones skew blue
      tempColor(Math.min(1, Math.max(0, 0.18 + r() * 0.5 + (r() < 0.22 ? 0.35 : 0) + m * 0.25)), tmp); col.set(tmp, i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1))
    g.setAttribute('aF', new THREE.BufferAttribute(fq, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3))
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uT: { value: 0 }, uVis: { value: 0 }, uDpr: { value: dpr }, uTw: { value: tw }, uBase: { value: base }, uMax: { value: maxPx }, uAmp: { value: ampCap }, uSgPtr: SIGU.uSgPtr, uSgHead: SIGU.uSgHead, uSgMus: SIGU.uSgMus },
      vertexShader: VERT, fragmentShader: spike ? FRAG_SPIKE : FRAG_DOT })
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -4
    const grp = new THREE.Group(); grp.add(p); root.push(grp); mats.push(m); twBase.push(tw); geos.push(g); return grp
  }
  const k = phone ? 0.5 : 1
  // far (rides with the camera: infinite), mid and near (lag behind it, so they slide against the far one: parallax). Radii keep every star inside camera.far.
  const far = mk(Math.round(2600 * k), 96, 1.3, 3.4, 4, 0.5, 0.5, false, 9)
  const mid = mk(Math.round(1100 * k), 76, 1.6, 4.0, 3.5, 0.55, 0.5, false, 11)
  const near = mk(Math.round(420 * k), 60, 2.0, 5.0, 3, 0.6, 0.6, false, 13)
  const bright = mk(Math.round(60 * k), 90, 26, 62, 2.4, 0.6, 0.18, true, 96 * dpr)
  // wave 24: the hero stars used to be 80-118 px sprites at brightness ~19. At a stop whose camera looks their way (meeple, chess, bouldering) one sat beside the subject as a
  // large, blurred white four-point blob. Now a crisp telescope glint like the bright layer: 40-64 px (a hard 64 px screen cap, in CSS px at any dpr) and a brightness ceiling of 6.5.
  const hero = mk(phone ? 3 : 6, 88, 40, 64, 1, 0.62, 0.1, true, 64 * dpr, 6.5)
  const follow = [1, 0.8, 0.55, 1, 1]

  // ---- the shooting star: 130 points along a great-circle arc, head first
  const TRAIL = 130, sp = new Float32Array(TRAIL * 3), ss = new Float32Array(TRAIL), sa = new Float32Array(TRAIL)
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(ss, 1)); sg.setAttribute('aA', new THREE.BufferAttribute(sa, 1))
  const sm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uDpr: { value: dpr } },
    vertexShader: 'attribute float aSize; attribute float aA; uniform float uDpr; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uDpr; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 1.6) * vA; gl_FragColor = vec4(vec3(0.85, 0.93, 1.0) * a * 2.4, 1.0); }' })
  const shootPts = new THREE.Points(sg, sm); shootPts.frustumCulled = false; shootPts.renderOrder = -3; shootPts.visible = false
  const shootGrp = new THREE.Group(); shootGrp.add(shootPts); root.push(shootGrp); follow.push(1)
  const S = { on: false, age: 0, dur: 1.15, p0: new THREE.Vector3(), v: new THREE.Vector3() }
  const tp = new THREE.Vector3(), f = new THREE.Vector3(), rt = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0)
  const rs = rng(0xbeef ^ (Date.now() & 0xffff))
  let next = 11 + rs() * 6, clock = 0

  const shoot = (cam: THREE.Camera) => {
      cam.getWorldDirection(f); rt.crossVectors(f, UP).normalize(); up.crossVectors(rt, f).normalize()
      const side = rs() < 0.5 ? -1 : 1
      S.p0.copy(f).addScaledVector(rt, (rs() - 0.5) * 0.7).addScaledVector(up, 0.05 + rs() * 0.22).normalize()
      S.v.copy(rt).multiplyScalar(side * (0.6 + rs() * 0.3)).addScaledVector(up, -0.18 - rs() * 0.25)
      S.on = true; S.age = 0; shootPts.visible = true
  }
  return {
    layers: root as THREE.Group[], follow, shoot,
    update(t, vis, rm, cam, dt) {
      mats.forEach((m, i) => { m.uniforms.uT.value = rm ? 0 : t; m.uniforms.uVis.value = vis; m.uniforms.uTw.value = rm ? 0 : twBase[i] })
      if (rm) { shootPts.visible = false; SIG.shoot.on = false; return }
      clock += dt
      if (!S.on && clock > next && vis > 0.5) { shoot(cam); next = clock + 20 + rs() * 20 }
      SIG.shoot.on = S.on
      if (S.on) {
        S.age += dt; const u = S.age / S.dur
        if (u >= 1) { S.on = false; shootPts.visible = false; SIG.shoot.on = false; SIG.shoot.env = 0 } else {
          for (let i = 0; i < TRAIL; i++) {
            const lag = i * 0.0036, a = Math.max(0, S.age - lag), e = a * a * 0.5 + a * 0.55   // accelerates a little
            tp.copy(S.p0).addScaledVector(S.v, e).normalize().multiplyScalar(98)
            sp[i * 3] = tp.x; sp[i * 3 + 1] = tp.y; sp[i * 3 + 2] = tp.z
            const fall = 1 - i / TRAIL, env = Math.sin(Math.PI * Math.min(1, u * 1.04)) // fades in, burns out
            ss[i] = (i === 0 ? 12 : 6 * fall + 1.4); sa[i] = fall * fall * env * 0.95 * (S.age - lag > 0 ? 1 : 0)
          }
          sg.attributes.position.needsUpdate = true; sg.attributes.aSize.needsUpdate = true; sg.attributes.aA.needsUpdate = true
          SIG.shoot.dir.set(sp[0], sp[1], sp[2]).normalize(); SIG.shoot.env = Math.sin(Math.PI * Math.min(1, u * 1.04))   // v19: the bus learns where the head is
        }
      }
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); sg.dispose(); sm.dispose(); for (const o of root) o.removeFromParent() },
  }
}
