export class InputController {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();
    this.target = target;
    this.onKeyDown = event => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    };
    this.onKeyUp = event => this.keys.delete(event.code);
    this.onBlur = () => { this.keys.clear(); this.pressed.clear(); };
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }
  down(code) { return this.keys.has(code); }
  consume(code) { const result = this.pressed.has(code); this.pressed.delete(code); return result; }
  clearFrame() { this.pressed.clear(); }
  destroy() {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
