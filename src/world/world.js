// Mundo — montagem completa das regiões, estradas, colisões e interações
import * as THREE from '../../vendor/three.module.js';
import { terrainHeight, buildTerrain, buildWater, buildRoad, WATER_LEVEL, WORLD } from './terrain.js';
import * as P from './props.js';
import { rand, randInt, pick, dist2d } from '../core/utils.js';
import { G } from '../core/state.js';
import { effects } from '../effects/effects.js';
import { audio } from '../audio/audio.js';

export const REGIONS = [
  { id: 'vila', name: 'Vila de Pedravale', x: 0, z: 0, r: 75 },
  { id: 'cidade', name: 'Cidade Real de Aurelia', x: 0, z: -260, r: 120 },
  { id: 'floresta', name: 'Floresta Sussurrante', x: 230, z: 60, r: 150 },
  { id: 'lago', name: 'Lago Espelhado', x: -200, z: -60, r: 95 },
  { id: 'montanhas', name: 'Montanhas Cinzentas', x: 330, z: -260, r: 170 },
  { id: 'vulcao', name: 'Coroa de Brasas', x: 400, z: 260, r: 140 },
  { id: 'congelado', name: 'Terras Gélidas', x: -380, z: -340, r: 190 },
  { id: 'pantano', name: 'Pântano da Ruína', x: -230, z: 260, r: 140 },
  { id: 'goblins', name: 'Território Goblin', x: 300, z: 320, r: 140 },
  { id: 'ruinas', name: 'Ruínas de Vhalor', x: -360, z: 160, r: 110 },
  { id: 'caverna', name: 'Boca da Caverna', x: 150, z: 200, r: 40 },
];

export class World {
  constructor() {
    this.colliders = [];       // {x, z, r}
    this.interactables = [];   // {type, x, y, z, r, label, data, mesh, once, done}
    this.spawns = [];          // pontos de spawn de inimigos
    this.torchFlames = [];
    this.nightWindows = [];
    this.ambientEmitters = [];
    this.region = null;
    this.waterMesh = null;
    this.windmill = null;
  }

  addCollider(x, z, r) { this.colliders.push({ x, z, r }); }

  addInteract(o) { this.interactables.push({ r: 2.6, once: false, done: false, ...o }); }

  // distância até o ponto de estrada mais próximo (para espalhar props)
  _nearRoad(x, z, roads) {
    for (const rd of roads) {
      for (const p of rd) {
        if (dist2d(x, z, p.x, p.z) < 7) return true;
      }
    }
    return false;
  }

  _blocked(x, z, roads) {
    // não colocar props dentro das construções principais
    if (dist2d(x, z, WORLD.village.x, WORLD.village.z) < 26) return true;
    if (dist2d(x, z, WORLD.city.x, WORLD.city.z) < 100) return true;
    if (terrainHeight(x, z) < WATER_LEVEL + 0.5) return true;
    if (Math.hypot(x - WORLD.volcano.x, z - WORLD.volcano.z) < 26) return true;
    return this._nearRoad(x, z, roads);
  }

  build(scene) {
    this.scene = scene;
    this.terrain = buildTerrain(scene);
    this.waterMesh = buildWater(scene);

    // ===== estradas =====
    const roadVillageCity = [];
    for (let t = 0; t <= 1; t += 0.06) {
      const x = WORLD.village.x + (WORLD.city.x - WORLD.village.x) * t + 8 * Math.sin(t * 9);
      const z = WORLD.village.z + (WORLD.city.z - WORLD.village.z) * t;
      roadVillageCity.push({ x, z });
    }
    const roadForest = [];
    for (let t = 0; t <= 1; t += 0.1) roadForest.push({ x: 30 + 200 * t, z: 30 + 30 * Math.sin(t * 5) + 30 * t });
    const roadLake = [];
    for (let t = 0; t <= 1; t += 0.1) roadLake.push({ x: -30 - 130 * t, z: -20 + 20 * Math.sin(t * 4) });
    const roadGoblin = [];
    for (let t = 0; t <= 1; t += 0.1) roadGoblin.push({ x: 60 + 240 * t, z: 90 + 230 * t + 25 * Math.sin(t * 6) });
    this.roads = [roadVillageCity, roadForest, roadLake, roadGoblin];
    buildRoad(scene, roadVillageCity, 5);
    buildRoad(scene, roadForest, 3.6);
    buildRoad(scene, roadLake, 3.6);
    buildRoad(scene, roadGoblin, 3.6);

    this._buildVillage(scene);
    this._buildCity(scene);
    // acampamento goblin na estrada da cidade (missão "Estrada Perigosa")
    const roadCamp = { x: 52, z: -118 };
    for (let i = 0; i < 3; i++) {
      const t = P.makeTent();
      const a = (i / 3) * Math.PI * 2 + 0.4;
      P.placeAt(t, roadCamp.x + Math.cos(a) * 6, roadCamp.z + Math.sin(a) * 6, a);
      scene.add(t);
      this.addCollider(roadCamp.x + Math.cos(a) * 6, roadCamp.z + Math.sin(a) * 6, 1.6);
    }
    const roadFire = P.makeTorch(1.1);
    P.placeAt(roadFire, roadCamp.x, roadCamp.z);
    scene.add(roadFire);
    this.torchFlames.push({ flame: roadFire.userData.flame, light: null, x: roadCamp.x, z: roadCamp.z });
    this.spawns.push({ type: 'goblinGuerreiro', x: roadCamp.x, z: roadCamp.z, r: 20, rank: 'D', count: 3, region: 'estrada' });
    this.spawns.push({ type: 'goblin', x: roadCamp.x + 14, z: roadCamp.z + 10, r: 14, rank: 'E', count: 2, region: 'estrada' });
    this._buildForest(scene);
    this._buildLake(scene);
    this._buildMountains(scene);
    this._buildVolcano(scene);
    this._buildFrozen(scene);
    this._buildSwamp(scene);
    this._buildGoblinTerritory(scene);
    this._buildRuins(scene);
    this._scatterNature(scene);
    this._buildWildlife(scene);

    return this;
  }

  // ============ VIDA SELVAGEM: pássaros e animais ============
  _buildWildlife(scene) {
    // pássaros — bando que circula perto do jogador
    this.birds = new THREE.Group();
    const birdMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    this._birdList = [];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), birdMat);
      body.rotation.x = Math.PI / 2;
      b.add(body);
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshLambertMaterial({ color: 0x3a3a44, side: THREE.DoubleSide }));
      wingL.position.x = -0.18; b.add(wingL);
      const wingR = wingL.clone(); wingR.position.x = 0.18; b.add(wingR);
      b.userData.wings = [wingL, wingR];
      this.birds.add(b);
      this._birdList.push({ mesh: b, ang: (i / 7) * Math.PI * 2, r: 6 + rand(0, 5), h: rand(14, 24), speed: rand(0.5, 0.9) });
    }
    scene.add(this.birds);

    // animais: ovelhas na fazenda, galinhas na vila
    this._animals = [];
    const sheepMat = new THREE.MeshLambertMaterial({ color: 0xe8e4dc });
    const chickenMat = new THREE.MeshLambertMaterial({ color: 0xf0e8d0 });
    const makeSheep = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), sheepMat);
      body.position.y = 0.55; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.3), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
      head.position.set(0.5, 0.7, 0); g.add(head);
      for (const [lx, lz] of [[-0.25, 0.15], [-0.25, -0.15], [0.25, 0.15], [0.25, -0.15]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
        leg.position.set(lx, 0.17, lz); g.add(leg);
      }
      return g;
    };
    const makeChicken = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), chickenMat);
      body.position.y = 0.2; body.scale.set(1, 0.9, 1.25); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), chickenMat);
      head.position.set(0, 0.38, 0.14); g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), new THREE.MeshLambertMaterial({ color: 0xe8a020 }));
      beak.position.set(0, 0.38, 0.24); beak.rotation.x = Math.PI / 2; g.add(beak);
      return g;
    };
    for (let i = 0; i < 5; i++) {
      const m = makeSheep();
      const x = -34 + rand(-8, 14), z = 20 + rand(-6, 12);
      m.position.set(x, terrainHeight(x, z), z);
      m.rotation.y = rand(0, Math.PI * 2);
      scene.add(m);
      this._animals.push({ mesh: m, hx: x, hz: z, t: rand(0, 10), speed: 0.5 });
    }
    for (let i = 0; i < 4; i++) {
      const m = makeChicken();
      const x = rand(-14, 14), z = rand(10, 24);
      m.position.set(x, terrainHeight(x, z), z);
      m.rotation.y = rand(0, Math.PI * 2);
      scene.add(m);
      this._animals.push({ mesh: m, hx: x, hz: z, t: rand(0, 10), speed: 0.8 });
    }
  }

  // ============ VILA ============
  _buildVillage(scene) {
    const V = WORLD.village;
    const H = (x, z) => terrainHeight(x, z);

    // praça central com fonte
    const square = new THREE.Mesh(new THREE.CircleGeometry(9, 20),
      new THREE.MeshLambertMaterial({ color: 0x9a8a6a }));
    square.rotation.x = -Math.PI / 2;
    square.position.set(V.x, H(V.x, V.z) + 0.05, V.z);
    square.receiveShadow = true;
    scene.add(square);

    const fountain = P.makeFountain();
    P.placeAt(fountain, V.x, V.z);
    scene.add(fountain);
    this.addCollider(V.x, V.z, 2.8);
    this.ambientEmitters.push({ type: 'fountain', x: V.x, z: V.z, y: H(V.x, V.z) + 2.8 });

    // casas ao redor
    const houseSpots = [
      [16, -10, 0.4], [-16, -8, -0.4], [-14, 14, 2.3], [18, 12, -2.0],
      [-2, -22, 0], [4, 22, Math.PI], [26, -2, -1.5], [-26, 2, 1.5],
    ];
    houseSpots.forEach(([dx, dz, rot], i) => {
      const h = P.makeHouse(6 + rand(-0.5, 1), 7, 3.4, i === 2 ? { roofMat: P.PropMaterials.roofBlue } : {});
      P.placeAt(h, V.x + dx, V.z + dz, rot);
      scene.add(h);
      this.addCollider(V.x + dx, V.z + dz, 4.6);
      this.nightWindows.push(h);
      h.userData.housePos = { x: V.x + dx, z: V.z + dz };
    });

    // taverna (maior)
    const tavern = P.makeHouse(9, 11, 4.2);
    P.placeAt(tavern, V.x - 24, V.z - 16, 0.9);
    scene.add(tavern);
    this.addCollider(V.x - 24, V.z - 16, 6);
    this.nightWindows.push(tavern);
    tavern.userData.housePos = { x: V.x - 24, z: V.z - 16 };
    const tavernSign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xc9a44a }));
    tavernSign.position.set(V.x - 21.5, H(V.x - 24, V.z - 16) + 3, V.z - 10.4);
    scene.add(tavernSign);

    // ferreiro: forja com bigorna e braseiro
    const forge = P.makeHouse(6, 5, 3);
    P.placeAt(forge, V.x + 24, V.z - 14, -0.9);
    scene.add(forge);
    this.addCollider(V.x + 24, V.z - 14, 4.2);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), P.PropMaterials.stoneDark);
    anvil.position.set(V.x + 21, H(V.x + 21, V.z - 11) + 0.65, V.z - 11);
    scene.add(anvil);
    const forgeFire = P.makeTorch(1);
    P.placeAt(forgeFire, V.x + 22, V.z - 11);
    scene.add(forgeFire);
    this.torchFlames.push({ flame: forgeFire.userData.flame, light: null, x: V.x + 22, z: V.z - 11 });
    this.ambientEmitters.push({ type: 'forgeFire', x: V.x + 22, z: V.z - 11, y: H(V.x + 22, V.z - 11) + 1.4 });

    // igreja / templo
    const church = new THREE.Group();
    const body = P.makeHouse(7, 10, 4.6, { stone: true });
    church.add(body);
    const steeple = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 4), P.PropMaterials.stoneDark);
    steeple.position.y = 4.6 + 2.2; church.add(steeple);
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), P.PropMaterials.gold);
    cross1.position.y = 10.2; church.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), P.PropMaterials.gold);
    cross2.position.y = 10.4; church.add(cross2);
    P.placeAt(church, V.x + 4, V.z - 30, 0);
    scene.add(church);
    this.addCollider(V.x + 4, V.z - 30, 5.2);

    // fazenda
    const farmX = V.x - 34, farmZ = V.z + 20;
    const wheatMat = new THREE.MeshLambertMaterial({ color: 0xd4b84a });
    for (let i = 0; i < 5; i++) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 5.5), wheatMat);
      patch.position.set(farmX + (i % 2) * 7, H(farmX + (i % 2) * 7, farmZ + Math.floor(i / 2) * 8) + 0.25, farmZ + Math.floor(i / 2) * 8);
      patch.receiveShadow = true;
      scene.add(patch);
    }
    const fenceL = P.makeFence(16);
    P.placeAt(fenceL, farmX + 3.5, farmZ + 8, Math.PI / 2); scene.add(fenceL);
    const fenceR = P.makeFence(16);
    P.placeAt(fenceR, farmX + 10.5, farmZ + 8, Math.PI / 2); scene.add(fenceR);
    const scarecrow = new THREE.Group();
    const scBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.25), P.PropMaterials.cloth);
    scBody.position.y = 1.2; scarecrow.add(scBody);
    const scHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), new THREE.MeshLambertMaterial({ color: 0xd8b070 }));
    scHead.position.y = 2.2; scarecrow.add(scHead);
    P.placeAt(scarecrow, farmX + 7, farmZ + 12); scene.add(scarecrow);
    this.addInteract({ type: 'farm', x: farmX + 7, z: farmZ + 12, y: H(farmX + 7, farmZ + 12), label: 'Falar com o fazendeiro', data: { npc: 'farm' } });

    // loja (banca)
    const shop = P.makeStall(0x3a7d44);
    P.placeAt(shop, V.x + 10, V.z + 16, 2.6); scene.add(shop);
    this.addCollider(V.x + 10, V.z + 16, 2);

    // poço
    const well = new THREE.Group();
    const wRing = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.9, 10), P.PropMaterials.stone);
    wRing.position.y = 0.45; well.add(wRing);
    const wRoof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.8, 6), P.PropMaterials.roof);
    wRoof.position.y = 2.4; well.add(wRoof);
    P.placeAt(well, V.x - 12, V.z + 4); scene.add(well);
    this.addCollider(V.x - 12, V.z + 4, 1);

    // tochas da praça
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      const t = P.makeTorch(2.2);
      P.placeAt(t, V.x + dx, V.z + dz);
      scene.add(t);
      this.torchFlames.push({ flame: t.userData.flame, light: null, x: V.x + dx, z: V.z + dz });
    }

    // estátua no caminho
    const statue = P.makeStatue();
    P.placeAt(statue, V.x, V.z - 32); scene.add(statue);
    this.addCollider(V.x, V.z - 32, 1.2);

    // placa de estrada
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5), P.PropMaterials.woodDark);
    post.position.y = 1.1; sign.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), P.PropMaterials.wood);
    board.position.y = 1.9; sign.add(board);
    P.placeAt(sign, V.x + 3, V.z - 36); scene.add(sign);
    this.addInteract({ type: 'sign', x: V.x + 3, z: V.z - 36, y: H(V.x + 3, V.z - 36), label: 'Ler placa', data: { text: '→ Aurelia, a Cidade Real (Norte)\n→ Floresta Sussurrante (Leste)\n← Lago Espelhado (Oeste)' } });
  }

  // ============ CIDADE + CASTELO ============
  _buildCity(scene) {
    const C = WORLD.city;
    const H = (x, z) => terrainHeight(x, z);
    const baseY = 3.0;

    // muralha circular com portão ao sul
    const R = 88;
    const segs = 40;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = C.x + Math.cos(a) * R, z = C.z + Math.sin(a) * R;
      // portão ao sul (z positivo)
      if (Math.abs(a - Math.PI / 2) < 0.14) continue;
      const wall = P.makeWall(16, 7, 2);
      P.placeAt(wall, x, z, -a + Math.PI / 2);
      scene.add(wall);
      this.addCollider(x, z, 8);
    }
    // torres
    for (const a of [Math.PI / 2 - 0.35, Math.PI / 2 + 0.35, 0, Math.PI]) {
      const t = P.makeTower(12, 3.4);
      P.placeAt(t, C.x + Math.cos(a) * R, C.z + Math.sin(a) * R);
      scene.add(t);
      this.addCollider(C.x + Math.cos(a) * R, C.z + Math.sin(a) * R, 4);
    }
    // portão (arco) — fecha durante a invasão
    const gateL = P.makeWall(8, 9, 2.4);
    P.placeAt(gateL, C.x - 6, C.z + R, Math.PI / 2);
    scene.add(gateL);
    const gateR = P.makeWall(8, 9, 2.4);
    P.placeAt(gateR, C.x + 6, C.z + R, Math.PI / 2);
    scene.add(gateR);
    this.gateBar = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1), P.PropMaterials.woodDark);
    this.gateBar.position.set(C.x, H(C.x, C.z + R) + 7.5, C.z + R);
    this.gateBar.visible = false;
    scene.add(this.gateBar);
    this.gateCollider = { x: C.x, z: C.z + R, r: 6, active: false };
    this.colliders.push(this.gateCollider);

    // casas dentro
    const inSpots = [
      [-40, 30], [40, 30], [-55, 0], [55, 0], [-35, -35], [35, -35],
      [-15, 45], [15, 45], [-60, -25], [60, -25],
    ];
    inSpots.forEach(([dx, dz], i) => {
      const h = P.makeHouse(6.5, 7.5, 3.6, i % 3 === 0 ? { stone: true } : {});
      P.placeAt(h, C.x + dx, C.z + dz, rand(-0.4, 0.4) + (dx > 0 ? -1.2 : 1.2));
      scene.add(h);
      this.addCollider(C.x + dx, C.z + dz, 5);
      this.nightWindows.push(h);
      h.userData.housePos = { x: C.x + dx, z: C.z + dz };
    });

    // mercado
    const stallCols = [0xb03a48, 0x3a7d44, 0x3a5a9d, 0xb08a2a];
    for (let i = 0; i < 4; i++) {
      const s = P.makeStall(stallCols[i]);
      P.placeAt(s, C.x - 24 + i * 14, C.z + 34, Math.PI + (i - 1.5) * 0.2);
      scene.add(s);
      this.addCollider(C.x - 24 + i * 14, C.z + 34, 2.2);
    }

    // ---- povoamento: carroças, bancos, barris, caixas, postes, cercas ----
    this._populateCity(scene, C);

    // castelo (fundo norte da cidade)
    const K = { x: C.x, z: C.z - 52 };
    const keep = new THREE.Group();
    // base (dais baixo — o jogador anda por cima sem degrau)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 44), P.PropMaterials.stone);
    platform.position.y = 0.1; platform.receiveShadow = true; keep.add(platform);
    // muros do salão (aberto em cima p/ luz)
    const wallH = 10;
    for (const [w, dx, dz, rot] of [
      [44, 0, -18, 0], [18, -13, 18, 0], [18, 13, 18, 0], [34, -22, 0, Math.PI / 2], [34, 22, 0, Math.PI / 2],
    ]) {
      const wl = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 2.2), P.PropMaterials.stone);
      wl.position.set(dx, wallH / 2 + 0.1, dz);
      wl.castShadow = true; wl.receiveShadow = true;
      keep.add(wl);
    }
    // entrada triunfal (sul)
    for (const dx of [-7, 7]) {
      const tw = P.makeTower(16, 2.6);
      tw.position.set(dx, 0.1, 19); keep.add(tw);
    }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 2.4), P.PropMaterials.stoneDark);
    arch.position.set(0, 10.4, 19); keep.add(arch);
    // colunas internas
    for (const cx of [-12, -4, 4, 12]) for (const cz of [-10, 8]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 9, 10), P.PropMaterials.stone);
      col.position.set(cx, 4.6, cz);
      col.castShadow = true; keep.add(col);
      this.addCollider(K.x + cx, K.z + cz, 1.1);
    }
    // estandartes
    for (const bx of [-16, -8, 8, 16]) {
      const b = P.makeBanner();
      b.position.set(bx, 0.1, -16.6); keep.add(b);
      const b2 = P.makeBanner();
      b2.position.set(bx, 0.1, 16.6); keep.add(b2);
    }
    // estátuas
    for (const sx of [-18, 18]) {
      const st = P.makeStatue();
      st.scale.setScalar(1.4);
      st.position.set(sx, 0.1, 12); keep.add(st);
    }
    // tochas do salão
    for (const tx of [-18, -10, 10, 18]) for (const tz of [-14, 14]) {
      const t = P.makeTorch(2.6);
      t.position.set(tx, 0.1, tz); keep.add(t);
      this.torchFlames.push({ flame: t.userData.flame, light: null, x: K.x + tx, z: K.z + tz, castle: true });
    }
    // trono
    const throne = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), P.PropMaterials.gold);
    seat.position.y = 1; throne.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, 0.4), P.PropMaterials.gold);
    back.position.set(0, 2.4, -0.9); throne.add(back);
    throne.position.set(0, 0.1, -15); keep.add(throne);
    // SALA DO TESTE: cristal no centro
    const crystal = P.makeCrystal();
    crystal.position.set(0, 0.1, 0);
    keep.add(crystal);
    this.crystal = crystal;
    this.addInteract({
      type: 'crystal', x: K.x, z: K.z, y: H(K.x, K.z) + 2, r: 4,
      label: 'Colocar a mão sobre o cristal',
      data: { crystal: true },
    });
    // tapete
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(10, 34), new THREE.MeshLambertMaterial({ color: 0x7a1f2e }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.36, 0);
    keep.add(carpet);

    P.placeAt(keep, K.x, K.z);
    scene.add(keep);
    // colisores do castelo (com entrada ao sul)
    for (let x = -20; x <= 20; x += 5) {
      this.addCollider(K.x + x, K.z - 18, 2);
      if (Math.abs(x) > 5) this.addCollider(K.x + x, K.z + 18, 2);
    }
    for (let z = -14; z <= 14; z += 5) {
      this.addCollider(K.x - 22, K.z + z, 2);
      this.addCollider(K.x + 22, K.z + z, 2);
    }
    this.addCollider(K.x - 7, K.z + 19, 2.5);
    this.addCollider(K.x + 7, K.z + 19, 2.5);
    this.castlePos = K;

    // placa do portão
    const citySign = new THREE.Group();
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), P.PropMaterials.woodDark);
    sp.position.y = 1.5; citySign.add(sp);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), P.PropMaterials.wood);
    sb.position.y = 2.6; citySign.add(sb);
    P.placeAt(citySign, C.x + 10, C.z + R + 4);
    scene.add(citySign);
    this.addInteract({ type: 'sign', x: C.x + 10, z: C.z + R + 4, y: H(C.x + 10, C.z + R + 4), label: 'Ler placa', data: { text: 'AURELIA — Cidade Real\n"Que a luz dos Seis guie seus passos."' } });
  }

  // ---- mobiliário urbano: carroças, bancos, barris, caixas, postes de tocha ----
  _populateCity(scene, C) {
    const H = (x, z) => terrainHeight(x, z);
    const placed = [];
    const put = (mesh, x, z, rot = 0, collR = 0) => {
      // evita sobrepor outro prop da mesma zona
      for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < 3.5) return;
      P.placeAt(mesh, x, z, rot);
      scene.add(mesh);
      placed.push({ x, z });
      if (collR > 0) this.addCollider(x, z, collR);
    };
    // postes de tocha ao longo da rua central (sul → castelo) e do mercado
    for (const [lx, lz] of [[-8, -190], [8, -190], [-8, -216], [8, -216], [-8, -244], [8, -244], [-8, -272], [8, -272], [-30, -232], [26, -232]]) {
      const lp = P.makeLampPost();
      put(lp, lx, lz, 0, 0.4);
      this.torchFlames.push({ flame: lp.userData.flame, light: null, x: lx, z: lz });
    }
    // bancos na praça central e perto da fonte do mercado
    for (const [bx, bz, br] of [[-4, -252, 0.5], [4, -252, -0.5], [0, -266, Math.PI], [-20, -230, 0.2], [12, -230, -0.2]]) {
      put(P.makeBench(), bx, bz, br);
    }
    // barris e caixas junto às bancas e tavernas
    const barrels = [[-22, -229], [-16, -224], [2, -229], [8, -224], [20, -229], [-42, -248], [46, -250], [-28, -266], [32, -268]];
    for (const [bx, bz] of barrels) put(P.makeBarrel(), bx, bz, rand(0, 3), 0.5);
    const crates = [[-19, -226], [5, -226], [22, -226], [-38, -246], [44, -246], [-26, -262], [28, -264], [-12, -196], [12, -196]];
    for (const [cx2, cz2] of crates) put(P.makeCrate(), cx2, cz2, rand(0, 3), 0.6);
    // carroças estacionadas: perto do portão e das ruas laterais
    const carts = [[-14, -186, 0.4], [14, -186, -0.4], [-38, -226, 1.2], [36, -262, -0.9], [-6, -262, 0.1]];
    for (const [cx3, cz3, cr] of carts) put(P.makeCart(), cx3, cz3, cr, 1.4);
    // cercas decorativas nos jardins das casas da borda
    const fences = [[-52, -238, 0], [52, -238, 0], [-52, -274, 0], [52, -274, 0], [-48, -256, Math.PI / 2], [48, -256, Math.PI / 2]];
    for (const [fx, fz, fr] of fences) {
      const f = P.makeFence(7);
      P.placeAt(f, fx, fz, fr);
      scene.add(f);
    }
  }

  // ============ FLORESTA ============
  _buildForest(scene) {
    const F = WORLD.forest;
    // acampamento goblin na floresta
    const camp = { x: F.x + 60, z: F.z - 40 };
    for (let i = 0; i < 4; i++) {
      const t = P.makeTent();
      const a = (i / 4) * Math.PI * 2;
      P.placeAt(t, camp.x + Math.cos(a) * 7, camp.z + Math.sin(a) * 7, a);
      scene.add(t);
    }
    const fire = P.makeTorch(1);
    P.placeAt(fire, camp.x, camp.z); scene.add(fire);
    this.torchFlames.push({ flame: fire.userData.flame, light: null, x: camp.x, z: camp.z });
    this.ambientEmitters.push({ type: 'campFire', x: camp.x, z: camp.z, y: terrainHeight(camp.x, camp.z) + 1.4 });
    for (let i = 0; i < 5; i++) {
      const s = P.makeSpire(0x3a2a1a, rand(3, 6));
      P.placeAt(s, camp.x + rand(-16, 16), camp.z + rand(-16, 16), rand(0, 6));
      scene.add(s);
    }
    this.spawns.push({ type: 'goblin', x: camp.x, z: camp.z, r: 22, rank: 'E', count: 4, region: 'floresta' });
    this.spawns.push({ type: 'goblinArqueiro', x: camp.x + 6, z: camp.z + 6, r: 18, rank: 'D', count: 2, region: 'floresta' });
    // baú do acampamento
    this._addChest(scene, camp.x + 4, camp.z - 5, 'raro');
    // baú escondido
    this._addChest(scene, F.x - 80, F.z + 90, 'incomum');
  }

  // ============ LAGO ============
  _buildLake(scene) {
    const L = WORLD.lake;
    const H = (x, z) => terrainHeight(x, z);
    // píer
    const pier = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 10), P.PropMaterials.wood);
    deck.position.y = 0.1; pier.add(deck);
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 5), P.PropMaterials.woodDark);
      post.position.set(i % 2 === 0 ? -1 : 1, -0.8, -4 + i * 2.6); pier.add(post);
    }
    pier.position.set(L.x + 60, WATER_LEVEL + 0.25, L.z);
    pier.rotation.y = -Math.PI / 2;
    scene.add(pier);
    // cachoeira onde o rio sai do lago (partículas)
    this.ambientEmitters.push({ type: 'waterfall', x: riverOutletX(), z: -10, y: 3, big: true });
    // barco
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 3.6), P.PropMaterials.wood);
    hull.position.y = 0.2; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), P.PropMaterials.woodDark);
    mast.position.y = 1.4; boat.add(mast);
    boat.position.set(L.x - 20, WATER_LEVEL, L.z + 10);
    scene.add(boat);
    // baú no fundo do píer
    this._addChest(scene, L.x + 66, L.z + 3, 'comum');
    this.addInteract({ type: 'fishing', x: L.x + 64, z: L.z, y: WATER_LEVEL, label: 'Pescar', data: {} });
  }

  // ============ MONTANHAS ============
  _buildMountains(scene) {
    const M = WORLD.mountains;
    for (let i = 0; i < 6; i++) {
      const r = P.makeTower(rand(4, 7), rand(2, 3));
      const x = M.x + rand(-90, 90), z = M.z + rand(-90, 90);
      P.placeAt(r, x, z); scene.add(r);
      this.addCollider(x, z, 3);
    }
    // depósitos de minério
    for (let i = 0; i < 5; i++) {
      const x = M.x + rand(-100, 100), z = M.z + rand(-100, 100);
      const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0),
        new THREE.MeshLambertMaterial({ color: 0x7a8a9a, emissive: 0x1a2a3a }));
      P.placeAt(ore, x, z, rand(0, 3)); scene.add(ore);
      this.addInteract({ type: 'collect', x, z, y: terrainHeight(x, z), label: 'Coletar minério', data: { item: 'minerio', respawn: 90 }, r: 2 });
    }
  }

  // ============ VULCÃO ============
  _buildVolcano(scene) {
    const V = WORLD.volcano;
    // lava
    const lava = new THREE.Mesh(new THREE.CircleGeometry(20, 20),
      new THREE.MeshBasicMaterial({ color: 0xff5a1a }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(V.x, terrainHeight(V.x, V.z) - 19 + 1.5, V.z);
    scene.add(lava);
    this.lava = lava;
    this.ambientEmitters.push({ type: 'lava', x: V.x, z: V.z, y: lava.position.y + 1, big: true });
    // rochas obsidiana
    for (let i = 0; i < 8; i++) {
      const x = V.x + rand(-70, 70), z = V.z + rand(-70, 70);
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1, 2.4), 0),
        new THREE.MeshLambertMaterial({ color: 0x1a1216, flatShading: true }));
      P.placeAt(r, x, z, rand(0, 3)); scene.add(r);
      this.addCollider(x, z, 1.6);
    }
    this.spawns.push({ type: 'fogoElemental', x: V.x, z: V.z + 40, r: 40, rank: 'C', count: 2, region: 'vulcao' });
  }

  // ============ CONGELADO ============
  _buildFrozen(scene) {
    const F = WORLD.frozen;
    for (let i = 0; i < 10; i++) {
      const x = F.x + rand(-140, 140), z = F.z + rand(-140, 140);
      const s = new THREE.Mesh(new THREE.ConeGeometry(rand(0.8, 2), rand(3, 8), 6),
        new THREE.MeshLambertMaterial({ color: 0x9fd4ee, transparent: true, opacity: 0.85, flatShading: true }));
      P.placeAt(s, x, z); scene.add(s);
    }
    // acampamento perdido
    this._addChest(scene, F.x + 40, F.z + 30, 'epico');
    this.spawns.push({ type: 'geloElemental', x: F.x, z: F.z, r: 60, rank: 'C', count: 3, region: 'congelado' });
  }

  // ============ PÂNTANO ============
  _buildSwamp(scene) {
    const S = WORLD.swamp;
    for (let i = 0; i < 10; i++) {
      const x = S.x + rand(-110, 110), z = S.z + rand(-110, 110);
      const dead = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 3.2, 5), P.PropMaterials.woodDark);
      trunk.position.y = 1.6; dead.add(trunk);
      for (let b = 0; b < 3; b++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.4, 4), P.PropMaterials.woodDark);
        br.position.set(rand(-0.4, 0.4), rand(2, 3), rand(-0.4, 0.4));
        br.rotation.z = rand(-1, 1); br.rotation.x = rand(-1, 1);
        dead.add(br);
      }
      P.placeAt(dead, x, z); scene.add(dead);
    }
    // cabana da bruxa
    const hut = P.makeHouse(5, 5, 2.8, { roofMat: new THREE.MeshLambertMaterial({ color: 0x2a3a2a }) });
    P.placeAt(hut, S.x + 20, S.z - 10, 0.7);
    scene.add(hut);
    this.addCollider(S.x + 20, S.z - 10, 4);
    this.nightWindows.push(hut);
    this.spawns.push({ type: 'goblin', x: S.x - 40, z: S.z + 30, r: 40, rank: 'D', count: 3, region: 'pantano' });
  }

  // ============ TERRITÓRIO GOBLIN ============
  _buildGoblinTerritory(scene) {
    const T = WORLD.goblin;
    // grande acampamento
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const t = P.makeTent();
      P.placeAt(t, T.x + Math.cos(a) * 16, T.z + Math.sin(a) * 16, a);
      scene.add(t);
    }
    const bigFire = P.makeTorch(1.4);
    P.placeAt(bigFire, T.x, T.z); scene.add(bigFire);
    this.torchFlames.push({ flame: bigFire.userData.flame, light: null, x: T.x, z: T.z });
    this.ambientEmitters.push({ type: 'campFire', x: T.x, z: T.z, y: terrainHeight(T.x, T.z) + 1.6, big: true });
    // totem
    const totem = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x8a2a2a : 0x3a3a3a }));
      s.position.y = 0.7 + i * 1.4; totem.add(s);
    }
    P.placeAt(totem, T.x + 10, T.z - 8); scene.add(totem);
    this.spawns.push({ type: 'goblin', x: T.x - 25, z: T.z + 15, r: 50, rank: 'C', count: 4, region: 'goblins' });
    this.spawns.push({ type: 'goblinGuerreiro', x: T.x + 15, z: T.z - 15, r: 40, rank: 'C', count: 3, region: 'goblins' });
    this.spawns.push({ type: 'goblinMago', x: T.x, z: T.z, r: 30, rank: 'C', count: 2, region: 'goblins' });
    this.spawns.push({ type: 'goblinElite', x: T.x + 30, z: T.z + 30, r: 25, rank: 'B', count: 1, region: 'goblins' });
    this._addChest(scene, T.x - 12, T.z - 12, 'lendario');
  }

  // ============ RUÍNAS ============
  _buildRuins(scene) {
    const R = WORLD.ruins;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = R.x + Math.cos(a) * 22, z = R.z + Math.sin(a) * 22;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, rand(3, 8), 8), P.PropMaterials.stone);
      P.placeAt(col, x, z, rand(-0.15, 0.15));
      col.rotation.z = rand(-0.2, 0.2);
      scene.add(col);
      this.addCollider(x, z, 1.2);
    }
    // altar central
    const altar = P.makeAltar();
    P.placeAt(altar, R.x, R.z); scene.add(altar);
    this.addCollider(R.x, R.z, 1.4);
    this.addInteract({ type: 'shrine', x: R.x, z: R.z, y: terrainHeight(R.x, R.z), label: 'Tocar o altar antigo', data: {}, r: 3 });
    this._addChest(scene, R.x + 14, R.z - 10, 'raro');
    this.spawns.push({ type: 'terraElemental', x: R.x + 20, z: R.z + 20, r: 40, rank: 'C', count: 2, region: 'ruinas' });
  }

  _addChest(scene, x, z, rarity) {
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.3) return;
    const chest = P.makeChest(rarity);
    P.placeAt(chest, x, z, rand(0, Math.PI * 2));
    scene.add(chest);
    this.addInteract({
      type: 'chest', x, z, y: h, label: 'Abrir baú', once: true,
      data: { rarity, mesh: chest }, r: 2.4,
    });
  }

  // ============ NATUREZA ESPALHADA ============
  _scatterNature(scene) {
    // árvores
    const treeSpots = [];
    const snowTreeSpots = [];
    for (let i = 0; i < 560; i++) {
      const x = rand(-430, 430), z = rand(-430, 430);
      if (this._blocked(x, z, this.roads)) continue;
      const hf = terrainHeight(x, z);
      if (hf > 20) continue;
      const frozen = Math.hypot(x - WORLD.frozen.x, z - WORLD.frozen.z) < 170;
      if (frozen) { if (Math.random() < 0.3) snowTreeSpots.push({ x, z }); continue; }
      // mais denso na floresta
      if (Math.hypot(x - WORLD.forest.x, z - WORLD.forest.z) < 150 || Math.random() < 0.45) treeSpots.push({ x, z });
    }
    // troncos instanciados
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.8, 6);
    const trunkMesh = P.makeInstanced(trunkGeo, P.PropMaterials.trunk, treeSpots.length + snowTreeSpots.length);
    const canopyGeo = new THREE.ConeGeometry(1.8, 4.2, 7);
    const canopyMesh = P.makeInstanced(canopyGeo, P.PropMaterials.leaf, treeSpots.length);
    const snowCanopyGeo = new THREE.ConeGeometry(1.5, 3.6, 7);
    const snowCanopyMesh = P.makeInstanced(snowCanopyGeo, P.PropMaterials.leafSnow, snowTreeSpots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let ti = 0, ci = 0, si = 0;
    for (const it of treeSpots) {
      const y = terrainHeight(it.x, it.z);
      const sc = rand(0.8, 1.6);
      q.setFromAxisAngle(up, rand(0, Math.PI * 2)); s.setScalar(sc);
      pv.set(it.x, y + 1.3 * sc, it.z);
      m.compose(pv, q, s); trunkMesh.setMatrixAt(ti++, m);
      pv.set(it.x, y + 4.2 * sc, it.z);
      m.compose(pv, q, s); canopyMesh.setMatrixAt(ci++, m);
      this.addCollider(it.x, it.z, 0.55 * sc);
    }
    for (const it of snowTreeSpots) {
      const y = terrainHeight(it.x, it.z);
      const sc = rand(0.8, 1.4);
      q.setFromAxisAngle(up, rand(0, Math.PI * 2)); s.setScalar(sc);
      pv.set(it.x, y + 1.2 * sc, it.z);
      m.compose(pv, q, s); trunkMesh.setMatrixAt(ti++, m);
      pv.set(it.x, y + 3.6 * sc, it.z);
      m.compose(pv, q, s); snowCanopyMesh.setMatrixAt(si++, m);
      this.addCollider(it.x, it.z, 0.55 * sc);
    }
    trunkMesh.count = ti; canopyMesh.count = ci; snowCanopyMesh.count = si;
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    snowCanopyMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh, canopyMesh, snowCanopyMesh);

    // pedras
    const rockSpots = [];
    for (let i = 0; i < 220; i++) {
      const x = rand(-440, 440), z = rand(-440, 430);
      if (this._blocked(x, z, this.roads)) continue;
      if (terrainHeight(x, z) > 30) continue;
      rockSpots.push({ x, z });
    }
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const rockMesh = P.makeInstanced(rockGeo, P.PropMaterials.stone, rockSpots.length);
    P.scatterPositions(rockSpots, rockMesh, 0.25, [0.5, 1.8]);
    scene.add(rockMesh);
    rockSpots.slice(0, 60).forEach(it => this.addCollider(it.x, it.z, 1));

    // grama (tufos) e flores — sem colisão
    const grassSpots = [];
    for (let i = 0; i < 1400; i++) {
      const x = rand(-420, 420), z = rand(-420, 420);
      if (this._blocked(x, z, this.roads)) continue;
      if (terrainHeight(x, z) > 18) continue;
      grassSpots.push({ x, z });
    }
    const grassGeo = new THREE.ConeGeometry(0.14, 0.55, 3);
    const grassMesh = P.makeInstanced(grassGeo, new THREE.MeshLambertMaterial({ color: 0x4a9a3a, flatShading: true }), grassSpots.length);
    grassMesh.castShadow = false;
    P.scatterPositions(grassSpots, grassMesh, 0.2, [0.7, 1.5]);
    scene.add(grassMesh);

    const flowerSpots = grassSpots.filter(() => Math.random() < 0.18).slice(0, 220);
    const flowerGeo = new THREE.SphereGeometry(0.12, 5, 4);
    const flowerColors = [0xe74c3c, 0xf1c40f, 0xecf0f1, 0x9b59b6];
    const flowerMesh = P.makeInstanced(flowerGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), flowerSpots.length);
    const col = new THREE.Color();
    flowerSpots.forEach((it, i) => {
      col.setHex(flowerColors[i % flowerColors.length]);
      const mm = new THREE.Matrix4();
      pv.set(it.x, terrainHeight(it.x, it.z) + 0.42, it.z);
      q.setFromAxisAngle(up, rand(0, 6)); s.setScalar(1);
      mm.compose(pv, q, s);
      flowerMesh.setMatrixAt(i, mm);
      flowerMesh.setColorAt(i, col);
    });
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    scene.add(flowerMesh);

    // ervas coletáveis
    const herbSpots = [
      { x: 80, z: 60 }, { x: -80, z: -30 }, { x: 190, z: 140 }, { x: -140, z: 180 },
      { x: 40, z: -120 }, { x: -260, z: -160 }, { x: 120, z: 300 }, { x: 260, z: -180 },
    ];
    for (const it of herbSpots) {
      const herb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4),
        new THREE.MeshLambertMaterial({ color: 0x35d478, emissive: 0x0a4a24 }));
      P.placeAt(herb, it.x, it.z);
      scene.add(herb);
      this.addInteract({ type: 'collect', x: it.x, z: it.z, y: terrainHeight(it.x, it.z), label: 'Coletar erva medicinal', data: { item: 'erva', respawn: 60, mesh: herb }, r: 2 });
    }
  }

  // ---------- consultas ----------
  height(x, z) { return terrainHeight(x, z); }

  collide(x, z, radius = 0.6) {
    for (const c of this.colliders) {
      if (!c.active && c.active !== undefined) continue;
      const d = dist2d(x, z, c.x, c.z) - c.r;
      if (d < radius) return c;
    }
    return null;
  }

  // move com deslizamento em paredes (teste eixo a eixo)
  resolveMove(oldX, oldZ, nx, nz, radius = 0.6) {
    if (!this.collide(nx, nz, radius)) return { x: nx, z: nz };
    if (!this.collide(nx, oldZ, radius)) return { x: nx, z: oldZ };
    if (!this.collide(oldX, nz, radius)) return { x: oldX, z: nz };
    return { x: oldX, z: oldZ };
  }

  regionAt(x, z) {
    for (const r of REGIONS) {
      if (dist2d(x, z, r.x, r.z) < r.r) return r;
    }
    return null;
  }

  update(dt, playerPos) {
    // água ondulando
    if (this.waterMesh) this.waterMesh.material.emissiveIntensity = 0.35 + 0.1 * Math.sin(G.playtime * 2);
    // vulcão pulsando
    if (this.lava) this.lava.material.color.setHSL(0.05, 1, 0.5 + 0.06 * Math.sin(G.playtime * 3));
    // chamas piscam
    for (const t of this.torchFlames) {
      if (t.flame) {
        t.flame.scale.setScalar(0.85 + 0.3 * Math.sin(G.playtime * 9 + t.x));
        t.flame.visible = true;
      }
    }
    // emissores ambiente
    const isNight = G.sky ? G.sky.isNight : false;
    for (const e of this.ambientEmitters) {
      e._t = (e._t || 0) + dt;
      if (e._t < 0.06) continue;
      e._t = 0;
      if (e.type === 'fountain') {
        effects.particles.burst(e.x + rand(-0.4, 0.4), e.y, e.z + rand(-0.4, 0.4), 2,
          { r: 0.5, g: 0.75, b: 1, spread: 0.6, up: 2.4, life: 0.7, size: 0.22, grav: 6 });
      } else if (e.type === 'forgeFire' || e.type === 'campFire') {
        const n = e.big ? 5 : 3;
        effects.particles.burst(e.x + rand(-0.3, 0.3), e.y, e.z + rand(-0.3, 0.3), n,
          { r: 1, g: rand(0.4, 0.6), b: 0.1, spread: 0.3, up: 1.8, life: 0.6, size: 0.35, grav: -1, drag: 0.95 });
      } else if (e.type === 'lava') {
        effects.particles.burst(e.x + rand(-14, 14), e.y, e.z + rand(-14, 14), 4,
          { r: 1, g: 0.4, b: 0.1, spread: 0.4, up: 1.4, life: 1.1, size: 0.5, grav: -0.6, drag: 0.96 });
      } else if (e.type === 'waterfall') {
        for (let i = 0; i < (e.big ? 6 : 3); i++) {
          effects.particles.burst(e.x + rand(-1.6, 1.6), e.y, e.z + rand(-1.6, 1.6), 1,
            { r: 0.7, g: 0.85, b: 1, spread: 0.2, up: -3, life: 0.8, size: 0.3, grav: 6, drag: 0.99 });
        }
      }
    }
    // vagalumes à noite
    if (isNight && Math.random() < dt * 8) {
      const a = rand(0, Math.PI * 2), d = rand(6, 24);
      const x = playerPos.x + Math.cos(a) * d, z = playerPos.z + Math.sin(a) * d;
      const y = terrainHeight(x, z) + rand(0.5, 2.5);
      effects.particles.emit({ x, y, z, vx: rand(-0.3, 0.3), vy: rand(0.1, 0.4), vz: rand(-0.3, 0.3), life: rand(2, 4), size: 0.25, r: 1, g: 0.95, b: 0.4, drag: 0.99, grav: 0 });
    }
    // pássaros circulando (sempre relativos ao jogador)
    if (this.birds && this._birdList) {
      this.birds.position.set(playerPos.x, 0, playerPos.z);
      for (const b of this._birdList) {
        b.ang += dt * b.speed * 0.4;
        const bx = Math.cos(b.ang) * b.r, bz = Math.sin(b.ang) * b.r;
        const by = b.h + Math.sin(b.ang * 3 + b.r) * 1.2;
        b.mesh.position.set(bx, by, bz);
        b.mesh.rotation.y = -b.ang + Math.PI / 2;
        // bater de asas
        const flap = Math.sin(G.playtime * 9 + b.r * 2) * 0.5;
        b.mesh.userData.wings[0].rotation.z = flap;
        b.mesh.userData.wings[1].rotation.z = -flap;
      }
    }
    // animais passeiam perto de casa
    if (this._animals) {
      for (const a of this._animals) {
        a.t += dt;
        const d = Math.hypot(playerPos.x - a.mesh.position.x, playerPos.z - a.mesh.position.z);
        if (d > 70) continue; // economiza CPU longe do jogador
        const wob = Math.sin(a.t * 0.4) * 3;
        const tx = a.hx + Math.cos(a.t * 0.25) * wob;
        const tz = a.hz + Math.sin(a.t * 0.25) * wob;
        const dx = tx - a.mesh.position.x, dz = tz - a.mesh.position.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 0.1) {
          a.mesh.position.x += dx / dl * a.speed * dt;
          a.mesh.position.z += dz / dl * a.speed * dt;
          a.mesh.rotation.y = Math.atan2(dx, dz);
          // bob de caminhada
          a.mesh.position.y = terrainHeight(a.mesh.position.x, a.mesh.position.z) + Math.abs(Math.sin(a.t * 6)) * 0.03;
        }
      }
    }
  }

  // portão da cidade abre/fecha (invasão)
  setGate(closed) {
    if (this.gateBar) this.gateBar.visible = closed;
    if (this.gateCollider) this.gateCollider.active = closed ? undefined : false;
    // active false → ignora; undefined → considera (colide)
    if (!closed && this.gateCollider) this.gateCollider.active = false;
    if (closed && this.gateCollider) delete this.gateCollider.active;
  }
}

function riverOutletX() {
  // ponto onde o rio cruza perto do lago
  return -170 + 60 * Math.sin(-10 * 0.012) + 30 * Math.sin(-10 * 0.033) + 30;
}
