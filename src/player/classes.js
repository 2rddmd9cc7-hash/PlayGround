// Classes de RPG — Guerreiro, Mago e Arqueiro
// Define equipamento inicial, modificadores de atributos e estilo de combate
import { G } from '../core/state.js';
import { audio } from '../audio/audio.js';
import { effects } from '../effects/effects.js';

export const CLASSES = {
  guerreiro: {
    id: 'guerreiro',
    name: 'Guerreiro',
    icon: '⚔️',
    weaponType: 'sword',
    tagline: 'Aço, escudo e coragem',
    desc: 'Mestre da espada e do escudo. Vida e defesa elevadas, combate corpo a corpo devastador. Ataque pesado com Q ou segurando o botão.',
    perks: ['+25% Vida', '+20% Stamina', 'Bloqueio reforçado', 'Força e Defesa elevadas'],
    statMods: { forca: 3, defesa: 3, resistencia: 2, velocidade: 0, mana: -1, poder: -1, critico: 0 },
    hpMult: 1.25, mpMult: 0.6, staminaMult: 1.2,
    items: ['espada_ferro', 'escudo_madeira', 'armadura_couro'],
  },
  mago: {
    id: 'mago',
    name: 'Mago',
    icon: '🪄',
    weaponType: 'staff',
    tagline: 'O saber é poder',
    desc: 'Conjurador elemental. Frágil de perto, devastador de longe. O grimório responde mais cedo e a mana flui abundante.',
    perks: ['+40% Mana', 'Magias 20% mais fortes', 'Grimório prematuro', 'Regeneração de mana acelerada'],
    statMods: { forca: -1, defesa: -1, resistencia: 0, velocidade: 0, mana: 3, poder: 3, critico: 0 },
    hpMult: 0.8, mpMult: 1.6, staminaMult: 0.9,
    items: ['cajado_aprendiz', 'capacete_couro', 'pocao_mana'],
  },
  arqueiro: {
    id: 'arqueiro',
    name: 'Arqueiro',
    icon: '🏹',
    weaponType: 'bow',
    tagline: 'Um olho, um alvo',
    desc: 'Caçador de longa distância. Flechas certeiras, passos velozes e esquivas ágeis. Letal antes que o inimigo se aproxime.',
    perks: ['+15% Stamina', '+Velocidade', 'Crítico elevado', 'Ataque à distância'],
    statMods: { forca: 1, defesa: 0, resistencia: 0, velocidade: 3, mana: 0, poder: 0, critico: 3 },
    hpMult: 1.0, mpMult: 0.9, staminaMult: 1.15,
    items: ['arco_caca', 'botas_viajante', 'capa_viajante'],
  },
};

export function classById(id) { return CLASSES[id] || null; }

// aplica a classe escolhida: modifica atributos, entrega itens (SEM equipar)
// e devolve a lista de itens entregues
export function applyClass(id) {
  const c = classById(id);
  if (!c || G.classe) return null;
  G.classe = id;
  for (const [k, v] of Object.entries(c.statMods)) {
    G.attributes[k] = Math.max(1, (G.attributes[k] || 5) + v);
  }
  for (const itemId of c.items) {
    G.inventory?.addItem(itemId, 1);
  }
  audio.sfx('levelup');
  return c;
}

// recalcular stats considera a classe (chamado por story.recalcStats)
export function classStatMults() {
  const c = classById(G.classe);
  return c ? { hpMult: c.hpMult, mpMult: c.mpMult, staminaMult: c.staminaMult } : { hpMult: 1, mpMult: 1, staminaMult: 1 };
}
