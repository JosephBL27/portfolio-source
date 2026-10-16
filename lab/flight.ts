// Flight lab: /lab/flight.html — scrub p (0..1) through the continuous world with ONLY the engine + forms.
// Placeholder wire boxes mark each area centre and a sphere marks the hub TV, so the camera path, the morph
// timing and the placement can be judged before the TV/world builder lands.
//   ?p=<0..1>   start position        ?n=<count>  base particle count (default engine default)
//   ?hud=0      hide the HUD          ?follow=1   run p through the FlightFollower (time floors)
//   ?t=<sec>    freeze the shader clock          ?boxes=0  hide the placeholders
//   ?auto=1     autoplay at ?speed=<p/s> (default 0.02)
// window.__flight = { field, setP(p), flightAt, stats() }
import '@fontsource/ibm-plex-mono/500.css'
import * as THREE from 'three'
import { FORMS } from '../src/v3/forms'
import type { FormDef } from '../src/v3/forms/types'
import { createField } from '../src/v3/engine/field'
import { AREAS, HUB, RING, WAYPOINTS } from '../src/v3/world/layout'
import { flightAt, FlightFollower, SCROLL_VH, waypointP, powerOffAt } from '../src/v3/world/flight'

const q = new URLSearchParams(location.search)
const resolve = (id: string) => (FORMS[id] ? id : 'sphere')
const order: string[] = []
for (const w of WAYPOINTS) { const id = resolve(w.form); if (!order.includes(id)) order.push(id) }
const forms: FormDef[] = order.map(id => FORMS[id]).filter(Boolean)

document.documentElement.classList.toggle('hide', q.get('hud') === '0')
const canvas = document.getElementById('c') as HTMLCanvasElement
const statsEl = document.getElementById('stats')!, label = document.getElementById('label')!
const scrub = document.getElementById('scrub') as HTMLInputElement
const field = createField(canvas, { forms, count: q.has('n') ? +q.get('n')! : undefined, onProgress: p => { if (p < 1) label.textContent = `building forms ${(p * 100) | 0}%` } })
if (q.has('t')) field.setTime?.(+q.get('t')!)

// ---- placeholders: the orb TV at the hub, one wire panel per area, the ring
const group = new THREE.Group()
{
  const hub = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x6a6a72, wireframe: true, transparent: true, opacity: 0.55 }))
  hub.position.set(...HUB); group.add(hub)
  const ringPts: THREE.Vector3[] = []
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.sin(a) * RING, 0, Math.cos(a) * RING)) }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x333338, transparent: true, opacity: 0.6 })))
  for (const a of AREAS) {
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9, 5.5, 1.2)), new THREE.LineBasicMaterial({ color: new THREE.Color(a.accent) }))
    box.position.set(...a.center); box.rotation.y = (a.angle * Math.PI) / 180; group.add(box)
    // the arc of small TVs
    a.projects.forEach((_, i, arr) => {
      const k = arr.length > 1 ? (i / (arr.length - 1) - 0.5) * 1.1 : 0
      const tv = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.4, 1.0, 0.3)), new THREE.LineBasicMaterial({ color: new THREE.Color(a.accent), transparent: true, opacity: 0.5 }))
      const ang = (a.angle * Math.PI) / 180 + k * 0.45
      tv.position.set(Math.sin(ang) * (RING - 6), a.height + 3.6 + Math.cos(k * 3) * 0.2, Math.cos(ang) * (RING - 6)); tv.rotation.y = ang; group.add(tv)
    })
  }
}
field.addObject(group)
group.visible = q.get('boxes') !== '0'
document.getElementById('boxes')!.onclick = e => { group.visible = !group.visible; (e.target as HTMLElement).classList.toggle('on', group.visible) }

// ---- scrubbing
const follower = new FlightFollower()
let useFollow = q.get('follow') === '1', goal = q.has('p') ? +q.get('p')! : 0
follower.snap(goal); scrub.value = String(goal)
const followBtn = document.getElementById('follow')!; followBtn.classList.toggle('on', useFollow)
followBtn.onclick = () => { useFollow = !useFollow; followBtn.classList.toggle('on', useFollow); follower.snap(goal) }
scrub.addEventListener('input', () => { goal = +scrub.value })
const marks = document.getElementById('marks')!
WAYPOINTS.forEach((w, i) => { const b = document.createElement('button'); b.textContent = w.id; b.onclick = () => { goal = waypointP(i); scrub.value = String(goal) }; marks.appendChild(b) })
let playing = q.get('auto') === '1'
const playBtn = document.getElementById('play')!, speed = +(q.get('speed') ?? 0.02)
const setPlay = (v: boolean) => { playing = v; playBtn.classList.toggle('on', v); playBtn.textContent = v ? 'stop' : 'fly' }
playBtn.onclick = () => setPlay(!playing); setPlay(playing)

let cur = flightAt(goal), last = performance.now()
function tick(now: number) {
  requestAnimationFrame(tick)
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  if (playing) { goal += dt * speed; if (goal > 1) goal = 0; scrub.value = String(goal) }
  const p = useFollow ? follower.update(goal, dt) : goal
  cur = flightAt(p)
  const m = field.shown
  field.setWorld({ a: FORMS[cur.a] ? cur.a : 'sphere', b: FORMS[cur.b] ? cur.b : 'sphere', mix: cur.mix, placeA: cur.placeA, placeB: cur.placeB, cam: cur.cam })
  const S = field.stats
  label.textContent = cur.dwelling ? `${WAYPOINTS[cur.wp].id} (${cur.area})  dwell ${(cur.local * 100).toFixed(0)}%` : `${WAYPOINTS[cur.wp].id} -> ${WAYPOINTS[cur.next].id}  t ${cur.t.toFixed(2)}`
  statsEl.textContent = `p ${p.toFixed(4)}   track ${SCROLL_VH.toFixed(1)} vh\nwaypoint ${WAYPOINTS[cur.wp].id}${cur.dwelling ? '' : ' -> ' + WAYPOINTS[cur.next].id}   area ${cur.area}\nform ${m.a} -> ${m.b}  shown ${m.mix.toFixed(2)}  goal ${cur.mix.toFixed(2)}\noverlay ${cur.overlay} -> ${cur.overlayNext}  k ${cur.overlayK.toFixed(2)}  speed ${cur.speed.toFixed(2)}  off ${powerOffAt(cur).toFixed(2)}\n${S.fps.toFixed(0)} fps  ${S.frameMs.toFixed(1)} ms (p95 ${S.p95Ms.toFixed(1)})  ${S.particles} particles  tier ${S.tier}  exp ${S.exposure.toFixed(2)}`
}
requestAnimationFrame(tick)
;(window as any).__flight = {
  field, flightAt, FlightFollower, SCROLL_VH, stats: () => ({ ...field.stats }),
  setP: (p: number) => { goal = p; follower.snap(p); scrub.value = String(p) },
  state: () => cur,
}
