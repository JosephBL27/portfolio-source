// UI lab (v4): the v4 UI layer over a PLACEHOLDER world (a faux particle ring tinted by the current area)
// and the REAL flight state machine (src/v3/world/flight.ts: flightAt + FlightFollower), exactly as main.ts feeds it.
// ?hold keeps the loader up   ?fast skips the fake loading   ?gate=0 enters silently   ?p=0.4 starts at that progress
import { WAYPOINTS, AREAS } from '../src/v3/world/layout'
import { initV4UI } from '../src/v3/ui/ui'
import { Track } from '../src/v3/ui/track'
import { flightAt, FlightFollower, waypointP } from '../src/v3/world/flight'

const q = new URLSearchParams(location.search)
const track = new Track(WAYPOINTS)
const ui = initV4UI({
  waypoints: WAYPOINTS,
  onOpen: (id, el) => { console.log('[lab] open', id); el?.setAttribute('data-opened', id) },
  onEnter: s => console.log('[lab] enter, sound =', s),
})

if (!q.has('hold')) {
  let p = q.has('fast') ? 1 : 0
  const iv = setInterval(() => {
    p += 0.1 + Math.random() * 0.12
    ui.setLoading(Math.min(p, 1))
    if (p >= 1) { clearInterval(iv); setTimeout(() => ui.ready(), q.has('fast') ? 0 : 250) }
  }, 110)
}
const p0 = +(q.get('p') ?? 0)
if (p0 > 0) addEventListener('load', () => window.scrollTo(0, p0 * (ui.scrollVh - 1) * innerHeight))

const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const cv = document.getElementById('field') as HTMLCanvasElement
const g = cv.getContext('2d')!
const N = 2600
const pts = Array.from({ length: N }, (_, i) => {
  const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 0.55 + Math.random() * 0.45
  return { x: Math.cos(th) * Math.sqrt(1 - u * u) * r, y: u * r, z: Math.sin(th) * Math.sqrt(1 - u * u) * r, s: 0.6 + Math.random() * 1.6, i }
})
let t = 0, shown = 0
function resize() { cv.width = innerWidth; cv.height = innerHeight }
resize(); addEventListener('resize', resize)
const smooth01 = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k) }

const follower = new FlightFollower()
let first = true, lastT = performance.now()

function loop(now: number) {
  requestAnimationFrame(loop)
  t += 0.016
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now
  const goal = ui.progress()
  if (first) { follower.snap(goal); first = false }
  shown = follower.update(goal, dt)
  const st = flightAt(shown)
  ui.setFlight({ ...st, form: st.t < 0.5 ? st.a : st.b })
  const w = WAYPOINTS[st.dwelling ? st.wp : (st.t < 0.5 ? st.wp : st.next)]
  const area = AREAS.find(a => a.id === w.area)
  const col = hex(area?.accent ?? '#EDE6D6')
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = '#050506'; g.fillRect(0, 0, cv.width, cv.height)
  g.globalCompositeOperation = 'lighter'
  const cx = cv.width * 0.5, cy = cv.height * 0.5, R = Math.min(cv.width, cv.height) * (0.34 + 0.06 * Math.sin(shown * 40))
  const a = t * 0.25 + shown * 30
  for (const q2 of pts) {
    const x = q2.x * Math.cos(a) - q2.z * Math.sin(a), z = q2.x * Math.sin(a) + q2.z * Math.cos(a)
    const k = 1 / (1.6 - z * 0.5)
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.16 + 0.18 * (z + 1)) * (q2.i % 7 === 0 ? 1.6 : 1)})`
    g.fillRect(cx + x * R * k * 1.5, cy + q2.y * R * k, q2.s, q2.s)
  }
  ui.setCamera(st.cam.pos, st.cam.target)
  // anchors for the featured TVs, spread on an arc
  const tvs = st.dwelling ? st.tvsA : []
  ui.setAnchors(tvs.map((id, k) => ({ id, label: id, x: innerWidth * (0.3 + 0.4 * (k + 0.5) / tvs.length), y: innerHeight * (0.62 - 0.1 * Math.sin((k + 0.5) / tvs.length * Math.PI)), visible: true })))
}
requestAnimationFrame(loop)
;(window as any).__ui = ui

;(window as any).__lab = { stops: WAYPOINTS.map((w, i) => ({ id: w.overlay, wp: w.id, p: waypointP(i), area: w.area })), segs: track.segs }
