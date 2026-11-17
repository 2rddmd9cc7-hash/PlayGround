// NPCs vivos — rotinas diárias, casas, diálogos, comércio
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { audio } from '../audio/audio.js';
import { effects } from '../effects/effects.js';
import { rand, dist2d, angleLerp, clamp } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

const MAT = {
  skin: new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
  tunic: new THREE.MeshLambertMaterial({ color: 0x6a7a5a }),
  pants: new THREE.MeshLambertMaterial({ color: 0x4a4438 }),
  hair: new THREE.MeshLambertMaterial({ color: 0x4a2c14 }),
  guard: new THREE.MeshLambertMaterial({ color: 0x6a7a8a }),
  guardMetal: new THREE.MeshLambertMaterial({ color: 0x9aa2a8 }),
  mage: new THREE.MeshLambertMaterial({ color: 0x4a2a7a }),
  priest: new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }),
  child: new THREE.MeshLambertMaterial({ color: 0x8a9a6a }),
};

const OUTFITS = {
  aldeao: { tunic: 0x7a8a5a }, aldeia: { tunic: 0x9a7a5a, skirt: true },
  ferreiro: { tunic: 0x5a4a3a, apron: true }, comerciante: { tunic: 0x8a6a2a },
  guarda: { tunic: 0x6a7a8a, guard: true }, soldado: { tunic: 0x5a6a7a, guard: true },
  mago: { tunic: 0x4a2a7a, robe: true }, sacerdote: { tunic: 0xd8d0c0, robe: true },
  taverneiro: { tunic: 0x8a4a3a }, crianca: { tunic: 0x8a9a6a, child: true, scale: 0.62 },
  fazendeiro: { tunic: 0x6a6a4a }, arqueiro: { tunic: 0x5a6a4a, guard: true },
  rainha: { tunic: 0x8a2a6a, robe: true }, rei: { tunic: 0x6a2a2a, robe: true },
};

export const NPC_DEFS = [
  { id: 'elder', name: 'Ancião Bram', role: 'Ancião da Vila', outfit: 'aldeao', home: { x: -2, z: -22 }, work: { x: 2, z: 4 }, dialog: 'elder' },
  { id: 'blacksmith', name: 'Ferreiro Doran', role: 'Ferreiro', outfit: 'ferreiro', home: { x: 26, z: -2 }, work: { x: 21, z: -11 }, dialog: 'blacksmith', shop: 'weapons' },
  { id: 'merchant', name: 'Comerciante Lila', role: 'Comerciante', outfit: 'comerciante', home: { x: 16, z: -10 }, work: { x: 10, z: 16 }, dialog: 'merchant', shop: 'general' },
  { id: 'innkeeper', name: 'Taverneiro Guss', role: 'Taverneiro', outfit: 'taverneiro', home: { x: -24, z: -16 }, work: { x: -22, z: -12 }, dialog: 'innkeeper' },
  { id: 'priest', name: 'Sacerdotisa Mirena', role: 'Sacerdotisa', outfit: 'sacerdote', home: { x: 4, z: -30 }, work: { x: 4, z: -26 }, dialog: 'priest' },
  { id: 'farmer', name: 'Fazendeiro Tom', role: 'Fazendeiro', outfit: 'fazendeiro', home: { x: -34, z: 20 }, work: { x: -34, z: 20 }, dialog: 'farmer' },
  { id: 'guard1', name: 'Guarda Fenwick', role: 'Guarda', outfit: 'guarda', home: { x: 16, z: -10 }, work: { x: 0, z: -34 }, dialog: 'guard', patrol: true },
  { id: 'child1', name: 'Pip', role: 'Criança', outfit: 'crianca', home: { x: 4, z: 22 }, work: { x: 6, z: 8 }, dialog: 'child', run: true },
  { id: 'child2', name: 'Nima', role: 'Criança', outfit: 'crianca', home: { x: 18, z: 12 }, work: { x: 8, z: 9 }, dialog: 'child2', run: true },
  { id: 'archmage', name: 'Arquimaga Selenar', role: 'Arquimaga do Reino', outfit: 'mago', home: { x: 0, z: -312 }, work: { x: 0, z: -306 }, dialog: 'archmage', castle: true },
  { id: 'captain', name: 'Capitão Aldric', role: 'Capitão da Guarda', outfit: 'soldado', home: { x: -40, z: 30 }, work: { x: 0, z: -270 }, dialog: 'captain', castle: true },
  { id: 'candidate1', name: 'Candidato Rove', role: 'Candidato ao Teste', outfit: 'aldeao', home: { x: -6, z: -290 }, work: { x: -6, z: -290 }, dialog: 'candidate', castle: true, static: true },
  { id: 'candidate2', name: 'Candidata Ysa', role: 'Candidata ao Teste', outfit: 'aldeia', home: { x: 6, z: -288 }, work: { x: 6, z: -288 }, dialog: 'candidate', castle: true, static: true },
  { id: 'candidate3', name: 'Candidato Bramm', role: 'Candidato ao Teste', outfit: 'ferreiro', home: { x: -10, z: -294 }, work: { x: -10, z: -294 }, dialog: 'candidate', castle: true, static: true },
  { id: 'queen', name: 'Rainha Isolde', role: 'Rainha de Aurelia', outfit: 'rainha', home: { x: 0, z: -322 }, work: { x: 0, z: -322 }, dialog: 'queen', castle: true, static: true },
  { id: 'traveler', name: 'Viajante Odd', role: 'Viajante', outfit: 'comerciante', home: { x: 0, z: 60 }, work: { x: 0, z: 60 }, dialog: 'traveler', wander: 40 },
];

function buildNPC(def) {
  const o = OUTFITS[def.outfit] || OUTFITS.aldeao;
  const scale = o.child ? 0.62 : 1;
  const g = new THREE.Group();
  const tunicMat = new THREE.MeshLambertMaterial({ color: o.tunic });
  // corpo
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.24), tunicMat);
  torso.position.y = 0.98; torso.castShadow = true; g.add(torso);
  if (o.robe) {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8), tunicMat);
    robe.position.y = 0.5; g.add(robe);
  }
  // cabeça
  const head = new THREE.Group(); head.position.y = 1.42; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), MAT.skin);
  skull.position.y = 0.08; skull.castShadow = true; head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), MAT.hair);
  hair.position.y = 0.13; hair.scale.set(1, 0.7, 1); head.add(hair);
  for (const sx of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), new THREE.MeshBasicMaterial({ color: 0x222228 }));
    eye.position.set(sx, 0.07, 0.15); head.add(eye);
  }
  // braços
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.26, 1.2, 0); g.add(sh);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.12), tunicMat);
    arm.position.y = -0.21; sh.add(arm);
    arms.push(sh);
  }
  // pernas
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.11, 0.75, 0); g.add(hip);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.15), MAT.pants);
    leg.position.y = -0.36; hip.add(leg);
    legs.push(hip);
  }
  // guardas: elmo + lança
  if (o.guard) {
    torso.material = MAT.guard;
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.guardMetal);
    helm.position.y = 1.48; g.add(helm);
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), MAT.hair);
    spear.position.set(0.34, 1.2, 0); g.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), MAT.guardMetal);
    tip.position.set(0.34, 2.4, 0); g.add(tip);
  }
  if (o.apron) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    apron.position.set(0, 0.9, 0.14); g.add(apron);
  }
  g.scale.setScalar(scale);
  g.userData.parts = { torso, head, arms, legs };
  return g;
}

class NPC {
  constructor(def, x, z) {
    this.def = def;
    this.root = buildNPC(def);
    this.name = def.name;
    this.role = def.role;
    this.house = def.home;
    this.work = def.work;
    this.state = 'idle';
    this.target = null;
    this.speed = def.run ? 2.2 : 1.3;
    this.animT = rand(0, 10);
    this.yaw = rand(0, Math.PI * 2);
    this.talkedTo = false;
    this.root.position.set(x, terrainHeight(x, z), z);
    this.moving = false;
    this.fleeing = false;
    this.dlgLines = null;
    this.dlgIdx = 0;
  }

  // rotina: dia → trabalho; noite → casa
  updateRoutine(hour) {
    const night = hour < 6.5 || hour > 19.5;
    const dest = night ? this.house : this.work;
    this.moving = dist2d(this.root.position.x, this.root.position.z, dest.x, dest.z) > 1.6;
    this.destX = dest.x; this.destZ = dest.z;
    if (night && G.storyFlags.invasion && !this.def.castle) this.fleeing = true;
    else this.fleeing = false;
  }

  update(dt, playerPos) {
    this.animT += dt;
    const p = this.root.position;
    let speed = 0;
    if (this.fleeing) {
      // correr para longe do jogador
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d < 12) {
        const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
        const l = Math.hypot(dx, dz) || 1;
        speed = this._step(p.x + dx / l * 5, p.z + dz / l * 5, dt, 3.2);
      }
    } else if (this.moving && this.destX !== undefined) {
      speed = this._step(this.destX, this.destZ, dt, this.def.run ? this.speed * 1.4 : this.speed);
    }
    // vagar
    if (this.def.wander && !this.moving) {
      this._wanderT = (this._wanderT || 0) - dt;
      if (this._wanderT <= 0) {
        this._wanderT = rand(4, 9);
        const a = rand(0, Math.PI * 2), d = rand(4, this.def.wander);
        this._wx = this.work.x + Math.cos(a) * d;
        this._wz = this.work.z + Math.sin(a) * d;
      }
      if (this._wx !== undefined) speed = Math.max(speed, this._step(this._wx, this._wz, dt, this.speed * 0.6));
    }
    // animação
    const parts = this.root.userData.parts;
    if (speed > 0.2) {
      const t = this.animT * (this.def.run ? 9 : 6);
      parts.legs[0].rotation.x = Math.sin(t) * 0.6;
      parts.legs[1].rotation.x = -Math.sin(t) * 0.6;
      parts.arms[0].rotation.x = -Math.sin(t) * 0.4;
      parts.arms[1].rotation.x = Math.sin(t) * 0.4;
      parts.torso.position.y = 0.98 + Math.abs(Math.sin(t)) * 0.03;
    } else {
      const b = Math.sin(this.animT * 1.5) * 0.02;
      parts.legs[0].rotation.x *= 0.9; parts.legs[1].rotation.x *= 0.9;
      parts.arms[0].rotation.x = b; parts.arms[1].rotation.x = -b;
      parts.head.rotation.y = Math.sin(this.animT * 0.4) * 0.3;
    }
  }

  _step(tx, tz, dt, speed) {
    const p = this.root.position;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) return 0;
    const nx = p.x + dx / d * speed * dt, nz = p.z + dz / d * speed * dt;
    const res = G.world.resolveMove(p.x, p.z, nx, nz, 0.4);
    p.set(res.x, terrainHeight(res.x, res.z), res.z);
    this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    this.root.rotation.y = this.yaw;
    return speed;
  }

  // olhar para o jogador ao conversar
  facePlayer(dt) {
    const p = this.root.position, pp = G.player.root.position;
    const targetYaw = Math.atan2(pp.x - p.x, pp.z - p.z);
    this.yaw = angleLerp(this.yaw, targetYaw, Math.min(1, dt * 8));
    this.root.rotation.y = this.yaw;
  }
}

class NPCManager {
  constructor() {
    this.npcs = [];
    this.interactables = [];
  }

  build(scene) {
    for (const def of NPC_DEFS) {
      const x = def.work.x, z = def.work.z;
      const npc = new NPC(def, x, z);
      scene.add(npc.root);
      this.npcs.push(npc);
      this.interactables.push({
        type: 'npc', npc, x, z, y: 0, label: `Falar com ${def.name}`,
        get x() { return npc.root.position.x; },
        get z() { return npc.root.position.z; },
        r: 2.4,
      });
    }
  }

  update(dt, playerPos) {
    for (const n of this.npcs) {
      n.updateRoutine(G.timeOfDay);
      const d = Math.hypot(n.root.position.x - playerPos.x, n.root.position.z - playerPos.z);
      if (d < 70) n.update(dt, playerPos);
    }
  }

  byId(id) { return this.npcs.find(n => n.def.id === id); }
}

export { NPCManager };
