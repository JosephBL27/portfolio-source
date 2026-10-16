// The pneumatic network: wall with halftone shadows, glass tubes, powder-coated stations,
// lamps, end fittings and the capsule traffic. Everything procedural, few draw calls.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildLayout, GLOBE_R, WALL_Z, type Layout, type Station } from '../sim/layout'
import { buildTrips, flightsAt, draw, type Flight, type Trip } from '../sim/schedule'
import { createTubeGlass, writeCaps, type TubeGlass } from './tubeGlass'
import { palette } from '../theme'

const TUBE_R = 0.025
const CAP_R = 0.021
const CAP_LEN = 0.085
const MAX_FLIGHTS = 48

export interface Network {
  group: THREE.Group
  layout: Layout
  trips: Trip[]
  update(simMin: number, dt: number): Flight[]
  setNight(n: boolean): void
  setFocus(stationId: string | null): void
  setDim(v: number): void
  stationScreen(camera: THREE.Camera, w: number, h: number, out: { id: string; x: number; y: number; z: number; s: Station }[]): void
  onArrive(cb: (s: Station, f: Flight) => void): void
  /** up to 24 capsules as xyz+intensity, for the brain's glass */
  capsGlow: Float32Array
}

// ---------- wall: drafting paper + halftone shadows ----------
const WALL_W = 11, WALL_H = 7.2
function shadowTexture(layout: Layout) {
  const W = 1650, H = 1080
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  const toPx = (x: number, y: number): [number, number] => [((x + WALL_W / 2) / WALL_W) * W, (1 - (y + WALL_H / 2) / WALL_H) * H]
  const off = (z: number): [number, number] => { const d = z - WALL_Z; return [d * 0.55, -d * 0.62] } // light from top-left-front
  g.lineCap = 'round'; g.lineJoin = 'round'
  // tubes
  for (const r of layout.routes) {
    const pts = r.curve.getPoints(60)
    for (let pass = 0; pass < 2; pass++) {
      g.filter = pass === 0 ? 'blur(6px)' : 'blur(1.5px)'
      g.strokeStyle = pass === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.30)'
      g.lineWidth = pass === 0 ? 11 : 3.2
      g.beginPath()
      pts.forEach((p, i) => { const o = off(p.z); const [x, y] = toPx(p.x + o[0], p.y + o[1]); i ? g.lineTo(x, y) : g.moveTo(x, y) })
      g.stroke()
    }
  }
  // stations
  g.filter = 'blur(4px)'; g.fillStyle = 'rgba(255,255,255,0.55)'
  for (const s of layout.stations) {
    if (s.ring === 'port') continue
    const o = off(s.pos.z + 0.06)
    const [x, y] = toPx(s.pos.x + o[0], s.pos.y + o[1])
    const w = (0.26 / WALL_W) * W, h = (0.17 / WALL_H) * H
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 8); g.fill()
  }
  // globe
  g.filter = 'blur(18px)'
  const o = off(0.25)
  const [gx, gy] = toPx(o[0], o[1])
  const grad = g.createRadialGradient(gx, gy, 10, gx, gy, (GLOBE_R * 1.05 / WALL_W) * W)
  grad.addColorStop(0, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad; g.beginPath(); g.arc(gx, gy, (GLOBE_R * 1.1 / WALL_W) * W, 0, Math.PI * 2); g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  return tex
}

function wallMaterial(shadow: THREE.Texture) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uShadow: { value: shadow },
      uPaper: { value: new THREE.Color(palette(false).paper) },
      uInk: { value: new THREE.Color(palette(false).ink) },
      uRule: { value: new THREE.Color(palette(false).rule) },
      uDpr: { value: Math.min(devicePixelRatio, 1.75) },
      uCell: { value: 6.5 },
      uInkA: { value: 0.78 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec2 vW;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uShadow; uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uRule;
      uniform float uDpr; uniform float uCell; uniform float uInkA;
      varying vec2 vUv; varying vec2 vW;
      float gridLine(float v, float step, float w) { float f = abs(fract(v / step - 0.5) - 0.5) * step; return 1.0 - smoothstep(0.0, w, f); }
      void main() {
        float shade = texture2D(uShadow, vUv).r;
        // 45-degree screen-space dot screen, constant size like ink on paper
        float cell = uCell * uDpr;
        vec2 p = gl_FragCoord.xy;
        float c = 0.70710678;
        vec2 q = vec2(c * p.x - c * p.y, c * p.x + c * p.y) / cell;
        vec2 f = fract(q) - 0.5;
        float r = sqrt(clamp(shade, 0.0, 1.0)) * 0.56;
        if (shade < 0.035) r = 0.0;
        float d = length(f);
        float aa = fwidth(d) * 1.2;
        float dot = 1.0 - smoothstep(r - aa, r + aa, d);
        // drafting grid: fine every 0.25 u, major every 1 u, very faint
        float fw = fwidth(vW.x) * 0.9;
        float g1 = max(gridLine(vW.x, 0.25, fw), gridLine(vW.y, 0.25, fw)) * 0.05;
        float g2 = max(gridLine(vW.x, 1.0, fw * 1.4), gridLine(vW.y, 1.0, fw * 1.4)) * 0.11;
        // vignette the grid out toward the wall edge
        float edge = smoothstep(0.5, 0.36, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
        vec3 col = mix(uPaper, uRule, (g1 + g2) * edge * 3.0);
        col = mix(col, uInk, dot * uInkA * edge);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

// ---------- inner rolled sheet (halftone strip inside each capsule) ----------
function sheetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPaper: { value: new THREE.Color('#F7F5F0') }, uInk: { value: new THREE.Color('#121212') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vShade;
      void main() {
        vUv = uv; vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
        vShade = 0.55 + 0.45 * max(dot(normalize(mat3(modelMatrix) * n), normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaper; uniform vec3 uInk; varying vec2 vUv; varying float vShade;
      void main() {
        vec2 q = vec2(vUv.x * 18.0, vUv.y * 10.0);
        vec2 f = fract(q) - 0.5;
        float lum = 0.5 + 0.5 * sin(vUv.y * 9.0 + vUv.x * 3.0);
        float r = sqrt(1.0 - lum) * 0.55;
        float dot = 1.0 - smoothstep(r - 0.08, r + 0.08, length(f));
        vec3 col = mix(uPaper, uInk, dot * 0.85) * vShade;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

export function createNetwork(envMap: THREE.Texture | null): Network {
  const layout = buildLayout()
  const trips = buildTrips(layout)
  const group = new THREE.Group()
  const day = palette(false), night = palette(true)

  // wall
  const shadow = shadowTexture(layout)
  const wallMat = wallMaterial(shadow)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat)
  wall.position.z = WALL_Z
  wall.renderOrder = -10
  group.add(wall)

  // tubes: one merged geometry, one draw call
  const tubeGeos = layout.routes.map(r => new THREE.TubeGeometry(r.curve, Math.max(24, Math.round(r.length * 34)), r.radius > 0.011 ? TUBE_R : TUBE_R * 0.82, 12, false))
  const tubeGeo = mergeGeometries(tubeGeos, false)
  tubeGeos.forEach(g => g.dispose())
  const tubeMat = createTubeGlass({ tint: '#DDE3E6', rim: day.ink, glow: day.brain }, { tint: '#1a2228', rim: '#9fb3c2', glow: '#ff9a7a' }, { rimPow: 2.2, body: 0.05, rimA: 0.9 })
  const tubes = new THREE.Mesh(tubeGeo, tubeMat)
  tubes.renderOrder = 5
  group.add(tubes)

  // stations: rounded powder-coated boxes (not ports)
  const bodies = layout.stations.filter(s => s.ring !== 'port')
  const boxGeo = new RoundedBoxGeometry(0.25, 0.16, 0.11, 4, 0.03)
  const powder = new THREE.MeshPhysicalMaterial({ transparent: true, color: '#F4F2EC', roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMap, envMapIntensity: 0.65 })
  const boxes = new THREE.InstancedMesh(boxGeo, powder, bodies.length)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1)
  bodies.forEach((s, i) => {
    const big = s.ring === 'agent' ? 1 : 1.12
    m4.compose(v.set(s.pos.x, s.pos.y, s.pos.z), q.identity(), sc.set(big, big, 1))
    boxes.setMatrixAt(i, m4)
  })
  group.add(boxes)

  // ports on the globe rim: flanged rings
  const ports = layout.stations.filter(s => s.ring === 'port')
  const flangeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 28, 1, false)
  flangeGeo.rotateX(Math.PI / 2)
  const alu = new THREE.MeshPhysicalMaterial({ transparent: true, color: '#C9CDD1', metalness: 1, roughness: 0.3, envMap, envMapIntensity: 1.1, clearcoat: 0.5 })
  const flanges = new THREE.InstancedMesh(flangeGeo, alu, ports.length + layout.routes.length * 2)
  let fi = 0
  ports.forEach(s => {
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s.pos.x, s.pos.y, 0.4).normalize())
    m4.compose(s.pos, q, sc.set(1, 1, 1)); flanges.setMatrixAt(fi++, m4)
  })
  // end fittings where each tube meets a station
  const t0 = new THREE.Vector3(), t1 = new THREE.Vector3()
  for (const r of layout.routes) {
    for (const end of [0.03, 0.97]) {
      r.curve.getPointAt(end, t0); r.curve.getTangentAt(end, t1)
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t1)
      m4.compose(t0, q, sc.set(0.52, 0.52, 0.9)); flanges.setMatrixAt(fi++, m4)
    }
  }
  flanges.count = fi
  group.add(flanges)

  // lamps (front face of each station, and each port)
  const lampGeo = new THREE.CircleGeometry(0.019, 20)
  const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false })
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, layout.stations.length)
  const lampBase: THREE.Color[] = []
  const lampHeat = new Float32Array(layout.stations.length)
  const lampIndex = new Map<string, number>()
  layout.stations.forEach((s, i) => {
    lampIndex.set(s.node.id, i)
    const p = s.ring === 'port' ? s.pos.clone().add(new THREE.Vector3(s.pos.x, s.pos.y, 0.4).normalize().multiplyScalar(0.02)) : s.pos.clone().add(new THREE.Vector3(0.085, 0.035, 0.057))
    q.identity()
    if (s.ring === 'port') q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s.pos.x, s.pos.y, 0.4).normalize())
    m4.compose(p, q, sc.set(1, 1, 1)); lamps.setMatrixAt(i, m4)
    const c = new THREE.Color(s.ring === 'source' ? day.inbound : s.ring === 'output' ? day.delivered : s.ring === 'port' ? day.brain : day.ink)
    lampBase.push(c); lamps.setColorAt(i, c)
  })
  group.add(lamps)

  // capsule traffic: glass bodies, inner sheets, coloured caps
  const capGeo = new THREE.CapsuleGeometry(CAP_R, CAP_LEN, 4, 14)
  const capGlass = createTubeGlass({ tint: '#E8EEF0', rim: day.ink, glow: '#ffffff' }, { tint: '#26323a', rim: '#d8e4ec', glow: '#ffffff' }, { rimPow: 1.8, body: 0.18, rimA: 0.95 })
  const capsules = new THREE.InstancedMesh(capGeo, capGlass, MAX_FLIGHTS)
  capsules.renderOrder = 6
  const sheetGeo = new THREE.CylinderGeometry(CAP_R * 0.72, CAP_R * 0.72, CAP_LEN * 0.95, 14, 1, true)
  const sheets = new THREE.InstancedMesh(sheetGeo, sheetMaterial(), MAX_FLIGHTS)
  const endGeo = new THREE.CylinderGeometry(CAP_R * 1.06, CAP_R * 1.06, 0.016, 18)
  const capMetal = new THREE.MeshPhysicalMaterial({ metalness: 0.55, roughness: 0.28, clearcoat: 1, envMap, envMapIntensity: 0.9 })
  const ends = new THREE.InstancedMesh(endGeo, capMetal, MAX_FLIGHTS * 2)
  const capColours = { inbound: new THREE.Color(day.inbound), ink: new THREE.Color(day.ink), delivered: new THREE.Color(day.delivered) }
  for (let i = 0; i < MAX_FLIGHTS * 2; i++) ends.setColorAt(i, capColours.ink)
  ;[capsules, sheets, ends].forEach(m => { m.count = 0; m.frustumCulled = false; group.add(m) })

  // ---------- update ----------
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3(), tan = new THREE.Vector3(), endPos = new THREE.Vector3()
  const glowList: { x: number; y: number; z: number; w: number }[] = []
  const capsGlow = new Float32Array(24 * 4)
  const arrived = new Set<Trip>()
  let arriveCb: ((s: Station, f: Flight) => void) | null = null
  let focus: string | null = null
  let focusK = 1, lastNow = performance.now()
  const focusNbrs = new Set<string>()
  const tmpC = new THREE.Color(), WHITE = new THREE.Color('#ffffff')
  let lampsForce = true

  function update(simMin: number, dt: number) {
    const nowR = performance.now(), rdt = Math.min(0.05, (nowR - lastNow) / 1000); lastNow = nowR
    focusK += ((focus ? 0.35 : 1) - focusK) * (1 - Math.exp(-rdt * 16)); tubeMat.uniforms.uDim.value = focusK * dimV
    const flights = flightsAt(trips, simMin, MAX_FLIGHTS)
    glowList.length = 0
    let n = 0
    for (const f of flights) {
      const r = f.trip.route
      const u = draw(f.u)
      r.curve.getPointAt(Math.min(0.995, Math.max(0.005, u)), pos)
      r.curve.getTangentAt(Math.min(0.995, Math.max(0.005, u)), tan)
      q.setFromUnitVectors(up, tan)
      const dim = focus && r.from.node.id !== focus && r.to.node.id !== focus ? 0.25 : 1
      m4.compose(pos, q, sc.set(dim, 1, dim))
      capsules.setMatrixAt(n, m4)
      sheets.setMatrixAt(n, m4)
      for (let k = 0; k < 2; k++) {
        endPos.copy(tan).multiplyScalar((k ? 1 : -1) * (CAP_LEN / 2 + CAP_R * 0.55)).add(pos)
        m4.compose(endPos, q, sc.set(dim, 1, dim))
        ends.setMatrixAt(n * 2 + k, m4)
        ends.setColorAt(n * 2 + k, capColours[f.trip.colour])
      }
      // glow: strongest mid-flight
      glowList.push({ x: pos.x, y: pos.y, z: pos.z, w: (0.35 + 0.65 * Math.sin(Math.PI * f.u)) * dim })
      // arrival → lamp heat + callback
      if (f.u > 0.93 && !arrived.has(f.trip)) {
        arrived.add(f.trip)
        const li = lampIndex.get(r.to.node.id)!
        lampHeat[li] = 1
        arriveCb?.(r.to, f)
      }
      n++
    }
    if (arrived.size > 400) arrived.clear()
    capsules.count = n; sheets.count = n; ends.count = n * 2
    capsules.instanceMatrix.needsUpdate = true
    sheets.instanceMatrix.needsUpdate = true
    ends.instanceMatrix.needsUpdate = true
    if (ends.instanceColor) ends.instanceColor.needsUpdate = true
    writeCaps(tubeMat, glowList)
    capsGlow.fill(0)
    for (let i = 0, j = 0; i < glowList.length && j < 24; i++) { const g = glowList[i]; if (g.x * g.x + g.y * g.y + g.z * g.z > 0.97 * 0.97) continue; capsGlow[j * 4] = g.x; capsGlow[j * 4 + 1] = g.y; capsGlow[j * 4 + 2] = g.z; capsGlow[j * 4 + 3] = g.w; j++ }
    // lamps cool down (only upload when something changed)
    let lampDirty = lampsForce
    for (let i = 0; i < lampHeat.length; i++) {
      if (lampHeat[i] <= 0 && !lampsForce) continue
      lampHeat[i] = Math.max(0, lampHeat[i] - dt * 1.6)
      const id = layout.stations[i].node.id
      const dimmed = focus !== null && id !== focus && !focusNbrs.has(id)
      tmpC.copy(lampBase[i]).lerp(WHITE, lampHeat[i] * 0.6).multiplyScalar(dimmed ? 0.35 : 1)
      lamps.setColorAt(i, tmpC)
      lampDirty = true
    }
    lampsForce = false
    if (lampDirty && lamps.instanceColor) lamps.instanceColor.needsUpdate = true
    return flights
  }

  function setNight(nt: boolean) {
    const p = nt ? night : day
    ;(wallMat.uniforms.uPaper.value as THREE.Color).set(p.paper)
    ;(wallMat.uniforms.uInk.value as THREE.Color).set(nt ? '#8f8b80' : p.ink)
    ;(wallMat.uniforms.uRule.value as THREE.Color).set(nt ? '#3a3d41' : p.rule)
    wallMat.uniforms.uInkA.value = nt ? 0.32 : 0.78
    tubeMat.setNight(nt); capGlass.setNight(nt); hiMat.setNight(nt)
    powder.color.set(nt ? '#2a2c2f' : '#F4F2EC')
    capColours.inbound.set(p.inbound); capColours.ink.set(nt ? '#cfcac0' : p.ink); capColours.delivered.set(p.delivered)
    lampsForce = true
    layout.stations.forEach((s, i) => lampBase[i].set(s.ring === 'source' ? p.inbound : s.ring === 'output' ? p.delivered : s.ring === 'port' ? p.brain : nt ? '#ECEAE3' : p.ink))
  }

  const hiMat = createTubeGlass({ tint: day.brain, rim: day.brain, glow: '#ffffff' }, { tint: night.brain, rim: night.brain, glow: '#ffffff' }, { rimPow: 1.4, body: 0.35, rimA: 1 })
  let hiMesh: THREE.Mesh | null = null
  function setFocus(id: string | null) {
    focus = id
    focusNbrs.clear()
    if (id) for (const r of layout.routes) { if (r.from.node.id === id) focusNbrs.add(r.to.node.id); if (r.to.node.id === id) focusNbrs.add(r.from.node.id) }
    lampsForce = true
    if (hiMesh) { group.remove(hiMesh); hiMesh.geometry.dispose(); hiMesh = null }
    if (!id) return
    const rs = layout.routes.filter(r => r.from.node.id === id || r.to.node.id === id)
    if (!rs.length) return
    const gs = rs.map(r => new THREE.TubeGeometry(r.curve, Math.max(24, Math.round(r.length * 34)), TUBE_R * 1.02, 12, false))
    hiMesh = new THREE.Mesh(mergeGeometries(gs, false), hiMat)
    gs.forEach(g => g.dispose())
    hiMesh.renderOrder = 7
    group.add(hiMesh)
  }

  const proj = new THREE.Vector3()
  function stationScreen(camera: THREE.Camera, w: number, h: number, out: { id: string; x: number; y: number; z: number; s: Station }[]) {
    out.length = 0
    for (const s of layout.stations) {
      proj.copy(s.pos).applyMatrix4(group.matrixWorld).project(camera)
      out.push({ id: s.node.id, x: (proj.x * 0.5 + 0.5) * w, y: (-proj.y * 0.5 + 0.5) * h, z: proj.z, s })
    }
  }

  let dimV = 1, nightV = false
  function setDim(v: number) {
    if (Math.abs(v - dimV) < 0.002) return
    dimV = v
    capGlass.uniforms.uDim.value = 0.4 + 0.6 * v
    wallMat.uniforms.uInkA.value = (nightV ? 0.32 : 0.78) * (0.35 + 0.65 * v)
    powder.opacity = alu.opacity = 0.25 + 0.75 * v
  }
  const _setNight = setNight
  const setNightW = (n: boolean) => { nightV = n; _setNight(n); const d = dimV; dimV = -1; setDim(d) }
  return { group, layout, trips, update, setNight: setNightW, setFocus, setDim, stationScreen, onArrive: cb => (arriveCb = cb), capsGlow }
}
