// Brain lab: /lab/brainview.html?view=plain|glass&yaw=0.3&pitch=0.1&mode=0..3&dist=9&t=3
// plain = the baked mesh with simple shading (anatomy check); glass = the glass brain with the vault graph (src/gl/brain.ts, anatomical).
import * as THREE from 'three'
import { loadBrainMesh, poseVec, REGIONS } from '../src/gl/brainShape'

const q = new URLSearchParams(location.search)
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false)
renderer.setClearColor(0x06070a, 1)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100)
const view = q.get('view') ?? 'plain'
const yaw = +(q.get('yaw') ?? 0), pitch = +(q.get('pitch') ?? 0.12), dist = +(q.get('dist') ?? 10)
camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(0, -0.1, 0)
const info = document.getElementById('info')!

async function plain() {
  const m = await loadBrainMesh()
  const g = new THREE.BufferGeometry()
  const p = new Float32Array(m.pos.length), n = new Float32Array(m.nrm.length), tmp: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < m.pos.length; i += 3) {
    poseVec(m.pos[i], m.pos[i + 1], m.pos[i + 2], tmp); p.set(tmp.map(v => v * 2.8), i)
    poseVec(m.nrm[i], m.nrm[i + 1], m.nrm[i + 2], tmp); n.set(tmp, i)
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
  g.setAttribute('aFold', new THREE.BufferAttribute(m.fold, 1)); g.setAttribute('aRegion', new THREE.BufferAttribute(Float32Array.from(m.region), 1))
  g.setIndex(new THREE.BufferAttribute(m.idx, 1))
  const pal = [[0.95, 0.6, 0.55], [0.9, 0.75, 0.45], [0.5, 0.8, 0.55], [0.45, 0.6, 0.95], [0.7, 0.55, 0.9], [0.9, 0.55, 0.75], [0.5, 0.85, 0.85], [0.85, 0.85, 0.5], [0.8, 0.8, 0.8]]
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPal: { value: pal.map(c => new THREE.Vector3(...c)) } },
    vertexShader: `attribute float aFold; attribute float aRegion; varying vec3 vN; varying float vF; varying float vR; void main(){ vN = normalMatrix * normal; vF = aFold; vR = aRegion; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uPal[9]; varying vec3 vN; varying float vF; varying float vR; void main(){ vec3 n = normalize(vN); float l = 0.25 + 0.75 * max(dot(n, normalize(vec3(-0.4,0.6,0.7))),0.); vec3 c = ${q.get('regions') ? 'uPal[int(vR + 0.5)]' : 'vec3(0.86,0.78,0.74)'}; c *= l * (1. - 0.55 * vF); gl_FragColor = vec4(pow(c, vec3(1./2.2)), 1.); }`,
  })
  scene.add(new THREE.Mesh(g, mat))
  info.textContent = `plain ${m.pos.length / 3} verts ${m.idx.length / 3} tris · regions ${REGIONS.join(' ')}`
}
async function glass() {
  const { createBrainGlass } = await import('../src/v3/world/brainglass')
  const bg = createBrainGlass({ radius: 2.7, at: [0, 0, 0], display: false })
  scene.add(bg.group)
  if (q.get('mode')) bg.brain.setMode?.(+q.get('mode')!, true)
  const T = +(q.get('t') ?? 3)
  let t = 0, last = performance.now()
  ;(window as any).__brain = bg
  const loop = (now: number) => {
    requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt
    bg.update(q.get('t') ? T : t, dt, camera, 1)
    bg.brain.group.rotation.y += +(q.get('turn') ?? 0); bg.brain.group.rotation.x = +(q.get('tilt') ?? 0)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(loop)
  info.textContent = 'glass'
}
;(view === 'glass' ? glass() : plain().then(() => { renderer.render(scene, camera); requestAnimationFrame(function r() { renderer.render(scene, camera); requestAnimationFrame(r) }) }))
;(window as any).__ready = true
