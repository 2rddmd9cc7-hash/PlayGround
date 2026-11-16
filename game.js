import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb7c3);
scene.fog = new THREE.FogExp2(0x9fb7c3, 0.002);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 10, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('#game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdfefff, 0x334d2a, 2.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6ad, 2.8);
sun.position.set(-60, 110, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.0002;
scene.add(sun);

const toonRamp = new THREE.DataTexture(
  new Uint8Array([
    26, 26, 26, 255,
    84, 84, 84, 255,
    160, 160, 160, 255,
    255, 255, 255, 255
  ]),
  4,
  1,
  THREE.RGBAFormat
);
toonRamp.needsUpdate = true;
toonRamp.magFilter = THREE.NearestFilter;
toonRamp.minFilter = THREE.NearestFilter;

const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
const mesh = (geometry, material, parent = scene, x = 0, y = 0, z = 0) => {
  const obj = new THREE.Mesh(geometry, material);
  obj.position.set(x, y, z);
  obj.castShadow = true;
  obj.receiveShadow = true;
  parent.add(obj);
  return obj;
};

function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeTexture(base, accents, seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1200; i += 1) {
    const ax = seeded(seed + i) * 256;
    const ay = seeded(seed * 2 + i) * 256;
    const size = 1 + seeded(i * 7 + seed) * 3;
    ctx.globalAlpha = 0.08 + seeded(i + 66) * 0.12;
    ctx.fillStyle = accents[Math.floor(seeded(i + 77) * accents.length)];
    ctx.fillRect(ax, ay, size, size);
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const grassTexture = makeTexture('#657d52', ['#7e9966', '#4f6947', '#819766', '#415f42'], 4);
const terrainMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0 });
const terrain = mesh(new THREE.PlaneGeometry(700, 700, 1, 1), terrainMaterial, scene, 0, -0.26, 0);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;

const regions = [
  { name: 'AURELIA', x: 0, z: 0, color: 0x8aa063, radius: 40 },
  { name: 'REINO DE ELDORIA', x: -120, z: -96, color: 0x81946a, radius: 46 },
  { name: 'VALE DE BRUMAFRIA', x: 122, z: -110, color: 0x90a6a8, radius: 44 },
  { name: 'DUNAS DE SOLARES', x: 120, z: 120, color: 0xb28f59, radius: 48 },
  { name: 'FLORESTA LUNARGENTA', x: -126, z: 112, color: 0x5f7d4f, radius: 47 },
];

for (const [i, region] of regions.entries()) {
  const disc = mesh(new THREE.CircleGeometry(region.radius, 64), mat(region.color), scene, region.x, -0.18, region.z);
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  const rim = mesh(new THREE.RingGeometry(region.radius - 1, region.radius, 64), mat(i === 2 ? 0x9dd4d2 : 0xd8c17b), scene, region.x, -0.16, region.z);
  rim.rotation.x = -Math.PI / 2;
}

function path(points, width, color = 0x8f7d63) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = new THREE.Vector3(points[i][0], -0.14, points[i][1]);
    const b = new THREE.Vector3(points[i + 1][0], -0.14, points[i + 1][1]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const distance = a.distanceTo(b);
    const road = mesh(new THREE.PlaneGeometry(width, distance), mat(color), scene, mid.x, -0.13, mid.z);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = -Math.atan2(b.x - a.x, b.z - a.z);
  }
}

path([[-320, 0], [-90, 0], [0, 0], [90, 0], [320, 0]], 7, 0x94846a);
path([[0, -320], [0, -80], [0, 0], [0, 80], [0, 320]], 6, 0x978a68);
path([[-240, -220], [-120, -96], [0, 0], [120, -110], [240, -220]], 4, 0x9a8869);
path([[-240, 220], [-126, 112], [0, 0], [120, 116], [240, 220]], 4, 0x978667);

const plaza = mesh(new THREE.CylinderGeometry(12, 12, 0.35, 16), mat(0xa69a89), scene, 0, -0.04, 0);
plaza.castShadow = false;
for (let i = 0; i < 12; i += 1) {
  const angle = i * (Math.PI / 6);
  const tile = mesh(new THREE.BoxGeometry(2.5, 0.14, 2.5), mat(i % 2 ? 0xc9bfa1 : 0x8a7f69), scene, Math.cos(angle) * 7, 0.12, Math.sin(angle) * 7);
  tile.rotation.y = angle * 0.35;
}

const mats = {
  bark: mat(0x5a4435),
  leaf: mat(0x3f6d48),
  leaf2: mat(0x5b8f61),
  wall: mat(0xd7bc92),
  roof: mat(0x834d42),
  roof2: mat(0x495d68),
  stone: mat(0x7a7f83),
  gold: mat(0xd7b975),
  wood: mat(0x775549),
  dark: mat(0x303842),
  skin: mat(0xe4b995),
  cloth: mat(0x516f86),
  red: mat(0x9c4d48),
  grass: mat(0x4d7654),
};

function tree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  mesh(new THREE.CylinderGeometry(0.25 * scale, 0.42 * scale, 3.2 * scale, 7), mats.bark, group, 0, 1.5 * scale, 0);
  for (let j = 0; j < 3; j += 1) {
    const crown = mesh(new THREE.IcosahedronGeometry((1.8 - j * 0.24) * scale, 1), j === 1 ? mats.leaf2 : mats.leaf, group, 0, (3.2 + j * 1.0) * scale, 0);
    crown.scale.set(1, 0.9, 1);
  }
  return group;
}

function house(x, z, scale = 1, roofColor = mats.roof) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  const width = 6 * scale;
  const height = 4 * scale;
  mesh(new THREE.BoxGeometry(width, height, 5 * scale), mats.wall, group, 0, height / 2, 0);
  const roof = mesh(new THREE.ConeGeometry(4.8 * scale, 2.6 * scale, 4), roofColor, group, 0, height + 1.1 * scale, 0);
  roof.rotation.y = Math.PI / 4;

  mesh(new THREE.BoxGeometry(1.15 * scale, 2.3 * scale, 0.18), mats.wood, group, 0, 1.1 * scale, 2.55 * scale);
  for (const xx of [-1.9, 1.9]) {
    mesh(new THREE.BoxGeometry(1.0 * scale, 0.85 * scale, 0.12), mat(0x9fd6d3), group, xx * scale, 2.3 * scale, 2.58 * scale);
  }
  return group;
}

function tower(x, z, height = 12, roofColor = mats.roof) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);
  mesh(new THREE.CylinderGeometry(2.2, 2.7, height, 8), mats.stone, group, 0, height / 2, 0);
  mesh(new THREE.ConeGeometry(3.3, 3.5, 8), roofColor, group, 0, height + 1.2, 0);
  for (let y = 2; y < height - 1; y += 3) {
    mesh(new THREE.BoxGeometry(0.5, 0.8, 0.1), mats.gold, group, 0, y, 2.2);
  }
  return group;
}

function buildTown(cx, cz, roofShade) {
  for (let i = 0; i < 7; i += 1) {
    const angle = i * ((Math.PI * 2) / 7);
    const radius = 14 + seeded(i + cx) * 6;
    house(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius, 0.8 + (i % 3) * 0.1, roofShade);
  }
  tower(cx, cz - 12, 13, roofShade);
}

for (let i = 0; i < 110; i += 1) {
  const angle = seeded(i + 12) * Math.PI * 2;
  const radius = 45 + seeded(i + 919) * 120;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (Math.hypot(x, z) > 45) tree(x, z, 0.7 + seeded(i + 81) * 0.7);
}

for (let i = 0; i < 20; i += 1) {
  const x = -22 + (i % 5) * 11;
  const z = 25 + Math.floor(i / 5) * 9;
  tree(x, z, 0.75 + seeded(i) * 0.42);
}

house(-16, -13, 1.1);
house(15, -14, 1.2);
house(-19, 13, 0.95);
house(19, 15, 1.0, mats.roof2);
house(-31, -7, 0.85);
house(31, -4, 0.92);
tower(-7, -27, 12);
tower(8, -27, 12);
house(-5, -45, 1.65, mats.roof2);
tower(-17, -44, 16, mats.roof2);
tower(17, -44, 16, mats.roof2);
tower(0, -53, 18, mats.roof2);
mesh(new THREE.BoxGeometry(28, 10, 3), mats.stone, scene, 0, 5, -45);
mesh(new THREE.BoxGeometry(8, 2, 4), mats.gold, scene, 0, 11, -45);
buildTown(-122, -96, mats.roof2);
buildTown(122, -110, mats.roof);
buildTown(120, 120, mats.roof);
buildTown(-126, 112, mats.roof2);

const crystalGroup = new THREE.Group();
scene.add(crystalGroup);
crystalGroup.position.set(0, 0.15, -7);
mesh(new THREE.CylinderGeometry(2.6, 3.5, 0.7, 8), mat(0x6a7975), crystalGroup, 0, 0, 0);
const crystal = mesh(
  new THREE.OctahedronGeometry(1.45, 0),
  new THREE.MeshStandardMaterial({ color: 0x66d8ff, emissive: 0x2e82c7, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.2 }),
  crystalGroup,
  0,
  2,
  0
);
crystal.scale.set(0.75, 1.2, 0.75);
const halo = mesh(new THREE.TorusGeometry(2.0, 0.075, 8, 48), mat(0x5fd5f5), crystalGroup, 0, 1.0, 0);
halo.rotation.x = Math.PI / 2;
for (let i = 0; i < 4; i += 1) {
  const angle = i * (Math.PI / 2);
  mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.7, 7), mats.gold, crystalGroup, Math.cos(angle) * 2.1, 1.3, Math.sin(angle) * 2.1);
}

function makeHero() {
  const group = new THREE.Group();
  const hairColor = mat(0x422e31);
  const clothColor = mat(0x3d5d88);
  const dark = mat(0x2d343e);
  const trim = mat(0xd7bb73);

  const body = mesh(new THREE.CapsuleGeometry(0.48, 0.95, 4, 8), clothColor, group, 0, 1.2, 0);
  body.scale.set(0.9, 1.0, 0.65);

  const head = mesh(new THREE.SphereGeometry(0.38, 16, 12), mat(0xe6b89c), group, 0, 2.2, 0);
  head.scale.set(0.9, 1.05, 0.86);

  const hair = mesh(new THREE.SphereGeometry(0.4, 12, 10), hairColor, group, 0, 2.35, -0.04);
  hair.scale.set(1.0, 0.58, 1.03);

  for (const x of [-0.17, 0.17]) {
    const eye = mesh(new THREE.SphereGeometry(0.065, 8, 8), mat(0x263b4e), group, x, 2.24, 0.315);
    eye.scale.set(0.7, 1.2, 0.4);
    mesh(new THREE.SphereGeometry(0.022, 6, 6), mat(0xffffff), group, x - 0.012, 2.26, 0.343);
  }

  const fringe = mesh(new THREE.ConeGeometry(0.24, 0.55, 5), hairColor, group, 0.12, 2.16, 0.25);
  fringe.rotation.z = -0.42;
  fringe.rotation.x = -0.25;

  const sash = mesh(new THREE.BoxGeometry(0.82, 0.16, 0.68), trim, group, 0, 0.82, 0);
  sash.rotation.z = -0.08;

  const legs = [];
  for (const x of [-0.22, 0.22]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.16, 0.58, 3, 6), dark, group, x, 0.46, 0);
    const boot = mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.22, 8), mat(0x5e493b), group, x, 0.18, 0.02);
    legs.push(leg);
    legs.push(boot);
  }

  const arms = [];
  for (const x of [-0.58, 0.58]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.13, 0.62, 3, 6), clothColor, group, x, 1.35, 0);
    arm.rotation.z = x < 0 ? -0.18 : 0.18;
    arms.push(arm);
    mesh(new THREE.SphereGeometry(0.19, 8, 8), trim, group, x * 0.82, 1.65, 0);
  }

  const cloak = mesh(new THREE.ConeGeometry(0.76, 1.4, 5), mat(0x3b4f6e), group, 0, 1.20, -0.42);
  cloak.rotation.x = -0.1;

  return { group, body, legs, arms, cloak };
}

const hero = makeHero();
hero.group.position.set(0, 0, 7);
hero.group.scale.setScalar(1.1);
scene.add(hero.group);

const audio = { ctx: null, enabled: true };
function ensureAudio() {
  if (!audio.ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audio.ctx = new AudioCtx();
  }
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
}
function playTone(freq = 440, duration = 0.12, type = 'sine', volume = 0.03) {
  if (!audio.enabled || !audio.ctx) return;
  try {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start();
    osc.stop(audio.ctx.currentTime + duration);
  } catch (err) {
    // ignore unsupported browsers
  }
}

$('#soundBtn').addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  $('#soundBtn').textContent = audio.enabled ? '♫' : '♪';
  toast(audio.enabled ? 'Sons ativados' : 'Sons silenciados');
});

const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 128;
const glowCtx = glowCanvas.getContext('2d');
const glowGradient = glowCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
glowGradient.addColorStop(0, 'rgba(255,255,255,1)');
glowGradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
glowGradient.addColorStop(0.42, 'rgba(255,255,255,0.35)');
glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
glowCtx.fillStyle = glowGradient;
glowCtx.fillRect(0, 0, 128, 128);
const glowTexture = new THREE.CanvasTexture(glowCanvas);

const elements = [
  { name: 'Fogo', color: 0xff693f, skills: ['Faísca', 'Bastão de Chamas', 'Nova Incandescente'], damage: [18, 42, 110], mana: [8, 22, 55], icon: ['✦', '✹'] },
  { name: 'Água', color: 0x4cc6f0, skills: ['Jato', 'Marejada', 'Maremoto'], damage: [16, 38, 105], mana: [8, 20, 52], icon: ['❋', '◈'] },
  { name: 'Raio', color: 0xf5dc60, skills: ['Relâmpago', 'Tempestade', 'Céu Partido'], damage: [19, 42, 120], mana: [9, 21, 54], icon: ['ϟ', '✦'] },
  { name: 'Terra', color: 0xa9c66a, skills: ['Pedra', 'Tremor', 'Mural Estelar'], damage: [20, 45, 110], mana: [8, 22, 58], icon: ['◆', '⬢'] },
  { name: 'Vento', color: 0x8fe9cf, skills: ['Lâmina', 'Vendaval', 'Tufão'], damage: [17, 40, 115], mana: [8, 21, 56], icon: ['✧', '❋'] },
  { name: 'Gelo', color: 0xbfe8ff, skills: ['Estilhaço', 'Nevasca', 'Nuvem de Gelo'], damage: [18, 41, 112], mana: [8, 20, 52], icon: ['❄', '✧'] },
];
const defaultState = {
  level: 1,
  xp: 0,
  gold: 120,
  hp: 100,
  maxHp: 100,
  mp: 100,
  maxMp: 100,
  element: 'Fogo',
  elementUnlocked: false,
  skill: 0,
  kills: 0,
  wave: 0,
  quest: 0,
  crystalAt: { x: 0, z: -7 }
};

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem('aetheria-save') || '{}');
} catch (error) {
  saved = {};
}
const state = { ...defaultState, ...saved };
let selectedSkill = state.skill || 0;

const waveRanks = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
let wave = {
  active: false,
  num: 0,
  remaining: 0,
  total: 0,
};

const npcs = [
  { name: 'Capitã Lyra', job: 'Guardiã da Vila', x: -5, z: 4, color: 0x9e5a4f, kind: 'lyra', dialogue: 'A invasão cresce nas colinas. Se o cristal despertar seu dom, a praça estará segura.' },
  { name: 'Mira', job: 'Alquimista', x: 8, z: 6, color: 0x6b8d74, kind: 'crystal', dialogue: 'A esfera antiga responde ao coração que a chama. Toque-a e descubra seu elemento.' },
  { name: 'Tomas', job: 'Mercador', x: -9, z: 11, color: 0x9d7f53, kind: 'shop', dialogue: 'Poções, armas e fortalezas do espírito para quem atravessa a estrada.' },
  { name: 'Borin', job: 'Ferreiro', x: 15, z: 9, color: 0x6f7580, kind: 'forge', dialogue: 'O metal canta melhor quando a mão sabe ouvir a chama.' },
  { name: 'Nilo', job: 'Padeiro', x: 6, z: -18, color: 0x9a6b4c, kind: 'town', dialogue: 'A vila vive em paz quando a arena há de calar.' },
  { name: 'Sera', job: 'Pastora', x: -21, z: 10, color: 0x708f65, kind: 'town', dialogue: 'Dizem que o bosque respira acima das nuvens.' },
  { name: 'Riven', job: 'Aventureiro', x: -18, z: -15, color: 0x886d90, kind: 'town', dialogue: 'Pelo menos uma vez, eu gostaria de atravessar a ponte sem cair.' },
];

const NPC_GROUPS = [];
for (const npc of npcs) {
  const group = makeHero();
  group.group.position.set(npc.x, 0, npc.z);
  group.group.scale.setScalar(0.9);
  group.group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group.group);
  NPC_GROUPS.push({ ...npc, group: group.group, body: group.body, legs: group.legs, root: group.group });
}

const effectGroup = new THREE.Group();
scene.add(effectGroup);
const projectiles = [];
const enemies = [];

function save() {
  try {
    localStorage.setItem('aetheria-save', JSON.stringify(state));
  } catch (error) {
    // ignore storage errors
  }
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function updateWaveTrack() {
  const track = $('#waveTrack');
  if (!track.dataset.ready) {
    track.innerHTML = waveRanks.map((rank, index) => `
      <div class="wave-step ${index === 6 ? 'boss' : ''}" data-wave="${index + 1}">
        <span>${index === 6 ? 'SS' : rank}</span>
        <span class="wave-count">${index === 6 ? 'BOSS' : index + 1}</span>
      </div>
    `).join('');
    track.dataset.ready = 'true';
  }

  const steps = track.querySelectorAll('.wave-step');
  steps.forEach((step, index) => {
    const isDone = index < state.wave;
    const isCurrent = wave.active ? index === wave.num - 1 : index === state.wave;
    step.classList.toggle('done', isDone);
    step.classList.toggle('current', isCurrent);
    step.classList.toggle('boss', index === 6);
  });
}

function elementForName(name) {
  return elements.find((entry) => entry.name === name) || elements[0];
}

function buildSkills() {
  const current = elementForName(state.element);
  const list = $('#skillList');
  list.innerHTML = '';
  current.skills.forEach((skillName, index) => {
    const item = document.createElement('div');
    item.className = `skill ${selectedSkill === index ? 'active' : ''}`;
    item.innerHTML = `
      <div class="skill-icon">${current.icon[index % current.icon.length]}</div>
      <div class="skill-copy">
        <b>${skillName}</b>
        <small>${current.damage[index]} dano · ${current.mana[index]} mana</small>
      </div>
      <div class="skill-key">${index + 1}</div>
    `;
    item.addEventListener('click', () => {
      selectedSkill = index;
      state.skill = index;
      buildSkills();
      save();
    });
    list.appendChild(item);
  });
}

function updateUI() {
  const currentElement = elementForName(state.element);
  $('#heroName').textContent = state.elementUnlocked ? 'Viajante Arcano' : 'Viajante';
  $('#levelText').textContent = `NÍV. ${state.level}`;
  $('#hpText').textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
  $('#mpText').textContent = `${Math.floor(state.mp)} / ${state.maxMp}`;
  $('#hpBar').style.width = `${(state.hp / state.maxHp) * 100}%`;
  $('#mpBar').style.width = `${(state.mp / state.maxMp) * 100}%`;
  $('#xpText').textContent = `${state.xp} / ${state.level * 100} XP`;
  $('#xpBar').style.width = `${Math.min(100, (state.xp / (state.level * 100)) * 100)}%`;
  $('#goldText').textContent = state.gold;
  $('#killText').textContent = state.kills;
  $('#elementName').textContent = currentElement.name.toUpperCase();
  $('#waveNumber').textContent = wave.active ? wave.num : state.wave;
  $('#waveRank').textContent = wave.active ? waveRanks[wave.num - 1] : state.wave ? waveRanks[state.wave - 1] : '—';
  $('#waveDesc').textContent = wave.active ? `${wave.remaining} inimigo${wave.remaining === 1 ? '' : 's'} restante${wave.remaining === 1 ? '' : 's'}` : state.wave >= 7 ? 'A paz voltou à arena.' : state.wave ? 'Próxima onda disponível.' : 'A praça está tranquila.';
  updateWaveTrack();

  $('#questTitle').textContent = state.quest >= 2 ? 'Estradas de Aetheria' : 'Ecos da invasão';
  $('#questText').textContent = state.quest === 0 ? 'Encontre a capitã Lyra na praça.' : state.quest === 1 ? 'Descubra seu elemento na bola de cristal.' : state.quest === 2 ? 'Proteja Aurelia das ondas de invasão.' : 'Vá além da vila e descubra os reinos distantes.';
  $('#questProgress').style.width = state.quest === 0 ? '15%' : state.quest === 1 ? '35%' : state.quest === 2 ? '70%' : '100%';
  $('#questStep').textContent = state.quest === 0 ? 'A HISTÓRIA COMEÇA AQUI' : state.quest === 1 ? 'UM DOM SERÁ REVELADO' : state.quest === 2 ? 'DEFESE A VILA' : 'EXPLORE AS TERRAS DESPERTAS';
  $('#shopGold').textContent = state.gold;
  buildSkills();
}

function buildMap() {
  const el = $('#worldMap');
  el.innerHTML = '';
  const coords = [[50, 50], [26, 32], [77, 32], [77, 77], [23, 77]];
  regions.forEach((region, index) => {
    const marker = document.createElement('div');
    marker.className = 'map-point';
    marker.style.left = `${coords[index][0]}%`;
    marker.style.top = `${coords[index][1]}%`;
    marker.textContent = `${region.name}`;
    el.appendChild(marker);
  });
  const playerMarker = document.createElement('div');
  playerMarker.className = 'map-point player';
  playerMarker.style.left = '50%';
  playerMarker.style.top = '50%';
  playerMarker.textContent = '◉';
  el.appendChild(playerMarker);
}

function showShop() {
  const el = $('#shopItems');
  el.innerHTML = '';
  const offers = [
    { name: 'Poção de Vida', cost: 35, desc: 'Restaura toda a vida.', action: () => { state.hp = state.maxHp; toast('Vida restaurada!'); } },
    { name: 'Poção de Mana', cost: 30, desc: 'Restaura toda a mana.', action: () => { state.mp = state.maxMp; toast('Mana restaurada!'); } },
    { name: 'Espada Rúnica', cost: 90, desc: 'Aumenta o dano em 8.', action: () => { state.damage = (state.damage || 0) + 8; toast('Dano aumentado!'); } },
    { name: 'Manto Guardião', cost: 100, desc: 'Aumenta a vida máxima em 25.', action: () => { state.maxHp += 25; state.hp += 25; toast('Vida máxima aumentada!'); } },
    { name: 'Amuleto Arcano', cost: 85, desc: 'Aumenta a mana máxima em 25.', action: () => { state.maxMp += 25; state.mp += 25; toast('Mana máxima aumentada!'); } },
  ];

  offers.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'shop-item';
    card.innerHTML = `<h3>${item.name}</h3><p>${item.desc}</p><button>${item.cost} ◈ &nbsp; COMPRAR</button>`;
    const button = card.querySelector('button');
    button.disabled = state.gold < item.cost;
    button.addEventListener('click', () => {
      if (state.gold < item.cost) return;
      state.gold -= item.cost;
      item.action();
      updateUI();
      save();
      showShop();
    });
    el.appendChild(card);
  });

  $('#shopGold').textContent = state.gold;
  $('#shopOverlay').classList.add('open');
}

function updateInteraction() {
  let nearest = null;
  let bestDistance = 5;

  for (const npc of NPC_GROUPS) {
    const d = npc.root.position.distanceTo(hero.group.position);
    if (d < bestDistance) {
      bestDistance = d;
      nearest = { type: 'npc', label: `Conversar com ${npc.name} · ${npc.job}`, value: npc };
    }
  }

  const crystalDistance = hero.group.position.distanceTo(new THREE.Vector3(0, 0, -7));
  if (crystalDistance < 4.5 && crystalDistance < bestDistance) {
    nearest = { type: 'crystal', label: state.elementUnlocked ? 'Ver cristal elemental' : 'Revelar elemento', value: null };
  }

  const interaction = $('#interaction');
  if (nearest) {
    $('#interactionText').textContent = nearest.label;
    interaction.classList.add('show');
    interaction.dataset.target = nearest.type;
  } else {
    interaction.classList.remove('show');
  }

  return nearest;
}

function startDialogue(npc) {
  $('#speakerName').textContent = npc.name;
  $('#speakerRole').textContent = npc.job;
  $('#dialogueText').textContent = npc.dialogue;
  $('#dialogueChoices').innerHTML = '';
  $('#dialogue').classList.add('open');

  if (npc.kind === 'lyra' && state.quest === 0) {
    state.quest = 1;
    updateUI();
    save();
  }

  if (npc.kind === 'shop') {
    setTimeout(() => {
      $('#dialogue').classList.remove('open');
      showShop();
    }, 700);
  }

  if (npc.kind === 'crystal' && !state.elementUnlocked) {
    revealElement();
    $('#dialogue').classList.remove('open');
  }
}

function revealElement() {
  const options = ['Fogo', 'Água', 'Raio', 'Terra', 'Vento', 'Gelo'];
  const chosen = options[Math.floor(Math.random() * options.length)];
  state.element = chosen;
  state.elementUnlocked = true;
  state.quest = Math.max(2, state.quest);
  selectedSkill = 0;
  state.skill = 0;

  const current = elementForName(state.element);
  crystal.material.color.setHex(current.color);
  crystal.material.emissive.setHex(current.color);
  halo.material.color.setHex(current.color);

  $('#speakerName').textContent = 'A bola de cristal';
  $('#speakerRole').textContent = 'SEU ELEMENTO';
  $('#dialogueText').innerHTML = `A luz se torna <b style="color:#${current.color.toString(16)}">${state.element.toUpperCase()}</b>! Seu arsenal elemental foi despertado.`;
  $('#dialogueChoices').innerHTML = '<button id="closeReveal">ACEITAR DESTINO</button>';
  $('#dialogue').classList.add('open');
  $('#closeReveal').addEventListener('click', () => $('#dialogue').classList.remove('open'));
  toast(`Elemento despertado: ${state.element}!`);
  playTone(620, 0.4, 'sine', 0.08);
  updateUI();
  save();
}

function interact() {
  const target = updateInteraction();
  if (!target) return;

  if (target.type === 'npc') {
    startDialogue(target.value);
    return;
  }

  if (target.type === 'crystal') {
    if (!state.elementUnlocked) {
      startDialogue({ name: 'A bola de cristal', job: 'ALTAR ELEMENTAL', kind: 'crystal', dialogue: 'A esfera antiga pulsa. Toque o cristal e descubra o elo entre você e o mundo.' });
    } else {
      toast(`Seu elemento: ${state.element}.`);
    }
  }
}

$('#mapBtn').addEventListener('click', () => {
  $('#mapOverlay').classList.add('open');
  buildMap();
});
$('#closeMap').addEventListener('click', () => $('#mapOverlay').classList.remove('open'));
$('#helpBtn').addEventListener('click', () => $('#helpOverlay').classList.add('open'));
$('#closeShop').addEventListener('click', () => $('#shopOverlay').classList.remove('open'));
$$('[data-close]').forEach((button) => {
  button.addEventListener('click', () => $(`#${button.dataset.close}`).classList.remove('open'));
});
$$('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.classList.remove('open');
  });
});

$('#closeDialogue').addEventListener('click', () => $('#dialogue').classList.remove('open'));
$('#dialogue').addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') {
    $('#dialogue').classList.remove('open');
  }
});

function checkLevel() {
  while (state.xp >= state.level * 100) {
    state.xp -= state.level * 100;
    state.level += 1;
    state.maxHp += 12;
    state.maxMp += 8;
    state.hp = state.maxHp;
    state.mp = state.maxMp;
    $('#newLevel').textContent = state.level;
    $('#levelUp').classList.add('show');
    setTimeout(() => $('#levelUp').classList.remove('show'), 2200);
    toast(`Nível ${state.level}!`);
    playTone(700, 0.25, 'sine', 0.06);
  }
}

function spawnEnemy(type = 0) {
  const specs = [
    { hp: 48, speed: 1.5, damage: 8, color: 0x6a924d, reward: 12 },
    { hp: 62, speed: 2.1, damage: 11, color: 0x6f7f82, reward: 18 },
    { hp: 84, speed: 1.2, damage: 14, color: 0x8a5ea7, reward: 24 },
    { hp: 150, speed: 1.1, damage: 17, color: 0x9b554d, reward: 32 },
    { hp: 120, speed: 1.6, damage: 17, color: 0x5da08d, reward: 30 },
    { hp: 250, speed: 1.2, damage: 22, color: 0x4e6988, reward: 68 },
    { hp: 1400, speed: 1.2, damage: 32, color: 0xc24841, reward: 420 },
  ];

  const entry = type === 'boss' ? specs[6] : specs[Math.min(type, specs.length - 2)];
  const group = new THREE.Group();
  scene.add(group);

  const body = mesh(new THREE.CapsuleGeometry(0.48, 0.8, 4, 8), mat(entry.color), group, 0, 1.1, 0);
  body.scale.set(1.0, 1.0, 0.78);
  const head = mesh(new THREE.SphereGeometry(0.38, 12, 8), mat(type === 'boss' ? 0xa73033 : 0x7ea879), group, 0, 2.05, 0);
  head.scale.set(1.0, 0.9, 0.8);

  const weapon = mesh(new THREE.BoxGeometry(type === 'boss' ? 1.1 : 0.28, type === 'boss' ? 2.2 : 1.0, 0.24), mat(type === 'boss' ? 0x53423d : 0x918270), group, 0.72, 1.2, 0.1);
  weapon.rotation.z = -0.35;
  const legs = [];
  for (const x of [-0.24, 0.24]) {
    legs.push(mesh(new THREE.CapsuleGeometry(0.16, 0.58, 3, 5), mat(0x3d403f), group, x, 0.38, 0));
  }

  const bar = mesh(new THREE.BoxGeometry(type === 'boss' ? 3.3 : 1.6, 0.12, 0.08), mat(0x2b1d28), group, 0, 3.0, 0);
  const fill = mesh(new THREE.BoxGeometry(type === 'boss' ? 3.1 : 1.45, 0.08, 0.08), mat(0xd05046), group, 0, 3.0, 0.04);

  const scale = type === 'boss' ? 2.3 : type === 3 ? 1.35 : 1.0;
  group.scale.setScalar(scale);

  const enemy = {
    group,
    body,
    head,
    legs,
    weapon,
    fill,
    bar,
    hp: entry.hp,
    maxHp: entry.hp,
    speed: entry.speed,
    damage: entry.damage,
    reward: entry.reward,
    color: entry.color,
    attackTimer: Math.random() * 0.5,
    phase: Math.random() * 10,
    hitFlash: 0,
    type: type === 'boss' ? 'boss' : type,
  };

  const angle = Math.random() * Math.PI * 2;
  const radius = 16 + Math.random() * 6;
  enemy.group.position.set(hero.group.position.x + Math.cos(angle) * radius, 0, hero.group.position.z + Math.sin(angle) * radius);
  enemies.push(enemy);
  return enemy;
}

function finishWave() {
  wave.active = false;
  state.wave = wave.num;
  state.gold += 35 * wave.num;
  state.xp += 35 * wave.num;
  $('#waveBtn').disabled = false;
  $('#waveBtn').textContent = wave.num === 7 ? '✦ DESAFIO CONCLUÍDO' : '✦ PRÓXIMA ONDA';
  if (wave.num >= 7) {
    state.quest = 3;
    toast('A invasão foi derrotada. As rotas se abriram.');
  } else {
    toast(`Onda ${waveRanks[wave.num - 1]} concluída!`);
  }
  playTone(500, 0.35, 'sine', 0.08);
  checkLevel();
  updateUI();
  save();
}

function beginWave() {
  if (wave.active || state.wave >= 7) return;
  if (!state.elementUnlocked) {
    toast('Desperte o elemento primeiro no cristal.');
    return;
  }

  wave.active = true;
  wave.num = state.wave + 1;
  wave.total = wave.num === 7 ? 1 : 2 + wave.num * 2;
  wave.remaining = wave.total;

  $('#waveBtn').disabled = true;
  $('#waveBtn').textContent = wave.num === 7 ? '⚔ BOSS EM ANDAMENTO' : '⚔ ONDA EM ANDAMENTO';
  hero.group.position.set(0, 0, 10);
  toast(wave.num === 7 ? 'O Rei Goblin se aproximou!' : `Onda ${waveRanks[wave.num - 1]} iniciada!`);
  playTone(wave.num === 7 ? 110 : 280, 0.5, 'sawtooth', 0.07);

  if (wave.num === 7) {
    spawnEnemy('boss');
  } else {
    for (let i = 0; i < wave.total; i += 1) {
      const type = wave.num <= 2 ? 0 : Math.min(5, Math.floor(Math.random() * Math.min(5, wave.num + 1)));
      spawnEnemy(type);
    }
  }
}

function burst(position, color, scale = 1.4) {
  const ring = mesh(new THREE.TorusGeometry(scale, 0.12, 8, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }), effectGroup, position.x, 0.12, position.z);
  ring.rotation.x = Math.PI / 2;
  effectGroup.userData = effectGroup.userData || {};
  effectGroup.children[effectGroup.children.length - 1].userData = { kind: 'ring', life: 0.4, scale };

  const glow = mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }), effectGroup, position.x, 1.0, position.z);
  glow.userData = { kind: 'glow', life: 0.28 };

  const effects = [ring, glow];
  effects.forEach((obj) => {
    obj.userData.life = obj.userData.life ?? 0.3;
    obj.userData.base = scale;
  });
}

function damageEnemy(enemy, amount, color) {
  if (!enemies.includes(enemy)) return;
  enemy.hp -= amount;
  enemy.hitFlash = 0.18;
  enemy.body.material.emissive = new THREE.Color(color);
  enemy.body.material.emissiveIntensity = 0.9;
  const width = enemy.type === 'boss' ? 3.1 : 1.45;
  enemy.fill.scale.x = Math.max(0.02, enemy.hp / enemy.maxHp);
  enemy.fill.position.x = -(width * (1 - enemy.hp / enemy.maxHp)) / 2;
  burst(enemy.group.position, color, enemy.type === 'boss' ? 1.2 : 0.75);

  if (enemy.hp <= 0) {
    scene.remove(enemy.group);
    enemies.splice(enemies.indexOf(enemy), 1);
    state.kills += 1;
    state.gold += enemy.reward;
    state.xp += enemy.reward;
    playTone(enemy.type === 'boss' ? 100 : 180, 0.18, 'triangle', 0.04);
    toast(`${enemy.type === 'boss' ? 'REI GOBLIN DERROTADO' : 'Inimigo derrotado'} · +${enemy.reward} XP · +${enemy.reward} ouro`);
    if (wave.active) {
      wave.remaining = Math.max(0, wave.remaining - 1);
      if (wave.remaining === 0) finishWave();
    }
    checkLevel();
    updateUI();
    save();
  }
}

function spellTarget(target) {
  if (state.mp < elementForName(state.element).mana[selectedSkill]) {
    toast('Mana insuficiente!');
    playTone(120, 0.12, 'square', 0.02);
    return;
  }

  const current = elementForName(state.element);
  state.mp -= current.mana[selectedSkill];

  const origin = hero.group.position.clone();
  origin.y = 1.5;
  let aim = target ? target.clone() : hero.group.position.clone().add(new THREE.Vector3(0, 0, -8));
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of enemies) {
    const d = enemy.group.position.distanceTo(aim);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }

  let dir;
  if (nearest) {
    dir = new THREE.Vector3(nearest.group.position.x - origin.x, 1.2, nearest.group.position.z - origin.z).normalize();
  } else {
    dir = new THREE.Vector3(aim.x - origin.x, 0, aim.z - origin.z).normalize();
  }
  if (!isFinite(dir.x) || dir.lengthSq() === 0) dir = new THREE.Vector3(0, 0, -1);

  const spell = new THREE.Group();
  scene.add(spell);
  spell.position.copy(origin);

  const coreColor = current.color;
  const core = mesh(
    selectedSkill === 2 ? new THREE.IcosahedronGeometry(0.58, 1) : selectedSkill === 1 ? new THREE.OctahedronGeometry(0.38, 1) : new THREE.SphereGeometry(0.34, 16, 12),
    new THREE.MeshStandardMaterial({ color: coreColor, emissive: coreColor, emissiveIntensity: 2.1, roughness: 0.18, metalness: 0.15 }),
    spell,
    0,
    0,
    0
  );

  const shell = mesh(new THREE.IcosahedronGeometry(selectedSkill === 2 ? 0.8 : 0.52, 1), new THREE.MeshBasicMaterial({ color: coreColor, wireframe: true, transparent: true, opacity: 0.65 }), spell, 0, 0, 0);
  shell.scale.set(1, 1.15, 1);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: coreColor, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
  glow.scale.set(selectedSkill === 2 ? 3.5 : 2.3, selectedSkill === 2 ? 3.5 : 2.3, 1);
  spell.add(glow);

  for (let i = 0; i < 4; i += 1) {
    const mote = mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), spell, Math.cos(i * (Math.PI / 2)) * 0.55, Math.sin(i * (Math.PI / 2)) * 0.55, 0);
    mote.userData.orbit = i;
  }

  projectiles.push({
    mesh: spell,
    dir,
    speed: 18 * (selectedSkill === 1 ? 1.4 : selectedSkill === 2 ? 1.8 : 1),
    damage: current.damage[selectedSkill] + (state.level - 1) * 2 + (state.damage || 0),
    aoe: selectedSkill === 2 ? 5.2 : 1.6,
    color: coreColor,
    life: 2.3,
    trail: 0,
    spin: Math.random() * 6,
    previous: origin.clone(),
    target: nearest,
  });

  hero.group.rotation.y = Math.atan2(dir.x, dir.z);
  playTone(340 + selectedSkill * 110, 0.15, selectedSkill === 2 ? 'sawtooth' : 'triangle', 0.04);
  updateUI();
  save();
}

function fireAt(point) {
  if (!point) {
    const nearest = enemies.reduce((best, enemy) => {
      const dist = enemy.group.position.distanceTo(hero.group.position);
      if (!best || dist < best.distance) return { enemy, distance: dist };
      return best;
    }, null);
    if (nearest) point = nearest.enemy.group.position.clone();
    else point = hero.group.position.clone().add(new THREE.Vector3(0, 0, -8));
  }
  spellTarget(point);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if ($('#dialogue').classList.contains('open')) return;
  if ($$('.overlay.open').length) return;
  ensureAudio();
  const pt = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pt, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  fireAt(target);
});

window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  ensureAudio();

  if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
    selectedSkill = Number(event.code.slice(-1)) - 1;
    state.skill = selectedSkill;
    buildSkills();
    save();
  }

  if (event.code === 'Space') {
    hero.dash = 0.22;
    playTone(240, 0.08, 'triangle', 0.03);
  }

  if (event.code === 'KeyE' || event.code === 'Enter') {
    if ($('#dialogue').classList.contains('open')) {
      $('#dialogue').classList.remove('open');
      return;
    }
    interact();
  }

  if (event.code === 'Escape') {
    $$('.overlay.open').forEach((el) => el.classList.remove('open'));
    $('#dialogue').classList.remove('open');
  }
});
window.addEventListener('keydown', (event) => { window.keys = window.keys || {}; window.keys[event.code] = true; });
window.addEventListener('keyup', (event) => { window.keys = window.keys || {}; window.keys[event.code] = false; });
window.addEventListener('wheel', (event) => {
  selectedSkill = (selectedSkill + (event.deltaY > 0 ? 1 : -1) + 3) % 3;
  state.skill = selectedSkill;
  buildSkills();
  save();
}, { passive: true });

const joyEl = $('#joystick');
const knobEl = $('#joyKnob');
let joystick = { x: 0, y: 0 };
function moveJoystick(event) {
  const rect = joyEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const max = rect.width * 0.32;
  const len = Math.hypot(dx, dy) || 1;
  const factor = Math.min(1, max / len);
  joystick.x = (dx / len) * factor;
  joystick.y = (dy / len) * factor;
  knobEl.style.left = `${50 + joystick.x * 36}%`;
  knobEl.style.top = `${50 + joystick.y * 36}%`;
}
joyEl.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  joyEl.setPointerCapture(event.pointerId);
  moveJoystick(event);
});
joyEl.addEventListener('pointermove', (event) => {
  if (event.pressure > 0 || event.buttons) moveJoystick(event);
});
const resetJoystick = () => {
  joystick = { x: 0, y: 0 };
  knobEl.style.left = '50%';
  knobEl.style.top = '50%';
};
joyEl.addEventListener('pointerup', resetJoystick);
joyEl.addEventListener('pointercancel', resetJoystick);
$('#mobileAttack').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  ensureAudio();
  fireAt();
});
$('#mobileDodge').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  hero.dash = 0.22;
  playTone(240, 0.08, 'triangle', 0.03);
});

const musicTune = [392, 494, 587, 494, 330, 392, 494, 392, 294, 370, 440, 370, 330, 392, 494, 587];
let musicTimer = 0;
let musicIndex = 0;

function updateMusic(delta) {
  if (!audio.enabled || !audio.ctx) return;
  musicTimer += delta;
  if (musicTimer > 0.68) {
    musicTimer = 0;
    const note = musicTune[musicIndex % musicTune.length];
    musicIndex += 1;
    playTone(note, 0.48, 'sine', 0.012);
    if (musicIndex % 4 === 0) playTone(note / 2, 0.62, 'triangle', 0.009);
  }
}

function updateEnemyAI(delta, elapsed) {
  for (const enemy of [...enemies]) {
    const toPlayer = new THREE.Vector3(hero.group.position.x - enemy.group.position.x, 0, hero.group.position.z - enemy.group.position.z);
    const distance = toPlayer.length();
    enemy.phase += delta * 7;
    enemy.attackTimer -= delta;

    if (distance > 1.8) {
      toPlayer.normalize();
      enemy.group.position.addScaledVector(toPlayer, delta * enemy.speed);
      enemy.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      for (const [index, leg] of enemy.legs.entries()) {
        leg.rotation.x = Math.sin(enemy.phase + index * Math.PI) * 0.5;
      }
    } else if (enemy.attackTimer <= 0) {
      enemy.attackTimer = enemy.type === 'boss' ? 1.25 : 1.55;
      if (hero.invuln <= 0) {
        state.hp -= enemy.damage;
        hero.invuln = 0.7;
        playTone(110, 0.16, 'sawtooth', 0.035);
        toast(enemy.type === 'boss' ? 'O Rei Goblin golpeou você!' : 'Você foi atingido!');
        burst(hero.group.position, 0xe8524c, 1.1);
        if (state.hp <= 0) {
          state.hp = state.maxHp * 0.55;
          state.mp = state.maxMp * 0.5;
          hero.group.position.set(0, 0, 8);
          toast('Você caiu em batalha, mas foi salvo por Aurelia.');
          playTone(80, 0.4, 'sawtooth', 0.06);
        }
        updateUI();
        save();
      }
    }

    enemy.body.material.emissiveIntensity = Math.max(0, enemy.body.material.emissiveIntensity - delta * 6);
    enemy.body.material.emissive = new THREE.Color(0x000000);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
  }
}

function updateProjectiles(delta) {
  for (const projectile of [...projectiles]) {
    projectile.life -= delta;
    projectile.spin += delta * 8;

    let target = projectile.target && enemies.includes(projectile.target) ? projectile.target : null;
    if (!target) {
      let nearestDistance = Infinity;
      for (const enemy of enemies) {
        const d = enemy.group.position.distanceTo(projectile.mesh.position);
        if (d < nearestDistance) {
          nearestDistance = d;
          target = enemy;
        }
      }
      if (nearestDistance > 12) target = null;
      projectile.target = target;
    }

    if (target) {
      const desired = new THREE.Vector3(target.group.position.x - projectile.mesh.position.x, 1.2, target.group.position.z - projectile.mesh.position.z).normalize();
      projectile.dir.lerp(desired, Math.min(0.22, delta * 4));
      projectile.dir.normalize();
    }

    projectile.mesh.position.addScaledVector(projectile.dir, projectile.speed * delta);
    projectile.mesh.rotation.x += delta * 3;
    projectile.mesh.rotation.y += delta * 5;

    projectile.mesh.children.forEach((part) => {
      if (part.userData.orbit !== undefined) {
        const a = projectile.spin + part.userData.orbit * (Math.PI / 2);
        part.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, Math.sin(a * 0.7) * 0.2);
      }
    });

    projectile.trail -= delta;
    if (projectile.trail <= 0) {
      projectile.trail = 0.055;
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: projectile.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      tail.position.copy(projectile.mesh.position);
      tail.scale.set(0.9, 0.9, 1);
      scene.add(tail);
      projectiles.push({
        mesh: tail,
        dir: new THREE.Vector3(),
        life: 0.12,
        speed: 0,
        damage: 0,
        aoe: 0,
        color: projectile.color,
        trail: 1,
      });
    }

    let hit = null;
    let hitT = 0;
    const previous = projectile.previous || projectile.mesh.position.clone();
    for (const enemy of enemies) {
      const ex = enemy.group.position.x - previous.x;
      const ez = enemy.group.position.z - previous.z;
      const dx = projectile.mesh.position.x - previous.x;
      const dz = projectile.mesh.position.z - previous.z;
      const denom = dx * dx + dz * dz;
      let t = 0;
      if (denom) t = THREE.MathUtils.clamp((ex * dx + ez * dz) / denom, 0, 1);
      const px = previous.x + dx * t;
      const pz = previous.z + dz * t;
      const radius = enemy.type === 'boss' ? 1.8 : 1.1;
      if (Math.hypot(enemy.group.position.x - px, enemy.group.position.z - pz) < radius) {
        hit = enemy;
        hitT = t;
        break;
      }
    }
    projectile.previous = projectile.mesh.position.clone();

    if (hit || projectile.life <= 0) {
      const finalPos = hit ? new THREE.Vector3(previous.x + (projectile.mesh.position.x - previous.x) * hitT, 1.2, previous.z + (projectile.mesh.position.z - previous.z) * hitT) : projectile.mesh.position.clone();
      burst(finalPos, projectile.color, projectile.aoe * 0.6);
      for (const enemy of [...enemies]) {
        const dist = Math.hypot(enemy.group.position.x - finalPos.x, enemy.group.position.z - finalPos.z);
        if (dist < projectile.aoe + (enemy.type === 'boss' ? 1.2 : 0.55)) {
          damageEnemy(enemy, projectile.damage, projectile.color);
        }
      }
      scene.remove(projectile.mesh);
      projectiles.splice(projectiles.indexOf(projectile), 1);
    }
  }

  for (const object of [...projectiles]) {
    if (object.mesh && object.mesh.isSprite && object.life <= 0) {
      scene.remove(object.mesh);
      projectiles.splice(projectiles.indexOf(object), 1);
    }
  }
}

function updateEffects(delta) {
  for (const effect of [...effectGroup.children]) {
    const data = effect.userData || {};
    if (!data.life) continue;
    data.life -= delta;
    if (data.kind === 'ring') {
      const progress = 1 - data.life / 0.4;
      effect.scale.setScalar(1 + progress * 2.8);
      effect.material.opacity = Math.max(0, data.life * 1.8);
    } else {
      effect.scale.multiplyScalar(1 + delta * 4);
      effect.material.opacity = Math.max(0, data.life * 2.5);
    }
    if (data.life <= 0) {
      effectGroup.remove(effect);
    }
  }
}

function updatePlayer(delta, elapsed) {
  const keys = window.keys || {};
  const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joystick.x;
  const moveZ = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joystick.y;
  const length = Math.hypot(moveX, moveZ);
  let finalX = moveX;
  let finalZ = moveZ;
  if (length > 1) {
    finalX /= length;
    finalZ /= length;
  }

  const speed = hero.dash > 0 ? 13 : 7.6;
  hero.group.position.x += finalX * speed * delta;
  hero.group.position.z += finalZ * speed * delta;
  hero.group.position.y = 0;

  if (Math.hypot(finalX, finalZ) > 0.08) {
    hero.group.rotation.y = Math.atan2(finalX, finalZ);
  }

  hero.dash = Math.max(0, hero.dash - delta);
  hero.invuln = Math.max(0, hero.invuln - delta);

  const walk = elapsed * 8 + (hero.dash > 0 ? 6 : 0);
  hero.legs.forEach((leg, index) => {
    leg.rotation.x = Math.hypot(finalX, finalZ) > 0.08 ? Math.sin(walk + index * Math.PI) * 0.8 : 0;
  });
  hero.arms.forEach((arm, index) => {
    arm.rotation.x = Math.hypot(finalX, finalZ) > 0.08 ? Math.sin(walk + index * Math.PI + Math.PI) * 0.32 : 0;
  });
  hero.cloak.rotation.z = Math.hypot(finalX, finalZ) > 0.08 ? Math.sin(walk) * 0.1 : 0;

  state.mp = Math.min(state.maxMp, state.mp + delta * 5);
  if (state.hp < state.maxHp && !enemies.some((enemy) => enemy.group.position.distanceTo(hero.group.position) < 7)) {
    state.hp = Math.min(state.maxHp, state.hp + delta * 0.45);
  }
}

function updateWorldCamera(delta, elapsed) {
  const desired = new THREE.Vector3(hero.group.position.x, hero.group.position.y + 9.2, hero.group.position.z + 11.5);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 5));
  camera.lookAt(hero.group.position.x, 1.2, hero.group.position.z - 1.8);
  crystalGroup.rotation.y += delta * 0.35;
  crystal.position.y = 2 + Math.sin(elapsed * 1.6) * 0.18;
  halo.rotation.z += delta * 0.7;

  const nearestRegion = [...regions].sort((a, b) => {
    const da = Math.hypot(hero.group.position.x - a.x, hero.group.position.z - a.z);
    const db = Math.hypot(hero.group.position.x - b.x, hero.group.position.z - b.z);
    return da - db;
  })[0];
  $('#regionName').textContent = nearestRegion.name.toUpperCase();
  $('#weather').textContent = nearestRegion.name.includes('DUNAS') ? 'CALOR DAS DUNAS' : nearestRegion.name.includes('VALE') ? 'VENTO GELADO' : nearestRegion.name.includes('FLORESTA') ? 'AROMAS DA FLORESTA' : 'BRISA SERENA';
  $('.compass-label').textContent = `${nearestRegion.name.toUpperCase()} · ${Math.round(Math.hypot(hero.group.position.x - nearestRegion.x, hero.group.position.z - nearestRegion.z))} m`;
}

let lastUpdate = 0;
function animate(now) {
  if (!lastUpdate) lastUpdate = now;
  const elapsed = now / 1000;
  const delta = Math.min(0.04, (now - lastUpdate) / 1000 || 0.016);
  lastUpdate = now;

  updatePlayer(delta, elapsed);
  updateWorldCamera(delta, elapsed);
  updateEnemyAI(delta, elapsed);
  updateProjectiles(delta);
  updateEffects(delta);
  updateMusic(delta);
  updateInteraction();

  if (Math.floor(elapsed * 4) % 4 === 0) updateUI();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

$('#waveBtn').addEventListener('click', beginWave);

if (state.elementUnlocked) {
  const current = elementForName(state.element);
  crystal.material.color.setHex(current.color);
  crystal.material.emissive.setHex(current.color);
  halo.material.color.setHex(current.color);
}
if (Number.isFinite(state.px) && Number.isFinite(state.pz)) hero.group.position.set(state.px, 0, state.pz);
updateUI();
buildMap();
$('#waveBtn').textContent = state.wave >= 7 ? '✦ DESAFIO CONCLUÍDO' : '✦ INICIAR DESAFIO';
$('#waveBtn').disabled = state.wave >= 7;
requestAnimationFrame(animate);

setInterval(() => {
  state.px = hero.group.position.x;
  state.pz = hero.group.position.z;
  save();
}, 4000);
