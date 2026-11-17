/* ============================================================
   Efeitos — pool único de partículas + anéis de impacto.
   ============================================================ */
import * as THREE from 'three'
import { G, rand, randInt } from './state.js'

const MAX = 1800
let points = null
let ringPool = []
let ringIdx = 0

const P = {
  pos: null, vel: null, col: null, size: null,
  life: null, maxLife: null, grav: null, drag: null, count: 0,
}

export function initEffects(scene) {
  const geo = new THREE.BufferGeometry()
  P.pos = new Float32Array(MAX * 3)
  P.vel = new Float32Array(MAX * 3)
  P.col = new Float32Array(MAX * 3)
  P.size = new Float32Array(MAX)
  P.life = new Float32Array(MAX)
  P.maxLife = new Float32Array(MAX)
  P.grav = new Float32Array(MAX)
  P.drag = new Float32Array(MAX)
  for (let i = 0; i < MAX; i++) { P.size[i] = 0; P.pos[i * 3 + 1] = -9999 }
  geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(P.col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor; attribute float aSize;
      varying vec3 vColor; varying float vFade;
      uniform float uTime;
      void main(){
        vColor = aColor;
        vFade = 1.0;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (220.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vFade;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.05, r);
        gl_FragColor = vec4(vColor, a);
      }`,
    uniforms: { uTime: { value: 0 } },
  })
  points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)

  const ringGeo = new THREE.RingGeometry(0.86, 1, 40)
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.visible = false
    m.userData = { t: 0, dur: 0, maxScale: 3 }
    scene.add(m)
    ringPool.push(m)
  }
}

function nextSlot() {
  for (let i = 0; i < MAX; i++) {
    const idx = (P.count + i) % MAX
    if (P.life[idx] <= 0) { P.count = (idx + 1) % MAX; return idx }
  }
  return P.count
}

function emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav, drag) {
  const i = nextSlot()
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz
  P.col[i * 3] = r; P.col[i * 3 + 1] = g; P.col[i * 3 + 2] = b
  P.size[i] = size; P.life[i] = life; P.maxLife[i] = life
  P.grav[i] = grav; P.drag[i] = drag
}

const PRESETS = {
  fire: { n: [4, 9], col: [[1, 0.55, 0.12], [1, 0.3, 0.05], [1, 0.8, 0.3]], spd: 2.2, up: 2.4, size: [0.1, 0.24], life: [0.4, 0.9], grav: 1.6, drag: 2.2 },
  smoke: { n: [2, 4], col: [[0.3, 0.3, 0.32], [0.2, 0.2, 0.22]], spd: 0.5, up: 1.1, size: [0.2, 0.4], life: [0.8, 1.6], grav: -0.4, drag: 1.2 },
  sparks: { n: [5, 10], col: [[1, 0.85, 0.4], [1, 0.6, 0.2]], spd: 5.5, up: 3.2, size: [0.05, 0.1], life: [0.25, 0.6], grav: 9, drag: 0.6 },
  frost: { n: [4, 8], col: [[0.6, 0.85, 1], [0.8, 0.95, 1]], spd: 2.8, up: 2, size: [0.07, 0.16], life: [0.4, 0.9], grav: 3.5, drag: 1 },
  water: { n: [4, 8], col: [[0.35, 0.65, 1], [0.55, 0.8, 1]], spd: 3, up: 2.4, size: [0.08, 0.18], life: [0.4, 0.8], grav: 6, drag: 0.8 },
  zap: { n: [3, 6], col: [[0.7, 0.85, 1], [0.5, 0.6, 1]], spd: 6, up: 1, size: [0.05, 0.12], life: [0.15, 0.35], grav: 0, drag: 3 },
  earth: { n: [5, 10], col: [[0.45, 0.32, 0.2], [0.6, 0.45, 0.3]], spd: 3.4, up: 3.6, size: [0.1, 0.24], life: [0.5, 1.1], grav: 9, drag: 0.5 },
  wind: { n: [4, 7], col: [[0.75, 0.9, 0.95], [0.9, 1, 1]], spd: 4, up: 0.6, size: [0.1, 0.2], life: [0.3, 0.7], grav: 0, drag: 1.6 },
  magic: { n: [3, 6], col: [[0.8, 0.6, 1], [1, 0.9, 0.5]], spd: 1.6, up: 1.6, size: [0.08, 0.2], life: [0.5, 1.1], grav: -0.5, drag: 1.5 },
  dust: { n: [2, 4], col: [[0.55, 0.5, 0.4], [0.45, 0.42, 0.35]], spd: 1, up: 0.8, size: [0.1, 0.22], life: [0.5, 1], grav: 1.5, drag: 2 },
  leaf: { n: [1, 3], col: [[0.35, 0.65, 0.25], [0.6, 0.75, 0.3]], spd: 0.6, up: -0.2, size: [0.08, 0.14], life: [1.5, 3], grav: 0.25, drag: 1 },
  heal: { n: [4, 8], col: [[0.4, 1, 0.6], [0.7, 1, 0.8]], spd: 0.8, up: 1.8, size: [0.08, 0.16], life: [0.7, 1.4], grav: -0.8, drag: 1 },
  blood: { n: [3, 6], col: [[0.6, 0.12, 0.12], [0.8, 0.2, 0.15]], spd: 3, up: 2, size: [0.07, 0.14], life: [0.3, 0.7], grav: 8, drag: 0.6 },
}

// pré-fabricados por elemento: [preset primário, cor do anel]
export const ELEM_FX = {
  Fogo: ['fire', 0xff7020], Água: ['water', 0x4090ff], Raio: ['zap', 0xaac8ff],
  Terra: ['earth', 0xb08a50], Vento: ['wind', 0xc0e8f0], Gelo: ['frost', 0x90d0ff],
}

export function burst(type, x, y, z, scale = 1, colorOverride = null) {
  if (!points) return
  const pr = PRESETS[type]
  if (!pr) return
  const n = randInt(pr.n[0], pr.n[1])
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2
    const e = Math.random() * 0.9
    const s = rand(pr.spd * 0.4, pr.spd) * scale
    const c = colorOverride ? colorOverride : pr.col[randInt(0, pr.col.length - 1)]
    const tint = colorOverride ? rand(0.75, 1.05) : 1
    emit(
      x + Math.cos(a) * 0.12, y + Math.random() * 0.3 * scale, z + Math.sin(a) * 0.12,
      Math.cos(a) * s * (1 - e * 0.5), (pr.up >= 0 ? pr.up : -pr.up * 0.4 + pr.up * 0) + Math.abs(pr.up) * e * 0.9 + (pr.up < 0 ? pr.up : 0), Math.sin(a) * s * (1 - e * 0.5),
      Math.min(1, c[0] * tint), Math.min(1, c[1] * tint), Math.min(1, c[2] * tint),
      rand(pr.size[0], pr.size[1]) * scale, rand(pr.life[0], pr.life[1]), pr.grav, pr.drag,
    )
  }
}

export function ring(x, y, z, color, maxScale = 3, dur = 0.45) {
  const m = ringPool[ringIdx]
  ringIdx = (ringIdx + 1) % ringPool.length
  m.position.set(x, y + 0.06, z)
  m.scale.setScalar(0.3)
  m.material.color.set(color)
  m.material.opacity = 0.85
  m.visible = true
  m.userData.t = 0; m.userData.dur = dur; m.userData.maxScale = maxScale
}

export function updateEffects(dt) {
  if (!points) return
  const pa = points.geometry.attributes
  for (let i = 0; i < MAX; i++) {
    if (P.life[i] <= 0) continue
    P.life[i] -= dt
    if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -9999; P.size[i] = 0; continue }
    const dr = Math.max(0, 1 - P.drag[i] * dt)
    P.vel[i * 3] *= dr; P.vel[i * 3 + 2] *= dr
    P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * dr - P.grav[i] * dt
    P.pos[i * 3] += P.vel[i * 3] * dt
    P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt
    P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt
    if (P.pos[i * 3 + 1] < 0.02 && P.grav[i] > 4) P.pos[i * 3 + 1] = 0.02
    P.size[i] *= 1 - dt * 0.6
  }
  pa.position.needsUpdate = true
  pa.aSize.needsUpdate = true
  pa.aColor.needsUpdate = true
  for (const m of ringPool) {
    if (!m.visible) continue
    m.userData.t += dt
    const k = m.userData.t / m.userData.dur
    if (k >= 1) { m.visible = false; continue }
    m.scale.setScalar(0.3 + m.userData.maxScale * k)
    m.material.opacity = 0.85 * (1 - k)
  }
}

export function elemBurst(elem, x, y, z, scale = 1) {
  const [type, col] = ELEM_FX[elem] || ['magic', 0xb080ff]
  burst(type, x, y, z, scale)
  if (scale > 1.2) ring(x, y - 0.05, z, col, scale * 2.4)
}
