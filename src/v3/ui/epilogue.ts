// Contact: the contact block (two email rows, LinkedIn, GitHub, Credits) used by the contact sheet, the Overview and the ending, plus the Credits dialog.
// The project Index that used to sit below the track is gone: the last stop is the overview itself (world/extras/finale.ts), so buildIndex only keeps the
// node ui.ts expects. Everything here comes from src/data/site.json.
import { animate, scrambleText } from 'animejs'
import { SITE } from './copy'
import siteRaw from '../../data/site.json'
import { h, isRm } from './util'

const BIO = siteRaw.bio as { github: string; emailUchicago: string }
/** the ways to reach Joseph, all from src/data/site.json (bio.github is the GitHub profile, bio.emailUchicago the University of Chicago address) */
export const LINKS = { email: SITE.email, emailUchicago: BIO.emailUchicago, linkedin: SITE.linkedin, github: BIO.github }
/** the addresses in the order every contact block lists them */
export const EMAILS: { key: string; label: string; address: string }[] = [
  { key: 'personal', label: 'Personal', address: LINKS.email },
  { key: 'uchicago', label: 'University of Chicago', address: LINKS.emailUchicago },
]
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '')


/** SCRAMBLE_MS: how long the address scrambles back into itself when it is copied */
export const SCRAMBLE_MS = 400
export interface CopyToast { el: HTMLElement; show(msg: string): void }
/** a small "Copied" pill over the copy button. The live region exists from the start (so a screen reader hears the text arrive); `host` must be position: relative. */
export function makeToast(): CopyToast {
  const el = h('span', { class: 'copy-toast mono', role: 'status', 'aria-live': 'polite' })
  let t = 0
  return {
    el,
    show(msg) {
      clearTimeout(t); el.classList.remove('on'); el.textContent = ''
      requestAnimationFrame(() => { el.textContent = msg; el.classList.add('on') })
      t = window.setTimeout(() => { el.classList.remove('on'); t = window.setTimeout(() => { el.textContent = '' }, 300) }, 1700)
    },
  }
}
/** write an address (the personal one unless told otherwise) to the clipboard; on success the address scrambles for SCRAMBLE_MS (not when reduced motion is on) and the toast says Copied. Returns whether it worked. */
export async function copyEmailText(mail: HTMLElement, toast: CopyToast, reduced: boolean, address: string = SITE.email): Promise<boolean> {
  let ok = false
  try { await navigator.clipboard.writeText(address); ok = true } catch {
    const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-999px;top:0' }); ta.value = address; document.body.append(ta); ta.select()
    try { ok = document.execCommand('copy') } catch { /* ignore */ } ta.remove()
  }
  if (ok && !reduced) {
    mail.setAttribute('aria-label', address) // keep the link's name steady while its letters churn
    animate(mail, { innerHTML: scrambleText({ text: address, chars: 'a-z0-9', duration: SCRAMBLE_MS }), ease: 'linear', onComplete: () => { mail.textContent = address } })
  }
  toast.show(ok ? 'Copied' : 'Press ⌘C to copy')
  return ok
}

/** one third-party source from src/data/credits.json (written by the imagery package; the Overview prints the same list) */
interface CreditEntry { id?: string; what?: string; title?: string; source?: string; author?: string; licence?: string; url?: string }
const CREDIT_FILES = import.meta.glob('../../data/credits.json', { eager: true, import: 'default' }) as Record<string, unknown>
/** the list, or none when the file is absent (import.meta.glob then resolves to {}) */
const CREDIT_LIST: CreditEntry[] = (() => {
  const v = Object.values(CREDIT_FILES)[0] as unknown
  const list = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { credits?: unknown }).credits) ? (v as { credits: unknown[] }).credits : []
  return list.filter((c): c is CreditEntry => !!c && typeof c === 'object')
})()

let creditsDlg: HTMLDialogElement | null = null
/** the control that opened the Credits dialog; Esc and Close hand focus back to it */
let creditsOpener: HTMLElement | null = null

/** the Credits dialog: a native modal (top layer, so it sits over the contact sheet or the Overview alike; Esc closes it by default) */
function buildCreditsDialog(): HTMLDialogElement {
  const dlg = h('dialog', { class: 'cr-dlg', 'aria-labelledby': 'cr-h' })
  const close = h('button', { class: 'cr-x', type: 'button', 'data-cursor': '', 'aria-label': 'Close the credits' }, h('span', { text: 'Close' }), h('kbd', { 'aria-hidden': 'true', text: 'Esc' }))
  close.addEventListener('click', () => dlg.close())
  const items = CREDIT_LIST.map(c => {
    const name = c.title || c.what || c.id || 'Untitled source'
    const rows: [string, string | undefined][] = [['Source', c.source], ['Author', c.author], ['Licence', c.licence]]
    const meta = h('dl', { class: 'cr-meta' }, ...rows.filter(r => !!r[1]).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))))
    const link = c.url
      ? h('a', { class: 'cr-a', href: c.url, target: '_blank', rel: 'noopener noreferrer', 'data-cursor': '', 'aria-label': `${name}: source page (opens in a new tab)` },
        h('span', { text: 'Source page' }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '↗' }))
      : null
    return h('li', { class: 'cr-it' }, h('p', { class: 'cr-nm', text: name }), c.what ? h('p', { class: 'cr-what', text: c.what }) : null, meta, link)
  })
  dlg.append(
    h('header', { class: 'cr-top' }, h('p', { class: 'cr-kick mono', text: 'Sources' }), close),
    h('div', { class: 'cr-body' },
      h('h2', { id: 'cr-h', class: 'cr-h', tabindex: -1, text: 'Credits' }),
      h('p', { class: 'cr-intro', text: items.length ? 'Real-world imagery and data used on this site. Each source links to its own page.' : 'No third-party sources are listed.' }),
      h('ul', { class: 'cr-list' }, ...items)))
  // Escape closes this dialog only: the keystroke stops here, so the global keys and the nav never see it
  dlg.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation() })
  dlg.addEventListener('close', () => { const o = creditsOpener; creditsOpener = null; if (o && o.isConnected) o.focus({ preventScroll: true }) })
  return dlg
}

/** open the Credits dialog (built on first use and appended to <body>); the heading takes focus, and the opener gets it back on close */
export function openCredits(opener: HTMLElement | null = null): void {
  if (!creditsDlg) { creditsDlg = buildCreditsDialog(); document.body.append(creditsDlg) }
  if (creditsDlg.open) return
  creditsOpener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  creditsDlg.showModal()
  creditsDlg.querySelector<HTMLElement>('.cr-h')?.focus({ preventScroll: true })
}

/** the quiet "Credits" control in the contact block. Exported so any other contact console (the finale) can place the same control. */
export function creditsButton(): HTMLButtonElement {
  const b = h('button', { class: 'cr-open mono', type: 'button', 'data-cursor': '', 'aria-haspopup': 'dialog', 'aria-label': 'Credits: the sources of the imagery and data (opens a dialog)', text: 'Credits' })
  b.addEventListener('click', () => openCredits(b))
  return b
}

/** One email row: the address as a mailto link, its own Copy button, and its own "Copied" pill. The button names the address it copies. */
function emailRow(e: { key: string; label: string; address: string }): HTMLElement {
  const mail = h('a', { class: 'em', href: 'mailto:' + e.address, 'data-cursor': '', 'data-email': e.key, text: e.address })
  const copy = h('button', { class: 'cp mono', type: 'button', 'data-cursor': '', 'data-copy': e.key, 'aria-label': `Copy ${e.address}` }, h('span', { text: 'Copy' }))
  const toast = makeToast()
  let t = 0
  copy.addEventListener('click', async () => {
    const label = copy.firstElementChild as HTMLElement
    const ok = await copyEmailText(mail, toast, isRm(), e.address)
    const next = ok ? 'Copied' : 'Press \u2318C'
    if (isRm()) label.textContent = next
    else animate(label, { innerHTML: scrambleText({ text: next, chars: 'A-Z', cursor: true, duration: 520 }) })
    clearTimeout(t)
    t = window.setTimeout(() => { if (isRm()) label.textContent = 'Copy'; else animate(label, { innerHTML: scrambleText({ text: 'Copy', chars: 'A-Z', duration: 380 }) }) }, 1800)
  })
  return h('div', { class: 'em-item' }, h('span', { class: 'em-k mono', text: e.label }), h('div', { class: 'em-row' }, mail, copy, toast.el))
}

/** The contact block: both addresses (each a mailto link with its own Copy button), LinkedIn, GitHub and Credits. The contact sheet (C), the Overview dialog (O)
 *  and the ending all build one. `opts` is kept for the callers that pass { sheet: true }; every variant is the same block now that the Index is gone. */
export function buildContact(_opts: { sheet?: boolean } = {}): HTMLElement {
  const ext = (cls: string, href: string, label: string, aria: string) => h('a', { class: `li mono ${cls}`, href, target: '_blank', rel: 'noopener noreferrer', 'data-cursor': '', 'aria-label': aria },
    h('span', { text: label }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '\u2197' }))
  const li = ext('lk', LINKS.linkedin, 'LinkedIn \u00b7 ' + shortUrl(LINKS.linkedin), 'LinkedIn (opens in a new tab)')
  const gh = ext('gh', LINKS.github, 'GitHub \u00b7 ' + shortUrl(LINKS.github), 'GitHub (opens in a new tab)')
  return h('div', { class: 'contact' },
    h('span', { class: 'lab mono', text: 'Write to me' }),
    h('div', { class: 'em-set' }, ...EMAILS.map(emailRow)),
    h('div', { class: 'links' }, li, gh, creditsButton()))
}

export interface IndexEnv {
  onOpen(id: string, el: HTMLElement): void
  onJump(areaId: string): void
  onTop(): void
}

/** The project Index below the track is gone: the last stop is the overview itself, with the contact first and every project listed (finale.ts). ui.ts still
 *  appends this node after the track and nothing scrolls past the track any more, so it is a hidden stub that takes no space. A link to #index (the skip
 *  link, the Index menu's footer) is sent to the last stop by finale.ts. */
export function buildIndex(_env: IndexEnv): { el: HTMLElement; reveal(): void } {
  const el = h('section', { class: 'idx-gone', id: 'index', hidden: true, 'aria-hidden': 'true' })
  return { el, reveal() { /* nothing to reveal */ } }
}
