// Travel moment 1: star streaks. Short additive line segments in a tube around the view axis, flowing past the camera; their length and
// brightness follow the flight's speed (nothing at rest, a slow warp at the peak of a long leg). Vertices are built in camera space in the
// shader (projection only), depth-tested so they stay behind the TVs and the particle field.
import * as THREE from 'three'
import { rng } from '../lib/flags'
import { U as SIGU } from '../../signals'

export function createWarp(phone: boolean) {
  const N = phone ? 150 : 320, r = rng(0xa11ce)
  const s3 = new Float32Array(N * 6), end = new Float32Array(N * 2), pos = new Float32Array(N * 6)   // pos: unused by the shader, three wants it for the vertex count
  for (let i = 0; i < N; i++) { const a = r(), b = r(), c = r(); for (let k = 0; k < 2; k++) { s3.set([a, b, c], (i * 2 + k) * 3); end[i * 2 + k] = k } }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s3, 3)); g.setAttribute('aE', new THREE.BufferAttribute(end, 1))
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTravel: { value: 0 }, uLen: { value: 0 }, uVis: { value: 0 }, uSgPtrC: SIGU.uSgPtrC, uSgMus: SIGU.uSgMus },
    vertexShader: `attribute vec3 aS; attribute float aE; uniform float uTravel, uLen, uVis; uniform vec4 uSgPtrC, uSgMus; varying float vA; varying vec3 vC;
      void main(){
        float L = 90.0, rad = 2.6 + pow(aS.x, 0.8) * 36.0, an = aS.y * 6.2831853;
        float z = -mod(aS.z * L - uTravel * (0.7 + 0.6 * aS.x), L);
        float len = uLen * (0.5 + aS.x);
        z -= len * aE; z = min(z, -0.4);
        vec3 p = vec3(cos(an) * rad, sin(an) * rad * 0.7, z);
        // v19: the pointer bends the streaks near it (a lens in view space: uSgPtrC.xy * depth is the pointer's line of sight, .z its presence)
        vec2 dd = p.xy - uSgPtrC.xy * -p.z; float pr = 0.16 * -p.z + 1.0, pg = exp(-dot(dd, dd) / (pr * pr)) * uSgPtrC.z;
        p.xy -= dd * pg * 0.55;
        float near = smoothstep(0.0, 6.0, -z) * smoothstep(L, L * 0.55, -z);
        vA = uVis * near * (1.0 - aE) * (0.35 + 0.65 * aS.y) * (1.0 + 1.2 * pg + 0.5 * uSgMus.x);
        vC = mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.88, 0.7), step(0.8, fract(aS.z * 7.0)));
        gl_Position = projectionMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * vA, 1.0); }' })
  const mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; mesh.renderOrder = -3; mesh.visible = false; mesh.userData.noReflect = true
  return {
    mesh,
    update(speed: number, dt: number, vis: number) {
      const s = Math.max(0, (speed - 0.28) / 0.72), v = vis * s * s * (3 - 2 * s)
      mesh.visible = v > 0.01
      if (!mesh.visible) return
      m.uniforms.uTravel.value += (6 + speed * 70) * dt; m.uniforms.uLen.value = 0.8 + speed * 11; m.uniforms.uVis.value = v * 0.5
    },
    dispose() { g.dispose(); m.dispose(); mesh.removeFromParent() },
  }
}
