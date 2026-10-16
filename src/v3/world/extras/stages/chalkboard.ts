// STAGE mathecon (waypoint 'mathecon', Education: Economics + Applied Math): THE CHALKBOARD. A classroom slate in a worn oak frame, lit by a raking key
// from the upper left, with Joseph's coursework (from his resume) written on it in chalk as the stop arrives. It replaces the r5 board.
//   model     scripts/blender/chalkboard.py -> public/models/glb/chalkboard.glb (Draco + WebP, Cycles-baked AO in COLOR_0, M5 preset): the slate, oak rails
//             (Poly Haven Oak Veneer 01), a chalk ledge with white, pink and blue chalk and a felt eraser, on a dark wall that falls to black. The model is
//             stretchable: a phone gets a taller, narrower board (same parts, vertices moved, see chalkboard.py)
//   light     the PMREM of Poly Haven "Studio Small 09" (stages/studio.ts) on every material, plus a raking key light computed in the shaders (no light is
//             added to the scene, so no other material recompiles): it grazes the slate from the upper left, so the tooth of the slate shows
//   slate     chalkboard/slate.ts: dark green-black, grain, mottle, the cloudy residue of old erasures (Poly Haven wipe streaks), ghosts of old writing
//   chalk     chalkboard/hand.ts lays src/data/coursework.json out in single-stroke handwriting (EMS Tech) with a pressure profile per stroke;
//             chalkboard/chalk.ts draws it as chalk (grain, skips, a dusty edge, the slate's tooth). An anime.js timeline (one tween per line, seeked by the
//             stage's own clock once the board has arrived) drives how far each stroke is down: about thirteen seconds for the whole board, heading first.
//             Dust shakes loose at the tip and settles on the ledge (chalkboard/dust.ts); a faint tap per word when the site's sound is on ('chalk:tap')
//   interact  drag the board to tilt it (an anime.js spring brings it back), or click the felt eraser: it leaves the ledge, wipes the board in bands
//             (most of the chalk comes off, a haze stays) and the courses are written again. Keyboard: a hidden button does the same.
//   honesty   the titles are exactly those under Relevant Coursework on Joseph's resume (coursework.confirmed true): no codes, grades, GPA, credits or
//             instructors. A screen-reader copy of the list is in the DOM.
//   reduced   the board arrives fully written, no dust, nothing moves on its own; tilt and the eraser (which wipes and writes again at once) still work.
//             Pause (the site's switch) holds the write-on and the dust where they are
//   fallback  until the GLB and the HDRI arrive (or if either fails) nothing shows and the particle form keeps the frame (dust 1)
// window.__chalkboard = { info(), eraser(), erase(), seek(t) } for the probes.
import * as THREE from 'three'
import { animate, createTimeline, spring, type JSAnimation, type Timeline } from 'animejs'
import { loadGLB, meshesByName, withAO } from '../../glbmodel'
import coursework from '../../../../data/coursework.json'
import handFont from '../../../../data/handwriting-tech.json'
import { state as appState } from '../../../../state'
import { clamp01, easeInCubic, easeOutCubic, lit, srAction, stageTip, tryMark, type StageBuildCtx, type StageDef, type StageFrame, type StagePointer } from './common'
import { studioEnv } from './studio'
import { WAYPOINTS } from '../../layout'
import { CHALK, TALL, WIDE, layoutBoard, pointAt, strokeAt, type CourseData, type HandFont, type Layout } from './chalkboard/hand'
import { ChalkLayer } from './chalkboard/chalk'
import { grainNormal, loadWipes, paintSlate } from './chalkboard/slate'
import { Dust } from './chalkboard/dust'

// ---- the same numbers as scripts/blender/chalkboard.py (the model is authored at the wide size) ----
const PW0 = 3.2, PH0 = 2.0, FW = 0.085, LIP = 0.014, WALL_Z = -0.066, LEDGE_D = 0.13
const LEDGE_TOP0 = -PH0 / 2 - FW - 0.005
const YAW0 = -0.1                          // a little off square, so the frame's depth reads
const TAU = Math.PI * 2
/** the stage frame scales a stage so that `size` fills 60% of the window width, but only ever by place.scale x k (k <= 1), so a stage authors its object at world
 *  size: this board is built about 3.4 units wide and shown S times larger inside its group, and declares `size` as that world footprint times place.scale */
const S = 3.2
/** phone: the band between the title and the copy is taller than the frame's 38% rule allows a stage; the board takes 57% and sits a little lower */
const PHONE_H = 0.57, PHONE_DROP = 0.091

export function buildStage(c: StageBuildCtx) {
  const root = new THREE.Group()
  const face = new THREE.Group(), turn = new THREE.Group()
  root.add(face); face.add(turn)
  face.rotation.y = Math.atan2(c.view.dir.x, c.view.dir.z)
  face.scale.setScalar(S)
  const ps = WAYPOINTS[c.wp]?.place.scale ?? 1
  turn.rotation.y = YAW0
  turn.visible = false
  const html = document.documentElement
  const rm = () => html.classList.contains('rm')
  const st = { yaw: 0, pitch: 0 }
  /** a touch screen taps, a mouse clicks */
  const coarse = matchMedia('(pointer: coarse)').matches
  const click = coarse ? 'tap' : 'click', Click = coarse ? 'Tap' : 'Click'
  const tall = c.phone && innerWidth / Math.max(1, innerHeight) < 0.85
  const { W, H } = tall ? TALL : WIDE
  const dx = (W - PW0) / 2, dy = (H - PH0) / 2
  /** the stretch map of chalkboard.py: inside the writing area scales, outside shifts */
  const mapX = (x: number) => x + dx * Math.max(-1, Math.min(1, x / (PW0 / 2)))
  const mapY = (y: number) => y + dy * Math.max(-1, Math.min(1, y / (PH0 / 2)))
  const OW = W + 2 * FW + 0.06, top = H / 2 + FW, bottom = -H / 2 - FW - 0.17
  const LIFT = -(top + bottom) / 2               // centre the footprint (board + ledge) on the root
  const footH = top - bottom

  let ready = false
  const inst = {
    root,
    dust: 1,
    size: [(OW + 0.12) * S * ps, (footH + 0.1) * S * ps * (tall ? 0.38 / PHONE_H : 1)] as [number, number],
    update,
    pointer: undefined as StagePointer | undefined,
    hint: ['Drag to tilt the board', `${click} the eraser to wipe and rewrite`] as [string, string],
  }

  // -------------------------------------------------------------------------------------------- the screen-reader copy of the list (the canvas is invisible to them)
  const cw = coursework as unknown as CourseData
  const sr = document.createElement('section')
  sr.className = 'cb-sr'; sr.setAttribute('aria-label', 'Coursework written on the chalkboard')
  {
    const h = document.createElement('h3'); h.textContent = cw.title
    const pr = document.createElement('p'); pr.textContent = `${cw.program.school}, ${cw.program.degrees.join('; ')}`
    const ul = document.createElement('ul')
    for (const g of cw.groups) { const li = document.createElement('li'); li.textContent = `${g.heading}: ${g.courses.join(', ')}`; ul.append(li) }
    sr.append(h, pr, ul)
    const style = document.createElement('style')
    style.textContent = '.cb-sr{position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:0;padding:0;border:0;pointer-events:none}'
    document.head.append(style)
    document.body.append(sr)
  }

  // -------------------------------------------------------------------------------------------- the hand: layout, the chalk layer, the slate, the timeline
  const font = handFont as unknown as HandFont
  const layout: Layout = layoutBoard(cw, font, tall)
  const CW = tall ? 1024 : 1536, CH = Math.round(CW * H / W), K = CW / W
  const chalk = new ChalkLayer(CW, CH, K)
  const albedoCanvas = document.createElement('canvas'); albedoCanvas.width = CW; albedoCanvas.height = CH
  const g = albedoCanvas.getContext('2d', { alpha: false })!
  let slateAlbedo: HTMLCanvasElement | null = null
  const prev = layout.lines.map(l => new Float32Array(l.strokes.length))
  const pen = layout.lines.map(() => ({ p: 0 }))
  let committed = 0, dirty = false
  const tl: Timeline = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })
  layout.lines.forEach((ln, i) => tl.add(pen[i], { p: [0, 1], duration: Math.max(1, Math.round(ln.dur * 1000)) }, Math.round(ln.t0 * 1000)))
  const totalMs = Math.ceil(layout.total * 1000)

  let tip: [number, number] | null = null, tipChalk: [number, number, number] = CHALK.white, lastTap = -1, tapsOn = false
  let emitT = 0
  /** strokes that landed since the last frame (board position of the first point, canvas units from the top-left): each throws off a puff of dust */
  const starts: { x: number; y: number; c: [number, number, number] }[] = []
  /** lay down whatever the hand has done since the last call (forward in time: the new part of each stroke) */
  const paintUntil = (live: boolean) => {
    tip = null
    for (let li = committed; li < layout.lines.length; li++) {
      const p = pen[li].p
      if (p <= 0) break
      const ln = layout.lines[li], t = ln.t0 + p * ln.dur
      let done = true
      for (let si = 0; si < ln.strokes.length; si++) {
        const s = ln.strokes[si], f = strokeAt(s, t), pf = prev[li][si]
        if (f > pf) {
          const at = chalk.span(s, pf, f)
          if (at) { tip = at; tipChalk = CHALK[s.chalk] }
          if (live && pf <= 0 && starts.length < 4 && (si === 0 || (s.seed & 1) === 0)) starts.push({ x: s.pts[0], y: s.pts[1], c: CHALK[s.chalk] })
          if (live && pf <= 0 && tapsOn && (si === 0 || (s.seed % 5) === 0) && emitT - lastTap > 0.11) { lastTap = emitT; c.emit('chalk:tap', { velocity: 0.4 + s.press * 0.4 }) }
          prev[li][si] = f; dirty = true
        }
        if (f < 1) done = false
      }
      if (done && p >= 1) committed = li + 1
    }
  }
  const resetProgress = () => { for (const a of prev) a.fill(0); committed = 0 }
  const clearInk = () => { chalk.clear(); resetProgress(); dirty = true }
  let wt = 0, written = false
  /** the board as it should look at clock `t` seconds (a jump: everything before is drawn at once) */
  const seekInk = (t: number) => { clearInk(); tl.seek(Math.max(0, Math.min(totalMs, t * 1000))); paintUntil(false) }
  const compose = () => { if (!slateAlbedo) return; g.drawImage(slateAlbedo, 0, 0); g.drawImage(chalk.canvas, 0, 0) }

  // -------------------------------------------------------------------------------------------- the raking key (in the shaders: no scene light)
  const key = {
    uKeyDir: { value: new THREE.Vector3(0, 0, 1) }, uKeyCol: { value: new THREE.Color(1.0, 0.95, 0.86).multiplyScalar(1.25) },
    uKeyPos: { value: new THREE.Vector3() }, uKeyRad: { value: 1 },
  }
  const KEY_L = new THREE.Vector3(-0.72, 0.52, 0.42).normalize()   // board frame: from the upper left, grazing
  // -------------------------------------------------------------------------------------------- age: wear and grime on the oak, a pool of light on the wall
  const aged = { uBotY: { value: -H / 2 }, uHalf: { value: new THREE.Vector2(W / 2, H / 2) }, uDust: { value: 0.25 }, uBoard: { value: new THREE.Vector4(W / 2 + FW, H / 2 + FW, -H / 2 - FW - 0.17, 0.5) } }
  const NOISE = `
    varying vec3 vOP;
    float cbH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float cbN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(cbH(i), cbH(i + vec3(1,0,0)), f.x), mix(cbH(i + vec3(0,1,0)), cbH(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(cbH(i + vec3(0,0,1)), cbH(i + vec3(1,0,1)), f.x), mix(cbH(i + vec3(0,1,1)), cbH(i + vec3(1,1,1)), f.x), f.y), f.z); }`
  type Sh = { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }
  /** the model-space position, for noise that sticks to the wood */
  const objPos = (sh: Sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;')
  }
  /** the frame's age: dulled colour, dirt in patches, bare wood scuffed through the finish along the bevelled edges (the distance to the nearest edge comes from the
   *  rail's known box, so it is crisp whatever the mesh density), and chalk dust ground into the bottom rail and the ledge */
  const FD0 = 0.06, LEDGE_T0 = 0.03
  const wornOak = (sh: Sh) => {
    objPos(sh)
    Object.assign(sh.uniforms, { uBotY: aged.uBotY, uHalf: aged.uHalf, uDust: aged.uDust })
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBotY; uniform vec2 uHalf; uniform float uDust;' + NOISE)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 wd = mix(vec3(lum), diffuseColor.rgb, 0.42);
        float ay = abs(vOP.y), ax = abs(vOP.x), edge;
        if (vOP.y < uBotY - ${FW.toFixed(3)} - 0.004) {
          // the ledge: depth along z, thickness along y
          edge = max(min(vOP.z - ${WALL_Z.toFixed(4)}, ${(WALL_Z + LEDGE_D).toFixed(4)} - vOP.z), min(${mapY(LEDGE_TOP0).toFixed(4)} - vOP.y, vOP.y - ${(mapY(LEDGE_TOP0) - LEDGE_T0).toFixed(4)}));
        } else {
          // a rail or a stile: across its width (u) and through its depth (z); on a face one of the two is zero, on a bevel both are small
          float u = ay > uHalf.y - 0.002 ? ay - uHalf.y : ax - uHalf.x;
          edge = max(min(u, ${FW.toFixed(3)} - u), min(-vOP.z, vOP.z + ${FD0.toFixed(3)}));
        }
        float edgeW = 1.0 - smoothstep(0.004, 0.021, max(edge, 0.0));
        float big = cbN(vOP * 3.1), mid = cbN(vOP * 11.0), fine = cbN(vOP * 46.0);
        wd *= 1.0 - 0.55 * (smoothstep(0.28, 0.85, big) * 0.6 + smoothstep(0.45, 0.9, mid) * 0.3);
        // long fine scratches along the grain: bare wood in thin pale lines (the grain runs along x in a rail, along y in a stile)
        vec3 sq = ay > uHalf.y - 0.002 ? vec3(1.6, 85.0, 85.0) : vec3(85.0, 1.6, 85.0);
        float scr = smoothstep(0.8, 0.93, cbN(vOP * sq));
        wd = mix(wd, vec3(lum) * vec3(1.5, 1.28, 1.02), scr * 0.55);
        float scuff = edgeW * smoothstep(0.3, 0.68, mid * 0.55 + fine * 0.55);
        wd = mix(wd, vec3(lum) * vec3(1.55, 1.3, 1.02) * 0.9, scuff * 0.9);
        float low = smoothstep(uBotY + 0.1, uBotY - 0.12, vOP.y) * (0.3 + 0.7 * smoothstep(0.36, 0.78, cbN(vOP * vec3(4.0, 15.0, 5.0))));
        wd = mix(wd, vec3(0.62, 0.6, 0.56), low * 0.62);
        // the corners and the joints are where a board is gripped and carried: grime, in a dark brown patch that fades along the rail
        vec2 oc = vec2(max(uHalf.x + ${FW.toFixed(3)} - ax, 0.0), max(uHalf.y + ${FW.toFixed(3)} - ay, 0.0));
        float grime = (1.0 - smoothstep(0.0, 0.3, length(oc))) * (0.45 + 0.55 * cbN(vOP * vec3(8.0, 8.0, 3.0)));
        wd *= 1.0 - 0.42 * grime * step(uBotY - ${FW.toFixed(3)} - 0.004, vOP.y);
        if (vOP.y < uBotY - ${FW.toFixed(3)} - 0.004) {
          // the shelf takes the most handling: darker than the rails, and along the front half of its top a faint line of chalk dust (it gathers as the board is written)
          wd *= 0.8;
          float onTop = step(${(mapY(LEDGE_TOP0) - 0.0025).toFixed(4)}, vOP.y);
          float dz = vOP.z - ${(WALL_Z + LEDGE_D * 0.7).toFixed(4)};
          float dustLn = exp(-dz * dz / ${(2 * 0.018 * 0.018).toFixed(6)}) * smoothstep(0.32, 0.78, cbN(vOP * vec3(16.0, 70.0, 16.0)) * 0.7 + cbN(vOP * 90.0) * 0.4);
          wd = mix(wd, vec3(0.84, 0.8, 0.7), onTop * dustLn * uDust * 0.55);
        }
        diffuseColor.rgb = wd;
      }`)
  }
  /** the wall is only a faint wash around the board (luma under 0.05 at the frame's edge): its light pool falls to the page's black within a sixth of a board's width of the frame */
  const wallPool = (sh: Sh) => {
    objPos(sh)
    Object.assign(sh.uniforms, { uBoard: aged.uBoard })
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uBoard;' + NOISE)
      .replace('#include <opaque_fragment>', `{
        float wx = max(abs(vOP.x) - uBoard.x, 0.0), wy = max(max(vOP.y - uBoard.y, uBoard.z - vOP.y), 0.0);
        float pool = 1.0 - smoothstep(0.0, uBoard.w, length(vec2(wx, wy)));
        outgoingLight *= 0.3 * pow(pool, 2.0) * (0.8 + 0.4 * cbN(vOP * 5.0));
      }
      #include <opaque_fragment>`)
  }
  /** withAO reads the baked occlusion from the interpolated vertex colour. At a silhouette edge the rasteriser extrapolates it past 0..1, and a negative light value
   *  is NaN in the sRGB transfer (pow of a negative): a black pixel, which showed as dark specks along the ledge and the frame's edges. Clamp the occlusion and the
   *  light, once, in every material of this board */
  const safe = <T extends THREE.Material>(m: T): T => {
    const obc = m.onBeforeCompile, key = m.customProgramCacheKey
    m.onBeforeCompile = function (sh, r) {
      obc.call(this, sh, r)
      sh.fragmentShader = sh.fragmentShader.replace('float gAO = vColor.r;', 'float gAO = clamp(vColor.r, 0.0, 1.0);').replace('#include <opaque_fragment>', 'outgoingLight = max(outgoingLight, vec3(0.0));\n#include <opaque_fragment>')
    }
    m.customProgramCacheKey = () => key.call(m) + '|safe'
    m.needsUpdate = true
    return m
  }
  const withKey = (strength: number) => (shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => {
    Object.assign(shader.uniforms, key)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uKeyPos; uniform float uKeyRad;')
      .replace('#include <aomap_fragment>', `{
        float kd = length(geometryPosition - uKeyPos) / uKeyRad;
        IncidentLight keyL; keyL.direction = uKeyDir; keyL.visible = true;
        keyL.color = uKeyCol * ${strength.toFixed(3)} * (0.3 + 0.7 * (1.0 - smoothstep(0.15, 1.0, kd)));
        RE_Direct( keyL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
      }
      #include <aomap_fragment>`)
  }

  // -------------------------------------------------------------------------------------------- build (async: GLB + HDR + the wipe photograph)
  let slateMat: THREE.MeshPhysicalMaterial | null = null
  let albedoTex: THREE.CanvasTexture | null = null
  const owned: { dispose(): void }[] = []
  const hit: THREE.Object3D[] = []              // what a drag on the board may grab: the slate, the frame, the ledge
  const eraser = new THREE.Group(), eraserTilt = new THREE.Group()
  const E0 = new THREE.Vector3()                // the eraser's rest centre, in the model's frame
  let gltfRoot: THREE.Object3D | null = null
  let dust: Dust | null = null
  // probe state (window.__chalkboard): the named meshes, the build's main-thread cost, the vertices of the shelf's lip that were lowered
  const dbg = { by: null as Map<string, THREE.Mesh> | null, slateMs: 0, buildMs: 0, lipN: 0 }

  void (async () => {
    const [gltf, env, wipes] = await Promise.all([loadGLB('chalkboard'), studioEnv(c.renderer), loadWipes()])
    if (!gltf || !env) return
    const tBuild = performance.now()
    const by = meshesByName(gltf)
    dbg.by = by
    // re-proportion the board (phone): every vertex through the stretch map; the chalk and the eraser move whole
    if (dx !== 0 || dy !== 0) {
      const _c = new THREE.Vector3()
      for (const [name, me] of by) {
        const pos = me.geometry.attributes.position as THREE.BufferAttribute, o = me.position
        if (/^(chalk_|eraser_)/.test(name)) {
          me.geometry.computeBoundingBox(); me.geometry.boundingBox!.getCenter(_c).add(o)
          const tx = mapX(_c.x) - _c.x, ty = mapY(_c.y) - _c.y
          me.geometry.translate(tx, ty, 0)
        } else {
          for (let i = 0; i < pos.count; i++) pos.setXY(i, mapX(pos.getX(i) + o.x) - o.x, mapY(pos.getY(i) + o.y) - o.y)
          pos.needsUpdate = true
        }
        me.geometry.computeBoundingBox(); me.geometry.computeBoundingSphere()
      }
    }
    // the shelf's front lip stands 18 mm, which hides most of a 21 mm stick: lower it to a third so the chalk reads as sticks and not slivers
    {
      const lm = by.get('ledge')
      if (lm) {
        const pos = lm.geometry.attributes.position as THREE.BufferAttribute, o = lm.position, top = mapY(LEDGE_TOP0), z0 = WALL_Z + LEDGE_D - 0.02
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i) + o.y
          if (y > top + 0.0008 && pos.getZ(i) + o.z > z0) { pos.setY(i, top + (y - top) * 0.36 - o.y); dbg.lipN++ }
        }
        pos.needsUpdate = true; lm.geometry.computeBoundingBox(); lm.geometry.computeBoundingSphere()
      }
    }
    const own = <T extends THREE.Material>(m: T, k = 1) => { (m as unknown as THREE.MeshStandardMaterial).envMap = env; (m as unknown as THREE.MeshStandardMaterial).envMapIntensity = k; m.userData.ownEnv = true; return m }
    const src = (n: string) => by.get(n)?.material as THREE.MeshStandardMaterial | undefined
    const set = (n: string, m: THREE.Material) => { const me = by.get(n); if (me) { (me.material as THREE.Material).dispose(); me.material = m } }
    const col = (n: string) => src(n)?.color.clone() ?? new THREE.Color(0.5, 0.5, 0.5)

    // the slate: the live colour canvas (slate + chalk), the roughness canvas, the grain normal
    const base = await paintSlate(CW, CH, W, font, wipes)
    dbg.slateMs = base.maxChunkMs
    slateAlbedo = base.albedo
    const maxA = Math.min(8, c.renderer.capabilities.getMaxAnisotropy())
    albedoTex = new THREE.CanvasTexture(albedoCanvas)
    albedoTex.colorSpace = THREE.SRGBColorSpace; albedoTex.flipY = false; albedoTex.anisotropy = maxA
    albedoTex.generateMipmaps = true; albedoTex.minFilter = THREE.LinearMipmapLinearFilter
    // the roughness needs no more than half the colour's resolution (a quarter of the GPU memory)
    const rh = document.createElement('canvas'); rh.width = CW >> 1; rh.height = CH >> 1
    rh.getContext('2d')!.drawImage(base.rough, 0, 0, rh.width, rh.height)
    const roughTex = new THREE.CanvasTexture(rh)
    roughTex.colorSpace = THREE.NoColorSpace; roughTex.flipY = false; roughTex.anisotropy = maxA
    const nrm = new THREE.CanvasTexture(grainNormal())
    nrm.colorSpace = THREE.NoColorSpace; nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(W * 2.6, H * 2.6); nrm.anisotropy = maxA
    owned.push(albedoTex, roughTex, nrm)
    slateMat = safe(lit(own(new THREE.MeshPhysicalMaterial({ map: albedoTex, roughnessMap: roughTex, roughness: 1, metalness: 0, color: 0xffffff, normalMap: nrm, normalScale: new THREE.Vector2(0.24, 0.24) }), 0.5), 'cb-slate', withKey(0.9))) as THREE.MeshPhysicalMaterial
    set('board_face', slateMat)

    // the oak: the GLB's maps (Poly Haven Oak Veneer 01), aged a little darker and warmer
    const o0 = src('frame_h')
    const oakKey = withKey(0.42)
    const oak = safe(withAO(lit(own(new THREE.MeshStandardMaterial({ map: o0?.map ?? null, normalMap: o0?.normalMap ?? null, roughnessMap: o0?.roughnessMap ?? null, color: new THREE.Color(0.45, 0.4, 0.35), roughness: 0.95, metalness: 0 }), 0.5), 'cb-oak2', sh => { oakKey(sh); wornOak(sh) }), { direct: 0.6, spec: 0.95 }))
    if (oak.map) oak.map.anisotropy = maxA
    for (const n of ['frame_h', 'frame_v', 'ledge']) set(n, oak)
    const matte = (n: string, rough: number, k = 1, keyK = 0.7) => safe(withAO(lit(own(new THREE.MeshStandardMaterial({ color: col(n), roughness: rough, metalness: 0 }), k), 'cb-' + n, withKey(keyK)), { direct: 0.6, spec: 0.8 }))
    for (const k of ['white', 'pink', 'blue']) set('chalk_' + k, matte('chalk_' + k, 1.0, 0.9, 0.8))
    const eBack = matte('eraser_body', 0.7)
    eBack.color.lerp(new THREE.Color(0.2, 0.2, 0.2), 0.35).multiplyScalar(0.82)      // an old wooden back, not new tan
    set('eraser_body', eBack); set('eraser_felt', matte('eraser_felt', 1.0, 0.8))
    const wallKey = withKey(0.07)
    const wallMat = safe(withAO(lit(own(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.035, 0.034, 0.032), roughness: 0.96, metalness: 0 }), 0.22), 'cb-wall2', sh => { wallKey(sh); wallPool(sh) }), { direct: 1, spec: 1 }))
    set('wall', wallMat)
    for (const n of ['board_face', 'frame_h', 'frame_v', 'ledge']) { const m = by.get(n); if (m) hit.push(m) }

    // the eraser gets its own pivot so it can leave the ledge
    const eb = by.get('eraser_body'), ef = by.get('eraser_felt')
    if (eb && ef) {
      const bb = new THREE.Box3().setFromObject(eb).union(new THREE.Box3().setFromObject(ef))   // gltf is not yet in the scene graph: its matrices are the identity here
      bb.getCenter(E0)
      eraser.position.copy(E0)
      eraser.add(eraserTilt)
      for (const m of [eb, ef]) { m.removeFromParent(); m.position.sub(E0); eraserTilt.add(m) }
      gltf.add(eraser)
    }
    // chalk dust: sinks to the groove at the foot of the slate (the bottom rail's top), or, off the eraser, to the ledge
    dust = new Dust({ y: -H / 2, z0: -LIP + 0.001, z1: 0 }, { y: mapY(LEDGE_TOP0), z0: 0, z1: WALL_Z + LEDGE_D })
    gltf.add(dust.points)
    owned.push(dust)
    gltf.position.y = LIFT
    gltfRoot = gltf
    turn.add(gltf)
    // first frame state: the board blank, nothing written yet (the entrance writes it)
    clearInk(); compose(); albedoTex.needsUpdate = true; dirty = false
    turn.visible = true
    dust.points.visible = true
    c.prewarm(root)
    dust.points.visible = false
    dbg.buildMs = performance.now() - tBuild
    ready = true
    inst.dust = 0          // the old particle chalkboard would show through the dark slate as faint graphs: the form hides fully while the board is in
  })()

  // -------------------------------------------------------------------------------------------- the felt eraser: leave the ledge, wipe in bands, go back (anime.js), then write again
  let wipeAnim: JSAnimation | null = null
  let wiping = false
  const wipe = { s: 0 }
  const NB = tall ? 6 : 5
  const BANDS = Array.from({ length: NB }, (_, i) => H / 2 - (i + 0.5) * (H / NB))
  const BAND_H = H / NB / 2 + 0.03
  const frontX = new Array(NB).fill(0)
  const REST = new THREE.Vector3(), _lift = new THREE.Vector3(), _from = new THREE.Vector3()
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x))
  let wipeSeed = 1
  /** the bands the pad has left behind keep a haze of chalk dust (chalk.haze): lay it over each band as the pad moves on to the next */
  let hazed = 0
  const hazeTo = (n: number) => { for (; hazed < n; hazed++) { dirty = true; chalk.haze(wipeSeed++, H / 2 - BANDS[hazed] - H / NB / 2, H / 2 - BANDS[hazed] + H / NB / 2) } }
  const eraserPose = (s: number) => {
    // 0..0.12 off the ledge to the top-left of the board, 0.12..0.86 the bands, 0.86..1 back to the ledge
    const A = 0.12, B = 0.86
    const left = -W / 2 + 0.16, right = W / 2 - 0.16, zf = -LIP + 0.029
    let x: number, y: number, z: number, flip: number, wob = 0
    const lifted = _lift.set(left, BANDS[0], zf + 0.05)
    if (s < A) {
      const u = ease(s / A)
      x = REST.x + (lifted.x - REST.x) * u; y = REST.y + (lifted.y - REST.y) * u
      z = REST.z + (lifted.z - REST.z) * u + Math.sin(u * Math.PI) * 0.12
      flip = u * (Math.PI / 2)
    } else if (s < B) {
      const b = (s - A) / (B - A) * NB, bi = Math.min(NB - 1, Math.floor(b)), u = b - bi, e = ease(u)
      hazeTo(bi)
      const dir = bi % 2 === 0 ? 1 : -1
      x = dir > 0 ? left + (right - left) * e : right + (left - right) * e
      y = BANDS[bi] + (BAND_H - 0.08) * Math.sin(u * TAU * 5.5)
      wob = 0.12 * Math.sin(u * TAU * 5.5 + 1)
      const turnEase = bi < NB - 1 ? Math.max(0, (u - 0.93) / 0.07) : 0
      y += (BANDS[Math.min(NB - 1, bi + 1)] - BANDS[bi]) * ease(turnEase)
      z = zf + (u < 0.04 ? (0.04 - u) * 1.2 : 0) + turnEase * 0.03
      flip = Math.PI / 2
      // wipe what the pad has crossed (canvas: board units from the top-left, y down)
      const lo = Math.min(frontX[bi], x), hi = Math.max(frontX[bi], x)
      if (u > 0.002 && hi - lo > 0.0005) { chalk.wipe(lo - 0.13 + W / 2, hi + 0.13 + W / 2, H / 2 - (BANDS[bi] + BAND_H), H / 2 - (BANDS[bi] - BAND_H), wipeSeed++); dirty = true }
      frontX[bi] = x
    } else {
      hazeTo(NB)
      const u = ease((s - B) / (1 - B))
      const from = _from.set(right, BANDS[NB - 1], zf)
      x = from.x + (REST.x - from.x) * u; y = from.y + (REST.y - from.y) * u
      z = from.z + (REST.z - from.z) * u + Math.sin(u * Math.PI) * 0.12
      flip = (1 - u) * (Math.PI / 2)
    }
    eraser.position.set(x, y, z); eraser.rotation.z = wob; eraserTilt.rotation.x = flip
  }
  const endWipe = () => {
    wiping = false; wipeAnim = null
    eraser.position.copy(REST); eraser.rotation.z = 0; eraserTilt.rotation.x = 0
    resetProgress(); wt = -0.7; written = false      // the haze stays; the hand writes over it
  }
  const startWipe = () => {
    if (!ready || wiping || !gltfRoot) return
    mark?.dismiss()
    if (rm()) {
      // reduced motion: the wipe happens at once (most of the chalk off, a haze left), then the board is written again at once
      for (let i = 0; i < NB; i++) chalk.wipe(0, W, H / 2 - (BANDS[i] + BAND_H), H / 2 - (BANDS[i] - BAND_H), wipeSeed++)
      chalk.haze(wipeSeed++); dirty = true
      resetProgress(); tl.seek(totalMs); paintUntil(false); written = true; wt = layout.total; dirty = true
      return
    }
    wiping = true
    REST.copy(E0)
    BANDS.forEach((_, i) => { frontX[i] = i % 2 === 0 ? -W / 2 + 0.16 : W / 2 - 0.16 })
    wipe.s = 0; hazed = 0
    c.emit('sig.mathecon')
    wipeAnim = animate(wipe, { s: 1, duration: 3300 + NB * 120, ease: 'linear', onUpdate: () => eraserPose(wipe.s), onComplete: endWipe })
  }

  // -------------------------------------------------------------------------------------------- pointer: drag the board to tilt it, click the eraser
  const tip_ = stageTip()
  const _box = new THREE.Box3(), _hit = new THREE.Vector3()
  const overEraser = (ray: THREE.Raycaster) => {
    if (!ready || wiping) return false
    eraser.updateWorldMatrix(true, true)
    if (ray.intersectObject(eraser, true).length) return true
    _box.setFromObject(eraser).expandByScalar(0.06)
    return !!ray.ray.intersectBox(_box, _hit)
  }
  const overBoard = (ray: THREE.Raycaster) => ready && hit.length > 0 && ray.intersectObjects(hit, false).length > 0
  let drag: { x0: number; y0: number; yaw0: number; pitch0: number } | null = null
  let spring_: JSAnimation | null = null
  const pointer: StagePointer = {
    hover(ray, x, y) {
      if (overEraser(ray)) { tip_.show(x, y, 'Felt eraser', `${click} to wipe and rewrite`, '#D9A441', true); return 'pointer' }
      tip_.hide()
      return overBoard(ray) ? 'grab' : null
    },
    down(ray, x, y) {
      if (overEraser(ray)) { tip_.hide(); startWipe(); return 'tap' }
      if (!overBoard(ray)) return null
      spring_?.cancel(); spring_ = null
      drag = { x0: x, y0: y, yaw0: st.yaw, pitch0: st.pitch }
      mark?.dismiss()
      return 'drag'
    },
    move(_ray, x, y) {
      if (!drag) return
      st.yaw = Math.max(-0.34, Math.min(0.34, drag.yaw0 + (x - drag.x0) * 0.0042))
      st.pitch = Math.max(-0.13, Math.min(0.13, drag.pitch0 + (y - drag.y0) * 0.0028))
    },
    up() {
      if (!drag) return
      drag = null
      if (rm()) { st.yaw = 0; st.pitch = 0; return }
      spring_ = animate(st, { yaw: 0, pitch: 0, ease: spring({ duration: 1000, bounce: 0.22 }), composition: 'replace' })
    },
    leave() { tip_.hide() },
  }
  Object.defineProperty(inst, 'pointer', { get: () => (ready ? pointer : undefined) })
  const srBtn = srAction('Wipe the chalkboard and write the coursework again', startWipe)
  let mark: ReturnType<typeof tryMark> | null = null
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3()

  // -------------------------------------------------------------------------------------------- frame
  let broken = false, upT = 0, trickle = 0, tipSeen = false
  const tipPx: [number, number] = [0, 0]
  const _d = new THREE.Vector3()
  /** the grain of chalk dust, in CSS pixels at scale 1 (a speck's own scale runs 0.78 to 1.6 times this: 3 to 7 px) */
  const DUST_PX = Math.max(3.6, Math.min(5, innerHeight * 0.0048))
  function update(f: StageFrame) {
    if (!ready || broken) return
    try { frame(f) } catch (e) { broken = true; turn.visible = false; inst.dust = 1; srBtn.setActive(false); console.warn('[chalkboard] stage stopped', e) }
  }
  function frame(f: StageFrame) {
    const a = f.arrive, d = f.depart
    const held = a > 0.97 && d < 0.02
    const paused = appState.paused
    emitT = f.t
    tapsOn = !f.reduced
    // entrance: the board swings in from a steeper angle and settles; the exit tilts it away (scrubbed with the leg)
    const e = easeOutCubic(clamp01(a / 0.85)), x = easeInCubic(clamp01(d / 0.9))
    turn.rotation.y = YAW0 + (1 - e) * 0.55 + x * -0.4 + st.yaw
    turn.rotation.x = st.pitch
    turn.position.set(0, -0.12 * (1 - e) - 0.18 * x, 0)
    face.position.y = tall ? -PHONE_DROP * f.visH / Math.max(1e-6, root.scale.x) : 0

    // the hand: starts when the board has all but arrived, runs on its own clock; reduced motion: written at once; Pause holds it
    if (f.reduced) {
      if (!written && !wiping) { seekInk(layout.total); written = true; wt = layout.total }
    } else if (wiping) {
      // the eraser owns the layer
    } else {
      if (a < 0.5 || d > 0.9) { if (wt !== 0 || written) { wt = 0; written = false; clearInk(); dust?.clear(); aged.uDust.value = 0.25 } }
      else if (a > 0.8 && !paused) {
        wt += f.dt
        if (wt > 0 && !written) {
          tl.seek(Math.min(totalMs, wt * 1000)); paintUntil(true)
          if (wt >= layout.total) written = true
        }
      }
    }
    // dust: a puff as each stroke lands and a trickle along it, a cloud off the felt pad while it drags; it drifts, sinks and settles (none under reduced motion;
    // Pause holds it where it is). The grain is a few pixels across on any screen: the size is set from the distance to the board
    if (dust && !f.reduced && !paused) {
      const dt = Math.min(f.dt, 0.05)
      if (!wiping) {
        for (const s0 of starts) dust.puff(s0.x - W / 2, H / 2 - s0.y, -LIP, 3 + ((Math.random() * 3) | 0), s0.c, 0.9)
        if (tip) {
          trickle += dt * 16
          const n = Math.floor(trickle); trickle -= n
          if (n > 0) dust.emit(tip[0] - W / 2, H / 2 - tip[1], -LIP, n, tipChalk)
        }
      } else if (wipe.s > 0.12 && wipe.s < 0.86) {
        trickle += dt * 46
        const n = Math.floor(trickle); trickle -= n
        for (let k = 0; k < n; k++) dust.puff(eraser.position.x + (Math.random() - 0.5) * 0.26, eraser.position.y + (Math.random() - 0.5) * 0.08, eraser.position.z - 0.012, 1 + (Math.random() < 0.4 ? 1 : 0), CHALK.white, 0.8, 0.62)
      }
      dust.step(dt, f.t)
      gltfRoot?.getWorldPosition(_d)
      dust.setSize(DUST_PX * 2 * c.camera.position.distanceTo(_d) / Math.max(1, c.renderer.domElement.clientHeight))
    } else if (dust && f.reduced) dust.clear()
    if (tip && gltfRoot) {
      // where the chalk tip is on screen (CSS pixels), for the probes
      _d.set(tip[0] - W / 2, H / 2 - tip[1], -LIP); gltfRoot.localToWorld(_d); _d.project(c.camera)
      tipPx[0] = Math.round((_d.x + 1) / 2 * innerWidth); tipPx[1] = Math.round((1 - _d.y) / 2 * innerHeight); tipSeen = true
    }
    starts.length = 0
    tip = null

    // the dust that has gathered on the shelf: a little always (old dust), more as the board is written, most after the eraser has been at it
    aged.uDust.value = wiping ? 1 : Math.max(aged.uDust.value, 0.25 + 0.75 * (written ? 1 : clamp01(committed / layout.lines.length)))

    // the canvas: composite and upload at most 30 times a second while the chalk moves (a jump uploads at once)
    if (dirty && albedoTex && (f.t - upT > 0.032 || f.reduced || written)) { compose(); albedoTex.needsUpdate = true; dirty = false; upT = f.t }

    // the key: board-frame direction and pool centre into view space
    if (gltfRoot) {
      gltfRoot.updateWorldMatrix(true, false)
      gltfRoot.getWorldQuaternion(_q)
      key.uKeyDir.value.copy(KEY_L).applyQuaternion(_q).transformDirection(c.camera.matrixWorldInverse)
      _v.set(-W * 0.32, H * 0.3, 0.2); gltfRoot.localToWorld(_v); key.uKeyPos.value.copy(_v).applyMatrix4(c.camera.matrixWorldInverse)
      key.uKeyRad.value = Math.max(W, H) * 1.05 * S * root.scale.x
    }
    if (slateMat) slateMat.envMapRotation.y = Math.sin(f.t * 0.21) * 0.12 + (1 - e) * 0.5

    srBtn.setActive(held && ready && !wiping)
    const covered = html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
    if (!mark) mark = tryMark('chalkboard', `${Click} the eraser`, () => { if (!gltfRoot) return null; eraser.updateWorldMatrix(true, false); return eraser.getWorldPosition(_p) }, c.camera, '#D9A441')
    mark.update(held && !covered && written && !wiping, f.dt, f.reduced)
  }

  ;(window as unknown as { __chalkboard: unknown }).__chalkboard = {
    info: () => ({ ready, tall, wt: +wt.toFixed(2), written, wiping, committed, lines: layout.lines.length, strokes: layout.lines.reduce((n, l) => n + l.strokes.length, 0), total: +layout.total.toFixed(2), canvas: [CW, CH], yaw: +st.yaw.toFixed(3), dust: dust?.count() ?? 0, tip: tipSeen ? [tipPx[0], tipPx[1]] : null, calls: c.renderer.info.render.calls, paused: appState.paused, slateMs: +dbg.slateMs.toFixed(1), buildMs: +dbg.buildMs.toFixed(1), lipN: dbg.lipN, dustLine: +aged.uDust.value.toFixed(2) }),
    eraser: () => { if (!gltfRoot) return null; eraser.updateWorldMatrix(true, true); const v = eraser.getWorldPosition(new THREE.Vector3()).project(c.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight] },
    /** the slate's centre on screen (CSS pixels), for the drag probe */
    board: () => { const me = dbg.by?.get('board_face'); if (!me || !gltfRoot) return null; me.updateWorldMatrix(true, false); const v = new THREE.Box3().setFromObject(me).getCenter(new THREE.Vector3()).project(c.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight] },
    erase: () => startWipe(),
    parts: () => { const n: string[] = []; root.traverse(o => { if ((o as THREE.Mesh).isMesh) n.push(o.name) }); return n },
    seek: (t: number) => { seekInk(t); wt = t; written = t >= layout.total; compose(); if (albedoTex) albedoTex.needsUpdate = true; dirty = false },
    layout,
  }
  void owned
  return inst
}

const def: StageDef = { id: 'mathecon', build: buildStage }
export default def
