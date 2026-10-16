// SPACE "meeple" (unit 15B: a game-cafe corner): a candlelit library corner. ONE pendant lamp hangs over the game table and throws a cone of warm light on a worn rug; a ring of dark bookshelves
// stands round the corner, barely lit; two candles flicker on shelf boards; warm dust drifts through the cone. Nothing else: the table is the only bright thing.
import * as THREE from 'three'
import { canvasTex, glowTexture } from '../cabinet/kit'
import { withAO } from '../../glbmodel'
import { bokeh, burst, gameProps, since, type Bokeh, type Burst } from './games-fx'
import { fogify, glowPlane, groundMesh, lcg, lightCone, motes, type Cone, type LightCfg, type Motes, type Space, type SpaceKit } from './common'

const RING_R = 6.5, UNIT_W = 2.15, UNIT_H = 6.0, UNIT_D = 0.62, SHELVES = [0.5, 1.7, 2.9, 4.1, 5.3]
const LAMP_Y = 3.6, PIVOT_Y = LAMP_Y + 9.5
// game-box palette (muted, unbranded): teal, mustard, brick, forest, plum, slate blue, terracotta, cream
const BOXES: [number, number, number][] = [[0.07, 0.30, 0.31], [0.50, 0.36, 0.07], [0.43, 0.13, 0.09], [0.08, 0.26, 0.14], [0.27, 0.09, 0.22], [0.10, 0.17, 0.38], [0.50, 0.22, 0.10], [0.50, 0.46, 0.36]]
// muted dark spines: oxblood, bottle green, navy, umber, ochre, slate, plum, bone
const SPINES: [number, number, number][] = [[0.30, 0.09, 0.08], [0.10, 0.22, 0.15], [0.09, 0.13, 0.26], [0.26, 0.15, 0.08], [0.36, 0.26, 0.10], [0.16, 0.19, 0.24], [0.22, 0.10, 0.18], [0.42, 0.38, 0.30]]

export function createMeepleSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-meeple'
  let kit: SpaceKit, cone: Cone, dust: Motes, halo: THREE.Sprite, pool: THREE.Mesh, lamp: THREE.Group, bk: Bokeh, spark: Burst, lastRoll = 0
  const flames: { s: THREE.Sprite; ph: number; base: number }[] = []
  const light: LightCfg = {
    keyPos: [0, 6.0, 1.6], keyAim: [0, 0.4, 0], keyCol: [1.0, 0.8, 0.52], keyI: 44, keyAngle: 0.62, keyPen: 0.75, keyDist: 20,
    rimPos: [-2.7, 3.4, -2.5], rimCol: [0.3, 0.95, 0.5], rimI: 10, rimDist: 14,
    fillSky: [1.0, 0.72, 0.45], fillGround: [0.1, 0.05, 0.04], fillI: 0.16,
  }
  return {
    id: 'meeple', root, light,
    async build(k) {
      kit = k
      root.add(groundMesh(k, {
        frag: /* glsl */ `
          vec4 ground(vec2 p, float r) {
            float rr = length(p);
            float lamp = 0.14 + 0.86 * exp(-rr * rr / 11.0);
            // dark boards, faint seams
            float board = floor((p.y + 20.0) / 0.62); float seam = smoothstep(0.012, 0.0, abs(fract((p.y + 20.0) / 0.62) - 0.5) - 0.48);
            vec3 wood = vec3(0.024, 0.016, 0.012) * (0.7 + 0.6 * h21(vec2(board, floor(p.x * 0.5 + h11(board) * 9.0)))) * (1.0 - 0.5 * seam);
            // the rug: a worn oxblood field, ochre and bone bands, a fringe at the edge
            float rug = 1.0 - smoothstep(4.95, 5.05, rr);
            float wv = fbm(p * 9.0) * 0.5 + 0.5 * h21(floor(p * 40.0));
            vec3 field = vec3(0.20, 0.045, 0.04) * (0.55 + 0.7 * wv);
            float b1 = smoothstep(0.05, 0.0, abs(rr - 4.62) - 0.12), b2 = smoothstep(0.03, 0.0, abs(rr - 4.2) - 0.03), b3 = smoothstep(0.03, 0.0, abs(rr - 3.7) - 0.02);
            field = mix(field, vec3(0.42, 0.28, 0.09) * (0.6 + 0.5 * wv), b1);
            field = mix(field, vec3(0.5, 0.45, 0.34) * (0.6 + 0.4 * wv), max(b2, b3) * 0.8);
            float worn = 0.75 + 0.25 * fbm(p * 1.6);
            vec3 col = mix(wood * lamp, field * worn * lamp, rug);
            col += vec3(1.0, 0.62, 0.28) * exp(-rr * rr / 6.0) * 0.015;
            return vec4(col, 1.0);
          }`,
      }))
      // ---- the shelves: a ring of units round the corner, barely lit (the world's two directional lights and a low env are all they get)
      const R = lcg(31)
      const wood = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.075, 0.048, 0.034), roughness: 0.62, envMap: k.env, envMapIntensity: 0.35 }), k.fog)
      const spineMat = fogify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, envMap: k.env, envMapIntensity: 0.25 }), k.fog)
      const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g }
      const frameParts = [
        box(0.08, UNIT_H, UNIT_D, -UNIT_W / 2, UNIT_H / 2, 0), box(0.08, UNIT_H, UNIT_D, UNIT_W / 2, UNIT_H / 2, 0), box(UNIT_W, 0.1, UNIT_D, 0, UNIT_H, 0), box(UNIT_W, 0.35, UNIT_D, 0, 0.175, 0.02),
        box(UNIT_W, UNIT_H, 0.05, 0, UNIT_H / 2, -UNIT_D / 2 + 0.025), ...SHELVES.map(y => box(UNIT_W - 0.04, 0.06, UNIT_D - 0.04, 0, y - 0.03, 0)),
      ]
      const unitGeo = frameParts.reduce<THREE.BufferGeometry[]>((a, g) => { a.push(g.toNonIndexed()); return a }, [])
      const units: number[] = []
      const span = 108 * Math.PI / 180, count = k.phone ? 9 : 11
      for (let u = 0; u < count; u++) units.push(-span + (2 * span * u) / (count - 1))
      // merge the frame once, instance it per unit
      const frameGeo = (() => {
        const pos: number[] = [], nor: number[] = []
        for (const g of unitGeo) { const p = g.getAttribute('position'), n = g.getAttribute('normal'); for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)) } }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g
      })()
      const frames = new THREE.InstancedMesh(frameGeo, wood, units.length); frames.frustumCulled = false
      // books: per unit and per shelf, a row of spines of random width and height
      const books: { x: number; y: number; z: number; w: number; h: number; d: number; c: number; ph: number }[][] = []
      let nb = 0
      units.forEach((a, ui) => {
        const list: typeof books[0] = []
        for (let s = 0; s < SHELVES.length; s++) {
          let x = -UNIT_W / 2 + 0.1 + R() * 0.1
          const end = UNIT_W / 2 - 0.1 - (R() < 0.3 ? R() * 0.5 : 0)
          while (x < end) {
            if (R() < 0.17 && s !== 0) {                                                  // a game box on its end: a thick spine with a pale label band
              const w = 0.2 + R() * 0.16, h = 0.62 + R() * 0.34, c = Math.floor(R() * BOXES.length)
              if (x + w > end) break
              list.push({ x: x + w / 2, y: SHELVES[s] + h / 2, z: 0.02, w: w * 0.97, h, d: 0.5, c: 100 + c, ph: R() })
              list.push({ x: x + w / 2, y: SHELVES[s] + h * (0.45 + R() * 0.25), z: 0.02 + 0.254, w: w * 0.97, h: 0.1 + R() * 0.07, d: 0.012, c: 200 + c, ph: 0.5 })
              x += w
              continue
            }
            const w = 0.05 + R() * 0.12, h = 0.6 + R() * 0.46, c = Math.floor(R() * SPINES.length)
            if (x + w > end) break
            list.push({ x: x + w / 2, y: SHELVES[s] + h / 2, z: (R() - 0.5) * 0.06 + 0.02, w: w * 0.94, h, d: 0.36 + R() * 0.08, c, ph: R() })
            x += w
            if (R() < 0.05) x += 0.12 + R() * 0.2                                        // a gap, a book leaning
          }
        }
        nb += list.length; books.push(list); void ui; void a
      })
      const spines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), spineMat, nb); spines.frustumCulled = false
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
      let bi = 0
      units.forEach((a, ui) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
        const cx = Math.sin(a) * RING_R, cz = -Math.cos(a) * RING_R
        m.compose(pp.set(cx, 0, cz), q, sc.set(1, 1, 1)); frames.setMatrixAt(ui, m)
        for (const b of books[ui]) {
          const local = new THREE.Vector3(b.x, b.y, b.z).applyQuaternion(q)
          m.compose(pp.set(cx + local.x, local.y, cz + local.z), q, sc.set(b.w, b.h, b.d)); spines.setMatrixAt(bi, m)
          const base = b.c >= 200 ? [0.62, 0.55, 0.40] : b.c >= 100 ? BOXES[b.c - 100] : SPINES[b.c]; const v = b.c >= 200 ? 1 : 0.7 + 0.6 * b.ph
          spines.setColorAt(bi, col.setRGB(base[0] * v, base[1] * v, base[2] * v)); bi++
        }
      })
      frames.instanceMatrix.needsUpdate = true; spines.instanceMatrix.needsUpdate = true; if (spines.instanceColor) spines.instanceColor.needsUpdate = true
      root.add(frames, spines)
      // ---- the pendant: a cord out of the top of the frame, a brass shade, a bulb glow, the cone of light, a pool of it on the table
      const brass = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.14, 0.07), metalness: 0.9, roughness: 0.34, envMap: k.env, envMapIntensity: 1.2, side: THREE.DoubleSide }), k.fog)
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 9, 6), fogify(new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.8 }), k.fog)); cord.position.set(0, LAMP_Y + 0.5 + 4.5, 0)
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.78, 0.5, 40, 1, true), brass); shade.position.set(0, LAMP_Y + 0.25, 0)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.84, 0.55), toneMapped: false })); bulb.position.set(0, LAMP_Y + 0.12, 0)
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.7, 0.34), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.setScalar(2.6); halo.position.set(0, LAMP_Y + 0.05, 0)
      cone = lightCone(k, { h: LAMP_Y - 0.4, r: 3.9, col: [1.0, 0.72, 0.38], I: 0.62, seed: 3 }); cone.mesh.position.set(0, LAMP_Y, 0)
      pool = glowPlane(k, { col: [1.0, 0.66, 0.3], size: 7.4, opacity: 0.32 }); pool.position.set(0, 0.014, 0)
      // the whole pendant hangs from the ceiling point and swings when a die is thrown
      lamp = new THREE.Group(); lamp.position.set(0, PIVOT_Y, 0)
      for (const o of [cord, shade, bulb, halo, cone.mesh]) { o.position.y -= PIVOT_Y; lamp.add(o) }
      root.add(lamp, pool)
      // ---- two candles on shelf boards, flickering
      for (const [a, s] of [[-0.62, 1], [0.78, 2]] as [number, number][]) {
        const cx = Math.sin(a) * (RING_R - 0.1), cz = -Math.cos(a) * (RING_R - 0.1), y = SHELVES[s] + 0.02
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.55, 0.42), toneMapped: false })); stub.position.set(cx, y + 0.15, cz)
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.62, 0.22), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); f.scale.setScalar(0.9); f.position.set(cx, y + 0.36, cz)
        const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.62, 0.22), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); w.scale.setScalar(3.4); w.position.copy(f.position)
        root.add(stub, f, w); flames.push({ s: f, ph: a * 7, base: 0.9 }, { s: w, ph: a * 7 + 1, base: 0.28 })
      }
      // ---- on the rug round the table: fanned cards (a blue back, a cream face with plain pips: nothing printed), a few stacks of tokens
      const cardGeo = new THREE.BoxGeometry(0.5, 0.012, 0.76)
      const side = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.52, 0.44), roughness: 0.8 }), k.fog)
      const backTex = canvasTex(128, 192, (g, w, h) => {
        g.fillStyle = '#1a2a52'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8c79a'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16)
        g.strokeStyle = 'rgba(216,199,154,0.55)'; g.lineWidth = 2
        for (let i = -h; i < w + h; i += 18) { g.beginPath(); g.moveTo(i, 14); g.lineTo(i + h, h - 14); g.stroke(); g.beginPath(); g.moveTo(i + h, 14); g.lineTo(i, h - 14); g.stroke() }
        g.fillStyle = '#1a2a52'; g.beginPath(); g.ellipse(w / 2, h / 2, 26, 38, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d8c79a'; g.lineWidth = 3; g.stroke()
      })
      const faceTex = canvasTex(128, 192, (g, w, h) => {
        g.fillStyle = '#efe6d0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9a77c'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12)
        const pips: [number, number][] = [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]]
        pips.forEach(([x, y], i) => { g.fillStyle = i % 2 ? '#a3302a' : '#17202f'; g.beginPath(); g.moveTo(x * w, y * h - 15); g.lineTo(x * w + 11, y * h); g.lineTo(x * w, y * h + 15); g.lineTo(x * w - 11, y * h); g.fill() })
      })
      const cardMat = (map: THREE.Texture) => fogify(new THREE.MeshStandardMaterial({ map, roughness: 0.62, envMap: k.env, envMapIntensity: 0.3 }), k.fog)
      const cards = new THREE.InstancedMesh(cardGeo, [side, side, cardMat(backTex), side, side, side], 26)
      const faces = new THREE.InstancedMesh(cardGeo, [side, side, cardMat(faceTex), side, side, side], 14)
      cards.frustumCulled = false; faces.frustumCulled = false
      const placeCards = (im: THREE.InstancedMesh, centers: [number, number, number][], per: number) => {
        let i = 0
        for (const [cx, cz, base] of centers) for (let j = 0; j < per && i < im.count; j++, i++) {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), base + (j - per / 2) * 0.24 + (R() - 0.5) * 0.08)
          m.compose(pp.set(cx + (R() - 0.5) * 0.06 + j * 0.09 * Math.cos(base), 0.008 + 0.0135 * j, cz + (R() - 0.5) * 0.06 + j * 0.09 * Math.sin(base)), q, sc.set(1, 1, 1)); im.setMatrixAt(i, m)
        }
        for (; i < im.count; i++) { m.compose(pp.set(0, -9, 0), q, sc.set(0, 0, 0)); im.setMatrixAt(i, m) }
        im.instanceMatrix.needsUpdate = true
      }
      sc.set(1, 1, 1)
      placeCards(cards, [[-3.7, 2.7, 0.5], [3.1, 3.4, -0.6], [-1.4, 4.3, 2.4], [4.2, -1.4, 1.1]], 6)
      placeCards(faces, [[2.0, 4.1, 0.3], [-4.2, -0.6, 2.0]], 6)
      const tokens = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.045, 22), fogify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.12, envMap: k.env, envMapIntensity: 0.8 }), k.fog), 30)
      tokens.frustumCulled = false
      const TOK: [number, number, number][] = [[0.75, 0.16, 0.12], [0.12, 0.45, 0.30], [0.16, 0.28, 0.72], [0.85, 0.66, 0.14], [0.78, 0.74, 0.66]]
      let ti = 0
      for (const [cx, cz, n] of [[-3.0, 3.7, 5], [2.5, 4.4, 4], [-4.3, 1.0, 5], [4.1, 1.6, 3], [0.6, 4.8, 4], [3.8, -2.4, 4]] as [number, number, number][]) {
        const c = TOK[Math.floor(R() * TOK.length)]
        for (let j = 0; j < n && ti < tokens.count; j++, ti++) {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6)
          m.compose(pp.set(cx + (R() - 0.5) * 0.025, 0.0235 + 0.047 * j, cz + (R() - 0.5) * 0.025), q, sc.set(1, 1, 1)); tokens.setMatrixAt(ti, m); tokens.setColorAt(ti, col.setRGB(c[0], c[1], c[2]))
        }
      }
      for (; ti < tokens.count; ti++) { m.compose(pp.set(0, -9, 0), q, sc.set(0, 0, 0)); tokens.setMatrixAt(ti, m) }
      tokens.instanceMatrix.needsUpdate = true; if (tokens.instanceColor) tokens.instanceColor.needsUpdate = true
      root.add(cards, faces, tokens)
      // ---- Blender props (lazy; a stand-in when the file is missing): a pile of lidded game boxes, a fan of cards, a stack of books
      const gp = await gameProps()
      const put = (name: string, mat: THREE.MeshStandardMaterial, x: number, z: number, yaw: number, scale = 1) => {
        const src = gp?.get(name); if (!src) return null
        const o = new THREE.Mesh(src.geometry, gp ? withAO(mat, { direct: 0.4 }) : mat); o.position.set(x, 0, z); o.rotation.y = yaw; o.scale.setScalar(scale); o.frustumCulled = false
        root.add(o); return o
      }
      const pm = (c: [number, number, number], rough = 0.62, metal = 0) => fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: rough, metalness: metal, envMap: k.env, envMapIntensity: 0.5 }), k.fog)
      if (gp) {
        put('boxstack', pm([0.10, 0.34, 0.35]), -4.9, 3.5, 0.5, 1.15); put('boxlid', pm([0.52, 0.17, 0.10]), -4.9, 3.5, 0.5, 1.15)
        put('boxstack', pm([0.45, 0.30, 0.08]), 5.1, -2.9, -0.7, 1.0); put('boxlid', pm([0.12, 0.2, 0.34]), 5.1, -2.9, -0.7, 1.0)
        put('cardfan', pm([0.9, 0.85, 0.7], 0.7), 1.1, 4.5, 2.7, 1.2)
        for (let i = 0; i < 4; i++) put('book' + i, pm([[0.5, 0.1, 0.1], [0.1, 0.27, 0.2], [0.12, 0.17, 0.4], [0.42, 0.3, 0.1]][i] as [number, number, number], 0.7), -5.3, -1.6, -0.9, 1.2)
        put('pages', pm([0.8, 0.74, 0.6], 0.9), -5.3, -1.6, -0.9, 1.2)
      } else {
        for (const [x, z, w, h] of [[-4.9, 3.5, 1.7, 0.4], [-4.88, 3.52, 1.4, 0.32], [5.1, -2.9, 1.5, 0.36]] as number[][]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7), pm(BOXES[Math.floor(R() * BOXES.length)])); b.position.set(x, h / 2 + (w === 1.4 ? 0.4 : 0), z); b.rotation.y = R() * 3; root.add(b)
        }
      }
      // ---- soft bokeh far behind the shelves, and the burst of sparks a thrown die sends up
      bk = bokeh(k, { n: 54, rMin: 9.2, rMax: 15, yMin: 0.6, yMax: 8.4, cols: [[1.0, 0.7, 0.34], [1.0, 0.54, 0.3], [0.9, 0.78, 0.5], [0.45, 0.8, 0.7], [0.9, 0.5, 0.6]], size: 70, seed: 17, arc: [-2.2, 2.2] })
      spark = burst(k, { n: 70, speed: 2.4, up: 4.6, g: 8, life: 1.7, size: 3.2, col: [1.0, 0.8, 0.45], alpha: 0.95, seed: 5 })
      root.add(bk.points, spark.points)
      dust = motes(k, { n: 110, at: [0, 0, 0], half: [3.6, 3.4], h: 4.2, col: [1.0, 0.82, 0.55], size: 2.2, speed: 0.07, sway: 0.4, seed: 9, alpha: 0.7 })
      root.add(dust.points)
    },
    update(t, _dt, r) {
      const rm = kit.reduced()
      const roll = rm ? 0 : since('rollAt', 2.6)
      if (!rm && roll > 0.97 && lastRoll <= 0.97) spark.fire([0, 0.6, 0])
      lastRoll = roll; spark.update()
      const fl = rm ? 1 : 0.94 + 0.06 * Math.sin(t * 1.1) + 0.02 * Math.sin(t * 3.7) + 0.22 * roll
      // the pendant swings out of a thrown die's shock and settles
      const age = 1 - roll; lamp.rotation.z = rm ? 0 : Math.sin(age * 9.0) * 0.07 * roll * roll; lamp.rotation.x = rm ? 0 : Math.cos(age * 7.0) * 0.03 * roll * roll
      cone.set(0.62 * fl)
      halo.material.opacity = Math.min(1, 0.8 * r * fl); (pool.material as THREE.MeshBasicMaterial).opacity = Math.min(0.6, 0.3 * r * fl)
      for (const f of flames) f.s.material.opacity = f.base * r * (rm ? 1 : 0.78 + 0.22 * Math.sin(t * 9 + f.ph) * Math.sin(t * 3.1 + f.ph * 2))
      bk.set(r, roll, t)
      dust.set(r, rm ? 0 : 1 + 2.4 * roll)
    },
    dispose() { dust?.dispose(); bk?.dispose(); spark?.dispose(); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } }) },
  }
}
