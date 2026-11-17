/* =========================================================
 * Aetheria — Sistema elemental modular
 * Cada elemento: cor, partículas, som e 4 magias.
 * Adicionar novo elemento = adicionar uma entrada aqui.
 * ========================================================= */

export const ELEMENTS = {
  fire: {
    id: 'fire', name: 'FOGO', icon: '🔥', color: 0xff5a1a, color2: 0xffd050,
    css: '#ff7a30', theme: 'queima a vontade criadora e destruidora',
    spells: [
      { id: 'fireball', name: 'Bola de Fogo', kind: 'projectile', desc: 'Arremessa uma esfera de fogo que explode no impacto, incendiando inimigos próximos.', mana: 12, cd: 1.6, dmg: 26, radius: 2.6, speed: 16, unlock: 1, sfx: 'm_fire' },
      { id: 'embers', name: 'Chuva de Brasas', kind: 'rain', desc: 'Invoca uma chuva ardente que atinge uma área ao redor do alvo.', mana: 22, cd: 6, dmg: 14, radius: 5.5, strikes: 6, dur: 2.2, unlock: 2, sfx: 'm_fire' },
      { id: 'hellnova', name: 'Explosão Infernal', kind: 'nova', desc: 'Onda de calor que queima tudo ao redor do conjurador.', mana: 30, cd: 9, dmg: 42, radius: 6.5, unlock: 3, sfx: 'm_fireHit' },
      { id: 'meteor', name: 'Meteoro', kind: 'strike', desc: 'Chama um meteoro do céu que devasta a área visada.', mana: 45, cd: 14, dmg: 75, radius: 5, unlock: 4, sfx: 'm_fireHit' }
    ]
  },
  water: {
    id: 'water', name: 'ÁGUA', icon: '💧', color: 0x3aa8ff, color2: 0xa8e0ff,
    css: '#3aa8ff', theme: 'flui com a corrente e a cura das marés',
    spells: [
      { id: 'aqua', name: 'Projétil Aquático', kind: 'projectile', desc: 'Jato de água pressurizada que empurra e machuca o alvo.', mana: 10, cd: 1.2, dmg: 20, radius: 1.6, speed: 20, knock: 6, unlock: 1, sfx: 'm_water' },
      { id: 'oceanlance', name: 'Lança Oceânica', kind: 'projectile', desc: 'Lança perfurante de água que atravessa inimigos em linha.', mana: 20, cd: 4, dmg: 34, radius: 1.2, speed: 26, pierce: 4, unlock: 2, sfx: 'm_water' },
      { id: 'tidewave', name: 'Onda Devastadora', kind: 'cone', desc: 'Onda que avança à frente e restaura um pouco da sua vida ao acertar.', mana: 28, cd: 8, dmg: 30, radius: 6, heal: 12, unlock: 3, sfx: 'm_waterHit' },
      { id: 'prison', name: 'Prisão de Água', kind: 'zone', desc: 'aprisiona inimigos numa esfera líquida que os retarda e afoga.', mana: 35, cd: 12, dmg: 10, radius: 4.5, dur: 4, slow: 0.6, unlock: 4, sfx: 'm_water' }
    ]
  },
  lightning: {
    id: 'lightning', name: 'RAIO', icon: '⚡', color: 0xfff060, color2: 0xffffff,
    css: '#ffe050', theme: 'fere como a fúria instantânea da tempestade',
    spells: [
      { id: 'bolt', name: 'Raio', kind: 'strike', desc: 'Trovão instantâneo cai sobre o ponto visado.', mana: 12, cd: 1.5, dmg: 24, radius: 2, unlock: 1, sfx: 'm_lightning' },
      { id: 'chain', name: 'Cadeia Elétrica', kind: 'chain', desc: 'Corrente elétrica que salta entre até 4 inimigos.', mana: 24, cd: 5, dmg: 20, jumps: 4, range: 8, unlock: 2, sfx: 'm_lightning' },
      { id: 'dash', name: 'Dash Elétrico', kind: 'dash', desc: 'Transporte relâmpago que eletriza quem estiver no caminho.', mana: 16, cd: 4, dmg: 18, dist: 9, radius: 1.8, unlock: 3, sfx: 'm_lightning' },
      { id: 'storm', name: 'Tempestade Celeste', kind: 'rain', desc: 'Invoca a tempestade: raios sucessivos castigam a área.', mana: 42, cd: 14, dmg: 22, radius: 6, strikes: 8, dur: 2.6, unlock: 4, sfx: 'm_lightning' }
    ]
  },
  earth: {
    id: 'earth', name: 'TERRA', icon: '🪨', color: 0xb07a3a, color2: 0x5a4020,
    css: '#c08040', theme: 'resiste como a paciência das montanhas',
    spells: [
      { id: 'rock', name: 'Pedra Explosiva', kind: 'projectile', desc: 'Rocha lançada que se despeda em estilhaços no impacto.', mana: 14, cd: 1.8, dmg: 28, radius: 2.4, speed: 14, unlock: 1, sfx: 'm_earth' },
      { id: 'spikes', name: 'Espinhos de Terra', kind: 'line', desc: 'Fileira de espinhos rochosos que emergem à sua frente.', mana: 22, cd: 5, dmg: 30, radius: 2.2, len: 8, unlock: 2, sfx: 'm_earth' },
      { id: 'wall', name: 'Muralha de Pedra', kind: 'wall', desc: 'Ergue um muro que bloqueia inimigos e projéteis.', mana: 20, cd: 8, dmg: 0, radius: 3.5, dur: 12, unlock: 3, sfx: 'm_earth' },
      { id: 'quake', name: 'Terremoto', kind: 'nova', desc: 'A terra estremece: dano massivo e atordoamento em volta.', mana: 40, cd: 13, dmg: 46, radius: 7, stun: 2.2, unlock: 4, sfx: 'm_earth' }
    ]
  },
  wind: {
    id: 'wind', name: 'VENTO', icon: '🌪️', color: 0xcfe8d8, color2: 0x8fd0b0,
    css: '#b8e8d0', theme: 'voa com a liberdade que nenhum muro detém',
    spells: [
      { id: 'blade', name: 'Lâmina de Vento', kind: 'projectile', desc: 'Fio de ar comprimido, rápido e cortante.', mana: 9, cd: 0.9, dmg: 17, radius: 1.2, speed: 30, unlock: 1, sfx: 'm_wind' },
      { id: 'cyclone', name: 'Turbilhão', kind: 'vortex', desc: 'Redemoinho que percorre a área sugando e cortando inimigos.', mana: 22, cd: 5, dmg: 12, radius: 2.6, speed: 7, dur: 3, unlock: 2, sfx: 'm_wind' },
      { id: 'winddash', name: 'Passo do Vento', kind: 'dash', desc: 'Deslocamento veloz que deixa uma lâmina de ar por onde passa.', mana: 12, cd: 3.5, dmg: 14, dist: 10, radius: 1.6, unlock: 3, sfx: 'm_wind' },
      { id: 'hurricane', name: 'Furacão', kind: 'nova', desc: 'Furacão devastador que arremessa todos ao redor.', mana: 38, cd: 12, dmg: 40, radius: 7, knock: 12, unlock: 4, sfx: 'm_wind' }
    ]
  },
  ice: {
    id: 'ice', name: 'GELO', icon: '❄️', color: 0x9adfff, color2: 0xffffff,
    css: '#9adfff', theme: 'reina com o silêncio absoluto do inverno',
    spells: [
      { id: 'shard', name: 'Estilhaço de Gelo', kind: 'projectile', desc: 'Cristal gelado veloz que congela o alvo atingido.', mana: 10, cd: 1.3, dmg: 19, radius: 1.5, speed: 22, slow: 0.5, unlock: 1, sfx: 'm_ice' },
      { id: 'glacial', name: 'Lança Glacial', kind: 'projectile', desc: 'Lança perfurante de gelo que atravessa e congela.', mana: 20, cd: 4, dmg: 32, radius: 1.2, speed: 24, pierce: 3, slow: 0.45, unlock: 2, sfx: 'm_ice' },
      { id: 'icewall', name: 'Parede de Gelo', kind: 'wall', desc: 'Muro de gelo sólido que protege e bloqueia o caminho.', mana: 18, cd: 7, dmg: 0, radius: 3.5, dur: 10, unlock: 3, sfx: 'm_ice' },
      { id: 'glacialprison', name: 'Prisão Glacial', kind: 'zone', desc: 'Inverno absoluto: congela e prende inimigos da área.', mana: 36, cd: 12, dmg: 16, radius: 5, dur: 3.5, slow: 0.2, stun: 1.2, unlock: 4, sfx: 'm_iceHit' }
    ]
  }
};

export const ELEMENT_LIST = Object.values(ELEMENTS);
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
/** multiplicadores por rank de inimigo */
export const RANK_MULT = {
  E:  { hp: 1.0,  dmg: 1.0,  spd: 1.0,  xp: 1.0,  gold: 1.0,  iq: 0 },
  D:  { hp: 1.5,  dmg: 1.3,  spd: 1.08, xp: 1.6,  gold: 1.5,  iq: 1 },
  C:  { hp: 2.3,  dmg: 1.7,  spd: 1.15, xp: 2.6,  gold: 2.3,  iq: 2 },
  B:  { hp: 3.4,  dmg: 2.2,  spd: 1.22, xp: 4.2,  gold: 3.4,  iq: 3 },
  A:  { hp: 5.0,  dmg: 2.9,  spd: 1.3,  xp: 6.5,  gold: 5,    iq: 4 },
  S:  { hp: 7.5,  dmg: 3.8,  spd: 1.38, xp: 10,   gold: 7.5,  iq: 5 },
  SS: { hp: 11,   dmg: 5.0,  spd: 1.45, xp: 15,   gold: 11,   iq: 6 }
};

export function elementOf(id) { return ELEMENTS[id] || null; }
export function spellOf(elemId, spellId) {
  const e = ELEMENTS[elemId];
  return e ? e.spells.find(s => s.id === spellId) : null;
}
