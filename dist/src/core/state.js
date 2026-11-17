// Estado global compartilhado (serviço simples para evitar imports circulares)
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  world: null,
  sky: null,
  enemies: null,      // EnemyManager
  npcs: null,         // NPCManager
  quests: null,
  inventory: null,
  hud: null,
  story: null,
  grimoire: null,
  effects: null,
  ui: null,
  timeOfDay: 9,       // 0-24
  playtime: 0,
  paused: false,      // menu/inventário aberto
  combatMusic: 0,     // contador de agressão p/ música
  savePos: { x: 0, z: 0 },
  mobile: false,

  // ---- status do jogador ----
  level: 1, xp: 0, gold: 50, hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100,
  attributes: { forca: 5, defesa: 5, velocidade: 5, mana: 5, poder: 5, resistencia: 5, critico: 5 },
  attrPoints: 0,
  element: null,
  spells: {},           // spellId -> { level:1, uses:0 }
  equipment: { weapon: null, armor: null, helmet: null, gloves: null, boots: null, cape: null, accessory: null },
  inventory_list: [],
  magic: null,
  projectiles: null,
  chapter: 1,
  storyFlags: {},
  quests: {},
  discovered: [],
  grimoireLevel: 1,
};
