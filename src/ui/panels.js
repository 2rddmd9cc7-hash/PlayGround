// Painéis modais — diálogo, inventário, grimório, mapa, menu, loja
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { settings, saveSettings } from '../core/config.js';
import { ELEMENTS, getSpellDef, allSpellDefs } from '../magic/elements.js';
import { itemById, RARITIES, ITEMS } from '../items/items.js';
import { xpForLevel } from './hud.js';
import { audio } from '../audio/audio.js';
import { REGIONS } from '../world/world.js';
import { fmtTime } from '../core/utils.js';

const $ = (id) => document.getElementById(id);
const modal = () => $('modal-layer');

function openModal(html, cls = '') {
  modal().classList.remove('hidden');
  modal().innerHTML = `<div class="modal ${cls}">${html}</div>`;
  G.paused = true;
  document.exitPointerLock?.();
  return modal().firstElementChild;
}
function closeModal() {
  modal().classList.add('hidden');
  modal().innerHTML = '';
  G.paused = false;
}function bindClose(el) {
  const close = document.createElement('div');
  close.className = 'close-x';
  close.textContent = '✕';
  close.onclick = () => closeModal();
  el.appendChild(close);
  el.addEventListener('click', (e) => { if (e.target === el) closeModal(); });
}

// ==================== DIÁLOGO ====================
const PANELS = {
  // Diálogos por npc/dialog-id; arrays de falas, com escolhas opcionais
  elder: [
    { name: 'Ancião Bram', text: 'Ah, ali está você, criança. O dia chegou: o cristal de Aurelia aguarda os jovens do vale.' },
    { name: 'Ancião Bram', text: 'Todo jovem deve ao reino o Rito do Teste do Poder. O cristal escolherá o elemento que dorme em você.' },
    { name: 'Ancião Bram', text: 'Siga a estrada ao norte até a cidade real. E não se esqueça: fale com todos por aqui antes de partir. É assim que se sobrevive neste mundo.' },
    { name: 'Ancião Bram', text: 'Vá com a bênção da vila, {player}. Que os Seis guiem sua mão.' },
  ],
  blacksmith: [
    { name: 'Ferreiro Doran', text: 'Fuum! Sente o calor? O aço não mente: precisa ser ouvido, sentido, obedecido.' },
    { name: 'Ferreiro Doran', text: 'Se trouxer minério das montanhas, forjo algo decente para você. E se precisar de lâmina, minha banca está sempre aberta.' },
  ],
  merchant: [
    { name: 'Comerciante Lila', text: 'Bem-vindo, viajante! Trago de tudo: poções, lâminas, tesouros da estrada.' },
    { name: 'Comerciante Lila', text: 'Abro a banca quando quiser negociar. Bom preço pelo que carrega, melhor preço pelo que compra!' },
  ],
  innkeeper: [
    { name: 'Taverneiro Guss', text: 'Sede de aventura ou sede de cerveja? As duas se curam do mesmo jeito aqui dentro.' },
    { name: 'Taverneiro Guss', text: 'Corre na vila que os goblins se mexem além das colinas. Mantenha o aço perto, amigo.' },
  ],
  priest: [
    { name: 'Sacerdotisa Mirena', text: 'Que a luz dos Seis aqueça seu caminho, filho.' },
    { name: 'Sacerdotisa Mirena', text: 'Se encontrar ervas medicinais na estrada, traga-me três. Os doentes do templo agradecem.' },
  ],
  farmer: [
    { name: 'Fazendeiro Tom', text: 'A terra não engana quem cuida dela. Cultive com paciência e ela retribuirá.' },
  ],
  guard: [
    { name: 'Guarda Fenwick', text: 'Mantenha os olhos abertos. A noite traz coisas que o dia esconde.' },
    { name: 'Guarda Fenwick', text: 'Se houver coragem em você, apareça aqui na madrugada. A vila precisa de olhos vigilantes.' },
  ],
  child: [
    { name: 'Pip', text: 'Quando eu crescer, vou ser um mago do elemento mais forte de todos!' },
    { name: 'Pip', text: 'Você vai fazer o Teste? O cristal cintila de verdade? Conta pra mim depois!' },
  ],
  child2: [
    { name: 'Nima', text: 'Pip sempre diz bobagem. O cristal não escolhe o mais forte — escolhe o mais verdadeiro.' },
  ],
  archmage: [
    { name: 'Arquimaga Selenar', text: 'Então o cristal escolheu você. Interessante... muito interessante.' },
    { name: 'Arquimaga Selenar', text: 'Há muito tempo não vejo essa marca. Guarde bem este grimório, jovem: ele crescerá com você.' },
  ],
  captain: [
    { name: 'Capitão Aldric', text: 'Disciplina vence força bruta. Lembre-se disso quando o aço cantar.' },
    { name: 'Capitão Aldric', text: 'Os goblins se aglomeram na floresta. Traga-me cabeças e haverá recompensa.' },
  ],
  candidate: [
    { name: 'Candidato', text: 'Ei, você! Também veio para o Teste? A fila anda devagar... o cristal escolhe apenas um entre muitos.' },
  ],
  queen: [
    { name: 'Rainha Isolde', text: 'Aurelia observa você, jovem. Que o seu elemento seja um farol, não uma chama destrutiva.' },
  ],
  traveler: [
    { name: 'Viajante Odd', text: 'Já caminhei por todas as estradas de Aetheria... e ainda há segredos que não contei a ninguém.' },
    { name: 'Viajante Odd', text: 'Se explorar o mundo e descobrir regiões, traga-me as notícias. Adoro um mapa bem vivo.' },
  ],
};

class Panels {
  constructor() {
    this.dialog = null;     // {lines, idx, npc}
    this.mapOpen = false;
    this.grimOpen = false;
  }

  // ---------- diálogo ----------
  startDialog(lines, npc, onEnd) {
    this.dialog = { lines, idx: 0, npc, onEnd };
    G.paused = true;
    audio.sfx('talk');
    this.showDialogLine();
  }

  showDialogLine() {
    const d = this.dialog;
    if (d.idx >= d.lines.length) { this.endDialog(); return; }
    const line = d.lines[d.idx];
    const name = line.name?.replace('{player}', G.playerName || 'Andarilho');
    const text = line.text.replace('{player}', G.playerName || 'Andarilho');
    const el = openModal(`
      <div class="dialog-name">${name || ''}</div>
      <div class="dialog-text">${text}</div>
      <div class="dialog-continue">▶ clique / espaço para continuar</div>
    `, 'dialog-wrap');
    // qualquer clique na camada avança (não só na caixa)
    if (this._layerClick) modal().removeEventListener('click', this._layerClick);
    this._layerClick = (e) => {
      if (e.target.closest('.close-x')) return;
      this.advanceDialog();
    };
    modal().addEventListener('click', this._layerClick);
    if (this._dialogAdvance) window.removeEventListener('keydown', this._dialogAdvance);
    this._dialogAdvance = (e) => {
      if (!this.dialog) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.advanceDialog();
      }
    };
    window.addEventListener('keydown', this._dialogAdvance);
  }

  advanceDialog() {
    if (!this.dialog) return;
    this.dialog.idx++;
    audio.sfx('talk');
    this.showDialogLine();
  }

  endDialog() {
    if (!this.dialog) return;
    if (this._dialogAdvance) window.removeEventListener('keydown', this._dialogAdvance);
    if (this._layerClick) { modal().removeEventListener('click', this._layerClick); this._layerClick = null; }
    const cb = this.dialog.onEnd;
    this.dialog = null;
    closeModal();
    if (G.player && G.player.state === 'interact') G.player.state = 'idle';
    cb?.();
  }

  // diálogo de NPC com escolhas (loja, missão)
  npcDialog(npc) {
    const key = npc.def.dialog;
    const lines = PANELS[key] || [{ name: npc.name, text: 'Que dia bom para uma conversa, não?' }];
    // escolhas ao final
    const withChoices = [...lines];
    const last = withChoices[withChoices.length - 1];
    const choices = [];
    if (npc.def.shop && G.storyFlags?.testDone) choices.push({ label: '🛒 Ver produtos', action: 'shop' });
    if (npc.def.dialog === 'elder' && !G.quests.activeIds.includes('main_teste') && !G.storyFlags?.testDone) choices.push({ label: '📜 Sobre o Teste do Poder', action: 'quest_teste' });
    if (npc.def.dialog === 'priest' && !G.quests.doneIds.includes('herbs')) choices.push({ label: '🌿 Oferecer ervas', action: 'quest_herbs' });
    if (npc.def.dialog === 'captain' && G.chapter >= 4 && !G.quests.doneIds.includes('hunt_goblins')) choices.push({ label: '⚔️ Aceitar caça aos goblins', action: 'quest_hunt' });
    if (npc.def.dialog === 'traveler' && !G.quests.doneIds.includes('explore_all')) choices.push({ label: '🗺️ Sobre o mundo', action: 'quest_explore' });
    if (npc.def.dialog === 'archmage' && !G.quests.doneIds.includes('main_grimorio') && G.storyFlags?.testDone) choices.push({ label: '📖 Receber o grimório', action: 'quest_grimoire' });
    if (choices.length === 0) {
      this.startDialog(withChoices, npc, () => { npc.talkedTo = true; G.story?.onTalkTo?.(npc.def.id); });
      return;
    }
    // mostra falas + tela de escolhas
    this._pendingNpc = { npc, choices, onEnd: () => { npc.talkedTo = true; G.story?.onTalkTo?.(npc.def.id); } };
    this.startDialog(withChoices, npc, () => {
      const el = openModal(`
        <div class="dialog-name">${npc.name}</div>
        <div class="dialog-text">O que você gostaria de fazer?</div>
        <div class="dialog-choices">${choices.map((c, i) => `<button data-i="${i}">${c.label}</button>`).join('')}
        <button data-i="-1">Falar mais tarde</button></div>
      `);
      el.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const i = parseInt(btn.dataset.i);
          closeModal();
          if (i >= 0) this._handleChoice(this._pendingNpc.choices[i].action);
          this._pendingNpc?.onEnd?.();
        };
      });
    });
  }

  _handleChoice(action) {
    switch (action) {
      case 'shop': this.openShop(); break;
      case 'quest_teste': G.quests.offer('main_teste'); G.hud?.hint('Missão aceita: vá ao castelo de Aurelia ao norte!'); break;
      case 'quest_herbs':
        if (G.inventory.count('erva') >= 3) {
          G.inventory.removeItem('erva', 3);
          G.quests.onObjectiveFlag('herbs', 'herbs');
          if (!G.quests.activeIds.includes('herbs')) { G.quests.activeIds.push('herbs'); G.quests.progress.herbs = { herbs: 3 }; G.quests.complete('herbs'); }
        } else {
          G.quests.offer('herbs');
          G.hud?.hint('Traga 3 Ervas Medicinais para a sacerdotisa.');
        }
        break;
      case 'quest_hunt': G.quests.offer('hunt_goblins'); break;
      case 'quest_explore': G.quests.offer('explore_all'); break;
      case 'quest_grimoire': G.story?.giveGrimoire(); break;
    }
  }

  // ---------- loja ----------
  openShop() {
    const stock = ['pocao_vida', 'pocao_mana', 'espada_aco', 'armadura_malha', 'capacete_couro', 'luvas_couro', 'botas_viajante', 'pergaminho_energia', 'amuleto_poder'];
    const buyStock = G.chapter >= 4 ? [...stock, 'espada_runa', 'pocao_elixir', 'armadura_placas', 'botas_vento', 'capacete_aço'] : stock;
    let el = openModal(`
      <h2>🛒 LOJA</h2>
      <p style="text-align:center;color:var(--text-dim)">Ouro: <b style="color:var(--gold)" id="shop-gold">${G.gold}</b> 🪙</p>
      <div id="shop-list" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px">
        ${buyStock.map(id => {
          const it = ITEMS[id];
          return `<button data-buy="${id}" style="text-align:left;padding:10px;background:#171009;border:1px solid #3a2c18;color:var(--text);border-radius:8px">
            ${it.icon} <b style="color:${RARITIES[it.rarity].color}">${it.name}</b><br>
            <span style="font-size:12px;color:var(--text-dim)">${it.price} 🪙 — ${it.desc}</span></button>`;
        }).join('')}
      </div>
      <h2 style="margin-top:18px">Seus itens (vender)</h2>
      <div id="sell-list" style="display:flex;flex-wrap:wrap;gap:8px"></div>
    `);
    bindClose(el);
    const renderSell = () => {
      const list = el.querySelector('#sell-list');
      list.innerHTML = G.inventory_list.map((it, i) => {
        const def = itemById(it.id);
        if (!def || def.price === 0) return '';
        return `<button data-sell="${i}" style="padding:8px;background:#171009;border:1px solid #3a2c18;color:${RARITIES[def.rarity].color};border-radius:8px;font-size:13px">${def.icon} ${def.name}${it.qty > 1 ? ` ×${it.qty}` : ''} → ${Math.floor(def.price * 0.5)}🪙</button>`;
      }).join('') || '<span style="color:var(--text-dim);font-size:13px">Nada para vender.</span>';
      list.querySelectorAll('button[data-sell]').forEach(b => {
        b.onclick = () => { G.inventory.sell(G.inventory_list[parseInt(b.dataset.sell)].id); el.querySelector('#shop-gold').textContent = G.gold; renderSell(); };
      });
    };
    renderSell();
    el.querySelectorAll('button[data-buy]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.buy;
        const def = ITEMS[id];
        if (G.gold < def.price) { G.hud?.toast('🪙 Ouro insuficiente!'); return; }
        G.gold -= def.price;
        G.inventory.addItem(id, 1);
        el.querySelector('#shop-gold').textContent = G.gold;
        audio.sfx('coin');
      };
    });
  }

  // ---------- inventário ----------
  openInventory() {
    const tabs = [
      ['all', 'Tudo'], ['weapon', 'Armas'], ['armor', 'Armaduras'], ['accessory', 'Acessórios'],
      ['consumable', 'Consumíveis'], ['material', 'Materiais'], ['quest', 'Missão'], ['book', 'Livros'],
    ];
    let el = openModal(`
      <h2>🎒 INVENTÁRIO</h2>
      <div class="inv-tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === 'all' ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="inv-grid" id="inv-grid"></div>
      <div class="inv-detail" id="inv-detail">Selecione um item.</div>
      <h2 style="margin-top:14px">Equipamentos</h2>
      <div id="eq-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    `);
    bindClose(el);
    const render = () => {
      const grid = el.querySelector('#inv-grid');
      const curTab = el.querySelector('.inv-tabs .on')?.dataset.tab || 'all';
      grid.innerHTML = '';
      G.inventory_list.forEach((it, i) => {
        const def = itemById(it.id);
        if (!def) return;
        if (curTab !== 'all' && def.type !== curTab) return;
        const slot = document.createElement('div');
        slot.className = `inv-slot rarity-${def.rarity}`;
        slot.innerHTML = `${def.icon}${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ''}`;
        slot.title = def.name;
        slot.onclick = () => showDetail(i);
        grid.appendChild(slot);
      });
      if (grid.children.length === 0) grid.innerHTML = '<div style="color:var(--text-dim);font-size:13px;grid-column:span 8">Vazio.</div>';
      // equipamentos
      const eqList = el.querySelector('#eq-list');
      const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'cape', 'accessory'];
      eqList.innerHTML = slots.map(s => {
        const cur = G.equipment[s];
        return `<button data-uneq="${s}" style="padding:6px 10px;background:#171009;border:1px solid #3a2c18;color:var(--text);border-radius:6px;font-size:12px">
          ${cur ? `${cur.icon} ${cur.name}` : `${s}: vazio`}</button>`;
      }).join('');
      eqList.querySelectorAll('button').forEach(b => {
        b.onclick = () => { G.inventory.unequip(b.dataset.uneq); render(); };
      });
    };
    const showDetail = (i) => {
      const it = G.inventory_list[i];
      if (!it) return;
      const def = itemById(it.id);
      const rar = RARITIES[def.rarity];
      let btns = '';
      if (['weapon', 'armor', 'accessory'].includes(def.type)) btns += `<button id="inv-equip">Equipar</button>`;
      if (def.type === 'consumable') btns += `<button id="inv-use">Usar</button>`;
      if (def.price > 0) btns += `<button id="inv-sell">Vender (${Math.floor(def.price * 0.5)}🪙)</button>`;
      el.querySelector('#inv-detail').innerHTML = `
        <h3>${def.icon} ${def.name} <span class="rar" style="color:${rar.color}">[${rar.name}]</span></h3>
        <p>${def.desc}</p>
        ${def.dmg ? `<p>⚔️ Dano: ${def.dmg}</p>` : ''}${def.def ? `<p>🛡️ Defesa: ${def.def}</p>` : ''}
        <div>${btns}</div>`;
      el.querySelector('#inv-equip')?.addEventListener('click', () => { G.inventory.equip(it.id); render(); });
      el.querySelector('#inv-use')?.addEventListener('click', () => { G.inventory.useItem(it.id); render(); });
      el.querySelector('#inv-sell')?.addEventListener('click', () => { G.inventory.sell(it.id); render(); });
    };
    el.querySelectorAll('.inv-tabs button').forEach(b => {
      b.onclick = () => {
        el.querySelectorAll('.inv-tabs button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        render();
      };
    });
    render();
  }

  // ---------- atributos / level up ----------
  openAttributes() {
    const attrs = [
      ['forca', 'Força', 'dano físico'], ['defesa', 'Defesa', 'reduz dano'],
      ['velocidade', 'Velocidade', 'movimento'], ['mana', 'Mana', 'custo e regen'],
      ['poder', 'Poder Mágico', 'dano de magia'], ['resistencia', 'Resistência', 'stamina e status'],
      ['critico', 'Crítico', 'chance de crítico'],
    ];
    let el = openModal(`
      <h2>📊 ATRIBUTOS — Nível ${G.level}</h2>
      <p style="text-align:center;color:var(--gold)">Pontos disponíveis: <b id="pts">${G.attrPoints}</b></p>
      <div id="attr-list">${attrs.map(([k, n, d]) => `
        <div class="row" data-attr="${k}">
          <label>${n} <span style="font-size:11px;color:var(--text-dim)">(${d})</span></label>
          <div style="display:flex;align-items:center;gap:10px">
            <b id="av-${k}">${G.attributes[k]}</b>
            <button data-attr="${k}" style="padding:4px 14px;background:#2c2216;color:var(--gold);border:1px solid var(--panel-border);border-radius:6px" ${G.attrPoints <= 0 ? 'disabled' : ''}>+</button>
          </div>
        </div>`).join('')}</div>
    `);
    bindClose(el);
    el.querySelectorAll('button[data-attr]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.attr;
        if (G.attrPoints <= 0) return;
        G.attributes[k]++;
        G.attrPoints--;
        G.recalcStats?.();
        el.querySelector('#pts').textContent = G.attrPoints;
        el.querySelector(`#av-${k}`).textContent = G.attributes[k];
        audio.sfx('levelup');
      };
    });
  }

  // ---------- grimório UI ----------
  openGrimoire() {
    if (!G.element) return;
    const elDef = ELEMENTS[G.element];
    const spells = allSpellDefs(G.element);
    let el = openModal(`
      <h2 style="color:${elDef.colorCss}">📖 GRIMÓRIO — ${elDef.icon} ${elDef.name}</h2>
      <p style="text-align:center;font-style:italic;color:var(--text-dim);font-size:13px">"${elDef.desc}"</p>
      <div class="grim-grid">
        ${spells.map((s, i) => {
          const known = G.spells[s.id];
          const lvl = known?.level || 0;
          return `<div class="grim-spell ${known ? '' : 'locked'}" data-slot="${i + 1}">
            <h4>${s.icon} ${s.name} <span class="lvl">${known ? `Nv ${lvl}` : `🔒 Nv ${s.unlock}`}</span></h4>
            <div class="stats">
              ⚔️ Dano: ${s.dmg} × (1+${((lvl - 1) * 0.25).toFixed(2)}) <br>
              💧 Mana: ${s.mana} · ⏱️ CD: ${s.cd}s ${s.radius ? `· 🌀 Área: ${s.radius}m` : ''}
            </div>
            <p style="font-size:12px;color:var(--text-dim);margin-top:5px">${known ? s.desc : `Desbloqueia no nível ${s.unlock}.`}</p>
          </div>`;
        }).join('')}
      </div>
      <p style="margin-top:12px;font-size:12px;color:var(--text-dim);text-align:center">Grimório nível ${G.grimoireLevel} — cada magia evolui com o uso (25 usos = +1 nível, máx 5). Use as teclas 1–4 na hotbar.</p>
    `);
    bindClose(el);
    el.querySelectorAll('.grim-spell:not(.locked)').forEach(d => {
      d.onclick = () => {
        const slot = parseInt(d.dataset.slot);
        closeModal();
        G.grimoire.uiOpen = false;
        G.grimoire.targetOpen = 0;
        G.magic?.castSlot(slot);
      };
    });
  }
  closeGrimoire() { if (modal() && !modal().classList.contains('hidden')) { closeModal(); } }

  // ---------- mapa ----------
  openMap() {
    this.mapOpen = true;
    let el = openModal(`
      <h2>🗺️ MAPA DE AETHERIA</h2>
      <canvas id="world-map-canvas" width="640" height="640"></canvas>
      <div class="map-legend">
        <span>⬜ Vila</span><span>🏛️ Cidade</span><span>🌲 Floresta</span><span>⛰️ Montanhas</span>
        <span>🌋 Vulcão</span><span>❄️ Gelo</span><span>🕳️ Caverna</span><span>💀 Ruínas</span>
        <span style="color:#ffd23a">◆ descoberto</span><span style="color:#555">· não descoberto</span>
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-top:6px">Clique em uma região <b>descoberta</b> para viajar rápido. (1 viagem = 30🪙)</p>
    `);
    bindClose(el);
    el.addEventListener('click', (e) => { if (e.target === el) this.mapOpen = false; });
    const canvas = el.querySelector('#world-map-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const toX = (x) => (x + 500) / 1000 * W;
    const toY = (z) => (z + 500) / 1000 * W;
    const draw = () => {
      // fundo
      ctx.fillStyle = '#0b0d0a';
      ctx.fillRect(0, 0, W, W);
      // relevo simplificado
      ctx.fillStyle = '#1a2a14';
      for (let gx = 0; gx < 32; gx++) for (let gz = 0; gz < 32; gz++) {
        const wx = gx / 32 * 1000 - 500, wz = gz / 32 * 1000 - 500;
        const h = G.world.height(wx, wz);
        if (h < 0.55) { ctx.fillStyle = '#1a3a5a'; ctx.fillRect(gx * 20, gz * 20, 20, 20); }
        else if (h > 20) { ctx.fillStyle = '#3a3a42'; ctx.fillRect(gx * 20, gz * 20, 20, 20); }
        else if (h > 10) { ctx.fillStyle = '#26301c'; ctx.fillRect(gx * 20, gz * 20, 20, 20); }
      }
      // estradas
      ctx.strokeStyle = '#8a7150'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(toX(0), toY(0)); ctx.lineTo(toX(0), toY(-260)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(30), toY(30)); ctx.lineTo(toX(230), toY(60)); ctx.stroke();
      // regiões
      ctx.font = 'bold 13px Georgia';
      for (const r of REGIONS) {
        const disc = G.discovered.includes(r.id);
        const icons = { vila: '⌂', cidade: '🏛️', floresta: '🌲', lago: '🌊', montanhas: '⛰️', vulcao: '🌋', congelado: '❄️', pantano: '🐊', goblins: '👹', ruinas: '💀', caverna: '🕳️' };
        ctx.fillStyle = disc ? '#ffd23a' : '#3a3a35';
        ctx.fillText(icons[r.id] || '◆', toX(r.x) - 8, toY(r.z) + 5);
        if (disc) {
          ctx.fillStyle = '#cfc4a0';
          ctx.font = '10px Georgia';
          ctx.fillText(r.name, toX(r.x) - 30, toY(r.z) + 20);
          ctx.font = 'bold 13px Georgia';
        }
      }
      // player
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(toX(G.player.root.position.x), toY(G.player.root.position.z), 5, 0, Math.PI * 2); ctx.fill();
    };
    draw();
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W;
      const my = (e.clientY - rect.top) / rect.height * W;
      for (const r of REGIONS) {
        if (!G.discovered.includes(r.id)) continue;
        if (Math.hypot(toX(r.x) - mx, toY(r.z) - my) < 24) {
          if (r.id === 'vila') { closeModal(); this.mapOpen = false; G.story?.fastTravel?.(0, 0); return; }
          if (G.gold < 30) { G.hud?.toast('🪙 Viagem custa 30 de ouro.'); return; }
          G.gold -= 30;
          closeModal();
          this.mapOpen = false;
          G.story?.fastTravel?.(r.x, r.z + 20);
          G.hud?.updateAll?.();
          return;
        }
      }
    };
  }

  // ---------- pausa / settings ----------
  openPause() {
    const el = openModal(`
      <h2>⏸️ JOGO PAUSADO</h2>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
        <button id="p-continue" style="padding:10px 40px;background:#2c2216;color:var(--gold);border:1px solid var(--panel-border);border-radius:8px">▶ Continuar</button>
        <button id="p-inv" style="padding:10px 40px;background:#2c2216;color:var(--text);border:1px solid var(--panel-border);border-radius:8px">🎒 Inventário</button>
        <button id="p-attr" style="padding:10px 40px;background:#2c2216;color:var(--text);border:1px solid var(--panel-border);border-radius:8px">📊 Atributos${G.attrPoints > 0 ? ` (${G.attrPoints}!)` : ''}</button>
        <button id="p-settings" style="padding:10px 40px;background:#2c2216;color:var(--text);border:1px solid var(--panel-border);border-radius:8px">⚙️ Configurações</button>
        <button id="p-save" style="padding:10px 40px;background:#2c2216;color:var(--text);border:1px solid var(--panel-border);border-radius:8px">💾 Salvar</button>
        <button id="p-menu" style="padding:10px 40px;background:#2c2216;color:#e77;border:1px solid var(--panel-border);border-radius:8px">🚪 Menu Principal</button>
      </div>
      <p style="text-align:center;margin-top:14px;color:var(--text-dim);font-size:13px">Tempo de jogo: ${fmtTime(G.playtime / 60)} min · Capítulo ${G.chapter}</p>
    `);
    bindClose(el);
    el.querySelector('#p-continue').onclick = () => closeModal();
    el.querySelector('#p-inv').onclick = () => { closeModal(); this.openInventory(); };
    el.querySelector('#p-attr').onclick = () => { closeModal(); this.openAttributes(); };
    el.querySelector('#p-settings').onclick = () => { this.openSettings(); };
    el.querySelector('#p-save').onclick = () => { G.saveNow?.(); G.hud?.toast('💾 Jogo salvo!', true); };
    el.querySelector('#p-menu').onclick = () => { closeModal(); G.backToMenu?.(); };
  }

  openSettings() {
    const el = openModal(`
      <h2>⚙️ CONFIGURAÇÕES</h2>
      <div class="row"><label>Sensibilidade da câmera</label><input type="range" id="s-sens" min="0.2" max="2.5" step="0.1" value="${settings.camSensitivity}"></div>
      <div class="row"><label>Distância da câmera</label><input type="range" id="s-dist" min="3" max="14" step="0.5" value="${settings.camDistance}"></div>
      <div class="row"><label>Distância mín.</label><input type="range" id="s-min" min="2" max="6" step="0.5" value="${settings.camMinDist}"></div>
      <div class="row"><label>Distância máx.</label><input type="range" id="s-max" min="8" max="20" step="1" value="${settings.camMaxDist}"></div>
      <div class="row"><label>Inverter vertical</label><select id="s-invy"><option value="0" ${!settings.camInvertY ? 'selected' : ''}>Não</option><option value="1" ${settings.camInvertY ? 'selected' : ''}>Sim</option></select></div>
      <div class="row"><label>Sombras</label><select id="s-shadow"><option value="1" ${settings.shadows ? 'selected' : ''}>Ligado</option><option value="0" ${!settings.shadows ? 'selected' : ''}>Desligado</option></select></div>
      <div class="row"><label>Partículas</label><input type="range" id="s-part" min="0.2" max="1.5" step="0.1" value="${settings.particles}"></div>
      <div class="row"><label>Neblina</label><input type="range" id="s-fog" min="0.4" max="2" step="0.1" value="${settings.fogDensity}"></div>
      <div class="row"><label>Volume geral</label><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${settings.masterVolume}"></div>
      <div class="row"><label>Música</label><input type="range" id="s-mus" min="0" max="1" step="0.05" value="${settings.musicVolume}"></div>
      <div class="row"><label>Efeitos sonoros</label><input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${settings.sfxVolume}"></div>
      <div class="row"><label>Mostrar dano</label><select id="s-dmg"><option value="1" ${settings.showDamage ? 'selected' : ''}>Sim</option><option value="0" ${!settings.showDamage ? 'selected' : ''}>Não</option></select></div>
      <button class="close-btn" id="s-done">Salvar e fechar</button>
    `);
    bindClose(el);
    const upd = (id, key, num = true) => {
      const input = el.querySelector(id);
      input.oninput = () => { settings[key] = num ? parseFloat(input.value) : input.value === '1'; };
    };
    upd('#s-sens', 'camSensitivity'); upd('#s-dist', 'camDistance'); upd('#s-min', 'camMinDist'); upd('#s-max', 'camMaxDist');
    el.querySelector('#s-invy').onchange = (e) => { settings.camInvertY = e.target.value === '1'; };
    el.querySelector('#s-shadow').onchange = (e) => { settings.shadows = e.target.value === '1'; G.applyQuality?.(); };
    upd('#s-part', 'particles'); upd('#s-fog', 'fogDensity');
    upd('#s-vol', 'masterVolume'); upd('#s-mus', 'musicVolume'); upd('#s-sfx', 'sfxVolume');
    el.querySelector('#s-dmg').onchange = (e) => { settings.showDamage = e.target.value === '1'; G.showDamage = settings.showDamage; };
    el.querySelector('#s-done').onclick = () => {
      saveSettings();
      G.applyQuality?.();
      audio.applyVolumes?.();
      closeModal();
    };
  }
}

export { Panels, closeModal, openModal };
