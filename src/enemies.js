/* ============================================================
   Inimigos — goblins, IA, ranks E→SS, animações e loot.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, rand, randInt, pick, angleDiff, addCollider, resolveCircle } from './state.js'
import { groundAt, CAMPS } from './world.js'
import { hurtPlayer, gainXp } from './player.js'
import { sfx } from './audio.js'
import { burst, ring } from './effects.js'

export const RANKS = {
  E: { mul: 1, detect: 11, xp: 6, gold: 3, color: 0x9aa0a8 },
  D: { mul: 1.45, detect: 13, xp: 10, gold: 5, color: 0x7aa058 },
  C: { mul: 2, detect: 15, xp: 17, gold: 9, color: 0x58a8b8 },
  B: { mul: 2.8, detect: 17, xp: 28, gold: 16, color: 0xa868c8 },
  A: { mul: 4, detect: 19, xp: 45, gold: 26, color: 0xe8a030 },
  S: { mul: 5.6, detect: 21, xp: 75, gold: 45, color: 0xe85050 },
  SS: { mul: 8, detect: 24, xp: 120, gold: 80, color: 0xff4040 },
}
export const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS']

const CLASSES = {
  Goblin: { hp: 22, dmg: 6, spd: 3.2, range: 1.5, ranged: false, scale: 0.85, weapon: 'club' },
  'Goblin Guerreiro': { hp: 38, dmg: 10, spd: 3.6, range: 1.7, ranged: false, scale: 0.95, weapon: 'sword' },
  'Goblin Arqueiro': { hp: 26, dmg: 9, spd: 3.4, range: 12, ranged: true, scale: 0.85, weapon: 'bow' },
  'Goblin Mago': { hp: 24, dmg: 12, spd: 3, range: 11, ranged: true, scale: 0.85, weapon: 'staff' },
  'Goblin Capitão': { hp: 90, dmg: 16, spd: 4, range: 1.9, ranged: false, scale: 1.15, weapon: 'axe', boss: true },
  'Goblin Elite': { hp: 60, dmg: 14, spd: 4.4, range: 1.8, ranged: false, scale: 1.05, weapon: 'sword' },
  'Grão-Chefe Uzgar': { hp: 320, dmg: 22, spd: 3.8, range: 2.4, ranged: false, scale: 1.6, weapon: 'axe', boss: true },
}

export const enemies = []

export function spawnEnemy(cls, rank, x, z, opts = {}) {
  const c = CLASSES[cls] || CLASSES.Goblin
  const r = RANKS[rank] || RANKS.E
  const hp = Math.round(c.hp * r.mul * (opts.hpMul || 1))
  const e = {
    cls, rank, hp, maxHp: hp,
    dmg: c.dmg * r.mul * (opts.dmgMul || 1),
    speed: c.spd * (0.9 + r.mul * 0.05),
    radius: 0.55 * c.scale,
    pos: new THREE.Vector3(x, groundAt(x, z), z),
    yaw: rand(0, Math.PI * 2), vy: 0,
    home: { x, z }, wanderT: rand(0, 3), target: null,
    state: 'idle', attackT: 0, atkCd: rand(0, 1), swingDone: false,
    staggered: 0, rooted: 0, frozen: 0, burn: 0, burnTick: 0,
    dead: false, deathT: 0, xp: Math.round(r.xp * (c.boss ? 6 : 1) * (opts.xpMul || 1)),
    gold: Math.round(r.gold * (c.boss ? 5 : 1) * (opts.goldMul || 1)),
    boss: !!c.boss, ranged: c.ranged, atkRange: c.range,
    scale: c.scale, strafe: rand(-1, 1), strafeT: 0,
    camp: opts.camp || null, respawn: opts.respawn || 0,
    aggro: false, hitFlash: 0, projectile: c.weapon === 'bow' ? 'arrow' : c.weapon === 'staff' ? 'bolt' : null,
  }
  buildEnemyRig(e, cls, c, r)
  enemies.push(e)
  G.scene.add(e.rig)
  return e
}

const skinM = new THREE.MeshLambertMaterial({ color: 0x6a9a48 })
const skinDark = new THREE.MeshLambertMaterial({ color: 0x557a38 })
const clothM = new THREE.MeshLambertMaterial({ color: 0x7a5a3a })
const metalM = new THREE.MeshStandardMaterial({ color: 0xa8a8b0, metalness: 0.6, roughness: 0.4 })
const woodM = new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
const bossM = new THREE.MeshLambertMaterial({ color: 0x8a4a2a })

function buildEnemyRig(e, cls, c, r) {
  const g = new THREE.Group()
  const mk = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }
  const s = c.scale
  const skin = cls.includes('Capitão') || cls.includes('Chefe') ? bossM : skinM
  const body = mk(new THREE.BoxGeometry(0.42 * s, 0.5 * s, 0.3 * s), skin, 0, 0.55 * s, 0)
  const head = mk(new THREE.SphereGeometry(0.24 * s, 8, 7), skin, 0, 0.95 * s, 0.02)
  head.scale.set(1, 0.9, 1.05)
  // orelhas pontudas
  for (const sd of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(0.06 * s, 0.22 * s, 5), skin, sd * 0.24 * s, 1 * s, 0)
    ear.rotation.z = sd * -1.2
    g.add(ear)
  }
  const kilt = mk(new THREE.ConeGeometry(0.3 * s, 0.3 * s, 6), clothM, 0, 0.34 * s, 0)
  const eyeL = mk(new THREE.SphereGeometry(0.035 * s, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffcc30 }), -0.09 * s, 0.97 * s, 0.21 * s)
  const eyeR = mk(new THREE.SphereGeometry(0.035 * s, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffcc30 }), 0.09 * s, 0.97 * s, 0.21 * s)

  const armL = new THREE.Group(); armL.position.set(-0.26 * s, 0.72 * s, 0)
  armL.add(mk(new THREE.BoxGeometry(0.1 * s, 0.4 * s, 0.1 * s), skin, 0, -0.2 * s, 0))
  const armR = new THREE.Group(); armR.position.set(0.26 * s, 0.72 * s, 0)
  armR.add(mk(new THREE.BoxGeometry(0.1 * s, 0.4 * s, 0.1 * s), skin, 0, -0.2 * s, 0))
  const legL = new THREE.Group(); legL.position.set(-0.12 * s, 0.36 * s, 0)
  legL.add(mk(new THREE.BoxGeometry(0.12 * s, 0.34 * s, 0.13 * s), skinDark, 0, -0.18 * s, 0))
  const legR = new THREE.Group(); legR.position.set(0.12 * s, 0.36 * s, 0)
  legR.add(mk(new THREE.BoxGeometry(0.12 * s, 0.34 * s, 0.13 * s), skinDark, 0, -0.18 * s, 0))

  // arma
  const weapon = new THREE.Group()
  if (c.weapon === 'club') weapon.add(mk(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 0.55 * s, 6), woodM, 0, -0.5 * s, 0.05))
  else if (c.weapon === 'sword') weapon.add(mk(new THREE.BoxGeometry(0.05 * s, 0.6 * s, 0.02 * s), metalM, 0, -0.5 * s, 0.05))
  else if (c.weapon === 'axe') {
    weapon.add(mk(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.8 * s, 6), woodM, 0, -0.6 * s, 0))
    weapon.add(mk(new THREE.BoxGeometry(0.06 * s, 0.22 * s, 0.3 * s), metalM, 0, -0.9 * s, 0.12 * s))
  } else if (c.weapon === 'bow') {
    const bow = mk(new THREE.TorusGeometry(0.22 * s, 0.02 * s, 5, 10, Math.PI), woodM, 0, -0.55 * s, 0.1)
    bow.rotation.z = Math.PI / 2
    weapon.add(bow)
  } else if (c.weapon === 'staff') {
    weapon.add(mk(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.8 * s, 5), woodM, 0, -0.55 * s, 0))
    const orb = mk(new THREE.SphereGeometry(0.07 * s, 6, 5), new THREE.MeshBasicMaterial({ color: r.color }), 0, -0.95 * s, 0)
    weapon.add(orb)
  }
  weapon.position.set(0, -0.4 * s, 0)
  weapon.rotation.x = Math.PI
  armR.add(weapon)

  g.add(body, head, kilt, eyeL, eyeR, armL, armR, legL, legR)
  if (e.boss) {
    // coroa/spinhos do chefe
    for (let i = 0; i < 3; i++) {
      const spike = mk(new THREE.ConeGeometry(0.05 * s, 0.2 * s, 4), metalM, (i - 1) * 0.1 * s, 1.14 * s, 0)
      g.add(spike)
    }
  }
  // marca de rank flutuante
  const rankSprite = makeRankSprite(e.rank)
  rankSprite.position.y = 1.45 * s
  g.add(rankSprite)

  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  e.rig = g
  e.parts = { armL, armR, legL, legR, body, head }
  e.rankSprite = rankSprite
}

function makeRankSprite(rank) {
  const cv = document.createElement('canvas')
  cv.width = 64; cv.height = 64
  const ctx = cv.getContext('2d')
  const col = '#' + (RANKS[rank]?.color || 0xffffff).toString(16).padStart(6, '0')
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 8
  ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = col
  ctx.beginPath(); ctx.arc(32, 32, 21, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#101010'
  ctx.font = 'bold 30px Georgia'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(rank, 32, 34)
  const tex = new THREE.CanvasTexture(cv)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sp.scale.setScalar(0.45)
  return sp
}

/* ---------- projéteis inimigos ---------- */
const eProjs = []
const eProjPool = []
function spawnEnemyProj(e, tx, tz) {
  const pl = G.player
  if (!pl) return
  const dy = (pl.pos.y + 1) - (e.pos.y + 0.9)
  const dx = tx - e.pos.x, dz = tz - e.pos.z
  const d = Math.hypot(dx, dz) || 1
  const spd = e.projectile === 'arrow' ? 14 : 9
  let mesh = eProjPool.pop()
  if (!mesh) {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    G.scene.add(mesh)
  }
  mesh.material.color.set(e.projectile === 'arrow' ? 0xd8c8a0 : 0xb080ff)
  mesh.visible = true
  mesh.position.set(e.pos.x, e.pos.y + 0.9, e.pos.z)
  eProjs.push({ mesh, vx: (dx / d) * spd, vy: (dy / d) * spd + d * 0.08, vz: (dz / d) * spd, dmg: e.dmg, life: 3, magic: e.projectile === 'bolt' })
  sfx(e.projectile === 'arrow' ? 'swing' : 'magic')
}

/* ---------- dano ---------- */
export function damageEnemy(e, amount, opts = {}) {
  if (e.dead) return
  let dmg = amount
  const p = G.player
  let crit = false
  if (p && !opts.silent) {
    if (Math.random() * 100 < p.crit) { dmg *= 1.85; crit = true }
  }
  e.hp -= dmg
  e.hitFlash = 0.15
  e.aggro = true
  if (opts.from) {
    const dx = e.pos.x - opts.from.x, dz = e.pos.z - opts.from.z
    const d = Math.hypot(dx, dz) || 1
    const k = (opts.knock || 2) * (e.boss ? 0.25 : 1) * 0.06
    e.pos.x += (dx / d) * k
    e.pos.z += (dz / d) * k
  }
  if (opts.elem === 'Fogo' && !e.burnImmune) e.burn = Math.max(e.burn, 2.4)
  if (opts.elem === 'Gelo') e.rooted = Math.max(e.rooted, 0.8)
  if (!opts.silent) {
    sfx(crit ? 'crit' : 'hit')
    burst('blood', e.pos.x, e.pos.y + 0.9 * e.scale, e.pos.z, 0.7)
    if (G.uiApi) G.uiApi.damageAt(e.pos.x, e.pos.y + 1.3 * e.scale, e.pos.z, Math.round(dmg), crit ? '#ffd050' : '#ffffff')
  }
  if (e.hp <= 0) killEnemy(e)
}

function killEnemy(e) {
  e.dead = true
  e.deathT = 0
  e.state = 'dead'
  sfx('goblindie')
  burst('blood', e.pos.x, e.pos.y + 0.6, e.pos.z, 1.2)
  const p = G.player
  if (p) {
    gainXp(p, e.xp)
    p.gold += e.gold
    if (G.uiApi) {
      G.uiApi.toast(`+${e.gold} ◈`, 'gold')
      if (G.quests) G.quests.onKill(e)
    }
  }
  // loot
  dropLoot(e)
  if (e.respawn > 0) {
    setTimeout(() => {
      // reaparece se o jogador estiver longe
      const p2 = G.player
      if (p2 && Math.hypot(p2.pos.x - e.home.x, p2.pos.z - e.home.z) > 30) {
        const ne = spawnEnemy(e.cls, e.rank, e.home.x, e.home.z, { camp: e.camp, respawn: e.respawn })
        ne.respawn = e.respawn
      }
    }, e.respawn * 1000)
  }
}

const LOOT_TABLE = [
  { item: 'gold', w: 30 }, { item: 'poção de vida', w: 18, kind: 'potion' },
  { item: 'poção de mana', w: 10, kind: 'potion' }, { item: 'Presas de Goblin', w: 22, kind: 'mat' },
  { item: 'Espada Curta', w: 5, kind: 'weapon' }, { item: 'Pergaminho Antigo', w: 4, kind: 'book' },
  { item: 'Elmo de Couro', w: 5, kind: 'armor' },
]
const RARITIES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico']
function dropLoot(e) {
  const p = G.player
  const roll = Math.random() * 100
  let acc = 0
  let chosen = LOOT_TABLE[0]
  for (const l of LOOT_TABLE) { acc += l.w; if (roll < acc) { chosen = l; break } }
  if (chosen.kind === 'potion' || chosen.kind === 'weapon' || chosen.kind === 'armor' || chosen.kind === 'book') {
    const rarIdx = e.boss ? randInt(2, 4) : randInt(0, 2)
    const item = { name: chosen.item, kind: chosen.kind, rarity: RARITIES[rarIdx], icon: iconFor(chosen.kind), qty: 1 }
    if (G.inventory) G.inventory.add(item)
    if (p) lootOrb(e.pos, item)
  } else if (chosen.kind === 'mat') {
    if (G.inventory) G.inventory.add({ name: chosen.item, kind: 'mat', rarity: 'Comum', icon: '🦷', qty: randInt(1, 2) })
  }
}

function iconFor(kind) { return kind === 'potion' ? '🧪' : kind === 'weapon' ? '🗡️' : kind === 'armor' ? '🛡️' : kind === 'book' ? '📜' : '🦷' }

/* orbs de loot que voam até o jogador */
const orbs = []
function lootOrb(pos, item) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xe8d060 }))
  m.position.set(pos.x, pos.y + 0.5, pos.z)
  G.scene.add(m)
  orbs.push({ mesh: m, item, t: 0, vy: 3 })
}

/* ---------- IA ---------- */
export function updateEnemies(dt) {
  const p = G.player
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]

    // morte
    if (e.dead) {
      e.deathT += dt
      e.rig.rotation.x = Math.min(Math.PI / 2, e.deathT * 3)
      e.rig.position.y = e.pos.y + Math.max(0, 0.15 - e.deathT * 0.1)
      if (e.deathT > 8) {
        G.scene.remove(e.rig)
        enemies.splice(i, 1)
      }
      continue
    }

    e.hitFlash -= dt
    e.atkCd -= dt
    e.staggered -= dt
    e.rooted -= dt
    e.frozen -= dt

    // queimadura
    if (e.burn > 0) {
      e.burn -= dt
      e.burnTick -= dt
      if (e.burnTick <= 0) {
        e.burnTick = 0.5
        e.hp -= 2
        burst('fire', e.pos.x, e.pos.y + 0.8, e.pos.z, 0.5)
        if (e.hp <= 0) { killEnemy(e); continue }
      }
    }

    if (e.hitFlash > 0) {
      e.parts.body.material = e.parts.body.material
      e.rig.scale.setScalar(1 + e.hitFlash * 0.15)
    } else e.rig.scale.setScalar(1)

    // condição travada
    if (e.rooted > 0 || e.frozen > 0) {
      if (e.frozen > 0 && Math.random() < 0.1) burst('frost', e.pos.x, e.pos.y + 0.8, e.pos.z, 0.4)
      e.rig.position.copy(e.pos)
      e.rig.rotation.y = e.yaw
      continue
    }

    if (!p || p.dead) {
      // patrulha sem alvo
      wander(e, dt)
      continue
    }

    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z
    const d = Math.hypot(dx, dz)
    const det = (RANKS[e.rank]?.detect || 11) * (p.sprinting ? 1.25 : 1)

    if (e.state === 'idle' || e.state === 'patrol') {
      if (d < det) { e.state = 'chase'; e.aggro = true; if (Math.random() < 0.4) sfx('goblin') }
      else wander(e, dt)
    } else if (e.state === 'chase') {
      if (d > det * 2.4 && !e.boss) { e.state = 'return'; e.aggro = false }
      if (e.ranged) {
        // mantém distância
        const ideal = e.atkRange * 0.75
        if (d > ideal + 2) moveToward(e, p.pos.x, p.pos.z, dt)
        else if (d < ideal - 3) moveAway(e, p.pos.x, p.pos.z, dt)
        else {
          e.strafeT -= dt
          if (e.strafeT <= 0) { e.strafeT = rand(1, 2.4); e.strafe = rand(-1, 1) }
          moveStrafe(e, dx / d, dz / d, dt)
        }
        e.yaw += angleDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8)
        if (d < e.atkRange && e.atkCd <= 0 && e.staggered <= 0) {
          e.atkCd = rand(1.6, 2.6)
          e.attackT = 0.45
          e.pendingShot = true
        }
      } else {
        if (d > e.atkRange * 0.85) moveToward(e, p.pos.x, p.pos.z, dt)
        else {
          // cercar: leve strafe
          e.strafeT -= dt
          if (e.strafeT <= 0) { e.strafeT = rand(0.8, 2); e.strafe = rand(-1, 1) }
          moveStrafe(e, dx / d, dz / d, dt, 0.4)
          e.yaw += angleDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10)
          if (e.atkCd <= 0 && e.staggered <= 0) {
            e.atkCd = e.boss ? rand(1.2, 2) : rand(1.8, 3)
            e.attackT = 0.55
            e.swingDone = false
          }
        }
      }
      // executa ataque
      if (e.attackT > 0) {
        e.attackT -= dt
        if (e.pendingShot && e.attackT <= 0.2) {
          e.pendingShot = false
          spawnEnemyProj(e, p.pos.x + rand(-0.5, 0.5), p.pos.z + rand(-0.5, 0.5))
        }
        if (!e.swingDone && e.attackT <= 0.2) {
          e.swingDone = true
          if (!e.ranged && d < e.atkRange + 0.6) {
            const facing = Math.abs(angleDiff(e.yaw, Math.atan2(dx, dz))) < 1
            if (facing) {
              hurtPlayer(p, e.dmg, e.pos.x, e.pos.z, { src: e })
              sfx('swing')
            }
          }
        }
      }
    } else if (e.state === 'return') {
      const dh = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z)
      if (dh < 1.5) { e.state = 'idle'; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3) }
      else moveToward(e, e.home.x, e.home.z, dt, 0.8)
      if (d < det * 0.7) { e.state = 'chase'; e.aggro = true }
    }

    // gravidade simples
    const gy = groundAt(e.pos.x, e.pos.z)
    e.pos.y = dampY(e.pos.y, gy, dt)

    resolveCircle(e.pos, e.radius)
    e.rig.position.copy(e.pos)
    e.rig.rotation.y = e.yaw
    animateEnemy(e, dt, d)
  }

  // projéteis inimigos
  for (let i = eProjs.length - 1; i >= 0; i--) {
    const pr = eProjs[i]
    pr.life -= dt
    pr.vy -= 9 * dt
    pr.mesh.position.x += pr.vx * dt
    pr.mesh.position.y += pr.vy * dt
    pr.mesh.position.z += pr.vz * dt
    const mp = pr.mesh.position
    let done = pr.life <= 0 || mp.y < groundAt(mp.x, mp.z)
    if (!done && p && !p.dead) {
      if (Math.hypot(p.pos.x - mp.x, p.pos.z - mp.z) < 0.6 && mp.y > p.pos.y && mp.y < p.pos.y + 2) {
        hurtPlayer(p, pr.dmg, mp.x, mp.z, {})
        if (pr.magic) burst('magic', mp.x, mp.y, mp.z, 0.7)
        else burst('dust', mp.x, mp.y, mp.z, 0.5)
        done = true
      }
    }
    if (done) { pr.mesh.visible = false; eProjPool.push(pr.mesh); eProjs.splice(i, 1) }
  }

  // orbs de loot
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]
    o.t += dt
    if (o.t < 0.6) {
      o.vy -= 8 * dt
      o.mesh.position.y += o.vy * dt
      o.mesh.rotation.y += dt * 4
    } else if (p && !p.dead) {
      const d = Math.hypot(p.pos.x - o.mesh.position.x, p.pos.y + 1 - o.mesh.position.y, p.pos.z - o.mesh.position.z)
      if (d < 0.7 || o.t > 6) {
        G.scene.remove(o.mesh)
        orbs.splice(i, 1)
        if (G.inventory) { G.inventory.add(o.item); sfx('coin') }
        if (G.uiApi) G.uiApi.toast(`${o.item.icon} ${o.item.name} (${o.item.rarity})`, 'gold')
      } else {
        const dx = p.pos.x - o.mesh.position.x, dy = p.pos.y + 1 - o.mesh.position.y, dz = p.pos.z - o.mesh.position.z
        o.mesh.position.x += dx / d * 9 * dt
        o.mesh.position.y += dy / d * 9 * dt
        o.mesh.position.z += dz / d * 9 * dt
      }
    }
  }
}

function dampY(y, g, dt) { return y + (g - y) * Math.min(1, dt * 12) }

function moveToward(e, tx, tz, dt, mul = 1) {
  const dx = tx - e.pos.x, dz = tz - e.pos.z
  const d = Math.hypot(dx, dz) || 1
  const s = e.speed * mul * dt
  e.pos.x += (dx / d) * s
  e.pos.z += (dz / d) * s
  e.yaw += angleDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8)
}
function moveAway(e, tx, tz, dt) {
  const dx = e.pos.x - tx, dz = e.pos.z - tz
  const d = Math.hypot(dx, dz) || 1
  e.pos.x += (dx / d) * e.speed * dt
  e.pos.z += (dz / d) * e.speed * dt
}
function moveStrafe(e, nx, nz, dt, mul = 1) {
  const s = e.speed * 0.6 * mul * e.strafe * dt
  e.pos.x += -nz * s
  e.pos.z += nx * s
}

function wander(e, dt) {
  if (e.state === 'return') return
  e.wanderT -= dt
  if (e.wanderT <= 0) {
    e.wanderT = rand(2, 5)
    e.wTarget = { x: e.home.x + rand(-5, 5), z: e.home.z + rand(-5, 5) }
  }
  if (e.wTarget) {
    const d = Math.hypot(e.wTarget.x - e.pos.x, e.wTarget.z - e.pos.z)
    if (d > 0.5) moveToward(e, e.wTarget.x, e.wTarget.z, dt, 0.45)
    else e.wTarget = null
  }
  const gy = groundAt(e.pos.x, e.pos.z)
  e.pos.y = dampY(e.pos.y, gy, dt)
  resolveCircle(e.pos, e.radius)
  e.rig.position.copy(e.pos)
  e.rig.rotation.y = e.yaw
  animateEnemy(e, dt, 99)
}

function animateEnemy(e, dt, distToPlayer) {
  const t = performance.now() / 1000 + e.home.x
  const s = e.scale
  let lL = 0, lR = 0, aL = 0, aR = 0
  if (e.attackT > 0) {
    const k = 1 - e.attackT / 0.55
    aR = -2.2 * Math.sin(k * Math.PI)
  } else {
    const moving = e.wTarget || e.state === 'chase' || e.state === 'return'
    if (moving) {
      const sw = Math.sin(t * 9)
      lL = sw * 0.5; lR = -sw * 0.5; aL = -sw * 0.35
    } else {
      aL = Math.sin(t * 2) * 0.08
      aR = Math.sin(t * 2 + 1) * 0.08
    }
  }
  e.parts.legL.rotation.x += (lL - e.parts.legL.rotation.x) * Math.min(1, dt * 10)
  e.parts.legR.rotation.x += (lR - e.parts.legR.rotation.x) * Math.min(1, dt * 10)
  e.parts.armL.rotation.x += (aL - e.parts.armL.rotation.x) * Math.min(1, dt * 10)
  e.parts.armR.rotation.x += (aR - e.parts.armR.rotation.x) * Math.min(1, dt * 10)
  e.rankSprite.position.y = 1.45 * s + Math.sin(t * 2.4) * 0.03
}

/* ---------- limpeza ---------- */
export function clearEnemies() {
  for (const e of enemies) G.scene.remove(e.rig)
  enemies.length = 0
  for (const o of orbs) G.scene.remove(o.mesh)
  orbs.length = 0
}

export function nearestEnemy(x, z, maxD = 25) {
  let best = null, bd = maxD
  for (const e of enemies) {
    if (e.dead) continue
    const d = Math.hypot(e.pos.x - x, e.pos.z - z)
    if (d < bd) { bd = d; best = e }
  }
  return best
}

/* ---------- guardas dos acampamentos ---------- */
export function spawnCampGuards() {
  for (const c of CAMPS) {
    spawnEnemy('Goblin', 'E', c.x + 2, c.z + 2, { camp: c, respawn: 45 })
    spawnEnemy('Goblin Guerreiro', 'E', c.x - 2, c.z - 2, { camp: c, respawn: 45 })
    spawnEnemy('Goblin Arqueiro', 'D', c.x, c.z + 4, { camp: c, respawn: 60 })
  }
}
