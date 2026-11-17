/* ============================================================
   UI — HUD, menus, grimório, inventário, loja, mapa, diálogos.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp } from './state.js'
import { ELEMENTS } from './elements.js'
import { POIS, VILLAGE, CITY } from './world.js'
import { RANKS } from './enemies.js'
import { xpNeed } from './player.js'
import { RARITY_COLORS } from './inventory.js'
import { applyVolumes, sfx } from './audio.js'

export function createUI(hooks) {
  const $ = (id) => document.getElementById(id)
  const hud = $('hud')
  const menuRoot = $('menu-root')
  const ui = {
    modal: null,
    dialog: null,
    dialogIdx: 0,
    dialogLines: [],
    dialogOnEnd: null,
    bannerT: 0,
    hintT: 0,
    damage: [],
    minimapT: 0,
    hudT: 0,
    prompt: null,
    discovered: G.discovered || (G.discovered = new Set()),
  }

  /* ---------- elementos criados ---------- */
  const promptEl = document.createElement('div')
  promptEl.id = 'interact-prompt'
  promptEl.className = 'hidden'
  hud.appendChild(promptEl)

  const dmgLayer = document.createElement('div')
  dmgLayer.id = 'dmg-layer'
  hud.appendChild(dmgLayer)

  const cinemaEl = document.createElement('div')
  cinemaEl.id = 'cinema'
  cinemaEl.className = 'hidden'
  cinemaEl.innerHTML = '<div class="cine-bar top"></div><div class="cine-bar bot"></div>'
  document.body.appendChild(cinemaEl)

  /* ============================================================
     HUD
     ============================================================ */
  function showHud() { hud.classList.remove('hidden') }
  function hideHud() { hud.classList.add('hidden') }
  UI_hideLoading()

  function setProgress(pct, msg) {
    const f = $('load-fill')
    if (f) f.style.width = `${pct}%`
    if (msg) $('load-msg').textContent = msg
  }
  function UI_hideLoading() {
    const l = $('loading')
    if (l) l.classList.add('hidden')
  }
  function showError(msg) {
    const e = $('err-screen')
    if (e) { e.classList.remove('hidden'); $('err-msg').textContent = msg || 'Erro desconhecido.' }
    $('err-reload').onclick = () => location.reload()
  }

  function toast(text, cls = '') {
    const t = document.createElement('div')
    t.className = `toast ${cls}`
    t.textContent = text
    $('toasts').appendChild(t)
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400) }, 2800)
  }

  function banner(big, sub = '', small = '', dur = 1, color = '#d9c98a') {
    const b = $('banner')
    $('banner-small').textContent = small
    $('banner-big').textContent = big
    $('banner-big').style.setProperty('--bcolor', color)
    $('banner-sub').textContent = sub
    b.classList.remove('hidden', 'show')
    void b.offsetWidth
    b.classList.add('show')
    ui.bannerT = 3.4 * dur
  }

  function showHint(text, dur = 5) {
    const h = $('hint-bar')
    h.textContent = text
    h.classList.remove('hidden')
    ui.hintT = dur
  }
  function hideHint() { $('hint-bar').classList.add('hidden'); ui.hintT = 0 }

  function setPrompt(text) {
    ui.prompt = text
    if (!text) promptEl.classList.add('hidden')
    else { promptEl.textContent = text; promptEl.classList.remove('hidden') }
  }

  function setRegion(name) {
    if (ui._region === name) return
    ui._region = name
    $('region-name').textContent = name
    if (G.story && G.story.phase !== 'menu' && name) {
      if (!ui.discovered.has(name)) {
        ui.discovered.add(name)
        if (name !== 'Campos de Aetheria') {
          toast(`Região descoberta: ${name}`, 'xp')
          if (G.player) G.player.gold += 5
        }
      }
    }
  }

  function setElementUI() {
    const p = G.player
    if (!p || !p.element) return
    const el = ELEMENTS[p.element]
    $('element-chip').classList.remove('hidden')
    $('element-icon').textContent = el.icon
    $('element-name').textContent = p.element
    $('element-name').style.color = el.cssColor
  }

  /* ---------- hotbar ---------- */
  function refreshHotbar() {
    const p = G.player
    const bar = $('hotbar')
    if (!p) return
    let html = ''
    const elem = p.element ? ELEMENTS[p.element] : null
    for (let i = 0; i < 4; i++) {
      const unlocked = !!elem && i < (p.spellsUnlocked || 1)
      const sp = elem ? elem.spells[i] : null
      html += `<div class="slot ${unlocked ? '' : 'locked'}" data-slot="${i}">
        <span class="key">${i + 1}</span>
        <span class="icon">${unlocked ? sp.icon : '🔒'}</span>
        ${sp && unlocked ? `<span class="mana">${sp.mana}</span>` : ''}
        <div class="cd hidden"></div>
      </div>`
    }
    const inv = G.inventory
    const pv = inv ? inv.count('poção de vida') : 0
    const pm = inv ? inv.count('poção de mana') : 0
    html += `<div class="slot" data-slot="4"><span class="key">5</span><span class="icon">🧪</span><span class="count">${pv}</span><div class="cd hidden"></div></div>`
    html += `<div class="slot" data-slot="5"><span class="key">6</span><span class="icon">🔮</span><span class="count">${pm}</span><div class="cd hidden"></div></div>`
    bar.innerHTML = html
  }

  /* ---------- tracker ---------- */
  function refreshTracker() {
    const q = G.quests
    const box = $('quest-tracker')
    if (!q || !q.tracked) { box.classList.add('hidden'); return }
    const d = q.defs[q.tracked]
    if (!d) { box.classList.add('hidden'); return }
    box.classList.remove('hidden')
    $('quest-title').textContent = d.title
    let obj = d.obj
    const prog = q.progress[q.tracked]
    if (d.counter) obj += ` (${Math.min(prog || 0, d.counter)}/${d.counter})`
    $('quest-obj').textContent = obj
    const t = d.target ? d.target() : null
    const p = G.player
    if (t && p) $('quest-dist').textContent = `◈ ${Math.round(Math.hypot(t.x - p.pos.x, t.z - p.pos.z))} m`
    else $('quest-dist').textContent = ''
  }
  function clearTracker() { $('quest-tracker').classList.add('hidden') }
  function questBanner(title, obj) { banner('NOVA MISSÃO', title, obj, 0.85) }

  /* ---------- dano flutuante ---------- */
  const _v = new THREE.Vector3()
  function damageAt(x, y, z, amount, color = '#fff') {
    if (ui.damage.length > 40) return
    const el = document.createElement('div')
    el.className = 'dmg-num'
    el.textContent = amount
    el.style.color = color
    dmgLayer.appendChild(el)
    ui.damage.push({ el, x, y, z, t: 0 })
  }

  /* ---------- cinema ---------- */
  function cinema(on) {
    if (on) { cinemaEl.classList.remove('hidden'); hud.style.opacity = '0.15' }
    else { cinemaEl.classList.add('hidden'); hud.style.opacity = '1' }
  }

  /* ============================================================
     MODAIS
     ============================================================ */
  function openScreen(html, cls = 'dark') {
    menuRoot.innerHTML = `<div class="screen ${cls}">${html}</div>`
    ui.modal = true
    document.body.classList.add('ui-open')
    sfx('ui')
    bindMenuClicks()
  }
  function closeScreen() {
    menuRoot.innerHTML = ''
    ui.modal = null
    G.grimoireOpen = false
    document.body.classList.remove('ui-open')
  }

  function bindMenuClicks() {
    menuRoot.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.dataset.act
        sfx('ui')
        handleAction(act, btn)
      }
    })
    menuRoot.querySelectorAll('input[type=range]').forEach((inp) => {
      const key = inp.dataset.setting
      inp.oninput = () => {
        G.settings[key] = parseFloat(inp.value)
        const val = btnValue(inp)
        const label = inp.parentElement.querySelector('.val')
        if (label) label.textContent = val
        if (key === 'camDist' && G.cameraRig) G.cameraRig.targetDist = parseFloat(inp.value)
        if (['master', 'music', 'sfx'].includes(key)) applyVolumes()
      }
    })
    menuRoot.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.onchange = () => {
        G.settings[cb.dataset.setting] = cb.checked
      }
    })
    menuRoot.querySelectorAll('select').forEach((sel) => {
      sel.onchange = () => {
        G.settings[sel.dataset.setting] = sel.value
        if (G.settings.shadows === 'off') toast('Sombras desligadas.', 'xp')
      }
    })
  }

  function btnValue(inp) {
    const v = parseFloat(inp.value)
    if (inp.dataset.setting === 'sensitivity') return v.toFixed(2)
    if (['master', 'music', 'sfx'].includes(inp.dataset.setting)) return Math.round(v * 100) + '%'
    if (inp.dataset.setting === 'camDist') return v.toFixed(1) + ' m'
    return String(v)
  }

  function handleAction(act, btn) {
    switch (act) {
      case 'new': hooks.onNewGame(); return
      case 'continue': hooks.onContinue(); return
      case 'resume': closeScreen(); G.paused = false; showHud(); return
      case 'save': if (G.saveApi) G.saveApi.save(true); return
      case 'settings': showSettings(); return
      case 'controls': showControls(); return
      case 'credits': showCredits(); return
      case 'menu': hooks.onQuitToMenu(); return
      case 'back': if (hooks.onMenuBack) hooks.onMenuBack(); else showMainMenu(); return
      case 'inventory': toggleInventory(); return
      case 'map': toggleMap(); return
      case 'grim-close': closeGrimoire(); return
      case 'inventory-close': closeScreen(); G.paused = false; showHud(); return
      case 'shop-close': closeScreen(); G.paused = false; showHud(); return
      case 'equip': {
        const it = G.inventory.items[parseInt(btn.dataset.idx, 10)]
        if (it) { G.inventory.equip(it); toggleInventory() }
        return
      }
      case 'use-potion': {
        const p = G.player
        if (btn.dataset.kind === 'mana') { p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.5); G.inventory.remove('poção de mana', 1); sfx('potion') }
        else { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); G.inventory.remove('poção de vida', 1); sfx('heal') }
        toggleInventory()
        return
      }
      case 'buy': {
        const p = G.player
        const price = parseInt(btn.dataset.price, 10)
        if (p.gold < price) { toast('Ouro insuficiente!', 'gold'); return }
        p.gold -= price
        const item = JSON.parse(btn.dataset.item)
        G.inventory.add(item)
        sfx('buy')
        toast(`Comprado: ${item.name}`, 'gold')
        openShop(ui._shopKind || 'comerciante')
        return
      }
      case 'sell': {
        const n = G.inventory.count('Presas de Goblin')
        if (n <= 0) { toast('Nada para vender.', 'gold'); return }
        G.inventory.remove('Presas de Goblin', n)
        G.player.gold += n * 4
        sfx('coin')
        toast(`Vendido por ${n * 4} ◈`, 'gold')
        openShop(ui._shopKind || 'comerciante')
        return
      }
      case 'travel': {
        const x = parseFloat(btn.dataset.x), z = parseFloat(btn.dataset.z)
        const p = G.player
        p.pos.x = x; p.pos.z = z; p.pos.y = 0
        closeScreen(); G.paused = false; showHud()
        toast('Você viajou.', 'xp')
        return
      }
      case 'reset': {
        if (G.saveApi) G.saveApi.delete()
        G.story.phase = 'menu'
        location.reload()
        return
      }
      default: return
    }
  }

  /* ============================================================
     MENU PRINCIPAL
     ============================================================ */
  function showMainMenu() {
    const has = G.saveApi && G.saveApi.hasSave()
    openScreen(`
      <div class="menu-title">CRÔNICAS DE AETHERIA</div>
      <div class="menu-sub">Um RPG de fantasia medieval em mundo aberto</div>
      <div class="menu-list">
        <button class="menu-btn" data-act="new">Novo Jogo</button>
        <button class="menu-btn" data-act="continue" ${has ? '' : 'disabled'}>Continuar</button>
        <button class="menu-btn" data-act="settings">Configurações</button>
        <button class="menu-btn" data-act="controls">Controles</button>
        <button class="menu-btn" data-act="credits">Créditos</button>
      </div>
      <div class="menu-sub" style="margin-top:26px;font-size:11px">Elementos · Fogo · Água · Raio · Terra · Vento · Gelo</div>
    `)
    hideHud()
    if (G.audio) G.audio.menu?.()
  }

  function showSettings() {
    const s = G.settings
    openScreen(`
      <div class="menu-title" style="font-size:1.4rem">CONFIGURAÇÕES</div>
      <div class="opt-group">
        <div class="opt-row"><label>Sensibilidade</label><input type="range" min="0.3" max="2" step="0.05" value="${s.sensitivity}" data-setting="sensitivity" /><span class="val">${s.sensitivity.toFixed(2)}</span></div>
        <div class="opt-row"><label>Distância da câmera</label><input type="range" min="3" max="9" step="0.2" value="${s.camDist}" data-setting="camDist" /><span class="val">${s.camDist.toFixed(1)} m</span></div>
        <div class="opt-row"><label>Inverter eixo vertical</label><input type="checkbox" data-setting="invertY" ${s.invertY ? 'checked' : ''} /></div>
        <div class="opt-row"><label>Volume geral</label><input type="range" min="0" max="1" step="0.05" value="${s.master}" data-setting="master" /><span class="val">${Math.round(s.master * 100)}%</span></div>
        <div class="opt-row"><label>Música</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-setting="music" /><span class="val">${Math.round(s.music * 100)}%</span></div>
        <div class="opt-row"><label>Efeitos</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-setting="sfx" /><span class="val">${Math.round(s.sfx * 100)}%</span></div>
        <div class="opt-row"><label>Sombras</label><select data-setting="shadows">
          <option value="alta" ${s.shadows === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="baixa" ${s.shadows === 'baixa' ? 'selected' : ''}>Baixa</option>
          <option value="off" ${s.shadows === 'off' ? 'selected' : ''}>Desligadas</option>
        </select></div>
        <div class="opt-row"><label>Apagar progresso</label><button class="menu-btn" style="padding:6px 14px;font-size:12px" data-act="reset">Apagar save</button></div>
      </div>
      <button class="menu-back" data-act="back">◂ Voltar</button>
    `)
  }

  function showControls() {
    openScreen(`
      <div class="menu-title" style="font-size:1.4rem">CONTROLES</div>
      <div class="ctrl-grid" style="margin-top:18px">
        <b>W A S D</b><span>Movimentação</span>
        <b>Mouse direito</b><span>Girar câmera</span>
        <b>Mouse esquerdo</b><span>Ataque (combo)</span>
        <b>F</b><span>Ataque pesado</span>
        <b>Espaço</b><span>Esquiva</span>
        <b>V</b><span>Salto</span>
        <b>Shift</b><span>Correr</span>
        <b>Q</b><span>Defender / parry</span>
        <b>1 · 2 · 3 · 4</b><span>Magias elementais</span>
        <b>5 · 6</b><span>Poção de vida / mana</span>
        <b>E</b><span>Interagir / conversar</span>
        <b>G</b><span>Abrir grimório</span>
        <b>I</b><span>Inventário</span>
        <b>M</b><span>Mapa do mundo</span>
        <b>Esc</b><span>Pausa</span>
        <b>Roda do mouse</b><span>Zoom da câmera</span>
      </div>
      <button class="menu-back" data-act="back">◂ Voltar</button>
    `)
  }

  function showCredits() {
    openScreen(`
      <div class="menu-title" style="font-size:1.5rem">CRÔNICAS DE AETHERIA</div>
      <div class="menu-sub">Um RPG 3D de fantasia medieval</div>
      <div style="max-width:460px;text-align:center;line-height:1.7;color:#c8c0a8;font-size:14px">
        <p>Construído do zero com Three.js, WebAudio e módulos independentes.</p>
        <p style="margin-top:12px">Mundo, personagem, magia, grimório, NPCs, combate e história — tudo procedural, sem recursos externos.</p>
        <p style="margin-top:16px;color:#8f8672;font-size:12px">Capítulos I–V jogáveis · 6 elementos · 24 magias · mundo aberto com 15 regiões</p>
      </div>
      <button class="menu-back" data-act="back">◂ Voltar</button>
    `)
  }

  function togglePause() {
    if (ui.modal) { closeScreen(); G.paused = false; showHud(); return }
    if (G.story.phase === 'menu') return
    G.paused = true
    openScreen(`
      <div class="menu-title" style="font-size:1.6rem">PAUSA</div>
      <div class="menu-sub">Crônicas de Aetheria</div>
      <div class="menu-list">
        <button class="menu-btn" data-act="resume">Continuar</button>
        <button class="menu-btn" data-act="save">Salvar Jogo</button>
        <button class="menu-btn" data-act="inventory">Inventário</button>
        <button class="menu-btn" data-act="map">Mapa do Mundo</button>
        <button class="menu-btn" data-act="settings">Configurações</button>
        <button class="menu-btn" data-act="controls">Controles</button>
        <button class="menu-btn" data-act="menu">Menu Principal</button>
      </div>
    `)
  }

  /* ============================================================
     GRIMÓRIO
     ============================================================ */
  function openGrimoire() {
    const p = G.player
    if (!p || !p.element) return
    const el = ELEMENTS[p.element]
    const unlocked = p.spellsUnlocked || 1
    let spellsHtml = ''
    el.spells.forEach((sp, i) => {
      const isUnlocked = i < unlocked
      const lvl = p.spellLevel[i]
      spellsHtml += `<div class="grim-spell ${isUnlocked ? '' : 'locked'}" style="--gc:${el.cssColor}">
        <span class="gi">${isUnlocked ? sp.icon : '🔒'}</span>
        <div>
          <div class="gn">${isUnlocked ? sp.name : 'Página selada'}</div>
          <div class="gd">${isUnlocked ? sp.desc : `Desbloqueada no nível ${lvl}. Continue evoluindo.`}</div>
          ${isUnlocked ? `<div class="gs">Dano ${Math.round(sp.dmg)} · Mana ${sp.mana} · Recarga ${sp.cd}s · Tecla ${i + 1}</div>` : ''}
        </div>
        <div class="selmark">${isUnlocked ? (p.cds[i] > 0 ? `${p.cds[i].toFixed(1)}s` : 'PRONTA') : 'Nv ' + lvl}</div>
      </div>`
    })
    openScreen(`
      <div class="menu-title" style="font-size:1.3rem;color:${el.cssColor}">${el.icon} GRIMÓRIO DE ${p.element.toUpperCase()}</div>
      <div class="menu-sub">${el.desc} · Nível de mago ${p.level}</div>
      <div class="page grim-page">${spellsHtml}</div>
      <div class="menu-sub" style="margin-top:12px;font-size:11px">Páginas evoluem com seu nível · ${unlocked}/4 desbloqueadas</div>
      <button class="menu-back" data-act="grim-close">[G] Fechar grimório</button>
    `, 'panel grim-screen')
    G.grimoireOpen = true
  }
  function closeGrimoire() {
    G.grimoireOpen = false
    if (!ui.modal) return
    closeScreen()
  }

  /* ============================================================
     INVENTÁRIO
     ============================================================ */
  function toggleInventory() {
    if (ui.modal) { closeScreen(); G.paused = false; showHud(); return }
    const p = G.player
    const inv = G.inventory
    if (!p || !inv) return
    G.paused = true
    const rows = inv.items.length
      ? inv.items.map((it, i) => `<div class="inv-item">
          <span class="ic">${it.icon || '❔'}</span>
          <span class="nm">${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''}<br><small class="rar-${(it.rarity || 'Comum').toLowerCase()}">${it.rarity || 'Comum'}</small></span>
          ${it.kind === 'weapon' || it.kind === 'armor' ? `<button data-act="equip" data-idx="${i}">Equipar</button>` : ''}
          ${it.kind === 'potion' ? `<button data-act="use-potion" data-kind="${it.name.includes('mana') ? 'mana' : 'vida'}">Usar</button>` : ''}
        </div>`).join('')
      : '<div style="padding:22px;color:#8f8672;font-style:italic">Seu inventário está vazio. Derrote inimigos e explore baús.</div>'
    openScreen(`
      <div class="menu-title" style="font-size:1.4rem">INVENTÁRIO</div>
      <div class="menu-sub">
        Nv ${p.level} · ◈ ${p.gold} · Força ${p.str} · Defesa ${p.def} · Magia ${p.mag} · Crítico ${p.crit}%
        ${inv.equipped.weapon ? ` · Arma: ${inv.equipped.weapon.name}` : ''}${inv.equipped.armor ? ` · Armadura: ${inv.equipped.armor.name}` : ''}
      </div>
      <div class="inv-grid">${rows}</div>
      <button class="menu-back" data-act="inventory-close">[I] Fechar</button>
    `, 'panel')
  }

  /* ============================================================
     LOJA
     ============================================================ */
  function openShop(kind) {
    ui._shopKind = kind
    const p = G.player
    if (!p) return
    G.paused = true
    const potion = { name: 'poção de vida', kind: 'potion', rarity: 'Comum', icon: '🧪', qty: 1 }
    const manaPot = { name: 'poção de mana', kind: 'potion', rarity: 'Comum', icon: '🔮', qty: 1 }
    const stock = kind === 'ferreiro'
      ? [
        { item: { name: 'Poção de Vida', kind: 'potion', rarity: 'Comum', icon: '🧪', qty: 1 }, price: 30 },
        { item: { name: 'Espada de Aço', kind: 'weapon', rarity: 'Raro', icon: '🗡️', qty: 1 }, price: 220 },
        { item: { name: 'Armadura de Placas', kind: 'armor', rarity: 'Raro', icon: '🛡️', qty: 1 }, price: 260 },
      ]
      : [
        { item: { name: 'Poção de Vida', kind: 'potion', rarity: 'Comum', icon: '🧪', qty: 1 }, price: 28 },
        { item: { name: 'Poção de Mana', kind: 'potion', rarity: 'Comum', icon: '🔮', qty: 1 }, price: 32 },
        { item: { name: 'Adaga do Viajante', kind: 'weapon', rarity: 'Incomum', icon: '🗡️', qty: 1 }, price: 90 },
        { item: { name: 'Pergaminho Antigo', kind: 'book', rarity: 'Raro', icon: '📜', qty: 1 }, price: 60 },
      ]
    const rows = stock.map((s) => `<div class="inv-item">
        <span class="ic">${s.item.icon}</span>
        <span class="nm">${s.item.name}<br><small class="rar-${s.item.rarity.toLowerCase()}">${s.item.rarity}</small></span>
        <button data-act="buy" data-price="${s.price}" data-item='${JSON.stringify(s.item)}'>◈ ${s.price}</button>
      </div>`).join('')
    openScreen(`
      <div class="menu-title" style="font-size:1.4rem">${kind === 'ferreiro' ? '⚒ FORJA DE BRANN' : '🧺 MERCADO DE MILA'}</div>
      <div class="menu-sub">Seu ouro: ◈ ${p.gold}</div>
      <div class="shop-list">${rows}
        <div class="inv-item"><span class="ic">🦷</span><span class="nm">Vender Presas de Goblin (4 ◈ cada)<br><small>Possui: ${G.inventory.count('Presas de Goblin')}</small></span><button data-act="sell">Vender</button></div>
      </div>
      <button class="menu-back" data-act="shop-close">Fechar</button>
    `, 'panel')
  }

  /* ============================================================
     MAPA
     ============================================================ */
  function toggleMap() {
    if (ui.modal) { closeScreen(); G.paused = false; showHud(); return }
    G.paused = true
    const discovered = G.quests && G.quests.tracked
    const qTarget = discovered ? (G.quests.defs[discovered]?.target?.() || null) : null
    const travel = [
      { name: 'Vila de Pedravale', x: VILLAGE.x, z: VILLAGE.z },
      { name: 'Corvoalta', x: CITY.x, z: CITY.z },
    ]
    openScreen(`
      <div class="menu-title" style="font-size:1.4rem">MAPA DE AETHERIA</div>
      <div class="menu-sub">Regiões descobertas: ${ui.discovered.size}</div>
      <canvas id="world-map" width="520" height="520"></canvas>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;justify-content:center">
        ${travel.map((t) => `<button class="menu-btn" style="padding:7px 14px;font-size:12px" data-act="travel" data-x="${t.x + 3}" data-z="${t.z + 6}">Viajar: ${t.name}</button>`).join('')}
      </div>
      <button class="menu-back" data-act="grid-back">◂ Voltar</button>
    `, 'panel')
    // botão voltar do mapa
    const back = menuRoot.querySelector('[data-act="grid-back"]')
    if (back) back.onclick = () => { closeScreen(); G.paused = false; showHud() }
    drawWorldMap(qTarget)
  }

  function drawWorldMap(qTarget) {
    const cv = $('world-map')
    if (!cv) return
    const ctx = cv.getContext('2d')
    const W = cv.width, H = cv.height
    const S = W / 500
    const px = (x) => (x + 250) * S
    const pz = (z) => (z + 250) * S
    // fundo
    ctx.fillStyle = '#1a2418'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#233020'
    ctx.fillRect(px(-180), pz(-180), 360 * S, 360 * S)
    // mar
    ctx.fillStyle = '#1c3a5a'
    ctx.beginPath(); ctx.arc(px(40), pz(115), 58 * S, 0, Math.PI * 2); ctx.fill()
    // rio
    ctx.strokeStyle = '#2e5a8a'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(px(60), pz(-250)); ctx.lineTo(px(60), pz(60)); ctx.stroke()
    // estradas
    ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px(0), pz(12)); ctx.lineTo(px(34), pz(2)); ctx.lineTo(px(60), pz(-30)); ctx.lineTo(px(134), pz(-30)); ctx.stroke()
    // regiões
    const zones = [
      ['Vila de Pedravale', 0, 0, 52, '#4a6a3a'],
      ['Corvoalta', 150, -30, 55, '#5a5a6a'],
      ['Floresta de Auberon', -130, 30, 70, '#2a4a2a'],
      ['Lago Lúnula', 40, 115, 58, '#2a5a8a'],
      ['Ruínas de Vhalor', -45, -158, 26, '#5a5040'],
      ['Caverna Umbral', -206, 92, 22, '#3a3030'],
      ['Serra do Inverno', 20, -215, 55, '#7a8a9a'],
    ]
    for (const [name, x, z, r, col] of zones) {
      const known = ui.discovered.has(name)
      ctx.fillStyle = known ? col : 'rgba(60,60,60,.35)'
      ctx.beginPath(); ctx.arc(px(x), pz(z), r * S, 0, Math.PI * 2); ctx.fill()
      if (known) {
        ctx.fillStyle = '#d8d0b0'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'
        ctx.fillText(name, px(x), pz(z) + r * S + 12)
      }
    }
    // POIs
    for (const poi of POIS) {
      const known = ui.discovered.has(poi.name) || ui.discovered.has('Corvoalta')
      ctx.font = '13px Georgia'; ctx.textAlign = 'center'
      ctx.fillStyle = known ? '#e8d48a' : 'rgba(150,150,150,.4)'
      ctx.fillText(poi.icon, px(poi.x), pz(poi.z))
    }
    // alvo da missão
    if (qTarget) {
      ctx.strokeStyle = '#ffd050'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(px(qTarget.x), pz(qTarget.z), 8, 0, Math.PI * 2); ctx.stroke()
    }
    // jogador
    const p = G.player
    if (p) {
      ctx.save()
      ctx.translate(px(p.pos.x), pz(p.pos.z))
      ctx.rotate(-p.yaw + Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = '#8f8672'; ctx.font = '10px Verdana'; ctx.textAlign = 'left'
    ctx.fillText('N', 10, 18)
  }

  /* ============================================================
     DIÁLOGO
     ============================================================ */
  function showDialog(name, lines, onEnd) {
    ui.dialog = { name, onEnd }
    ui.dialogLines = lines.slice()
    ui.dialogIdx = 0
    $('dialog').classList.remove('hidden')
    renderDialogLine()
  }
  function renderDialogLine() {
    $('dialog-name').textContent = ui.dialog?.name || ''
    $('dialog-text').textContent = ui.dialogLines[ui.dialogIdx] || ''
    $('dialog-next').textContent = ui.dialogIdx < ui.dialogLines.length - 1 ? '[E] continuar ▸' : '[E] encerrar'
  }
  function advanceDialog() {
    if (!ui.dialog) return false
    if (ui.dialogIdx < ui.dialogLines.length - 1) {
      ui.dialogIdx++
      renderDialogLine()
    } else {
      const cb = ui.dialog.onEnd
      ui.dialog = null
      $('dialog').classList.add('hidden')
      if (cb) { try { cb() } catch (err) { console.error(err) } }
    }
    return true
  }

  /* ============================================================
     MINIMAPA
     ============================================================ */
  function drawMinimap() {
    const cv = $('minimap')
    if (!cv) return
    const ctx = cv.getContext('2d')
    const W = cv.width, H = cv.height
    const p = G.player
    if (!p) return
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); ctx.clip()
    ctx.fillStyle = '#22301e'; ctx.fillRect(0, 0, W, H)
    const range = 85
    const S = (W / 2) / range
    const px = (x) => W / 2 + (x - p.pos.x) * S
    const pz = (z) => H / 2 + (z - p.pos.z) * S
    // água
    ctx.fillStyle = '#2a5a8a'
    ctx.beginPath(); ctx.arc(px(40), pz(115), 58 * S, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2e6a9a'
    ctx.fillRect(px(56), pz(-120), 8 * S, 200 * S)
    // estrada
    ctx.strokeStyle = '#7a6a4a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px(-60), pz(0)); ctx.lineTo(px(60), pz(-30)); ctx.lineTo(px(170), pz(-30)); ctx.stroke()
    // cidade/vila
    ctx.fillStyle = '#a89870'
    ctx.fillRect(px(-24), pz(-24), 48 * S, 48 * S)
    ctx.beginPath(); ctx.arc(px(150), pz(-30), 42 * S, 0, Math.PI * 2); ctx.strokeStyle = '#c8c0a0'; ctx.lineWidth = 1.5; ctx.stroke()
    // POIs
    ctx.font = '10px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8d48a'
    for (const poi of POIS) {
      const dx = poi.x - p.pos.x, dz = poi.z - p.pos.z
      if (Math.hypot(dx, dz) > range * 0.95) continue
      ctx.fillStyle = poi.name === 'Acampamento Goblin' ? '#e86050' : '#e8d48a'
      ctx.fillText(poi.icon.length > 2 ? '!' : poi.icon, px(poi.x), pz(poi.z) + 3)
    }
    // inimigos
    for (const e of G.enemies) {
      if (e.dead) continue
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > range) continue
      ctx.fillStyle = e.boss ? '#ff4040' : '#ff7050'
      ctx.beginPath(); ctx.arc(px(e.pos.x), pz(e.pos.z), e.boss ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill()
    }
    // NPCs
    ctx.fillStyle = '#80c8ff'
    for (const n of G.npcs) {
      if (!n.rig) continue
      if (Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z) > range) continue
      ctx.beginPath(); ctx.arc(px(n.pos.x), pz(n.pos.z), 1.6, 0, Math.PI * 2); ctx.fill()
    }
    // alvo da missão
    const q = G.quests
    if (q && q.tracked) {
      const t = q.defs[q.tracked]?.target?.()
      if (t) {
        ctx.strokeStyle = '#ffd050'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.arc(px(t.x), pz(t.z), 5, 0, Math.PI * 2); ctx.stroke()
      }
    }
    // jogador
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-p.yaw + Math.PI)
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.restore()
    // brilho / borda
    ctx.strokeStyle = 'rgba(200,180,120,.55)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#e8d48a'; ctx.font = '10px Verdana'; ctx.textAlign = 'center'
    ctx.fillText('N', W / 2, 12)
  }

  /* ============================================================
     UPDATE GERAL
     ============================================================ */
  function updateHud(p, dt) {
    if (!p) return
    ui.hudT -= dt
    if (ui.hudT <= 0) {
      ui.hudT = 0.08
      $('hp-fill').style.width = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`
      $('mp-fill').style.width = `${clamp(p.mp / p.maxMp, 0, 1) * 100}%`
      $('st-fill').style.width = `${clamp(p.st / p.maxSt, 0, 1) * 100}%`
      $('xp-fill').style.width = `${clamp(p.xp / xpNeed(p.level), 0, 1) * 100}%`
      $('hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`
      $('mp-text').textContent = `${Math.ceil(p.mp)}/${p.maxMp}`
      $('st-text').textContent = `${Math.ceil(p.st)}/${p.maxSt}`
      $('level-num').textContent = p.level
      $('gold-num').textContent = p.gold
      const hh = Math.floor(G.hour), mm = Math.floor((G.hour % 1) * 60)
      $('clock-num').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      // cooldowns dos slots
      const slots = $('hotbar').children
      for (let i = 0; i < 4; i++) {
        const s = slots[i]
        if (!s) continue
        const cd = s.querySelector('.cd')
        if (!cd) continue
        if (p.cds && p.cds[i] > 0) { cd.classList.remove('hidden'); cd.textContent = p.cds[i].toFixed(1) }
        else cd.classList.add('hidden')
      }
    }

    // alvo
    const tgt = pickTarget(p)
    const tp = $('target-plate')
    if (tgt) {
      tp.classList.remove('hidden')
      $('target-name').textContent = tgt.cls
      $('target-hp').style.width = `${clamp(tgt.hp / tgt.maxHp, 0, 1) * 100}%`
      $('target-rank').textContent = `Rank ${tgt.rank} · Nv ${rankLevel(tgt.rank)}`
    } else tp.classList.add('hidden')

    // boss
    const boss = G.enemies.find((e) => !e.dead && e.boss && e.aggro && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 40)
    const bp = $('boss-plate')
    if (boss) {
      bp.classList.remove('hidden')
      $('boss-name').textContent = boss.cls
      $('boss-hp').style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`
    } else bp.classList.add('hidden')

    // minimapa
    ui.minimapT -= dt
    if (ui.minimapT <= 0) { ui.minimapT = 0.18; drawMinimap() }

    // banner/hint
    if (ui.bannerT > 0) {
      ui.bannerT -= dt
      if (ui.bannerT <= 0) { const b = $('banner'); b.classList.add('hidden'); b.classList.remove('show') }
    }
    if (ui.hintT > 0) {
      ui.hintT -= dt
      if (ui.hintT <= 0) $('hint-bar').classList.add('hidden')
    }

    // números de dano
    for (let i = ui.damage.length - 1; i >= 0; i--) {
      const d = ui.damage[i]
      d.t += dt
      if (d.t > 0.95) { d.el.remove(); ui.damage.splice(i, 1); continue }
      _v.set(d.x, d.y + d.t * 0.9, d.z)
      _v.project(G.camera)
      if (_v.z > 1) { d.el.style.display = 'none'; continue }
      d.el.style.display = 'block'
      const sx = (_v.x * 0.5 + 0.5) * window.innerWidth
      const sy = (-_v.y * 0.5 + 0.5) * window.innerHeight
      d.el.style.transform = `translate(${sx}px, ${sy}px)`
      d.el.style.opacity = String(1 - d.t / 0.95)
    }
  }

  function pickTarget(p) {
    let best = null, bd = 24
    for (const e of G.enemies) {
      if (e.dead) continue
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z)
      if (d < bd) { bd = d; best = e }
    }
    return best
  }
  function rankLevel(r) { return { E: 1, D: 3, C: 6, B: 10, A: 15, S: 22, SS: 30 }[r] || 1 }

  function setTouchVisible(v) { $('touch-ui').classList.toggle('hidden', !v) }

  /* ---------- ligação pública ---------- */
  const api = {
    showHud, hideHud, setProgress, hideLoading: UI_hideLoading, showError,
    toast, banner, showHint, hideHint, setPrompt,
    setRegion, setElementUI, refreshHotbar, refreshTracker, clearTracker, questBanner,
    damageAt, cinema, updateHud,
    showMainMenu, showSettings, togglePause, toggleInventory, toggleMap,
    openGrimoire, closeGrimoire, openShop, showDialog, advanceDialog,
    closeScreen,
    isBlocking() { return !!ui.modal },
    isDialogOpen() { return !!ui.dialog },
    setTouchVisible,
    destroy() { menuRoot.innerHTML = '' },
  }
  G.uiApi = api
  return api
}
