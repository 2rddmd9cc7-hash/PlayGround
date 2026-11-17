/* =========================================================
 * Aetheria — NPCs vivos: rotinas, diálogos, lojas
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { buildHumanoid } from '../player/character.js';
import { rand, chance, dist } from '../core/utils.js';
import { heightAt } from '../world/world.js';

function labelSprite(text, color = '#f5d97a') {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 30px Georgia';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.6, 0.65, 1);
  return sp;
}

export const NPC_DEFS = [
  {
    id: 'elder', name: 'Ancião Tomás', role: 'Ancião da vila', color: 0x6a5a8a, hair: 0xc8c0b0,
    home: [-10, 24], work: [2, 6], label: 'Ancião Tomás',
    talksTo: ['player']
  },
  {
    id: 'blacksmith', name: 'Ferreiro Doren', role: 'Ferreiro', color: 0x5a4030, hair: 0x2a1a10,
    home: [30, 14], work: [28, 9], shop: 'smith'
  },
  {
    id: 'merchant', name: 'Comerciante Lysa', role: 'Comerciante', color: 0x3a6a8a, hair: 0x8a5a2a,
    home: [30, -8], work: [26, -4], shop: 'general'
  },
  {
    id: 'innkeeper', name: 'Taverneiro Bram', role: 'Taverneiro', color: 0x8a5a2a, hair: 0x3a2818,
    home: [-30, 16], work: [-27, 11]
  },
  {
    id: 'priest', name: 'Sacerdotisa Mira', role: 'Sacerdotisa', color: 0xd8d0c0, hair: 0xd8c070,
    home: [-36, -24], work: [-33, -21]
  },
  {
    id: 'farmer', name: 'Agricultor Hob', role: 'Agricultor', color: 0x4a6a30, hair: 0x6a4a2a,
    home: [14, 42], work: [22, 38]
  },
  {
    id: 'arion', name: 'Mago Arion', role: 'Mago da Ordem', color: 0x2a3a6a, hair: 0xd8d8e8,
    home: [0, -230], work: [-8, -238], label: 'Mago Arion'
  },
  {
    id: 'guard1', name: 'Guarda Kell', role: 'Guarda real', color: 0x6a6a72, hair: 0x4a3a20,
    home: [-6, -206], work: [4, -200], patrol: [[-6, -206], [0, -195], [6, -206]]
  },
  {
    id: 'guard2', name: 'Soldado Rowan', role: 'Soldado', color: 0x5a5a62, hair: 0x6a4a2a,
    home: [8, -220], work: [0, -230], patrol: [[8, -220], [14, -228], [8, -238], [0, -230]]
  },
  { id: 'kid1', name: 'Pequeno Finn', role: 'Criança', color: 0x7a9a4a, hair: 0x8a6a2a, home: [-4, 10], work: [8, 4], kid: true },
  { id: 'kid2', name: 'Pequena Nia', role: 'Criança', color: 0x9a6a7a, hair: 0x5a3a1a, home: [6, 12], work: [-8, 2], kid: true },
  { id: 'villager1', name: 'Aldeão Piet', role: 'Aldeão', color: 0x8a7a4a, home: [4, 26], work: [-6, 14] },
  { id: 'villager2', name: 'Aldeã Sela', role: 'Aldeã', color: 0x7a5a6a, home: [20, -12], work: [12, -6] },
  { id: 'captain', name: 'Capitão Rhys', role: 'Capitão da guarda', color: 0x4a4a5a, hair: 0x2a2a2a, home: [0, -235], work: [0, -222], patrol: [[0, -222], [8, -215], [0, -208], [-8, -215]] }
];

export class NPC {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.role = def.role;
    this.relation = 0;
    const ch = buildHumanoid({
      skin: 0xd8a880, cloth: def.color, cloth2: 0x4a3a26, hair: def.hair ?? 0x3a281a,
      scale: def.kid ? 0.62 : rand(0.94, 1.04), cape: def.role.includes('Mago') ? 0x2a2a5a : (def.role.includes('Capitão') || def.role.includes('Guarda') ? 0x6a1a12 : null)
    });
    this.body = ch.parts;
    this.root = ch.root;
    if (def.label) {
      const sp = labelSprite(def.name);
      sp.position.y = 2.15;
      this.root.add(sp);
      this.label = sp;
    }
    this.home = new THREE.Vector3(def.home[0], 0, def.home[1]);
    this.work = new THREE.Vector3(def.work[0], 0, def.work[1]);
    this.patrol = def.patrol ? def.patrol.map(p => new THREE.Vector3(p[0], 0, p[1])) : null;
    this.pos = this.work.clone();
    this.root.position.set(this.work.x, heightAt(this.work.x, this.work.z), this.work.z);
    this.target = this.work.clone();
    this.waitT = rand(1, 4);
    this.animT = rand(0, 10);
    this.patrolIdx = 0;
    this.speakT = rand(4, 14);
    game.scene.add(this.root);
  }

  currentGoal(isNight) {
    if (this.def.kid) return isNight ? this.home : this.work;
    return isNight ? this.home : this.work;
  }

  update(dt) {
    const game = this.game;
    this.animT += dt;
    const isNight = game.daynight.isNight;
    let goal = this.currentGoal(isNight);
    let speed = this.def.kid ? 2.2 : 1.5;

    // patrulha de guardas durante o dia
    if (this.patrol && !isNight && !game.story.invasionActive) {
      const wp = this.patrol[this.patrolIdx];
      goal = wp;
      if (dist(this.pos.x, this.pos.z, wp.x, wp.z) < 1.2) {
        this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      }
      speed = 1.9;
    }

    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 1) {
      moving = true;
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
      this.root.rotation.y = Math.atan2(dx, dz);
    } else {
      // espera/idle
      this.waitT -= dt;
      if (this.waitT <= 0) {
        this.waitT = rand(2, 6);
        if (this.def.kid && !isNight) {
          // crianças correm pela praça
          const a = rand(0, Math.PI * 2);
          goal = this.work.clone().add(new THREE.Vector3(Math.cos(a) * rand(2, 10), 0, Math.sin(a) * rand(2, 10)));
        }
      }
      this.root.rotation.y += Math.sin(this.animT * 0.6) * dt * 0.3;
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);

    /* animação procedural simples */
    const B = this.body;
    const w = Math.sin(this.animT * (this.def.kid ? 12 : 7));
    const amp = moving ? 0.55 : 0;
    if (B.legL) {
      B.legL.rotation.x = w * amp; B.legR.rotation.x = -w * amp;
      B.shinL.rotation.x = Math.max(0, -w) * amp * 0.8; B.shinR.rotation.x = Math.max(0, w) * amp * 0.8;
      B.armL.rotation.x = -w * amp * 0.6; B.armR.rotation.x = w * amp * 0.6;
      B.hip.position.y = 0.95 + (moving ? Math.abs(Math.sin(this.animT * 7)) * 0.04 : Math.sin(this.animT * 2) * 0.015);
      B.head.rotation.y = Math.sin(this.animT * 0.8) * 0.2;
    }

    /* falas ambientes (bolhas de texto) */
    this.speakT -= dt;
    if (this.speakT <= 0) {
      this.speakT = rand(12, 30);
      if (dist(this.pos.x, this.pos.z, game.player.root.position.x, game.player.root.position.z) < 14 && chance(0.5)) {
        game.hud.bubble(this.root.position, this.ambientLine());
      }
    }
  }

  ambientLine() {
    const isNight = this.game.daynight.isNight;
    const lines = {
      elder: ['Que os Antigos protejam Pedravale.', 'O castelo aguarda os jovens candidatos.'],
      blacksmith: ['Aço bom não nasce de minério ruim.', 'Hmpf. Preciso de mais carvão…'],
      merchant: ['Poções frescas! Ervas do vale!', 'Ouro bem gasto é ouro bem ganho.'],
      innkeeper: ['Cerveja gelada e história quente!', 'Dizem que há um lobo enorme nas montanhas…'],
      priest: ['A luz guia os perdidos.', 'Reze, e o cristal responderá.'],
      farmer: ['Colheita boa este ano.', 'Cuidado com os corvos… e com goblins.'],
      arion: ['O poder escolhe. Nós apenas escutamos.', 'Seis elementos, um destino.'],
      guard1: ['Fiquem atentos ao portão.', 'Tudo tranquilo por aqui.'],
      guard2: ['Já vi pegadas de goblin na estrada norte…'],
      captain: ['Mantenham a formação.', 'A cidade conta com nós.'],
      kid1: ['Corre, pegadas! 🏃', 'Quando crescer, serei cavaleiro!'],
      kid2: ['Você viu a luz do castelo ontem? ✨'],
      villager1: ['Bom dia, viajante!', 'Que dia bonito.'],
      villager2: ['Dizem que o lago é mágico…']
    };
    const arr = lines[this.id] || ['…'];
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return pick + (isNight && this.def.kid ? ' (boceja)' : '');
  }
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = NPC_DEFS.map(d => new NPC(game, d));
    this.byId = {};
    for (const n of this.npcs) this.byId[n.id] = n;
  }
  get(id) { return this.byId[id]; }
  update(dt) {
    const pp = this.game.player.root.position;
    for (const n of this.npcs) {
      // LOD: perto atualiza sempre, longe com menos frequência
      const d = dist(n.pos.x, n.pos.z, pp.x, pp.z);
      if (d < 90) n.update(dt);
      else if (Math.random() < dt * 2) n.update(dt * 5);
    }
  }
  nearest(pos, r = 3.2) {
    let best = null, bd = r * r;
    for (const n of this.npcs) {
      const d = dist(n.pos.x, n.pos.z, pos.x, pos.z);
      if (d < r && d < bd) { bd = d; best = n; }
    }
    return best;
  }
}
