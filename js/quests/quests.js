/* =========================================================
 * Aetheria — Sistema de missões
 * ========================================================= */
import { dist } from '../core/utils.js';

export const QUESTS = {
  /* ---- CADEIA PRINCIPAL ---- */
  main_intro: {
    title: 'O Despertar', type: 'principal',
    desc: 'Fale com o Ancião Tomás na praça da vila.',
    objectives: [{ type: 'talk', target: 'elder', count: 1 }],
    rewards: { xp: 30, gold: 10 }, marker: () => game.npcs.get('elder').pos
  },
  main_test: {
    title: 'O Teste do Poder', type: 'principal',
    desc: 'Dirija-se ao castelo em Valoria e coloque sua mão sobre o cristal mágico.',
    objectives: [{ type: 'flag', target: 'testDone', count: 1 }],
    rewards: { xp: 100, gold: 0 }, marker: () => game.world.crystalPos
  },
  main_invasion: {
    title: 'A Invasão', type: 'principal',
    desc: 'Defenda a cidadela do ataque goblin! Elimine as ondas de invasores.',
    objectives: [{ type: 'flag', target: 'invasionDone', count: 1 }],
    rewards: { xp: 250, gold: 80 }, marker: () => ({ x: 0, z: -195 })
  },
  main_arion: {
    title: 'O Primeiro Grimório', type: 'principal',
    desc: 'Procure o Mago Arion na cidadela para aprender mais sobre seu elemento.',
    objectives: [{ type: 'talk', target: 'arion', count: 1 }],
    rewards: { xp: 120, gold: 40 }, marker: () => game.npcs.get('arion').pos
  },
  main_explore: {
    title: 'A Jornada', type: 'principal',
    desc: 'Explore Aetheria e descubra 3 regiões novas.',
    objectives: [{ type: 'discover', target: null, count: 3 }],
    rewards: { xp: 200, gold: 60 }, marker: null
  },
  main_letter: {
    title: 'A Missão do Capitão', type: 'principal',
    desc: 'Entregue a carta do Ancião ao Capitão Rhys na cidadela.',
    objectives: [{ type: 'talk', target: 'captain', count: 1 }],
    rewards: { xp: 90, gold: 30, items: ['potion_hp2'] }, marker: () => game.npcs.get('captain').pos
  },
  main_dungeon: {
    title: 'A Caverna de Umbra', type: 'dungeon',
    desc: 'Adentre a caverna nas Montanhas da Coroa e derrote o Rei Goblin Gronnak.',
    objectives: [{ type: 'kill', target: 'goblinKing', count: 1 }],
    rewards: { xp: 500, gold: 300, items: ['sword_steel'] },
    marker: () => ({ x: -140, z: -470 })
  },
  main_realms: {
    title: 'Os Reinos de Aetheria', type: 'principal',
    desc: 'Visite o Reino de Umbra e descubra a verdade sobre a invasão.',
    objectives: [{ type: 'discover', target: 'umbra', count: 1 }],
    rewards: { xp: 400, gold: 150 }, marker: () => ({ x: 500, z: -320 })
  },
  /* ---- SECUNDÁRIAS ---- */
  hunt_goblins: {
    title: 'Caça aos Goblins', type: 'caça',
    desc: 'O acampamento Sangue cresce. Elimine 8 goblins.',
    objectives: [{ type: 'kill', target: 'goblin', count: 8 }],
    rewards: { xp: 120, gold: 50 }, giver: 'guard1'
  },
  collect_herbs: {
    title: 'Ervas para Mira', type: 'coleta',
    desc: 'Colete 5 Ervas Curativas para a Sacerdotisa.',
    objectives: [{ type: 'collect', target: 'mat_herb', count: 5 }],
    rewards: { xp: 80, gold: 35, items: ['potion_hp', 'potion_hp'] }, giver: 'priest'
  },
  wolves: {
    title: 'Lobos na Estrada', type: 'caça',
    desc: 'Lobos atacam viajantes. Elimine 5 lobos.',
    objectives: [{ type: 'kill', target: 'wolf', count: 5 }],
    rewards: { xp: 100, gold: 45 }, giver: 'farmer'
  },
  night_watch: {
    title: 'Vigília Noturna (apenas à noite)', type: 'defesa',
    desc: 'Esqueletos surgem à noite nas Ruínas de Eldrin. Elimine 4.',
    objectives: [{ type: 'kill', target: 'skeleton', count: 4 }],
    rewards: { xp: 150, gold: 70, items: ['amulet_mana'] }, giver: 'priest', nightOnly: true
  }
};

let game = null;
export function setGameRef(g) { game = g; }
function V(x, y, z) { return { x, y: y || 0, z }; }

export class QuestManager {
  constructor(game) {
    setGameRef(game);
    this.game = game;
    this.active = [];      // {id, progress:{}, done:false}
    this.completed = [];
    this.flags = {};
  }

  start(id, silent = false) {
    if (this.isActive(id) || this.completed.includes(id)) return;
    const def = QUESTS[id];
    if (!def) return;
    if (def.nightOnly && !this.game.daynight.isNight && !silent) {
      this.game.hud.toast(`"${def.title}" só está disponível à noite. 🌙`);
      return;
    }
    this.active.push({ id, progress: this.active.find(a => a.id === id)?.progress || {}, done: false });
    if (!silent) {
      this.game.hud.toast(`📜 Nova missão: <b>${def.title}</b>`);
      this.game.audio.play('quest', 0.8);
    }
    this.game.hud.dirtyQuests = true;
  }

  isActive(id) { return this.active.some(a => a.id === id); }
  get(id) { return this.active.find(a => a.id === id); }

  progress(a, objective, by = 1) {
    const key = objective.target ?? '_';
    a.progress[key] = (a.progress[key] || 0) + by;
    return a.progress[key];
  }
  objectiveDone(a, objective) {
    const def = QUESTS[a.id];
    return (a.progress[objective.target ?? '_'] || 0) >= (objective.count || 1);
  }
  questComplete(a) {
    return QUESTS[a.id].objectives.every(o => this.objectiveDone(a, o));
  }

  /* eventos */
  onTalk(npcId) {
    let changed = false;
    for (const a of this.active) {
      const def = QUESTS[a.id];
      for (const o of def.objectives) {
        if (o.type === 'talk' && o.target === npcId && !this.objectiveDone(a, o)) {
          this.progress(a, o);
          changed = true;
          this.game.hud.toast(`${def.title}: objetivo concluído!`);
        }
      }
      this.checkComplete(a);
    }
    if (changed) this.game.hud.dirtyQuests = true;
    return this.game.story.onTalk(npcId);
  }
  onKill(typeId) {
    for (const a of this.active) {
      const def = QUESTS[a.id];
      for (const o of def.objectives) {
        if (o.type === 'kill' && (o.target === typeId || (o.target === 'goblin' && typeId.startsWith('goblin')))) {
          if (!this.objectiveDone(a, o)) {
            this.progress(a, o);
            const def2 = QUESTS[a.id];
            this.game.hud.toast(`${def2.title}: progresso ${this.totalProgress(a)}/${this.totalNeeded(a)}`);
          }
        }
      }
      this.checkComplete(a);
    }
  }
  onCollect(itemId) {
    for (const a of this.active) {
      const def = QUESTS[a.id];
      for (const o of def.objectives) {
        if (o.type === 'collect' && o.target === itemId && !this.objectiveDone(a, o)) {
          this.progress(a, o);
          this.game.hud.toast(`${def.title}: ${this.game.inventory.count(itemId)}/${o.count} ${itemId && 'coletados'}`);
        }
      }
      this.checkComplete(a);
    }
  }
  onDiscover(regionId) {
    let changed = false;
    for (const a of this.active) {
      const def = QUESTS[a.id];
      for (const o of def.objectives) {
        if (o.type !== 'discover' || this.objectiveDone(a, o)) continue;
        if (o.target && o.target !== regionId) continue;
        this.progress(a, o);
        changed = true;
      }
      this.checkComplete(a);
    }
    if (changed) this.game.hud.dirtyQuests = true;
  }
  onFlag(flag) {
    this.flags[flag] = true;
    for (const a of this.active) {
      const def = QUESTS[a.id];
      for (const o of def.objectives) {
        if (o.type === 'flag' && o.target === flag && !this.objectiveDone(a, o)) {
          this.progress(a, o);
          this.game.hud.toast(`${def.title}: objetivo concluído!`);
        }
      }
      this.checkComplete(a);
    }
  }

  totalProgress(a) {
    const def = QUESTS[a.id];
    return def.objectives.reduce((s, o) => s + Math.min(this.objectiveCount(a, o), o.count || 1), 0);
  }
  totalNeeded(a) {
    const def = QUESTS[a.id];
    return def.objectives.reduce((s, o) => s + (o.count || 1), 0);
  }
  objectiveCount(a, o) { return Math.min(a.progress[o.target ?? '_'] || 0, o.count || 1); }

  checkComplete(a) {
    if (a.done || !this.questComplete(a)) return;
    a.done = true;
    const def = QUESTS[a.id];
    this.completed.push(a.id);
    this.active = this.active.filter(x => x !== a);
    const r = def.rewards || {};
    this.game.player.gainXP(r.xp || 0);
    if (r.gold) this.game.inventory.addGold(r.gold);
    if (r.items) for (const it of r.items) this.game.inventory.addItem(it);
    this.game.hud.toast(`✅ Missão concluída: <b>${def.title}</b> (+${r.xp || 0} XP${r.gold ? `, +${r.gold} 🪙` : ''})`);
    this.game.audio.play('quest');
    this.game.fx.ring(this.game.player.root.position, { radius: 1.8, color: 0xf5d97a, life: 0.6 });
    this.game.hud.dirtyQuests = true;
    this.game.story.onQuestComplete(a.id);
  }

  /* missão exibida no tracker: primeira principal ativa */
  trackerQuest() {
    const mains = ['main_intro', 'main_test', 'main_invasion', 'main_arion', 'main_letter', 'main_explore', 'main_dungeon', 'main_realms'];
    for (const id of mains) { const a = this.get(id); if (a && !a.done) return a; }
    return this.active[0] || null;
  }
}
