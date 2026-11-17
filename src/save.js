/* ============================================================
   Salvamento local (localStorage) — automático e manual.
   ============================================================ */
import { G, storeGet, storeSet, storeDel } from './state.js'
import { chests } from './world.js'

const KEY = 'aetheria_save_v1'

export function createSave() {
  const api = {
    lastSave: 0,
    autoT: 20,
    hasSave() {
      const d = storeGet(KEY)
      return !!(d && d.player && d.story && d.story.phase !== 'menu')
    },
    save(manual = false) {
      const p = G.player
      if (!p || G.story.phase === 'menu') return false
      const data = {
        v: 1,
        at: Date.now(),
        player: {
          hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, st: p.st, maxSt: p.maxSt,
          level: p.level, xp: p.xp, gold: p.gold, element: p.element,
          str: p.str, def: p.def, mag: p.mag, crit: p.crit,
          spellsUnlocked: p.spellsUnlocked || 1,
          weaponDmg: p.weaponDmg || 0, armorDef: p.armorDef || 0,
          pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, yaw: p.yaw,
        },
        quests: G.quests ? G.quests.serialize() : null,
        story: G.storyApi ? G.storyApi.serialize() : null,
        inventory: G.inventory ? G.inventory.serialize() : null,
        world: { hour: G.hour, day: G.day, chests: chests.map((c) => c.opened), discovered: [...(G.discovered || [])] },
        settings: { ...G.settings },
      }
      const ok = storeSet(KEY, data)
      this.lastSave = Date.now()
      if (manual && G.uiApi) G.uiApi.toast('Jogo salvo.', 'gold')
      return ok
    },
    load() {
      const d = storeGet(KEY)
      if (!d) return false
      const p = G.player
      if (!p) return false
      const pd = d.player
      Object.assign(p, {
        hp: pd.hp, maxHp: pd.maxHp, mp: pd.mp, maxMp: pd.maxMp, st: pd.st, maxSt: pd.maxSt,
        level: pd.level, xp: pd.xp, gold: pd.gold, element: pd.element,
        str: pd.str, def: pd.def, mag: pd.mag, crit: pd.crit,
        spellsUnlocked: pd.spellsUnlocked || 1,
        weaponDmg: pd.weaponDmg || 0, armorDef: pd.armorDef || 0,
      })
      p.pos.set(pd.pos.x, pd.pos.y, pd.pos.z)
      p.yaw = pd.yaw || 0
      p.dead = false
      if (d.settings) Object.assign(G.settings, d.settings)
      if (d.world) {
        G.hour = d.world.hour ?? 8.5
        G.day = d.world.day ?? 1
        G.discovered = new Set(d.world.discovered || [])
        if (Array.isArray(d.world.chests)) d.world.chests.forEach((op, i) => { if (chests[i]) chests[i].opened = op })
      }
      if (G.quests && d.quests) G.quests.load(d.quests)
      if (G.inventory && d.inventory) G.inventory.load(d.inventory)
      if (G.storyApi && d.story) G.storyApi.load(d.story)
      if (G.grimoireApi && p.element && (p.spellsUnlocked > 0)) {
        G.grimoireApi.granted = false
        G.grimoireApi.grant()
      }
      return true
    },
    delete() { storeDel(KEY) },
    update(dt) {
      this.autoT -= dt
      if (this.autoT <= 0) {
        this.autoT = 25
        if (G.story.phase !== 'menu' && G.story.phase !== 'pause' && G.player && !G.player.dead) this.save()
      }
    },
  }
  G.saveApi = api
  return api
}
