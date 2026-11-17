/* =========================================================
 * Aetheria — Inventário, itens, equipamentos, loot e lojas
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, randi, chance, pick, clamp } from '../core/utils.js';

export const RARITY = {
  com: { name: 'Comum', css: 'r-com', mult: 1 },
  unc: { name: 'Incomum', css: 'r-unc', mult: 1.25 },
  rar: { name: 'Raro', css: 'r-rar', mult: 1.6 },
  epi: { name: 'Épico', css: 'r-epi', mult: 2.1 },
  len: { name: 'Lendário', css: 'r-len', mult: 2.9 },
  mit: { name: 'Mítico', css: 'r-mit', mult: 4 }
};

/* ---------- banco de itens ---------- */
export const ITEMS = {
  /* armas */
  sword_rust:   { name: 'Espada Enferrujada', icon: '🗡️', type: 'weapon', slot: 'arma', rarity: 'com', price: 20, desc: 'Uma lâmina velha da vila. Melhor que as mãos.', stats: { atk: 4 } },
  sword_iron:   { name: 'Espada de Ferro', icon: '⚔️', type: 'weapon', slot: 'arma', rarity: 'unc', price: 80, desc: 'Forjada pelo Ferreiro Doren.', stats: { atk: 9 } },
  sword_steel:  { name: 'Espada de Aço Valórico', icon: '⚔️', type: 'weapon', slot: 'arma', rarity: 'rar', price: 240, desc: 'Aço fino da cidadela.', stats: { atk: 16, crit: 1 } },
  sword_rune:   { name: 'Lâmina Rúnica', icon: '🗡️', type: 'weapon', slot: 'arma', rarity: 'epi', price: 700, desc: 'Runas antigas brilham ao entardecer.', stats: { atk: 26, crit: 2, magic: 2 } },
  sword_dawn:   { name: 'Alvorada, Lâmina do Herói', icon: '🌟', type: 'weapon', slot: 'arma', rarity: 'len', price: 2000, desc: 'Dizem que só responde a um verdadeiro herói.', stats: { atk: 40, crit: 3, magic: 4 } },
  /* armaduras */
  helm_leather: { name: 'Capuz de Couro', icon: '🧢', type: 'armor', slot: 'capacete', rarity: 'com', price: 15, desc: 'Protege da chuva e de pouca coisa mais.', stats: { def: 2 } },
  helm_iron:    { name: 'Elmo de Ferro', icon: '🪖', type: 'armor', slot: 'capacete', rarity: 'unc', price: 60, desc: 'Pesado, mas confiável.', stats: { def: 5, hp: 10 } },
  chest_cloth:  { name: 'Túnica de Viajante', icon: '👕', type: 'armor', slot: 'armadura', rarity: 'com', price: 18, desc: 'Confortável para longas jornadas.', stats: { def: 3, hp: 5 } },
  chest_chain:  { name: 'Cota de Malha', icon: '🥼', type: 'armor', slot: 'armadura', rarity: 'unc', price: 90, desc: 'Anéis de ferro entrelaçados.', stats: { def: 8, hp: 15 } },
  chest_plate:  { name: 'Armadura de Placas', icon: '🛡️', type: 'armor', slot: 'armadura', rarity: 'rar', price: 300, desc: 'Forjada para os cavaleiros de Valoria.', stats: { def: 14, hp: 30 } },
  gloves_leather: { name: 'Luvas de Couro', icon: '🧤', type: 'armor', slot: 'luvas', rarity: 'com', price: 12, desc: 'Boa aderência na empunhadura.', stats: { def: 2, atk: 1 } },
  boots_travel: { name: 'Botas de Estrada', icon: '🥾', type: 'armor', slot: 'botas', rarity: 'com', price: 14, desc: 'Já caminharam por meio Aetheria.', stats: { def: 2, spd: 3 } },
  boots_swift:  { name: 'Botas Ligeiras', icon: '👟', type: 'armor', slot: 'botas', rarity: 'rar', price: 180, desc: 'Encantadas para passos velozes.', stats: { def: 4, spd: 8 } },
  cape_red:     { name: 'Capa Escarlate', icon: '🧣', type: 'armor', slot: 'capa', rarity: 'unc', price: 70, desc: 'Ossos de vento ao redor do pescoço.', stats: { def: 3, hp: 8 } },
  amulet_mana:  { name: 'Amuleto das Marés', icon: '📿', type: 'accessory', slot: 'acessorio', rarity: 'rar', price: 200, desc: 'Aumenta a reserva de mana.', stats: { mana: 25, magic: 2 } },
  ring_power:   { name: 'Anel do Poder Arcano', icon: '💍', type: 'accessory', slot: 'acessorio', rarity: 'epi', price: 600, desc: 'A magia flui mais forte pelo portador.', stats: { magic: 5, mana: 15 } },
  /* consumíveis */
  potion_hp:    { name: 'Poção de Vida', icon: '🧪', type: 'consumable', rarity: 'com', price: 25, desc: 'Restaura 45 de vida.', heal: 45 },
  potion_hp2:   { name: 'Poção Maior de Vida', icon: '🍷', type: 'consumable', rarity: 'unc', price: 70, desc: 'Restaura 110 de vida.', heal: 110 },
  potion_mp:    { name: 'Poção de Mana', icon: '💧', type: 'consumable', rarity: 'com', price: 30, desc: 'Restaura 40 de mana.', mana: 40 },
  elixir:       { name: 'Elixir do Herói', icon: '⚗️', type: 'consumable', rarity: 'rar', price: 150, desc: 'Restaura vida e mana por completo.', heal: 999, mana: 999 },
  scroll_tp:    { name: 'Pergaminho de Retorno', icon: '📜', type: 'consumable', rarity: 'unc', price: 50, desc: 'Teleporta você para a vila inicial.', scroll: 'village' },
  /* materiais */
  mat_goblin:   { name: 'Orelha de Goblin', icon: '👂', type: 'material', rarity: 'com', price: 6, desc: 'Prova de caça. Os guardas pagam por elas.' },
  mat_wolf:     { name: 'Pele de Lobo', icon: '🐺', type: 'material', rarity: 'com', price: 9, desc: 'Pele grossa e quente.' },
  mat_herb:     { name: 'Erva Curativa', icon: '🌿', type: 'material', rarity: 'com', price: 8, desc: 'Usada em poções de vida.' },
  mat_ore:      { name: 'Minério de Ferro', icon: '🪨', type: 'material', rarity: 'com', price: 12, desc: 'Matéria-prima para forjas.' },
  mat_crystal:  { name: 'Fragmento Arcano', icon: '💎', type: 'material', rarity: 'rar', price: 60, desc: 'Hum baixo de energia arcana.' },
  mat_umbra:    { name: 'Selo de Umbra', icon: '🌑', type: 'material', rarity: 'epi', price: 120, desc: 'Marca sombria do reino inimigo.' },
  /* missão */
  quest_letter: { name: 'Carta do Ancião', icon: '✉️', type: 'quest', rarity: 'com', price: 0, desc: 'Entregue ao Capitão Rhys na cidadela.' },
  quest_shard:  { name: 'Estilhaço do Cristal', icon: '🔮', type: 'quest', rarity: 'epi', price: 0, desc: 'Um fragmento que pulsa com o seu elemento.' },
  /* livros */
  book_history: { name: 'Crônicas de Aetheria', icon: '📕', type: 'book', rarity: 'unc', price: 40, desc: 'História dos reinos e da Grande Guerra.' }
};

export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = [];   // {id, qty}
    this.gold = 25;
  }
  addStarter() {
    this.addItem('potion_hp', 2);
  }
  addItem(id, qty = 1) {
    if (!ITEMS[id]) { console.warn('Item desconhecido', id); return false; }
    const slot = this.items.find(i => i.id === id);
    if (slot) slot.qty += qty;
    else this.items.push({ id, qty });
    this.game.hud.refreshHotbar();
    return true;
  }
  count(id) { const s = this.items.find(i => i.id === id); return s ? s.qty : 0; }
  removeItem(id, qty = 1) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx < 0) return false;
    this.items[idx].qty -= qty;
    if (this.items[idx].qty <= 0) this.items.splice(idx, 1);
    this.game.hud.refreshHotbar();
    return true;
  }
  addGold(n) {
    this.gold = Math.max(0, this.gold + n);
    this.game.hud.refreshGold();
  }
  usePotion(kind) {
    const id = kind === 'hp' ? 'potion_hp' : 'potion_mp';
    if (this.count(id) <= 0) {
      const alt = kind === 'hp' ? 'potion_hp2' : null;
      if (alt && this.count(alt) > 0) return this.useItem(alt);
      this.game.hud.toast('Você não tem poções desse tipo.');
      return false;
    }
    return this.useItem(id);
  }
  useItem(id) {
    const def = ITEMS[id];
    if (!def) return false;
    const p = this.game.player;
    if (def.type === 'consumable') {
      if (def.heal) { p.heal(def.heal); this.game.audio.play('potion'); }
      if (def.mana) { p.mana = Math.min(p.maxMana, p.mana + def.mana); this.game.audio.play('potion'); }
      if (def.scroll === 'village') {
        p.root.position.set(0, this.game.world.terrainHeight(0, 8), 8);
        this.game.hud.toast('O pergaminho te devolve à vila. ✨');
        this.game.fx.ring(p.root.position, { radius: 2, color: 0x8a5aff, life: 0.6 });
      }
      this.removeItem(id);
      return true;
    }
    return false;
  }
  equipItem(id) {
    const def = ITEMS[id];
    if (!def || !def.slot) return;
    const p = this.game.player;
    const current = p.equipment[def.slot];
    if (current) this.addItem(current.id);
    p.equipment[def.slot] = { id, ...def };
    this.removeItem(id);
    p.recalc();
    if (def.slot === 'arma') p.giveSword();
    this.game.hud.toast(`Equipado: ${def.name}`);
    this.game.audio.play('ui');
    this.game.hud.renderInventory();
  }
  unequip(slot) {
    const p = this.game.player;
    const cur = p.equipment[slot];
    if (!cur) return;
    p.equipment[slot] = null;
    this.addItem(cur.id);
    p.recalc();
    this.game.hud.renderInventory();
  }
  sellItem(id) {
    const def = ITEMS[id];
    if (!def || def.type === 'quest') return;
    const price = Math.max(1, Math.floor((def.price || 5) * 0.4));
    this.removeItem(id);
    this.addGold(price);
    this.game.audio.play('coin');
    this.game.hud.toast(`Vendido por ${price} 🪙`);
    this.game.hud.renderInventory();
  }
  buyItem(id) {
    const def = ITEMS[id];
    if (!def) return;
    if (this.gold < def.price) { this.game.hud.toast('Ouro insuficiente!'); return; }
    this.addGold(-def.price);
    this.addItem(id);
    this.game.audio.play('coin');
    this.game.hud.toast(`Comprado: ${def.name}`);
  }
}

/* ---------- Loot: drops físicos com brilho por raridade ---------- */
export class LootManager {
  constructor(game) {
    this.game = game;
    this.pickups = [];
  }
  dropLoot(enemy) {
    const g = this.game;
    //Chance de equipamento (raro!) ou poção/material
    const rolls = [];
    if (chance(0.14)) rolls.push(this.randomEquip(enemy));
    if (chance(0.3)) rolls.push(pick(['potion_hp', 'potion_mp']));
    if (chance(0.5)) rolls.push(this.randomMaterial(enemy));
    if (chance(0.04 + (enemy.rank === 'B' || enemy.rank === 'A' ? 0.08 : 0))) rolls.push(pick(['sword_iron', 'helm_iron', 'chest_chain', 'cape_red', 'amulet_mana']));
    if (enemy.isBoss) { rolls.push('sword_steel', 'chest_plate', 'elixir'); }
    for (const id of rolls) this.spawnPickup(id, enemy.root.position, g);
  }
  randomEquip(enemy) {
    return pick(['sword_rust', 'helm_leather', 'chest_cloth', 'gloves_leather', 'boots_travel', 'potion_hp']);
  }
  randomMaterial(enemy) {
    const t = enemy.typeId;
    if (t.startsWith('goblin')) return 'mat_goblin';
    if (t === 'wolf') return 'mat_wolf';
    return pick(['mat_herb', 'mat_ore', 'mat_goblin']);
  }
  spawnPickup(id, pos, g) {
    const def = ITEMS[id];
    if (!def) return;
    const color = { com: 0xd8d8d8, unc: 0x5aff5a, rar: 0x5a8aff, epi: 0xb05aff, len: 0xffb020, mit: 0xff5080 }[def.rarity];
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.add(core, glow);
    const base = g.world.terrainHeight(pos.x, pos.z);
    mesh.position.set(pos.x + rand(-1, 1), base + 0.6, pos.z + rand(-1, 1));
    g.scene.add(mesh);
    this.pickups.push({ mesh, id, t: rand(0, 6), base });
  }
  update(dt) {
    const g = this.game, p = g.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y = pk.base + 0.6 + Math.sin(pk.t * 2.4) * 0.12;
      if (p.root.position.distanceTo(pk.mesh.position) < 1.6) {
        g.inventory.addItem(pk.id);
        const def = ITEMS[pk.id];
        g.hud.toast(`Obtido: <b>${def.name}</b> ${def.icon}`);
        g.audio.play('coin', 0.7);
        if (def.rarity !== 'com') g.fx.spawn(pk.mesh.position, { count: 14, color: 0xf5d97a, speed: 3, life: 0.6, size: 5, gravity: 2 });
        g.quests.onCollect(pk.id);
        g.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }
}

/* ---------- Lojas ---------- */
export const SHOPS = {
  smith: {
    title: 'Forja de Doren',
    items: ['sword_iron', 'helm_iron', 'chest_chain', 'gloves_leather', 'boots_travel'],
    greet: 'Aço honesto para heróis honestos. O que precisa?'
  },
  general: {
    title: 'Comércio de Lysa',
    items: ['potion_hp', 'potion_hp2', 'potion_mp', 'cape_red', 'scroll_tp', 'book_history'],
    greet: 'Ervas, poções e rumores — tudo tem preço!'
  },
  castle: {
    title: 'Mercado do Castelo',
    items: ['potion_hp2', 'elixir', 'sword_steel', 'chest_plate', 'boots_swift', 'amulet_mana'],
    greet: 'Bem-vindo ao mercado da cidadela.'
  },
  umbra: {
    title: 'Mercador Sombrio',
    items: ['sword_rune', 'ring_power', 'elixir', 'potion_hp2'],
    greet: 'Khehe… itens que os reis não ousam vender.'
  }
};
