// Jogador — corpo humano 3D procedural, animações, movimento e combate físico
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { input, readMove, wasPressed, touchPressed, touchHeld } from '../core/input.js';
import { audio } from '../audio/audio.js';
import { effects, ELEMENT_COLORS } from '../effects/effects.js';
import { clamp, damp, angleLerp, rand } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

const MAT = {
  skin: new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
  hair: new THREE.MeshLambertMaterial({ color: 0x4a2c14 }),
  shirt: new THREE.MeshLambertMaterial({ color: 0x7a4a2a }),
  vest: new THREE.MeshLambertMaterial({ color: 0x5a3a1a }),
  pants: new THREE.MeshLambertMaterial({ color: 0x4a4438 }),
  boots: new THREE.MeshLambertMaterial({ color: 0x33261a }),
  belt: new THREE.MeshLambertMaterial({ color: 0x2a1a0e }),
  cape: new THREE.MeshLambertMaterial({ color: 0x8a1a2a, side: THREE.DoubleSide }),
  metal: new THREE.MeshLambertMaterial({ color: 0xb8bec4 }),
  metalDark: new THREE.MeshLambertMaterial({ color: 0x5a5f66 }),
  gold: new THREE.MeshLambertMaterial({ color: 0xe8c26a }),
  eye: new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
  shield: new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  leather: new THREE.MeshLambertMaterial({ color: 0x5a3a20 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  clothGreen: new THREE.MeshLambertMaterial({ color: 0x3a5a2a }),
};

// durações de cada estado de combate (máquina de estados + watchdog)
const STATE_DUR = {
  attack: 0.42, heavy: 0.75, cast: 0.55, hurt: 0.35, dodge: 0.45, interact: 0.6,
};

class Player {
  constructor() {
    this.root = new THREE.Group();
    this.vel = new THREE.Vector3();
    this.yaw = 0;                    // direção do corpo
    this.state = 'idle';
    this.stateT = 0;
    this.animPhase = 0;
    this.grounded = true;
    this.speed = 0;
    this.comboIdx = 0;
    this.comboTimer = 0;
    this.attackHitDone = false;
    this.iframe = 0;                 // invulnerabilidade (esquiva)
    this.blocking = false;
    this.dead = false;
    this.staggered = 0;
    this.hurtFlash = 0;
    this.stepTimer = 0;
    this.chargeT = 0;                // ataque pesado carregando
    this.interactTarget = null;
    this.arrows = [];                // flechas do arqueiro no ar
    this.buildBody();
  }

  buildBody() {
    const g = this.root;
    // quadril
    this.hips = new THREE.Group(); this.hips.position.y = 0.98; g.add(this.hips);
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.26), MAT.pants);
    pelvis.castShadow = true; this.hips.add(pelvis);
    // cinto
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.28), MAT.belt);
    belt.position.y = 0.12; this.hips.add(belt);

    // tronco
    this.torso = new THREE.Group(); this.torso.position.y = 0.14; this.hips.add(this.torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.28), MAT.shirt);
    chest.position.y = 0.25; chest.castShadow = true; this.torso.add(chest);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.31), MAT.vest);
    vest.position.y = 0.28; vest.castShadow = true; this.torso.add(vest);
    // capa (atrás)
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), MAT.cape);
    this.cape.position.set(0, 0.18, -0.18);
    this.cape.rotation.x = 0.12;
    this.torso.add(this.cape);

    // pescoço + cabeça
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 6), MAT.skin);
    neck.position.y = 0.55; this.torso.add(neck);
    this.head = new THREE.Group(); this.head.position.y = 0.68; this.torso.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), MAT.skin);
    skull.position.y = 0.1; skull.scale.set(0.9, 1, 0.95); skull.castShadow = true; this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), MAT.hair);
    hair.position.set(0, 0.16, -0.03); hair.scale.set(0.92, 0.75, 0.95);
    this.head.add(hair);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), MAT.hair);
    fringe.position.set(0, 0.14, 0.16); this.head.add(fringe);
    for (const sx of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), MAT.eye);
      eye.position.set(sx, 0.08, 0.17); this.head.add(eye);
    }

    // braços
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.3, 0.46, 0);
      this.torso.add(shoulder);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.14), MAT.shirt);
      upper.position.y = -0.15; upper.castShadow = true; shoulder.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.12), MAT.skin);
      fore.position.y = -0.14; elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), MAT.skin);
      hand.position.y = -0.31; elbow.add(hand);
      this.arms.push({ shoulder, elbow, hand, side });
    }
    this.rightArm = this.arms[1]; this.leftArm = this.arms[0];

    // ---------- ARMAS ----------
    // espada (mão direita) — visível apenas sacada
    this.sword = this.buildSword();
    this.sword.position.set(0, -0.36, 0.05);
    this.sword.rotation.set(-0.25, 0, 0.12); // lâmina para cima a partir do punho
    this.rightArm.elbow.add(this.sword);

    // bainha no quadril esquerdo (espada guardada fica aqui)
    this.sheath = new THREE.Group();
    const sheathBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.1), MAT.leather);
    sheathBody.position.y = -0.15; sheathBody.castShadow = true;
    this.sheath.add(sheathBody);
    const sheathTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), MAT.metalDark);
    sheathTip.position.y = -0.62; sheathTip.rotation.x = Math.PI; this.sheath.add(sheathTip);
    this.sheath.position.set(-0.22, -0.1, -0.12);
    this.sheath.rotation.z = 0.35; // inclinada para trás
    this.hips.add(this.sheath);
    // cópia da espada guardada na bainha (punho para fora)
    this.sheathSword = this.buildSword();
    this.sheathSword.rotation.x = Math.PI;
    this.sheathSword.position.y = 0.05;
    this.sheath.add(this.sheathSword);

    // cajado (mão direita)
    this.staff = this.buildStaff();
    this.staff.position.set(0, -0.34, 0.04);
    this.rightArm.elbow.add(this.staff);

    // arco (mão esquerda)
    this.bow = this.buildBow();
    this.bow.position.set(0, -0.32, 0.1);
    this.leftArm.elbow.add(this.bow);

    // escudo (mão esquerda)
    this.shield = new THREE.Group();
    const shieldBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), MAT.shield);
    shieldBody.rotation.x = Math.PI / 2;
    shieldBody.castShadow = true;
    this.shield.add(shieldBody);
    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), MAT.metal);
    shieldBoss.position.z = 0.04; this.shield.add(shieldBoss);
    const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 14), MAT.metalDark);
    shieldRim.position.z = 0.02; this.shield.add(shieldRim);
    this.shield.position.set(0, -0.38, 0.05);
    this.leftArm.elbow.add(this.shield);

    // estado da arma: guardada / sacada / animando
    this.weaponState = 'sheathed';   // sheathed | drawing | drawn | sheathing
    this.weaponT = 0;
    this.combatIdleT = 0;            // tempo sem combate (para guardar a arma)

    // pernas
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.13, -0.08, 0);
      this.hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.17), MAT.pants);
      thigh.position.y = -0.18; thigh.castShadow = true; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.38; hip.add(knee);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.15), MAT.pants);
      shin.position.y = -0.17; knee.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.26), MAT.boots);
      boot.position.set(0, -0.4, 0.04); boot.castShadow = true; knee.add(boot);
      this.legs.push({ hip, knee, side });
    }
  }

  buildSword() {
    const g = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 6), MAT.belt);
    g.add(grip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), MAT.gold);
    guard.position.y = 0.1; g.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.85, 0.018), MAT.metal);
    blade.position.y = 0.53; blade.castShadow = true; g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), MAT.metal);
    tip.position.y = 1.0; g.add(tip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), MAT.gold);
    pommel.position.y = -0.11; g.add(pommel);
    g.userData.blade = blade;
    return g;
  }

  buildStaff() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.3, 6), MAT.wood);
    shaft.position.y = 0.45; shaft.castShadow = true; g.add(shaft);
    // cabeça: garra + orbe
    const claw1 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 4), MAT.metalDark);
    claw1.position.set(0.05, 1.1, 0); claw1.rotation.z = -0.5; g.add(claw1);
    const claw2 = claw1.clone(); claw2.position.x = -0.05; claw2.rotation.z = 0.5; g.add(claw2);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x7ec8ff, emissive: 0x1a4a8a, emissiveIntensity: 0.9 }));
    orb.position.y = 1.16; g.add(orb);
    g.userData.orb = orb;
    return g;
  }

  buildBow() {
    const g = new THREE.Group();
    const limb = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 6, 20, Math.PI * 1.35), MAT.wood);
    limb.rotation.z = Math.PI - (Math.PI * 1.35) / 2; // abertura para baixo/tras
    limb.castShadow = true; g.add(limb);
    const tip1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), MAT.belt);
    tip1.position.y = 0.3; g.add(tip1);
    const tip2 = tip1.clone(); tip2.position.y = -0.3; g.add(tip2);
    // corda
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 3), new THREE.MeshBasicMaterial({ color: 0xe8e0d0 }));
    string.position.y = 0; g.add(string);
    g.rotation.y = Math.PI / 2; // corda atrás da mão
    return g;
  }

  // ---------- aparência por equipamento ----------
  weaponType() {
    const w = G.equipment.weapon;
    const wt = w ? (w.wtype || 'sword') : (G.classe === 'mago' ? 'staff' : G.classe === 'arqueiro' ? 'bow' : 'sword');
    return wt;
  }

  refreshEquipment() {
    const eq = G.equipment;
    // cor da armadura
    MAT.shirt.color.setHex(eq.armor ? 0x6a7a8a : 0x7a4a2a);
    MAT.cape.color.setHex(eq.cape ? 0x2a4a8a : 0x8a1a2a);
    this.cape.visible = !!eq.cape;
    // arma melhor = lâmina maior
    const s = this.sword.userData.blade;
    const wIdx = eq.weapon ? (eq.weapon.tier || 0) : 0;
    s.scale.set(1 + wIdx * 0.12, 1 + wIdx * 0.22, 1);
    MAT.metal.color.setHex(eq.weapon ? 0xd8e2ea : 0xb8bec4);
    MAT.boots.color.setHex(eq.boots ? 0x22201c : 0x33261a);

    // ---- visibilidade por tipo de arma + estado (sacada/guardada) ----
    const wt = this.weaponType();
    const hasWeapon = !!eq.weapon;
    const drawn = this.weaponState === 'drawn' || this.weaponState === 'drawing';
    // espada: na mão quando sacada; na bainha quando guardada
    this.sword.visible = wt === 'sword' && drawn;
    this.sheath.visible = wt === 'sword';
    // cajado/arco: sempre na mão quando equipados
    this.staff.visible = wt === 'staff';
    this.bow.visible = wt === 'bow';
    // escudo: só quando equipado no slot offhand
    this.shield.visible = !!eq.offhand;
    // se espada guardada, cópia na bainha
    this.sheathSword.visible = wt === 'sword' && !drawn;
  }

  // sacar a arma (animação de equipar) — usada no início de combate e pela seleção de classe
  drawWeapon(auto = false) {
    if (this.weaponState === 'drawn' || this.weaponState === 'drawing') return true;
    if (!G.equipment.weapon && this.weaponType() === 'sword') return false; // sem espada para sacar
    this.weaponState = 'drawing';
    this.weaponT = 0;
    if (!auto) audio.sfx('chest');
    return true;
  }

  sheatheWeapon() {
    if (this.weaponState !== 'drawn') return;
    this.weaponState = 'sheathing';
    this.weaponT = 0;
    audio.sfx('pageFlip');
  }

  updateWeapon(dt) {
    const wt = this.weaponType();
    if (this.weaponState === 'drawing') {
      this.weaponT += dt;
      if (this.weaponT >= 0.45) { this.weaponState = 'drawn'; audio.sfx('swing'); }
    } else if (this.weaponState === 'sheathing') {
      this.weaponT += dt;
      if (this.weaponT >= 0.4) { this.weaponState = 'sheathed'; this.refreshEquipment(); }
    } else if (this.weaponState === 'drawn') {
      // fora de combate por 7s → guarda a arma
      if (G.combatMusic <= 0) {
        this.combatIdleT += dt;
        if (this.combatIdleT > 7 && this.grounded && this.speed < 0.5) this.sheatheWeapon();
      } else this.combatIdleT = 0;
    }
    // espada guardada: cópia visual na bainha
    if (this.sheathSword && this.sheathSword.visible) {
      this.sheathSword.rotation.z = 0;
    }
    // brilho do orbe do cajado pulsa com mana
    if (this.staff.visible && this.staff.userData.orb) {
      const m = this.staff.userData.orb.material;
      m.emissiveIntensity = 0.5 + Math.sin(performance.now() * 0.004) * 0.25 + (G.mp / Math.max(1, G.maxMp)) * 0.6;
    }
    // flechas no ar
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.t += dt;
      a.mesh.position.x += a.vx * dt; a.mesh.position.z += a.vz * dt;
      a.mesh.position.y += a.vy * dt; a.vy -= 6 * dt;
      a.mesh.lookAt(a.mesh.position.x + a.vx, a.mesh.position.y + a.vy, a.mesh.position.z + a.vz);
      // acerto
      for (const e of (G.enemies?.active || [])) {
        if (e.dead) continue;
        const dxz = Math.hypot(a.mesh.position.x - e.root.position.x, a.mesh.position.z - e.root.position.z);
        if (dxz < e.radius + 0.5 && a.mesh.position.y > e.root.position.y - 0.4 && a.mesh.position.y < e.root.position.y + 1.8) {
          e.takeDamage(a.dmg, { x: a.vx, z: a.vz, kb: 2, source: 'player' });
          effects.particles.burst(a.mesh.position.x, a.mesh.position.y, a.mesh.position.z, 6,
            { r: 1, g: 0.9, b: 0.7, spread: 1, life: 0.3, size: 0.25 });
          a.t = 99; break;
        }
      }
      if (a.t > 2.2 || a.mesh.position.y < terrainHeight(a.mesh.position.x, a.mesh.position.z)) {
        G.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  // ---------- ciclo ----------
  update(dt, camera) {
    this.stateT += dt;
    this.animPhase += dt * (4 + this.speed * 0.7);
    this.iframe = Math.max(0, this.iframe - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.staggered = Math.max(0, this.staggered - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if (this.comboTimer === 0 && this.comboIdx > 0 && this.state !== 'attack') this.comboIdx = 0;

    // ---- WATCHDOG da máquina de estados de combate ----
    // garante que TODO estado temporário termina, mesmo se uma exceção
    // em qualquer ponto do update impedir a transição normal
    const sdur = STATE_DUR[this.state];
    if (sdur && this.stateT >= sdur && this.state !== 'dead' && this.state !== 'crystal') {
      this.state = 'idle'; this.stateT = 0; this.attackHitDone = false;
    }

    const busy = ['attack', 'cast', 'dodge', 'heavy', 'hurt', 'dead', 'interact', 'crystal'].includes(this.state);

    // ---- entrada de movimento ----
    const mv = readMove();
    const canMove = !this.dead && this.staggered <= 0 && !['attack', 'cast', 'dodge', 'heavy', 'interact', 'crystal'].includes(this.state);
    let moveSpeed = 0;
    if (canMove) {
      // direção relativa à câmera
      const len = Math.hypot(mv.x, mv.z);
      if (len > 0.05) {
        const d = _v1.set(0, 0, -1).applyQuaternion(camera.quaternion); d.y = 0; d.normalize();
        const right = _v2.set(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
        const wx = right.x * mv.x + d.x * (-mv.z);
        const wz = right.z * mv.x + d.z * (-mv.z);
        const wl = Math.hypot(wx, wz) || 1;
        const sprint = input.sprint && G.stamina > 5;
        const base = 4.2 + (G.attributes.velocidade - 5) * 0.12;
        const waterSlow = this.inWater ? 0.55 : 1;
        moveSpeed = (sprint ? base * 1.55 : base) * waterSlow;
        this._wishX = (wx / wl) * moveSpeed;
        this._wishZ = (wz / wl) * moveSpeed;
        this._wishYaw = Math.atan2(wx, wz);
        if (sprint && this.grounded) {
          G.stamina = Math.max(0, G.stamina - dt * 14);
          this.state = 'sprint';
        } else {
          this.state = 'run';
        }
      } else {
        this._wishX = this._wishZ = 0;
        this.state = this.dead ? 'dead' : 'idle';
      }
      // bloquear
      this.blocking = input.block && G.stamina > 10 && this.grounded && !this.dead;
      // pular
      if ((wasPressed('Space') || touchPressed('jump')) && this.grounded) {
        this.vel.y = 7.2;
        this.grounded = false;
        this.state = 'jump';
        audio.sfx('jump');
      }
      // esquiva
      if ((wasPressed('KeyC') || touchPressed('dodge')) && G.stamina >= 25 && this.grounded && !this.dead) {
        this.startDodge();
      }
    } else {
      this._wishX = this._wishZ = 0;
      if (this.state === 'run' || this.state === 'sprint' || this.state === 'idle') this.state = 'idle';
      this.blocking = false;
    }
    if (this.blocking) G.stamina = Math.max(0, G.stamina - dt * 8);
    else if (this.grounded) G.stamina = Math.min(G.maxStamina, G.stamina + dt * (input.sprint ? 4 : 12));

    // ---- física ----
    this.inWater = this.isInWaterBody();
    this.speed = Math.hypot(this._wishX || 0, this._wishZ || 0);
    let vx = this._wishX || 0, vz = this._wishZ || 0;
    // empurrão de knockback
    vx += this._kbx || 0; vz += this._kbz || 0;
    this._kbx = (this._kbx || 0) * Math.pow(0.001, dt); this._kbz = (this._kbz || 0) * Math.pow(0.001, dt);

    // esquiva: impulso próprio
    if (this.state === 'dodge') {
      const t = this.stateT / 0.45;
      const boost = Math.sin(Math.min(1, t) * Math.PI) * 9;
      vx += Math.sin(this.yaw) * boost; vz += Math.cos(this.yaw) * boost;
    }

    this.vel.y -= 20 * dt;
    let nx = this.root.position.x + vx * dt;
    let nz = this.root.position.z + vz * dt;
    let ny = this.root.position.y + this.vel.y * dt;

    // colisão com o mundo
    const res = this.world.resolveMove(this.root.position.x, this.root.position.z, nx, nz, 0.55);
    nx = res.x; nz = res.z;

    const ground = terrainHeight(nx, nz);
    if (ny <= ground) {
      if (!this.grounded && this.vel.y < -6) audio.sfx('land');
      ny = ground; this.vel.y = 0; this.grounded = true;
      if (this.state === 'jump' || this.state === 'fall') this.state = 'idle';
    } else {
      this.grounded = false;
      if (this.vel.y < -0.5 && this.state !== 'jump') this.state = 'fall';
    }

    this.root.position.set(nx, ny, nz);
    G.savePos = { x: nx, z: nz };

    // girar corpo
    if (this.state === 'attack' || this.state === 'heavy' || this.state === 'cast') {
      // olha para o alvo / direção da câmera
      const targetYaw = this.actionYaw ?? this.yaw;
      this.yaw = angleLerp(this.yaw, targetYaw, Math.min(1, dt * 14));
    } else if (this.speed > 0.5) {
      this.yaw = angleLerp(this.yaw, this._wishYaw ?? this.yaw, Math.min(1, dt * 12));
    }
    this.root.rotation.y = this.yaw;

    // ---- passos (som) ----
    if (this.grounded && this.speed > 1 && this.state !== 'dodge') {
      this.stepTimer -= dt * (this.state === 'sprint' ? 2.4 : 1.6);
      if (this.stepTimer <= 0) { this.stepTimer = 0.5; audio.sfx('step'); }
    }

    // ---- ataque ----
    if (!this.dead && this.staggered <= 0) {
      this.handleAttack(dt, camera);
      this.handleSpells();
    }
    if (this.state === 'attack') this.updateAttackPose();
    if (this.state === 'interact' && this.stateT > 0.6) this.state = 'idle';

    // ---- armas (sacar/guardar/flechas) ----
    this.updateWeapon(dt);

    // ---- pose ----
    this.updatePose(dt);
    this.root.traverse(o => { if (o.isMesh) { } });
  }

  isInWaterBody() {
    const p = this.root.position;
    const h = terrainHeight(p.x, p.z);
    return h < 0.55 && p.y < 0.8;
  }

  startDodge() {
    this.state = 'dodge'; this.stateT = 0;
    this.iframe = 0.5;
    G.stamina -= 25;
    audio.sfx('dodge');
    effects.particles.burst(this.root.position.x, this.root.position.y + 0.3, this.root.position.z, 8,
      { r: 0.8, g: 0.85, b: 0.9, spread: 1.2, up: 0.3, life: 0.4, size: 0.3, drag: 0.85 });
  }

  handleAttack(dt, camera) {
    // clique rápido (edge) — sempre dispara o combo, mesmo se down/up ocorrerem no mesmo frame
    const clicked = input.leftPressed || touchPressed('attack');
    if (clicked && (this.state === 'idle' || this.state === 'run' || this.state === 'sprint') && this.grounded) {
      this.startAttack('combo', camera);
      this.chargeT = 0;
    }
    // segurar: carrega o ataque pesado
    const held = input.buttons.left || touchHeld('attack');
    if (held && (this.state === 'idle' || this.state === 'run' || this.state === 'sprint')) {
      this.chargeT += dt;
      if (this.chargeT > 0.45 && this.grounded && G.stamina >= 30) {
        this.startAttack('heavy', camera);
        this.chargeT = 0;
      }
    } else {
      this.chargeT = 0;
    }
    if (wasPressed('KeyQ') && this.grounded && this.stamina >= 30 &&
      (this.state === 'idle' || this.state === 'run' || this.state === 'sprint')) {
      this.startAttack('heavy', camera);
    }

    if (this.state === 'attack' || this.state === 'heavy') {
      const dur = this.state === 'heavy' ? 0.75 : 0.42;
      const hitAt = this.state === 'heavy' ? 0.38 : (0.14 + this.comboIdx * 0.02);
      if (!this.attackHitDone && this.stateT >= hitAt) {
        this.attackHitDone = true;
        this.doMeleeHit(this.state === 'heavy');
      }
      if (this.stateT >= dur) {
        this.state = 'idle'; this.stateT = 0;
      }
    }
  }

  startAttack(kind, camera) {
    const heavy = kind === 'heavy';
    // arma precisa estar sacada: saca durante o wind-up
    if (this.weaponType() === 'sword' && this.weaponState !== 'drawn' && this.weaponState !== 'drawing') {
      this.drawWeapon(true);
    }
    if (!heavy) {
      this.comboIdx = (this.comboTimer > 0 ? this.comboIdx + 1 : 1) % 3 || 3;
      this.comboTimer = 1.0;
      if (this.comboIdx > 3) this.comboIdx = 1;
    } else {
      G.stamina -= 30;
    }
    G.stamina = Math.max(0, G.stamina - (heavy ? 0 : 8));
    this.state = heavy ? 'heavy' : 'attack';
    this.stateT = 0;
    this.attackHitDone = false;
    this.iframe = 0;
    // olhar para o alvo próximo ou direção da câmera (fallback: câmera global)
    this.actionYaw = this.aimYaw(camera || G.camera);
    audio.sfx('swing');
  }

  aimYaw(camera) {
    // direção da câmera no plano
    const d = _v3.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return Math.atan2(d.x, d.z);
  }

  doMeleeHit(heavy) {
    // Arqueiro: dispara flecha em vez de golpe
    if (this.weaponType() === 'bow') { this.doBowShot(heavy); return; }
    const dirX = Math.sin(this.yaw), dirZ = Math.cos(this.yaw);
    const reach = this.weaponType() === 'staff' ? 2.2 : (heavy ? 3.2 : 2.6);
    const dmgBase = 6 + G.attributes.forca * 1.2 + (G.equipment.weapon ? G.equipment.weapon.dmg : 0);
    const dmg = dmgBase * (heavy ? 2.1 : 1) * rand(0.85, 1.15);
    const crit = Math.random() < 0.05 + G.attributes.critico * 0.012;
    let hitAny = false;
    const enemies = G.enemies ? G.enemies.active : [];
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.root.position.x - this.root.position.x;
      const dz = e.root.position.z - this.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + e.radius) continue;
      const dot = (dx / d) * dirX + (dz / d) * dirZ;
      if (dot < 0.3) continue;
      hitAny = true;
      e.takeDamage(dmg * (crit ? 2 : 1), {
        x: dirX, z: dirZ, kb: heavy ? 6 : 3, crit, heavy,
        element: null, source: 'player',
      });
    }
    // rastro da lâmina
    const hx = this.root.position.x + dirX * 1.2;
    const hz = this.root.position.z + dirZ * 1.2;
    const hy = this.root.position.y + 1.1;
    const c = heavy ? 0xffe0a0 : 0xcfd8e2;
    effects.slash(this.root.position.x, this.root.position.y + 1.1, this.root.position.z, this.yaw, c, heavy ? 1.5 : 1.1);
    effects.particles.burst(hx, hy, hz, heavy ? 10 : 6,
      { r: 0.85, g: 0.88, b: 0.95, spread: 1.6, up: 0.2, life: 0.25, size: 0.3, drag: 0.8 });
    if (hitAny) audio.sfx(crit ? 'crit' : 'hit');
    if (heavy) {
      G.combatMusic = 5;
    }
  }

  // flecha do arqueiro: projétil físico com arco
  doBowShot(heavy) {
    const dmgBase = 5 + G.attributes.forca * 1.0 + (G.equipment.weapon ? G.equipment.weapon.dmg * 1.4 : 0);
    const dmg = dmgBase * (heavy ? 1.9 : 1) * rand(0.9, 1.15);
    const crit = Math.random() < 0.12 + G.attributes.critico * 0.015;
    const speed = 22;
    const dirX = Math.sin(this.yaw), dirZ = Math.cos(this.yaw);
    // mesh da flecha
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 4), MAT.wood);
    shaft.rotation.x = Math.PI / 2; arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), MAT.metal);
    head.rotation.x = -Math.PI / 2; head.position.z = 0.3; arrow.add(head);
    const origin = this.root.position;
    arrow.position.set(origin.x + dirX * 0.5, origin.y + 1.3, origin.z + dirZ * 0.5);
    arrow.rotation.y = this.yaw;
    G.scene.add(arrow);
    this.arrows.push({ mesh: arrow, vx: dirX * speed, vz: dirZ * speed, vy: heavy ? 1.6 : 0.8, dmg: dmg * (crit ? 2 : 1), t: 0 });
    audio.sfx(heavy ? 'bowHeavy' : 'bow');
    // partícula de disparo
    effects.particles.burst(arrow.position.x, arrow.position.y, arrow.position.z, 4,
      { r: 0.9, g: 0.85, b: 0.7, spread: 0.6, life: 0.25, size: 0.2 });
  }

  handleSpells() {
    for (let i = 1; i <= 4; i++) {
      if (wasPressed('Digit' + i) || touchPressed('spell' + i)) {
        G.magic?.castSlot(i);
        break;
      }
    }
    if (wasPressed('Digit5') || touchPressed('potion')) G.inventory?.usePotion();
  }

  // ---------- animação procedural ----------
  updatePose(dt) {
    const t = this.animPhase;
    const st = this.state;
    const speedF = clamp(this.speed / 6, 0, 1);
    const A = this.arms, L = this.legs;

    // padrão: reset suave
    const ease = (cur, target, k) => damp(cur, target, k, dt);
    let lHip = 0, rHip = 0, lKnee = 0, rKnee = 0;
    let lSh = -0.1, rSh = -0.1, lEl = -0.25, rEl = -0.25;
    let torsoRot = 0, headRot = 0, bob = 0, lean = 0;

    if (st === 'idle') {
      const b = Math.sin(t * 1.6) * 0.03;
      bob = b * 0.4;
      lSh = -0.08 + b; rSh = -0.08 - b;
      lEl = -0.3; rEl = -0.3;
      torsoRot = Math.sin(t * 0.8) * 0.02;
      headRot = Math.sin(t * 0.5) * 0.06;
    } else if (st === 'run' || st === 'sprint') {
      const f = st === 'sprint' ? t * 1.4 : t;
      const amp = st === 'sprint' ? 0.95 : 0.7;
      lHip = Math.sin(f) * amp; rHip = -Math.sin(f) * amp;
      lKnee = Math.max(0, -Math.sin(f) * amp * 0.9);
      rKnee = Math.max(0, Math.sin(f) * amp * 0.9);
      lSh = -0.2 + Math.sin(f + Math.PI) * amp * 0.7;
      rSh = -0.2 + Math.sin(f) * amp * 0.7;
      lEl = -0.5 - Math.max(0, Math.sin(f + Math.PI)) * 0.4;
      rEl = -0.5 - Math.max(0, Math.sin(f)) * 0.4;
      torsoRot = Math.sin(f * 2) * 0.04;
      lean = st === 'sprint' ? 0.24 : 0.12;
      bob = Math.abs(Math.sin(f)) * 0.06;
    } else if (st === 'jump') {
      lHip = -0.5; rHip = 0.3; lKnee = 0.9; rKnee = 0.4;
      lSh = -2.6; rSh = -2.6; lEl = -0.3; rEl = -0.3;
    } else if (st === 'fall') {
      lHip = -0.3; rHip = 0.2; lKnee = 0.6; rKnee = 0.5;
      lSh = -1.4 + Math.sin(t * 6) * 0.2; rSh = -1.2 - Math.sin(t * 6) * 0.2;
    } else if (st === 'dodge') {
      const p = clamp(this.stateT / 0.45, 0, 1);
      const spin = p * Math.PI * 2;
      this.root.rotation.x = spin;
      lHip = -1.2; rHip = -0.4; lKnee = 1.8; rKnee = 1.2;
      lSh = -1.8; rSh = -1.8; lEl = -1.2; rEl = -1.2;
      if (p >= 1) this.root.rotation.x = 0;
    } else if (st === 'attack') {
      const p = clamp(this.stateT / 0.42, 0, 1);
      const wind = Math.min(1, p * 2.4), strike = clamp((p - 0.35) * 2.6, 0, 1);
      const c = this.comboIdx;
      if (c === 1) { rSh = -2.4 * wind + (strike * 2.4) - 0.4; rEl = -1.4 + strike * 1.0; lSh = -0.5 * wind; }
      else if (c === 2) { rSh = -0.6 - strike * 1.8; rEl = -0.4; lSh = -2.2 * wind + strike * 1.6; torsoRot = strike * 0.5 * (wind - 0.5); }
      else { rSh = -2.8 * wind + strike * 2.2 - 0.6; rEl = -1.2 + strike * 0.8; lSh = -0.4; torsoRot = -0.3 + strike * 0.6; }
      lHip = 0.25 * strike; rHip = -0.2 * strike;
      lean = 0.15 * strike;
    } else if (st === 'heavy') {
      const p = clamp(this.stateT / 0.75, 0, 1);
      const wind = Math.min(1, p * 1.8), strike = clamp((p - 0.45) * 3.2, 0, 1);
      rSh = -3.0 * wind + strike * 2.8 - 0.5;
      rEl = -1.6 + strike * 1.4;
      lSh = -1.0 * wind;
      torsoRot = -0.5 * wind + strike * 0.9;
      lean = 0.2 + strike * 0.25;
      lHip = 0.3 * strike; rHip = -0.25 * strike;
      if (wind >= 1 && strike === 0) {
        // partículas de carga
        if (Math.random() < dt * 20) {
          effects.particles.emit({ x: this.root.position.x + rand(-0.4, 0.4), y: this.root.position.y + 1.2, z: this.root.position.z + rand(-0.4, 0.4), vy: 1, life: 0.3, size: 0.25, r: 1, g: 0.9, b: 0.6 });
        }
      }
    } else if (st === 'cast') {
      const p = clamp(this.stateT / 0.55, 0, 1);
      rSh = -2.2 - Math.sin(p * Math.PI) * 0.4;
      rEl = -0.9;
      lSh = -0.5; lEl = -0.9;
      lean = -0.08;
    } else if (st === 'block') {
      lSh = -1.1; lEl = -1.4;
      rSh = -0.4; rEl = -0.8;
      lean = 0.1;
    } else if (st === 'hurt') {
      const p = clamp(this.stateT / 0.35, 0, 1);
      torsoRot = Math.sin(p * Math.PI) * -0.4;
      rSh = -1.2; lSh = -1.2;
      headRot = Math.sin(p * Math.PI) * 0.4;
    } else if (st === 'dead') {
      const p = clamp(this.stateT / 1.4, 0, 1);
      this.root.rotation.x = -p * Math.PI / 2 * 0.9;
      this.root.position.y = damp(this.root.position.y, terrainHeight(this.root.position.x, this.root.position.z) + 0.35, 4, dt);
      lSh = -0.3; rSh = -0.3;
      return;
    } else if (st === 'interact') {
      const p = clamp(this.stateT / 0.6, 0, 1);
      rSh = -1.6 - Math.sin(p * Math.PI) * 0.6;
      rEl = -0.6;
      headRot = 0.2;
    } else if (st === 'crystal') {
      // mão sobre o cristal — controlada pela cinemática
      rSh = -1.9; rEl = -0.4;
      lSh = -0.15; lEl = -0.25;
      headRot = -0.25;
    }
    if (this.blocking && st !== 'attack' && st !== 'cast' && st !== 'heavy') {
      lSh = -1.1; lEl = -1.4;
    }

    // aplicar
    L[0].hip.rotation.x = ease(L[0].hip.rotation.x, lHip, 16);
    L[1].hip.rotation.x = ease(L[1].hip.rotation.x, rHip, 16);
    L[0].knee.rotation.x = ease(L[0].knee.rotation.x, lKnee, 16);
    L[1].knee.rotation.x = ease(L[1].knee.rotation.x, rKnee, 16);
    A[0].shoulder.rotation.x = ease(A[0].shoulder.rotation.x, lSh, 18);
    A[1].shoulder.rotation.x = ease(A[1].shoulder.rotation.x, rSh, 18);
    A[0].shoulder.rotation.z = ease(A[0].shoulder.rotation.z, -0.08, 10);
    A[1].shoulder.rotation.z = ease(A[1].shoulder.rotation.z, 0.08, 10);
    A[0].elbow.rotation.x = ease(A[0].elbow.rotation.x, lEl, 18);
    A[1].elbow.rotation.x = ease(A[1].elbow.rotation.x, rEl, 18);
    this.torso.rotation.x = ease(this.torso.rotation.x, lean, 12);
    this.torso.rotation.y = ease(this.torso.rotation.y, torsoRot, 12);
    this.head.rotation.y = ease(this.head.rotation.y, headRot, 8);
    this.hips.position.y = 0.98 + bob;
    this.cape.rotation.x = 0.12 + lean * 0.5 + Math.sin(t * 2.4) * 0.04 + speedF * 0.35;
  }

  updateAttackPose() { /* integrado em updatePose */ }

  takeDamage(amount, opts = {}) {
    if (this.dead || this.iframe > 0) return false;
    if (this.blocking && !opts.pierce) {
      // reduz dano, consome stamina
      const blocked = G.stamina > 5;
      amount *= blocked ? 0.25 : 0.7;
      G.stamina = Math.max(0, G.stamina - 20);
      audio.sfx('block');
      effects.particles.burst(this.root.position.x + Math.sin(this.yaw) * 0.7, this.root.position.y + 1.1, this.root.position.z + Math.cos(this.yaw) * 0.7, 8,
        { r: 1, g: 0.9, b: 0.5, spread: 2, life: 0.3, size: 0.25 });
      if (blocked) { G.hud?.floatText?.('Bloqueado!', this.root.position, '#8fd4ff'); return false; }
    }
    const def = G.attributes.defesa * 0.8 + (G.equipment.armor ? G.equipment.armor.def : 0);
    amount = Math.max(1, amount - def * rand(0.8, 1.2));
    G.hp = Math.max(0, G.hp - amount);
    this.hurtFlash = 1;
    this.state = 'hurt'; this.stateT = 0;
    this.staggered = 0.3;
    audio.sfx('hurt');
    G.hud?.damagePlayer?.(amount);
    G.combatMusic = 4;
    if (opts.kb) {
      this._kbx = (opts.x || 0) * opts.kb; this._kbz = (opts.z || 0) * opts.kb;
    }
    if (G.hp <= 0) this.die();
    return true;
  }

  die() {
    this.dead = true;
    this.state = 'dead'; this.stateT = 0;
    audio.sfx('death');
    G.story?.onPlayerDeath();
  }

  respawn(x, z) {
    this.dead = false;
    this.state = 'idle'; this.stateT = 0;
    this.root.rotation.x = 0;
    G.hp = G.maxHp; G.mp = G.maxMp * 0.5; G.stamina = G.maxStamina;
    this.root.position.set(x, terrainHeight(x, z), z);
    effects.particles.burst(x, this.root.position.y + 1, z, 20, { r: 0.8, g: 0.9, b: 1, spread: 2, up: 2, life: 0.8, size: 0.4 });
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export { Player };
