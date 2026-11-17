/* =========================================================
 * Aetheria — Orquestrador principal (Game)
 * ========================================================= */
import * as THREE from '../vendor/three.module.js';
import { clamp, rand, randi, pick, chance, dist, damp } from './core/utils.js';
import { Input } from './core/input.js';
import { CameraCtl } from './core/camera.js';
import { AudioSys } from './audio/audio.js';
import { Particles } from './effects/particles.js';
import { World, REGIONS, DUNGEON_C, CAVE_ENTRANCE } from './world/world.js';
import { DayNight } from './world/daynight.js';
import { Player } from './player/player.js';
import { Combat } from './combat/combat.js';
import { EnemyManager } from './enemies/enemies.js';
import { NPCManager } from './npc/npcs.js';
import { Grimoire } from './grimoire/grimoire.js';
import { Inventory, LootManager, ITEMS, SHOPS } from './inventory/inventory.js';
import { QuestManager } from './quests/quests.js';
import { Story, CHAPTERS } from './story/story.js';
import { BossManager } from './bosses/bosses.js';
import { HUD } from './ui/hud.js';
import { SaveSystem } from './save/save.js';
import { SpellCaster } from './magic/spells.js';

export class Game {
  constructor(_THREE, prog) {
    this.THREE = THREE;
    this.prog = prog;

    /* ---------- renderizador ---------- */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const persp = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
    this.camCtl = new CameraCtl(persp);
    this.camera = this.camCtl;      // game.camera = controlador (yaw, aimDir, cam)
    persp.position.set(0, 8, 14);

    addEventListener('resize', () => {
      persp.aspect = innerWidth / innerHeight;
      persp.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    /* ---------- configurações ---------- */
    this.settings = { music: 55, sfx: 70, sens: 100, camdist: 75, cammax: 140, invert: false, shadows: 2, particles: 2, fps: true };
    this.paused = true;
    this.playing = false;
    this.clock = new THREE.Clock();
    this.autosaveT = 30;

    /* ---------- sistemas ---------- */
    this.input = new Input();
    this.audio = new AudioSys();
    this.fx = new Particles(this.scene);
    this.world = new World(this.scene);
    this.daynight = new DayNight(this.scene);
    this.player = new Player(this);
    this.player.recalc();
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.npcs = new NPCManager(this);
    this.grimoire = new Grimoire(this);
    this.inventory = new Inventory(this);
    this.loot = new LootManager(this);
    this.quests = new QuestManager(this);
    this.story = new Story(this);
    this.bosses = new BossManager(this);
    this.hud = new HUD(this);
    this.save = new SaveSystem(this);

    /* filas de magia/projéteis */
    this.spellProjectiles = [];
    this.enemyProjectiles = [];
    this.effectQueue = [];
    this.cityGatePos = { x: 0, z: -195 };

    this._scanT = 0;
    this._regionT = 0;
    this._eventT = rand(50, 100);
    this._lastT = performance.now();
    this.errShown = false;

    this.setupInteractables();
    this.setupSpawnZones();

    prog && prog(90, 'Acordando os sistemas…');
    this.loop();
  }

  /* ================= INTERAÇÕES DO MUNDO ================= */
  setupInteractables() {
    const w = this.world;
    // cristal do castelo
    w.interactables.push({
      pos: w.crystalPos.clone(), r: 3,
      label: 'Colocar a mão no cristal', icon: '🔮',
      action: () => this.story.onCrystalInteract(),
      enabled: () => true
    });
    // fonte da vila
    w.interactables.push({
      pos: new THREE.Vector3(0, w.fountainPos.y, 0), r: 3.4,
      label: 'Descansar na fonte', icon: '⛲',
      action: () => {
        this.player.hp = this.player.maxHp;
        this.player.mana = this.player.maxMana;
        this.audio.play('heal');
        this.hud.toast('Você descansou na fonte. ❤️💚');
      },
      cd: 30
    });
    // baús
    for (const chest of w.chests) {
      w.interactables.push({
        pos: chest.pos.clone(), r: 2.4,
        label: () => chest.opened ? 'Baú vazio' : 'Abrir baú', icon: '🎁',
        action: () => {
          if (chest.opened) return;
          chest.opened = true;
          this.audio.play('chest');
          if (chest.lid) chest.lid.rotation.x = -1.1;
          this.fx.spawn(chest.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 18, color: 0xf5d97a, speed: 2.5, life: 0.8, size: 5, gravity: 2 });
          // conteúdo por região
          const n = randi(1, 3);
          for (let i = 0; i < n; i++) {
            const roll = Math.random();
            let id = 'potion_hp';
            if (roll > 0.7) id = pick(['sword_iron', 'helm_iron', 'chest_chain', 'amulet_mana', 'boots_swift']);
            else if (roll > 0.45) id = 'potion_mp';
            else if (roll > 0.3) id = pick(['mat_ore', 'mat_crystal', 'mat_herb']);
            this.loot.spawnPickup(id, chest.pos, this);
          }
          const gold = randi(15, 60);
          this.inventory.addGold(gold);
          this.hud.toast(`Baú aberto! +${gold} 🪙`);
          this.fx.ring(chest.pos, { radius: 1.5, color: 0xf5d97a, life: 0.5 });
        }
      });
    }
    // ervas
    for (const herb of w.herbs) {
      w.interactables.push({
        pos: herb.pos.clone(), r: 2,
        label: 'Coletar Erva Curativa', icon: '🌿',
        action: () => {
          if (herb.taken) return;
          herb.taken = true;
          herb.mesh.visible = false;
          this.inventory.addItem('mat_herb');
          this.audio.play('potion', 0.6);
          this.fx.spawn(herb.pos, { count: 8, color: 0x6ae08a, speed: 1.5, life: 0.5, size: 4, upBias: 1 });
        }
      });
    }
    // entrada da caverna (masmorra)
    w.interactables.push({
      pos: new THREE.Vector3(CAVE_ENTRANCE.x, w.terrainHeight(CAVE_ENTRANCE.x, CAVE_ENTRANCE.z) + 2, CAVE_ENTRANCE.z), r: 4,
      label: 'Entrar na Caverna de Umbra', icon: '🕳️',
      action: () => {
        const p = this.player.root.position;
        p.set(DUNGEON_C.x, this.world.terrainHeight(DUNGEON_C.x, DUNGEON_C.z - 30) + 0.2, DUNGEON_C.z - 30);
        this.fx.ring(p, { radius: 2, color: 0x8a5aff, life: 0.6 });
        this.audio.play('door');
        this.hud.toast('Você adentra a escuridão da caverna… 🕯️');
        this.audio.setMood('dungeon');
        // o Rei desperta
        if (!this._dungeonBossSpawned) {
          this._dungeonBossSpawned = true;
          setTimeout(() => {
            const king = this.enemies.spawn('goblinKing', DUNGEON_C.x, DUNGEON_C.z, { bossBar: true });
            this.hud.tutorial('O Rei Goblin Gronnak desperta! <b>Esquive (Espaço)</b> dos golpes pesados e castigue com magia.', 7);
          }, 2500);
        }
      }
    });
    // saída da caverna
    w.interactables.push({
      pos: new THREE.Vector3(DUNGEON_C.x, 4, DUNGEON_C.z - 30), r: 4,
      label: 'Sair da caverna', icon: '🌅',
      action: () => {
        const p = this.player.root.position;
        p.set(CAVE_ENTRANCE.x + 3, this.world.terrainHeight(CAVE_ENTRANCE.x + 3, CAVE_ENTRANCE.z) + 0.2, CAVE_ENTRANCE.z + 3);
        this.audio.play('door');
      }
    });
  }

  setupSpawnZones() {
    const E = this.enemies;
    E.addZone({ x: 170, z: 170, r: 42, max: 5, interval: 7, activeRange: 130, type: () => pick(['goblin', 'goblin', 'goblinWarrior', 'goblinArcher']), ranks: ['E', 'E', 'D'] });
    E.addZone({ x: 260, z: -60, r: 70, max: 5, interval: 9, activeRange: 130, type: 'wolf' });
    E.addZone({ x: 400, z: 240, r: 60, max: 5, interval: 9, activeRange: 130, type: 'slime' });
    E.addZone({ x: -280, z: 40, r: 50, max: 4, interval: 12, activeRange: 130, type: 'skeleton' });
    E.addZone({ x: -380, z: -220, r: 70, max: 4, interval: 10, activeRange: 130, type: 'wolf', ranks: ['E', 'D'] });
    E.addZone({ x: -400, z: 280, r: 60, max: 4, interval: 12, activeRange: 130, type: 'slime', ranks: ['D', 'C'] });
    E.addZone({ x: 500, z: -320, r: 80, max: 6, interval: 8, activeRange: 140, type: () => pick(['goblinWarrior', 'goblinElite', 'goblinMage']), ranks: ['C', 'B', 'B'] });
    E.addZone({ x: -140, z: -430, r: 80, max: 4, interval: 10, activeRange: 130, type: 'wolf', ranks: ['D', 'C'] });
  }

  /* ================= INÍCIO ================= */
  startGame(load) {
    this.playing = true;
    this.paused = false;
    this.audio.ensure();
    this.audio.setVolumes(this.settings.music / 100, this.settings.sfx / 100);
    if (load) {
      const ok = this.save.loadGame();
      if (!ok) this.hud.toast('Save não encontrado — iniciando novo jogo.');
    }
    this.hud.hideMainMenu();
    this.hud.refreshGold();
    this.hud.refreshHotbar();
    this.hud.showMobileUI(this.input.isTouch);
    this.camCtl.targetDist = this.settings.camdist / 10;
    this.camCtl.sensitivity = this.settings.sens / 100;
    this.camCtl.invertY = this.settings.invert;
    this.camCtl.maxDist = this.settings.cammax / 10;
    this.daynight.setShadowQuality(this.settings.shadows);
    if (!load) {
      this.inventory.addStarter();
      this.story.start();
      this.save.saveGame();
    } else {
      this.hud.announce('BEM-VINDO DE VOLTA', CHAPTERS[Math.min(this.story.chapter, CHAPTERS.length - 1)], 3);
    }
  }

  /* ================= LOOP ================= */
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    let dt = (now - this._lastT) / 1000;
    this._lastT = now;
    dt = clamp(dt, 0, 0.05);

    try {
      if (this.playing && !this.paused && !this.errShown) {
        this.update(dt);
      }
      this.renderer.render(this.scene, this.camCtl.cam);
    } catch (err) {
      console.error('Erro no loop do jogo:', err);
      this.showError(err);
    }
    this.input.endFrame();
  }

  update(dt) {
    const p = this.player;

    /* câmera sempre responde */
    this.camCtl.update(dt, this);

    /* teclas de interface */
    if (this.input.wasPressed('Escape')) {
      if (this.hud.isDialogOpen()) this.hud.closeDialog();
      else if (this.hud.isPanelOpen()) this.hud.closeAllPanels();
      else this.hud.togglePause(true);
    }
    if (this.input.wasPressed('KeyG') && this.grimoire.visible) this.grimoire.toggle();
    if (this.input.wasPressed('KeyI')) this.hud.togglePanel('inventory');
    if (this.input.wasPressed('KeyM')) this.hud.togglePanel('map');
    if (this.input.wasPressed('KeyJ')) this.hud.togglePanel('quests');

    /* mundo */
    this.daynight.update(dt, this);
    this.world.update(dt, this.daynight.isNight, this);

    /* jogador + combate */
    p.update(dt, this.input);
    this.combat.updateLock(dt);

    /* inimigos / NPCs */
    this.enemies.update(dt);
    this.npcs.update(dt);

    /* magias */
    for (let i = this.spellProjectiles.length - 1; i >= 0; i--) {
      const pr = this.spellProjectiles[i];
      pr.update(dt, this);
      if (pr.dead) this.spellProjectiles.splice(i, 1);
    }
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const pr = this.enemyProjectiles[i];
      pr.update(dt, this);
      if (pr.dead) this.enemyProjectiles.splice(i, 1);
    }
    SpellCaster.updateEffects(dt, this);
    this.fx.update(dt);
    this.grimoire.update(dt);
    this.bosses.update(dt);
    this.loot.update(dt);
    this.story.update(dt);

    /* interação — verifica a cada frame (a tecla E é consumida em 1 frame;
       se fosse limitada por throttle, a maioria dos pressionamentos se perderia) */
    this.scanInteraction(dt);
    this._regionT -= dt;
    if (this._regionT <= 0) {
      this._regionT = 0.5;
      this.scanRegions();
    }

    /* eventos aleatórios */
    this._eventT -= dt;
    if (this._eventT <= 0) {
      this._eventT = rand(70, 140);
      this.randomEvent();
    }

    /* HUD */
    this.hud.update(dt);
    this.hud.refreshGold();

    /* música */
    this.audio.updateMusic();

    /* autosave */
    this.autosaveT -= dt;
    if (this.autosaveT <= 0) {
      this.autosaveT = 30;
      this.save.saveGame();
    }
  }

  /* ================= INTERAÇÃO ================= */
  scanInteraction(dt) {
    const p = this.player;
    if (p.dead) { this.hud.hideInteract(); return; }
    const pp = p.root.position;

    // NPC mais próximo
    const npc = this.npcs.nearest(pp, 3.4);
    let best = null, bestLabel = '', bestAction = null, bestIcon = '';
    if (npc) {
      best = { type: 'npc', npc };
      bestLabel = `Falar com ${npc.name}`;
      bestAction = () => this.talkToNPC(npc);
      bestIcon = '💬';
    }
    // interativos do mundo
    for (const it of this.world.interactables) {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      if (label === 'Baú vazio') continue;
      const d = dist(pp.x, pp.z, it.pos.x, it.pos.z);
      if (d < (it.r || 2.5) && d < (best ? 3.4 : 99)) {
        if (it.cd && (it._cdT || 0) > 0) continue;
        best = { type: 'world', it };
        bestLabel = label;
        bestAction = () => {
          if (it.cd) it._cdT = it.cd;
          it.action(this);
        };
        bestIcon = it.icon || '✋';
      }
    }
    // ervas tomadas
    if (best && best.type === 'world' && best.it.label === 'Coletar Erva Curativa') {
      const herb = this.world.herbs.find(h => h.pos === best.it.pos);
      if (herb && herb.taken) { best = null; }
    }

    if (best) {
      this.hud.showInteract(`${bestIcon} ${bestLabel}`);
      if (this.input.wasPressed('KeyE') && !this.hud.isPanelOpen() && !this.hud.isDialogOpen()) bestAction();
    } else {
      this.hud.hideInteract();
    }
    // decrementar cds de interação
    for (const it of this.world.interactables) {
      if (it._cdT > 0) it._cdT = Math.max(0, it._cdT - dt);
    }
  }

  talkToNPC(npc) {
    const g = this;
    const isNight = this.daynight.isNight;
    const lines = {
      elder: 'Que os Antigos te guardem, jovem. O castelo espera pelos candidatos ao Teste do Poder.',
      blacksmith: 'Aço honesto para heróis honestos! Dê uma olhada.',
      merchant: 'Poções fresquinhas! Compre duas, leve… bem, compre duas.',
      innkeeper: 'Sente-se, viajante! Uma caneca e uma história boa curam qualquer ferida.',
      priest: 'A luz te acompanhe. As eras escuras se aproximam — prepare-se.',
      farmer: 'A terra é generosa… quando não vêm goblins comer a colheita!',
      arion: 'Ah, o portador do novo elemento. O cristal raramente erra.',
      guard1: 'Mantenha os olhos abertos. Dizem que o acampamento goblin cresce.',
      guard2: 'A cidadela está segura… por enquanto.',
      kid1: 'Você lutou contra goblins?! Conte tudo!',
      kid2: 'Quando eu crescer, quero um grimório também!',
      villager1: 'Bom dia! Que a colheita seja generosa.',
      villager2: 'Cuidado no pântano ao sudeste. Ele engole os distraídos.',
      captain: 'Mantenha-se firme, soldado… digo, aventureiro.'
    };
    let text = lines[npc.id] || '…';
    if (isNight && !npc.def.kid) text = 'Já é tarde. Deveria estar em casa…';

    const options = [];
    if (npc.def.shop) {
      options.push(['🛒 Comprar / Vender', () => { this.hud.closeDialog(); this.hud.renderShop(npc.def.shop, npc.name); }]);
    }
    options.push(['Até logo', () => this.hud.closeDialog()]);
    // missões/história primeiro: o diálogo da história tem prioridade sobre o genérico
    const hadStory = this.quests.onTalk(npc.id);
    if (!this.hud.isDialogOpen()) {
      this.hud.dialogBox(`${npc.name} — ${npc.role}`, text, options);
    }
  }

  /* ================= REGIÕES ================= */
  scanRegions(dt) {
    this._regionT -= dt;
    if (this._regionT > 0) return;
    this._regionT = 0.5;
    const r = this.world.regionAt(this.player.root.position.x, this.player.root.position.z);
    if (r && !r.discovered) {
      r.discovered = true;
      this.hud.announce(r.name.toUpperCase(), '📍 Nova região descoberta', 2.5);
      this.audio.play('quest', 0.7);
      this.quests.onDiscover(r.id);
      this.player.gainXP(50);
      this.save.saveGame();
    }
  }

  /* ================= EVENTOS ALEATÓRIOS ================= */
  randomEvent() {
    if (this.story.invasionActive) return;
    const region = this.world.regionAt(this.player.root.position.x, this.player.root.position.z);
    const safe = region && region.safe;
    const p = this.player.root.position;
    const roll = Math.random();
    const lvl = this.player.level;

    if (!safe && roll < 0.45) {
      // emboscada
      this.hud.toast('Você sente que está sendo observado… 👀');
      const kind = region && region.id === 'volcano' || region && region.id === 'snow' ? 'wolf' : chance(0.5) ? 'bandit' : 'goblin';
      const rank = lvl >= 6 ? 'C' : lvl >= 3 ? 'D' : 'E';
      for (let i = 0; i < 3; i++) {
        const a = rand(0, Math.PI * 2);
        this.enemies.spawn(kind, p.x + Math.cos(a) * 22, p.z + Math.sin(a) * 22, { rank });
      }
      this.audio.play('goblin', 0.8);
    } else if (roll < 0.6 && !safe) {
      // tesouro
      this.hud.toast('Algo brilha no chão… ✨');
      this.loot.spawnPickup(pick(['potion_hp', 'mat_crystal', 'scroll_tp', 'potion_mp']), p, this);
    } else if (roll < 0.75) {
      // viajante pedindo ajuda
      this.hud.toast('Um viajante passa apressado: "Goblins na estrada! Cuidado!" 🐴');
    } else if (roll < 0.85) {
      // evento mágico
      this.hud.toast('Uma aurora arcanas dança no céu… 🌌');
      this.fx.spawn(p.clone().add(new THREE.Vector3(0, 12, 0)), { count: 30, color: 0x9a7aff, speed: 2, life: 2, size: 6, gravity: -0.5, alpha: 0.5 });
      this.player.gainXP(30);
    } else {
      // mercador itinerante
      this.hud.toast('Um mercador itinerante oferece especiarias. (+5 🪙 de sorte)');
      this.inventory.addGold(5);
    }
  }

  /* ================= ERRO ================= */
  showError(err) {
    if (this.errShown) return;
    this.errShown = true;
    try {
      const ov = document.getElementById('error-overlay');
      document.getElementById('error-msg').textContent = 'Ocorreu um erro durante o jogo. O mundo será recarregado.';
      document.getElementById('error-detail').textContent = String(err && err.stack || err);
      ov.style.display = 'flex';
    } catch (e) {}
  }
}
