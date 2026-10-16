// 3.6 "Off the board." Four capsules drop in (120 ms apart) and open onto four halftone cut-outs.
// The cards are a visual restatement; the full vetted sentence below is the accessible copy.
import { animate, inView } from 'motion'
import { site } from '../data'
import { bus } from '../bus'
import { state } from '../state'
import { palette } from '../theme'
import { mountHalftone, type ShapeName, type HalftoneHandle } from './halftone'
import '../styles/offboard.css'

interface Card { shape: ShapeName; plate: string; figure: string; caption: string; turn: number; sway?: number }

// Figures and captions are substrings of site.bio.offBoard (checked below); plate names follow the concept.
const CARDS: Card[] = [
  { shape: 'hold', plate: 'Climbing hold', figure: 'V8', caption: 'at my peak', turn: 90 },
  { shape: 'meeple', plate: 'Meeple', figure: '80+', caption: 'board games', turn: 9, sway: 9 },
  { shape: 'record', plate: '12-inch record', figure: '400+', caption: 'records and CDs', turn: 48 },
  { shape: 'pawn', plate: 'Pawn', figure: '1750', caption: 'on Chess.com', turn: 11, sway: 4 },
]

const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function initOffBoard(root: HTMLElement): void {
  const text = site.bio.offBoard
  for (const c of CARDS) {
    if (!text.includes(c.figure) || !text.includes(c.caption)) console.warn('[offboard] copy drift:', c.figure, c.caption)
  }
  root.classList.add('offboard')
  root.innerHTML = ''

  const head = el('header', 'offboard__head')
  const h2 = el('h2', 'offboard__title'); h2.id = 'offboard-title'; h2.textContent = 'Off the board.'
  head.append(h2)
  if (!root.hasAttribute('aria-labelledby')) root.setAttribute('aria-labelledby', 'offboard-title')

  const grid = el('ol', 'offboard__grid')
  grid.setAttribute('aria-hidden', 'true') // the sentence below carries the same facts as real text
  const handles: HalftoneHandle[] = []
  const cards: HTMLElement[] = []

  const ink = () => getComputedStyle(root).getPropertyValue('--ob-ink').trim() || palette(state.night).ink

  CARDS.forEach((c, i) => {
    const li = el('li', 'ob-card'); li.dataset.shape = c.shape
    const tube = el('span', 'ob-card__tube')
    const cap = el('span', 'ob-card__capsule')
    const plate = el('div', 'ob-card__plate')
    const label = el('span', 'ob-card__label'); label.textContent = c.plate
    const art = el('div', 'ob-card__art')
    const canvas = document.createElement('canvas')
    art.append(canvas)
    const fig = el('span', 'ob-card__figure'); fig.textContent = c.figure
    const capt = el('span', 'ob-card__caption'); capt.textContent = c.caption
    plate.append(label, art, fig, capt)
    li.append(tube, cap, plate)
    grid.append(li)
    cards.push(li)
    // mount after insertion so the canvas has a size
    queueMicrotask(() => {
      handles[i] = mountHalftone(canvas, c.shape, {
        ink: ink(), cell: dotCell(), turnSeconds: c.turn, sway: c.sway, breathe: true, hoverTarget: li, fill: 0.9,
      })
    })
  })

  const body = el('p', 'offboard__text'); body.textContent = text
  root.append(head, grid, body)

  bus.on('theme', () => { const k = ink(); handles.forEach(h => h?.setInk(k)) })

  if (state.reduced) return
  // closed state: capsule parked above, plate pinched to a capsule-sized slot
  for (const li of cards) {
    li.style.setProperty('--open', '0')
    const cap = li.querySelector<HTMLElement>('.ob-card__capsule')!
    cap.style.opacity = '0'; cap.style.transform = 'translate(-50%, -56px)'
    li.querySelector<HTMLElement>('.ob-card__figure')!.style.opacity = '0'
    li.querySelector<HTMLElement>('.ob-card__caption')!.style.opacity = '0'
  }
  inView(grid, () => {
    cards.forEach((li, i) => {
      const d = i * 0.12
      const cap = li.querySelector<HTMLElement>('.ob-card__capsule')!
      const fig = li.querySelector<HTMLElement>('.ob-card__figure')!
      const capt = li.querySelector<HTMLElement>('.ob-card__caption')!
      animate(cap, { opacity: [0, 1], transform: ['translate(-50%, -56px)', 'translate(-50%, 0px)'] }, { duration: 0.38, delay: d, ease: [0.5, 0, 0.75, 0] })
      animate(cap, { opacity: [1, 0], transform: ['translate(-50%, 0px) scaleX(1)', 'translate(-50%, 0px) scaleX(2.4)'] }, { duration: 0.3, delay: d + 0.42, ease: 'easeOut' })
      animate(li, { '--open': [0, 1] }, { duration: 0.75, delay: d + 0.36, ease: EASE_OUT })
      animate(fig, { opacity: [0, 1], transform: ['translateY(28px)', 'translateY(0px)'] }, { type: 'spring', visualDuration: 0.5, bounce: 0.16, delay: d + 0.62 })
      animate(capt, { opacity: [0, 1] }, { duration: 0.4, delay: d + 0.78 })
    })
  }, { amount: 0.3 })
}

// 7 px is the system pitch; small phone plates drop to 5 px so the shapes keep enough dots to read.
const dotCell = () => (window.innerWidth < 560 ? 5 : 7)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = cls; return e
}
