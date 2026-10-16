// Contact shadows (w12 render). Tag any root with `root.userData.contactShadow = { size, opacity?, y?, height? }` and it gets a soft shadow on the ground
// under it: the three.js 'webgl_shadow_contact' technique. An orthographic camera sits at the ground looking UP through the object, a depth-only
// override draws its meshes as black with alpha = (1 - depth) so what touches the ground is darkest, the 256 px target is blurred (a horizontal
// then a vertical pass), and the result is the texture of a ground quad at `y`.
//   size     world width of the shadow square (the camera covers size x size)
//   opacity  0..1 darkness at contact (default 0.5)
//   y        world y of the ground (default: the lowest point of the root's bounding box)
//   height   how far above the ground the shadow camera sees (default 0.6 * size)
// At most 2 are active at once (the nearest to the camera, inside the view), each re-rendered every 2nd frame. Nothing here touches the particle
// field or the post stack, and nothing runs when no object is tagged.
//   ?contact=0     off
//   ?contact=test  adds a debug box + sphere on a grey plate at the current stop (so the technique can be seen and measured)
//   window.__v3.contact = { active(): string[], slots, test: Object3D | null, gpuMs, enabled }
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { GpuTimer } from '../../engine/post'

export interface ContactShadow { size: number; opacity?: number; y?: number; height?: number }

const RES = 256, MAX_ACTIVE = 2, LAYER = 29, RANGE = 70
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('contact') : null

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse; uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tDiffuse, vUv) * 0.2270270270;
  s += (texture2D(tDiffuse, vUv + uDir * 1.3846153846) + texture2D(tDiffuse, vUv - uDir * 1.3846153846)) * 0.3162162162;
  s += (texture2D(tDiffuse, vUv + uDir * 3.2307692308) + texture2D(tDiffuse, vUv - uDir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = s;
}`
const BLUR_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

interface Slot {
  rt: THREE.WebGLRenderTarget; rt2: THREE.WebGLRenderTarget
  plane: THREE.Mesh; mat: THREE.MeshBasicMaterial; cam: THREE.OrthographicCamera
  target: THREE.Object3D | null; meshes: THREE.Mesh[]; k: number; boxAt: number; ground: number; size: number; opacity: number; height: number; label: string
}

export function install(ctx: ExtraCtx): Extra | void {
  if (q === '0' || q === 'off' || !ctx.field?.renderer || !ctx.field?.scene) return
  const renderer: THREE.WebGLRenderer = ctx.field.renderer, scene: THREE.Scene = ctx.field.scene, camera: THREE.Camera = ctx.field.camera
  const mkRT = () => new THREE.WebGLRenderTarget(RES, RES, { type: THREE.UnsignedByteType, depthBuffer: true, generateMipmaps: false })
  const depthMat = new THREE.MeshDepthMaterial()
  depthMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDark = uDark
    sh.fragmentShader = 'uniform float uDark;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * uDark );')
  }
  const uDark = { value: 1 }
  const blurMat = new THREE.ShaderMaterial({ vertexShader: BLUR_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } } })
  const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat); blurQuad.frustumCulled = false
  const blurScene = new THREE.Scene(); blurScene.add(blurQuad)
  const blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const gpu = new GpuTimer(renderer)
  let prof = new URLSearchParams(location.search).get('prof') === '1'

  const slots: Slot[] = []
  for (let i = 0; i < MAX_ACTIVE; i++) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide, color: 0x000000 })
    const rt = mkRT(), rt2 = mkRT()
    mat.map = rt.texture
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    plane.rotation.x = -Math.PI / 2; plane.renderOrder = -5; plane.visible = false; plane.frustumCulled = false; plane.name = `contact-shadow-${i}`
    plane.userData.noContact = true
    const holder = new THREE.Group(); holder.add(plane); holder.name = `contact-holder-${i}`; holder.userData.noContact = true
    scene.add(holder)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    cam.layers.set(LAYER)
    slots.push({ rt, rt2, plane, mat, cam, target: null, meshes: [], k: 0, boxAt: -1e9, ground: 0, size: 1, opacity: 0.5, height: 1, label: '' })
  }
  const holderOf = (s: Slot) => s.plane.parent as THREE.Group

  // ---- the optional debug object (?contact=test): a box and a sphere hovering above a grey plate, placed at the current stop's look target
  let test: THREE.Group | null = null
  if (q === 'test') {
    test = new THREE.Group(); test.name = 'contact-test'
    const plate = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshBasicMaterial({ color: 0x4a443c })); plate.rotation.x = -Math.PI / 2; plate.position.y = -0.01; plate.userData.noContact = true
    const body = new THREE.Group(); body.name = 'contact-test-body'
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.4, metalness: 0.2 })); box.position.set(-0.6, 0.3, 0)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), new THREE.MeshStandardMaterial({ color: 0xb9484a, roughness: 0.3 })); ball.position.set(0.75, 0.95, 0.35)
    body.add(box, ball); body.userData.contactShadow = { size: 3.4, opacity: 0.7, height: 2.2 } satisfies ContactShadow
    test.add(plate, body)
    ctx.field.addObject(test)
  }

  const cc = new THREE.Color()
  const box = new THREE.Box3(), tmpC = new THREE.Vector3(), fr = new THREE.Frustum(), pm = new THREE.Matrix4()
  type Cand = { o: THREE.Object3D; d: number }
  let cands: Cand[] = []
  const gatherCandidates = () => {
    camera.updateMatrixWorld()
    pm.multiplyMatrices((camera as THREE.PerspectiveCamera).projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm)
    const out: Cand[] = []
    const walk = (o: THREE.Object3D) => {
      if (!o.visible || o.userData.noContact) return
      const cs = o.userData.contactShadow as ContactShadow | undefined
      if (cs && cs.size > 0) {
        box.setFromObject(o)
        if (!box.isEmpty() && fr.intersectsBox(box)) { box.getCenter(tmpC); const d = tmpC.distanceTo(camera.position); if (d < RANGE) out.push({ o, d }) }
      }
      for (const c of o.children) walk(c)
    }
    walk(scene)
    out.sort((a, b) => a.d - b.d)
    cands = out.slice(0, MAX_ACTIVE)
  }
  const mb = new THREE.Box3()
  /** the meshes that can throw this shadow: visible, solid enough, inside the shadow volume (x, z within the square, y within the camera's height) and not tiny */
  const meshesOf = (root: THREE.Object3D, cx: number, cz: number, half: number, y0: number, y1: number) => {
    const out: THREE.Mesh[] = []
    root.updateMatrixWorld(true)
    root.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.visible || o.userData.noContact) return
      for (let p: THREE.Object3D | null = o.parent; p && p !== root; p = p.parent) if (!p.visible) return
      const mt = m.material as THREE.Material
      if (!mt || Array.isArray(mt) || mt.visible === false || (mt.transparent && (mt.opacity < 0.35 || mt.depthWrite === false))) return
      mb.setFromObject(m)
      if (mb.isEmpty() || mb.max.y < y0 || mb.min.y > y1 || mb.max.x < cx - half || mb.min.x > cx + half || mb.max.z < cz - half || mb.min.z > cz + half) return
      if (Math.max(mb.max.x - mb.min.x, mb.max.y - mb.min.y, mb.max.z - mb.min.z) < half * 0.03) return
      out.push(m)
    })
    return out
  }

  const assign = () => {
    const taken = new Set<THREE.Object3D>()
    // keep slots whose target is still a candidate; free the rest; then give free slots the remaining candidates (nearest first)
    for (const s of slots) { if (s.target && cands.some(c => c.o === s.target)) taken.add(s.target); else if (s.target) { s.target = null } }
    for (const c of cands) {
      if (taken.has(c.o)) continue
      const s = slots.find(x => !x.target); if (!s) break
      s.target = c.o; s.k = 0; s.boxAt = -1e9; taken.add(c.o); s.label = c.o.name || c.o.parent?.name || c.o.type
    }
  }

  const setCam = (s: Slot) => {
    const o = s.target!, cs = o.userData.contactShadow as ContactShadow
    box.setFromObject(o); box.getCenter(tmpC)
    s.size = cs.size; s.opacity = cs.opacity ?? 0.5; s.height = cs.height ?? cs.size * 0.6
    s.ground = cs.y ?? box.min.y
    const c = s.cam, h = s.size / 2
    c.left = -h; c.right = h; c.top = h; c.bottom = -h; c.near = 0; c.far = s.height; c.updateProjectionMatrix()
    c.position.set(tmpC.x, s.ground, tmpC.z); c.rotation.set(Math.PI / 2, 0, 0); c.updateMatrixWorld(true)
    const holder = holderOf(s); holder.position.set(tmpC.x, s.ground + 0.004, tmpC.z); holder.updateMatrixWorld(true)
    s.plane.scale.set(s.size, -s.size, 1)
    s.meshes = meshesOf(o, tmpC.x, tmpC.z, h, s.ground, s.ground + s.height); s.boxAt = performance.now()
  }

  const blurPass = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
    blurMat.uniforms.tDiffuse.value = src.texture; blurMat.uniforms.uDir.value.set(dx / RES, dy / RES)
    renderer.setRenderTarget(dst); renderer.render(blurScene, blurCam)
  }

  // top-level scene children are hidden for the depth draw (except the one holding the target): three.js walks every node of a scene it renders
  // and refreshes every matrix, which would cost more than the shadow itself. Matrices are the ones this frame's updates already made.
  const hid: THREE.Object3D[] = []
  const topOf = (o: THREE.Object3D) => { let t = o; while (t.parent && t.parent !== scene) t = t.parent; return t }
  const renderShadow = (s: Slot) => {
    if (prof) gpu.begin('contact')
    const prevRT = renderer.getRenderTarget(), prevBg = scene.background, prevOv = scene.overrideMaterial, prevAC = renderer.autoClear, prevMW = scene.matrixWorldAutoUpdate
    renderer.getClearColor(cc); const prevA = renderer.getClearAlpha()
    const keep = topOf(s.target!)
    for (const c of scene.children) if (c !== keep && c.visible) { c.visible = false; hid.push(c) }
    for (const m of s.meshes) m.layers.enable(LAYER)
    uDark.value = Math.min(1, s.opacity * 1.6)
    scene.background = null; scene.overrideMaterial = depthMat; scene.matrixWorldAutoUpdate = false; renderer.autoClear = true; renderer.setClearColor(0x000000, 0)
    try { renderer.setRenderTarget(s.rt); renderer.render(scene, s.cam) } finally {
      scene.overrideMaterial = prevOv; scene.background = prevBg; scene.matrixWorldAutoUpdate = prevMW
      for (const m of s.meshes) m.layers.disable(LAYER)
      for (const c of hid) c.visible = true
      hid.length = 0
    }
    blurPass(s.rt, s.rt2, 1.8, 0); blurPass(s.rt2, s.rt, 0, 1.8)
    renderer.setClearColor(cc, prevA); renderer.autoClear = prevAC; renderer.setRenderTarget(prevRT)
    if (prof) gpu.end()
  }

  let frame = 0, lastGather = -1e9
  const api = {
    enabled: true, slots, test, gpuMs: gpu.ms, supported: gpu.supported,
    active: () => slots.filter(s => s.target && s.plane.visible).map(s => s.label),
    profile(on: boolean) { prof = on },
    /** measurement: render slot i's shadow n times back to back and wait for the GPU; returns ms per render (slot must be assigned) */
    bench(n = 20, i = 0) {
      const s = slots[i]; if (!s?.target) return -1
      setCam(s); const gl = renderer.getContext() as WebGL2RenderingContext, px = new Uint8Array(4)
      const rr = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      renderShadow(s); rr()
      const t0 = performance.now(); for (let k = 0; k < n; k++) renderShadow(s); rr()
      return (performance.now() - t0) / n
    },
  }
  const publish = () => { const v = (window as unknown as { __v3?: Record<string, unknown> }).__v3; if (v) v.contact = api; else requestAnimationFrame(publish) }
  publish()

  return {
    update(_t, dt, st) {
      if (test) {
        // follow the stop: stand just in front of where the camera looks, on a plane a little under it
        const tg = st.cam.target, cp = st.cam.pos
        const dx = cp[0] - tg[0], dz = cp[2] - tg[2], dl = Math.hypot(dx, dz) || 1
        test.position.set(tg[0] + (dx / dl) * 0.5, tg[1] - 0.9, tg[2] + (dz / dl) * 0.5)
      }
      if (!api.enabled) { for (const s of slots) { s.plane.visible = false; s.target = null } return }
      const now = performance.now()
      if (now - lastGather > 300) { lastGather = now; gatherCandidates(); assign() }
      frame++
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        if (!s.target || !s.target.visible) { s.k = Math.max(0, s.k - dt * 4); s.mat.opacity = s.k; if (s.k <= 0) { s.plane.visible = false; s.target = null } continue }
        if (now - s.boxAt > 400) setCam(s)
        s.k = Math.min(1, s.k + dt * 3)
        s.mat.opacity = s.k
        s.plane.visible = true
        if ((frame + i) % 2 === 0) renderShadow(s)
      }
      if (prof) gpu.poll()
    },
  }
}
