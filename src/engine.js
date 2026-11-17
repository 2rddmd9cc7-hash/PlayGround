/* ============================================================
   Motor — renderer, céu, ciclo dia/noite, luzes e fogueiras.
   ============================================================ */
import * as THREE from 'three'
import { G, lerp, clamp, smoothstep, damp } from './state.js'
import { burst } from './effects.js'
import { applyVolumes, updateMusic } from './audio.js'

export let renderer, scene, camera, sunLight, hemiLight, moonLight
let sunMesh, moonMesh, stars, starMat
let fog
let pitTimer = 0
const DAY_SECONDS = 720 // 1 dia completo = 12 min reais
const SKY_KEYS = [
  { h: 0, sky: 0x070b18, fogc: 0x0a0f1e, sun: 0x000000, sunI: 0, hemiI: 0.16, amb: 0.3 },
  { h: 4.6, sky: 0x0a1024, fogc: 0x101630, sun: 0x201030, sunI: 0, hemiI: 0.18, amb: 0.32 },
  { h: 6.2, sky: 0xd88a4a, fogc: 0xc88a60, sun: 0xff9a50, sunI: 0.9, hemiI: 0.5, amb: 0.6 },
  { h: 8, sky: 0x9fc4e8, fogc: 0xbccfe4, sun: 0xfff0d8, sunI: 1.7, hemiI: 0.75, amb: 0.95 },
  { h: 13, sky: 0x87b8e8, fogc: 0xb0c8e0, sun: 0xffffff, sunI: 2.1, hemiI: 0.9, amb: 1 },
  { h: 17.2, sky: 0xa8b8d8, fogc: 0xc0b8a8, sun: 0xffe8c0, sunI: 1.5, hemiI: 0.7, amb: 0.9 },
  { h: 18.8, sky: 0xd87038, fogc: 0xc07048, sun: 0xff8040, sunI: 0.8, hemiI: 0.45, amb: 0.55 },
  { h: 20.2, sky: 0x141c34, fogc: 0x1a2038, sun: 0x000000, sunI: 0, hemiI: 0.2, amb: 0.35 },
  { h: 24, sky: 0x070b18, fogc: 0x0a0f1e, sun: 0x000000, sunI: 0, hemiI: 0.16, amb: 0.3 },
]
const cA = new THREE.Color(), cB = new THREE.Color(), cOut = new THREE.Color()

export function initEngine(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87b8e8)
  fog = new THREE.Fog(0xb0c8e0, 60, 240)
  scene.fog = fog

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900)

  hemiLight = new THREE.HemisphereLight(0xbfd8ff, 0x5a6a4a, 0.9)
  scene.add(hemiLight)

  sunLight = new THREE.DirectionalLight(0xffffff, 2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  const sc = sunLight.shadow.camera
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 260
  sunLight.shadow.bias = -0.0006
  scene.add(sunLight); scene.add(sunLight.target)

  moonLight = new THREE.DirectionalLight(0x8090c0, 0.25)
  scene.add(moonLight); scene.add(moonLight.target)

  // sol e lua visíveis
  const sunGeo = new THREE.SphereGeometry(9, 16, 16)
  sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }))
  scene.add(sunMesh)
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xd8e0f0, fog: false }))
  scene.add(moonMesh)

  // estrelas
  const starGeo = new THREE.BufferGeometry()
  const sp = new Float32Array(900 * 3)
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48
    const r = 420
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r
    sp[i * 3 + 1] = Math.sin(e) * r + 20
    sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  starMat = new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })
  stars = new THREE.Points(starGeo, starMat)
  stars.frustumCulled = false
  scene.add(stars)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}

export function isNight() { return G.hour < 5.8 || G.hour > 19.2 }

export function updateEnvironment(dt) {
  G.hour = (G.hour + (dt * 24) / DAY_SECONDS) % 24
  if (G.hour < dt * 24 / DAY_SECONDS) G.day++

  const h = G.hour
  let i = 0
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].h <= h) i++
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1]
  const t = clamp((h - a.h) / Math.max(0.01, b.h - a.h), 0, 1)

  cA.setHex(a.sky); cB.setHex(b.sky); cOut.copy(cA).lerp(cB, t)
  scene.background.copy(cOut)
  cA.setHex(a.fogc); cB.setHex(b.fogc); fog.color.copy(cA).lerp(cB, t)

  cA.setHex(a.sun); cB.setHex(b.sun)
  sunLight.color.copy(cA).lerp(cB, t)
  sunLight.intensity = lerp(a.sunI, b.sunI, t) * (G.settings.shadows === 'off' ? 1.15 : 1)
  hemiLight.intensity = lerp(a.hemiI, b.hemiI, t)

  // posição dos astros
  const dayT = (h - 6) / 12 // 0..1 durante o dia
  const ang = dayT * Math.PI
  const px = G.player ? G.player.pos.x : 0, pz = G.player ? G.player.pos.z : 0, py = G.player ? G.player.pos.y : 0
  const sunDir = new THREE.Vector3(Math.cos(ang) * 0.7, Math.sin(ang), -0.35).normalize()
  sunLight.position.set(px + sunDir.x * 110, py + sunDir.y * 110, pz + sunDir.z * 110)
  sunLight.target.position.set(px, py, pz)
  sunMesh.position.set(px + sunDir.x * 380, py + sunDir.y * 380 - 30, pz + sunDir.z * 380)
  sunMesh.visible = sunDir.y > -0.12

  const mAng = ang + Math.PI
  const mDir = new THREE.Vector3(Math.cos(mAng) * 0.7, Math.sin(mAng), -0.3).normalize()
  moonLight.position.set(px + mDir.x * 100, py + Math.max(20, mDir.y * 100), pz + mDir.z * 100)
  moonLight.target.position.set(px, py, pz)
  moonLight.intensity = isNight() ? 0.32 : 0
  moonMesh.position.set(px + mDir.x * 360, py + mDir.y * 360 - 20, pz + mDir.z * 360)
  moonMesh.visible = mDir.y > -0.12

  starMat.opacity = smoothstep(19.2, 20.6, h) + smoothstep(5.6, 4.4, h) * 0.9
  stars.position.set(px, 0, pz)

  // fogueiras/tochas — partículas + luz do nearest
  pitTimer -= dt
  const near = []
  for (const p of G.firePits) {
    const d = Math.hypot(p.x - px, p.z - pz)
    if (d < 70) near.push({ p, d })
  }
  near.sort((m, n) => m.d - n.d)
  for (let k = 0; k < near.length; k++) {
    const p = near[k].p
    if (p.light) p.light.intensity = k < 9 && (isNight() || p.fx === 'water') ? (p.fx === 'water' ? 0.7 : 1.5) : k < 9 ? 0.35 : 0
    if (k < 6 && pitTimer <= 0 && !p.lamp) {
      burst(p.fx || 'fire', p.x, p.y, p.z, p.fx === 'water' ? 0.9 : 0.55)
      if (p.fx !== 'water' && Math.random() < 0.3) burst('smoke', p.x, p.y + 0.4, p.z, 0.5)
    }
  }
  if (pitTimer <= 0) pitTimer = 0.16
  updateMusic(dt)
  applyVolumes()
}

export function shadowMode() {
  if (G.settings.shadows === 'off' && renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = false
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true })
  } else if (G.settings.shadows !== 'off' && !renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = true
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true })
  }
}
