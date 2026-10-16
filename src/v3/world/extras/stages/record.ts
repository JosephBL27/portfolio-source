// STAGE "record" (Unequal Mobilization). Style: a printed paper map. The paper's own county figure (public/media/wwii/imbalance-map-lg.webp,
// the same image the particle form samples) is re-printed here as a halftone on cream paper, cut to the shape of the country, stacked in
// four sheets for a paper edge, and folded like a road map (4 x 3 panels: real vertex displacement with analytic creases). The counties
// rise from it as bars: height = the figure's colour intensity, exactly the form's rule (0.03 + 0.5 * m^1.3, here with the relief
// exaggerated); red = loss exceeds investment, blue = investment exceeds loss. No number is drawn, no claim is made beyond the figure.
//   entrance  the map unfolds from a folded stack (spring), turns to its place, then the bars rise in a wave from west to east
//   exit      the bars sink east to west, the map folds shut and slides away
import * as THREE from 'three'
import { url } from '../../../../data'
import credits from '../../../../data/credits.json'
import { canvasTex, clamp01, easeInCubic, easeInOutCubic, easeOutCubic, lit, sstep, stageTip, tryMark, type StageBuildCtx, type StageDef, type StagePointer, type StageFrame } from './common'

const SRC = 'media/wwii/imbalance-map-lg.webp'
// The archival plate: a 1940s Census Bureau map of the United States (Library of Congress), printed faint and sepia under the halftone. Licence and credit: src/data/credits.json
const PLATE = 'media/wwii/archive/us-population-density-1940.jpg'
const PLATE_ID = 'wwii-archive-map', PLATE_OPACITY = 0.35
// the country's extent inside the plate image (fractions of its width and height), so the old map's land sits under the figure's land
const PLATE_BOX = { x0: 0.01, y0: 0.004, x1: 0.99, y1: 0.968 }
const plateCredit = (credits as { id: string; title: string; source: string; url: string; author: string }[]).find(c => c.id === PLATE_ID)
/** the legend's one-line caption: 'Map: <LOC title, shortened>, <year>, Library of Congress' (the year is the Government Printing Office's, as credited in credits.json) */
const PLATE_CAPTION = (() => {
  const yr = plateCredit?.author.match(/\b(19\d\d)\b/)?.[1]
  return plateCredit && yr ? `Map: U.S. population density map, ${yr}, Library of Congress` : ''
})()
const MAPW = 7.3
const HM = 0.5, RELIEF = 1.25
const INK_R = '#b9402a', INK_B = '#2b5c92', WASH = '#eee5cf', PAPER_EDGE = 0xcfc3a8

interface MapData { w: number; h: number; land: Uint8Array; m: Float32Array; sg: Int8Array; box: { x0: number; y0: number; x1: number; y1: number } }

async function loadMap(maxSide: number): Promise<MapData> {
  const img = new Image(); img.decoding = 'async'; img.src = url(SRC); await img.decode()
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, w, h)
  const data = g.getImageData(0, 0, w, h).data, px = w * h
  const white = (i: number) => data[i * 4] >= 249 && data[i * 4 + 1] >= 249 && data[i * 4 + 2] >= 249
  const bg = new Uint8Array(px), stack = new Int32Array(px); let sp = 0
  const push = (i: number) => { if (!bg[i] && white(i)) { bg[i] = 1; stack[sp++] = i } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (sp) {
    const i = stack[--sp], x = i % w, y = (i - x) / w
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const j = yy * w + xx; if (!bg[j] && white(j)) { bg[j] = 1; stack[sp++] = j }
    }
  }
  const lx = Math.floor(w * 0.462), ly = Math.floor(h * 0.795)               // the figure's legend lives in the lower-left corner
  for (let y = ly; y < h; y++) for (let x = 0; x < lx; x++) bg[y * w + x] = 1
  // enclosed white areas of useful size are lakes (water, not land)
  const water = new Uint8Array(px), seen = new Uint8Array(px), minLake = Math.max(30, Math.floor(px * 0.00022)), comp: number[] = []
  for (let i0 = 0; i0 < px; i0++) {
    if (bg[i0] || seen[i0] || !white(i0)) continue
    comp.length = 0; sp = 0; stack[sp++] = i0; seen[i0] = 1
    while (sp) {
      const i = stack[--sp]; comp.push(i); const x = i % w, y = (i - x) / w
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const j = yy * w + xx; if (!seen[j] && !bg[j] && white(j)) { seen[j] = 1; stack[sp++] = j }
      }
    }
    if (comp.length >= minLake) for (const i of comp) water[i] = 1
  }
  const land = new Uint8Array(px), m = new Float32Array(px), sg = new Int8Array(px)
  let x0 = w, x1 = 0, y0 = h, y1 = 0
  for (let i = 0; i < px; i++) {
    if (bg[i] || water[i]) continue
    land[i] = 1
    const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2], luma = 0.299 * r + 0.587 * gg + 0.114 * b, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
    if (!(mx - mn < 16 && luma < 242)) { m[i] = Math.min(1, Math.max(0, (247 - luma) / 205)); sg[i] = r >= b ? 1 : -1 }   // grey state lines carry no value
    const x = i % w, y = (i - x) / w
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return { w, h, land, m, sg, box: { x0, y0, x1, y1 } }
}

async function loadPlate(): Promise<HTMLImageElement | null> {
  try { const img = new Image(); img.decoding = 'async'; img.src = url(PLATE); await img.decode(); return img } catch { return null }
}

/** GLSL shared by the paper and the bars: fold the flat map like a road map (4 columns x 3 rows), amounts uFx / uFz (radians) */
const FOLD_GLSL = /* glsl */ `
uniform float uFx, uFz, uW, uD;
vec3 foldP(vec3 p) {
  float u = p.x + uW * 0.5, v = p.z + uD * 0.5;
  float Wp = uW / 4.0, Dp = uD / 3.0;
  float iu = clamp(floor(u / Wp), 0.0, 3.0), iv = clamp(floor(v / Dp), 0.0, 2.0);
  float su = u - iu * Wp, sv = v - iv * Dp;
  float tx = mod(iu, 2.0) < 0.5 ? su : Wp - su, tz = mod(iv, 2.0) < 0.5 ? sv : Dp - sv;
  return vec3(p.x * cos(uFx), p.y + tx * sin(uFx) + tz * sin(uFz), p.z * cos(uFz));
}
vec3 foldN(vec3 p) {
  float u = p.x + uW * 0.5, v = p.z + uD * 0.5;
  float iu = clamp(floor(u / (uW / 4.0)), 0.0, 3.0), iv = clamp(floor(v / (uD / 3.0)), 0.0, 2.0);
  float sx = mod(iu, 2.0) < 0.5 ? 1.0 : -1.0, sz = mod(iv, 2.0) < 0.5 ? 1.0 : -1.0;
  return normalize(vec3(-tan(uFx) * sx, 1.0, -tan(uFz) * sz));
}`
type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }

export default {
  id: 'record',
  build(c: StageBuildCtx) {
    const { env, phone, view } = c
    const root = new THREE.Group()
    const az = Math.atan2(view.dir.x, view.dir.z)
    const yawG = new THREE.Group(); yawG.rotation.y = az * 0.5; root.add(yawG)
    const rig = new THREE.Group(); yawG.add(rig)
    const spin = new THREE.Group(); rig.add(spin)
    let ready = false
    const FU: Record<string, THREE.IUniform> = { uFx: { value: 1.3 }, uFz: { value: 1.2 }, uW: { value: MAPW }, uD: { value: MAPW * 0.6 }, uRise: { value: 0 }, uTime: { value: 0 } }

    const patchPaper = (m: THREE.MeshStandardMaterial, key: string) => lit(m, key, (s: Shader) => {
      Object.assign(s.uniforms, FU)
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\n' + FOLD_GLSL)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = foldN(position);')
        .replace('#include <project_vertex>', 'vec4 mvPosition = vec4(foldP(transformed), 1.0);\n mvPosition = modelViewMatrix * mvPosition;\n gl_Position = projectionMatrix * mvPosition;')
    })

    const update = (_f: StageFrame) => {}
    const inst = { root, update: (f: StageFrame) => run(f), get dust() { return ready ? 0.1 : 1 }, size: [7.6, 5.0] as [number, number], pointer: undefined as StagePointer | undefined, hint: ['Touch a county', 'darker = further from even'] as [string, string] }
    let run: (f: StageFrame) => void = () => {}

    Promise.all([loadMap(phone ? 520 : 760), loadPlate()]).then(([M, plate]) => {
      const { w, h, land, m, sg, box } = M
      const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1, scale = MAPW / bw, MAPD = bh * scale
      FU.uD.value = MAPD
      // ------------------------------------------------------------ print texture: wash cut to the land, halftone dots in two inks, crease lines
      const CW = phone ? 1024 : 1536, CH = Math.round(CW * bh / bw)
      const mask = document.createElement('canvas'); mask.width = bw; mask.height = bh
      const mg = mask.getContext('2d')!, mi = mg.createImageData(bw, bh)
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (box.y0 + y) * w + box.x0 + x, o = (y * bw + x) * 4; mi.data[o] = mi.data[o + 1] = mi.data[o + 2] = 255; mi.data[o + 3] = land[i] ? 255 : 0 }
      mg.putImageData(mi, 0, 0)
      const maskTex = (() => { const t = canvasTex(512, Math.round(512 * bh / bw), (g, cw, ch) => { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.filter = 'blur(0.6px)'; g.drawImage(mask, 0, 0, cw, ch) }, { srgb: false }); return t })()
      const print = canvasTex(CW, CH, (g, cw, ch) => {
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
        // wash: the land in cream, from the mask scaled up (smooth edge)
        g.drawImage(mask, 0, 0, cw, ch)
        g.globalCompositeOperation = 'source-in'; g.fillStyle = WASH; g.fillRect(0, 0, cw, ch)
        g.globalCompositeOperation = 'source-atop'
        // paper fibre
        let sd = 11; const rn = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296 }
        for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(${rn() < 0.5 ? '120,100,70' : '255,250,235'},${(0.03 + rn() * 0.05).toFixed(3)})`; g.lineWidth = 0.6; const x = rn() * cw, y = rn() * ch, a = rn() * 6.28, l = 6 + rn() * 22; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke() }
        // the archival plate: the old Census map, desaturated to sepia, multiplied under the print at low opacity, then re-clipped to the land
        if (plate) {
          const pc = document.createElement('canvas'); pc.width = cw; pc.height = ch
          const pg = pc.getContext('2d', { willReadFrequently: true })!; pg.imageSmoothingQuality = 'high'
          const sw = plate.naturalWidth, sh = plate.naturalHeight
          pg.drawImage(plate, PLATE_BOX.x0 * sw, PLATE_BOX.y0 * sh, (PLATE_BOX.x1 - PLATE_BOX.x0) * sw, (PLATE_BOX.y1 - PLATE_BOX.y0) * sh, 0, 0, cw, ch)
          // levels: the sheet's paper stays white (multiply leaves it alone), its tints and linework go to a warm grey (sepia, no hue of the original ink)
          const pd = pg.getImageData(0, 0, cw, ch), q = pd.data
          for (let i = 0; i < q.length; i += 4) {
            const l = (0.299 * q[i] + 0.587 * q[i + 1] + 0.114 * q[i + 2]) / 255, t = Math.min(1, Math.max(0, (l - 0.5) / 0.42)), v = 0.1 + 0.9 * Math.pow(t, 1.4)
            q[i] = 255 * v; q[i + 1] = 255 * v * 0.92; q[i + 2] = 255 * v * 0.76
          }
          pg.putImageData(pd, 0, 0)
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = PLATE_OPACITY; g.drawImage(pc, 0, 0); g.restore()
          g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0, cw, ch); g.restore()
          g.globalCompositeOperation = 'source-atop'
        }
        // halftone: a 45-degree screen; dot area follows the figure's intensity, ink follows its sign
        const pitch = phone ? 8 : 9, ca = Math.cos(Math.PI / 4), sa = Math.sin(Math.PI / 4)
        const sample = (u: number, v: number): [number, number] => {            // canvas px -> figure px (box-relative), mean over a 3x3 of land pixels
          const fx = box.x0 + (u / cw) * bw, fy = box.y0 + (v / ch) * bh
          let sm = 0, ss = 0, n = 0
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.round(fx + dx), yy = Math.round(fy + dy); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            const i = yy * w + xx; if (!land[i]) continue; sm += m[i]; ss += sg[i] * m[i]; n++
          }
          return n < 5 ? [0, 0] : [sm / n, ss]
        }
        const span = Math.hypot(cw, ch)
        for (let j = -span / pitch; j < span / pitch; j++) for (let i = -span / pitch; i < span / pitch; i++) {
          const gx = i * pitch, gy = j * pitch, x = cw / 2 + gx * ca - gy * sa, y = ch / 2 + gx * sa + gy * ca
          if (x < 0 || y < 0 || x >= cw || y >= ch) continue
          const [mm, ss] = sample(x, y); if (mm < 0.05) continue
          const r = pitch * 0.74 * Math.sqrt(Math.min(1, mm * 1.05)) + 0.5
          g.fillStyle = ss >= 0 ? INK_R : INK_B; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill()
        }
        // crease lines where the map folds
        g.globalCompositeOperation = 'source-atop'
        for (let k = 1; k < 4; k++) { const x = (k / 4) * cw; g.fillStyle = 'rgba(255,252,240,0.55)'; g.fillRect(x - 1, 0, 1.6, ch); g.fillStyle = 'rgba(60,45,25,0.35)'; g.fillRect(x + 0.6, 0, 1.4, ch) }
        for (let k = 1; k < 3; k++) { const y = (k / 3) * ch; g.fillStyle = 'rgba(255,252,240,0.55)'; g.fillRect(0, y - 1, cw, 1.6); g.fillStyle = 'rgba(60,45,25,0.35)'; g.fillRect(0, y + 0.6, cw, 1.4) }
      }, { aniso: 8 })

      // ------------------------------------------------------------ the paper: four sheets (the lower three plain, for the edge), the printed one on top
      const segs = phone ? [64, 40] : [112, 68]
      const sheetGeo = new THREE.PlaneGeometry(MAPW, MAPD, segs[0], segs[1]); sheetGeo.rotateX(-Math.PI / 2)
      const top = new THREE.Mesh(sheetGeo, patchPaper(new THREE.MeshStandardMaterial({ map: print.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.86, metalness: 0, envMap: env, envMapIntensity: 0.9 }), 'paper'))
      top.frustumCulled = false; spin.add(top)
      const under = patchPaper(new THREE.MeshStandardMaterial({ color: PAPER_EDGE, alphaMap: maskTex.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, envMap: env, envMapIntensity: 0.4 }), 'paper-edge')
      for (let i = 1; i <= 3; i++) { const s = new THREE.Mesh(sheetGeo, under); s.position.y = -0.016 * i; s.frustumCulled = false; spin.add(s) }
      // soft shadow on nothing in particular: the map floats, its shadow falls on the dark below
      const shTex = canvasTex(256, Math.round(256 * bh / bw), (g, cw, ch) => { g.filter = 'blur(10px)'; g.fillStyle = '#000'; g.drawImage(mask, 12, 12, cw - 24, ch - 24); g.globalCompositeOperation = 'source-in'; g.fillRect(0, 0, cw, ch) }, { mips: false })
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(MAPW * 1.12, MAPD * 1.14), new THREE.MeshBasicMaterial({ map: shTex.tex, transparent: true, opacity: 0.6, depthWrite: false })); lit(shadow.material as THREE.MeshBasicMaterial, 'map-shadow')
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.7; spin.add(shadow)

      // ------------------------------------------------------------ the bars: one instanced mesh, one box per cell, height in the shader
      const Q = phone ? 6 : 5, GW = Math.ceil(bw / Q), GH = Math.ceil(bh / Q)
      const cells: { x: number; z: number; hgt: number; m: number; s: number }[] = [], flats: { x: number; z: number }[] = []
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        let n = 0, area = 0, sm = 0, ss = 0
        for (let y = box.y0 + gy * Q; y < Math.min(h, box.y0 + gy * Q + Q); y++) for (let x = box.x0 + gx * Q; x < Math.min(w, box.x0 + gx * Q + Q); x++) { const i = y * w + x; area++; if (land[i]) { n++; sm += m[i]; ss += sg[i] * m[i] } }
        if (n < area * 0.5) continue
        const mm = sm / n
        if (mm < 0.27) { flats.push({ x: ((gx * Q + Q / 2) / bw - 0.5) * MAPW, z: ((gy * Q + Q / 2) / bh - 0.5) * MAPD }); continue }      // pale counties stay flat paper (hover reads them as 'close to even')
        cells.push({ x: ((gx * Q + Q / 2) / bw - 0.5) * MAPW, z: ((gy * Q + Q / 2) / bh - 0.5) * MAPD, hgt: (0.03 + HM * Math.pow(mm, 1.3)) * RELIEF, m: mm, s: ss >= 0 ? 1 : -1 })
      }
      const N = cells.length, cellW = Q * scale
      const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0)
      const aH = new Float32Array(N), aD = new Float32Array(N)
      const barMat = lit(new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, envMap: env, envMapIntensity: 0.5 }), 'bars', (s: Shader) => {
        Object.assign(s.uniforms, FU)
        s.vertexShader = s.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aH; attribute float aD; uniform float uRise, uTime;\n' + FOLD_GLSL)
          .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
 float rk = clamp((uRise * 1.8 - aD) / 0.8, 0.0, 1.0); rk = 1.0 + 2.7 * pow(rk - 1.0, 3.0) + 1.7 * pow(rk - 1.0, 2.0); rk = max(rk, 0.0) * step(0.0001, uRise);
 float crest = 1.0 + 0.1 * sin(uTime * 1.2 - instanceMatrix[3].x * 0.9) * smoothstep(0.7, 1.0, uRise);
 transformed.y *= aH * rk * crest;`)
          .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
 mvPosition = instanceMatrix * mvPosition;
 mvPosition = modelViewMatrix * vec4(foldP(mvPosition.xyz), 1.0);
 gl_Position = projectionMatrix * mvPosition;`)
      })
      const bars = new THREE.InstancedMesh(bGeo, barMat, N); bars.frustumCulled = false
      const col = new THREE.Color(), mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3()
      cells.forEach((cl, i) => {
        sc.set(cellW * 0.82, 1, cellW * 0.82); ps.set(cl.x, 0.002, cl.z); mat4.compose(ps, q, sc); bars.setMatrixAt(i, mat4)
        const lo = cl.s > 0 ? new THREE.Color(INK_R) : new THREE.Color(INK_B), hi = cl.s > 0 ? new THREE.Color('#5d130c') : new THREE.Color('#0f2a4d')
        col.copy(lo).lerp(hi, clamp01((cl.m - 0.3) / 0.7)); bars.setColorAt(i, col)
        aH[i] = cl.hgt; aD[i] = (cl.x / MAPW + 0.5) * 0.7 + ((i * 7919) % 100) / 100 * 0.12
      })
      bGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 1)); bGeo.setAttribute('aD', new THREE.InstancedBufferAttribute(aD, 1))
      spin.add(bars)
      ready = true
      c.prewarm(root)
      // ------------------------------------------------------------ interaction: hover a county bar to read it. The bar lifts and brightens, and a label gives its side
      // (losses outran investment, or the reverse) and how to read the shade (darker = further from even). It prints no number: the paper's figure is a colour scale,
      // and a figure computed from a bar's colour intensity is not data. Tap does the same on touch. The pick radius is generous (18px at least, a finger's reach),
      // the current bar sticks until another is 6px closer, and the label lingers 400 ms after the pointer leaves.
      const lbl = stageTip(), V = new THREE.Vector3(), cam = c.camera
      const gridOf = new Map<number, number>()
      let hotI = -1, tipUntil = 0, lastSnd = 0, clockNow = 0, emitR = (_n: string) => {}
      const baseCol: THREE.Color[] = cells.map((_, i) => { const cc = new THREE.Color(); bars.getColorAt(i, cc); return cc })
      void gridOf
      const foldCpu = (x: number, y: number, z: number, out: THREE.Vector3) => {
        const Wm = FU.uW.value as number, Dm = FU.uD.value as number, fx = FU.uFx.value as number, fz = FU.uFz.value as number
        const u = x + Wm / 2, v = z + Dm / 2, Wp = Wm / 4, Dp = Dm / 3, iu = Math.min(3, Math.max(0, Math.floor(u / Wp))), iv = Math.min(2, Math.max(0, Math.floor(v / Dp)))
        const su = u - iu * Wp, sv = v - iv * Dp, tx = iu % 2 === 0 ? su : Wp - su, tz = iv % 2 === 0 ? sv : Dp - sv
        return out.set(x * Math.cos(fx), y + tx * Math.sin(fx) + tz * Math.sin(fz), z * Math.cos(fz))
      }
      const MIN_R = 18, STICK = 6, LINGER = 0.4
      const nearest = (x: number, y: number): number => {
        if ((FU.uRise.value as number) < 0.85) return -1
        spin.updateWorldMatrix(true, false)
        const W2 = innerWidth / 2, H2 = innerHeight / 2
        spin.getWorldPosition(V); const d = V.distanceTo(cam.position)
        const pxu = innerHeight / (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) * rig.scale.x * root.scale.x
        const R = Math.max(MIN_R, cellW * pxu * 0.75)
        let best = -1, bd = 1e9, cur = 1e9
        for (let i = 0; i < N; i++) {
          const cl = cells[i]
          let di = 1e9
          for (const k of [0.5, 1]) {
            foldCpu(cl.x, cl.hgt * k, cl.z, V); V.applyMatrix4(spin.matrixWorld).project(cam)
            const dx = (V.x + 1) * W2 - x, dy = (1 - V.y) * H2 - y, dd = Math.hypot(dx, dy)
            if (dd < di) di = dd
          }
          if (i === hotI) cur = di
          if (di < R && di - cl.hgt * 2 < bd) { bd = di - cl.hgt * 2; best = i }
        }
        // hysteresis: keep the bar under the pointer until another one is 6px closer
        if (hotI >= 0 && hotI < N && best !== hotI && cur < R && cur - cells[hotI].hgt * 2 <= bd + STICK) return hotI
        if (best >= 0) return best
        // no bar in reach: pale paper (a county close to even on the figure's scale), so the whole map answers the pointer
        let bf = -1, fd = R, curF = 1e9
        for (let j = 0; j < flats.length; j++) {
          foldCpu(flats[j].x, 0, flats[j].z, V); V.applyMatrix4(spin.matrixWorld).project(cam)
          const di = Math.hypot((V.x + 1) * W2 - x, (1 - V.y) * H2 - y)
          if (N + j === hotI) curF = di
          if (di < fd) { fd = di; bf = j }
        }
        if (hotI >= N && bf !== hotI - N && curF < R && curF <= fd + STICK) return hotI
        return bf >= 0 ? N + bf : -1
      }
      const setHot = (i: number, x: number, y: number) => {
        if (i !== hotI) {
          if (hotI >= 0 && hotI < N) { bars.setColorAt(hotI, baseCol[hotI]); aH[hotI] = cells[hotI].hgt }
          hotI = i
          if (i >= 0 && i < N) { const cl = cells[i]; bars.setColorAt(i, baseCol[i].clone().lerp(new THREE.Color(cl.s > 0 ? '#ffb4a0' : '#a9d0ff'), 0.55)); aH[i] = cl.hgt * 1.16; if (clockNow - lastSnd > 0.09) { lastSnd = clockNow; emitR('obj:probe') } }
          if (bars.instanceColor) bars.instanceColor.needsUpdate = true; ;(bGeo.getAttribute('aH') as THREE.BufferAttribute).needsUpdate = true
        }
        if (i < 0) { lbl.hide(); return }
        if (i >= N) { lbl.show(x, y, 'Close to even', 'darker = further from even', '#c9bfa6'); return }
        const cl = cells[i]
        lbl.show(x, y, cl.s > 0 ? 'Losses outran investment' : 'More investment than losses', 'darker = further from even', cl.s > 0 ? '#e0583f' : '#4f86c6')
      }
      let hideAt = 0
      const pointer: StagePointer = {
        hover(_r, x, y) {
          const i = nearest(x, y)
          if (i >= 0) { hideAt = 0; setHot(i, x, y); return 'pointer' }
          if (hotI >= 0 && !hideAt) hideAt = clockNow + LINGER           // left every bar: the label and the lifted bar linger for 400 ms
          return null
        },
        down(_r, x, y) { const i = nearest(x, y); if (i < 0) return null; mark.dismiss(); hideAt = 0; setHot(i, x, y); tipUntil = clockNow + 2.6; return 'tap' },
        leave() { if (clockNow < tipUntil) return; if (hotI >= 0 && !hideAt) hideAt = clockNow + LINGER },
      }
      // the try-me mark sits on the tallest bar; the legend strip is a DOM node under the map (the diverging scale: blue = investment, cream = even, red = losses)
      let topI = 0; for (let i = 1; i < N; i++) if (cells[i].hgt > cells[topI].hgt) topI = i
      const markAt = new THREE.Vector3()
      const mark = tryMark('record', 'Touch a county', () => { if ((FU.uRise.value as number) < 0.95) return null; spin.updateWorldMatrix(true, false); foldCpu(cells[topI].x, cells[topI].hgt * 0.7, cells[topI].z, markAt); return markAt.applyMatrix4(spin.matrixWorld) }, cam, '#e0583f')
      const legend = document.createElement('div'); legend.className = 'rec-legend'; legend.setAttribute('data-proof', 'skip'); legend.setAttribute('aria-hidden', 'true')
      legend.innerHTML = '<div class="rl-ends"><span class="rl-b">More investment than losses</span><span class="rl-r">Losses outran investment</span></div><div class="rl-bar"></div><div class="rl-mid"><span>even</span></div><div class="rl-note">darker = further from even</div>' + (PLATE_CAPTION ? '<div class="rl-cap">' + PLATE_CAPTION + '</div>' : '')
      const lst = document.createElement('style')
      lst.textContent = `.rec-legend{position:fixed;left:0;top:0;z-index:60;width:min(300px,64vw);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .4s ease-out,visibility 0s linear .4s;font:500 9.5px/1.3 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(241,236,224,.82)}.rec-legend.on{opacity:1;visibility:visible;transition:opacity .4s ease-out}.rl-ends{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px}.rl-ends span{max-width:48%}.rl-b{color:#8fb7e6}.rl-r{color:#f08a74;text-align:right}.rl-bar{height:8px;border-radius:4px;background:linear-gradient(90deg,${INK_B} 0%,#6e92bd 22%,${WASH} 50%,#d98a70 78%,${INK_R} 100%);box-shadow:0 0 0 1px rgba(255,255,255,.14)}.rl-mid{position:relative;height:10px}.rl-mid span{position:absolute;left:50%;transform:translateX(-50%);top:3px;opacity:.7}.rl-mid:before{content:"";position:absolute;left:50%;top:0;height:4px;width:1px;background:rgba(255,255,255,.5)}.rl-note{margin-top:8px;text-align:center;opacity:.6}.rl-cap{margin-top:5px;text-align:center;opacity:.42;letter-spacing:.06em;font-size:8.5px}@media (prefers-reduced-motion:reduce){.rec-legend,.rec-legend.on{transition:none}}`
      document.head.append(lst); document.body.append(legend)
      let legOn = false, legX = 0, legY = 0, legUp = 0, legWatch = 0
      const legendAt = new THREE.Vector3()
      const placeLegend = (show: boolean) => {
        if (!show) { if (legOn) { legOn = false; legend.classList.remove('on'); if (legWatch) { clearInterval(legWatch); legWatch = 0 } } return }
        legUp = performance.now()
        if (!legWatch) legWatch = window.setInterval(() => { if (performance.now() - legUp > 250) placeLegend(false) }, 250)      // the stage stopped updating (it left): hide
        // the map's near edge, a little below it, in screen space, left-aligned with the map (the middle of the foot is where the TV's orb hangs)
        spin.updateWorldMatrix(true, false)
        const Dm = FU.uD.value as number
        legendAt.set(-MAPW / 2 + 0.4, 0, Dm / 2 + 0.25); foldCpu(legendAt.x, legendAt.y, legendAt.z, legendAt); legendAt.applyMatrix4(spin.matrixWorld).project(cam)
        const w = legend.offsetWidth || 300, h = legend.offsetHeight || 60
        const phoneNow = innerWidth <= 760
        let x = (legendAt.x + 1) / 2 * innerWidth, y = (1 - legendAt.y) / 2 * innerHeight + 14
        if (phoneNow) x = innerWidth / 2 - w / 2
        x = Math.max(12, Math.min(innerWidth - w - 12, x)); y = Math.max(60, Math.min((phoneNow ? innerHeight - 84 : innerHeight - 20) - h, y))
        legX = legOn ? legX + (x - legX) * 0.2 : x; legY = legOn ? legY + (y - legY) * 0.2 : y
        legend.style.transform = `translate(${Math.round(legX)}px,${Math.round(legY)}px)`
        if (!legOn) { legOn = true; legend.classList.add('on') }
      }
      inst.pointer = pointer
      ;(inst as { debug?: () => unknown }).debug = () => {
        // screen positions of every bar (for measuring the hover sweep), and the projected map corners
        spin.updateWorldMatrix(true, false)
        const pr = (x: number, y: number, z: number) => { foldCpu(x, y, z, V); V.applyMatrix4(spin.matrixWorld).project(cam); return [Math.round((V.x + 1) / 2 * innerWidth), Math.round((1 - V.y) / 2 * innerHeight)] }
        const Dm = FU.uD.value as number
        return { hot: hotI, cells: N, cell: hotI >= 0 && hotI < N ? cells[hotI] : null, bars: cells.map(cl => pr(cl.x, cl.hgt * 0.5, cl.z)), corners: [pr(-MAPW / 2, 0, -Dm / 2), pr(MAPW / 2, 0, -Dm / 2), pr(MAPW / 2, 0, Dm / 2), pr(-MAPW / 2, 0, Dm / 2)] }
      }
      ;(inst as { tick?: (t: number, e: (n: string) => void) => void }).tick = (t, e) => {
        clockNow = t; emitR = e
        if (hotI >= 0 && tipUntil && t > tipUntil) { tipUntil = 0; setHot(-1, 0, 0) }
        if (hotI >= 0 && hideAt && t > hideAt && !tipUntil) { hideAt = 0; setHot(-1, 0, 0) }
      }
      run = (f: StageFrame) => {
        const rm = f.reduced
        ;(inst as { tick?: (t: number, e: (n: string) => void) => void }).tick?.(f.t, n => f.emit(n))
        mark.update(f.tIn > 0.6 && f.depart < 0.02 && hotI < 0, f.dt, f.reduced)
        placeLegend(f.depart < 0.02 && (FU.uRise.value as number) > 0.9)
        const sa = rm ? 1 : clamp01((f.arrive - 0.1) / 0.9), sd = rm ? 0 : sstep(0, 0.9, f.depart)
        // unfold (x first, then z) with a spring; fold shut on exit
        const sp = (x: number) => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * (Math.cos(6.2832 * 0.9 * x) + 0.95 * Math.sin(6.2832 * 0.9 * x)))
        const ux = sp(clamp01(sa / 0.8)), uz = sp(clamp01((sa - 0.1) / 0.8))
        const fx = 0.13 + 1.22 * (1 - ux) + 1.1 * easeInCubic(sstep(0.25, 1, sd)), fz = 0.11 + 1.15 * (1 - uz) + 1.0 * easeInCubic(sstep(0.35, 1, sd))
        FU.uFx.value = Math.min(1.45, Math.max(-0.2, fx + (rm ? 0 : 0.006 * Math.sin(f.t * 0.7)))); FU.uFz.value = Math.min(1.4, Math.max(-0.2, fz))
        FU.uTime.value = rm ? 0 : f.t
        const rise = rm ? 1 : Math.min(1, clamp01((sa - 0.62) / 0.38) * 0.5 + 0.5 * clamp01(f.tIn / 1.8)) * (1 - easeInOutCubic(sstep(0, 0.45, sd)))
        FU.uRise.value = rise > 0.002 ? Math.max(0.003, rise) : 0
        const e = easeOutCubic(sstep(0, 0.75, sa))
        rig.position.set(0.2 * (1 - e) - 4 * easeInCubic(sd), -2.0 * (1 - e) - 2.5 * easeInCubic(sd), -1.0 * (1 - e))
        rig.scale.setScalar(0.7 + 0.3 * e)
        rig.rotation.set(0.25 * (1 - e) + 0.5 * easeInCubic(sd), 0, 0)
        spin.rotation.y = (rm ? -0.12 : -0.12 + Math.sin(f.t * 0.3) * 0.08) + 1.3 * (1 - easeInOutCubic(sstep(0, 0.9, sa))) - 1.2 * easeInCubic(sd)
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.6 * sstep(0.3, 0.9, sa) * (1 - sstep(0.1, 0.6, sd))
        shadow.position.y = -0.7 - 0.5 * (1 - e)
      }
    }).catch(e => console.warn('[stages] record: map failed to load, the particle form stays', e))
    void update
    return inst
  },
} satisfies StageDef
