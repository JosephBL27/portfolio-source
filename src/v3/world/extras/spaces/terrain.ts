// The Yosemite Valley backdrop of the climbing-wall space: real elevation (AWS Terrain Tiles, Terrarium) and real orthophoto (USGS The National Map) of the valley as seen
// from the valley's west end (Tunnel View, moved 1.6 km up-valley so El Capitan and Half Dome stand clear of the wall), looking east-north-east up the valley, at dusk and at true vertical scale: ONE uniform scale for every axis (metres per world unit, no exaggeration).
// public/terrain/* is built by scripts/build-terrain.mjs. This module is loaded lazily by spaces/hold.ts when the space builds, so none of it is fetched before the flight
// is within three stops of the hold.
//   * geometry: a displaced grid built on the CPU from the decoded heights (createImageBitmap with no colour conversion), quads beyond the haze dropped
//   * shading, one fragment shader: orthophoto albedo (desaturated, dusk-dark) x a low west-south-west sun (alpenglow on the faces that look at it) x the baked sun-shadow,
//     plus sky ambient x the baked occlusion, a per-pixel normal from the height field, atmospheric perspective toward the SKY colour of the same ray (so the far ridges melt
//     into the sky and the mesh border can never show), a thin valley mist, canopy grain up close. It has its own fog: the spaces' depth fog never touches it.
//   * colour: this world is display-referred (post.ts has no transfer function). The photo is an sRGB texture (decoded to linear by the sampler), lit in linear light, and
//     written back through the sRGB curve, so the number on screen is the number the lighting says it should be.
// Space-local axes: x right, y up, -z away; the camera stands at the hold waypoint, the Tunnel View point is mapped onto it.
import * as THREE from 'three'
import { WAYPOINTS } from '../../layout'
import type { SpaceKit } from './common'

export interface Terrain {
  group: THREE.Group; mesh: THREE.Mesh
  /** per frame: the camera in space-local coordinates, the clock */
  update(t: number, camLocal: THREE.Vector3, reduced: boolean): void
  info: { ms: number; maxTaskMs: number; tris: number; verts: number; metresPerUnit: number; farthest: number; fetchMs: number; segs: [number, number]; t0: number; t1: number; landmarks: Record<string, [number, number, number]> }
  dispose(): void
}

interface Meta {
  bounds: { lon0: number; lon1: number; lat0: number; lat1: number }
  size_m: { east: number; north: number }
  grid: { height: [number, number]; color: [number, number]; shade: [number, number] }
  tunnelView: { lat: number; lon: number; elev_m: number }
  view: { lat: number; lon: number; bearingDeg: number }
  sun: { azimuthDeg: number; elevationDeg: number; dirENU: [number, number, number] }
  geography: Record<string, number>
}

/** metres per world unit. One scale for x, y and z. The farthest quad kept is under 110 units from the camera (camera.far is 120). */
export const METRES_PER_UNIT = 140
const FAR_KEEP = 108
const VALLEY_FLOOR_Y = -0.85                  // El Capitan Meadow (1207 m) sits this far below the wall's ground
const SUN_COL: [number, number, number] = [1.0, 0.50, 0.26]       // the brief's (1.0, 0.56, 0.32), a little deeper: alpenglow is red-orange on granite
const AMBIENT: [number, number, number] = [0.36, 0.43, 0.74]       // the brief's (0.10, 0.12, 0.20) is display-referred; this is the linear light that lands there on dark conifer
const tick = () => new Promise<void>(r => setTimeout(r, 0))

async function bitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
}

const VERT = /* glsl */ `
varying vec3 vP; varying vec2 vUv;
void main() { vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const FRAG = (sky: string) => /* glsl */ `
precision highp float;
varying vec3 vP; varying vec2 vUv;
uniform sampler2D tColor, tNormal, tShade, tNoise;
uniform vec3 uCam, uSunDir, uSunCol, uAmb;
uniform vec2 uAnti, uSizeM;
uniform float uPres, uTime, uUnit, uSunI, uFarFade, uMistY, uDebug, uScale, uHRef;
${sky}
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// value noise from ONE texture fetch (two z layers packed in R and G, the second shifted by (37, 17)): the hash-and-lerp version cost a third of the frame
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return texture2D(tNoise, (i + f + 0.5) / 256.0).r; }
float fbm3(vec2 p) { float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 3; i++) { s += a * vn(p); p = m * p; a *= 0.5; } return s; }
float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 rg = texture2D(tNoise, (i.xy + vec2(37.0, 17.0) * i.z + f.xy + 0.5) / 256.0).rg; return mix(rg.x, rg.y, f.z); }
vec3 toDisplay(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// granite relief the 19 m height field cannot carry: blocky ridged noise, sharper on steep ground, gone with distance (a 5 m crack is sub-pixel past a few km)
float rockH(vec3 p, float amp2) { float l = 1.0 - abs(2.0 * n3(p * 2.3 + 1.3) - 1.0), a = 1.0 - abs(2.0 * n3(p * 6.0) - 1.0), b = 1.0 - abs(2.0 * n3(p * 17.0 + 3.7) - 1.0), c = n3(p * 44.0 + 9.1); return l * 0.8 + a * 0.5 + b * 0.28 * amp2 + c * 0.14 * amp2; }
void main() {
  vec3 rdv = vP - uCam; float dist = length(rdv); vec3 rd = rdv / dist;
  vec3 N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
  vec2 sh = texture2D(tShade, vUv).rg;
  vec3 alb = texture2D(tColor, vUv).rgb;                                                // linear (sRGB texture)
  float slope = 1.0 - N.y;                                                               // 0 flat .. 1 vertical
  float hm = vP.y * uScale + uHRef;                                                      // metres above sea level
  float high = smoothstep(1750.0, 2150.0, hm);                                           // above the tree line's thick part the slopes are bare granite
  float cliff = max(smoothstep(0.24, 0.58, slope), high * smoothstep(0.05, 0.22, slope) * 0.85);
  // relief: a normal perturbation from a 3D rock field, on the steeper ground, fading with distance
  float dF = 1.0 - smoothstep(22.0, 80.0, dist);
  float amp2 = 1.0 - smoothstep(10.0, 40.0, dist);
  if (dF > 0.01) {
    float e = 0.014, r0 = rockH(vP, amp2);
    vec3 g = vec3(rockH(vP + vec3(e, 0.0, 0.0), amp2) - r0, rockH(vP + vec3(0.0, e, 0.0), amp2) - r0, rockH(vP + vec3(0.0, 0.0, e), amp2) - r0) / e;
    N = normalize(N - (0.03 + 0.07 * cliff) * dF * (g - dot(g, N) * N));
  }
  // albedo: the orthophoto is a view from above, so on a cliff it is stretched and shows only the tree line. Cliffs become granite (lit grey, the photo only
  // modulating it: ledges and trees stay dark), forest stays the photo; desaturated a quarter and darkened for dusk
  float lum = dot(alb, vec3(0.2126, 0.7152, 0.0722));
  vec3 forest = mix(vec3(lum), alb, 0.75) * 1.25;
  float up = n3(vec3(vP.x * 3.0 + vP.z * 3.0, vP.y * 0.5, 0.0)) ;                       // slow warm/cool drift
  vec3 granite = mix(vec3(0.30, 0.29, 0.285), vec3(0.34, 0.31, 0.275), up) * (0.55 + 1.1 * smoothstep(0.015, 0.22, lum));
  vec2 face = vec2(dot(vP.xz, vec2(N.z, -N.x)) * 70.0, vP.y * 9.0);                      // along the face x up it: vertical water streaks
  float streak = smoothstep(0.58, 0.82, fbm3(face) * 1.25) * cliff;
  granite *= 1.0 - 0.38 * streak;
  alb = mix(forest, granite, cliff);
  // canopy grain up close: the photo is 6 m a pixel, a tree is not
  float near = (1.0 - smoothstep(0.0, 34.0, dist)) * (1.0 - cliff);
  vec2 q = vP.xz * 12.0 / uUnit;
  float g2 = fbm3(q) * 0.65 + vn(q * 3.1) * 0.35;
  alb *= 1.0 + (g2 - 0.5) * 0.9 * near;
  float mid = (1.0 - smoothstep(30.0, 100.0, dist));                                     // stands of trees and bare patches: the photo alone is soft at this range
  alb *= 1.0 + (fbm3(vP.xz * 3.4 + 5.0) - 0.5) * 0.9 * mid * (1.0 - 0.7 * cliff);
  // light: the sun (low, behind and to the right), baked shadow, then the sky
  float ndl = max(dot(N, uSunDir), 0.0);
  float vis = sh.r;
  vec3 direct = uSunCol * uSunI * ndl * vis;
  float ao = sh.g * sh.g;
  // sky light: blue from above, and the bright sunset sky in the west lights every face that looks at it (the shadowed side of a ridge is rose, not black)
  vec2 sunH = normalize(uSunDir.xz);
  float westFace = max(dot(N.xz, sunH), 0.0) * (1.0 - 0.6 * N.y);
  vec3 amb = (uAmb * (0.55 + 0.45 * (N.y * 0.5 + 0.5)) + vec3(0.62, 0.34, 0.30) * 0.5 * westFace) * ao;
  vec3 col = alb * (direct + amb);
  if (uDebug > 0.5) { gl_FragColor = vec4(uDebug < 1.5 ? vec3(1.0, 0.0, 1.0) : uDebug < 2.5 ? vec3(ndl) : uDebug < 3.5 ? vec3(vis) : uDebug < 4.5 ? vec3(ao) : N * 0.5 + 0.5, 1.0); return; }
  col = toDisplay(col);
  // thin valley mist, lying low and drifting
  float mistN = fbm3(vP.xz * 0.045 + vec2(uTime * 0.012, -uTime * 0.007));
  float mist = (1.0 - smoothstep(uMistY, uMistY + 1.7, vP.y)) * (0.30 + 0.55 * mistN);
  vec3 skyH = skyCol(normalize(vec3(rd.x, max(rd.y, 0.012), rd.z)), uAnti);
  col = mix(col, skyH * 1.15 + vec3(0.02, 0.02, 0.035), mist * (0.25 + 0.75 * smoothstep(6.0, 40.0, dist)));
  // atmospheric perspective toward the sky colour of the same ray; low ground sits in thicker air
  float k = pow(dist / 150.0, 1.35) * (1.12 - 0.34 * smoothstep(-1.2, 7.0, vP.y));
  float fogF = 1.0 - exp(-k);
  vec3 hz = skyH;
  // warm forward scatter near the horizon: lit haze takes the sun's colour
  hz += vec3(1.0, 0.52, 0.28) * 0.13 * fogF * (1.0 - fogF) * (0.35 + 0.65 * vis) * (1.0 - smoothstep(0.0, 0.5, rd.y));
  // no hard mesh edge: the border and everything past the far fade is pure sky
  vec2 e = min(vUv, 1.0 - vUv) * uSizeM;
  float edge = min(e.x, e.y);
  float border = 1.0 - smoothstep(0.0, 2200.0, edge);
  float farF = smoothstep(uFarFade - 26.0, uFarFade, dist);
  float f = max(max(fogF, border), farF);
  col = mix(col, hz, clamp(f, 0.0, 1.0));
  // dither: the shade maps are 6-bit
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col * uPres, 1.0);
}`

export async function loadTerrain(k: SpaceKit, o: { skyGlsl: string; sunCol?: [number, number, number]; metresPerUnit?: number }): Promise<Terrain> {
  const T0 = performance.now()
  let maxTask = 0, mark = performance.now()
  const lap = () => { const n = performance.now(); maxTask = Math.max(maxTask, n - mark); mark = n }
  const yieldNow = async () => { lap(); await tick(); mark = performance.now() }

  const base = `${import.meta.env.BASE_URL}terrain/`
  const maxTex = k.renderer.capabilities.maxTextureSize
  const meta = (await (await fetch(`${base}yosemite.json`)).json()) as Meta
  if (maxTex < Math.max(meta.grid.color[0], meta.grid.height[0])) throw new Error(`max texture size ${maxTex} is below the terrain's ${meta.grid.color[0]}`)
  const [bmH, bmC, bmS] = await Promise.all([bitmap(`${base}yosemite-height.png`), bitmap(`${base}yosemite-color.jpg`), bitmap(`${base}yosemite-shade.png`)])
  const fetchMs = performance.now() - T0
  mark = performance.now()

  // ---- decode the elevation (terrarium: R*256 + G + B/256 - 32768)
  const [W, H] = meta.grid.height
  if (bmH.width !== W || bmH.height !== H) throw new Error('terrain height size mismatch')
  const cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d', { willReadFrequently: true })!
  cx.drawImage(bmH, 0, 0)
  const px = cx.getImageData(0, 0, W, H).data
  const elev = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) elev[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768
  bmH.close()
  await yieldNow()

  // ---- geography -> space-local metres. The viewpoint lands on the hold waypoint's camera; the view bearing becomes -z; one uniform scale.
  const S = o.metresPerUnit ?? METRES_PER_UNIT
  const { bounds: B } = meta
  const latMid = (B.lat0 + B.lat1) / 2, rl = Math.PI / 180
  const mLat = 111132.954 - 559.822 * Math.cos(2 * latMid * rl) + 1.175 * Math.cos(4 * latMid * rl)
  const mLon = 111412.84 * Math.cos(latMid * rl) - 93.5 * Math.cos(3 * latMid * rl) + 0.118 * Math.cos(5 * latMid * rl)
  const wp = WAYPOINTS.find(w => w.id === k.def.id)!
  const dxw = wp.cam.pos[0] - k.def.at[0], dzw = wp.cam.pos[2] - k.def.at[2], cyaw = Math.cos(k.def.yaw), syaw = Math.sin(k.def.yaw)
  const eye = new THREE.Vector3(dxw * cyaw - dzw * syaw, wp.cam.pos[1] - k.def.at[1], dxw * syaw + dzw * cyaw)    // R(-yaw) * (cam - at)
  const beta = meta.view.bearingDeg * rl, cb = Math.cos(beta), sb = Math.sin(beta)
  const tvE = (meta.view.lon - B.lon0) * mLon, tvN = (meta.view.lat - B.lat0) * mLat                      // the viewpoint, east / north metres from the box's south-west corner
  const hRef = 1207 + -VALLEY_FLOOR_Y * S                                                                  // metres that map to y = 0 (the wall's ground)
  const toLocal = (E: number, N: number, h: number, out: THREE.Vector3) => {
    const e = E - tvE, n = N - tvN
    return out.set((e * cb - n * sb) / S + eye.x, (h - hRef) / S, eye.z - (e * sb + n * cb) / S)
  }

  // ---- mesh: ONE vertex per height sample (25 m on the ground: Half Dome's face is 600 m of rock over a hundred, a coarser grid turns it into a spike), only the quads inside the
  // haze AND inside the wedge the camera can swing across (a phone takes every second sample). The geometry is built from the height field itself, not resampled.
  const stride = k.phone ? 2 : 1
  const NX = Math.floor((W - 1) / stride), NY = Math.floor((H - 1) / stride)
  const vx = NX + 1, vy = NY + 1
  const pos = new Float32Array(vx * vy * 3), uv = new Float32Array(vx * vy * 2), dist = new Float32Array(vx * vy), inWedge = new Uint8Array(vx * vy)
  const dxm0 = meta.size_m.east / W, dym0 = meta.size_m.north / H
  const invS = 1 / S, ex = eye.x, ey = eye.y, ez = eye.z
  const WEDGE = Math.cos((78 * Math.PI) / 180)                                             // |bearing off the view axis| < 78 degrees (the space's camera never turns further)
  const ap0 = 5.0, ap1 = 8.5
  for (let j = 0; j < vy; j++) {
    const py = Math.min(H - 1, j * stride), v = (py + 0.5) / H, nN = (H - py - 0.5) * dym0 - tvN
    for (let i = 0; i < vx; i++) {
      const pxi = Math.min(W - 1, i * stride), id = j * vx + i
      const e = (pxi + 0.5) * dxm0 - tvE
      let x = (e * cb - nN * sb) * invS + ex, y = (elev[py * W + pxi] - hRef) * invS, z = ez - (e * sb + nN * cb) * invS
      // the stage's apron: within 5 units of the wall the ground is the space's own floor (y = 0), so the valley is pressed 0.4 below it (no coplanar surfaces, no hill through the pad)
      const rr = Math.hypot(x, z)
      if (rr < ap1) { const aw = Math.min(1, Math.max(0, (rr - ap0) / (ap1 - ap0))), sw = aw * aw * (3 - 2 * aw); y = Math.min(y, -0.4) * (1 - sw) + y * sw }
      pos[id * 3] = x; pos[id * 3 + 1] = y; pos[id * 3 + 2] = z; uv[id * 2] = (pxi + 0.5) / W; uv[id * 2 + 1] = v
      const dd = Math.hypot(x - ex, y - ey, z - ez); dist[id] = dd
      inWedge[id] = (ez - z) > dd * WEDGE || dd < 22 ? 1 : 0
    }
    if (j % 48 === 47) await yieldNow()
  }
  const idx = new Uint32Array(NX * NY * 6)
  let ni = 0, farthest = 0
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1
      if (!(inWedge[a] | inWedge[b] | inWedge[c] | inWedge[d])) continue
      const mn = Math.min(dist[a], dist[b], dist[c], dist[d])
      if (mn > FAR_KEEP) continue                                                        // wholly beyond the haze: nothing of it can be seen
      idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = b; idx[ni++] = c; idx[ni++] = d
      const mx = Math.max(dist[a], dist[b], dist[c], dist[d]); if (mx > farthest) farthest = mx
    }
    if (j % 96 === 95) await yieldNow()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, ni), 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(eye.x, 0, eye.z - 60), 190)             // generous: the mesh is never culled while the space shows
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-200, -20, -200), new THREE.Vector3(200, 40, 100))
  const landmarks: Record<string, [number, number, number]> = {}
  for (const [name, lat, lon] of [['Half Dome', 37.7459, -119.5332], ['El Capitan', 37.734, -119.6377], ['Sentinel Dome', 37.7228, -119.5855], ['Cathedral Rocks', 37.7128, -119.6255]] as const) {
    const px0 = Math.round(((lon - B.lon0) / (B.lon1 - B.lon0)) * W - 0.5), py0 = Math.round(((B.lat1 - lat) / (B.lat1 - B.lat0)) * H - 0.5)
    let hh = -1e9; for (let yy = py0 - 6; yy <= py0 + 6; yy++) for (let xx = px0 - 6; xx <= px0 + 6; xx++) hh = Math.max(hh, elev[yy * W + xx])
    const q = toLocal((lon - B.lon0) * mLon, (lat - B.lat0) * mLat, hh, new THREE.Vector3()); landmarks[name] = [q.x, q.y, q.z]
  }
  await yieldNow()

  // ---- normals from the height field, ONCE, in space-local axes (the shader never rebuilds them). 
  const dxm = meta.size_m.east / W, dym = meta.size_m.north / H
  const sm = elev                                                                                            // whole metres over 19 m: a 0.7 degree error on the flats, nothing worth blurring away on the cliffs
  const nrm = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    if (y % 100 === 99) await yieldNow()
    for (let x = 0; x < W; x++) {
      const xl = Math.max(0, x - 1), xr = Math.min(W - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(H - 1, y + 1)
      const hE = (sm[y * W + xr] - sm[y * W + xl]) / ((xr - xl) * dxm), hN = -(sm[yd * W + x] - sm[yu * W + x]) / ((yd - yu) * dym)
      const nE = -hE, nN = -hN, il = 1 / Math.hypot(nE, 1, nN)
      const lx = (nE * cb - nN * sb) * il, ly = il, lz = -(nE * sb + nN * cb) * il
      const k4 = (y * W + x) * 4
      nrm[k4] = Math.round((lx * 0.5 + 0.5) * 255); nrm[k4 + 1] = Math.round((ly * 0.5 + 0.5) * 255); nrm[k4 + 2] = Math.round((lz * 0.5 + 0.5) * 255); nrm[k4 + 3] = 255
    }
  }

  // ---- textures: photo is sRGB, mipmapped, anisotropic; the normal and shade maps are data
  const aniso = Math.min(8, k.renderer.capabilities.getMaxAnisotropy())
  const setup = (t: THREE.Texture, srgb: boolean) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = aniso; t.needsUpdate = true
    return t
  }
  const tColor = setup(new THREE.Texture(bmC), true), tShade = setup(new THREE.Texture(bmS), false)
  const tNormal = setup(new THREE.DataTexture(nrm, W, H, THREE.RGBAFormat), false)
  const tNoise = (() => {                                                   // 256 x 256 value noise, R and G = the same field shifted by (37, 17): a 3D lookup in one fetch
    const n = 256, r = new Uint8Array(n * n); let a = 0x9e3779b9
    for (let i = 0; i < r.length; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; r[i] = a >>> 24 }
    const d = new Uint8Array(n * n * 4)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = (y * n + x) * 4; d[k] = r[y * n + x]; d[k + 1] = r[((y + 17) & 255) * n + ((x + 37) & 255)]; d[k + 3] = 255 }
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true
    return t
  })()
  // upload now, one per frame: the first render must not pay for 14 MB of texture
  for (const t of [tColor, tNormal, tShade, tNoise]) { k.renderer.initTexture(t); await yieldNow() }

  // ---- material
  const sunLocal = (() => {                                                // dirENU -> space-local
    const [e, n, u] = meta.sun.dirENU
    return new THREE.Vector3(e * cb - n * sb, u, -(e * sb + n * cb)).normalize()
  })()
  const anti = new THREE.Vector2(-sunLocal.x, -sunLocal.z).normalize()
  const uniforms = {
    tColor: { value: tColor }, tNormal: { value: tNormal }, tShade: { value: tShade }, tNoise: { value: tNoise },
    uCam: { value: eye.clone() }, uSunDir: { value: sunLocal }, uSunCol: { value: new THREE.Vector3(...(o.sunCol ?? SUN_COL)) }, uAmb: { value: new THREE.Vector3(...AMBIENT) },
    uAnti: { value: anti }, uSizeM: { value: new THREE.Vector2(meta.size_m.east, meta.size_m.north) },
    uPres: k.fog.pres, uTime: k.fog.time, uUnit: { value: S / 140 }, uSunI: { value: 3.2 }, uFarFade: { value: FAR_KEEP - 4 }, uMistY: { value: VALLEY_FLOOR_Y + 0.5 }, uDebug: { value: 0 }, uScale: { value: S }, uHRef: { value: hRef },
  }
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG(o.skyGlsl), depthWrite: true, depthTest: true, side: THREE.FrontSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'terrain'; mesh.frustumCulled = false; mesh.renderOrder = -8
  mesh.userData.noReflect = true
  const group = new THREE.Group(); group.name = 'terrain-group'; group.add(mesh)
  lap()

  return {
    group, mesh,
    update(_t, camLocal, _reduced) { uniforms.uCam.value.copy(camLocal) },
    info: { ms: performance.now() - T0, maxTaskMs: maxTask, tris: ni / 3, verts: vx * vy, metresPerUnit: S, farthest, fetchMs, segs: [NX, NY], t0: T0, t1: performance.now(), landmarks },
    dispose() { geo.dispose(); mat.dispose(); tColor.dispose(); tNormal.dispose(); tShade.dispose(); tNoise.dispose() },
  }
}
