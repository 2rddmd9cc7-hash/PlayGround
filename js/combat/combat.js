/* =========================================================
 * Aetheria — Combate em tempo real
 * dano físico/elemental, crítico, knockback, stagger, lock-on
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, chance, clamp } from '../core/utils.js';
import { ELEMENTS } from '../magic/elements.js';
import { FX } from '../effects/particles.js';

export class Combat {
  constructor(game) { this.game = game; }

  /* ---------- jogador → inimigo ---------- */
  startMelee(player) {
    if (player.stamina < 8) { this.game.hud.toast('Sem vigor para atacar!'); return; }
    player.stamina -= 8;
    if (player.comboWindow > 0) player.comboIdx = (player.comboIdx + 1) % 3;
    else player.comboIdx = 0;
    player.comboWindow = 0.9;
    player.attackDuration = player.comboIdx === 2 ? 0.62 : 0.42;
    player.attackTimer = player.attackDuration;
    player.attackHitDone = false;
    player.setState('attack');
    this.game.audio.play('swing', 0.8);
  }

  meleeHit(player, comboIdx) {
    const heavy = comboIdx === 2;
    const reach = 2.4, arc = 1.15; // rad
    const pos = player.root.position;
    const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    let hitAny = false;
    for (const e of this.game.enemies.list) {
      if (e.dead) continue;
      const to = e.root.position.clone().sub(pos);
      const d = to.length();
      if (d > reach + e.hitRadius) continue;
      to.normalize();
      if (to.dot(fwd) < Math.cos(arc)) continue;
      hitAny = true;
      this.hitEnemy(e, {
        dmg: player.attackDamage * (heavy ? 1.9 : 1),
        knock: heavy ? 7 : 3.5,
        from: pos,
        heavy
      });
    }
    if (hitAny) this.game.audio.play('sword', 0.9);
    else this.game.audio.play('swing', 0.6);
  }

  hitEnemy(enemy, o = {}) {
    if (enemy.dead) return;
    const game = this.game;
    const player = game.player;
    const isCrit = chance(clamp(player.critChance, 0, 0.6));
    let dmg = o.dmg ?? 10;
    if (isCrit) dmg *= player.critMult;
    dmg *= rand(0.92, 1.08);
    dmg = Math.max(1, dmg - enemy.defense);
    enemy.hp -= dmg;
    enemy.lastHitT = 0;
    enemy.hitFlash();
    // knockback
    if (o.from && (o.knock || 0) > 0) {
      const dir = enemy.root.position.clone().sub(o.from).setY(0).normalize();
      enemy.knockback(o.from, o.knock);
    }
    if (o.stun) enemy.applyStun(o.stun);
    if (o.slow) enemy.applySlow(o.slow, 2);
    // número de dano
    game.hud.damageNumber(enemy.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), Math.round(dmg), isCrit ? 'crit' : 'enemy', isCrit);
    // elementos: efeito visual próprio
    if (o.element) FX[o.element]?.(game.fx, enemy.root.position.clone().add(new THREE.Vector3(0, 1, 0)), false);
    else game.fx.spawn(enemy.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 6, color: 0xffd0a0, speed: 3, life: 0.25, size: 4 });
    game.audio.playAt(isCrit ? 'crit' : 'hit', 0.8, game.camera.cam.position.distanceTo(enemy.root.position), 50);
    if (isCrit) game.camera.addShake(0.1);
    // aggro
    enemy.alertTo(player.root.position);
    if (enemy.hp <= 0) enemy.kill();
    else {
      // stagger em golpes pesados
      if (o.heavy && !enemy.isBoss) enemy.applyStun(0.5);
    }
  }

  /* ---------- inimigo → jogador ---------- */
  damagePlayer(dmg, fromPos, opts = {}) {
    const game = this.game, player = game.player;
    if (player.dead) return;
    if (player.iframes > 0) return;
    if (player.blocking) {
      // parry: primeiros 0.28s do bloqueio
      if (player.blockT < 0.28) {
        game.audio.play('block', 1);
        game.hud.toast('⚡ Parry!');
        game.fx.spawn(player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 10, color: 0xffe880, speed: 4, life: 0.3, size: 4 });
        if (opts.attacker && !opts.attacker.isBoss) opts.attacker.applyStun(1.1);
        return;
      }
      dmg *= 0.3;
      game.audio.play('block', 0.8);
      game.fx.spawn(player.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), { count: 6, color: 0xd0d0d0, speed: 3, life: 0.25, size: 3 });
    }
    const final = Math.max(1, Math.round(dmg - player.defense * 0.55));
    player.hp -= final;
    player.hurt(final, fromPos);
    game.hud.damageNumber(player.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), final, 'player');
    if (player.hp <= 0) {
      player.hp = 0;
      player.die();
      game.hud.announce('VOCÊ CAIU…', 'A vila te encontrou e trouxe de volta', 2.5);
    }
  }

  /* ---------- lock-on ---------- */
  toggleLock() {
    const game = this.game, player = game.player;
    if (player.lockTarget) { player.lockTarget = null; game.hud.toast('Alvo destravado'); return; }
    let best = null, bd = 26 * 26;
    const fwd = game.camera.aimDir(new THREE.Vector3());
    for (const e of game.enemies.list) {
      if (e.dead) continue;
      const to = e.root.position.clone().sub(player.root.position);
      const d2 = to.lengthSq();
      if (d2 > bd) continue;
      if (to.normalize().dot(fwd) < 0.3) continue;
      bd = d2; best = e;
    }
    if (best) { player.lockTarget = best; game.hud.toast('Alvo: ' + best.displayName); }
    else game.hud.toast('Nenhum alvo próximo');
  }

  updateLock(dt) {
    const player = this.game.player;
    if (player.lockTarget && !player.lockTarget.dead && !player.dead) {
      // face suave
      const t = player.lockTarget.root.position.clone().sub(player.root.position);
      player.targetFacing = Math.atan2(t.x, t.z);
    }
  }
}
