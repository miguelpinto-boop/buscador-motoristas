// Prestígio de portfólio e Modo Império — PRD §19, §38.

import { BALANCE } from '../data/balance.js';
import { prestigeValue, legacyPointsFor, prestigeRequirements, portfolioValue, computeEconomy } from '../core/formulas.js';
import { game, freshCycleState, markDirty, emitChange } from '../core/store.js';
import { savePrestigeCheckpoint, saveGame } from '../persistence/save.js';
import { bus } from '../core/bus.js';
import { COMPANIES } from '../data/companies.js';
import { RESEARCH, researchById } from '../data/research.js';
import { COUNCIL_GOALS } from '../data/extras.js';
import { seededShuffle } from '../core/rng.js';
import { evaluateCheck } from './progression.js';
import { grantReward } from './actions.js';

/** Prévia da venda (PRD §19.3, §21.9). */
export function prestigePreview(state) {
  const snap = game.snapshot || computeEconomy(state);
  const value = prestigeValue(state, snap);
  return {
    requirements: prestigeRequirements(state, snap),
    value,
    legacyPoints: legacyPointsFor(value, state.reputation),
    portfolio: portfolioValue(state, snap),
  };
}

export function canPrestige(state) {
  return prestigePreview(state).requirements.every((r) => r.ok);
}

/**
 * Vende o portfólio e inicia um novo ciclo (PRD §19.4/§19.5).
 * Salva checkpoint antes e save completo depois (PRD §19.7).
 */
export function doPrestige(state) {
  if (!canPrestige(state)) return false;
  savePrestigeCheckpoint(state);

  const preview = prestigePreview(state);
  const mods = game.snapshot?.mods;

  // Retenção de PP (PRD §7.4): 50% base + Rede de Pesquisa + Memória de Pesquisa
  const retention = Math.min(1, BALANCE.prestige.ppRetention
    + (mods?.ppRetentionBonus || 0)
    + (state.legacyUpgrades.L13 || 0) * 0.10);
  const keptPP = Math.floor(state.researchPoints * retention);

  // Pesquisas de qualidade de vida permanecem (PRD §31.2)
  const keptResearch = state.researchNodes.filter((id) => researchById(id)?.qol);

  // Contratos Herdados (L18): empresas permanecem descobertas
  const keepDiscovered = ['T01'];
  const l18 = state.legacyUpgrades.L18 || 0;
  if (l18 > 0) {
    const discovered = state.discoveredTenants.filter((id) => id !== 'T01');
    keepDiscovered.push(...discovered.slice(-l18 * 3)); // até 1 por propriedade × nível
  }

  const cycleSeconds = state.statistics.playSeconds;
  state.prestigeHistory.push({
    cycle: state.currentCycle,
    at: Date.now(),
    value: preview.value,
    pl: preview.legacyPoints,
    seconds: cycleSeconds,
  });
  if (state.empireMode.active) {
    state.empireMode.bestCycleSeconds = state.empireMode.bestCycleSeconds
      ? Math.min(state.empireMode.bestCycleSeconds, cycleSeconds) : cycleSeconds;
  }

  // Reinicia o ciclo preservando o que permanece (PRD §19.5)
  const cycle = freshCycleState();
  Object.assign(state, cycle);

  state.currentCycle++;
  state.prestigeCount++;
  state.legacyPoints += preview.legacyPoints;
  state.researchPoints = keptPP;
  state.researchNodes = keptResearch;
  state.discoveredTenants = [...new Set(keepDiscovered)];
  state.paidContracts = [];

  // Melhorias de Legado aplicadas ao novo ciclo
  state.balance = BALANCE.initialBalance + (state.legacyUpgrades.L01 || 0) * 500;
  state.reputation = (state.legacyUpgrades.L04 || 0) * 5;
  if (state.legacyUpgrades.L12) {
    for (const id of ['101', '102', '103']) state.rooms[id].unlocked = true;
  }

  // Sede e mercado continuam liberados se a campanha já passou por eles
  state.hqUnlocked = state.campaign.completedChapters >= 5;
  state.marketUnlocked = state.campaign.completedChapters >= 6;

  // Gestor M24 (campanha) é permanente
  if (state.campaign.finished) state.hiredManagers.M24 = { level: 1, xp: 0 };

  saveGame(state, { backup: true });
  bus.emit('celebrate', { text: `Prestígio! +${preview.legacyPoints} Pontos de Legado` });
  emitChange('prestige');
  return true;
}

// ————— Modo Império (PRD §38.3) —————

export function empireAvailable(state) {
  const campusComplete = state.campaign.finished
    && state.prestigeCount >= BALANCE.empire.requiresPrestiges
    && state.properties.campus;
  return campusComplete;
}

export function activateEmpireMode(state) {
  if (!empireAvailable(state) || state.empireMode.active) return false;
  state.empireMode.active = true;
  nextCouncilGoal(state);
  bus.emit('celebrate', { text: 'Modo Império ativado! O Conselho aguarda suas metas.' });
  markDirty();
  emitChange('prestige');
  return true;
}

export function nextCouncilGoal(state) {
  const idx = seededShuffle(`council:${Date.now()}:${state.rngSeed}`, COUNCIL_GOALS.length)[0];
  const goal = COUNCIL_GOALS[idx];
  const baseline = {};
  baseline[goal.type] = state.statistics[goal.type] || 0;
  if (goal.type === 'portfolioGrowth') baseline.portfolio = game.snapshot ? portfolioValue(state, game.snapshot) : 0;
  state.empireMode.councilGoal = { goalId: goal.id, baseline, startedAt: Date.now() };
  markDirty();
}

export function tickEmpire(state) {
  if (!state.empireMode.active || !state.empireMode.councilGoal) return;
  const cg = state.empireMode.councilGoal;
  const goal = COUNCIL_GOALS.find((g) => g.id === cg.goalId);
  if (!goal) { nextCouncilGoal(state); return; }
  const r = evaluateCheck(state, { type: goal.type, value: goal.value }, cg.baseline);
  if (r.done) {
    const mult = game.snapshot?.mods?.councilMult || 1;
    grantReward(state, { pl: Math.round((goal.reward.pl || 0) * mult) });
    bus.emit('celebrate', { text: `Meta do Conselho cumprida: ${goal.name}!` });
    nextCouncilGoal(state);
    emitChange('prestige');
  }
}
