/* =========================================================
 * Aetheria — Câmera terceira pessoa cinematográfica
 * NÃO gira automaticamente com o movimento (WASD é relativo à câmera,
 * mas a câmera só gira por input do mouse botão-direito).
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { clamp, damp, lerp } from '../core/utils.js';

export class CameraCtl {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = -0.28;
    this.dist = 7.5;
    this.targetDist = 7.5;
    this.minDist = 3.2;
    this.maxDist = 14;
    this.sensitivity = 1;
    this.invertY = false;
    this.smoothPos = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.firstUpdate = true;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.fovBase = 60;
    this._curTarget = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this.cinematic = null; // {pos, look, dur, t} sobrepõe tudo
    this._init = false;
  }
  addShake(amp) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = 0.35; }

  update(dt, game) {
    const input = game.input;
    // --- input de rotação (só botão direito ou toque) ---
    const [dx, dy] = input.cameraDelta();
    const sens = this.sensitivity * 0.0032;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.25, 0.7);
    // zoom
    if (input.wheel) this.targetDist = clamp(this.targetDist + input.wheel * 1.1, this.minDist, this.maxDist);

    // --- cinematográfica sobrepõe ---
    if (this.cinematic) {
      const c = this.cinematic;
      c.t += dt;
      const f = clamp(c.t / c.dur, 0, 1);
      this.cam.position.lerpVectors(c.fromPos, c.toPos, f * f * (3 - 2 * f));
      this._curTarget.lerpVectors(c.fromLook, c.toLook, f * f * (3 - 2 * f));
      this.cam.lookAt(this._curTarget);
      if (c.t >= c.dur + (c.hold || 0)) this.cinematic = null;
      return;
    }

    this.dist = damp(this.dist, this.targetDist, 8, dt);
    const target = game.player ? game.player.cameraFocus() : this._curTarget;
    this._curTarget.lerp(target, 1 - Math.exp(-14 * dt));

    // posição esférica desejada
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._desired.set(
      this._curTarget.x + Math.sin(this.yaw) * cp * this.dist,
      this._curTarget.y - sp * this.dist + 1.2,
      this._curTarget.z + Math.cos(this.yaw) * cp * this.dist
    );

    // --- colisão: marcha do alvo até a câmera contra terreno e colisores ---
    let d = this.dist;
    const dir = this._desired.clone().sub(this._curTarget);
    const len = dir.length(); dir.normalize();
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * len;
      const px = this._curTarget.x + dir.x * t, py = this._curTarget.y + dir.y * t, pz = this._curTarget.z + dir.z * t;
      let hit = false;
      const th = game.world.terrainHeight(px, pz) + 0.5;
      if (py < th) hit = true;
      if (!hit) {
        for (const c of game.world.colliders) {
          const ddx = px - c.x, ddz = pz - c.z;
          if (ddx * ddx + ddz * ddz < c.r * c.r && py < c.top) { hit = true; break; }
        }
      }
      if (hit) { d = Math.max(1.6, t - 0.55); break; }
    }
    if (d < this.dist) {
      this._desired.copy(this._curTarget).addScaledVector(dir, d);
    }

    // suavização
    if (!this._init) { this.smoothPos.copy(this._desired); this._init = true; }
    else this.smoothPos.lerp(this._desired, 1 - Math.exp(-11 * dt));

    this.cam.position.copy(this.smoothPos);
    // shake
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / 0.35);
      this.cam.position.x += (Math.random() - 0.5) * a;
      this.cam.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.cam.lookAt(this._curTarget);

    // FOV dinâmico sutil ao correr
    const wantFov = game.player && game.player.sprinting ? this.fovBase + 6 : this.fovBase;
    this.cam.fov = damp(this.cam.fov, wantFov, 4, dt);
    this.cam.updateProjectionMatrix();
  }

  /* direção horizontal "para frente" da câmera (referência de mira) */
  aimDir(out) {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-1);
    return out;
  }

  startCinematic(toPos, toLook, dur, hold = 0.6) {
    this.cinematic = {
      fromPos: this.cam.position.clone(), fromLook: this._curTarget.clone(),
      toPos: toPos.clone(), toLook: toLook.clone(), dur, t: 0, hold
    };
  }
}
