/* =========================================================
 * Aetheria — Áudio procedural (WebAudio, sem arquivos externos)
 * SFX sintetizados + trilha musical procedural por contexto
 * ========================================================= */
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.55;
    this.sfxVol = 0.7;
    this.mood = 'village';
    this._nextNote = 0;
    this._step = 0;
    this._noiseBuf = null;
    this._enabled = true;
  }
  /* deve ser chamado após um gesto do usuário */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this._enabled = false; return false; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      // buffer de ruído reutilizável
      const len = this.ctx.sampleRate * 1;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._nextNote = this.ctx.currentTime + 0.1;
      return true;
    } catch (e) { console.warn('Áudio indisponível:', e); this._enabled = false; return false; }
  }
  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.ctx) {
      this.musicGain.gain.value = music;
      this.sfxGain.gain.value = sfx;
    }
  }

  /* ============ SFX ============ */
  _osc(type, freq, dur, vol, { slide = 0, delay = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(dur, vol, { freq = 800, q = 1, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || !this._noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.05);
  }
  play(name, vol = 1) {
    if (!this.ctx) return;
    try {
      switch (name) {
        case 'swing': this._noise(0.12, 0.25 * vol, { freq: 1400, slide: -900 }); break;
        case 'sword': this._noise(0.09, 0.3 * vol, { freq: 2200, slide: -1400 }); this._osc('square', 220, 0.06, 0.08 * vol, { slide: -120 }); break;
        case 'hit': this._noise(0.1, 0.5 * vol, { freq: 300, slide: -180 }); this._osc('sine', 110, 0.12, 0.3 * vol, { slide: -60 }); break;
        case 'crit': this._noise(0.14, 0.6 * vol, { freq: 500, slide: -400 }); this._osc('sine', 90, 0.18, 0.4 * vol, { slide: -50 }); this._osc('square', 660, 0.08, 0.12 * vol, { slide: 300 }); break;
        case 'block': this._osc('square', 180, 0.1, 0.25 * vol, { slide: -60 }); this._noise(0.08, 0.3 * vol, { freq: 900 }); break;
        case 'dodge': this._noise(0.2, 0.15 * vol, { freq: 500, slide: 300 }); break;
        case 'step': this._noise(0.05, 0.08 * vol, { freq: 260, slide: -120 }); break;
        case 'jump': this._osc('sine', 280, 0.15, 0.12 * vol, { slide: 200 }); break;
        case 'hurt': this._osc('sawtooth', 160, 0.2, 0.25 * vol, { slide: -90 }); break;
        case 'die': this._osc('sawtooth', 200, 0.7, 0.3 * vol, { slide: -170 }); break;
        case 'goblin': this._osc('sawtooth', rand2(300, 480), 0.15, 0.18 * vol, { slide: -140 }); break;
        case 'goblinDie': this._osc('sawtooth', 320, 0.4, 0.22 * vol, { slide: -260 }); break;
        case 'wolf': this._osc('sawtooth', 200, 0.35, 0.2 * vol, { slide: 120 }); break;
        case 'arrow': this._noise(0.18, 0.2 * vol, { freq: 1800, slide: -1200 }); break;
        case 'chest': this._osc('triangle', 320, 0.12, 0.2 * vol); this._osc('triangle', 480, 0.18, 0.18 * vol, { delay: 0.1 }); break;
        case 'coin': this._osc('sine', 880, 0.1, 0.15 * vol); this._osc('sine', 1320, 0.14, 0.12 * vol, { delay: 0.06 }); break;
        case 'potion': this._osc('sine', 520, 0.12, 0.18 * vol, { slide: 260 }); this._osc('sine', 780, 0.16, 0.14 * vol, { delay: 0.09 }); break;
        case 'bell': for (let i = 0; i < 3; i++) { this._osc('sine', 196, 1.6, 0.3 * vol, { delay: i * 1.1 }); this._osc('sine', 392, 1.2, 0.12 * vol, { delay: i * 1.1 }); } break;
        case 'door': this._noise(0.3, 0.2 * vol, { freq: 140, slide: 60 }); break;
        case 'ui': this._osc('triangle', 640, 0.06, 0.12 * vol); break;
        case 'open': this._noise(0.25, 0.2 * vol, { freq: 600, slide: 400 }); break;
        case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, 0.3, 0.2 * vol, { delay: i * 0.11 })); break;
        case 'quest': [659, 784, 988].forEach((f, i) => this._osc('triangle', f, 0.35, 0.16 * vol, { delay: i * 0.13 })); break;
        case 'page': this._noise(0.3, 0.18 * vol, { freq: 1100, slide: 500 }); break;
        case 'heal': [440, 554, 659].forEach((f, i) => this._osc('sine', f, 0.4, 0.14 * vol, { delay: i * 0.1 })); break;
        /* magias elementais */
        case 'm_fire': this._noise(0.5, 0.35 * vol, { freq: 900, slide: -500 }); this._osc('sawtooth', 120, 0.4, 0.2 * vol, { slide: -40 }); break;
        case 'm_fireHit': this._noise(0.4, 0.55 * vol, { freq: 400, slide: -320 }); this._osc('sine', 70, 0.35, 0.4 * vol, { slide: -30 }); break;
        case 'm_water': this._noise(0.45, 0.3 * vol, { freq: 1200, q: 3, slide: 600 }); this._osc('sine', 300, 0.35, 0.16 * vol, { slide: 180 }); break;
        case 'm_waterHit': this._noise(0.3, 0.45 * vol, { freq: 800, slide: -500 }); break;
        case 'm_lightning': this._noise(0.25, 0.5 * vol, { freq: 2600, slide: -2200 }); this._osc('square', 1400, 0.12, 0.14 * vol, { slide: -1100 }); break;
        case 'm_earth': this._osc('sine', 65, 0.5, 0.42 * vol, { slide: -25 }); this._noise(0.4, 0.3 * vol, { freq: 200, slide: -120 }); break;
        case 'm_wind': this._noise(0.7, 0.28 * vol, { freq: 700, q: 2, slide: 500 }); break;
        case 'm_ice': this._osc('triangle', 1500, 0.25, 0.2 * vol, { slide: 900 }); this._noise(0.2, 0.2 * vol, { freq: 3000, slide: 1000 }); break;
        case 'm_iceHit': this._osc('triangle', 1900, 0.15, 0.28 * vol, { slide: -1400 }); this._noise(0.15, 0.3 * vol, { freq: 2600, slide: -1800 }); break;
        case 'm_cast': this._osc('sine', 440, 0.3, 0.12 * vol, { slide: 320 }); break;
        case 'grimoire': this._noise(0.4, 0.15 * vol, { freq: 900, slide: 700 }); this._osc('sine', 523, 0.5, 0.1 * vol, { slide: 200 }); break;
        case 'element': [261, 329, 392, 523, 659, 784].forEach((f, i) => this._osc('sine', f, 1.2, 0.18 * vol, { delay: i * 0.22 })); break;
        case 'roar': this._osc('sawtooth', 80, 1.1, 0.4 * vol, { slide: -30 }); this._noise(1.0, 0.3 * vol, { freq: 220, slide: -120 }); break;
        case 'thunder': this._noise(1.4, 0.6 * vol, { freq: 90, slide: -40 }); break;
        case 'night': this._osc('sine', 660, 0.4, 0.05 * vol); break;
      }
    } catch (e) { /* áudio nunca deve quebrar o jogo */ }
  }
  playAt(name, vol, dist, maxDist = 40) {
    const f = Math.max(0, 1 - dist / maxDist);
    if (f > 0.02) this.play(name, vol * f);
  }

  /* ============ Música procedural ============ */
  setMood(mood) { if (mood !== this.mood) { this.mood = mood; this._step = 0; } }
  _patterns = {
    village:   { tempo: 0.42, scale: [0, 2, 4, 7, 9, 12, 14], root: 261.6, bass: [0, 0, 5, 5, 3, 3, 5, 5], lead: [0, 4, 2, 7, 4, 9, 7, 12], wave: 'triangle', bassWave: 'sine', vol: 0.09 },
    city:      { tempo: 0.38, scale: [0, 2, 4, 5, 7, 9, 11], root: 233.1, bass: [0, 0, 4, 4, 5, 5, 7, 7], lead: [7, 4, 5, 2, 0, 4, 7, 9], wave: 'triangle', bassWave: 'sine', vol: 0.085 },
    explore:   { tempo: 0.5,  scale: [0, 2, 3, 5, 7, 8, 10], root: 220, bass: [0, 0, 3, 3, 5, 5, 3, 3], lead: [0, 3, 7, 5, 3, 7, 10, 7], wave: 'triangle', bassWave: 'sine', vol: 0.08 },
    combat:    { tempo: 0.24, scale: [0, 2, 3, 5, 7, 8, 10, 12], root: 174.6, bass: [0, 0, 0, 3, 5, 3, 0, 2], lead: [7, 5, 3, 7, 10, 7, 5, 3], wave: 'sawtooth', bassWave: 'square', vol: 0.07 },
    dungeon:   { tempo: 0.66, scale: [0, 1, 3, 5, 6, 8, 10], root: 130.8, bass: [0, 0, 6, 6], lead: [0, 6, 3, 6], wave: 'sine', bassWave: 'sine', vol: 0.07 },
    boss:      { tempo: 0.22, scale: [0, 1, 3, 5, 6, 8, 10, 12], root: 146.8, bass: [0, 0, 6, 0, 8, 6, 5, 3], lead: [12, 10, 8, 6, 8, 10, 12, 10], wave: 'sawtooth', bassWave: 'square', vol: 0.075 },
    invasion:  { tempo: 0.26, scale: [0, 2, 3, 5, 7, 8, 10], root: 155.6, bass: [0, 0, 0, 5, 0, 0, 3, 2], lead: [3, 7, 3, 10, 7, 3, 5, 2], wave: 'sawtooth', bassWave: 'square', vol: 0.075 },
    story:     { tempo: 0.6,  scale: [0, 2, 4, 5, 7, 9, 11], root: 196, bass: [0, 0, 5, 5], lead: [0, 4, 7, 9, 7, 4, 2, 0], wave: 'sine', bassWave: 'sine', vol: 0.08 },
  };
  updateMusic() {
    if (!this.ctx || !this._enabled) return;
    const p = this._patterns[this.mood] || this._patterns.explore;
    const now = this.ctx.currentTime;
    while (this._nextNote < now + 0.25) {
      const t = Math.max(this._nextNote, now + 0.02);
      const i = this._step % p.bass.length;
      // baixo
      this._note(p.root * Math.pow(2, p.bass[i] / 12) / 2, p.tempo * 0.9, p.vol * 1.6, p.bassWave, t);
      // melodia (nem sempre — deixa respirar)
      if (this._step % 2 === 0 || Math.random() < 0.6) {
        const li = Math.floor(this._step / 2) % p.lead.length;
        this._note(p.root * Math.pow(2, p.lead[li] / 12), p.tempo * 0.8, p.vol, p.wave, t);
      }
      this._nextNote += p.tempo;
      this._step++;
    }
  }
  _note(freq, dur, vol, wave, t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
}
function rand2(a, b) { return a + Math.random() * (b - a); }
