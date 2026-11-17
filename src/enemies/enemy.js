// Inimigos — goblins, monstros elementais, IA, ranks e bosses
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { audio } from '../audio/audio.js';
import { effects } from '../effects/effects.js';
import { rand, randInt, pick, clamp, angleLerp } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';
import { input } from '../core/input.js';

const MAT = {
  skin: new THREE.MeshLambertMaterial({ color: 0x5a8a3a }),
  skinDark: new THREE.MeshLambertMaterial({ color: 0x4a7030 }),
  cloth: new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  clothRed: new THREE.MeshLambertMaterial({ color: 0x8a2a2a }),
  metal: new THREE.MeshLambertMaterial({ color: 0x8a8f94 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  eye: new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  eyeRed: new THREE.MeshBasicMaterial({ color: 0xff4830 }),
  eyeViolet: new THREE.MeshBasicMaterial({ color: 0xc46aff }),
  teeth: new THREE.MeshBasicMaterial({ color: 0xf2ead8 }),
  brow: new THREE.MeshLambertMaterial({ color: 0x2a3a14 }),
  loincloth: new THREE.MeshLambertMaterial({ color: 0x5a4630, side: THREE.DoubleSide }),
  ice: new THREE.MeshLambertMaterial({ color: 0x8cd9ff, emissive: 0x1a4a6a, transparent: true, opacity: 0.9 }),
  fire: new THREE.MeshLambertMaterial({ color: 0xff5a1a, emissive: 0x8a2a00, flatShading: true }),
  rock: new THREE.MeshLambertMaterial({ color: 0x7a6a55, flatShading: true }),
  shadow: new THREE.MeshLambertMaterial({ color: 0x1a1024, emissive: 0x3a0a3a, emissiveIntensity: 0.6, flatShading: true }),
  shadowEye: new THREE.MeshBasicMaterial({ color: 0xff2a6a }),
};

// variação de cor de pele por tipo de goblin
function goblinSkin(typeId) {
  if (typeId === 'goblinMago') return 0x6a5a8a;      // arcano roxo
  if (typeId === 'goblinCapitao') return 0x4a7a2a;   // verde escuro
  if (typeId === 'goblinElite') return 0x3a6a20;     // verde militar
  if (typeId === 'bossUgluk' || typeId === 'bossGoblinKing') return 0x6a3a2a; // marrom do boss
  if (typeId === 'goblinArqueiro') return 0x7a9a3a;  // verde pálido
  return 0x5a8a3a;                                   // verde padrão
}

export const RANKS = {
  E:  { hp: 1.0,  dmg: 1.0,  spd: 1.0,  reward: 1.0,  ai: 0 },
  D:  { hp: 1.5,  dmg: 1.25, spd: 1.05, reward: 1.6,  ai: 1 },
  C:  { hp: 2.2,  dmg: 1.5,  spd: 1.1,  reward: 2.4,  ai: 2 },
  B:  { hp: 3.2,  dmg: 1.9,  spd: 1.15, reward: 3.5,  ai: 3 },
  A:  { hp: 4.5,  dmg: 2.4,  spd: 1.2,  reward: 5,    ai: 3 },
  S:  { hp: 6.5,  dmg: 3.1,  spd: 1.28, reward: 7,    ai: 4 },
  SS: { hp: 9.0,  dmg: 4.0,  spd: 1.35, reward: 10,   ai: 4 },
};

export const ENEMY_TYPES = {
  goblin:          { name: 'Goblin', base: 'goblin', hp: 26, dmg: 6, speed: 3.4, xp: 12, melee: true, scale: 0.8 },
  goblinGuerreiro: { name: 'Goblin Guerreiro', base: 'goblin', hp: 42, dmg: 9, speed: 3.2, xp: 20, melee: true, scale: 0.9, armor: 2 },
  goblinArqueiro:  { name: 'Goblin Arqueiro', base: 'goblin', hp: 24, dmg: 8, speed: 3.0, xp: 22, ranged: true, scale: 0.8 },
  goblinMago:      { name: 'Goblin Mago', base: 'goblin', hp: 30, dmg: 11, speed: 2.8, xp: 28, caster: true, scale: 0.85 },
  goblinCapitao:   { name: 'Goblin Capitão', base: 'goblin', hp: 70, dmg: 13, speed: 3.6, xp: 45, melee: true, scale: 1.05, armor: 4 },
  goblinElite:     { name: 'Goblin Elite', base: 'goblin', hp: 110, dmg: 17, speed: 4.0, xp: 70, melee: true, scale: 1.15, armor: 6 },
  fogoElemental:   { name: 'Elemental de Fogo', base: 'fogo', hp: 60, dmg: 14, speed: 3.0, xp: 40, melee: true, scale: 1.0 },
  geloElemental:   { name: 'Elemental de Gelo', base: 'gelo', hp: 55, dmg: 12, speed: 2.6, xp: 40, melee: true, scale: 1.0 },
  terraElemental:  { name: 'Elemental de Terra', base: 'terra', hp: 90, dmg: 16, speed: 2.2, xp: 50, melee: true, scale: 1.2 },
  bossUgluk:       { name: 'Uglúk, o Devorador', base: 'goblin', hp: 420, dmg: 22, speed: 4.2, xp: 300, melee: true, scale: 1.7, armor: 8, boss: true },
  bossGoblinKing:  { name: 'Rei Goblin Groshnak', base: 'goblin', hp: 620, dmg: 26, speed: 4.4, xp: 500, melee: true, scale: 1.9, armor: 10, boss: true },
  bossMorgath:     { name: 'Morgath, o Devorador de Reinos', base: 'terra', hp: 1100, dmg: 34, speed: 4.8, xp: 1500, melee: true, scale: 3.0, armor: 14, boss: true, dark: true },
};

function buildGoblin(type, typeId) {
  const g = new THREE.Group();
  const s = type.scale || 1;
  // pele com tom por tipo (material próprio do inimigo)
  const skinMat = new THREE.MeshLambertMaterial({ color: goblinSkin(typeId) });
  const skinDarkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(goblinSkin(typeId)).multiplyScalar(0.72) });
  // corpo
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.34), skinMat);
  torso.position.y = 0.75; torso.castShadow = true; g.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), skinDarkMat);
  belly.position.set(0, 0.62, 0.06); belly.scale.set(1, 0.8, 0.8); g.add(belly);
  // tanga (roupa)
  const loincloth = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), MAT.loincloth);
  loincloth.position.set(0, 0.5, 0.18); g.add(loincloth);
  const loinclothBack = loincloth.clone(); loinclothBack.position.z = -0.18; g.add(loinclothBack);
  // cabeça com orelhas
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.25; head.scale.set(1, 0.9, 0.95); head.castShadow = true; g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), skinMat);
    ear.position.set(side * 0.24, 1.3, -0.02);
    ear.rotation.z = side * -1.9;
    g.add(ear);
  }
  // olhos: amarelo padrão, vermelho para elites/boss, violeta para o mago
  const eyeMat = (type.boss || type.armor >= 6) ? MAT.eyeRed : (type.caster ? MAT.eyeViolet : MAT.eye);
  for (const sx of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeMat);
    eye.position.set(sx, 1.27, 0.2); g.add(eye);
  }
  // rosto: sobrancelhas bravas + presas
  for (const sx of [-0.09, 0.09]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.03), MAT.brow);
    brow.position.set(sx, 1.34, 0.2); brow.rotation.z = sx > 0 ? -0.5 : 0.5; g.add(brow);
  }
  for (const sx of [-0.05, 0.05]) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), MAT.teeth);
    tooth.position.set(sx, 1.1, 0.2); tooth.rotation.x = Math.PI; g.add(tooth);
  }
  // braços
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 1.05, 0); g.add(sh);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.13), skinMat);
    upper.position.y = -0.16; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.32; sh.add(elbow);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.11), skinMat);
    fore.position.y = -0.14; elbow.add(fore);
    arms.push({ sh, elbow, side });
  }
  // pernas
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.14, 0.5, 0); g.add(hip);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.16), skinDarkMat);
    thigh.position.y = -0.15; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.3; hip.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.14), skinDarkMat);
    shin.position.y = -0.14; knee.add(shin);
    legs.push({ hip, knee });
  }
  // arma por tipo
  let weapon = null;
  if (type.ranged) {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 5, 12, Math.PI), MAT.wood);
    bow.rotation.z = Math.PI / 2;
    bow.position.set(0, -0.34, 0);
    arms[1].elbow.add(bow);
  } else if (type.caster) {
    const staff = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 5), MAT.wood);
    staff.add(stick);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9a4aff }));
    orb.position.y = 0.55; staff.add(orb);
    staff.position.set(0, -0.3, 0.1);
    arms[1].elbow.add(staff);
    weapon = staff;
  } else {
    const club = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.8, 5), MAT.wood);
    club.add(handle);
    const head2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), MAT.wood);
    head2.position.y = 0.45; club.add(head2);
    if (type.armor >= 4) {
      head2.material = MAT.metal;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.02), MAT.metal);
      blade.position.y = 0.75; club.add(blade);
    }
    club.position.set(0, -0.32, 0.05);
    arms[1].elbow.add(club);
    weapon = club;
  }
  // armaduras visuais
  if (type.armor >= 2) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.metal);
    helm.position.y = 1.28; g.add(helm);
  }
  if (type.armor >= 6) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.38), MAT.metal);
    chest.position.y = 0.8; g.add(chest);
  }
  // elemento visual
  if (type.base === 'fogo') {
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(rand(0.1, 0.2), rand(0.3, 0.6), 5), MAT.fire);
      fl.position.set(rand(-0.3, 0.3), rand(0.9, 1.5), rand(-0.2, 0.2));
      fl.rotation.z = rand(-0.4, 0.4);
      g.add(fl);
    }
    torso.material = MAT.fire;
  } else if (type.base === 'gelo') {
    torso.material = MAT.ice;
    head.material = MAT.ice;
  } else if (type.base === 'terra') {
    torso.material = MAT.rock;
    head.material = MAT.rock;
    g.scale.setScalar(1.2);
  }
  // lord sombrio (boss final)
  if (type.dark) {
    for (const m of [torso, head, belly]) { m.material = MAT.shadow; }
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), MAT.shadowEye);
    crown.position.y = 1.55; g.add(crown);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x3a0a3a, transparent: true, opacity: 0.22 }));
    aura.position.y = 1.0; g.add(aura);
    g.userData.aura = aura;
  }
  g.scale.setScalar(s);
  return { group: g, arms, legs };
}

class Enemy {
  constructor(typeId, x, z, rank) {
    this.typeId = typeId;
    this.type = ENEMY_TYPES[typeId];
    this.rank = rank || 'E';
    this.root = new THREE.Group();
    const built = buildGoblin(this.type, typeId);
    this.body = built.group;
    this.arms = built.arms;
    this.legs = built.legs;
    this.root.add(this.body);
    this.radius = 0.7 * (this.type.scale || 1);
    const rk = RANKS[this.rank];
    this.maxHp = this.type.hp * rk.hp;
    this.hp = this.maxHp;
    this.dmg = this.type.dmg * rk.dmg;
    this.speed = this.type.speed * rk.spd;
    this.xpReward = Math.round(this.type.xp * rk.reward);
    this.dead = false;
    this.stunned = 0;
    this.frozenT = 0;
    this.state = 'patrol';
    this.stateT = 0;
    this.homeX = x; this.homeZ = z;
    this.wanderT = 0; this.wanderX = x; this.wanderZ = z;
    this.attackCd = 0;
    this.animPhase = rand(0, 10);
    this.yaw = rand(0, Math.PI * 2);
    this.hurtFlash = 0;
    this.burnTicks = 0;
    this.lastTick = 0;
    this.patrolAng = rand(0, Math.PI * 2);
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.detectRange = 14 + rk.ai * 3;
    this.boss = !!this.type.boss;
    this.phase = 1;
    this.root.position.set(x, terrainHeight(x, z), z);
  }

  center() {
    return new THREE.Vector3(this.root.position.x, this.root.position.y + 0.9 * (this.type.scale || 1), this.root.position.z);
  }

  freeze(t) { this.frozenT = Math.max(this.frozenT, t); effects.flashSphere(this.root.position.x, this.root.position.y + 0.8, this.root.position.z, 1, 0x8cd9ff, 0.4, 0.5); }

  takeDamage(amount, opts = {}) {
    if (this.dead) return;
    const armor = (this.type.armor || 0);
    amount = Math.max(1, amount - armor * rand(0.7, 1.1));
    this.hp -= amount;
    this.hurtFlash = 1;
    // knockback
    if (opts.kb) {
      this._kbx = (opts.x || 0) * opts.kb; this._kbz = (opts.z || 0) * opts.kb;
    }
    this.stunned = Math.max(this.stunned, opts.heavy ? 0.5 : 0.18);
    G.hud?.damageEnemy?.(amount, this.center(), opts.crit, opts.element);
    audio.sfx(opts.crit ? 'crit' : 'hit');
    const c = opts.element ? { fogo: 0xff5515, agua: 0x3d8bff, raio: 0xffe633, terra: 0xb37433, vento: 0xb3ffbf, gelo: 0x8cd9ff }[opts.element] : 0xdd5544;
    effects.hit(this.root.position.x, this.root.position.y + 1, this.root.position.z, c, opts.crit ? 12 : 7, 0.35);
    if (opts.element === 'fogo') this.burnTicks = 3;
    // reagir: percebe o jogador
    if (this.state === 'patrol') this.state = 'chase';
    // medo em ranks baixos
    if (this.hp < this.maxHp * 0.2 && (this.rank === 'E' || this.rank === 'D') && Math.random() < 0.3) {
      this.state = 'flee';
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.deathT = 0;
    audio.sfx('goblin'); audio.sfx('death');
    effects.particles.burst(this.root.position.x, this.root.position.y + 0.8, this.root.position.z, 16, { r: 0.4, g: 0.6, b: 0.2, spread: 2.5, up: 1.5, life: 0.7, size: 0.35, grav: 4 });
    G.enemies?.onEnemyDeath(this);
  }

  update(dt, playerPos) {
    this.stateT += dt;
    this.animPhase += dt * 6;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.frozenT = Math.max(0, this.frozenT - dt);

    const px = playerPos.x, pz = playerPos.z;
    const my = this.root.position;
    const distP = Math.hypot(px - my.x, pz - my.z);
    const rk = RANKS[this.rank];

    // estados
    if (this.dead) {
      this.deathT += dt;
      this.body.rotation.x = Math.min(Math.PI / 2, this.deathT * 3);
      this.body.position.y = Math.max(-0.2, -this.deathT * 0.2);
      if (this.deathT > 3) this.root.visible = false;
      return;
    }
    if (this.frozenT > 0) {
      this.updatePose(dt, 'frozen');
      return;
    }
    if (this.stunned > 0) {
      this.updatePose(dt, 'stun');
      return;
    }

    const canSee = distP < this.detectRange;
    switch (this.state) {
      case 'patrol': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = rand(2, 5);
          this.patrolAng += rand(-1, 1);
          const range = this.boss ? 4 : 8;
          this.wanderX = this.homeX + Math.cos(this.patrolAng) * rand(0, range);
          this.wanderZ = this.homeZ + Math.sin(this.patrolAng) * rand(0, range);
        }
        this._moveTowards(this.wanderX, this.wanderZ, dt, this.speed * 0.4);
        if (canSee && !G.player.dead) {
          this.state = 'chase';
          if (distP < 20) audio.sfx('goblin');
          if (this.boss) G.story?.onBossSeen(this);
        }
        break;
      }
      case 'chase': {
        if (distP > this.detectRange * 2.2 || G.player.dead) { this.state = 'patrol'; break; }
        const atkRange = this.type.ranged ? 11 : this.type.caster ? 9 : 1.5 + this.radius + 0.4;
        if (distP <= atkRange && this.attackCd <= 0) {
          this.state = 'attack';
          this.stateT = 0;
          this.attackCd = rand(1.4, 2.6) / (1 + rk.ai * 0.15);
        } else {
          // rank alto: cercar (strafe)
          if (rk.ai >= 2 && distP < 10) {
            const ang = Math.atan2(my.x - px, my.z - pz) + this.strafeDir * 0.7;
            this._moveTowards(px + Math.sin(ang) * 2.5, pz + Math.cos(ang) * 2.5, dt, this.speed);
            if (Math.random() < dt * 0.5) this.strafeDir *= -1;
          } else {
            this._moveTowards(px, pz, dt, this.speed);
          }
          if (this.type.caster || this.type.ranged) {
            // manter distância
            if (distP < 5) this._moveAway(px, pz, dt, this.speed * 0.8);
          }
        }
        break;
      }
      case 'attack': {
        const windup = this.type.caster ? 0.8 : this.type.ranged ? 0.6 : 0.4;
        this.yaw = angleLerp(this.yaw, Math.atan2(px - my.x, pz - my.z), Math.min(1, dt * 10));
        if (this.stateT >= windup && !this._attacked) {
          this._attacked = true;
          this._doAttack(distP);
        }
        if (this.stateT >= windup + 0.5) {
          this._attacked = false;
          this.state = 'chase';
        }
        break;
      }
      case 'flee': {
        this._moveAway(px, pz, dt, this.speed * 1.1);
        if (distP > 20) { this.state = 'patrol'; }
        break;
      }
    }
    // knockback decai
    this._kbx = (this._kbx || 0) * Math.pow(0.001, dt);
    this._kbz = (this._kbz || 0) * Math.pow(0.001, dt);

    // posição
    let nx = my.x + (this._vx || 0) * dt + this._kbx * dt;
    let nz = my.z + (this._vz || 0) * dt + this._kbz * dt;
    const res = G.world.resolveMove(my.x, my.z, nx, nz, this.radius);
    const gy = terrainHeight(res.x, res.z);
    this.root.position.set(res.x, gy, res.z);
    this.root.rotation.y = this.yaw;
    // queimadura
    if (this.burnTicks > 0 && Math.random() < dt * 2) {
      this.takeDamage(4, { element: 'fogo' });
      this.burnTicks--;
    }
    this.updatePose(dt, this.state);
  }

  _moveTowards(x, z, dt, speed) {
    const my = this.root.position;
    const dx = x - my.x, dz = z - my.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      this._vx = (dx / d) * speed; this._vz = (dz / d) * speed;
      this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
    } else { this._vx = this._vz = 0; }
  }
  _moveAway(x, z, dt, speed) {
    const my = this.root.position;
    const dx = my.x - x, dz = my.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this._vx = (dx / d) * speed; this._vz = (dz / d) * speed;
    this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
  }

  _doAttack(distP) {
    const pl = G.player;
    if (this.type.ranged) {
      // flecha
      const from = new THREE.Vector3(this.root.position.x, this.root.position.y + 1.1, this.root.position.z);
      const to = new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1, pl.root.position.z);
      // erro de mira por rank
      const err = (1 - RANKS[this.rank].ai * 0.15) * rand(-0.8, 0.8);
      to.x += err; to.z += err;
      G.projectiles?.enemyArrow(from, to, this.dmg);
      audio.sfx('swing');
    } else if (this.type.caster) {
      // bola sombria
      const from = this.center();
      const to = new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1, pl.root.position.z);
      G.projectiles?.enemyBolt(from, to, this.dmg, 0x9a4aff);
      audio.sfx('magicCast', { element: 'raio' });
    } else {
      // golpe corpo a corpo
      const dir = Math.atan2(pl.root.position.x - this.root.position.x, pl.root.position.z - this.root.position.z);
      if (distP < 2.6 + this.radius) {
        const hit = pl.takeDamage(this.dmg, { x: Math.sin(dir), z: Math.cos(dir), kb: 4 });
        if (this.boss && this.phase >= 2 && Math.random() < 0.4) {
          // combo do boss
          setTimeout(() => { if (!this.dead && !G.player.dead) pl.takeDamage(this.dmg * 0.8, { x: Math.sin(dir), z: Math.cos(dir), kb: 6 }); }, 350);
        }
      }
      audio.sfx('swing');
      effects.slash(this.root.position.x, this.root.position.y + 0.9 * (this.type.scale || 1), this.root.position.z, dir, this.boss ? 0xff6a33 : 0xffb066, 0.8 + (this.type.scale || 1) * 0.35);
      effects.particles.burst(this.root.position.x + Math.sin(dir) * 1, this.root.position.y + 1, this.root.position.z + Math.cos(dir) * 1, 6, { r: 1, g: 0.85, b: 0.6, spread: 1.4, life: 0.3, size: 0.3 });
      if (this.boss) {
        // onda de choque
        effects.flashSphere(this.root.position.x, this.root.position.y + 0.3, this.root.position.z, 3, 0xff8844, 0.4, 0.4);
      }
    }
  }

  updatePose(dt, state) {
    const t = this.animPhase;
    let lHip = 0, rHip = 0, lSh = 0, rSh = 0;
    let bodyBob = 0, torsoLean = 0;
    if (state === 'chase' || state === 'flee') {
      const amp = 0.7;
      lHip = Math.sin(t) * amp; rHip = -Math.sin(t) * amp;
      lSh = Math.sin(t + Math.PI) * amp * 0.7; rSh = Math.sin(t) * amp * 0.7;
      bodyBob = Math.abs(Math.sin(t)) * 0.05;
      torsoLean = 0.15;
    } else if (state === 'attack') {
      const p = clamp(this.stateT / 0.9, 0, 1);
      const wind = Math.min(1, p * 2), strike = clamp((p - 0.45) * 3, 0, 1);
      rSh = -2.4 * wind + strike * 2.6;
      torsoLean = 0.2 * strike;
    } else if (state === 'stun') {
      torsoLean = Math.sin(t * 3) * 0.2;
      lSh = rSh = Math.sin(t * 3) * 0.3;
    } else if (state === 'frozen') {
      torsoLean = 0;
    } else {
      // patrol / idle
      lHip = Math.sin(t * 0.5) * 0.15; rHip = -Math.sin(t * 0.5) * 0.15;
      bodyBob = Math.sin(t * 0.8) * 0.02;
    }
    // aplicar
    this.legs[0].hip.rotation.x += (lHip - this.legs[0].hip.rotation.x) * Math.min(1, dt * 10);
    this.legs[1].hip.rotation.x += (rHip - this.legs[1].hip.rotation.x) * Math.min(1, dt * 10);
    this.arms[0].sh.rotation.x += (lSh - this.arms[0].sh.rotation.x) * Math.min(1, dt * 10);
    this.arms[1].sh.rotation.x += (rSh - this.arms[1].sh.rotation.x) * Math.min(1, dt * 10);
    this.body.position.y = bodyBob;
    // flash de dano
    this.body.traverse(o => {
      if (o.isMesh && o.material.emissive !== undefined) {
        o.material.emissive.setScalar(this.hurtFlash * 0.5);
      }
    });
    // chamas do elemental
    if (this.typeId === 'fogoElemental') {
      this.body.children.forEach((c, i) => {
        if (c.geometry?.type === 'ConeGeometry') c.rotation.z = Math.sin(t + i) * 0.4;
      });
      if (Math.random() < dt * 8) {
        effects.particles.emit({ x: this.root.position.x + rand(-0.3, 0.3), y: this.root.position.y + rand(0.5, 1.5), z: this.root.position.z + rand(-0.3, 0.3), vy: 1, life: 0.4, size: 0.3, r: 1, g: 0.4, b: 0.1, drag: 0.95 });
      }
    }
  }
}

class EnemyManager {
  constructor() {
    this.active = [];
    this.spawnDefs = [];
    this.respawnTimers = {};
  }

  buildAll(scene) {
    // coleta spawns definidos pelo mundo
    this.spawnDefs = G.world.spawns.map(s => ({ ...s }));
    // + monstros noturnos perto da vila
    this.spawnDefs.push({ type: 'goblin', x: 60, z: 60, r: 30, rank: 'D', count: 2, region: 'floresta', night: true });
  }

  update(dt, playerPos) {
    // spawn/despawn por distância
    for (const def of this.spawnDefs) {
      const dist = Math.hypot(playerPos.x - def.x, playerPos.z - def.z);
      const alive = this.active.filter(e => e.spawnDef === def && !e.dead).length;
      if (def.night && !(G.sky && G.sky.isNight)) continue;
      if (dist < 70 && alive < def.count) {
        const missing = def.count - alive;
        for (let i = 0; i < missing; i++) {
          if (this.active.length > 28) break;
          this.spawnAt(def);
        }
      }
    }
    // remove mortos antigos (invasores e bosses nunca são removidos por distância)
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      const far = e.root.position.distanceTo(new THREE.Vector3(playerPos.x, e.root.position.y, playerPos.z)) > 90;
      if ((e.dead && e.deathT > 4) || (far && !e.boss && !e.invasion)) {
        G.scene.remove(e.root);
        this.active.splice(i, 1);
      }
    }
    // IA
    for (const e of this.active) {
      const d = Math.hypot(e.root.position.x - playerPos.x, e.root.position.z - playerPos.z);
      if (d < 75 || e.boss || e.invasion) e.update(dt, playerPos);
    }
    // invasão: spawner especial controlado pela história
    this.invasion?.(dt);
  }

  spawnAt(def, x = null, z = null) {
    const px = x ?? def.x + rand(-def.r, def.r);
    const pz = z ?? def.z + rand(-def.r, def.r);
    const e = new Enemy(def.type, px, pz, def.rank);
    e.root.position.set(px, terrainHeight(px, pz), pz);
    e.spawnDef = def;
    if (terrainHeight(px, pz) < 0.6 && def.x !== undefined) { e.root.position.set(def.x, terrainHeight(def.x, def.z), def.z); }
    G.scene.add(e.root);
    this.active.push(e);
    return e;
  }

  spawnBoss(typeId, x, z, rank = 'B') {
    const e = new Enemy(typeId, x, z, rank);
    e.spawnDef = null;
    G.scene.add(e.root);
    this.active.push(e);
    return e;
  }

  onEnemyDeath(e) {
    // XP e loot
    // contagem da invasão
    if (e.invasion && G.story?.invasionState) {
      const st = G.story.invasionState;
      if (st.wave < st.waves.length) st.waveKills++;
    }
    const xp = e.xpReward;
    G.quests?.onKill?.(e);
    G.story?.addXp?.(xp);
    const gold = Math.round(rand(3, 10) * RANKS[e.rank].reward * (e.boss ? 12 : 1));
    G.gold += gold;
    G.hud?.toast(`+${gold} 🪙`);
    audio.sfx('coin');
    // chance de drop
    const dropChance = e.boss ? 1 : 0.18 + RANKS[e.rank].reward * 0.04;
    if (Math.random() < dropChance) {
      G.inventory?.rollLoot(e.rank, e.boss);
    }
    if (Math.random() < 0.3) G.inventory?.addItem({ id: 'erva', qty: 1 });
    G.hud?.updateAll?.();
  }

  aliveCount() { return this.active.filter(e => !e.dead).length; }

  clearRegion(x, z, r) {
    for (const e of this.active) {
      if (Math.hypot(e.root.position.x - x, e.root.position.z - z) < r) e.die?.();
    }
  }
}

export { Enemy, EnemyManager };
