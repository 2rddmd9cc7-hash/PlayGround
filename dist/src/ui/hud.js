// HUD — barras, hotbar, minimapa, avisos, dano flutuante, barra de boss
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { ELEMENTS, getSpellDef } from '../magic/elements.js';
import { fmtTime, clamp } from '../core/utils.js';
import { REGIONS } from '../world/world.js';
import { RARITIES } from '../items/items.js';

const $ = (id) => document.getElementById(id);

class Hud {
  constructor() {
    this.hotbarSlots = [];
    this.floaters = [];
    this.hintTimer = null;
  }

  init() {
    this.buildHotbar();
    $('gold-display').style.pointerEvents = 'none';
  }

  buildHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    this.hotbarSlots = [];
    for (let i = 1; i <= 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<span class="key">${i}</span><span class="icon">·</span><span class="mana"></span><div class="cd" style="display:none"></div>`;
      bar.appendChild(slot);
      this.hotbarSlots.push(slot);
    }
  }

  flashSlot(i) {
    const slot = this.hotbarSlots[i - 1];
    if (!slot) return;
    slot.style.boxShadow = '0 0 18px #ffe633';
    setTimeout(() => { slot.style.boxShadow = ''; }, 250);
  }

  updateHotbar() {
    for (let i = 1; i <= 6; i++) {
      const slot = this.hotbarSlots[i - 1];
      if (!slot) continue;
      const iconEl = slot.querySelector('.icon');
      const manaEl = slot.querySelector('.mana');
      const cdEl = slot.querySelector('.cd');
      if (i <= 4) {
        const spell = G.element ? getSpellDef(G.element, i) : null;
        const known = spell && G.spells[spell.id];
        if (spell && known) {
          iconEl.textContent = spell.icon;
          manaEl.textContent = spell.mana;
          slot.classList.remove('empty', 'locked');
          const cd = G.magic ? G.magic.cooldowns[spell.id] || 0 : 0;
          if (cd > 0) {
            cdEl.style.display = 'flex';
            cdEl.textContent = cd > 1 ? Math.ceil(cd) : cd.toFixed(1);
          } else cdEl.style.display = 'none';
        } else if (spell) {
          iconEl.textContent = '🔒';
          manaEl.textContent = '';
          cdEl.style.display = 'none';
          slot.classList.add('locked');
        } else {
          iconEl.textContent = '·'; manaEl.textContent = '';
          cdEl.style.display = 'none';
          slot.classList.add('empty');
        }
      } else {
        const itemId = i === 5 ? 'pocao_vida' : 'pocao_mana';
        const cnt = G.inventory ? G.inventory.count(itemId) : 0;
        const def = { pocao_vida: '🧪', pocao_mana: '💧' }[itemId];
        iconEl.textContent = def;
        manaEl.textContent = cnt > 0 ? `×${cnt}` : '';
        slot.classList.toggle('empty', cnt === 0);
        cdEl.style.display = 'none';
      }
    }
  }

  updateAll() {
    // barras
    $('bar-hp-fill').style.width = `${clamp(G.hp / G.maxHp * 100, 0, 100)}%`;
    $('bar-hp-text').textContent = `${Math.ceil(G.hp)}/${Math.round(G.maxHp)}`;
    $('bar-mp-fill').style.width = `${clamp(G.mp / G.maxMp * 100, 0, 100)}%`;
    $('bar-mp-text').textContent = `${Math.ceil(G.mp)}/${Math.round(G.maxMp)}`;
    $('bar-sp-fill').style.width = `${clamp(G.stamina / G.maxStamina * 100, 0, 100)}%`;
    const xpNeed = xpForLevel(G.level);
    $('bar-xp-fill').style.width = `${clamp(G.xp / xpNeed * 100, 0, 100)}%`;
    $('lvl-text').textContent = `Nv ${G.level}`;
    // ouro
    $('gold-amount').textContent = G.gold;
    // elemento
    if (G.element) {
      const el = ELEMENTS[G.element];
      $('element-icon').textContent = el.icon;
      $('element-name').textContent = el.name;
      $('element-badge').style.borderColor = el.colorCss;
    }
    // relógio
    const sky = G.sky;
    const isNight = sky && sky.isNight;
    $('clock-time').textContent = sky ? sky.clock : '08:00';
    $('clock-display').firstChild.textContent = isNight ? '🌙 ' : '☀️ ';
    // quest
    const q = G.quests ? G.quests.tracked() : null;
    if (q) {
      $('quest-title').textContent = q.title;
      const prog = G.quests.trackedProgress(q.id);
      const o = q.objectives.find(x => (prog[x.id] || 0) < x.count) || q.objectives[q.objectives.length - 1];
      let text = o.text;
      if (o.count) text = text.replace(/\(0\/\d+\)/, '').trim() + ` (${prog[o.id] || 0}/${o.count})`;
      $('quest-objective').textContent = text;
      const pos = G.quests.objectivePos(q.id);
      if (pos && G.player) {
        const d = Math.hypot(G.player.root.position.x - pos.x, G.player.root.position.z - pos.z);
        $('quest-dist').textContent = `📍 ${Math.round(d)} m`;
      } else $('quest-dist').textContent = '';
    } else {
      $('quest-title').textContent = 'Sem missão ativa';
      $('quest-objective').textContent = '';
      $('quest-dist').textContent = '';
    }
    this.updateHotbar();
  }

  updateRegion() {
    const r = G.world?.regionAt(G.player.root.position.x, G.player.root.position.z);
    if (r) {
      $('region-name').textContent = r.name;
      if (!G.discovered.includes(r.id)) {
        G.discovered.push(r.id);
        this.toast(`🗺️ Região descoberta: ${r.name}`, true);
        audio('quest');
        G.quests?.onDiscover?.(r.id);
      }
    } else {
      $('region-name').textContent = 'Terras Selvagens';
    }
  }

  toast(text, gold = false) {
    let wrap = $('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (gold ? ' gold' : '');
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3400);
    while (wrap.children.length > 5) wrap.firstChild.remove();
  }

  hint(text, ms = 3500) {
    const el = $('hint-text');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }

  showInteract(text) {
    const el = $('interact-prompt');
    if (text) { el.textContent = text; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  }

  floatText(text, worldPos, color = '#fff', big = false) {
    if (!G.showDamage) return;
    const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(G.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = 'float-dmg';
    el.textContent = text;
    el.style.cssText = `left:${x - 30}px; top:${y - 20}px; color:${color}; font-size:${big ? 26 : 16}px;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translateY(-${big ? 60 : 40}px)`;
      el.style.opacity = 0;
    });
    setTimeout(() => el.remove(), 900);
  }

  damageEnemy(amount, worldPos, crit, element) {
    const colors = { fogo: '#ff7744', agua: '#5aa8ff', raio: '#ffe633', terra: '#c98a4a', vento: '#aaffcc', gelo: '#9ad8ff' };
    this.floatText(`${crit ? '✧' : ''}${Math.round(amount)}`, worldPos, crit ? '#ffd23a' : (element ? colors[element] : '#ffd9c0'), crit);
  }

  damagePlayer(amount) {
    this.floatText(`-${Math.round(amount)}`, G.player.root.position, '#ff6a5a');
    G.camCtl?.shakeIt(0.4);
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:850;pointer-events:none;background:radial-gradient(ellipse at center, transparent 40%, rgba(200,20,20,.4) 100%);opacity:1;transition:opacity .5s;';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = 0; }, 60);
    setTimeout(() => flash.remove(), 600);
  }

  showBoss(name, hpFrac) {
    const bar = $('boss-bar');
    if (name === null) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    $('boss-name').textContent = name;
    $('bar-boss-fill').style.width = `${clamp(hpFrac * 100, 0, 100)}%`;
  }

  setCrosshair(on) { $('crosshair').classList.toggle('hidden', !on); }

  // ---------- minimapa ----------
  drawMinimap() {
    const canvas = $('minimap');
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    const p = G.player.root.position;
    const range = 120; // metros visíveis
    const toX = (x) => (x - p.x) / range * (S / 2) + S / 2;
    const toY = (z) => (z - p.z) / range * (S / 2) + S / 2;

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20301c';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();

    // água
    ctx.fillStyle = '#2a5a8a';
    const lx = toX(-200), lz = toY(-60);
    ctx.beginPath(); ctx.arc(lx, lz, 78 / range * (S / 2), 0, Math.PI * 2); ctx.fill();

    // estradas (linha para a cidade)
    ctx.strokeStyle = '#8a7150'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(0), toY(-260));
    ctx.stroke();

    // regiões descobertas
    ctx.font = '8px serif';
    for (const r of REGIONS) {
      if (!G.discovered.includes(r.id)) continue;
      const x = toX(r.x), y = toY(r.z);
      if (Math.hypot(x - S / 2, y - S / 2) > S / 2 - 4) continue;
      ctx.fillStyle = '#e8c26a';
      ctx.fillText('◆', x - 3, y + 3);
    }

    // inimigos
    ctx.fillStyle = '#e74c3c';
    for (const e of G.enemies.active) {
      if (e.dead) continue;
      const x = toX(e.root.position.x), y = toY(e.root.position.z);
      if (Math.hypot(x - S / 2, y - S / 2) > S / 2 - 3) continue;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // NPCs
    ctx.fillStyle = '#7dd87a';
    for (const n of G.npcs.npcs) {
      const x = toX(n.root.position.x), y = toY(n.root.position.z);
      if (Math.hypot(x - S / 2, y - S / 2) > S / 2 - 3) continue;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // alvo da quest
    const q = G.quests?.tracked();
    if (q) {
      const pos = G.quests.objectivePos(q.id);
      if (pos) {
        const x = toX(pos.x), y = toY(pos.z);
        ctx.strokeStyle = '#ffd23a';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(clamp(x, 6, S - 6), clamp(y, 6, S - 6), 4, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // player (triângulo)
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-G.player.yaw + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function xpForLevel(level) { return 100 + (level - 1) * 80; }

function audio(name) { import('../audio/audio.js').then(m => m.audio.sfx(name)); }

export { Hud, xpForLevel };
