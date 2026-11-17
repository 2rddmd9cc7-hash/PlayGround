/* ============================================================
   Magia — conjuração, projéteis e habilidades especiais.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, rand, addCollider } from './state.js'
import { ELEMENTS } from './elements.js'
import { damageEnemy, enemies } from './enemies.js'
import { sfx } from './audio.js'
import { burst, ring, ELEM_FX } from './effects.js'
import { groundAt } from './world.js'

const GRAV = 14
const projs = []
const projPool = []
const tempV = new THREE.Vector3()
const areas = [] // efeitos de área em andamento (chuvas, tempestades, tornados)

function getProjMesh(color) {
  let m = projPool.pop()
  if (!m) {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    G.scene.add(m)
  }
  m.material.color.set(color)
  m.visible = true
  m.scale.setScalar(1)
  return m
}

function spawnProj(opts) {
  const { x, y, z, dir, speed, dmg, radius, aoe, elem, color, pierce = false, grav = 0, owner = 'player', life = 3 } = opts
  const mesh = getProjMesh(color)
  mesh.position.set(x, y, z)
  mesh.scale.setScalar(radius / 0.24)
  projs.push({
    mesh, vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed,
    dmg, radius, aoe, elem, color, pierce, grav, owner, life,
    hitSet: pierce ? new Set() : null,
  })
}

export function castSpell(p, index) {
  if (!p.element || p.dead) return false
  const spell = ELEMENTS[p.element].spells[index]
  if (!spell) return false
  if ((p.cds[index] || 0) > 0) return false
  if (p.mp < spell.mana) { if (G.uiApi) G.uiApi.toast('Mana insuficiente!', 'gold'); return false }
  if (p.st < 8) return false

  p.mp -= spell.mana
  p.cds[index] = spell.cd
  p.castPhase = 0.5
  p.attackType = null
  p.yaw += 0 // encarado pela câmera via updatePlayer

  const rig = G.cameraRig
  const fwd = { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) }
  const ox = p.pos.x, oy = p.pos.y + 1.4, oz = p.pos.z
  const color = ELEMENTS[p.element].color
  const [fxType, fxCol] = ELEM_FX[p.element] || ['magic', color]
  const M = 2.4 // alcance à frente para efeitos de área
  const tx = ox + fwd.x * M, tz = oz + fwd.z * M
  const ty = groundAt(tx, tz)

  sfx('magic')
  burst(fxType, ox + fwd.x * 0.6, oy, oz + fwd.z * 0.6, 0.9)

  switch (spell.kind) {
    case 'proj':
      sfx(p.element === 'Fogo' ? 'fire' : p.element === 'Raio' ? 'zap' : p.element === 'Gelo' ? 'ice' : p.element === 'Água' ? 'water' : p.element === 'Terra' ? 'earth' : 'wind')
      spawnProj({ x: ox + fwd.x * 0.7, y: oy, z: oz + fwd.z * 0.7, dir: { x: fwd.x, y: 0.02, z: fwd.z }, speed: spell.speed, dmg: spell.dmg + p.mag * 0.6, radius: spell.radius, aoe: spell.aoe, elem: p.element, color, life: 2.4 })
      break
    case 'pierce':
      sfx(p.element === 'Água' ? 'water' : 'ice')
      spawnProj({ x: ox + fwd.x * 0.7, y: oy, z: oz + fwd.z * 0.7, dir: { x: fwd.x, y: 0, z: fwd.z }, speed: spell.speed, dmg: spell.dmg + p.mag * 0.7, radius: spell.radius, aoe: spell.aoe, elem: p.element, color, pierce: true, life: 2 })
      break
    case 'nova': {
      // detonação ao redor do mago
      const r = spell.aoe
      ring(ox, oy - 1.2, oz, fxCol, r, 0.5)
      for (let i = 0; i < 26; i++) burst(fxType, ox + rand(-r, r) * 0.5, oy - 1 + rand(0, 1), oz + rand(-r, r) * 0.5, 1.2)
      sfx(p.element === 'Fogo' ? 'firehit' : 'thunder')
      areaDamage(ox, oy, oz, r, spell.dmg + p.mag, p.element, 8)
      break
    }
    case 'rain': {
      areas.push({ kind: 'rain', x: tx, z: tz, r: spell.aoe, t: 2.4, tick: 0, dmg: spell.dmg + p.mag * 0.4, elem: p.element, color })
      sfx('fire')
      break
    }
    case 'storm': {
      areas.push({ kind: 'storm', x: tx, z: tz, r: spell.aoe, t: 2.6, tick: 0, dmg: spell.dmg + p.mag * 0.5, elem: p.element, color })
      sfx('zap')
      break
    }
    case 'meteor': {
      const mx = tx + rand(-2, 2), mz = tz + rand(-2, 2)
      areas.push({ kind: 'meteor', x: mx, z: mz, t: 1.1, dmg: spell.dmg + p.mag, r: spell.aoe, elem: p.element, color, warn: 0 })
      sfx('earth')
      break
    }
    case 'chain': {
      // salta entre inimigos próximos
      let src = { x: ox, y: oy, z: oz }
      const hit = new Set()
      sfx('zap')
      for (let hop = 0; hop < 4; hop++) {
        let best = null, bd = hop === 0 ? 12 : 8
        for (const e of enemies) {
          if (e.dead || hit.has(e)) continue
          const d = Math.hypot(e.pos.x - src.x, e.pos.z - src.z)
          if (d < bd) { bd = d; best = e }
        }
        if (!best) break
        hit.add(best)
        lightningArc(src, best.pos)
        damageEnemy(best, spell.dmg + p.mag * 0.5 + hop * 2, { elem: 'Raio', from: p.pos, knock: 2 })
        src = best.pos
      }
      if (hit.size === 0) burst('zap', ox + fwd.x * 3, oy, oz + fwd.z * 3, 1.2)
      break
    }
    case 'dash': {
      // atravessa para frente causando dano
      const dashD = 7
      const steps = 12
      sfx('zap')
      for (let i = 1; i <= steps; i++) {
        const k = (i / steps) * dashD
        const px = ox + fwd.x * k, pz = oz + fwd.z * k
        burst(fxType, px, groundAt(px, pz) + 0.8, pz, 0.8)
        for (const e of enemies) {
          if (!e.dead && Math.hypot(e.pos.x - px, e.pos.z - pz) < 1.6) {
            damageEnemy(e, spell.dmg + p.mag * 0.5, { elem: p.element, from: p.pos, knock: 3 })
          }
        }
      }
      p.pos.x = clamp(ox + fwd.x * dashD, -244, 244)
      p.pos.z = clamp(oz + fwd.z * dashD, -244, 244)
      resolveToGround(p)
      break
    }
    case 'wall': {
      const isIce = p.element === 'Gelo'
      sfx(isIce ? 'ice' : 'earth')
      const wx = tx, wz = tz
      const ang = Math.atan2(fwd.x, fwd.z)
      for (let i = -3; i <= 3; i++) {
        const px = wx + Math.cos(ang) * i * 1.1, pz = wz + Math.sin(ang) * i * 1.1
        const gy = groundAt(px, pz)
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(1, 2.6, 0.8),
          new THREE.MeshLambertMaterial({ color: isIce ? 0xa8d8f0 : 0x8a7a60, transparent: true, opacity: 0.92 }),
        )
        block.position.set(px, gy + 1.3, pz)
        block.rotation.y = ang + Math.PI / 2
        block.castShadow = true
        G.scene.add(block)
        const col = addCollider(px, pz, 0.7, 2.6)
        areas.push({ kind: 'block', mesh: block, t: 12, cols: [col] })
      }
      break
    }
    case 'spikes': {
      sfx('earth')
      for (let i = 1; i <= 5; i++) {
        const px = ox + fwd.x * i * 1.7, pz = oz + fwd.z * i * 1.7
        const gy = groundAt(px, pz)
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 5), new THREE.MeshLambertMaterial({ color: 0x7a6040 }))
        spike.position.set(px, gy + 0.4, pz)
        G.scene.add(spike)
        ring(px, gy, pz, 0xb08a50, 1.6, 0.4)
        areas.push({ kind: 'spikeMesh', mesh: spike, t: 1.6 })
        for (const e of enemies) {
          if (!e.dead && Math.hypot(e.pos.x - px, e.pos.z - pz) < 1.5) {
            damageEnemy(e, spell.dmg + p.mag * 0.4, { elem: 'Terra', from: { x: px, z: pz }, knock: 1 })
          }
        }
        burst('earth', px, gy, pz, 0.9)
      }
      break
    }
    case 'wave': {
      areas.push({ kind: 'wave', x: ox, z: oz, dir: { ...fwd }, t: 1.4, r: spell.aoe, dmg: spell.dmg + p.mag * 0.5, elem: p.element, color, hitSet: new Set() })
      sfx('water')
      break
    }
    case 'tornado': {
      areas.push({ kind: 'tornado', x: tx, z: tz, t: 3, r: spell.aoe, dmg: spell.dmg + p.mag * 0.3, tick: 0, elem: 'Vento', color })
      sfx('wind')
      break
    }
    case 'hurricane': {
      areas.push({ kind: 'hurricane', x: ox, z: oz, t: 2.8, r: spell.aoe, dmg: spell.dmg + p.mag * 0.4, tick: 0, elem: 'Vento', color })
      sfx('wind')
      break
    }
    case 'quake': {
      sfx('thunder')
      ring(ox, oy - 1.3, oz, 0xb08a50, spell.aoe, 0.8)
      for (let i = 0; i < 30; i++) burst('earth', ox + rand(-spell.aoe, spell.aoe) * 0.6, oy - 1.2, oz + rand(-spell.aoe, spell.aoe) * 0.6, 1.3)
      // rachaduras visuais
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2), d = rand(1, spell.aoe)
        const crack = new THREE.Mesh(new THREE.BoxGeometry(rand(0.2, 0.4), 0.1, rand(1.5, 3)), new THREE.MeshBasicMaterial({ color: 0x302010 }))
        crack.position.set(ox + Math.cos(a) * d, groundAt(ox + Math.cos(a) * d, oz + Math.sin(a) * d) + 0.05, oz + Math.sin(a) * d)
        crack.rotation.y = rand(0, Math.PI)
        G.scene.add(crack)
        areas.push({ kind: 'crack', mesh: crack, t: 3 })
      }
      areaDamage(ox, oy, oz, spell.aoe, spell.dmg + p.mag, 'Terra', 10)
      break
    }
    case 'prison': {
      sfx('water')
      areaRoot(tx, ty, tz, spell.aoe, 3.2)
      burst('water', tx, ty + 0.5, tz, 1.4)
      ring(tx, ty, tz, 0x4898ff, spell.aoe, 0.6)
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08)
      sfx('heal')
      burst('heal', ox, oy, oz, 1)
      break
    }
    case 'freeze': {
      sfx('ice')
      areaRoot(ox + fwd.x * 2, oy - 1, oz + fwd.z * 2, spell.aoe, 3.5, true)
      ring(ox + fwd.x * 2, groundAt(ox + fwd.x * 2, oz + fwd.z * 2), oz + fwd.z * 2, 0x90d0ff, spell.aoe, 0.7)
      for (let i = 0; i < 18; i++) burst('frost', ox + fwd.x * 2 + rand(-3, 3), oy + rand(0, 1.5), oz + fwd.z * 2 + rand(-3, 3), 1.1)
      areaDamage(ox + fwd.x * 2, oy, oz + fwd.z * 2, spell.aoe, spell.dmg + p.mag * 0.4, 'Gelo', 4)
      break
    }
    default: break
  }
  if (G.uiApi) G.uiApi.refreshHotbar()
  return true
}

function resolveToGround(p) {
  const g = groundAt(p.pos.x, p.pos.z)
  if (p.pos.y < g) { p.pos.y = g; p.vy = 0 }
}

function areaDamage(x, y, z, r, dmg, elem, knock) {
  for (const e of enemies) {
    if (e.dead) continue
    const d = Math.hypot(e.pos.x - x, e.pos.z - z)
    if (d < r + e.radius) {
      damageEnemy(e, dmg * (1 - d / (r * 2.2)), { elem, from: { x, z }, knock })
    }
  }
}

function areaRoot(x, y, z, r, dur, freeze = false) {
  for (const e of enemies) {
    if (e.dead) continue
    if (Math.hypot(e.pos.x - x, e.pos.z - z) < r) {
      e.rooted = Math.max(e.rooted || 0, dur)
      if (freeze) { e.frozen = Math.max(e.frozen || 0, dur); e.rooted = dur }
    }
  }
}

const arcPool = []
function lightningArc(a, b) {
  const segs = 6
  const pts = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    pts.push(new THREE.Vector3(
      a.x + (b.x - a.x) * t + rand(-0.4, 0.4),
      a.y + (b.y - a.y) * t + rand(-0.3, 0.6),
      a.z + (b.z - a.z) * t + rand(-0.4, 0.4),
    ))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xb0d8ff, transparent: true, opacity: 1 }))
  G.scene.add(line)
  arcPool.push({ line, t: 0.18 })
  burst('zap', b.x, b.y + 0.8, b.z, 0.9)
}

/* ---------- atualização por frame ---------- */
export function updateMagic(p, dt) {
  // cooldowns
  for (let i = 0; i < 4; i++) if (p.cds[i] > 0) p.cds[i] -= dt

  // projéteis
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i]
    pr.life -= dt
    pr.vy -= pr.grav * dt
    pr.mesh.position.x += pr.vx * dt
    pr.mesh.position.y += pr.vy * dt
    pr.mesh.position.z += pr.vz * dt
    const px = pr.mesh.position.x, py = pr.mesh.position.y, pz = pr.mesh.position.z
    burstTrail(pr, px, py, pz)

    let hit = pr.life <= 0 || py < groundAt(px, pz) - 0.1
    if (!hit && G.worldApi && py > 0.2) {
      // colisão com paredes (simplificada)
      hit = pointBlockedSafe(px, py, pz)
    }
    let hitEnemy = null
    if (pr.owner === 'player') {
      for (const e of enemies) {
        if (e.dead) continue
        if (pr.hitSet && pr.hitSet.has(e)) continue
        const d = Math.hypot(e.pos.x - px, e.pos.z - pz)
        if (d < e.radius + pr.radius && py < e.pos.y + 2 && py > e.pos.y - 0.5) { hitEnemy = e; break }
      }
    } else {
      const pl = G.player
      if (pl && !pl.dead) {
        const d = Math.hypot(pl.pos.x - px, pl.pos.z - pz)
        if (d < 0.7 + pr.radius && py < pl.pos.y + 2) hitEnemy = pl
      }
    }
    if (hitEnemy) {
      if (pr.pierce && pr.hitSet) {
        pr.hitSet.add(hitEnemy)
        applyProjDamage(pr, hitEnemy)
      } else {
        hit = true
      }
    }
    if (hit) {
      // impacto
      const ix = px, iy = Math.max(py, groundAt(px, pz) + 0.1), iz = pz
      const [fxType, fxCol] = ELEM_FX[pr.elem] || ['magic', 0xffffff]
      burst(fxType, ix, iy, iz, 1.3)
      ring(ix, groundAt(ix, iz), iz, fxCol, pr.aoe * 1.5, 0.4)
      if (pr.aoe > 0) {
        if (pr.owner === 'player') areaDamage(ix, iy, iz, pr.aoe, pr.dmg, pr.elem, 4)
        else {
          const pl = G.player
          if (pl && Math.hypot(pl.pos.x - ix, pl.pos.z - iz) < pr.aoe + 0.4) hurtProjPlayer(pl, pr)
        }
        if (pr.elem === 'Fogo') { sfx('firehit'); for (let k = 0; k < 6; k++) burst('smoke', ix + rand(-0.5, 0.5), iy + rand(0, 0.8), iz + rand(-0.5, 0.5), 0.8) }
        else if (pr.elem === 'Gelo') sfx('icehit')
        else if (pr.elem === 'Raio') sfx('zap')
        else sfx('hit')
      }
      releaseProj(i)
      continue
    }
    if (pr.life <= 0) releaseProj(i)
  }

  // efeitos de área
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i]
    a.t -= dt
    switch (a.kind) {
      case 'rain': {
        a.tick -= dt
        if (a.tick <= 0) {
          a.tick = 0.18
          const rx = a.x + rand(-a.r, a.r) * 0.8, rz = a.z + rand(-a.r, a.r) * 0.8
          spawnProj({ x: rx, y: groundAt(rx, rz) + 9, z: rz, dir: { x: 0, y: -1, z: 0 }, speed: 13, dmg: a.dmg * 0.55, radius: 0.5, aoe: 1.4, elem: a.elem, color: a.color, grav: 0, life: 1.2 })
          burst('fire', rx, groundAt(rx, rz) + 6, rz, 0.6)
        }
        break
      }
      case 'storm': {
        a.tick -= dt
        if (a.tick <= 0) {
          a.tick = 0.4
          const rx = a.x + rand(-a.r, a.r) * 0.9, rz = a.z + rand(-a.r, a.r) * 0.9
          const gy = groundAt(rx, rz)
          strikeBolt(rx, gy, rz)
          sfx('zap')
          areaDamage(rx, gy, rz, 2, a.dmg, 'Raio', 3)
        }
        break
      }
      case 'meteor': {
        a.warn += dt
        if (a.t > 0.35 && a.warn < 0.7 && Math.random() < 0.4) ring(a.x, groundAt(a.x, a.z), a.z, 0xff5020, a.r, 0.5)
        if (a.t <= 0.35 && !a.struck) {
          a.struck = true
          const gy = groundAt(a.x, a.z)
          sfx('thunder')
          ring(a.x, gy, a.z, 0xff7020, a.r * 1.6, 0.7)
          for (let k = 0; k < 24; k++) burst('fire', a.x + rand(-a.r, a.r) * 0.6, gy + rand(0, 2), a.z + rand(-a.r, a.r) * 0.6, 1.5)
          areaDamage(a.x, gy, a.z, a.r, a.dmg, 'Fogo', 9)
          // rocha persistente
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), new THREE.MeshLambertMaterial({ color: 0x5a4030 }))
          rock.position.set(a.x, gy + 0.5, a.z)
          rock.castShadow = true
          G.scene.add(rock)
          areas.push({ kind: 'rock', mesh: rock, t: 6 })
        }
        break
      }
      case 'wave': {
        const k = 1 - a.t / 1.4
        const wx = a.x + a.dir.x * k * 9, wz = a.z + a.dir.z * k * 9
        const gy = groundAt(wx, wz)
        ring(wx, gy, wz, 0x4898ff, a.r, 0.3)
        burst('water', wx, gy + 0.5, wz, 1.4)
        for (const e of enemies) {
          if (e.dead || a.hitSet.has(e)) continue
          if (Math.hypot(e.pos.x - wx, e.pos.z - wz) < a.r * 0.8) {
            a.hitSet.add(e)
            damageEnemy(e, a.dmg, { elem: 'Água', from: { x: wx, z: wz }, knock: 6 })
          }
        }
        break
      }
      case 'tornado':
      case 'hurricane': {
        a.tick -= dt
        const cx = a.kind === 'hurricane' ? a.x : a.x
        if (a.tick <= 0) {
          a.tick = 0.25
          const ang = Math.random() * Math.PI * 2
          const rr = Math.random() * a.r
          burst('wind', cx + Math.cos(ang) * rr, groundAt(cx, a.z) + rand(0, 2.4), a.z + Math.sin(ang) * rr, 1.2)
        }
        for (const e of enemies) {
          if (e.dead) continue
          const d = Math.hypot(e.pos.x - cx, e.pos.z - a.z)
          if (d < a.r) {
            // puxão
            const pull = a.kind === 'hurricane' ? 2.4 : 1.2
            e.pos.x += (cx - e.pos.x) / (d || 1) * pull * dt
            e.pos.z += (a.z - e.pos.z) / (d || 1) * pull * dt
            damageEnemy(e, a.dmg * dt * 2.2, { elem: 'Vento', silent: true })
          }
        }
        break
      }
      case 'block':
      case 'rock':
      case 'crack':
      case 'spikeMesh': {
        if (a.mesh && a.t < 1.2) {
          a.mesh.traverse?.((o) => { })
          if (a.mesh.material.transparent || true) {
            a.mesh.material.transparent = true
            a.mesh.material.opacity = clamp(a.t / 1.2, 0, 1)
          }
        }
        if (a.t <= 0 && a.mesh) {
          G.scene.remove(a.mesh)
          if (a.cols) for (const c of a.cols) c.r = 0.01
          a.mesh.geometry.dispose?.()
          areas.splice(i, 1)
          continue
        }
        break
      }
      default: break
    }
    if (a.t <= 0) areas.splice(i, 1)
  }

  // raios visuais
  for (let i = arcPool.length - 1; i >= 0; i--) {
    const ar = arcPool[i]
    ar.t -= dt
    ar.line.material.opacity = clamp(ar.t / 0.18, 0, 1)
    if (ar.t <= 0) {
      G.scene.remove(ar.line)
      ar.line.geometry.dispose()
      arcPool.splice(i, 1)
    }
  }
}

function strikeBolt(x, y, z) {
  const pts = []
  let cx = x
  for (let i = 0; i <= 8; i++) {
    pts.push(new THREE.Vector3(cx, y + i * 1.3, z + rand(-0.3, 0.3)))
    cx += rand(-0.35, 0.35)
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xcfe0ff }))
  G.scene.add(line)
  arcPool.push({ line, t: 0.2 })
  burst('zap', x, y + 0.3, z, 1.2)
  ring(x, y, z, 0xa8c8ff, 2.2, 0.35)
}

function burstTrail(pr, x, y, z) {
  if (Math.random() < 0.55) {
    const [fxType] = ELEM_FX[pr.elem] || ['magic']
    burst(fxType, x, y, z, 0.4)
  }
}

function pointBlockedSafe(x, y, z) {
  const near = G.colliderGrid.get(`${Math.floor(x / 12)},${Math.floor(z / 12)}`)
  if (!near) return false
  for (const c of near) {
    if (Math.hypot(x - c.x, z - c.z) < c.r && y > c.y0 && y < c.y0 + c.h) return true
  }
  return false
}

function applyProjDamage(pr, e) {
  damageEnemy(e, pr.dmg, { elem: pr.elem, from: G.player ? G.player.pos : pr.mesh.position, knock: 3 })
  const [fxType] = ELEM_FX[pr.elem] || ['magic']
  burst(fxType, e.pos.x, e.pos.y + 1, e.pos.z, 0.8)
}

function hurtProjPlayer(pl, pr) {
  // dano de projétil inimigo
  const { hurtPlayer } = playerMod
  hurtPlayer(pl, pr.dmg, pr.mesh.position.x, pr.mesh.position.z, {})
}

import { hurtPlayer } from './player.js'
const playerMod = { hurtPlayer }

function releaseProj(i) {
  const pr = projs[i]
  pr.mesh.visible = false
  projPool.push(pr.mesh)
  projs.splice(i, 1)
}

export function clearProjectiles() {
  for (let i = projs.length - 1; i >= 0; i--) releaseProj(i)
  areas.length = 0
}
