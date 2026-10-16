// SET PIECE 2: into the screen.  leg name > world.
// The camera dives at the hub TV: the name particles rush past, the real bezel and curved glass sweep by, and the TV's picture turns into a live
// view of the destination (the establishing shot, rendered into a half-resolution render target from the destination camera, with scanlines, an RGB
// mask, chromatic fringing and a rolling tear). As the glass fills the frame the picture is mapped to the screen instead of to the surface, so the
// face IS the view; at the crossing the camera takes the destination pose and the CRT look drains off the same picture, now the real world, over
// about a fifth of the leg. A pure function of leg progress (the render target is just a second camera on the same frame). Scroll back and the
// camera climbs out of the screen backwards.
import * as THREE from 'three'
import { type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, easeOut, keys, lerp, precompile, sstep } from './common'
import { LANE_ON } from '../lib/lane'

const SWAP = 0.5

const FACE_V = /* glsl */ `
varying vec2 vSurf;
void main() { vSurf = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FULL_V = /* glsl */ `
varying vec2 vSurf;
void main() { vSurf = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tRT; uniform vec2 uRes; uniform float uTime, uA, uMix, uScan, uGlitch, uBoost, uAdd;
varying vec2 vSurf;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 sc = gl_FragCoord.xy / uRes;
  vec2 q = mix(vSurf, sc, uMix);
  // a rolling tear: a band that slides down and shoves the picture sideways
  float bandY = fract(uTime * 0.37 + 0.2), by = abs(sc.y - bandY);
  float tear = smoothstep(0.06, 0.0, by) * (h12(vec2(floor(sc.y * 90.0), floor(uTime * 12.0))) - 0.5) * (0.02 + 0.08 * uGlitch);
  q.x += tear + uGlitch * (h12(vec2(floor(sc.y * 40.0), floor(uTime * 20.0))) - 0.5) * 0.03;
  vec2 d = q - 0.5;
  float ca = (0.0015 + 0.007 * uGlitch) * (0.35 + 2.0 * length(d));
  vec3 col;
  col.r = texture2D(tRT, q + vec2(ca, 0.0)).r; col.g = texture2D(tRT, q).g; col.b = texture2D(tRT, q - vec2(ca, 0.0)).b;
  col = 1.0 - exp(-col * 2.1);                                  // the render target is raw HDR: soft-clip it like the post stack does
  float scan = 1.0 - uScan * 0.38 * pow(0.5 + 0.5 * sin(gl_FragCoord.y * 2.0944), 1.4);
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = mix(vec3(1.0), vec3(m < 1.0 ? 1.0 : 0.8, m >= 1.0 && m < 2.0 ? 1.0 : 0.8, m >= 2.0 ? 1.0 : 0.8), uScan * 0.7);
  float rr = length(vSurf - 0.5) * 2.0;
  float vig = 1.0 - (1.0 - uMix) * smoothstep(0.65, 1.05, rr) * 0.9;
  float n = h12(gl_FragCoord.xy + floor(uTime * 30.0) * 17.0) - 0.5;
  col = col * scan * mask * vig + n * 0.06 * (uScan + uGlitch) + vec3(0.7, 0.85, 1.0) * uBoost;
  col += vec3(0.15, 0.4, 0.5) * uScan * 0.06;
  gl_FragColor = vec4(col * mix(uAdd, 1.0, uA), uA);   // premultiplied: uA = 0 adds the picture over the screen's own, uA = 1 replaces it
}`

export function createPortal(leg: Leg): Piece {
  let built = false, ok = false
  let hubScreen: THREE.Mesh | null = null
  let face: THREE.Mesh | null = null, full: THREE.Mesh | null = null
  const grp = new THREE.Group(); grp.name = 'tr-portal'; grp.userData.noReflect = true
  let rt: THREE.WebGLRenderTarget | null = null
  const rtCam = new THREE.PerspectiveCamera(35, 1.6, 0.1, 400)
  const U = { tRT: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1440, 900) }, uTime: { value: 0 }, uA: { value: 0 }, uMix: { value: 0 }, uScan: { value: 1 }, uGlitch: { value: 0 }, uBoost: { value: 0 }, uAdd: { value: 0.55 } }
  const UF = { ...U, uA: { value: 0 }, uAdd: { value: 0 } }
  const P = new THREE.Vector3(), Nrm = new THREE.Vector3(), q = new THREE.Quaternion(), tmp = new THREE.Vector3()
  let hidden: THREE.Object3D[] = []

  const post = (env: Env, u: number): CamPose => {
    const M = env.flightCam(1)
    const dx = M.pos[0] - M.target[0], dy = M.pos[1] - M.target[1], dz = M.pos[2] - M.target[2], l = Math.hypot(dx, dy, dz) || 1
    const back = 15 * (1 - easeOut((u - SWAP) / (1 - SWAP)))
    return { pos: [M.pos[0] - (dx / l) * back, M.pos[1] - (dy / l) * back, M.pos[2] - (dz / l) * back], target: [...M.target], fov: M.fov }
  }
  const sizeRT = (env: Env) => {
    const w = Math.max(64, Math.round(Math.min(env.res.x * 0.5, 1000))), h = Math.max(64, Math.round(env.res.y * (w / Math.max(1, env.res.x))))
    if (!rt) { rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 }); rt.texture.minFilter = THREE.LinearFilter; rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false; U.tRT.value = rt.texture }
    else if (rt.width !== w || rt.height !== h) rt.setSize(w, h)
  }

  const piece: Piece = {
    leg,
    cues: [{ at: 0.42, name: 'tr:portal' }],
    build(env) {
      if (built) return
      built = true
      const root = env.world?.root as THREE.Object3D | undefined
      root?.traverse(o => { if (!hubScreen && (o as THREE.Mesh).isMesh && o.userData.part === 'screen') hubScreen = o as THREE.Mesh })
      if (!hubScreen || !hubScreen.parent) return
      const mat = new THREE.ShaderMaterial({ vertexShader: FACE_V, fragmentShader: FRAG, uniforms: U as unknown as Record<string, THREE.IUniform>, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor })
      face = new THREE.Mesh(hubScreen.geometry, mat)
      face.position.copy(hubScreen.position); face.quaternion.copy(hubScreen.quaternion); face.scale.copy(hubScreen.scale)
      face.translateZ(0.004); face.renderOrder = 20; face.visible = false
      hubScreen.parent.add(face)
      const fm = new THREE.ShaderMaterial({ vertexShader: FULL_V, fragmentShader: FRAG, uniforms: UF as unknown as Record<string, THREE.IUniform>, transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor })
      full = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fm); full.frustumCulled = false; full.renderOrder = 100; full.visible = false
      grp.add(full); env.scene.add(grp)
      sizeRT(env)
      precompile(env, grp, face)
      ok = true
    },
    setVisible(v) { if (!v) { if (face) face.visible = false; if (full) full.visible = false } },
    frame(inp: FrameIn, out: FrameOut, env: Env) {
      if (!ok || !face || !full || !hubScreen) return
      const { u, t } = inp
      const pre = u < SWAP
      U.uTime.value = t; UF.uTime.value = t
      env.renderer.getDrawingBufferSize(env.res); U.uRes.value.copy(env.res); UF.uRes.value.copy(env.res)
      const glitch = Math.exp(-Math.pow((u - SWAP) / 0.045, 2)) * 0.9 + 0.35 * sstep(0.22, 0.36, u) * (1 - sstep(0.4, 0.5, u))
      const boost = Math.exp(-Math.pow((u - SWAP) / 0.02, 2)) * 0.32
      U.uGlitch.value = UF.uGlitch.value = glitch; U.uBoost.value = UF.uBoost.value = boost
      U.uMix.value = UF.uMix.value = pre ? sstep(0.26, 0.44, u) : 1
      U.uScan.value = UF.uScan.value = pre ? 1 : 1 - sstep(0.58, 0.78, u)
      U.uA.value = sstep(0.4, 0.48, u); U.uAdd.value = 0.7 * sstep(0.12, 0.34, u)
      UF.uA.value = pre ? 0 : 1 - sstep(0.6, 0.78, u)
      face.visible = pre && (U.uA.value > 0.002 || U.uAdd.value > 0.002)
      full.visible = !pre && UF.uA.value > 0.002
      // the destination, rendered live from where the camera will be just after the crossing
      if (u > 0.14 && u < 0.8) {
        sizeRT(env)
        const pose = post(env, Math.max(u, SWAP))
        rtCam.position.set(...pose.pos); rtCam.up.set(0, 1, 0); rtCam.lookAt(pose.target[0], pose.target[1], pose.target[2])
        rtCam.fov = pose.fov; rtCam.aspect = env.res.x / Math.max(1, env.res.y); rtCam.near = env.camera.near; rtCam.far = env.camera.far; rtCam.updateProjectionMatrix(); rtCam.updateMatrixWorld(true)
        const r = env.renderer, prevRT = r.getRenderTarget()
        hidden = []
        for (const o of [face, full, grp, env.scene.getObjectByName('atmos-mirror')]) if (o && o.visible) { o.visible = false; hidden.push(o) }
        for (const ch of env.scene.children) if (ch.userData.noReflect && ch.visible && !hidden.includes(ch)) { ch.visible = false; hidden.push(ch) }
        const pu = (env.field.points?.material as THREE.ShaderMaterial | undefined)?.uniforms
        const dpr0 = pu?.uDpr?.value as number | undefined
        if (pu?.uDpr && dpr0 != null) pu.uDpr.value = dpr0 * (rt!.width / Math.max(1, env.res.x))
        env.field.setFieldAlpha?.(1)
        const laneOn = LANE_ON.value; LANE_ON.value = 0
        try { r.setRenderTarget(rt); r.clear(); r.render(env.scene, rtCam) } finally {
          r.setRenderTarget(prevRT); LANE_ON.value = laneOn
          if (pu?.uDpr && dpr0 != null) pu.uDpr.value = dpr0
          for (const o of hidden) o.visible = true
          face.visible = pre && (U.uA.value > 0.002 || U.uAdd.value > 0.002); full.visible = !pre && UF.uA.value > 0.002
        }
      }
      out.field = u < SWAP ? 1 - 0.93 * sstep(0.3, 0.46, u) : 0.07 + 0.93 * sstep(0.54, 0.86, u)
      out.flash = 0
    },
    camera(u, _base, env) {
      if (!ok || !hubScreen) return null
      const S = env.flightCam(0)
      if (u >= SWAP) return post(env, u)
      hubScreen.updateWorldMatrix(true, false)
      hubScreen.matrixWorld.decompose(P, q, tmp)
      Nrm.set(0, 0, 1).applyQuaternion(q)
      const d0 = Math.hypot(S.pos[0] - P.x, S.pos[1] - P.y, S.pos[2] - P.z)
      const dist = keys([[0, d0], [0.1, d0 * 0.88], [0.25, d0 * 0.5], [0.38, 3.2], [0.46, 0.95], [SWAP, 0.32]])(u)
      const dS = new THREE.Vector3(S.pos[0] - P.x, S.pos[1] - P.y, S.pos[2] - P.z).normalize()
      const dir = dS.lerp(Nrm, sstep(0.22, 0.44, u)).normalize()
      const tk = sstep(0, 0.3, u)
      return { pos: [P.x + dir.x * dist, P.y + dir.y * dist, P.z + dir.z * dist], target: [lerp(S.target[0], P.x, tk), lerp(S.target[1], P.y, tk), lerp(S.target[2], P.z, tk)], fov: lerp(S.fov, 52, sstep(0.2, 0.5, u)) }
    },
    dispose() { grp.removeFromParent(); face?.removeFromParent(); rt?.dispose() },
  }
  return piece
}
