/* ============================================================
   Câmera — terceira pessoa, independente do movimento.
   Botão direito + mouse controlam; roda dá zoom; colisão com paredes.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, damp, smoothstep } from './state.js'
import { Input, mouse, touch } from './input.js'
import { pointBlocked } from './state.js'

export function createCameraRig() {
  const rig = {
    yaw: Math.PI, pitch: 0.28, dist: 5.2, targetDist: 5.2,
    pos: new THREE.Vector3(0, 3, 8), look: new THREE.Vector3(),
    shackleT: 0,
  }
  G.cameraRig = rig
  return rig
}

export function updateCamera(rig, dt) {
  const p = G.player
  if (!p) return
  const sens = 0.0028 * G.settings.sensitivity

  // ----- rotação: botão direito + mouse (ou área de toque) -----
  let rotX = 0, rotY = 0
  if (mouse.buttons[2] || !touch.active) {
    // sem toque: botão direito arrasta; com toque, área direita controla
    if (mouse.buttons[2]) { rotX = mouse.dx * sens; rotY = mouse.dy * sens }
  }
  if (touch.active) { rotX += touch.lookDx * 0.005 * G.settings.sensitivity; rotY += touch.lookDy * 0.005 * G.settings.sensitivity }
  if (G.settings.invertY) rotY = -rotY

  rig.yaw -= rotX
  rig.pitch = clamp(rig.pitch + rotY, -0.55, 1.15)

  // ----- zoom -----
  const wheel = Input.takeWheel()
  if (wheel) rig.targetDist = clamp(rig.targetDist + wheel * 0.7, 2.2, 11)
  rig.dist = damp(rig.dist, rig.targetDist, 8, dt)

  // ----- alvo -----
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.55, p.pos.z)
  const back = new THREE.Vector3(
    Math.sin(rig.yaw) * Math.cos(rig.pitch),
    Math.sin(rig.pitch),
    Math.cos(rig.yaw) * Math.cos(rig.pitch),
  )

  // colisão: aproxima a câmera se algo bloquear
  let dist = rig.dist
  const steps = 8
  for (let i = 1; i <= steps; i++) {
    const d = (dist * i) / steps
    const px = target.x + back.x * d
    const py = target.y + back.y * d + 0.25
    const pz = target.z + back.z * d
    if (pointBlocked(px, py, pz, 0.4)) { dist = Math.max(1.2, (dist * (i - 1)) / steps); break }
  }
  const minY = G.worldApi ? G.worldApi.heightAt(target.x + back.x * dist, target.z + back.z * dist) + 0.35 : 0.3
  const camPos = new THREE.Vector3(target.x + back.x * dist, target.y + back.y * dist + 0.25, target.z + back.z * dist)
  if (camPos.y < minY) camPos.y = minY

  // suavização cinematográfica
  const speed = p.dodgeT > 0 ? 20 : 14
  rig.pos.x = damp(rig.pos.x, camPos.x, speed, dt)
  rig.pos.y = damp(rig.pos.y, camPos.y, speed, dt)
  rig.pos.z = damp(rig.pos.z, camPos.z, speed, dt)
  rig.look.x = damp(rig.look.x, target.x, 18, dt)
  rig.look.y = damp(rig.look.y, target.y, 18, dt)
  rig.look.z = damp(rig.look.z, target.z, 18, dt)

  const cam = G.camera
  cam.position.copy(rig.pos)
  cam.lookAt(rig.look)
}

// vetor "para frente" da câmera no plano XZ (para mira)
export function cameraForward() {
  const rig = G.cameraRig
  return { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) }
}
