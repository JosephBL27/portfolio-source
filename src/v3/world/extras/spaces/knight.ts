// SPACE "knight" (unit 15B): a candlelit study. A panelled back wall holds a stone fireplace (a shader fire, embers, and the room's one warm point light, which
// is what the board catches) and a tall window with NO pane: the night behind it is the world's own Milky Way sky. A worn rug and dark parquet under the set, a
// leather armchair at the edge of the frame, books, three candles on the mantel, a thread of moonlight from the window. The chess set sits in a walnut frame let
// into the floor (cabinet/chess.ts base footprint). Reactions: a move on the board makes the hearth pop (embers, a flare of light), a hovered piece makes the
// candles lean in. Blender props (games-props.glb: fireplace, chair, books) are lazy; each has a plain procedural stand-in.
import * as THREE from 'three'
import { canvasTex, glowTexture } from '../cabinet/kit'
import { withAO } from '../../glbmodel'
import { burst, gameProps, since, type Burst } from './games-fx'
import { fogify, glowPlane, groundMesh, lightCone, motes, NOISE, type Cone, type LightCfg, type Motes, type Space, type SpaceKit } from './common'

// the chess stage's footprint (cabinet/chess.ts: W = 2 (HB + BORDER + SIDE), the base is W - 0.34 wide, DEPTH deep, centred at CZ)
const BASE_W = 6.88 - 0.34, BASE_D = 8.16 - 0.34, CZ = 0.02
const WALL_Z = -7.6, FIRE_X = -4.3, FIRE_S = 1.15, WIN_X = 3.9

const FLAME_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform float uTime, uPres, uInt, uSeed;\n${NOISE}
void main() {
  vec2 uv = vUv; float x = (uv.x - 0.5) * 2.0;
  float n = fbm(vec2(uv.x * 3.2 + uSeed, uv.y * 2.4 - uTime * 1.7)) + 0.35 * vn(vec2(uv.x * 9.0, uv.y * 6.0 - uTime * 3.4));
  float body = (1.0 - abs(x) * (0.55 + uv.y * 1.2)) * (1.25 - uv.y * 1.15);
  float f = clamp(body + (n - 0.62) * 0.95, 0.0, 1.0); f = f * f * (3.0 - 2.0 * f);
  vec3 c = mix(vec3(0.62, 0.05, 0.01), vec3(1.0, 0.46, 0.06), smoothstep(0.1, 0.55, f)); c = mix(c, vec3(1.0, 0.9, 0.55), smoothstep(0.55, 0.95, f));
  gl_FragColor = vec4(c * f * 1.15, f * smoothstep(0.0, 0.07, uv.y) * uPres * uInt);
}`

export function createKnightSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-knight'
  let kit: SpaceKit, beam: Cone, hearth: THREE.Mesh, embers: Motes, dust: Motes, pop: Burst, lastMove = 0
  const flames: THREE.ShaderMaterial[] = []
  const candles: { s: THREE.Sprite; g: THREE.Sprite; ph: number }[] = []
  const firePos = new THREE.Vector3(FIRE_X, 1.05, WALL_Z + 0.55)
  const light: LightCfg = {
    keyPos: [3.2, 7.6, 5.4], keyAim: [0, 1.4, 0.2], keyCol: [1.0, 0.78, 0.5], keyI: 90, keyAngle: 0.78, keyPen: 0.85, keyDist: 24,
    rimPos: [FIRE_X + 0.3, 1.2, WALL_Z + 1.0], rimCol: [1.0, 0.46, 0.16], rimI: 240, rimDist: 17,
    fillSky: [0.30, 0.38, 0.62], fillGround: [0.24, 0.12, 0.06], fillI: 1.0,
  }
  return {
    id: 'knight', root, light,
    async build(k) {
      kit = k
      k.fog.col.value.setRGB(0.02, 0.012, 0.012)
      root.add(groundMesh(k, {
        uniforms: { uFire: { value: 1 } },
        frag: /* glsl */ `
          uniform float uFire;
          vec4 ground(vec2 p, float r) {
            // dark parquet: planks in rows, each row offset, grain along x
            float row = floor((p.y + 30.0) / 0.5); float off = h11(row) * 3.0; float cx = floor((p.x + off) / 2.1);
            vec2 pl = vec2(fract((p.x + off) / 2.1), fract((p.y + 30.0) / 0.5));
            float seam = smoothstep(0.03, 0.0, min(min(pl.x, 1.0 - pl.x) * 2.1, min(pl.y, 1.0 - pl.y) * 0.5) - 0.006);
            float tone = 0.55 + 0.9 * h21(vec2(row, cx)); float grain = fbm(vec2(p.x * 2.5 + row * 7.0, p.y * 28.0));
            vec3 wood = vec3(0.12, 0.066, 0.034) * (0.55 + 0.7 * tone) * (0.7 + 0.6 * grain) * (1.0 - 0.7 * seam);
            // the rug: a worn oxblood field, an indigo band, a cream line, a diamond medallion
            vec2 q = abs(p - vec2(0.0, 0.4)); float rd = max(q.x / 5.4, q.y / 5.7); float rug = 1.0 - smoothstep(0.985, 1.0, rd);
            float wv = 0.6 + 0.4 * fbm(p * 7.0) + 0.25 * h21(floor(p * 34.0));
            vec3 field = vec3(0.17, 0.035, 0.035) * wv;
            float b1 = smoothstep(0.88, 0.89, rd) * (1.0 - smoothstep(0.945, 0.955, rd));
            float b2 = smoothstep(0.83, 0.835, rd) * (1.0 - smoothstep(0.85, 0.855, rd));
            float dia = 1.0 - smoothstep(0.5, 0.52, (q.x + q.y * 0.9) / 3.3);
            float dia2 = smoothstep(0.37, 0.39, (q.x + q.y * 0.9) / 3.3) * (1.0 - smoothstep(0.41, 0.43, (q.x + q.y * 0.9) / 3.3));
            field = mix(field, vec3(0.06, 0.07, 0.2) * wv, b1); field = mix(field, vec3(0.5, 0.42, 0.26) * wv, b2 * 0.9);
            field = mix(field, vec3(0.1, 0.07, 0.17) * wv, dia * 0.8); field = mix(field, vec3(0.5, 0.38, 0.2) * wv, dia2 * 0.7);
            float fringe = smoothstep(1.0, 1.03, rd) * (1.0 - smoothstep(1.03, 1.06, rd)) * step(0.5, fract(p.x * 14.0 + p.y * 14.0));
            vec3 col = mix(wood, field, rug);
            // the firelight pooling on the boards and rug from the hearth at the back left; a cold slab of moonlight from the window on the right
            vec2 hf = p - vec2(${FIRE_X.toFixed(2)}, ${(WALL_Z + 1.5).toFixed(2)});
            float lit = exp(-dot(hf, hf * vec2(0.5, 1.2)) / 22.0);
            col *= 0.55 + 2.2 * lit * uFire;
            col += vec3(1.0, 0.45, 0.12) * lit * uFire * 0.045;
            vec2 mw = p - vec2(${(WIN_X - 1.0).toFixed(2)}, -1.2);
            col += vec3(0.22, 0.32, 0.6) * exp(-dot(mw * vec2(0.8, 0.45), mw * vec2(0.8, 0.45)) / 4.0) * 0.07;
            return vec4(col, 1.0);
          }`,
      }))
      // ---- the frame the set stands in: four walnut slabs round the base footprint, a brass line on the inner edge
      const walnut = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.11, 0.06, 0.035), roughness: 0.42, metalness: 0.05, envMap: k.env, envMapIntensity: 0.8 }), k.fog)
      const brass = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.66, 0.34), metalness: 1, roughness: 0.3, envMap: k.env, envMapIntensity: 1.5 }), k.fog)
      const dais = new THREE.Group(); dais.rotation.y = k.stageYaw; dais.position.set(0, 0, CZ)
      const T = 0.5, H = 0.3, iw = BASE_W + 0.12, id = BASE_D + 0.12
      const slab = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), walnut); m.position.set(x, H / 2, z); return m }
      dais.add(slab(iw + 2 * T, T, 0, -(id + T) / 2), slab(iw + 2 * T, T, 0, (id + T) / 2), slab(T, id, -(iw + T) / 2, 0), slab(T, id, (iw + T) / 2, 0))
      const line = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), brass); m.position.set(x, H + 0.004, z); return m }
      dais.add(line(iw, 0.03, 0, -id / 2), line(iw, 0.03, 0, id / 2), line(0.03, id, -iw / 2, 0), line(0.03, id, iw / 2, 0))
      root.add(dais)

      // ---- the back wall: damask-striped plaster, a window cut clean through it, wainscot, a crown line, a framed print
      const WIN = { x0: WIN_X - 1.7, x1: WIN_X + 1.7, y0: 2.1, y1: 5.9 }
      const wallShape = new THREE.Shape(); wallShape.moveTo(-30, 0); wallShape.lineTo(30, 0); wallShape.lineTo(30, 8.2); wallShape.lineTo(-30, 8.2); wallShape.closePath()
      const hole = new THREE.Path(); hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x1, WIN.y0); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x0, WIN.y1); hole.closePath(); wallShape.holes.push(hole)
      const wallTex = canvasTex(192, 192, (g, w, h) => {
        g.fillStyle = '#4a1e1a'; g.fillRect(0, 0, w, h)
        for (let x = 0; x < w; x += 48) { g.fillStyle = 'rgba(96,36,30,0.7)'; g.fillRect(x, 0, 24, h) }
        g.fillStyle = 'rgba(170,110,60,0.45)'
        for (let y = 24; y < h + 48; y += 96) for (let x = 24; x < w; x += 48) { g.beginPath(); g.moveTo(x, y - 18); g.quadraticCurveTo(x + 12, y, x, y + 18); g.quadraticCurveTo(x - 12, y, x, y - 18); g.fill() }
      }, { repeat: true })
      wallTex.repeat.set(1 / 3.2, 1 / 3.2)
      const wallMat = fogify(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, envMap: k.env, envMapIntensity: 0.5 }), k.fog)
      const wall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), wallMat); wall.position.set(0, 0, WALL_Z)
      root.add(wall)
      const trimMat = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1, 0.055, 0.032), roughness: 0.5, envMap: k.env, envMapIntensity: 0.6 }), k.fog)
      const trim = (w: number, h: number, d: number, x: number, y: number, z = WALL_Z + d / 2) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat); m.position.set(x, y, z); root.add(m); return m }
      trim(60, 1.5, 0.12, 0, 0.75); trim(60, 0.14, 0.2, 0, 1.55); trim(60, 0.22, 0.28, 0, 8.0)                          // wainscot, its rail, the crown
      for (let i = -5; i <= 5; i++) if (Math.abs(i * 2.2 - FIRE_X) > 3.2) trim(1.7, 0.95, 0.04, i * 2.2, 0.8, WALL_Z + 0.14)   // panels
      // the window: the opening is bare (the night behind it is the real sky); a frame, two mullions, a transom, a sill
      trim(3.7, 0.16, 0.34, WIN_X, WIN.y1 + 0.08, WALL_Z + 0.1); trim(3.7, 0.16, 0.34, WIN_X, WIN.y0 - 0.08, WALL_Z + 0.1); trim(0.16, 3.96, 0.34, WIN.x0 - 0.08, (WIN.y0 + WIN.y1) / 2, WALL_Z + 0.1); trim(0.16, 3.96, 0.34, WIN.x1 + 0.08, (WIN.y0 + WIN.y1) / 2, WALL_Z + 0.1)
      trim(0.09, 3.8, 0.12, WIN_X, (WIN.y0 + WIN.y1) / 2, WALL_Z + 0.04); trim(3.4, 0.09, 0.12, WIN_X, WIN.y0 + 2.3, WALL_Z + 0.04); trim(3.4, 0.09, 0.12, WIN_X, WIN.y0 + 1.0, WALL_Z + 0.04)
      trim(4.1, 0.14, 0.7, WIN_X, WIN.y0 - 0.2, WALL_Z + 0.35)
      // a framed print between the hearth and the window: a plain board diagram, no text
      const printTex = canvasTex(128, 160, (g, w, h) => {
        g.fillStyle = '#d8ccae'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a1e'
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) g.fillRect(14 + i * 12, 22 + j * 12, 12, 12)
        g.strokeStyle = '#3a2a1e'; g.lineWidth = 2; g.strokeRect(14, 22, 96, 96)
        g.fillStyle = '#1e1810'; for (const [x, y] of [[3, 2], [5, 4], [2, 6], [6, 1]]) { g.beginPath(); g.arc(20 + x * 12, 28 + y * 12, 4, 0, Math.PI * 2); g.fill() }
      })
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), new THREE.MeshStandardMaterial({ map: printTex, roughness: 0.8 })); pic.position.set(-0.4, 4.2, WALL_Z + 0.07); root.add(pic)
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.97, 0.1), brass); fr.position.set(-0.4, 4.2, WALL_Z + 0.03); root.add(fr)

      // ---- the fireplace: Blender stone + firebox + logs, or boxes. The flame planes stand in the opening.
      const gp = await gameProps()
      const mat = (c: [number, number, number], rough = 0.7, metal = 0, env = 0.4) => fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: rough, metalness: metal, envMap: k.env, envMapIntensity: env }), k.fog)
      const put = (name: string, m: THREE.MeshStandardMaterial, x: number, y: number, z: number, yaw: number, s: number) => {
        const src = gp?.get(name); if (!src) return null
        const o = new THREE.Mesh(src.geometry, withAO(m, { direct: 0.4 })); o.position.set(x, y, z); o.rotation.y = yaw; o.scale.setScalar(s); o.frustumCulled = false; root.add(o); return o
      }
      const fz = WALL_Z + 0.5 * FIRE_S + 0.02
      if (gp) {
        put('stone', mat([0.34, 0.29, 0.24], 0.8, 0, 0.7), FIRE_X, 0, fz, 0, FIRE_S); put('firebox', mat([0.035, 0.025, 0.022], 0.95), FIRE_X, 0, fz, 0, FIRE_S)
        put('logs', mat([0.06, 0.03, 0.018], 0.9), FIRE_X, 0, fz, 0, FIRE_S)
      } else {
        const st = mat([0.34, 0.29, 0.24], 0.8, 0, 0.7)
        for (const [w, h, d, x, y] of [[1.1, 3.4, 0.9, -1.8, 1.7], [1.1, 3.4, 0.9, 1.8, 1.7], [4.4, 0.7, 0.9, 0, 2.35], [5.4, 0.2, 1.2, 0, 2.82]] as number[][]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w * FIRE_S, h * FIRE_S, d * FIRE_S), st); b.position.set(FIRE_X + x * FIRE_S, y * FIRE_S, fz); root.add(b)
        }
      }
      // flames: three crossed planes, additive; a warm glow plane on the hearth
      for (let i = 0; i < 3; i++) {
        const fm = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { uTime: k.fog.time, uPres: k.fog.pres, uInt: { value: 1 }, uSeed: { value: i * 3.7 } },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FLAME_FRAG,
        })
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2.0 - i * 0.3, 1.7 - i * 0.2), fm); p.position.set(FIRE_X + (i - 1) * 0.18, 0.2 + (1.7 - i * 0.2) / 2, fz - 0.05 + i * 0.03); p.rotation.y = (i - 1) * 0.45; p.renderOrder = 6
        root.add(p); flames.push(fm)
      }
      hearth = glowPlane(k, { col: [1.0, 0.5, 0.16], size: [8, 4.4], opacity: 0.4 }); hearth.position.set(FIRE_X, 0.03, WALL_Z + 2.0)
      const wallGlow = glowPlane(k, { col: [1.0, 0.5, 0.2], size: [9, 6], opacity: 0.34, standing: true }); wallGlow.position.set(FIRE_X, 2.0, WALL_Z + 0.25)
      root.add(hearth, wallGlow)
      embers = motes(k, { n: 46, at: [FIRE_X, 0.6, WALL_Z + 0.9], half: [0.7, 0.2], h: 4.2, col: [1.0, 0.5, 0.15], size: 1.7, speed: 0.55, sway: 0.5, seed: 8, alpha: 0.95 })
      pop = burst(k, { n: 44, speed: 1.1, up: 3.6, g: 5.5, life: 1.9, size: 2.6, col: [1.0, 0.62, 0.22], alpha: 1, seed: 9 })
      root.add(embers.points, pop.points)

      // ---- three candles on the mantel, flickering; a stack of books
      const mantelY = 2.92 * FIRE_S + 0.1
      for (const dx of [-1.5, 0.4, 1.6]) {
        const x = FIRE_X + dx, z = fz + 0.1
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.32 + Math.abs(dx) * 0.06, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.64, 0.5), toneMapped: false })); stub.position.set(x, mantelY + 0.17, z)
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.65, 0.24), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); f.scale.setScalar(0.5); f.position.set(x, mantelY + 0.45, z)
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.6, 0.22), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.scale.setScalar(2.8); g.position.copy(f.position)
        root.add(stub, f, g); candles.push({ s: f, g, ph: dx * 5 })
      }
      // the armchair at the edge of the frame, and books on the floor and the mantel
      if (gp) {
        const yawC = Math.atan2(-5.9, -1.8)
        put('chair', mat([0.16, 0.065, 0.035], 0.42, 0, 0.9), 5.9, 0, 1.8, yawC, 1.25); put('cushion', mat([0.2, 0.085, 0.045], 0.45, 0, 0.9), 5.9, 0, 1.8, yawC, 1.25); put('chairwood', mat([0.07, 0.04, 0.025], 0.5), 5.9, 0, 1.8, yawC, 1.25)
        const cols: [number, number, number][] = [[0.34, 0.07, 0.07], [0.07, 0.2, 0.15], [0.1, 0.13, 0.3], [0.36, 0.26, 0.08]]
        for (let i = 0; i < 4; i++) { put('book' + i, mat(cols[i], 0.65), -5.7, 0, -1.1, 0.7, 1.25); if (i < 3) put('book' + i, mat(cols[(i + 2) % 4], 0.65), FIRE_X + 2.3, mantelY, fz + 0.1, 0.2, 0.55) }
        put('pages', mat([0.78, 0.72, 0.56], 0.9), -5.7, 0, -1.1, 0.7, 1.25); put('pages', mat([0.78, 0.72, 0.56], 0.9), FIRE_X + 2.3, mantelY, fz + 0.1, 0.2, 0.55)
      } else {
        const chair = new THREE.Group(); chair.position.set(5.9, 0, 1.8); chair.rotation.y = Math.atan2(-5.9, -1.8)
        const lm = mat([0.16, 0.065, 0.035], 0.42, 0, 0.9)
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 2.3), lm); seat.position.y = 0.6; const back = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.3, 0.6), lm); back.position.set(0, 1.5, -1.0)
        chair.add(seat, back); root.add(chair)
      }
      // ---- moonlight from the window: a cool, faint shaft toward the board, and dust turning in the room
      const sd = new THREE.Vector3(-1.4, -3.6, 4.2).normalize()
      beam = lightCone(k, { h: 9, r: 1.9, col: [0.5, 0.64, 1.0], I: 0.12, seed: 6 })
      beam.mesh.position.set(WIN_X, 4.2, WALL_Z + 0.5); beam.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), sd)
      dust = motes(k, { n: 100, at: [0, 0, -1], half: [6, 5], h: 6, col: [1.0, 0.8, 0.55], size: 1.8, speed: 0.06, sway: 0.4, seed: 21, alpha: 0.55 })
      root.add(beam.mesh, dust.points)
    },
    update(t, _dt, r) {
      const rm = kit.reduced()
      const mv = rm ? 0 : since('moveAt', 2.2), hv = rm ? 0 : since('hoverAt', 0.8)
      if (!rm && mv > 0.97 && lastMove <= 0.97) pop.fire([FIRE_X + (Math.random() - 0.5) * 0.8, 0.5, WALL_Z + 1.0])
      lastMove = mv; pop.update()
      // the fire: a slow breath, a quick flutter, a flare when a move is made
      const flick = rm ? 1 : 0.9 + 0.07 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.1 + 1.0) + 0.04 * Math.sin(t * 13.7)
      const flare = 1 + 0.55 * mv
      for (const f of flames) f.uniforms.uInt.value = flick * flare
      light.rimI = 240 * flick * flare
      ;(hearth.material as THREE.MeshBasicMaterial).opacity = 0.3 * r * flick * flare
      for (const c of candles) {
        const q = rm ? 1 : 0.78 + 0.22 * Math.sin(t * 9 + c.ph) * Math.sin(t * 3.1 + c.ph * 2)
        c.s.material.opacity = Math.min(1, 0.9 * r * q * (1 + 0.25 * hv)); c.g.material.opacity = 0.28 * r * q * (1 + 0.6 * hv)
        c.s.scale.set(0.5 * (1 + 0.1 * hv), 0.5 * (1 + 0.3 * hv + 0.12 * Math.sin(t * 11 + c.ph)), 1)
      }
      beam.set(0.12 * (rm ? 1 : 0.92 + 0.08 * Math.sin(t * 0.5)))
      embers.set(r, rm ? 0 : 1 + 1.8 * mv); dust.set(r, rm ? 0 : 1)
    },
    dispose() { embers?.dispose(); dust?.dispose(); pop?.dispose(); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; for (const x of Array.isArray(mm) ? mm : [mm]) x.dispose() } }) },
  }
}
