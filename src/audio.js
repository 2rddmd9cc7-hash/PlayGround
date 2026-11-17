/* ============================================================
   Áudio 100% procedural (WebAudio) — efeitos + trilhas por estado.
   Nenhum arquivo externo: tudo sintetizado.
   ============================================================ */
import { G, clamp, rand, pick } from './state.js'

let ctx = null
let master, musicGain, sfxGain
let musicState = 'none'
let musicTimer = 0
let musicStep = 0
let noiseBuf = null

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch { return }
  master = ctx.createGain(); master.gain.value = G.settings.master; master.connect(ctx.destination)
  musicGain = ctx.createGain(); musicGain.gain.value = G.settings.music; musicGain.connect(master)
  sfxGain = ctx.createGain(); sfxGain.gain.value = G.settings.sfx; sfxGain.connect(master)
  const len = ctx.sampleRate * 1.2
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
}

export function applyVolumes() {
  if (!ctx) return
  master.gain.value = G.settings.master
  musicGain.gain.value = G.settings.music
  sfxGain.gain.value = G.settings.sfx
}

function env(gain, t0, a, peak, d) {
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + a)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d)
}

function osc(type, freq, t0, dur, peak, dest, slideTo = null) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  env(g, t0, 0.008, peak, dur)
  o.connect(g); g.connect(dest || sfxGain)
  o.start(t0); o.stop(t0 + dur + 0.05)
}

function noise(t0, dur, peak, filterFreq, dest, q = 1, type = 'bandpass') {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf
  src.playbackRate.value = rand(0.8, 1.2)
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = q
  const g = ctx.createGain(); env(g, t0, 0.005, peak, dur)
  src.connect(f); f.connect(g); g.connect(dest || sfxGain)
  src.start(t0); src.stop(t0 + dur + 0.05)
}

export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  switch (name) {
    case 'swing': noise(t, 0.16, 0.25, 2400, null, 0.7); osc('triangle', 620, t, 0.1, 0.05, null, 200); break
    case 'heavy': noise(t, 0.3, 0.35, 1200, null, 0.6); osc('sawtooth', 180, t, 0.25, 0.12, null, 60); break
    case 'hit': noise(t, 0.12, 0.4, 800, null, 1.2); osc('square', 140, t, 0.1, 0.18, null, 70); break
    case 'crit': noise(t, 0.16, 0.5, 1600); osc('square', 300, t, 0.16, 0.22, null, 90); break
    case 'hurt': osc('sawtooth', 220, t, 0.2, 0.16, null, 90); noise(t, 0.14, 0.25, 500); break
    case 'dodge': noise(t, 0.22, 0.2, 3200, null, 0.5); break
    case 'block': osc('square', 900, t, 0.08, 0.2, null, 500); noise(t, 0.08, 0.25, 4000, null, 2); break
    case 'parry': osc('square', 1500, t, 0.2, 0.3, null, 700); noise(t, 0.2, 0.35, 5200, null, 3); break
    case 'step': noise(t, 0.07, 0.12, rand(300, 500), null, 1.4); break
    case 'jump': noise(t, 0.12, 0.12, 900, null, 0.8); break
    case 'fire': noise(t, 0.5, 0.3, 600, null, 0.5, 'lowpass'); osc('sawtooth', rand(90, 140), t, 0.4, 0.14, null, 40); break
    case 'firehit': noise(t, 0.5, 0.45, 500, null, 0.4, 'lowpass'); osc('sawtooth', 110, t, 0.4, 0.2, null, 35); break
    case 'water': osc('sine', rand(500, 700), t, 0.35, 0.16, null, 180); noise(t, 0.3, 0.2, 1400, null, 0.7); break
    case 'ice': osc('triangle', rand(1200, 1600), t, 0.3, 0.2, null, 2400); noise(t, 0.25, 0.18, 5200, null, 2); break
    case 'icehit': osc('triangle', 2200, t, 0.35, 0.28, null, 700); noise(t, 0.3, 0.3, 4200, null, 1.5); break
    case 'zap': osc('square', 2400, t, 0.14, 0.22, null, 300); noise(t, 0.14, 0.28, 3600, null, 0.6, 'highpass'); break
    case 'thunder': noise(t, 0.9, 0.5, 300, null, 0.4, 'lowpass'); osc('sawtooth', 70, t, 0.8, 0.25, null, 30); break
    case 'earth': osc('sawtooth', 60, t, 0.5, 0.3, null, 28); noise(t, 0.5, 0.3, 240, null, 0.4, 'lowpass'); break
    case 'wind': noise(t, 0.7, 0.24, 900, null, 0.3); break
    case 'magic': osc('sine', 520, t, 0.5, 0.14, null, 1560); osc('sine', 780, t + 0.06, 0.4, 0.1, null, 2080); break
    case 'heal': osc('sine', 620, t, 0.4, 0.14, null, 940); osc('sine', 930, t + 0.08, 0.35, 0.12, null, 1240); break
    case 'bell': for (let i = 0; i < 4; i++) { osc('sine', 220 * (i + 1) * 0.99, t, 2.4 - i * 0.4, 0.16 / (i * 0.6 + 1)) } noise(t, 0.1, 0.2, 1800); break
    case 'goblin': osc('sawtooth', rand(300, 420), t, 0.22, 0.14, null, rand(140, 220)); break
    case 'goblindie': osc('sawtooth', 380, t, 0.5, 0.18, null, 70); break
    case 'coin': osc('square', 1180, t, 0.09, 0.14); osc('square', 1560, t + 0.07, 0.14, 0.12); break
    case 'chest': noise(t, 0.25, 0.25, 400, null, 0.6); osc('triangle', 260, t + 0.1, 0.3, 0.14, null, 520); break
    case 'page': noise(t, 0.2, 0.14, 2600, null, 0.8); break
    case 'levelup': [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.3, 0.16)); break
    case 'questdone': [659, 784, 988].forEach((f, i) => osc('triangle', f, t + i * 0.1, 0.35, 0.16)); break
    case 'crystal': osc('sine', 300, t, 1.6, 0.2, null, 1200); osc('sine', 452, t + 0.2, 1.4, 0.14, null, 1800); noise(t + 0.1, 1.2, 0.1, 3000, null, 0.4); break
    case 'ui': osc('triangle', 700, t, 0.06, 0.1); break
    case 'buy': osc('triangle', 880, t, 0.12, 0.14, null, 1200); break
    case 'potion': osc('sine', 420, t, 0.3, 0.15, null, 760); noise(t, 0.2, 0.1, 1800); break
    case 'waves': noise(t, 0.8, 0.16, 500, null, 0.3); break
    default: break
  }
}

/* ---------- trilha procedural ---------- */
const TRACKS = {
  menu: { bpm: 60, root: 220, scale: [0, 3, 7, 10, 12], pad: [0, -8], bright: 0.5 },
  village: { bpm: 76, root: 262, scale: [0, 2, 4, 7, 9, 12], pad: [0, 4, 7], bright: 0.8 },
  city: { bpm: 84, root: 294, scale: [0, 2, 4, 5, 7, 9, 11, 12], pad: [0, 5, 9], bright: 1 },
  explore: { bpm: 66, root: 233, scale: [0, 3, 5, 7, 10, 12], pad: [0, 3, 10], bright: 0.6 },
  combat: { bpm: 132, root: 220, scale: [0, 3, 5, 7, 10], pad: [0, -5], bright: 1.2, drums: true },
  invasion: { bpm: 140, root: 208, scale: [0, 1, 5, 7, 8], pad: [0, -6, 6], bright: 1.4, drums: true },
  boss: { bpm: 150, root: 196, scale: [0, 1, 4, 6, 7, 11], pad: [0, -6], bright: 1.5, drums: true },
  dungeon: { bpm: 56, root: 196, scale: [0, 3, 6, 10, 12], pad: [0, -12], bright: 0.35 },
  test: { bpm: 60, root: 330, scale: [0, 4, 7, 11, 12, 16], pad: [0, 7, 12], bright: 1.1 },
}

function padChord(root, intervals, dur, vol) {
  const t = ctx.currentTime
  for (const iv of intervals) {
    const f = root * Math.pow(2, iv / 12)
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = f
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    o.connect(lp); lp.connect(g); g.connect(musicGain)
    o.start(t); o.stop(t + dur + 0.1)
  }
}

function pluckNote(root, semis, vol, dur = 0.35) {
  const t = ctx.currentTime
  const f = root * Math.pow(2, semis / 12)
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'triangle'; o.frequency.value = f
  env(g, t, 0.01, vol, dur)
  o.connect(g); g.connect(musicGain)
  o.start(t); o.stop(t + dur + 0.05)
}

function drum(kind, vol) {
  const t = ctx.currentTime
  if (kind === 'kick') { osc('sine', 120, t, 0.16, vol, musicGain, 40) }
  else if (kind === 'snare') { noise(t, 0.1, vol * 0.7, 1800, musicGain, 0.8) }
  else { noise(t, 0.05, vol * 0.4, 6000, musicGain, 1) }
}

export function setMusic(state) {
  if (musicState === state) return
  musicState = state
  musicStep = 0
  musicTimer = 0
}

export function updateMusic(dt) {
  if (!ctx || ctx.state !== 'running' || musicState === 'none') return
  const tr = TRACKS[musicState]
  if (!tr) return
  const stepDur = 60 / tr.bpm / 2
  musicTimer -= dt
  while (musicTimer <= 0) {
    musicTimer += stepDur
    const s = musicStep % 32
    if (s === 0) padChord(tr.root, tr.pad, stepDur * 16, 0.05 * tr.bright)
    if (musicState !== 'menu' && s % 4 === 0) pluckNote(tr.root * 2, pick(tr.scale), 0.06 * tr.bright, stepDur * 1.8)
    if (tr.drums) {
      if (s % 8 === 0) drum('kick', 0.4)
      if (s % 8 === 4) drum('snare', 0.3)
      if (s % 2 === 1) drum('hat', 0.14)
    }
    musicStep++
  }
}
