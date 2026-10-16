// LEGACY SPACE "hold" (kept as the fallback of spaces/hold.ts when the Poly Haven backdrop is unavailable): the climbing wall, with Yosemite Valley behind it. The backdrop is the REAL place: elevation (AWS Terrain Tiles) and orthophoto (USGS The National Map)
// of the valley seen from Tunnel View, looking east-north-east at dusk, at true vertical scale (spaces/terrain.ts, built by scripts/build-terrain.mjs). The sky is the
// east sky after sunset: the earth's shadow low on the horizon, the Belt of Venus above it, indigo overhead, a few stars; the sun is behind the camera and never shown.
// Two or three dark granite boulders frame the base of the wall as silhouettes against the lit valley. The ground is black, dusted with grit, with a warm pool under the pad.
// Fallback (?noterrain=1, a fetch or parse failure): the earlier dusk crag (granite cliff, GLB or procedural) under a low amber-to-indigo band, no console error, one warn.
import * as THREE from 'three'
import { loadCrag, type Crag } from './crag'
import type { Terrain } from './terrain'
import { withAO } from '../../glbmodel'
import { burst, gameProps, type Burst } from './games-fx'
import { glowPlane, groundMesh, lightCone, motes, type Cone, type LightCfg, type Motes, type Space, type SpaceKit } from './common'

const SKY_FRAG = /* glsl */ `
precision highp float; varying vec3 vD; uniform float uPres, uTime; uniform vec3 uWin;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vD); float h = max(d.y + 0.10, 0.0);                            // the band sits ~6 degrees up the sky: the camera looks over the crag into it
  vec3 amber = vec3(1.0, 0.5, 0.15), rose = vec3(0.74, 0.22, 0.30), indigo = vec3(0.11, 0.08, 0.36), top = vec3(0.012, 0.014, 0.05);
  vec3 c = mix(amber, rose, smoothstep(0.02, 0.12, h)); c = mix(c, indigo, smoothstep(0.1, 0.3, h)); c = mix(c, top, smoothstep(0.3, 0.8, h));
  c *= 0.34 + 0.66 * (1.0 - smoothstep(0.02, 0.5, h));                                // a band: bright low, gone high
  vec3 sun = normalize(vec3(0.42, 0.0, -1.0));
  c += vec3(1.0, 0.58, 0.22) * pow(max(dot(d, sun), 0.0), 30.0) * 0.9;               // the last of the sun
  c += uWin * 0.05 * smoothstep(0.25, 0.6, h);                                        // a breath of the window's blue high up
  vec2 sp = d.xz / max(0.2, d.y) * 26.0; float st = step(0.9972, h21(floor(sp))); c += vec3(0.8, 0.85, 1.0) * st * smoothstep(0.3, 0.6, h) * 0.55;
  float fade = smoothstep(-0.34, -0.04, d.y);
  gl_FragColor = vec4(c * fade * uPres, 1.0);
}`

/** the east sky after sunset, as one function of the view direction (space-local) so the terrain's haze can use the very same colours. anti = horizontal direction of the antisolar point.
 *  Earth's shadow: a blue-grey band on the horizon with a soft top edge near 5 degrees; Belt of Venus: pink, centred near 11 degrees (about 6 to 16); indigo above; display-referred. */
export const EAST_SKY_GLSL = /* glsl */ `
vec3 skyCol(vec3 d, vec2 anti) {
  float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float side = 0.5 + 0.5 * dot(normalize(d.xz + vec2(1e-5)), anti);                    // 1 at the antisolar point, 0 toward the sun's side
  vec3 zen = vec3(0.010, 0.014, 0.062), indigo = vec3(0.062, 0.070, 0.245), dusk = vec3(0.15, 0.14, 0.31);
  vec3 c = mix(dusk, indigo, smoothstep(9.0, 34.0, el));
  c = mix(c, zen, smoothstep(32.0, 88.0, el));
  float belt = exp(-pow((el - 11.0) / 5.4, 2.0));
  c = mix(c, vec3(0.70, 0.38, 0.46), belt * (0.38 + 0.5 * side));                          // the Belt of Venus
  c += vec3(0.50, 0.20, 0.07) * (1.0 - side) * exp(-max(el, 0.0) / 8.0) * 0.5;            // the sunset's own glow leaking round the sun's side of the sky
  float shadow = 1.0 - smoothstep(1.2, 7.2, el);
  c = mix(c, vec3(0.072, 0.088, 0.150), shadow * (0.55 + 0.4 * side));                     // the earth's shadow
  return c;
}`

const EAST_FRAG = /* glsl */ `
precision highp float; varying vec3 vD; uniform float uPres, uTime; uniform vec3 uWin; uniform vec2 uAnti;
${EAST_SKY_GLSL}
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.03 + 7.7; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vD);
  vec3 c = skyCol(d, uAnti);
  float el = max(d.y, 0.0);
  // high cirrus, stretched along the horizon, still lit from below by the sun that has set for them (rose near the Belt of Venus, grey-violet higher)
  vec2 cp = d.xz / (d.y + 0.35) * 2.1;
  float cn = fbm2(vec2(cp.x * 1.6 + uTime * 0.004, cp.y * 5.5)) * 0.7 + fbm2(vec2(cp.x * 4.1, cp.y * 14.0 + 3.0)) * 0.3;
  float cirrus = smoothstep(0.50, 0.78, cn) * smoothstep(0.03, 0.12, el) * (1.0 - smoothstep(0.35, 0.8, el));
  c = mix(c, mix(vec3(0.66, 0.34, 0.40), vec3(0.20, 0.17, 0.34), smoothstep(0.1, 0.5, el)), cirrus * 0.55);
  c += uWin * 0.035 * smoothstep(0.35, 0.85, el);                                          // a breath of the window's blue high up
  vec2 sp = d.xz / max(0.25, d.y) * 34.0; vec2 cell = floor(sp);
  float tw = 0.65 + 0.35 * sin(uTime * (0.9 + 2.1 * h21(cell + 3.0)) + h21(cell) * 40.0);
  float dotv = smoothstep(0.30, 0.0, length(fract(sp) - 0.5)) * step(0.9965, h21(cell)) * smoothstep(0.34, 0.62, el);
  c += vec3(0.80, 0.85, 1.0) * dotv * tw * 0.5;                                            // a few stars, high up, never near the horizon
  gl_FragColor = vec4(c * uPres, 1.0);
}`

export function createHoldSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-hold'
  let kit: SpaceKit, beams: Cone[] = [], puff: Burst, nextPuff = 0, crag: Crag | null = null, chalk: Motes, warm: THREE.Mesh, rim: THREE.Mesh, sky: THREE.Mesh, skyMat: THREE.ShaderMaterial
  let terrain: Terrain | null = null, mode: 'terrain' | 'crag' = 'crag', why = ''
  const light: LightCfg = {
    keyPos: [-8.4, 5.2, 6.4], keyAim: [0.2, 2.4, -0.8], keyCol: [1.0, 0.68, 0.36], keyI: 150, keyAngle: 0.6, keyPen: 0.75, keyDist: 38,
    rimPos: [4.2, 3.4, -4.6], rimCol: [0.45, 0.6, 1.0], rimI: 85, rimDist: 15,
    fillSky: [1.0, 0.64, 0.45], fillGround: [0.09, 0.07, 0.1], fillI: 0.8,
  }
  // the terrain mesh follows the space's visibility exactly (a hidden space owns no visible terrain)
  let shown = true
  Object.defineProperty(root, 'visible', { configurable: true, get: () => shown, set: (v: boolean) => { shown = v; if (terrain) terrain.mesh.visible = v } })
  const camLocal = new THREE.Vector3()
  return {
    id: 'hold', root, light,
    async build(k) {
      kit = k
      // ---- the real valley first: lazily loaded code and data; any failure keeps the old crag and says so once
      if (!new URLSearchParams(location.search).has('noterrain')) {
        try {
          const mod = await import('./terrain')
          terrain = await mod.loadTerrain(k, { skyGlsl: EAST_SKY_GLSL })
          mode = 'terrain'
        } catch (e) { terrain = null; why = String((e as Error)?.message ?? e); console.warn('[spaces] hold: the Yosemite backdrop is unavailable, using the dusk crag', why) }
      } else { why = '?noterrain=1'; console.warn('[spaces] hold: ?noterrain=1, using the dusk crag') }
      const T = mode === 'terrain'
      if (T) {
        k.fog.col.value.setRGB(0.082, 0.098, 0.165); k.fog.range.value.set(26, 96)     // the boulders sit in the valley's blue-grey air
        light.fillSky = [0.34, 0.40, 0.72]; light.fillGround = [0.05, 0.045, 0.06]; light.fillI = 0.5
      } else k.fog.col.value.setRGB(0.07, 0.04, 0.075), k.fog.range.value.set(12, 30)    // the haze is dusk, so the far crag melts into the band behind it
      // the ground: black, a fine grit, a warm pool under the pad, a cool lap toward the rim light
      root.add(groundMesh(k, {
        frag: /* glsl */ `
          float gr(vec2 p) { return fbm(p * 5.0) * 0.6 + h21(floor(p * 38.0)) * 0.4; }
          vec4 ground(vec2 p, float r) {
            float g = gr(p);
            vec3 col = vec3(0.018, 0.016, 0.016) * (0.6 + 0.9 * g);
            float pool = exp(-dot(p - vec2(0.0, 0.4), p - vec2(0.0, 0.4)) / 7.0);
            col += vec3(1.0, 0.5, 0.2) * pool * (0.05 + 0.06 * g);
            float cool = exp(-dot(p - vec2(4.4, -3.2), p - vec2(4.4, -3.2)) / 12.0);
            col += vec3(0.1, 0.2, 0.5) * cool * 0.05;
            return vec4(col, 1.0);
          }`,
      }))
      if (T) {
        // the dome rides with the camera (it is the sky, infinitely far): radius 106 sits just inside camera.far (120) and just beyond the farthest terrain quad (108 is culled by distance)
        skyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false, transparent: true,
          uniforms: { uPres: k.fog.pres, uTime: k.fog.time, uWin: { value: new THREE.Vector3(...k.win) }, uAnti: { value: new THREE.Vector2(0, 1) } },
          vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: EAST_FRAG,
        })
        sky = new THREE.Mesh(new THREE.SphereGeometry(112, 64, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), skyMat)
        // the terrain owns the antisolar direction (its sun); read it back from its material
        skyMat.uniforms.uAnti.value = (terrain!.mesh.material as THREE.ShaderMaterial).uniforms.uAnti.value
      } else {
        skyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false, transparent: true,
          uniforms: { uPres: k.fog.pres, uTime: k.fog.time, uWin: { value: new THREE.Vector3(...k.win) } },
          vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: SKY_FRAG,
        })
        sky = new THREE.Mesh(new THREE.SphereGeometry(34, 48, 22, 0, Math.PI * 2, 0, Math.PI * 0.56), skyMat)
      }
      sky.renderOrder = -9; sky.frustumCulled = false; sky.name = 'sky'
      root.add(sky)
      if (terrain) { terrain.mesh.visible = shown; root.add(terrain.group) }
      crag = await loadCrag(k, T ? 'boulders' : 'full')
      root.add(crag.group)
      warm = glowPlane(k, { col: [1.0, 0.55, 0.22], size: 9, opacity: 0.45 }); warm.position.set(0, 0.012, 0.3)
      rim = glowPlane(k, { col: [0.32, 0.55, 1.0], size: [9, 4.5], opacity: T ? 0.12 : 0.22, standing: true }); rim.position.set(2.4, 3.2, -5.2)
      chalk = motes(k, { n: 190, at: [0, 0.2, -0.6], half: [5.4, 3.8], h: 6.4, col: [1.0, 0.86, 0.6], size: 2.6, speed: 0.12, sway: 0.5, seed: 5, alpha: 0.8 })
      root.add(warm, rim, chalk.points)
      // ---- golden hour: the sun is low in the west behind the camera and rakes in through three shafts, lit chalk hangs in them
      if (T) { const u = (terrain!.mesh.material as THREE.ShaderMaterial).uniforms; if (u.uSunCol) u.uSunCol.value.set(1.0, 0.56, 0.27); if (u.uSunI) u.uSunI.value = 3.7 }
      for (const [x, y, z, aim, r, seed] of [[-11, 13, 9, -2.2, 2.4, 1], [-12.5, 13.5, 6, 0.6, 2.9, 4], [-10, 12.5, 11, 2.8, 2.1, 7]] as number[][]) {
        const c = lightCone(k, { h: 24, r, col: [1.0, 0.7, 0.34], I: 0.1, seed }); c.mesh.position.set(x, y, z)
        const d = new THREE.Vector3(aim - x, -y + 0.2, -1.2 - z).normalize(); c.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d); beams.push(c); root.add(c.mesh)
      }
      // a clap of chalk: a slow cloud that rises off the pad now and then (and on arrival)
      puff = burst(k, { n: 46, speed: 0.9, up: 1.5, g: -0.3, life: 3.4, size: 7, grow: 0.9, col: [1.0, 0.9, 0.72], alpha: 0.3, seed: 13 })
      root.add(puff.points)
      // ---- a coil of climbing rope with its tail across the floor beside the pad (Blender; a plain tube coil when the file is missing)
      const gp = await gameProps()
      const ropeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.4, 0.16), roughness: 0.8, envMap: k.env, envMapIntensity: 0.5 })
      const rsrc = gp?.get('rope')
      if (rsrc) { const o = new THREE.Mesh(rsrc.geometry, withAO(ropeMat, { direct: 0.4 })); o.position.set(-3.3, 0, 3.4); o.rotation.y = 0.5; o.scale.setScalar(1.0); o.frustumCulled = false; root.add(o) }
      else {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i <= 180; i++) { const a = i * 0.16, rad = 0.9 - i * 0.0012; pts.push(new THREE.Vector3(-3.3 + Math.cos(a) * rad, 0.07 + Math.min(2, Math.floor(i / 40)) * 0.11, 3.4 + Math.sin(a) * rad)) }
        const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 360, 0.07, 8), ropeMat); root.add(o)
      }
    },
    update(t, _dt, r) {
      const rm = kit.reduced()
      if (terrain) {
        kit.camera.getWorldPosition(camLocal); root.worldToLocal(camLocal)
        sky.position.copy(camLocal)                                                      // a sky does not parallax
        terrain.update(t, camLocal, rm)
        terrain.mesh.visible = true
      }
      ;(warm.material as THREE.MeshBasicMaterial).opacity = 0.42 * r * (rm ? 1 : 0.92 + 0.08 * Math.sin(t * 0.9))
      ;(rim.material as THREE.MeshBasicMaterial).opacity = (mode === 'terrain' ? 0.12 : 0.2) * r
      chalk.set(r, rm ? 0 : 1)
      for (let i = 0; i < beams.length; i++) beams[i].set((0.16 + 0.03 * i) * (rm ? 1 : 0.86 + 0.14 * Math.sin(t * 0.32 + i * 2.1)))
      if (!rm) { const n = performance.now() / 1000; if (n > nextPuff) { puff.fire([0.4, 1.3, 0.5]); nextPuff = n + (nextPuff === 0 ? 7 : 8 + Math.random() * 5) } puff.update() }
    },
    info: () => ({ mode, why, terrain: terrain ? { ...terrain.info, visible: terrain.mesh.visible } : null, crag: crag?.source, tris: crag?.tris, ms: crag ? Math.round(crag.ms) : 0 }),
    dispose() { chalk?.dispose(); puff?.dispose(); terrain?.dispose(); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } }) },
  }
}
