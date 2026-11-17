// Sistema de partículas e efeitos — pool única, baixa alocação
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { settings } from '../core/config.js';
import { rand } from '../core/utils.js';

const MAX_PARTICLES = 900;

class Particles {
  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.size = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) { this.size[i] = 0; this.pos[i * 3 + 1] = -9999; }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float size; varying vec3 vColor;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * (220.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vColor;
        void main(){ float d = length(gl_PointCoord - vec2(0.5)); if(d > 0.5) discard;
          float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vColor, a); }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.items = [];   // {i, x,y,z, vx,vy,vz, life, maxLife, size, r,g,b, drag, grav, fadePow}
    this.free = [];
    for (let i = 0; i < MAX_PARTICLES; i++) this.free.push(i);
    this.scale = 1;
  }
  emit(o) {
    if (this.free.length === 0) return;
    const i = this.free.pop();
    const maxLife = (o.life || 0.8);
    this.items.push({
      i, x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: maxLife, maxLife,
      size: o.size || 0.4,
      r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1,
      drag: o.drag ?? 0.9, grav: o.grav ?? 0,
      spread: o.spread || 0,
    });
  }
  burst(x, y, z, n, opts = {}) {
    const count = Math.max(1, Math.round(n * this.scale * settings.particles));
    for (let k = 0; k < count; k++) {
      const s = opts.spread ?? 1;
      this.emit({
        x, y, z,
        vx: rand(-s, s), vy: rand(opts.up ?? 0.5, (opts.up ?? 0.5) + s), vz: rand(-s, s),
        life: opts.life || rand(0.4, 0.9),
        size: opts.size || rand(0.2, 0.5),
        r: opts.r ?? 1, g: opts.g ?? 1, b: opts.b ?? 1,
        drag: opts.drag ?? 0.92, grav: opts.grav ?? 0, spread: 0,
      });
    }
  }
  update(dt) {
    for (let k = this.items.length - 1; k >= 0; k--) {
      const p = this.items[k];
      p.life -= dt;
      if (p.life <= 0) {
        this.pos[p.i * 3 + 1] = -9999; this.size[p.i] = 0;
        this.items[k] = this.items[this.items.length - 1]; this.items.pop();
        this.free.push(p.i);
        continue;
      }
      const dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = p.life / p.maxLife;
      const idx = p.i * 3;
      this.pos[idx] = p.x; this.pos[idx + 1] = p.y; this.pos[idx + 2] = p.z;
      this.col[idx] = p.r; this.col[idx + 1] = p.g; this.col[idx + 2] = p.b;
      this.size[p.i] = p.size * (0.35 + 0.65 * f);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

// efeitos de cores por elemento
export const ELEMENT_COLORS = {
  fogo:  { r: 1.0, g: 0.35, b: 0.08, hex: 0xff5515 },
  agua:  { r: 0.25, g: 0.6, b: 1.0, hex: 0x3d8bff },
  raio:  { r: 1.0, g: 0.9, b: 0.2, hex: 0xffe633 },
  terra: { r: 0.7, g: 0.45, b: 0.2, hex: 0xb37433 },
  vento: { r: 0.7, g: 1.0, b: 0.75, hex: 0xb3ffbf },
  gelo:  { r: 0.55, g: 0.85, b: 1.0, hex: 0x8cd9ff },
};

class Effects {
  constructor() {
    this.particles = new Particles();
    this.tempMeshes = [];   // { mesh, life, maxLife, shrink, fade }
    this.pool = [];         // meshes genéricos reutilizáveis (esferas)
  }
  init(scene) {
    scene.add(this.particles.points);
    this.scene = scene;
    this.scale = settings.particles;
  }
  // esfera de efeito temporária (impactos, AoE)
  flashSphere(x, y, z, radius, color, life = 0.4, opacity = 0.7) {
    let mesh = this.pool.pop();
    if (!mesh) {
      const geo = new THREE.SphereGeometry(1, 12, 10);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 6;
    }
    mesh.material.color.setHex(color);
    mesh.material.opacity = opacity;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(radius);
    mesh.visible = true;
    this.scene.add(mesh);
    this.tempMeshes.push({ mesh, life, maxLife: life, radius, opacity });
    return mesh;
  }
  // projétil mágico visual (devolve mesh controlado pelo chamador)
  makeProjectileMesh(color, radius = 0.25) {
    const geo = new THREE.SphereGeometry(radius, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.8, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.add(glow);
    return mesh;
  }
  hit(x, y, z, colorHex, n = 14, size = 0.4) {
    const c = new THREE.Color(colorHex);
    this.particles.burst(x, y, z, n, { r: c.r, g: c.g, b: c.b, spread: 3, up: 1, life: 0.55, size, grav: 4, drag: 0.9 });
    this.flashSphere(x, y, z, size * 2.4, colorHex, 0.25, 0.5);
  }
  explosion(x, y, z, colorHex, n = 40, radius = 3) {
    const c = new THREE.Color(colorHex);
    this.particles.burst(x, y, z, n, { r: c.r, g: c.g, b: c.b, spread: 6, up: 2, life: 0.9, size: 0.6, grav: 3, drag: 0.88 });
    this.flashSphere(x, y, z, radius, colorHex, 0.5, 0.75);
    this.flashSphere(x, y, z, radius * 0.55, 0xffffff, 0.22, 0.9);
  }
  update(dt) {
    this.particles.update(dt);
    for (let i = this.tempMeshes.length - 1; i >= 0; i--) {
      const t = this.tempMeshes[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.pool.push(t.mesh);
        this.tempMeshes.splice(i, 1);
        continue;
      }
      const f = t.life / t.maxLife;
      t.mesh.scale.setScalar(t.radius * (0.35 + 0.75 * (1 - f) + 0.25 * f));
      t.mesh.material.opacity = t.opacity * f;
    }
  }
}

export const effects = new Effects();
