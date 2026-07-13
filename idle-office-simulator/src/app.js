// Bootstrap e loop do jogo — PRD §26.4.
// Economia calculada por diferença real de tempo (nunca por frames).

import { BALANCE } from './data/balance.js';
import { game, freshState, markDirty, emitChange } from './core/store.js';
import { computeEconomy } from './core/formulas.js';
import { loadGame, saveGame } from './persistence/save.js';
import { bus } from './core/bus.js';
import { tickProgression, ensureDailyMissions, ensureWeeklyMissions } from './systems/progression.js';
import { maybeTriggerEvent, expireEvent, pauseEventTimer, resumeEventTimer, ensureMarketCondition, maybeCreateRequest, expireRequests } from './systems/events.js';
import { computeOfflineReturn, collectOfflineReturn } from './systems/offline.js';
import { tickEmpire } from './systems/prestige.js';
import { tickChallenge } from './systems/challenges.js';
import { runAutomation } from './systems/actions.js';
import { managerById } from './data/managers.js';
import { initUI } from './ui/ui.js';
import { initDebugPanel } from './debug/panel.js';

let lastEconomyAt = Date.now();
let saveTimer = null;

function economyTick() {
  const state = game.state;
  const now = Date.now();
  let dt = (now - lastEconomyAt) / 1000;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;

  // Lacuna longa (aba suspensa / computador dormiu): trata como retorno offline
  if (dt >= BALANCE.offlineMinSeconds) {
    const report = computeOfflineReturn(state, now, lastEconomyAt);
    lastEconomyAt = now;
    if (report) bus.emit('offline-return', report);
    return;
  }

  lastEconomyAt = now;

  // Snapshot 1×/s (PRD §46)
  game.snapshot = computeEconomy(state, now);

  // Renda passiva pelo tempo real decorrido
  const gain = game.snapshot.totalPerSec * dt;
  if (gain > 0) {
    state.balance += gain;
    state.statistics.moneyEarned += gain;
    state.lifetimeStatistics.moneyEarned += gain;
  }
  state.statistics.playSeconds += dt;
  state.lifetimeStatistics.playSeconds += dt;
  state.statistics.maxIncomeRate = Math.max(state.statistics.maxIncomeRate, game.snapshot.totalPerSec);
  state.lifetimeStatistics.maxIncomeRate = Math.max(state.lifetimeStatistics.maxIncomeRate, game.snapshot.totalPerSec);

  // Experiência de gestores designados (pesquisa Plano de Carreira)
  if (game.snapshot.mods.managerXp) {
    for (const mgrId of Object.values(state.managerAssignments)) {
      const hired = state.hiredManagers[mgrId];
      if (!hired || hired.level >= BALANCE.managerMaxLevel) continue;
      hired.xp = (hired.xp || 0) + dt;
      const threshold = 7200 * hired.level;
      if (hired.xp >= threshold) {
        hired.xp = 0;
        hired.level++;
        bus.emit('toast', { type: 'success', text: `${managerById(mgrId)?.name} subiu para o nível ${hired.level} com a experiência adquirida!` });
      }
    }
  }

  // Desgaste leve de condição durante jogo ativo (reduzido por Manutenção Preventiva)
  const decayReduction = game.snapshot.mods.conditionLossReduction || 0;
  const decayPerSec = (1 / 600) * (1 - decayReduction); // -1 ponto a cada 10 min ativos
  for (const propId of Object.keys(state.properties)) {
    if (!state.properties[propId]) continue;
    state.propertyCondition[propId] = Math.max(0, state.propertyCondition[propId] - decayPerSec * dt);
  }

  // Sistemas periódicos
  tickProgression(state, now);
  ensureMarketCondition(state);
  maybeCreateRequest(state, now);
  expireRequests(state, now);
  tickEmpire(state);
  runAutomation(state);

  // Eventos aleatórios
  maybeTriggerEvent(state, now);
  if (state.events.pending && !state.events.pending.pausedAt && now > state.events.pending.deadline) {
    expireEvent(state);
  }

  // Remove efeitos expirados (mantidos até aqui para o cálculo por trechos)
  const before = state.activeEffects.length;
  state.activeEffects = state.activeEffects.filter((fx) => fx.expiresAt > now);
  if (state.activeEffects.length !== before) markDirty();

  // Cenário de desafio em execução (estado separado)
  tickChallenge(now);

  bus.emit('tick', game.snapshot);
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (game.dirty) saveGame(game.state);
  }, 1500);
}

function startLoops() {
  // Um único loop econômico (PRD §26.4 — impedir múltiplos loops)
  if (game._loopStarted) return;
  game._loopStarted = true;
  setInterval(economyTick, BALANCE.economyTickMs);
  setInterval(() => { if (game.dirty) saveGame(game.state); }, BALANCE.autosaveIntervalMs);
  bus.on('change', scheduleSave);
}

function bindLifecycle() {
  document.addEventListener('visibilitychange', () => {
    const state = game.state;
    if (document.hidden) {
      pauseEventTimer(state);
      saveGame(state);
    } else {
      resumeEventTimer(state);
    }
  });
  window.addEventListener('pagehide', () => saveGame(game.state));
  window.addEventListener('beforeunload', () => saveGame(game.state));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// não suporta SW; o jogo funciona normalmente sem ele
  if (location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          bus.emit('sw-update', reg); // “Atualização disponível” (PRD §42)
        }
      });
    });
  }).catch((err) => console.warn('Service worker não registrado:', err));
}

function boot() {
  const { state, isNew, fromBackup } = loadGame();
  game.state = state;
  game.snapshot = computeEconomy(state);
  lastEconomyAt = Date.now();

  ensureDailyMissions(state);
  ensureWeeklyMissions(state);
  ensureMarketCondition(state);

  initUI();
  initDebugPanel();
  bindLifecycle();
  startLoops();
  registerServiceWorker();

  if (fromBackup) bus.emit('toast', { type: 'info', text: 'O save principal estava corrompido. Backup restaurado.' });

  // Retorno offline no boot (PRD §18)
  if (!isNew) {
    const report = computeOfflineReturn(state);
    if (report) bus.emit('offline-return', report);
  }

  saveGame(state);
  emitChange('boot');
}

boot();
