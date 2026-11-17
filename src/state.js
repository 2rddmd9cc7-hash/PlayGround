/* ============================================================
   CRÔNICAS DE AETHERIA — estado compartilhado
   Ponto único de verdade entre os sistemas.
   ============================================================ */

export const G = {
  // motor
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  input: null,
  audio: null,
  clock: null,

  // mundo
  worldApi: null, // { heightAt, addCollider, resolveCircle, regionAt, pois, waterLevel }
  colliders: [],
  colliderGrid: null,
  lampMats: [], // materiais que brilham à noite
  firePits: [], // fontes de fogo/tochas

  // entidades
  player: null,
  enemies: [],
  npcs: [],
  projectiles: [],
  effects: null,

  // sistemas
  quests: null,
  inventory: null,
  saveApi: null,
  uiApi: null,
  grimoireApi: null,

  // tempo e clima
  day: 1,
  hour: 8.5, // 0..24
  weather: { type: 'clear', intensity: 0, changeIn: 120 },

  // fluxo
  story: {
    chapter: 0, // 0 = aguardando início
    phase: 'menu', // menu | village | toCastle | test | invasion | openWorld
    flags: {},
  },
  region: 'Vila de Pedravale',
  paused: false,
  timeScale: 1,
  combatTimer: 0, // música de combate
  running: false,

  // configurações
  settings: {
    sensitivity: 1.0,
    camDist: 5.2,
    invertY: false,
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    shadows: 'alta',
  },

  // spacial
  playerCell: { x: 0, z: 0 },
};

export const WORLD_SIZE = 250; // metade do lado (mundo vai de -250..250)

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/* ---------- colisores (cilindros) ---------- */

const CELL = 12;

export function addCollider(x, z, r, h = 3, y0 = 0) {
  const c = { x, z, r, h, y0 };
  G.colliders.push(c);
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      const key = `${cx + i},${cz + j}`;
      if (!G.colliderGrid.has(key)) G.colliderGrid.set(key, []);
      G.colliderGrid.get(key).push(c);
    }
  }
  return c;
}

export function collidersNear(x, z, out = []) {
  out.length = 0;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      const list = G.colliderGrid.get(`${cx + i},${cz + j}`);
      if (list) for (const c of list) if (!out.includes(c)) out.push(c);
    }
  }
  return out;
}

const _near = [];
export function resolveCircle(pos, radius) {
  const list = collidersNear(pos.x, pos.z, _near);
  for (const c of list) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + radius;
    if (d < min && d > 0.0001) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
}

export function pointBlocked(x, y, z, pad = 0.35) {
  const list = collidersNear(x, z, _near);
  for (const c of list) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + pad && y > c.y0 - 0.2 && y < c.y0 + c.h + 0.2) return true;
  }
  return false;
}

/* ---------- armazenamento seguro ---------- */

export function storeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento */
  }
}

export function storeDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
