// Música ambiente procedural por propriedade — PRD §41.1.
// Gerada via WebAudio (sem arquivos externos): acordes suaves em loop,
// com escala e andamento próprios para cada propriedade.

import { game, activeState } from '../core/store.js';
import { bus } from '../core/bus.js';

// Progressões por propriedade (frequências base em Hz, acordes de 3-4 notas)
const NOTE = (semitonesFromA3) => 220 * Math.pow(2, semitonesFromA3 / 12);
const PROGRESSIONS = {
  // Aurora: maior, acolhedor (C – Am – F – G)
  aurora: {
    tempoMs: 7000,
    volume: 0.05,
    chords: [
      [NOTE(3), NOTE(7), NOTE(10)],           // C
      [NOTE(0), NOTE(3), NOTE(7)],            // Am
      [NOTE(-4), NOTE(0), NOTE(3)],           // F
      [NOTE(-2), NOTE(2), NOTE(5)],           // G
    ],
  },
  // Torre Central: suspenso, corporativo (Dm7 – G7 – Cmaj7 – Am7)
  torre: {
    tempoMs: 6200,
    volume: 0.045,
    chords: [
      [NOTE(5), NOTE(8), NOTE(12), NOTE(15)],
      [NOTE(-2), NOTE(2), NOTE(5), NOTE(8)],
      [NOTE(3), NOTE(7), NOTE(10), NOTE(14)],
      [NOTE(0), NOTE(3), NOTE(7), NOTE(10)],
    ],
  },
  // Campus Horizonte: lídio, futurista (Cmaj7 – D/C – Em7 – Bm7)
  campus: {
    tempoMs: 8000,
    volume: 0.045,
    chords: [
      [NOTE(3), NOTE(7), NOTE(10), NOTE(14)],
      [NOTE(5), NOTE(9), NOTE(12)],
      [NOTE(7), NOTE(10), NOTE(14), NOTE(17)],
      [NOTE(2), NOTE(5), NOTE(9), NOTE(12)],
    ],
  },
};

let ctx = null;
let master = null;
let timer = null;
let chordIndex = 0;
let currentTheme = null;
let started = false;

function ensureContext() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    // Filtro suave para o timbre de "pad"
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    master.connect(filter).connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function playChord(theme) {
  if (!ctx || ctx.state !== 'running') return;
  const prog = PROGRESSIONS[theme] || PROGRESSIONS.aurora;
  const chord = prog.chords[chordIndex % prog.chords.length];
  chordIndex++;
  const now = ctx.currentTime;
  const dur = prog.tempoMs / 1000;
  for (const freq of chord) {
    for (const detune of [-4, 4]) { // duas vozes levemente desafinadas = pad
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(prog.volume / chord.length, now + dur * 0.35);
      gain.gain.linearRampToValueAtTime(0.0001, now + dur * 1.05);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + dur * 1.1);
    }
  }
}

function scheduleLoop() {
  clearInterval(timer);
  const theme = currentTheme || 'aurora';
  const prog = PROGRESSIONS[theme] || PROGRESSIONS.aurora;
  playChord(theme);
  timer = setInterval(() => playChord(currentTheme || 'aurora'), prog.tempoMs);
}

function updateMusic() {
  const state = game.state;
  if (!state) return;
  const wantMusic = state.settings.music && !document.hidden;
  const theme = activeState().currentProperty;

  if (!wantMusic) {
    clearInterval(timer);
    timer = null;
    if (master && ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    return;
  }
  if (!started) return; // só após interação do usuário (política de autoplay)
  if (!ensureContext()) return;
  if (ctx.state === 'suspended') ctx.resume();
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  if (theme !== currentTheme || !timer) {
    currentTheme = theme;
    chordIndex = 0;
    scheduleLoop();
  }
}

export function initMusic() {
  // Áudio só inicia após a primeira interação (PRD §41.1)
  const kickoff = () => {
    started = true;
    updateMusic();
    document.removeEventListener('pointerdown', kickoff);
    document.removeEventListener('keydown', kickoff);
  };
  document.addEventListener('pointerdown', kickoff);
  document.addEventListener('keydown', kickoff);
  bus.on('change', updateMusic);
  document.addEventListener('visibilitychange', updateMusic);
}
