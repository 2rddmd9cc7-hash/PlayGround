// Masmorra — caverna interior com salas, armadilhas, baús, miniboss e boss
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import * as P from '../world/props.js';
import { rand, randInt, pick } from '../core/utils.js';
import { audio } from '../audio/audio.js';
import { effects } from '../effects/effects.js';

export const DUNGEON_OFFSET = 2000; // coordenadas x da dungeon (mundo separado)

export class Dungeon {
  constructor() {
    this.built = false;
    this.active = false;
    this.group = null;
    this.boss = null;
    this.miniBoss = null;
    this.chests = [];
    this.traps = [];
    this.spawned = false;
    this.musicWas = null;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const g = new THREE.Group();
    const ox = DUNGEON_OFFSET;
    const MAT = P.PropMaterials;
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x3a3230, flatShading: true });

    // chão de pedra (estendido até a entrada, para não ver o céu pela fresta)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 175), rockMat);
    floor.position.set(ox, -0.5, 12);
    floor.receiveShadow = true;
    g.add(floor);

    // paredes / corredores: corredor de entrada + 3 salas
    const wall = (x, z, w, d, h = 8) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rockMat);
      m.position.set(ox + x, h / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      this._collide(x, z, Math.max(w, d) / 2 + 1);
    };
    // corredor de entrada (norte, da entrada até sala 1)
    wall(-6, -50, 2, 24); wall(6, -50, 2, 24);
    // sala 1
    wall(-18, -28, 26, 2); wall(18, -28, 26, 2); wall(-18, -12, 2, 18); wall(18, -12, 2, 18);
    // corredor 2
    wall(-6, 4, 2, 18); wall(6, 4, 2, 18);
    // sala 2 (grande — miniboss)
    wall(-24, 26, 40, 2); wall(24, 26, 40, 2); wall(-24, 46, 2, 24); wall(24, 46, 2, 24);
    // corredor 3
    wall(-5, 58, 2, 14); wall(5, 58, 2, 14);
    // sala do boss
    wall(-22, 76, 36, 2); wall(22, 76, 36, 2); wall(-22, 98, 2, 26); wall(22, 98, 2, 26);

    // colunas
    for (const cx of [-10, 10]) for (const cz of [-22, -18]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 7, 8), MAT.stoneDark);
      c.position.set(ox + cx, 3.5, cz);
      g.add(c);
      this._collide(cx, cz, 1.2);
    }
    for (const cx of [-16, 16]) for (const cz of [34, 42]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 7, 8), MAT.stoneDark);
      c.position.set(ox + cx, 3.5, cz);
      g.add(c);
      this._collide(cx, cz, 1.2);
    }

    // tochas das paredes (com luzes de verdade)
    for (const [tx, tz] of [[-5.4, -46], [5.4, -46], [-17, -20], [17, -20], [-5, 12], [5, 12], [-16, 30], [16, 30], [-4, 64], [4, 64], [-10, 80], [10, 80]]) {
      const t = P.makeTorch(1.6);
      t.position.set(ox + tx, 0, tz);
      g.add(t);
      const light = new THREE.PointLight(0xffb060, 30, 14, 2);
      light.position.set(0, 2.1, 0);
      t.add(light);
    }
    // luz que acompanha o jogador dentro da caverna
    this.playerLight = new THREE.PointLight(0xffd9a0, 55, 18, 2);
    this.playerLight.position.set(ox, 2.2, -62);
    g.add(this.playerLight);

    // armadilhas: espinhos no chão (dano ao pisar)
    for (let i = 0; i < 8; i++) {
      const tx = rand(-4, 4), tz = rand(-56, -40) + (i > 3 ? 40 : 0);
      const spikes = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), MAT.metal);
        s.position.set(rand(-1, 1), 0.25, rand(-1, 1));
        spikes.add(s);
      }
      spikes.position.set(ox + tx, 0, tz);
      spikes.visible = false; // escondidas no chão
      g.add(spikes);
      this.traps.push({ x: ox + tx, z: tz, mesh: spikes, armed: true, cd: 0 });
    }

    // baús
    this._chest(g, -14, -24, 'raro');
    this._chest(g, 18, 36, 'epico');
    this._chest(g, -16, 88, 'lendario');

    // altar do boss
    const altar = P.makeAltar();
    altar.scale.setScalar(1.6);
    altar.position.set(ox, 0, 92);
    g.add(altar);

    // cristais brilhantes decorativos (longe dos corredores)
    for (let i = 0; i < 10; i++) {
      const sideX = (Math.random() < 0.5 ? -1 : 1) * rand(9, 19);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.3, 0.6), 0),
        new THREE.MeshLambertMaterial({ color: 0x6ac0e8, emissive: 0x1a4a6a, transparent: true, opacity: 0.8 }));
      c.position.set(ox + sideX, rand(0.3, 1.6), rand(-54, 94));
      g.add(c);
    }

    // céu escuro local (teto)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(90, 2, 170), rockMat);
    roof.position.set(ox, 8.8, 20);
    g.add(roof);

    this.group = g;
    G.scene.add(g);
    g.visible = false;
  }

  _collide(x, z, r) {
    G.world.addCollider(DUNGEON_OFFSET + x, z, r);
  }

  _chest(g, x, z, rarity) {
    const chest = P.makeChest(rarity);
    chest.position.set(DUNGEON_OFFSET + x, 0, z);
    g.add(chest);
    const inter = {
      type: 'chest', x: DUNGEON_OFFSET + x, z, y: 0, label: 'Abrir baú', once: true,
      data: { rarity, mesh: chest }, r: 2.4, dungeon: true,
    };
    G.world.interactables.push(inter);
  }

  enter() {
    this.build();
    this.group.visible = true;
    this.active = true;
    // esconde o mundo exterior? não: está a 2000 de distância, fog cobre
    this.musicWas = audio.currentTrack;
    audio.playMusic('dungeon');
    G.story?.fastTravel(DUNGEON_OFFSET, -62);
    G.hud?.toast('🕳️ Você entra na Caverna Sussurrante…');
    audio.sfx('door');
    if (!this.spawned) {
      this.spawned = true;
      // inimigos
      for (let i = 0; i < 5; i++) {
        const e = G.enemies.spawnAt({ type: 'goblinGuerreiro', rank: 'C' }, DUNGEON_OFFSET + rand(-14, 14), rand(-24, 20));
        e.dungeon = true;
      }
      for (let i = 0; i < 4; i++) {
        const e = G.enemies.spawnAt({ type: 'goblinArqueiro', rank: 'C' }, DUNGEON_OFFSET + rand(-18, 18), rand(30, 44));
        e.dungeon = true;
      }
      this.miniBoss = G.enemies.spawnBoss('goblinElite', DUNGEON_OFFSET, 36, 'B');
      this.miniBoss.dungeon = true;
      this.boss = G.enemies.spawnBoss('bossGoblinKing', DUNGEON_OFFSET, 86, 'A');
      this.boss.dungeon = true;
      G.hud?.toast('⚠️ Algo poderoso ronda as profundezas…', true);
    }
    this.bossIntroDone = false;
    // marca objetivo "entrar"
    if (G.quests.activeIds.includes('main_dungeon')) G.quests.onObjectiveFlag('main_dungeon', 'enter');
  }

  exit() {
    this.active = false;
    if (this.group) this.group.visible = false;
    audio.playMusic('exploracao');
    // limpa inimigos da dungeon
    for (const e of [...G.enemies.active]) {
      if (e.dungeon && !e.dead) { e.die?.(); }
    }
  }

  update(dt) {
    if (!this.active) return;
    // luz acompanha o jogador
    if (this.playerLight) {
      const p = G.player.root.position;
      this.playerLight.position.set(p.x, p.y + 2.2, p.z);
    }
    // armadilhas
    const pl = G.player.root.position;
    for (const t of this.traps) {
      t.cd -= dt;
      const d = Math.hypot(pl.x - t.x, pl.z - t.z);
      if (d < 2 && t.armed) {
        t.armed = false;
        t.mesh.visible = true;
        t.cd = 4;
        G.player.takeDamage(14, { pierce: true });
        effects.hit(t.x, 0.5, t.z, 0xcc4444, 10, 0.3);
        audio.sfx('hit');
        G.hud?.hint('⚠️ Armadilha de espinhos! Fique atento ao chão.', 3000);
      } else if (!t.armed && t.cd <= 0 && d > 3.5) {
        t.armed = true;
        t.mesh.visible = false;
      }
    }
    // boss bar + resolução da dungeon
    if (this.boss && !this.boss.dead) {
      G.hud?.showBoss(this.boss.type.name, this.boss.hp / this.boss.maxHp);
      // fases do boss
      if (this.boss.hp < this.boss.maxHp * 0.5 && this.boss.phase === 1) {
        this.boss.phase = 2;
        this.boss.speed *= 1.2;
        this.boss.dmg *= 1.2;
        audio.sfx('bossRoar');
        G.hud?.toast(`${this.boss.type.name} desata a FÚRIA!`, true);
        effects.explosion(this.boss.root.position.x, this.boss.root.position.y + 1, this.boss.root.position.z, 0xff5515, 40, 5);
      }
    } else if (this.boss && this.boss.dead) {
      G.hud?.showBoss(null);
      if (!this._cleared) {
        this._cleared = true;
        G.quests.onObjectiveFlag?.('main_dungeon', 'boss');
        // se quest não ativa, força
        if (!G.quests.doneIds.includes('main_dungeon')) {
          if (!G.quests.activeIds.includes('main_dungeon')) { G.quests.activeIds.push('main_dungeon'); G.quests.progress['main_dungeon'] = { enter: 1, boss: 1 }; }
          G.quests.complete('main_dungeon');
        }
        audio.playMusic('exploracao');
        setTimeout(() => { if (this.active) this.exit(); G.story?.fastTravel(150, 200); }, 4000);
      }
    } else if (this.miniBoss && !this.miniBoss.dead) {
      G.hud?.showBoss(this.miniBoss.type.name, this.miniBoss.hp / this.miniBoss.maxHp);
    } else if (this.miniBoss && this.miniBoss.dead) {
      G.hud?.showBoss(null);
    }
  }
}
