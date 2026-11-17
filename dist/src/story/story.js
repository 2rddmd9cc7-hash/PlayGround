// História — capítulos, cinemática do Teste do Poder, invasão, XP/progressão
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { ELEMENTS, getSpellDef } from '../magic/elements.js';
import { audio } from '../audio/audio.js';
import { effects, ELEMENT_COLORS } from '../effects/effects.js';
import { xpForLevel } from '../ui/hud.js';
import { wasPressed } from '../core/input.js';
import { classStatMults } from '../player/classes.js';
import { rand, clamp } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

const CHAPTER_NAMES = {
  1: ['CAPÍTULO 1', 'A Vila de Pedravale'],
  2: ['CAPÍTULO 2', 'O Teste do Poder'],
  3: ['CAPÍTULO 3', 'A Invasão'],
  4: ['CAPÍTULO 4', 'O Primeiro Grimório'],
  5: ['CAPÍTULO 5', 'A Jornada'],
  6: ['CAPÍTULO 6', 'Os Reinos'],
  7: ['CAPÍTULO 7', 'A Grande Guerra'],
  8: ['CAPÍTULO 8', 'O Segredo do Protagonista'],
  9: ['CAPÍTULO 9', 'A Ameaça Final'],
  10: ['CAPÍTULO 10', 'Batalha Final'],
};

function showChapterTitle(cap, name, dur = 4000) {
  const el = document.createElement('div');
  el.className = 'chapter-title';
  el.innerHTML = `<div class="cap">${cap}</div><div class="name">${name}</div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity 1s'; el.style.opacity = 0; }, dur);
  setTimeout(() => el.remove(), dur + 1100);
}

class Story {
  constructor() {
    this.testState = null;     // cinemática do teste
    this.invasionState = null;
    this.finalState = null;    // arco final (Morgath)
    this.morgath = null;
    this._endingClose = null;
    this.tutored = {};
  }

  init() {
    showChapterTitle(...(CHAPTER_NAMES[G.chapter] || CHAPTER_NAMES[1]));
    // começar no capítulo adequado
    if (G.storyFlags.testDone && G.chapter < 4) G.chapter = 4;
    if (G.storyFlags.testDone) G.grimoire?.appear();
    G.quests.offer('main_teste');
    if (G.storyFlags.testDone) {
      // mundo aberto
      G.quests.offer('main_reinos');
      G.quests.offer('main_dungeon');
    }
    // retomar arco final de um save
    if (G.storyFlags.dungeonDone && !G.storyFlags.gameFinished && !G.quests.doneIds.includes('main_final')) {
      G.quests.offer('main_final');
    }
    G.hud?.updateAll?.();
  }

  addXp(amount) {
    G.xp += amount;
    G.hud?.floatText?.(`+${amount} XP`, G.player.root.position, '#ffd23a');
    while (G.xp >= xpForLevel(G.level)) {
      G.xp -= xpForLevel(G.level);
      G.level++;
      G.attrPoints += 3;
      this._levelUp();
    }
    G.hud?.updateAll?.();
  }

  _levelUp() {
    audio.sfx('levelup');
    const flash = document.createElement('div');
    flash.id = 'levelup-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1700);
    G.hud?.toast(`⭐ NÍVEL ${G.level}! +3 pontos de atributo (pausa → Atributos)`, true);
    this.recalcStats();
    G.grimoire?.checkUnlocks();
    G.grimoireLevel = Math.max(G.grimoireLevel, 1 + Math.floor(G.level / 3));
  }

  recalcStats() {
    const a = G.attributes;
    const eq = G.equipment;
    const cm = classStatMults();
    G.maxHp = Math.round((80 + a.resistencia * 6 + G.level * 8 + (eq.accessory?.hp || 0)) * cm.hpMult);
    G.maxMp = Math.round((40 + a.mana * 5 + G.level * 4 + (eq.weapon?.mpBonus || 0)) * cm.mpMult);
    G.maxStamina = Math.round((80 + a.resistencia * 4) * cm.staminaMult);
    G.hp = Math.min(G.hp + 30, G.maxHp); // cura parcial ao subir de nível
    G.mp = G.maxMp;
    if (G.player) G.player.refreshEquipment?.();
  }

  onPlayerDeath() {
    G.hud?.toast('☠️ Você caiu… retornando à vila.');
    setTimeout(() => {
      G.player.respawn(0, 0);
      G.gold = Math.max(0, Math.floor(G.gold * 0.9));
      G.hud?.updateAll?.();
      audio.sfx('bell');
    }, 2500);
  }

  onQuestComplete(id) {
    if (id === 'main_teste') { /* concluída ao interagir com cristal */ }
    if (id === 'main_invasao') {
      G.storyFlags.invasionWon = true;
      // cadeia secundária: ferreiro preocupado → estrada perigosa
      G.quests.offer('blacksmith_worry');
      G.hud?.hint('⚒️ O Ferreiro Doran quer falar com você sobre a defesa da cidade.', 7000);
      this._openWorld();
    }
    if (id === 'blacksmith_worry') {
      G.quests.offer('dangerous_road');
      G.hud?.hint('⚔️ Nova missão: limpe a estrada dos goblins!', 7000);
    }
    if (id === 'main_dungeon') {
      G.storyFlags.dungeonDone = true;
      G.hud?.toast('🏆 O Rei Goblin caiu! O vale respira aliviado.', true);
      // arco final desbloqueia
      if (!G.storyFlags.gameFinished) {
        G.chapter = Math.max(G.chapter, 6);
        showChapterTitle('CAPÍTULO 6', 'Os Reinos', 4000);
        setTimeout(() => {
          if (G.storyFlags.gameFinished) return;
          G.quests.offer('main_final');
          audio.sfx('bell');
          G.hud?.toast('🌑 Uma sombra antiga desperta nas Montanhas Negras…', true);
          G.hud?.hint('A verdadeira ameaça aguarda no Pico Umbral, a nordeste. Prepare-se e vá até lá!', 10000);
        }, 6000);
      }
    }
    if (id === 'main_final') {
      G.storyFlags.gameFinished = true;
      G.chapter = 10;
      this._showEnding();
    }
  }

  onTalkTo(npcId) {
    // conversas marcam progresso da missão do teste
    if (npcId === 'elder' && !G.storyFlags.talkedElder) {
      G.storyFlags.talkedElder = true;
      G.hud?.hint('Siga a estrada ao NORTE até Aurelia. (Use o minimapa!)');
    }
    // objetivo "falar com o ferreiro" da cadeia pós-invasão
    if (npcId === 'blacksmith' && G.quests.activeIds.includes('blacksmith_worry')) {
      G.quests.onObjectiveFlag('blacksmith_worry', 'talk');
    }
  }

  onBossSeen(boss) {
    if (this._bossIntroDone) return;
    this._bossIntroDone = true;
    G.hud?.toast(`⚠️ ${boss.type.name} aparece!`, true);
    audio.sfx('bossRoar');
  }

  giveGrimoire() {
    if (G.storyFlags.grimoireGiven) return;
    G.storyFlags.grimoireGiven = true;
    G.grimoire?.appear();
    G.hud?.toast('📖 O Arquimaga entrega o GRIMÓRIO! (tecla G para abrir)', true);
    this.addXp(100);
    if (G.quests.activeIds.includes('main_grimorio')) G.quests.complete('main_grimorio');
    G.quests.offer('main_reinos');
    G.quests.offer('main_dungeon');
  }

  // ==================== ARCO FINAL: MORGATH ====================
  updateFinal(dt) {
    // estado criado sob demanda (oferta da quest ou save carregado)
    if (!this.finalState) {
      if (!G.quests.activeIds.includes('main_final')) return;
      this.finalState = { spawned: false, warned: false };
    }
    if (this.finalState.spawned) return;
    const p = G.player.root.position;
    const d = Math.hypot(p.x - 330, p.z + 260);
    // aproximação do Pico Umbral: introdução do boss
    if (d < 70 && !this.finalState.warned) {
      this.finalState.warned = true;
      showChapterTitle('CAPÍTULO 10', 'Batalha Final', 4500);
      G.hud?.toast('🌑 O ar congela… MORGATH desperta no Pico Umbral!', true);
      audio.playMusic('boss');
      audio.sfx('bossRoar');
      G.camCtl?.shakeIt(1.5);
    }
    if (d < 45) {
      this.finalState.spawned = true;
      G.quests.onObjectiveFlag('main_final', 'go');
      const m = G.enemies.spawnBoss('bossMorgath', 330, -268, 'B');
      m.state = 'chase';
      m.invasion = true; // nunca é removido por distância
      this.morgath = m;
      effects.explosion(330, terrainHeight(330, -268) + 3, -268, 0x5a0a5a, 60, 7);
      G.hud?.showBoss(m.type.name, 1);
      G.hud?.hint('⚔️ BOSS FINAL! Ele ataca forte — esquive (espaço), feche a distância e castigue com magia (1-4)!', 12000);
      this.onBossSeen(m);
    }
  }

  _showEnding() {
    G.hud?.showBoss(null);
    G.paused = true;
    audio.playMusic('vila');
    G.hud?.toast('🏆 MORGATH FOI DERROTADO! Aetheria está livre!', true);
    const mins = Math.floor(G.playtime / 60);
    const done = G.quests.doneIds.length;
    const el = document.createElement('div');
    el.id = 'ending-screen';
    el.innerHTML = `
      <div class="ending-box">
        <div class="ending-title">FIM</div>
        <div class="ending-sub">Crônicas de Aetheria</div>
        <p>A escuridão de Morgath se dissipa sobre as Montanhas Negras. Os reinos celebram o nome do herói de Pedravale — e as suas crônicas, para sempre escritas no Grimório.</p>
        <div class="ending-stats">
          <div><span>Nível</span><b>${G.level}</b></div>
          <div><span>Ouro</span><b>${G.gold}</b></div>
          <div><span>Missões</span><b>${done}</b></div>
          <div><span>Elemento</span><b>${G.element ? (ELEMENTS[G.element]?.name || G.element) : '—'}</b></div>
          <div><span>Tempo</span><b>${mins} min</b></div>
        </div>
        <button id="ending-continue">🌍 Continuar explorando Aetheria</button>
      </div>`;
    document.body.appendChild(el);
    const btn = el.querySelector('#ending-continue');
    const close = () => {
      el.remove();
      G.paused = false;
      G.hud?.hint('O mundo continua aberto! Missões secundárias, dungeons e segredos aguardam.', 8000);
    };
    btn.addEventListener('click', close);
    this._endingClose = close;
  }

  closeEnding() { this._endingClose?.(); this._endingClose = null; }

  // ---------- viagem rápida ----------
  fastTravel(x, z) {
    const y = terrainHeight(x, z);
    G.player.root.position.set(x, y, z);
    effects.particles.burst(x, y + 1, z, 30, { r: 0.7, g: 0.9, b: 1, spread: 3, up: 2, life: 1, size: 0.5 });
    audio.sfx('magicCast', { element: 'vento' });
    G.hud?.toast('✨ Viajou pelo vento.');
  }

  // ==================== TESTE DO PODER ====================
  startCrystalTest() {
    if (G.storyFlags.testDone || this.testState) return;
    this.testState = { phase: 0, t: 0 };
    G.paused = true; // pausa combate, mantém cinemática
    audio.sfx('crystal');
    G.hud?.showInteract(null);
    G.ui?.closeModalSilent?.();
    G.hud?.hint('Coloque sua mão sobre o cristal…', 8000);
    // pausa parcial: inimigos não atacam (não há na sala)
  }

  updateTestCinematic(dt) {
    const st = this.testState;
    if (!st) return;
    st.t += dt;
    const pl = G.player;
    pl.root.rotation.y = pl.yaw;
    pl.updatePose(dt);
    const crystal = G.world.crystal;
    // posição de MUNDO do cristal (ele vive dentro do keep, coords locais ≠ mundo)
    const CW = new THREE.Vector3(); crystal.getWorldPosition(CW);
    const cam = G.camCtl ?? G.camera;
    const plPos = pl.root.position;

    if (st.phase === 0) {
      // aproximar o jogador do cristal
      const target = new THREE.Vector3(CW.x + 2.2, plPos.y, CW.z + 1.2);
      plPos.lerp(target, Math.min(1, dt * 2));
      pl.yaw = Math.atan2(CW.x - plPos.x, CW.z - plPos.z);
      pl.state = 'crystal'; pl.stateT = 0;
      // câmera aproxima
      const camTarget = new THREE.Vector3(CW.x + 3.5, CW.y + 4.5, CW.z + 4);
      const look = new THREE.Vector3(CW.x, CW.y + 2.5, CW.z);
      cam.overrideTo(camTarget, look, dt, 2.5);
      if (st.t > 2.2) { st.phase = 1; st.t = 0; st.element = this._pickElement(); }
    } else if (st.phase === 1) {
      // cristal brilha
      const mat = crystal.userData.crystal.material;
      mat.emissiveIntensity = 0.5 + Math.sin(st.t * 6) * 0.5 + st.t * 0.4;
      crystal.userData.crystal.rotation.y += dt;
      crystal.userData.crystal.position.y = 2.6 + Math.sin(st.t * 3) * 0.15;
      if (Math.random() < dt * 30) {
        effects.particles.emit({
          x: CW.x + rand(-1.2, 1.2), y: CW.y + rand(1, 3.6), z: CW.z + rand(-1.2, 1.2),
          vy: 1.5, life: 1, size: 0.3, r: 0.6, g: 0.9, b: 1, drag: 0.96,
        });
      }
      if (st.t > 2.5) { st.phase = 2; st.t = 0; audio.sfx('elementReveal'); }
    } else if (st.phase === 2) {
      // energia envolve o personagem + escolha
      const el = st.element;
      const c = ELEMENT_COLORS[el];
      const plPos2 = pl.root.position;
      if (Math.random() < dt * 40) {
        effects.particles.emit({
          x: plPos2.x + rand(-0.6, 0.6), y: plPos2.y + rand(0, 2), z: plPos2.z + rand(-0.6, 0.6),
          vy: 2.5, life: 0.8, size: 0.35, r: c.r, g: c.g, b: c.b, drag: 0.95,
        });
      }
      effects.flashSphere(CW.x, CW.y + 2.6, CW.z, 2 + st.t * 2, ELEMENTS[el].color, 0.3, 0.5);
      cam.overrideTo(
        new THREE.Vector3(plPos2.x - 3, plPos2.y + 3.5, plPos2.z + 4),
        new THREE.Vector3(plPos2.x, plPos2.y + 1.4, plPos2.z), dt, 2);
      if (st.t > 2.6) { st.phase = 3; st.t = 0; this._showElementReveal(el); }
    } else if (st.phase === 3) {
      // anúncio grande + rajada elemental
      const el = st.element;
      const c = ELEMENT_COLORS[el];
      if (Math.random() < dt * 60) {
        const a = rand(0, Math.PI * 2);
        effects.particles.emit({
          x: pl.root.position.x + Math.cos(a) * 3, y: pl.root.position.y + rand(0, 0.5), z: pl.root.position.z + Math.sin(a) * 3,
          vy: 4, life: 1.2, size: 0.4, r: c.r, g: c.g, b: c.b, drag: 0.94,
        });
      }
      cam.overrideTo(
        new THREE.Vector3(pl.root.position.x - 4, pl.root.position.y + 2.5, pl.root.position.z + 5),
        new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1.6, pl.root.position.z), dt, 3);
      if (st.t > 4.5) { st.phase = 4; st.t = 0; }
    } else if (st.phase === 4) {
      this._finishTest();
    }
  }

  _pickElement() {
    // escolha aleatória do elemento (arquitetura permite novos elementos)
    const keys = Object.keys(ELEMENTS);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  _showElementReveal(element) {
    const el = ELEMENTS[element];
    const div = document.createElement('div');
    div.id = 'element-cine';
    div.innerHTML = `
      <div class="small">SEU ELEMENTO</div>
      <div class="big" style="color:${el.colorCss}">${el.icon}</div>
      <div class="big" style="color:${el.colorCss};font-size:64px">${el.name}</div>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4500);
    audio.sfx('elementReveal');
    G.camCtl.shakeIt(1);
    // burst elemental
    const c = ELEMENT_COLORS[element];
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        effects.explosion(G.player.root.position.x, G.player.root.position.y + 1, G.player.root.position.z, c.hex, 40, 4);
        audio.sfx(element === 'raio' ? 'thunder' : element === 'terra' ? 'earth' : element === 'gelo' ? 'ice' : element === 'agua' ? 'water' : element === 'vento' ? 'wind' : 'fire');
      }, i * 400);
    }
  }

  _finishTest() {
    const element = this.testState.element;
    this.testState = null;
    G.paused = false;
    if (G.player) { G.player.state = 'idle'; G.player.stateT = 0; }
    G.element = element;
    G.storyFlags.testDone = true;
    G.chapter = Math.max(G.chapter, 3);
    // desbloquear primeira magia
    const first = ELEMENTS[element].spells[0];
    G.spells[first.id] = { level: 1, uses: 0 };
    this.recalcStats();
    G.grimoire?.appear();
    G.grimoire?.checkUnlocks();
    G.hud?.updateAll?.();
    G.quests.complete('main_teste');
    G.hud?.toast(`✨ Você recebeu o elemento ${ELEMENTS[element].name}! O grimório surgiu ao seu lado. (G)`, true);
    // inicia invasão em sequência
    setTimeout(() => this.startInvasion(), 6000);
  }

  // ==================== INVASÃO GOBLIN ====================
  startInvasion() {
    if (G.storyFlags.invasionDone || this.invasionState) return;
    G.storyFlags.invasionDone = true;
    G.chapter = Math.max(G.chapter, 3);
    showChapterTitle('CAPÍTULO 3', 'A Invasão', 4000);
    audio.sfx('bell');
    setTimeout(() => audio.sfx('bell'), 2000);
    G.world.setGate(true);
    G.quests.offer('main_invasao');
    this.invasionState = {
      wave: 0, killCount: 0, waveKills: 0,
      waves: [
        { rank: 'E', count: 3, types: ['goblin'] },
        { rank: 'D', count: 3, types: ['goblin', 'goblinArqueiro'] },
        { rank: 'C', count: 2, types: ['goblinGuerreiro', 'goblinMago'] },
      ],
      eliteDone: false,
      t: 0, announceT: 0,
    };
    // NPCs entram em pânico
    G.storyFlags.invasion = true;
    G.hud?.hint('🔔 Sinos tocam! GOBLINS INVADEM A CIDADE! Defenda-se! (botão esquerdo = ataque, espaço = esquiva)', 8000);
    G.hud?.setCrosshair(true);
    audio.playMusic('invasao');
    G.combatMusic = 8;
  }

  updateInvasion(dt) {
    const st = this.invasionState;
    if (!st) return;
    st.t += dt;
    // spawn de ondas
    const q = G.quests.progress['main_invasao'];
    if (st.wave < st.waves.length) {
      const w = st.waves[st.wave];
      const aliveInvasion = G.enemies.active.filter(e => e.invasion && !e.dead).length;
      if (st.t > 2 && aliveInvasion < w.count && st.announceT === 0) {
        // spawn em pontos da cidade
        for (let i = 0; i < w.count; i++) {
          const a = rand(0, Math.PI * 2);
          const e = G.enemies.spawnAt(
            { type: w.types[i % w.types.length], rank: w.rank },
            Math.cos(a) * rand(20, 50), -260 + Math.sin(a) * rand(20, 50),
          );
          e.invasion = true;
          e.state = 'chase';
        }
        st.announceT = 1;
        G.hud?.toast(`⚔️ Onda ${st.wave + 1} de ${st.waves.length + 1}!`);
      }
      // progresso da quest acompanha kills de invasores
      if (q && st.waveKills >= w.count) {
        const objId = st.wave === 0 ? 'wave1' : st.wave === 1 ? 'wave2' : 'wave3';
        q[objId] = w.count;
        st.wave++;
        st.waveKills = 0;
        st.t = 0;
        st.announceT = 0;
        if (st.wave < st.waves.length) {
          G.hud?.hint('Mais goblins se aproximam! Use magias (teclas 1-4) e esquive (espaço).', 6000);
        } else {
          // ELITE FINAL
          this._spawnElite();
        }
      }
    } else if (!st.eliteDone) {
      const elite = G.enemies.active.find(e => e.boss && e.invasion && !e.dead);
      if (elite) {
        G.hud?.showBoss(elite.type.name, elite.hp / elite.maxHp);
        if (elite.hp < elite.maxHp * 0.5 && elite.phase === 1) {
          elite.phase = 2;
          elite.speed *= 1.15;
          G.hud?.toast(`${elite.type.name} entra em fúria!`, true);
          audio.sfx('bossRoar');
        }
      } else if (st.t > 1) {
        st.eliteDone = true;
        G.hud?.showBoss(null);
      }
    } else {
      // vitória
      this._finishInvasion();
    }
  }

  _spawnElite() {
    const elite = G.enemies.spawnBoss('bossUgluk', 0, -240, 'C');
    elite.invasion = true;
    elite.state = 'chase';
    audio.sfx('bossRoar');
    G.camCtl.shakeIt(1.2);
    G.hud?.toast('👑 UGLÚK, O DEVORADOR, surge da poeira!', true);
    G.hud?.hint('⚔️ BOSS! Ataque quando ele errar, esquive seus golpes e use sua magia!', 9000);
  }

  _finishInvasion() {
    if (!this.invasionState) return;
    this.invasionState = null;
    G.hud?.showBoss(null);
    G.world.setGate(false);
    G.storyFlags.invasion = false;
    G.hud?.toast('🏆 A invasão foi repelida! Aurelia está segura… por enquanto.', true);
    audio.sfx('questDone');
    const q = G.quests.progress['main_invasao'];
    if (q) { q.wave1 = 3; q.wave2 = 3; q.wave3 = 1; }
    G.quests.complete('main_invasao');
    this.addXp(120);
    G.chapter = 4;
    showChapterTitle('CAPÍTULO 4', 'O Primeiro Grimório', 4000);
    G.quests.offer('main_grimorio');
    this._openWorld();
  }

  _openWorld() {
    G.storyFlags.worldOpen = true;
    G.hud?.hint('🌍 O mundo se abriu! Abra o mapa (tecla M) e explore. Fale com NPCs por missões!', 9000);
  }

  // tutorial contextual de combate
  showTutorialHint(key) {
    if (this.tutored[key]) return;
    this.tutored[key] = true;
    const hints = {
      attack: '🖱️ Botão esquerdo: ataque com a espada! Segure para um golpe pesado.',
      dodge: '⌨️ Espaço/C: esquiva! Você fica invulnerável por um instante.',
      spell: '⌨️ Teclas 1-4: conjure suas magias elementais.',
      grimoire: '⌨️ G: abra seu grimório para ver e evoluir suas magias.',
      combo: '⚔️ Combine: ataque → magia → esquiva → ataque pesado!',
    };
    G.hud?.hint(hints[key] || '', 6000);
  }

  onEnemyKilledInvasionHint(enemy) {
    if (!G.storyFlags.tutCombo) {
      G.storyFlags.tutCombo = true;
      setTimeout(() => this.showTutorialHint('combo'), 3000);
    }
  }
}

export { Story };
