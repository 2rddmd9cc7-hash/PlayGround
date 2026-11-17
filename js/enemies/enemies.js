/* =========================================================
 * Aetheria — Inimigos: goblins, lobos, esqueletos, slimes
 * IA: patrulhar → detectar → perseguir → atacar → cercar → recuar/fugir
 * Ranks E…SS escalam HP, dano, velocidade, IA e recompensas.
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { buildHumanoid, buildSword } from '../player/character.js';
import { rand, randi, pick, chance, clamp, damp, lerpAngle, dist } from '../core/utils.js';
import { RANK_MULT, RANKS } from '../magic/elements.js';
import { Projectile } from '../magic/spells.js';
import { FX } from '../effects/particles.js';

/* ---------- definição de tipos ---------- */
export const ENEMY_TYPES = {
  goblin:        { name: 'Goblin',            hp: 30,  dmg: 8,  speed: 3.2, atkRange: 1.7, atkCd: 1.5, detect: 11, xp: 14, gold: [3, 8], scale: 0.72, skin: 0x6a8a3a, cloth: 0x5a4a2a, rank: 'E', ranged: false },
  goblinWarrior: { name: 'Goblin Guerreiro',  hp: 55,  dmg: 12, speed: 3.4, atkRange: 1.9, atkCd: 1.3, detect: 13, xp: 26, gold: [6, 14], scale: 0.85, skin: 0x5a7a32, cloth: 0x6a3020, rank: 'D', ranged: false, weapon: true },
  goblinArcher:  { name: 'Goblin Arqueiro',   hp: 34,  dmg: 11, speed: 3.0, atkRange: 13, atkCd: 2.2, detect: 17, xp: 24, gold: [6, 12], scale: 0.74, skin: 0x6a8a3a, cloth: 0x3a4a2a, rank: 'D', ranged: true, keepDist: 9 },
  goblinMage:    { name: 'Goblin Mago',       hp: 38,  dmg: 14, speed: 2.8, atkRange: 11, atkCd: 3, detect: 16, xp: 34, gold: [10, 18], scale: 0.74, skin: 0x7a9a42, cloth: 0x2a2a5a, rank: 'C', ranged: true, keepDist: 9, magicColor: 0x9a5aff },
  goblinCaptain: { name: 'Goblin Capitão',    hp: 110, dmg: 18, speed: 3.6, atkRange: 2.1, atkCd: 1.1, detect: 15, xp: 70, gold: [18, 40], scale: 1.05, skin: 0x4a6a2a, cloth: 0x5a1a12, rank: 'C', ranged: false, weapon: true },
  goblinElite:   { name: 'Goblin Elite',      hp: 160, dmg: 24, speed: 3.9, atkRange: 2.2, atkCd: 1.0, detect: 17, xp: 120, gold: [30, 60], scale: 1.15, skin: 0x3a5a22, cloth: 0x2a1a3a, rank: 'B', ranged: false, weapon: true },
  goblinKing:    { name: 'Rei Goblin Gronnak',hp: 550, dmg: 30, speed: 3.4, atkRange: 2.6, atkCd: 1.4, detect: 24, xp: 400, gold: [120, 260], scale: 1.5, skin: 0x3a5a22, cloth: 0x6a1a0a, rank: 'A', ranged: false, weapon: true, boss: true },
  wolf:          { name: 'Lobo Selvagem',     hp: 40,  dmg: 12, speed: 4.6, atkRange: 1.7, atkCd: 1.2, detect: 14, xp: 20, gold: [0, 4], scale: 1, animal: true },
  skeleton:      { name: 'Esqueleto',         hp: 45,  dmg: 13, speed: 2.9, atkRange: 1.8, atkCd: 1.6, detect: 13, xp: 24, gold: [2, 10], scale: 0.9, skin: 0xd8d0c0, cloth: 0x4a4a42, night: true },
  slime:         { name: 'Slime do Pântano',  hp: 60,  dmg: 9,  speed: 2.2, atkRange: 1.9, atkCd: 2.0, detect: 10, xp: 18, gold: [2, 8], scale: 1, slime: true },
  bandit:        { name: 'Bandido',           hp: 65,  dmg: 15, speed: 3.5, atkRange: 1.9, atkCd: 1.2, detect: 15, xp: 40, gold: [15, 35], scale: 0.95, skin: 0xc89878, cloth: 0x2a2a2a, rank: 'D', weapon: true }
};

let ENEMY_ID = 0;

export class Enemy {
  constructor(game, typeId, x, z, opts = {}) {
    const T = ENEMY_TYPES[typeId] || ENEMY_TYPES.goblin;
    this.game = game;
    this.id = ENEMY_ID++;
    this.typeId = typeId;
    this.type = T;
    this.rank = opts.rank || T.rank || 'E';
    const rm = RANK_MULT[this.rank] || RANK_MULT.E;
    this.rankMult = rm;
    const lvlScale = 1 + (opts.level || 0) * 0.12;

    this.maxHp = Math.round(T.hp * rm.hp * lvlScale * (opts.hpMult || 1));
    this.hp = this.maxHp;
    this.damage = T.dmg * rm.dmg * lvlScale;
    this.speed = T.speed * rm.spd;
    this.defense = Math.round(2 * (1 + RANKS.indexOf(this.rank) * 0.6));
    this.xpReward = Math.round(T.xp * rm.xp);
    this.goldRange = [Math.round(T.gold[0] * rm.gold), Math.round(T.gold[1] * rm.gold)];
    this.isBoss = !!T.boss || !!opts.boss;
    this.displayName = T.name;

    this.dead = false;
    this.deathT = 0;
    this.animT = rand(0, 10);
    this.attackWindup = 0;
    this.fleeing = false;
    this.orbitSide = chance(0.5) ? 1 : -1;
    this.hitRadius = 0.8 * (T.scale || 1);
    this.vy = 0;
    this.facing = rand(0, Math.PI * 2);
    this.mats = [];

    /* corpo */
    if (T.animal) this.buildWolf(T);
    else if (T.slime) this.buildSlime(T);
    else this.buildHumanoid(T, opts);

    this.root.position.set(x, game.world.terrainHeight(x, z), z);
    game.scene.add(this.root);

    /* IA */
    this.state = 'idle';
    this.stateT = 0;
    this.home = new THREE.Vector3(x, 0, z);
    this.spawnZone = opts.zone || null;
    this.patrolTarget = this.pickPatrol();
    this.patrolT = 0;
    this.atkCd = 0;
    this.stunT = 0;
    this.slowF = 1; this.slowT = 0;
    this.kbVel = new THREE.Vector3();
    this.lastHitT = 99;
    this.hitRadius = 0.8 * (T.scale || 1);
  }

  buildHumanoid(T, opts) {
    const ch = buildHumanoid({
      scale: T.scale, skin: T.skin, cloth: T.cloth, hair: T.hairC ?? 0x2a2016,
      eyes: 0xff4020, boots: 0x2a2016
    });
    this.body = ch.parts;
    this.root = ch.root;
    if (T.weapon) {
      this.sword = buildSword(null, 0x9a9080);
      this.sword.scale.setScalar(0.85);
      this.sword.position.set(0, -0.32, 0.02);
      this.sword.rotation.x = Math.PI / 2;
      this.body.handR.add(this.sword);
    }
    if (T.magicColor) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: T.magicColor }));
      orb.position.set(0, -0.34, 0.04);
      this.body.handR.add(orb);
      this.staffGlow = orb;
    }
    // capuz para mago
    if (T.id === 'goblinMage' || T.name.includes('Mago')) {
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26 * T.scale, 0.3 * T.scale, 6), ch.mats.cloth);
      hood.position.y = 0.3 * T.scale;
      this.body.head.add(hood);
    }
    this.hitFlashMats = [ch.mats.skin, ch.mats.cloth];
    this._baseColors = [ch.mats.skin.color.clone(), ch.mats.cloth.color.clone()];
  }

  buildWolf(T) {
    this.root = new THREE.Group();
    this.body = {};
    const m = new THREE.MeshStandardMaterial({ color: 0x5a5248, roughness: 0.9 });
    const fur = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.95 });
    this.mats.push(m);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 1.1), m);
    torso.position.y = 0.55;
    torso.castShadow = true;
    this.root.add(torso);
    const head = new THREE.Group();
    head.position.set(0, 0.75, 0.6);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.4), m);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), fur);
    snout.position.set(0, -0.05, 0.28);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), m); earL.position.set(-0.1, 0.2, 0);
    const earR = earL.clone(); earR.position.x = 0.1;
    head.add(skull, snout, earL, earR);
    this.root.add(head);
    this.body.head = head;
    const mkLeg = (x, z) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), m);
      l.position.set(x, 0.25, z);
      this.root.add(l);
      return l;
    };
    this.body.legFL = mkLeg(-0.16, 0.4); this.body.legFR = mkLeg(0.16, 0.4);
    this.body.legBL = mkLeg(-0.16, -0.4); this.body.legBR = mkLeg(0.16, -0.4);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), fur);
    tail.position.set(0, 0.62, -0.7); tail.rotation.x = 0.5;
    this.root.add(tail);
    this.blobShadow = null;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; this.root.add(blob);
    this.hitFlashMats = [m];
    this._baseColors = [m.color.clone()];
  }

  buildSlime(T) {
    this.root = new THREE.Group();
    this.body = {};
    const m = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.3, transparent: true, opacity: 0.85 });
    this.mats.push(m);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), m);
    core.position.y = 0.55;
    core.scale.y = 0.8;
    core.castShadow = true;
    this.root.add(core);
    this.body.core = core;
    const eyes = new THREE.MeshStandardMaterial({ color: 0x1a1a22 });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyes); eL.position.set(-0.18, 0.62, 0.5);
    const eR = eL.clone(); eR.position.x = 0.18;
    this.root.add(eL, eR);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; this.root.add(blob);
    this.hitFlashMats = [m];
    this._baseColors = [m.color.clone()];
  }

  hitFlash() {
    for (let i = 0; i < this.hitFlashMats.length; i++) {
      const m = this.hitFlashMats[i];
      if (!m || !m.color) continue;
      m.color.setRGB(1, 0.35, 0.3);
    }
    this.lastHitT = 0;
  }

  alertTo(pos) {
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'return') {
      this.state = 'chase';
      this.stateT = 0;
      this.game.audio.playAt('goblin', 0.5, this.game.camera.cam.position.distanceTo(this.root.position), 30);
    }
  }

  pickPatrol() {
    const a = rand(0, Math.PI * 2), r = rand(3, 10);
    return new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
  }

  knockback(fromPos, strength) {
    const dir = this.root.position.clone().sub(fromPos).setY(0).normalize();
    this.kbVel.addScaledVector(dir, strength);
  }
  applyStun(t) { if (!this.isBoss || t > 1.5) { this.stunT = Math.max(this.stunT, t); this.attackWindup = 0; } }
  applySlow(f, t) { this.slowF = Math.min(this.slowF, f); this.slowT = Math.max(this.slowT, t); }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    const game = this.game;
    game.audio.playAt(this.type.animal ? 'wolf' : 'goblinDie', 0.8, game.camera.cam.position.distanceTo(this.root.position), 40);
    // recompensas
    const gold = randi(this.goldRange[0], this.goldRange[1]);
    game.player.gainXP(this.xpReward);
    game.inventory.addGold(gold);
    game.hud.damageNumber(this.root.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${gold} 🪙`, 'heal');
    game.quests.onKill(this.typeId, this);
    game.loot.dropLoot(this);
    game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 14, color: 0x8a4a3a, speed: 3, life: 0.6, size: 5, gravity: -3 });
    if (this.isBoss) {
      game.bosses.endBoss();
      game.story.onBossKilled(this.typeId);
    }
    if (game.player.lockTarget === this) game.player.lockTarget = null;
    if (this.spawnZone) this.spawnZone.notifyKill();
  }

  /* ---------- IA ---------- */
  update(dt) {
    const game = this.game;
    this.animT += dt;
    this.stateT += dt;
    this.atkCd -= dt;
    if (this.lastHitT < 1) {
      this.lastHitT += dt;
      if (this.lastHitT >= 0.12) {
        // restaura cor
        for (let i = 0; i < this.hitFlashMats.length; i++) {
          const m = this.hitFlashMats[i];
          if (m && m.color && this._baseColors[i]) m.color.copy(this._baseColors[i]);
        }
      }
    }
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowF = 1; }

    if (this.dead) {
      this.deathT += dt;
      const f = clamp(this.deathT / 0.7, 0, 1);
      if (this.body.core) this.body.core.scale.setScalar(Math.max(0.01, 1 - f));
      else if (this.body.hip) this.body.hip.rotation.x = f * Math.PI / 2;
      this.root.position.y -= f * dt * 1.2;
      if (this.deathT > 1.6) { game.scene.remove(this.root); this.removeMe = true; }
      return;
    }

    const player = game.player;
    const pp = player.root.position;
    const ep = this.root.position;
    const dToPlayer = ep.distanceTo(pp);
    // só atualiza IA completa perto do jogador
    const near = dToPlayer < 85;
    if (!near) {
      // hibernação barata
      if (Math.random() < dt * 0.2) this.facing += rand(-0.5, 0.5);
      return;
    }

    if (this.stunT > 0) { this.stunT -= dt; this.move(dt, 0); this.applyAnim(dt, 0); return; }

    /* seleção de estado */
    const T = this.type;
    const detectR = T.detect * (player.sprinting ? 1.3 : 1) * (player.dead ? 0 : 1);
    switch (this.state) {
      case 'idle': case 'patrol': {
        if (dToPlayer < detectR && !player.dead) {
          this.state = 'chase'; this.stateT = 0;
          game.audio.playAt('goblin', 0.5, dToPlayer, 25);
          break;
        }
        // patrulha
        const d = ep.distanceTo(new THREE.Vector3(this.patrolTarget.x, ep.y, this.patrolTarget.z));
        if (d < 1 || this.patrolT > 8) {
          this.patrolTarget = this.pickPatrol(); this.patrolT = 0;
          this.state = 'idle'; this.stateT = 0;
        } else {
          this.patrolT += dt;
          this.faceToward(this.patrolTarget.x, this.patrolTarget.z);
          this.moveDir(dt, (this.patrolTarget.x - ep.x), (this.patrolTarget.z - ep.z), this.speed * 0.4);
        }
        break;
      }
      case 'chase': {
        if (player.dead) { this.state = 'return'; break; }
        // fugir com pouca vida (tipo covarde)
        if (!this.isBoss && this.hp < this.maxHp * 0.18 && chance(dt * 0.5) && this.rankMult.iq >= 1) { this.fleeing = true; }
        if (this.fleeing) {
          this.state = 'flee'; this.stateT = 0; break;
        }
        // cercar: se aliado já está atacando de frente, orbita
        if (T.ranged) {
          const ideal = T.keepDist;
          if (dToPlayer > ideal + 2) this.moveToward(dt, pp, this.speed);
          else if (dToPlayer < ideal - 3) this.moveToward(dt, ep.clone().add(ep.clone().sub(pp).normalize().multiplyScalar(3)), this.speed * 0.7);
          else this.strafe(dt);
          this.faceToward(pp.x, pp.z);
          if (this.atkCd <= 0 && dToPlayer < T.atkRange + 2) this.rangedAttack(pp);
        } else {
          if (dToPlayer > T.atkRange + 0.6) {
            // circle-strafe quando muito perto de outros atacantes
            const attacking = game.enemies.list.filter(e => !e.dead && e !== this && e.state === 'attack' && e.root.position.distanceTo(pp) < 3).length;
            if (attacking > 0 && this.rankMult.iq >= 1 && dToPlayer < 6) this.strafe(dt);
            else this.moveToward(dt, pp, this.speed);
          } else {
            this.state = 'attack'; this.stateT = 0; this.attackWindup = this.isBoss ? 0.55 : 0.38;
            this.faceToward(pp.x, pp.z);
          }
        }
        // desistindo
        if (dToPlayer > 30) { this.state = 'return'; this.stateT = 0; }
        break;
      }
      case 'attack': {
        this.faceToward(pp.x, pp.z);
        if (this.attackWindup > 0) {
          this.attackWindup -= dt;
        } else {
          // golpe
          if (dToPlayer < T.atkRange + 1) {
            game.combat.damagePlayer(this.damage, ep, { attacker: this });
            game.audio.playAt('swing', 0.7, dToPlayer, 25);
            if (this.staffGlow) FX.fire(game.fx, ep.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), 1), false);
          }
          this.atkCd = T.atkCd * rand(0.85, 1.2);
          this.state = dToPlayer > T.atkRange + 2 ? 'chase' : 'attack';
          this.stateT = 0;
          // recuo breve entre golpes (stagger natural)
          if (!this.isBoss && chance(0.4)) { this.state = 'chase'; }
        }
        break;
      }
      case 'flee': {
        if (this.stateT > 6) { this.fleeing = false; this.state = 'return'; break; }
        const away = ep.clone().sub(pp).normalize().multiplyScalar(6).add(ep);
        this.moveToward(dt, away, this.speed * 1.15);
        this.faceToward(away.x, away.z);
        if (this.hp > this.maxHp * 0.4) { this.fleeing = false; this.state = 'chase'; }
        break;
      }
      case 'return': {
        const d = ep.distanceTo(this.home);
        if (d < 2) { this.state = 'idle'; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.1); break; }
        this.moveToward(dt, this.home, this.speed * 0.7);
        if (dToPlayer < T.detect * 0.7 && !player.dead) this.state = 'chase';
        break;
      }
    }

    /* física simples */
    this.move(dt, 0); // aplica kb + gravidade
    this.applyAnim(dt, Math.hypot(this._mvx || 0, this._mvz || 0));
  }

  faceToward(x, z) {
    const target = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    this.facing = lerpAngle(this.facing, target, 0.18);
  }

  moveToward(dt, target, speed) {
    const ep = this.root.position;
    const dx = target.x - ep.x, dz = target.z - ep.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) { this._mvx = 0; this._mvz = 0; return; }
    this.moveDir(dt, dx / d, dz / d, speed);
  }
  strafe(dt) {
    const game = this.game, pp = game.player.root.position, ep = this.root.position;
    const dx = ep.x - pp.x, dz = ep.z - pp.z;
    const d = Math.hypot(dx, dz) || 1;
    // orbita
    this.moveDir(dt, (-dz / d) * this.orbitSide, (dx / d) * this.orbitSide, this.speed * 0.6);
    if (Math.random() < dt * 0.5) this.orbitSide *= -1;
  }
  moveDir(dt, nx, nz, speed) {
    const s = speed * this.slowF;
    this._mvx = nx * s; this._mvz = nz * s;
  }

  move(dt, _unused) {
    const game = this.game;
    const p = this.root.position;
    const mvx = (this._mvx || 0) + this.kbVel.x;
    const mvz = (this._mvz || 0) + this.kbVel.z;
    this.kbVel.multiplyScalar(Math.max(0, 1 - 6 * dt));
    const nx = p.x + mvx * dt, nz = p.z + mvz * dt;
    // colisão com obstáculos
    let cx = nx, cz = nz;
    for (const o of game.world.obstacles || []) {
      const dx = cx - o.x, dz = cz - o.z;
      const d = Math.hypot(dx, dz);
      const min = (o.r || 1) + this.hitRadius * 0.7;
      if (d < min && d > 0.001) { cx = o.x + (dx / d) * min; cz = o.z + (dz / d) * min; }
    }
    p.x = clamp(cx, -game.world.half + 10, game.world.half - 10);
    p.z = clamp(cz, -game.world.half + 10, game.world.half - 10);
    // gravidade/terreno
    this.vy -= 22 * dt;
    const ground = game.world.terrainHeight(p.x, p.z);
    p.y += this.vy * dt;
    if (p.y < ground) { p.y = ground; this.vy = 0; }
    this.root.rotation.y = this.facing;
  }

  rangedAttack(pp) {
    const game = this.game;
    const T = this.type;
    const origin = this.root.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const vel = pp.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin).normalize().multiplyScalar(T.atkRange > 12 ? 18 : 14);
    game.enemyProjectiles.push(new Projectile(game.scene, {
      owner: 'enemy', dmg: this.damage, radius: 1.2, pos: origin, vel,
      color: T.magicColor || 0xd8c890, life: 2.5, explodeFx: false, element: null
    }));
    game.audio.playAt(T.magicColor ? 'm_fire' : 'arrow', 0.7, game.camera.cam.position.distanceTo(origin), 40);
    this.atkCd = T.atkCd * rand(0.9, 1.3);
  }

  applyAnim(dt, speed) {
    const B = this.body, t = this.animT;
    if (this.type.slime) {
      if (this.body.core) {
        const sq = 1 + Math.sin(t * 6) * 0.12;
        this.body.core.scale.set(sq, 2 - sq, sq);
        this.body.core.position.y = 0.55 - (sq - 1) * 0.3;
      }
      return;
    }
    if (this.type.animal) {
      const w = Math.sin(t * 10);
      const amp = speed > 0.5 ? 0.6 : 0;
      if (B.legFL) B.legFL.rotation.x = w * amp;
      if (B.legFR) B.legFR.rotation.x = -w * amp;
      if (B.legBL) B.legBL.rotation.x = -w * amp;
      if (B.legBR) B.legBR.rotation.x = w * amp;
      if (B.head) B.head.rotation.y = Math.sin(t * 2) * 0.1;
      return;
    }
    if (!B || !B.legL) return;
    if (this.dead) return;
    const w = Math.sin(t * 9);
    const amp = speed > 0.5 ? 0.55 : 0;
    B.legL.rotation.x = w * amp; B.legR.rotation.x = -w * amp;
    B.shinL.rotation.x = Math.max(0, -w) * amp * 0.8; B.shinR.rotation.x = Math.max(0, w) * amp * 0.8;
    if (this.state === 'attack') {
      const f = 1 - clamp(this.attackWindup / 0.4, 0, 1);
      if (B.armR) B.armR.rotation.x = -2.2 + f * 2.8;
      if (B.torso) B.torso.rotation.x = 0.2 - f * 0.4;
    } else if (this.state === 'chase') {
      if (B.armR) B.armR.rotation.x = -w * amp * 0.7;
      if (B.armL) B.armL.rotation.x = w * amp * 0.7;
      if (B.torso) B.torso.rotation.x = 0.15;
    } else {
      if (B.armR) B.armR.rotation.x = 0.05 - w * amp * 0.5;
      if (B.armL) B.armL.rotation.x = 0.05 + w * amp * 0.5;
      if (B.torso) B.torso.rotation.x = 0.06;
    }
    if (B.head) B.head.rotation.y = Math.sin(t * 1.3) * 0.15;
  }
}

/* ---------- Gerenciador ---------- */
export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.zones = []; // {x,z,r,type,ranks,max,count,interval,t}
  }
  addZone(z) { z.count = 0; z.t = 0; this.zones.push(z); }

  spawn(typeId, x, z, opts = {}) {
    if (this.list.length > 40) return null;
    const e = new Enemy(this.game, typeId, x, z, opts);
    this.list.push(e);
    if (e.isBoss || opts.bossBar) this.game.bosses.startBoss(e);
    return e;
  }

  update(dt) {
    // zonas de spawn mantêm população perto do jogador
    const pp = this.game.player.root.position;
    for (const z of this.zones) {
      const dz = dist(pp.x, pp.z, z.x, z.z);
      if (dz > z.activeRange) continue;
      z.t -= dt;
      if (z.count < z.max && z.t <= 0) {
        z.t = z.interval;
        const a = rand(0, Math.PI * 2), r = rand(z.r * 0.3, z.r);
        const x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
        const type = typeof z.type === 'function' ? z.type() : z.type;
        const e = this.spawn(type, x, zz, { zone: z, rank: z.ranks ? pick(z.ranks) : undefined });
        if (e) z.count++;
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.update(dt);
      if (e.removeMe) this.list.splice(i, 1);
    }
  }
  countAlive() { return this.list.filter(e => !e.dead).length; }
  clearNonBoss() {
    for (const e of this.list) { if (!e.isBoss && !e.dead) e.kill(); }
  }
  clearAll() {
    for (const e of this.list) { if (!e.dead) { e.dead = true; this.game.scene.remove(e.root); } }
    this.list.length = 0;
  }
}
