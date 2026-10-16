// Shared plumbing for the product labs (selforge, chomchom, notebooklm-study-loop, recruiting-os): the root shell and a tiny timer owner.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Every lab root carries data-proof="skip".
import './prod.css'
import { esc, type LabOpts } from './kit'

export interface Shell { root: HTMLElement; body: HTMLElement; hint: HTMLElement }

/** builds `.pl` with a head and an empty body; `vars` sets the accent triplet */
export function shell(host: HTMLElement, cls: string, vars: { acc: string; acc2: string; glow: string }, kicker: string, title: string, note: string, hint: string): Shell {
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = `pl ${cls}`
  root.setAttribute('data-proof', 'skip')
  root.style.setProperty('--pl-acc', vars.acc); root.style.setProperty('--pl-acc2', vars.acc2); root.style.setProperty('--pl-glow', vars.glow)
  root.innerHTML = `<header class="pl-head"><div><span class="pl-kicker">${esc(kicker)}</span><h3 class="pl-title">${esc(title)}</h3></div><p class="pl-note">${esc(note)}</p></header><div class="pl-body"></div><p class="pl-hint">${esc(hint)}</p>`
  host.append(root)
  return { root, body: root.querySelector('.pl-body')!, hint: root.querySelector('.pl-hint')! }
}

/** owns timeouts/intervals/listeners so dispose() clears everything */
export function owner() {
  const offs: (() => void)[] = []
  return {
    on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) { el.addEventListener(type, fn, o); offs.push(() => el.removeEventListener(type, fn, o)) },
    timeout(fn: () => void, ms: number) { const id = window.setTimeout(fn, ms); offs.push(() => clearTimeout(id)); return id },
    interval(fn: () => void, ms: number) { const id = window.setInterval(fn, ms); offs.push(() => clearInterval(id)); return id },
    raf(fn: FrameRequestCallback) { const id = requestAnimationFrame(fn); offs.push(() => cancelAnimationFrame(id)); return id },
    add(fn: () => void) { offs.push(fn) },
    dispose() { offs.splice(0).forEach(f => f()) },
  }
}
export type { LabOpts }
