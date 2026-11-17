// Áudio — sintetizado 100% proceduralmente (sem arquivos externos)
import { settings } from '../core/config.js';
import { clamp } from '../core/utils.js';

class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null; this.musicGain = null; this.sfxGain = null;
    this.musicTimer = null;
    this.currentTrack = null;
    this.ready = false;
  }
  init() {
    if (this.ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.applyVolumes();
      this.ready = true;
      return true;
    } catch (e) { console.warn('Áudio indisponível:', e); return false; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = settings.masterVolume;
    this.musicGain.gain.value = settings.musicVolume * 0.5;
    this.sfxGain.gain.value = settings.sfxVolume;
  }

  // ------- SFX primitivos -------
  _env(node, t0, a, d, peak = 1) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  _noiseBuffer(len = 0.5) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * len), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  noise(t0 = 0, { dur = 0.3, freq = 1000, q = 1, vol = 0.3, type = 'bandpass', slide = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + t0;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(Math.max(0.1, dur));
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, 0.01, dur, vol);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.1);
  }
  tone(t0 = 0, { freq = 440, dur = 0.3, type = 'sine', vol = 0.2, slide = 0, attack = 0.01 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + t0;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, attack, dur, vol);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.1);
  }

  // ------- SFX de jogo -------
  sfx(name, opts = {}) {
    if (!this.ready) return;
    this.resume();
    try {
      switch (name) {
        case 'swing': this.noise(0, { dur: 0.14, freq: 2600, slide: 0.3, vol: 0.16, q: 2 }); break;
        case 'hit': this.noise(0, { dur: 0.12, freq: 500, q: 0.7, vol: 0.35 }); this.tone(0, { freq: 160, dur: 0.12, type: 'square', vol: 0.12, slide: 0.4 }); break;
        case 'crit': this.noise(0, { dur: 0.18, freq: 700, q: 0.6, vol: 0.4 }); this.tone(0, { freq: 660, dur: 0.15, type: 'triangle', vol: 0.2, slide: 0.3 }); break;
        case 'hurt': this.tone(0, { freq: 220, dur: 0.2, type: 'sawtooth', vol: 0.16, slide: 0.5 }); break;
        case 'dodge': this.noise(0, { dur: 0.25, freq: 900, slide: 2.5, vol: 0.12, q: 1.5 }); break;
        case 'block': this.tone(0, { freq: 300, dur: 0.12, type: 'square', vol: 0.14 }); this.noise(0, { dur: 0.1, freq: 1800, q: 3, vol: 0.15 }); break;
        case 'step': this.noise(0, { dur: 0.07, freq: 300 + Math.random() * 200, q: 0.8, vol: 0.07 }); break;
        case 'jump': this.tone(0, { freq: 300, dur: 0.18, type: 'sine', vol: 0.1, slide: 1.6 }); break;
        case 'land': this.noise(0, { dur: 0.1, freq: 350, q: 0.7, vol: 0.14 }); break;
        case 'coin': this.tone(0, { freq: 1200, dur: 0.09, type: 'sine', vol: 0.14 }); this.tone(0.07, { freq: 1800, dur: 0.12, type: 'sine', vol: 0.12 }); break;
        case 'potion': this.tone(0, { freq: 500, dur: 0.25, type: 'sine', vol: 0.14, slide: 1.9 }); break;
        case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(i * 0.12, { freq: f, dur: 0.3, type: 'triangle', vol: 0.16 })); break;
        case 'quest': [392, 523, 659].forEach((f, i) => this.tone(i * 0.1, { freq: f, dur: 0.25, type: 'sine', vol: 0.14 })); break;
        case 'questDone': [659, 784, 1047, 1319].forEach((f, i) => this.tone(i * 0.11, { freq: f, dur: 0.3, type: 'triangle', vol: 0.15 })); break;
        case 'chest': this.noise(0, { dur: 0.2, freq: 700, q: 1, vol: 0.2 }); [440, 554, 659].forEach((f, i) => this.tone(0.15 + i * 0.09, { freq: f, dur: 0.2, type: 'sine', vol: 0.13 })); break;
        case 'door': this.noise(0, { dur: 0.5, freq: 180, q: 2, vol: 0.2, slide: 1.4 }); break;
        case 'bell': this.tone(0, { freq: 523, dur: 2.2, type: 'sine', vol: 0.3 }); this.tone(0, { freq: 1046, dur: 1.6, type: 'sine', vol: 0.12 }); this.tone(0, { freq: 1319, dur: 1.2, type: 'sine', vol: 0.07 }); break;
        case 'goblin': { const f = 500 + Math.random() * 400; this.tone(0, { freq: f, dur: 0.18, type: 'sawtooth', vol: 0.1, slide: 0.6 }); } break;
        case 'magicCast': { const el = opts.element || 'fogo'; const base = { fogo: 320, agua: 240, raio: 700, terra: 130, vento: 420, gelo: 900 }[el] || 300; this.tone(0, { freq: base, dur: 0.35, type: 'sine', vol: 0.18, slide: 1.7 }); this.noise(0, { dur: 0.3, freq: base * 3, q: 2, vol: 0.08, slide: 1.5 }); } break;
        case 'magicHit': this.noise(0, { dur: 0.3, freq: opts.freq || 800, q: 0.8, vol: 0.3, slide: 0.4 }); this.tone(0, { freq: opts.freq || 800, dur: 0.25, type: 'sine', vol: 0.2, slide: 0.5 }); break;
        case 'fire': this.noise(0, { dur: 0.6, freq: 300, q: 0.4, vol: 0.3, slide: 0.5 }); this.noise(0.05, { dur: 0.5, freq: 1200, q: 1, vol: 0.15, slide: 0.3 }); break;
        case 'explosion': this.noise(0, { dur: 0.7, freq: 250, q: 0.5, vol: 0.45, slide: 0.25 }); this.tone(0, { freq: 80, dur: 0.5, type: 'sine', vol: 0.35, slide: 0.3 }); break;
        case 'ice': this.tone(0, { freq: 1400, dur: 0.3, type: 'triangle', vol: 0.15, slide: 0.6 }); this.noise(0, { dur: 0.25, freq: 3200, q: 3, vol: 0.1, slide: 0.5 }); break;
        case 'thunder': this.noise(0, { dur: 0.8, freq: 400, q: 0.3, vol: 0.4, slide: 0.2 }); this.tone(0, { freq: 60, dur: 0.6, type: 'sawtooth', vol: 0.25, slide: 0.4 }); break;
        case 'wind': this.noise(0, { dur: 1.0, freq: 600, q: 0.5, vol: 0.2, slide: 1.6 }); break;
        case 'earth': this.tone(0, { freq: 90, dur: 0.5, type: 'sine', vol: 0.3, slide: 0.7 }); this.noise(0, { dur: 0.5, freq: 200, q: 0.6, vol: 0.25, slide: 0.5 }); break;
        case 'water': this.noise(0, { dur: 0.5, freq: 800, q: 0.8, vol: 0.2, slide: 1.8 }); break;
        case 'grimoire': this.noise(0, { dur: 0.35, freq: 1500, q: 1.5, vol: 0.12, slide: 1.4 }); this.tone(0.1, { freq: 880, dur: 0.3, type: 'sine', vol: 0.08, slide: 1.3 }); break;
        case 'pageFlip': this.noise(0, { dur: 0.2, freq: 2400, q: 1, vol: 0.1, slide: 1.3 }); break;
        case 'crystal': [440, 554, 659, 880].forEach((f, i) => this.tone(i * 0.25, { freq: f, dur: 0.8, type: 'sine', vol: 0.14 })); this.tone(0.2, { freq: 110, dur: 2.5, type: 'sine', vol: 0.2, slide: 3 }); break;
        case 'elementReveal': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(i * 0.16, { freq: f, dur: 1.2, type: 'triangle', vol: 0.18 })); break;
        case 'talk': this.tone(0, { freq: 350 + Math.random() * 250, dur: 0.06, type: 'sine', vol: 0.07 }); break;
        case 'death': this.tone(0, { freq: 300, dur: 0.6, type: 'sawtooth', vol: 0.2, slide: 0.2 }); break;
        case 'bossRoar': this.tone(0, { freq: 120, dur: 1.1, type: 'sawtooth', vol: 0.3, slide: 0.5 }); this.noise(0, { dur: 0.9, freq: 300, q: 0.5, vol: 0.3, slide: 0.4 }); break;
      }
    } catch (e) { /* sfx nunca deve quebrar o jogo */ }
  }

  // ------- Música generativa -------
  // trilhas: vila, cidade, exploração, combate, dungeon, boss, invasão
  _trackData() {
    return {
      vila:        { bpm: 72,  scale: [0, 2, 4, 7, 9],     base: 220, wave: 'sine',     chord: [0, 4, 7], arp: 1, drums: 0 },
      cidade:      { bpm: 88,  scale: [0, 2, 4, 5, 7, 9], base: 196, wave: 'triangle', chord: [0, 5, 7], arp: 1, drums: 1 },
      exploracao:  { bpm: 96,  scale: [0, 3, 5, 7, 10],   base: 174, wave: 'triangle', chord: [0, 3, 7], arp: 1, drums: 1 },
      combate:     { bpm: 140, scale: [0, 3, 5, 7, 10],   base: 147, wave: 'sawtooth', chord: [0, 3, 10], arp: 2, drums: 2 },
      dungeon:     { bpm: 60,  scale: [0, 1, 5, 7, 8],    base: 130, wave: 'sine',     chord: [0, 1, 5], arp: 0.5, drums: 0 },
      boss:        { bpm: 150, scale: [0, 1, 4, 6, 7, 10],base: 110, wave: 'sawtooth', chord: [0, 6, 10], arp: 2, drums: 2 },
      invasao:     { bpm: 132, scale: [0, 3, 5, 6, 10],   base: 130, wave: 'square',   chord: [0, 3, 6], arp: 2, drums: 2 },
      historia:    { bpm: 76,  scale: [0, 2, 3, 7, 8],    base: 164, wave: 'sine',     chord: [0, 3, 7], arp: 1, drums: 0 },
    };
  }
  playMusic(track) {
    if (!this.ready) return;
    if (this.currentTrack === track) return;
    this.stopMusic();
    const data = this._trackData()[track];
    if (!data) return;
    this.currentTrack = track;
    const beat = 60 / data.bpm;
    let step = 0;
    const tick = () => {
      if (this.currentTrack !== track || !this.ctx) return;
      try {
        const t = this.ctx.currentTime + 0.05;
        const st = step % 16;
        // baixo
        if (st % 8 === 0) {
          const rootMidi = data.base * Math.pow(2, data.chord[(step / 8 | 0) % data.chord.length] / 12) / 2;
          this._mNote(rootMidi, t, beat * 3.5, data.wave, 0.10);
        }
        // arpejo
        if (data.arp > 0 && st % Math.round(4 / data.arp) === 0) {
          const deg = data.scale[(step * 2 + st) % data.scale.length];
          const oct = st % 12 < 6 ? 2 : 4;
          this._mNote(data.base * Math.pow(2, deg / 12) * oct / 2, t, beat * 0.9, 'sine', 0.055);
        }
        // melodia suave
        if (st === 0 || st === 10) {
          const deg = data.scale[(step * 3) % data.scale.length];
          this._mNote(data.base * Math.pow(2, deg / 12), t, beat * 2, data.wave, 0.05);
        }
        // percussão
        if (data.drums > 0) {
          if (st % 4 === 0) this._mDrum(t, 0.11);
          if (st % 8 === 4) this._mHat(t, 0.05);
        }
      } catch (e) { /* música nunca quebra o jogo */ }
      step++;
      this.musicTimer = setTimeout(tick, beat * 500);
    };
    tick();
  }
  _mNote(freq, t, dur, wave, vol) {
    const o = this.ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _mDrum(t, vol) {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.2);
  }
  _mHat(t, vol) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.06);
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t); src.stop(t + 0.07);
  }
  stopMusic() {
    this.currentTrack = null;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }
}

export const audio = new AudioSys();
