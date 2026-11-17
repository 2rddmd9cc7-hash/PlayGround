// Missões — história principal, secundárias, caça, coleta, exploração
import { G } from '../core/state.js';
import { audio } from '../audio/audio.js';
import { dist2d } from '../core/utils.js';

// Cada quest: { id, title, type, desc, objectives: [{id, text, target?, x?, z?, region?}], rewards: {xp, gold, item?}, chapter? }
export const QUEST_DEFS = {
  main_teste: {
    id: 'main_teste', title: 'O Teste do Poder', type: 'principal', chapter: 1,
    desc: 'Os Seis Elementos escolhem seus portadores no cristal sagrado de Aurelia. O Ancião Bram pediu que você se apresentasse ao castelo.',
    objectives: [{ id: 'go', text: 'Vá ao castelo em Aurelia', x: 0, z: -280 }],
    rewards: { xp: 50, gold: 30 },
  },
  main_invasao: {
    id: 'main_invasao', title: 'A Invasão Goblin', type: 'principal', chapter: 2,
    desc: 'Os goblins atacam a cidade! Defenda o povo de Aurelia.',
    objectives: [
      { id: 'wave1', text: 'Derrote os invasores (0/3)', count: 3, target: 'kill' },
      { id: 'wave2', text: 'Resista à segunda onda (0/3)', count: 3, target: 'kill' },
      { id: 'wave3', text: 'Enfrente o capitão invasor (0/1)', count: 1, target: 'kill', boss: true },
    ],
    rewards: { xp: 150, gold: 80, item: 'armadura_couro' },
  },
  main_grimorio: {
    id: 'main_grimorio', title: 'O Primeiro Grimório', type: 'principal', chapter: 3,
    desc: 'A Arquimaga Selenar aguarda no salão do castelo. Ela guarda um presente para você.',
    objectives: [{ id: 'go', text: 'Fale com a Arquimaga Selenar', x: 0, z: -306 }],
    rewards: { xp: 100, gold: 40 },
  },
  main_reinos: {
    id: 'main_reinos', title: 'A Jornada Começa', type: 'principal', chapter: 4,
    desc: 'Explore o mundo de Aetheria. Descubra 4 regiões do mapa.',
    objectives: [{ id: 'explore', text: 'Descubra regiões (0/4)', count: 4, target: 'discover' }],
    rewards: { xp: 200, gold: 100 },
  },
  main_final: {
    id: 'main_final', title: 'A Ameaça Final', type: 'principal', chapter: 6,
    desc: 'A sombra por trás dos goblins se revela: Morgath, o Devorador de Reinos, aguarda no Pico Umbral, nas Montanhas Negras (nordeste). Acabe com ele… ou Aetheria jamais conhecerá a paz.',
    objectives: [
      { id: 'go', text: 'Suba o Pico Umbral (nordeste, montanhas)', x: 330, z: -260 },
      { id: 'boss', text: 'Derrote Morgath (0/1)', count: 1, target: 'kill', boss: true },
    ],
    rewards: { xp: 800, gold: 500 },
  },
  main_dungeon: {
    id: 'main_dungeon', title: 'A Masmorra Sussurrante', type: 'dungeon', chapter: 4,
    desc: 'Uma caverna a leste esconde o covil do Rei Goblin. Investigue e derrote-o.',
    objectives: [
      { id: 'enter', text: 'Entre na caverna (leste da vila)', x: 150, z: 200 },
      { id: 'boss', text: 'Derrote o Rei Goblin Groshnak (0/1)', count: 1, target: 'kill', boss: true },
    ],
    rewards: { xp: 400, gold: 250, item: 'espada_runa' },
  },
  // ------- secundárias -------
  hunt_goblins: {
    id: 'hunt_goblins', title: 'Caça aos Goblins', type: 'caça',
    desc: 'O Capitão Aldric paga pela cabeça de goblins da Floresta Sussurrante.',
    objectives: [{ id: 'kill', text: 'Derrote goblins na floresta (0/6)', count: 6, target: 'kill', region: 'floresta' }],
    rewards: { xp: 120, gold: 90 },
    giver: 'captain',
  },
  herbs: {
    id: 'herbs', title: 'Ervas para Mirena', type: 'coleta',
    desc: 'A Sacerdotisa precisa de 3 ervas medicinais para as poções do templo.',
    objectives: [{ id: 'herbs', text: 'Colete Ervas Medicinais (0/3)', count: 3, target: 'item', item: 'erva' }],
    rewards: { xp: 80, gold: 40, item: 'pocao_vida' },
    giver: 'priest',
  },
  forge_ore: {
    id: 'forge_ore', title: 'Minério para Doran', type: 'coleta',
    desc: 'O Ferreiro Doran procura minério de qualidade nas Montanhas Cinzentas.',
    objectives: [{ id: 'ore', text: 'Colete Minério de Ferro (0/2)', count: 2, target: 'item', item: 'minerio' }],
    rewards: { xp: 100, gold: 60, item: 'espada_aco' },
    giver: 'blacksmith',
  },
  night_watch: {
    id: 'night_watch', title: 'Vigília Noturna', type: 'secundária',
    desc: 'Criaturas surgem na vila à noite. O Guarda Fenwick pede ajuda na madrugada (22h–5h).',
    objectives: [{ id: 'kill', text: 'Derrote criaturas à noite (0/4)', count: 4, target: 'kill', night: true }],
    rewards: { xp: 150, gold: 100, item: 'capacete_aço' },
    giver: 'guard1', nightOnly: true,
  },
  explore_all: {
    id: 'explore_all', title: 'Mapamundi', type: 'exploração',
    desc: 'Um viajante sonha em mapear Aetheria. Descubra 8 regiões.',
    objectives: [{ id: 'explore', text: 'Descubra regiões (0/8)', count: 8, target: 'discover' }],
    rewards: { xp: 300, gold: 200, item: 'botas_vento' },
    giver: 'traveler',
  },
  volcano_heart: {
    id: 'volcano_heart', title: 'O Coração de Brasas', type: 'boss',
    desc: 'Elementais de fogo guardam a Coroa de Brasas. Derrote-os.',
    objectives: [{ id: 'kill', text: 'Derrote Elementais de Fogo (0/2)', count: 2, target: 'kill', type: 'fogoElemental' }],
    rewards: { xp: 250, gold: 180, item: 'lamba_prisma' },
  },
  // ------- cadeia pós-invasão: Ferreiro → Estrada Perigosa -------
  blacksmith_worry: {
    id: 'blacksmith_worry', title: 'O Ferreiro Preocupado', type: 'secundária',
    desc: 'Depois da invasão, o Ferreiro Doran quer falar com quem defendeu a cidade.',
    objectives: [{ id: 'talk', text: 'Fale com o Ferreiro Doran', target: 'flag' }],
    rewards: { xp: 60, gold: 40 },
    giver: 'blacksmith',
  },
  dangerous_road: {
    id: 'dangerous_road', title: 'Estrada Perigosa', type: 'caça',
    desc: 'Goblins acampados nas redondezas ameaçam a estrada da cidade. Limpe o caminho.',
    objectives: [{ id: 'kill', text: 'Derrote goblins fora da cidade (0/5)', count: 5, target: 'kill', type: 'goblinGuerreiro' }],
    rewards: { xp: 180, gold: 120, item: 'pocao_elixir' },
    giver: 'blacksmith',
  },
};

class QuestSystem {
  constructor() {
    this.activeIds = [];
    this.doneIds = [];
    this.progress = {};   // questId -> { objId -> counter }
  }

  stateFor(id) {
    if (this.activeIds.includes(id)) return 'active';
    if (this.doneIds.includes(id)) return 'done';
    return 'locked';
  }

  offer(id) {
    if (this.stateFor(id) !== 'locked') return false;
    const q = QUEST_DEFS[id];
    if (!q) return false;
    this.activeIds.push(id);
    this.progress[id] = {};
    for (const o of q.objectives) this.progress[id][o.id] = 0;
    G.hud?.toast(`📜 Nova missão: ${q.title}`, true);
    audio.sfx('quest');
    G.hud?.updateAll?.();
    return true;
  }

  complete(id) {
    const q = QUEST_DEFS[id];
    if (!q || this.doneIds.includes(id)) return;
    this.activeIds = this.activeIds.filter(x => x !== id);
    this.doneIds.push(id);
    const r = q.rewards;
    if (r.xp) G.story?.addXp?.(r.xp);
    if (r.gold) { G.gold += r.gold; G.hud?.toast(`+${r.gold} 🪙`); }
    if (r.item) G.inventory?.addItem(r.item, 1);
    G.hud?.toast(`✅ Missão concluída: ${q.title}`, true);
    audio.sfx('questDone');
    G.hud?.updateAll?.();
    G.story?.onQuestComplete?.(id);
  }

  // eventos do jogo
  onKill(enemy) {
    for (const id of this.activeIds) {
      const q = QUEST_DEFS[id];
      if (!q) continue;
      for (const o of q.objectives) {
        if (o.target !== 'kill') continue;
        if (o.boss && !enemy.boss) continue;
        if (o.type && enemy.typeId !== o.type) continue;
        if (o.region) {
          const r = G.world?.regionAt(enemy.root.position.x, enemy.root.position.z);
          if (!r || r.id !== o.region) continue;
        }
        if (o.night && !(G.sky && G.sky.isNight)) continue;
        const cur = this.progress[id][o.id] || 0;
        if (cur >= o.count) continue;
        this.progress[id][o.id] = cur + 1;
        this._tick(id, o, cur + 1, o.count);
      }
      this._checkComplete(id);
    }
  }

  onCollect(item, qty = 1) {
    for (const id of this.activeIds) {
      const q = QUEST_DEFS[id];
      if (!q) continue;
      for (const o of q.objectives) {
        if (o.target !== 'item' || o.item !== item) continue;
        const have = G.inventory?.count(item) || 0;
        this.progress[id][o.id] = Math.min(o.count, have);
        this._tick(id, o, this.progress[id][o.id], o.count);
      }
      this._checkComplete(id);
    }
  }

  onDiscover(regionId) {
    for (const id of this.activeIds) {
      const q = QUEST_DEFS[id];
      if (!q) continue;
      for (const o of q.objectives) {
        if (o.target !== 'discover') continue;
        const cur = this.progress[id][o.id] || 0;
        this.progress[id][o.id] = Math.min(o.count, G.discovered.length);
        this._tick(id, o, G.discovered.length, o.count);
      }
      this._checkComplete(id);
    }
  }

  onObjectiveFlag(id, objId) {
    const q = QUEST_DEFS[id];
    if (!q || !this.activeIds.includes(id)) return;
    const o = q.objectives.find(x => x.id === objId);
    if (!o) return;
    this.progress[id][objId] = 1;
    this._tick(id, o, 1, 1);
    this._checkComplete(id);
  }

  _tick(id, o, cur, target) {
    if (cur === target) {
      G.hud?.toast(`✔ Objetivo: ${o.text.replace(/\(0\/\d+\)/, '').replace(/\((\d+)\/\1\)/, '').trim()} — completo!`);
      audio.sfx('quest');
    }
    G.hud?.updateAll?.();
  }

  _checkComplete(id) {
    const q = QUEST_DEFS[id];
    if (!q) return;
    for (const o of q.objectives) {
      if (o.count === undefined) {
        // objetivos de evento precisam da flag explícita
        if (!((this.progress[id]?.[o.id] || 0) > 0)) return;
        continue;
      }
      const cur = this.progress[id]?.[o.id] || 0;
      if (cur < o.count) return;
    }
    this.complete(id);
  }

  // quest ativa para o HUD (prioriza principal)
  tracked() {
    for (const id of this.activeIds) {
      if (QUEST_DEFS[id]?.type === 'principal') return QUEST_DEFS[id];
    }
    return this.activeIds.length ? QUEST_DEFS[this.activeIds[0]] : null;
  }

  trackedProgress(id) {
    return this.progress[id] || {};
  }

  objectivePos(id) {
    const q = QUEST_DEFS[id];
    if (!q) return null;
    for (const o of q.objectives) {
      const cur = this.progress[id]?.[o.id] || 0;
      if (cur < o.count && o.x !== undefined) return { x: o.x, z: o.z };
    }
    return null;
  }

  serialize() {
    return { active: [...this.activeIds], done: [...this.doneIds], progress: { ...this.progress } };
  }
  restore(data) {
    if (!data) return;
    this.activeIds = data.active || [];
    this.doneIds = data.done || [];
    this.progress = data.progress || {};
  }
}

export { QuestSystem };
