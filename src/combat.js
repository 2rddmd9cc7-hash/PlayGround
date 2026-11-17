/* ============================================================
   Combate — ataques do jogador (combo, pesado), teclas de magia.
   ============================================================ */
import { G, clamp } from './state.js'
import { Input } from './input.js'
import { sfx } from './audio.js'
import { burst, ring } from './effects.js'
import { damageEnemy, enemies } from './enemies.js'
import { castSpell } from './magic.js'

const ATTACKS = {
  slash1: { dur: 1.0, hitAt: 0.42, dmgMul: 1, st: 9, reach: 2.3, arc: 1.1 },
  slash2: { dur: 0.95, hitAt: 0.4, dmgMul: 1.15, st: 11, reach: 2.3, arc: 1.2 },
  heavy: { dur: 1.35, hitAt: 0.68, dmgMul: 2.1, st: 26, reach: 2.6, arc: 1.3 },
}

export function updateCombat(p, dt) {
  // parry: tempo de guarda
  if (p.blocking) p.blockT = (p.blockT || 0) + dt
  else p.blockT = 0

  const paused = G.paused || (G.grimoireApi && G.grimoireApi.isOpen()) || (G.uiApi && G.uiApi.isBlocking())
  if (p.dead || paused || p.lockT > 0) {
    advanceAttack(p, dt)
    return
  }

  // ----- ataque físico -----
  if (!p.attackType && p.atkCd <= 0 && p.castPhase <= 0 && p.dodgeT <= 0 && !p.blocking) {
    const heavy = Input.pressed('KeyF')
    const light = Input.mPressed(0) || Input.pressed('attack')
    if (heavy && p.st >= ATTACKS.heavy.st) startAttack(p, 'heavy', 3)
    else if (light && p.st >= 9) startAttack(p, p.comboWindow > 0 && p.comboIdx === 1 ? 'slash2' : 'slash1', p.comboWindow > 0 ? (p.comboIdx + 1) % 3 : 1)
  }

  advanceAttack(p, dt)

  // ----- magias (1-4) -----
  const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4']
  for (let i = 0; i < 4; i++) {
    if (Input.pressed(keys[i])) tryCast(p, i)
  }
  // poções (5/6)
  if (Input.pressed('Digit5') || Input.pressed('Digit6')) {
    usePotion(p, Input.pressed('Digit6'))
  }
}

function tryCast(p, i) {
  if (p.dodgeT > 0 || p.blocking) return
  if (!p.element) {
    if (G.uiApi) G.uiApi.toast('Você ainda não possui elemento. Vá ao castelo!', 'gold')
    return
  }
  castSpell(p, i)
}

function usePotion(p, manaPotion) {
  if (!G.inventory) return
  const name = manaPotion ? 'poção de mana' : 'poção de vida'
  const it = G.inventory.items.find((x) => x.kind === 'potion' && x.name === name && x.qty > 0)
  if (!it) { if (G.uiApi) G.uiApi.toast(`Sem ${name}!`, 'gold'); return }
  G.inventory.remove(it.name, 1)
  if (manaPotion) { p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.6); sfx('potion'); burst('magic', p.pos.x, p.pos.y + 1, p.pos.z, 1) }
  else { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); sfx('heal'); burst('heal', p.pos.x, p.pos.y + 1, p.pos.z, 1) }
  if (G.uiApi) G.uiApi.refreshHotbar()
}

function startAttack(p, type, comboIdx) {
  const a = ATTACKS[type]
  p.attackType = type
  p.attackPhase = 0
  p.attackHitDone = false
  p.comboIdx = comboIdx
  p.atkCd = a.dur * 0.75
  p.comboWindow = 0
  p.st -= a.st
  sfx(type === 'heavy' ? 'heavy' : 'swing')
}

function advanceAttack(p, dt) {
  if (!p.attackType) return
  const a = ATTACKS[p.attackType]
  if (!a) { p.attackType = null; return }
  p.attackPhase += dt / a.dur
  if (!p.attackHitDone && p.attackPhase >= a.hitAt) {
    p.attackHitDone = true
    doHit(p, a, p.attackType === 'heavy')
  }
  if (p.attackPhase >= 1) {
    p.attackType = null
    p.comboWindow = 0.6
  }
}

function doHit(p, a, heavy) {
  const fwd = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }
  let hitAny = false
  for (const e of enemies) {
    if (e.dead) continue
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z
    const d = Math.hypot(dx, dz)
    if (d > a.reach + e.radius) continue
    const ang = Math.atan2(dx, dz)
    let diff = Math.abs(ang - p.yaw)
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2)
    if (diff > a.arc) continue
    hitAny = true
    const dmg = (p.str * 1.35 + p.level * 2) * a.dmgMul
    damageEnemy(e, dmg, { from: p.pos, knock: heavy ? 7 : 3.5, elem: null })
    if (heavy) {
      e.staggered = Math.max(e.staggered, 0.9)
      burst('sparks', e.pos.x, e.pos.y + 1, e.pos.z, 1)
      ring(e.pos.x, e.pos.y + 0.1, e.pos.z, 0xfff0a0, 2, 0.3)
    }
  }
  if (hitAny) {
    if (G.uiApi) G.uiApi.hitstop(heavy ? 0.09 : 0.045)
  } else {
    burst('dust', p.pos.x + fwd.x * 1.6, p.pos.y + 0.6, p.pos.z + fwd.z * 1.6, 0.4)
  }
}
