/* =========================================================
 * Aetheria — Input (teclado, mouse, toque)
 * ========================================================= */
import { clamp } from './utils.js';

export class Input {
  constructor() {
    this.keys = new Set();          // códigos atualmente pressionados
    this.pressed = new Set();       // códigos pressionados neste frame
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, dx: 0, dy: 0 };
    this.rightDown = false;
    this.leftPressed = false;
    this.wheel = 0;
    this.isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
    // mobile
    this.joy = { x: 0, y: 0, active: false };
    this.mBtn = {};                 // ações mobile "pressionadas"
    this.mPressed = {};
    this.lookDX = 0; this.lookDY = 0;
    this.enabled = true;
    this._bind();
  }
  _bind() {
    addEventListener('keydown', e => {
      if (!this.enabled) return;
      if (['Space','Tab','F1','F3'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.rightDown = false; });

    const cv = document.getElementById('app');
    cv.addEventListener('mousedown', e => {
      if (!this.enabled) return;
      if (e.button === 0) this.leftPressed = true;
      if (e.button === 2) this.rightDown = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.leftPressed = false;
      if (e.button === 2) this.rightDown = false;
    });
    addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.rightDown) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; }
    });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', e => e.preventDefault());

    /* -------- Touch -------- */
    if (this.isTouch) {
      const joy = document.getElementById('joystick'), stick = document.getElementById('joy-stick');
      let joyId = null;
      const jrect = () => joy.getBoundingClientRect();
      const onJoyMove = t => {
        const r = jrect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        this.joy.x = dx; this.joy.y = dy; this.joy.active = true;
        stick.style.transform = `translate(${dx * 32}px,${dy * 32}px)`;
      };
      joy.addEventListener('touchstart', e => {
        const t = e.changedTouches[0]; joyId = t.identifier; onJoyMove(t); e.preventDefault();
      }, { passive: false });
      addEventListener('touchmove', e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) onJoyMove(t);
        }
      }, { passive: true });
      addEventListener('touchend', e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) {
            joyId = null; this.joy.x = 0; this.joy.y = 0; this.joy.active = false;
            stick.style.transform = '';
          }
        }
      });
      // botões de ação
      document.querySelectorAll('.m-btn').forEach(btn => {
        const act = btn.dataset.act;
        btn.addEventListener('touchstart', e => { this.mBtn[act] = true; this.mPressed[act] = true; e.preventDefault(); }, { passive: false });
        btn.addEventListener('touchend', () => { this.mBtn[act] = false; });
      });
      // câmera por toque na metade direita
      const look = document.getElementById('m-look');
      let lookId = null, lx = 0, ly = 0;
      look.addEventListener('touchstart', e => {
        const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault();
      }, { passive: false });
      look.addEventListener('touchmove', e => {
        for (const t of e.changedTouches) if (t.identifier === lookId) {
          this.lookDX += t.clientX - lx; this.lookDY += t.clientY - ly;
          lx = t.clientX; ly = t.clientY;
        }
      }, { passive: true });
      look.addEventListener('touchend', e => {
        for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
      });
    }
  }

  isDown(code) { return this.keys.has(code) || this.mBtn[mapToAction(code)]; }
  wasPressed(code) { return this.pressed.has(code) || this.mPressed[mapToAction(code)]; }

  /* vetor de movimento combinado (teclado + joystick) */
  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(len, 1) };
  }

  /* deltas de câmera (mouse arrastando com botão direito + toque) */
  cameraDelta() {
    let dx = this.mouse.dx + this.lookDX, dy = this.mouse.dy + this.lookDY;
    this.mouse.dx = 0; this.mouse.dy = 0; this.lookDX = 0; this.lookDY = 0;
    return [dx, dy];
  }
  endFrame() {
    this.pressed.clear();
    this.mPressed = {};
    this.wheel = 0;
    this.leftPressed = false;
  }
}

/* mapeia códigos de teclado para ações mobile equivalentes */
function mapToAction(code) {
  switch (code) {
    case 'KeyE': return 'interact';
    default: return null;
  }
}
