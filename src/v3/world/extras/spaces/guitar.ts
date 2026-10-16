// SPACE "guitar": a small stage. A low black riser with a lit front edge, ONE spotlight cone from above with dust turning in it, folds of dark velvet curtain behind
// and to both sides, an amp that is only a silhouette (its edges catch the rim light, a single pilot lamp glows). The guitar itself stands upright on a stand (cabinet/guitar.ts).
import * as THREE from 'three'
import { canvasTex, glowTexture } from '../cabinet/kit'
import { fogify, glowPlane, groundMesh, lightCone, motes, type Cone, type LightCfg, type Motes, type Space, type SpaceKit } from './common'

export const RISER = { w: 7.4, h: 0.36, z0: -3.0, z1: 2.0 }

export function createGuitarSpace(): Space {
  const root = new THREE.Group(); root.name = 'space-guitar'
  root.userData.contactShadow = { size: 3.2, opacity: 0.55 }   // the render package draws a soft contact shadow under the stage (shared contract)
  let kit: SpaceKit, cone: Cone, dust: Motes, pool: THREE.Mesh, edge: THREE.Mesh, edgeGlow: THREE.Mesh, edgeFloor: THREE.Mesh, pilot: THREE.Sprite
  const light: LightCfg = {
    keyPos: [0.3, 8.0, 1.4], keyAim: [0, 1.7, 0], keyCol: [1.0, 0.92, 0.8], keyI: 105, keyAngle: 0.36, keyPen: 0.6, keyDist: 24,
    rimPos: [3.6, 3.4, -3.4], rimCol: [1.0, 0.7, 0.24], rimI: 60, rimDist: 14,
    fillSky: [0.9, 0.55, 0.35], fillGround: [0.05, 0.03, 0.03], fillI: 0.06,
  }
  const velvet = (k: SpaceKit, w: number, h: number, x: number, z: number, yaw: number, amp: number, freq: number, seed: number) => {
    const g = new THREE.PlaneGeometry(w, h, Math.round(w * 14), 1)
    const P = g.getAttribute('position')
    for (let i = 0; i < P.count; i++) {
      const u = P.getX(i)
      P.setZ(i, amp * Math.sin(u * freq + seed) + amp * 0.45 * Math.sin(u * freq * 2.3 + seed * 1.7) - 0.012 * u * u)
    }
    g.translate(0, h / 2, 0); g.computeVertexNormals()
    const m = new THREE.Mesh(g, fogify(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.05, 0.018, 0.024), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.26, 0.1, 0.1), envMap: k.env, envMapIntensity: 0.2, side: THREE.DoubleSide }), k.fog))
    m.position.set(x, 0, z); m.rotation.y = yaw
    return m
  }
  return {
    id: 'guitar', root, light,
    build(k) {
      kit = k
      root.add(groundMesh(k, {
        frag: /* glsl */ `
          vec4 ground(vec2 p, float r) {
            vec3 col = vec3(0.012, 0.011, 0.012) * (0.7 + 0.6 * fbm(p * 2.2));
            vec2 d = p - vec2(0.0, 2.9); col += vec3(1.0, 0.66, 0.26) * exp(-dot(d * vec2(0.5, 1.0), d * vec2(0.5, 1.0)) / 2.2) * 0.07;   // the front edge's wash on the floor
            return vec4(col, 1.0);
          }`,
      }))
      // ---- the riser: black boards, a strip of gaffer tape where the stand goes, the lit front lip
      const top = canvasTex(512, 384, (g, w, h) => {
        g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, w, h)
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#0e0e0f' : '#090909'; g.fillRect(0, (i / 9) * h, w, h / 9) }
        g.fillStyle = 'rgba(0,0,0,0.9)'; for (let i = 1; i < 9; i++) g.fillRect(0, (i / 9) * h - 1, w, 2)
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.025).toFixed(3)})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1) }
        const cx = w * 0.5, cy = h * 0.62                                                    // gaffer tape: the mark the stand stands on
        g.save(); g.translate(cx, cy); g.fillStyle = 'rgba(200,196,180,0.55)'; g.rotate(0.7); g.fillRect(-26, -3, 52, 6); g.rotate(-1.4); g.fillRect(-26, -3, 52, 6); g.restore()
      })
      const riserMat = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.9, 0.9), map: top, roughness: 0.5, envMap: k.env, envMapIntensity: 0.55 }), k.fog)
      const sideMat = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.034, 0.036), roughness: 0.6, envMap: k.env, envMapIntensity: 0.3 }), k.fog)
      const dz = RISER.z1 - RISER.z0
      const riser = new THREE.Mesh(new THREE.BoxGeometry(RISER.w, RISER.h, dz), [sideMat, sideMat, riserMat, sideMat, sideMat, sideMat])
      riser.position.set(0, RISER.h / 2, (RISER.z0 + RISER.z1) / 2)
      // the lit front lip: a thin warm strip along the front edge
      edge = new THREE.Mesh(new THREE.BoxGeometry(RISER.w + 0.04, 0.035, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.3), toneMapped: false }))
      edge.position.set(0, RISER.h - 0.012, RISER.z1 + 0.012)
      edgeGlow = glowPlane(k, { col: [1.0, 0.66, 0.26], size: [RISER.w + 2.5, 0.9], opacity: 0.6, standing: true }); edgeGlow.position.set(0, RISER.h - 0.1, RISER.z1 + 0.05)
      edgeFloor = glowPlane(k, { col: [1.0, 0.62, 0.24], size: [RISER.w + 3.5, 2.4], opacity: 0.42 }); edgeFloor.position.set(0, 0.011, RISER.z1 + 0.7)
      pool = glowPlane(k, { col: [1.0, 0.88, 0.7], size: 5.2, opacity: 0.4 }); pool.position.set(0, RISER.h + 0.006, 0.1)
      root.add(riser, edge, edgeGlow, edgeFloor, pool)
      // ---- curtains: a long back drape and two heavy wings, folds from sine sums, dark velvet with a sheen the rim light can find
      root.add(velvet(k, 15.4, 8.8, 0, -5.55, 0, 0.34, 2.3, 1.0))
      root.add(velvet(k, 3.6, 8.8, -6.0, -2.7, 0.62, 0.28, 2.9, 3.0), velvet(k, 3.6, 8.8, 6.0, -2.7, -0.62, 0.28, 2.9, 5.0))
      // ---- the amp: a closed back combo seen from the front-left, grille cloth, a control strip, one pilot lamp
      const grille = canvasTex(256, 192, (g, w, h) => {
        g.fillStyle = '#0d0c0c'; g.fillRect(0, 0, w, h)
        g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1
        for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
        for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
      }, { repeat: false })
      const amp = new THREE.Group(); amp.position.set(-2.55, RISER.h, -1.95); amp.rotation.y = 0.42
      const vinyl = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.022, 0.021, 0.022), roughness: 0.58, envMap: k.env, envMapIntensity: 0.5 }), k.fog)
      const cloth = fogify(new THREE.MeshStandardMaterial({ map: grille, roughness: 0.9, envMap: k.env, envMapIntensity: 0.15 }), k.fog)
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.86), [vinyl, vinyl, vinyl, vinyl, cloth, vinyl]); cab.position.y = 0.75
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.05), fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.045, 0.04), roughness: 0.4, metalness: 0.5, envMap: k.env, envMapIntensity: 0.9 }), k.fog)); strip.position.set(0, 1.4, 0.44)
      const knobMat = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1, 0.09, 0.08), metalness: 0.8, roughness: 0.3, envMap: k.env, envMapIntensity: 1.1 }), k.fog)
      for (let i = 0; i < 5; i++) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 14), knobMat); kn.rotation.x = Math.PI / 2; kn.position.set(-0.7 + i * 0.28, 1.4, 0.49); amp.add(kn) }
      pilot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(1, 0.5, 0.15), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); pilot.scale.setScalar(0.34); pilot.position.set(0.82, 1.4, 0.5)
      const corner = fogify(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.5, 0.42), metalness: 1, roughness: 0.3, envMap: k.env, envMapIntensity: 1.4 }), k.fog)
      for (const [x, y] of [[-0.93, 0.03], [0.93, 0.03], [-0.93, 1.47], [0.93, 1.47]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), corner); c.position.set(x, y, 0); amp.add(c) }
      amp.add(cab, strip, pilot); root.add(amp)
      // ---- the one spotlight: a cone from above, dust in it
      cone = lightCone(k, { h: 7.7, r: 2.55, col: [1.0, 0.9, 0.74], I: 0.17, seed: 5 }); cone.mesh.position.set(0.3, 8.06, 1.4)
      cone.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.3, RISER.h - 8.06, -1.3).normalize())   // the cone opens along -y: turn that axis toward the stage
      dust = motes(k, { n: 120, at: [0.1, RISER.h, 0.4], half: [1.6, 1.4], h: 7.2, col: [1.0, 0.9, 0.75], size: 2.0, speed: 0.045, sway: 0.28, seed: 13, alpha: 0.7 })
      root.add(cone.mesh, dust.points)
    },
    update(t, _dt, r) {
      const rm = kit.reduced()
      const fl = rm ? 1 : 0.97 + 0.03 * Math.sin(t * 0.7)
      cone.set(0.17 * fl)
      ;(pool.material as THREE.MeshBasicMaterial).opacity = 0.4 * r * fl
      ;(edgeGlow.material as THREE.MeshBasicMaterial).opacity = 0.6 * r; (edgeFloor.material as THREE.MeshBasicMaterial).opacity = 0.42 * r
      ;(edge.material as THREE.MeshBasicMaterial).color.setRGB(1.0 * r, 0.7 * r, 0.3 * r)
      pilot.material.opacity = 0.9 * r * (rm ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2))
      dust.set(r, rm ? 0 : 1)
    },
    dispose() { dust?.dispose(); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; for (const x of Array.isArray(mm) ? mm : [mm]) x.dispose() } }) },
  }
}
