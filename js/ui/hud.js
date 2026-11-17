/* =========================================================
 * Aetheria — HUD, menus, painéis, minimapa, mapa-múndia
 * ========================================================= */
import { clamp, dist, lerp } from '../core/utils.js';
import { ELEMENTS, ELEMENT_LIST, RANKS } from '../magic/elements.js';
import { ITEMS, RARITY, SHOPS } from '../inventory/inventory.js';
import { QUESTS } from '../quests/quests.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.dirtyQuests = true;
    this.announceT = 0;
    this.dmgPool = [];
    this.bubbles = [];
    this.fpsAcc = 0; this.fpsFrames = 0; this.fpsVal = 60;
    this.minimapT = 0;
    this.bossName = '';
    this.bindButtons();
    this.buildHotbar();
  }

  /* =============== BOTÕES E MENUS =============== */
  bindButtons() {
    const g = () => this.game;
    $('mm-new').onclick = () => { g().audio.ensure(); g().startGame(false); };
    $('mm-continue').onclick = () => { g().audio.ensure(); g().startGame(true); };
    $('mm-settings').onclick = () => this.openPanel('settings');
    $('mm-controls').onclick = () => this.openPanel('controls');
    $('mm-credits').onclick = () => this.openPanel('credits');
    $('pm-resume').onclick = () => this.togglePause(false);
    $('pm-save').onclick = () => { g().save.saveGame(); this.toast('Jogo salvo. 💾'); this.togglePause(false); };
    $('pm-settings').onclick = () => this.openPanel('settings');
    $('pm-controls').onclick = () => this.openPanel('controls');
    $('pm-quit').onclick = () => { g().save.saveGame(); location.reload(); };
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closeAllPanels());
    this.bindSettings();
  }

  showMainMenu() {
    $('mainmenu').classList.remove('hidden');
    $('hud').classList.add('hidden');
    if (this.game.save.hasSave()) {
      const btn = $('mm-continue');
      btn.disabled = false;
      btn.textContent = 'CONTINUAR (jogo salvo)';
    }
  }
  hideMainMenu() {
    $('mainmenu').classList.add('hidden');
    $('hud').classList.remove('hidden');
  }

  togglePause(on) {
    const g = this.game;
    g.paused = on ?? !$('pause-menu').classList.contains('open');
    $('pause-menu').classList.toggle('open', g.paused);
    g.input.enabled = !g.paused;
    g.audio.play('ui', 0.5);
  }

  openPanel(name) {
    this.closeAllPanels();
    const map = { settings: 'panel-settings', controls: 'panel-controls', credits: 'panel-credits', grimoire: 'panel-grimoire', inventory: 'panel-inventory', map: 'panel-map', quests: 'panel-quests', shop: 'panel-shop' };
    const el = $(map[name]);
    if (el) {
      el.classList.add('open');
      if (name === 'inventory') this.renderInventory();
      if (name === 'map') this.renderMap();
      if (name === 'quests') this.renderQuests();
      if (name === 'grimoire') this.renderGrimoire();
    }
    this.game.paused = false;
  }
  togglePanel(name, force) {
    const map = { grimoire: 'panel-grimoire', inventory: 'panel-inventory', map: 'panel-map', quests: 'panel-quests' };
    const el = $(map[name]);
    if (!el) return;
    const willOpen = force !== undefined ? force : !el.classList.contains('open');
    if (willOpen) this.openPanel(name);
    else { el.classList.remove('open'); this.game.audio.play('page', 0.5); }
  }
  closeAllPanels() {
    document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
  }
  isPanelOpen() { return !!document.querySelector('.panel.open'); }

  bindSettings() {
    const g = this.game;
    const S = g.settings;
    const bind = (id, valId, key, fmt, apply) => {
      const el = $(id);
      el.value = S[key];
      const upd = () => {
        S[key] = parseFloat(el.value);
        if (valId) $(valId).textContent = fmt ? fmt(S[key]) : el.value;
        apply && apply(S[key]);
      };
      el.oninput = upd; upd();
    };
    bind('set-music', 'val-music', 'music', v => v, v => g.audio.setVolumes(v / 100, g.settings.sfx / 100));
    bind('set-sfx', 'val-sfx', 'sfx', v => v, v => g.audio.setVolumes(g.settings.music / 100, v / 100));
    bind('set-sens', 'val-sens', 'sens', v => (v / 100).toFixed(1), v => g.camera.sensitivity = v / 100);
    bind('set-camdist', 'val-camdist', 'camdist', v => (v / 10).toFixed(1), v => g.camera.targetDist = v / 10);
    bind('set-cammax', 'val-cammax', 'cammax', v => (v / 10).toFixed(1), v => g.camera.maxDist = v / 10);
    const inv = $('set-invert');
    inv.checked = S.invert;
    inv.onchange = () => { S.invert = inv.checked; g.camera.invertY = inv.checked; };
    const sh = $('set-shadows');
    sh.value = S.shadows;
    sh.onchange = () => { S.shadows = parseInt(sh.value); g.daynight.setShadowQuality(S.shadows); g.renderer.shadowMap.enabled = S.shadows > 0; };
    const pa = $('set-particles');
    pa.value = S.particles;
    pa.onchange = () => { S.particles = parseInt(pa.value); g.fx.quality = S.particles; };
    const fp = $('set-fps');
    fp.checked = S.fps;
    fp.onchange = () => { S.fps = fp.checked; $('fps-counter').style.display = fp.checked ? '' : 'none'; };
  }

  /* =============== HOTBAR =============== */
  buildHotbar() {
    const hb = $('hotbar');
    hb.innerHTML = '';
    this.hslots = [];
    const labels = ['1', '2', '3', '4', '5', '6'];
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'hslot';
      slot.innerHTML = `<span class="key">${labels[i]}</span><span class="ico"></span><span class="cost"></span><span class="qty"></span><div class="cd" style="transform:scaleY(0)"></div><span class="nm"></span>`;
      hb.appendChild(slot);
      this.hslots.push(slot);
    }
    this.refreshHotbar();
  }

  refreshHotbar() {
    const g = this.game;
    if (!g.player) return;
    const el = g.player.element ? ELEMENTS[g.player.element] : null;
    const unlocked = g.grimoire ? g.grimoire.unlockedSpells() : [];
    for (let i = 0; i < 6; i++) {
      const slot = this.hslots[i];
      if (i < 4) {
        const sp = unlocked[i];
        const elSp = el ? el.spells[i] : null;
        if (elSp && sp) {
          slot.classList.remove('locked', 'empty');
          slot.querySelector('.ico').textContent = el.icon;
          slot.querySelector('.nm').textContent = sp.name;
          slot.querySelector('.cost').textContent = sp.mana;
        } else if (elSp) {
          slot.classList.remove('empty');
          slot.classList.add('locked');
          slot.querySelector('.ico').textContent = '🔒';
          slot.querySelector('.nm').textContent = `Nível ${[1, 3, 5, 7][i]}`;
          slot.querySelector('.cost').textContent = elSp.mana;
        } else {
          slot.classList.add('empty');
          slot.querySelector('.ico').textContent = '✨';
          slot.querySelector('.nm').textContent = '';
        }
      } else {
        const id = i === 4 ? 'potion_hp' : 'potion_mp';
        const def = ITEMS[id];
        const qty = g.inventory ? g.inventory.count(id) : 0;
        slot.classList.remove('locked');
        slot.classList.toggle('empty', qty <= 0);
        slot.querySelector('.ico').textContent = def.icon;
        slot.querySelector('.nm').textContent = def.name.split(' ')[0];
        slot.querySelector('.cost').textContent = '';
        slot.querySelector('.qty').textContent = qty > 0 ? 'x' + qty : '';
      }
    }
  }

  /* =============== VITAIS =============== */
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    $('hp-fill').style.transform = `scaleX(${clamp(p.hp / p.maxHp, 0, 1)})`;
    $('hp-txt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('mp-fill').style.transform = `scaleX(${clamp(p.mana / p.maxMana, 0, 1)})`;
    $('mp-txt').textContent = `${Math.floor(p.mana)} / ${p.maxMana}`;
    $('sp-fill').style.transform = `scaleX(${clamp(p.stamina / p.maxStam, 0, 1)})`;
    $('xp-fill').style.transform = `scaleX(${clamp(p.xp / p.xpNext, 0, 1)})`;
    $('lvl-orb').textContent = p.level;

    // cooldowns hotbar
    const unlocked = g.grimoire ? g.grimoire.unlockedSpells() : [];
    for (let i = 0; i < 4; i++) {
      const sp = unlocked[i];
      const cdEl = this.hslots[i].querySelector('.cd');
      if (sp) {
        const cd = p.cooldowns[sp.id] || 0;
        cdEl.style.transform = `scaleY(${clamp(cd / sp.cd, 0, 1)})`;
      }
    }

    // relógio
    const dn = g.daynight;
    $('clock').textContent = `${dn.isNight ? '🌙' : '☀'} ${dn.clockString()}`;

    // elemento
    const el = p.element ? ELEMENTS[p.element] : null;
    $('elem-ico').textContent = el ? el.icon : '✨';
    $('elem-name').textContent = el ? el.name : 'Sem elemento';
    $('elem-name').style.color = el ? el.css : '#a89060';

    // tracker de quest
    if (this.dirtyQuests) {
      this.dirtyQuests = false;
      this.updateTracker();
      if ($('panel-quests').classList.contains('open')) this.renderQuests();
    } else {
      this.updateTrackerDistance();
    }

    // alvo travado
    if (p.lockTarget && !p.lockTarget.dead) {
      $('target-frame').classList.remove('hidden');
      $('tf-name').textContent = p.lockTarget.displayName;
      $('tf-fill').style.transform = `scaleX(${clamp(p.lockTarget.hp / p.lockTarget.maxHp, 0, 1)})`;
      $('tf-rank').textContent = `Rank ${p.lockTarget.rank}`;
    } else {
      $('target-frame').classList.add('hidden');
    }

    // números de dano / bolhas
    this.updateFloating(dt);

    // fps
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      this.fpsVal = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0; this.fpsFrames = 0;
      $('fps-counter').textContent = `${this.fpsVal} FPS • ${g.enemies.countAlive()} inimigos`;
    }

    // minimapa (10x/s)
    this.minimapT -= dt;
    if (this.minimapT <= 0) { this.minimapT = 0.1; this.drawMinimap(); }
  }

  updateTracker() {
    const g = this.game;
    const a = g.quests.trackerQuest();
    if (!a) { $('qt-title').textContent = ''; $('qt-obj').textContent = 'Explore o mundo livremente.'; $('qt-dist').textContent = ''; return; }
    const def = QUESTS[a.id];
    $('qt-title').textContent = `📜 ${def.title}`;
    const objTexts = def.objectives.map(o => {
      const prog = a.progress[o.target ?? '_'] || 0;
      const need = o.count || 1;
      const names = { talk: 'Fale', kill: 'Derrote', collect: 'Colete', discover: 'Descubra', flag: '' };
      let label = o.target;
      if (o.type === 'kill' && o.target === 'goblin') label = 'goblins';
      if (o.type === 'discover' && !o.target) label = 'regiões';
      if (o.type === 'discover' && o.target) {
        const r = g.world.regions.find(r => r.id === o.target);
        label = r ? r.name : o.target;
      }
      if (o.type === 'flag') return def.desc;
      return `${names[o.type]} ${label} (${prog}/${need})`;
    });
    $('qt-obj').textContent = objTexts.join(' • ');
    $('qt-obj').dataset.marker = def.marker && def.marker() ? '1' : '0';
  }
  updateTrackerDistance() {
    const g = this.game;
    const a = g.quests.trackerQuest();
    if (!a) return;
    const def = QUESTS[a.id];
    if (typeof def.marker === 'function') {
      try {
        const m = def.marker();
        if (m && typeof m.x === 'number') {
          const d = dist(g.player.root.position.x, g.player.root.position.z, m.x, m.z);
          $('qt-dist').textContent = `📍 ${Math.round(d)} m`;
          return;
        }
      } catch (e) {}
    }
    $('qt-dist').textContent = '';
  }

  /* =============== MINIMAPA / MAPA =============== */
  drawMinimap() {
    const g = this.game;
    const cv = $('minimap'), ctx = cv.getContext('2d');
    const S = cv.width;
    ctx.clearRect(0, 0, S, S);
    // fundo
    ctx.fillStyle = '#141008';
    ctx.fillRect(0, 0, S, S);
    const scale = S / (g.world.half * 2);
    const tx = (x, z) => [ (x + g.world.half) * scale, (z + g.world.half) * scale ];
    // regiões descobertas
    for (const r of g.world.regions) {
      if (!r.discovered) continue;
      const [x, y] = tx(r.cx, r.cz);
      ctx.fillStyle = r.color + '55';
      ctx.beginPath();
      ctx.arc(x, y, r.r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // marcador de quest
    const a = g.quests.trackerQuest();
    if (a) {
      const def = QUESTS[a.id];
      if (typeof def.marker === 'function') {
        try {
          const m = def.marker();
          if (m) {
            const [x, y] = tx(m.x, m.z);
            ctx.fillStyle = '#f5d97a';
            ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.fill();
          }
        } catch (e) {}
      }
    }
    // inimigos próximos
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const d = e.root.position.distanceTo(g.player.root.position);
      if (d > 60) continue;
      const [x, y] = tx(e.root.position.x, e.root.position.z);
      ctx.fillStyle = e.isBoss ? '#ff4040' : '#d05540';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // jogador
    const [px, py] = tx(g.player.root.position.x, g.player.root.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-g.player.facing + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.fill();
    ctx.restore();
    // borda norte
    ctx.fillStyle = '#8a7850';
    ctx.font = '10px Georgia';
    ctx.fillText('N', S / 2 - 3, 12);
  }

  renderMap() {
    const g = this.game;
    const cv = $('map-canvas'), ctx = cv.getContext('2d');
    const S = cv.width;
    ctx.clearRect(0, 0, cv.width, cv.height);
    // pergaminho
    ctx.fillStyle = '#1a150c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const scale = Math.min(cv.width, cv.height * 1.4) / (g.world.half * 2);
    const ox = (cv.width - g.world.half * 2 * scale) / 2, oy = (cv.height - g.world.half * 2 * scale) / 2;
    const tx = (x, z) => [ox + (x + g.world.half) * scale, oy + (z + g.world.half) * scale];
    for (const r of g.world.regions) {
      if (!r.discovered) continue;
      const [x, y] = tx(r.cx, r.cz);
      ctx.fillStyle = r.color + '66';
      ctx.beginPath(); ctx.arc(x, y, r.r * scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = r.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      ctx.font = '12px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, x, y - r.r * scale - 6);
    }
    // jogador + quest
    const [px, py] = tx(g.player.root.position.x, g.player.root.position.z);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.stroke();
    // viagem rápida para regiões descobertas seguras
    const side = $('map-travel');
    side.innerHTML = '';
    for (const r of g.world.regions) {
      if (!r.discovered || !r.safe) continue;
      const btn = document.createElement('button');
      btn.className = 'travel-btn';
      btn.textContent = `🧭 ${r.name}`;
      btn.onclick = () => {
        g.player.root.position.set(r.cx, g.world.terrainHeight(r.cx, r.cz) + 0.5, r.cz + 10);
        this.toast(`Viajou para ${r.name}. 🧭`);
        g.fx.ring(g.player.root.position, { radius: 2.4, color: 0x8a5aff, life: 0.7 });
        this.closeAllPanels();
      };
      side.appendChild(btn);
    }
  }

  /* =============== FEEDBACK VISUAL =============== */
  announce(big, small, dur = 2.5) {
    $('ann-big').textContent = big;
    $('ann-small').textContent = small || '';
    $('announce').style.opacity = 1;
    clearTimeout(this._annTO);
    this._annTO = setTimeout(() => { $('announce').style.opacity = 0; }, dur * 1000);
  }

  toast(html) {
    const box = $('toasts');
    if (box.children.length > 5) box.removeChild(box.firstChild);
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transition = 'opacity .5s'; setTimeout(() => t.remove(), 500); }, 3400);
  }

  tutorial(html, dur = 6) {
    const el = $('tut-hint');
    el.innerHTML = html;
    el.classList.remove('hidden');
    el.style.opacity = 1;
    clearTimeout(this._tutTO);
    this._tutTO = setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.classList.add('hidden'), 400); }, dur * 1000);
  }

  hurtFlash() {
    const el = $('hurt-vignette');
    el.style.boxShadow = 'inset 0 0 140px rgba(160,20,10,.55)';
    clearTimeout(this._hurtTO);
    this._hurtTO = setTimeout(() => el.style.boxShadow = 'inset 0 0 140px rgba(160,20,10,0)', 250);
  }

  damageNumber(worldPos, text, kind = 'enemy', crit = false) {
    const el = document.createElement('div');
    el.className = `dmgnum ${kind}${crit ? ' crit' : ''}`;
    el.textContent = text;
    el.style.color = kind === 'player' ? '#ff6a5a' : kind === 'heal' ? '#6ae08a' : crit ? '#ffb020' : '#ffd97a';
    $('damage-layer').appendChild(el);
    this.dmgPool.push({ el, pos: worldPos.clone(), t: 0, vy: 60 });
  }

  bubble(worldPos, text) {
    const el = document.createElement('div');
    el.className = 'dmgnum';
    el.style.color = '#e8dcc0';
    el.style.fontSize = '12px';
    el.style.fontStyle = 'italic';
    el.style.background = 'rgba(10,8,5,.7)';
    el.style.padding = '3px 8px';
    el.style.borderRadius = '10px';
    el.textContent = text;
    $('damage-layer').appendChild(el);
    this.bubbles.push({ el, pos: worldPos.clone().add({ x: 0, y: 2.1, z: 0 }), t: 0 });
  }

  updateFloating(dt) {
    const cam = this.game.camera.cam;
    const proj = (p) => {
      const v = p.clone ? p.clone() : { x: p.x, y: p.y, z: p.z };
      // projeta manualmente
      const vec = new (cam.position.constructor)(v.x, v.y, v.z);
      vec.project(cam);
      return [ (vec.x * 0.5 + 0.5) * innerWidth, (-vec.y * 0.5 + 0.5) * innerHeight, vec.z < 1 ];
    };
    for (let i = this.dmgPool.length - 1; i >= 0; i--) {
      const d = this.dmgPool[i];
      d.t += dt;
      d.pos.y += dt * 1.2;
      const [x, y, vis] = proj(d.pos);
      if (!vis || d.t > 1.1) { d.el.remove(); this.dmgPool.splice(i, 1); continue; }
      d.el.style.left = x + 'px';
      d.el.style.top = y + 'px';
      d.el.style.opacity = 1 - d.t / 1.1;
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      const [x, y, vis] = proj(b.pos);
      if (!vis || b.t > 3) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      b.el.style.left = x + 'px';
      b.el.style.top = y + 'px';
      b.el.style.opacity = b.t < 0.2 ? b.t / 0.2 : b.t > 2.4 ? (3 - b.t) / 0.6 : 1;
    }
  }

  /* =============== DIÁLOGO =============== */
  dialogBox(name, text, options = []) {
    $('dialog').classList.remove('hidden');
    $('d-name').textContent = name;
    $('d-text').textContent = text;
    const opts = $('d-opts');
    opts.innerHTML = '';
    for (const [label, fn] of options) {
      const b = document.createElement('button');
      b.className = 'd-opt';
      b.textContent = label;
      b.onclick = () => { this.game.audio.play('ui'); fn && fn(); };
      opts.appendChild(b);
    }
    if (options.length === 0) {
      const b = document.createElement('button');
      b.className = 'd-opt';
      b.textContent = 'Fechar';
      b.onclick = () => this.closeDialog();
      opts.appendChild(b);
    }
  }
  closeDialog() { $('dialog').classList.add('hidden'); }
  isDialogOpen() { return !$('dialog').classList.contains('hidden'); }

  /* =============== INTERAÇÃO / ALVO / BOSS =============== */
  showInteract(label) {
    const el = $('interact-prompt');
    el.innerHTML = `<b>E</b> — ${label}`;
    el.classList.remove('hidden');
  }
  hideInteract() { $('interact-prompt').classList.add('hidden'); }

  showBossBar(name) {
    $('bossbar').classList.remove('hidden');
    $('boss-name').textContent = name;
    this.bossName = name;
  }
  setBossBar(f) { $('boss-fill').style.transform = `scaleX(${clamp(f, 0, 1)})`; }
  hideBossBar() { $('bossbar').classList.add('hidden'); }

  /* =============== GRIMÓRIO (UI) =============== */
  renderGrimoire() {
    const g = this.game, p = g.player;
    const el = ELEMENTS[p.element];
    const book = $('grimoire-book');
    if (!el) {
      book.innerHTML = `<div class="gpage gleft"><h4>Grimório Selado</h4><p style="color:#4a3a26">O grimório aguarda seu primeiro elemento…<br><i>Complete o Teste do Poder.</i></p></div>`;
      return;
    }
    const left = document.createElement('div');
    left.className = 'gpage gleft';
    const right = document.createElement('div');
    right.className = 'gpage gright';
    const spine = document.createElement('div');
    spine.className = 'gspine';
    left.innerHTML = `<h4>${el.icon} ${el.name} — Página I</h4>`;
    right.innerHTML = `<h4>Grimório de ${p.name || 'Herói'} — Nv ${p.level}</h4>`;
    const unlocked = g.grimoire.unlockedSpells();
    el.spells.forEach((sp, i) => {
      const isUnlocked = unlocked.includes(sp);
      const lvl = p.spellLevels[sp.id] || 1;
      const div = document.createElement('div');
      div.className = 'gspell' + (isUnlocked ? '' : ' locked');
      div.innerHTML = `
        <div class="gs-n">${sp.name}<span class="gs-lv">Nv ${isUnlocked ? lvl : '—'}</span></div>
        <div class="gs-d">${sp.desc}</div>
        <div class="gs-stats">
          <span>Mana ${sp.mana}</span><span>Recarga ${sp.cd}s</span><span>Dano ~${Math.round(sp.dmg * p.spellPower)}</span>
          ${isUnlocked ? '' : '<span style="color:#8a5a2a">🔒 desbloqueia no nível ' + g.grimoire.unlockLevel(sp.unlock) + '</span>'}
        </div>`;
      div.onclick = () => {
        if (!isUnlocked) return;
        book.querySelectorAll('.gspell').forEach(x => x.classList.remove('sel'));
        div.classList.add('sel');
        g.audio.play('page', 0.6);
      };
      (i < 2 ? left : right).appendChild(div);
    });
    const art = document.createElement('div');
    art.className = 'gp-art';
    art.textContent = '✦ ' + el.icon + ' ✦';
    right.appendChild(art);
    book.innerHTML = '';
    book.append(left, spine, right);
  }

  /* =============== INVENTÁRIO (UI) =============== */
  renderInventory() {
    const g = this.game, inv = g.inventory;
    // slots de equipamento
    const slots = [
      ['capacete', '🪖'], ['armadura', '🥼'], ['luvas', '🧤'], ['botas', '🥾'], ['capa', '🧣'], ['acessorio', '📿'], ['arma', '⚔️']
    ];
    const eq = $('equip-slots');
    eq.innerHTML = '';
    for (const [slot, icon] of slots) {
      const div = document.createElement('div');
      div.className = 'eq-slot';
      const cur = g.player.equipment[slot];
      div.innerHTML = `<span>${cur ? ITEMS[cur.id].icon : icon}</span><span class="eq-lbl">${slot}</span>`;
      div.title = cur ? `${ITEMS[cur.id].name} (clique para remover)` : `${slot} (vazio)`;
      div.onclick = () => { if (cur) { g.inventory.unequip(slot); g.audio.play('ui'); } };
      eq.appendChild(div);
    }
    // abas
    const tabs = [
      ['all', 'Tudo'], ['weapon', 'Armas'], ['armor', 'Armaduras'], ['accessory', 'Acessórios'],
      ['consumable', 'Consumíveis'], ['material', 'Materiais'], ['quest', 'Missão'], ['book', 'Livros']
    ];
    const tabBox = $('inv-tabs');
    tabBox.innerHTML = '';
    if (!this.invTab) this.invTab = 'all';
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.className = 'inv-tab' + (this.invTab === id ? ' on' : '');
      b.textContent = label;
      b.onclick = () => { this.invTab = id; this.renderInventory(); g.audio.play('ui', 0.4); };
      tabBox.appendChild(b);
    }
    // grade
    const grid = $('inv-grid');
    grid.innerHTML = '';
    const filtered = inv.items.filter(i => {
      const def = ITEMS[i.id];
      if (!def) return false;
      if (this.invTab === 'all') return true;
      if (this.invTab === 'armor') return def.type === 'armor';
      return def.type === this.invTab;
    });
    for (const item of filtered) {
      const def = ITEMS[item.id];
      const cell = document.createElement('div');
      cell.className = `inv-cell r-${def.rarity}`;
      cell.innerHTML = `<span>${def.icon}</span>${item.qty > 1 ? `<span class="q">${item.qty}</span>` : ''}`;
      cell.title = def.name;
      cell.onclick = () => this.showItemDetail(item.id);
      grid.appendChild(cell);
    }
    if (filtered.length === 0) grid.innerHTML = '<div style="color:#8a7850;font-size:13px;padding:20px">Mochila vazia nesta categoria.</div>';
    $('inv-detail').innerHTML = '<div class="id-desc" style="color:#8a7850">Selecione um item…</div>';
  }

  showItemDetail(id) {
    const g = this.game;
    const def = ITEMS[id];
    if (!def) return;
    const det = $('inv-detail');
    let statHtml = '';
    if (def.stats) {
      statHtml = Object.entries(def.stats).map(([k, v]) => {
        const names = { atk: 'Ataque', def: 'Defesa', hp: 'Vida', mana: 'Mana', spd: 'Velocidade', crit: 'Crítico', magic: 'Poder Mágico' };
        return `+${v} ${names[k] || k}`;
      }).join(' • ');
    }
    const usable = def.type === 'consumable';
    const equippable = !!def.slot;
    det.innerHTML = `
      <div class="id-name">${def.icon} ${def.name} <span style="color:#9a9080;font-size:11px">(${RARITY[def.rarity].name})</span></div>
      <div class="id-desc">${def.desc}</div>
      ${statHtml ? `<div class="id-stat">${statHtml}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:8px">
        ${equippable ? '<button class="travel-btn" onclick="window.__game.inventory.equipItem(\'' + id + '\')">Equipar</button>' : ''}
        ${usable ? '<button class="travel-btn" onclick="window.__game.inventory.useItem(\'' + id + '\')">Usar</button>' : ''}
        <button class="travel-btn" onclick="window.__game.inventory.sellItem(\'' + id + '\')">Vender (${Math.max(1, Math.floor((def.price || 5) * 0.4))} 🪙)</button>
      </div>`;
    g.audio.play('ui', 0.4);
  }

  /* =============== QUESTS (UI) =============== */
  renderQuests() {
    const g = this.game, q = g.quests;
    const list = $('quests-list');
    list.innerHTML = '';
    const add = (a, done) => {
      const def = QUESTS[a.id || a];
      if (!def) return;
      const div = document.createElement('div');
      div.className = 'q-item';
      const prog = done ? '' : ` <span style="color:#8fb07a">(${q.totalProgress(a)}/${q.totalNeeded(a)})</span>`;
      div.innerHTML = `<div class="q-t ${done ? 'done' : ''}">${done ? '✔' : '📜'} ${def.title}${prog}</div>
        <div class="q-d">${def.desc}</div>
        <div class="q-r">Recompensas: ${def.rewards?.xp || 0} XP${def.rewards?.gold ? `, ${def.rewards.gold} 🪙` : ''}${def.rewards?.items ? ', itens' : ''}</div>`;
      list.appendChild(div);
    };
    if (q.active.length === 0 && q.completed.length === 0) {
      list.innerHTML = '<div style="color:#8a7850;padding:20px">Nenhuma missão ainda. Fale com os moradores!</div>';
    }
    for (const a of q.active) add(a, false);
    for (const id of q.completed) add({ id }, true);
  }

  /* =============== LOJA (UI) =============== */
  renderShop(shopId, npcName) {
    const g = this.game;
    const shop = SHOPS[shopId];
    if (!shop) return;
    $('shop-title').textContent = shop.title;
    const list = $('shop-list');
    list.innerHTML = '';
    for (const id of shop.items) {
      const def = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `
        <span class="si-ico">${def.icon}</span>
        <span class="si-n">${def.name}<br><span style="font-size:11px;color:#9a9080">${def.desc || ''}</span></span>
        <span class="si-p">${def.price} 🪙</span>
        <button class="buy-btn">Comprar</button>`;
      row.querySelector('button').onclick = () => { g.inventory.buyItem(id); $('shop-gold').textContent = `Ouro: ${g.inventory.gold} 🪙`; };
      list.appendChild(row);
    }
    // vender materiais
    const sellables = g.inventory.items.filter(i => ITEMS[i.id] && ITEMS[i.id].type === 'material');
    for (const s of sellables) {
      const def = ITEMS[s.id];
      const row = document.createElement('div');
      row.className = 'shop-item';
      const price = Math.max(1, Math.floor((def.price || 5) * 0.4));
      row.innerHTML = `<span class="si-ico">${def.icon}</span>
        <span class="si-n">${def.name} x${s.qty}</span>
        <span class="si-p">+${price} 🪙</span>
        <button class="buy-btn">Vender</button>`;
      row.querySelector('button').onclick = () => { g.inventory.sellItem(s.id); this.renderShop(shopId, npcName); };
      list.appendChild(row);
    }
    $('shop-gold').textContent = `Ouro: ${g.inventory.gold} 🪙`;
    this.openPanel('shop');
  }

  refreshGold() {
    const g = this.game;
    $('gold-display').textContent = `🪙 ${g.inventory ? g.inventory.gold : 0}`;
  }

  /* mobile */
  showMobileUI(on) {
    $('mobile-ui').style.display = on ? 'block' : 'none';
  }
}
