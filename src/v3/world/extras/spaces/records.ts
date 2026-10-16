// SPACE "records": a listening room. A curved wall of record spines (thin boxes in muted colour blocks: NO art, NO text) stands behind the turntable, a floor lamp
// throws a warm wash across it, the floor is dark boards with a pool under the deck. While a record plays the wall's wash takes the song's colour and breathes with
// the bass (read from window.__vibe, extras/vibe.ts: read only).
// v19 (unit 15M): a real listening room. A walnut credenza under a lancet window (stone, tracery, wine velvet curtains, a dusk pane) carries a valve amplifier with backlit VU
// meters and a speaker stands at each end; a woven rug lies under the deck; and while a record plays the room performs (musicviz/room.ts: wall-wide equaliser in the spines, the
// frequency landscape on the floor, sweeping beams, pumping woofers, the lamp and the pane taking the song's colours). All of it fades back to calm when the record stops.
import * as THREE from 'three'
import { glowTexture } from '../cabinet/kit'
import { fogify, glowPlane, groundMesh, lcg, motes, type LightCfg, type Motes, type Space, type SpaceKit } from './common'
import { MUSIC, pump } from '../musicviz/bus'
import { createRoom, wallGlow, type Room } from '../musicviz/room'

const WALL_R = 6.8, SPAN = 66 * Math.PI / 180, ROWS = 5, ROW_H = 1.28, ROW_Y0 = 0.32, SPINE_H = 1.0
const BLOCKS: [number, number, number][] = [[0.55, 0.28, 0.20], [0.62, 0.46, 0.20], [0.34, 0.37, 0.20], [0.22, 0.30, 0.40], [0.66, 0.62, 0.52], [0.34, 0.20, 0.28], [0.20, 0.36, 0.36], [0.46, 0.20, 0.12]]
const LAMP = { a: -38 * Math.PI / 180, x: -4.0, z: -1.9 }       // the floor lamp stands left of the deck: the copy lane is on the right

export function createRecordsSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-records'
  let kit: SpaceKit, dust: Motes, washL: THREE.Mesh, washC: THREE.Mesh, floorL: THREE.Mesh, floorD: THREE.Mesh, lampHalo: THREE.Sprite, lampShade: THREE.MeshBasicMaterial
  const tint = new THREE.Color(1.0, 0.74, 0.42), BASE = new THREE.Color(1.0, 0.72, 0.4), cTint = new THREE.Color(), cLamp = new THREE.Color()
  let tintK = 0, nSp = 0, room: Room | null = null
  const wall = wallGlow()
  const light: LightCfg = {
    keyPos: [-4.0, 5.6, -1.4], keyAim: [0.4, 0.8, 0.2], keyCol: [1.0, 0.78, 0.5], keyI: 44, keyAngle: 0.78, keyPen: 0.8, keyDist: 20,
    rimPos: [6.2, 4.0, 0.6], rimCol: [1.0, 0.3, 0.68], rimI: 9, rimDist: 14,
    fillSky: [1.0, 0.72, 0.45], fillGround: [0.1, 0.06, 0.04], fillI: 0.2,
  }
  const toward = (a: number, radius: number, y: number, o: THREE.Object3D) => { o.position.set(Math.sin(a) * radius, y, -Math.cos(a) * radius); o.rotation.y = -a }
  return {
    id: 'records', root, light,
    async build(k) {
      kit = k
      root.add(groundMesh(k, {
        frag: /* glsl */ `
          vec4 ground(vec2 p, float r) {
            float plank = floor((p.x + 30.0) / 0.55); float seam = smoothstep(0.014, 0.0, abs(fract((p.x + 30.0) / 0.55) - 0.5) - 0.485);
            float grain = fbm(vec2(p.y * 0.8 + h11(plank) * 20.0, p.x * 9.0)) ;
            vec3 col = vec3(0.030, 0.019, 0.013) * (0.55 + 0.9 * grain) * (0.75 + 0.5 * h11(plank)) * (1.0 - 0.55 * seam);
            vec2 d = p - vec2(0.0, 0.1); col *= 0.35 + 0.9 * exp(-dot(d, d) / 10.0);
            vec2 l = p - vec2(-4.0, -1.9); col += vec3(1.0, 0.6, 0.28) * exp(-dot(l, l) / 5.5) * 0.045;
            // a woven rug under the deck: a wine field, a teal band, an ochre border, a fringe of thin lines (the pedestal hides its middle)
            vec2 rp = p - vec2(0.0, 0.1); float rr = length(rp), rw = 0.5 + 0.5 * sin(rp.x * 90.0) * sin(rp.y * 90.0);
            float rug = 1.0 - smoothstep(4.45, 4.55, rr);
            vec3 rc = vec3(0.17, 0.035, 0.05);
            rc = mix(rc, vec3(0.04, 0.17, 0.17), smoothstep(0.012, 0.0, abs(rr - 4.05) - 0.16));
            rc = mix(rc, vec3(0.34, 0.2, 0.06), smoothstep(0.012, 0.0, abs(rr - 4.38) - 0.05) + smoothstep(0.012, 0.0, abs(rr - 3.82) - 0.03));
            rc += 0.04 * sin(atan(rp.y, rp.x) * 40.0 + rr * 6.0) * smoothstep(3.7, 4.3, rr);
            rc *= (0.7 + 0.5 * rw) * (0.6 + 0.9 * fbm(rp * 4.0)) * (0.55 + 0.9 * exp(-dot(rp, rp) / 14.0));
            col = mix(col, rc * 0.62, rug * 0.95);
            return vec4(col, 1.0);
          }`,
      }))
      // ---- the wall: shelves and dividers (instanced boards), then the spines (instanced boxes, one colour each)
      const board = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.04, 0.03), roughness: 0.6, envMap: k.env, envMapIntensity: 0.3 }), k.fog)
      const spineMat = wall.patch(fogify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, envMap: k.env, envMapIntensity: 0.22 }), k.fog))
      const R = lcg(77)
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0)
      const bays = 8, bayA = (2 * SPAN) / bays
      const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), board, ROWS * bays + (bays + 1) * ROWS + 2); boards.frustumCulled = false
      const spines: { a: number; y: number; w: number; h: number; z: number; c: [number, number, number] }[] = []
      let bi = 0
      for (let row = 0; row < ROWS; row++) {
        const y0 = ROW_Y0 + row * ROW_H
        for (let b = 0; b < bays; b++) {
          const a0 = -SPAN + b * bayA, a1 = a0 + bayA, am = (a0 + a1) / 2, len = WALL_R * (a1 - a0)
          if (row >= 1 && (b === 4 || b === 5)) continue                  // the window opens in these two bays (musicviz/room.ts)
          // the shelf board under the bay (a chord: close enough over this arc)
          q.setFromAxisAngle(UP, -am); m.compose(p.set(Math.sin(am) * (WALL_R + 0.1), y0 - 0.03, -Math.cos(am) * (WALL_R + 0.1)), q, s.set(len * 1.01, 0.06, 0.9)); boards.setMatrixAt(bi++, m)
          // spines across the bay, in colour blocks
          let a = a0 + 0.02 / WALL_R, runLeft = 0, blk = BLOCKS[0], bright = 1
          const end = a1 - 0.02 / WALL_R, gapAt = R() < 0.4 ? a0 + (a1 - a0) * (0.55 + 0.4 * R()) : 9
          while (a < end) {
            if (runLeft <= 0) { runLeft = 6 + Math.floor(R() * 16); blk = BLOCKS[Math.floor(R() * BLOCKS.length)]; bright = 0.82 + 0.3 * R() }
            const w = 0.05 + R() * 0.06, aw = w / WALL_R
            if (a + aw > end) break
            if (a > gapAt && a < gapAt + 0.9 / WALL_R) { a += aw; continue }                // a gap where a few records have been taken out
            const v = bright * (0.9 + 0.2 * R()), h = SPINE_H * (0.93 + 0.07 * R())
            spines.push({ a: a + aw / 2, y: y0 + h / 2, w: w, h, z: (R() < 0.12 ? 0.05 + 0.08 * R() : 0.0), c: [blk[0] * v, blk[1] * v, blk[2] * v] })
            a += aw; runLeft--
          }
        }
        for (let b = 0; b <= bays; b++) {
          if (row >= 1 && b === 5) continue
          const a = -SPAN + b * bayA
          q.setFromAxisAngle(UP, -a); m.compose(p.set(Math.sin(a) * (WALL_R + 0.1), y0 + ROW_H / 2 - 0.03, -Math.cos(a) * (WALL_R + 0.1)), q, s.set(0.06, ROW_H, 0.9)); boards.setMatrixAt(bi++, m)
        }
      }
      // the top board
      q.setFromAxisAngle(UP, 0); m.compose(p.set(0, ROW_Y0 + ROWS * ROW_H - 0.03, -(WALL_R + 0.1) * 0.93), q, s.set(WALL_R * 2 * Math.sin(SPAN), 0.07, 0.9)); boards.setMatrixAt(bi++, m)
      boards.count = bi; boards.instanceMatrix.needsUpdate = true
      nSp = spines.length
      const sp = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), spineMat, nSp); sp.frustumCulled = false
      spines.forEach((x, i) => {
        q.setFromAxisAngle(UP, -x.a); m.compose(p.set(Math.sin(x.a) * (WALL_R - x.z), x.y, -Math.cos(x.a) * (WALL_R - x.z)), q, s.set(x.w, x.h, 0.62)); sp.setMatrixAt(i, m); sp.setColorAt(i, col.setRGB(...x.c))
      })
      sp.instanceMatrix.needsUpdate = true; if (sp.instanceColor) sp.instanceColor.needsUpdate = true
      root.add(boards, sp)
      // ---- the floor lamp: a weighted foot, a thin brass pole, a drum shade that glows from inside
      const brass = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.22, 0.1), metalness: 1, roughness: 0.3, envMap: k.env, envMapIntensity: 1.4 }), k.fog)
      const lx = LAMP.x, lz = LAMP.z
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.07, 36), brass); foot.position.set(lx, 0.035, lz)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 4.5, 10), brass); pole.position.set(lx, 2.3, lz)
      lampShade = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.74, 0.42), side: THREE.DoubleSide, toneMapped: false }); const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.88, 0.98, 40, 1, true), lampShade); shade.position.set(lx, 5.05, lz)
      lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.74, 0.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); lampHalo.scale.setScalar(4.2); lampHalo.position.set(lx, 5.0, lz)
      root.add(foot, pole, shade, lampHalo)
      // ---- the warm wash on the wall (the lamp's, and a broad one behind the deck), a pool under the lamp, a pool under the deck
      const mk = (o: Parameters<typeof glowPlane>[1]) => { const g = glowPlane(k, { ...o, col: [1, 1, 1] }); return g }
      washL = mk({ col: [1, 1, 1], size: [8.5, 6.5], opacity: 0.5, standing: true }); toward(LAMP.a, WALL_R - 0.12, 3.5, washL)
      washC = mk({ col: [1, 1, 1], size: [11, 6.6], opacity: 0.26, standing: true }); toward(0, WALL_R - 0.12, 3.2, washC)
      floorL = mk({ col: [1, 1, 1], size: 6.4, opacity: 0.38 }); floorL.position.set(lx, 0.012, lz)
      floorD = mk({ col: [1, 1, 1], size: 9, opacity: 0.3 }); floorD.position.set(0, 0.013, 0.1)
      root.add(washL, washC, floorL, floorD)
      dust = motes(k, { n: 70, at: [-0.5, 0, -1.0], half: [4.6, 3.2], h: 4.6, col: [1.0, 0.8, 0.55], size: 2.0, speed: 0.06, sway: 0.4, seed: 21, alpha: 0.55 })
      root.add(dust.points)
      room = await createRoom(k, root, wall)
      ;(window as unknown as { __musicviz?: unknown }).__musicviz = { info: () => ({ ...room?.info(), k: +MUSIC.k.toFixed(2), beats: MUSIC.beats, snares: MUSIC.snares, real: MUSIC.real, level: +MUSIC.level.toFixed(2), vu: [+MUSIC.vuL.toFixed(2), +MUSIC.vuR.toFixed(2)], spec: Array.from(MUSIC.spec).filter((_, i) => i % 6 === 0).map(v => +v.toFixed(2)) }) }
    },
    update(t, dt, r) {
      const rm = kit.reduced(), M = pump()
      const kk = M.k, bass = M.bass
      tintK += (kk - tintK) * Math.min(1, dt * 3)
      if (kk > 0.02) tint.copy(M.pal[2])
      cTint.copy(BASE).lerp(tint, tintK * 0.85); cLamp.copy(BASE).lerp(cTint, tintK * 0.3)
      const pump_ = rm ? 0 : tintK * (0.45 * bass + 0.5 * M.beat + M.mood.flick * M.snare)
      const br = r * (1 + 0.7 * pump_ + 0.03 * (rm ? 0 : Math.sin(t * 0.8)))
      for (const [m, o] of [[washL, 0.5], [washC, 0.26], [floorL, 0.38], [floorD, 0.3]] as [THREE.Mesh, number][]) {
        const mat = m.material as THREE.MeshBasicMaterial, broad = m === washC || m === floorD
        mat.opacity = o * br * (broad ? 1 : 1 - 0.3 * tintK)
        mat.color.copy(broad ? cTint : cLamp)
      }
      // the lamp breathes with the bass and lends the shade the song's colour
      lampHalo.material.opacity = Math.min(1, 0.85 * r * (1 + 0.55 * pump_)); lampHalo.scale.setScalar(4.2 * (1 + 0.22 * pump_))
      ;(lampHalo.material as THREE.SpriteMaterial).color.copy(cLamp).multiplyScalar(1 / Math.max(0.2, Math.max(cLamp.r, cLamp.g, cLamp.b)))
      lampShade.color.copy(cLamp).multiplyScalar(1 + 0.6 * pump_)
      dust.set(r, rm ? 0 : 1 + 0.8 * tintK * M.level)
      room?.update(t, dt, r, M, rm)
    },
    info: () => ({ spines: nSp, tint: +tintK.toFixed(2) }),
    dispose() { room?.dispose(); wall.dispose(); dust?.dispose(); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } }) },
  }
}
