/* ============================================================
   Personagem — rig humanoide procedural + animações + física.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, damp, lerp, rand, angleDiff, resolveCircle, TAU } from './state.js'
import { groundAt } from './world.js'
import { Input, mouse } from './input.js'
import { sfx } from './audio.js'
import { burst, ring } from './effects.js'
import { damageEnemy, nearestEnemy } from './enemies.js'

const WALK = 4.4, RUN = 6.8, JUMP_V = 7.4, GRAV = 20

export function createPlayer(scene) {
  const rig = new THREE.Group()
  const parts = buildRig(rig)
  scene.add(rig)

  const p = {
    rig, parts,
    pos: new THREE.Vector3(0, 2, 10),
    vy: 0, yaw: Math.PI, moving: 0, grounded: true,
    // stats
    hp: 100, maxHp: 100, mp: 60, maxMp: 60, st: 100, maxSt: 100,
    level: 1, xp: 0, gold: 25, element: null,
    str: 10, def: 5, mag: 10, crit: 5,
    spellLevel: [1, 3, 6, 10],
    // estado de animação
    state: 'idle', stateT: 0, lockT: 0,
    attackType: null, attackPhase: 0, attackHitDone: false, comboIdx: 0, comboWindow: 0,
    castPhase: 0, pendingSpell: -1,
    // combate
    invuln: 0, dodgeT: 0, dodgeDir: new THREE.Vector3(), blocking: false,
    staggered: 0, dead: false, respawnT: 0,
    atkCd: 0, regenT: 0,
    interactTarget: null,
  }
  G.player = p
  return p
}

function buildRig(rig) {
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 })
  const cloth = new THREE.MeshLambertMaterial({ color: 0x3e5a8a })
  const pants = new THREE.MeshLambertMaterial({ color: 0x4a3a2c })
  const hairM = new THREE.MeshLambertMaterial({ color: 0x5a3a1e })
  const boot = new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.7, roughness: 0.35 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.4 })

  const mk = (geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const torso = mk(new THREE.BoxGeometry(0.52, 0.62, 0.3), cloth, 0, 1.28, 0)
  const belt = mk(new THREE.BoxGeometry(0.56, 0.09, 0.34), boot, 0, 0.98, 0)
  const chest = mk(new THREE.BoxGeometry(0.56, 0.3, 0.34), metal, 0, 1.42, 0) // peitoral
  const head = mk(new THREE.SphereGeometry(0.21, 10, 9), skin, 0, 1.78, 0)
  const hair = mk(new THREE.SphereGeometry(0.23, 10, 8), hairM, 0, 1.83, -0.03)
  hair.scale.set(1, 0.8, 1)
  const nose = mk(new THREE.BoxGeometry(0.05, 0.07, 0.06), skin, 0, 1.76, 0.21)

  // capa
  const cape = mk(new THREE.BoxGeometry(0.5, 0.75, 0.04), new THREE.MeshLambertMaterial({ color: 0x8a2830, side: THREE.DoubleSide }), 0, 1.22, -0.19)

  // braços (pivot no ombro)
  const armL = new THREE.Group(); armL.position.set(-0.33, 1.52, 0)
  armL.add(mk(new THREE.BoxGeometry(0.13, 0.42, 0.14), cloth, 0, -0.2, 0))
  armL.add(mk(new THREE.BoxGeometry(0.11, 0.36, 0.12), skin, 0, -0.58, 0))
  armL.add(mk(new THREE.BoxGeometry(0.13, 0.12, 0.13), skin, 0, -0.8, 0))
  const armR = new THREE.Group(); armR.position.set(0.33, 1.52, 0)
  armR.add(mk(new THREE.BoxGeometry(0.13, 0.42, 0.14), cloth, 0, -0.2, 0))
  armR.add(mk(new THREE.BoxGeometry(0.11, 0.36, 0.12), skin, 0, -0.58, 0))
  armR.add(mk(new THREE.BoxGeometry(0.13, 0.12, 0.13), skin, 0, -0.8, 0))
  // ombreiras
  armL.add(mk(new THREE.BoxGeometry(0.2, 0.12, 0.22), metal, 0, -0.02, 0))
  armR.add(mk(new THREE.BoxGeometry(0.2, 0.12, 0.22), metal, 0, -0.02, 0))

  // espada na mão direita
  const sword = new THREE.Group()
  sword.position.set(0, -0.86, 0.02)
  sword.add(mk(new THREE.BoxGeometry(0.045, 0.78, 0.015), metal, 0, -0.42, 0))
  sword.add(mk(new THREE.BoxGeometry(0.16, 0.05, 0.04), gold, 0, -0.02, 0))
  sword.add(mk(new THREE.BoxGeometry(0.04, 0.16, 0.04), boot, 0, 0.07, 0))
  sword.rotation.x = Math.PI // lâmina para baixo quando o braço pende
  armR.add(sword)

  // pernas (pivot no quadril)
  const legL = new THREE.Group(); legL.position.set(-0.15, 0.95, 0)
  legL.add(mk(new THREE.BoxGeometry(0.17, 0.6, 0.18), pants, 0, -0.3, 0))
  legL.add(mk(new THREE.BoxGeometry(0.18, 0.3, 0.2), boot, 0, -0.75, 0.02))
  const legR = new THREE.Group(); legR.position.set(0.15, 0.95, 0)
  legR.add(mk(new THREE.BoxGeometry(0.17, 0.6, 0.18), pants, 0, -0.3, 0))
  legR.add(mk(new THREE.BoxGeometry(0.18, 0.3, 0.2), boot, 0, -0.75, 0.02))

  rig.add(torso, belt, chest, head, hair, nose, cape, armL, armR, legL, legR)
  return { torso, head, hair, cape, armL, armR, legL, legR, sword, chest }
}

/* ---------- animação ---------- */
function ease(t) { return t * t * (3 - 2 * t) }

function pose(p, dt) {
  const t = p.stateT
  const pt = p.parts
  const moving = p.moving
  const spd = moving > 0.1 ? (p.sprinting ? RUN : WALK) : 0
  const walkT = t * (p.sprinting ? 11 : 8)

  // alvos padrão
  let aLx = 0, aLz = 0, aRx = 0, aRz = 0, lLx = 0, lRx = 0, torsoY = 0, torsoX = 0, capeRot = 0
  let rigRoll = 0

  if (p.dead) {
    const k = clamp(t / 1.2, 0, 1)
    rigRoll = -Math.PI / 2 * ease(k)
    torsoY = -0.6 * ease(k)
    aRx = 0.6; aLx = 0.4
  } else if (p.staggered > 0) {
    aRx = -0.9; aLx = -0.7; torsoX = -0.25
  } else if (p.dodgeT > 0) {
    const k = 1 - p.dodgeT / 0.42
    rigRoll = -ease(clamp(k * 1.4, 0, 1)) * TAU
    lLx = 1.2; lRx = 1.2; aRx = -1; aLx = 1
  } else if (p.attackType) {
    const ph = p.attackPhase
    if (p.attackType === 'slash1') {
      const w = clamp(ph / 0.32, 0, 1), s = clamp((ph - 0.32) / 0.3, 0, 1), r = clamp((ph - 0.62) / 0.38, 0, 1)
      if (s <= 0) { aRx = lerp(-0.4, -2.4, ease(w)); aRz = lerp(0, -0.7, ease(w)); torsoY = lerp(0, -0.5, ease(w)) }
      else if (r <= 0) { aRx = lerp(-2.4, 0.9, ease(s)); aRz = lerp(-0.7, 0.4, ease(s)); torsoY = lerp(-0.5, 0.45, ease(s)) }
      else { aRx = lerp(0.9, 0, ease(r)); aRz = lerp(0.4, 0, ease(r)); torsoY = lerp(0.45, 0, ease(r)) }
    } else if (p.attackType === 'slash2') {
      const w = clamp(ph / 0.28, 0, 1), s = clamp((ph - 0.28) / 0.26, 0, 1), r = clamp((ph - 0.54) / 0.4, 0, 1)
      if (s <= 0) { aRx = lerp(0, -1.6, ease(w)); aRz = lerp(0, 1, ease(w)); torsoY = lerp(0, 0.6, ease(w)) }
      else if (r <= 0) { aRx = lerp(-1.6, 0.7, ease(s)); aRz = lerp(1, -0.5, ease(s)); torsoY = lerp(0.6, -0.5, ease(s)) }
      else { aRx = lerp(0.7, 0, ease(r)); aRz = lerp(-0.5, 0, ease(r)); torsoY = lerp(-0.5, 0, ease(r)) }
    } else if (p.attackType === 'heavy') {
      const w = clamp(ph / 0.5, 0, 1), s = clamp((ph - 0.5) / 0.22, 0, 1), r = clamp((ph - 0.72) / 0.4, 0, 1)
      if (s <= 0) { aRx = lerp(0, -2.9, ease(w)); torsoX = lerp(0, -0.2, ease(w)); lLx = lerp(0, -0.3, w) }
      else if (r <= 0) { aRx = lerp(-2.9, 1.1, ease(s)); torsoX = lerp(-0.2, 0.35, ease(s)) }
      else { aRx = lerp(1.1, 0, ease(r)); torsoX = lerp(0.35, 0, ease(r)) }
    }
  } else if (p.castPhase > 0) {
    const k = clamp(1 - p.castPhase / 0.5, 0, 1)
    aRx = lerp(-2.6, -1.4, k); aLx = lerp(-2.6, -1.4, k); aRz = 0.5; aLz = -0.5
    torsoX = -0.1
  } else if (p.blocking) {
    aRx = -1.5; aRz = -0.6; aLx = -0.4
  } else if (!p.grounded) {
    aRx = -0.7; aLx = -0.7; lLx = p.vy > 0 ? 0.5 : 0.2; lRx = p.vy > 0 ? -0.2 : -0.1
  } else if (moving > 0.1) {
    const sw = Math.sin(walkT), sw2 = Math.sin(walkT + Math.PI)
    const amp = p.sprinting ? 0.85 : 0.55
    lLx = sw * amp; lRx = sw2 * amp
    aRx = sw2 * amp * 0.7; aLx = sw * amp * 0.7
    torsoY = sw * 0.06
  } else {
    aLx = Math.sin(t * 1.8) * 0.05
    aRx = Math.sin(t * 1.8 + 1) * 0.05
    torsoX = Math.sin(t * 2.2) * 0.02 + 0.02
  }

  const sp = 14
  pt.armL.rotation.x = damp(pt.armL.rotation.x, aLx, sp, dt)
  pt.armL.rotation.z = damp(pt.armL.rotation.z, aLz, sp, dt)
  pt.armR.rotation.x = damp(pt.armR.rotation.x, aRx, sp, dt)
  pt.armR.rotation.z = damp(pt.armR.rotation.z, aRz, sp, dt)
  pt.legL.rotation.x = damp(pt.legL.rotation.x, lLx, sp, dt)
  pt.legR.rotation.x = damp(pt.legR.rotation.x, lRx, sp, dt)
  pt.torso.rotation.y = damp(pt.torso.rotation.y, torsoY, sp, dt)
  pt.torso.rotation.x = damp(pt.torso.rotation.x, torsoX, sp, dt)
  if (rigRoll !== 0) p.rig.rotation.x = rigRoll
  else p.rig.rotation.x = damp(p.rig.rotation.x, 0, 12, dt)
  // bob vertical
  const bob = p.grounded && moving > 0.1 ? Math.abs(Math.sin(walkT)) * 0.06 * (p.sprinting ? 1.4 : 1) : 0
  p.parts.bob = bob
}

/* ---------- atualização ---------- */
export function updatePlayer(p, dt) {
  const s = p
  s.stateT += dt
  s.atkCd -= dt
  s.invuln -= dt
  s.staggered -= dt
  s.comboWindow -= dt
  if (s.lockT > 0) s.lockT -= dt
  if (s.castPhase > 0) s.castPhase -= dt

  // regeneração
  s.regenT -= dt
  if (s.regenT <= 0) {
    s.regenT = 1
    if (!s.dead) {
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.01)
      s.mp = Math.min(s.maxMp, s.mp + s.maxMp * 0.04)
      s.st = Math.min(s.maxSt, s.st + s.maxSt * 0.14)
    }
  }

  if (s.dead) {
    s.respawnT -= dt
    pose(s, dt)
    s.rig.position.copy(s.pos)
    s.rig.rotation.y = s.yaw
    if (s.respawnT <= 0) respawn(p)
    return
  }

  const ui = G.uiApi
  const paused = G.paused || (G.grimoireApi && G.grimoireApi.isOpen()) || (ui && ui.isBlocking())

  // ----- entrada de movimento -----
  let ix = 0, iz = 0
  if (!paused && s.lockT <= 0) {
    if (Input.isDown('KeyW')) iz -= 1
    if (Input.isDown('KeyS')) iz += 1
    if (Input.isDown('KeyA')) ix -= 1
    if (Input.isDown('KeyD')) ix += 1
    const va = Input.virtualAxis()
    ix += va.x; iz += va.y
  }
  const len = Math.hypot(ix, iz)
  if (len > 1) { ix /= len; iz /= len }

  const cam = G.cameraRig
  const camYaw = cam ? cam.yaw : 0
  const sprint = Input.isDown('ShiftLeft') && s.st > 5 && len > 0.1
  s.sprinting = sprint

  // direção no espaço do mundo a partir da câmera
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw)
  const wx = ix * cos - iz * sin
  const wz = ix * sin + iz * cos
  // (câmera olha na direção -Z rotacionada por yaw)
  const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
  const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw)
  const moveX = fwdX * -iz + rightX * ix
  const moveZ = fwdZ * -iz + rightZ * ix

  let speed = 0
  if (Math.hypot(moveX, moveZ) > 0.05 && s.lockT <= 0 && s.dodgeT <= 0 && s.staggered <= 0) {
    speed = sprint && s.grounded ? RUN : WALK
    if (s.attackType || s.castPhase > 0) speed *= 0.35
    if (s.blocking) speed *= 0.5
    if (sprint && s.grounded) s.st -= dt * 7
  }

  // esquiva
  const dodgePressed = !paused && s.lockT <= 0 && (Input.pressed('Space') || Input.pressed('dodge'))
  if (dodgePressed && s.dodgeT <= 0 && s.st >= 20 && s.grounded) {
    s.dodgeT = 0.42
    s.invuln = Math.max(s.invuln, 0.5)
    s.st -= 20
    s.attackType = null
    let dx = moveX, dz = moveZ
    if (Math.hypot(dx, dz) < 0.05) { dx = fwdX; dz = fwdZ }
    const dl = Math.hypot(dx, dz) || 1
    s.dodgeDir.set(dx / dl, 0, dz / dl)
    s.yaw = Math.atan2(dx / dl, dz / dl)
    sfx('dodge')
    burst('dust', s.pos.x, s.pos.y + 0.2, s.pos.z, 0.8)
  }

  // pulo
  if (!paused && s.lockT <= 0 && (Input.pressed('KeyV') || Input.pressed('jump')) && s.grounded && s.st >= 10 && s.dodgeT <= 0) {
    s.vy = JUMP_V
    s.grounded = false
    s.st -= 10
    sfx('jump')
  }

  // bloqueio
  s.blocking = !paused && s.lockT <= 0 && Input.isDown('KeyQ') && s.st > 4 && s.dodgeT <= 0 && !s.attackType

  // movimento horizontal
  let vx = moveX * speed, vz = moveZ * speed
  if (s.dodgeT > 0) {
    s.dodgeT -= dt
    const dspd = 11 * (0.4 + s.dodgeT / 0.42)
    vx = s.dodgeDir.x * dspd
    vz = s.dodgeDir.z * dspd
  }
  s.pos.x += vx * dt
  s.pos.z += vz * dt
  resolveCircle(s.pos, 0.42)
  const lim = 246
  s.pos.x = clamp(s.pos.x, -lim, lim)
  s.pos.z = clamp(s.pos.z, -lim, lim)

  // gravidade
  const ground = groundAt(s.pos.x, s.pos.z)
  if (s.grounded && s.pos.y > ground + 0.05) s.grounded = false
  if (!s.grounded) {
    s.vy -= GRAV * dt
    s.pos.y += s.vy * dt
    if (s.pos.y <= ground) { s.pos.y = ground; s.vy = 0; s.grounded = true; if (s.stateFall) burst('dust', s.pos.x, ground, s.pos.z, 0.6) }
  } else {
    s.pos.y = damp(s.pos.y, ground, 18, dt)
    if (Math.abs(s.pos.y - ground) < 0.02) s.pos.y = ground
  }

  // passo
  if (s.grounded && speed > 0 && s.dodgeT <= 0) {
    s.stepT = (s.stepT || 0) - dt * (sprint ? 2.2 : 1.5)
    if (s.stepT <= 0) { s.stepT = 0.42; sfx('step'); if (Math.random() < 0.3) burst('dust', s.pos.x, s.pos.y + 0.05, s.pos.z, 0.4) }
  }

  // rotação do personagem
  if (s.attackType || s.castPhase > 0) {
    // durante ataques, encara a direção da câmera (direção do ataque)
    const targetYaw = Math.atan2(fwdX, fwdZ)
    s.yaw += angleDiff(s.yaw, targetYaw) * Math.min(1, dt * 14)
  } else if (Math.hypot(moveX, moveZ) > 0.05 && s.dodgeT <= 0) {
    const targetYaw = Math.atan2(moveX, moveZ)
    s.yaw += angleDiff(s.yaw, targetYaw) * Math.min(1, dt * 12)
  }

  s.moving = speed > 0.1 ? (sprint ? 2 : 1) : 0

  pose(s, dt)
  s.rig.position.copy(s.pos)
  s.rig.position.y += s.parts.bob || 0
  s.rig.rotation.y = s.yaw

  // atualizar estado simples
  s.state = s.dead ? 'morte' : s.dodgeT > 0 ? 'esquiva' : s.attackType ? 'ataque' : s.castPhase > 0 ? 'conjuração'
    : s.blocking ? 'defesa' : !s.grounded ? (s.vy > 0 ? 'salto' : 'queda')
    : s.moving ? (s.sprinting ? 'corrida' : 'caminhada') : 'idle'

  // render da espada brilho elemental
  if (s.parts.sword) s.parts.sword.visible = true
}

/* ---------- dano / morte ---------- */
export function hurtPlayer(p, amount, srcX, srcZ, opts = {}) {
  if (p.dead || p.invuln > 0 || G.story.phase === 'test') return false
  let dmg = amount
  if (p.blocking) {
    const from = Math.atan2(srcX - p.pos.x, srcZ - p.pos.z)
    const facing = Math.abs(angleDiff(p.yaw, from)) < 1.2
    if (facing) {
      dmg *= 0.25
      p.st = Math.max(0, p.st - 12)
      sfx('block')
      burst('sparks', p.pos.x, p.pos.y + 1.2, p.pos.z, 0.7)
      // parry: se acabou de levantar a guarda
      if (p.blockT && p.blockT < 0.18) {
        dmg = 0
        if (opts.src) opts.src.staggered = Math.max(opts.src.staggered || 0, 1.4)
        sfx('parry')
        ring(p.pos.x, p.pos.y + 1, p.pos.z, 0xfff0a0, 2)
        p.st = Math.min(p.maxSt, p.st + 10)
      }
    }
  }
  if (dmg <= 0) return true
  p.hp -= dmg
  p.invuln = Math.max(p.invuln, 0.45)
  p.staggered = Math.max(p.staggered, 0.25)
  sfx('hurt')
  burst('blood', p.pos.x, p.pos.y + 1.2, p.pos.z, 0.8)
  if (G.uiApi) G.uiApi.damageAt(p.pos.x, p.pos.y + 1.8, p.pos.z, Math.round(dmg), '#ff6a5a')
  // knockback
  const dx = p.pos.x - srcX, dz = p.pos.z - srcZ
  const d = Math.hypot(dx, dz) || 1
  p.pos.x += (dx / d) * 0.35
  p.pos.z += (dz / d) * 0.35
  if (p.hp <= 0) {
    p.hp = 0
    p.dead = true
    p.stateT = 0
    p.respawnT = 4
    sfx('goblindie')
    if (G.uiApi) G.uiApi.banner('VOCÊ CAIU', 'Retornando à vila…', '', 0.9)
  }
  return true
}

export function respawn(p) {
  p.dead = false
  p.hp = p.maxHp * 0.6
  p.mp = p.maxMp
  p.st = p.maxSt
  p.pos.set(VILLAGEX, 0, VILLAGEZ)
  p.pos.y = groundAt(p.pos.x, p.pos.z)
  p.vy = 0
  p.invuln = 2
}
const VILLAGEX = 0, VILLAGEZ = 14

export function gainXp(p, amount) {
  p.xp += amount
  if (G.uiApi) G.uiApi.toast(`+${amount} XP`, 'xp')
  const need = xpNeed(p.level)
  if (p.xp >= need) {
    p.xp -= need
    p.level++
    p.maxHp += 9; p.maxMp += 7; p.maxSt += 5
    p.str += 2; p.def += 1; p.mag += 2
    p.hp = p.maxHp; p.mp = p.maxMp; p.st = p.maxSt
    sfx('levelup')
    burst('magic', p.pos.x, p.pos.y + 1, p.pos.z, 1.6)
    if (G.uiApi) {
      G.uiApi.banner(`NÍVEL ${p.level}`, 'Seus poderes crescem…', '', 1)
      const unlocked = checkSpellUnlock(p)
      if (unlocked) G.uiApi.toast(`Nova magia: ${unlocked}! (pressione G)`, 'gold')
    }
  }
}

export function xpNeed(level) { return Math.round(70 * Math.pow(level, 1.45)) }

export function checkSpellUnlock(p) {
  if (!p.element || !G.grimoireApi) return null
  return G.grimoireApi.checkUnlocks()
}
