/* ============================================================
   Inventário — itens, equipamentos e uso.
   ============================================================ */
import { G } from './state.js'
import { sfx } from './audio.js'

export const RARITY_COLORS = {
  Comum: '#c8c0a8', Incomum: '#7ac855', Raro: '#5590e8', Épico: '#b06ae8', Lendário: '#e8a830', Mítico: '#e85580',
}
const RARITY_POWER = { Comum: 1, Incomum: 1.6, Raro: 2.4, Épico: 3.4, Lendário: 4.6, Mítico: 6 }

export function createInventory() {
  const inv = {
    items: [],
    equipped: { weapon: null, armor: null },
    add(item) {
      if (!item) return
      const same = this.items.find((i) => i.name === item.name && i.kind === item.kind)
      if (same) same.qty = (same.qty || 1) + (item.qty || 1)
      else this.items.push({ ...item, qty: item.qty || 1 })
      if (G.uiApi) G.uiApi.refreshHotbar()
    },
    remove(name, qty = 1) {
      const it = this.items.find((i) => i.name === name)
      if (!it) return false
      it.qty -= qty
      if (it.qty <= 0) this.items.splice(this.items.indexOf(it), 1)
      if (G.uiApi) G.uiApi.refreshHotbar()
      return true
    },
    count(name) {
      return this.items.filter((i) => i.name === name).reduce((s, i) => s + (i.qty || 1), 0)
    },
    equip(item) {
      if (!item) return
      if (item.kind === 'weapon') {
        this.equipped.weapon = item
        G.player.weaponDmg = 4 + (RARITY_POWER[item.rarity] || 1) * 2
        sfx('ui')
        if (G.uiApi) G.uiApi.toast(`Equipado: ${item.name}`, 'gold')
      } else if (item.kind === 'armor') {
        this.equipped.armor = item
        G.player.armorDef = (RARITY_POWER[item.rarity] || 1) * 1.5
        sfx('ui')
        if (G.uiApi) G.uiApi.toast(`Equipado: ${item.name}`, 'gold')
      }
    },
    serialize() { return { items: this.items, equipped: this.equipped } },
    load(d) {
      if (!d) return
      this.items = d.items || []
      this.equipped = d.equipped || { weapon: null, armor: null }
      if (this.equipped.weapon && G.player) G.player.weaponDmg = 4 + (RARITY_POWER[this.equipped.weapon.rarity] || 1) * 2
      if (this.equipped.armor && G.player) G.player.armorDef = (RARITY_POWER[this.equipped.armor.rarity] || 1) * 1.5
    },
  }
  G.inventory = inv
  return inv
}
