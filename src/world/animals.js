// Animais ambientes — galinhas na vila, cervos nos campos/floresta
// Leves: animação procedural, vagar com pontos de interesse e fuga do jogador
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { rand, dist2d, angleLerp } from '../core/utils.js';
import { terrainHeight } from './terrain.js';

const MAT = {
  chicken: new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  chickenRed: new THREE.MeshLambertMaterial({ color: 0xc03a2a }),
  beak: new THREE.MeshLambertMaterial({ color: 0xe8a83a }),
  deer: new THREE.MeshLambertMaterial({ color: 0x8a6238 }),
  deerDark: new THREE.MeshLambertMaterial({ color: 0x5a4020 }),
  antler: new THREE.MeshLambertMaterial({ color: 0xc8b088 }),
};

function buildChicken() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MAT.chicken);
  body.scale.set(1, 0.9, 1.15); body.position.y = 0.22; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), MAT.chicken);
  head.position.set(0, 0.4, 0.13); g.add(head);
  const comb = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), MAT.chickenRed);
  comb.position.set(0, 0.47, 0.12); g.add(comb);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), MAT.beak);
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.4, 0.22); g.add(beak);
  for (const sx of [-0.05, 0.05]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 3), MAT.beak);
    leg.position.set(sx, 0.07, 0); g.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), MAT.chickenRed);
  tail.rotation.x = -2.4; tail.position.set(0, 0.3, -0.16); g.add(tail);
  g.userData.kind = 'chicken';
  return g;
}

function buildDeer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.95), MAT.deer);
  body.position.y = 0.85; body.castShadow = true; g.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.22), MAT.deer);
  neck.position.set(0, 1.16, 0.42); neck.rotation.x = -0.35; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.34), MAT.deer);
  head.position.set(0, 1.35, 0.6); g.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), MAT.deerDark);
  nose.position.set(0, 1.33, 0.78); g.add(nose);
  // galhada
  for (const sx of [-1, 1]) {
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.3, 4), MAT.antler);
    a1.position.set(sx * 0.07, 1.55, 0.6); a1.rotation.z = sx * -0.35; g.add(a1);
    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4), MAT.antler);
    a2.position.set(sx * 0.14, 1.68, 0.58); a2.rotation.z = sx * -0.9; g.add(a2);
  }
  const legs = [];
  for (const [sx, sz] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]]) {
    const hip = new THREE.Group(); hip.position.set(sx, 0.64, sz); g.add(hip);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.64, 0.1), MAT.deerDark);
    leg.position.y = -0.32; hip.add(leg);
    legs.push(hip);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), MAT.chicken);
  tail.position.set(0, 0.95, -0.5); g.add(tail);
  g.userData.kind = 'deer';
  g.userData.legs = legs;
  return g;
}

class Animal {
  constructor(kind, x, z, homeR) {
    this.kind = kind;
    this.root = kind === 'chicken' ? buildChicken() : buildDeer();
    // reposiciona se o ponto sorteado cair dentro de uma construção/colisor
    const spot = AnimalManager.freeSpot(x, z);
    this.home = { x: spot.x, z: spot.z };
    this.homeR = homeR || 10;
    this.speed = kind === 'chicken' ? 0.9 : 2.2;
    this.animT = rand(0, 10);
    this.yaw = rand(0, Math.PI * 2);
    this.state = 'idle';
    this.stateT = rand(0.5, 2);
    this.wx = this.home.x; this.wz = this.home.z;
    this.root.position.set(this.home.x, terrainHeight(this.home.x, this.home.z), this.home.z);
  }

  update(dt, playerPos) {
    this.animT += dt;
    this.stateT -= dt;
    const p = this.root.position;
    const dP = dist2d(p.x, p.z, playerPos.x, playerPos.z);
    let speed = 0;

    // fuga: cervo corre, galinha se agita e foge em distância curta
    const fleeDist = this.kind === 'deer' ? 9 : 4.5;
    if (dP < fleeDist) {
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
      let l = Math.hypot(dx, dz);
      let ux, uz;
      if (l < 0.001) { const a = rand(0, Math.PI * 2); ux = Math.cos(a); uz = Math.sin(a); }
      else { ux = dx / l; uz = dz / l; }
      speed = this._step(p.x + ux * 6, p.z + uz * 6, dt, this.speed * 2.2);
      this.state = 'flee';
      this.stateT = 1.5;
      this.wx = p.x + ux * 6; this.wz = p.z + uz * 6;
    } else if (this.state === 'flee' && this.stateT > 0) {
      speed = this._step(this.wx, this.wz, dt, this.speed * 1.6);
    } else {
      this.state = 'idle';
      if (this.stateT <= 0) {
        // novo ponto de interesse perto de casa
        const a = rand(0, Math.PI * 2), r = rand(1, this.homeR);
        this.wx = this.home.x + Math.cos(a) * r;
        this.wz = this.home.z + Math.sin(a) * r;
        this.stateT = rand(2, 6);
        this.moving = true;
      }
      if (this.moving) {
        speed = this._step(this.wx, this.wz, dt, this.speed);
        if (dist2d(p.x, p.z, this.wx, this.wz) < 0.5) this.moving = false;
      }
    }

    // animação
    if (this.kind === 'chicken') {
      const bob = Math.abs(Math.sin(this.animT * (speed > 0 ? 14 : 3))) * (speed > 0 ? 0.05 : 0.012);
      this.root.position.y = terrainHeight(p.x, p.z) + bob;
      this.root.rotation.z = speed > 0 ? Math.sin(this.animT * 14) * 0.08 : 0;
      // bicadas quando parada
      if (speed === 0 && Math.sin(this.animT * 2.2) > 0.85) this.root.rotation.x = 0.25; else this.root.rotation.x *= 0.9;
    } else {
      const legs = this.root.userData.legs;
      if (legs) {
        const t = this.animT * (speed > 0 ? 8 : 2);
        legs[0].rotation.x = Math.sin(t) * 0.5 * (speed > 0 ? 1 : 0.15);
        legs[1].rotation.x = -Math.sin(t) * 0.5 * (speed > 0 ? 1 : 0.15);
        legs[2].rotation.x = -Math.sin(t) * 0.5 * (speed > 0 ? 1 : 0.15);
        legs[3].rotation.x = Math.sin(t) * 0.5 * (speed > 0 ? 1 : 0.15);
      }
      // pastejo
      this.root.rotation.x = (speed === 0 && Math.sin(this.animT * 0.7) > 0.6) ? 0.2 : this.root.rotation.x * 0.92;
    }
  }

  _step(tx, tz, dt, speed) {
    const p = this.root.position;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return 0;
    const nx = p.x + dx / d * speed * dt, nz = p.z + dz / d * speed * dt;
    const res = G.world.resolveMove(p.x, p.z, nx, nz, 0.3);
    p.set(res.x, terrainHeight(res.x, res.z), res.z);
    this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    this.root.rotation.y = this.yaw;
    return speed;
  }
}

export class AnimalManager {
  constructor() {
    this.animals = [];
  }

  // procura um ponto livre de colisores em anéis ao redor de (x,z)
  static freeSpot(x, z) {
    if (!G.world?.collide(x, z, 0.7)) return { x, z };
    for (let r = 3; r <= 24; r += 3) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
        if (!G.world.collide(nx, nz, 0.7)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }

  build(scene) {
    this.scene = scene;
    // galinhas na vila (pátios e praça)
    const chickenSpots = [[-14, 14], [-10, 18], [8, 16], [18, -2], [12, 20]];
    for (const [x, z] of chickenSpots) {
      const a = new Animal('chicken', x, z, 4);
      scene.add(a.root);
      this.animals.push(a);
    }
    // cervos nos campos a leste da vila e na orla da floresta
    const deerSpots = [[72, 24], [88, 40], [60, 52], [-40, -90], [-58, -104], [40, -96]];
    for (const [x, z] of deerSpots) {
      const a = new Animal('deer', x, z, 12);
      scene.add(a.root);
      this.animals.push(a);
    }
  }

  update(dt, playerPos) {
    for (const a of this.animals) {
      // otimização: animais distantes atualizam em taxa reduzida
      const d = Math.hypot(a.root.position.x - playerPos.x, a.root.position.z - playerPos.z);
      if (d > 90) continue;
      if (d > 45) { a._skip = (a._skip || 0) + 1; if (a._skip % 3 !== 0) continue; a.update(dt * 3, playerPos); continue; }
      a.update(dt, playerPos);
    }
  }
}
