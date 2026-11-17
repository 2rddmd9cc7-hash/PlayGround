// Itens — definições, raridades, loot
export const RARITIES = {
  comum:    { name: 'Comum',    color: '#95a5a6', mult: 1.0,  weight: 50 },
  incomum:  { name: 'Incomum',  color: '#27ae60', mult: 1.3,  weight: 25 },
  raro:     { name: 'Raro',     color: '#3498db', mult: 1.7,  weight: 14 },
  epico:    { name: 'Épico',    color: '#9b59b6', mult: 2.2,  weight: 7 },
  lendario: { name: 'Lendário', color: '#e67e22', mult: 2.9,  weight: 3 },
  mitico:   { name: 'Mítico',   color: '#e74c3c', mult: 3.8,  weight: 1 },
};

export const ITEMS = {
  // armas
  espada_ferro:     { name: 'Espada de Ferro', type: 'weapon', slot: 'weapon', icon: '🗡️', rarity: 'comum', dmg: 6, price: 40, desc: 'Uma espada simples de ferreiro.' },
  espada_aco:       { name: 'Espada de Aço', type: 'weapon', slot: 'weapon', icon: '⚔️', rarity: 'incomum', dmg: 10, price: 120, desc: 'Bem forjada, equilibrada.' },
  espada_runa:      { name: 'Lâmina Rúnica', type: 'weapon', slot: 'weapon', icon: '🗡️', rarity: 'raro', dmg: 15, price: 300, desc: 'Runas brilham ao longo da lâmina.' },
  lamba_prisma:     { name: 'Lâmina Prisma', type: 'weapon', slot: 'weapon', icon: '⚔️', rarity: 'epico', dmg: 22, price: 700, desc: 'Reflete luz em mil cores.' },
  lamba_aurora:     { name: 'Lâmina da Aurora', type: 'weapon', slot: 'weapon', icon: '⚔️', rarity: 'lendario', dmg: 32, price: 1500, desc: 'Forjada com a luz do amanhecer.' },
  corte_estrelas:   { name: 'Corte-Estrelas', type: 'weapon', slot: 'weapon', icon: '🌠', rarity: 'mitico', dmg: 45, price: 3000, desc: 'Dizem que um fragmento de estrela a formou.' },
  machado_terra:    { name: 'Machado da Montanha', type: 'weapon', slot: 'weapon', icon: '🪓', rarity: 'raro', dmg: 17, price: 320, desc: 'Pesado como uma montanha.' },
  // armaduras
  armadura_couro:   { name: 'Armadura de Couro', type: 'armor', slot: 'armor', icon: '🥋', rarity: 'comum', def: 3, price: 50, desc: 'Proteção leve e barata.' },
  armadura_malha:   { name: 'Cota de Malha', type: 'armor', slot: 'armor', icon: '🛡️', rarity: 'incomum', def: 6, price: 150, desc: 'Anéis de aço entrelaçados.' },
  armadura_placas:  { name: 'Armadura de Placas', type: 'armor', slot: 'armor', icon: '🛡️', rarity: 'raro', def: 10, price: 380, desc: 'Placas de aço pesadas.' },
  armadura_dragao:  { name: 'Armadura Dracônica', type: 'armor', slot: 'armor', icon: '🐉', rarity: 'epico', def: 15, price: 800, desc: 'Escamas endurecidas de dragão.' },
  armadura_aegis:   { name: 'Égide Celeste', type: 'armor', slot: 'armor', icon: '✨', rarity: 'lendario', def: 21, price: 1600, desc: 'Bendita pelos Seis.' },
  capacete_couro:   { name: 'Capuz de Couro', type: 'armor', slot: 'helmet', icon: '🎩', rarity: 'comum', def: 1, price: 25, desc: 'Protege a cabeça do sol e das chuvas.' },
  capacete_aço:     { name: 'Elmo de Aço', type: 'armor', slot: 'helmet', icon: '⛑️', rarity: 'incomum', def: 3, price: 90, desc: 'Elmo padrão da guarda.' },
  capacete_corvo:   { name: 'Elmo do Corvo', type: 'armor', slot: 'helmet', icon: '🖤', rarity: 'epico', def: 6, price: 500, desc: 'Plumas negras dançam ao vento.' },
  luvas_couro:      { name: 'Luvas de Couro', type: 'armor', slot: 'gloves', icon: '🧤', rarity: 'comum', def: 1, price: 20, desc: 'Boas para o trabalho e para a luta.' },
  luvas_guantelete: { name: 'Guanteletes de Aço', type: 'armor', slot: 'gloves', icon: '🥊', rarity: 'raro', def: 4, price: 260, desc: 'Punhos de ferro.' },
  botas_viajante:   { name: 'Botas do Viajante', type: 'armor', slot: 'boots', icon: '👞', rarity: 'comum', def: 1, price: 22, desc: 'Resistentes a milhas de estrada.' },
  botas_vento:      { name: 'Botas do Vento', type: 'armor', slot: 'boots', icon: '🥿', rarity: 'raro', def: 3, spd: 1, price: 300, desc: 'Leves como brisa. +velocidade.' },
  capa_viajante:    { name: 'Capa Verde', type: 'armor', slot: 'cape', icon: '🧣', rarity: 'comum', def: 1, price: 30, desc: 'Camufla na floresta.' },
  capa_real:        { name: 'Capa Real', type: 'armor', slot: 'cape', icon: '👑', rarity: 'lendario', def: 4, price: 900, desc: 'Tecido dos salões de Aurelia.' },
  anel_sabio:       { name: 'Anel do Sábio', type: 'accessory', slot: 'accessory', icon: '💍', rarity: 'incomum', mpRegen: 1, price: 140, desc: 'Regenera mana mais rápido.' },
  amuleto_poder:    { name: 'Amuleto de Poder', type: 'accessory', slot: 'accessory', icon: '🔮', rarity: 'raro', poder: 3, price: 350, desc: '+3 Poder Mágico.' },
  talisma_vida:     { name: 'Talismã Vital', type: 'accessory', slot: 'accessory', icon: '❤️‍🔥', rarity: 'epico', hp: 30, price: 700, desc: '+30 HP máximo.' },
  // consumíveis
  pocao_vida:       { name: 'Poção de Vida', type: 'consumable', icon: '🧪', rarity: 'comum', price: 20, heal: 40, desc: 'Restaura 40 HP.' },
  pocao_mana:       { name: 'Poção de Mana', type: 'consumable', icon: '💧', rarity: 'comum', price: 20, mana: 30, desc: 'Restaura 30 MP.' },
  pocao_elixir:     { name: 'Elixir Maior', type: 'consumable', icon: '⚗️', rarity: 'raro', price: 90, heal: 100, mana: 60, desc: 'Restaura 100 HP e 60 MP.' },
  pergaminho_energia: { name: 'Pergaminho de Energia', type: 'consumable', icon: '📜', rarity: 'incomum', price: 60, stamina: 100, desc: 'Restaura toda a stamina.' },
  // materiais
  erva:             { name: 'Erva Medicinal', type: 'material', icon: '🌿', rarity: 'comum', price: 8, desc: 'Usada em poções de cura.' },
  minerio:          { name: 'Minério de Ferro', type: 'material', icon: '⛏️', rarity: 'comum', price: 12, desc: 'Matéria-prima do ferreiro.' },
  presa_goblin:     { name: 'Presa de Goblin', type: 'material', icon: '🦷', rarity: 'comum', price: 10, desc: 'Troféu de caça.' },
  cristal_bruto:    { name: 'Cristal Bruto', type: 'material', icon: '💎', rarity: 'raro', price: 120, desc: 'Pulsa com energia arcanas.' },
  pena_vento:       { name: 'Pena do Vento', type: 'material', icon: '🪶', rarity: 'incomum', price: 40, desc: 'Flutua contra a corrente.' },
  // missão
  selo_castelo:     { name: 'Selo do Castelo', type: 'quest', icon: '🏵️', rarity: 'comum', price: 0, desc: 'Autorização para o Teste do Poder.' },
  estandarte:       { name: 'Estandarte Roubado', type: 'quest', icon: '🏴', rarity: 'incomum', price: 0, desc: 'Estandarte da guarda levado pelos goblins.' },
  // livros
  livro_historia:   { name: 'Crônicas de Aetheria', type: 'book', icon: '📕', rarity: 'incomum', price: 0, desc: 'Relatos sobre os Seis Elementos e a antiga guerra.' },
};

export function itemById(id) { return ITEMS[id]; }

export function rollRarity(bonus = 0) {
  const entries = Object.entries(RARITIES);
  let total = 0;
  const weights = entries.map(([k, v], i) => {
    const w = v.weight * (i >= 3 ? 1 + bonus : 1);
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return 'comum';
}

// sorteia um item de equipamento por raridade
export function rollEquipment(rarity) {
  const pool = Object.entries(ITEMS).filter(([id, it]) => ['weapon', 'armor', 'accessory'].includes(it.type) && it.rarity === rarity);
  if (pool.length === 0) return null;
  return pickId(pool);
}
function pickId(pool) { return pool[Math.floor(Math.random() * pool.length)][0]; }

export function lootForRank(rank, boss = false) {
  // retorna id de item ou null
  const bonus = boss ? 2 : { E: 0, D: 0.3, C: 0.6, B: 1, A: 1.4, S: 2, SS: 2.5 }[rank] || 0;
  const rarity = rollRarity(bonus);
  if (Math.random() < 0.55) {
    const eq = rollEquipment(rarity);
    if (eq) return eq;
  }
  const consum = ['pocao_vida', 'pocao_mana', 'pergaminho_energia', 'cristal_bruto', 'pena_vento'];
  if (rarity === 'raro' || rarity === 'epico') return Math.random() < 0.5 ? 'cristal_bruto' : 'pocao_elixir';
  return consum[Math.floor(Math.random() * consum.length)];
}
