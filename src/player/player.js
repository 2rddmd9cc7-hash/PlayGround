import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { clamp } from '../core/services.js';

const material = (color, roughness = .86, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
function mesh(geometry, color, x, y, z, parent, extra = {}) {
  const item = new THREE.Mesh(geometry, material(color, .86, extra)); item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
}

export class Player {
  constructor(scene, position = new THREE.Vector3(0, 0, 10)) {
    this.root = new THREE.Group(); this.root.position.copy(position); scene.add(this.root);
    this.visual = new THREE.Group(); this.root.add(this.visual);
    this.speed = CONFIG.player.speed; this.hp = CONFIG.player.maxHp; this.maxHp = CONFIG.player.maxHp;
    this.mana = CONFIG.player.maxMana; this.maxMana = CONFIG.player.maxMana; this.stamina = 100;
    this.level = 1; this.xp = 0; this.gold = 12; this.element = null; this.grimoire = false;
    this.attackTime = 0; this.dodgeTime = 0; this.hitFlash = 0; this.walkPhase = 0;
    this.spellCooldowns = [0, 0, 0, 0];
    this.buildModel();
  }
  buildModel() {
    const body = mesh(new THREE.CylinderGeometry(.3, .4, .94, 8), 0x536d61, 0, 1.12, 0, this.visual);
    body.scale.z = .72;
    mesh(new THREE.SphereGeometry(.31, 12, 10), 0xd7ab84, 0, 1.88, 0, this.visual);
    mesh(new THREE.SphereGeometry(.32, 10, 8), 0x49382f, 0, 2.08, -.04, this.visual).scale.set(1, .52, .94);
    mesh(new THREE.BoxGeometry(.48, .12, .48), 0x69513a, 0, 1.56, 0, this.visual);
    const leftArm = mesh(new THREE.CapsuleGeometry(.13, .52, 4, 7), 0xb48c6b, -.44, 1.12, 0, this.visual); leftArm.rotation.z = -.1;
    const rightArm = mesh(new THREE.CapsuleGeometry(.13, .52, 4, 7), 0xb48c6b, .44, 1.12, 0, this.visual); rightArm.rotation.z = .1;
    const leftLeg = mesh(new THREE.CapsuleGeometry(.14, .54, 4, 7), 0x403f3a, -.18, .42, 0, this.visual);
    const rightLeg = mesh(new THREE.CapsuleGeometry(.14, .54, 4, 7), 0x403f3a, .18, .42, 0, this.visual);
    const leftBoot = mesh(new THREE.BoxGeometry(.28, .18, .42), 0x4d382b, -.18, .1, .07, this.visual);
    const rightBoot = mesh(new THREE.BoxGeometry(.28, .18, .42), 0x4d382b, .18, .1, .07, this.visual);
    const sword = new THREE.Group(); sword.position.set(.56, 1.04, .13); this.visual.add(sword);
    mesh(new THREE.BoxGeometry(.12, .95, .09), 0xc3c5b8, 0, .45, 0, sword, { metalness: .65, roughness: .28 });
    mesh(new THREE.BoxGeometry(.42, .1, .14), 0xc19a58, 0, -.05, 0, sword);
    mesh(new THREE.CylinderGeometry(.07, .08, .28, 8), 0x493729, 0, -.23, 0, sword);
    this.limbs = { leftArm, rightArm, leftLeg, rightLeg, leftBoot, rightBoot, sword };
    this.aura = new THREE.PointLight(0xff9a4e, 0, 4); this.aura.position.y = 1.4; this.root.add(this.aura);
  }
  update(dt, input, cameraYaw, colliders, bounds) {
    this.attackTime = Math.max(0, this.attackTime - dt); this.dodgeTime = Math.max(0, this.dodgeTime - dt); this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.spellCooldowns = this.spellCooldowns.map(time => Math.max(0, time - dt));
    this.stamina = Math.min(100, this.stamina + dt * 13); this.mana = Math.min(this.maxMana, this.mana + dt * 2.6);
    let x = 0, z = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) z -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) z += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) x -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) x += 1;
    const len = Math.hypot(x, z); if (len) { x /= len; z /= len; }
    const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
    const moveX = x * c + z * s, moveZ = -x * s + z * c;
    const sprinting = input.down('ShiftLeft') && this.stamina > 1 && len > 0;
    const speed = this.speed * (sprinting ? 1.55 : 1) * (this.dodgeTime > 0 ? 2.55 : 1);
    if (len) {
      const nx = this.root.position.x + moveX * speed * dt, nz = this.root.position.z + moveZ * speed * dt;
      if (!this.collides(nx, this.root.position.z, colliders)) this.root.position.x = nx;
      if (!this.collides(this.root.position.x, nz, colliders)) this.root.position.z = nz;
      this.root.position.x = clamp(this.root.position.x, bounds.minX, bounds.maxX); this.root.position.z = clamp(this.root.position.z, bounds.minZ, bounds.maxZ);
      this.visual.rotation.y = Math.atan2(moveX, moveZ);
      this.walkPhase += dt * (sprinting ? 14 : 9);
      if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 11);
    }
    const stride = len ? Math.sin(this.walkPhase) * (sprinting ? .57 : .38) : Math.sin(performance.now() * .0018) * .035;
    this.limbs.leftLeg.rotation.x = stride; this.limbs.rightLeg.rotation.x = -stride;
    this.limbs.leftArm.rotation.x = -stride * .7; this.limbs.rightArm.rotation.x = stride * .7;
    if (this.attackTime > 0) { this.limbs.sword.rotation.x = -Math.sin((this.attackTime / .42) * Math.PI) * 1.8; this.limbs.rightArm.rotation.x = -1.6; }
    else { this.limbs.sword.rotation.x = 0; }
    this.aura.intensity = this.element ? (this.attackTime > 0 ? 2.2 : .24) : 0;
    if (this.dodgeTime > 0) this.visual.position.y = Math.sin(this.dodgeTime * 18) * .12; else this.visual.position.y = 0;
  }
  collides(x, z, colliders) {
    const r = CONFIG.player.radius;
    return colliders.some(c => Math.abs(x - c.x) < c.width / 2 + r && Math.abs(z - c.z) < c.depth / 2 + r);
  }
  attack() { if (this.attackTime > 0 || this.dodgeTime > 0) return false; this.attackTime = .42; return true; }
  dodge() { if (this.stamina < 20 || this.dodgeTime > .1) return false; this.stamina -= 20; this.dodgeTime = .48; return true; }
  takeDamage(amount) { if (this.dodgeTime > .14) return false; this.hp = Math.max(0, this.hp - amount); this.hitFlash = .2; return true; }
  gainXp(amount) {
    this.xp += amount; const required = this.level * 90;
    if (this.xp >= required) { this.xp -= required; this.level++; this.maxHp += 12; this.hp = this.maxHp; this.maxMana += 7; this.mana = this.maxMana; return true; }
    return false;
  }
}

export class CameraRig {
  constructor(camera, domElement, target) {
    this.camera = camera; this.dom = domElement; this.target = target; this.yaw = 0; this.pitch = .34; this.distance = 8.3;
    this.dragging = false; this.lastX = 0; this.lastY = 0; this.sensitivity = CONFIG.camera.sensitivity;
    this.bind();
  }
  bind() {
    this.dom.addEventListener('contextmenu', event => event.preventDefault());
    this.dom.addEventListener('pointerdown', event => { if (event.button !== 2) return; this.dragging = true; this.lastX = event.clientX; this.lastY = event.clientY; this.dom.setPointerCapture?.(event.pointerId); });
    this.dom.addEventListener('pointerup', event => { if (event.button === 2) this.dragging = false; });
    this.dom.addEventListener('pointermove', event => { if (!this.dragging) return; this.yaw -= (event.clientX - this.lastX) * this.sensitivity; this.pitch = clamp(this.pitch + (event.clientY - this.lastY) * this.sensitivity, CONFIG.camera.minPitch, CONFIG.camera.maxPitch); this.lastX = event.clientX; this.lastY = event.clientY; });
    this.dom.addEventListener('wheel', event => { this.distance = clamp(this.distance + event.deltaY * .006, CONFIG.camera.minDistance, CONFIG.camera.maxDistance); }, { passive: true });
  }
  update(dt) {
    const p = this.target.position; const aim = new THREE.Vector3(p.x, p.y + 1.3, p.z);
    const horizontal = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(p.x + Math.sin(this.yaw) * horizontal, p.y + 1.4 + Math.sin(this.pitch) * this.distance, p.z + Math.cos(this.yaw) * horizontal);
    const ray = new THREE.Vector3().subVectors(desired, aim); const length = ray.length(); ray.normalize();
    // Keep the camera from clipping through the nearest building or terrain.
    const raycaster = new THREE.Raycaster(aim, ray, .35, length);
    // Sprite.raycast needs a camera to resolve its world-space quad.
    raycaster.camera = this.camera;
    const obstacle = raycaster.intersectObjects(this.target.parent.children, true).find(hit => hit.object.name && !['power-crystal'].includes(hit.object.name));
    if (obstacle) desired.copy(aim).addScaledVector(ray, Math.max(2.4, obstacle.distance - .35));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8)); this.camera.lookAt(aim);
  }
}
