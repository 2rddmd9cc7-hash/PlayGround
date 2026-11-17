import * as THREE from 'three';
import { random } from '../core/services.js';

const goblinMat = new THREE.MeshStandardMaterial({ color: 0x68884d, roughness: .88 });
const leatherMat = new THREE.MeshStandardMaterial({ color: 0x554331, roughness: .95 });
const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8d0b1, roughness: .7 });

function makeGoblin(scene, x, z, index) {
  const root = new THREE.Group(); root.position.set(x, 0, z); root.visible = false; root.userData.index = index; scene.add(root);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.28, .4, .82, 7), goblinMat); body.position.y = .79; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 9, 7), goblinMat); head.position.set(0, 1.42, .04); head.scale.set(1, .9, .88); head.castShadow = true; root.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.15, .55, 5), goblinMat); ear.position.set(side * .38, 1.48, 0); ear.rotation.z = side * -.9; ear.castShadow = true; root.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd66d })); eye.position.set(side * .13, 1.47, .32); root.add(eye);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .43, 3, 5), leatherMat); leg.position.set(side * .16, .26, 0); leg.castShadow = true; root.add(leg);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(.34, .35, .14, 7), leatherMat); belt.position.y = .55; root.add(belt);
  const club = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .9, 6), leatherMat); club.position.set(.49, .88, .1); club.rotation.z = -.45; club.castShadow = true; root.add(club);
  const marker = new THREE.PointLight(0xff6047, 0, 4); marker.position.y = 1.3; root.add(marker);
  return { root, hp: 54, maxHp: 54, attack: 0, hurt: 0, alive: true, marker, walk: random(0, Math.PI * 2), hitThisSwing: false };
}

export class EnemySystem {
  constructor(scene, onPlayerHit = () => {}) {
    this.scene = scene; this.onPlayerHit = onPlayerHit; this.enemies = []; this.active = false;
    this.spots = [[-7.5, -24], [7.2, -28], [0, -20.5]];
    this.effects = [];
  }
  awaken() {
    if (this.active) return;
    this.active = true;
    this.enemies = this.spots.map(([x, z], i) => {
      const enemy = makeGoblin(this.scene, x, z, i); enemy.root.visible = true; return enemy;
    });
  }
  get aliveCount() { return this.enemies.filter(enemy => enemy.alive).length; }
  nearest(position, maxDistance = Infinity, direction = null, minDot = -1) {
    let best = null, bestDistance = maxDistance;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.root.position.x - position.x, dz = enemy.root.position.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > bestDistance) continue;
      if (direction && distance > .001 && (dx * direction.x + dz * direction.z) / distance < minDot) continue;
      best = enemy; bestDistance = distance;
    }
    return best ? { enemy: best, distance: bestDistance } : null;
  }
  damage(enemy, amount) {
    if (!enemy?.alive) return false;
    enemy.hp = Math.max(0, enemy.hp - amount); enemy.hurt = .2;
    enemy.marker.intensity = 2.4;
    if (enemy.hp === 0) { enemy.alive = false; enemy.root.visible = false; }
    return true;
  }
  addEffect(mesh, duration, update = null) {
    this.scene.add(mesh); this.effects.push({ mesh, duration, age: 0, update });
  }
  burst(position, color, size = 1.4) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, wireframe: true }));
    mesh.position.copy(position); mesh.position.y += .8;
    this.addEffect(mesh, .42, (effect, dt) => { effect.mesh.scale.multiplyScalar(1 + dt * 4); effect.mesh.material.opacity = Math.max(0, .8 * (1 - effect.age / effect.duration)); });
  }
  castSpell(slot, player, element, audio) {
    if (!this.active || !element) return { ok: false, reason: 'Ainda não despertou seu elemento.' };
    const spells = [
      { mana: 8, cooldown: .7, damage: 24, range: 24 },
      { mana: 18, cooldown: 4, damage: 34, range: 5.3 },
      { mana: 12, cooldown: 5, damage: 18, range: 6 },
      { mana: 28, cooldown: 9, damage: 58, range: 30 },
    ];
    const spell = spells[slot];
    if (player.mana < spell.mana) return { ok: false, reason: 'Mana insuficiente.' };
    if (player.spellCooldowns[slot] > 0) return { ok: false, reason: 'A magia ainda está recarregando.' };
    player.mana -= spell.mana; player.spellCooldowns[slot] = spell.cooldown;
    const facing = { x: Math.sin(player.visual.rotation.y), z: Math.cos(player.visual.rotation.y) };
    const origin = player.root.position;
    if (slot === 1) {
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.root.position.x - origin.x, enemy.root.position.z - origin.z) <= spell.range) {
          this.damage(enemy, spell.damage); this.burst(enemy.root.position, element.color, 1.05);
        }
      }
      this.burst(origin, element.color, 2.2);
    } else if (slot === 2) {
      const old = origin.clone(); origin.x += facing.x * spell.range; origin.z += facing.z * spell.range;
      for (const enemy of this.enemies) if (enemy.alive && Math.hypot(enemy.root.position.x - origin.x, enemy.root.position.z - origin.z) < 2.5) this.damage(enemy, spell.damage);
      const dash = new THREE.Mesh(new THREE.RingGeometry(.25, 1.2, 12), new THREE.MeshBasicMaterial({ color: element.color, side: THREE.DoubleSide, transparent: true, opacity: .75 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(old.x, .2, old.z);
      this.addEffect(dash, .5, (effect, dt) => { effect.mesh.scale.multiplyScalar(1 + dt * 3); effect.mesh.material.opacity = Math.max(0, .75 * (1 - effect.age / effect.duration)); });
    } else {
      const hit = this.nearest(origin, spell.range, facing, -.12);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(slot === 3 ? .28 : .18, 12, 9), new THREE.MeshBasicMaterial({ color: element.color }));
      const start = new THREE.Vector3(origin.x + facing.x * .8, 1.35, origin.z + facing.z * .8);
      const end = hit ? hit.enemy.root.position.clone().add(new THREE.Vector3(0, 1, 0)) : start.clone().add(new THREE.Vector3(facing.x, 0, facing.z).multiplyScalar(spell.range));
      orb.position.copy(start);
      const duration = .18 + Math.min(.38, start.distanceTo(end) / 70);
      this.addEffect(orb, duration, effect => effect.mesh.position.lerpVectors(start, end, Math.min(1, effect.age / duration)));
      if (hit) { this.damage(hit.enemy, spell.damage); this.burst(end, element.color, slot === 3 ? 1.7 : 1.1); }
    }
    audio?.play('magic');
    return { ok: true };
  }
  update(dt, player) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.attack = Math.max(0, enemy.attack - dt); enemy.hurt = Math.max(0, enemy.hurt - dt);
      enemy.marker.intensity = enemy.hurt > 0 ? 2 : 0;
      const dx = player.root.position.x - enemy.root.position.x, dz = player.root.position.z - enemy.root.position.z;
      const distance = Math.hypot(dx, dz); enemy.walk += dt * (distance > 1.65 ? 8 : 2);
      if (distance > 1.6 && distance < 34) {
        const step = Math.min(distance - 1.55, dt * 1.75);
        enemy.root.position.x += dx / distance * step; enemy.root.position.z += dz / distance * step;
        enemy.root.rotation.y = Math.atan2(dx, dz);
      } else if (distance <= 1.8 && enemy.attack <= 0) {
        enemy.attack = 1.45; enemy.hitThisSwing = false;
        if (distance < 1.65 && player.dodgeTime < .14) { this.onPlayerHit(10); enemy.hitThisSwing = true; }
      }
      enemy.root.position.y = Math.abs(Math.sin(enemy.walk)) * (distance > 1.6 ? .055 : .015);
    }
    for (const effect of this.effects) {
      effect.age += dt; effect.update?.(effect, dt);
      if (effect.age >= effect.duration) { this.scene.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose(); }
    }
    this.effects = this.effects.filter(effect => effect.age < effect.duration);
  }
}
