// Projéteis inimigos — flechas, bolas sombrias (pool simples)
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { effects } from '../effects/effects.js';
import { terrainHeight } from '../world/terrain.js';

class EnemyProjectiles {
  constructor() {
    this.list = [];
  }

  _makeMesh(color, r) {
    const geo = new THREE.SphereGeometry(r, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    return new THREE.Mesh(geo, mat);
  }

  enemyArrow(from, to, dmg) {
    const mesh = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
    shaft.rotation.x = Math.PI / 2;
    mesh.add(shaft);
    mesh.position.copy(from);
    G.scene.add(mesh);
    const dir = to.clone().sub(from).normalize();
    this.list.push({ mesh, dir, speed: 26, dmg, life: 3, grav: 3, color: 0x8a6a3a, arrow: true });
  }

  enemyBolt(from, to, dmg, color) {
    const mesh = this._makeMesh(color, 0.24);
    mesh.position.copy(from);
    G.scene.add(mesh);
    const dir = to.clone().sub(from).normalize();
    this.list.push({ mesh, dir, speed: 14, dmg, life: 4, grav: 0, color });
  }

  update(dt) {
    const pl = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.grav) p.dir.y -= p.grav * 0.02;
      p.mesh.position.addScaledVector(p.dir, p.speed * dt);
      if (p.arrow) p.mesh.lookAt(p.mesh.position.clone().add(p.dir));
      let done = p.life <= 0;
      const plPos = new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1, pl.root.position.z);
      if (!done && p.mesh.position.distanceTo(plPos) < 1.0) {
        const dir2 = new THREE.Vector3(p.dir.x, 0, p.dir.z).normalize();
        pl.takeDamage(p.dmg, { x: dir2.x, z: dir2.z, kb: 3 });
        effects.hit(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.color, 8, 0.3);
        done = true;
      }
      if (!done && p.mesh.position.y < terrainHeight(p.mesh.position.x, p.mesh.position.z) + 0.1) {
        effects.hit(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0x8a7a5a, 5, 0.2);
        done = true;
      }
      if (done) {
        G.scene.remove(p.mesh);
        this.list.splice(i, 1);
      }
    }
  }
}

export { EnemyProjectiles };
