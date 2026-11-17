/* =========================================================
 * Aetheria — Construtor de personagens humanoides 3D
 * Usado por jogador, NPCs e inimigos humanoides.
 * Hierarquia com pivôs para animação procedural.
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand } from '../core/utils.js';

const MAT = {};
function mat(color, rough = 0.85, metal = 0) {
  const key = color + '_' + rough + '_' + metal;
  if (!MAT[key]) MAT[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return MAT[key];
}

/**
 * Cria um humanoide. Retorna { root, parts, mats }
 * parts: { hip, torso, head, hair, armL, armR, foreL, foreR, legL, legR, shinL, shinR, handR, cape? }
 */
export function buildHumanoid(cfg = {}) {
  const s = cfg.scale ?? 1;
  const skin = cfg.skin ?? 0xd8a077;
  const cloth = cfg.cloth ?? 0x6a5a3a;
  const cloth2 = cfg.cloth2 ?? 0x4a3c28;
  const hairC = cfg.hair ?? 0x3a281a;
  const root = new THREE.Group();
  const mats = { skin: mat(skin), cloth: mat(cloth), cloth2: mat(cloth2), hair: mat(hairC), boot: mat(cfg.boots ?? 0x3a2c1a), metal: mat(0x8a8a92, 0.4, 0.7) };
  const parts = { root };

  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // quadril
  const hip = new THREE.Group();
  hip.position.y = 0.95 * s;
  root.add(hip);
  parts.hip = hip;

  // tronco
  const torso = new THREE.Group();
  hip.add(torso);
  parts.torso = torso;
  const chest = box(0.52 * s, 0.62 * s, 0.3 * s, mats.cloth);
  chest.position.y = 0.31 * s;
  chest.castShadow = true;
  torso.add(chest);
  const belt = box(0.56 * s, 0.1 * s, 0.34 * s, mats.boot);
  belt.position.y = 0.01 * s;
  torso.add(belt);
  // detalhe peitoral (armadura de couro)
  const vest = box(0.56 * s, 0.4 * s, 0.34 * s, mats.cloth2);
  vest.position.y = 0.42 * s;
  torso.add(vest);

  // cabeça
  const head = new THREE.Group();
  head.position.y = 0.68 * s;
  torso.add(head);
  parts.head = head;
  const skull = box(0.3 * s, 0.32 * s, 0.28 * s, mats.skin);
  skull.castShadow = true;
  head.add(skull);
  // olhos
  const eyeM = mat(cfg.eyes ?? 0x1a1a22);
  const eL = box(0.05 * s, 0.05 * s, 0.02 * s, eyeM), eR = box(0.05 * s, 0.05 * s, 0.02 * s, eyeM);
  eL.position.set(-0.075 * s, 0.03 * s, 0.15 * s);
  eR.position.set(0.075 * s, 0.03 * s, 0.15 * s);
  head.add(eL, eR);
  // cabelo
  const hair = new THREE.Group();
  const hTop = box(0.32 * s, 0.1 * s, 0.3 * s, mats.hair); hTop.position.y = 0.17 * s; hair.add(hTop);
  const hBack = box(0.32 * s, 0.18 * s, 0.08 * s, mats.hair); hBack.position.set(0, 0.05 * s, -0.14 * s); hair.add(hBack);
  const hL = box(0.06 * s, 0.14 * s, 0.26 * s, mats.hair); hL.position.set(-0.17 * s, 0.08 * s, 0); hair.add(hL);
  const hR = box(0.06 * s, 0.14 * s, 0.26 * s, mats.hair); hR.position.set(0.17 * s, 0.08 * s, 0); hair.add(hR);
  head.add(hair);
  parts.hair = hair;

  // braços (pivot no ombro)
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.32 * s, 0.56 * s, 0);
    const upper = box(0.14 * s, 0.3 * s, 0.14 * s, mats.cloth);
    upper.position.y = -0.15 * s;
    sh.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3 * s;
    sh.add(elbow);
    const fore = box(0.12 * s, 0.28 * s, 0.12 * s, mats.skin);
    fore.position.y = -0.14 * s;
    elbow.add(fore);
    const hand = box(0.13 * s, 0.12 * s, 0.13 * s, mats.skin);
    hand.position.y = -0.32 * s;
    elbow.add(hand);
    return { sh, elbow, hand };
  };
  const aL = mkArm(-1), aR = mkArm(1);
  torso.add(aL.sh, aR.sh);
  parts.armL = aL.sh; parts.foreL = aL.elbow; parts.handL = aL.hand;
  parts.armR = aR.sh; parts.foreR = aR.elbow; parts.handR = aR.hand;

  // pernas (pivot no quadril)
  const mkLeg = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.14 * s, -0.02 * s, 0);
    const thigh = box(0.17 * s, 0.42 * s, 0.17 * s, mats.cloth2);
    thigh.position.y = -0.21 * s;
    hp.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44 * s;
    hp.add(knee);
    const shin = box(0.15 * s, 0.38 * s, 0.15 * s, mats.cloth2);
    shin.position.y = -0.19 * s;
    knee.add(shin);
    const boot = box(0.17 * s, 0.12 * s, 0.26 * s, mats.boot);
    boot.position.set(0, -0.44 * s, 0.04 * s);
    knee.add(boot);
    return { hp, knee };
  };
  const lL = mkLeg(-1), lR = mkLeg(1);
  hip.add(lL.hp, lR.hp);
  parts.legL = lL.hp; parts.shinL = lL.knee;
  parts.legR = lR.hp; parts.shinR = lR.knee;

  // capa opcional
  if (cfg.cape) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.55 * s, 0.75 * s, 1, 4), mat(cfg.cape, 1));
    cape.position.set(0, 0.42 * s, -0.19 * s);
    cape.rotation.x = 0.12;
    torso.add(cape);
    parts.cape = cape;
  }

  // sombra blob simples sob o personagem
  if (cfg.blobShadow !== false) {
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42 * s, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    root.add(blob);
    parts.blob = blob;
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return { root, parts, mats, scale: s };
}

/* ---- Espada nas mãos ---- */
export function buildSword(mats, bladeColor = 0xb8c4cc) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.015), mat(bladeColor, 0.3, 0.85));
  blade.position.y = 0.48;
  blade.castShadow = true;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), mat(0x8a6a2a, 0.5, 0.6));
  guard.position.y = 0.04;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), mat(0x4a3018));
  grip.position.y = -0.04;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), mat(0x8a6a2a, 0.5, 0.6));
  pommel.position.y = -0.12;
  g.add(blade, guard, grip, pommel);
  return g;
}

/* ---- Escudo pequeno ---- */
export function buildShield() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.05, 8), mat(0x6a4a28, 0.8));
  body.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12), mat(0x8a8a92, 0.4, 0.7));
  g.add(body, rim);
  return g;
}
