// Câmera de terceira pessoa — independente, suavizada, com colisão
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { settings } from '../core/config.js';
import { input } from '../core/input.js';
import { clamp, damp, angleLerp } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

export class ThirdPersonCamera {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
    this.yaw = Math.PI;      // olhando para o norte do personagem
    this.pitch = 0.32;
    this.dist = settings.camDistance;
    this.targetDist = settings.camDistance;
    this.curPos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
    this.freeLook = false;
  }

  rotate(dx, dy) {
    const s = 0.0026 * settings.camSensitivity;
    this.yaw -= dx * s;
    this.pitch += dy * s * (settings.camInvertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.55, 1.25);
  }

  zoom(dir) {
    this.targetDist = clamp(this.targetDist + dir * 1.2, settings.camMinDist, settings.camMaxDist);
  }

  update(dt, player) {
    // ---- entrada de rotação ----
    const rightHeld = input.camRightHeld || input.touchCam.active;
    if (rightHeld) {
      const dx = input.mouse.dx + input.touchCam.dx;
      const dy = input.mouse.dy + input.touchCam.dy;
      if (dx || dy) this.rotate(dx, dy);
    }
    if (input.wheel) this.zoom(input.wheel);
    // recolhe distância
    this.dist = damp(this.dist, this.targetDist, 8, dt);

    const p = player.root.position;
    const headY = p.y + settings.camHeight;

    // ---- posição desejada ----
    const dir = _v1.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let wantDist = this.dist;
    let desired = _v2.set(p.x + dir.x * wantDist, headY + dir.y * wantDist, p.z + dir.z * wantDist);

    // ---- colisão: não atravessar terreno/objetos ----
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = p.x + dir.x * wantDist * t;
      const sy = headY + dir.y * wantDist * t;
      const sz = p.z + dir.z * wantDist * t;
      const ground = terrainHeight(sx, sz) + 0.4;
      if (sy < ground) {
        wantDist = Math.max(1.2, wantDist * t - 0.4);
        desired.set(p.x + dir.x * wantDist, ground + 0.35, p.z + dir.z * wantDist);
        break;
      }
      // colisão com prédios (esferas)
      const world = G.world;
      if (world) {
        let hit = false;
        for (const c of world.colliders) {
          if (c.r < 1.2) continue;
          const ddx = sx - c.x, ddz = sz - c.z;
          if (ddx * ddx + ddz * ddz < (c.r + 0.3) * (c.r + 0.3) && sy < terrainHeight(c.x, c.z) + 14) { hit = true; break; }
        }
        if (hit) {
          wantDist = Math.max(1.2, wantDist * t - 0.4);
          desired.set(p.x + dir.x * wantDist, headY + dir.y * wantDist, p.z + dir.z * wantDist);
          break;
        }
      }
    }

    // ---- suavização ----
    const k = 14;
    this.curPos.x = damp(this.curPos.x, desired.x, k, dt);
    this.curPos.y = damp(this.curPos.y, desired.y, k, dt);
    this.curPos.z = damp(this.curPos.z, desired.z, k, dt);
    if (this.curPos.lengthSq() === 0) this.curPos.copy(desired);

    // ---- shake ----
    this.shake = Math.max(0, this.shake - dt * 2);
    const sh = this.shake * 0.35;

    this.camera.position.set(
      this.curPos.x + rand2() * sh,
      this.curPos.y + rand2() * sh,
      this.curPos.z + rand2() * sh,
    );
    this.lookAt.x = damp(this.lookAt.x, p.x, 18, dt);
    this.lookAt.y = damp(this.lookAt.y, headY, 18, dt);
    this.lookAt.z = damp(this.lookAt.z, p.z, 18, dt);
    this.camera.lookAt(this.lookAt);
  }

  shakeIt(amount) { this.shake = Math.min(1.5, this.shake + amount); }

  // sobrepõe câmera (cinemáticas) — devolve controle depois
  overrideTo(pos, lookAt, dt, speed = 3) {
    this.camera.position.lerp(pos, Math.min(1, dt * speed));
    this.lookAt.lerp(lookAt, Math.min(1, dt * speed));
    this.camera.lookAt(this.lookAt);
  }
}

function rand2() { return (Math.random() - 0.5) * 2; }
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
