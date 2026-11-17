export const CONFIG = {
  player: { speed: 5.2, sprint: 1.65, radius: 0.42, maxHp: 100, maxMana: 80 },
  camera: { distance: 7.4, minDistance: 3.2, maxDistance: 12, sensitivity: 0.0032, minPitch: -0.02, maxPitch: 0.92 },
  world: { size: 190, dayLength: 300 },
};

export const ELEMENTS = [
  { id: 'fire', name: 'Fogo', glyph: '♨', color: 0xff753d, glow: '#ff753d', sound: 180 },
  { id: 'water', name: 'Água', glyph: '◉', color: 0x55c9e8, glow: '#55c9e8', sound: 420 },
  { id: 'lightning', name: 'Raio', glyph: 'ϟ', color: 0xffdc58, glow: '#ffdc58', sound: 520 },
  { id: 'earth', name: 'Terra', glyph: '⬟', color: 0xb58a5b, glow: '#b58a5b', sound: 110 },
  { id: 'wind', name: 'Vento', glyph: '〰', color: 0xa2e7ca, glow: '#a2e7ca', sound: 340 },
  { id: 'ice', name: 'Gelo', glyph: '❄', color: 0x9beaff, glow: '#9beaff', sound: 640 },
];

export const SPELLS = [
  { name: 'Rajada Arcana', icon: '✦', mana: 8, cooldown: 0.7, damage: 24, range: 24, description: 'Um projétil do seu elemento.' },
  { name: 'Pulso Elemental', icon: '✺', mana: 18, cooldown: 4, damage: 34, range: 9, description: 'Uma explosão ao redor do conjurador.' },
  { name: 'Passo Místico', icon: '➤', mana: 12, cooldown: 5, damage: 18, range: 7, description: 'Avance envolto em energia elemental.' },
  { name: 'Ruptura Arcana', icon: '✹', mana: 28, cooldown: 9, damage: 58, range: 30, description: 'Concentre poder em um disparo devastador.' },
];

export const SAVE_KEY = 'aetheria-save-v1';
