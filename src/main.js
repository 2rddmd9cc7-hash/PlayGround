// CRÔNICAS DE AETHERIA — bootstrap principal
// Ordem: checagem de ambiente → renderizador → mundo → entidades → loop
import * as THREE from '../vendor/three.module.js';
import { G } from './core/state.js';
import { settings, loadSettings } from './core/config.js';
import { input, initInput, wasPressed, touchPressed, touchHeld } from './core/input.js';
import { clamp, dist2d } from './core/utils.js';
import { audio } from './audio/audio.js';
import { effects } from './effects/effects.js';
import { World, REGIONS } from './world/world.js';
import { Sky } from './world/sky.js';
import { terrainHeight } from './world/terrain.js';
import { Player } from './player/player.js';
import { ThirdPersonCamera } from './player/camera.js';
import { MagicSystem } from './magic/magic.js';
import { EnemyProjectiles } from './magic/projectiles.js';
import { Grimoire } from './grimoire/grimoire.js';
import { EnemyManager } from './enemies/enemy.js';
import { NPCManager } from './npc/npc.js';
import { QuestSystem } from './quests/quests.js';
import { Inventory } from './inventory/inventory.js';
import { Story } from './story/story.js';
import { Dungeon } from './dungeons/dungeon.js';
import { Hud, xpForLevel } from './ui/hud.js';
import { Panels, closeModal, openModal } from './ui/panels.js';
import { hasSave, loadSave, writeSave, deleteSave } from './save/save.js';

const $ = (id) => document.getElementById(id);

// ---------- watchdog / tela de erro ----------
function showError(message, detail = '') {
  const el = $('error-screen');
  if (!el) return;
  el.classList.remove('hidden');
  $('error-message').textContent = message;
  $('error-detail').textContent = String(detail).slice(0, 800);
}
window.addEventListener('error', (e) => {
  if (window.__AETHERIA_READY) return;
  showError('Ocorreu um erro ao iniciar o jogo.', e.message + (e.filename ? `\n${e.filename}:${e.lineno}` : ''));
});
window.addEventListener('unhandledrejection', (e) => {
  if (window.__AETHERIA_READY) return;
  showError('Ocorreu um erro inesperado (promessa).', e.reason?.message || e.reason);
});
// watchdog: se o módulo não marcar pronto em 12s, avisa
setTimeout(() => {
  if (!window.__AETHERIA_READY) {
    showError('O jogo demorou demais para carregar.', 'Verifique sua conexão ou tente recarregar a página.');
  }
}, 12000);
$('error-reload')?.addEventListener('click', () => location.reload());

class Game {
  constructor() {
    this.lastT = 0;
    this.fpsSamples = [];
    this.fps = 60;
    this.autosaveT = 0;
    this.minimapT = 0;
    this.interactTarget = null;
    this.running = false;
  }

  init() {
    loadSettings();
    G.showDamage = settings.showDamage;
    G.mobile = input.isTouch && Math.min(screen.width, screen.height) < 900;

    // renderizador
    const canvas = $('game-canvas');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      showError('Seu navegador não suporta WebGL (necessário para 3D).', e.message);
      return false;
    }
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer = renderer;
    G.renderer = renderer;

    this.scene = new THREE.Scene();
    G.scene = this.scene;

    // entidades
    // câmera única compartilhada
    this.cam = new ThirdPersonCamera(canvas);
    G.camera = this.cam.camera;
    G.camCtl = this.cam;

    G.world = new World().build(this.scene);
    G.sky = new Sky(this.scene);
    G.sky.onThunder = () => audio.sfx('thunder');
    effects.init(this.scene);

    G.player = new Player();
    this.scene.add(G.player.root);
    G.player.world = G.world;
    G.player.root.position.set(0, terrainHeight(0, 8), 8);

    G.magic = new MagicSystem();
    G.projectiles = new EnemyProjectiles();
    G.grimoire = new Grimoire();
    this.scene.add(G.grimoire.group);

    G.enemies = new EnemyManager();
    G.enemies.buildAll(this.scene);
    G.npcs = new NPCManager();
    G.npcs.build(this.scene);
    G.quests = new QuestSystem();
    G.inventory = new Inventory();
    G.inventory.init();
    G.story = new Story();
    G.dungeon = new Dungeon();

    G.hud = new Hud();
    G.ui = new Panels();
    G.hud.init();

    // hooks
    G.recalcStats = () => G.story.recalcStats();
    G.applyQuality = () => this.applyQuality();
    G.saveNow = () => this.save();
    G.backToMenu = () => this.toMenu();

    // resize
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // input hooks
    initInput(canvas, {
      onLeft: () => this.onLeftClick(),
      onRight: () => {},
      onKey: (code) => this.onKey(code),
    });

    // menu
    this.setupMenu();

    window.__AETHERIA_READY = true;
    window.__G = G;
    window.__INPUT = input;
    $('loading-screen').classList.add('hidden');
    $('menu-screen').classList.remove('hidden');
    if (hasSave()) $('btn-continue').classList.remove('disabled');
    $('btn-continue').onclick = () => this.startGame(true);
    this.loop(performance.now());
    return true;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    G.camera.aspect = w / h;
    G.camera.updateProjectionMatrix();
  }

  applyQuality() {
    this.renderer.shadowMap.enabled = settings.shadows;
    G.sky.sun.castShadow = settings.shadows;
    effects.particles.scale = settings.particles;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.renderScale);
  }

  setupMenu() {
    const panel = $('menu-panel');
    document.querySelectorAll('#menu-buttons button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        audio.init();
        audio.resume();
        switch (action) {
          case 'new': this.startGame(false); break;
          case 'continue':
            if (hasSave()) this.startGame(true);
            break;
          case 'settings': this.showMenuPanel('settings'); break;
          case 'controls': this.showMenuPanel('controls'); break;
          case 'credits': this.showMenuPanel('credits'); break;
        }
      });
    });
  }

  showMenuPanel(kind) {
    const panel = $('menu-panel');
    panel.classList.remove('hidden');
    if (kind === 'settings') {
      const el = openModal('');
      el.remove();
      // usa o painel do jogo dentro do menu
      panel.innerHTML = `<h2>⚙️ CONFIGURAÇÕES</h2>
        <div class="row"><label>Sensibilidade da câmera</label><input type="range" id="m-sens" min="0.2" max="2.5" step="0.1" value="${settings.camSensitivity}"></div>
        <div class="row"><label>Distância da câmera</label><input type="range" id="m-dist" min="3" max="14" step="0.5" value="${settings.camDistance}"></div>
        <div class="row"><label>Inverter vertical</label><select id="m-invy"><option value="0" ${!settings.camInvertY ? 'selected' : ''}>Não</option><option value="1" ${settings.camInvertY ? 'selected' : ''}>Sim</option></select></div>
        <div class="row"><label>Sombras</label><select id="m-shadow"><option value="1" ${settings.shadows ? 'selected' : ''}>Ligado</option><option value="0" ${!settings.shadows ? 'selected' : ''}>Desligado</option></select></div>
        <div class="row"><label>Partículas</label><input type="range" id="m-part" min="0.2" max="1.5" step="0.1" value="${settings.particles}"></div>
        <div class="row"><label>Volume geral</label><input type="range" id="m-vol" min="0" max="1" step="0.05" value="${settings.masterVolume}"></div>
        <div class="row"><label>Música</label><input type="range" id="m-mus" min="0" max="1" step="0.05" value="${settings.musicVolume}"></div>
        <div class="row"><label>Efeitos</label><input type="range" id="m-sfx" min="0" max="1" step="0.05" value="${settings.sfxVolume}"></div>
        <button class="close-btn" id="m-done">Fechar</button>`;
      const upd = (id, key, num = true) => {
        panel.querySelector(id).oninput = (e) => { settings[key] = num ? parseFloat(e.target.value) : e.target.value === '1'; };
      };
      upd('#m-sens', 'camSensitivity'); upd('#m-dist', 'camDistance');
      panel.querySelector('#m-invy').onchange = (e) => { settings.camInvertY = e.target.value === '1'; };
      panel.querySelector('#m-shadow').onchange = (e) => { settings.shadows = e.target.value === '1'; G.applyQuality(); };
      upd('#m-part', 'particles');
      upd('#m-vol', 'masterVolume'); upd('#m-mus', 'musicVolume'); upd('#m-sfx', 'sfxVolume');
      panel.querySelector('#m-done').onclick = () => {
        saveSettings(); audio.applyVolumes(); G.applyQuality?.();
        panel.classList.add('hidden'); panel.innerHTML = '';
      };
    } else if (kind === 'controls') {
      panel.innerHTML = `<h2>🎮 CONTROLES</h2>
        <div class="ctl"><b>WASD</b> mover</div>
        <div class="ctl"><b>Shift</b> correr (sprint)</div>
        <div class="ctl"><b>Espaço / C</b> pular / esquiva (aperte C)</div>
        <div class="ctl"><b>Mouse esquerdo</b> atacar (segure = golpe pesado)</div>
        <div class="ctl"><b>Mouse direito</b> girar a câmera</div>
        <div class="ctl"><b>Scroll</b> zoom da câmera</div>
        <div class="ctl"><b>Teclas 1–4</b> magias do elemento</div>
        <div class="ctl"><b>5 / 6</b> poção de vida / mana</div>
        <div class="ctl"><b>Q</b> golpe pesado</div>
        <div class="ctl"><b>E</b> interagir / falar</div>
        <div class="ctl"><b>G</b> grimório</div>
        <div class="ctl"><b>I</b> inventário</div>
        <div class="ctl"><b>M</b> mapa do mundo</div>
        <div class="ctl"><b>P</b> atributos</div>
        <div class="ctl"><b>Esc</b> pausa</div>
        <button class="close-btn" id="m-done">Fechar</button>`;
      panel.querySelector('#m-done').onclick = () => { panel.classList.add('hidden'); panel.innerHTML = ''; };
    } else if (kind === 'credits') {
      panel.innerHTML = `<h2>✨ CRÉDITOS</h2>
        <p class="ctl">CRÔNICAS DE AETHERIA — RPG de fantasia medieval 3D</p>
        <p class="ctl">Renderização: Three.js (WebGL) · Áudio: Web Audio API procedural</p>
        <p class="ctl">Mundo, personagens, magias e história criados proceduralmente para este projeto.</p>
        <p class="ctl">Executa 100% no navegador — sem servidor, sem instalação.</p>
        <button class="close-btn" id="m-done">Fechar</button>`;
      panel.querySelector('#m-done').onclick = () => { panel.classList.add('hidden'); panel.innerHTML = ''; };
    }
  }

  startGame(continuar) {
    audio.init();
    audio.resume();
    // reset do estado dinâmico
    Object.assign(G, {
      level: 1, xp: 0, gold: 50, hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100,
      attrPoints: 0, element: null, spells: {}, chapter: 1, storyFlags: {},
      discovered: [], grimoireLevel: 1, playtime: 0, timeOfDay: 9,
    });
    G.attributes = { forca: 5, defesa: 5, velocidade: 5, mana: 5, poder: 5, resistencia: 5, critico: 5 };
    G.equipment = { weapon: null, armor: null, helmet: null, gloves: null, boots: null, cape: null, accessory: null };
    G.inventory_list = [];
    G.quests = new QuestSystem();
    G.inventory = new Inventory();
    G.inventory.init();
    G.story = new Story();
    G.story.init();

    if (continuar) {
      const save = loadSave();
      if (save) {
        Object.assign(G, {
          level: save.level, xp: save.xp, gold: save.gold, hp: save.hp, mp: save.mp,
          attrPoints: save.attrPoints || 0, element: save.element, spells: save.spells || {},
          chapter: save.chapter, storyFlags: save.storyFlags || {}, discovered: save.discovered || [],
          grimoireLevel: save.grimoireLevel || 1, playtime: save.playtime || 0, timeOfDay: save.timeOfDay ?? 9,
        });
        G.attributes = { ...G.attributes, ...(save.attributes || {}) };
        G.equipment = { ...G.equipment, ...(save.equipment || {}) };
        G.inventory_list = save.inventory_list || [];
        G.quests.restore(save.quests);
        G.playerName = 'Andarilho';
      }
    } else {
      // abertura narrativa
      G.playerName = 'Kael';
    }

    // recriar entidades dinâmicas
    for (const e of [...G.enemies.active]) { G.scene.remove(e.root); }
    G.enemies.active = [];
    if (G.dungeon) { if (G.dungeon.group) G.scene.remove(G.dungeon.group); }
    G.dungeon = new Dungeon();

    G.story.recalcStats();
    G.hp = Math.min(G.hp, G.maxHp);
    G.mp = Math.min(G.mp, G.maxMp);
    if (!continuar || G.hp <= 0) { G.hp = G.maxHp; G.mp = G.maxMp; }

    // posição inicial
    const sp = continuar ? loadSave()?.pos : { x: 0, z: 8 };
    G.player.respawn(sp?.x ?? 0, sp?.z ?? 8);
    if (!continuar) G.player.respawn(0, 8);

    G.player.refreshEquipment();
    if (G.element && G.storyFlags?.testDone) G.grimoire.appear();
    G.grimoire.group.visible = !!G.element;

    // limpar baús abertos do save
    if (continuar) {
      const opened = G.storyFlags.openedChests || [];
      for (const inter of G.world.interactables) {
        if (inter.type === 'chest' && opened.includes(`${inter.x},${inter.z}`)) inter.done = true;
      }
    }

    // UI
    $('menu-screen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (G.mobile) $('touch-ui').classList.remove('hidden');
    G.hud.updateAll();
    G.hud.updateRegion();

    // música inicial
    audio.playMusic('vila');
    if (G.mobile) G.hud.hint('📱 Joystick à esquerda, câmera arrastando à direita, botões à direita.', 8000);
    else G.hud.hint('WASD mover · Botão esquerdo atacar · Botão direito girar câmera · E interagir · G grimório', 9000);

    // primeira conversa com o ancião
    if (!continuar) {
      setTimeout(() => {
        G.ui.startDialog([
          { name: 'Ancião Bram', text: 'Você acordou, Kael. Hoje é um dia importante para Pedravale.' },
          { name: 'Ancião Bram', text: 'Venha até a praça quando estiver pronto. Preciso falar com você sobre o seu destino.' },
        ], null, () => {
          G.quests.offer('main_teste');
          G.hud.hint('Objetivo: converse com o Ancião Bram na praça (marcado no minimapa).');
        });
      }, 1200);
    }
    this.running = true;
  }

  save() {
    try {
      const state = { ...G, quests: G.quests.serialize() };
      state.storyFlags = { ...G.storyFlags, openedChests: this._openedChests() };
      return writeSave(state);
    } catch (e) { console.warn('save', e); return false; }
  }

  _openedChests() {
    return G.world.interactables.filter(i => i.type === 'chest' && i.done).map(i => `${i.x},${i.z}`);
  }

  toMenu() {
    this.save();
    this.running = false;
    $('hud').classList.add('hidden');
    $('touch-ui')?.classList.add('hidden');
    $('menu-screen').classList.remove('hidden');
    if (hasSave()) $('btn-continue').classList.remove('disabled');
    audio.stopMusic();
    closeModal();
  }

  onLeftClick() {
    if (!this.running) return;
    // clicar em diálogo avança (tratado no panel)
    if (!G.paused) {
      G.story.showTutorialHint('attack');
    }
  }

  onKey(code) {
    if (!this.running) {
      return;
    }
    if (G.story.testState) {
      return;
    }
    if (code === 'Escape') {
      if (G.paused) {
        // se há diálogo ativo, encerra-o de verdade (limpa listeners)
        if (G.ui?.dialog) G.ui.endDialog();
        else closeModal();
      }
      else G.ui.openPause();
      return;
    }
    if (G.paused) return;
    switch (code) {
      case 'KeyE': this.tryInteract(); break;
      case 'KeyG':
        if (G.element) { G.grimoire.toggle(); G.story.showTutorialHint('grimoire'); }
        else G.hud.hint('Você ainda não possui um grimório.');
        break;
      case 'KeyI': G.ui.openInventory(); break;
      case 'KeyM': G.ui.openMap(); break;
      case 'KeyP': G.ui.openAttributes(); break;
    }
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;
    const pl = G.player.root.position;
    switch (t.type) {
      case 'npc': {
        const npc = t.npc;
        npc.facePlayer && npc.facePlayer(1);
        G.player.state = 'interact'; G.player.stateT = 0;
        G.ui.npcDialog(npc);
        break;
      }
      case 'chest': {
        if (t.done) { G.hud.hint('Este baú já foi aberto.'); return; }
        t.done = true;
        audio.sfx('chest');
        const rarity = t.data.rarity;
        G.inventory.rollLoot(rarity === 'comum' ? 'E' : rarity === 'incomum' ? 'D' : rarity === 'raro' ? 'C' : rarity === 'epico' ? 'B' : 'A', true);
        const lid = t.data.mesh?.userData.lid;
        if (lid) { lid.rotation.x = -1.2; lid.position.z = 0.15; }
        effects.particles.burst(t.x, t.y + 1, t.z, 20, { r: 1, g: 0.85, b: 0.4, spread: 1.5, up: 2, life: 0.8, size: 0.35 });
        this.save();
        break;
      }
      case 'collect': {
        if (t.done) return;
        t.done = true;
        const item = t.data.item;
        G.inventory.addItem(item, 1);
        G.quests.onCollect(item);
        if (t.data.mesh) t.data.mesh.visible = false;
        audio.sfx('coin');
        // respawn
        setTimeout(() => {
          t.done = false;
          if (t.data.mesh) t.data.mesh.visible = true;
        }, (t.data.respawn || 60) * 1000);
        break;
      }
      case 'crystal': {
        if (G.storyFlags.testDone) { G.hud.hint('O cristal já escolheu seu destino.'); return; }
        const q = G.quests.progress['main_teste'];
        if (!G.quests.activeIds.includes('main_teste')) {
          G.hud.hint('Fale com o Ancião Bram na vila primeiro (ou aceite a missão).');
          return;
        }
        G.story.startCrystalTest();
        break;
      }
      case 'sign': {
        G.hud.hint(t.data.text, 7000);
        break;
      }
      case 'shrine': {
        if (t.done) return;
        t.done = true;
        G.mp = G.maxMp; G.hp = Math.min(G.maxHp, G.hp + 30);
        audio.sfx('crystal');
        effects.particles.burst(t.x, t.y + 1, t.z, 20, { r: 0.5, g: 0.9, b: 1, spread: 2, up: 2, life: 1, size: 0.4 });
        G.hud.toast('🛖 O altar antigo restaura suas forças!');
        break;
      }
      case 'fishing': {
        if (t.done) return;
        t.done = true;
        setTimeout(() => (t.done = false), 3000);
        const roll = Math.random();
        if (roll < 0.3) { G.inventory.addItem('erva', 1); G.hud.toast('🎣 Pescou… uma erva?!'); }
        else if (roll < 0.6) { G.gold += 5; audio.sfx('coin'); G.hud.toast('🎣 Pescou 5 🪙 de moedas antigas.'); }
        else if (roll < 0.9) G.hud.toast('🎣 Só… água.');
        else { G.inventory.addItem('pocao_mana', 1); G.hud.toast('🎣 Um frasco lacrado veio à tona!'); }
        break;
      }
      case 'farm': break;
      case 'dungeon': {
        G.dungeon.enter();
        break;
      }
      case 'dungeonExit': {
        G.dungeon.exit();
        G.story.fastTravel(150, 200);
        break;
      }
    }
    G.hud.showInteract(null);
    this.interactTarget = null;
  }

  // ---------- loop ----------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dtRaw = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = clamp(dtRaw, 0.001, 0.05); // estabilidade: nunca pular demais
    if (!this.running) {
      // renderiza fundo do menu
      this.renderer.render(this.scene, G.camera);
      return;
    }
    if (dtRaw > 0.0001 && dtRaw < 2) {
      this.fpsSamples.push(1 / dtRaw);
      if (this.fpsSamples.length > 60) this.fpsSamples.shift();
      this.fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    }
    const paused = G.paused;

    G.playtime += dt;

    // cinemática do teste tem prioridade
    if (G.story.testState) {
      G.story.updateTestCinematic(dt);
      effects.update(dt);
      this.renderer.render(this.scene, G.camera);
      input.consume();
      return;
    }

    if (!paused) {
      // jogador
      G.player.update(dt, G.camera);
      // câmera
      this.cam.update(dt, G.player);
      // mundo
      G.sky.update(dt, G.player.root.position);
      G.world.update(dt, G.player.root.position);
      // entidades
      G.npcs.update(dt, G.player.root.position);
      G.enemies.update(dt, G.player.root.position);
      G.magic.update(dt, G.camera);
      G.projectiles.update(dt);
      G.grimoire.update(dt, G.player);
      G.dungeon.update(dt);
      effects.update(dt);

      // invasão
      G.story.updateInvasion(dt);
      // arco final: spaw de Morgath por proximidade
      G.story.updateFinal(dt);

      // stamina regen natural extra
      // (já feita no player)

      // música por contexto
      this.updateMusic(dt);

      // interações próximas
      this.updateInteract();

      // HUD
      this.hudT = (this.hudT || 0) + dt;
      if (this.hudT > 0.15) {
        this.hudT = 0;
        G.hud.updateAll();
        G.hud.updateRegion();
      }
      this.minimapT += dt;
      if (this.minimapT > 0.2) { this.minimapT = 0; G.hud.drawMinimap(); }

      // autosave
      this.autosaveT += dt;
      if (this.autosaveT > 45 && settings.autosave) {
        this.autosaveT = 0;
        this.save();
      }

      // toques mobile extras
      if (touchPressed('map')) G.ui.openMap();
      if (touchPressed('grimoire')) G.grimoire.toggle();
      if (touchPressed('interact')) this.tryInteract();
    }

    // boss bar genérico (invasão é cuidada lá; dungeon na dungeon)
    if (!G.story.invasionState && !G.dungeon.active) {
      // boss por região? nenhum ativo → esconde se sobrou de estado
    }

    this.renderer.render(this.scene, G.camera);
    input.consume();
  }

  updateMusic(dt) {
    // decai agressividade
    G.combatMusic = Math.max(0, G.combatMusic - dt);
    const enemiesNear = G.enemies.active.some(e => !e.dead &&
      Math.hypot(e.root.position.x - G.player.root.position.x, e.root.position.z - G.player.root.position.z) < 18);
    if (G.combatMusic > 0 || (enemiesNear && G.story.invasionState)) {
      audio.playMusic(G.story.invasionState ? 'invasao' : 'combate');
      return;
    }
    if (G.dungeon.active) { audio.playMusic(G.dungeon.boss && !G.dungeon.boss.dead && Math.hypot(G.dungeon.boss.root.position.x - G.player.root.position.x, G.dungeon.boss.root.position.z - G.player.root.position.z) < 30 ? 'boss' : 'dungeon'); return; }
    const region = G.world.regionAt(G.player.root.position.x, G.player.root.position.z);
    if (region && (region.id === 'vila')) { audio.playMusic('vila'); return; }
    if (region && region.id === 'cidade') { audio.playMusic('cidade'); return; }
    audio.playMusic('exploracao');
  }

  updateInteract() {
    const pl = G.player.root.position;
    let best = null, bestD = 3.2;
    const all = [
      ...G.world.interactables.map(i => ({ ...i, _x: i.x, _z: i.z })),
      ...G.npcs.interactables.map(i => ({ ...i, _x: i.npc.root.position.x, _z: i.npc.root.position.z })),
    ];
    for (const t of all) {
      if (t.done && t.once) continue;
      if (t.type === 'crystal' && G.storyFlags.testDone) continue;
      const d = dist2d(pl.x, pl.z, t._x ?? t.x, t._z ?? t.z);
      const r = t.r || 2.6;
      if (d < r && d < bestD + 0.5) {
        // prioridade: interações menores primeiro se mais próximas
        if (!best || d < bestD) { best = t; bestD = d; }
      }
    }
    // entrada da caverna
    if (Math.hypot(pl.x - 150, pl.z - 200) < 6 && !G.dungeon.active) {
      best = { type: 'dungeon', label: 'Entrar na caverna' };
    }
    if (G.dungeon.active && Math.hypot(pl.x - 2000, pl.z - -60) < 5) {
      best = { type: 'dungeonExit', label: 'Sair da caverna' };
    }
    this.interactTarget = best;
    if (best && !G.paused) {
      G.hud.showInteract(`${G.mobile ? '💬' : 'E'} — ${best.label}`);
    } else {
      G.hud.showInteract(null);
    }
  }
}

// toques de teclado: C = esquiva (redundante com espaço)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && G.paused) e.preventDefault();
});

// ---------- start ----------
const game = new Game();
if (game.init()) {
  window.__GAME = game;
}
