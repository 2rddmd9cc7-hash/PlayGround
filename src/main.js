import * as THREE from 'three';
import './style.css';
import { CONFIG, ELEMENTS } from './core/config.js';
import { AudioService, SaveService, clamp, random } from './core/services.js';
import { InputController } from './core/input.js';
import { World } from './world/world.js';
import { CameraRig, Player } from './player/player.js';
import { EnemySystem } from './game/enemies.js';
import { GameInterface } from './ui/interface.js';

const fatal = document.querySelector('#fatal-error');
function showFatal(error) {
  console.error('Não foi possível iniciar Crônicas de Aetheria.', error);
  fatal.hidden = false;
  fatal.innerHTML = `<div><h1>Aetheria não conseguiu despertar</h1><p>${error?.message || 'O navegador não conseguiu iniciar a cena 3D.'}<br>Atualize a página ou tente usar um navegador com WebGL habilitado.</p></div>`;
}

class AetheriaGame {
  constructor() {
    this.container = document.querySelector('#game'); this.ui = new GameInterface(document.querySelector('#interface'));
    this.saveService = new SaveService(); this.audio = new AudioService(); this.input = new InputController();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.tabIndex = 0; this.renderer.domElement.setAttribute('aria-label', 'Cena 3D jogável de Crônicas de Aetheria'); this.container.append(this.renderer.domElement);
    this.world = new World(this.renderer); this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, .1, 240);
    this.player = new Player(this.world.scene); this.cameraRig = new CameraRig(this.camera, this.renderer.domElement, this.player.root);
    this.npc = this.makeElder(); this.enemies = new EnemySystem(this.world.scene, amount => this.hurtPlayer(amount));
    this.quest = { stage: 0, kills: 0 };
    this.screen = 'title'; this.wasRunning = false; this.saveClock = 0; this.meleeHit = false; this.lastAlive = 0; this.grimoireOpen = false;
    this.ui.setActionHandler(action => this.handleAction(action));
    this.ui.setScreen('title');
    this.rootAvailable(); this.bindEvents(); this.cameraRig.update(1 / 60);
    window.__aetheriaDebug = this;
    this.clock = new THREE.Clock(); this.renderer.setAnimationLoop(() => this.frame());
  }
  rootAvailable() {
    const button = this.ui.root.querySelector('[data-action="continue"]');
    button.disabled = !this.saveService.load(); button.title = button.disabled ? 'Nenhuma jornada salva ainda.' : 'Continuar a jornada salva';
  }
  makeElder() {
    const root = new THREE.Group(); root.position.set(0, 0, -8); this.world.scene.add(root);
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(.3, .46, 1.25, 8), mat(0x7d6850)); robe.position.y = .79; robe.castShadow = true; root.add(robe);
    const face = new THREE.Mesh(new THREE.SphereGeometry(.27, 10, 8), mat(0xd1a87e)); face.position.y = 1.62; face.castShadow = true; root.add(face);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(.38, .52, 8), mat(0x554838)); hood.position.y = 1.96; hood.castShadow = true; root.add(hood);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(.045, .07, 2.15, 7), mat(0x59432e)); staff.position.set(.49, 1.03, .04); staff.castShadow = true; root.add(staff);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshStandardMaterial({ color: 0xf0cd75, emissive: 0xc8923e, emissiveIntensity: 1.1 })); orb.position.set(.49, 2.19, .04); root.add(orb);
    const light = new THREE.PointLight(0xffcb71, 1.1, 4); light.position.copy(orb.position); root.add(light);
    const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 128; badgeCanvas.height = 128;
    const ctx = badgeCanvas.getContext('2d'); ctx.font = 'bold 100px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4d480'; ctx.shadowColor = '#e59d3a'; ctx.shadowBlur = 20; ctx.fillText('!', 64, 62);
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(badgeCanvas), transparent: true })); badge.position.y = 2.85; badge.scale.set(.65, .65, 1); root.add(badge);
    return { root, badge, orb };
  }
  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.renderer.domElement.addEventListener('pointerdown', event => {
      if (event.button === 0 && this.screen === 'game' && !this.grimoireOpen) this.melee();
    });
    window.addEventListener('keydown', event => {
      if (event.repeat) return;
      if (event.code === 'Escape') { if (this.grimoireOpen) this.toggleGrimoire(false); else if (this.screen === 'game') this.pauseGame(); else if (this.screen === 'pause') this.resumeGame(); }
      if (event.code === 'KeyG' && this.screen === 'game') this.toggleGrimoire();
      if (event.code === 'KeyE' && this.screen === 'game') this.interact();
      if (event.code === 'Space' && this.screen === 'game') this.dodge();
      const slot = Number(event.key) - 1; if (slot >= 0 && slot < 4 && this.screen === 'game') this.cast(slot);
    });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }
  handleAction(action) {
    if (action === 'start') this.startNew();
    else if (action === 'continue') this.continueGame();
    else if (action === 'resume') this.resumeGame();
    else if (action === 'pause') this.pauseGame();
    else if (action === 'home') { this.save(); this.screen = 'title'; this.ui.setScreen('title'); this.wasRunning = false; }
    else if (action === 'grimoire') this.toggleGrimoire();
    else if (action.startsWith('spell:')) this.cast(Number(action.split(':')[1]));
  }
  startNew() {
    this.saveService.clear(); this.player = new Player(this.world.scene); this.cameraRig.target = this.player.root;
    this.player.root.position.set(0, 0, 10); this.quest = { stage: 0, kills: 0 };
    this.enemies.enemies.forEach(enemy => this.world.scene.remove(enemy.root)); this.enemies.enemies = []; this.enemies.active = false; this.enemies.effects.forEach(effect => this.world.scene.remove(effect.mesh)); this.enemies.effects = [];
    this.screen = 'game'; this.grimoireOpen = false; this.ui.setScreen('game'); this.cameraRig.update(1 / 60); this.audio.unlock(); this.audio.play('interact');
    this.ui.toast('A vila de Aetheria aguarda por você. Encontre o ancião!', 4200); this.lastAlive = 0;
  }
  continueGame() {
    const data = this.saveService.load(); if (!data) return this.ui.toast('Nenhuma jornada salva foi encontrada.');
    this.startNew();
    this.player.level = Math.max(1, Number(data.player?.level) || 1); this.player.xp = Math.max(0, Number(data.player?.xp) || 0);
    this.player.gold = Math.max(0, Number(data.player?.gold) || 0); this.player.hp = clamp(Number(data.player?.hp) || this.player.maxHp, 1, this.player.maxHp);
    this.player.maxHp = Math.max(CONFIG.player.maxHp, Number(data.player?.maxHp) || CONFIG.player.maxHp); this.player.hp = clamp(Number(data.player?.hp) || this.player.maxHp, 1, this.player.maxHp);
    this.player.maxMana = Math.max(CONFIG.player.maxMana, Number(data.player?.maxMana) || CONFIG.player.maxMana); this.player.mana = clamp(Number(data.player?.mana) || this.player.maxMana, 0, this.player.maxMana);
    this.player.element = ELEMENTS.some(item => item.id === data.player?.element) ? data.player.element : null; this.player.grimoire = Boolean(data.player?.grimoire);
    this.player.root.position.set(clamp(Number(data.position?.x) || 0, -55, 55), 0, clamp(Number(data.position?.z) || 10, -70, 30));
    this.quest.stage = clamp(Number(data.quest?.stage) || 0, 0, 3); this.quest.kills = clamp(Number(data.quest?.kills) || 0, 0, 3);
    if (this.quest.stage >= 2) { this.enemies.awaken(); for (const [i, enemy] of this.enemies.enemies.entries()) if (i < this.quest.kills) { enemy.alive = false; enemy.root.visible = false; } }
    this.cameraRig.update(1 / 60); this.ui.toast('Sua jornada continua.');
  }
  save() {
    if (this.screen === 'title' && !this.wasRunning) return;
    this.saveService.save({ version: 1, player: { level: this.player.level, xp: this.player.xp, gold: this.player.gold, hp: this.player.hp, maxHp: this.player.maxHp, mana: this.player.mana, maxMana: this.player.maxMana, element: this.player.element, grimoire: this.player.grimoire }, position: { x: this.player.root.position.x, z: this.player.root.position.z }, quest: this.quest });
  }
  pauseGame() { if (this.screen !== 'game') return; this.wasRunning = true; this.screen = 'pause'; this.ui.setScreen('pause'); this.toggleGrimoire(false); this.save(); }
  resumeGame() { if (this.screen !== 'pause') return; this.screen = 'game'; this.ui.setScreen('game'); this.renderer.domElement.focus(); }
  toggleGrimoire(force) {
    if (!this.player.grimoire && force !== false) { this.ui.toast('O grimório ainda está selado.'); return; }
    this.grimoireOpen = force ?? !this.grimoireOpen; this.ui.root.querySelector('#grimoire').classList.toggle('hidden', !this.grimoireOpen);
  }
  cast(slot) {
    if (this.screen !== 'game' || this.grimoireOpen) return;
    if (!this.player.grimoire) { this.ui.toast('Descubra seu elemento para conjurar.'); return; }
    const result = this.enemies.castSpell(slot, this.player, ELEMENTS.find(item => item.id === this.player.element), this.audio);
    if (!result.ok) this.ui.toast(result.reason, 1500);
    else { this.player.selectedSpell = slot; this.syncKills(); }
  }
  melee() {
    if (!this.player.attack()) return;
    this.audio.play('hit'); this.meleeHit = false;
    const facing = { x: Math.sin(this.player.visual.rotation.y), z: Math.cos(this.player.visual.rotation.y) };
    const hit = this.enemies.nearest(this.player.root.position, 2.8, facing, -.35);
    if (hit && this.enemies.damage(hit.enemy, 27)) { this.audio.play('hit'); this.enemies.burst(hit.enemy.root.position, this.player.element ? ELEMENTS.find(e => e.id === this.player.element).color : 0xe7c77f, .8); this.syncKills(); }
  }
  dodge() { if (this.player.dodge()) this.audio.play('dodge'); }
  hurtPlayer(amount) {
    if (!this.player.takeDamage(amount)) return;
    this.audio.play('alarm');
    if (this.player.hp <= 0) {
      this.player.hp = this.player.maxHp; this.player.mana = this.player.maxMana; this.player.gold = Math.max(0, this.player.gold - 8);
      this.player.root.position.set(0, 0, 10); this.ui.toast('Você foi levado de volta à vila. Perdeu 8 moedas; sua jornada continua.', 4000);
    }
  }
  nearestInteraction() {
    const p = this.player.root.position; const npcDistance = Math.hypot(p.x - this.npc.root.position.x, p.z - this.npc.root.position.z);
    if (npcDistance < 3.2) return { type: 'elder', label: this.quest.stage === 0 ? 'Falar com Elian' : 'Conversar com Elian', distance: npcDistance };
    const crystalDistance = Math.hypot(p.x, p.z + 44);
    if (crystalDistance < 3.5) return { type: 'crystal', label: this.quest.stage === 0 ? 'Examinar o cristal' : 'Tocar o cristal', distance: crystalDistance };
    return null;
  }
  interact() {
    const nearby = this.nearestInteraction(); if (!nearby) { this.ui.toast('Não há nada para interagir por perto.', 1300); return; }
    this.audio.play('interact');
    if (nearby.type === 'elder') {
      if (this.quest.stage === 0) { this.quest.stage = 1; this.ui.toast('Elian: “O cristal escolhe quem pode proteger Aetheria. Vá ao castelo e toque sua luz.”', 5200); }
      else this.ui.toast(this.quest.stage >= 3 ? 'Elian: “A vila jamais esquecerá sua coragem.”' : 'Elian: “Siga pela estrada até o cristal, além do portão.”', 3200);
    } else if (this.quest.stage < 1) this.ui.toast('Uma voz ecoa: “Primeiro, ouça o chamado do ancião.”', 3000);
    else if (this.quest.stage === 1) {
      const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]; this.player.element = element.id; this.player.grimoire = true; this.quest.stage = 2;
      this.enemies.awaken(); this.lastAlive = this.enemies.aliveCount; this.audio.play('level');
      this.ui.toast(`O cristal desperta: seu elemento é ${element.name}! O grimório foi aberto.`, 4200);
    } else if (this.quest.stage === 2) this.ui.toast(`O cristal vibra em ${ELEMENTS.find(item => item.id === this.player.element)?.name}. Derrote os goblins da estrada.`, 3000);
    else this.ui.toast('O cristal reconhece o guardião de Aetheria.', 2400);
  }
  syncKills() {
    if (this.quest.stage !== 2) return;
    const alive = this.enemies.aliveCount; const killed = 3 - alive;
    this.quest.kills = Math.max(this.quest.kills, killed);
    if (alive === 0) {
      this.quest.stage = 3; this.player.gold += 75; const levelUp = this.player.gainXp(120);
      this.audio.play('level'); this.ui.toast(levelUp ? 'Aetheria está salva! Você subiu para o nível 2 e recebeu 75 moedas.' : 'Aetheria está salva! Recompensa: 75 moedas e 120 XP.', 4800);
    }
  }
  frame() {
    try {
      const dt = Math.min(this.clock.getDelta(), .05);
      if (this.screen === 'game') {
        this.player.update(dt, this.input, this.cameraRig.yaw, this.world.colliders, { minX: -54, maxX: 54, minZ: -68, maxZ: 28 });
        this.enemies.update(dt, this.player); this.syncKills(); this.cameraRig.update(dt); this.world.update(dt);
        this.npc.badge.position.y = 2.85 + Math.sin(performance.now() * .002) * .09; this.npc.orb.rotation.y += dt;
        this.saveClock += dt; if (this.saveClock > 8) { this.saveClock = 0; this.save(); }
        this.ui.update(this.player, this.questInfo(), this.nearestInteraction(), this.enemies, this.world.clock, dt);
        this.ui.updateToast(dt);
      } else {
        this.world.update(dt * .18); this.cameraRig.update(dt); this.ui.updateToast(dt);
      }
      this.renderer.render(this.world.scene, this.camera);
      this.input.clearFrame();
    } catch (error) { this.renderer.setAnimationLoop(null); showFatal(error); }
  }
  questInfo() {
    if (this.quest.stage === 0) return { objective: 'Encontre Elian, o ancião, na praça da vila.', progress: 'Aproxime-se e pressione E para conversar.' };
    if (this.quest.stage === 1) return { objective: 'Descubra seu elemento no castelo.', progress: 'Siga a estrada ao norte, atravesse o portão e toque o cristal.' };
    if (this.quest.stage === 2) return { objective: 'Derrote os goblins que ameaçam Aetheria.', progress: `${this.quest.kills} / 3 derrotados · Ataque com clique esquerdo ou conjure com 1–4.` };
    return { objective: 'A vila está segura — sua lenda começou.', progress: 'Converse com Elian ou explore os arredores.' };
  }
}

try {
  new AetheriaGame();
} catch (error) { showFatal(error); }
