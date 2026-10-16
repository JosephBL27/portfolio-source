// Form lab: /lab/formview.html?form=<id>[&to=<id2>&mix=0.5&n=262144&t=3]
// Renders forms through the SAME composed shader the site uses. Drag to orbit, buttons switch
// form (the morph plays). ?t= freezes time (for screenshots); ?mix= pins the morph.
import * as THREE from 'three'
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import { FORMS } from '../src/v3/forms'
import { makeCtx } from '../src/v3/forms/ctx'
import { composeVertex, FRAGMENT, particleAttributes } from '../src/v3/engine/compose'

const q = new URLSearchParams(location.search)
const N = +(q.get('n') ?? 262144), W = Math.sqrt(N) | 0
const list = Object.values(FORMS)
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: false })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight, false)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100)
const tex = new Map<string, { pos: THREE.DataTexture; col: THREE.DataTexture }>()
async function build(id: string) {
  if (tex.has(id)) return tex.get(id)!
  const f = FORMS[id]
  const pos = new Float32Array(N * 4), col = new Float32Array(N * 4)
  const t0 = performance.now()
  await f.build(makeCtx(id, N), pos, col)
  console.log(`[formview] built ${id} in ${(performance.now() - t0).toFixed(0)} ms`)
  const P = new THREE.DataTexture(pos, W, N / W, THREE.RGBAFormat, THREE.FloatType); P.needsUpdate = true
  const C = new THREE.DataTexture(col, W, N / W, THREE.RGBAFormat, THREE.FloatType); C.needsUpdate = true
  const v = { pos: P, col: C }; tex.set(id, v); return v
}
const { ref, rnd } = particleAttributes(N, W)
const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
geo.setAttribute('ref', new THREE.BufferAttribute(ref, 2)); geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4))
const uniforms: Record<string, THREE.IUniform> = {
  uPosA: { value: null }, uPosB: { value: null }, uColA: { value: null }, uColB: { value: null },
  uIdA: { value: 0 }, uIdB: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uTurb: { value: 1.2 },
  uDriftA: { value: 0.04 }, uDriftB: { value: 0.04 }, uSizeA: { value: 1 }, uSizeB: { value: 1 },
  uPointSize: { value: 2 }, uDpr: { value: renderer.getPixelRatio() }, uSpread: { value: 0.4 },
    uPlaceA: { value: new THREE.Vector4(0, 0, 0, 0) }, uPlaceB: { value: new THREE.Vector4(0, 0, 0, 0) }, uScaleA: { value: 1 }, uScaleB: { value: 1 },
  uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseR: { value: 0.6 }, uMouseK: { value: 0.0 },
  uFocus: { value: 9 }, uBokeh: { value: 0.15 },
}
for (const f of list) Object.assign(uniforms, f.uniforms ?? {})
const mat = new THREE.ShaderMaterial({ vertexShader: composeVertex(list), fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
let cur = q.get('form') ?? list[0]?.id, mixT = 1, yaw = 0, pitch = 0, dist = 9
const idx = (id: string) => list.findIndex(f => f.id === id)
async function show(id: string, instant = false) {
  const prev = cur; const A = await build(prev), B = await build(id)
  uniforms.uPosA.value = A.pos; uniforms.uColA.value = A.col; uniforms.uIdA.value = idx(prev)
  uniforms.uPosB.value = B.pos; uniforms.uColB.value = B.col; uniforms.uIdB.value = idx(id)
  uniforms.uDriftA.value = FORMS[prev].drift ?? 0.04; uniforms.uDriftB.value = FORMS[id].drift ?? 0.04
  uniforms.uSizeA.value = (FORMS[prev].pointSize ?? 2) / 2; uniforms.uSizeB.value = (FORMS[id].pointSize ?? 2) / 2
  mixT = instant ? 1 : 0; cur = id
  const c = FORMS[id].camera; if (c) { dist = Math.hypot(...c.pos.map((v, i) => v - c.target[i]) as [number, number, number]); camTarget.set(...c.target); camera.fov = c.fov ?? 35; camera.updateProjectionMatrix() }
  document.querySelectorAll('#hud button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.id === id))
  ;(document.getElementById('info')!).textContent = `${id} · ${N} particles`
}
const camTarget = new THREE.Vector3()
const hud = document.getElementById('hud')!
for (const f of list) { const b = document.createElement('button'); b.textContent = f.id; b.dataset.id = f.id; b.onclick = () => show(f.id); hud.appendChild(b) }
let down = false, lx = 0, ly = 0
addEventListener('pointerdown', e => { if ((e.target as HTMLElement).tagName === 'CANVAS') { down = true; lx = e.clientX; ly = e.clientY } })
addEventListener('pointerup', () => (down = false))
addEventListener('pointermove', e => {
  if (down) { yaw -= (e.clientX - lx) * 0.005; pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY }
  const ndc = new THREE.Vector3((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, 0.5).unproject(camera)
  const dir = ndc.sub(camera.position).normalize(); const tz = -camera.position.z / dir.z
  uniforms.uMouse.value.copy(camera.position).addScaledVector(dir, tz); uniforms.uMouseK.value = 0.35
})
addEventListener('wheel', e => { dist = Math.max(1.5, Math.min(30, dist * (1 + e.deltaY * 0.001))) })
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() })
const freezeT = q.get('t'), pinMix = q.get('mix')
let last = performance.now(), time = 0
function loop(now: number) {
  requestAnimationFrame(loop)
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt
  mixT = Math.min(1, mixT + dt / 2.4)
  uniforms.uMix.value = pinMix ? +pinMix : mixT
  uniforms.uTime.value = freezeT ? +freezeT : time
  for (const f of list) f.update?.(freezeT ? +freezeT : time, dt)
  camera.position.set(camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist)
  camera.lookAt(camTarget); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}
;(async () => {
  if (!cur) { document.getElementById('info')!.textContent = 'no forms registered yet'; return }
  const to = q.get('to')
  await show(cur, true)
  if (to) { await show(to) }
  requestAnimationFrame(loop)
  ;(window as any).__formview = { show, uniforms, FORMS }
})()
