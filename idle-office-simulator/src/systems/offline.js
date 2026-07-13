// Ganho offline por trechos temporais — PRD §18.
// O cálculo separa períodos com boost/efeitos ativos e respeita as expirações.

import { BALANCE } from '../data/balance.js';
import { computeEconomy } from '../core/formulas.js';
import { game, markDirty } from '../core/store.js';

/**
 * Calcula a renda entre `fromTs` e `toTs` dividindo o intervalo nos instantes
 * em que boosts/efeitos expiram (PRD §18.3). Retorna { total, segments }.
 */
export function incomeOverInterval(state, fromTs, toTs) {
  if (toTs <= fromTs) return { total: 0, segments: [] };
  // Pontos de corte: expiração de cada efeito e do boost, dentro do intervalo
  const cuts = new Set([fromTs, toTs]);
  for (const fx of state.activeEffects || []) {
    if (fx.expiresAt > fromTs && fx.expiresAt < toTs) cuts.add(fx.expiresAt);
  }
  if (state.boostExpiresAt > fromTs && state.boostExpiresAt < toTs) cuts.add(state.boostExpiresAt);
  const points = [...cuts].sort((a, b) => a - b);
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const midpoint = points[i] + 1; // avalia modificadores válidos neste trecho
    const snap = computeEconomy(state, midpoint);
    const seconds = (points[i + 1] - points[i]) / 1000;
    const gain = snap.totalPerSec * seconds;
    total += gain;
    segments.push({ from: points[i], to: points[i + 1], perSec: snap.totalPerSec, gain });
  }
  return { total, segments };
}

/**
 * Processa o retorno do jogador. Retorna null se a ausência for curta demais,
 * ou um relatório para o modal de retorno (PRD §18.4).
 */
export function computeOfflineReturn(state, now = Date.now(), fromTs = null) {
  const from0 = fromTs ?? state.lastSavedAt;
  const away = (now - from0) / 1000;
  if (!Number.isFinite(away) || away < BALANCE.offlineMinSeconds) return null; // inclui tempo negativo → zero
  const snap = computeEconomy(state, from0);
  const limitHours = snap.mods.offlineHours;
  const consideredSec = Math.min(away, limitHours * 3600);
  const from = from0;
  const to = from + consideredSec * 1000;
  const { total, segments } = incomeOverInterval(state, from, to);
  const bonus = 1 + (snap.mods.offlineGainBonus || 0); // Dividendos Compostos (r05)
  return {
    awaySeconds: away,
    consideredSeconds: consideredSec,
    limitHours,
    baseRate: segments.length ? segments[0].perSec : snap.totalPerSec,
    segments,
    total: total * bonus,
    doubled: false,
  };
}

/** Credita o ganho offline (1× ou 2× com anúncio — uma vez por retorno). */
export function collectOfflineReturn(state, report, doubled = false) {
  const adMult = doubled ? 2 * (1 + ((game.snapshot?.mods?.adMult || 1) - 1)) : 1;
  const amount = report.total * (doubled ? adMult : 1);
  state.balance += amount;
  state.statistics.moneyEarned += amount;
  state.lifetimeStatistics.moneyEarned += amount;
  state.statistics.offlineCollections++;
  state.lifetimeStatistics.offlineCollections++;
  state.statistics.offlineSecondsRewarded += report.consideredSeconds;
  state.lifetimeStatistics.offlineSecondsRewarded += report.consideredSeconds;
  const hours = report.consideredSeconds / 3600;
  state.statistics.offlineMaxHours = Math.max(state.statistics.offlineMaxHours, hours);
  state.lifetimeStatistics.offlineMaxHours = Math.max(state.lifetimeStatistics.offlineMaxHours, hours);
  markDirty();
  return amount;
}
