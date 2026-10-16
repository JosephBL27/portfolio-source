// Astro 2/3: the big, slow things. The Milky Way on an inverted sphere (NASA SVS Deep Star Maps 2020, boosted so its core can bloom, turning very slowly),
// a drifting fbm nebula behind each area tinted in that area's colour, and a faint aurora curtain over the education / hall horizon (the education stops look out toward azimuth ~110 degrees, the gate toward ~40).
// Everything is additive, depth-tested, drawn before the scene (renderOrder < 0), and rides with the camera.
import * as THREE from 'three'
import { AREAS } from '../../layout'
import { U as SIGU } from '../../signals'

const BASE = import.meta.env.BASE_URL
const NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }`

export interface SkyBits {
  group: THREE.Group
  /** gain: overall level of the Milky Way; hot: how much of its core is pushed over the bloom threshold; neb[i]: nebula weight per area (AREAS order) + hub last; aur: aurora weight */
  update(t: number, o: { yaw?: number; gain: number; hot: number; neb: number[]; aur: number; rm: boolean; load: number; tint?: THREE.Color }): void
  loadMap(): void
  dispose(): void
}

export function createSkyBits(phone: boolean): SkyBits {
  const group = new THREE.Group(), geos: THREE.BufferGeometry[] = [], mats: THREE.ShaderMaterial[] = []
  // ---- the Milky Way
  const dome = new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uMap: { value: null }, uGain: { value: 0 }, uHot: { value: 0 }, uRot: { value: 0 }, uTint: { value: new THREE.Color(0.86, 0.9, 1.0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform float uGain, uHot, uRot; uniform vec3 uTint; varying vec2 vUv;
      void main(){ vec3 c = texture2D(uMap, vec2(vUv.x + uRot, vUv.y), 1.3).rgb;   // a little mip bias: the shot is magnified ~2x, so keep the grain soft
      c = pow(max(c - 0.22, 0.0) / 0.78, vec3(1.7));   // crush the map's noise floor: faint stars stay, the grain and the dim haze go (v20: 0.16 -> 0.22, the black stays black)
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        c = c * uTint * uGain + c * pow(l, 2.2) * uHot;   // the HDR-ish boost: only the bright core climbs over the bloom threshold
        gl_FragColor = vec4(c, 1.0); }` })
  mats.push(dome)
  const sg = new THREE.SphereGeometry(100, phone ? 32 : 64, phone ? 20 : 40); geos.push(sg)
  const domeMesh = new THREE.Mesh(sg, dome); domeMesh.frustumCulled = false; domeMesh.renderOrder = -6; domeMesh.visible = false
  domeMesh.rotation.set(0.42, 2.2, -0.25)     // tilt chosen so the galactic band arcs across the upper view from the ring
  group.add(domeMesh)
  let tex: THREE.Texture | null = null, disposed = false, loading = false
  const loadMap = () => {
    if (loading || tex) return; loading = true
    const gl = document.createElement('canvas').getContext('webgl2'), big = !phone && (gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? 0) >= 4096
    const url = big ? `${BASE}media/sky/milkyway-4096.webp` : `${BASE}media/sky/milkyway-2048.jpg`
    new THREE.TextureLoader().load(url, t => {
      if (disposed) { t.dispose(); return }
      t.colorSpace = THREE.NoColorSpace   // the post stack treats scene colour as display-referred: use the map's values as they are
      t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter
      tex = t; dome.uniforms.uMap.value = t; domeMesh.visible = true
    }, undefined, () => { loading = false /* no map: the stars, nebulae and aurora still play */ })
  }

  // ---- nebulae: one billboard per area on the shell. The flight views each area from outside the ring, looking in across the hub, so what lies behind
  // the subject is the far side of the sky: area azimuth + 180 degrees (+25, measured from the actual stop cameras).
  const nebCol = (hex: string) => { const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); return [c.clone().multiplyScalar(0.9), new THREE.Color().setHSL((hsl.h + 0.1) % 1, Math.min(1, hsl.s * 0.9), 0.5)] }
  const nebs = [...AREAS.map(a => ({ az: ((a.angle + 205) * Math.PI) / 180, el: 0.04 + 0.05 * Math.sin(a.angle), hex: a.accent })), { az: 0.2, el: 0.5, hex: '#7B7CFF' },
    // v20: the name screen's own cloud, dead ahead of its camera (the camera looks down -z: az = PI), off to the right so the letters stay on the dark; violet into rose
    { az: Math.PI - 0.3, el: 0.1, hex: '#8E6BFF' }].map((d, i) => {
    const [c1, c2] = nebCol(d.hex)
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC1: { value: c1 }, uC2: { value: c2 }, uSeed: { value: i * 7.3 + 1.7 }, uSgPtr: SIGU.uSgPtr, uSgTv: SIGU.uSgTv, uSgMus: SIGU.uSgMus, uSgRip: SIGU.uSgRip, uSgBr: SIGU.uSgBr, uSgHead: SIGU.uSgHead, uSgMc: SIGU.uSgMc, uSgFlow: SIGU.uSgFlow },
      vertexShader: 'varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `${NOISE} uniform float uT, uA, uSeed, uSgFlow; uniform vec3 uC1, uC2, uSgMc; uniform vec4 uSgPtr, uSgTv, uSgMus, uSgRip, uSgBr, uSgHead; varying vec2 vUv; varying vec3 vDir;
        void main(){
          // v19 signals: the flight and the particle morph make the billow flow faster; the pointer lights the cloud it passes over; the hub TV tints it;
          // the bass swells it and every beat sends a ring across it
          vec2 p = (vUv - 0.5) * 3.2 + uSeed, w = vec2(uT * 0.011, -uT * 0.008) + uSgFlow * vec2(0.012, -0.007) * (1.0 + 2.0 * uSgBr.z);
          vec2 q = vec2(fbm(p + w), fbm(p + vec2(5.2, 1.3) - w));            // domain warp: the slow billow
          float f = fbm(p * 1.1 + 2.6 * q);
          float m = smoothstep(1.0, 0.12, length(vUv - 0.5) * 2.0);
          float rg = 1.0 - abs(2.0 * f - 1.0);                                // ridged: veils and filaments instead of a flat fill
          float d = (0.2 * smoothstep(0.5, 0.9, f) + pow(smoothstep(0.72, 0.98, rg), 2.0) * 1.1) * m * m;
          float pg = uSgPtr.w > 0.001 ? pow(max(dot(normalize(vDir), uSgPtr.xyz), 0.0), 30.0) * uSgPtr.w : 0.0;   // the pointer's light on the cloud
          float rr = length(vUv - 0.5) * 2.0, ring = uSgRip.y > 0.001 ? exp(-pow((rr - uSgRip.x * 1.5) / 0.16, 2.0)) * uSgRip.y : 0.0;   // the beat ring
          d *= 1.0 + 3.2 * pg + 0.9 * uSgMus.x + 0.5 * uSgBr.w + uSgHead.w * 0.8;
          d += (0.45 * ring + 0.6 * pg) * m * (0.4 + f);
          vec3 c = mix(uC1, uC2, smoothstep(0.2, 0.9, q.x)) * d * (0.55 + f);
          float ridge = smoothstep(0.62, 0.8, f) * m;                         // a thin bright filament in the thick of it
          c += vec3(1.0, 0.92, 0.85) * ridge * 0.18;
          vec3 hue = 0.35 + 1.5 * uSgTv.rgb;                                  // the hub TV's channel colour (w = how on and how coloured)
          c = mix(c, c * hue + uSgTv.rgb * d * 0.12, uSgTv.w * 0.6);
          c += uSgMc * ring * 0.2 * m;                                        // the song's own colour rides the ring
          gl_FragColor = vec4(c * uA, 1.0); }` })
    const g = new THREE.PlaneGeometry(1, 1); geos.push(g); mats.push(m)
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.visible = false
    const R = 92, s = R * (i === AREAS.length ? 1.3 : i === AREAS.length + 1 ? 1.55 : 0.95 + 0.15 * Math.sin(i * 2.1))
    mesh.position.set(Math.sin(d.az) * Math.cos(d.el) * R, Math.sin(d.el) * R, Math.cos(d.az) * Math.cos(d.el) * R); mesh.scale.set(s, s * 0.78, 1); mesh.lookAt(0, 0, 0); mesh.rotateZ(i * 1.3)
    group.add(mesh); return { mesh, m }
  })

  // ---- the aurora: a curved curtain on the shell toward the education / hall side of the ring (azimuths ~265 to 325 degrees)
  const AZ0 = (95 * Math.PI) / 180, SPAN = 1.2, SEG = phone ? 48 : 96, ROWS = 6
  const ap = new Float32Array((SEG + 1) * (ROWS + 1) * 3), au = new Float32Array((SEG + 1) * (ROWS + 1) * 2), ai: number[] = []
  for (let y = 0; y <= ROWS; y++) for (let x = 0; x <= SEG; x++) {
    const u = x / SEG, v = y / ROWS, az = AZ0 + (u - 0.5) * 2 * SPAN, el = 0.04 + v * 0.46 + 0.05 * Math.sin(u * 5.0), R = 96, k = (y * (SEG + 1) + x)
    ap.set([Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, Math.cos(az) * Math.cos(el) * R], k * 3); au.set([u, v], k * 2)
    if (x < SEG && y < ROWS) { const a = k, b = k + 1, c = k + SEG + 1, d = c + 1; ai.push(a, c, b, b, c, d) }
  }
  const ag = new THREE.BufferGeometry(); geos.push(ag)
  ag.setAttribute('position', new THREE.BufferAttribute(ap, 3)); ag.setAttribute('uv', new THREE.BufferAttribute(au, 2)); ag.setIndex(ai)
  const am = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE} uniform float uT, uA; varying vec2 vUv;
      void main(){
        float x = vUv.x * 9.0, v = vUv.y;
        float sway = fbm(vec2(x * 0.5 + uT * 0.035, uT * 0.02)) * 2.2;       // the whole curtain folds slowly
        float rays = vn(vec2(x * 7.0 + sway * 3.0, uT * 0.09)) * 0.65 + vn(vec2(x * 19.0 - sway * 5.0, uT * 0.14)) * 0.35;
        float body = smoothstep(0.0, 0.09, v) * pow(1.0 - v, 1.4);          // bright hem at the bottom, long fade upward
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = body * edge * (0.05 + 1.5 * pow(rays, 2.6)) * (0.55 + 0.45 * sin(x * 1.3 + uT * 0.3 + sway));
        vec3 col = mix(vec3(0.16, 1.0, 0.58), vec3(0.5, 0.35, 1.0), smoothstep(0.15, 0.95, v + 0.18 * (rays - 0.5)));
        col = mix(col, vec3(0.95, 0.35, 0.65), smoothstep(0.78, 1.0, v) * 0.35);
        gl_FragColor = vec4(col * a * uA, 1.0); }` })
  mats.push(am)
  const aur = new THREE.Mesh(ag, am); aur.frustumCulled = false; aur.renderOrder = -4; aur.visible = false; group.add(aur)

  return {
    group, loadMap,
    update(t, o) {
      const tt = o.rm ? 0 : t
      dome.uniforms.uGain.value = o.gain * o.load; dome.uniforms.uHot.value = o.hot * o.load; dome.uniforms.uRot.value = tt * 0.0009 + (o.yaw ?? 0)
      if (o.tint) dome.uniforms.uTint.value.copy(o.tint)
      domeMesh.visible = !!tex && o.gain * o.load > 0.002
      nebs.forEach((n, i) => { const a = o.neb[i] ?? 0; n.mesh.visible = a > 0.004; n.m.uniforms.uA.value = a * (phone ? 0.8 : 1); n.m.uniforms.uT.value = tt })
      am.uniforms.uT.value = tt; am.uniforms.uA.value = o.aur; aur.visible = o.aur > 0.004
    },
    dispose() { disposed = true; tex?.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); group.removeFromParent() },
  }
}
