// The baked field of the "hold" space (w23): scripts/blender/hold_field.py -> public/models/glb/hold-field.glb (Draco + WebP) + public/media/crag/field-shadow.webp.
//   floor   a Geometry Nodes terrain (2 x 22 m, relief that dies away inside the landing zone). Its colour is the backdrop PHOTOGRAPH projected from the eye
//           (holdPhoto, the dome's own function: from the camera the floor and the dome are one picture, no seam), multiplied by the SHADOW RATIO the bake found
//           (floor lit with the inserts / floor lit bare: the rocks, ferns, hero boulder and crash pads darken the plate where they really would, nothing else changes).
//           In front of the problem a landing zone of real forest soil (Poly Haven "Forest Ground 04", tiled) replaces the moss, at the photograph's own brightness.
//   rocks   Poly Haven "Rock Moss Set 01" scans scattered by slope / distance / clumps, light baked into COLOR_0 (L = display(albedo x light) / albedo / GAIN)
//   ferns   Poly Haven "Fern 02" the same way, cut out by the map's alpha (hidden on phones)
// Everything is unlit at runtime (MeshBasicMaterial / one ShaderMaterial: no lights, no shadow map, no read-back); 3 draw calls, 119k triangles (54k on a phone, ferns off).
// Display-referred like the dome: maps are read raw (NoColorSpace), output goes to the canvas as is, darkened by the dome's holdShade at the same direction.
import * as THREE from 'three'
import { loadGLB } from '../../glbmodel'
import type { SpaceKit } from './common'

const BASE = import.meta.env.BASE_URL
const GAIN = 2.0                                  // hold_field.py GAIN
const TILE_M = 3.15                               // Forest Ground 04 is 315 cm across
const TILE_LUM = 0.6                              // display luminance of its mean colour
/** crash pads in the STAGE's frame: centre x, y, z, size x, y, z, yaw (hold_field.py PADS; cabinet/boulder.ts builds them from the same numbers) */
export const PADS: [number, number, number, number, number, number, number][] = [[-0.85, 0.06, 3.9, 1.5, 0.12, 1.2, 0.32], [0.62, 0.055, 4.75, 1.3, 0.11, 1.05, -0.26]]

export interface Field { group: THREE.Group; update(eye: THREE.Vector3): void; info(): Record<string, unknown>; dispose(): void }
export interface Photo { map: THREE.Texture; sky: THREE.Texture; exp: { value: number }; glsl: string }

function loadTex(url: string, repeat = false): Promise<THREE.Texture> {
  return new Promise((ok, no) => new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.NoColorSpace
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 }
    ok(t)
  }, undefined, () => no(new Error('missing ' + url))))
}

export async function loadField(k: SpaceKit, photo: Photo): Promise<Field> {
  const t0 = performance.now()
  const [gltf, shadow, tile] = await Promise.all([loadGLB('hold-field'), loadTex(`${BASE}media/crag/field-shadow.webp`), loadTex(`${BASE}media/crag/forest-ground-04.webp`, true)])
  if (!gltf) { shadow.dispose(); tile.dispose(); throw new Error('hold-field.glb unavailable') }
  shadow.flipY = false; shadow.needsUpdate = true          // read through the glTF's own uv (the exporter flips v), like a texture the GLTFLoader made
  const eye = { value: new THREE.Vector3(0, 3.3, 13) }
  // the landing zone, in the space's frame: an ellipse in front of the climbing face that takes in both pads
  const yaw = k.stageYaw, c = Math.cos(yaw), s = Math.sin(yaw)
  const lz = new THREE.Vector2(-0.2, 3.9), lzS = new THREE.Vector2(lz.x * c + lz.y * s, -lz.x * s + lz.y * c)
  const uni = {
    uMap: { value: photo.map }, uSky: { value: photo.sky }, uExp: photo.exp, uPres: k.fog.pres, uEye: eye,
    uShadow: { value: shadow }, uTile: { value: tile }, uLz: { value: lzS }, uLzR: { value: new THREE.Vector2(3.6, 2.5) }, uLzA: { value: -yaw - 0.15 },
  }
  const floorMat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec2 vUv;
      void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float; varying vec3 vP; varying vec2 vUv;
      uniform sampler2D uShadow, uTile; uniform vec3 uEye; uniform float uPres, uLzA; uniform vec2 uLz, uLzR;
      ${photo.glsl}
      void main() {
        vec3 d = normalize(vP - uEye);
        vec3 plate = holdPhoto(d);
        float sh = texture2D(uShadow, vUv).r;
        // the landing zone: trodden soil in front of the problem, its edge broken by the soil texture itself
        vec2 q = vP.xz - uLz; float ca = cos(uLzA), sa = sin(uLzA); q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y) / uLzR;
        vec3 ta = texture2D(uTile, vP.xz / ${TILE_M.toFixed(2)}).rgb, tb = texture2D(uTile, vP.zx / ${(TILE_M * 3.7).toFixed(2)} + 0.31).rgb;
        float tl = dot(ta, vec3(0.2126, 0.7152, 0.0722)), pl = dot(plate, vec3(0.2126, 0.7152, 0.0722));
        float m = 1.0 - smoothstep(0.62, 1.0, length(q) + (tl - ${TILE_LUM.toFixed(2)}) * 0.55 + (dot(tb, vec3(0.33)) - 0.5) * 0.3);
        vec3 soil = ta * mix(vec3(1.0), tb / vec3(${TILE_LUM.toFixed(2)}), 0.35) * clamp(pl / ${TILE_LUM.toFixed(2)}, 0.25, 1.1) * 0.92;
        vec3 col = mix(plate, soil, m * 0.88) * sh * holdShade(d);
        gl_FragColor = vec4(col * uPres, 1.0);
      }`,
  })
  const shared = { uExp: photo.exp, uPres: k.fog.pres, uEye: eye, uMap: { value: photo.map }, uSky: { value: photo.sky } }
  const insert = (map: THREE.Texture | null, cut: boolean, key: string) => {
    const m = new THREE.MeshBasicMaterial({ map, vertexColors: true, toneMapped: false, side: cut ? THREE.DoubleSide : THREE.FrontSide, alphaTest: cut ? 0.5 : 0, transparent: false })
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, shared)
      sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvP = position;')
      sh.fragmentShader = 'varying vec3 vP; uniform vec3 uEye; uniform float uPres;\n' + photo.glsl + '\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
        `gl_FragColor.rgb *= ${GAIN.toFixed(1)} * uExp * holdShade(normalize(vP - uEye)) * uPres;\n#include <dithering_fragment>`)
    }
    m.customProgramCacheKey = () => key
    return m
  }
  const group = new THREE.Group(); group.name = 'hold-field'
  const mats: THREE.Material[] = [floorMat], maps: THREE.Texture[] = [shadow, tile], geos: THREE.BufferGeometry[] = []
  let tris = 0, calls = 0
  const parts: Record<string, THREE.Mesh> = {}
  gltf.updateMatrixWorld(true)
  gltf.traverse(o => { if ((o as THREE.Mesh).isMesh) parts[o.name] = o as THREE.Mesh })
  for (const [name, src] of Object.entries(parts)) {
    const g = src.geometry.clone().applyMatrix4(src.matrixWorld); geos.push(g); src.geometry.dispose()
    const old = src.material as THREE.MeshStandardMaterial, map = old.map
    if (map) { map.colorSpace = THREE.NoColorSpace; map.anisotropy = 4; maps.push(map) }
    old.dispose()
    const isFloor = name.startsWith('terrain'), isFern = name.startsWith('fern')
    const mat = isFloor ? floorMat : insert(map, isFern, isFern ? 'field-fern-v1' : 'field-rock-v1')
    if (!isFloor) mats.push(mat)
    const mesh = new THREE.Mesh(g, mat); mesh.name = 'field-' + name; mesh.matrixAutoUpdate = false
    if (isFloor) mesh.renderOrder = -8
    if (isFern && k.phone) mesh.visible = false
    group.add(mesh)
    if (mesh.visible) { tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3; calls++ }
  }
  if (!parts.terrain) throw new Error('hold-field.glb has no terrain')
  return {
    group,
    update(e) { eye.value.copy(e) },
    info: () => ({ field: true, parts: Object.keys(parts), tris: Math.round(tris), calls, ms: Math.round(performance.now() - t0) }),
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of maps) t.dispose() },
  }
}
