/* ============================================================
   Mundo — terreno, vila, cidade, castelo, natureza e regiões.
   ============================================================ */
import * as THREE from 'three'
import { G, addCollider, smoothstep, lerp, rand, randInt, pick, TAU } from './state.js'

export const WATER_Y = -0.8
export const VILLAGE = { x: 0, z: 0 }
export const CITY = { x: 150, z: -30 }
export const CASTLE_HALL = { x: 150, z: -56 }
export const LAKE = { x: 40, z: 115 }
export const RIVER_X = 60

export const CAMPS = [
  { x: -95, z: -105, r: 'Acampamento Goblin' },
  { x: 112, z: 128, r: 'Acampamento Goblin' },
  { x: -168, z: -48, r: 'Acampamento Goblin' },
]
export const RUINS = { x: -45, z: -158 }
export const CAVE = { x: -206, z: 92 }

export const POIS = [
  { name: 'Vila de Pedravale', x: 0, z: 0, icon: '⌂' },
  { name: 'Corvoalta · Castelo', x: 150, z: -30, icon: '♜' },
  { name: 'Floresta de Auberon', x: -130, z: 30, icon: '🌲' },
  { name: 'Lago Lúnula', x: 40, z: 115, icon: '💧' },
  { name: 'Ruínas de Vhalor', x: -45, z: -158, icon: '🏛' },
  { name: 'Serra do Inverno', x: 20, z: -215, icon: '🏔' },
  { name: 'Caverna Umbral', x: -206, z: 92, icon: '洞穴' },
  ...CAMPS.map((c) => ({ name: 'Acampamento Goblin', x: c.x, z: c.z, icon: '⚔' })),
]

/* ---------- altura do terreno ---------- */
export function heightAt(x, z) {
  const r = Math.max(Math.abs(x), Math.abs(z))
  let h = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 2.4
    + Math.sin(x * 0.043 + z * 0.031) * 0.9
    + Math.sin(x * 0.09) * Math.sin(z * 0.11) * 0.3
  const edge = smoothstep(165, 248, r)
  h += edge * edge * (16 + Math.abs(Math.sin(x * 0.028 + z * 0.024)) * 15 + Math.cos(x * 0.05) * Math.sin(z * 0.045) * 6)
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z)
  h = lerp(h, 0.5, 1 - smoothstep(26, 52, dv))
  const dc = Math.hypot(x - CITY.x, z - CITY.z)
  h = lerp(h, 1.2, 1 - smoothstep(30, 55, dc))
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z)
  h -= smoothstep(58, 20, dl) * 4.5
  if (z < 62) h -= (1 - smoothstep(3.2, 6.8, Math.abs(x - RIVER_X))) * 3.4
  return h
}

// superfícies artificiais que o jogador pode pisar (pontes)
const surfaces = []
export function groundAt(x, z) {
  let h = heightAt(x, z)
  for (const s of surfaces) {
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y > h) h = s.y
  }
  return h
}

export function regionAt(x, z) {
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 42) return 'Vila de Pedravale'
  if (Math.hypot(x - CITY.x, z - CITY.z) < 58) return 'Corvoalta'
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < 60) return 'Lago Lúnula'
  if (Math.hypot(x - RUINS.x, z - RUINS.z) < 26) return 'Ruínas de Vhalor'
  if (Math.hypot(x - CAVE.x, z - CAVE.z) < 22) return 'Caverna Umbral'
  if (Math.hypot(x + 130, z - 30) < 70) return 'Floresta de Auberon'
  if (z < -190) return 'Serra do Inverno'
  for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < 18) return 'Acampamento Goblin'
  const r = Math.max(Math.abs(x), Math.abs(z))
  if (r > 190) return 'Fronteiras Selvagens'
  return 'Campos de Aetheria'
}

/* ---------- helpers de construção ---------- */
function mat(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }) }
const M = {
  wall: mat(0xb09468), wallStone: mat(0x9a9aa2), roofRed: mat(0x8a4a30), roofSlate: mat(0x54627e),
  wood: mat(0x7a5634), darkWood: mat(0x5a4028), stone: mat(0x82828a), grass: mat(0x4e8a3a),
  gold: mat(0xd8b050, { emissive: 0x503800 }), crystalM: null, banner: mat(0x8a2830), banner2: mat(0x2a4a8a),
  tent: mat(0x9a8a5a), cloth: mat(0xc8b090), snow: mat(0xe8ecf4),
}
M.crystalM = new THREE.MeshStandardMaterial({ color: 0xa0d8ff, emissive: 0x4090c0, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })

function box(w, h, d, material, x, y, z, ry = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z); m.rotation.y = ry
  m.castShadow = shadow; m.receiveShadow = true
  return m
}
function cyl(rt, rb, h, seg, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material)
  m.position.set(x, y, z); m.rotation.y = ry
  m.castShadow = true; m.receiveShadow = true
  return m
}
function cone(r, h, seg, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material)
  m.position.set(x, y, z); m.rotation.y = ry
  m.castShadow = true
  return m
}

function addFirePit(x, z, y, opts = {}) {
  G.firePits.push({ x, y: y + 0.5, z, fx: opts.fx || 'fire', lamp: !!opts.lamp })
  if (!opts.noLight) {
    const l = new THREE.PointLight(opts.lamp ? 0xffc880 : 0xff9040, 0, opts.lamp ? 12 : 9)
    l.position.set(x, y + 1.1, z)
    l.color.set(opts.lamp ? 0xffd090 : 0xff9848)
    G.scene.add(l)
    G.firePits[G.firePits.length - 1].light = l
  }
}

function house(x, z, ry, w = 6, d = 5.4, h = 3, wallMat = M.wall, roofMat = M.roofRed) {
  const g = new THREE.Group()
  const y = groundAt(x, z)
  g.add(box(w, h, d, wallMat, 0, h / 2, 0))
  g.add(box(w + 0.5, 0.25, d + 0.5, M.darkWood, 0, 0.12, 0))
  const roof = cone(Math.max(w, d) * 0.78, 2.4, 4, roofMat, 0, h + 1.15, 0, Math.PI / 4)
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d))
  g.add(roof)
  // porta e janelas
  g.add(box(1, 1.8, 0.12, M.darkWood, 0, 0.9, d / 2 + 0.02))
  g.add(box(0.9, 0.9, 0.08, mat(0x30405a), -w / 4, h * 0.6, d / 2 + 0.02))
  g.add(box(0.9, 0.9, 0.08, mat(0x30405a), w / 4, h * 0.6, d / 2 + 0.02))
  g.position.set(x, y, z); g.rotation.y = ry
  G.scene.add(g)
  addCollider(x, z, Math.max(w, d) * 0.62, h + 2)
  return g
}

function tower(x, z, h = 9, r = 2.2) {
  const y = groundAt(x, z)
  const t = cyl(r, r + 0.3, h, 10, M.wallStone, x, y + h / 2, z)
  t.add(cone(r + 0.5, 2.6, 10, M.roofSlate, 0, h / 2 + 1.3, 0))
  G.scene.add(t)
  addCollider(x, z, r + 0.35, h)
  return t
}

function lampPost(x, z) {
  const y = groundAt(x, z)
  const g = new THREE.Group()
  g.add(cyl(0.07, 0.09, 3, 6, M.darkWood, 0, 1.5, 0))
  g.add(box(0.34, 0.42, 0.34, mat(0xffe0a0, { emissive: 0xffaa40, emissiveIntensity: 0 }), 0, 3.15, 0))
  g.add(cone(0.3, 0.25, 4, M.darkWood, 0, 3.5, 0, Math.PI / 4))
  g.position.set(x, y, z)
  G.scene.add(g)
  addCollider(x, z, 0.3, 3)
  const lampGlass = g.children[1]
  G.lampMats.push(lampGlass.material)
  addFirePit(x, z, y + 2.6, { lamp: true })
  return g
}

/* ---------- construção do mundo ---------- */
export function buildWorld() {
  buildTerrain()
  buildWater()
  buildVillage()
  buildCity()
  buildCastle()
  buildRoads()
  buildNature()
  buildCamps()
  buildRuins()
  buildCave()
  buildChests()
}

let crystalMesh = null, crystalBase = null
export function getCrystal() { return { mesh: crystalMesh, base: crystalBase } }

function buildTerrain() {
  const size = 500, seg = 210
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const cGrass = new THREE.Color(0x56873b), cGrass2 = new THREE.Color(0x6a9a48),
    cSand = new THREE.Color(0xc8b080), cRock = new THREE.Color(0x7a7468),
    cSnow = new THREE.Color(0xe8edf4), cDirt = new THREE.Color(0x8a7048)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const y = heightAt(x, z)
    pos.setY(i, y)
    if (y < WATER_Y + 0.4) tmp.copy(cSand)
    else if (y > 15) tmp.copy(cSnow).lerp(cRock, clamp((18 - y) / 5, 0, 1))
    else if (y > 8.5) tmp.copy(cRock).lerp(cGrass, clamp((12 - y) / 4, 0, 1))
    else {
      tmp.copy(cGrass).lerp(cGrass2, Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.05)))
      if (Math.abs(Math.sin(x * 0.013 + 3) * Math.cos(z * 0.017)) > 0.82) tmp.lerp(cDirt, 0.5)
    }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  terrain.receiveShadow = true
  G.scene.add(terrain)
}

let waterMesh
function buildWater() {
  const geo = new THREE.PlaneGeometry(500, 500)
  geo.rotateX(-Math.PI / 2)
  waterMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2e6aa8, transparent: true, opacity: 0.72 }))
  waterMesh.position.y = WATER_Y
  G.scene.add(waterMesh)
}

function buildVillage() {
  const vx = VILLAGE.x, vz = VILLAGE.z
  // praça central com fonte
  const sq = cyl(7, 7.4, 0.25, 24, mat(0x9a9a92), vx, groundAt(vx, vz) + 0.12, vz)
  sq.receiveShadow = true
  G.scene.add(sq)
  const basin = cyl(2.2, 2.4, 0.8, 16, M.stone, vx, groundAt(vx, vz) + 0.65, vz)
  G.scene.add(basin)
  const wtr = cyl(1.9, 1.9, 0.5, 16, mat(0x3a7ac0, { transparent: true, opacity: 0.7 }), vx, groundAt(vx, vz) + 0.95, vz)
  G.scene.add(wtr)
  G.scene.add(cyl(0.3, 0.4, 1.6, 8, M.stone, vx, groundAt(vx, vz) + 1.6, vz))
  addCollider(vx, vz, 2.6, 2)

  house(vx - 12, vz + 8, 0.4)
  house(vx + 11, vz + 9, -0.5, 6.6, 6, 3.6, M.wall, M.roofSlate) // taverna
  house(vx - 13, vz - 9, 2.2, 5.4, 5, 3, M.wallStone, M.roofSlate) // igreja
  G.scene.add(cone(0.9, 2.2, 4, M.gold, vx - 13, groundAt(vx - 13, vz - 9) + 6.6, vz - 9, Math.PI / 4))
  house(vx + 13, vz - 8, -2.4, 5.6, 5, 2.9) // ferreiro
  // chaminé + forja
  G.scene.add(box(0.9, 3.4, 0.9, M.stone, vx + 14.5, groundAt(vx + 14.5, vz - 8) + 1.7, vz - 9.5))
  addFirePit(vx + 12.6, vz - 5.4, groundAt(vx + 12.6, vz - 5.4))
  house(vx - 4, vz - 20, 0, 7, 5.6, 3.2) // loja
  house(vx + 3, vz + 21, Math.PI, 6.4, 5.4, 3) // fazenda/casa do agricultor
  // plantação
  for (let i = 0; i < 5; i++) {
    const fx = vx - 12 + i * 2.2, fz = vz + 27
    G.scene.add(box(1.8, 0.25, 3.2, mat(0x6a4a2a), fx, groundAt(fx, fz) + 0.12, fz))
    for (let j = 0; j < 4; j++) G.scene.add(cyl(0.05, 0.09, 0.7, 5, M.grass, fx - 0.6 + j * 0.4, groundAt(fx, fz) + 0.45, fz - 1 + (j % 2)))
  }
  // palco do ancião + bandeiras
  G.scene.add(box(3.4, 0.4, 3, M.wood, vx, groundAt(vx, vz - 12) + 0.2, vz - 12))
  // lampiões
  for (const [lx, lz] of [[vx - 6, vz - 5], [vx + 6, vz - 5], [vx - 6, vz + 6], [vx + 6, vz + 6], [vx - 16, vz], [vx + 16, vz]]) lampPost(lx, lz)
  // cerca
  for (let i = 0; i < 8; i++) {
    const px = vx - 20 + i * 1.4, pz = vz + 30.5
    G.scene.add(box(0.12, 1, 0.12, M.wood, px, groundAt(px, pz) + 0.5, pz))
  }
  // animais: ovelhas estáticas simples + galinhas
  for (let i = 0; i < 4; i++) {
    const sx = vx - 16 + i * 3, sz = vz + 25 + (i % 2) * 2
    const y = groundAt(sx, sz)
    const sheep = new THREE.Group()
    sheep.add(box(1.1, 0.8, 0.7, mat(0xe8e4da), 0, 0.55, 0))
    sheep.add(box(0.5, 0.45, 0.4, mat(0x3a3a3a), 0.7, 0.75, 0))
    for (const [lx, lz] of [[-0.35, 0.2], [0.35, 0.2], [-0.35, -0.2], [0.35, -0.2]]) sheep.add(box(0.14, 0.5, 0.14, mat(0x3a3a3a), lx, 0.2, lz))
    sheep.position.set(sx, y, sz)
    sheep.traverse((o) => { if (o.isMesh) o.castShadow = true })
    G.scene.add(sheep)
  }
  lampPost(vx, vz + 34)
}

function buildCity() {
  const cx = CITY.x, cz = CITY.z
  const R = 42
  const wallMat = M.wallStone
  // muralha em segmentos com portão a oeste
  const gateAng = Math.atan2(VILLAGE.z - cz, VILLAGE.x - cx) // direção oeste
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * TAU
    const dAng = Math.abs(((ang - gateAng + Math.PI * 3) % TAU) - Math.PI)
    if (dAng < 0.14) continue // abertura do portão
    const px = cx + Math.cos(ang) * R, pz = cz + Math.sin(ang) * R
    const y = groundAt(px, pz)
    const seg = box(4.4, 6.5, 1.6, wallMat, px, y + 3.2, pz, -ang)
    G.scene.add(seg)
    if (a % 8 === 0) G.scene.add(box(0.4, 1, 1.8, wallMat, px, y + 6.8, pz, -ang))
    addCollider(px, pz, 2.4, 7)
  }
  // torres do portão
  const gx = cx + Math.cos(gateAng) * R, gz = cz + Math.sin(gateAng) * R
  const px2 = cx + Math.cos(gateAng + 0.16) * R, pz2 = cz + Math.sin(gateAng + 0.16) * R
  const px3 = cx + Math.cos(gateAng - 0.16) * R, pz3 = cz + Math.sin(gateAng - 0.16) * R
  tower(px2, pz2, 10, 2.4); tower(px3, pz3, 10, 2.4)
  // portão de madeira aberto
  G.scene.add(box(1.2, 6, 0.5, M.darkWood, gx + Math.cos(gateAng) * 0.8, groundAt(gx, gz) + 3, gz + Math.sin(gateAng) * 0.8, gateAng + Math.PI / 2))
  // praça e casas
  const sqy = groundAt(cx, cz)
  const sq = cyl(10, 10.4, 0.3, 24, mat(0x9a9a92), cx, sqy + 0.15, cz)
  sq.receiveShadow = true; G.scene.add(sq)
  const positions = [
    [-16, -14], [-20, 2], [-16, 16], [2, -18], [12, -14], [-2, 14], [10, 12], [18, -2], [18, 10], [-6, -24],
  ]
  for (let i = 0; i < positions.length; i++) {
    const [ox, oz] = positions[i]
    house(cx + ox, cz + oz, Math.atan2(-oz, -ox) + Math.PI / 2, rand(5.4, 7), rand(5, 6.4), rand(3, 4), i % 3 === 0 ? M.wallStone : M.wall, i % 2 ? M.roofSlate : M.roofRed)
  }
  // mercado: bancas com toldos
  for (let i = 0; i < 4; i++) {
    const mx = cx - 4 + i * 5, mz = cz + 5
    const my = groundAt(mx, mz)
    G.scene.add(box(2.6, 0.9, 1.4, M.wood, mx, my + 0.45, mz))
    G.scene.add(box(3, 0.1, 2, mat([0xa03040, 0x3060a0, 0xa08030, 0x40a060][i]), mx, my + 2.2, mz))
    for (const s of [-1, 1]) G.scene.add(cyl(0.05, 0.05, 2.2, 5, M.wood, mx + s * 1.3, my + 1.1, mz + 0.8))
    addCollider(mx, mz, 1.5, 2)
  }
  for (const [lx, lz] of [[cx - 10, cz - 4], [cx + 10, cz - 4], [cx, cz + 9], [gx - 2, gz]]) lampPost(lx, lz)
}

function buildCastle() {
  const hx = CASTLE_HALL.x, hz = CASTLE_HALL.z
  const y = groundAt(hx, hz)
  // plataforma
  const plat = box(22, 1, 18, M.stone, hx, y + 0.5, hz)
  plat.receiveShadow = true; G.scene.add(plat)
  const fy = y + 1
  // paredes do salão (entrada ao sul = +z)
  const W = 18, D = 14, H = 8, T = 0.9
  G.scene.add(box(W, H, T, M.wallStone, hx, fy + H / 2, hz - D / 2)) // fundo
  G.scene.add(box(T, H, D, M.wallStone, hx - W / 2, fy + H / 2, hz))
  G.scene.add(box(T, H, D, M.wallStone, hx + W / 2, fy + H / 2, hz))
  // frente com vãos
  G.scene.add(box(5.5, H, T, M.wallStone, hx - (W / 2 - 2.75), fy + H / 2, hz + D / 2))
  G.scene.add(box(5.5, H, T, M.wallStone, hx + (W / 2 - 2.75), fy + H / 2, hz + D / 2))
  G.scene.add(box(W, 2.2, T, M.wallStone, hx, fy + H - 1.1, hz + D / 2))
  for (const s of [-1, 1]) addCollider(hx + s * (W / 2 - 1.4), hz + D / 2, 2.6, H)
  addCollider(hx, hz - D / 2, W / 2 + 0.4, H)
  for (const s of [-1, 1]) addCollider(hx + s * W / 2, hz, 1, H)
  // telhado
  const roof = cone(W * 0.72, 4.5, 4, M.roofSlate, hx, fy + H + 2.2, hz, Math.PI / 4)
  roof.scale.set(1, 1, D / W)
  G.scene.add(roof)
  // torres do castelo
  tower(hx - 10, hz - 8, 14, 2.6); tower(hx + 10, hz - 8, 14, 2.6)
  tower(hx - 10, hz + 7, 11, 2.2); tower(hx + 10, hz + 7, 11, 2.2)
  // bandeiras
  for (const s of [-1, 1]) {
    G.scene.add(cyl(0.08, 0.08, 7, 6, M.darkWood, hx + s * 6, fy + 3.5, hz + D / 2 + 0.6))
    G.scene.add(box(1.6, 1, 0.06, s > 0 ? M.banner : M.banner2, hx + s * 6 + s * 0.85, fy + 6.3, hz + D / 2 + 0.6))
  }
  // colunas internas
  for (const sx of [-5, 0, 5]) for (const sz of [-3.5, 3.5]) {
    G.scene.add(cyl(0.5, 0.6, H, 10, M.stone, hx + sx, fy + H / 2, hz + sz))
    addCollider(hx + sx, hz + sz, 0.7, H)
  }
  // tochas internas
  addFirePit(hx - 6, hz + 5.6, fy + 2); addFirePit(hx + 6, hz + 5.6, fy + 2)
  addFirePit(hx - 6, hz - 5.6, fy + 2); addFirePit(hx + 6, hz - 5.6, fy + 2)
  // dais + cristal
  crystalBase = cyl(2.6, 3, 0.7, 12, M.stone, hx, fy + 0.35, hz)
  G.scene.add(crystalBase)
  addCollider(hx, hz, 2.4, 1.2)
  crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), M.crystalM)
  crystalMesh.position.set(hx, fy + 2.4, hz)
  crystalMesh.castShadow = true
  G.scene.add(crystalMesh)
  const glow = new THREE.PointLight(0x80c0ff, 0.8, 14)
  glow.position.set(hx, fy + 2.6, hz)
  G.scene.add(glow)
  crystalMesh.userData.glow = glow
}

// estrada: polilinha + segmentos visuais
const ROAD = [
  [0, 12], [14, 14], [34, 2], [48, -14], [60, -30], [80, -30], [100, -30], [108, -30],
  [116, -30], [134, -30],
]
function buildRoads() {
  const pathMat = mat(0x9a8560)
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [x0, z0] = ROAD[i], [x1, z1] = ROAD[i + 1]
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.ceil(len / 3)
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const px = lerp(x0, x1, t) + rand(-0.5, 0.5), pz = lerp(z0, z1, t) + rand(-0.5, 0.5)
      const py = heightAt(px, pz)
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.6), pathMat)
      seg.rotation.x = -Math.PI / 2
      seg.rotation.z = Math.atan2(x1 - x0, z1 - z0)
      seg.position.set(px, py + 0.06, pz)
      seg.receiveShadow = true
      G.scene.add(seg)
    }
  }
  // ponte sobre o rio
  const bx = RIVER_X, bz = -30
  const deck = box(10.5, 0.5, 5.2, M.wood, bx, 2.05, bz)
  G.scene.add(deck)
  for (const s of [-1, 1]) {
    G.scene.add(box(10.5, 0.14, 0.14, M.darkWood, bx, 3, bz + s * 2.5))
    for (const px of [-4.6, 0, 4.6]) G.scene.add(box(0.16, 1.1, 0.16, M.darkWood, bx + px, 2.6, bz + s * 2.5))
    G.scene.add(cyl(0.45, 0.55, 3.6, 8, M.stone, bx + s * 4.4, 0.6, bz))
  }
  surfaces.push({ x0: bx - 5.2, x1: bx + 5.2, z0: bz - 2.6, z1: bz + 2.6, y: 2.3 })
  // cachoeira nas montanhas onde o rio nasce
  const wy = heightAt(RIVER_X, -246)
  const wf = box(9, 14, 0.6, mat(0x9cc8e8, { transparent: true, opacity: 0.65 }), RIVER_X, wy + 7, -248)
  G.scene.add(wf)
  G.firePits.push({ x: RIVER_X, y: wy + 1, z: -244, fx: 'water' })
  G.firePits.push({ x: RIVER_X, y: wy + 9, z: -244, fx: 'water' })
}

function clearOf(x, z) {
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 34) return true
  if (Math.hypot(x - CITY.x, z - CITY.z) < 52) return true
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < 56) return true
  if (Math.abs(x - RIVER_X) < 9 && z < 66) return true
  for (const [rx, rz] of ROAD) if (Math.hypot(x - rx, z - rz) < 8) return true
  for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < 15) return true
  if (Math.hypot(x - RUINS.x, z - RUINS.z) < 16) return true
  if (Math.hypot(x - CAVE.x, z - CAVE.z) < 14) return true
  return false
}

function mulberry(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildNature() {
  const rng = mulberry(1234)
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6)
  const leafGeo = new THREE.ConeGeometry(1.7, 3.6, 7)
  const pineGeo = new THREE.ConeGeometry(1.3, 5.2, 7)
  const treeCount = 420, pineCount = 140, rockCount = 150, grassCount = 900, flowerCount = 240
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x6a4a2c), treeCount)
  const leaves = new THREE.InstancedMesh(leafGeo, mat(0x3f7a30), treeCount)
  const pines = new THREE.InstancedMesh(pineGeo, mat(0x2c5a38), pineCount)
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9), mat(0x82828a), rockCount)
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.55, 4), mat(0x5a9a40), grassCount)
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 5, 4), mat(0xffffff), flowerCount)
  const dummy = new THREE.Object3D()
  const cLeaf = new THREE.Color(), cFlower = new THREE.Color()
  let ti = 0, pi = 0, ri = 0, gi = 0, fi = 0
  let guard = 0
  while ((ti < treeCount || pi < pineCount || ri < rockCount || gi < grassCount || fi < flowerCount) && guard++ < 60000) {
    const x = rand(-245, 245), z = rand(-245, 245)
    const y = heightAt(x, z)
    if (clearOf(x, z) || y < WATER_Y + 0.3) continue
    const kind = rng()
    if (kind < 0.42 && ti < treeCount) {
      const s = rand(0.8, 1.4)
      dummy.position.set(x, y + 1.3 * s, z); dummy.rotation.y = rng() * TAU; dummy.scale.setScalar(s)
      dummy.updateMatrix(); trunks.setMatrixAt(ti, dummy.matrix)
      dummy.position.y = y + 2.6 * s + 1.2 * s
      dummy.updateMatrix(); leaves.setMatrixAt(ti, dummy.matrix)
      cLeaf.setHSL(0.29 + rng() * 0.06, 0.5, 0.28 + rng() * 0.12)
      leaves.setColorAt(ti, cLeaf)
      addCollider(x, z, 0.5, 3)
      ti++
    } else if (kind < 0.55 && pi < pineCount) {
      if (y < 6) continue
      const s = rand(0.8, 1.3)
      dummy.position.set(x, y + 1.3 * s, z); dummy.rotation.y = rng() * TAU; dummy.scale.setScalar(s)
      dummy.updateMatrix(); trunks.setMatrixAt(pi, dummy.matrix)
      dummy.position.y = y + 3.4 * s; dummy.updateMatrix(); pines.setMatrixAt(pi, dummy.matrix)
      addCollider(x, z, 0.5, 3)
      pi++
    } else if (kind < 0.72 && ri < rockCount) {
      const s = rand(0.4, 1.6)
      dummy.position.set(x, y + 0.3 * s, z); dummy.rotation.set(rng(), rng() * TAU, rng()); dummy.scale.setScalar(s)
      dummy.updateMatrix(); rocks.setMatrixAt(ri, dummy.matrix)
      if (s > 0.9) addCollider(x, z, s * 0.8, s)
      ri++
    } else if (kind < 0.94 && gi < grassCount) {
      dummy.position.set(x, y + 0.22, z); dummy.rotation.y = rng() * TAU; dummy.scale.setScalar(rand(0.7, 1.4))
      dummy.updateMatrix(); grass.setMatrixAt(gi, dummy.matrix); gi++
    } else if (fi < flowerCount) {
      dummy.position.set(x, y + 0.12, z); dummy.scale.setScalar(1)
      dummy.updateMatrix(); flowers.setMatrixAt(fi, dummy.matrix)
      cFlower.setHSL(rng(), 0.75, 0.65); flowers.setColorAt(fi, cFlower); fi++
    }
  }
  for (const im of [trunks, leaves, pines, rocks, grass, flowers]) {
    im.castShadow = true; im.receiveShadow = true
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    G.scene.add(im)
  }
  // nuvens
  for (let i = 0; i < 14; i++) {
    const cx = rand(-350, 350), cz = rand(-350, 350)
    const cloud = new THREE.Group()
    for (let j = 0; j < randInt(3, 6); j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(7, 14), 7, 5), new THREE.MeshLambertMaterial({ color: 0xf0f2f6, transparent: true, opacity: 0.82, fog: false }))
      puff.position.set(rand(-14, 14), rand(-3, 3), rand(-10, 10))
      puff.scale.y = 0.5
      cloud.add(puff)
    }
    cloud.position.set(cx, rand(85, 130), cz)
    cloud.userData.speed = rand(1, 2.4)
    G.scene.add(cloud)
    G.clouds.push(cloud)
  }
}

function buildCamps() {
  for (const c of CAMPS) {
    const y = groundAt(c.x, c.z)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + rand(0, 0.5)
      const tx = c.x + Math.cos(a) * 6, tz = c.z + Math.sin(a) * 6
      const ty = groundAt(tx, tz)
      const tent = cone(2.2, 2.8, 5, M.tent, tx, ty + 1.4, tz)
      G.scene.add(tent)
      addCollider(tx, tz, 1.9, 2.8)
    }
    // fogueira central + espetos + totem
    const fx = c.x, fz = c.z
    for (let i = 0; i < 5; i++) {
      const st = cyl(0.08, 0.08, 1.6, 5, M.darkWood, fx + Math.cos(i) * 0.7, groundAt(fx, fz) + 0.4, fz + Math.sin(i) * 0.7)
      st.rotation.z = rand(-0.4, 0.4); G.scene.add(st)
    }
    addFirePit(fx, fz, groundAt(fx, fz))
    G.scene.add(cyl(0.4, 0.6, 2.4, 6, M.darkWood, c.x + 3, groundAt(c.x + 3, c.z + 3) + 1.2, c.z + 3))
    G.scene.add(box(0.5, 0.5, 0.1, mat(0x8a2020), c.x + 3, groundAt(c.x + 3, c.z + 3) + 2.4, c.z + 3))
  }
}

function buildRuins() {
  const rx = RUINS.x, rz = RUINS.z
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU
    const px = rx + Math.cos(a) * 9, pz = rz + Math.sin(a) * 9
    const h = rand(1.5, 5)
    const col = cyl(rand(0.5, 0.7), rand(0.6, 0.8), h, 8, M.wallStone, px, groundAt(px, pz) + h / 2, pz, rand(0, 0.3))
    G.scene.add(col)
    addCollider(px, pz, 0.8, h)
  }
  const altar = box(3, 0.8, 3, M.wallStone, rx, groundAt(rx, rz) + 0.4, rz)
  G.scene.add(altar)
  addCollider(rx, rz, 2, 1)
  G.scene.add(box(1, 1.4, 1, M.wallStone, rx, groundAt(rx, rz) + 1.5, rz))
}

function buildCave() {
  const cx = CAVE.x, cz = CAVE.z
  const y = groundAt(cx, cz)
  // boca da caverna: arco de pedras + interior escuro
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.9, 8, 14, Math.PI), M.wallStone)
  arch.position.set(cx, y, cz)
  arch.rotation.y = Math.PI / 2
  arch.castShadow = true
  G.scene.add(arch)
  const dark = new THREE.Mesh(new THREE.CircleGeometry(2.9, 16), new THREE.MeshBasicMaterial({ color: 0x05070c }))
  dark.position.set(cx + 0.1, y + 1.2, cz)
  dark.rotation.y = Math.PI / 2
  G.scene.add(dark)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.2, 2.4)), M.wallStone)
    r.position.set(cx + 2 + Math.cos(a) * 5, groundAt(cx + 2, cz) + rand(0.3, 1), cz + Math.sin(a) * 6)
    r.castShadow = true
    G.scene.add(r)
  }
  addCollider(cx - 3.4, cz, 1.6, 4); addCollider(cx + 3.4, cz, 1.6, 4)
}

const CHESTS = [
  { x: 10, z: -34, loot: 'gold' }, { x: -34, z: 20, loot: 'potion' },
  { x: -120, z: 44, loot: 'gold' }, { x: 34, z: 96, loot: 'potion' },
  { x: -95, z: -110, loot: 'gold' }, { x: 108, z: 134, loot: 'weapon' },
  { x: -45, z: -152, loot: 'weapon' }, { x: 20, z: -200, loot: 'gold' },
]
export const chests = []
function buildChests() {
  for (const c of CHESTS) {
    const y = groundAt(c.x, c.z)
    const g = new THREE.Group()
    g.add(box(1.1, 0.7, 0.8, M.wood, 0, 0.35, 0))
    g.add(box(1.1, 0.3, 0.8, M.darkWood, 0, 0.82, -0.25))
    g.add(box(0.2, 0.2, 0.06, M.gold, 0, 0.55, 0.42))
    g.position.set(c.x, y, c.z)
    g.traverse((o) => { if (o.isMesh) o.castShadow = true })
    G.scene.add(g)
    chests.push({ ...c, mesh: g, opened: false, pos: new THREE.Vector3(c.x, y, c.z) })
  }
}

export function updateWorld(dt, t) {
  if (waterMesh) waterMesh.position.y = WATER_Y + Math.sin(t * 1.2) * 0.05
  if (crystalMesh) {
    crystalMesh.rotation.y += dt * 0.8
    crystalMesh.position.y = crystalBase.position.y + 1.7 + Math.sin(t * 1.6) * 0.15
    crystalMesh.rotation.x = Math.sin(t * 0.7) * 0.15
  }
  for (const c of G.clouds) {
    c.position.x += c.userData.speed * dt
    if (c.position.x > 380) c.position.x = -380
  }
}
