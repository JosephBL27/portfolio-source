// Loader for the Blender-authored models (scripts/blender/*.py -> public/models/glb/*.glb, Draco compressed, one mesh per named part, a baked ambient-occlusion
// factor in COLOR_0). Lazy: the Draco decoder (public/draco, local) and the file are fetched only when a stop that owns a model is built, and a failed or
// missing file resolves to null so the caller keeps its procedural model.
//   loadGLB(name)     -> the glTF scene (named nodes) or null
//   withAO(material)  -> a clone of a PBR material that multiplies the baked AO into the INDIRECT light (environment + ambient), and a little into the direct
//                        light; the vertex colour is NOT the albedo. Keeps the donor's display-referred encode (tvset.displayReferred) and its maps.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// One Draco decoder for the session, created on the first GLB (it was a new DRACOLoader per call, disposed in finally). Its default config is the
// wasm decoder (decoderConfig = {} in three r186), so the old decoder-config call (type 'wasm') changed nothing: it only warned on every call and
// is removed in r194. The decoder is served from public/draco; the loader lives as long as the page does.
let draco: DRACOLoader | null = null
const decoder = (): DRACOLoader => draco ??= new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`)

export async function loadGLB(name: string): Promise<THREE.Group | null> {
  if (new URLSearchParams(location.search).has('noglb')) return null     // measurement switch: the procedural models only (the "before")
  try {
    const gltf = await new GLTFLoader().setDRACOLoader(decoder()).loadAsync(`${import.meta.env.BASE_URL}models/glb/${name}.glb`)
    return gltf.scene
  } catch (e) {
    console.warn(`[glb] ${name}.glb unavailable, using the procedural model`, e)
    return null
  }
}

export interface AOOpts {
  /** how much of the AO darkens the direct light too (contact shading; real AO would only touch the indirect) */
  direct?: number
  /** how much of the AO darkens indirect specular (the environment reflection in a crevice) */
  spec?: number
}
export function withAO<T extends THREE.MeshStandardMaterial>(base: T, o: AOOpts = {}): T {
  const direct = (o.direct ?? 0.45).toFixed(3), spec = (o.spec ?? 0.95).toFixed(3)
  const m = base.clone() as T
  m.vertexColors = true
  const donor = base.onBeforeCompile
  m.onBeforeCompile = function (shader, renderer) {
    donor?.call(m, shader, renderer)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <aomap_fragment>', `
        float gAO = vColor.r;
        reflectedLight.indirectDiffuse *= gAO;
        reflectedLight.indirectSpecular *= mix(1.0, gAO * gAO, ${spec});
        reflectedLight.directDiffuse *= mix(1.0, gAO, ${direct});
        reflectedLight.directSpecular *= mix(1.0, gAO, ${direct});`)
  }
  const key = base.customProgramCacheKey?.call(base) ?? ''
  m.customProgramCacheKey = () => `${key}|glbao|${direct}|${spec}`
  m.needsUpdate = true
  return m
}

/** every Mesh under root, by node name */
export function meshesByName(root: THREE.Object3D): Map<string, THREE.Mesh> {
  const out = new Map<string, THREE.Mesh>()
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) out.set(o.name, o as THREE.Mesh) })
  return out
}
