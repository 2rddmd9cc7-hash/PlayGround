/* =========================================================
 * Aetheria — Sistema de partículas (pool única, shader de pontos)
 * + anéis de choque e flashes de luz reutilizáveis
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, chance } from '../core/utils.js';

const MAX_P = 2200;

const vert = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
void main(){
  vA = alpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const frag = `
varying float vA; varying vec3 vC;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if(d > 0.5) discard;
  float a = smoothstep(0.5, 0.08, d) * vA;
  gl_FragColor = vec4(vC, a);
}`;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.count = MAX_P;
    this.pos = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.size = new Float32Array(MAX_P);
    this.alpha = new Float32Array(MAX_P);
    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.alpha0 = new Float32Array(MAX_P);
    this.cursor = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.quality = 2; // 2 alta, 1 média, 0 baixa
    this._tmpColor = new THREE.Color();
    this._ringPool = [];
    this._lightPool = [];
  }

  spawn(pos, opts = {}) {
    const n = Math.round((opts.count || 12) * (this.quality === 2 ? 1 : this.quality === 1 ? 0.55 : 0.3));
    const color = this._tmpColor.set(opts.color ?? 0xffffff);
    const speed = opts.speed ?? 3, spread = opts.spread ?? 1;
    const life = opts.life ?? 0.7, size = opts.size ?? 6;
    const grav = opts.gravity ?? 0, drag = opts.drag ?? 1.5;
    const dir = opts.dir, cone = opts.cone;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_P;
      const i3 = i * 3;
      this.pos[i3] = pos.x + rand(-spread, spread) * 0.4;
      this.pos[i3 + 1] = pos.y + rand(-spread, spread) * 0.4;
      this.pos[i3 + 2] = pos.z + rand(-spread, spread) * 0.4;
      let vx, vy, vz;
      if (dir) {
        const s = speed * rand(0.6, 1.4);
        vx = dir.x * s + rand(-1, 1) * spread; vy = dir.y * s + rand(-1, 1) * spread; vz = dir.z * s + rand(-1, 1) * spread;
      } else {
        const th = rand(0, Math.PI * 2), ph = Math.acos(rand(-1, 1));
        const s = speed * rand(0.3, 1);
        vx = Math.sin(ph) * Math.cos(th) * s;
        vy = Math.abs(Math.cos(ph)) * s * (opts.upBias ? 1.4 : 1) * 0.7 + (opts.upBias ?? 0);
        vz = Math.sin(ph) * Math.sin(th) * s;
      }
      if (cone) { vy += cone * rand(0.5, 1); }
      this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
      const vj = rand(0.75, 1.25);
      this.life[i] = life * vj; this.maxLife[i] = this.life[i];
      this.size[i] = size * rand(0.6, 1.5);
      this.grav[i] = grav; this.drag[i] = drag;
      this.alpha0[i] = opts.alpha ?? 1;
      const cvar = opts.colorJitter ?? 0.15;
      this.col[i3] = Math.min(1, color.r * (1 + rand(-cvar, cvar)));
      this.col[i3 + 1] = Math.min(1, color.g * (1 + rand(-cvar, cvar)));
      this.col[i3 + 2] = Math.min(1, color.b * (1 + rand(-cvar, cvar)));
    }
    this.alive = MAX_P; // força update; custo pequeno
  }

  /* anel de choque expandindo */
  ring(pos, { radius = 3, color = 0xffffff, life = 0.4, y = 0 } = {}) {
    let r = this._ringPool.find(x => !x.userData.busy);
    if (!r) {
      if (this._ringPool.length > 12) return;
      const geo = new THREE.RingGeometry(0.5, 0.62, 40);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      r = new THREE.Mesh(geo, mat);
      r.rotation.x = -Math.PI / 2;
      r.userData.busy = false;
      this.scene.add(r);
      this._ringPool.push(r);
    }
    r.userData.busy = true;
    r.material.color.set(color);
    r.material.opacity = 0.9;
    r.position.set(pos.x, pos.y + y, pos.z);
    r.scale.setScalar(0.1);
    r.userData.t = 0; r.userData.life = life; r.userData.maxR = radius;
    r.visible = true;
  }

  /* luz efêmera (impactos de magia) */
  flash(pos, { color = 0xffffff, intensity = 8, dist = 12, life = 0.3 } = {}) {
    let l = this._lightPool.find(x => !x.userData.busy);
    if (!l) {
      if (this._lightPool.length > 6) return;
      l = new THREE.PointLight(0xffffff, 0, 12);
      l.userData.busy = false;
      this.scene.add(l);
      this._lightPool.push(l);
    }
    l.userData.busy = true;
    l.color.set(color);
    l.position.copy(pos);
    l.intensity = intensity;
    l.distance = dist;
    l.userData.t = 0; l.userData.life = life; l.userData.i0 = intensity;
    l.visible = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX_P; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0; this.size[i] = 0;
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr + this.grav[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.alpha0[i] * f * f;
    }
    if (any) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.alpha.needsUpdate = true;
      g.attributes.size.needsUpdate = true;
      g.attributes.pcolor.needsUpdate = true;
    }
    // anéis
    for (const r of this._ringPool) {
      if (!r.userData.busy) continue;
      r.userData.t += dt;
      const f = r.userData.t / r.userData.life;
      if (f >= 1) { r.userData.busy = false; r.visible = false; continue; }
      r.scale.setScalar(0.1 + r.userData.maxR * f);
      r.material.opacity = 0.9 * (1 - f);
    }
    // luzes
    for (const l of this._lightPool) {
      if (!l.userData.busy) continue;
      l.userData.t += dt;
      const f = l.userData.t / l.userData.life;
      if (f >= 1) { l.userData.busy = false; l.visible = false; continue; }
      l.intensity = l.userData.i0 * (1 - f);
    }
  }
}

/* ---- Helpers de efeitos por elemento ---- */
export const FX = {
  fire(p, pos, big = false) {
    p.spawn(pos, { count: big ? 30 : 14, color: 0xff5a1a, colorJitter: 0.3, speed: big ? 5 : 3, spread: big ? 1.2 : 0.6, life: 0.6, size: big ? 10 : 7, gravity: 2.5, upBias: 1.5 });
    p.spawn(pos, { count: big ? 12 : 6, color: 0xffd050, speed: 2, spread: 0.5, life: 0.4, size: 5, upBias: 2 });
    p.flash(pos, { color: 0xff6a20, intensity: big ? 14 : 7, life: 0.25 });
  },
  water(p, pos, big = false) {
    p.spawn(pos, { count: big ? 26 : 12, color: 0x3aa8ff, speed: 4, spread: 0.8, life: 0.5, size: 6, gravity: 8 });
    p.spawn(pos, { count: 6, color: 0xa8e0ff, speed: 2.5, spread: 0.4, life: 0.6, size: 4 });
    p.flash(pos, { color: 0x3090ff, intensity: 8, life: 0.25 });
  },
  lightning(p, pos) {
    p.spawn(pos, { count: 20, color: 0xfff060, speed: 8, spread: 1, life: 0.3, size: 5, drag: 3 });
    p.spawn(pos, { count: 8, color: 0xffffff, speed: 10, spread: 0.6, life: 0.2, size: 4 });
    p.flash(pos, { color: 0xffffaa, intensity: 16, dist: 16, life: 0.2 });
  },
  earth(p, pos, big = false) {
    p.spawn(pos, { count: big ? 26 : 14, color: 0x9a6a3a, speed: 5, spread: 1, life: 0.7, size: 7, gravity: -7, upBias: 2 });
    p.spawn(pos, { count: 6, color: 0x5a4020, speed: 3, spread: 0.6, life: 0.8, size: 8, gravity: -6 });
    p.flash(pos, { color: 0xaa7733, intensity: 7, life: 0.3 });
  },
  wind(p, pos, big = false) {
    p.spawn(pos, { count: big ? 24 : 12, color: 0xcfe8d8, speed: 6, spread: 1.2, life: 0.5, size: 6, gravity: 0.5, upBias: 1 });
    p.spawn(pos, { count: 6, color: 0xffffff, speed: 4, spread: 0.8, life: 0.4, size: 4 });
  },
  ice(p, pos, big = false) {
    p.spawn(pos, { count: big ? 24 : 12, color: 0x9adfff, speed: 5, spread: 0.8, life: 0.6, size: 6, gravity: 5 });
    p.spawn(pos, { count: 5, color: 0xffffff, speed: 3, spread: 0.4, life: 0.5, size: 4 });
    p.flash(pos, { color: 0x88ccff, intensity: 8, life: 0.3 });
  }
};
