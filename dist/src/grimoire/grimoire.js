// Grimório físico — livro flutuante ao lado do jogador + painel de magias
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { ELEMENTS, allSpellDefs } from '../magic/elements.js';
import { wasPressed } from '../core/input.js';
import { audio } from '../audio/audio.js';
import { effects, ELEMENT_COLORS } from '../effects/effects.js';
import { rand, clamp } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

const MAT = {
  cover: new THREE.MeshLambertMaterial({ color: 0x4a2a52 }),
  coverDark: new THREE.MeshLambertMaterial({ color: 0x2a1430 }),
  page: new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }),
  runeGold: new THREE.MeshLambertMaterial({ color: 0xe8c26a, emissive: 0x6a4a10 }),
  clasp: new THREE.MeshLambertMaterial({ color: 0xb8a24a }),
};

export class Grimoire {
  constructor() {
    this.group = new THREE.Group();
    this.visible = false;
    this.uiOpen = false;
    this.pageOpen = 0;        // 0..1 abertura física
    this.targetOpen = 0;
    this.flipT = 0;
    this.spin = 0;
    this.build();
  }

  build() {
    const g = this.group;
    // capa traseira
    this.backCover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.03), MAT.coverDark);
    this.backCover.position.z = -0.02;
    g.add(this.backCover);
    // lombada
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.05), MAT.cover);
    g.add(spine);
    // páginas (monte)
    const pageStack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 0.035), MAT.page);
    pageStack.position.z = 0.02;
    g.add(pageStack);
    // capa frontal (giratória)
    this.frontCover = new THREE.Group();
    const fc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.025), MAT.cover);
    fc.position.z = 0.0125;
    this.frontCover.add(fc);
    // gema do elemento
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), MAT.runeGold.clone());
    this.gem.position.set(0, 0.08, 0.03);
    this.frontCover.add(this.gem);
    // cantoneiras
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), MAT.clasp);
      c.position.set(sx * 0.15, sy * 0.22, 0.02);
      this.frontCover.add(c);
    }
    this.frontCover.position.z = 0.038;
    g.add(this.frontCover);
    g.visible = false;
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  appear() {
    this.visible = true;
    this.group.visible = true;
    this.group.scale.setScalar(0.01);
    this._appearT = 0;
    audio.sfx('grimoire');
  }

  toggle() {
    if (!this.visible) { G.hud?.hint('Você ainda não possui um grimório.'); return; }
    this.uiOpen = !this.uiOpen;
    this.targetOpen = this.uiOpen ? 1 : 0;
    audio.sfx(this.uiOpen ? 'grimoire' : 'pageFlip');
    if (this.uiOpen) {
      G.ui?.openGrimoire();
    } else {
      G.ui?.closeGrimoire();
    }
  }

  refresh() { if (this.uiOpen) G.ui?.openGrimoire(); }

  update(dt, player) {
    if (!this.visible) return;
    // surgir
    if (this._appearT < 1) {
      this._appearT = Math.min(1, (this._appearT ?? 0) + dt * 1.4);
      const s = 0.01 + (1 - Math.pow(1 - this._appearT, 3)) * 0.99;
      this.group.scale.setScalar(s);
    }
    this.spin += dt;
    // abertura física
    this.pageOpen += (this.targetOpen - this.pageOpen) * Math.min(1, dt * 8);
    this.frontCover.rotation.y = -this.pageOpen * Math.PI * 0.85;
    // flutuar ao lado do jogador
    const p = player.root.position;
    const bob = Math.sin(this.spin * 2) * 0.06;
    const side = Math.sin(player.yaw) * -0.8, sideZ = Math.cos(player.yaw) * -0.8;
    const tx = p.x + side, tz = p.z + sideZ;
    const ty = terrainHeight(tx, tz) + 1.35 + bob;
    this.group.position.x += (tx - this.group.position.x) * Math.min(1, dt * 6);
    this.group.position.y += (ty - this.group.position.y) * Math.min(1, dt * 6);
    this.group.position.z += (tz - this.group.position.z) * Math.min(1, dt * 6);
    // rotacionar para encarar levemente o jogador
    const faceYaw = Math.atan2(p.x - tx, p.z - tz);
    this.group.rotation.y += (faceYaw - this.group.rotation.y) * Math.min(1, dt * 4);
    this.group.rotation.z = Math.sin(this.spin * 1.3) * 0.08;
    // brilho da gema conforme elemento
    if (G.element) {
      const c = ELEMENT_COLORS[G.element];
      this.gem.material.emissive.setRGB(c.r * 0.8, c.g * 0.8, c.b * 0.8);
      const pulse = 0.7 + 0.3 * Math.sin(this.spin * 3);
      this.gem.scale.setScalar(1 + pulse * 0.3);
    }
    // partículas
    if (Math.random() < dt * 6) {
      const c = G.element ? ELEMENT_COLORS[G.element] : { r: 0.9, g: 0.8, b: 0.5 };
      effects.particles.emit({
        x: this.group.position.x + rand(-0.2, 0.2), y: this.group.position.y + rand(-0.25, 0.3), z: this.group.position.z + rand(-0.15, 0.15),
        vy: 0.5, life: 0.8, size: 0.15, r: c.r, g: c.g, b: c.b, drag: 0.97,
      });
    }
  }

  // desbloqueia magias conforme nível
  checkUnlocks() {
    if (!G.element) return;
    let changed = false;
    for (const spell of allSpellDefs(G.element)) {
      if (!G.spells[spell.id] && G.level >= spell.unlock) {
        G.spells[spell.id] = { level: 1, uses: 0 };
        changed = true;
        G.hud?.toast(`📖 Nova magia desbloqueada: ${spell.name}!`, true);
        G.hud?.hint(`Nova página do grimório: ${spell.name} (tecla ${allSpellDefs(G.element).indexOf(spell) + 1})`);
        audio.sfx('quest');
      }
    }
    if (changed) this.refresh();
  }

  spellLevelBonus() { return 1 + (G.grimoireLevel - 1) * 0.1; }
}
