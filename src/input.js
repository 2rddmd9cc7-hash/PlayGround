/* ============================================================
   Entrada — teclado, mouse (botão direito = câmera) e toque.
   ============================================================ */
import { G } from './state.js'

const down = new Set()
const edge = new Set()
const mouseEdge = new Set()
export const mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: [false, false, false], wheel: 0, dragging: false }
export const touch = { active: false, moveX: 0, moveZ: 0, lookDx: 0, lookDy: 0 }
const virtual = { x: 0, z: 0 }

export const Input = {
  isDown(code) { return down.has(code) },
  pressed(code) { return edge.has(code) },
  mDown(btn) { return mouse.buttons[btn] },
  mPressed(btn) { return mouseEdge.has(btn) },
  takeWheel() { const w = mouse.wheel; mouse.wheel = 0; return w },
  setVirtual(x, z) { virtual.x = x; virtual.z = z },
  virtualAxis() { return { ...virtual } },
  endFrame() { edge.clear(); mouseEdge.clear(); mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; touch.lookDx = 0; touch.lookDy = 0 },
}

export function initInput(canvas) {
  const hot = (e) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault() }
  window.addEventListener('keydown', (e) => {
    hot(e)
    if (!down.has(e.code)) edge.add(e.code)
    down.add(e.code)
  })
  window.addEventListener('keyup', (e) => down.delete(e.code))
  window.addEventListener('blur', () => { down.clear(); mouse.buttons = [false, false, false] })

  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.addEventListener('mousedown', (e) => {
    if (!mouse.buttons[e.button]) mouseEdge.add(`b${e.button}`)
    mouse.buttons[e.button] = true
    mouse.dragging = e.button === 2
  })
  window.addEventListener('mouseup', (e) => {
    mouse.buttons[e.button] = false
    if (e.button === 2) mouse.dragging = false
  })
  window.addEventListener('mousemove', (e) => {
    mouse.dx += e.movementX || 0
    mouse.dy += e.movementY || 0
    mouse.x = e.clientX
    mouse.y = e.clientY
  })
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); mouse.wheel += Math.sign(e.deltaY) }, { passive: false })

  // ----- toque -----
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    touch.active = true
    const zone = document.getElementById('joy-zone')
    const base = document.getElementById('joy-base')
    const nub = document.getElementById('joy-nub')
    let joyId = null, jx = 0, jy = 0
    const setJoy = (el, x, y) => { el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px` }
    zone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]
      joyId = t.identifier; jx = t.clientX; jy = t.clientY
      setJoy(base, jx - 55, jy - 55); setJoy(nub, jx - 24, jy - 24)
    }, { passive: true })
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        let dx = t.clientX - jx, dy = t.clientY - jy
        const d = Math.hypot(dx, dy), max = 55
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max }
        setJoy(nub, jx + dx - 24, jy + dy - 24)
        Input.setVirtual(dx / max, dy / max)
      }
    }, { passive: true })
    const joyEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joyId = null; Input.setVirtual(0, 0)
        base.style.display = 'none'; nub.style.display = 'none'
      }
    }
    zone.addEventListener('touchend', joyEnd)
    zone.addEventListener('touchcancel', joyEnd)

    const cam = document.getElementById('tb-camzone')
    let camId = null, cx = 0, cy = 0
    cam.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]
      if (camId === null) { camId = t.identifier; cx = t.clientX; cy = t.clientY }
    }, { passive: true })
    cam.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === camId) {
        touch.lookDx += (t.clientX - cx) * 1.6
        touch.lookDy += (t.clientY - cy) * 1.6
        cx = t.clientX; cy = t.clientY
      }
    }, { passive: true })
    const camEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === camId) camId = null }
    cam.addEventListener('touchend', camEnd)
    cam.addEventListener('touchcancel', camEnd)

    for (const [id, key] of [['tb-atk', 'attack'], ['tb-dodge', 'dodge'], ['tb-jump', 'jump']]) {
      const el = document.getElementById(id)
      el.addEventListener('touchstart', (e) => { e.preventDefault(); edge.add(key); touch[`b_${key}`] = true })
      el.addEventListener('touchend', () => { touch[`b_${key}`] = false })
    }
    // botões virtuais mapeados para ações
    const origPressed = Input.pressed.bind(Input)
    Input.pressed = (code) => {
      if (code === 'attack' && touch.b_attack) return true
      if (code === 'dodge' && touch.b_dodge) return true
      if (code === 'jump' && touch.b_jump) return true
      return origPressed(code)
    }
  }
}
