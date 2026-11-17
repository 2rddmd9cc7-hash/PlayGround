/* =========================================================
 * Aetheria — Grimório físico: flutua, abre, emite partículas
 * + interface de páginas (painel DOM do HUD)
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { ELEMENTS } from '../magic/elements.js';
import { rand, damp, clamp } from '../core/utils.js';

export class Grimoire {
  constructor(game) {
    this.game = game;
    this.visible = false;      // aparece após o Teste do Poder
    this.open = false;         // modo página (G)
    this.openT = 0;            // animação 0..1
    this.dirty = true;

    /* ---- mesh do livro flutuante ---- */
    const g = new THREE.Group();
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.6, metalness: 0.2 });
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.62), coverMat);
    back.position.y = -0.025;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.58), pageMat);
    pages.position.y = 0;
    const coverF = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.62), coverMat.clone());
    coverF.position.set(0, 0.03, 0);
    this.coverFront = coverF;
    // detalhes da capa: canto dourado + olho mágico
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b45a, metalness: 0.8, roughness: 0.3 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gold);
    eye.position.set(0, 0.05, -0.18);
    const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.06), gold);
    corner1.position.set(0.21, 0.015, 0.27);
    const corner2 = corner1.clone(); corner2.position.x = -0.21; corner2.position.z = -0.27;
    const corner3 = corner1.clone(); corner3.position.x = 0.21; corner3.position.z = -0.27;
    const corner4 = corner1.clone(); corner4.position.x = -0.21; corner4.position.z = 0.27;
    // fivela central
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), gold);
    clasp.position.set(0, 0, 0.29);
    g.add(back, pages, coverF, eye, corner1, corner2, corner3, corner4, clasp);
    // símbolo elemental (troca cor com elemento)
    this.symbol = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.9 }));
    this.symbol.position.set(0, 0.09, -0.18);
    g.add(this.symbol);
    g.visible = false;
    g.castShadow = false;
    this.root = g;
    game.scene.add(g);
    this.bobT = 0;
    this._particleT = 0;
  }

  appear() {
    this.visible = true;
    this.root.visible = true;
    this.root.position.copy(this.game.player.root.position).add(new THREE.Vector3(0.7, 1.6, 0.4));
    this.game.audio.play('grimoire');
    this.game.fx.spawn(this.root.position, { count: 24, color: 0xf5d97a, speed: 2, life: 0.9, size: 5, gravity: 1, upBias: 1 });
  }

  setElement(elemId) {
    const el = ELEMENTS[elemId];
    if (!el) return;
    this.symbol.material.color.setHex(el.color);
    if (this.coverFront) {
      this.coverFront.material = this.coverFront.material.clone();
      this.coverFront.material.color.lerp(new THREE.Color(el.color), 0.4);
    }
    this.dirty = true;
  }

  /* magias desbloqueadas por nível (evolui com o grimório) */
  unlockedSpells() {
    const el = ELEMENTS[this.game.player.element];
    if (!el) return [];
    const lvl = this.game.player.level;
    const out = [];
    for (const s of el.spells) {
      const req = this.unlockLevel(s.unlock);
      if (lvl >= req) out.push(s);
    }
    return out;
  }
  unlockLevel(slot) { return [1, 3, 5, 7][slot - 1] || 99; }
  isUnlocked(spell) {
    return this.game.player.level >= this.unlockLevel(spell.unlock);
  }
  checkUnlocks() { this.dirty = true; }

  toggle() {
    if (!this.visible) return;
    this.open = !this.open;
    this.openT = 0;
    this.game.audio.play('page');
    this.game.hud.togglePanel('grimoire', this.open);
    if (this.open) this.game.hud.renderGrimoire();
  }

  update(dt) {
    if (!this.visible) return;
    const player = this.game.player;
    this.bobT += dt;
    if (this.openT < 1 && this.open) this.openT = Math.min(1, this.openT + dt * 2.5);
    if (this.openT > 0 && !this.open) this.openT = Math.max(0, this.openT - dt * 2.5);

    /* posição flutuante ao lado do jogador */
    const target = player.root.position.clone().add(new THREE.Vector3(0.75, 1.55 + Math.sin(this.bobT * 1.8) * 0.08, 0.35));
    this.root.position.lerp(target, 1 - Math.exp(-6 * dt));
    this.root.rotation.y = damp(this.root.rotation.y, player.facing + Math.PI * 0.8, 4, dt);
    /* abertura da capa */
    this.coverFront.rotation.y = -this.openT * 2.2;
    this.coverFront.position.x = -this.openT * 0.02;
    this.coverFront.position.z = this.openT * 0.28;

    /* partículas mágicas reagindo ao elemento */
    const el = ELEMENTS[player.element];
    if (el) {
      this._particleT -= dt;
      if (this._particleT <= 0) {
        this._particleT = rand(0.2, 0.5);
        this.game.fx.spawn(this.root.position.clone().add(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.1, 0.25), rand(-0.3, 0.3))),
          { count: 1, color: el.color, speed: 0.4, life: 1.1, size: 3, alpha: 0.6, upBias: 0.8 });
      }
    }
  }
}
