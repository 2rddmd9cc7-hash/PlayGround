// Terreno — heightfield procedural determinístico + água
import * as THREE from '../../vendor/three.module.js';

export const WORLD_SIZE = 1000;
export const WATER_LEVEL = 0.55;

// regiões-chave do mundo (coordenadas fixas)
export const WORLD = {
  village:   { x: 0,     z: 0    },
  city:      { x: 0,     z: -260 },
  forest:    { x: 230,   z: 60   },
  lake:      { x: -200,  z: -60  },
  mountains: { x: 330,   z: -260 },
  volcano:   { x: 400,   z: 260  },
  frozen:    { x: -380,  z: -340 },
  swamp:     { x: -230,  z: 260  },
  goblin:    { x: 300,   z: 320  },
  ruins:     { x: -360,  z: 160  },
  cave:      { x: 150,   z: 200  },
};

const MOUNTAINS = [
  { x: 330, z: -260, r: 150, h: 55 },   // montanhas
  { x: 420, z: -80, r: 90, h: 30 },
  { x: 160, z: -420, r: 100, h: 40 },
  { x: -140, z: -450, r: 120, h: 45 },
  { x: 460, z: 100, r: 110, h: 50 },
];

// ribeira sinuosa indo do lago para o pântano (ao sul)
function riverX(z) { return -170 + 60 * Math.sin(z * 0.012) + 30 * Math.sin(z * 0.033); }

export function terrainHeight(x, z) {
  // zona da masmorra (espaço separado, longe do mapa): chão plano
  if (x > 1500) return 0;
  // colinas suaves
  let y = 2.2
    + 1.6 * Math.sin(x * 0.018) * Math.cos(z * 0.021)
    + 0.9 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.041 + 0.7)
    + 0.4 * Math.sin(x * 0.09) * Math.cos(z * 0.087 + 2.1);

  // montanhas
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) {
      const t = 1 - d / m.r;
      y += m.h * t * t * (3 - 2 * t) * 0.9;
    }
  }

  // vulcão: cone com cratera
  {
    const d = Math.hypot(x - WORLD.volcano.x, z - WORLD.volcano.z);
    const R = 110;
    if (d < R) {
      const t = 1 - d / R;
      y += 46 * Math.pow(t, 1.6);
      if (d < 22) y -= (1 - d / 22) * 20; // cratera
    }
  }

  // região congelada: platô elevado
  {
    const d = Math.hypot(x - WORLD.frozen.x, z - WORLD.frozen.z);
    if (d < 170) { const t = 1 - d / 170; y += 7 * t * t + 3 * t; }
  }

  // pântano: abaixa
  {
    const d = Math.hypot(x - WORLD.swamp.x, z - WORLD.swamp.z);
    if (d < 130) { const t = 1 - d / 130; y -= 3.2 * t * (2 - t); }
  }

  // rio esculpido
  {
    const d = Math.abs(x - riverX(z));
    if (d < 14) {
      const t = 1 - d / 14;
      y = THREE.MathUtils.lerp(y, -1.6, t * t * (3 - 2 * t));
    }
  }

  // lago: bacia
  {
    const d = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
    const R = 78;
    if (d < R) { const t = 1 - d / R; y = THREE.MathUtils.lerp(y, -3.2, Math.min(1, t * 1.7) * t); }
  }

  // vila: área plana
  {
    const d = Math.hypot(x - WORLD.village.x, z - WORLD.village.z);
    if (d < 80) { const t = Math.min(1, (80 - d) / 30); y = THREE.MathUtils.lerp(y, 2.0, t); }
  }

  // cidade + castelo: planalto plano
  {
    const d = Math.hypot(x - WORLD.city.x, z - WORLD.city.z);
    if (d < 110) { const t = Math.min(1, (110 - d) / 34); y = THREE.MathUtils.lerp(y, 3.0, t); }
  }

  // borda do mundo: muralha de montanhas
  {
    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge > 400) y += Math.pow((edge - 400) / 100, 2) * 90;
  }

  return y;
}

// normal aproximada via diferenças finitas
export function terrainNormal(x, z, out) {
  const e = 1.2;
  const hL = terrainHeight(x - e, z), hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e), hU = terrainHeight(x, z + e);
  out.set(hL - hR, 2 * e, hD - hU).normalize();
  return out;
}

// cor do terreno conforme altura/região
function terrainColor(x, z, y, target) {
  const inVolcano = Math.hypot(x - WORLD.volcano.x, z - WORLD.volcano.z) < 130;
  const frozenD = Math.hypot(x - WORLD.frozen.x, z - WORLD.frozen.z);
  const swampD = Math.hypot(x - WORLD.swamp.x, z - WORLD.swamp.z);
  const goblinD = Math.hypot(x - WORLD.goblin.x, z - WORLD.goblin.z);

  if (y < WATER_LEVEL + 0.9) target.set(0.78, 0.70, 0.48);            // areia
  else if (y > 26) target.set(0.82, 0.85, 0.9);                       // neve alta
  else if (frozenD < 150 || y > 15) target.set(0.85, 0.88, 0.92);     // neve
  else if (inVolcano || y > 34) target.set(0.28, 0.16, 0.12);         // rocha vulcânica
  else if (y > 22) target.set(0.45, 0.42, 0.4);                       // rocha
  else if (swampD < 120) target.set(0.32, 0.38, 0.22);                // pântano
  else if (goblinD < 120) target.set(0.42, 0.42, 0.25);               // terra goblin
  else target.set(0.34, 0.55, 0.25);                                  // grama

  // variação sutil
  const n = 0.92 + 0.08 * Math.sin(x * 0.35) * Math.cos(z * 0.3);
  target.multiplyScalar(n);
}

export function buildTerrain(scene) {
  const SEG = 180;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    terrainColor(x, z, y, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

export function buildWater(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x2a6a9e, transparent: true, opacity: 0.72,
    emissive: 0x0a2033, emissiveIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_LEVEL;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

// ribbons de estrada acompanhando o relevo
export function buildRoad(scene, points, width = 4.5) {
  const verts = [], idx = [];
  const half = width / 2;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const next = points[Math.min(i + 1, points.length - 1)];
    const prev = points[Math.max(i - 1, 0)];
    const dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * half, nz = dx / len * half;
    const y0 = terrainHeight(p.x + nx, p.z + nz) + 0.06;
    const y1 = terrainHeight(p.x - nx, p.z - nz) + 0.06;
    verts.push(p.x + nx, y0, p.z + nz, p.x - nx, y1, p.z - nz);
    if (i < points.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a7150 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
