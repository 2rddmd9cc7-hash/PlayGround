/* =========================================================
 * Aetheria — Fusão de geometria estática (reduz draw calls)
 * Concatena malhas estáticas de um grupo por material.
 * Objetos animados devem marcar userData.noMerge = true.
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';

export function mergeGroup(group, scene) {
  try {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    const remove = [];
    group.traverse(o => {
      if (o.isMesh && !o.userData.noMerge && o.geometry && o.material) {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const key = o.material.uuid;
        if (!buckets.has(key)) buckets.set(key, { mat: o.material, pos: [], nor: [] });
        const b = buckets.get(key);
        b.pos.push(g.attributes.position.array);
        b.nor.push(g.attributes.normal ? g.attributes.normal.array : null);
        remove.push(o);
      }
    });
    if (remove.length < 4) return 0; // não compensa
    for (const o of remove) if (o.parent) o.parent.remove(o);
    let count = 0;
    for (const b of buckets.values()) {
      const total = b.pos.reduce((s, a) => s + a.length, 0);
      if (!total) continue;
      const pos = new Float32Array(total);
      let off = 0;
      for (const a of b.pos) { pos.set(a, off); off += a.length; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (b.nor.length && b.nor.every(n => n)) {
        const nor = new Float32Array(total);
        off = 0;
        for (const a of b.nor) { nor.set(a, off); off += a.length; }
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      } else geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      count++;
    }
    return count;
  } catch (e) {
    console.warn('mergeGroup falhou (não crítico):', e);
    return 0;
  }
}
