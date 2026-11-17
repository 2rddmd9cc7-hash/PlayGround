// Utilidades gerais
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const angleLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
export const fmtTime = (t) => {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
export function safeGet(obj, path, def) {
  try {
    let cur = obj;
    for (const p of path.split('.')) { if (cur == null) return def; cur = cur[p]; }
    return cur === undefined ? def : cur;
  } catch { return def; }
}
