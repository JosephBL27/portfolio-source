// The studio light shared by the product-photograph stages (qvr, chalkboard): Poly Haven "Studio Small 09" (CC0, 512 x 256 .hdr in public/media/hdri) turned
// into a PMREM once per renderer. A material that uses it sets userData.ownEnv = true so env.ts does not swap it for the scene's environment.
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const BASE = import.meta.env.BASE_URL
let studioP: Promise<THREE.Texture | null> | null = null
export function studioEnv(renderer: THREE.WebGLRenderer): Promise<THREE.Texture | null> {
  return (studioP ??= (async () => {
    try {
      const t = await new HDRLoader().loadAsync(`${BASE}media/hdri/studio_small_09-512.hdr`)
      t.mapping = THREE.EquirectangularReflectionMapping
      const prev = renderer.getRenderTarget()
      const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t)
      renderer.setRenderTarget(prev)
      t.dispose(); pm.dispose()
      return rt.texture
    } catch (e) { console.warn('[stages] studio HDRI unavailable', e); return null }
  })())
}
