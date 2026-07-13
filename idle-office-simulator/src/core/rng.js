// RNG com semente persistida (mulberry32) — PRD §45.2.
// Recompensas importantes usam a semente do save: recarregar a página não re-sorteia.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Avança a semente do estado e retorna um número em [0, 1).
export function nextRandom(state) {
  const rand = mulberry32(state.rngSeed);
  const value = rand();
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return value;
}

// Sorteio determinístico a partir de uma chave (ex.: data local) — mesmo resultado ao recarregar.
export function seededPick(seedString, listLength) {
  let h = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % listLength;
}

// Embaralha deterministicamente uma lista de índices a partir de uma chave.
export function seededShuffle(seedString, length) {
  let h = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = mulberry32(h >>> 0);
  const idx = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function randomInt(state, min, max) {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}
