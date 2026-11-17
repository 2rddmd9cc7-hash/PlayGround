// Construtores de objetos 3D — casas, árvores, muros, baús, etc.
import * as THREE from '../../vendor/three.module.js';
import { terrainHeight } from './terrain.js';
import { rand, randInt } from '../core/utils.js';

const MAT = {
  wood: new THREE.MeshLambertMaterial({ color: 0x8a5a2b }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x5e3c1c }),
  plaster: new THREE.MeshLambertMaterial({ color: 0xd8cbb0 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8d8d85 }),
  stoneDark: new THREE.MeshLambertMaterial({ color: 0x5f5f58 }),
  roof: new THREE.MeshLambertMaterial({ color: 0x9b3c2e }),
  roofBlue: new THREE.MeshLambertMaterial({ color: 0x3d6a8a }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x2e7d32, flatShading: true }),
  leafDark: new THREE.MeshLambertMaterial({ color: 0x1b5e20, flatShading: true }),
  leafSnow: new THREE.MeshLambertMaterial({ color: 0xb8ccb8, flatShading: true }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  gold: new THREE.MeshLambertMaterial({ color: 0xe8c26a, emissive: 0x6a4a10 }),
  banner: new THREE.MeshLambertMaterial({ color: 0x8a2be2 }),
  banner2: new THREE.MeshLambertMaterial({ color: 0xd4af37 }),
  cloth: new THREE.MeshLambertMaterial({ color: 0xb03a48 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x9aa2a8 }),
  crystal: new THREE.MeshLambertMaterial({ color: 0x8ce0ff, emissive: 0x2a6a8a, transparent: true, opacity: 0.9 }),
};

export const materials = MAT;

// ---------- Casa medieval ----------
export function makeHouse(w = 6, d = 7, h = 3.4, opts = {}) {
  const g = new THREE.Group();
  const wallMat = opts.stone ? MAT.stone : MAT.plaster;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.y = h / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  g.add(wall);
  // estrutura de madeira
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.1), MAT.woodDark);
  beam.position.y = h - 0.15; g.add(beam);
  const beamB = beam.clone(); beamB.position.y = 0.15; g.add(beamB);
  // telhado
  const roofH = h * 0.65;
  const roofGeo = new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, opts.roofMat || MAT.roof);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + roofH / 2 - 0.1;
  roof.scale.z = d / w;
  roof.castShadow = true;
  g.add(roof);
  // porta
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.15), MAT.woodDark);
  door.position.set(0, 1, d / 2 + 0.05); g.add(door);
  // janelas
  const winMat = new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x000000 });
  for (const sx of [-w / 2 + 1.4, w / 2 - 1.4]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), winMat);
    win.position.set(sx, h * 0.6, d / 2 + 0.05); g.add(win);
    g.userData.windows ??= []; g.userData.windows.push(win);
  }
  g.userData.windowsMat = winMat;
  return g;
}

export function placeAt(g, x, z, rotY = 0, yOff = 0) {
  g.position.set(x, terrainHeight(x, z) + yOff, z);
  g.rotation.y = rotY;
  return g;
}

// ---------- Torre / muralha ----------
export function makeTower(h = 10, r = 3) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 10), MAT.stone);
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, 1.2, 10), MAT.stoneDark);
  top.position.y = h + 0.6; top.castShadow = true; g.add(top);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), MAT.stoneDark);
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * r * 1.1, h + 1.7, Math.sin(a) * r * 1.1);
    g.add(m);
  }
  return g;
}

export function makeWall(len = 20, h = 6, thick = 1.6) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), MAT.stone);
  w.position.y = h / 2; w.castShadow = true; w.receiveShadow = true;
  g.add(w);
  const count = Math.floor(len / 2);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, thick), MAT.stoneDark);
    m.position.set(-len / 2 + 1 + i * 2, h + 0.5, 0);
    g.add(m);
  }
  return g;
}

// ---------- Árvores ----------
export function makeTreeGeo() {
  const group = { trunk: new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6), canopy: new THREE.ConeGeometry(1.7, 3.6, 7) };
  return group;
}

// instanced helper
export function makeInstanced(geo, mat, count) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return mesh;
}

export function scatterPositions(list, mesh, yOff = 0, scaleRange = [0.8, 1.3]) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((it, i) => {
    const sc = rand(scaleRange[0], scaleRange[1]);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2));
    s.setScalar(sc);
    p.set(it.x, terrainHeight(it.x, it.z) + yOff, it.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

// ---------- Baú ----------
export function makeChest(rarity = 'comum') {
  const g = new THREE.Group();
  const colByRarity = { comum: 0x8a5a2b, incomum: 0x2e8b57, raro: 0x2980b9, epico: 0x8e44ad, lendario: 0xe67e22, mitico: 0xe74c3c };
  const mat = new THREE.MeshLambertMaterial({ color: colByRarity[rarity] || 0x8a5a2b });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), mat);
  base.position.y = 0.3; base.castShadow = true; g.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), mat);
  lid.position.set(0, 0.72, -0.18); g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), MAT.gold);
  lock.position.set(0, 0.55, 0.38); g.add(lock);
  g.userData.lid = lid;
  return g;
}

// ---------- Cristal do teste ----------
export function makeCrystal() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.7, 8), MAT.stoneDark);
  base.position.y = 0.35; base.receiveShadow = true; g.add(base);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), MAT.crystal.clone());
  crystal.position.y = 2.6; crystal.castShadow = true;
  g.add(crystal);
  g.userData.crystal = crystal;
  return g;
}

// ---------- Fogueira / tocha ----------
export function makeTorch(h = 2) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), MAT.woodDark);
  pole.position.y = h / 2; g.add(pole);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa030 }));
  flame.position.y = h + 0.25;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

// ---------- Estandarte ----------
export function makeBanner() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 6), MAT.woodDark);
  pole.position.y = 2.2; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), MAT.banner);
  cloth.position.set(0.62, 3.1, 0);
  cloth.material.side = THREE.DoubleSide;
  g.add(cloth);
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), MAT.banner2);
  emblem.position.set(0.63, 3.3, 0.01);
  g.add(emblem);
  return g;
}

// ---------- Estátua ----------
export function makeStatue() {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), MAT.stoneDark);
  ped.position.y = 0.4; g.add(ped);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.2, 8), MAT.stone);
  body.position.y = 1.9; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), MAT.stone);
  head.position.y = 3.2; g.add(head);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), MAT.metal);
  sword.position.set(0.5, 2.4, 0); sword.rotation.z = -0.3; g.add(sword);
  return g;
}

// ---------- Fonte ----------
export function makeFountain() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1, 14), MAT.stone);
  ring.position.y = 0.5; ring.receiveShadow = true; g.add(ring);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.2, 14),
    new THREE.MeshLambertMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.75 }));
  water.position.y = 0.95; g.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 8), MAT.stone);
  pillar.position.y = 1.6; g.add(pillar);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), MAT.stone);
  top.position.y = 2.6; g.add(top);
  return g;
}

// ---------- Feira / banca ----------
export function makeStall(color = 0xb03a48) {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 1.4), MAT.wood);
  table.position.y = 0.95; g.add(table);
  for (const [lx, lz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), MAT.woodDark);
    leg.position.set(lx, 0.47, lz); g.add(leg);
  }
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  roof.position.y = 2.1; roof.rotation.x = -0.25; g.add(roof);
  for (const [lx, lz] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), MAT.woodDark);
    pole.position.set(lx, 1.1, lz); g.add(pole);
  }
  return g;
}

// ---------- Cerca ----------
export function makeFence(len = 6) {
  const g = new THREE.Group();
  for (let i = 0; i <= len; i += 2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), MAT.woodDark);
    post.position.set(-len / 2 + i, 0.55, 0); g.add(post);
  }
  for (const yy of [0.45, 0.85]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), MAT.wood);
    rail.position.set(0, yy, 0); g.add(rail);
  }
  return g;
}

// ---------- Ponte ----------
export function makeBridge(len = 14, w = 4) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, len), MAT.wood);
  deck.position.y = 0; deck.receiveShadow = true; g.add(deck);
  for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) {
    for (let i = 0; i <= 3; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), MAT.woodDark);
      post.position.set(sx, 0.75, -len / 2 + i * len / 3); g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), MAT.woodDark);
    rail.position.set(sx, 1.25, 0); g.add(rail);
  }
  return g;
}

// ---------- Altar de pedra ----------
export function makeAltar() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.4), MAT.stone);
  base.position.y = 0.25; g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.1), MAT.stoneDark);
  top.position.y = 0.65; g.add(top);
  return g;
}

// ---------- Acampamento goblin ----------
export function makeTent() {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b5a3e, flatShading: true }));
  t.position.y = 1.1; t.castShadow = true; g.add(t);
  return g;
}

export function makeSpire(color = 0x444a55, h = 18) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, h, 8), MAT.stoneDark);
  body.position.y = h / 2; body.castShadow = true; g.add(body);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5, 8),
    new THREE.MeshLambertMaterial({ color, flatShading: true }));
  spike.position.y = h + 2.4; g.add(spike);
  return g;
}

export { MAT as PropMaterials };
