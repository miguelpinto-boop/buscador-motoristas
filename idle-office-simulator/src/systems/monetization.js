// Monetização simulada — PRD §20. Nenhum valor real é cobrado.
// Mock de anúncio: idle → loading → playing → success/error → idle.

import { BALANCE } from '../data/balance.js';
import { STORE_PRODUCTS } from '../data/prestige.js';
import { game, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { earn, grantPP, grantCollectionItem } from './actions.js';
import { randomInt } from '../core/rng.js';

const toast = (type, text) => bus.emit('toast', { type, text });

export const adState = { status: 'idle', failChance: 0 }; // failChance ajustável no debug

/**
 * Executa o mock de anúncio e chama onSuccess UMA vez (PRD §20.1).
 * onUpdate recebe o status para a UI.
 */
export function playMockAd(onUpdate, onSuccess) {
  if (adState.status !== 'idle') return false;
  adState.status = 'loading';
  onUpdate?.('loading');
  setTimeout(() => {
    adState.status = 'playing';
    onUpdate?.('playing');
    setTimeout(() => {
      const failed = Math.random() < adState.failChance;
      adState.status = failed ? 'error' : 'success';
      onUpdate?.(adState.status);
      if (!failed) {
        const state = game.state;
        state.statistics.adsWatched++;
        state.lifetimeStatistics.adsWatched++;
        try { onSuccess?.(); } catch (err) { console.error(err); }
      } else {
        toast('error', 'O anúncio simulado falhou. Tente novamente.');
      }
      setTimeout(() => { adState.status = 'idle'; onUpdate?.('idle'); }, 800);
    }, BALANCE.ads.playMs);
  }, BALANCE.ads.loadMs);
  return true;
}

// ————— Anúncios recompensados (PRD §20.2) —————

/** B. Café Executivo: 2× por 4h, acumula até 12h. */
export function coffeeBoostAvailable(state) {
  const now = Date.now();
  const remaining = Math.max(0, (state.boostExpiresAt || 0) - now);
  return remaining < BALANCE.ads.coffeeBoostMaxHours * 3600e3 - BALANCE.ads.coffeeBoostHours * 3600e3 + 1;
}

export function applyCoffeeBoost(state) {
  const now = Date.now();
  const base = Math.max(now, state.boostExpiresAt || 0);
  const cap = now + BALANCE.ads.coffeeBoostMaxHours * 3600e3;
  state.boostExpiresAt = Math.min(cap, base + BALANCE.ads.coffeeBoostHours * 3600e3);
  toast('success', 'Café Executivo ativado: renda 2×!');
  markDirty();
  emitChange('economy');
}

/** C. Investidor Anjo: aparece a cada 10–15 min. */
export function investorReady(state, now = Date.now()) {
  if (!state.investorAvailableAt) {
    state.investorAvailableAt = now + randomInt(state, BALANCE.ads.investorIntervalMinMs, BALANCE.ads.investorIntervalMaxMs);
    markDirty();
    return false;
  }
  return now >= state.investorAvailableAt;
}

export function applyInvestor(state) {
  const adMult = snapFor(state)?.mods?.adMult || 1;
  const reward = (snapFor(state)?.totalPerSec || 1) * BALANCE.ads.investorRewardMinutes * 60 * adMult;
  earn(state, reward);
  state.investorAvailableAt = Date.now() + randomInt(state, BALANCE.ads.investorIntervalMinMs, BALANCE.ads.investorIntervalMaxMs);
  toast('success', 'O Investidor Anjo depositou 30 minutos de renda!');
  emitChange('economy');
}

/** D. Reforma Expressa: -20% nos próximos 10 upgrades (até 30). */
export function applyRenovationDiscount(state) {
  const left = Math.min(BALANCE.ads.renovationMaxUpgrades,
    (state.adReduction.upgradesLeft || 0) + BALANCE.ads.renovationUpgrades);
  state.adReduction = { upgradesLeft: left, discount: BALANCE.ads.renovationDiscount };
  toast('success', `Reforma Expressa: desconto nos próximos ${left} upgrades!`);
  markDirty();
  emitChange('economy');
}

// ————— Loja simulada (PRD §20.3/§20.4) —————

export function productAvailable(state, product) {
  if (product.type === 'unique' && state.purchases.includes(product.id)) return false;
  return true;
}

/** Simula a compra. O modal de confirmação é responsabilidade da UI. */
export function simulatePurchase(state, productId) {
  const product = STORE_PRODUCTS.find((p) => p.id === productId);
  if (!product || !productAvailable(state, product)) return false;
  const g = product.grant;
  const income = snapFor(state)?.totalPerSec || 1;

  if (g.moneyMin || g.moneySeconds) earn(state, Math.max(g.moneyMin || 0, income * (g.moneySeconds || 0)));
  if (g.permIncome) state.permanentMultipliers.income += g.permIncome;
  if (g.offlineHours) state.permanentMultipliers.offlineHours = Math.max(state.permanentMultipliers.offlineHours, g.offlineHours);
  if (g.items) for (const [k, v] of Object.entries(g.items)) state.inventory[k] = (state.inventory[k] || 0) + v;
  if (g.renovations) {
    state.renovations = {
      count: (state.renovations.count || 0) + g.renovations.count,
      discount: Math.max(state.renovations.discount || 0, g.renovations.discount),
    };
  }
  if (g.boostHours) {
    const now = Date.now();
    state.boostExpiresAt = Math.max(now, state.boostExpiresAt || 0) + g.boostHours * 3600e3;
  }
  if (g.pp) grantPP(state, g.pp);
  if (g.collection) grantCollectionItem(state, g.collection);

  if (product.type === 'unique') state.purchases.push(product.id);
  state.statistics.simulatedPurchases++;
  state.lifetimeStatistics.simulatedPurchases++;
  toast('success', `Compra simulada: ${product.name}. Nenhum valor foi cobrado.`);
  markDirty();
  emitChange('economy');
  return true;
}

/** Usa um salto de tempo do inventário. */
export function useTimeSkip(state, kind) {
  const hours = kind === 'skip24h' ? 24 : 4;
  if ((state.inventory[kind] || 0) < 1) return false;
  state.inventory[kind]--;
  const reward = (snapFor(state)?.totalPerSec || 1) * hours * 3600;
  earn(state, reward);
  toast('success', `Salto de ${hours}h aplicado!`);
  emitChange('economy');
  return true;
}
