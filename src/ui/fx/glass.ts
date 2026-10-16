// Unit 15F: liquid glass. A panel that bends what is behind it: an SVG displacement map (a convex rounded-rect bezel, drawn once per size)
// feeds `backdrop-filter: url(#filter)`, so the pixels behind (the world canvas, the ink) are refracted at the rim and stay flat in the middle.
// Chromium only (the url() backdrop filter); elsewhere the panel keeps a plain blur. A specular arc travels the rim, led by the pointer.
// Reduced motion keeps the refraction and parks the arc.
import './glass.css'

export interface GlassOpts { radius?: number; bezel?: number; strength?: number; blur?: number }

const SVGNS = 'http://www.w3.org/2000/svg'
const chromium = typeof navigator !== 'undefined' && /Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent) || (typeof navigator !== 'undefined' && /Edg\//.test(navigator.userAgent))
let defs: SVGSVGElement | null = null
let uid = 0

function ensureDefs(): SVGSVGElement {
  if (defs) return defs
  defs = document.createElementNS(SVGNS, 'svg') as SVGSVGElement
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true')
  defs.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
  document.body.append(defs)
  return defs
}

/** a displacement map for a w x h rounded rect: R and G encode the outward direction scaled by a lens profile, 128 = no shift */
function mapFor(w: number, h: number, radius: number, bezel: number): string {
  const k = 0.5, cw = Math.max(8, Math.round(w * k)), ch = Math.max(8, Math.round(h * k))
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
  const c = cv.getContext('2d')!, img = c.createImageData(cw, ch), d = img.data
  const R = radius * k, B = bezel * k, hw = cw / 2, hh = ch / 2
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    // signed distance to the rounded rect (negative inside)
    const qx = Math.abs(x + 0.5 - hw) - (hw - R), qy = Math.abs(y + 0.5 - hh) - (hh - R)
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
    const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - R
    const i = (y * cw + x) * 4
    let r = 128, g = 128
    if (sd < 0 && -sd < B) {
      const t = 1 + sd / B                               // 0 at the rim .. 1 at the inner edge of the bezel
      const mag = Math.pow(1 - t, 2.2)                   // lens: strongest at the rim, none inside
      // direction of the gradient of the sdf
      let nx: number, ny: number
      if (qx > 0 || qy > 0) { const L = Math.hypot(ox, oy) || 1; nx = ox / L * Math.sign(x + 0.5 - hw); ny = oy / L * Math.sign(y + 0.5 - hh) }
      else if (qx > qy) { nx = Math.sign(x + 0.5 - hw); ny = 0 } else { nx = 0; ny = Math.sign(y + 0.5 - hh) }
      // the sample is pulled inward from the rim: the glass magnifies what lies just inside it
      r = 128 - nx * mag * 127; g = 128 - ny * mag * 127
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = 128; d[i + 3] = 255
  }
  c.putImageData(img, 0, 0)
  return cv.toDataURL('image/png')
}

/** make `el` liquid glass. Returns a disposer. */
export function liquidGlass(el: HTMLElement, o: GlassOpts = {}): () => void {
  el.classList.add('lg')
  const radius = o.radius ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20)
  const bezel = o.bezel ?? Math.min(34, radius * 1.4 + 6), blur = o.blur ?? 5
  let filter: SVGFilterElement | null = null, feImage: SVGFEImageElement | null = null, disp: SVGFEDisplacementMapElement | null = null
  let id = ''
  let raf = 0, lastW = 0, lastH = 0

  const apply = () => {
    raf = 0
    const r = el.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height)
    if (w < 24 || h < 24 || (w === lastW && h === lastH)) return
    lastW = w; lastH = h
    if (!filter) {
      id = `lg-${++uid}`
      filter = document.createElementNS(SVGNS, 'filter') as SVGFilterElement
      filter.id = id; filter.setAttribute('color-interpolation-filters', 'sRGB')
      filter.setAttribute('x', '0'); filter.setAttribute('y', '0'); filter.setAttribute('filterUnits', 'userSpaceOnUse')
      feImage = document.createElementNS(SVGNS, 'feImage') as SVGFEImageElement
      feImage.setAttribute('preserveAspectRatio', 'none'); feImage.setAttribute('result', 'map'); feImage.setAttribute('x', '0'); feImage.setAttribute('y', '0')
      disp = document.createElementNS(SVGNS, 'feDisplacementMap') as SVGFEDisplacementMapElement
      disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 'map'); disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G')
      filter.append(feImage, disp); ensureDefs().append(filter)
    }
    filter.setAttribute('width', String(w)); filter.setAttribute('height', String(h))
    feImage!.setAttribute('width', String(w)); feImage!.setAttribute('height', String(h))
    feImage!.setAttribute('href', mapFor(w, h, radius, bezel))
    disp!.setAttribute('scale', String(Math.round((o.strength ?? 1) * Math.min(48, bezel * 1.6))))
    el.style.setProperty('--lg-filter', `url(#${id})`)
    el.classList.add('lg-refract')
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply) }
  const ro = new ResizeObserver(queue)
  if (chromium) { ro.observe(el); queue() }
  el.style.setProperty('--lg-blur', blur + 'px')

  // the specular arc follows the pointer round the rim
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90
    el.style.setProperty('--lg-ang', a.toFixed(1) + 'deg'); el.classList.add('lg-hot')
    el.style.setProperty('--lg-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); el.style.setProperty('--lg-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
  }
  const leave = () => { el.classList.remove('lg-hot'); el.style.removeProperty('--lg-ang') }
  el.addEventListener('pointermove', move, { passive: true }); el.addEventListener('pointerleave', leave)
  return () => {
    ro.disconnect(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave)
    el.classList.remove('lg', 'lg-refract', 'lg-hot'); filter?.remove()
  }
}

/** panels the other modules own (Index, Contact sheet): given the glass look as they appear, with no edit to their files */
export function autoGlass(selectors: string[]): void {
  const done = new WeakSet<Element>()
  const scan = () => selectors.forEach(s => document.querySelectorAll<HTMLElement>(s).forEach(el => { if (!done.has(el)) { done.add(el); liquidGlass(el) } }))
  if (document.body) scan()
  new MutationObserver(scan).observe(document.body ?? document.documentElement, { childList: true, subtree: true })
}
