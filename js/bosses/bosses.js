/* =========================================================
 * Aetheria — Bosses: introdução, barra, fases, recompensas
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { clamp, chance } from '../core/utils.js';
import { FX } from '../effects/particles.js';

export class BossManager {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.phase = 1;
    this.introT = 0;
  }

  startBoss(enemy) {
    this.current = enemy;
    this.phase = 1;
    this.introT = 3.2;
    this.game.audio.play('roar', 1);
    this.game.audio.setMood('boss');
    this.game.camera.addShake(0.35);
    this.game.hud.announce(enemy.displayName.toUpperCase(), '⚔️ Um grande desafio se aproxima ⚔️', 3);
    this.game.hud.showBossBar(enemy.displayName);
    FX.fire(this.game.fx, enemy.root.position.clone().add(new THREE.Vector3(0, 1, 0)), true);
  }

  update(dt) {
    const e = this.current;
    if (!e || e.dead) return;
    if (this.introT > 0) {
      this.introT -= dt;
      return;
    }
    // barra de HP
    this.game.hud.setBossBar(clamp(e.hp / e.maxHp, 0, 1));
    // fases: comportamento muda
    const f = e.hp / e.maxHp;
    if (f < 0.6 && this.phase === 1) {
      this.phase = 2;
      this.game.hud.toast(`${e.displayName} se enfurece!`);
      e.speed *= 1.25;
      this.game.audio.play('roar', 0.8);
      FX.fire(this.game.fx, e.root.position.clone().add(new THREE.Vector3(0, 1, 0)), true);
      this.game.fx.ring(e.root.position, { radius: 4, color: 0xff5a20, life: 0.6 });
    }
    if (f < 0.3 && this.phase === 2) {
      this.phase = 3;
      this.game.hud.toast(`${e.displayName} desespera-se — ataque final!`);
      e.speed *= 1.15;
      e.damage *= 1.2;
      e.atkRange += 1;
    }
  }

  endBoss() {
    if (!this.current) return;
    this.game.hud.hideBossBar();
    this.game.hud.announce('VITÓRIA!', 'O desafio foi superado', 2.5);
    this.game.audio.setMood('explore');
    const e = this.current;
    this.current = null;
    // loot adicional garantido
    this.game.inventory.addGold(50);
  }
}
