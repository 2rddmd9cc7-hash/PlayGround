/* ============================================================
   Grimório — livro físico flutuante + desbloqueio de páginas.
   ============================================================ */
import * as THREE from 'three'
import { G, clamp, damp } from './state.js'
import { ELEMENTS } from './elements.js'
import { burst } from './effects.js'
import { sfx } from './audio.js'

export function createGrimoire() {
  const api = {
    granted: false,
    group: null,
    pageT: 0,
    emitT: 0,
    isOpen() { return !!G.grimoireOpen },
    grant() {
      if (this.granted) return
      this.granted = true
      buildBook()
      if (G.player) G.player.spellsUnlocked = 1
      this.refresh()
      if (G.uiApi) G.uiApi.toast('Você recebeu um Grimório! Pressione G para abri-lo.', 'gold')
    },
    refresh() {
      const p = G.player
      if (!p) return
      const count = p.spellLevel.filter((lv) => p.level >= lv).length
      if (count > (p.spellsUnlocked || 1)) {
        p.spellsUnlocked = count
        const sp = ELEMENTS[p.element]?.spells[count - 1]
        if (sp && G.uiApi) {
          G.uiApi.toast(`Nova página desbloqueada: ${sp.name}!`, 'gold')
          sfx('page')
        }
      }
      if (G.uiApi) G.uiApi.refreshHotbar()
    },
    checkUnlocks() {
      const p = G.player
      if (!p || !p.element) return null
      const count = p.spellLevel.filter((lv) => p.level >= lv).length
      if (count > (p.spellsUnlocked || 1)) {
        p.spellsUnlocked = count
        return ELEMENTS[p.element].spells[count - 1]?.name || null
      }
      return null
    },
    toggle() {
      if (!this.granted) {
        if (G.uiApi) G.uiApi.toast('O grimório ainda não é seu…', 'gold')
        return
      }
      if (G.grimoireOpen) this.close()
      else this.open()
    },
    open() {
      if (!this.granted) return
      G.grimoireOpen = true
      sfx('page')
      if (G.uiApi) G.uiApi.openGrimoire()
      this.pageT = 0
    },
    close() {
      if (!G.grimoireOpen && !(G.uiApi && G.uiApi.isBlocking())) return
      G.grimoireOpen = false
      if (G.uiApi) G.uiApi.closeGrimoire()
      sfx('page')
    },
    update(dt) {
      const p = G.player
      if (!this.group || !p) return
      const t = performance.now() / 1000
      const yaw = p.yaw
      const lx = Math.cos(yaw) * 0.62, lz = -Math.sin(yaw) * 0.62
      const openK = G.grimoireOpen ? 1 : 0
      this.pageT = damp(this.pageT, openK, 8, dt)
      const g = this.group
      const targetY = p.pos.y + 1.25 + Math.sin(t * 1.7) * 0.08 + this.pageT * 0.35
      g.position.x = damp(g.position.x, p.pos.x + lx + Math.sin(yaw) * 0.2, 10, dt)
      g.position.y = damp(g.position.y, targetY, 8, dt)
      g.position.z = damp(g.position.z, p.pos.z + lz + Math.cos(yaw) * 0.2, 10, dt)
      g.rotation.y = damp(g.rotation.y, yaw + Math.PI + 0.45, 6, dt)
      g.rotation.z = Math.sin(t * 1.3) * 0.05
      g.rotation.x = Math.sin(t * 1.1) * 0.04 - this.pageT * 0.3
      // páginas abrem quando o grimório está ativo
      if (this.pages) {
        this.pages[0].rotation.y = damp(this.pages[0].rotation.y, -0.32 - this.pageT * 0.9, 8, dt)
        this.pages[1].rotation.y = damp(this.pages[1].rotation.y, 0.32 + this.pageT * 0.9, 8, dt)
      }
      // partículas de magia
      this.emitT -= dt
      if (this.emitT <= 0) {
        this.emitT = 0.28
        const col = ELEMENTS[p.element]?.color || 0xb080ff
        burst('magic', g.position.x, g.position.y, g.position.z, 0.35, hexToRgb(col))
      }
      // brilho da capa
      if (this.runeMat) this.runeMat.emissiveIntensity = 0.7 + Math.sin(t * 2.4) * 0.35
    },
  }
  G.grimoireApi = api
  return api
}

function hexToRgb(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255
  return [r, g, b]
}

function buildBook() {
  const api = G.grimoireApi
  const p = G.player
  const col = ELEMENTS[p.element]?.color || 0xb080ff
  const g = new THREE.Group()
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.7, metalness: 0.2 })
  const pageMat = new THREE.MeshLambertMaterial({ color: 0xe8dfc8 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.4 })
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.62), coverMat)
  g.add(cover)
  const back = cover.clone(); back.position.y = -0.09; g.add(back)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.62), coverMat)
  spine.position.set(-0.2, -0.045, 0)
  g.add(spine)
  const pageL = new THREE.Group(); pageL.position.set(-0.03, -0.045, 0)
  pageL.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.58), pageMat))
  const pageR = new THREE.Group(); pageR.position.set(0.03, -0.045, 0)
  pageR.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.58), pageMat))
  g.add(pageL, pageR)
  // runas / símbolo elemental na capa
  const runeMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 18), runeMat)
  rune.rotation.x = -Math.PI / 2
  rune.position.y = 0.02
  g.add(rune)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), runeMat)
  core.position.y = 0.04
  g.add(core)
  // cantos dourados
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.07), goldMat)
    c.position.set(sx * 0.19, 0.005, sz * 0.27)
    g.add(c)
  }
  const glow = new THREE.PointLight(col, 0.8, 5)
  glow.position.y = 0.15
  g.add(glow)
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  g.position.set(p.pos.x + 0.6, p.pos.y + 1.3, p.pos.z)
  G.scene.add(g)
  api.group = g
  api.pages = [pageL, pageR]
  api.runeMat = runeMat
}
