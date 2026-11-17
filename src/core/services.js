import { SAVE_KEY } from './config.js';

export class SaveService {
  load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); }
    catch (error) { console.warn('O save local não pôde ser lido.', error); return null; }
  }
  save(state) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch (error) { console.warn('O save local não pôde ser gravado.', error); return false; }
  }
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* armazenamento indisponível */ } }
}

export class AudioService {
  constructor() { this.context = null; this.enabled = true; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') this.context.resume();
    } catch (error) { console.info('Áudio não disponível neste navegador.', error); }
  }
  tone(frequency = 220, duration = 0.14, type = 'sine', volume = 0.045) {
    if (!this.enabled || !this.context) return;
    try {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(); oscillator.stop(this.context.currentTime + duration);
    } catch { /* áudio cosmético: nunca deve impedir o jogo */ }
  }
  play(kind) {
    const notes = { magic: [660, .32, 'sine'], hit: [95, .12, 'sawtooth'], dodge: [330, .18, 'triangle'], interact: [460, .2, 'sine'], alarm: [210, .6, 'square'], level: [740, .5, 'triangle'] };
    const [freq, duration, type] = notes[kind] || notes.interact;
    this.tone(freq, duration, type, kind === 'alarm' ? .025 : .045);
    if (kind === 'magic' || kind === 'level') this.tone(freq * 1.5, duration * .8, 'sine', .02);
  }
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const random = (min, max) => min + Math.random() * (max - min);
export function directionFromAngle(angle, target = null) {
  return target || { x: Math.sin(angle), z: Math.cos(angle) };
}
