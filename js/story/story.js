/* =========================================================
 * Aetheria — História principal (cinemáticas e capítulos)
 * CAP 1: vila → CAP 2: teste → CAP 3: invasão → CAP 4+: mundo
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, chance, clamp, pick } from '../core/utils.js';
import { ELEMENTS, ELEMENT_LIST } from '../magic/elements.js';
import { FX } from '../effects/particles.js';

export const CHAPTERS = [
  'CAPÍTULO 1 — A Vila',
  'CAPÍTULO 2 — O Teste do Poder',
  'CAPÍTULO 3 — A Invasão',
  'CAPÍTULO 4 — O Primeiro Grimório',
  'CAPÍTULO 5 — A Jornada',
  'CAPÍTULO 6 — Os Reinos',
  'CAPÍTULO 7 — A Grande Guerra',
  'CAPÍTULO 8 — O Segredo do Protagonista',
  'CAPÍTULO 9 — A Ameaça Final',
  'CAPÍTULO 10 — Batalha Final'
];

export class Story {
  constructor(game) {
    this.game = game;
    this.chapter = 0;
    this.stage = 'intro';       // intro | toCastle | atCastle | test | postTest | invasion | afterInvasion | open
    this.testDone = false;
    this.invasionDone = false;
    this.invasionActive = false;
    this.invasionT = 0;
    this.wave = 0;
    this.cinematic = null;      // {t, steps:[{at, fn}]}
    this.respawnPoint = { x: 0, z: 10 };
    this.element = null;
    this.lockInt = false;
  }

  start() {
    const g = this.game;
    this.chapter = 0;
    this.stage = 'intro';
    g.hud.announce(CHAPTERS[0], 'Uma manhã tranquila em Pedravale…', 3.5);
    g.hud.tutorial('Use <b>WASD</b> para andar • <b>Botão direito</b> gira a câmera • <b>E</b> interage', 7);
    g.quests.start('main_intro', true);
    // spawn na vila
    const p = g.player;
    p.root.position.set(0, g.world.terrainHeight(0, 10), 10);
    this.respawnPoint = { x: 0, z: 10 };
    g.audio.setMood('village');
  }

  update(dt) {
    const g = this.game;
    // cinemática programada
    if (this.cinematic) {
      this.cinematic.t += dt;
      for (const step of this.cinematic.steps) {
        if (!step.done && this.cinematic.t >= step.at) { step.done = true; step.fn(); }
      }
      if (this.cinematic.t >= this.cinematic.end) this.cinematic = null;
    }
    // música por contexto
    if (!g.bosses.current) {
      if (this.invasionActive) g.audio.setMood('invasion');
      else if (g.enemies.list.some(e => !e.dead && e.state !== 'idle' && e.state !== 'patrol' && e.root.position.distanceTo(g.player.root.position) < 18)) g.audio.setMood('combat');
      else if (g.world.regionAt(g.player.root.position.x, g.player.root.position.z)?.id === 'city' && !this.invasionDone) g.audio.setMood('city');
      else if (g.player.root.position.distanceTo(g.world.dungeonCenter || new THREE.Vector3(9999, 0, 9999)) < 60) g.audio.setMood('dungeon');
      else if (g.world.regionAt(g.player.root.position.x, g.player.root.position.z)?.id === 'village' || g.world.regionAt(g.player.root.position.x, g.player.root.position.z)?.id === 'city') g.audio.setMood('village');
      else g.audio.setMood('explore');
    }
    // invasão
    if (this.invasionActive) this.updateInvasion(dt);
    // gatilho da invasão à prova de reload (o setTimeout original se perde
    // se o jogador salvar/carregar entre o teste e a invasão)
    else if (this.testDone && !this.invasionDone && !this.game.invasionStarted && !this.cinematic) {
      this._invPendingT = (this._invPendingT ?? 9) - dt;
      if (this._invPendingT <= 0) this.startInvasion();
    }
  }

  onTalk(npcId) {
    const g = this.game;
    if (npcId === 'elder' && !g.quests.flags.introDone) {
      g.hud.dialogBox('Ancião Tomás', 'Ah, jovem! O castelo convocou os candidatos ao Teste do Poder. O cristal escolherá qual elemento habita em você. Vá — a estrada ao norte leva à Cidadela de Valoria.', [
        ['Vou imediatamente!', () => { this.beginJourney(); g.hud.closeDialog(); }],
        ['Tenho medo…', () => { g.hud.dialogBox('Ancião Tomás', 'Todo herói sente medo, criança. Vá — e que os Antigos te guardem.', [['Fechar', () => g.hud.closeDialog()]]) }]
      ]);
      return true;
    }
    if (npcId === 'arion' && !g.quests.flags.arionDone && this.invasionDone) {
      g.hud.dialogBox('Mago Arion', `O cristal escolheu ${ELEMENTS[this.element].name.toLowerCase()}… interessante. Seu grimório crescerá com você. Há rumores de que os goblins servem a um poder maior — o Reino de Umbra se move. Explore o mundo, fortaleça-se, e volte quando as regiões se revelarem a você.`, [
        ['O que é Umbra?', () => g.hud.dialogBox('Mago Arion', 'Um reino de sombras a leste. Os magos selaram suas legiões há um século… selo que agora se rompe. Descubra 3 regiões e depois enfrente o Rei Goblin Gronnak na Caverna de Umbra, nas Montanhas da Coroa.', [['Entendido', () => { g.hud.closeDialog(); this.afterArion(); }]])],
        ['Estou pronto.', () => { g.hud.closeDialog(); this.afterArion(); }]
      ]);
      return true;
    }
    if (npcId === 'captain') {
      if (g.inventory.count('quest_letter') > 0 && !g.quests.get('main_letter')) {
        // missão entregue pela sacerdotisa/ancião dinamicamente
      }
    }
    // missões secundárias por giver
    this.checkGiverQuests(npcId);
    return false;
  }

  checkGiverQuests(npcId) {
    const g = this.game;
    const map = { guard1: ['hunt_goblins'], priest: ['collect_herbs', 'night_watch'], farmer: ['wolves'] };
    for (const id of (map[npcId] || [])) {
      if (!g.quests.isActive(id) && !g.quests.completed.includes(id)) {
        g.quests.start(id);
      }
    }
  }

  beginJourney() {
    const g = this.game;
    this.stage = 'toCastle';
    g.quests.start('main_test', true);
    g.quests.onFlag('introDone');
    g.hud.tutorial('Siga a estrada ao norte até <b>Valoria</b>. Abra o mapa com <b>M</b>.', 6);
    g.inventory.addItem('quest_letter');
  }

  afterArion() {
    const g = this.game;
    g.quests.flags.arionDone = true;
    this.stage = 'open';
    this.chapter = 4;
    g.quests.start('main_dungeon', true);
    g.quests.start('main_letter', true);
    g.hud.tutorial('Novas magias aguardam no <b>grimório (G)</b>. A Caverna de Umbra fica nas Montanhas da Coroa, a leste.', 8);
  }

  /* ---- interação com o cristal ---- */
  onCrystalInteract() {
    const g = this.game;
    if (this.testDone || this.stage === 'test') return;
    if (this.stage !== 'toCastle' && this.stage !== 'atCastle') {
      g.hud.dialogBox('Guarda do Cristal', 'O Teste do Poder é reservado aos candidatos convocados. Fale com o Ancião de Pedravale primeiro.', [['Fechar', () => g.hud.closeDialog()]]);
      return;
    }
    this.stage = 'test';
    g.hud.dialogBox('Guarda do Cristal', 'Coloque sua mão sobre o cristal.', [['Estender a mão…', () => { g.hud.closeDialog(); this.startTestCinematic(); }]]);
  }

  startTestCinematic() {
    const g = this.game;
    g.hud.closeDialog();
    const crystal = g.world.crystalPos;
    const player = g.player;
    player.setState('interact');
    // congela input
    g.input.enabled = false;
    // câmera aproxima do cristal
    g.camera.startCinematic(
      crystal.clone().add(new THREE.Vector3(2.5, 3.2, 4.5)),
      crystal.clone().add(new THREE.Vector3(0, 0.8, 0)),
      2.2, 1.0
    );
    this.cinematic = {
      t: 0, end: 12, steps: [
        { at: 0.4, fn: () => { g.audio.play('m_cast', 1); g.fx.spawn(crystal, { count: 20, color: 0x88ccff, speed: 1.5, life: 1.4, size: 5, upBias: 1 }); } },
        { at: 1.4, fn: () => { g.audio.play('element', 1); g.world.crystalLight.intensity = 5; } },
        { at: 2.4, fn: () => this.testSurge() },
        { at: 5.4, fn: () => this.revealElement() },
        { at: 9.0, fn: () => this.finishTest() }
      ]
    };
    // escurece levemente
    g.daynight.paused = true;
  }

  testSurge() {
    const g = this.game;
    const crystal = g.world.crystalPos;
    const p = g.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        g.fx.ring(crystal, { radius: 3 + i, color: 0x66aaff, life: 0.7 });
        g.fx.spawn(crystal, { count: 30, color: 0x88ccff, speed: 3, life: 1, size: 6, upBias: 2 });
        g.camera.addShake(0.15);
      }, i * 600);
    }
    g.audio.play('m_lightning', 0.8);
  }

  revealElement() {
    const g = this.game;
    // elemento aleatório
    const el = pick(ELEMENT_LIST);
    this.element = el.id;
    g.player.setElement(el.id);
    g.grimoire.setElement(el.id);
    // grande apresentação
    g.hud.announce('SEU ELEMENTO', `${el.icon} ${el.name} ${el.icon}`, 3.4);
    g.hud.toast(`Você é um conjurador de <b>${el.name}</b> — ${el.theme}.`);
    // grande animação do elemento
    const p = g.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    FX[el.id](g.fx, p, true);
    g.fx.ring(g.player.root.position, { radius: 3.5, color: el.color, life: 1 });
    g.fx.spawn(p, { count: 50, color: el.color, speed: 6, life: 1.4, size: 7, gravity: 3, upBias: 3 });
    g.camera.addShake(0.3);
    g.audio.play('element', 1);
    // magia 1 desbloqueada no grimório
    g.player.giveSword();
  }

  finishTest() {
    const g = this.game;
    g.daynight.paused = false;
    g.input.enabled = true;
    this.testDone = true;
    this.stage = 'postTest';
    g.quests.onFlag('testDone');
    g.grimoire.appear();
    g.hud.tutorial('O grimório flutua ao seu lado. Pressione <b>G</b> para lê-lo • <b>1</b> para lançar magia', 8);
    // capítulo 3 — invasão em breve
    this.chapter = 2;
    setTimeout(() => {
      if (g.player && !g.invasionStarted) this.startInvasion();
    }, 9000);
  }

  /* ---- INVASÃO ---- */
  startInvasion() {
    const g = this.game;
    if (this.invasionDone || this.invasionActive) return;
    g.invasionStarted = true;
    this.invasionActive = true;
    this.wave = 0;
    this.invasionT = 1;
    g.hud.announce('A INVASÃO', 'Sinos tocam… goblins avançam sobre a cidadela!', 3.5);
    g.audio.play('bell', 1);
    g.hud.tutorial('Sobreviva! <b>Clique</b>: ataque • <b>Espaço</b>: esquiva • <b>1</b>: magia • <b>F</b>: defesa', 8);
    g.quests.start('main_invasion', true);
    // NPCs em pânico: guardas correm para o portão
    g.audio.setMood('invasion');
    // fecha portões
    if (g.world.cityDoors) g.world.cityDoors.forEach(d => { d.rotation.y = 0.9; });
    this.chapter = 2;
  }

  updateInvasion(dt) {
    const g = this.game;
    this.invasionT -= dt;
    // conta apenas os invasores (inimigos selvagens do mundo não travam as ondas)
    const alive = g.enemies.list.filter(e => !e.dead && e.invader).length;
    if (this.invasionT <= 0 && (alive === 0)) {
      this.wave++;
      if (this.wave === 1) {
        g.hud.toast('Onda 1: batedores goblins!');
        this.spawnWave('village', [
          ['goblin', 0, -190], ['goblin', 8, -186], ['goblin', -8, -190], ['goblin', 4, -180]
        ]);
        this.invasionT = 12;
      } else if (this.wave === 2) {
        g.hud.toast('Onda 2: guerreiros e arqueiros!');
        this.spawnWave('village', [
          ['goblinWarrior', 6, -192], ['goblinWarrior', -6, -190],
          ['goblinArcher', 12, -198], ['goblinArcher', -12, -196],
          ['goblin', 0, -185], ['goblin', 3, -188]
        ]);
        this.invasionT = 15;
      } else if (this.wave === 3) {
        g.hud.toast('Onda final: o Capitão Sanguinário!');
        g.audio.play('roar', 1);
        const boss = g.enemies.spawn('goblinCaptain', 0, -200, { rank: 'B', bossBar: true, hpMult: 1.6 });
        if (boss) { boss.displayName = 'Capitão Sanguinário'; boss.invader = true; }
        const w1 = g.enemies.spawn('goblinWarrior', 5, -195, { rank: 'C' });
        const w2 = g.enemies.spawn('goblinWarrior', -5, -195, { rank: 'C' });
        if (w1) w1.invader = true;
        if (w2) w2.invader = true;
        this.invasionT = 999;
      }
    }
    // vitória: capitão morto
    if (this.wave >= 3 && alive === 0) {
      this.invasionActive = false;
      this.invasionDone = true;
      this.stage = 'postInvasion';
      this.chapter = 3;
      g.quests.onFlag('invasionDone');
      if (g.world.cityDoors) g.world.cityDoors.forEach(d => { d.rotation.y = 0; });
      g.hud.announce('A CIDADELA RESISTE', 'Os sobreviventes celebram — e o mundo se abre', 3.5);
      g.quests.start('main_arion', true);
      g.quests.start('main_explore', true);
      g.save.saveGame();
      g.player.gainXP(150);
      g.hud.tutorial('O mundo de Aetheria está aberto. Explore, evolua e siga o grimório. <b>M</b> abre o mapa.', 9);
    }
  }

  spawnWave(_tag, defs) {
    const g = this.game;
    for (const [type, dx, dz] of defs) {
      const x = dx, z = dz + rand(-4, 4);
      const e = g.enemies.spawn(type, x, z, { rank: this.wave === 1 ? 'E' : 'D' });
      if (e) e.invader = true;
    }
  }

  onBossKilled(typeId) {
    const g = this.game;
    if (typeId === 'goblinKing') {
      g.hud.announce('GRONNAK CAIU', 'O segredo de Umbra se revela…', 3.5);
      g.quests.onFlag('dungeonDone');
      g.quests.start('main_realms', true);
      g.inventory.addItem('quest_shard');
      g.hud.dialogBox('Estilhaço do Cristal', 'Nas cinzas de Gronnak, um estilhaço pulsa com o SEU elemento. Sussurros antigos revelam a verdade: o poder do cristal do teste vem do mesmo núcleo que alimenta Umbra. Você não foi escolhido por acaso…', [['Continuar', () => g.hud.closeDialog()]]);
      this.chapter = 6;
    }
  }

  onQuestComplete(id) {
    const g = this.game;
    if (id === 'main_intro') this.stage = 'toCastle';
    if (id === 'main_arion') {
      this.stage = 'open';
      this.chapter = 4;
      g.quests.start('main_dungeon', true);
      g.quests.start('main_letter', true);
    }
    if (id === 'main_explore') {
      this.chapter = 5;
      g.hud.toast('Os caminhos dos reinos se revelam… 🗺️');
      g.quests.start('main_realms', true);
    }
    if (id === 'main_realms') {
      this.chapter = 7;
      g.hud.dialogBox('O Selo se Rompe', 'Ao pisar em Umbra, o céu escurece. A Grande Guerra se aproxima — mas você já é mais forte do que nunca. (Capítulos finais: expansão futura — o mundo continua aberto para exploração!)', [['Continuar a jornada', () => g.hud.closeDialog()]]);
      g.inventory.addGold(500);
    }
    if (id === 'main_dungeon') this.chapter = 6;
    if (id === 'main_letter') {
      g.hud.dialogBox('Capitão Rhys', 'A carta do Ancião… entendo. Você realizou o Teste e defendeu a cidadela! Leve isto — a guarda reconhece seus serviços.', [['Receber', () => { g.hud.closeDialog(); }]]);
      g.quests.start('hunt_goblins', true);
    }
  }
}
