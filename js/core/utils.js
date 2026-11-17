/* =========================================================
 * Aetheria — utilidades matemáticas e procedurais
 * ========================================================= */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
/** suavização exponencial independente de framerate */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;
export const dist2 = (x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1; return dx * dx + dz * dz; };
export const dist = (x1, z1, x2, z2) => Math.sqrt(dist2(x1, z1, x2, z2));
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const smoothstep = t => t * t * (3 - 2 * t);

export function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/* ---- RNG determinístico (para o mundo) ---- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---- value noise 2D + fbm ---- */
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smoothstep(xf), v = smoothstep(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm2(x, y, oct = 4, lac = 2, gain = 0.5) {
  let f = 1, amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * f, y * f) * amp;
    norm += amp;
    f *= lac; amp *= gain;
  }
  return sum / norm;
}
