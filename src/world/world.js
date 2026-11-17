import * as THREE from 'three';
import { random } from '../core/services.js';

const mats = {};
function mat(color, roughness = .9, extra = {}) {
  const key = `${color}-${roughness}-${JSON.stringify(extra)}`;
  return mats[key] ||= new THREE.MeshStandardMaterial({ color, roughness, ...extra });
}
function box(parent, name, x, y, z, sx, sy, sz, color, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color, options.roughness ?? .9, options.material || {}));
  mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = true;
  if (options.rotation) mesh.rotation.y = options.rotation;
  parent.add(mesh); return mesh;
}
function cylinder(parent, x, y, z, top, bottom, height, color, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function makeHouse(scene, x, z, scale = 1, color = 0xc5a77e, roof = 0x594637, rotation = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; g.scale.setScalar(scale); scene.add(g);
  box(g, 'Casa', 0, 1.15, 0, 5, 2.3, 4, color);
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(3.55, 2.25, 4), mat(roof));
  roofMesh.position.set(0, 3.35, 0); roofMesh.rotation.y = Math.PI / 4; roofMesh.scale.z = .78; roofMesh.castShadow = true; g.add(roofMesh);
  box(g, 'Porta', 0, .85, 2.02, .86, 1.7, .12, 0x493326);
  box(g, 'Janela', -1.35, 1.45, 2.04, .75, .7, .1, 0x93bbb3, { material: { emissive: 0x28413b, emissiveIntensity: .25 } });
  box(g, 'Janela', 1.35, 1.45, 2.04, .75, .7, .1, 0x93bbb3, { material: { emissive: 0x28413b, emissiveIntensity: .25 } });
  box(g, 'Moldura', 0, .85, 2.1, 1.05, .1, .12, 0x8c6941);
  return g;
}

function makeTree(scene, x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
  cylinder(g, 0, 1.1, 0, .2, .34, 2.2, 0x60462f, 6);
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05 - i * .12, 1), mat([0x416447, 0x4f7550, 0x587a52][(i + Math.floor(x + z + 20)) % 3]));
    crown.position.set((i % 2 - .5) * .28, 2.05 + i * .56, 0); crown.scale.set(1.1 - i * .12, 1.04, 1); crown.castShadow = true; crown.receiveShadow = true; g.add(crown);
  }
  return g;
}

function makeNpcModel(scene, x, z, tunic = 0x748c69, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); scene.add(group);
  cylinder(group, 0, .92, 0, .31, .37, .88, tunic, 7);
  cylinder(group, 0, 1.62, 0, .26, .27, .47, 0xd5a878, 7);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 6), mat(0x44332a)); hair.position.set(0, 1.89, -.03); hair.scale.set(1, .58, 1); group.add(hair);
  box(group, 'Braço', -.4, 1, 0, .19, .75, .2, 0xd5a878);
  box(group, 'Braço', .4, 1, 0, .19, .75, .2, 0xd5a878);
  box(group, 'Perna', -.17, .32, 0, .22, .62, .25, 0x423e37);
  box(group, 'Perna', .17, .32, 0, .22, .62, .25, 0x423e37);
  return group;
}

export class World {
  constructor(renderer) {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x9dbdc0); this.scene.fog = new THREE.Fog(0x9dbdc0, 60, 190);
    this.renderer = renderer; this.colliders = []; this.decor = new THREE.Group(); this.scene.add(this.decor);
    this.clock = 0; this.ambient = new THREE.HemisphereLight(0xdde9e1, 0x5d6246, 2.05); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffe6bc, 3); this.sun.position.set(-32, 55, 28); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536); this.sun.shadow.camera.left = -65; this.sun.shadow.camera.right = 65; this.sun.shadow.camera.top = 65; this.sun.shadow.camera.bottom = -65; this.sun.shadow.bias = -.00035; this.scene.add(this.sun);
    this.makeGround(); this.makeRoad(); this.makeVillage(); this.makeCastle(); this.makeNature(); this.makeSkyDetails();
  }
  addBlocker(x, z, width, depth) { this.colliders.push({ x, z, width, depth }); }
  makeGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(0x849268)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.08; ground.receiveShadow = true; this.scene.add(ground);
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 32, 32), new THREE.MeshStandardMaterial({ color: 0x75875c, roughness: 1, flatShading: true }));
    meadow.rotation.x = -Math.PI / 2; meadow.position.y = -.1; meadow.receiveShadow = true; this.scene.add(meadow);
    // Low-poly hills create a natural horizon without expensive terrain simulation.
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2, radius = random(75, 110), h = random(11, 25);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(random(13, 23), h, 7), mat(i % 3 ? 0x758365 : 0x87916d));
      hill.position.set(Math.cos(a) * radius, h / 2 - .2, Math.sin(a) * radius); hill.scale.z = random(.7, 1.2); hill.rotation.y = random(0, 6); hill.receiveShadow = true; this.scene.add(hill);
    }
  }
  makeRoad() {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 66), mat(0xa58e67)); road.rotation.x = -Math.PI / 2; road.position.set(0, .005, -16); road.receiveShadow = true; this.scene.add(road);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 33), mat(0xb7a37a)); path.rotation.x = -Math.PI / 2; path.position.set(0, .013, 8); this.scene.add(path);
    for (let i = 0; i < 23; i++) {
      const z = 14 - i * 2.4;
      for (const side of [-1, 1]) {
        const stone = new THREE.Mesh(new THREE.BoxGeometry(random(.3, .7), .08, random(.25, .6)), mat(i % 2 ? 0x958565 : 0xc0ad83));
        stone.position.set(side * random(2.5, 4.7), .04, z + random(-.7, .7)); stone.rotation.y = random(0, 6); stone.receiveShadow = true; this.decor.add(stone);
      }
    }
  }
  makeVillage() {
    makeHouse(this.scene, -12, 5, 1, 0xcdbb94, 0x665041, .05); this.addBlocker(-12, 5, 6, 5);
    makeHouse(this.scene, 13, 4, 1, 0xb9c39d, 0x725542, -.08); this.addBlocker(13, 4, 6, 5);
    makeHouse(this.scene, -15, -6, .9, 0xb9a68a, 0x53624b, .2); this.addBlocker(-15, -6, 5.5, 4.5);
    makeHouse(this.scene, 14, -8, .88, 0xd3c09d, 0x664b44, -.14); this.addBlocker(14, -8, 5.5, 4.5);
    makeHouse(this.scene, -11, -16, .86, 0xc7af87, 0x6a5945, -.1); this.addBlocker(-11, -16, 5.3, 4.3);
    makeHouse(this.scene, 12, -16, .9, 0xb2ba9c, 0x765741, .12); this.addBlocker(12, -16, 5.5, 4.5);
    // Central well and market stalls.
    cylinder(this.decor, 0, .43, 3, 1.12, 1.25, .8, 0x8f8c79, 10); cylinder(this.decor, 0, .88, 3, .9, .92, .12, 0x44615d, 10);
    for (const x of [-5.7, 5.7]) {
      box(this.decor, 'Banca', x, .85, 2, 2.6, .18, 1.55, 0x795b3c);
      for (const postX of [-1, 1]) box(this.decor, 'Poste', x + postX, 1.95, 2, .13, 2.2, .13, 0x60452e);
      box(this.decor, 'Toldo', x, 2.95, 2, 3, .16, 2, x < 0 ? 0x9c5e47 : 0x617c68);
      for (let j = 0; j < 5; j++) { const fruit = new THREE.Mesh(new THREE.SphereGeometry(.15, 7, 6), mat(j % 2 ? 0xb3523e : 0xd6ac53)); fruit.position.set(x - .8 + j * .4, 1.12, 1.6); this.decor.add(fruit); }
    }
    // Smithy and tavern signs.
    makeHouse(this.scene, -22, 1, .85, 0x847b69, 0x56493d, .3); this.addBlocker(-22, 1, 5, 4);
    box(this.decor, 'Placa da ferraria', -19.8, 2.3, 2.6, 1.25, .62, .12, 0xb98c4e);
    makeHouse(this.scene, 23, 0, .95, 0x796c59, 0x594238, -.25); this.addBlocker(23, 0, 5.5, 4.5);
    box(this.decor, 'Placa da taverna', 20.5, 2.5, 2.5, 1.3, .7, .12, 0xa9834e);
    // Fences and small vegetable plots.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) box(this.decor, 'Cerca', side * (19 + (i % 2) * 1.6), .48, 9 + Math.floor(i / 2) * 1.2, .12, .95, .12, 0x765937);
      for (let i = 0; i < 14; i++) {
        const plant = new THREE.Mesh(new THREE.SphereGeometry(.25, 6, 5), mat(i % 3 ? 0x567647 : 0xd6b85d));
        plant.scale.y = .65; plant.position.set(side * random(18, 28), .19, random(4, 15)); this.decor.add(plant);
      }
    }
  }
  makeCastle() {
    // Outer city walls and the gate frame the keep at the end of the village road.
    for (const side of [-1, 1]) {
      box(this.scene, 'Muralha', side * 31, 4.5, -12, 2.2, 9, 42, 0x958c76);
      box(this.scene, 'Parapeito', side * 31, 9.2, -12, 2.8, .8, 43, 0x706c5c);
      for (let i = 0; i < 8; i++) box(this.scene, 'Ameia', side * 31, 10, -31 + i * 5.5, 2.8, 1, 1.4, 0x817968);
      cylinder(this.scene, side * 31, 5.5, -31, 1.9, 2.2, 11, 0x85806f, 8);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.45, 4, 8), mat(0x494c45)); cone.position.set(side * 31, 13, -31); cone.castShadow = true; this.scene.add(cone);
    }
    // A real open passage through the wall; the earlier solid gate blocked the road.
    for (const x of [-4.25, 4.25]) {
      box(this.scene, 'Pilar do portao', x, 3.2, -32, 1, 6.4, 1.3, 0x574331);
      for (let y = .8; y < 5.8; y += 1.05) box(this.scene, 'Ferro do portao', x, y, -31.28, .12, .12, .12, 0x99713e);
    }
    box(this.scene, 'Arco do portao', 0, 6.4, -32, 9.5, 1, 1.3, 0x574331);
    // Keep's broad stair, facade, towers, and warm windows. Side and rear walls
    // leave the ceremonial entrance open for the player to walk through.
    box(this.scene, 'Castelo', 0, 5.4, -56, 25, 10.8, 1.5, 0xb7aa8c);
    for (const side of [-1, 1]) box(this.scene, 'Ala lateral', side * 11.6, 5.4, -48, 1.7, 10.8, 14, 0xb7aa8c);
    box(this.scene, 'Frontão', 0, 11.6, -39.5, 14, 2, 1.6, 0x8d8069);
    for (const x of [-10.5, 10.5]) {
      cylinder(this.scene, x, 7.8, -39.4, 2, 2.25, 15.5, 0xb6a98a, 8);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 4.8, 8), mat(0x4a5147)); roof.position.set(x, 18, -39.4); roof.castShadow = true; this.scene.add(roof);
      for (let y = 5; y < 12; y += 3) box(this.scene, 'Janela do castelo', x, y, -37.34, .68, 1.2, .12, 0xdbc38a, { material: { emissive: 0x876b3c, emissiveIntensity: .35 } });
    }
    // Open ceremonial entrance: the crystal remains visible from the courtyard.
    box(this.scene, 'Ala', -4.7, 4.8, -39.2, 2.3, 9.6, 1.8, 0x9c9078); box(this.scene, 'Ala', 4.7, 4.8, -39.2, 2.3, 9.6, 1.8, 0x9c9078);
    box(this.scene, 'Lintel', 0, 9.5, -39.2, 7.4, 1.5, 1.8, 0x8a7b65);
    for (let i = 0; i < 7; i++) box(this.scene, 'Degrau', 0, .16 + i * .19, -36.1 - i * .52, 13.5 - i * .45, .34, 1.25, 0xaaa18b);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const torch = new THREE.PointLight(0xffa64b, 1.35, 9); torch.position.set(side * 5.7, 3.1, -36 - i * 4); this.scene.add(torch);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(.19, .68, 6), mat(0xff9b3c, .35, { emissive: 0xe87528, emissiveIntensity: 1.3 })); flame.position.copy(torch.position).y += .38; this.decor.add(flame);
        box(this.decor, 'Tocha', side * 5.7, 2.6, -36 - i * 4, .11, .8, .11, 0x573d28);
      }
    }
    // Magical test pedestal and crystal.
    cylinder(this.decor, 0, .52, -44, 1.55, 1.85, .95, 0x77776b, 10);
    cylinder(this.decor, 0, 1.05, -44, .85, .92, .16, 0xc2a764, 10);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.92, 0), new THREE.MeshStandardMaterial({ color: 0x78b7bc, emissive: 0x397d83, emissiveIntensity: .7, roughness: .2, metalness: .22 }));
    crystal.name = 'power-crystal'; crystal.position.set(0, 2.45, -44); crystal.scale.set(.76, 1.55, .76); crystal.castShadow = true; this.decor.add(crystal); this.crystal = crystal;
    const glow = new THREE.PointLight(0x7adce1, 1.8, 13); glow.position.set(0, 2.5, -44); this.scene.add(glow); this.crystalLight = glow;
    for (const x of [-2, 2]) makeNpcModel(this.scene, x, -41, 0x596a76, .9);
  }
  makeNature() {
    for (let i = 0; i < 85; i++) {
      const a = random(0, Math.PI * 2), r = random(34, 100), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 28 && z < 22 && z > -56) continue;
      makeTree(this.scene, x, z, random(.72, 1.45));
    }
    // Stream, banks, rocks, and flower clumps add scale and visual texture.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4, 68), new THREE.MeshStandardMaterial({ color: 0x4b9fa7, roughness: .23, metalness: .18, transparent: true, opacity: .8 }));
    water.rotation.x = -Math.PI / 2; water.position.set(36, .02, 12); this.scene.add(water);
    for (let i = 0; i < 90; i++) {
      const x = random(-42, 42), z = random(-38, 35);
      if ((Math.abs(x) < 30 && z < 19 && z > -56) || (x > 32 && x < 40)) continue;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(random(.045, .09), 5, 4), mat([0xd7bd7a, 0xb97973, 0xe2d7b4][i % 3]));
      flower.position.set(x, .12, z); this.decor.add(flower);
      if (i % 4 === 0) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(random(.28, .75), 0), mat(i % 2 ? 0x77786b : 0x898273)); rock.position.set(x + 1.3, .28, z + .8); rock.scale.y = .7; rock.castShadow = true; this.decor.add(rock); }
    }
    for (let i = 0; i < 16; i++) {
      const x = -22 + i * 2.9;
      const person = makeNpcModel(this.scene, x, random(-9, 13), [0x71856c, 0x8d6856, 0x66798d, 0x9b8359][i % 4], random(.8, 1.02));
      person.rotation.y = random(0, 6.28);
    }
  }
  makeSkyDetails() {
    // Tiny warm windows hint at inhabited homes; dawn/dusk changes are driven by update().
    this.sunSphere = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe3a2 }));
    this.sunSphere.position.set(-44, 42, -60); this.scene.add(this.sunSphere);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe4e9ef })); this.moon.position.set(52, 45, -65); this.scene.add(this.moon);
  }
  update(dt) {
    this.clock += dt;
    const pulse = .9 + Math.sin(this.clock * 2.3) * .16; this.crystal.scale.y = 1.55 * pulse; this.crystal.rotation.y += dt * .34; this.crystalLight.intensity = 1.55 + Math.sin(this.clock * 2) * .3;
    const phase = this.clock / 300 * Math.PI * 2, daylight = .52 + Math.sin(phase - .8) * .35;
    this.sun.position.set(Math.cos(phase) * 45, Math.max(8, 35 + Math.sin(phase) * 38), 25);
    this.sun.intensity = .55 + daylight * 2.8; this.ambient.intensity = .65 + daylight * 1.35;
    const sky = new THREE.Color().setHSL(.52, .22, .2 + daylight * .33); this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    this.sunSphere.position.set(Math.cos(phase) * 65, 12 + Math.max(0, Math.sin(phase)) * 55, -65); this.sunSphere.visible = daylight > .35;
    this.moon.position.set(-Math.cos(phase) * 60, 18 + Math.max(0, -Math.sin(phase)) * 55, -70); this.moon.visible = daylight < .5;
  }
}
