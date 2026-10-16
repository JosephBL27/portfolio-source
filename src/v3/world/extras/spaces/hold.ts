// SPACE "hold": a real bouldering forest. The backdrop is a photograph, not geometry: Poly Haven's "Forest Slope" HDRI (CC0, Andreas Mischok: sandstone towers in a fir
// forest, the kind of place people boulder), cropped to the sector the camera can see, tonemapped offline to display values (scripts/hdri-prep.mjs; the site writes
// material output straight to the canvas, so a backdrop must already be display-referred) and ground-projected: the photograph's own forest floor becomes the floor the
// boulder stands on (the vertex shader flattens everything below the horizon onto a plane the camera's height beneath it, the technique of three's GroundedSkybox).
// The whole sphere surrounds it (a 2048 x 1024 copy outside the sharp crop, feathered), so the 360 look (pov.ts) always finds forest. A 1k copy goes through PMREM and
// lights the boulder and the climber (cabinet/boulder.ts, the stage that stands in this space); the shared key comes from the photograph's sun (HDRI yaw 41, elevation 40).
// W23: the floor in front of the camera is a baked field (spaces/hold-field.ts, scripts/blender/hold_field.py): a Geometry Nodes terrain that shows the SAME photograph
// projected from the eye, multiplied by the shadows its inserts cast in a Cycles bake (scanned mossy rocks and ferns from Poly Haven, the hero boulder, two crash pads),
// with a trampled landing zone of real forest soil in front of the problem. ?dusk=1 shows the previous scene (Kiara 9 Dusk + the sandstone crag ring, spaces/hold-ring.ts).
// The dome is darkened toward the zenith and on the copy side so the title lane stays legible; hue is untouched (a multiply, never a tint).
// Fallback: any failure (missing file, no WebGL texture) keeps the oldest scene, spaces/hold-legacy.ts, with one console warning; a missing field keeps the photograph.
import * as THREE from 'three'
import { createHoldSpace as createLegacy } from './hold-legacy'
import { burst, type Burst } from './games-fx'
import { motes, type LightCfg, type Motes, type Space, type SpaceKit } from './common'
import { loadRing, type Ring } from './hold-ring'
import { loadField, type Field } from './hold-field'

const BASE = import.meta.env.BASE_URL
const D2R = Math.PI / 180
const R = 112

/** one photograph: the crop (yaw / elevation in degrees, scripts/hdri-prep.mjs), the yaw shown straight ahead, the exposure and the darkening of the dome */
interface Sky { name: string; yaw0: number; yaw1: number; el0: number; el1: number; yawc: number; exp: number; zenith: number; copy: number; floor: number }
const SKIES: Record<'forest' | 'dusk', Sky> = {
  // the sandstone tower stands left of the boulder, the fir trunks run off to the right; the sun (yaw 41) is 101 degrees right of the view axis: it lights the climbing face
  forest: { name: 'forest_slope', yaw0: -130, yaw1: 10, el0: -45, el1: 50, yawc: -60, exp: 0.66, zenith: 0.3, copy: 0.46, floor: 0.72 },
  dusk: { name: 'kiara_9_dusk', yaw0: -22, yaw1: 118, el0: -45, el1: 50, yawc: 48, exp: 0.5, zenith: 0.14, copy: 0.38, floor: 0.5 },
}
export const holdSky = (): Sky => (new URLSearchParams(location.search).has('dusk') ? SKIES.dusk : SKIES.forest)

/** GLSL: holdPhoto(dir) = the photograph in direction dir (space-local, display values, exposure applied); holdShade(dir) = the dome's darkening there.
 *  Needs uniforms uMap (crop), uSky (sphere), uExp. Shared by the dome and by the field's floor, so the two are the same picture. */
export function photoGLSL(s: Sky): string {
  const AZ0 = (s.yaw0 - s.yawc) * D2R, AZ1 = (s.yaw1 - s.yawc) * D2R, E0 = s.el0 * D2R, E1 = s.el1 * D2R, FE = 9 * D2R
  return /* glsl */ `
uniform sampler2D uMap, uSky; uniform float uExp;
const float H_AZ0 = ${AZ0.toFixed(5)}, H_AZ1 = ${AZ1.toFixed(5)}, H_E0 = ${E0.toFixed(5)}, H_E1 = ${E1.toFixed(5)}, H_FE = ${FE.toFixed(5)}, H_YC = ${(s.yawc * D2R).toFixed(5)};
vec3 holdPhoto(vec3 d) {
  float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z);                         // az 0 = straight ahead (-z), + to the right
  vec3 crop = texture2D(uMap, vec2((az - H_AZ0) / (H_AZ1 - H_AZ0), (el - H_E0) / (H_E1 - H_E0))).rgb;
  vec3 sky = texture2D(uSky, vec2((az + H_YC) / 6.2831853 + 0.5, el / 3.14159265 + 0.5)).rgb;
  float w = smoothstep(0.0, H_FE, az - H_AZ0) * smoothstep(0.0, H_FE, H_AZ1 - az) * smoothstep(0.0, H_FE, el - H_E0) * smoothstep(0.0, H_FE, H_E1 - el);
  return mix(sky, crop, w) * uExp;
}
float holdShade(vec3 d) {
  float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z);
  float up = smoothstep(0.0, 0.42, el);                                                  // deep toward the zenith, hue kept
  float copy = smoothstep(0.12, 0.95, az) * (1.0 - smoothstep(1.5, 2.5, az));               // the title lane is on the right (the way round behind the camera stays open)
  float k = mix(1.0, ${s.zenith.toFixed(3)}, up) * mix(1.0, ${s.copy.toFixed(3)}, copy);
  return k * mix(1.0, ${s.floor.toFixed(3)}, smoothstep(0.0, -0.5, el));                  // the floor falls away into the dark in front of the camera
}`
}

const VERT = /* glsl */ `
attribute vec3 dir; varying vec3 vDir; uniform float uH;
void main() {
  vDir = dir;
  float dist = dir.y < 0.0 ? min(uH / -dir.y, ${R.toFixed(1)}) : ${R.toFixed(1)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * dist, 1.0);
}`
const frag = (s: Sky) => /* glsl */ `
precision highp float; varying vec3 vDir; uniform float uPres;
${photoGLSL(s)}
void main() { gl_FragColor = vec4(holdPhoto(vDir) * holdShade(vDir) * uPres, 1.0); }`

function domeGeo(): THREE.BufferGeometry {
  const NX = 192, NY = 96, pos: number[] = [], dir: number[] = [], idx: number[] = []
  for (let j = 0; j <= NY; j++) {
    const el = -Math.PI / 2 + (Math.PI * j) / NY
    for (let i = 0; i <= NX; i++) {
      const az = -Math.PI + (2 * Math.PI * i) / NX
      dir.push(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); pos.push(0, 0, 0)
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('dir', new THREE.Float32BufferAttribute(dir, 3)); g.setIndex(idx)
  return g
}

function blackTex(): THREE.Texture { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t }
function loadTex(url: string): Promise<THREE.Texture> {
  return new Promise((ok, no) => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.NoColorSpace; ok(t) }, undefined, () => no(new Error('missing ' + url))))
}

/** the PMREM of the tonemapped 1k sphere: ready for MeshStandardMaterial.envMap (shared with cabinet/boulder.ts through window.__holdEnv) */
export async function holdEnv(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const w = window as unknown as { __holdEnv?: Promise<THREE.Texture> }
  return (w.__holdEnv ??= (async () => {
    const t = await loadTex(`${BASE}media/hdri/${holdSky().name}-env.webp`)
    t.mapping = THREE.EquirectangularReflectionMapping
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t)
    t.dispose(); pm.dispose()
    return rt.texture
  })())
}

export function createHoldSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-hold'
  const sky = holdSky(), forest = sky === SKIES.forest
  // forest: the key is the photograph's sun (site axes: 101 degrees right of ahead, 40 up, a little toward the camera), warm white; the rim is the bright canopy gap behind
  const light: LightCfg = forest ? {
    keyPos: [11.3, 9.6, 2.2], keyAim: [0.0, 1.5, 0.6], keyCol: [1.0, 0.9, 0.76], keyI: 175, keyAngle: 0.62, keyPen: 0.7, keyDist: 40,
    rimPos: [-4.2, 4.4, -6.0], rimCol: [0.86, 0.94, 1.0], rimI: 55, rimDist: 16,
    fillSky: [0.42, 0.5, 0.42], fillGround: [0.16, 0.12, 0.08], fillI: 0.9,
  } : {
    keyPos: [-8.4, 5.2, 6.4], keyAim: [0.2, 1.8, -0.8], keyCol: [1.0, 0.7, 0.4], keyI: 150, keyAngle: 0.6, keyPen: 0.75, keyDist: 38,
    rimPos: [5.2, 3.6, -4.6], rimCol: [1.0, 0.62, 0.34], rimI: 90, rimDist: 16,
    fillSky: [0.34, 0.4, 0.62], fillGround: [0.09, 0.075, 0.07], fillI: 0.9,
  }
  let legacy: Space | null = null, dome: THREE.Mesh | null = null, mat: THREE.ShaderMaterial, chalk: Motes, puff: Burst, kit: SpaceKit, nextPuff = 0, ring: Ring | null = null, ringErr = ''
  let field: Field | null = null, fieldErr = ''
  const camLocal = new THREE.Vector3()
  return {
    id: 'hold', root, light,
    async build(k) {
      kit = k
      try {
        const q = new URLSearchParams(location.search)
        if (q.has('nohdri')) throw new Error('?nohdri=1')
        const map = await loadTex(`${BASE}media/hdri/${sky.name}-backdrop.webp`)
        map.colorSpace = THREE.NoColorSpace; map.anisotropy = 8; map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter
        const sph = q.has('noring') ? blackTex() : await loadTex(`${BASE}media/hdri/${sky.name}-sphere.webp`)       // ?noring: no sphere either, black outside the crop
        { sph.wrapS = THREE.RepeatWrapping; sph.generateMipmaps = false; sph.minFilter = THREE.LinearFilter }
        const uni = { uMap: { value: map }, uSky: { value: sph }, uPres: k.fog.pres, uExp: { value: sky.exp }, uH: { value: 6 } }
        mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag(sky), depthWrite: false, side: THREE.DoubleSide, uniforms: uni })
        dome = new THREE.Mesh(domeGeo(), mat); dome.frustumCulled = false; dome.renderOrder = -9; dome.name = 'hdri-dome'
        root.add(dome)
        k.fog.col.value.setRGB(0.05, 0.055, 0.085); k.fog.range.value.set(40, 120)
        chalk = motes(k, { n: 160, at: [0, 0.2, 0.2], half: [4.8, 3.6], h: 5.6, col: [1.0, 0.9, 0.7], size: 2.4, speed: 0.1, sway: 0.5, seed: 5, alpha: forest ? 0.45 : 0.7 })
        puff = burst(k, { n: 46, speed: 0.9, up: 1.5, g: -0.3, life: 3.4, size: 7, grow: 0.9, col: [1.0, 0.92, 0.78], alpha: 0.3, seed: 13 })
        root.add(chalk.points, puff.points)
        await holdEnv(k.renderer)
        if (forest) {
          // the baked field: optional, never blocks the stop (a missing file leaves the photograph + boulder, one console warning)
          if (!q.has('nofield')) {
            try { field = await loadField(k, { map, sky: sph, exp: uni.uExp, glsl: photoGLSL(sky) }); root.add(field.group) } catch (e) {
              fieldErr = String((e as Error)?.message ?? e); field = null
              console.warn('[spaces] hold: the forest field is unavailable, keeping the photograph and the boulder', fieldErr)
            }
          }
        } else if (!q.has('noring')) {
          // the dusk scene's ring of photoscans: optional, never blocks the stop
          try { ring = await loadRing(k.fog); root.add(ring.group) } catch (e) {
            ringErr = String((e as Error)?.message ?? e); ring = null
            console.warn('[spaces] hold: the crag ring is unavailable, keeping the sky and the boulder', ringErr)
          }
        }
      } catch (e) {
        console.warn('[spaces] hold: the Poly Haven backdrop is unavailable, using the previous scene', String((e as Error)?.message ?? e))
        dome?.removeFromParent(); dome = null
        legacy = createLegacy(); await legacy.build(k); root.add(legacy.root); Object.assign(light, legacy.light)
      }
    },
    update(t, dt, r, dwell) {
      if (legacy) { legacy.update(t, dt, r, dwell); return }
      const rm = kit.reduced()
      kit.camera.getWorldPosition(camLocal); root.worldToLocal(camLocal)
      dome!.position.set(camLocal.x, camLocal.y, camLocal.z); mat.uniforms.uH.value = Math.max(1.5, camLocal.y)       // the sky and its ground ride with the camera (no parallax), the ground plane stays at y = 0
      field?.update(camLocal)
      chalk.set(r, rm ? 0 : 1)
      if (!rm) { const n = performance.now() / 1000; if (n > nextPuff) { puff.fire([0.4, 1.0, 1.4]); nextPuff = n + (nextPuff === 0 ? 7 : 8 + Math.random() * 5) } puff.update() }
    },
    info: () => (legacy ? { mode: 'legacy', ...legacy.info?.() } : {
      mode: field ? 'field' : ring ? 'ring' : 'hdri', source: 'polyhaven ' + sky.name,
      ...(field?.info() ?? (forest ? { field: false, fieldErr } : {})), ...(ring?.info() ?? (forest ? {} : { ring: false, ringErr })),
    }),
    dispose() { legacy?.dispose(); chalk?.dispose(); puff?.dispose(); ring?.dispose(); field?.dispose(); dome?.geometry.dispose(); mat?.uniforms.uMap.value.dispose(); mat?.uniforms.uSky.value.dispose(); mat?.dispose() },
  }
}
