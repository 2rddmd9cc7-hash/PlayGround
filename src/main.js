/* ============================================================
   CRÔNICAS DE AETHERIA — bootstrap e loop principal.
   ============================================================ */
import './style.css'
import * as THREE from 'three'
import { G, clamp, randInt, rand, storeGet, storeSet } from './state.js'
import { initInput, Input, mouse, touch } from './input.js'
import { initAudio, setMusic, sfx, applyVolumes } from './audio.js'
import { initEngine, updateEnvironment, renderer } from './engine.js'
import { initEffects, updateEffects } from './effects.js'
import { buildWorld, updateWorld, heightAt, groundAt, regionAt, chests, getCrystal, CASTLE_HALL, VILLAGE, CITY } from './world.js'
import { createPlayer, updatePlayer, gainXp } from './player.js'
import { createCameraRig, updateCamera } from './camera.js'
import { createGrimoire } from './grimoire.js'
import { createInventory } from './inventory.js'
import { createQuests } from './quests.js'
import { createStory } from './story.js'
import { createAllNpcs, updateNpcs, nearestNpc, npcs } from './npcs.js'
import { createSave } from './save.js'
import { createUI } from './ui.js'
import { spawnCampGuards, updateEnemies, clearEnemies, enemies, spawnEnemy } from './enemies.js'
import { updateCombat } from './combat.js'
import { updateMagic, castSpell, clearProjectiles } from './magic.js'
import { ELEMENTS } from './elements.js'
import { damageEnemy } from './enemies.js'

let ui, story, quests, saveApi, grimoire
let last = performance.now()
let started = false
let menuOrbit = 0

function fail(msg) {
  console.error(msg)
  try { if (G.uiApi) G.uiApi.showError(msg) } catch { document.getElementById('err-screen')?.classList.remove('hidden') }
}

window.addEventListener('error', (e) => {
  if (!e.message) return
  if (started) fail(`Erro inesperado: ${e.message}`)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason)
})

// exposto para depuração e testes automatizados
if (typeof window !== 'undefined') window.__AETHERIA__ = G

async function boot() {
  const progress = (pct, msg) => {
    if (ui) ui.setProgress(pct, msg)
    else {
      const el = document.getElementById('load-fill')
      if (el) el.style.width = `${pct}%`
      if (msg) document.getElementById('load-msg').textContent = msg
    }
  }
  const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

  try {
    // ---- verificação de capacidades ----
    const canvas = document.getElementById('game-canvas')
    if (!canvas) throw new Error('Canvas do jogo não encontrado.')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) throw new Error('Seu navegador não suporta WebGL. Ative a aceleração de hardware.')
    progress(8, 'Despertando o motor 3D…')

    initInput(canvas)
    initEngine(canvas)
    G.canvas = canvas
    G.clock = new THREE.Clock()
    progress(18, 'Tecendo os céus…')
    await tick()

    G.clouds = []
    G.npcs = []
    initEffects(G.scene)
    G.worldApi = { heightAt, groundAt, resolveCircle: undefined, pois: null }
    progress(28, 'Erguendo montanhas e florestas…')
    buildWorld()
    progress(48, 'Construindo a vila e o castelo…')
    await tick()

    createPlayer(G.scene)
    createCameraRig()
    createGrimoire()
    createInventory()
    quests = createQuests()
    story = createStory()
    story.init()
    progress(62, 'Trazendo os moradores à vida…')
    createAllNpcs()
    G.npcs = npcs
    spawnCampGuards()
    G.enemies = enemies
    progress(72, 'Preparando grimórios e encantamentos…')
    await tick()

    saveApi = createSave()
    ui = createUI({
      onNewGame: startNewGame,
      onContinue: continueGame,
      onQuitToMenu: quitToMenu,
      onMenuBack: () => { if (G.story.phase === 'menu') ui.showMainMenu() },
    })
    progress(88, 'Acendendo tochas…')

    // posição inicial
    const p = G.player
    p.pos.set(0, groundAt(0, 12), 12)
    p.yaw = Math.PI
    p.cds = [0, 0, 0, 0]
    p.spellsUnlocked = 1
    p.weaponDmg = 0
    p.armorDef = 0
    G.camera.position.set(14, 14, 26)
    G.camera.lookAt(0, 3, 0)
    G.cameraRig.yaw = Math.PI * 0.72

    ui.hideLoading()
    ui.showMainMenu()
    G.story.phase = 'menu'
    G.paused = true
    setMusic('menu')

    // áudio só inicia após gesto do usuário
    const startAudio = () => {
      initAudio()
      applyVolumes()
      window.removeEventListener('pointerdown', startAudio)
      window.removeEventListener('keydown', startAudio)
    }
    window.addEventListener('pointerdown', startAudio)
    window.addEventListener('keydown', startAudio)

    // mobile
    if (touch.active) {
      ui.setTouchVisible(true)
      document.getElementById('minimap').style.width = '100px'
      document.getElementById('minimap').style.height = '100px'
    }

    started = true
    progress(100, 'Pronto.')
    last = performance.now()
    // API de depuração/teste (não afeta a jogabilidade)
    window.__AETHERIA_TEST__ = {
      spawnEnemy, damageEnemy, castSpell, enemies, quests, story, saveApi, gainXp,
      teleport(x, z) {
        const p = G.player
        p.pos.x = x; p.pos.z = z
        p.pos.y = G.worldApi.heightAt(x, z)
        p.vy = 0
        G.cameraRig.pos.set(x + 4, p.pos.y + 4, z + 6)
      },
      interact() { const t = interactable(); if (t) doInteract(t) },
      tick(n = 1) { for (let i = 0; i < n; i++) { story.update(0.05); quests.update(0.05) } },
    }
    requestAnimationFrame(frame)
  } catch (err) {
    console.error(err)
    const msg = err && err.message ? err.message : 'Falha ao iniciar o jogo.'
    const es = document.getElementById('err-screen')
    if (es) {
      es.classList.remove('hidden')
      document.getElementById('err-msg').textContent = msg
      document.getElementById('err-reload').onclick = () => location.reload()
    }
    document.getElementById('loading')?.classList.add('hidden')
  }
}

/* ============================================================
   Fluxo de jogo
   ============================================================ */
function resetPlayerForNewGame() {
  const p = G.player
  Object.assign(p, {
    hp: 100, maxHp: 100, mp: 60, maxMp: 60, st: 100, maxSt: 100,
    level: 1, xp: 0, gold: 25, element: null,
    str: 10, def: 5, mag: 10, crit: 5,
    spellsUnlocked: 1, weaponDmg: 0, armorDef: 0,
    dead: false, vy: 0, grounded: true, invuln: 2,
    attackType: null, castPhase: 0, dodgeT: 0, staggered: 0, blocking: false,
    cds: [0, 0, 0, 0],
  })
  p.pos.set(0, groundAt(0, 12), 12)
  p.yaw = Math.PI
  p.rig.rotation.x = 0
  p.rig.visible = true
  G.cameraRig.yaw = Math.PI * 0.75
  G.cameraRig.pitch = 0.24
  G.cameraRig.targetDist = 5.2
}

function clearWorldEntities() {
  clearEnemies()
  clearProjectiles()
  for (const c of chests) c.opened = false
  if (G.grimoireApi?.group) { G.scene.remove(G.grimoireApi.group); G.grimoireApi.group = null; G.grimoireApi.pages = null }
  if (G.grimoireApi) { G.grimoireApi.granted = false; G.grimoireApi.pageT = 0 }
  G.grimoireOpen = false
}

function startNewGame() {
  clearWorldEntities()
  resetPlayerForNewGame()
  quests.active = []; quests.done = []; quests.progress = {}; quests.tracked = null
  G.inventory.items = []; G.inventory.equipped = { weapon: null, armor: null }
  G.hour = 8.5; G.day = 1
  G.discovered = new Set(['Vila de Pedravale'])
  story.invasionStarted = false
  story.endHandled = false
  story.chosen = null
  story.granted = false
  story.wave = null
  story.pending = []
  story.cineActive = false
  story.hints = []
  G.story.chapter = 1
  G.story.phase = 'village'
  G.story.flags = { invasion: false, grimoire: false, worldOpen: false }
  G.storyApi.talkTo = G.storyApi.talkTo
  ui.closeScreen()
  ui.showHud()
  ui.setElementUI()
  $clearElement()
  ui.refreshHotbar()
  ui.refreshTracker()
  G.paused = false
  G.story.phase = 'village'
  story.startNewGame()
  spawnCampGuards()
  saveApi.autoT = 30
  if (G.saveApi) G.saveApi.save()
}

function $clearElement() {
  const chip = document.getElementById('element-chip')
  if (chip) chip.classList.add('hidden')
}

function continueGame() {
  if (!saveApi.load()) { ui.toast('Nenhum salvamento encontrado.', 'gold'); return }
  clearWorldEntities()
  spawnCampGuards()
  ui.closeScreen()
  ui.showHud()
  ui.setElementUI()
  ui.refreshHotbar()
  ui.refreshTracker()
  G.paused = false
  if (!G.story.phase || G.story.phase === 'menu') G.story.phase = 'village'
  if (G.story.flags.invasion) story.invasionStarted = true
  if (G.player.element && !G.grimoireApi.granted) G.grimoireApi.grant()
  const reg = regionAt(G.player.pos.x, G.player.pos.z)
  G.region = reg
  ui.setRegion(reg)
  setMusic(reg === 'Vila de Pedravale' ? 'village' : reg === 'Corvoalta' ? 'city' : 'explore')
  if (G.story.phase === 'invasion' && G.storyApi.wave === null) story.startInvasion()
  ui.toast('Jogo carregado.', 'xp')
}

function quitToMenu() {
  saveApi.save()
  G.paused = true
  G.story.phase = 'menu'
  clearProjectiles()
  ui.showMainMenu()
  setMusic('menu')
}

/* ============================================================
   Interações
   ============================================================ */
function interactable() {
  const p = G.player
  if (!p || p.dead) return null
  const crystal = getCrystal()
  const dc = Math.hypot(p.pos.x - CASTLE_HALL.x, p.pos.z - CASTLE_HALL.z)
  if (dc < 3.6) {
    if (!p.element) return { type: 'crystal', text: '[E] Colocar a mão sobre o cristal' }
    return { type: 'crystal', text: '[E] Tocar o cristal' }
  }
  for (const c of chests) {
    if (c.opened) continue
    if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 2.4) return { type: 'chest', chest: c, text: '[E] Abrir baú' }
  }
  const n = nearestNpc(p.pos.x, p.pos.z, 2.9)
  if (n) return { type: 'npc', npc: n, text: `[E] Falar com ${n.name}` }
  return null
}

function doInteract(target) {
  if (!target) return
  if (target.type === 'crystal') {
    story.tryCrystal(G.player)
  } else if (target.type === 'npc') {
    story.talkTo(target.npc)
  } else if (target.type === 'chest') {
    openChest(target.chest)
  }
}

function openChest(c) {
  if (c.opened) return
  c.opened = true
  sfx('chest')
  burst('magic', c.x, c.pos.y + 0.6, c.z, 1.2)
  const p = G.player
  if (c.loot === 'gold') {
    const amount = randInt(35, 90)
    p.gold += amount
    ui.toast(`Baú: +${amount} ◈`, 'gold')
  } else if (c.loot === 'potion') {
    G.inventory.add({ name: 'poção de vida', kind: 'potion', rarity: 'Incomum', icon: '🧪', qty: 1 })
    ui.toast('Baú: Poção de Vida (Incomum)', 'gold')
  } else {
    const rar = Math.random() < 0.5 ? 'Raro' : 'Épico'
    G.inventory.add({ name: rar === 'Épico' ? 'Lâmina de Aether' : 'Espada do Cruzado', kind: 'weapon', rarity: rar, icon: '🗡️', qty: 1 })
    ui.toast(`Baú: Arma ${rar}!`, 'gold')
  }
  ui.refreshHotbar()
  if (G.quests && Math.hypot(c.x + 45, c.z - 158) < 30) quests.complete('ruins')
  if (G.saveApi) G.saveApi.save()
}

/* ============================================================
   Loop
   ============================================================ */
function frame(now) {
  requestAnimationFrame(frame)
  try {
    const rawDt = clamp((now - last) / 1000, 0, 0.05)
    last = now
    if (!started) return

    const inMenu = G.story.phase === 'menu'
    let dt = rawDt
    if (G.hitstop > 0) { G.hitstop -= rawDt; dt = rawDt * 0.08 }
    dt *= G.timeScale
    const envDt = inMenu ? rawDt : dt

    updateEnvironment(envDt)
    updateWorld(envDt, now / 1000)
    updateEffects(envDt)

    const p = G.player

    if (inMenu) {
      // câmera orbital de fundo
      menuOrbit += rawDt * 0.06
      const r = 26
      G.camera.position.set(Math.cos(menuOrbit) * r, 11 + Math.sin(menuOrbit * 0.8) * 2, Math.sin(menuOrbit) * r + 8)
      G.camera.lookAt(0, 3, 0)
      p.rig.visible = false
    } else {
      p.rig.visible = true
      if (!G.paused) {
        if (!story.cineActive) updateCamera(G.cameraRig, dt)
        updatePlayer(p, dt)
        updateCombat(p, dt)
        updateMagic(p, dt)
        updateEnemies(dt)
        updateNpcs(dt)
        G.grimoireApi.update(dt)
        story.update(dt)
        quests.update(dt)
        saveApi.update(dt)
        checkProgression(p)
        // prompt de interação
        if (!ui.isBlocking() && !ui.isDialogOpen()) {
          const target = interactable()
          if (target) { ui.setPrompt(target.text); G.interactTarget = target }
          else { ui.setPrompt(null); G.interactTarget = null }
        } else { ui.setPrompt(null); G.interactTarget = null }
        // região
        const reg = regionAt(p.pos.x, p.pos.z)
        if (reg !== G.region) G.region = reg
      } else if (story.cineActive) {
        story.update(dt)
        G.grimoireApi.update(dt)
      }
      ui.updateHud(p, rawDt)
    }

    // teclas globais
    handleKeys()

    renderer.render(G.scene, G.camera)
    Input.endFrame()
  } catch (err) {
    console.error(err)
    if (started) {
      started = false
      fail(`Erro durante o jogo: ${err.message}`)
    }
  }
}

function handleKeys() {
  if (G.story.phase === 'menu') return
  if (Input.pressed('Escape')) { ui.togglePause(); return }
  if (Input.pressed('KeyE')) {
    if (ui.isDialogOpen()) { ui.advanceDialog(); return }
    if (!ui.isBlocking()) {
      const t = G.interactTarget || interactable()
      if (t) doInteract(t)
    }
    return
  }
  if (Input.pressed('KeyG')) {
    if (ui.isBlocking() && G.grimoireOpen) { ui.closeGrimoire(); return }
    if (!ui.isBlocking()) grimoire.toggle()
    return
  }
  if (Input.pressed('KeyI')) { if (!G.grimoireOpen) ui.toggleInventory(); return }
  if (Input.pressed('KeyM')) { if (!G.grimoireOpen) ui.toggleMap(); return }
}

/* progressão de missões por posição */
let progT = 0
function checkProgression(p) {
  progT -= 0.1
  if (progT > 0) return
  progT = 0.25
  if (quests.active.some((a) => a.id === 'test')) {
    if (Math.hypot(p.pos.x - CASTLE_HALL.x, p.pos.z - CASTLE_HALL.z) < 15) {
      quests.complete('test')
      quests.add('crystal')
      G.story.phase = 'atCastle'
      ui.showHint('O cristal aguarda no centro do salão. Aproxime-se e pressione E.', 6)
    }
  }
  if (quests.active.some((a) => a.id === 'grimoire') && G.grimoireOpen) {
    quests.complete('grimoire')
    G.story.flags.grimoire = true
  }
}

/* ============================================================
   Início (com fallback de erro amigável)
   ============================================================ */
boot().catch((err) => {
  console.error(err)
  document.getElementById('loading')?.classList.add('hidden')
  const es = document.getElementById('err-screen')
  if (es) {
    es.classList.remove('hidden')
    document.getElementById('err-msg').textContent = err.message || 'Falha ao iniciar.'
    document.getElementById('err-reload').onclick = () => location.reload()
  }
})
