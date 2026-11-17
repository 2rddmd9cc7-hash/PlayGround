import { ELEMENTS, SPELLS } from '../core/config.js';

export class GameInterface {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <section id="title-screen" class="screen">
        <div class="title-card"><div class="eyebrow">Uma aventura medieval em 3D</div><h1 class="brand">Crônicas de<br>Aetheria</h1>
          <p class="subtitle">Uma antiga força desperta sob o castelo. Explore a vila, descubra seu elemento e defenda o reino das criaturas da floresta.</p>
          <div class="menu-actions"><button class="menu-btn" data-action="start">Iniciar jornada</button><button class="menu-btn secondary" data-action="continue">Continuar</button></div>
          <p class="menu-note">WASD mover · Shift correr · botão direito girar a câmera</p>
        </div><div class="title-mark"><span>✦</span><small>Reino de Aetheria</small></div>
      </section>
      <section id="pause-screen" class="screen hidden"><div class="pause-card"><div class="eyebrow">A jornada aguarda</div><h2>Jogo pausado</h2><p>Respire, viajante. Aetheria permanecerá aqui.</p><div class="menu-actions"><button class="menu-btn" data-action="resume">Retomar</button><button class="menu-btn secondary" data-action="home">Voltar ao título</button></div></div></section>
      <div id="hud" class="hud hidden">
        <div class="top-left"><div class="status-panel"><div class="level-row"><span class="level-badge">NÍVEL <b id="level">1</b></span><span id="gold">◈ 12</span></div>
          <div class="meter-label"><span>Vitalidade</span><span id="hp-text"></span></div><div class="meter"><i id="hp-bar"></i></div>
          <div class="meter-label"><span>Mana</span><span id="mana-text"></span></div><div class="meter mana"><i id="mana-bar"></i></div>
          <div class="meter-label"><span>Vigor</span><span id="stamina-text"></span></div><div class="meter stamina"><i id="stamina-bar"></i></div>
          <div class="xp-track"><i id="xp-bar"></i></div><div class="xp-label" id="xp-text">Experiência</div>
        </div></div>
        <div class="quest-panel"><div class="eyebrow">Crônica atual</div><div id="objective">Encontre a anciã da vila.</div><div id="quest-progress"></div></div>
        <div class="top-right"><button class="icon-btn" data-action="grimoire" aria-label="Abrir grimório">✧ <span>Grimório [G]</span></button><button class="icon-btn" data-action="pause" aria-label="Pausar">Ⅱ <span>Pausar [Esc]</span></button></div>
        <div id="interaction" class="interaction hidden"><span class="keycap">E</span><span id="interaction-label">Conversar</span></div>
        <div id="toast" class="toast"></div>
        <div class="bottom-hud"><div class="combat-tip"><span id="element-badge">Elemento não desperto</span><small>Botão esquerdo atacar · Espaço esquivar</small></div>
          <div id="hotbar" class="hotbar"></div><div class="clock-label">AETHERIA <span id="time-label">Manhã</span></div>
        </div>
        <div id="grimoire" class="grimoire hidden"><button class="close-btn" data-action="grimoire">×</button><div class="eyebrow">Arquivo das artes esquecidas</div><h2>Grimório Elemental</h2><p id="grimoire-intro">Seu destino mágico ainda não foi revelado.</p><div id="spell-list" class="spell-list"></div></div>
        <div class="crosshair"><i></i><b></b></div>
      </div>`;
    this.title = this.root.querySelector('#title-screen'); this.pause = this.root.querySelector('#pause-screen'); this.hud = this.root.querySelector('#hud');
    this.toastTimer = 0; this.onAction = () => {};
    this.root.addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) this.onAction(action); });
    this.buildHotbar();
  }
  buildHotbar() {
    const bar = this.root.querySelector('#hotbar');
    bar.innerHTML = SPELLS.map((spell, i) => `<button class="spell-slot locked" data-slot="${i}" aria-label="${spell.name}"><span class="slot-key">${i + 1}</span><b>${spell.icon}</b><small>${spell.name}</small><i class="cooldown"></i></button>`).join('');
    bar.addEventListener('click', event => { const slot = event.target.closest('[data-slot]'); if (slot) this.onAction(`spell:${slot.dataset.slot}`); });
    this.root.querySelector('#spell-list').innerHTML = SPELLS.map((spell, i) => `<div class="spell-entry"><b>${spell.icon} ${spell.name}</b><span>Tecla ${i + 1} · ${spell.mana} mana</span><p>${spell.description}</p></div>`).join('');
  }
  setActionHandler(callback) { this.onAction = callback; }
  setScreen(screen) {
    this.title.classList.toggle('hidden', screen !== 'title'); this.pause.classList.toggle('hidden', screen !== 'pause');
    this.hud.classList.toggle('hidden', screen !== 'game');
  }
  update(player, quest, nearby, enemies, worldClock, dt) {
    const set = (id, value) => { const node = this.root.querySelector(`#${id}`); if (node) node.textContent = value; };
    const bar = (id, value) => { const node = this.root.querySelector(`#${id}`); if (node) node.style.width = `${Math.max(0, Math.min(100, value))}%`; };
    set('level', player.level); set('gold', `◈ ${player.gold}`); set('hp-text', `${Math.ceil(player.hp)} / ${player.maxHp}`); set('mana-text', `${Math.floor(player.mana)} / ${player.maxMana}`); set('stamina-text', `${Math.floor(player.stamina)}%`);
    bar('hp-bar', player.hp / player.maxHp * 100); bar('mana-bar', player.mana / player.maxMana * 100); bar('stamina-bar', player.stamina);
    const needed = player.level * 90; bar('xp-bar', player.xp / needed * 100); set('xp-text', `${player.xp} / ${needed} XP`);
    set('objective', quest.objective); set('quest-progress', quest.progress || '');
    const interaction = this.root.querySelector('#interaction'); interaction.classList.toggle('hidden', !nearby);
    if (nearby) set('interaction-label', nearby.label);
    const element = ELEMENTS.find(item => item.id === player.element);
    set('element-badge', element ? `${element.glyph} ${element.name}` : 'Elemento não desperto');
    const badge = this.root.querySelector('#element-badge'); badge.style.color = element?.glow || '';
    const intro = this.root.querySelector('#grimoire-intro'); intro.textContent = player.grimoire ? `Seu elemento é ${element?.name || 'desconhecido'}. As quatro artes respondem às teclas 1–4.` : 'Seu destino mágico ainda não foi revelado.';
    for (const [i, spell] of SPELLS.entries()) {
      const slot = this.root.querySelector(`[data-slot="${i}"]`); slot?.classList.toggle('locked', !player.grimoire);
      if (slot) { slot.classList.toggle('selected', player.grimoire && player.selectedSpell === i); const cooldown = slot.querySelector('.cooldown'); cooldown.style.transform = `scaleY(${player.spellCooldowns[i] / spell.cooldown})`; }
    }
    set('time-label', ['Aurora', 'Manhã', 'Entardecer', 'Noite'][Math.floor(((worldClock % 300) / 300) * 4)]);
  }
  toast(message, duration = 2600) {
    const node = this.root.querySelector('#toast'); node.textContent = message; node.classList.add('visible'); this.toastTimer = duration;
  }
  updateToast(dt) { if (this.toastTimer > 0) { this.toastTimer -= dt * 1000; if (this.toastTimer <= 0) this.root.querySelector('#toast')?.classList.remove('visible'); } }
}
