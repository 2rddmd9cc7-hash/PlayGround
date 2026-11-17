/* ============================================================
   NPCs vivos — rotinas diárias, diálogos e reações à invasão.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, rand, damp, angleDiff, addCollider, resolveCircle } from './state.js'
import { groundAt } from './world.js'
import { enemies, damageEnemy } from './enemies.js'
import { sfx } from './audio.js'

const npcs = []
export { npcs }

const SKIN = [0xd8a878, 0xc09060, 0xe0b890, 0xa87850, 0x8a5a38]
const CLOTH = [0x4a6a8a, 0x7a4a3a, 0x5a7a4a, 0x8a7a4a, 0x6a4a6a, 0x3a5a6a]

function labelSprite(text, color = '#e8d48a') {
  const cv = document.createElement('canvas')
  cv.width = 256; cv.height = 64
  const ctx = cv.getContext('2d')
  ctx.font = 'bold 26px Georgia'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 10, 256, 44)
  ctx.fillStyle = color
  ctx.fillText(text, 128, 33)
  const tex = new THREE.CanvasTexture(cv)
  tex.minFilter = THREE.LinearFilter
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(2.2, 0.55, 1)
  return sp
}

function buildNpcRig(n, colors) {
  const g = new THREE.Group()
  const s = n.child ? 0.72 : n.guard ? 1.05 : 1
  const mk = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; return me }
  const skin = new THREE.MeshLambertMaterial({ color: colors.skin })
  const cloth = new THREE.MeshLambertMaterial({ color: colors.cloth })
  const pants = new THREE.MeshLambertMaterial({ color: 0x4a3a2c })
  const metal = new THREE.MeshStandardMaterial({ color: 0xa8a8b0, metalness: 0.6, roughness: 0.45 })
  const body = mk(new THREE.BoxGeometry(0.46 * s, 0.55 * s, 0.26 * s), n.guard ? metal : cloth, 0, 1.15 * s, 0)
  const head = mk(new THREE.SphereGeometry(0.2 * s, 9, 8), skin, 0, 1.66 * s, 0)
  const hair = mk(new THREE.SphereGeometry(0.22 * s, 9, 8), new THREE.MeshLambertMaterial({ color: colors.hair }), 0, 1.71 * s, -0.03)
  hair.scale.set(1, 0.8, 1)
  const hat = n.profession === 'mago'
    ? mk(new THREE.ConeGeometry(0.28 * s, 0.5 * s, 8), new THREE.MeshLambertMaterial({ color: 0x2a2a5a }), 0, 1.95 * s, 0)
    : null
  const armL = new THREE.Group(); armL.position.set(-0.28 * s, 1.4 * s, 0)
  armL.add(mk(new THREE.BoxGeometry(0.11 * s, 0.42 * s, 0.11 * s), cloth, 0, -0.18 * s, 0))
  const armR = new THREE.Group(); armR.position.set(0.28 * s, 1.4 * s, 0)
  armR.add(mk(new THREE.BoxGeometry(0.11 * s, 0.42 * s, 0.11 * s), cloth, 0, -0.18 * s, 0))
  const legL = new THREE.Group(); legL.position.set(-0.13 * s, 0.86 * s, 0)
  legL.add(mk(new THREE.BoxGeometry(0.14 * s, 0.8 * s, 0.15 * s), pants, 0, -0.4 * s, 0))
  const legR = new THREE.Group(); legR.position.set(0.13 * s, 0.86 * s, 0)
  legR.add(mk(new THREE.BoxGeometry(0.14 * s, 0.8 * s, 0.15 * s), pants, 0, -0.4 * s, 0))
  g.add(body, head, hair, armL, armR, legL, legR)
  if (hat) g.add(hat)
  if (n.guard) {
    g.add(mk(new THREE.BoxGeometry(0.5 * s, 0.1 * s, 0.3 * s), metal, 0, 1.45 * s, 0))
    const spear = new THREE.Group()
    spear.add(mk(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 2.1 * s, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }), 0, 0.2 * s, 0))
    spear.add(mk(new THREE.ConeGeometry(0.06 * s, 0.2 * s, 5), metal, 0, 1.3 * s, 0))
    spear.position.set(0.55 * s, 0.4 * s, 0)
    g.add(spear)
  }
  if (n.profession === 'mago') {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 1.9 * s, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a2a }))
    staff.position.set(0.42 * s, 1.1 * s, 0)
    g.add(staff)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 6, 5), new THREE.MeshBasicMaterial({ color: 0x90c0ff }))
    orb.position.set(0.42 * s, 2.05 * s, 0)
    g.add(orb)
  }
  const label = labelSprite(n.name, n.guard ? '#c8d0e0' : '#e8d48a')
  label.position.y = 2.15 * s
  g.add(label)
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  n.rig = g
  n.parts = { armL, armR, legL, legR, body, head, label }
  n.scale = s
}

export function createNpc(def) {
  const n = {
    ...def,
    home: def.home || { x: 0, z: 0 },
    work: def.work || def.home || { x: 0, z: 0 },
    radius: def.child ? 0.28 : 0.38,
    pos: new THREE.Vector3(def.home.x, groundAt(def.home.x, def.home.z), def.home.z),
    yaw: rand(0, Math.PI * 2), moving: false, walkT: rand(0, 9),
    target: null, waitT: rand(0, 3), lineIdx: 0, panic: false,
    attackCd: 0, aggro: null, hp: 60,
    lines: def.lines || ['Bom dia, viajante.'],
    special: def.special || null,
  }
  const colors = def.colors || { skin: SKIN[Math.floor(Math.random() * SKIN.length)], cloth: CLOTH[Math.floor(Math.random() * CLOTH.length)], hair: 0x4a3320 }
  buildNpcRig(n, colors)
  n.rig.position.copy(n.pos)
  G.scene.add(n.rig)
  npcs.push(n)
  return n
}

export function createAllNpcs() {
  // --- vila ---
  createNpc({
    id: 'oran', name: 'Ancião Oran', profession: 'ancião', home: { x: -2, z: -8 }, work: { x: 0, z: -12 },
    colors: { skin: 0xc8a078, cloth: 0x6a5a8a, hair: 0xd8d8d8 }, static: true, special: 'elder',
    lines: [
      'Ah… você finalmente acordou. Aetheria precisa de você, jovem.',
      'Há séculos o Cristal do Poder aguarda alguém digno no castelo de Corvoalta.',
      'Vá até o castelo e faça o Teste. Seu destino será revelado.',
    ],
  })
  createNpc({
    id: 'brann', name: 'Ferreiro Brann', profession: 'ferreiro', home: { x: 14, z: -9 }, work: { x: 12, z: -5 },
    colors: { skin: 0xb08050, cloth: 0x6a4a2a, hair: 0x3a2a1a }, special: 'shop',
    lines: [
      'Aço novo, forjado no fogo da minha forja. Quer comprar?',
      'Um bom ferreiro vale mais que um exército, não acha?',
    ],
  })
  createNpc({
    id: 'mila', name: 'Comerciante Mila', profession: 'comerciante', home: { x: -5, z: -20 }, work: { x: -4, z: -17 },
    colors: { skin: 0xd8a878, cloth: 0x7a4a6a, hair: 0x5a3a1a }, special: 'shop',
    lines: [
      'Poções fresquinhas! Não saia de casa sem elas.',
      'Dizem que goblins foram vistos ao norte. Melhor levar uma lâmina.',
    ],
  })
  createNpc({
    id: 'hugo', name: 'Taverneiro Hugo', profession: 'taverneiro', home: { x: 11, z: 9 }, work: { x: 11, z: 6 },
    colors: { skin: 0xc09060, cloth: 0x8a6a3a, hair: 0x4a3320 },
    lines: [
      'O hidromel da casa é o melhor de Pedravale!',
      'Aventureiros contam histórias estranhas sobre as Ruínas de Vhalor…',
    ],
  })
  createNpc({
    id: 'ivo', name: 'Sacerdote Ivo', profession: 'sacerdote', home: { x: -13, z: -9 }, work: { x: -13, z: -6 },
    colors: { skin: 0xd8b890, cloth: 0xd8d0b8, hair: 0x8a8070 }, special: 'heal',
    lines: [
      'Que a Luz preserve seu caminho, filho.',
      'O cristal escolhe, não julga. Aceite o que ele revelar.',
    ],
  })
  createNpc({
    id: 'tom', name: 'Agricultor Tom', profession: 'agricultor', home: { x: 3, z: 21 }, work: { x: -6, z: 27 },
    colors: { skin: 0xb08050, cloth: 0x6a7a3a, hair: 0x5a4020 },
    lines: ['As cabras estão fugindo de novo…', 'A colheita vai bem, graças aos deuses.'],
  })
  createNpc({
    id: 'toren', name: 'Guarda Toren', profession: 'guarda', home: { x: 4, z: 8 }, work: { x: 6, z: 4 },
    colors: { skin: 0xc89868, cloth: 0x3a4a6a, hair: 0x3a2a1a }, guard: true,
    lines: ['Mantenha-se longe de problemas e não teremos problemas.', 'O castelo fica a leste, seguindo a estrada.'],
  })
  const villagers = [
    ['Lia', 0x4a6a8a, -8, 6], ['Bento', 0x6a5a3a, 12, 2], ['Sora', 0x5a4a6a, -14, 2], ['Cael', 0x3a6a5a, 4, -18],
  ]
  for (const [name, cloth, x, z] of villagers) {
    createNpc({
      id: name.toLowerCase(), name, profession: 'aldeão', home: { x, z }, work: { x: x + 2, z: z + 1 },
      colors: { skin: SKIN[Math.floor(Math.random() * SKIN.length)], cloth, hair: 0x4a3320 }, wander: 7,
      lines: ['Bom dia!', 'O clima está agradável hoje.', 'Dizem que o Ancião quer falar com você.', 'Cuidado com os goblins nas estradas.'],
    })
  }
  for (const [name, x, z] of [['Nino', 3, 3], ['Pia', -3, 5]]) {
    createNpc({
      id: name.toLowerCase(), name, profession: 'criança', home: { x, z }, work: { x: x + 4, z: z + 3 },
      colors: { skin: 0xe0b890, cloth: 0x8a5a3a, hair: 0x6a4a20 }, child: true, wander: 9, speed: 2.6,
      lines: ['Pega-pega! Você é o goblin!', 'Quando eu crescer vou ser cavaleiro!', 'Você viu meu gato?'],
    })
  }
  // --- cidade / castelo ---
  createNpc({
    id: 'dario', name: 'Capitão Dario', profession: 'guarda', home: { x: 148, z: -47 }, work: { x: 146, z: -46 },
    colors: { skin: 0xc09060, cloth: 0x2a3a5a, hair: 0x2a1a10 }, guard: true, special: 'captain', static: true,
    lines: ['O Teste do Poder é logo ali, no Grande Salão.', 'Que os deuses olhem por Corvoalta.'],
  })
  createNpc({
    id: 'elandor', name: 'Mago Elandor', profession: 'mago', home: { x: 142, z: -52 }, work: { x: 142, z: -52 },
    colors: { skin: 0xd0b090, cloth: 0x2a2a5a, hair: 0x909090 }, static: true, special: 'mage',
    lines: ['O cristal reconhece a alma, não a linhagem.', 'Nenhum elemento é fraco. Apenas alguns magos o são.'],
  })
  for (let i = 0; i < 4; i++) {
    createNpc({
      id: `cand${i}`, name: 'Candidato', profession: 'candidato', home: { x: 145 + i * 2.4, z: -45 }, work: { x: 145 + i * 2.4, z: -45 },
      colors: { skin: SKIN[i % SKIN.length], cloth: CLOTH[(i + 2) % CLOTH.length], hair: 0x4a3320 }, static: true,
      lines: ['Estou nervoso. E se o cristal me rejeitar?', 'Ouvi dizer que o elemento é aleatório…', 'Boa sorte, forasteiro.'],
    })
  }
  for (const [name, cloth, x, z] of [['Mercador Vane', 0x8a6a3a, 150, -18], ['Cidadão Aldo', 0x4a5a7a, 140, -12], ['Cidadã Rhea', 0x7a4a5a, 158, -14], ['Guarda Selo', 0x3a4a6a, 112, -30]]) {
    createNpc({
      id: name.split(' ')[1].toLowerCase(), name, profession: name.includes('Guarda') ? 'guarda' : 'cidadão',
      home: { x, z }, work: { x: x + 2, z: z + 2 }, guard: name.includes('Guarda'),
      colors: { skin: SKIN[Math.floor(Math.random() * SKIN.length)], cloth, hair: 0x4a3320 }, wander: 6,
      lines: ['Bem-vindo a Corvoalta.', 'O castelo é imponente, não?', 'O mercado abre ao amanhecer.'],
    })
  }
}

export function updateNpcs(dt) {
  const hour = G.hour
  const day = hour > 5.8 && hour < 20
  const invasion = G.story.flags.invasion
  const p = G.player

  for (const n of npcs) {
    if (!n.rig) continue
    n.attackCd -= dt

    // guardas lutam na invasão
    if (invasion && n.guard && !n.panic) {
      let best = null, bd = 30
      for (const e of enemies) {
        if (e.dead) continue
        const d = Math.hypot(e.pos.x - n.pos.x, e.pos.z - n.pos.z)
        if (d < bd) { bd = d; best = e }
      }
      if (best) {
        n.aggro = best
        const d = bd
        if (d > 1.8) moveNpcTo(n, best.pos.x, best.pos.z, dt, 3.4)
        else {
          n.yaw += angleDiff(n.yaw, Math.atan2(best.pos.x - n.pos.x, best.pos.z - n.pos.z)) * Math.min(1, dt * 8)
          if (n.attackCd <= 0) {
            n.attackCd = 1.1
            damageEnemy(best, 8, { from: n.pos, silent: false, knock: 1 })
          }
        }
        n.rig.position.copy(n.pos)
        n.rig.rotation.y = n.yaw
        animateNpc(n, dt, true)
        continue
      }
    } else if (invasion && !n.guard) {
      n.panic = true
    }

    // rotina
    let tx, tz, speed = n.speed || 1.7, range = n.wander || 3
    if (n.panic) { tx = n.home.x; tz = n.home.z; speed = 3.2 }
    else if (day) { tx = n.work.x; tz = n.work.z }
    else { tx = n.home.x; tz = n.home.z; speed = 1.9 }

    const dx = tx - n.pos.x, dz = tz - n.pos.z
    const dist = Math.hypot(dx, dz)

    if (n.static && !n.panic) {
      n.moving = false
    } else if (dist > range * 0.5 + 0.4) {
      moveNpcTo(n, tx, tz, dt, speed)
    } else {
      // vagueia ao redor do ponto
      n.waitT -= dt
      if (n.waitT <= 0) {
        n.waitT = rand(2, 6)
        n.target = { x: tx + rand(-range, range), z: tz + rand(-range, range) }
      }
      if (n.target) {
        const td = Math.hypot(n.target.x - n.pos.x, n.target.z - n.pos.z)
        if (td > 0.4) moveNpcTo(n, n.target.x, n.target.z, dt, speed * 0.6)
        else { n.target = null; n.moving = false }
      }
    }

    // cumprimenta o jogador
    if (p && !n.panic && Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z) < 4) {
      const targetYaw = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z)
      n.yaw += angleDiff(n.yaw, targetYaw) * Math.min(1, dt * 2)
    }

    const gy = groundAt(n.pos.x, n.pos.z)
    n.pos.y = damp(n.pos.y, gy, 12, dt)
    resolveCircle(n.pos, n.radius)
    n.rig.position.copy(n.pos)
    n.rig.rotation.y = n.yaw
    animateNpc(n, dt, false)
  }
}

function moveNpcTo(n, tx, tz, dt, speed) {
  const dx = tx - n.pos.x, dz = tz - n.pos.z
  const d = Math.hypot(dx, dz) || 1
  if (d < 0.15) { n.moving = false; return }
  n.pos.x += (dx / d) * speed * dt
  n.pos.z += (dz / d) * speed * dt
  n.yaw += angleDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6)
  n.moving = true
  n.walkT += dt * 7 * (speed / 1.7)
}

function animateNpc(n, dt, fighting) {
  const pt = n.parts
  let lL = 0, lR = 0, aL = 0, aR = 0
  if (fighting) {
    const t = performance.now() / 500
    aR = -1.5 + Math.sin(t) * 1.2
  } else if (n.moving) {
    const sw = Math.sin(n.walkT) * 0.45
    lL = sw; lR = -sw; aL = -sw * 0.5; aR = sw * 0.5
  } else {
    const t = performance.now() / 1000 + n.home.x
    aL = Math.sin(t * 1.6) * 0.05; aR = Math.sin(t * 1.6 + 1) * 0.05
  }
  const k = Math.min(1, dt * 10)
  pt.legL.rotation.x += (lL - pt.legL.rotation.x) * k
  pt.legR.rotation.x += (lR - pt.legR.rotation.x) * k
  pt.armL.rotation.x += (aL - pt.armL.rotation.x) * k
  pt.armR.rotation.x += (aR - pt.armR.rotation.x) * k
}

export function nearestNpc(x, z, maxD = 3.2) {
  let best = null, bd = maxD
  for (const n of npcs) {
    if (!n.rig) continue
    const d = Math.hypot(n.pos.x - x, n.pos.z - z)
    if (d < bd) { bd = d; best = n }
  }
  return best
}
