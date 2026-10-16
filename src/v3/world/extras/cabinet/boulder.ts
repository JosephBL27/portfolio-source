// STAGE "hold": one photo-scanned boulder (Poly Haven "Namaqualand Boulder 03", CC0, Jenelle van Heerden + Dario Barresi; decimated to 30k triangles and Draco / WebP
// compressed by scripts/blender/boulder_prep.py) standing in a bouldering forest (spaces/hold.ts + the baked field, spaces/hold-field.ts), two crash pads in its landing
// zone and a route of five chalked holds. The plywood wall (cabinet/climb.ts) stays the fallback when the GLB is missing.
// W23 "Send the V8", a playable climb (a Simulation; data-proof skip): a rigged climber (cabinet/climber.ts, Quaternius CC0, posed by two-bone IK) climbs the route one
// move per press (a chalked hold, the "Next move" button, the C key, or the hidden "Climb" action):
//   reach, reach, match, DYNO (the climber pumps; a timing meter swings with the hips; release while the needle is in the lit zone at the top of the swing to catch the
//   high hold, too early or too late and she comes off onto the pads: the pad squashes, chalk flies, she pulls back on), reach, match the lip = the send: "Sent · V8", the
//   camera pulls back over the forest (extras/climbcam.ts reads window.__holdCam), she drops onto the pad and claps (the pack's own clip). "Climb again" restarts.
// W24 winnability (measured with a human-timed automated player, reaction 200-350 ms: before, a 150 ms window and 1 first-try send in 5; after, 600 ms and 5 in 5): the dyno
// window was shorter than a reaction and stopped short of the very top, so "release at the top of the swing" fell. Now the meter is a cosine pendulum (SWING) that lingers at the top: the lit zone is needle >= ZONE_LO, about 590 ms per pass,
// plus GRACE of forgiven input latency; each fall lights a little more of the meter; a press during a move is remembered (BUFFER); a press in the first ARM ms of the charge
// (a tap arriving twice) is ignored. Inputs: a hold, the rock, the HUD button (on pointerdown), Space or Enter on the button, or C (claimed at this stop: it would otherwise
// open the Contact sheet, nav.ts). The meter is a function of time, judged with the same function that draws it. Needle, zone and the judge share one source of truth.
// All the other motion is anime.js 4 (timelines of plain objects: the four contacts, the pelvis, the pad, the camera pull). Reduced motion: every press steps straight to
// the next position, the dyno always catches, no fall, no camera move, no meter swing.
// Cursor, hit testing and presence come from cabinet.ts; the contract is cabinet/stage.ts. Colours are the photograph's own (the diffuse map is read un-decoded).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { animate, createTimeline, stagger, type JSAnimation, type Timeline } from 'animejs'
import type { FlightState } from '../../flight'
import { loadGLB } from '../../glbmodel'
import { holdEnv } from '../spaces/hold'
import { PADS } from '../spaces/hold-field'
import { canvasTex, D, disposeTree, enter, sstep, precompile, type Kit } from './kit'
import type { Stage } from './stage'
import { createClimb } from './climb'
import { loadClimber, type Climber } from './climber'

const H_TARGET = 3.3                    // boulder height in scene units (metres)
const YAW = 0.5                         // boulder yaw (rad), chosen so the best face looks at the camera
// the route: (fraction across the boulder's visible width, fraction of its height), found on the camera-facing surface by rays
//   0 start (both hands)   1 right-hand crimp   2 left-hand sloper (then matched)   3 the dyno jug   4 the lip (the finish, matched)
const ROUTE: [number, number][] = [[0.4, 0.3], [0.52, 0.47], [0.4, 0.62], [0.47, 0.86], [0.42, 0.97]]
const N_ROUTE = ROUTE.length
type Hand = 'lh' | 'rh'
interface Move { kind: 'reach' | 'match' | 'dyno'; hand?: Hand; hold: number; label: string }
const MOVES: Move[] = [
  { kind: 'reach', hand: 'rh', hold: 1, label: 'Right hand up to the crimp' },
  { kind: 'reach', hand: 'lh', hold: 2, label: 'Left hand across to the sloper' },
  { kind: 'match', hand: 'rh', hold: 2, label: 'Match the sloper' },
  { kind: 'dyno', hold: 3, label: 'Dyno for the jug' },
  { kind: 'reach', hand: 'lh', hold: 4, label: 'Left hand to the lip' },
  { kind: 'match', hand: 'rh', hold: 4, label: 'Match the lip to send' },
]
// the dyno's pendulum: the needle climbs from hips-low (0) to hips-high (1) in SWING ms along a cosine, so it lingers at the top. The lit zone is the top of the swing
// (needle >= the zone's low edge); with ZONE_LO 0.8 the needle is inside it for ~590 ms per pass, well over a human reaction (200-350 ms): see it enter, press, catch.
const SWING = 1000
const ZONE_LO = 0.8
const ZONE_WIDEN = 0.04, ZONE_WIDEN_MAX = 3      // each fall lights 4% more of the meter, three falls at most: the pads are kind
const GRACE = 70                                 // ms of input latency forgiven at either edge of the zone (a phone's touch pipeline adds 50-100 ms nobody can see)
const ARM = 380                                  // ms after the charge starts during which a press is ignored (one tap delivered twice, a stray double click)
const BUFFER = 700                               // a press during a move is remembered this long and played the moment she is ready
const vAt = (ms: number) => 0.5 - 0.5 * Math.cos((Math.PI * ms) / SWING)                                  // the meter, as a function of time since the charge began
const zoneHalf = (lo: number) => (SWING * (Math.PI - Math.acos(1 - 2 * lo))) / Math.PI                    // ms either side of a peak that the needle is inside the zone
/** judge a release `ms` after the charge began against a zone starting at `lo`: in the lit zone (+ GRACE), and if not, whether the swing was still rising (too early) */
function judge(ms: number, lo: number): { good: boolean; early: boolean; v: number } {
  const ph = ((ms % (2 * SWING)) + 2 * SWING) % (2 * SWING)
  return { good: Math.abs(ph - SWING) <= zoneHalf(lo) + GRACE, early: ph < SWING, v: vAt(ms) }
}

function chalkMark(seed: number, hand = true) {
  return canvasTex(256, 256, (g, w, h) => {
    let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    g.clearRect(0, 0, w, h)
    const gr = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2)
    gr.addColorStop(0, 'rgba(250,247,238,0.55)'); gr.addColorStop(0.55, 'rgba(244,240,230,0.26)'); gr.addColorStop(1, 'rgba(240,236,226,0)')
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 520; i++) { const a = rnd() * 6.283, r = Math.pow(rnd(), 0.7) * w * 0.46; g.fillStyle = `rgba(252,250,244,${(0.12 + rnd() * 0.4).toFixed(2)})`; g.beginPath(); g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 0.8 + rnd() * 2.4, 0, 7); g.fill() }
    if (hand) for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.45 + rnd() * 0.1; g.fillStyle = 'rgba(250,248,240,0.4)'; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 62, h / 2 + Math.sin(a) * 62, 13, 20, a + 1.57, 0, 7); g.fill() }
  })
}

/** a crash pad's cover: cordura weave, a darker hinge seam, scuffs and chalk handprints (canvas, sRGB) */
function padCover(base: string, seam: string, seed: number) {
  return canvasTex(512, 512, (g, w, h) => {
    let s = seed * 7919 + 13; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${(0.05 + rnd() * 0.05).toFixed(3)})`; g.fillRect(0, y, w, 1) }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${(0.02 + rnd() * 0.03).toFixed(3)})`; g.fillRect(x, 0, 1, h) }
    g.fillStyle = seam; g.fillRect(w / 2 - 3, 0, 6, h)
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(240,236,226,${(0.04 + rnd() * 0.1).toFixed(3)})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 26, 4 + rnd() * 14, rnd() * 3, 0, 7); g.fill() }
    for (let i = 0; i < 3; i++) { const x = 80 + rnd() * 340, y = 80 + rnd() * 340; g.fillStyle = 'rgba(245,242,234,0.22)'; g.beginPath(); g.ellipse(x, y, 16, 22, rnd(), 0, 7); g.fill(); for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(x - 14 + f * 9, y - 30, 4, 9, 0, 0, 7); g.fill() } }
  })
}

interface Hud { root: HTMLElement; label: HTMLElement; count: HTMLElement; move: HTMLElement; meter: HTMLElement; zone: HTMLElement; needle: HTMLElement; go: HTMLButtonElement; sent: HTMLElement; arm(lo: number): void; burst(): void; fresh(): boolean; dispose(): void }
/** the game's HUD. The button plays on pointerdown (a tap is not waiting for the finger to lift) and swallows the click that follows; Space / Enter on it play on keydown.
 *  `fresh()` is true while the same pointerdown is still being delivered to the page, so cabinet.ts's own press handler does not play it a second time. */
function makeHud(onGo: () => void): Hud {
  const css = document.createElement('style'); css.id = 'climb-hud-css'
  css.textContent = `
  .climb-hud{position:fixed;left:clamp(16px,3.2vw,44px);bottom:calc(112px + env(safe-area-inset-bottom));z-index:41;display:grid;gap:10px;justify-items:start;max-width:min(300px,80vw);
    padding:14px 16px 14px;border-radius:14px;background:color-mix(in srgb,#050506 58%,transparent);border:1px solid color-mix(in srgb,#EDE6D6 16%,transparent);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#EDE6D6;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease,border-color .5s ease,box-shadow .5s ease;pointer-events:none;touch-action:manipulation}
  .climb-hud.on{opacity:1;transform:none;pointer-events:auto}
  .climb-hud.sent{border-color:color-mix(in srgb,#FFF6DE 62%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,#FFF6DE 18%,transparent),0 0 44px color-mix(in srgb,#FFF6DE 16%,transparent)}
  .climb-hud .ch-k{margin:0;font:500 11px/1.2 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,#EDE6D6 74%,transparent)}
  .climb-hud .ch-move{margin:0;font:400 21px/1.2 "Instrument Serif",Georgia,serif;letter-spacing:.005em;min-height:1.25em}
  .climb-hud.sent .ch-move{font:600 30px/1.1 "Bodoni Moda Variable","Bodoni Moda","Bodoni 72",Didot,serif;font-variation-settings:'opsz' 44;color:#FFF6DE}
  .climb-hud .ch-meter{position:relative;width:min(260px,100%);height:12px;border-radius:999px;border:1px solid color-mix(in srgb,#EDE6D6 34%,transparent);background:color-mix(in srgb,#EDE6D6 6%,transparent)}
  .climb-hud .ch-meter[hidden]{display:none}
  .climb-hud .ch-zone{position:absolute;top:1px;bottom:1px;left:${(ZONE_LO * 100).toFixed(1)}%;width:${((1 - ZONE_LO) * 100).toFixed(1)}%;border-radius:999px;background:color-mix(in srgb,#EDE6D6 52%,transparent);
    box-shadow:0 0 0 1px color-mix(in srgb,#FFF6DE 55%,transparent);transition:background .12s ease,box-shadow .12s ease}
  .climb-hud .ch-meter.hit .ch-zone{background:#FFF6DE;box-shadow:0 0 0 1px #FFF6DE,0 0 16px 3px color-mix(in srgb,#FFF6DE 62%,transparent)}
  .climb-hud .ch-needle{position:absolute;top:-5px;width:3px;height:20px;margin-left:-1.5px;left:0;background:#FFF6DE;border-radius:2px;box-shadow:0 0 6px color-mix(in srgb,#FFF6DE 60%,transparent)}
  .climb-hud .ch-next{appearance:none;cursor:pointer;padding:10px 16px;border-radius:999px;border:1px solid color-mix(in srgb,#EDE6D6 40%,transparent);background:rgba(5,5,6,.62);color:#EDE6D6;touch-action:manipulation;
    font:600 13px/1 "Archivo Variable",Archivo,system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap;transition:background .2s ease,border-color .2s ease,transform .16s ease}
  .climb-hud .ch-next:hover{background:rgba(237,230,214,.12);border-color:color-mix(in srgb,#EDE6D6 70%,transparent)}
  .climb-hud .ch-next:active{transform:scale(.97)}
  .climb-hud .ch-next:focus-visible{outline:2px solid #FFF6DE;outline-offset:3px}
  .climb-hud.sent .ch-next{background:#FFF6DE;color:#0B0A08;border-color:#FFF6DE}
  .climb-hud .ch-row{display:flex;align-items:center;gap:12px}
  .climb-hud .ch-n{font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.08em;color:color-mix(in srgb,#EDE6D6 74%,transparent)}
  .climb-hud .ch-next kbd{margin-left:8px;font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;color:color-mix(in srgb,#EDE6D6 74%,transparent)}
  .climb-hud.sent .ch-next kbd{color:color-mix(in srgb,#0B0A08 70%,transparent)}
  .climb-sent{position:fixed;left:50%;top:21vh;z-index:29;transform:translate(-50%,10px) scale(.94);margin:0;pointer-events:none;opacity:0;transition:opacity .9s ease,transform 1.1s cubic-bezier(.2,.8,.2,1);
    font-family:"Bodoni Moda Variable","Bodoni Moda","Bodoni 72",Didot,serif;font-weight:600;font-variation-settings:'opsz' 44;font-size:clamp(64px,6.2vw,76px);line-height:1;letter-spacing:-.015em;color:#FFF6DE;
    text-shadow:0 2px 30px rgba(5,5,6,.55);white-space:nowrap}
  .climb-sent.on{opacity:.94;transform:translate(-50%,0) scale(1)}
  .climb-sent i{font-style:normal;opacity:.6;margin:0 .22em}
  .climb-burst{position:fixed;left:50%;top:calc(21vh + 40px);width:0;height:0;z-index:29;pointer-events:none}
  .climb-burst i{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:#FFF6DE;opacity:0}
  html.rm .climb-hud,html.rm .climb-sent{transition:none}
  @media (pointer:coarse){.climb-hud .ch-next{min-height:46px;padding:12px 20px}.climb-hud .ch-next kbd{display:none}}
  @media (max-width:760px){
    .climb-hud{top:calc(70px + env(safe-area-inset-top));bottom:auto;left:12px;right:12px;max-width:none;justify-items:stretch;gap:8px;padding:11px 14px 12px}
    .climb-hud .ch-meter{width:100%}.climb-hud .ch-move{font-size:20px;min-height:0}
    .climb-hud.sent .ch-move{font-size:34px}
    .climb-hud .ch-row{display:grid;grid-template-columns:1fr auto}.climb-hud .ch-next{min-height:46px;padding:12px 16px;font-size:15px}
    .climb-sent{display:none}.climb-burst{top:calc(70px + env(safe-area-inset-top) + 58px)}
  }`
  document.head.append(css)
  const root = document.createElement('div'); root.className = 'climb-hud'; root.setAttribute('data-proof', 'skip'); root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Send the V8, a climbing simulation')
  root.innerHTML = '<p class="ch-k">Simulation · Send the V8</p><p class="ch-move" aria-live="polite"></p><div class="ch-meter" hidden aria-hidden="true"><i class="ch-zone"></i><i class="ch-needle"></i></div><div class="ch-row"><button type="button" class="ch-next">Next move<kbd>C</kbd></button><span class="ch-n"></span></div>'
  const sent = document.createElement('p'); sent.className = 'climb-sent'; sent.setAttribute('data-proof', 'skip'); sent.setAttribute('aria-hidden', 'true'); sent.innerHTML = 'Sent<i>·</i>V8'
  const wrap = document.createElement('div'); wrap.className = 'climb-burst'; wrap.setAttribute('data-proof', 'skip'); wrap.setAttribute('aria-hidden', 'true')
  document.body.append(root, sent, wrap)
  const go = root.querySelector('.ch-next') as HTMLButtonElement, meter = root.querySelector('.ch-meter') as HTMLElement, zone = root.querySelector('.ch-zone') as HTMLElement, needle = root.querySelector('.ch-needle') as HTMLElement
  let pdAt = -1e9
  const onDown = (e: PointerEvent) => { if (e.button > 0) return; pdAt = performance.now(); onGo() }
  const onClick = (e: MouseEvent) => { if (e.detail > 0 && performance.now() - pdAt < 2500) return; onGo() }              // the click after a pointerdown was played already; keyboard and assistive clicks (detail 0) play
  const onKeyDown = (e: KeyboardEvent) => { if ((e.key !== ' ' && e.key !== 'Enter') || e.metaKey || e.ctrlKey || e.altKey) return; e.preventDefault(); if (!e.repeat) onGo() }
  go.addEventListener('pointerdown', onDown); go.addEventListener('click', onClick); go.addEventListener('keydown', onKeyDown)
  return {
    root, label: root.querySelector('.ch-k') as HTMLElement, count: root.querySelector('.ch-n') as HTMLElement, move: root.querySelector('.ch-move') as HTMLElement, meter, zone, needle, go, sent,
    arm(lo) { zone.style.left = (lo * 100).toFixed(2) + '%'; zone.style.width = ((1 - lo) * 100).toFixed(2) + '%'; needle.style.left = '0%'; meter.classList.remove('hit') },
    fresh: () => performance.now() - pdAt < 40,
    /** the send: a ring of chalk specks thrown out from behind the headline (anime.js; never under reduced motion, the stage skips the call) */
    burst() {
      const n = 22, specks = Array.from({ length: n }, () => { const d = document.createElement('i'); wrap.append(d); return d })
      animate(specks, {
        x: (_?: unknown, i = 0) => Math.cos((i / n) * 6.2832 + 0.2) * (170 + (i % 3) * 60), y: (_?: unknown, i = 0) => Math.sin((i / n) * 6.2832 + 0.2) * (110 + (i % 3) * 40),
        opacity: [{ to: 0.9, duration: 90 }, { to: 0, duration: 1300 }], scale: [1.2, 0.3], duration: 1400, ease: 'out(3)', delay: stagger(14),
        onComplete: () => { for (const d of specks) d.remove() },
      })
    },
    dispose() { go.removeEventListener('pointerdown', onDown); go.removeEventListener('click', onClick); go.removeEventListener('keydown', onKeyDown); root.remove(); sent.remove(); wrap.remove(); css.remove() },
  }
}

function boulderStage(): Stage {
  const root = new THREE.Group(); root.name = 'cab-hold'
  root.userData.contactShadow = { size: 7, opacity: 0.35 }
  let kit: Kit, built = false
  const rock = new THREE.Group()
  const marks: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; at: THREE.Vector3; n: THREE.Vector3 }[] = []
  const pick: THREE.Object3D[] = []
  const puffs: { s: THREE.Sprite; t: number }[] = []
  const pads: THREE.Mesh[] = []
  let boulder: THREE.Mesh, climber: Climber | null = null, hud: Hud | null = null
  let dims = { w: 3, h: H_TARGET, d: 2 }, now = 0, hot = -1, lastTick = 0, present = false
  // game state
  type State = 'idle' | 'busy' | 'charge' | 'sent' | 'down'
  let state: State = 'idle', step = 0, hands: Record<Hand, number> = { lh: 0, rh: 0 }, tries = 0, busySince = 0, lastState: State = 'idle'
  let chargeT0 = 0, falls = 0, miss: '' | 'early' | 'late' = '', queuedAt = 0, zoneLo = ZONE_LO, inZoneNow = false
  let last: { ms: number; v: number; good: boolean; lo: number } | null = null                // the latest release, for tests
  let focusedByUs = false                                                                   // the charge moved focus onto the HUD button so Space lands there; the send hands it back
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)) }
  const meter = { v: 0 }, cam = { k: 0, near: 0, fy: 0 }               // k: the send's pull-back; near: the lean-in while a climb is under way (extras/climbcam.ts)
  let nearAnim: JSAnimation | null = null
  const lean = (to: number) => { if (kit.reduced() || cam.near === to) return; nearAnim?.pause(); nearAnim = track(animate(cam, { near: to, duration: to ? 1400 : 1800, ease: 'inOut(3)' })) }
  let tl: Timeline | null = null, camAnim: JSAnimation | null = null
  const anims: (JSAnimation | Timeline)[] = []
  const track = <T extends JSAnimation | Timeline>(a: T): T => { anims.push(a); if (anims.length > 40) anims.splice(0, anims.length - 40); return a }
  const rc = new THREE.Raycaster(), wallN = new THREE.Vector3(0, 0, 1), focus = new THREE.Vector3()
  ;(window as unknown as { __holdCam: typeof cam }).__holdCam = cam

  /** the boulder's surface seen from the camera side at (x, y) of the stage frame: point + outward normal (null: the ray missed) */
  function surf(x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } | null {
    root.updateMatrixWorld(true)
    const o = new THREE.Vector3(x, y, dims.d * 2 + 4).applyMatrix4(root.matrixWorld), d = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld)
    rc.set(o, d)
    const hit = rc.intersectObject(boulder, false)[0]
    if (!hit) return null
    const p = root.worldToLocal(hit.point.clone())
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const n = hit.face ? hit.face.normal.clone().transformDirection(boulder.matrixWorld).transformDirection(inv).normalize() : new THREE.Vector3(0, 0, 1)
    return { p, n }
  }
  const handAt = (i: number, hand: Hand, both: boolean) => {
    const mk = marks[i], side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), mk.n).normalize()      // screen-right along the wall
    return mk.at.clone().addScaledVector(side, both ? (hand === 'rh' ? 0.075 : -0.075) : 0)
  }
  /** where the feet go for a pair of hand holds: low and under the body, on the rock */
  function feetFor(lh: THREE.Vector3, rh: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
    const lowY = Math.min(lh.y, rh.y), cx = (lh.x + rh.x) / 2, y = Math.max(0.24, lowY - 1.02)
    const f = (dx: number, dy: number) => surf(cx + dx, y + dy)?.p ?? new THREE.Vector3(cx + dx, y + dy, (lh.z + rh.z) / 2 - 0.2)
    return [f(-0.25, 0.08), f(0.21, 0)]
  }
  const stanceAfter = (k: number) => {          // hands after k moves
    const h: Record<Hand, number> = { lh: 0, rh: 0 }
    for (let i = 0; i < k; i++) { const m = MOVES[i]; if (m.kind === 'dyno') { h.lh = m.hold; h.rh = m.hold } else h[m.hand!] = m.hold }
    return h
  }
  const both = (h: Record<Hand, number>) => h.lh === h.rh
  function placeStance(k: number) {
    if (!climber) return
    const h = stanceAfter(k), lh = handAt(h.lh, 'lh', both(h)), rh = handAt(h.rh, 'rh', both(h)), [lf, rf] = feetFor(lh, rh)
    climber.pose.lh.copy(lh); climber.pose.rh.copy(rh); climber.pose.lf.copy(lf); climber.pose.rf.copy(rf); climber.pose.off.set(0, 0, 0)
    climber.wall.k = 1; climber.turn.a = 0; climber.clip(null)
    hands = h
  }
  const puffAt = (p: THREE.Vector3, time = now) => {
    const pf = puffs.find(q => time - q.t > 1.4) ?? puffs[0]
    pf.t = time; pf.s.position.copy(p); pf.s.visible = true
  }
  const label = () => {
    if (!hud) return
    const m = MOVES[step], over = state === 'sent' || state === 'down'
    hud.move.textContent = over ? (phoneLayout() ? 'Sent · V8' : 'Sent')
      : state === 'charge' ? (inZoneNow ? 'Now' : 'Release in the bright zone')
      : state === 'busy' && miss ? (miss === 'early' ? 'Too early. Off onto the pads' : 'Too late. Off onto the pads')
      : state === 'idle' && miss && m?.kind === 'dyno' ? 'Back on the wall. Dyno again' : m ? m.label : ''
    hud.count.textContent = over ? `${MOVES.length} / ${MOVES.length} · ${falls === 0 ? 'first go' : falls + (falls === 1 ? ' fall' : ' falls')}` : `${step + 1} / ${MOVES.length}`
    hud.go.firstChild!.textContent = over ? 'Climb again' : state === 'charge' ? 'Release' : miss && m?.kind === 'dyno' ? 'Dyno again' : 'Next move'
    hud.meter.hidden = state !== 'charge'
    hud.root.classList.toggle('sent', over)
  }
  const phoneLayout = () => window.matchMedia('(max-width: 760px)').matches

  /** a limb travels from a to b on an arc off the wall (anime.js drives t; onUpdate writes the target) */
  function limb(t: Timeline, target: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, at: number, dur: number, lift = 0.16, ease = 'inOut(3)') {
    const o = { t: 0 }, n = wallN
    t.add(o, { t: 1, duration: dur, ease, onUpdate: () => { const e = o.t; target.lerpVectors(a, b, e).addScaledVector(n, lift * Math.sin(Math.PI * e)) } }, at)
  }

  function next(): string {
    if (!climber || !built) return ''
    const rm = kit.reduced()
    if (state === 'busy') { queuedAt = performance.now(); return '' }                  // she is mid-move: remember the press, play it when she is ready (BUFFER)
    if (state === 'sent' || state === 'down') { restart(); return 'Back at the start of the problem.' }
    if (state === 'charge') return release()
    const m = MOVES[step]
    if (!m) return ''
    if (m.kind === 'dyno') {
      if (rm) { step++; placeStance(step); puffAt(marks[m.hold].at); kit.emit('cab:grab', { i: m.hold }); label(); return 'Dyno caught: both hands on the high hold. Reduced motion skips the timing.' }
      // the charge: hips sink and rise with the meter (update() writes both from the clock); the meter starts low and the lit zone is the top of the swing
      state = 'charge'; chargeT0 = performance.now(); meter.v = 0; miss = ''; inZoneNow = false
      zoneLo = ZONE_LO - ZONE_WIDEN * Math.min(falls, ZONE_WIDEN_MAX)
      hud?.arm(zoneLo); label()
      if (hud && document.activeElement !== hud.go) { hud.go.focus({ preventScroll: true }); focusedByUs = true }      // Space / Enter now land on the button (the tour's own Space would fly her away)
      return 'Dyno: release when the needle is in the bright zone at the top of the swing.'
    }
    const from = stanceAfter(step), to = stanceAfter(step + 1)
    const a = { lh: handAt(from.lh, 'lh', both(from)), rh: handAt(from.rh, 'rh', both(from)) }, b = { lh: handAt(to.lh, 'lh', both(to)), rh: handAt(to.rh, 'rh', both(to)) }
    const [lf0, rf0] = feetFor(a.lh, a.rh), [lf1, rf1] = feetFor(b.lh, b.rh)
    const done = () => { hands = to; step++; state = step >= MOVES.length ? 'sent' : 'idle'; if (state === 'sent') send(); label() }
    if (rm) { placeStance(step + 1); puffAt(marks[m.hold].at); kit.emit('cab:grab', { i: m.hold }); done(); return m.label + '.' }
    state = 'busy'; lean(1)
    const p = climber.pose, other: Hand = m.hand === 'lh' ? 'rh' : 'lh'
    tl = track(createTimeline({ onComplete: done }))
    limb(tl, p[m.hand!], a[m.hand!], b[m.hand!], 0, m.kind === 'match' ? 420 : 560, m.kind === 'match' ? 0.06 : 0.17)
    if (m.kind === 'match') limb(tl, p[other], a[other], b[other], 0, 420, 0.04)
    tl.call(() => { puffAt(marks[m.hold].at); kit.emit('cab:grab', { i: m.hold }) }, m.kind === 'match' ? 400 : 540)
    limb(tl, p.lf, lf0, lf1, 330, 380, 0.1); limb(tl, p.rf, rf0, rf1, 520, 380, 0.1)
    kit.emit('obj:move', { i: m.hold })
    return m.label + '.'
  }

  function release(): string {
    if (!climber || state !== 'charge') return ''
    const ms = performance.now() - chargeT0
    if (ms < ARM) return ''                                                              // the same press delivered twice, or a stray double click: not a release
    const j = judge(ms, zoneLo), good = j.good
    last = { ms: Math.round(ms), v: +j.v.toFixed(3), good, lo: +zoneLo.toFixed(3) }; meter.v = j.v
    if (!good) { miss = j.early ? 'early' : 'late'; falls++ }
    state = 'busy'; tries++; label()
    const p = climber.pose, from = stanceAfter(step), to = stanceAfter(step + 1)
    const a = { lh: handAt(from.lh, 'lh', true), rh: handAt(from.rh, 'rh', true) }, b = { lh: handAt(to.lh, 'lh', true), rh: handAt(to.rh, 'rh', true) }
    const [lf0, rf0] = [p.lf.clone(), p.rf.clone()], [lf1, rf1] = feetFor(b.lh, b.rh)
    const off0 = p.off.clone(), drive = { y: off0.y, z: off0.z }
    const setOff = () => p.off.set(0, drive.y, drive.z)
    kit.emit('obj:move', { i: 3 })
    if (good) {
      tl = track(createTimeline({ onComplete: () => { hands = to; step++; state = 'idle'; label() } }))
      tl.add(drive, { y: 0.42, z: -0.04, duration: 300, ease: 'out(3)', onUpdate: setOff }, 0)
      limb(tl, p.lh, a.lh, b.lh, 90, 330, 0.12, 'out(2)'); limb(tl, p.rh, a.rh, b.rh, 90, 330, 0.12, 'out(2)')
      // feet cut loose as the hands land, swing under, and come back to the rock
      const cutL = lf0.clone().addScaledVector(wallN, 0.42).add(new THREE.Vector3(-0.08, -0.12, 0)), cutR = rf0.clone().addScaledVector(wallN, 0.46).add(new THREE.Vector3(0.1, -0.16, 0))
      limb(tl, p.lf, lf0, cutL, 220, 260, 0.05, 'out(2)'); limb(tl, p.rf, rf0, cutR, 220, 260, 0.05, 'out(2)')
      tl.call(() => { puffAt(marks[3].at); kit.emit('cab:grab', { i: 3 }) }, 420)
      tl.add(drive, { y: 0, z: 0, duration: 620, ease: 'outBack(1.6)', onUpdate: setOff }, 420)
      limb(tl, p.lf, cutL, lf1, 560, 460, 0.06, 'outBack(1.3)'); limb(tl, p.rf, cutR, rf1, 640, 460, 0.06, 'outBack(1.3)')
      return 'Caught it. Both hands on the high hold.'
    }
    // the miss: the hands come up short, then she is off
    const shortL = b.lh.clone().lerp(a.lh, 0.42).addScaledVector(wallN, 0.12), shortR = b.rh.clone().lerp(a.rh, 0.42).addScaledVector(wallN, 0.12)
    tl = track(createTimeline())
    tl.add(drive, { y: j.early ? 0.16 : 0.26, duration: 260, ease: 'out(2)', onUpdate: setOff }, 0)
    limb(tl, p.lh, a.lh, shortL, 60, 300, 0.1, 'out(2)'); limb(tl, p.rh, a.rh, shortR, 60, 300, 0.1, 'out(2)')
    tl.call(() => fall(), 360)
    return j.early ? 'Too early. Off the wall onto the pads.' : 'Too late. Off the wall onto the pads.'
  }

  /** off the wall: the pelvis goes free, falls onto the first pad, the pad squashes and springs back, then she pulls back on below the dyno */
  function fall() {
    if (!climber) return
    const p = climber.pose, start = climber.pelvis(), pad = pads[0]
    const top = pad.position.y + pad.userData.h, land = new THREE.Vector3(pad.position.x + 0.3, top + 0.16, pad.position.z - 0.15)
    p.free.copy(start); climber.wall.k = 0
    const o = { t: 0 }, arms = () => {             // limbs ride the body: arms up, legs hanging, then out along the pad as she sits
      const f = p.free, k = o.t, dy = 0.42 - 0.3 * k, dz = 0.25 + 0.4 * k
      p.lh.set(f.x - 0.3, f.y + 0.82 - 0.25 * k, f.z - 0.12 + 0.2 * k); p.rh.set(f.x + 0.32, f.y + 0.8 - 0.25 * k, f.z - 0.1 + 0.2 * k)
      p.lf.set(f.x - 0.2, Math.max(top + 0.05, f.y - dy), f.z + dz); p.rf.set(f.x + 0.22, Math.max(top + 0.05, f.y - dy + 0.02), f.z + dz + 0.04)
    }
    tl = track(createTimeline({ onComplete: () => later(pullOn, 450) }))
    tl.add(o, { t: 1, duration: 560, ease: 'in(2)', onUpdate: () => { p.free.lerpVectors(start, land, o.t); p.free.y += 0.18 * Math.sin(Math.PI * o.t * 0.5); arms() } }, 0)
    tl.call(() => { puffAt(land.clone().setY(top + 0.05)); kit.emit('cab:grab', { i: 0 }) }, 560)
    tl.add(pad.scale, { y: [1, 0.58, 1.07, 1], duration: 760, ease: 'out(2)' }, 560)
    const b = { y: 0 }
    tl.add(b, { y: [0, -0.16, 0.12, 0], duration: 760, ease: 'out(2)', onUpdate: () => { p.free.copy(land).y += b.y; arms() } }, 560)
  }
  function pullOn() {
    if (!climber) return
    const p = climber.pose, k = step, h = stanceAfter(k)
    const lh = handAt(h.lh, 'lh', both(h)), rh = handAt(h.rh, 'rh', both(h)), [lf, rf] = feetFor(lh, rh)
    const a = { lh: p.lh.clone(), rh: p.rh.clone(), lf: p.lf.clone(), rf: p.rf.clone() }
    tl = track(createTimeline({ onComplete: () => { state = 'idle'; label() } }))
    tl.add(climber.wall, { k: 1, duration: 800, ease: 'inOut(3)' }, 0)
    limb(tl, p.lh, a.lh, lh, 0, 620, 0.1); limb(tl, p.rh, a.rh, rh, 70, 620, 0.1); limb(tl, p.lf, a.lf, lf, 220, 520, 0.08); limb(tl, p.rf, a.rf, rf, 300, 500, 0.08)
    p.off.set(0, 0, 0)
  }

  function send() {
    if (!climber || !hud) return
    const rm = kit.reduced()
    hud.sent.classList.add('on')
    if (focusedByUs && document.activeElement === hud.go) hud.go.blur()                  // sent: Space goes back to stepping the tour
    focusedByUs = false
    kit.emit('cab:grab', { i: 4 })
    if (!rm) for (let k = 0; k < 7; k++) later(() => { if (state !== 'sent' && state !== 'down') return; const at = marks[N_ROUTE - 1].at; puffAt(new THREE.Vector3(at.x + (Math.random() - 0.5) * 1.1, at.y + 0.1 + Math.random() * 0.7, at.z + 0.1)) }, 120 + k * 150)     // the chalk goes up
    if (rm) return
    hud.burst(); lean(0)
    camAnim = track(animate(cam, { k: [0, 1], duration: 2600, ease: 'inOut(3)' }))
    const p = climber.pose, pad = pads[1]
    later(() => {
      if (state !== 'sent' || !climber) return
      state = 'down'
      const start = climber.pelvis(), land = new THREE.Vector3(pad.position.x - 0.1, pad.position.y + pad.userData.h, pad.position.z + 0.05)
      p.free.copy(start); climber.wall.k = 0
      const o = { t: 0 }
      const t2 = track(createTimeline())
      t2.add(o, { t: 1, duration: 760, ease: 'in(1.6)', onUpdate: () => {
        const f = p.free.lerpVectors(start, land.clone().setY(land.y + 0.62), o.t); f.y += 0.5 * Math.sin(Math.PI * o.t)
        p.lh.set(f.x - 0.32, f.y + 0.7, f.z); p.rh.set(f.x + 0.32, f.y + 0.7, f.z); p.lf.set(f.x - 0.18, f.y - 0.55, f.z + 0.15); p.rf.set(f.x + 0.18, f.y - 0.55, f.z + 0.15)
      } }, 0)
      t2.call(() => { puffAt(land.clone().setY(land.y + 0.05)); climber!.pose.free.copy(land); climber!.clip('Clapping') }, 760)
      t2.add(pad.scale, { y: [1, 0.66, 1.05, 1], duration: 700, ease: 'out(2)' }, 760)
      t2.add(climber!.turn, { a: Math.PI, duration: 620, ease: 'inOut(3)' }, 820)
      camAnim = track(animate(cam, { k: 0, duration: 2400, ease: 'inOut(3)', delay: 5200 }))
    }, 1700)
  }
  function restart() {
    for (const a of anims) a.pause()
    anims.length = 0
    for (const t of timers) window.clearTimeout(t)
    timers.length = 0
    cam.k = 0; hud?.sent.classList.remove('on'); if (kit.reduced()) cam.near = 0; else lean(0)
    step = 0; state = 'idle'; tries = 0; falls = 0; miss = ''; queuedAt = 0; inZoneNow = false; last = null
    for (const pd of pads) pd.scale.set(1, 1, 1)
    placeStance(0); label()
  }

  async function build(k: Kit) {
    kit = k
    const scene = await loadGLB('namaqualand-boulder-03')
    if (!scene) throw new Error('boulder glb unavailable')
    const env = await holdEnv(k.renderer)
    let mesh: THREE.Mesh | null = null
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh })
    if (!mesh) throw new Error('boulder glb has no mesh')
    const m = mesh as THREE.Mesh, src = m.material as THREE.MeshStandardMaterial
    if (src.map) src.map.colorSpace = THREE.NoColorSpace                     // display-referred: the photograph's own colours, no decode
    src.envMap = env; src.envMapIntensity = 0.85; src.metalness = 0; src.color.setRGB(1.0, 1.0, 1.0, THREE.LinearSRGBColorSpace)
    if (src.normalScale) src.normalScale.set(1.1, 1.1)
    m.geometry.computeBoundingBox()
    const bb = m.geometry.boundingBox!, size = bb.getSize(new THREE.Vector3()), s = H_TARGET / size.y
    m.scale.setScalar(s); m.position.set(-(bb.min.x + size.x / 2) * s, -bb.min.y * s + 0.0, -(bb.min.z + size.z / 2) * s)
    dims = { w: size.x * s, h: size.y * s, d: size.z * s }
    rock.add(m); rock.rotation.y = YAW; root.add(rock); boulder = m

    // ---- two crash pads in the landing zone (the bake under spaces/hold-field.ts shadows the floor with the same numbers)
    const covers = [padCover('#1d2a24', '#121a16', 3), padCover('#2b2f3a', '#1a1d24', 7)], trims = [D(0.78, 0.33, 0.1), D(0.62, 0.64, 0.6)]
    PADS.forEach(([x, y, z, sx, sy, sz, yaw], i) => {
      const map = covers[i]                                     // canvasTex: display values read raw, like every map at this stop
      const pm = new THREE.MeshStandardMaterial({ map, roughness: 0.92, envMap: env, envMapIntensity: 0.5 })
      const pad = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 5, Math.min(0.08, sy * 0.35)), pm)
      pad.geometry.translate(0, sy / 2, 0)                      // squash from the floor up
      pad.position.set(x, y - sy / 2, z); pad.rotation.y = yaw; pad.userData.h = sy
      const trim = new THREE.Mesh(new RoundedBoxGeometry(sx + 0.02, 0.05, sz + 0.02, 2, 0.02), new THREE.MeshStandardMaterial({ color: trims[i], roughness: 0.75, envMap: env, envMapIntensity: 0.4 }))
      trim.position.y = 0.03; pad.add(trim)
      root.add(pad); pads.push(pad)
    })

    // ---- the route: rays shot at the boulder from the camera side find the surface for each chalked hold
    root.updateMatrixWorld(true)
    const proxMat = new THREE.MeshBasicMaterial({ visible: false }), nAvg = new THREE.Vector3()
    ROUTE.forEach(([fx, fy], i) => {
      const x = (fx - 0.5) * dims.w * 0.9, y = fy * dims.h
      let hit = surf(x, y)
      for (let yy = y - 0.03; !hit && yy > y - 0.9; yy -= 0.03) hit = surf(x, yy)              // the lip: a ray over the top misses, so walk down to the edge
      if (hit && i === N_ROUTE - 1) hit = surf(x, hit.p.y - 0.06) ?? hit                          // and take it just below the edge, where a hand wraps it
      const at = hit ? hit.p : new THREE.Vector3(x, y, 0), nrm = hit ? hit.n : new THREE.Vector3(0, 0, 1)
      nAvg.add(nrm)
      const mat = new THREE.MeshBasicMaterial({ map: chalkMark(i + 3), transparent: true, depthWrite: false, opacity: 0.4, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat)
      mk.position.copy(at).addScaledVector(nrm, 0.03); mk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); mk.rotateZ(i * 1.7); mk.renderOrder = 3
      root.add(mk); marks.push({ m: mk, mat, at, n: nrm.clone() })
      const prox = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), proxMat); prox.position.copy(at).addScaledVector(nrm, 0.12); prox.userData.route = i
      root.add(prox); pick.push(prox)
    })
    nAvg.y = 0; wallN.copy(nAvg.lengthSq() > 1e-6 ? nAvg.normalize() : new THREE.Vector3(0, 0, 1))
    m.userData.route = -2; pick.push(m)                                          // pressing the rock itself also climbs (touch: the holds are small)
    // ---- "V8", scribbled in chalk on the low face beside the start hold
    const v8 = canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(250,247,238,0.82)'; g.font = '700 190px "Caveat","Segoe Script","Bradley Hand",cursive'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.save(); g.translate(w / 2, h / 2); g.rotate(-0.08); g.fillText('V8', 0, 4); g.restore()
      for (let i = 0; i < 700; i++) { g.clearRect(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 2.5, 1 + Math.random() * 2) }
    })
    const lowHit = surf(marks[0].at.x - 0.75, Math.max(0.35, marks[0].at.y - 0.55))
    const tagAt = lowHit ? lowHit.p : marks[0].at.clone().add(new THREE.Vector3(-0.6, -0.5, 0)), tagN = lowHit ? lowHit.n : marks[0].n
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: v8, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))
    tag.position.copy(tagAt).addScaledVector(tagN, 0.035); tag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tagN); tag.renderOrder = 3; root.add(tag)

    // ---- chalk that lifts off each grab and off the pads
    const cs = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,250,0.8)'); gr.addColorStop(0.5, 'rgba(240,240,232,0.3)'); gr.addColorStop(1, 'rgba(240,240,232,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128) })
    for (let i = 0; i < 12; i++) { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: cs, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })); s2.visible = false; s2.renderOrder = 6; root.add(s2); puffs.push({ s: s2, t: -9 }) }

    // ---- the climber (optional: the stage still stands without it)
    try {
      climber = await loadClimber(env)
      climber.normal.copy(wallN)
      root.add(climber.root)
      placeStance(0); climber.update(0)
    } catch (e) { console.warn('[cabinet] hold: the climber is unavailable, the route stays a route', String((e as Error)?.message ?? e)); climber = null }
    if (climber) { hud = makeHud(() => { next() }); label() }                  // no climber: the route stays a route, no game chrome
    window.addEventListener('keydown', onKey, true)                              // capture: C is also the site's Contact key (nav.ts); at this stop it climbs instead
    precompile(k, root)
    built = true
  }
  const onKey = (e: KeyboardEvent) => {
    if (!present || e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'c' && e.key !== 'C')) return
    const t = e.target as HTMLElement | null
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    const h = document.documentElement
    if (document.querySelector('dialog[open]') || h.classList.contains('in-index') || h.classList.contains('is-loading')) return          // a sheet, the case view or the Index owns the keys
    e.preventDefault(); e.stopPropagation()                                      // never also open Contact
    if (!e.repeat) next()
  }

  function update(time: number, dt: number, r: number, dwell: boolean, _st: FlightState) {
    if (!built) return
    const rm = kit.reduced()
    now = time
    if (r <= 0.0005) { root.visible = false; present = false; hud?.root.classList.remove('on'); return }
    root.visible = true
    enter(root, r, rm, 1.8)
    const here = dwell && r > 0.97
    if (here !== present) {
      present = here; hud?.root.classList.toggle('on', here)
      if (!here && (state === 'sent' || state === 'down')) restart()          // leaving after a send: the next visit starts fresh
      if (!here) { cam.k = 0; cam.near = 0; camAnim?.pause(); nearAnim?.pause(); if (state === 'charge') { state = 'idle'; miss = ''; inZoneNow = false; climber?.pose.off.set(0, 0, 0); label() } }
    }
    if (state === 'charge') {
      // the meter is a function of the clock: the needle, the hips and the judge all read the same number
      const ms = performance.now() - chargeT0, v = vAt(ms); meter.v = v
      climber?.pose.off.set(0, -0.22 * (1 - v), 0.06 * (1 - v))
      if (hud) {
        hud.needle.style.left = (v * 100).toFixed(2) + '%'
        const hit = v >= zoneLo
        if (hit !== inZoneNow) { inZoneNow = hit; hud.meter.classList.toggle('hit', hit); label(); if (hit && ms > ARM) kit.emit('obj:tick', { i: 3 }) }
      }
    }
    if (queuedAt && state === 'idle') { const fresh = performance.now() - queuedAt < BUFFER; queuedAt = 0; if (fresh && present) next() }          // the press she was too busy for
    // a watchdog: a move that never completes (a lost timeline) must not freeze the game
    if (state !== lastState) { lastState = state; busySince = time }
    if (state === 'busy' && time - busySince > 6) { for (const a of anims) a.pause(); anims.length = 0; placeStance(step); state = 'idle'; label() }
    if (climber) {
      if (state === 'idle' && !rm) climber.pose.off.y = 0.012 * Math.sin(time * 1.7)          // breathing on the holds
      climber.update(Math.min(dt, 0.05))
      focus.copy(climber.pelvis()); focus.y += 0.45; root.localToWorld(focus)
      cam.fy += (focus.y - cam.fy) * Math.min(1, dt * 3)                                        // the zoom's aim follows her up the wall, smoothly
    }
    // the chalk marks: the next hold calls, the held ones are bright
    const nextHold = state === 'charge' ? MOVES[step].hold : MOVES[step]?.hold ?? -1
    marks.forEach((mk, ri) => {
      const held = ri === hands.lh || ri === hands.rh
      let glow = held ? 0.72 : 0.42
      if (ri === nextHold) glow = rm ? 0.9 : 0.72 + 0.22 * Math.sin(time * 6)
      if (ri === hot) glow = 1
      mk.mat.opacity += (Math.min(0.92, glow * 0.85) - mk.mat.opacity) * Math.min(1, dt * 10)
      const sc = ri === hot || ri === nextHold ? 1.12 : 1
      mk.m.scale.setScalar(mk.m.scale.x + (sc - mk.m.scale.x) * Math.min(1, dt * 12))
    })
    for (const p of puffs) {
      const u = (time - p.t) / 1.5
      if (u < 0 || u > 1) { p.s.visible = false; continue }
      p.s.visible = true; p.s.position.y += dt * 0.3; p.s.scale.setScalar(0.3 + 0.9 * u); (p.s.material as THREE.SpriteMaterial).opacity = 0.7 * (1 - u) * (1 - u)
    }
  }

  const routeOf = (o: THREE.Object3D | null) => (typeof o?.userData.route === 'number' ? (o.userData.route as number) : -1)
  return {
    id: 'hold', root, dim: 0.05, pick, build, update,
    hover(o) { const k = routeOf(o); if (k !== hot) { hot = k; if (k >= 0 && now - lastTick > 0.08) { lastTick = now; kit.emit('obj:tick', { i: k }) } } },
    press(o) { if (routeOf(o) !== -1 && !hud?.fresh()) next() },                      // the HUD button already played this pointerdown
    act(name) { if (name !== 'climb') return ''; return next() || 'The climber is moving.' },
    demo() { if (step === 0 && state === 'idle') next() },
    api: {
      get state() { return state }, get step() { return step }, get meter() { return state === 'charge' ? vAt(performance.now() - chargeT0) : meter.v }, set meter(v: number) { meter.v = v }, get tries() { return tries },
      get falls() { return falls }, get last() { return last }, zone: () => ({ lo: zoneLo, hi: 1, swingMs: SWING, windowMs: Math.round(2 * zoneHalf(zoneLo)), graceMs: GRACE, armMs: ARM, bufferMs: BUFFER }),
      next, release, restart, marks, get dims() { return dims }, get cam() { return cam.k }, climber: () => climber?.info() ?? null, pads: () => pads.map(p => +p.scale.y.toFixed(3)),
    },
    dispose() { for (const a of anims) a.pause(); for (const t of timers) window.clearTimeout(t); window.removeEventListener('keydown', onKey, true); hud?.dispose(); climber?.dispose(); disposeTree(root) },
  }
}

/** the boulder when its model loads; the previous plywood wall when it does not (one console warning) */
export function createBoulder(): Stage {
  const root = new THREE.Group(); root.name = 'cab-hold-switch'
  let inner: Stage = boulderStage(), fell = false
  const stage: Stage = {
    id: 'hold', root, dim: 0.05, pick: [],
    async build(k) {
      try { await inner.build(k) } catch (e) {
        console.warn('[cabinet] hold: the boulder model is unavailable, using the plywood wall', String((e as Error)?.message ?? e))
        inner = createClimb(); fell = true; await inner.build(k)
      }
      Object.assign(inner.root.userData, { x0: 0, y0: 0, z0: 0, yaw0: 0, s0: 1 })        // the manager placed THIS group; the inner one animates relative to it
      root.add(inner.root); inner.root.visible = false
      Object.assign(root.userData, { contactShadow: inner.root.userData.contactShadow })
      stage.pick = inner.pick; stage.hover = inner.hover?.bind(inner); stage.press = inner.press?.bind(inner); stage.act = inner.act?.bind(inner); stage.demo = inner.demo?.bind(inner)
      stage.api = Object.defineProperty(inner.api ?? {}, 'fell', { value: fell, enumerable: true })      // keep the inner getters live (a spread would freeze them)
    },
    update(t, dt, r, dwell, st) {
      inner.update(t, dt, r, dwell, st)
      root.visible = inner.root.visible
    },
    dispose() { inner.dispose() },
  }
  return stage
}
