// Small shared helpers for the v3 UI layer.
export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const ROM: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
export function roman(n: number): string {
  let s = ''
  for (const [v, r] of ROM) while (n >= v) { s += r; n -= v }
  return s
}

type Attrs = Record<string, string | number | boolean | undefined | null>
/** Tiny DOM builder: h('div', { class: 'x' }, child, 'text') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (k === 'text') el.textContent = String(v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of kids) if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  return el
}

export function fontsReady(): Promise<void> {
  const f = (document as any).fonts
  return f?.ready ? f.ready.then(() => undefined) : Promise.resolve()
}

/** pad a number with a sign and fixed decimals for the camera readout */
export const sgn = (v: number, d = 2, w = 2) => {
  const a = Math.abs(v).toFixed(d)
  const [i, f] = a.split('.')
  return (v < 0 ? '-' : '+') + i.padStart(w, '0') + (f ? '.' + f : '')
}

/** "about $4,000" -> prefix "about $", number 4000 (comma), suffix "" ; "2.0 ms" -> 2.0, " ms" */
export function parseFigure(v: string) {
  const m = v.match(/^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/)
  if (!m) return null
  const num = m[2]
  return { pre: m[1], suf: m[3], target: parseFloat(num.replace(/,/g, '')), dec: (num.split('.')[1] ?? '').length, comma: num.includes(',') }
}
export function fmtNum(n: number, dec: number, comma: boolean) {
  const s = n.toFixed(dec)
  if (!comma) return s
  const [i, f] = s.split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '')
}
export const isRm = () => document.documentElement.classList.contains('rm')
