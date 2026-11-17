// Entrada — teclado, mouse e toque (mobile)
import { settings } from './config.js';
import { clamp } from './utils.js';

export const input = {
  keys: new Set(),            // códigos de tecla abaixados
  pressed: new Set(),         // apertadas neste frame
  mouse: { x: 0, y: 0, dx: 0, dy: 0 },
  buttons: { left: false, right: false },
  leftPressed: false, rightPressed: false,
  wheel: 0,
  isTouch: false,
  // touch
  touchMove: { x: 0, y: 0, active: false },   // -1..1 (joystick)
  touchCam: { dx: 0, dy: 0, active: false },
  touchBtns: new Set(),
  touchBtnPressed: new Set(),
  // mapeado
  move: { x: 0, z: 0 },
  sprint: false, block: false,
  camRightHeld: false,

  consume() {
    this.pressed.clear(); this.leftPressed = false; this.rightPressed = false;
    this.mouse.dx = 0; this.mouse.dy = 0; this.wheel = 0;
    this.touchCam.dx = 0; this.touchCam.dy = 0;
    this.touchBtnPressed.clear();
  },
};

const _listeners = [];

function onTapOrClick(el, fn) { _listeners.push([el, fn]); }

export function initInput(canvas, hooks) {
  input.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const c = e.code;
    if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    if (!input.keys.has(c)) { input.keys.add(c); input.pressed.add(c); hooks?.onKey?.(c); }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.buttons.left = input.buttons.right = false; });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.buttons.left = true; input.leftPressed = true; hooks?.onLeft?.(); }
    if (e.button === 2) { input.buttons.right = true; input.rightPressed = true; input.camRightHeld = true; hooks?.onRight?.(); }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.buttons.left = false;
    if (e.button === 2) { input.buttons.right = false; input.camRightHeld = false; }
  });
  window.addEventListener('mousemove', (e) => {
    input.mouse.dx += e.movementX || 0; input.mouse.dy += e.movementY || 0;
  });
  canvas.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  // ------- Touch -------
  if (input.isTouch) {
    const joyZone = document.getElementById('joy-zone');
    const joyBase = document.getElementById('joy-base');
    const joyStick = document.getElementById('joy-stick');
    const camZone = document.getElementById('cam-zone');
    let joyId = null, joyCenter = { x: 0, y: 0 };
    let camId = null, camLast = { x: 0, y: 0 };

    const setStick = (dx, dy) => { joyStick.style.left = 35 + dx + 'px'; joyStick.style.top = 35 + dy + 'px'; };

    joyZone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (joyId === null) {
          joyId = t.identifier;
          const r = joyBase.getBoundingClientRect();
          joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
    });
    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y;
          const len = Math.hypot(dx, dy), max = 45;
          if (len > max) { dx = dx / len * max; dy = dy / len * max; }
          setStick(dx, dy);
          input.touchMove.x = dx / max; input.touchMove.y = dy / max; input.touchMove.active = true;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joyId = null; input.touchMove.x = 0; input.touchMove.y = 0; input.touchMove.active = false; setStick(0, 0);
      }
    };
    joyZone.addEventListener('touchend', endJoy);
    joyZone.addEventListener('touchcancel', endJoy);

    camZone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) if (camId === null) { camId = t.identifier; camLast = { x: t.clientX, y: t.clientY }; }
    });
    camZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === camId) {
        input.touchCam.dx += t.clientX - camLast.x; input.touchCam.dy += t.clientY - camLast.y;
        camLast = { x: t.clientX, y: t.clientY };
        input.touchCam.active = true;
      }
      e.preventDefault();
    }, { passive: false });
    const endCam = (e) => { for (const t of e.changedTouches) if (t.identifier === camId) { camId = null; input.touchCam.active = false; } };
    camZone.addEventListener('touchend', endCam);
    camZone.addEventListener('touchcancel', endCam);

    document.getElementById('touch-buttons').addEventListener('touchstart', (e) => {
      const b = e.target.closest('button[data-tb]'); if (!b) return;
      const act = b.dataset.tb;
      if (!input.touchBtns.has(act)) input.touchBtnPressed.add(act);
      input.touchBtns.add(act);
      e.preventDefault();
    }, { passive: false });
    document.getElementById('touch-buttons').addEventListener('touchend', (e) => {
      const b = e.target.closest('button[data-tb]'); if (b) input.touchBtns.delete(b.dataset.tb);
    });
  }
}

export function wasPressed(code) { return input.pressed.has(code); }
export function touchPressed(act) { return input.touchBtnPressed.has(act); }
export function touchHeld(act) { return input.touchBtns.has(act); }

// Movimento normalizado (teclado + joystick) no espaço da câmera
export function readMove() {
  let x = 0, z = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) z -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) z += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.touchMove.active) { x += input.touchMove.x; z += input.touchMove.y; }
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  input.move.x = x; input.move.z = z;
  input.sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || touchHeld('sprint');
  input.block = input.keys.has('KeyF') || touchHeld('block');
  return input.move;
}
