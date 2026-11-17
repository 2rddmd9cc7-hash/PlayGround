/* =========================================================
 * Aetheria — Mundo aberto: terreno, biomas, regiões, estruturas
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { fbm2, noise2, hash2, clamp, lerp, smoothstep, rand, randi, pick, chance, mulberry32, dist } from '../core/utils.js';
import * as S from './structures.js';
import { mat } from './structures.js';
import { mergeGroup } from '../core/merge.js';

export const WORLD_HALF = 700;
export const WATER_Y = 1.8;
const LAKE = { x: 340, z: 80, r: 100 };
const VOLCANO = { x: -400, z: 280, r: 90 };
export const DUNGEON_C = { x: 620, z: 620, r: 42 };
export const CAVE_ENTRANCE = { x: -140, z: -470 };

/* regiões discoveráveis */
export const REGIONS = [
  { id: 'village', name: 'Vila Pedravale', cx: 0, cz: 0, r: 95, color: '#7aa04a', discovered: true, safe: true },
  { id: 'city', name: 'Cidadela de Valoria', cx: 0, cz: -260, r: 130, color: '#c8b878', discovered: false, safe: true },
  { id: 'forest', name: 'Floresta Sussurrante', cx: 260, cz: -60, r: 150, color: '#3a7a34', discovered: false },
  { id: 'mountains', name: 'Montanhas da Coroa', cx: -140, cz: -430, r: 190, color: '#8a8478', discovered: false },
  { id: 'lake', name: 'Lago Cristalino', cx: 340, cz: 80, r: 105, color: '#3a8ac0', discovered: false },
  { id: 'river', name: 'Rio Sereno', cx: 140, cz: -80, r: 210, color: '#4a9ab0', discovered: false },
  { id: 'ruins', name: 'Ruínas de Eldrin', cx: -280, cz: 40, r: 95, color: '#9a9080', discovered: false },
  { id: 'swamp', name: 'Pântano Nievoeiro', cx: 400, cz: 240, r: 125, color: '#4a5a30', discovered: false },
  { id: 'volcano', name: 'Terras de Cinza', cx: -400, cz: 280, r: 135, color: '#6a2a1a', discovered: false },
  { id: 'snow', name: 'Planície Gelada', cx: -380, cz: -220, r: 135, color: '#d8dce8', discovered: false },
  { id: 'goblincamp', name: 'Acampamento Sangue', cx: 170, cz: 170, r: 75, color: '#8a4a20', discovered: false },
  { id: 'umbra', name: 'Reino de Umbra', cx: 500, cz: -320, r: 155, color: '#4a2a5a', discovered: false },
  { id: 'secret', name: 'Vale Secreto', cx: -60, cz: 380, r: 75, color: '#a0c060', discovered: false, hidden: true }
];

/* estradas */
const ROADS = [
  [[0, 30], [0, -195]],       // vila → cidade
  [[0, 0], [260, -60]],       // vila → floresta
  [[0, 0], [-280, 40]],       // vila → ruínas
  [[0, -215], [-140, -440]],  // cidade → montanhas
  [[0, 0], [400, 240]],       // vila → pântano
  [[0, -200], [500, -320]],   // cidade → umbra
  [[0, 20], [330, 60]]        // vila → lago
];

function roadDist(x, z) {
  let best = 999;
  for (const [[ax, az], [bx, bz]] of ROADS) {
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t, pz = az + dz * t;
    const d = dist(x, z, px, pz);
    if (d < best) best = d;
  }
  return best;
}

/* função de altura central — usada pelo terreno e pela física */
export function heightAt(x, z) {
  let h = 3.5 + fbm2(x * 0.008, z * 0.008, 4) * 7 + fbm2(x * 0.045, z * 0.045, 2) * 1.4;

  // montanhas da coroa
  const dM = dist(x, z, -120, -440);
  h += Math.max(0, 1 - dM / 240) * Math.max(0, 1 - dM / 240) * 30 * (0.6 + fbm2(x * 0.02, z * 0.02, 3) * 0.8);
  // reino de umbra — planalto escuro elevado
  const dU = dist(x, z, 500, -320);
  h += Math.max(0, 1 - dU / 200) * 7;
  // borda do mundo
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > WORLD_HALF - 90) h += (edge - (WORLD_HALF - 90)) * 0.55;
  // vulcão
  const dV = dist(x, z, VOLCANO.x, VOLCANO.z);
  if (dV < VOLCANO.r) {
    const cone = (1 - dV / VOLCANO.r);
    h += cone * cone * 26;
    if (dV < 22) h = lerp(4, h, dV / 22); // cratera
  }
  // lago
  const dL = dist(x, z, LAKE.x, LAKE.z);
  if (dL < LAKE.r) {
    const f = smoothstep(1 - dL / LAKE.r);
    h = lerp(h, -2.8, f);
  }
  // rio
  const rx = 150 + Math.sin(z * 0.008) * 60;
  const dR = Math.abs(x - rx);
  if (dR < 18 && z > -140 && z < 380) {
    h = lerp(0.4, h, smoothstep(clamp(dR / 18, 0, 1)));
  }
  // pântano — depressões
  if (dist(x, z, 400, 240) < 120) {
    const swamp = fbm2(x * 0.02 + 7, z * 0.02 + 3, 3);
    if (swamp > 0.55) h = lerp(h, 1.2, smoothstep((swamp - 0.55) / 0.2));
  }
  // caverna (masmorra) — bacia fechada no canto
  const dD = dist(x, z, DUNGEON_C.x, DUNGEON_C.z);
  if (dD < DUNGEON_C.r + 16) {
    if (dD < DUNGEON_C.r) h = lerp(3.4, h, dD / DUNGEON_C.r);
    else h += (1 - (dD - DUNGEON_C.r) / 16) * 26; // muralha da caverna
  }
  // planície gelada — colinas suaves altas
  if (dist(x, z, -380, -220) < 135) h += 3;

  return h;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.half = WORLD_HALF;
    this.colliders = [];
    this.obstacles = [];
    this.interactables = [];
    this.regions = REGIONS.map(r => ({ ...r }));
    this.torchLights = [];
    this.windows = [];
    this.flames = [];
    this.blades = [];
    this.chests = [];
    this.herbs = [];
    this.birds = [];
    this.critters = [];
    this.cityDoors = null;
    this.crystal = null;
    this.crystalPos = null;
    this.rng = mulberry32(20260117);
    this._t = 0;
    this.build();
  }

  terrainHeight(x, z) { return heightAt(x, z); }

  regionAt(x, z) {
    for (const r of this.regions) {
      if (dist(x, z, r.cx, r.cz) < r.r) return r;
    }
    return null;
  }

  build() {
    this.buildTerrain();
    this.buildWater();
    this.buildVillage();
    this.buildCity();
    this.buildOutposts();
    this.buildDungeon();
    this.buildProps();
    this.buildChests();
    this.buildHerbs();
    this.buildWildlife();
  }

  /* ---------- TERRENO ---------- */
  buildTerrain() {
    const seg = 190, size = WORLD_HALF * 2;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      // cor por bioma
      const n = noise2(x * 0.05, z * 0.05);
      const rd = roadDist(x, z);
      const slope = Math.abs(heightAt(x + 2, z) - h) + Math.abs(heightAt(x, z + 2) - h);
      if (h < WATER_Y - 0.6) c.setHex(0x4a5a44);                       // fundo
      else if (h < WATER_Y + 0.8) c.setHex(0xb0a070);                  // areia
      else if (h > 17) c.setHex(0xd8dce8);                             // neve/pico
      else if (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r * 0.8) {
        c.setHex(0x4a362c); if (n > 0.7) c.setHex(0x8a3a1a);
      }
      else if (dist(x, z, 400, 240) < 120) c.setHex(0x4a5a30);         // pântano
      else if (dist(x, z, -380, -220) < 135) c.setHex(0xc8d4e0);       // neve
      else if (dist(x, z, -140, -440) < 200 && h > 10) c.setHex(0x8a8478); // rocha
      else if (dist(x, z, 500, -320) < 150) c.setHex(0x3a3a4a);        // umbra
      else if (rd < 5) c.setHex(0x9a865c);                             // estrada
      else {
        const g = 0x5a8a3a;
        c.setHex(g);
        c.offsetHSL(0, 0, (n - 0.5) * 0.08);
      }
      if (dist(x, z, 260, -60) < 150 && h > WATER_Y && h < 17) c.setHex(0x3a6a2c); // floresta
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // lava do vulcão
    const lava = new THREE.Mesh(
      new THREE.CircleGeometry(20, 24),
      new THREE.MeshStandardMaterial({ color: 0xff4a10, emissive: 0xff5a10, emissiveIntensity: 1.4, roughness: 0.6 })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(VOLCANO.x, 4.4, VOLCANO.z);
    this.scene.add(lava);
    this.lava = lava;
    const lavaLight = new THREE.PointLight(0xff5a10, 2.5, 60);
    lavaLight.position.set(VOLCANO.x, 10, VOLCANO.z);
    this.scene.add(lavaLight);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, 40, 40);
    geo.rotateX(-Math.PI / 2);
    this.waterMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2a7ab8, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.3
    }));
    this.waterMesh.position.y = WATER_Y;
    this.scene.add(this.waterMesh);
  }

  /* ---------- VILA ---------- */
  buildVillage() {
    const add = (built, x, z, ry = 0, y = null) => {
      built.group.position.set(x, y ?? heightAt(x, z) - 0.15, z);
      built.group.rotation.y = ry;
      this.scene.add(built.group);
      mergeGroup(built.group, this.scene);
      for (const c of built.colliders) this.colliders.push({ x: x + c.x, z: z + c.z, r: c.r, top: c.top });
      if (built.windows) this.windows.push(...built.windows);
      return built;
    };
    // fonte central
    const f = add(S.buildFountain(), 0, 0, 0, 3.2);
    this.fountainPos = new THREE.Vector3(0, 3.2, 0);
    // praça
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshStandardMaterial({ color: 0xa89878, roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, heightAt(0, 0) + 0.06, 0);
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // casas em anel
    const houseDefs = [
      [-16, 8, 0.6, 'plaster'], [-24, -4, 1.2, 'stone'], [-20, -18, 1.9, 'plaster'],
      [-6, -24, 2.6, 'plaster'], [10, -22, 3.6, 'stone'], [20, -12, 4.4, 'plaster'],
      [24, 4, 5.2, 'plaster'], [18, 18, 0.2, 'plaster'], [4, 26, 5.9, 'stone'], [-10, 24, 0.8, 'plaster']
    ];
    for (const [hx, hz, ry, st] of houseDefs) {
      const b = S.buildHouse({ style: st, roof: chance(0.5) ? 'thatch' : 'red' });
      add(b, hx, hz, ry);
    }
    // prédios especiais
    const tavern = S.buildHouse({ w: 7, d: 6, h: 3.2, sign: true, signColor: mat(0x8a6a2a, 0.6) });
    add(tavern, -30, 14, 2.3);
    this.tavernPos = new THREE.Vector3(-30, 0, 14);
    const smithy = S.buildHouse({ w: 5.5, d: 4.5, h: 2.8, style: 'stone' });
    add(smithy, 30, 12, 4.6);
    this.smithyPos = new THREE.Vector3(30, 0, 12);
    // forja (fogueira + bigorna)
    const forge = S.buildCampfire();
    add(forge, 26.5, 8.5, 0);
    this.flames.push(forge.flame);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), mat(0x4a4a52, 0.5, 0.7));
    anvil.position.set(28.5, heightAt(28.5, 8.5) + 0.5, 8.5);
    anvil.castShadow = true;
    this.scene.add(anvil);
    const shop = S.buildHouse({ w: 6, d: 5, sign: true, signColor: mat(0x3a7a3a, 0.6) });
    add(shop, 30, -6, 4.9);
    this.shopPos = new THREE.Vector3(30, 0, -6);
    add(S.buildChurch(), -36, -26, 2.6);
    const mill = add(S.buildWindmill(), 40, 32, 0.5);
    this.blades.push(mill.blades);
    add(S.buildFarmField(12, 9), 24, 38, 0.4);
    add(S.buildFarmField(9, 8), 14, 42, 0.2);
    add(S.buildHay(), 20, 34, 0.4);
    add(S.buildHay(), 31, 37, 1.2);
    // torre do sino
    const bell = S.buildBellTower();
    add(bell, 12, -30, 0);
    this.bellTowerPos = new THREE.Vector3(12, 0, -30);
    // tochas da praça
    for (const [tx, tz] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -14], [0, 14]]) {
      this.addTorch(tx, tz);
    }
    // placas
    this.addSign(0, 22, '↑ Cidadela de Valoria  •  ← Ruínas  •  → Floresta');
  }

  addTorch(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), mat(0x4a3420, 0.9));
    pole.position.y = 1.2;
    pole.castShadow = true;
    g.add(pole);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
    flame.position.y = 2.6;
    flame.userData.noMerge = true;
    g.add(flame);
    const light = new THREE.PointLight(0xff9030, 0, 14);
    light.position.y = 2.8;
    g.add(light);
    g.position.set(x, heightAt(x, z), z);
    this.scene.add(g);
    this.torchLights.push(light);
    this.flames.push(flame);
  }

  addSign(x, z, text) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2, 6), mat(0x4a3420, 0.9));
    post.position.y = 1;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), mat(0x6a4a2c, 0.9));
    board.position.y = 1.8;
    g.add(post, board);
    g.position.set(x, heightAt(x, z), z);
    g.rotation.y = rand(0, Math.PI * 2);
    this.scene.add(g);
    this.interactables.push({
      pos: new THREE.Vector3(x, heightAt(x, z) + 1, z), r: 2.4,
      label: 'Ler placa', icon: '📖',
      action: game => game.hud.dialogBox('Placa', text, [['Fechar', () => game.hud.closeDialog()]])
    });
  }

  /* ---------- CIDADE ---------- */
  buildCity() {
    const cx = 0, cz = -260, R = 62;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // portão ao sul (em direção à vila = +z)
      if (a > Math.PI * 0.42 && a < Math.PI * 0.58) continue;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const seg = S.buildWallSegment(24);
      seg.group.position.set(x, heightAt(x, z) - 0.4, z);
      seg.group.rotation.y = -a + Math.PI / 2;
      this.scene.add(seg.group);
      mergeGroup(seg.group, this.scene);
      this.colliders.push({ x, z, r: 10, top: 8 });
    }
    // portão
    const gate = S.buildGate();
    gate.group.position.set(cx, heightAt(cx, cz + R) - 0.3, cz + R);
    this.scene.add(gate.group);
    mergeGroup(gate.group, this.scene);
    this.colliders.push(...gate.colliders.map(c => ({ x: cx + c.x, z: cz + R + c.z, r: c.r, top: c.top })));
    this.cityDoors = gate.doors;
    // castelo
    const castle = S.buildCastle();
    castle.group.position.set(cx, heightAt(cx, cz - 8) - 0.3, cz - 8);
    this.scene.add(castle.group);
    mergeGroup(castle.group, this.scene);
    for (const c of castle.colliders) this.colliders.push({ x: cx + c.x, z: cz - 8 + c.z, r: c.r, top: c.top });
    this.crystal = castle.crystal;
    this.crystalLight = castle.crystalLight;
    this.crystalPos = castle.crystalPos.clone().add(new THREE.Vector3(cx, 0, cz - 8));
    // bandeiras do castelo
    // casas da cidade
    const houseSpots = [[-30, -40, 1], [30, -40, -1], [-38, -20, 2], [38, -20, 2.6], [-24, -48, 0.4], [24, -48, 5.8], [-44, -34, 3], [44, -34, 2]];
    for (const [hx, hz, ry] of houseSpots) {
      const b = S.buildHouse({ style: 'stone', roof: 'blue' });
      const x = cx + hx, z = cz + hz;
      b.group.position.set(x, heightAt(x, z) - 0.15, z);
      b.group.rotation.y = ry;
      this.scene.add(b.group);
      mergeGroup(b.group, this.scene);
      for (const c of b.colliders) this.colliders.push({ x: x + c.x, z: z + c.z, r: c.r, top: c.top });
      if (b.windows) this.windows.push(...b.windows);
    }
    // mercado
    for (const [sx, sz, ry] of [[-10, -36, 0.4], [10, -36, 5.8], [-14, -30, 1.2], [14, -30, 5]]) {
      const st = S.buildStall();
      const x = cx + sx, z = cz + sz;
      st.group.position.set(x, heightAt(x, z), z);
      st.group.rotation.y = ry;
      this.scene.add(st.group);
      mergeGroup(st.group, this.scene);
      this.colliders.push({ x, z, r: 1.5, top: 2 });
    }
    // tochas da cidade
    for (const [tx, tz] of [[-6, -210], [6, -210], [-12, -240], [12, -240], [0, -230], [-20, -260], [20, -260]]) {
      this.addTorch(cx + tx, cz + tz);
    }
    this.addSign(cx, cz + R - 4, 'Bem-vindo à Cidadela de Valoria — sede do Rei e da Ordem dos Magos');
    this.cityCenter = new THREE.Vector3(cx, 0, cz);
  }

  /* ---------- Postos avançados, acampamentos, ruínas ---------- */
  buildOutposts() {
    const add = (built, x, z, ry = 0, sink = 0.15) => {
      built.group.position.set(x, heightAt(x, z) - sink, z);
      built.group.rotation.y = ry;
      this.scene.add(built.group);
      mergeGroup(built.group, this.scene);
      for (const c of built.colliders) this.colliders.push({ x: x + c.x, z: z + c.z, r: c.r, top: c.top });
      return built;
    };
    // acampamento goblin
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(S.buildTent(), 170 + Math.cos(a) * 14, 170 + Math.sin(a) * 14, a);
    }
    add(S.buildCampfire(), 170, 170);
    this.flames.push(this.scene.children[this.scene.children.length - 1]?.children?.[6]);
    add(S.buildTotem(), 176, 176);
    add(S.buildTotem(), 164, 174);
    // ruínas
    for (const [rx, rz] of [[-280, 40], [-300, 60], [-255, 25]]) {
      add(S.buildRuin(), rx, rz, rand(0, 3));
      if (chance(0.7)) add(S.buildStatue(), rx + rand(-8, 8), rz + rand(-8, 8));
    }
    // torres de vigia no caminho
    add(S.buildTower(), 30, -100);
    add(S.buildTower(), -60, -320);
    // pontes sobre o rio (cruzando em x≈150)
    for (const bz of [-60, 120]) {
      const bx = 150 + Math.sin(bz * 0.008) * 60;
      const br = S.buildBridge(16);
      br.group.position.set(bx, 2, bz);
      this.scene.add(br.group);
      this.roadBridges = (this.roadBridges || []).concat([br]);
      // deck não bloqueia: sem collider
    }
    // acampamento bandidos (segredo perto do vale)
    add(S.buildTent(), -60, 372);
    add(S.buildTent(), -68, 386);
    add(S.buildCampfire(), -64, 380);
    // reino de umbra: fortaleza escura
    add(S.buildHouse({ w: 10, d: 8, h: 6, style: 'stone', roof: 'blue' }), 500, -330, 0.3, 0.3);
    add(S.buildTower(), 485, -315);
    add(S.buildTower(), 515, -345);
    for (let i = 0; i < 5; i++) add(S.buildTent(), 480 + rand(-20, 20), -300 + rand(-15, 15));
    // estátuas decorativas no caminho ao castelo
    add(S.buildStatue(), -5, -180);
    add(S.buildStatue(), 5, -180);
  }

  /* ---------- MASMORRA (Caverna de Umbra) ---------- */
  buildDungeon() {
    const g = new THREE.Group();
    const cx = DUNGEON_C.x, cz = DUNGEON_C.z;
    // chão de pedra
    const floor = new THREE.Mesh(new THREE.CircleGeometry(DUNGEON_C.r, 24), mat(0x4a4038, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 3.5, cz);
    floor.receiveShadow = true;
    g.add(floor);
    // estalactites/pilares
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), r = rand(8, DUNGEON_C.r - 8);
      const h = rand(3, 7);
      const stal = new THREE.Mesh(new THREE.ConeGeometry(rand(0.6, 1.4), h, 6), mat(0x3a332c, 0.95));
      stal.position.set(cx + Math.cos(a) * r, 3.5 + h / 2, cz + Math.sin(a) * r);
      stal.rotation.x = Math.PI; // pêndulo para baixo? deixa em pé
      stal.castShadow = true;
      g.add(stal);
      this.colliders.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, r: 1.1, top: 3.5 + h });
    }
    // cristais luminosos azuis
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2), r = rand(6, DUNGEON_C.r - 10);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x6adfff, emissive: 0x2a8aff, emissiveIntensity: 1, roughness: 0.2 }));
      crystal.position.set(cx + Math.cos(a) * r, 4.2, cz + Math.sin(a) * r);
      g.add(crystal);
      const l = new THREE.PointLight(0x3a9aff, 1.2, 12);
      l.position.copy(crystal.position).y += 1;
      g.add(l);
    }
    // braseiro central (arena do boss)
    for (const [bx, bz] of [[cx - 6, cz - 6], [cx + 6, cz - 6], [cx - 6, cz + 6], [cx + 6, cz + 6]]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff7a20 }));
      flame.position.set(bx, 5, bz);
      g.add(flame);
      const l = new THREE.PointLight(0xff8030, 1.4, 16);
      l.position.set(bx, 6, bz);
      g.add(l);
      this.flames.push(flame);
    }
    this.scene.add(g);
    mergeGroup(g, this.scene);
    this.dungeonCenter = new THREE.Vector3(cx, 3.5, cz);
    // boca da caverna na montanha (entrada)
    const arch = new THREE.Group();
    const rockL = new THREE.Mesh(new THREE.DodecahedronGeometry(4, 0), mat(0x6a6258, 0.95));
    rockL.position.set(-4, 2, 0);
    const rockR = rockL.clone(); rockR.position.x = 4;
    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(4.5, 0), mat(0x6a6258, 0.95));
    top.position.y = 4.4;
    const dark = new THREE.Mesh(new THREE.CircleGeometry(3, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    dark.position.set(0, 2.6, -0.6);
    arch.add(rockL, rockR, top, dark);
    arch.position.set(CAVE_ENTRANCE.x, heightAt(CAVE_ENTRANCE.x, CAVE_ENTRANCE.z) - 1, CAVE_ENTRANCE.z);
    arch.rotation.y = 0.8;
    this.scene.add(arch);
    this.colliders.push({ x: CAVE_ENTRANCE.x - 4, z: CAVE_ENTRANCE.z, r: 3.4, top: 6 }, { x: CAVE_ENTRANCE.x + 4, z: CAVE_ENTRANCE.z, r: 3.4, top: 6 });
  }

  /* ---------- vegetação/props instanciados ---------- */
  buildProps() {
    const rng = this.rng;
    const trees = [], rocks = [], grass = [], flowers = [], deadTrees = [];
    let tries = 0;
    while (trees.length + deadTrees.length < 850 && tries < 6000) {
      tries++;
      const x = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const z = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.5) continue;
      if (roadDist(x, z) < 6) continue;
      const dv = dist(x, z, 0, 0), dc = dist(x, z, 0, -260);
      if (dv < 52 || dc < 70) continue;                      // dentro da vila/cidade: limpo
      if (dist(x, z, DUNGEON_C.x, DUNGEON_C.z) < DUNGEON_C.r + 18) continue;
      const inVolcano = dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r;
      const inSwamp = dist(x, z, 400, 240) < 120;
      const inSnow = dist(x, z, -380, -220) < 135;
      const inForest = dist(x, z, 260, -60) < 145;
      if (h > 16) continue;                                  // picos sem árvores
      if (!inForest && rng() > 0.25) continue;               // floresta densa, resto espalhado
      const scale = 0.75 + rng() * 0.7;
      if (inVolcano || (inSwamp && rng() < 0.5)) deadTrees.push([x, h, z, scale]);
      else if (inSnow || (dist(x, z, -140, -440) < 220 && rng() < 0.6) || rng() < 0.4) trees.push([x, h, z, scale, rng()]);
      else trees.push([x, h, z, scale, rng()]);
    }
    for (let i = 0; i < 260; i++) {
      const x = rng() * WORLD_HALF * 2 - WORLD_HALF, z = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.5 || dist(x, z, 0, 0) < 40) continue;
      rocks.push([x, h, z, 0.5 + rng() * 1.6, rng()]);
    }
    for (let i = 0; i < 2200; i++) {
      const x = rng() * WORLD_HALF * 2 - WORLD_HALF, z = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.4) continue;
      if (roadDist(x, z) < 5) continue;
      grass.push([x, h, z, 0.7 + rng() * 0.8]);
    }
    for (let i = 0; i < 380; i++) {
      const x = rng() * WORLD_HALF * 2 - WORLD_HALF, z = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.4 || dist(x, z, 0, 0) < 30) continue;
      if (rng() > 0.4) continue;
      flowers.push([x, h, z, 1, rng()]);
    }

    /* InstancedMesh — troncos */
    const dummy = new THREE.Object3D();
    const mkInstanced = (geo, m, list, place) => {
      const im = new THREE.InstancedMesh(geo, m, list.length);
      im.castShadow = true; im.receiveShadow = false;
      list.forEach((it, i) => { place(dummy, it, i); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.instanceMatrix.needsUpdate = true;
      this.scene.add(im);
      return im;
    };
    // pinheiros e árvores redondas
    const pineTrunk = [], pineTop = [], roundTrunk = [], roundTop = [];
    for (const [x, h, z, s, rv] of trees) {
      if (rv < 0.45) pineTrunk.push([x, h, z, s]); else roundTrunk.push([x, h, z, s]);
    }
    mkInstanced(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6), mat(0x5a4028, 0.95), pineTrunk,
      (d, [x, h, z, s]) => { d.position.set(x, h + 1.1 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); });
    mkInstanced(new THREE.ConeGeometry(1.5, 4.2, 7), mat(0x2a5a2a, 0.95), pineTrunk,
      (d, [x, h, z, s]) => { d.position.set(x, h + 3.6 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); });
    mkInstanced(new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6), mat(0x6a4a2c, 0.95), roundTrunk,
      (d, [x, h, z, s]) => { d.position.set(x, h + 1.3 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); });
    mkInstanced(new THREE.SphereGeometry(1.9, 8, 7), mat(0x3a7a34, 0.95), roundTrunk,
      (d, [x, h, z, s]) => { d.position.set(x, h + 3.4 * s, z); d.scale.set(s, s * 0.85, s); d.rotation.set(0, 0, 0); });
    // árvores mortas
    mkInstanced(new THREE.CylinderGeometry(0.12, 0.3, 3.4, 5), mat(0x4a3a2a, 0.98), deadTrees,
      (d, [x, h, z, s]) => { d.position.set(x, h + 1.7 * s, z); d.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15)); d.scale.setScalar(s); });
    // pedras
    mkInstanced(new THREE.DodecahedronGeometry(0.9, 0), mat(0x8a8478, 0.95), rocks,
      (d, [x, h, z, s, rv]) => { d.position.set(x, h + 0.2 * s, z); d.scale.set(s, s * 0.7, s); d.rotation.set(rv * 3, rv * 7, 0); });
    // grama
    const grassGeo = new THREE.ConeGeometry(0.16, 0.55, 4);
    mkInstanced(grassGeo, mat(0x5a9a3a, 0.95), grass,
      (d, [x, h, z, s]) => { d.position.set(x, h + 0.22 * s, z); d.scale.set(s, s, s); d.rotation.set(0, 0, 0); });
    // flores
    mkInstanced(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.7 }), flowers,
      (d, [x, h, z, s, rv]) => {
        d.position.set(x, h + 0.25, z);
        d.scale.setScalar(0.8 + rv * 0.5);
        d.rotation.set(0, 0, 0);
      });
    // colorir flores por instância (three r160: mesh.instanceColor)
    const flowersMesh = this.scene.children[this.scene.children.length - 1];
    if (flowersMesh && flowersMesh.isInstancedMesh) {
      const colBuf = new THREE.InstancedBufferAttribute(new Float32Array(flowers.length * 3), 3);
      const palette = [0xe05a6a, 0xe0c050, 0x9a7ae0, 0xffffff, 0xe08a3a];
      flowers.forEach((f, i) => {
        const c = new THREE.Color(palette[Math.floor(f[4] * palette.length)]);
        colBuf.setXYZ(i, c.r, c.g, c.b);
      });
      flowersMesh.instanceColor = colBuf;
    }
  }

  /* ---------- BAÚS ---------- */
  buildChests() {
    const spots = [
      [-36, -22, 'vila'], [24, -40, 'cidade'], [-290, 55, 'ruínas'],
      [160, 160, 'acampamento'], [-380, -240, 'gelo'], [-404, 300, 'vulcão'],
      [410, 250, 'pântano'], [-140, -455, 'montanha'], [612, 612, 'masmorra'],
      [330, 100, 'lago'], [495, -340, 'umbra'], [-64, 384, 'vale secreto']
    ];
    for (const [x, z, tag] of spots) {
      const built = S.buildChest();
      built.group.position.set(x, heightAt(x, z), z);
      built.group.rotation.y = rand(0, Math.PI * 2);
      this.scene.add(built.group);
      this.chests.push({ pos: new THREE.Vector3(x, heightAt(x, z), z), lid: built.lid, opened: false, tag });
    }
  }

  /* ---------- ERVAS (coleta) ---------- */
  buildHerbs() {
    const rng = this.rng;
    let n = 0, tries = 0;
    while (n < 26 && tries < 500) {
      tries++;
      const x = rng() * WORLD_HALF * 2 - WORLD_HALF, z = rng() * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.5 || h > 16) continue;
      if (dist(x, z, 0, 0) < 25 || dist(x, z, DUNGEON_C.x, DUNGEON_C.z) < 50) continue;
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 5), mat(0x4a8a3a, 0.9));
      stem.position.y = 0.25;
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshStandardMaterial({ color: 0x6ae08a, emissive: 0x2a8a4a, emissiveIntensity: 0.6 }));
      bloom.position.y = 0.55;
      g.add(stem, bloom);
      g.position.set(x, h, z);
      this.scene.add(g);
      this.herbs.push({ pos: new THREE.Vector3(x, h + 0.5, z), mesh: g, taken: false });
      n++;
    }
  }

  /* ---------- vida selvagem ---------- */
  buildWildlife() {
    // pássaros
    for (let i = 0; i < 10; i++) {
      const bird = new THREE.Group();
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x2a2a30, side: THREE.DoubleSide }));
      wingL.rotation.z = 0.4;
      const wingR = wingL.clone(); wingR.rotation.z = -0.4;
      bird.add(wingL, wingR);
      const cx = rand(-300, 300), cz = rand(-400, 100);
      bird.position.set(cx, heightAt(cx, cz) + rand(14, 26), cz);
      bird.userData = { cx, cz, r: rand(20, 50), a: rand(0, 6), speed: rand(0.2, 0.5), wingL, wingR };
      this.scene.add(bird);
      this.birds.push(bird);
    }
    // bichos de fazenda (galinhas/ovelhas simplificadas)
    const mkCritter = (x, z, color, scale, speed) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 7, 6), mat(color, 0.95));
      body.scale.set(1.3, 1, 1); body.position.y = 0.3 * scale;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 6, 6), mat(color, 0.95));
      head.position.set(0.35 * scale, 0.42 * scale, 0);
      g.add(body, head);
      g.position.set(x, heightAt(x, z), z);
      g.userData = { home: new THREE.Vector3(x, 0, z), t: rand(0, 10), speed, target: null };
      this.scene.add(g);
      this.critters.push(g);
    };
    for (let i = 0; i < 5; i++) mkCritter(rand(14, 34), rand(30, 44), 0xffffff, 0.8, 1.2);   // galinhas
    for (let i = 0; i < 4; i++) mkCritter(rand(-40, -20), rand(20, 44), 0xd8d0c8, 1.5, 0.8); // ovelhas
    for (let i = 0; i < 3; i++) mkCritter(rand(20, 36), rand(8, 16), 0xc89a6a, 1.3, 0.9);    // vacas
  }

  /* ---------- loop ---------- */
  update(dt, isNight, game) {
    this._t += dt;
    // tochas
    for (const l of this.torchLights) l.intensity = isNight ? 2.2 : 0;
    // janelas brilham à noite
    for (const w of this.windows) {
      if (w.emissive) {
        w.emissive.setHex(0xffb050);
        w.emissiveIntensity = isNight ? 1.1 : 0;
      }
    }
    // chamas tremulam
    const fl = 1 + Math.sin(this._t * 13) * 0.12 + Math.sin(this._t * 7.3) * 0.08;
    for (const f of this.flames) if (f) f.scale.set(fl, 1 + (fl - 1) * 0.5, fl);
    // água ondula levemente
    if (this.waterMesh) this.waterMesh.position.y = WATER_Y + Math.sin(this._t * 0.8) * 0.06;
    // lava pulsa
    if (this.lava) this.lava.material.emissiveIntensity = 1.2 + Math.sin(this._t * 2) * 0.4;
    // cristal do castelo brilha
    if (this.crystal) {
      this.crystal.rotation.y += dt * 0.5;
      this.crystal.position.y = 2.6 + Math.sin(this._t * 1.5) * 0.15;
      if (this.crystalLight) this.crystalLight.intensity = 2 + Math.sin(this._t * 2) * 0.6;
    }
    // moinho gira
    for (const b of this.blades) b.rotation.z += dt;
    // pássaros
    for (const b of this.birds) {
      const u = b.userData;
      u.a += dt * u.speed;
      b.position.set(u.cx + Math.cos(u.a) * u.r, heightAt(u.cx, u.cz) + 18 + Math.sin(u.a * 2) * 2, u.cz + Math.sin(u.a) * u.r);
      b.rotation.y = -u.a;
      const flap = Math.sin(this._t * 9) * 0.5;
      if (u.wingL) u.wingL.rotation.z = 0.4 + flap;
      if (u.wingR) u.wingR.rotation.z = -0.4 - flap;
    }
    // bichos vagando
    for (const c of this.critters) {
      const u = c.userData;
      u.t -= dt;
      if (u.t <= 0) {
        u.t = rand(2, 5);
        const a = rand(0, Math.PI * 2);
        u.target = u.home.clone().add(new THREE.Vector3(Math.cos(a) * rand(2, 8), 0, Math.sin(a) * rand(2, 8)));
      }
      if (u.target) {
        const d = u.target.clone().sub(c.position);
        d.y = 0;
        if (d.length() > 0.3) {
          d.normalize();
          c.position.addScaledVector(d, u.speed * dt);
          c.rotation.y = Math.atan2(d.x, d.z);
          c.position.y = heightAt(c.position.x, c.position.z);
        }
      }
    }
  }
}

/* material utilitário exportado para outros módulos */
export function sharedMat(color, rough = 0.85, metal = 0) { return mat(color, rough, metal); }
