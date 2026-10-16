// The glass brain's colour: a click (a tap, not a drag) on the brain while you are at the Mind area moves it to the next colour mode
// (folders, thermal, ivory, spectral) and sends a pulse from the note nearest the click. Whatever changes the mode (this click, the
// pulses, the slow dwell change) is announced as the event 'brain:mode' { mode, name } so other layers can follow; the pulse itself
// is 'brain:pulse', emitted by the world.
//
// v15 (discoverability): the colour change used to be silent, so nothing said the brain could be clicked. Now
//   * hovering the brain shows a tip ('Click: next colour' and the current mode in the accent) and the pointer cursor, within a frame;
//   * every mode change, whatever caused it, flashes a mono label under the brain for 1.5 s (a tap on a phone shows it too);
//   * in folders mode a small key names the vault's ten top-level folders in the colours they are drawn in (folder names only, never a note title). Wave 24: on a desktop it sits
//     ABOVE the brain, left-aligned with it (the lower left belongs to the TV orb, its tag and the ring radar, and the key used to land on all three);
//   * the first dwell shows a 'Click the brain' ring (once; localStorage 'v15.try.brain');
//   * a visually hidden button 'Next brain colour' does the same for the keyboard, and a polite live region announces the mode.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { reducedMotion } from './lib/flags'
import { FOLDER_LEGEND, MODE_NAMES, OBSIDIAN_COLORS } from '../../../gl/brainColor'
import { srAction, stageTip, tryMark } from './stages/common'
import { occ } from '../occlusion'

interface BrainLike {
  group: THREE.Group
  radius: number
  mode: number
  modeName: string
  click(x: number, y: number, cam: unknown): boolean
  hit(x: number, y: number, cam: unknown): unknown
  nextMode(): void
  onMode(cb: (m: number, n: string) => void): () => void
}
/** the accent of each mode: the tip's rule and the mode name in it */
const MODE_ACCENT = ['#6bd447', '#ff8a2b', '#e9dbb0', '#b05cff']
const FLASH_S = 1.5

export function install(ctx: ExtraCtx): Extra | void {
  const canvas = ctx.canvas
  const world = ctx.world as { brain?: BrainLike; hitTest?(x: number, y: number): unknown } | null
  if (!canvas || !world?.brain) return
  const brain = world.brain
  const camera = ctx.field.camera as THREE.PerspectiveCamera
  const html = document.documentElement
  const blocked = () => html.classList.contains('in-index') || html.classList.contains('is-loading') || html.classList.contains('pov-drag') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
  const ndcOf = (x: number, y: number): [number, number] => { const r = canvas.getBoundingClientRect(); return [((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1)] }
  const atMind = () => ctx.state().area === 'mind' && brain.group.visible && brain.group.scale.x > 0.9

  // ---------------------------------------------------------------------------------------------- DOM: mode label, folder key, live region
  const st = document.createElement('style')
  st.textContent = `html.brain-pointer,html.brain-pointer body,html.brain-pointer main,html.brain-pointer #field{cursor:pointer !important}
.brain-key{position:fixed;left:0;top:0;z-index:62;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .35s ease-out,visibility 0s linear .35s;font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:rgba(241,236,224,.86)}
.brain-key.on{opacity:1;visibility:visible;transition:opacity .35s ease-out}
.brain-key .bk-mode{display:inline-block;padding:6px 9px 6px 10px;border-radius:6px;background:rgba(10,10,12,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);box-shadow:inset 2px 0 0 var(--m,#6bd447);opacity:0;transform:translateY(4px);transition:opacity .25s ease-out,transform .25s ease-out}
.brain-key .bk-mode.on{opacity:1;transform:none}
.brain-key .bk-mode b{font-weight:600;color:var(--m,#6bd447);margin-left:6px}
.brain-key .bk-legend{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;gap:7px 16px;margin-top:9px;padding:0 2px;opacity:0;transition:opacity .35s ease-out}
.brain-key .bk-legend.on{opacity:1}
.brain-key .bk-legend span{display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:10.5px;letter-spacing:.1em;text-shadow:0 1px 6px rgba(0,0,0,.8)}
.brain-key .bk-legend i{flex:none;width:8px;height:8px;border-radius:50%;box-shadow:0 0 6px currentColor}
@media (max-width:760px){.brain-key .bk-legend{grid-template-columns:repeat(4,auto);gap:5px 10px;justify-content:center}.brain-key .bk-legend span{font-size:10px;letter-spacing:.1em;gap:4px}.brain-key .bk-mode{display:block;width:max-content;margin:0 auto}}
.brain-sr{position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.brain-key,.brain-key.on,.brain-key .bk-mode,.brain-key .bk-legend{transition:none}.brain-key .bk-mode{transform:none}}`
  document.head.append(st)
  // keyboard on the canvas: it can hold focus (not in the Tab order: tabindex -1; a click on the brain focuses it), and while it does, at the Mind stop, Enter or Space
  // moves the brain to the next colour. Anywhere else Space keeps stepping the flight; leaving the Mind stop hands the focus back.
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = -1
  const fst = document.createElement('style'); fst.textContent = '#field:focus{outline:none}'; document.head.append(fst)
  const key = document.createElement('div'); key.className = 'brain-key'; key.setAttribute('data-proof', 'skip'); key.setAttribute('aria-hidden', 'true')
  const modeEl = document.createElement('div'); modeEl.className = 'bk-mode'
  const modeTxt = document.createElement('span'); modeTxt.textContent = 'Colour:'
  const modeName = document.createElement('b'); modeEl.append(modeTxt, modeName)
  const legend = document.createElement('div'); legend.className = 'bk-legend'
  for (const f of FOLDER_LEGEND) {
    const s = document.createElement('span'), d = document.createElement('i'), c = OBSIDIAN_COLORS[f.key] ?? OBSIDIAN_COLORS.other
    d.style.background = c; d.style.color = c; s.append(d, document.createTextNode(f.name)); legend.append(s)
  }
  key.append(modeEl, legend); document.body.append(key)
  const live = document.createElement('div'); live.className = 'brain-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); document.body.append(live)

  // ---------------------------------------------------------------------------------------------- the mode label
  let flashUntil = 0, nowS = 0, announced = false
  const paintMode = (n: string) => { modeName.textContent = n; modeEl.style.setProperty('--m', MODE_ACCENT[MODE_NAMES.indexOf(n as (typeof MODE_NAMES)[number])] ?? MODE_ACCENT[0]) }
  paintMode(brain.modeName)
  brain.onMode((mode, name) => {
    ctx.emit('brain:mode', { mode, name })
    paintMode(name)
    flashUntil = nowS + FLASH_S
    live.textContent = 'Brain colour: ' + name
    announced = true
    if (hover) showTip()
  })

  // ---------------------------------------------------------------------------------------------- hover tip + cursor
  const tip = stageTip()
  let hover: { x: number; y: number } | null = null
  const showTip = () => { if (hover) tip.show(hover.x, hover.y, 'Click: next colour', brain.modeName, MODE_ACCENT[brain.mode] ?? MODE_ACCENT[0], true) }
  const dropHover = () => { if (!hover) return; hover = null; tip.hide(); html.classList.remove('brain-pointer') }
  const overBrain = (x: number, y: number) => {
    if (!atMind() || blocked() || world.hitTest?.(x, y)) return false
    const [nx, ny] = ndcOf(x, y)
    return !!brain.hit(nx, ny, camera)
  }
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return
    if (e.target !== canvas || !overBrain(e.clientX, e.clientY)) { dropHover(); return }
    hover = { x: e.clientX, y: e.clientY }; showTip(); html.classList.add('brain-pointer'); mark.dismiss()
  }, { passive: true })
  document.addEventListener('pointerleave', dropHover)

  // ---------------------------------------------------------------------------------------------- the click (a tap, not a drag)
  let down: { x: number; y: number } | null = null
  canvas.addEventListener('pointerdown', e => { down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null })
  canvas.addEventListener('pointerup', e => {
    const d = down; down = null
    if (!d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
    if (ctx.state().area !== 'mind') return
    if (world.hitTest?.(e.clientX, e.clientY)) return          // a TV part owns this click
    const [nx, ny] = ndcOf(e.clientX, e.clientY)
    if (brain.click(nx, ny, camera)) { mark.dismiss(); try { canvas.focus({ preventScroll: true }) } catch { /* focus is a courtesy */ } }
  })
  window.addEventListener('keydown', e => {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || e.metaKey || e.ctrlKey || e.altKey || document.activeElement !== canvas || !atMind() || blocked()) return
    e.preventDefault(); e.stopPropagation(); brain.nextMode(); mark.dismiss()
  }, true)

  // ---------------------------------------------------------------------------------------------- first-dwell ring + keyboard twin
  const centre = new THREE.Vector3()
  const mark = tryMark('brain', 'Click the brain', () => { brain.group.getWorldPosition(centre); return centre }, camera, MODE_ACCENT[0])
  const btn = srAction('Next brain colour', () => { brain.nextMode(); mark.dismiss() })

  // ---------------------------------------------------------------------------------------------- placement
  // desktop: above the brain, left-aligned with it, at the top of its projected bounds (the world's own subject box when it holds the brain, else a fraction of its radius).
  // The lower left is the featured TV's corner: its orb, its "SECOND BRAIN OPEN" tag and the ring radar. If the brain reaches too near the top bar for a row above it, the key goes under.
  // phone: the copy runs right under the brain, so the key sits over its lower lobes, centred.
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), vr = new THREE.Vector3()
  const place = () => {
    brain.group.getWorldPosition(v)
    const c = v.clone().project(camera)
    const R = brain.radius * brain.group.scale.x
    v2.copy(v).addScaledVector(vr.setFromMatrixColumn(camera.matrixWorld, 0), R).project(camera)
    const pxR = Math.abs(v2.x - c.x) / 2 * innerWidth
    const cx = (c.x + 1) / 2 * innerWidth, cy = (1 - c.y) / 2 * innerHeight
    const phone = innerWidth <= 760
    const w = key.offsetWidth || 320, h = key.offsetHeight || 60
    let x: number, y: number
    if (phone) {
      x = cx - w / 2; y = cy + 0.85 * pxR - h
      const it = document.querySelector('.ov.vis .info')?.getBoundingClientRect().top   // never closer than 8 px to the first line of the copy under it
      if (it && y + h > it - 8) y = it - 8 - h
    }
    else {
      let l = cx - pxR, t = cy - 0.66 * pxR, b = cy + 0.84 * pxR
      for (const z of occ.subject) if (z.l <= cx && cx <= z.r && z.t <= cy && cy <= z.b) { l = z.l; t = z.t; b = z.b; break }
      x = l; y = t - h - 12
      if (y < 84) y = b + 12
    }
    x = Math.max(28, Math.min(innerWidth - w - 16, x))
    y = Math.max(phone ? 70 : 84, Math.min((phone ? innerHeight - 84 : innerHeight - 24) - h, y))
    key.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`
  }

  return {
    update(t, dt, s) {
      nowS = t
      const here = atMind() && !blocked()
      const dwelling = here && s.dwelling
      mark.update(dwelling, dt, reducedMotion())
      btn.setActive(dwelling)
      if (!here && document.activeElement === canvas) canvas.blur()
      const flashing = here && t < flashUntil
      const showLegend = here && brain.mode === 0
      if (flashing || showLegend) place()
      modeEl.classList.toggle('on', flashing)
      legend.classList.toggle('on', showLegend)
      key.classList.toggle('on', flashing || showLegend)
      if (hover) { if (here) showTip(); else dropHover() }
      void announced
    },
  }
}
