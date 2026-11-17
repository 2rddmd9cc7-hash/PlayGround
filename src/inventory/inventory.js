// Inventário — itens, equipamentos, loja
import { G } from '../core/state.js';
import { itemById, lootForRank, ITEMS } from '../items/items.js';
import { audio } from '../audio/audio.js';
import { randInt } from '../core/utils.js';

class Inventory {
  constructor() {
    this.tab = 'all';
    this.selected = -1;
  }

  init() {
    if (G.inventory_list.length === 0) {
      G.inventory_list.push({ id: 'pocao_vida', qty: 2 });
      G.inventory_list.push({ id: 'espada_ferro', qty: 1 });
      G.equipment.weapon = { id: 'espada_ferro', ...itemById('espada_ferro') };
      G.inventory_list = G.inventory_list.filter(i => i.id !== 'espada_ferro');
    }
  }

  addItem(id, qty = 1) {
    if (!itemById(id)) return false;
    const stackable = ['consumable', 'material', 'quest', 'book'].includes(itemById(id).type);
    if (stackable) {
      const found = G.inventory_list.find(i => i.id === id);
      if (found) { found.qty += qty; this.notifyGain(id, qty); return true; }
    }
    G.inventory_list.push({ id, qty: stackable ? qty : 1 });
    this.notifyGain(id, qty);
    return true;
  }

  removeItem(id, qty = 1) {
    const idx = G.inventory_list.findIndex(i => i.id === id);
    if (idx < 0) return false;
    const it = G.inventory_list[idx];
    if (itemById(id).type === 'weapon' || itemById(id).type === 'armor' || itemById(id).type === 'accessory') {
      G.inventory_list.splice(idx, 1);
    } else {
      it.qty -= qty;
      if (it.qty <= 0) G.inventory_list.splice(idx, 1);
    }
    return true;
  }

  count(id) {
    const f = G.inventory_list.find(i => i.id === id);
    return f ? f.qty : 0;
  }

  notifyGain(id, qty) {
    const def = itemById(id);
    G.hud?.toast(`${def.icon} ${def.name}${qty > 1 ? ` ×${qty}` : ''}`);
    G.hud?.updateAll?.();
  }

  equip(id) {
    const def = itemById(id);
    if (!def || !['weapon', 'armor', 'accessory'].includes(def.type)) return;
    const slot = def.slot;
    // remover equipado atual para o inventário
    const cur = G.equipment[slot];
    if (cur && cur.id) G.inventory_list.push({ id: cur.id, qty: 1 });
    this.removeItem(id, 1);
    G.equipment[slot] = { id, ...def };
    audio.sfx('chest');
    G.hud?.toast(`Equipado: ${def.icon} ${def.name}`, true);
    G.player?.refreshEquipment?.();
    G.hud?.updateAll?.();
  }

  unequip(slot) {
    const cur = G.equipment[slot];
    if (!cur) return;
    G.inventory_list.push({ id: cur.id, qty: 1 });
    G.equipment[slot] = null;
    G.player?.refreshEquipment?.();
    G.hud?.updateAll?.();
    audio.sfx('pageFlip');
  }

  useItem(id) {
    const def = itemById(id);
    if (!def || def.type !== 'consumable') return false;
    if (def.heal) { G.hp = Math.min(G.maxHp, G.hp + def.heal); }
    if (def.mana) { G.mp = Math.min(G.maxMp, G.mp + def.mana); }
    if (def.stamina) { G.stamina = G.maxStamina; }
    this.removeItem(id, 1);
    audio.sfx('potion');
    G.hud?.floatText?.(`+${def.heal || def.mana || ''}`, G.player.root.position, '#7dff9a');
    G.hud?.updateAll?.();
    return true;
  }

  usePotion() {
    // melhor poção de vida disponível (hotbar 5/6)
    if (this.useItem('pocao_vida')) return;
    if (this.useItem('pocao_mana')) return;
    if (this.useItem('pocao_elixir')) return;
    G.hud?.hint('Sem poções!');
  }

  sell(id) {
    const def = itemById(id);
    if (!def || def.price <= 0) return;
    const price = Math.floor(def.price * 0.5);
    if (def.type === 'weapon' || def.type === 'armor' || def.type === 'accessory') {
      this.removeItem(id, 1);
    } else {
      if (this.count(id) < 1) return;
      this.removeItem(id, 1);
    }
    G.gold += price;
    audio.sfx('coin');
    G.hud?.toast(`Vendido por ${price} 🪙`);
    G.hud?.updateAll?.();
  }

  rollLoot(rank, boss = false) {
    const id = lootForRank(rank, boss);
    if (!id) return;
    this.addItem(id, 1);
    if (boss) this.addItem('pocao_elixir', 2);
  }
}

export { Inventory };
