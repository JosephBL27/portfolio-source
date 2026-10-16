// STAGE "drill" (ZETA). Style: mechanical LED hardware. A departures-board housing holds two split-flap modules; each digit is a chunky
// seven-segment glyph built from real extruded meshes (amber, emissive faces, bevelled edges) printed on the two halves of a flap. The score
// climbs from 30 to 80, the ones digit rattling through flap after flap, the tens digit dropping in now and then; a 50-cell meter fills
// under it, and a 120-tick dial (the 120-second drill) sweeps behind. Both numbers are in the data (best strict score 80, from 30).
//   entrance  the housing swings down from above on a spring while the dial ticks pop on round the ring, one after another
//   exit      the board tips forward off its hinge and falls, the ticks collapse
// Flap maths: a flip rotates the old top half about the hinge from 0 to 180 degrees; its back carries the NEW bottom half, so at 90 degrees
// the picture changes and at 180 it lands on the lower half. Digits are chains of such flips (one per step), so the ones digit shows a real
// rattle when the score climbs faster than it can flip.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { canvasTex, clamp01, easeInCubic, easeOutBack, glowMat, lit, mergeGeos, radialTexture, rng, srAction, sstep, stageTip, tryMark, type StageBuildCtx, type StageDef, type StageFrame } from './common'

type P2 = [number, number]
const HW = 0.68, HH = 1.25, T = 0.135, C = 0.02, GAP = 0.03
const Y1 = HH - 2 * T + C - GAP * Math.SQRT2, Y0 = T - C + GAP * Math.SQRT2
const hexH = (yc: number): P2[] => [[-HW + C, yc], [-HW + C + T, yc + T], [HW - C - T, yc + T], [HW - C, yc], [HW - C - T, yc - T], [-HW + C + T, yc - T]]
const hexV = (xc: number, y0: number, y1: number): P2[] => [[xc, y1], [xc + T, y1 - T], [xc + T, y0 + T], [xc, y0], [xc - T, y0 + T], [xc - T, y1 - T]]
/** Sutherland-Hodgman against y >= 0 (upper) or y <= 0 */
function clipY(poly: P2[], upper: boolean): P2[] {
  const out: P2[] = [], inside = (p: P2) => (upper ? p[1] >= 0 : p[1] <= 0)
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b)
    if (ia) out.push(a)
    if (ia !== ib) { const t = (0 - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, 0]) }
  }
  return out
}
// segments a b c d e f g; halves
const SEG: P2[][] = [hexH(HH - T), hexV(HW - T, Y0, Y1), hexV(HW - T, -Y1, -Y0), hexH(-(HH - T)), hexV(-HW + T, -Y1, -Y0), hexV(-HW + T, Y0, Y1), hexH(0)]
const TOP_IDX = [0, 1, 5], BOT_IDX = [3, 2, 4]
const DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
const segOf = (ch: string) => 'abcdefg'.indexOf(ch)

const startN = 30, endN = 80
const FLIP = 0.085                      // seconds per flap
const CLIMB0 = 1.0, CLIMB = 6.0, HOLD = 3.6, BACK = 1.2, CYCLE = CLIMB0 + CLIMB + HOLD + BACK
const NT = 120, RR = 2.52, CELLS = 50
const AMBER = 0xffb52e

export default {
  id: 'drill',
  build(c: StageBuildCtx) {
    const { env, phone, view } = c
    const root = new THREE.Group()
    const az = Math.atan2(view.dir.x, view.dir.z)
    const yawG = new THREE.Group(); yawG.rotation.y = az * 0.55; root.add(yawG)
    const pivot = new THREE.Group(); pivot.position.y = 1.78; yawG.add(pivot)      // the board hangs from its top edge
    const board = new THREE.Group(); board.position.y = -1.78; pivot.add(board)

    // ------------------------------------------------------------------ materials
    const segMat = lit(new THREE.MeshStandardMaterial({ color: 0x1c1004, emissive: new THREE.Color(1.0, 0.6, 0.12), emissiveIntensity: 1.05, roughness: 0.45, metalness: 0.1, envMap: env, envMapIntensity: 0.9 }), 'seg')
    const ghostMat = lit(new THREE.MeshStandardMaterial({ color: 0x0a0604, emissive: new THREE.Color(0.2, 0.1, 0.02), emissiveIntensity: 0.9, roughness: 0.6, envMap: env, envMapIntensity: 0.3 }), 'ghost')
    const plateMat = lit(new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.5, metalness: 0.35, envMap: env, envMapIntensity: 0.9 }), 'plate')
    const metalMat = lit(new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.34, metalness: 0.9, envMap: env, envMapIntensity: 1.3 }), 'metal')
    const screwMat = lit(new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.28, metalness: 1, envMap: env, envMapIntensity: 1.6 }), 'screw')

    // ------------------------------------------------------------------ digit geometry: 11 glyphs (10 digits + blank) x 2 halves, plus ghosts
    const extrude = (poly: P2[], depth: number, bevel: number) => {
      const s = new THREE.Shape(); s.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) s.lineTo(poly[i][0], poly[i][1]); s.closePath()
      return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: phone ? 1 : 2, curveSegments: 1 })
    }
    const half = (idx: number[], upper: boolean, depth: number, bevel: number) => {
      const polys = idx.map(i => SEG[i]); polys.push(clipY(SEG[6], upper))
      return polys.map(p => extrude(p, depth, bevel))
    }
    const topParts = half(TOP_IDX, true, 0.13, 0.03), botParts = half(BOT_IDX, false, 0.13, 0.03)        // index: a b f g | d c e g
    const topKey = ['a', 'b', 'f', 'g'], botKey = ['d', 'c', 'e', 'g']
    const build = (parts: THREE.BufferGeometry[], keys: string[], ch: string) => {
      const pick = parts.filter((_, i) => ch.includes(keys[i]))
      return pick.length ? mergeGeos(pick) : new THREE.BufferGeometry()
    }
    const topG: THREE.BufferGeometry[] = [], botG: THREE.BufferGeometry[] = []
    for (let d = 0; d < 10; d++) { topG.push(build(topParts, topKey, DIGITS[d])); botG.push(build(botParts, botKey, DIGITS[d])) }
    topG.push(new THREE.BufferGeometry()); botG.push(new THREE.BufferGeometry())              // 10 = blank
    const ghostTop = mergeGeos(half(TOP_IDX, true, 0.03, 0).map(g => g)), ghostBot = mergeGeos(half(BOT_IDX, false, 0.03, 0).map(g => g))
    const plateGeo = new THREE.BoxGeometry(1.7, 1.4, 0.06); plateGeo.translate(0, 0.7, -0.03)
    const plateGeoB = plateGeo.clone(); plateGeoB.translate(0, -1.4, 0)                          // lower half plate (mirrors the upper)

    // a half-card: plate + ghost segments + lit segments (the lit mesh swaps its geometry)
    const halfCard = (upper: boolean) => {
      const g = new THREE.Group()
      const plate = new THREE.Mesh(upper ? plateGeo : plateGeoB, plateMat), ghost = new THREE.Mesh(upper ? ghostTop : ghostBot, ghostMat), lit1 = new THREE.Mesh(topG[10], segMat)
      ghost.position.z = 0.002; lit1.position.z = 0.004
      g.add(plate, ghost, lit1)
      return { g, lit: lit1 }
    }
    interface Mod {
      g: THREE.Group; shown: number; want: number; flipT: number; flipTo: number; flipping: boolean
      sTop: ReturnType<typeof halfCard>; sBot: ReturnType<typeof halfCard>; fFront: ReturnType<typeof halfCard>; fBack: ReturnType<typeof halfCard>; flap: THREE.Group
    }
    const mods: Mod[] = []
    const MS = 0.9
    for (const x of [-0.81, 0.81]) {
      const g = new THREE.Group(); g.position.set(x, 0.14, 0.1); g.scale.setScalar(MS); board.add(g)
      const sTop = halfCard(true), sBot = halfCard(false)
      const flap = new THREE.Group(); flap.position.z = 0.012
      const fFront = halfCard(true), fBack = halfCard(false)
      fBack.g.rotation.x = Math.PI                                                              // the flap's back carries the NEW lower half
      flap.add(fFront.g, fBack.g)
      g.add(sTop.g, sBot.g, flap)
      // hinge: a thin dark bar and two axle blocks
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.045, 0.11), metalMat); hinge.position.z = 0.02; g.add(hinge)
      for (const sx of [-1, 1]) { const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), screwMat); ax.rotation.z = Math.PI / 2; ax.position.set(sx * 0.93, 0, 0.03); g.add(ax) }
      mods.push({ g, shown: 10, want: 10, flipT: 0, flipTo: 10, flipping: false, sTop, sBot, fFront, fBack, flap })
      flap.visible = false
    }
    const setHalves = (m: Mod) => {
      m.sTop.lit.geometry = topG[m.shown]; m.sBot.lit.geometry = botG[m.shown]
    }
    for (const m of mods) setHalves(m)

    // ------------------------------------------------------------------ housing
    const HOUSE = { w: 3.78, h: 3.56, d: 0.5 }
    const house = new THREE.Mesh(new RoundedBoxGeometry(HOUSE.w, HOUSE.h, HOUSE.d, phone ? 2 : 4, 0.12), metalMat); house.position.z = -0.32; board.add(house)
    const face = new THREE.Mesh(new RoundedBoxGeometry(HOUSE.w - 0.28, HOUSE.h - 0.28, 0.06, 2, 0.04), lit(new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6, envMap: env, envMapIntensity: 0.4 }), 'face')); face.position.z = -0.06; board.add(face)
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), screwMat); sc.rotation.x = Math.PI / 2; sc.position.set(sx * (HOUSE.w / 2 - 0.15), sy * (HOUSE.h / 2 - 0.15), -0.06); board.add(sc)
    }
    // two hanging rods from the pivot line
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), metalMat); rod.position.set(sx * 1.4, HOUSE.h / 2 + 1.1, -0.3); board.add(rod) }
    // the glow in front of the digits (additive: it blooms)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.2), glowMat(radialTexture(), 0xff9a1f, 0)); halo.position.z = 0.55; board.add(halo)

    // ------------------------------------------------------------------ the 50-cell meter and its two end labels (30, 80)
    const meter = new THREE.Group(); meter.position.set(0, -HOUSE.h / 2 + 0.26, 0.0); board.add(meter)
    const cellGeo = new THREE.BoxGeometry(0.036, 0.1, 0.04)
    const cells = new THREE.InstancedMesh(cellGeo, lit(new THREE.MeshBasicMaterial({ toneMapped: false }), 'cell'), CELLS); cells.frustumCulled = false
    const MW = 2.3
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < CELLS; i++) { m4.makeTranslation(-MW / 2 + (i + 0.5) * (MW / CELLS), 0, 0); cells.setMatrixAt(i, m4); cells.setColorAt(i, new THREE.Color(0x2a1a06)) }
    meter.add(cells)
    const label = (txt: string, x: number) => {
      const t = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#FFB52E'; g.font = '600 42px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2) })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, toneMapped: false, depthWrite: false, opacity: 0.85 })); lit(m.material as THREE.MeshBasicMaterial, 'lbl')
      m.position.set(x, 0, 0.01); meter.add(m); document.fonts?.ready.then(() => { t.g.clearRect(0, 0, 128, 64); t.g.fillStyle = '#FFB52E'; t.g.font = '600 42px "IBM Plex Mono", ui-monospace, monospace'; t.g.textAlign = 'center'; t.g.textBaseline = 'middle'; t.g.fillText(txt, 64, 34); t.tex.needsUpdate = true }).catch(() => {})
    }
    label(String(startN), -MW / 2 - 0.3); label(String(endN), MW / 2 + 0.3)

    // ------------------------------------------------------------------ the 120-tick dial behind the board
    const dial = new THREE.Group(); dial.position.z = -0.7; yawG.add(dial)
    const tickGeo = new THREE.BoxGeometry(0.035, 0.15, 0.04); tickGeo.translate(0, 0.075, 0)
    const ticks = new THREE.InstancedMesh(tickGeo, lit(new THREE.MeshBasicMaterial({ toneMapped: false }), 'tick'), NT); ticks.frustumCulled = false
    for (let i = 0; i < NT; i++) ticks.setColorAt(i, new THREE.Color(0x3a2608))
    dial.add(ticks)
    const dialHalo = new THREE.Mesh(new THREE.PlaneGeometry(RR * 2.5, RR * 2.5), glowMat(radialTexture(), 0xffa020, 0)); dialHalo.position.z = -0.05; dial.add(dialHalo)
    const colA = new THREE.Color(), colOn = new THREE.Color(0xffc24a), colOff = new THREE.Color(0x3a2608), colHead = new THREE.Color(0xfff0c0)
    const dummy = new THREE.Object3D()

    // ------------------------------------------------------------------ the drill: click the board, a problem hangs above it, type the answer on the flaps
    // Mouse and keyboard: click = next problem, digits fill the flaps from the right, Enter checks (empty Enter shows the answer), Backspace, Escape leaves.
    // Touch (no keyboard): tap = show the answer, tap again = next problem. The meter counts solved problems while the drill is open. The problems are
    // generic mental arithmetic (answers 0 to 99, so two flaps hold them); nothing here is a result.
    const Q = { on: false, ans: 0, text: '', typed: '', revealed: false, solved: 0, streak: 0, okT: 0, badT: 0, nextAt: 0, idle: 0, n: 0 }
    const rnd = rng(0x2e7a)
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    const newProblem = () => {
      const k = Q.n++ % 3
      let a: number, b: number
      if (k === 0) { a = 10 + Math.floor(rnd() * 60); b = 2 + Math.floor(rnd() * (99 - a - 1)); Q.ans = a + b; Q.text = `${a} + ${b}` }
      else if (k === 1) { a = 30 + Math.floor(rnd() * 69); b = 2 + Math.floor(rnd() * (a - 3)); Q.ans = a - b; Q.text = `${a} − ${b}` }
      else { a = 3 + Math.floor(rnd() * 10); b = 3 + Math.floor(rnd() * 7); Q.ans = a * b; Q.text = `${a} × ${b}` }
      Q.typed = ''; Q.revealed = false; Q.okT = Q.badT = 0; Q.idle = 0; drawLabel()
    }
    const LW = 1024, LH = 330
    const labC = canvasTex(LW, LH, () => {}, { mips: false })
    function drawLabel() {
      const g = labC.g; g.clearRect(0, 0, LW, LH); g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillStyle = 'rgba(8,6,3,0.88)'; g.beginPath(); g.roundRect(6, 6, LW - 12, LH - 12, 34); g.fill(); g.strokeStyle = 'rgba(255,181,46,0.55)'; g.lineWidth = 4; g.stroke()
      const mono = '"IBM Plex Mono", ui-monospace, monospace'
      // the subtitle lines are 48px (they were 30px, too small to read from the stage's camera); the sign is taller to hold them
      if (!Q.on) {
        g.fillStyle = 'rgba(255,181,46,0.78)'; g.font = `600 64px ${mono}`; g.letterSpacing = '10px'; g.fillText('CLICK TO DRILL', LW / 2, 118); g.letterSpacing = '0px'
        g.fillStyle = 'rgba(255,181,46,0.62)'; g.font = `600 48px ${mono}`; g.letterSpacing = '6px'; g.fillText(coarse ? 'TAP FOR A PROBLEM' : 'THEN TYPE THE ANSWER', LW / 2, 224); g.letterSpacing = '0px'
        g.fillStyle = 'rgba(255,181,46,0.46)'; g.font = `600 36px ${mono}`; g.letterSpacing = '6px'; g.fillText('MENTAL ARITHMETIC', LW / 2, 284); g.letterSpacing = '0px'
      } else {
        const right = Q.revealed || Q.okT > 0
        g.fillStyle = Q.badT > 0 ? '#ff6a4a' : '#ffc24a'; g.font = `700 104px ${mono}`
        g.fillText(`${Q.text} = ${right ? Q.ans : '?'}`, LW / 2, 98)
        g.fillStyle = Q.badT > 0 ? 'rgba(255,106,74,0.85)' : 'rgba(255,181,46,0.78)'; g.font = `600 48px ${mono}`; g.letterSpacing = '6px'
        g.fillText(Q.badT > 0 ? 'NOT QUITE' : Q.okT > 0 ? 'CORRECT' : coarse ? 'TAP FOR THE ANSWER' : 'TYPE IT · ENTER', LW / 2, 192); g.letterSpacing = '0px'
        // the visitor's own streak (right answers in a row, this drill) and how to leave
        g.font = `600 44px ${mono}`; g.letterSpacing = '5px'; g.fillStyle = 'rgba(255,181,46,0.66)'
        g.textAlign = 'left'; g.fillText(`STREAK ${Q.streak}`, 54, 268)
        g.textAlign = 'right'; g.fillText(coarse ? 'TAP: NEXT' : 'ESC TO END', LW - 54, 268); g.letterSpacing = '0px'; g.textAlign = 'center'
      }
      labC.tex.needsUpdate = true
    }
    const labMat = lit(new THREE.MeshBasicMaterial({ map: labC.tex, transparent: true, toneMapped: false, depthWrite: false, opacity: 0 }), 'drill-label')
    const labMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0 * LH / LW), labMat); labMesh.position.set(0, HOUSE.h / 2 + 0.74, 0.0); labMesh.renderOrder = 4; board.add(labMesh)
    drawLabel(); document.fonts?.ready.then(drawLabel).catch(() => {})
    let shake = 0, hovering = false, hov = 0, solvedSeen = -1
    const tip = stageTip(), emitQ = { f: (_n: string) => {} }
    const start = () => { Q.on = true; Q.solved = 0; Q.streak = 0; newProblem(); emitQ.f('obj:flip') }
    const stop = () => { if (!Q.on) return; Q.on = false; Q.typed = ''; Q.revealed = false; Q.streak = 0; drawLabel() }
    const check = () => {
      if (Number(Q.typed) === Q.ans && Q.typed !== '') { Q.okT = 1; Q.streak++; Q.solved = Math.min(CELLS, Q.solved + 1); Q.nextAt = 0.9; drawLabel(); emitQ.f('obj:flip'); emitQ.f('count:tick') }
      else { Q.badT = 1; Q.streak = 0; Q.nextAt = 0; shake = 1; drawLabel(); emitQ.f('obj:wrong') }
    }
    const pickList: THREE.Object3D[] = []

    // ------------------------------------------------------------------ the climb
    const targetAt = (tau: number): number => {
      tau = tau % CYCLE
      if (tau < CLIMB0) return startN
      if (tau < CLIMB0 + CLIMB) { const u = (tau - CLIMB0) / CLIMB; return startN + Math.round((endN - startN) * (u * u * (3 - 2 * u))) }
      if (tau < CLIMB0 + CLIMB + HOLD) return endN
      const u = (tau - CLIMB0 - CLIMB - HOLD) / BACK; return endN - Math.round((endN - startN) * Math.min(1, u * u))
    }
    const advance = (m: Mod, dt: number, f: StageFrame, silent: boolean) => {
      let guard = 0
      while (dt > 0 && guard++ < 6) {
        if (!m.flipping) {
          if (m.shown === m.want) return
          m.flipTo = m.want === 10 ? 10 : (m.shown === 10 ? m.want : (m.shown + 1) % 10)
          if (m.shown !== 10 && m.want !== 10 && m.flipTo === m.shown) return
          m.flipping = true; m.flipT = 0
          m.fFront.lit.geometry = topG[m.shown]; m.fBack.lit.geometry = botG[m.flipTo]
          m.sTop.lit.geometry = topG[m.flipTo]; m.flap.visible = true
          if (!silent) f.emit('evidence:flip')
        }
        const need = (1 - m.flipT) * FLIP
        if (dt < need) { m.flipT += dt / FLIP; dt = 0 } else { dt -= need; m.flipT = 1; m.flipping = false; m.shown = m.flipTo; m.flap.visible = false; setHalves(m) }
      }
    }
    const setFlapAngle = (m: Mod) => {
      if (!m.flipping) return
      const e = clamp01(m.flipT); m.flap.rotation.x = Math.PI * e * e * (1.6 - 0.6 * e)   // accelerates under its own weight
    }
    let lastTier = -1, silentUntil = 0

    let uiTick: (f: StageFrame) => void = () => {}
    const update = (f: StageFrame) => {
      const rm = f.reduced
      emitQ.f = n => f.emit(n)
      uiTick(f)
      if (Q.on && (f.depart > 0.02 || f.arrive < 0.9)) stop()
      const sa = rm ? 1 : clamp01((f.arrive - 0.12) / 0.86)
      const sd = rm ? 0 : sstep(0.0, 0.85, f.depart)
      // ---- entrance: the board swings down on a spring; exit: it tips off its hinge and falls
      const e = sa < 1 ? 1 - (1 - (1 - Math.exp(-5.4 * sa) * (Math.cos(6.2832 * 1.05 * sa) + 0.8 * Math.sin(6.2832 * 1.05 * sa)))) : 1
      const ang = (1 - e) * 1.45
      pivot.rotation.x = ang - 1.1 * easeInCubic(sd)
      pivot.position.y = 1.78 - 6.5 * easeInCubic(sd) + 2.2 * (1 - clamp01(sa * 1.6))
      yawG.rotation.y = az * 0.55 + Math.sin(f.t * 0.5) * 0.02 * (rm ? 0 : sstep(0.9, 1, sa))
      // ---- the score
      const idle = rm ? 99 : f.tIn
      let want = rm ? endN : (f.tIn > 0 ? targetAt(idle) : 10 * 10)
      const tens = f.tIn > 0 || rm ? Math.floor(want / 10) : 10, ones = f.tIn > 0 || rm ? want % 10 : 10
      mods[0].want = tens; mods[1].want = ones
      if (Q.on) {
        Q.idle += f.dt; if (Q.idle > 30) stop()
        if (Q.okT > 0) { Q.nextAt -= f.dt; if (Q.nextAt <= 0) newProblem() }
        if (Q.badT > 0 && (Q.badT -= f.dt * 0.7) <= 0) { Q.badT = 0; Q.typed = ''; drawLabel() }
      }
      if (Q.on) { const t = (Q.revealed || Q.okT > 0 ? String(Q.ans) : Q.typed).padStart(2, ' '); mods[0].want = t[0] === ' ' ? 10 : +t[0]; mods[1].want = t[1] === ' ' ? 10 : +t[1] }
      hov += ((hovering ? 1 : 0) - hov) * Math.min(1, f.dt * 12); shake = Math.max(0, shake - f.dt * 3.2)
      labMat.opacity = sstep(0.4, 0.95, sa) * (1 - sstep(0.02, 0.3, f.depart)) * (Q.on ? 1 : 0.85 + 0.15 * Math.sin(f.t * 2.4) * (rm ? 0 : 1))
      board.position.x = Math.sin(f.t * 80) * 0.045 * shake * shake
      if (rm) { for (const m of mods) { m.shown = m.want; m.flipping = false; m.flap.visible = false; setHalves(m) } }
      else for (const m of mods) { advance(m, Math.min(f.dt, 0.1), f, f.tIn < 0.05); setFlapAngle(m) }
      void lastTier; void silentUntil
      const shownN = mods[0].shown === 10 || mods[1].shown === 10 ? startN : mods[0].shown * 10 + mods[1].shown
      const prog = clamp01((shownN - startN) / (endN - startN))
      // ---- meter, dial, glow
      const litCells = Q.on ? Q.solved : Math.round(prog * CELLS)
      for (let i = 0; i < CELLS; i++) { colA.copy(i < litCells ? colOn : colOff); if (i === litCells - 1 && litCells < CELLS) colA.copy(colHead); cells.setColorAt(i, colA) }
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true
      const sweep = rm ? 0.72 : ((f.t * 0.083) % 1)       // one turn in about 12 s: the dial that eats the drill's 120 seconds
      for (let i = 0; i < NT; i++) {
        const a = (i / NT) * Math.PI * 2
        const pop = rm ? 1 : easeOutBack(clamp01((sa - 0.1 - i * 0.0042) / 0.2)) * (1 - easeInCubic(clamp01((sd - 0.08 - (NT - i) * 0.003) / 0.35)))
        const big = i % 5 === 0
        dummy.position.set(Math.sin(a) * RR, Math.cos(a) * RR, 0); dummy.rotation.set(0, 0, -a); dummy.scale.set(big ? 1.7 : 1, Math.max(0.001, pop) * (big ? 1.7 : 1), 1); dummy.updateMatrix(); ticks.setMatrixAt(i, dummy.matrix)
        const ph = (i / NT - sweep + 1) % 1                // 0 at the hand, rising behind it
        const litK = ph > 0.5 ? 0 : 1 - ph * 2           // a comet behind the sweep hand
        colA.copy(colOff).lerp(ph < 0.012 ? colHead : colOn, Math.max(litK * litK, big ? 0.28 : 0.08)); ticks.setColorAt(i, colA)
      }
      ticks.instanceMatrix.needsUpdate = true; if (ticks.instanceColor) ticks.instanceColor.needsUpdate = true
      const pw = sstep(0.35, 0.95, sa) * (1 - sstep(0.05, 0.5, sd))
      ;(halo.material as THREE.MeshBasicMaterial).opacity = (0.16 + 0.07 * hov + 0.12 * (Q.okT > 0 ? 1 : 0)) * pw * (0.85 + 0.15 * Math.sin(f.t * 2.3))
      ;(dialHalo.material as THREE.MeshBasicMaterial).opacity = 0.1 * pw
      segMat.emissiveIntensity = 1.0 + (rm ? 0 : 0.08 * Math.sin(f.t * 31) * (mods[1].flipping ? 1 : 0.3))
      // the 80 pulses when the climb lands
      const pulse = !rm && f.tIn > 0 ? Math.exp(-((f.tIn % CYCLE) - (CLIMB0 + CLIMB + 0.1)) * 1.5) * (((f.tIn % CYCLE) > CLIMB0 + CLIMB) ? 1 : 0) : 0
      if (pulse > 0.001) (halo.material as THREE.MeshBasicMaterial).opacity += 0.18 * pulse
    }
    for (const m of mods) pickList.push(m.sTop.g.children[0], m.sBot.g.children[0])
    pickList.push(house, face)
    const onBoard = (ray: THREE.Raycaster) => { board.updateWorldMatrix(true, true); return ray.intersectObjects(pickList, false).length > 0 }
    // the tip is re-evaluated every frame while hovering (update): 'Click to drill' turns into 'Type the answer' the moment the drill starts
    let tipX = 0, tipY = 0
    const tipNow = () => {
      if (!hovering) return
      if (!Q.on) tip.show(tipX, tipY, 'Click to drill', 'mental arithmetic, not a score', '#FFB52E')
      else if (coarse) tip.show(tipX, tipY, 'Tap: answer, then next', undefined, '#FFB52E')
      else tip.show(tipX, tipY, 'Type the answer · Enter', 'click: next problem', '#FFB52E')
    }
    const press = () => {
      if (!Q.on) start()
      else if (coarse && !Q.revealed && !Q.okT) { Q.revealed = true; Q.streak = 0; Q.idle = 0; drawLabel(); emitQ.f('obj:flip') }
      else { newProblem(); emitQ.f('obj:flip') }
    }
    const pointer = {
      hover(ray: THREE.Raycaster, x: number, y: number) {
        hovering = onBoard(ray); tipX = x; tipY = y
        if (hovering) tipNow(); else tip.hide()
        return hovering ? 'pointer' as const : null
      },
      down(ray: THREE.Raycaster) {
        if (!onBoard(ray)) return null
        mark.dismiss(); press()
        return 'tap' as const
      },
      leave() { hovering = false; tip.hide() },
      key(e: KeyboardEvent) {
        // not started yet: Enter (page or canvas focused; buttons and links activate themselves) starts the drill, as a click does
        if (!Q.on) { if (e.key !== 'Enter' || e.repeat || (e.target as HTMLElement | null)?.closest?.('button, a[href], input, textarea, select, summary, [role="button"]')) return false; mark.dismiss(); press(); return true }
        Q.idle = 0
        if (e.key === 'Escape') { stop(); return true }
        if (Q.okT > 0) return /^[0-9]$|Backspace|Enter/.test(e.key)
        if (/^[0-9]$/.test(e.key)) { if (Q.revealed) return true; Q.badT = 0; if (Q.typed.length < 2) Q.typed += e.key; if (Q.typed.length === String(Q.ans).length) check(); else drawLabel(); return true }
        if (e.key === 'Backspace') { Q.typed = Q.typed.slice(0, -1); Q.badT = 0; drawLabel(); return true }
        if (e.key === 'Enter') { if (Q.revealed) newProblem(); else if (Q.typed) check(); else { Q.revealed = true; Q.streak = 0; drawLabel() } return true }
        return false
      },
    }
    // the try-me ring on the board, and the keyboard / screen-reader twin of the click
    const mark = tryMark('drill', 'Click to drill', board, c.camera, '#FFB52E')
    const startBtn = srAction('Start the drill', () => { press() })
    uiTick = (f: StageFrame) => {
      const held = f.arrive > 0.97 && f.depart < 0.02
      mark.update(held && f.tIn > 0.6 && !Q.on, f.dt, f.reduced)
      startBtn.setLabel(Q.on ? 'Next drill problem' : 'Start the drill'); startBtn.setActive(held)
      tipNow()
    }
    void solvedSeen
    return { root, update, dust: 0.045, size: [5.5, 5.5] as [number, number], pointer, hint: ['Click to drill', 'mental arithmetic, not a score'] as [string, string], debug: () => ({ on: Q.on, text: Q.text, ans: Q.ans, typed: Q.typed, solved: Q.solved, streak: Q.streak, okT: Q.okT }) }
  },
} satisfies StageDef
