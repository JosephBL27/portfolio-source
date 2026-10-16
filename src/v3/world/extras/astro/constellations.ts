// Astro 3/3: constellations. At the establishing shot each area's stops (its waypoints) light up as stars hanging above the area on the ring, joined by thin
// lines that draw on in turn (the stroke-reveal of the 'threads' look: a hot head runs ahead of the line). Hover near one and its name fades in.
// World-space (not on the camera's shell): they are real places, so they have real parallax.
import * as THREE from 'three'
import { AREAS, WAYPOINTS } from '../../layout'
import { rng } from '../lib/flags'
import { S as SIG, U as SIGU } from '../../signals'

export const AREA_NAME: Record<string, string> = { work: 'Work', systems: 'Systems', research: 'Research', mind: 'Second Brain', education: 'Education', about: 'About', hub: '' }

export interface Constellations {
  group: THREE.Group
  /** vis 0..1 overall; t seconds; dt; hover = index of the nearest constellation under the pointer or -1 */
  update(t: number, dt: number, vis: number, hover: number, rm: boolean): void
  /** world-space centroid of each constellation (AREAS order) */
  centers: THREE.Vector3[]
  dispose(): void
}

export function createConstellations(dpr: number): Constellations {
  const group = new THREE.Group(), r = rng(0xc0457), geos: THREE.BufferGeometry[] = [], mats: THREE.ShaderMaterial[] = []
  const centers: THREE.Vector3[] = [], parts: { line: THREE.LineSegments; stars: THREE.Points; lm: THREE.ShaderMaterial; sm: THREE.ShaderMaterial; hot: number; ph: number }[] = []
  AREAS.forEach((a, ai) => {
    const stops = WAYPOINTS.filter(w => w.area === a.id).length, n = stops >= 2 ? stops : a.projects.length   // a one-stop area (Second Brain) shows its four projects
    if (n < 2) { centers.push(new THREE.Vector3(...a.center)); return }
    // the stops, laid in the vertical plane tangent to the ring above the area: an easy zigzag, wider for the longer ones, never tighter than 1.5 apart
    const out = new THREE.Vector3(Math.sin((a.angle * Math.PI) / 180), 0, Math.cos((a.angle * Math.PI) / 180)), tan = new THREE.Vector3(out.z, 0, -out.x)
    const sx = Math.min(3.6, 17 / n), c = new THREE.Vector3(a.center[0], a.center[1] + 12, a.center[2]).addScaledVector(out, 4)
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) pts.push(c.clone().addScaledVector(tan, (i - (n - 1) / 2) * sx * (0.9 + 0.2 * r())).setY(c.y + Math.sin(i * 1.7 + ai) * 3.2 + (r() - 0.5) * 2.2).addScaledVector(out, (r() - 0.5) * 1.5))
    const edges: [number, number][] = pts.slice(1).map((_, i) => [i, i + 1] as [number, number]); if (n >= 5) edges.push([1, n - 1]); if (n >= 7) edges.push([2, 5])
    // cumulative parameter along the draw order, so the whole figure strokes on edge by edge
    const lp = new Float32Array(edges.length * 6), lu = new Float32Array(edges.length * 2); let len = 0
    const el = edges.map(([i, j]) => pts[i].distanceTo(pts[j])), tot = el.reduce((x, y) => x + y, 0)
    edges.forEach(([i, j], k) => { lp.set([pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z], k * 6); lu[k * 2] = len / tot; len += el[k]; lu[k * 2 + 1] = len / tot })
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aU', new THREE.BufferAttribute(lu, 1))
    const col = new THREE.Color(a.accent).lerp(new THREE.Color(1, 1, 1), 0.35)
    const lm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uC: { value: col }, uDraw: { value: 0 }, uVis: { value: 0 }, uHot: { value: 0 }, uFlare: { value: 0 }, uSgMus: SIGU.uSgMus, uSgRip: SIGU.uSgRip, uSgBr: SIGU.uSgBr, uSgMc: SIGU.uSgMc },
      vertexShader: 'attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // v19: the beat runs along the lines as a travelling band, the bass lifts them, a brain pulse is a white-hot run, a shooting star over the figure flares it
      fragmentShader: 'uniform vec3 uC, uSgMc; uniform vec4 uSgMus, uSgRip, uSgBr; uniform float uDraw, uVis, uHot, uFlare; varying float vU; void main(){ if (vU > uDraw) discard; float head = exp(-(uDraw - vU) * 22.0); float rw = exp(-pow((vU - uSgRip.x) / 0.16, 2.0)) * uSgRip.y; float br = exp(-pow((vU - uSgBr.x + 0.1) / 0.09, 2.0)) * uSgBr.y; float a = uVis * (0.62 + uHot * 0.5 + 1.0 * head + 0.3 * uSgMus.x + 1.6 * rw + 0.9 * uFlare); vec3 c = mix(uC, vec3(1.0), head * 0.7); c = mix(c, uSgMc, min(1.0, rw * 0.6)); gl_FragColor = vec4(c * a + vec3(1.0, 0.95, 0.85) * br * 2.2 * uVis, 1.0); }' })
    const line = new THREE.LineSegments(lg, lm); line.frustumCulled = false; line.renderOrder = 3
    // the stars: a flare sprite each; the n-th lights when the stroke reaches it
    const sp = new Float32Array(n * 3), su = new Float32Array(n), sz = new Float32Array(n)
    const reach = [0]; for (let i = 1; i < n; i++) { const k = edges.findIndex(e => e[1] === i); reach.push(lu[k * 2 + 1]) }
    pts.forEach((p, i) => { sp.set([p.x, p.y, p.z], i * 3); su[i] = reach[i]; sz[i] = i === 0 || i === n - 1 ? 52 : 36 + r() * 12 })
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aU', new THREE.BufferAttribute(su, 1)); sg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
    const sm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uC: { value: col }, uDraw: { value: 0 }, uVis: { value: 0 }, uHot: { value: 0 }, uT: { value: 0 }, uDpr: { value: dpr }, uFlare: { value: 0 }, uSgMus: SIGU.uSgMus, uSgRip: SIGU.uSgRip, uSgBr: SIGU.uSgBr },
      vertexShader: 'attribute float aU; attribute float aSize; uniform float uDraw, uVis, uHot, uT, uDpr, uFlare; uniform vec4 uSgMus, uSgRip, uSgBr; varying float vA; void main(){ float on = smoothstep(aU - 0.02, aU + 0.04, uDraw); float rw = exp(-pow((aU - uSgRip.x) / 0.2, 2.0)) * uSgRip.y, br = exp(-pow((aU - uSgBr.x + 0.1) / 0.1, 2.0)) * uSgBr.y; float ex = 0.35 * uSgMus.x + 1.4 * rw + 2.0 * br + 1.6 * uFlare; vA = uVis * on * (0.8 + 0.2 * sin(uT * 1.7 + aU * 30.0) + uHot * 0.6 + ex) * (1.0 + 1.4 * exp(-abs(uDraw - aU) * 14.0) * on); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uDpr * (0.8 + 0.5 * on) * (1.0 + 0.25 * ex); }',
      fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ vec2 p = (gl_PointCoord - 0.5) * 2.0; float r = length(p); float core = exp(-r * 14.0) * 1.5 + exp(-r * 4.5) * 0.35; float sp = (exp(-abs(p.x) * 40.0) * exp(-abs(p.y) * 3.0) + exp(-abs(p.y) * 40.0) * exp(-abs(p.x) * 3.0)) * 0.7; float a = (core + sp) * vA * smoothstep(1.0, 0.75, r); gl_FragColor = vec4(mix(uC, vec3(1.0), 0.45) * a, 1.0); }' })
    const stars = new THREE.Points(sg, sm); stars.frustumCulled = false; stars.renderOrder = 4
    group.add(line, stars); geos.push(lg, sg); mats.push(lm, sm)
    centers.push(pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n))
    parts[ai] = { line, stars, lm, sm, hot: 0, ph: ai }
  })
  group.visible = false
  return {
    group, centers,
    update(t, dt, vis, hover, rm) {
      group.visible = vis > 0.003
      if (!group.visible) return
      parts.forEach((p, i) => {
        if (!p) return
        p.hot += ((hover === i ? 1 : 0) - p.hot) * (1 - Math.exp(-dt / 0.2))
        // each area strokes on in turn (0.1 apart), over most of the visible window; scrolling away un-draws them in the same order
        const draw = rm ? (vis > 0.5 ? 1.05 : 0) : Math.min(1.05, Math.max(0, (vis * 1.6 - i * 0.1) / 0.8) * 1.05)
        for (const m of [p.lm, p.sm]) { m.uniforms.uDraw.value = draw; m.uniforms.uVis.value = Math.min(1, vis * 3); m.uniforms.uHot.value = p.hot }
        p.sm.uniforms.uT.value = rm ? 0 : t
        const fl = rm ? 0 : SIG.flare[i] ?? 0; p.lm.uniforms.uFlare.value = fl; p.sm.uniforms.uFlare.value = fl   // v19: a shooting star passed over this figure
      })
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); group.removeFromParent() },
  }
}
