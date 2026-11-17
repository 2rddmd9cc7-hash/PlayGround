/* =========================================================
 * Aetheria — Estruturas do mundo (casas, castelo, pontes…)
 * Cada builder retorna { group, colliders[], lights[], markers[] }
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, randi, pick, chance } from '../core/utils.js';

const M = {};
export function mat(color, rough = 0.85, metal = 0, extra = {}) {
  const key = color + '_' + rough + '_' + metal + JSON.stringify(extra);
  if (!M[key]) M[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return M[key];
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true; b.receiveShadow = true;
  return b;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 8) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  c.position.set(x, y, z);
  c.castShadow = true; c.receiveShadow = true;
  return c;
}

const WALL = mat(0xb0a084, 0.9);        // pedra clara
const WALL_DARK = mat(0x8a7a62, 0.9);
const WOOD = mat(0x6a4a2c, 0.85);
const WOOD_DARK = mat(0x4a3420, 0.85);
const ROOF = mat(0x8a3a28, 0.9);        // telha vermelha
const ROOF2 = mat(0x5a6a72, 0.9);       // telha azul-cinza
const THATCH = mat(0xa08a4a, 0.95);
const PLASTER = mat(0xd8ccb2, 0.95);
const CLOTH_BLUE = mat(0x3a5a8a, 0.9);
const CLOTH_RED = mat(0x8a2a22, 0.9);
const GOLD = mat(0xd8b45a, 0.4, 0.7);
const STONE_WHITE = mat(0xd0c8b8, 0.85);

/* ---------- Casa medieval ---------- */
export function buildHouse(o = {}) {
  const g = new THREE.Group();
  const w = o.w ?? rand(4.5, 6.5), d = o.d ?? rand(4, 5.5), h = o.h ?? rand(2.4, 3);
  const wallM = o.style === 'plaster' ? PLASTER : o.style === 'stone' ? WALL : PLASTER;
  const roofM = o.roof === 'thatch' ? THATCH : o.roof === 'blue' ? ROOF2 : ROOF;
  const base = box(w, h, d, wallM, 0, h / 2);
  g.add(base);
  // vigas de madeira
  for (let i = -1; i <= 1; i++) {
    g.add(box(0.14, h, 0.14, WOOD_DARK, i * w * 0.4, h / 2, d / 2));
    g.add(box(0.14, h, 0.14, WOOD_DARK, i * w * 0.4, h / 2, -d / 2));
  }
  // telhado (prisma)
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.72, h * 0.7, 4, 1), roofM);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, d / Math.max(w, d));
  roof.position.y = h + h * 0.33;
  roof.castShadow = true;
  g.add(roof);
  // porta
  const door = box(0.9, 1.6, 0.08, WOOD_DARK, 0, 0.8, d / 2 + 0.02);
  g.add(door);
  // janelas (emissivas à noite — marcadas)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, emissive: 0x000000, emissiveIntensity: 0 });
  const wins = [];
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), winMat.clone());
    win.position.set(sx * w * 0.28, h * 0.55, d / 2 + 0.03);
    g.add(win); wins.push(win.material);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), winMat.clone());
    win2.position.set(sx * w / 2 + 0.02, h * 0.55, 0);
    win2.rotation.y = Math.PI / 2;
    g.add(win2); wins.push(win2.material);
  }
  // chaminé
  if (o.chimney !== false) g.add(box(0.5, 1.4, 0.5, WALL_DARK, w * 0.3, h + 0.7, -d * 0.2));
  // placa (taverna/loja)
  if (o.sign) {
    const post = cyl(0.06, 0.06, 1.6, WOOD_DARK, w * 0.55, 0.8, d * 0.55);
    g.add(post);
    const board = box(0.9, 0.6, 0.06, WOOD, w * 0.55, 1.5, d * 0.55);
    g.add(board);
    if (o.signColor) {
      const icon = box(0.3, 0.3, 0.02, o.signColor, w * 0.55, 1.5, d * 0.58);
      g.add(icon);
    }
  }
  const colliders = [{ x: 0, z: 0, r: Math.max(w, d) * 0.62, top: h + 1 }];
  return { group: g, colliders, windows: wins };
}

/* ---------- Fonte ---------- */
export function buildFountain() {
  const g = new THREE.Group();
  const base = cyl(2.6, 2.9, 0.7, WALL, 0, 0.35, 0, 12);
  g.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.15, 12), mat(0x3a9ad0, 0.2, 0, { transparent: true, opacity: 0.8 }));
  water.position.y = 0.72;
  g.add(water);
  const pillar = cyl(0.3, 0.4, 1.6, STONE_WHITE, 0, 1.4, 0, 8);
  g.add(pillar);
  const top = cyl(0.9, 0.5, 0.35, STONE_WHITE, 0, 2.2, 0, 10);
  g.add(top);
  const statue = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), GOLD);
  statue.position.y = 2.85;
  g.add(statue);
  return { group: g, colliders: [{ x: 0, z: 0, r: 3, top: 2 }], light: null };
}

/* ---------- Torre de vigia ---------- */
export function buildTower() {
  const g = new THREE.Group();
  const h = 8;
  g.add(cyl(1.7, 2.1, h, WALL, 0, h / 2, 0, 10));
  g.add(cyl(2.2, 2.2, 1.2, WALL_DARK, 0, h + 0.5, 0, 10));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2, 10), ROOF2);
  roof.position.y = h + 2;
  roof.castShadow = true;
  g.add(roof);
  return { group: g, colliders: [{ x: 0, z: 0, r: 2.2, top: h + 2 }] };
}

/* ---------- Muralha (segmento circular) ---------- */
export function buildWallSegment(len) {
  const g = new THREE.Group();
  const h = 7;
  g.add(box(len, h, 2.2, WALL, 0, h / 2, 0));
  // ameias
  const n = Math.floor(len / 2);
  for (let i = 0; i < n; i++) {
    g.add(box(0.9, 0.8, 2.3, WALL_DARK, -len / 2 + 1 + i * 2, h + 0.4, 0));
  }
  return { group: g, colliders: [{ x: 0, z: 0, r: Math.min(len, 12), top: h + 1 }] };
}

/* ---------- Portão da cidade ---------- */
export function buildGate() {
  const g = new THREE.Group();
  g.add(box(2.4, 10, 3, WALL_DARK, -4.2, 5, 0));
  g.add(box(2.4, 10, 3, WALL_DARK, 4.2, 5, 0));
  g.add(box(11, 2.4, 3.4, WALL, 0, 8.6, 0));
  // portas de madeira (fecham na invasão)
  const doorL = box(1.6, 6.4, 0.3, WOOD_DARK, -0.8, 3.2, 0);
  const doorR = box(1.6, 6.4, 0.3, WOOD_DARK, 0.8, 3.2, 0);
  doorL.userData.noMerge = true; doorR.userData.noMerge = true;
  g.add(doorL, doorR);
  const roofL = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 4), ROOF2); roofL.position.set(-4.2, 11.2, 0); roofL.rotation.y = Math.PI / 4; g.add(roofL);
  const roofR = roofL.clone(); roofR.position.x = 4.2; g.add(roofR);
  return { group: g, colliders: [{ x: -4.2, z: 0, r: 1.6, top: 10 }, { x: 4.2, z: 0, r: 1.6, top: 10 }], doors: [doorL, doorR] };
}

/* ---------- Castelo ---------- */
export function buildCastle() {
  const g = new THREE.Group();
  const colliders = [];
  // torreão central
  g.add(box(16, 14, 12, STONE_WHITE, 0, 7, -6));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 7, 4), mat(0x3a5a8a, 0.85));
  roof.position.set(0, 18, -6); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  colliders.push({ x: 0, z: -6, r: 8.5, top: 16 });
  // torres laterais
  for (const sx of [-1, 1]) {
    g.add(cyl(2.6, 3, 17, STONE_WHITE, sx * 9.5, 8.5, -1, 10));
    const tr = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4, 10), mat(0x3a5a8a, 0.85));
    tr.position.set(sx * 9.5, 19.5, -1); tr.castShadow = true;
    g.add(tr);
    colliders.push({ x: sx * 9.5, z: -1, r: 3.1, top: 17 });
    // bandeira
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), mat(0x8a1a12, 1, 0, { side: THREE.DoubleSide }));
    flag.position.set(sx * 9.5, 20, -1);
    g.add(flag);
  }
  // muralha frontal
  g.add(box(30, 8, 2.6, STONE_WHITE, 0, 4, 6));
  colliders.push({ x: 0, z: 6, r: 14, top: 8 });
  // entrada arqueada
  g.add(box(4.4, 6, 2.8, WALL_DARK, 0, 3, 6.1));
  g.add(cyl(2.6, 2.6, 1, WALL, 0, 6, 6, 12));
  // escadaria
  for (let i = 0; i < 4; i++) g.add(box(6, 0.4, 1, WALL_DARK, 0, 0.2 + i * 0.4, 8 - i * 0.9));
  // ** Sala do Teste: rotunda aberta com cristal no pátio **
  const rotunda = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = cyl(0.45, 0.5, 6, STONE_WHITE, Math.cos(a) * 5, 3, Math.sin(a) * 5, 10);
    rotunda.add(col);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a5a8a, 0.8));
  dome.position.y = 5.8;
  dome.castShadow = true;
  rotunda.add(dome);
  const floor = cyl(5.6, 5.8, 0.3, mat(0xc8bfa8, 0.9), 0, 0.15, 0, 20);
  rotunda.add(floor);
  // pedestal + cristal
  const pedestal = cyl(0.7, 0.9, 1.2, mat(0x9a8a6a, 0.7), 0, 0.75, 0, 8);
  rotunda.add(pedestal);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({
    color: 0xbfe8ff, emissive: 0x4488ff, emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9
  }));
  crystal.position.y = 2.6;
  crystal.userData.noMerge = true;
  rotunda.add(crystal);
  rotunda.position.set(0, 0, 16);
  g.add(rotunda);
  colliders.push({ x: 0, z: 16, r: 1.4, top: 2 }); // pedestal
  // luz do cristal
  const cLight = new THREE.PointLight(0x66aaff, 2, 14);
  cLight.position.set(0, 3.4, 16);
  g.add(cLight);
  return { group: g, colliders, crystal, crystalLight: cLight, crystalPos: new THREE.Vector3(0, 2.6, 16) };
}

/* ---------- Igreja / templo ---------- */
export function buildChurch() {
  const g = new THREE.Group();
  g.add(box(7, 5, 10, WALL, 0, 2.5, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5.6, 3, 4, 1), ROOF2);
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 1.8); roof.position.y = 6.4; roof.castShadow = true;
  g.add(roof);
  const tower = box(2.2, 9, 2.2, WALL, -3.4, 4.5, -4);
  g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 4), ROOF2);
  spire.position.set(-3.4, 10.6, -4); spire.rotation.y = Math.PI / 4; spire.castShadow = true;
  g.add(spire);
  const cross = box(0.15, 1, 0.15, GOLD, -3.4, 12.4, -4);
  const cross2 = box(0.6, 0.15, 0.15, GOLD, -3.4, 12.5, -4);
  g.add(cross, cross2);
  return { group: g, colliders: [{ x: 0, z: 0, r: 5.4, top: 6 }, { x: -3.4, z: -4, r: 1.6, top: 10 }] };
}

/* ---------- Ponte ---------- */
export function buildBridge(len = 14) {
  const g = new THREE.Group();
  g.add(box(3.4, 0.5, len, WOOD, 0, 1.2, 0));
  for (const sx of [-1, 1]) {
    g.add(box(0.25, 0.9, len, WOOD_DARK, sx * 1.7, 1.7, 0));
    const n = 3;
    for (let i = 0; i < n; i++) {
      g.add(cyl(0.5, 0.6, 2.4, STONE_WHITE, sx * 1.5, 0.6, -len / 2 + (i + 0.5) * (len / n), 8));
    }
  }
  return { group: g, colliders: [] };
}

/* ---------- Tenda de acampamento ---------- */
export function buildTent() {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 6), mat(0x6a5a3a, 0.95));
  t.position.y = 1.2; t.castShadow = true;
  g.add(t);
  return { group: g, colliders: [{ x: 0, z: 0, r: 1.6, top: 2 }] };
}

/* ---------- Fogueira ---------- */
export function buildCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cyl(0.1, 0.12, 0.7, WOOD_DARK, Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4, 5));
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.9 }));
  flame.position.y = 0.5;
  flame.userData.noMerge = true;
  g.add(flame);
  return { group: g, colliders: [{ x: 0, z: 0, r: 0.8, top: 0.8 }], flame };
}

/* ---------- Ruínas (colunas quebradas) ---------- */
export function buildRuin() {
  const g = new THREE.Group();
  const n = randi(3, 6);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(2, 7);
    const h = rand(1.5, 5);
    const col = cyl(0.5, 0.6, h, mat(0x9a9080, 0.95), Math.cos(a) * r, h / 2, Math.sin(a) * r, 8);
    col.rotation.z = rand(-0.12, 0.12);
    g.add(col);
  }
  // arco caído
  if (chance(0.6)) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.45, 6, 12, Math.PI), mat(0x9a9080, 0.95));
    arc.position.set(rand(-3, 3), 2.2, rand(-3, 3));
    arc.rotation.y = rand(0, Math.PI);
    arc.castShadow = true;
    g.add(arc);
  }
  return { group: g, colliders: [{ x: 0, z: 0, r: 6, top: 1 }] };
}

/* ---------- Estátua ---------- */
export function buildStatue() {
  const g = new THREE.Group();
  g.add(cyl(0.8, 1, 0.6, STONE_WHITE, 0, 0.3, 0, 8));
  g.add(cyl(0.5, 0.6, 1.6, STONE_WHITE, 0, 1.4, 0, 8));
  const figure = box(0.7, 2, 0.5, mat(0x8a8878, 0.85), 0, 2.7, 0);
  g.add(figure);
  const head = box(0.35, 0.4, 0.35, mat(0x8a8878, 0.85), 0, 3.9, 0);
  g.add(head);
  const sword = box(0.1, 1.6, 0.1, mat(0x9a9a8a, 0.6, 0.4), 0.4, 3.4, 0);
  g.add(sword);
  return { group: g, colliders: [{ x: 0, z: 0, r: 0.9, top: 4 }] };
}

/* ---------- Mercado (barraca) ---------- */
export function buildStall() {
  const g = new THREE.Group();
  g.add(box(2.6, 0.9, 1.2, WOOD, 0, 0.45, 0));
  for (const sx of [-1, 1]) g.add(cyl(0.06, 0.06, 2.4, WOOD_DARK, sx * 1.2, 1.2, 0.4, 6));
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.8), pick([CLOTH_BLUE, CLOTH_RED, mat(0x4a7a3a, 0.9)]));
  canopy.position.y = 2.4; canopy.rotation.x = 0.12;
  canopy.castShadow = true;
  g.add(canopy);
  // mercadorias
  for (let i = 0; i < 4; i++) {
    g.add(cyl(0.12, 0.14, 0.3, mat(pick([0x8a6a3a, 0x5a7a8a, 0x7a5a8a]), 0.6), -0.9 + i * 0.6, 1.05, 0, 8));
  }
  return { group: g, colliders: [{ x: 0, z: 0, r: 1.5, top: 2 }] };
}

/* ---------- Moinho ---------- */
export function buildWindmill() {
  const g = new THREE.Group();
  g.add(cyl(2.2, 2.8, 7, WALL, 0, 3.5, 0, 10));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 2.4, 10), ROOF);
  roof.position.y = 8.2; roof.castShadow = true;
  g.add(roof);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = box(0.3, 5.5, 0.06, WOOD, 0, 2.6, 0);
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    b.userData.noMerge = true;
    holder.add(b);
    blades.add(holder);
  }
  blades.userData.noMerge = true;
  blades.position.set(0, 6.5, 2.4);
  g.add(blades);
  return { group: g, colliders: [{ x: 0, z: 0, r: 2.9, top: 8 }], blades };
}

/* ---------- Campo de cultivo ---------- */
export function buildFarmField(w = 10, d = 8) {
  const g = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), mat(0x5a4028, 1));
  soil.position.y = 0.08;
  soil.receiveShadow = true;
  g.add(soil);
  for (let i = 0; i < Math.floor(w / 1.2); i++) {
    for (let j = 0; j < Math.floor(d / 1.2); j++) {
      if (chance(0.75)) {
        const crop = new THREE.Mesh(new THREE.ConeGeometry(0.18, rand(0.4, 0.8), 5), mat(0x7aa03a, 0.9));
        crop.position.set(-w / 2 + 0.6 + i * 1.2, 0.4, -d / 2 + 0.6 + j * 1.2);
        g.add(crop);
      }
    }
  }
  return { group: g, colliders: [] };
}

/* ---------- Palheiro (feno) ---------- */
export function buildHay() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 8), mat(0xb09040, 1));
  h.position.y = 1.2; h.castShadow = true;
  g.add(h);
  return { group: g, colliders: [{ x: 0, z: 0, r: 1.4, top: 2 }] };
}

/* ---------- Baú ---------- */
export function buildChest() {
  const g = new THREE.Group();
  const body = box(0.9, 0.55, 0.6, WOOD_DARK, 0, 0.28, 0);
  const lid = box(0.9, 0.3, 0.6, WOOD, 0, 0.62, -0.05);
  const band = box(0.94, 0.1, 0.64, GOLD, 0, 0.42, 0);
  lid.userData.noMerge = true;
  g.add(body, lid, band);
  return { group: g, colliders: [], lid };
}

/* ---------- Totem goblin ---------- */
export function buildTotem() {
  const g = new THREE.Group();
  g.add(cyl(0.25, 0.3, 3.2, WOOD_DARK, 0, 1.6, 0, 6));
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), mat(0xd8d0b0, 0.9));
  skull.position.y = 3.4;
  g.add(skull);
  return { group: g, colliders: [{ x: 0, z: 0, r: 0.5, top: 3 }] };
}

/* ---------- Sino (torre do sino) ---------- */
export function buildBellTower() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.4, 7, 0.4, WOOD_DARK, sx * 1.2, 3.5, sz * 1.2));
  }
  g.add(box(3.2, 0.3, 3.2, WOOD, 0, 7, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 4), ROOF);
  roof.position.y = 8; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.7, 8), GOLD);
  bell.position.y = 6.2;
  g.add(bell);
  return { group: g, colliders: [{ x: 0, z: 0, r: 1.5, top: 7 }], bell };
}
