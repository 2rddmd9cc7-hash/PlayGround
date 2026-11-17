/* ============================================================
   História — capítulos, Teste do Poder, invasão e mundo aberto.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, rand, randInt, pick, damp } from './state.js'
import { ELEMENTS, ELEMENT_LIST } from './elements.js'
import { CASTLE_HALL, CITY, VILLAGE, LAKE, CAMPS, getCrystal } from './world.js'
import { spawnEnemy, enemies } from './enemies.js'
import { sfx, setMusic } from './audio.js'
import { burst, ring } from './effects.js'
import { gainXp } from './player.js'
import { npcs } from './npcs.js'

export function createStory() {
  const s = {
    cineActive: false,
    cineT: 0,
    cineData: null,
    timer: 0,
    pending: [],
    wave: null,
    eventT: 70,
    invasionStarted: false,
    hintT: 0,
    hints: [],
    musicT: 0,
    endHandled: false,

    init() {
      G.story = {
        chapter: 1,
        phase: 'village',
        flags: { invasion: false, grimoire: false, worldOpen: false },
        updateMusicNow: () => { this.musicT = 0 },
      }
      G.story.chapter = 1
    },

    startNewGame() {
      G.story.chapter = 1
      G.story.phase = 'village'
      G.story.flags = { invasion: false, grimoire: false, worldOpen: false }
      G.quests.add('village')
      if (G.uiApi) {
        G.uiApi.banner('CRÔNICAS DE AETHERIA', 'Capítulo I · A Vila de Pedravale', 'Fale com o Ancião Oran', 1, '#d9c98a')
        G.uiApi.showHint('WASD para andar · botão direito do mouse para a câmera · E interage', 8)
      }
      setMusic('village')
    },

    /* ---------- diálogos ---------- */
    talkTo(npc) {
      if (!npc) return false
      const ui = G.uiApi
      const phase = G.story.phase
      if (npc.id === 'oran') {
        if (phase === 'village' || phase === 'toCastle' && G.quests.active.some((a) => a.id === 'village')) {
          ui.showDialog('Ancião Oran', [
            'Ah… você finalmente despertou, jovem.',
            'O Cristal do Poder aguarda no Grande Salão do castelo de Corvoalta. Ele revelará a essência da sua alma.',
            'Siga a estrada a leste, atravesse a ponte. O capitão Dario o receberá.',
            'Que os Antigos o guiem.',
          ], () => G.quests.onTalk(npc))
          return true
        }
        if (G.story.flags.invasion) {
          ui.showDialog('Ancião Oran', ['Os goblins estão dentro das muralhas!', 'Ajude o capitão Dario! Use suas magias, jovem!'])
          return true
        }
        ui.showDialog('Ancião Oran', [
          `O elemento ${G.player.element || 'escolhido'} escolheu você. Sinto sua força crescer.`,
          'Há acampamentos goblins nas fronteiras. E algo antigo desperta em Vhalor…',
          'Explore o mundo. Torne-se quem você nasceu para ser.',
        ])
        return true
      }
      if (npc.id === 'dario') {
        if (G.story.flags.invasion) {
          ui.showDialog('Capitão Dario', ['Segure a linha! Os goblins não podem alcançar o salão!', 'Use tudo o que aprendeu!'])
          return true
        }
        if (npc.special === 'captain' && G.story.phase === 'toCastle') {
          ui.showDialog('Capitão Dario', ['O Teste do Poder? O Grande Salão é logo ao norte, dentro do castelo.', 'O mago Elandor conduz o ritual. Boa sorte.'])
          return true
        }
        ui.showDialog('Capitão Dario', ['Corvoalta está em dívida com você.', 'Mantenha as estradas seguras, e terá nossa gratidão eterna.'])
        return true
      }
      if (npc.id === 'elandor') {
        if (!G.player.element) {
          ui.showDialog('Mago Elandor', ['Aproxime-se do cristal e coloque sua mão sobre ele, com fé.', 'O ritual é simples. O destino, não.'])
        } else {
          ui.showDialog('Mago Elandor', [
            `Interessante… ${G.player.element}. O cristal raramente erra.`,
            'Seu grimório responderá ao seu elemento. Abra-o com G e estude cada página.',
            'Com o tempo, novas páginas se revelarão conforme você cresce.',
          ])
        }
        return true
      }
      if (npc.special === 'heal') {
        const cost = 15
        if (G.player.hp < G.player.maxHp) {
          if (G.player.gold >= cost) {
            G.player.gold -= cost
            G.player.hp = G.player.maxHp
            sfx('heal')
            burst('heal', G.player.pos.x, G.player.pos.y + 1, G.player.pos.z, 1.4)
            ui.showDialog('Sacerdote Ivo', ['Que a Luz cure suas feridas. (+Vida completa, -15 ◈)'])
          } else {
            ui.showDialog('Sacerdote Ivo', ['A fé é gratuita, mas as velas custam 15 ◈…'])
          }
        } else {
          ui.showDialog('Sacerdote Ivo', ['Você já está inteiro, filho. Que a Luz o acompanhe.'])
        }
        return true
      }
      if (npc.special === 'shop') {
        if (G.story.flags.invasion) {
          ui.showDialog(npc.name, ['Estamos sob ataque! Não é hora de negócios!'])
          return true
        }
        ui.openShop(npc.profession)
        return true
      }
      const lines = npc.lines
      ui.showDialog(npc.name, [pick(lines), pick(lines)])
      return true
    },

    /* ---------- teste do poder ---------- */
    startCrystalTest() {
      if (G.player.element || this.cineActive) return
      this.cineActive = true
      this.cineT = 0
      this.cineStep = 0
      G.paused = true
      G.quests.complete('crystal')
      const { mesh } = getCrystal()
      const p = G.player
      const hx = CASTLE_HALL.x, hz = CASTLE_HALL.z
      this.cineData = {
        from: G.camera.position.clone(),
        look: new THREE.Vector3(hx, p.pos.y + 1.4, hz),
        crystal: mesh,
      }
      sfx('crystal')
      setMusic('test')
      if (G.uiApi) { G.uiApi.cinema(true); G.uiApi.hideHint() }
      burst('magic', hx, p.pos.y + 1.6, hz, 2)
    },

    updateCrystalTest(dt) {
      const p = G.player
      const t = (this.cineT += dt)
      const hx = CASTLE_HALL.x, hz = CASTLE_HALL.z
      const { mesh } = getCrystal()
      // câmera cinematográfica
      const ang = Math.min(1, t / 4) * 0.9 + 0.6
      const dist = 4.4 - Math.min(1, t / 6) * 1.8
      const camTarget = new THREE.Vector3(hx + Math.cos(ang) * dist, p.pos.y + 2.1, hz + Math.sin(ang) * dist)
      G.camera.position.lerp(camTarget, Math.min(1, dt * 1.6))
      G.camera.lookAt(hx, p.pos.y + 1.5 + Math.min(t * 0.1, 0.4), hz)
      G.cameraRig.yaw = Math.atan2(G.camera.position.x - hx, G.camera.position.z - hz) + Math.PI

      // partículas crescentes
      if (Math.random() < 0.5) burst('magic', hx + rand(-0.8, 0.8), p.pos.y + 1.5 + rand(0, 1.8), hz + rand(-0.8, 0.8), 0.9)
      if (Math.random() < 0.25) burst('smoke', hx + rand(-1.2, 1.2), p.pos.y + 0.5, hz + rand(-1.2, 1.2), 1.2)
      if (mesh) {
        mesh.rotation.y += dt * (2 + t)
        mesh.material.emissiveIntensity = 0.6 + t * 0.5
      }

      // escolha do elemento
      if (t > 3.1 && !this.chosen) {
        this.chosen = pick(ELEMENT_LIST)
        p.element = this.chosen
        p.spellsUnlocked = Math.max(1, p.spellLevel.filter((lv) => p.level >= lv).length)
        const el = ELEMENTS[this.chosen]
        const col = '#' + el.color.toString(16).padStart(6, '0')
        if (G.uiApi) {
          G.uiApi.banner('SEU ELEMENTO', el.icon + ' ' + this.chosen.toUpperCase(), el.desc, 1, col)
          G.uiApi.setElementUI()
        }
        sfx('levelup')
        for (let i = 0; i < 3; i++) ring(hx, p.pos.y + 0.1 + i * 0.5, hz, el.color, 3 + i, 0.8)
        for (let i = 0; i < 40; i++) burst(el.aura === 'zap' ? 'zap' : el.aura, hx + rand(-1.5, 1.5), p.pos.y + rand(0, 2.6), hz + rand(-1.5, 1.5), 1.2)
        G.story.chapter = 2
        G.story.phase = 'tested'
      }

      if (t > 5.2 && this.chosen && !this.granted) {
        this.granted = true
        G.grimoireApi.grant()
        G.story.flags.grimoire = true
        if (mesh) mesh.material.emissiveIntensity = 0.7
      }

      if (t > 6.6) {
        this.cineActive = false
        G.paused = false
        if (G.uiApi) G.uiApi.cinema(false)
        // a câmera retorna suavemente
        G.cameraRig.yaw = Math.atan2(p.pos.x - hx, p.pos.z - hz) + Math.PI
        // invasão em 4s
        this.schedule(4, () => this.startInvasion())
        G.quests.add('invasion')
        this.hints = [
          [1.5, 'Clique esquerdo: ataque · Espaço: esquiva'],
          [6.5, 'Teclas 1-4: magias elementais · Q: defender'],
          [14, 'G: grimório · F: ataque pesado'],
        ]
        G.story.phase = 'afterTest'
      }
    },

    schedule(delay, fn) { this.pending.push({ t: delay, fn }) },

    /* ---------- invasão ---------- */
    startInvasion() {
      if (this.invasionStarted) return
      this.invasionStarted = true
      G.story.flags.invasion = true
      G.story.phase = 'invasion'
      G.story.chapter = 3
      this.wave = { n: 0, spawned: false, list: [], timer: 2, done: false }
      sfx('bell')
      setMusic('invasion')
      if (G.uiApi) {
        G.uiApi.banner('CORVOALTA É ATACADA', 'A invasão dos goblins começou', 'Defenda a cidade!', 1, '#e85040')
        G.uiApi.showHint('Sino de guerra! Goblins invadiram a cidade!', 5)
      }
      // NPCs entram em pânico
      for (const n of npcs) if (!n.guard) n.panic = true
    },

    updateInvasion(dt) {
      const w = this.wave
      if (!w) return
      const p = G.player
      if (!p) return

      if (!w.spawned) {
        w.timer -= dt
        if (w.timer > 0) return
        w.n++
        w.spawned = true
        w.list = []
        const base = p.pos
        const makePos = (i) => {
          const a = rand(0, Math.PI * 2)
          const d = rand(10, 15)
          let x = clamp(base.x + Math.cos(a) * d, 112, 188)
          let z = clamp(base.z + Math.sin(a) * d, -68, 8)
          return { x, z }
        }
        if (w.n === 1) {
          for (let i = 0; i < 3; i++) { const { x, z } = makePos(i); w.list.push(spawnEnemy('Goblin', 'E', x, z, { respawn: 0 })) }
          if (G.uiApi) G.uiApi.showHint('Onda 1/3 — Goblins comuns', 3)
        } else if (w.n === 2) {
          for (let i = 0; i < 2; i++) { const { x, z } = makePos(i); w.list.push(spawnEnemy('Goblin Guerreiro', 'D', x, z, { respawn: 0 })) }
          const { x, z } = makePos(2); w.list.push(spawnEnemy('Goblin Arqueiro', 'D', x, z, { respawn: 0 }))
          if (G.uiApi) G.uiApi.showHint('Onda 2/3 — Guerreiros e arqueiros', 3)
        } else if (w.n === 3) {
          for (let i = 0; i < 2; i++) { const { x, z } = makePos(i); w.list.push(spawnEnemy(i === 0 ? 'Goblin Guerreiro' : 'Goblin Mago', 'C', x, z, { respawn: 0 })) }
          const { x, z } = makePos(2)
          w.list.push(spawnEnemy('Goblin Elite', 'B', x, z, { respawn: 0 }))
          if (G.uiApi) {
            G.uiApi.showHint('Onda final — Goblin Elite!', 3)
            G.uiApi.banner('GOBLIN ELITE', 'O líder da invasão surge', '', 0.8, '#e85040')
          }
          setMusic('boss')
        } else {
          this.endInvasion()
        }
        G.quests.active // noop
        return
      }

      // conta vivos
      const alive = w.list.filter((e) => !e.dead)
      if (alive.length === 0) {
        w.spawned = false
        w.timer = 3.2
        if (w.n < 3) {
          if (G.uiApi) G.uiApi.toast(`Onda ${w.n} derrotada!`, 'xp')
          sfx('questdone')
        }
      }
    },

    endInvasion() {
      if (this.endHandled) return
      this.endHandled = true
      G.story.flags.invasion = false
      G.story.phase = 'openWorld'
      G.story.chapter = 5
      G.story.flags.worldOpen = true
      setMusic('explore')
      if (G.uiApi) {
        G.uiApi.banner('CORVOALTA RESISTIU', 'Capítulo V · O Mundo Se Abre', 'Explore Aetheria', 1, '#d9c98a')
        G.uiApi.showHint('O mundo está aberto! Siga as estradas e descubra novas regiões.', 6)
      }
      G.quests.complete('invasion')
      G.quests.add('grimoire')
      this.schedule(2, () => {
        G.quests.add('hunt'); G.quests.add('camps'); G.quests.add('ruins'); G.quests.add('lake')
      })
      for (const n of npcs) n.panic = false
      sfx('questdone')
      if (G.saveApi) G.saveApi.save()
    },

    /* ---------- interação com o cristal ---------- */
    tryCrystal(p) {
      if (!p.element) { this.startCrystalTest(); return true }
      if (G.uiApi) G.uiApi.toast('O cristal já revelou sua essência.', 'gold')
      return true
    },

    /* ---------- eventos do mundo ---------- */
    updateOpenWorld(dt) {
      const p = G.player
      if (!p) return
      this.eventT -= dt * (G.hour > 20 || G.hour < 5 ? 1.6 : 1)
      if (this.eventT > 0) return
      const activeCount = enemies.filter((e) => !e.dead).length
      if (activeCount > 22) { this.eventT = 25; return }
      this.eventT = rand(55, 95)
      const night = G.hour > 20 || G.hour < 5
      const d = Math.hypot(p.pos.x - VILLAGE.x, p.pos.z - VILLAGE.z)
      const dc = Math.hypot(p.pos.x - CITY.x, p.pos.z - CITY.z)
      if (d < 45 || dc < 55) { this.eventT = 40; return } // segurança perto das cidades
      const roll = Math.random()
      const spawnNear = (cls, rank, count) => {
        for (let i = 0; i < count; i++) {
          const a = rand(0, Math.PI * 2), r = rand(14, 20)
          const x = clamp(p.pos.x + Math.cos(a) * r, -240, 240)
          const z = clamp(p.pos.z + Math.sin(a) * r, -240, 240)
          spawnEnemy(cls, rank, x, z, { respawn: 0 })
        }
      }
      if (roll < 0.45) {
        spawnNear('Goblin', 'E', randInt(2, 4))
        if (G.uiApi) { G.uiApi.toast('Emboscada goblin!', 'xp'); sfx('goblin') }
        setMusic('combat')
      } else if (roll < 0.68) {
        spawnNear('Goblin Guerreiro', 'D', 2)
        if (G.uiApi) G.uiApi.toast('Guerreiros goblins atacam!', 'xp')
        setMusic('combat')
      } else if (roll < 0.82) {
        spawnNear(night ? 'Goblin Mago' : 'Goblin Arqueiro', 'C', 1)
        if (G.uiApi) G.uiApi.toast(night ? 'Um mago sombrio se aproxima…' : 'Um arqueiro emboscou você!', 'xp')
      } else {
        p.gold += randInt(15, 45)
        sfx('coin')
        if (G.uiApi) G.uiApi.toast('Você encontrou um baú escondido! +◈', 'gold')
        burst('magic', p.pos.x + rand(-2, 2), p.pos.y + 1, p.pos.z + rand(-2, 2), 1)
      }
    },

    /* ---------- trilha sonora dinâmica ---------- */
    updateMusic(dt) {
      this.musicT -= dt
      if (this.musicT > 0) return
      this.musicT = 1.2
      if (G.story.phase === 'test') return
      let nearAggro = false
      const p = G.player
      if (p) {
        for (const e of enemies) {
          if (!e.dead && e.aggro && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 22) { nearAggro = true; break }
        }
      }
      if (G.story.flags.invasion) { setMusic(nearAggro ? 'combat' : 'invasion'); return }
      if (nearAggro) { setMusic('combat'); return }
      const reg = G.region
      if (reg === 'Vila de Pedravale') setMusic('village')
      else if (reg === 'Corvoalta') setMusic('city')
      else if (reg === 'Caverna Umbral' || reg === 'Ruínas de Vhalor') setMusic('dungeon')
      else setMusic('explore')
    },

    update(dt) {
      // agendamentos
      for (let i = this.pending.length - 1; i >= 0; i--) {
        this.pending[i].t -= dt
        if (this.pending[i].t <= 0) {
          const fn = this.pending[i].fn
          this.pending.splice(i, 1)
          try { fn() } catch (err) { console.error(err) }
        }
      }

      if (this.cineActive) { this.updateCrystalTest(dt); return }

      if (G.story.flags.invasion) this.updateInvasion(dt)
      if (G.story.phase === 'openWorld') this.updateOpenWorld(dt)

      // dicas da invasão
      if (this.hints.length) {
        const [at, text] = this.hints[0]
        this.hintT += dt
        if (this.hintT > at) {
          this.hints.shift()
          this.hintT = 0
          if (G.uiApi && !this.cineActive) G.uiApi.showHint(text, 5)
        }
      }

      // quest tracker de distância / região
      const p = G.player
      if (p) {
        const reg = G.region
        if (G.uiApi) G.uiApi.setRegion(reg)
        if (G.quests) G.quests.onRegion(reg)
      }

      this.updateMusic(dt)
    },

    serialize() {
      return { chapter: G.story.chapter, phase: G.story.phase, flags: { ...G.story.flags }, invasionStarted: this.invasionStarted, endHandled: this.endHandled, chosen: this.chosen || null, granted: this.granted || false }
    },
    load(data) {
      if (!data) return
      G.story.chapter = data.chapter || 1
      G.story.phase = data.phase || 'village'
      G.story.flags = data.flags || {}
      this.invasionStarted = !!data.invasionStarted
      this.endHandled = !!data.endHandled
      this.chosen = data.chosen
      this.granted = !!data.granted
      if (this.granted && G.player.element && G.grimoireApi && !G.grimoireApi.granted) useGrant()
    },
  }

  function useGrant() {
    try { G.grimoireApi.grant() } catch { /* ignore */ }
  }

  G.story = { chapter: 1, phase: 'village', flags: {}, updateMusicNow: () => { s.musicT = 0 } }
  G.storyApi = s
  return s
}
