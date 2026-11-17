// Salvamento — LocalStorage com fallback seguro
import { settings, saveSettings } from '../core/config.js';
import { safeGet } from '../core/utils.js';

const SAVE_KEY = 'aetheria_save_v1';

const DEFAULT_SAVE = {
  version: 1,
  // personagem
  level: 1, xp: 0, gold: 0,
  hp: 100, mp: 50,
  attributes: { forca: 5, defesa: 5, velocidade: 5, mana: 5, poder: 5, resistencia: 5, critico: 5 },
  attrPoints: 0,
  element: null,
  spells: {},           // id -> { level, uses }
  equipment: { weapon: null, offhand: null, armor: null, helmet: null, gloves: null, boots: null, cape: null, accessory: null },
  inventory: [],        // { id, qty }
  // mundo / história
  chapter: 1,
  storyFlags: {},
  quests: {},           // id -> { state:'active'|'done', progress, step }
  discovered: [],
  pos: { x: 0, z: 0 },
  timeOfDay: 9,
  playtime: 0,
  grimoireLevel: 1,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // merge com padrões para tolerar saves antigos
    const merged = { ...DEFAULT_SAVE, ...data };
    merged.attributes = { ...DEFAULT_SAVE.attributes, ...(data.attributes || {}) };
    merged.equipment = { ...DEFAULT_SAVE.equipment, ...(data.equipment || {}) };
    merged.inventory_list = Array.isArray(data.inventory) ? data.inventory : (data.inventory_list || []);
    return merged;
  } catch (e) { console.warn('Save corrompido, ignorado.', e); return null; }
}

export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }

export function writeSave(state) {
  try {
    const data = {
      ...DEFAULT_SAVE,
      version: 1,
      level: state.level, xp: state.xp, gold: state.gold,
      hp: state.hp, mp: state.mp,
      attributes: { ...state.attributes }, attrPoints: state.attrPoints || 0,
      element: state.element, spells: state.spells, equipment: { ...state.equipment },
      inventory_list: (state.inventory_list || []).map(i => ({ ...i })),
      chapter: state.chapter, storyFlags: state.storyFlags,
      quests: state.quests, discovered: [...state.discovered],
      pos: state.savePos, timeOfDay: state.timeOfDay, playtime: Math.floor(state.playtime),
      grimoireLevel: state.grimoireLevel, classe: state.classe || null,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    saveSettings();
    return true;
  } catch (e) { console.warn('Falha ao salvar:', e); return false; }
}

export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
