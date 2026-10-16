// TEMPORARY dev harness for forms set 2 (table, phase, surface, compass). Imports only those four
// statically so other builders' edits do not trigger full reloads. Extra forms: &include=a,b
// ?form=<id>[&to=<id>&mix=0.5&t=5&n=262144&cam=x,y,z&tgt=x,y,z&fov=35&zoom=1&yaw=0&pitch=0&dpr=1&labels=1]
import * as THREE from 'three'
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import type { FormDef } from '../src/v3/forms/types'
import { makeCtx } from '../src/v3/forms/ctx'
import { composeVertex, FRAGMENT, particleAttributes } from '../src/v3/engine/compose'
import table from '../src/v3/forms/table'
import phase from '../src/v3/forms/phase'
import surface from '../src/v3/forms/surface'
import compass from '../src/v3/forms/compass'

const q = new URLSearchParams(location.search)
const N = +(q.get('n') ?? 262144), W = Math.sqrt(N) | 0
const FORMS: Record<string, FormDef> = { table, phase, surface, compass }
const lazy = import.meta.glob('../src/v3/forms/*.ts')
for (const id of (q.get('include') ?? '').split(',').filter(Boolean).concat([q.get('form') ?? '', q.get('to') ?? ''].filter(x => x && !FORMS[x]))) {
  const k = `../src/v3/forms/${id}.ts`
  if (lazy[k]) { const m: any = await lazy[k](); FORMS[id] = m.default }
}
const list = Object.values(FORMS)
const dpr = +(q.get('dpr') ?? Math.min(devicePixelRatio, 1.5))
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: false })
renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100)
const tex = new Map<string, { pos: THREE.DataTexture; col: THREE.DataTexture }>()
async function build(id: string) {
  if (tex.has(id)) return tex.get(id)!
  const f = FORMS[id]
  const pos = new Float32Array(N * 4), col = new Float32Array(N * 4)
  const t0 = performance.now()
  await f.build(makeCtx(id, N), pos, col)
  console.log(`[f2] built ${id} in ${(performance.now() - t0).toFixed(0)} ms`)
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
  uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseR: { value: 0.6 }, uMouseK: { value: 0.0 },
  uFocus: { value: 9 }, uBokeh: { value: 0.15 },
}
for (const f of list) Object.assign(uniforms, f.uniforms ?? {})
const mat = new THREE.ShaderMaterial({ vertexShader: composeVertex(list), fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
let cur = q.get('form') ?? 'table', mixT = 1
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3()
let yaw = +(q.get('yaw') ?? 0), pitch = +(q.get('pitch') ?? 0), zoom = +(q.get('zoom') ?? 1), baseDist = 9, baseYaw = 0, basePitch = 0
const idx = (id: string) => list.findIndex(f => f.id === id)
function applyCam(id: string) {
  const c = FORMS[id].camera
  const pos = (q.get('cam') ? q.get('cam')!.split(',').map(Number) : c?.pos ?? [0, 0, 9]) as [number, number, number]
  const tgt = (q.get('tgt') ? q.get('tgt')!.split(',').map(Number) : c?.target ?? [0, 0, 0]) as [number, number, number]
  camTarget.set(...tgt); camPos.set(...pos)
  const d = camPos.clone().sub(camTarget); baseDist = d.length(); baseYaw = Math.atan2(d.x, d.z); basePitch = Math.asin(d.y / baseDist)
  camera.fov = +(q.get('fov') ?? c?.fov ?? 35); camera.updateProjectionMatrix()
}
async function show(id: string, instant = false) {
  const prev = cur; const A = await build(prev), B = await build(id)
  uniforms.uPosA.value = A.pos; uniforms.uColA.value = A.col; uniforms.uIdA.value = idx(prev)
  uniforms.uPosB.value = B.pos; uniforms.uColB.value = B.col; uniforms.uIdB.value = idx(id)
  uniforms.uDriftA.value = FORMS[prev].drift ?? 0.04; uniforms.uDriftB.value = FORMS[id].drift ?? 0.04
  uniforms.uSizeA.value = (FORMS[prev].pointSize ?? 2) / 2; uniforms.uSizeB.value = (FORMS[id].pointSize ?? 2) / 2
  mixT = instant ? 1 : 0; cur = id; applyCam(id)
  document.querySelectorAll('#hud button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.id === id))
  document.getElementById('info')!.textContent = `${id} · ${N} particles`
  // anchors -> DOM labels
  document.querySelectorAll('.lab').forEach(e => e.remove())
  if (q.get('labels')) for (const a of FORMS[id].anchors ?? []) { const e = document.createElement('div'); e.className = 'lab'; e.dataset.a = a.id; e.textContent = a.label; document.body.appendChild(e) }
}
const hud = document.getElementById('hud')!
for (const f of list) { const b = document.createElement('button'); b.textContent = f.id; b.dataset.id = f.id; b.onclick = () => show(f.id); hud.appendChild(b) }
let down = false, lx = 0, ly = 0
addEventListener('pointerdown', e => { if ((e.target as HTMLElement).tagName === 'CANVAS') { down = true; lx = e.clientX; ly = e.clientY } })
addEventListener('pointerup', () => (down = false))
addEventListener('pointermove', e => { if (down) { yaw -= (e.clientX - lx) * 0.005; pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY } })
addEventListener('wheel', e => { zoom = Math.max(0.15, Math.min(3, zoom * (1 + e.deltaY * 0.001))) })
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false) })
const freezeT = q.get('t'), pinMix = q.get('mix')
let last = performance.now(), time = 0
const v3 = new THREE.Vector3()
function loop(now: number) {
  requestAnimationFrame(loop)
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt
  mixT = Math.min(1, mixT + dt / 2.4)
  uniforms.uMix.value = pinMix ? +pinMix : mixT
  const tt = freezeT ? +freezeT : time
  uniforms.uTime.value = tt
  for (const f of list) f.update?.(tt, dt)
  const dist = baseDist * zoom, ya = baseYaw + yaw, pi = basePitch + pitch
  camera.position.set(camTarget.x + Math.sin(ya) * Math.cos(pi) * dist, camTarget.y + Math.sin(pi) * dist, camTarget.z + Math.cos(ya) * Math.cos(pi) * dist)
  camera.lookAt(camTarget); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); camera.updateMatrixWorld()
  renderer.render(scene, camera)
  document.querySelectorAll<HTMLElement>('.lab').forEach(e => {
    const a = FORMS[cur].anchors?.find(x => x.id === e.dataset.a); if (!a) return
    v3.set(...a.pos).project(camera); e.style.left = ((v3.x * 0.5 + 0.5) * innerWidth) + 'px'; e.style.top = ((-v3.y * 0.5 + 0.5) * innerHeight) + 'px'
  })
}
;(async () => {
  const to = q.get('to')
  await show(cur, true)
  if (to) await show(to)
  requestAnimationFrame(loop)
  ;(window as any).__f2 = { show, uniforms, FORMS }
})()
