/* =========================================================
 * Aetheria — Salvamento local (LocalStorage com proteção)
 * ========================================================= */
const KEY = 'aetheria_save_v1';

export class SaveSystem {
  constructor(game) { this.game = game; }

  hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  saveGame() {
    const g = this.game;
    try {
      const p = g.player;
      const data = {
        version: 1,
        date: Date.now(),
        player: {
          pos: [p.root.position.x, p.root.position.y, p.root.position.z],
          level: p.level, xp: p.xp, xpNext: p.xpNext, gold: g.inventory.gold,
          hp: p.hp, mana: p.mana, stamina: p.stamina,
          element: p.element,
          attributes: p.attributes, attributePoints: p.attributePoints,
          spellLevels: p.spellLevels, spellXP: p.spellXP,
          equipment: p.equipment
        },
        inventory: g.inventory.items,
        quests: {
          active: g.quests.active.map(a => ({ id: a.id, progress: a.progress, done: a.done })),
          completed: g.quests.completed,
          flags: g.quests.flags
        },
        story: {
          chapter: g.story.chapter, stage: g.story.stage,
          testDone: g.story.testDone, invasionDone: g.story.invasionDone,
          element: g.story.element, respawnPoint: g.story.respawnPoint
        },
        world: {
          discovered: g.world.regions.filter(r => r.discovered).map(r => r.id),
          chests: g.world.chests.map(c => c.opened)
        },
        settings: g.settings,
        time: g.daynight.time
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Falha ao salvar', e);
      return false;
    }
  }

  loadGame() {
    const g = this.game;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      const p = g.player;
      // player
      p.level = d.player.level ?? 1;
      p.xp = d.player.xp ?? 0; p.xpNext = d.player.xpNext ?? 80;
      p.element = d.player.element ?? null;
      Object.assign(p.attributes, d.player.attributes || {});
      p.attributePoints = d.player.attributePoints ?? 0;
      p.spellLevels = d.player.spellLevels || {};
      p.spellXP = d.player.spellXP || {};
      p.equipment = Object.assign({ capacete: null, armadura: null, luvas: null, botas: null, capa: null, acessorio: null, arma: null }, d.player.equipment || {});
      p.recalc();
      p.hp = d.player.hp ?? p.maxHp;
      p.mana = d.player.mana ?? p.maxMana;
      p.stamina = d.player.stamina ?? p.maxStam;
      if (d.player.pos) p.root.position.set(d.player.pos[0], d.player.pos[1], d.player.pos[2]);
      // inventário
      g.inventory.items = d.inventory || [];
      g.inventory.gold = d.player.gold ?? 25;
      // quests
      g.quests.active = d.quests?.active || [];
      g.quests.completed = d.quests?.completed || [];
      g.quests.flags = d.quests?.flags || {};
      // história
      const s = d.story || {};
      g.story.chapter = s.chapter ?? 0;
      g.story.stage = s.stage ?? 'intro';
      g.story.testDone = !!s.testDone;
      g.story.invasionDone = !!s.invasionDone;
      g.story.element = s.element;
      g.story.respawnPoint = s.respawnPoint || { x: 0, z: 10 };
      if (g.story.testDone && p.element) {
        p.setElement(p.element);
        g.grimoire.appear();
        g.grimoire.setElement(p.element);
        p.giveSword();
      }
      // mundo
      if (d.world) {
        for (const id of d.world.discovered || []) {
          const r = g.world.regions.find(r => r.id === id);
          if (r) r.discovered = true;
        }
        if (d.world.chests) g.world.chests.forEach((c, i) => { c.opened = !!d.world.chests[i]; });
      }
      if (d.settings) Object.assign(g.settings, d.settings);
      g.daynight.time = d.time ?? 8;
      return true;
    } catch (e) {
      console.warn('Falha ao carregar', e);
      return false;
    }
  }

  deleteSave() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
}
