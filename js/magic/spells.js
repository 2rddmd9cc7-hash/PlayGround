/* =========================================================
 * Aetheria — Executor de magias + projéteis (com pooling)
 * Tipos: projectile, rain, nova, strike, chain, dash, cone,
 *        zone, vortex, wall, line
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { rand, chance, clamp, dist } from '../core/utils.js';
import { FX } from '../effects/particles.js';

/* ---------- Projétil ---------- */
const projGeos = {};
function projGeo(kind) {
  if (!projGeos[kind]) {
    if (kind === 'spear') projGeos[kind] = new THREE.ConeGeometry(0.16, 1.2, 6);
    else if (kind === 'rock') projGeos[kind] = new THREE.DodecahedronGeometry(0.32, 0);
    else projGeos[kind] = new THREE.SphereGeometry(0.22, 8, 8);
  }
  return projGeos[kind];
}

export class Projectile {
  constructor(scene, opts) {
    this.scene = scene;
    this.owner = opts.owner || 'player';       // 'player' | 'enemy'
    this.element = opts.element || null;
    this.dmg = opts.dmg || 10;
    this.radius = opts.radius || 1.5;          // raio de explosão
    this.pierce = opts.pierce || 0;
    this.slow = opts.slow || 0;                // lentidão aplicada (0..1)
    this.knock = opts.knock || 0;
    this.life = opts.life || 3;
    this.hitList = [];
    this.dead = false;
    this.explodeFx = opts.explodeFx !== false;

    const color = opts.color ?? 0xffffff;
    this.mesh = new THREE.Mesh(
      projGeo(opts.geo || 'orb'),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry((opts.geo === 'spear' ? 0.3 : 0.36), 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.mesh.add(glow);
    if (opts.geo === 'spear') this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.copy(opts.pos);
    this.vel = opts.vel.clone();
    this.speed = this.vel.length();
    scene.add(this.mesh);
    this.trailColor = color;
    this._t = 0;
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.die(game, true); return; }
    const step = this.vel.clone().multiplyScalar(dt);
    this.mesh.position.add(step);
    this.mesh.lookAt(this.mesh.position.clone().add(this.vel));
    // rastro
    this._t += dt;
    if (this._t > 0.04) {
      this._t = 0;
      game.fx.spawn(this.mesh.position, { count: 2, color: this.trailColor, speed: 0.6, spread: 0.2, life: 0.3, size: 4, alpha: 0.7 });
    }
    // colisão com terreno
    const p = this.mesh.position;
    const th = game.world.terrainHeight(p.x, p.z);
    if (p.y <= th + 0.1) { this.explode(game, p, th); return; }
    // colisão com alvos
    if (this.owner === 'player') {
      for (const e of game.enemies.list) {
        if (e.dead || this.hitList.includes(e)) continue;
        if (e.root.position.distanceTo(p) < e.hitRadius + 0.4) {
          this.hitList.push(e);
          if (this.pierce > 0) {
            this.pierce--;
            game.combat.hitEnemy(e, { dmg: this.dmg, element: this.element, knock: this.knock, slow: this.slow, from: this.owner === 'player' ? game.player.root.position : p });
            game.fx.spawn(p, { count: 6, color: this.trailColor, speed: 3, life: 0.3, size: 5 });
            if (this.pierce === 0) { this.explode(game, p, th); return; }
          } else { this.explode(game, p, th); return; }
        }
      }
    } else {
      // projétil inimigo: colide com jogador
      const pl = game.player;
      if (!pl.dead && pl.root.position.distanceTo(p) < 0.9) {
        game.combat.damagePlayer(this.dmg, p);
        this.die(game);
        return;
      }
      // e também bloqueia em muros
    }
    for (const w of game.world.obstacles || []) {
      if (w.blocksProjectiles && dist(w.x, w.z, p.x, p.z) < w.r && p.y < (w.top || 3)) { this.die(game); return; }
    }
  }
  explode(game, p, groundY) {
    if (this.radius > 0.5 && this.explodeFx) {
      // dano em área
      const el = this.element;
      if (this.owner === 'player') {
        for (const e of game.enemies.list) {
          if (e.dead) continue;
          const d = e.root.position.distanceTo(p);
          if (d < this.radius + e.hitRadius) {
            game.combat.hitEnemy(e, { dmg: this.dmg * (d < this.radius * 0.5 ? 1 : 0.7), element: el, knock: this.knock, slow: this.slow, from: game.player.root.position });
          }
        }
      } else {
        const d = game.player.root.position.distanceTo(p);
        if (d < this.radius) game.combat.damagePlayer(this.dmg * 0.8, p);
      }
      const fx = FX[(this.element || 'fire')] || FX.fire;
      fx(game.fx, new THREE.Vector3(p.x, Math.max(p.y, groundY ?? p.y) + 0.4, p.z), true);
      game.fx.ring(new THREE.Vector3(p.x, groundY ?? p.y, p.z), { radius: this.radius, color: this.trailColor, life: 0.35 });
      game.audio.playAt(this.element === 'earth' ? 'm_earth' : 'm_fireHit', 0.9, game.camera.cam.position.distanceTo(p), 60);
    } else {
      game.fx.spawn(p, { count: 5, color: this.trailColor, speed: 2, life: 0.25, size: 4 });
    }
    this.die(game);
  }
  die(game, silent = false) {
    this.dead = true;
    game.scene.remove(this.mesh);
    this.mesh.geometry && (this.mesh.material.dispose());
  }
}

/* ---------- Executor de magias ---------- */
export const SpellCaster = {
  /* game, player -> executa magia do elemento em índice i */
  cast(game, elem, spellIdx, power = 1) {
    const spell = elem.spells[spellIdx];
    const player = game.player;
    const origin = player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = game.camera.aimDir(new THREE.Vector3());
    // mira levemente para alvo travado
    const target = player.lockTarget && !player.lockTarget.dead ? player.lockTarget.root.position.clone().add(new THREE.Vector3(0, 1, 0)) : null;
    const color = elem.color;
    const lvl = (player.spellLevels[spell.id] || 1);
    const scale = power * (1 + (lvl - 1) * 0.15);

    switch (spell.kind) {
      case 'projectile': {
        const vel = dir.clone().multiplyScalar(spell.speed);
        vel.y = target ? ((target.y - origin.y) / Math.max(0.25, origin.distanceTo(target) / spell.speed)) * 0.6 : vel.y;
        if (target) { vel.add(target.clone().sub(origin).normalize().multiplyScalar(spell.speed * 0.25)); }
        game.spellProjectiles.push(new Projectile(game.scene, {
          owner: 'player', element: elem.id, dmg: spell.dmg * scale, radius: spell.radius, speed: spell.speed,
          pos: origin.clone().addScaledVector(dir, 0.8), vel,
          color, pierce: spell.pierce || 0, slow: spell.slow || 0, knock: spell.knock || 4,
          geo: spell.id === 'rock' ? 'rock' : (spell.id === 'oceanlance' || spell.id === 'glacial') ? 'spear' : 'orb', life: 3
        }));
        FX[elem.id](game.fx, origin, false);
        break;
      }
      case 'strike': {
        // ponto visado: raycast simples para o chão à frente
        const aim = this.aimPoint(game, 30);
        game.effectQueue.push({ type: 'strike', pos: aim, t: 0, dmg: spell.dmg * scale, radius: spell.radius, element: elem.id, color, stun: spell.stun || 0, done: false });
        break;
      }
      case 'rain': {
        const aim = this.aimPoint(game, 22);
        game.effectQueue.push({ type: 'rain', pos: aim, t: 0, dur: spell.dur, strikes: spell.strikes, nextStrike: 0, dmg: spell.dmg * scale, radius: spell.radius, element: elem.id, color, done: false });
        break;
      }
      case 'nova': {
        const p = player.root.position;
        game.fx.ring(new THREE.Vector3(p.x, game.world.terrainHeight(p.x, p.z) + 0.2, p.z), { radius: spell.radius, color, life: 0.5 });
        FX[elem.id](game.fx, p.clone().add(new THREE.Vector3(0, 0.5, 0)), true);
        game.camera.addShake(0.25);
        for (const e of game.enemies.list) {
          if (e.dead) continue;
          const d = e.root.position.distanceTo(p);
          if (d < spell.radius + e.hitRadius) {
            game.combat.hitEnemy(e, { dmg: spell.dmg * scale, element: elem.id, knock: spell.knock || 6, stun: spell.stun || 0, from: p });
          }
        }
        if (elem.id === 'earth') game.audio.play('m_earth', 1);
        break;
      }
      case 'chain': {
        let from = origin, remaining = spell.jumps;
        const hitSet = new Set();
        let cur = this.nearestEnemy(game, origin, spell.range * 1.4, hitSet);
        while (cur && remaining > 0) {
          hitSet.add(cur);
          game.combat.hitEnemy(cur, { dmg: spell.dmg * scale, element: elem.id, from });
          game.fx.spawn(cur.root.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 10, color: 0xfff060, speed: 5, life: 0.25, size: 4 });
          game.fx.ring(cur.root.position, { radius: 1.2, color: 0xfff060, life: 0.25 });
          remaining--;
          from = cur.root.position.clone().add(new THREE.Vector3(0, 1, 0));
          cur = this.nearestEnemy(game, from, spell.range, hitSet);
        }
        if (hitSet.size === 0) game.fx.spawn(origin, { count: 8, color: 0xfff060, speed: 4, life: 0.3, size: 4 });
        break;
      }
      case 'dash': {
        const distTo = Math.min(spell.dist, game.world.terrainHeight ? 99 : 99);
        player.dashTo(dir.clone().multiplyScalar(distTo), 0.22);
        game.effectQueue.push({
          type: 'dashTrail', pos: player.root.position.clone(), dir: dir.clone(), t: 0, dur: 0.25,
          dmg: spell.dmg * scale, radius: spell.radius, element: elem.id, color, done: false
        });
        break;
      }
      case 'cone': {
        game.effectQueue.push({ type: 'cone', pos: origin, dir: dir.clone(), t: 0, dur: 0.8, dist: spell.radius, width: 2.6, dmg: spell.dmg * scale, element: elem.id, color, heal: spell.heal || 0, hit: false, done: false });
        break;
      }
      case 'zone': {
        game.effectQueue.push({ type: 'zone', pos: this.aimPoint(game, 14), t: 0, dur: spell.dur, dmg: spell.dmg * scale, radius: spell.radius, element: elem.id, color, slow: spell.slow ?? 0.5, stun: spell.stun || 0, next: 0, done: false });
        break;
      }
      case 'vortex': {
        game.effectQueue.push({ type: 'vortex', pos: origin.clone().addScaledVector(dir, 2), dir: dir.clone(), t: 0, dur: spell.dur, dmg: spell.dmg * scale, radius: spell.radius, speed: spell.speed, element: elem.id, color, next: 0, done: false });
        break;
      }
      case 'wall': {
        const aim = this.aimPoint(game, 6);
        const mat = new THREE.MeshStandardMaterial({
          color: elem.id === 'ice' ? 0x9adfff : 0x8a6a4a,
          roughness: elem.id === 'ice' ? 0.2 : 0.9,
          transparent: true, opacity: 0.92
        });
        const wall = new THREE.Group();
        for (let i = -1; i <= 1; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, rand(2.4, 3.2), 0.7), mat);
          b.position.set(i * 1.6, 1.3, rand(-0.1, 0.1));
          b.castShadow = true;
          wall.add(b);
        }
        wall.position.copy(aim);
        wall.position.y = game.world.terrainHeight(aim.x, aim.z);
        wall.lookAt(player.root.position.x, wall.position.y, player.root.position.z);
        game.scene.add(wall);
        const obstacles = game.world.obstacles;
        obstacles.push({ x: aim.x, z: aim.z, r: 2.6, top: 3.2, blocksProjectiles: true, temp: true });
        game.effectQueue.push({ type: 'wall', mesh: wall, obstacle: obstacles[obstacles.length - 1], t: 0, dur: spell.dur, done: false });
        FX[elem.id](game.fx, aim.clone().add(new THREE.Vector3(0, 1, 0)), true);
        break;
      }
      case 'line': {
        const n = 5;
        for (let i = 1; i <= n; i++) {
          const p = origin.clone().addScaledVector(dir, i * (spell.len / n)).setY(player.root.position.y);
          game.effectQueue.push({ type: 'strike', pos: p, t: i * 0.08, dmg: spell.dmg * scale, radius: spell.radius, element: elem.id, color, done: false });
        }
        break;
      }
    }
    game.audio.play(spell.sfx || 'm_cast', 1);
    // XP de magia: sobe nível da magia usada
    player.castXP(spell.id, 1);
  },

  aimPoint(game, maxDist) {
    const player = game.player;
    const dir = game.camera.aimDir(new THREE.Vector3());
    const origin = player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    // prioriza alvo travado
    if (player.lockTarget && !player.lockTarget.dead) {
      const t = player.lockTarget.root.position.clone();
      return new THREE.Vector3(t.x, game.world.terrainHeight(t.x, t.z), t.z);
    }
    // raycast contra inimigos primeiro
    let best = null, bestD = maxDist;
    for (const e of game.enemies.list) {
      if (e.dead) continue;
      const to = e.root.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin);
      const proj = to.dot(dir);
      if (proj <= 0 || proj > maxDist) continue;
      const perp = to.clone().addScaledVector(dir, -proj).length();
      if (perp < 1.6 && proj < bestD) { bestD = proj; best = e; }
    }
    if (best) {
      const t = best.root.position;
      return new THREE.Vector3(t.x, game.world.terrainHeight(t.x, t.z), t.z);
    }
    // senão projeta no chão ~70% da distância máx
    const d = maxDist * 0.7;
    const p = origin.clone().addScaledVector(dir, d);
    return new THREE.Vector3(p.x, game.world.terrainHeight(p.x, p.z), p.z);
  },

  nearestEnemy(game, pos, range, exclude) {
    let best = null, bd = range * range;
    for (const e of game.enemies.list) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      const d = e.root.position.distanceToSquared(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  /* Atualiza fila de efeitos persistentes (chuvas, zonas, muros...) */
  updateEffects(dt, game) {
    const q = game.effectQueue;
    for (let i = q.length - 1; i >= 0; i--) {
      const f = q[i];
      f.t += dt;
      switch (f.type) {
        case 'strike': {
          if (!f.done && f.t >= 0) {
            f.done = true;
            const el = f.element;
            FX[el](game.fx, f.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), el === 'lightning');
            if (el === 'lightning') { game.fx.flash(f.pos.clone().add(new THREE.Vector3(0, 6, 0)), { color: 0xffffaa, intensity: 20, dist: 20, life: 0.15 }); game.audio.playAt('m_lightning', 0.9, game.camera.cam.position.distanceTo(f.pos), 70); }
            game.fx.ring(f.pos, { radius: f.radius, color: ELEMENT_COLOR(el), life: 0.3 });
            for (const e of game.enemies.list) {
              if (e.dead) continue;
              if (e.root.position.distanceTo(f.pos) < f.radius + e.hitRadius) {
                game.combat.hitEnemy(e, { dmg: f.dmg, element: el, stun: f.stun || 0, from: game.player.root.position });
              }
            }
          }
          if (f.t > 0.2) q.splice(i, 1);
          break;
        }
        case 'rain': {
          f.nextStrike -= dt;
          if (f.nextStrike <= 0 && f.strikes > 0) {
            f.strikes--;
            f.nextStrike = f.dur / Math.max(1, f.strikes + 1);
            const a = rand(0, Math.PI * 2), r = rand(0, f.radius);
            const p = new THREE.Vector3(f.pos.x + Math.cos(a) * r, game.world.terrainHeight(f.pos.x + Math.cos(a) * r, f.pos.z + Math.sin(a) * r), f.pos.z + Math.sin(a) * r);
            q.push({ type: 'strike', pos: p, t: 0, dmg: f.dmg, radius: 1.8, element: f.element, color: f.color, done: false });
          }
          if (f.t > f.dur) q.splice(i, 1);
          break;
        }
        case 'dashTrail': {
          if (!f.done) {
            f.done = true;
            for (const e of game.enemies.list) {
              if (e.dead) continue;
              if (e.root.position.distanceTo(game.player.root.position) < f.radius + e.hitRadius) {
                game.combat.hitEnemy(e, { dmg: f.dmg, element: f.element, from: f.pos });
              }
            }
          }
          if (f.t > 0.3) q.splice(i, 1);
          break;
        }
        case 'cone': {
          // onda avançando
          const prog = Math.min(1, f.t / f.dur);
          const cur = f.pos.clone().addScaledVector(f.dir, prog * f.dist);
          cur.y = game.world.terrainHeight(cur.x, cur.z) + 0.5;
          game.fx.spawn(cur, { count: 4, color: f.color, speed: 3, spread: f.width * 0.6, life: 0.35, size: 6, gravity: 4 });
          if (!f.hit) {
            for (const e of game.enemies.list) {
              if (e.dead) continue;
              const d = e.root.position.distanceTo(cur);
              if (d < f.width + e.hitRadius) {
                game.combat.hitEnemy(e, { dmg: f.dmg, element: f.element, knock: 8, from: f.pos });
                f.hit = true;
                if (f.heal) game.player.heal(f.heal);
              }
            }
          }
          if (prog >= 1) q.splice(i, 1);
          break;
        }
        case 'zone': {
          if (!f.mesh) {
            f.mesh = createZoneMesh(game.scene, f.color);
            game.scene.add(f.mesh);
          }
          const mesh = f.mesh;
          mesh.position.set(f.pos.x, game.world.terrainHeight(f.pos.x, f.pos.z) + 1.6, f.pos.z);
          mesh.scale.set(f.radius, 1, f.radius);
          mesh.rotation.y += dt * 0.6;
          f.next -= dt;
          if (f.next <= 0) {
            f.next = 0.6;
            for (const e of game.enemies.list) {
              if (e.dead) continue;
              const d = e.root.position.distanceTo(f.pos);
              if (d < f.radius + e.hitRadius) {
                if (f.stun) e.applyStun(f.stun);
                if (f.slow) e.applySlow(f.slow, 1.2);
                game.combat.hitEnemy(e, { dmg: f.dmg, element: f.element, from: f.pos, silent: true });
              }
            }
            game.fx.spawn(f.pos.clone().add(new THREE.Vector3(0, 1, 0)), { count: 4, color: f.color, speed: 1.5, spread: f.radius * 0.8, life: 0.6, size: 5 });
          }
          if (f.t > f.dur) { game.scene.remove(f.mesh); mesh.material.dispose(); q.splice(i, 1); }
          break;
        }
        case 'vortex': {
          f.pos.addScaledVector(f.dir, f.speed * dt);
          f.pos.y = game.world.terrainHeight(f.pos.x, f.pos.z) + 0.5;
          game.fx.spawn(f.pos, { count: 3, color: f.color, speed: 5, spread: f.radius, life: 0.4, size: 5, cone: 2 });
          f.next -= dt;
          if (f.next <= 0) {
            f.next = 0.45;
            for (const e of game.enemies.list) {
              if (e.dead) continue;
              const d = e.root.position.distanceTo(f.pos);
              if (d < f.radius + e.hitRadius) {
                game.combat.hitEnemy(e, { dmg: f.dmg, element: f.element, knock: 0, from: f.pos });
                e.knockback(f.pos, 3);
              }
            }
          }
          if (f.t > f.dur) q.splice(i, 1);
          break;
        }
        case 'wall': {
          const fade = Math.min(1, f.dur - f.t < 1 ? (f.dur - f.t) : 1);
          f.mesh.traverse(o => { if (o.isMesh) o.material.opacity = 0.92 * Math.max(0, fade); });
          if (f.t > f.dur) {
            game.scene.remove(f.mesh);
            const oi = (game.world.obstacles || []).indexOf(f.obstacle);
            if (oi >= 0) game.world.obstacles.splice(oi, 1);
            q.splice(i, 1);
          }
          break;
        }
      }
    }
  }
};

function ELEMENT_COLOR(el) {
  const map = { fire: 0xff6a20, water: 0x3090ff, lightning: 0xfff060, earth: 0xb07a3a, wind: 0xcfe8d8, ice: 0x9adfff };
  return map[el] || 0xffffff;
}
function createZoneMesh(scene, color) {
  const geo = new THREE.CylinderGeometry(1, 1.06, 3.4, 20, 1, true);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  return m;
}
