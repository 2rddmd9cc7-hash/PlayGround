/* ============================================================
   Missões — cadeia principal + secundárias, rastreio e recompensas.
   ============================================================ */
import { G } from './state.js'
import { sfx } from './audio.js'
import { VILLAGE, CITY, CASTLE_HALL, LAKE, RUINS, CAMPS } from './world.js'

const QUESTS = {
  village: {
    title: 'O Chamado do Ancião', obj: 'Fale com o Ancião Oran na praça da vila',
    target: () => ({ x: -2, z: -8 }), chapter: 1, reward: { xp: 20, gold: 10 },
    hint: 'Use W A S D para andar e o botão direito do mouse para girar a câmera.',
  },
  test: {
    title: 'O Teste do Poder', obj: 'Dirija-se ao Grande Salão do castelo em Corvoalta',
    target: () => ({ x: CASTLE_HALL.x, z: CASTLE_HALL.z + 10 }), chapter: 2, reward: { xp: 40, gold: 25 },
    hint: 'Siga a estrada a leste. Atravesse a ponte sobre o rio.',
  },
  crystal: {
    title: 'O Cristal Aguarda', obj: 'Aproxime-se do cristal e pressione E',
    target: () => ({ x: CASTLE_HALL.x, z: CASTLE_HALL.z }), chapter: 2, reward: { xp: 0 },
    hint: 'Coloque sua mão sobre o cristal.',
  },
  invasion: {
    title: 'A Invasão de Corvoalta', obj: 'Sobreviva às ondas de goblins',
    target: () => ({ x: CASTLE_HALL.x, z: CASTLE_HALL.z + 14 }), chapter: 3, reward: { xp: 120, gold: 70 },
    hint: 'Clique esquerdo ataca · Espaço esquiva · 1-4 conjuram magias.',
  },
  grimoire: {
    title: 'O Primeiro Grimório', obj: 'Pressione G para abrir seu grimório',
    target: null, chapter: 4, reward: { xp: 30, gold: 0 },
    hint: 'Seu grimório flutua ao seu lado. Pressione G.',
  },
  hunt: {
    title: 'Caçada nos Campos', obj: 'Derrote 12 goblins pelo mundo',
    target: () => CAMPS[0], chapter: 5, reward: { xp: 90, gold: 50 }, counter: 12,
    hint: 'Acampamentos goblins aparecem no minimapa (⚔).',
  },
  camps: {
    title: 'Três Fogueiras', obj: 'Elimine 9 goblins em acampamentos',
    target: () => CAMPS[1], chapter: 5, reward: { xp: 120, gold: 70 }, counter: 9,
    hint: 'Há três acampamentos marcados no mapa.',
  },
  ruins: {
    title: 'Segredos de Vhalor', obj: 'Explore as Ruínas de Vhalor',
    target: () => RUINS, chapter: 5, reward: { xp: 80, gold: 40 },
    hint: 'As ruínas ficam ao norte, além da floresta.',
  },
  lake: {
    title: 'O Lago Lúnula', obj: 'Descubra o Lago Lúnula',
    target: () => LAKE, chapter: 5, reward: { xp: 50, gold: 20 },
    hint: 'Siga para o sul, além das fazendas.',
  },
}

export function createQuests() {
  const q = {
    defs: QUESTS,
    active: [],
    done: [],
    progress: {},
    tracked: null,
    checkT: 0,
    add(id) {
      if (!QUESTS[id] || this.done.includes(id) || this.active.some((a) => a.id === id)) return
      this.active.push({ id })
      if (!this.tracked) this.tracked = id
      if (G.uiApi) {
        G.uiApi.questBanner(QUESTS[id].title, QUESTS[id].obj)
        G.uiApi.refreshTracker()
      }
      sfx('ui')
    },
    complete(id, silent = false) {
      const idx = this.active.findIndex((a) => a.id === id)
      if (idx < 0) return
      this.active.splice(idx, 1)
      this.done.push(id)
      const d = QUESTS[id]
      if (d.reward && G.player) {
        if (d.reward.xp) {
          import('./player.js').then((m) => m.gainXp(G.player, d.reward.xp))
        }
        if (d.reward.gold) {
          G.player.gold += d.reward.gold
          if (G.uiApi) G.uiApi.toast(`+${d.reward.gold} ◈`, 'gold')
        }
      }
      if (!silent && G.uiApi) {
        G.uiApi.banner('MISSÃO CONCLUÍDA', d.title, 'Recompensas recebidas', 0.8)
        sfx('questdone')
      }
      if (this.tracked === id) this.tracked = this.active[0]?.id || null
      if (G.uiApi) this.tracked ? G.uiApi.refreshTracker() : G.uiApi.clearTracker()
      if (G.saveApi) G.saveApi.save()
    },
    onTalk(npc) {
      if (!npc) return
      if (npc.id === 'oran' && this.active.some((a) => a.id === 'village')) {
        this.complete('village')
        this.add('test')
        G.story.chapter = Math.max(G.story.chapter, 2)
        G.story.phase = 'toCastle'
        G.story.updateMusicNow?.()
      }
    },
    onKill(e) {
      for (const a of this.active) {
        const d = QUESTS[a.id]
        if (!d.counter) continue
        if (a.id === 'camps' && !e.camp) continue
        this.progress[a.id] = (this.progress[a.id] || 0) + 1
        if (G.uiApi) G.uiApi.refreshTracker()
        if (this.progress[a.id] >= d.counter) this.complete(a.id)
      }
    },
    onRegion(name) {
      if (name === 'Lago Lúnula') this.complete('lake')
      if (name === 'Ruínas de Vhalor') this.complete('ruins')
    },
    track(id) {
      if (!QUESTS[id]) return
      this.tracked = id
      if (G.uiApi) G.uiApi.refreshTracker()
    },
    update(dt) {
      this.checkT -= dt
      if (this.checkT > 0) return
      this.checkT = 0.3
      if (G.uiApi) G.uiApi.refreshTracker()
    },
    serialize() {
      return { active: this.active, done: this.done, progress: this.progress, tracked: this.tracked }
    },
    load(data) {
      if (!data) return
      this.active = data.active || []
      this.done = data.done || []
      this.progress = data.progress || {}
      this.tracked = data.tracked || this.active[0]?.id || null
    },
  }
  G.quests = q
  return q
}
