// Conjuração de magias — projéteis, áreas, combos e efeitos por elemento
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { ELEMENTS, getSpellDef } from './elements.js';
import { effects, ELEMENT_COLORS } from '../effects/effects.js';
import { audio } from '../audio/audio.js';
import { wasPressed } from '../core/input.js';
import { rand } from '../core/utils.js';
import { terrainHeight } from '../world/terrain.js';

const _dir = new THREE.Vector3();

class MagicSystem {
  constructor() {
    this.cooldowns = {};   // spellId -> restante
    this.projectiles = []; // { mesh, vx,vy,vz, dmg, element, spell, life, friendly, from }
    this.areas = [];       // efeitos persistentes (tornados, prisões)
    this.activeSlot = 1;
  }

  update(dt, camera) {
    // cooldowns
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    // troca de slot ativo (Q/E para ciclo? simples: o slot é o da hotbar 1-4)
    // projéteis
    const enemies = G.enemies ? G.enemies.active : [];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      // gravidade leve
      if (p.grav) p.vy -= p.grav * dt;
      // rastro
      if (Math.random() < dt * 40) {
        const c = ELEMENT_COLORS[p.element];
        effects.particles.emit({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z, vx: rand(-0.5, 0.5), vy: rand(-0.3, 0.3), vz: rand(-0.5, 0.5), life: 0.35, size: 0.35, r: c.r, g: c.g, b: c.b, drag: 0.9 });
      }
      // impacto
      let hit = false;
      if (p.friendly) {
        for (const e of enemies) {
          if (e.dead) continue;
          const d = p.mesh.position.distanceTo(e.center());
          if (d < p.spell.radius + e.radius) {
            this._impactProjectile(p, e);
            hit = true;
            break;
          }
        }
      } else {
        const pl = G.player;
        const d = p.mesh.position.distanceTo(new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1, pl.root.position.z));
        if (d < p.spell.radius + 0.8) {
          this._impactProjectile(p, null);
          hit = true;
        }
      }
      const ground = terrainHeight(p.mesh.position.x, p.mesh.position.z);
      if (!hit && p.mesh.position.y <= ground + 0.2) {
        this._impactProjectile(p, null);
        hit = true;
      }
      if (hit || p.life <= 0) {
        G.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    // áreas persistentes
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i];
      a.t += dt;
      a.update?.(dt);
      if (a.t >= a.duration) {
        if (a.mesh) G.scene.remove(a.mesh);
        this.areas.splice(i, 1);
      }
    }
  }

  _impactProjectile(p, enemy) {
    const c = ELEMENT_COLORS[p.element];
    const pos = p.mesh.position;
    effects.explosion(pos.x, pos.y, pos.z, c.hex, 20, p.spell.radius * 0.8);
    audio.sfx('magicHit', { freq: p.element === 'gelo' ? 1400 : p.element === 'raio' ? 900 : 600 });
    const dmg = this.spellDamage(p.spell);
    if (enemy) {
      enemy.takeDamage(dmg, { x: p.vx * 0.06, z: p.vz * 0.06, kb: 3, element: p.element, source: 'magic', crit: Math.random() < 0.15 });
      if (p.spell.freeze) enemy.freeze(p.spell.freeze * (1 + G.attributes.poder * 0.05));
    } else {
      // impacto no chão: área pequena
      this._areaDamage(pos.x, pos.z, p.spell.radius * 0.7, dmg * 0.7, p.element, p.spell, 0);
    }
  }

  spellDamage(spell) {
    const lvl = G.spells[spell.id]?.level || 1;
    return spell.dmg * (1 + (lvl - 1) * 0.25) * (1 + G.attributes.poder * 0.09);
  }

  castSlot(slot, opts = {}) {
    if (!G.element) { G.hud?.hint('Você ainda não possui elemento.'); return false; }
    const spell = getSpellDef(G.element, slot);
    if (!spell) return false;
    const known = G.spells[spell.id];
    if (!known) { G.hud?.hint(`Magia bloqueada: desbloqueia no nível ${spell.unlock}.`); return false; }
    const cd = this.cooldowns[spell.id] || 0;
    if (cd > 0) { G.hud?.hint('Recarregando…'); return false; }
    const manaCost = spell.mana * (1 - Math.min(0.3, (G.attributes.mana - 5) * 0.01));
    if (G.mp < manaCost) { G.hud?.hint('Mana insuficiente!'); return false; }
    if (G.player.dead) return false;

    const pl = G.player;
    if (['attack', 'heavy', 'dodge'].includes(pl.state)) return false;

    G.mp -= manaCost;
    this.cooldowns[spell.id] = spell.cd;
    known.uses++;
    // evolução da magia: a cada 25 usos sobe de nível (até 5)
    if (known.uses % 25 === 0 && known.level < 5) {
      known.level++;
      G.hud?.floatText?.(`${spell.name} nível ${known.level}!`, pl.root.position, '#ffe633');
      audio.sfx('levelup');
      G.grimoire?.refresh();
    }

    const camDir = _dir.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const origin = new THREE.Vector3(pl.root.position.x, pl.root.position.y + 1.4, pl.root.position.z);
    pl.state = 'cast'; pl.stateT = 0;
    pl.actionYaw = Math.atan2(camDir.x, camDir.z);
    audio.sfx('magicCast', { element: G.element });
    const color = ELEMENTS[G.element].color;

    switch (spell.type) {
      case 'projectile': this._castProjectile(spell, origin, camDir, color, true); break;
      case 'beam': this._castBeam(spell, origin, camDir, color); break;
      case 'chain': this._castChain(spell, origin, color); break;
      case 'nova': this._castNova(spell, origin, color); break;
      case 'rain': this._castRain(spell, origin, camDir, color); break;
      case 'meteor': this._castMeteor(spell, origin, camDir, color); break;
      case 'dash': case 'windDash': this._castDash(spell, camDir, color); break;
      case 'spikes': this._castSpikes(spell, origin, camDir, color); break;
      case 'quake': this._castQuake(spell, origin, color); break;
      case 'storm': this._castStorm(spell, origin, camDir, color); break;
      case 'prison': this._castPrison(spell, origin, camDir, color); break;
      case 'tornado': this._castTornado(spell, origin, camDir, color); break;
    }
    G.hud?.flashSlot(slot);
    return true;
  }

  _aimPoint(origin, camDir, maxRange = 30) {
    // ponto alvo: inimigo próximo à linha de mira, senão ponto a X metros
    const enemies = G.enemies ? G.enemies.active : [];
    let best = null, bestScore = 0.9;
    for (const e of enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3(e.root.position.x, e.root.position.y + 0.8, e.root.position.z).sub(origin);
      const dist = to.length();
      if (dist > maxRange + 6) continue;
      to.normalize();
      const dot = to.dot(camDir);
      if (dot > bestScore) { bestScore = dot; best = e; }
    }
    if (best) {
      return { point: new THREE.Vector3(best.root.position.x, best.root.position.y + 0.8, best.root.position.z), enemy: best };
    }
    return { point: origin.clone().addScaledVector(camDir, maxRange), enemy: null };
  }

  _castProjectile(spell, origin, camDir, color, friendly) {
    const mesh = effects.makeProjectileMesh(color, 0.28);
    mesh.position.copy(origin);
    G.scene.add(mesh);
    const p = { mesh, spell, element: G.element, friendly, life: 3, grav: spell.id.includes('terra') ? 4 : 0 };
    const aim = this._aimPoint(origin, camDir);
    const dir = aim.point.sub(origin).normalize();
    if (aim.enemy) {
      // preditivo leve
      dir.y += 0.02;
      dir.normalize();
    }
    p.vx = dir.x * spell.speed; p.vy = dir.y * spell.speed; p.vz = dir.z * spell.speed;
    this.projectiles.push(p);
    const c = ELEMENT_COLORS[G.element];
    effects.particles.burst(origin.x, origin.y, origin.z, 10, { r: c.r, g: c.g, b: c.b, spread: 1, up: 0.5, life: 0.3, size: 0.3 });
  }

  _castBeam(spell, origin, camDir, color) {
    const aim = this._aimPoint(origin, camDir, spell.range);
    const end = aim.point;
    // linha de raio
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    G.scene.add(line);
    this.areas.push({ t: 0, duration: 0.12, mesh: line });
    const dist = origin.distanceTo(end);
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      effects.hit(origin.x + (end.x - origin.x) * t, origin.y + (end.y - origin.y) * t, origin.z + (end.z - origin.z) * t, color, 4, 0.3);
    }
    audio.sfx('thunder');
    const dmg = this.spellDamage(spell);
    if (aim.enemy) aim.enemy.takeDamage(dmg, { element: 'raio', source: 'magic', crit: Math.random() < 0.25 });
    else this._areaDamage(end.x, end.z, 1.5, dmg * 0.6, 'raio', spell);
    G.camCtl.shakeIt(0.3);
  }

  _castChain(spell, origin, color) {
    const aim = this._aimPoint(origin, camDir(), spell.range);
    let cur = aim.enemy;
    if (!cur) { this._castBeam({ ...spell, range: spell.range }, origin, camDir(), color); return; }
    const hitSet = new Set();
    let from = origin.clone();
    let jumps = spell.jumps + Math.floor(G.attributes.poder / 10);
    for (let j = 0; j < jumps && cur; j++) {
      const to = new THREE.Vector3(cur.root.position.x, cur.root.position.y + 0.8, cur.root.position.z);
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      G.scene.add(line);
      this.areas.push({ t: 0, duration: 0.15, mesh: line });
      cur.takeDamage(this.spellDamage(spell) * (1 - j * 0.15), { element: 'raio', source: 'magic', crit: Math.random() < 0.2 });
      audio.sfx('thunder');
      hitSet.add(cur);
      // próximo alvo
      const enemies = G.enemies ? G.enemies.active : [];
      let next = null, nd = spell.range;
      for (const e of enemies) {
        if (e.dead || hitSet.has(e)) continue;
        const d = e.root.position.distanceTo(cur.root.position);
        if (d < nd) { nd = d; next = e; }
      }
      from = to.clone();
      cur = next;
    }
  }

  _castNova(spell, origin, color) {
    const c = ELEMENT_COLORS[G.element];
    effects.explosion(origin.x, origin.y - 0.5, origin.z, c.hex, 40, spell.radius);
    G.camCtl.shakeIt(0.6);
    audio.sfx(G.element === 'terra' ? 'earth' : G.element === 'gelo' ? 'ice' : G.element === 'raio' ? 'thunder' : 'explosion');
    const dmg = this.spellDamage(spell);
    this._areaDamage(origin.x, origin.z, spell.radius, dmg, G.element, spell, 4);
  }

  _castRain(spell, origin, camDir, color) {
    const target = this._aimPoint(origin, camDir, 20).point;
    const cx = target.x, cz = target.z;
    const duration = 3;
    const c = ELEMENT_COLORS[G.element];
    const area = {
      t: 0, duration,
      update: (dt) => {
        if (Math.random() < dt * 30) {
          const x = cx + rand(-spell.radius, spell.radius), z = cz + rand(-spell.radius, spell.radius);
          effects.particles.emit({ x, y: terrainHeight(cx, cz) + 12, z, vx: 0, vy: -14, vz: 0, life: 0.85, size: 0.3, r: c.r, g: c.g, b: c.b, drag: 1, grav: 0 });
        }
        if (Math.random() < dt * 8) {
          const x = cx + rand(-spell.radius, spell.radius), z = cz + rand(-spell.radius, spell.radius);
          this._areaDamage(x, z, 1.6, this.spellDamage(spell) * 0.4, G.element, spell, 0, true);
        }
      },
    };
    this.areas.push(area);
  }

  _castMeteor(spell, origin, camDir, color) {
    const target = this._aimPoint(origin, camDir, 25).point;
    const c = ELEMENT_COLORS[G.element];
    const start = target.clone().add(new THREE.Vector3(rand(-4, 4), 35, rand(-4, 4)));
    const mesh = effects.makeProjectileMesh(color, 1.1);
    mesh.position.copy(start);
    G.scene.add(mesh);
    const area = {
      t: 0, duration: 1.4, mesh,
      update: (dt) => {
        const dirv = target.clone().add(new THREE.Vector3(0, 0.5, 0)).sub(mesh.position);
        const d = dirv.length();
        if (d < 1.2) {
          // impacto!
          effects.explosion(target.x, target.y, target.z, c.hex, 70, spell.radius);
          effects.flashSphere(target.x, target.y, target.z, spell.radius * 1.6, 0xffdd88, 0.6, 0.9);
          audio.sfx('explosion'); audio.sfx('fire');
          G.camCtl.shakeIt(1.2);
          this._areaDamage(target.x, target.z, spell.radius, this.spellDamage(spell), G.element, spell, 8);
          this._burn(target.x, target.z, spell.radius, 5);
          area.t = 99; // encerra
        } else {
          mesh.position.addScaledVector(dirv.normalize(), Math.min(d, 38 * dt));
          if (Math.random() < 0.8) effects.particles.emit({ x: mesh.position.x + rand(-0.8, 0.8), y: mesh.position.y + rand(-0.5, 0.5), z: mesh.position.z + rand(-0.8, 0.8), vy: 1, life: 0.5, size: 0.5, r: 1, g: 0.4, b: 0.1, drag: 0.93 });
        }
      },
    };
    this.areas.push(area);
  }

  _castDash(spell, camDir, color) {
    const pl = G.player;
    const c = ELEMENT_COLORS[G.element];
    const dir = _dir.clone().set(0, 0, -1).applyQuaternion(G.camera.quaternion); dir.y = 0; dir.normalize();
    const startX = pl.root.position.x, startZ = pl.root.position.z;
    const endX = pl.root.position.x + dir.x * 8, endZ = pl.root.position.z + dir.z * 8;
    const res = G.world.resolveMove(startX, startZ, endX, endZ, 0.55);
    const trail = 16;
    for (let i = 0; i < trail; i++) {
      const t = i / trail;
      const x = startX + (res.x - startX) * t, z = startZ + (res.z - startZ) * t;
      effects.particles.burst(x, pl.root.position.y + 0.8, z, 2, { r: c.r, g: c.g, b: c.b, spread: 0.5, up: 0.5, life: 0.4, size: 0.35, drag: 0.9 });
    }
    pl.root.position.set(res.x, terrainHeight(res.x, res.z), res.z);
    pl.iframe = Math.max(pl.iframe, 0.4);
    audio.sfx('thunder');
    // dano no caminho
    if (spell.dmg > 0) this._lineDamage(startX, startZ, res.x, res.z, 2, this.spellDamage(spell), G.element);
    pl.state = 'idle';
  }

  _castSpikes(spell, origin, camDir, color) {
    const dir = _dir.clone().set(0, 0, -1).applyQuaternion(G.camera.quaternion); dir.y = 0; dir.normalize();
    const pl = G.player;
    const c = ELEMENT_COLORS[G.element];
    const n = 6;
    for (let i = 1; i <= n; i++) {
      const x = pl.root.position.x + dir.x * i * 2.2, z = pl.root.position.z + dir.z * i * 2.2;
      setTimeout(() => {
        try {
          const y = terrainHeight(x, z);
          effects.explosion(x, y, z, c.hex, 12, 1.2);
          audio.sfx('earth');
          this._areaDamage(x, z, 1.8, this.spellDamage(spell) * 0.6, G.element, spell, 2);
        } catch (e) { /* ignore */ }
      }, i * 90);
    }
    G.camCtl.shakeIt(0.4);
  }

  _castQuake(spell, origin, color) {
    const pl = G.player;
    const c = ELEMENT_COLORS[G.element];
    G.camCtl.shakeIt(spell.big ? 1.6 : 1.0);
    audio.sfx('earth'); audio.sfx('explosion');
    effects.explosion(pl.root.position.x, pl.root.position.y - 0.4, pl.root.position.z, c.hex, spell.big ? 70 : 45, spell.radius);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), d = rand(1, spell.radius);
      effects.particles.burst(pl.root.position.x + Math.cos(a) * d, pl.root.position.y, pl.root.position.z + Math.sin(a) * d, 3,
        { r: 0.5, g: 0.35, b: 0.2, spread: 1.5, up: 3, life: 0.8, size: 0.5, grav: 5 });
    }
    this._areaDamage(pl.root.position.x, pl.root.position.z, spell.radius, this.spellDamage(spell), G.element, spell, 6, false, true);
  }

  _castStorm(spell, origin, camDir, color) {
    const target = this._aimPoint(origin, camDir, 24).point;
    const c = ELEMENT_COLORS[G.element];
    const strikes = spell.strikes + Math.floor(G.attributes.poder / 8);
    for (let i = 0; i < strikes; i++) {
      setTimeout(() => {
        try {
          const x = target.x + rand(-spell.radius, spell.radius);
          const z = target.z + rand(-spell.radius, spell.radius);
          const y = terrainHeight(x, z);
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, y + 14, z), new THREE.Vector3(x, y, z),
          ]);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe633, transparent: true, opacity: 1 }));
          G.scene.add(line);
          this.areas.push({ t: 0, duration: 0.14, mesh: line });
          effects.hit(x, y, z, 0xffe633, 12, 0.5);
          audio.sfx('thunder');
          this._areaDamage(x, z, 2.2, this.spellDamage(spell) * 0.5, G.element, spell, 1);
        } catch (e) { /* ignore */ }
      }, i * 220);
    }
    audio.sfx('thunder');
    G.camCtl.shakeIt(0.5);
  }

  _castPrison(spell, origin, camDir, color) {
    const enemies = G.enemies ? G.enemies.active : [];
    const target = this._aimPoint(origin, camDir, 16);
    const c = ELEMENT_COLORS[G.element];
    const list = [];
    if (target.enemy) list.push(target.enemy);
    for (const e of enemies) {
      if (e.dead || list.includes(e)) continue;
      if (e.root.position.distanceTo(new THREE.Vector3(target.point.x, e.root.position.y, target.point.z)) < spell.radius) list.push(e);
      if (list.length >= 4) break;
    }
    if (list.length === 0) { G.hud?.hint('Nenhum inimigo próximo para aprisionar.'); G.mp += spell.mana; this.cooldowns[spell.id] = 1; return; }
    for (const e of list) {
      const px = e.root.position.x, pz = e.root.position.z;
      const py = terrainHeight(px, pz);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, wireframe: !true }));
      mesh.position.set(px, py + 1.2, pz);
      G.scene.add(mesh);
      e.freeze(spell.freeze + 1);
      e.takeDamage(this.spellDamage(spell), { element: G.element, source: 'magic' });
      const area = {
        t: 0, duration: spell.freeze + 1, mesh,
        update: (dt) => {
          mesh.rotation.y += dt * 2;
          mesh.material.opacity = 0.35 * (1 - area.t / (spell.freeze + 1));
          if (Math.random() < dt * 12) {
            effects.particles.emit({ x: px + rand(-1, 1), y: py + rand(0, 2.4), z: pz + rand(-1, 1), vy: 0.5, life: 0.5, size: 0.25, r: c.r, g: c.g, b: c.b, drag: 0.95 });
          }
          e.stunned = Math.max(e.stunned, 0.2);
        },
      };
      this.areas.push(area);
      audio.sfx('ice');
    }
  }

  _castTornado(spell, origin, camDir, color) {
    const dir = _dir.clone().set(0, 0, -1).applyQuaternion(G.camera.quaternion); dir.y = 0; dir.normalize();
    const c = ELEMENT_COLORS[G.element];
    const pl = G.player;
    const tornado = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.35, 0.16, 6, 14),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.5 + i * 0.7;
      tornado.add(ring);
    }
    let tx = pl.root.position.x + dir.x * 4, tz = pl.root.position.z + dir.z * 4;
    tornado.position.set(tx, terrainHeight(tx, tz), tz);
    G.scene.add(tornado);
    const area = {
      t: 0, duration: 6, mesh: tornado,
      update: (dt) => {
        tx += dir.x * 4.5 * dt; tz += dir.z * 4.5 * dt;
        tornado.position.set(tx, terrainHeight(tx, tz), tz);
        tornado.rotation.y += dt * 6;
        tornado.children.forEach((r, i) => { r.position.y = 0.5 + i * 0.7 + Math.sin(area.t * 4 + i) * 0.2; });
        if (Math.random() < dt * 25) {
          effects.particles.burst(tx + rand(-1.5, 1.5), tornado.position.y + rand(0, 3), tz + rand(-1.5, 1.5), 2, { r: c.r, g: c.g, b: c.b, spread: 1.5, up: 2.5, life: 0.6, size: 0.35, drag: 0.95 });
        }
        if (Math.random() < dt * 10) {
          this._areaDamage(tx, tz, spell.radius * 0.7, this.spellDamage(spell) * 0.3, G.element, spell, 5);
        }
        audio._windT = (audio._windT || 0) + dt;
        if (audio._windT > 0.5) { audio._windT = 0; audio.sfx('wind'); }
      },
    };
    this.areas.push(area);
  }

  _burn(x, z, radius, seconds) {
    // queimadura: dano contínuo
    const area = {
      t: 0, duration: seconds,
      update: (dt) => {
        if (Math.random() < dt * 4) this._areaDamage(x, z, radius, 3, 'fogo', null, 0, true);
      },
    };
    this.areas.push(area);
  }

  // dano em área (inimigos)
  _areaDamage(x, z, radius, dmg, element, spell, kb = 0, tick = false, stagger = false) {
    const enemies = G.enemies ? G.enemies.active : [];
    let hitAny = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.root.position.x - x, e.root.position.z - z);
      if (d > radius + e.radius) continue;
      if (tick && e.lastTick === G.playtime) continue;
      hitAny = true;
      const dx = (e.root.position.x - x) / (d || 1), dz = (e.root.position.z - z) / (d || 1);
      e.takeDamage(dmg, { x: dx, z: dz, kb, element, source: 'magic', crit: Math.random() < 0.12 });
      if (spell?.freeze) e.freeze(spell.freeze);
      if (stagger) e.stunned = Math.max(e.stunned, 1.2);
      if (tick) e.lastTick = G.playtime;
    }
    return hitAny;
  }

  _lineDamage(x1, z1, x2, z2, width, dmg, element) {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this._areaDamage(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, width, dmg * 0.7, element, null, 3);
    }
  }
}

function camDir() {
  return _dir.set(0, 0, -1).applyQuaternion(G.camera.quaternion).clone();
}

export { MagicSystem };
