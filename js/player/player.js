/* =========================================================
 * Aetheria — Jogador (personagem, movimento, animação, ações)
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { buildHumanoid, buildSword, buildShield } from './character.js';
import { clamp, damp, lerp, lerpAngle, rand, chance } from '../core/utils.js';
import { ELEMENTS } from '../magic/elements.js';
import { SpellCaster } from '../magic/spells.js';
import { FX } from '../effects/particles.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.vel = new THREE.Vector3();
    this.facing = 0;                    // rotação Y do corpo
    this.grounded = true;

    /* ---- estatísticas ---- */
    this.level = 1;
    this.xp = 0;
    this.xpNext = 80;
    this.gold = 25;
    this.attributePoints = 0;
    this.attributes = { forca: 5, defesa: 5, velocidade: 5, mana: 5, poder: 5, resistencia: 5, critico: 5 };
    this.element = null;                // 'fire' etc — definido no Teste do Poder
    this.spellLevels = {};              // id -> nível
    this.spellXP = {};

    this.base = { maxHp: 100, maxMana: 60, maxStam: 100 };
    this.hp = 100; this.mana = 60; this.stamina = 100;

    /* ---- estado de ação ---- */
    this.state = 'idle';                // idle|walk|run|sprint|dodge|attack|block|cast|hurt|die|interact
    this.stateT = 0;
    this.animT = 0;
    this.comboIdx = 0;
    this.comboWindow = 0;
    this.attackTimer = 0;
    this.attackHitDone = false;
    this.castTimer = 0; this.castSpell = null; this.castIdx = -1;
    this.dodgeTimer = 0; this.dodgeDir = new THREE.Vector3();
    this.iframes = 0;
    this.blocking = false; this.blockT = 0;
    this.sprinting = false;
    this.staggerTimer = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.lockTarget = null;
    this.cooldowns = {};                // spellId -> restante
    this.stepT = 0;
    this.slowFactor = 1; this.slowT = 0;
    this.stunT = 0;

    /* ---- equipamentos (afetam atributos) ---- */
    this.equipment = { capacete: null, armadura: null, luvas: null, botas: null, capa: null, acessorio: null, arma: null };
    this.equipBonus = { atk: 0, def: 0, hp: 0, mana: 0, spd: 0, crit: 0, magic: 0 };

    /* ---- visual ---- */
    const ch = buildHumanoid({
      skin: 0xd8a880, cloth: 0x7a5a34, cloth2: 0x4a3a26, hair: 0x4a3020,
      cape: 0x6a2018, scale: 1
    });
    this.body = ch.parts;
    this.root.add(ch.root);
    this.bodyParts = ch;
    // espada na mão direita
    this.sword = buildSword(null);
    this.sword.position.set(0, -0.32, 0.02);
    this.sword.rotation.x = Math.PI / 2;
    this.body.handR.add(this.sword);
    this.sword.visible = false; // vira visível ao receber arma no prólogo
    // escudo no antebraço esquerdo
    this.shield = buildShield();
    this.shield.scale.setScalar(0.8);
    this.shield.position.set(-0.05, 0, -0.12);
    this.body.foreL.add(this.shield);
    this.shield.visible = false;

    // aura elemental (aparece após teste)
    this.aura = null;
    this.auraT = 0;
  }

  /* ---------- derivados ---------- */
  recalc() {
    const a = this.attributes;
    let atk = 0, def = 0, hp = 0, mana = 0, spd = 0, crit = 0, magic = 0;
    for (const slot of Object.values(this.equipment)) {
      if (slot && slot.stats) {
        atk += slot.stats.atk || 0; def += slot.stats.def || 0; hp += slot.stats.hp || 0;
        mana += slot.stats.mana || 0; spd += slot.stats.spd || 0; crit += slot.stats.crit || 0; magic += slot.stats.magic || 0;
      }
    }
    this.equipBonus = { atk, def, hp, mana, spd, crit, magic };
    this.maxHp = Math.round(this.base.maxHp + (this.level - 1) * 12 + a.forca * 2 + a.resistencia * 3 + hp);
    this.maxMana = Math.round(this.base.maxMana + (this.level - 1) * 6 + a.mana * 5 + mana);
    this.maxStam = this.base.maxStam + a.resistencia * 2;
    this.moveSpeed = 4.4 * (1 + a.velocidade * 0.02 + spd * 0.02);
    this.sprintSpeed = this.moveSpeed * 1.75;
    this.attackDamage = 12 + a.forca * 1.6 + atk + (this.level - 1) * 1.2;
    this.defense = 3 + a.defesa * 1.2 + def;
    this.critChance = 0.05 + a.critico * 0.01 + crit * 0.02;
    this.critMult = 1.6 + a.critico * 0.02;
    this.spellPower = 1 + a.poder * 0.05 + magic * 0.08;
    this.hp = Math.min(this.hp, this.maxHp);
    this.mana = Math.min(this.mana, this.maxMana);
  }

  giveSword() { this.sword.visible = true; }
  giveShield() { this.shield.visible = true; }

  /* ---------- elemento ---------- */
  setElement(id) {
    this.element = id;
    const el = ELEMENTS[id];
    if (!el) return;
    this.spellLevels[el.spells[0].id] = 1;
    // aura visual
    if (this.aura) this.root.remove(this.aura);
    this.aura = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.03, 6, 24),
      new THREE.MeshBasicMaterial({ color: el.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.aura.add(ring);
    this.root.add(this.aura);
    // tinge a capa com o elemento
    if (this.bodyParts && this.body.cape) this.body.cape.material = this.body.cape.material.clone();
    if (this.body.cape) { this.body.cape.material.color.lerp(new THREE.Color(el.color), 0.35); }
  }

  cameraFocus() {
    return this.root.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  }

  /* ---------- loop ---------- */
  update(dt, input) {
    const game = this.game;
    this.stateT += dt; this.animT += dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowFactor = 1; }
    if (this.stunT > 0) { this.stunT -= dt; }

    // cooldowns / regen
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (!this.dead) {
      const regen = this.state === 'sprint' || this.state === 'attack' ? 2 : 9;
      this.mana = Math.min(this.maxMana, this.mana + regen * dt * (1 + this.attributes.mana * 0.05));
      if (!this.sprinting) this.stamina = Math.min(this.maxStam, this.stamina + 14 * dt);
      this.hp = Math.min(this.maxHp, this.hp + 1.2 * dt);
    }

    if (this.dead) { this.updateDeath(dt); return; }
    if (this.stunT > 0) { this.applyAnim(dt); this.applyGravity(dt); return; }

    /* ---- lock target ---- */
    if (input.wasPressed('Tab')) {
      game.combat.toggleLock();
    }
    if (this.lockTarget && (this.lockTarget.dead || this.lockTarget.root.position.distanceTo(this.root.position) > 30)) this.lockTarget = null;

    /* ---- bloqueio ---- */
    const wantBlock = input.isDown('KeyF') && this.state !== 'dodge' && this.castTimer <= 0;
    if (wantBlock && !this.blocking) { this.blocking = true; this.blockT = 0; this.setState('block'); }
    if (!wantBlock && this.blocking) { this.blocking = false; this.setState('idle'); }
    if (this.blocking) this.blockT += dt;

    /* ---- esquiva ---- */
    if (input.wasPressed('Space') && this.dodgeTimer <= 0 && this.stamina >= 18 && this.castTimer <= 0 && this.staggerTimer <= 0) {
      this.startDodge(input);
    }

    /* ---- ataque corpo a corpo ---- */
    if (input.leftPressed && !this.blocking && this.castTimer <= 0 && this.dodgeTimer <= 0 && this.staggerTimer <= 0 && this.attackTimer <= 0) {
      game.combat.startMelee(this);
    }

    /* ---- magias ---- */
    for (let i = 0; i < 4; i++) {
      if (input.wasPressed('Digit' + (i + 1))) {
        this.tryCast(i);
      }
    }
    if (input.wasPressed('Digit5')) game.inventory.usePotion('hp');
    if (input.wasPressed('Digit6')) game.inventory.usePotion('mana');
    // mobile
    if (input.mPressed['dodge'] && this.dodgeTimer <= 0 && this.stamina >= 18) this.startDodge(input);

    /* ---- conjuração em progresso ---- */
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      if (this.castTimer <= 0.25 && this.castSpell && !this._castFired) {
        this._castFired = true;
        SpellCaster.cast(game, this.castElem, this.castIdx, this.spellPower);
        FX[this.castElem.id](game.fx, this.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(game.camera.aimDir(new THREE.Vector3()), 0.6), false);
      }
      if (this.castTimer <= 0) { this.setState('idle'); this.castSpell = null; this._castFired = false; }
    }

    /* ---- movimento ---- */
    const mv = input.moveVector();
    const canMove = this.attackTimer <= 0.12 && this.castTimer <= 0 && this.dodgeTimer <= 0 && this.staggerTimer <= 0 && !this.blocking;
    if (canMove && mv.len > 0.05) {
      this.sprinting = input.isDown('ShiftLeft') && this.stamina > 5 && mv.len > 0.6;
      let speed = (this.sprinting ? this.sprintSpeed : this.moveSpeed) * this.slowFactor;
      if (this.sprinting) this.stamina -= 12 * dt;
      // direção relativa à câmera
      const yaw = game.camera.yaw;
      const wx = mv.x * Math.cos(yaw) - mv.y * Math.sin(yaw) * -1;
      const wz = mv.x * Math.sin(yaw) + mv.y * Math.cos(yaw) * -1;
      // corrige: frente da câmera = -Z rotacionada por yaw
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const dx = rx * mv.x + fx * -mv.y;
      const dz = rz * mv.x + fz * -mv.y;
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      this.vel.x = damp(this.vel.x, dir.x * speed, 10, dt);
      this.vel.z = damp(this.vel.z, dir.z * speed, 10, dt);
      this.targetFacing = Math.atan2(dx, dz);
      this.setState(this.sprinting ? 'sprint' : 'run');
      // passos
      this.stepT -= dt * (this.sprinting ? 1.6 : 1);
      if (this.stepT <= 0) {
        this.stepT = this.sprinting ? 0.28 : 0.42;
        game.audio.play('step', 0.5);
        game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(0, 0.1, 0)), { count: 2, color: 0x8a7a5a, speed: 0.5, spread: 0.3, life: 0.4, size: 3, alpha: 0.4 });
      }
    } else if (canMove) {
      this.sprinting = false;
      this.vel.x = damp(this.vel.x, 0, 12, dt);
      this.vel.z = damp(this.vel.z, 0, 12, dt);
      if (this.state === 'run' || this.state === 'sprint' || this.state === 'walk') this.setState('idle');
    }
    if (this.sprinting && this.stamina <= 0) this.sprinting = false;

    /* dodge move */
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      const dodgeSpeed = 9.5 * (0.4 + 0.6 * clamp(this.dodgeTimer / 0.4, 0, 1));
      this.vel.x = this.dodgeDir.x * dodgeSpeed;
      this.vel.z = this.dodgeDir.z * dodgeSpeed;
      if (this.dodgeTimer <= 0) this.setState('idle');
    }

    /* ataque: trava movimento parcial + gira para alvo */
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.lockTarget && !this.lockTarget.dead) {
        const d = this.lockTarget.root.position.clone().sub(this.root.position);
        this.targetFacing = Math.atan2(d.x, d.z);
      } else if (mv.len <= 0.05) {
        // gira para direção da câmera ao atacar parado
        const d = game.camera.aimDir(new THREE.Vector3());
        this.targetFacing = Math.atan2(d.x, d.z);
      }
      // hit no meio do swing
      if (!this.attackHitDone && this.attackTimer < this.attackDuration * 0.55) {
        this.attackHitDone = true;
        game.combat.meleeHit(this, this.comboIdx);
      }
      if (this.attackTimer <= 0) {
        if (this.comboWindow > 0) this.setState('idle');
        else this.setState('idle');
      }
    }
    if (this.comboWindow > 0) this.comboWindow -= dt;

    /* stagger */
    if (this.staggerTimer > 0) this.staggerTimer -= dt;

    /* rotação suave do corpo */
    if (this.targetFacing !== undefined) this.facing = lerpAngle(this.facing, this.targetFacing, 1 - Math.exp(-14 * dt));

    this.applyGravity(dt);
    this.applyAnim(dt);
    this.updateAura(dt);
  }

  applyGravity(dt) {
    const game = this.game;
    this.vel.y -= 22 * dt;
    const p = this.root.position;
    const nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt;
    // colisão com obstáculos (empurrar para fora)
    let cx = nx, cz = nz;
    for (const o of game.world.obstacles || []) {
      const dx = cx - o.x, dz = cz - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.45;
      if (d < min && d > 0.001 && p.y < (o.top ?? 99)) {
        cx = o.x + (dx / d) * min;
        cz = o.z + (dz / d) * min;
      }
    }
    // limite do mundo
    const lim = game.world.half - 12;
    cx = clamp(cx, -lim, lim); cz = clamp(cz, -lim, lim);
    p.x = cx; p.z = cz;
    const ground = game.world.terrainHeight(p.x, p.z);
    p.y += this.vel.y * dt;
    if (p.y <= ground) { p.y = ground; this.vel.y = 0; this.grounded = true; }
    else this.grounded = false;
  }

  startDodge(input) {
    this.stamina -= 18;
    this.dodgeTimer = 0.42;
    this.iframes = 0.5;
    this.setState('dodge');
    this.game.audio.play('dodge');
    const mv = input.moveVector();
    if (mv.len > 0.05) {
      const yaw = this.game.camera.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const dx = rx * mv.x + fx * -mv.y, dz = rz * mv.x + fz * -mv.y;
      this.dodgeDir.set(dx, 0, dz).normalize();
      this.targetFacing = Math.atan2(dx, dz);
    } else {
      this.dodgeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    }
    this.game.fx.spawn(this.root.position, { count: 6, color: 0xcfc8b8, speed: 2, spread: 0.4, life: 0.35, size: 4, alpha: 0.5 });
  }

  /* tenta conjurar magia do slot i */
  tryCast(i) {
    if (!this.element || this.dead || this.blocking || this.dodgeTimer > 0 || this.staggerTimer > 0) return;
    const el = ELEMENTS[this.element];
    const unlocked = this.game.grimoire.unlockedSpells();
    const spell = unlocked[i];
    if (!spell) {
      this.game.hud.toast('Magia ainda bloqueada — evolua para desbloquear.');
      return;
    }
    const idx = el.spells.indexOf(spell);
    const cd = this.cooldowns[spell.id] || 0;
    if (cd > 0) { this.game.hud.toast(`${spell.name} recarregando…`); return; }
    if (this.mana < spell.mana) { this.game.hud.toast('Mana insuficiente!'); this.game.audio.play('ui', 0.6); return; }
    this.mana -= spell.mana;
    this.cooldowns[spell.id] = spell.cd;
    this.castSpell = spell; this.castElem = el; this.castIdx = idx; this.castTimer = 0.55; this._castFired = false;
    this.setState('cast');
    // gira para a mira
    const d = this.lockTarget && !this.lockTarget.dead
      ? this.lockTarget.root.position.clone().sub(this.root.position)
      : this.game.camera.aimDir(new THREE.Vector3());
    this.targetFacing = Math.atan2(d.x, d.z);
    this.game.audio.play('m_cast', 0.7);
  }

  /* usado pelo SpellCaster.dash */
  dashTo(offset, dur) {
    const game = this.game;
    const target = this.root.position.clone().add(offset);
    target.x = clamp(target.x, -game.world.half + 12, game.world.half - 12);
    target.z = clamp(target.z, -game.world.half + 12, game.world.half - 12);
    target.y = game.world.terrainHeight(target.x, target.z);
    this.root.position.copy(target);
    this.vel.set(0, 0, 0);
    this.iframes = Math.max(this.iframes, 0.3);
    this.setState('dodge');
    this.dodgeTimer = 0.25;
    this.dodgeDir.set(0, 0, 0);
    FX[this.element || 'wind'](game.fx, this.root.position.clone().add(new THREE.Vector3(0, 1, 0)), false);
  }

  /* XP */
  gainXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(80 * Math.pow(1.35, this.level - 1));
      this.attributePoints += 2;
      this.recalc();
      this.hp = this.maxHp; this.mana = this.maxMana;
      this.game.audio.play('levelup');
      this.game.hud.announce('NÍVEL ' + this.level, 'Continue sua jornada, herói', 2.2);
      this.game.fx.ring(this.root.position, { radius: 2.2, color: 0xf5d97a, life: 0.7 });
      this.game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 24, color: 0xf5d97a, speed: 4, life: 0.9, size: 6, gravity: 2, upBias: 2 });
      this.game.grimoire.checkUnlocks();
      this.game.hud.refreshHotbar();
    }
  }
  castXP(spellId, amount) {
    this.spellXP[spellId] = (this.spellXP[spellId] || 0) + amount;
    const need = 25;
    if (this.spellXP[spellId] >= need * (this.spellLevels[spellId] || 1)) {
      this.spellXP[spellId] = 0;
      this.spellLevels[spellId] = (this.spellLevels[spellId] || 1) + 1;
      this.game.hud.toast(`✨ ${spellId.replace(/^\w/, c => c.toUpperCase())} evoluiu para o nível ${this.spellLevels[spellId]}!`);
      this.game.grimoire.dirty = true;
    }
  }
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 10, color: 0x6ae08a, speed: 1.5, life: 0.6, size: 5, upBias: 2 });
    this.game.hud.damageNumber(this.root.position, '+' + Math.round(amount), 'heal');
  }

  hurt(dmg, fromPos, isCrit) {
    // tratado por combat.js — efeito visual aqui
    this.game.audio.play('hurt');
    this.game.hud.hurtFlash();
    this.game.camera.addShake(0.14);
    FX.fire ? null : null;
    this.game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 8, color: 0xd03020, speed: 3, spread: 0.5, life: 0.35, size: 4 });
    if (fromPos) {
      const d = this.root.position.clone().sub(fromPos).setY(0).normalize().multiplyScalar(3);
      this.vel.x += d.x; this.vel.z += d.z;
      this.targetFacing = Math.atan2(-d.x, -d.z);
    }
    this.setState('hurt');
    this.stateT = 0;
  }

  die() {
    this.dead = true;
    this.deathTimer = 0;
    this.setState('die');
    this.game.audio.play('die');
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    this.vel.x = damp(this.vel.x, 0, 6, dt);
    this.vel.z = damp(this.vel.z, 0, 6, dt);
    this.applyGravity(dt);
    this.applyAnim(dt);
    if (this.deathTimer > 3.2) {
      this.respawn();
    }
  }

  respawn() {
    const game = this.game;
    this.dead = false;
    this.hp = this.maxHp * 0.6; this.mana = this.maxMana * 0.5; this.stamina = this.maxStam;
    const sp = game.story.respawnPoint || { x: 0, z: 0 };
    this.root.position.set(sp.x, game.world.terrainHeight(sp.x, sp.z), sp.z);
    this.setState('idle');
    game.hud.toast('Você desperta novamente…');
  }

  setState(s) {
    if (this.state !== s) { this.state = s; this.stateT = 0; }
  }

  /* ---------- ANIMAÇÃO PROCEDURAL ---------- */
  applyAnim(dt) {
    const B = this.body, t = this.animT;
    const set = (o, x, y, z) => { if (o) { o.rotation.x = x; o.rotation.y = y || 0; o.rotation.z = z || 0; } };
    const st = this.state;
    const speed = Math.hypot(this.vel.x, this.vel.z);

    // reset base
    B.hip.position.y = 0.95;

    // respiração idle
    const breath = Math.sin(t * 2) * 0.02;

    if (st === 'die') {
      const f = clamp(this.deathTimer / 0.8, 0, 1);
      B.hip.position.y = 0.95 - f * 0.75;
      B.torso.rotation.x = f * 1.35;
      set(B.armR, -f * 1.2, 0, -f * 0.5); set(B.armL, -f * 0.8, 0, f * 0.5);
      set(B.head, f * 0.5);
      return;
    }

    if (st === 'dodge') {
      const f = 1 - clamp(this.dodgeTimer / 0.42, 0, 1);
      B.hip.rotation.x = f * Math.PI * 2 * 0.5; // rola o tronco
      B.hip.position.y = 0.95 - Math.sin(f * Math.PI) * 0.35;
      set(B.legL, 1.1 - f); set(B.legR, 1.1 - f);
      set(B.armL, -0.6); set(B.armR, -0.6);
      return;
    }
    B.hip.rotation.x = 0;

    if (st === 'run' || st === 'sprint' || st === 'walk') {
      const rate = st === 'sprint' ? 11 : 8;
      const w = Math.sin(t * rate);
      const amp = st === 'sprint' ? 0.85 : 0.6;
      set(B.legL, w * amp); set(B.legR, -w * amp);
      set(B.shinL, Math.max(0, -w) * amp * 0.9); set(B.shinR, Math.max(0, w) * amp * 0.9);
      if (!this.blocking && this.castTimer <= 0) {
        set(B.armL, -w * amp * 0.8, 0, 0.12); set(B.armR, w * amp * 0.8, 0, -0.12);
      }
      B.torso.rotation.x = 0.08 + (st === 'sprint' ? 0.14 : 0.04);
      B.hip.position.y = 0.95 + Math.abs(Math.sin(t * rate)) * 0.045;
      set(B.head, -0.05);
      return;
    }

    if (st === 'attack') {
      const f = 1 - clamp(this.attackTimer / this.attackDuration, 0, 1); // 0 início → 1 fim
      const sw = Math.sin(f * Math.PI);
      const idx = this.comboIdx % 3;
      if (idx === 0) { set(B.armR, -1.9 + sw * 2.6, -0.3, -0.4); set(B.torso, 0, -0.4 + sw * 0.7); }
      else if (idx === 1) { set(B.armR, -1.9 + sw * 2.6, 0.3, 0.4); set(B.torso, 0, 0.4 - sw * 0.7); }
      else { set(B.armR, -2.2 + sw * 3.0, 0, 0); set(B.torso, 0.1, sw * 0.9 - 0.45); }
      set(B.armL, -0.5, 0, 0.5); set(B.legL, 0.15); set(B.legR, -0.2);
      return;
    }

    if (st === 'block') {
      set(B.armL, -1.35, 0, 0.55); set(B.foreL, -1.0);
      set(B.armR, -0.4, 0, -0.2);
      B.torso.rotation.x = 0.12;
      set(B.legL, 0.2); set(B.legR, -0.15);
      return;
    }

    if (st === 'cast') {
      const f = 1 - clamp(this.castTimer / 0.55, 0, 1);
      const raise = Math.sin(f * Math.PI);
      set(B.armR, -2.4 * raise - 0.3, 0, -0.25);
      set(B.foreR, -0.5 * raise);
      set(B.armL, -0.3, 0, 0.3);
      B.torso.rotation.x = -0.08 * raise;
      set(B.legL, 0.1); set(B.legR, -0.1);
      return;
    }

    if (st === 'hurt') {
      const f = clamp(this.stateT / 0.35, 0, 1);
      set(B.torso, -0.3 * (1 - f), 0, 0.15 * (1 - f));
      set(B.armL, -0.5, 0, 0.8 * (1 - f)); set(B.armR, -0.5, 0, -0.8 * (1 - f));
      set(B.legL, 0.2); set(B.legR, -0.1);
      return;
    }

    /* idle */
    B.torso.rotation.x = breath;
    set(B.legL, 0.02); set(B.legR, -0.02);
    set(B.shinL, 0.02); set(B.shinR, 0);
    if (this.blocking) { set(B.armL, -1.3, 0, 0.5); set(B.armR, -0.3); }
    else if (this.castTimer <= 0 && this.attackTimer <= 0) {
      set(B.armL, 0.05 + breath, 0, 0.09); set(B.armR, 0.05 - breath, 0, -0.09);
      set(B.foreL, -0.15); set(B.foreR, -0.15);
    }
    set(B.head, breath * 0.5, Math.sin(t * 0.7) * 0.08);
  }

  updateAura(dt) {
    if (!this.aura) return;
    this.auraT += dt;
    this.aura.rotation.z += dt * 0.8;
    const el = ELEMENTS[this.element];
    if (el && Math.random() < dt * 8) {
      const p = this.root.position.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 1.5), rand(-0.4, 0.4)));
      this.game.fx.spawn(p, { count: 1, color: el.color, speed: 0.3, life: 0.8, size: 3.5, alpha: 0.5, upBias: 1 });
    }
  }
}
