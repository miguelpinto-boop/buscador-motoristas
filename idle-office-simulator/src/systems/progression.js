// Progressão: missões, conquistas, campanha, rival e calendário — PRD §15, §16, §30, §34.2, §36.
// Toda condição é declarativa e avaliada aqui contra estado + estatísticas.

import { BALANCE } from '../data/balance.js';
import { TUTORIAL_MISSIONS, MILESTONE_MISSIONS, DAILY_TEMPLATES, WEEKLY_TEMPLATES, LOGIN_CALENDAR } from '../data/missions.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { CHAPTERS, RIVAL_GOALS } from '../data/campaign.js';
import { OFFICES, FLOORS, FACILITIES, PROPERTIES, facilitiesOfProperty } from '../data/buildings.js';
import { COMPANIES, companyById } from '../data/companies.js';
import { managerById } from '../data/managers.js';
import { COLLECTION_ITEMS, CHALLENGES } from '../data/extras.js';
import { portfolioValue, effectiveCondition } from '../core/formulas.js';
import { game, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { localDateKey, localWeekKey } from '../core/format.js';
import { seededShuffle } from '../core/rng.js';
import { grantReward, grantRep } from './actions.js';

const toast = (type, text) => bus.emit('toast', { type, text });

// ————— Avaliador declarativo —————

/**
 * Avalia uma condição. `baseline` (opcional) contém contadores no momento em que a
 * missão foi gerada — diárias e semanais medem apenas o progresso novo.
 * Retorna { done, current, target }.
 */
export function evaluateCheck(state, check, baseline = null) {
  const snap = game.snapshot;
  const stats = state.statistics;
  const lt = state.lifetimeStatistics;
  const counter = (key, target) => {
    const base = baseline?.[key] || 0;
    const cur = Math.max(0, (stats[key] || 0) - base);
    return { done: cur >= target, current: cur, target };
  };
  const ltCounter = (key, target) => ({ done: (lt[key] || 0) >= target, current: lt[key] || 0, target });
  const stateCheck = (done, current = done ? 1 : 0, target = 1) => ({ done, current, target });
  const t = check.type;
  const v = check.value;

  // Contadores vitalícios (conquistas)
  if (t.startsWith('lt_')) {
    const key = t.slice(3);
    if (key === 'daysPlayed') return stateCheck((lt.daysPlayed || []).length >= v, (lt.daysPlayed || []).length, v);
    if (key === 'marketConditionsSeen') return stateCheck((lt.marketConditionsSeen || []).length >= v, (lt.marketConditionsSeen || []).length, v);
    return ltCounter(key, v);
  }

  switch (t) {
    // Contadores do ciclo
    case 'upgradesBought': case 'contractsSigned': case 'newContractsSigned': case 'taps':
    case 'adsWatched': case 'facilityUpgrades': case 'managersTrained': case 'offlineCollections':
    case 'eventsCompleted': case 'projectsCompleted': case 'conditionRestored': case 'requestsCompleted':
    case 'ppEarned': case 'repEarned': case 'rivalWins': case 'itemsEquipped': case 'chapterStepsDone':
    case 'maintenancesDone': case 'researchBought': case 'roomPremium':
      return counter(t, v);
    case 'moneyEarned': case 'moneySpent': {
      const target = check.incomeSeconds ? (baseline?.__target ?? Math.max(100, (snap?.totalPerSec || 1) * check.incomeSeconds)) : v;
      return counter(t, target);
    }
    case 'daysPlayed': {
      const base = baseline?.daysPlayedCount || 0;
      const cur = Math.max(0, (stats.daysPlayed || []).length - base);
      return { done: cur >= v, current: cur, target: v };
    }

    // Estado — salas / andares / propriedades
    case 'roomUnlocked': return stateCheck(!!state.rooms[v]?.unlocked);
    case 'floorUnlocked': return stateCheck(!!state.floors[v]);
    case 'propertyUnlocked': return stateCheck(!!state.properties[v]);
    case 'propertiesUnlocked': {
      const n = Object.values(state.properties).filter(Boolean).length;
      return stateCheck(n >= v, n, v);
    }
    case 'roomsUnlockedCount': {
      const n = Object.values(state.rooms).filter((r) => r.unlocked).length;
      return stateCheck(n >= v, n, v);
    }
    case 'roomsOfPropertyUnlocked': {
      const n = OFFICES.filter((o) => o.property === check.property && state.rooms[o.id]?.unlocked).length;
      return stateCheck(n >= v, n, v);
    }
    case 'occupiedRooms': {
      const n = Object.keys(state.tenantsByRoom).length;
      return stateCheck(n >= v, n, v);
    }
    case 'occupiedRoomsOfProperty': {
      const n = Object.keys(state.tenantsByRoom).filter((roomId) => OFFICES.find((o) => o.id === roomId)?.property === check.property).length;
      return stateCheck(n >= v, n, v);
    }
    case 'roomTotalLevels': {
      const r = state.rooms[check.room];
      const n = r ? r.structure + r.tech + r.comfort : 0;
      return stateCheck(n >= v, n, v);
    }
    case 'categoryLevel': {
      const n = Math.max(0, ...Object.values(state.rooms).filter((r) => r.unlocked).flatMap((r) => [r.structure, r.tech, r.comfort]));
      return stateCheck(n >= v, n, v);
    }

    // Renda / economia
    case 'incomeRate': return stateCheck((snap?.totalPerSec || 0) >= v, snap?.totalPerSec || 0, v);
    case 'incomeGrowth': {
      const base = baseline?.income ?? state.missions.baseline.income ?? 0;
      if (base <= 0) return stateCheck((snap?.totalPerSec || 0) > 0);
      const growth = (snap?.totalPerSec || 0) / base - 1;
      return stateCheck(growth >= v, growth, v);
    }
    case 'portfolioValue': {
      const pv = snap ? portfolioValue(state, snap) : 0;
      return stateCheck(pv >= v, pv, v);
    }
    case 'portfolioGrowth': {
      const base = baseline?.portfolio || state.missions.baseline.portfolio || 0;
      if (base <= 0) return stateCheck(false, 0, v);
      const pv = snap ? portfolioValue(state, snap) : 0;
      return stateCheck(pv / base - 1 >= v, pv / base - 1, v);
    }

    // Satisfação
    case 'satisfactionRoom': {
      const best = Math.max(0, ...Object.values(snap?.perRoom || {}).map((r) => r.satisfaction));
      return stateCheck(best >= v, best, v);
    }
    case 'avgSatisfaction': return stateCheck((snap?.avgSatisfaction || 0) >= v, snap?.avgSatisfaction || 0, v);

    // Instalações
    case 'facilityBuilt': return stateCheck((state.facilities[v] ?? -1) >= 0);
    case 'facilitiesBuiltCount': {
      const n = Object.values(state.facilities).filter((l) => l >= 0).length;
      return stateCheck(n >= v, n, v);
    }
    case 'facilitiesOfPropertyBuilt': {
      const n = facilitiesOfProperty(check.property).filter((f) => (state.facilities[f.id] ?? -1) >= 0).length;
      return stateCheck(n >= v, n, v);
    }
    case 'facilityMaxed': {
      const ok = FACILITIES.some((f) => (state.facilities[f.id] ?? -1) >= f.maxLevel);
      return stateCheck(ok);
    }
    case 'greenFacilityBuilt': {
      const ok = FACILITIES.some((f) => f.green && (state.facilities[f.id] ?? -1) >= 0);
      return stateCheck(ok);
    }

    // Gestores
    case 'managersHired': {
      const n = Object.keys(state.hiredManagers).length;
      return stateCheck(n >= v, n, v);
    }
    case 'managerAtLevel': {
      const n = Math.max(0, ...Object.values(state.hiredManagers).map((m) => m.level));
      return stateCheck(n >= v, n, v);
    }
    case 'assignedManagers': {
      const n = Object.keys(state.managerAssignments).length;
      return stateCheck(n >= v, n, v);
    }

    // Contratos / empresas
    case 'discoveredCount': return stateCheck(state.discoveredTenants.length >= v, state.discoveredTenants.length, v);
    case 'activeCategory': {
      const best = Math.max(0, ...Object.values(state.tenantsByRoom).map((id) => companyById(id)?.cat || 0));
      return stateCheck(best >= v, best, v);
    }
    case 'activeCompany': return stateCheck(Object.values(state.tenantsByRoom).includes(v));
    case 'activeSpecialty': {
      const n = Object.values(state.tenantsByRoom).filter((id) => companyById(id)?.specialty === check.specialty).length;
      return stateCheck(n >= v, n, v);
    }

    // Reputação / Prestígio / pesquisa
    case 'repTotal': return stateCheck(state.reputation >= v, state.reputation, v);
    case 'prestiges': return stateCheck(state.prestigeCount >= v, state.prestigeCount, v);
    case 'researchNode': return stateCheck(state.researchNodes.includes(v));
    case 'hqLevels': {
      const n = Object.values(state.hqDepartments).reduce((a, b) => a + b, 0);
      return stateCheck(n >= v, n, v);
    }

    // Campanha / desafios / coleção
    case 'tutorialIndex': return stateCheck(state.missions.tutorialIndex >= v, state.missions.tutorialIndex, v);
    case 'chapterDone': return stateCheck(state.campaign.completedChapters >= v, state.campaign.completedChapters, v);
    case 'campaignDone': return stateCheck(!!state.campaign.finished);
    case 'challengesCompleted': return stateCheck(state.challenges.completed.length >= v, state.challenges.completed.length, v);
    case 'medalsCount': {
      const n = Object.values(state.challenges.medals).reduce((a, b) => a + b, 0);
      return stateCheck(n >= v, n, v);
    }
    case 'challengeMedal': return stateCheck((state.challenges.medals[v] || 0) >= 1);
    case 'chapterAndChallenge':
      return stateCheck(state.campaign.completedChapters >= check.chapter && state.challenges.completed.length >= 1);
    case 'collectionCount': return stateCheck(state.collection.owned.length >= v, state.collection.owned.length, v);

    // Condição / mercado
    case 'conditionAt': {
      const best = Math.max(...PROPERTIES.filter((p) => state.properties[p.id]).map((p) => state.propertyCondition[p.id] ?? 100));
      return stateCheck(best >= v, best, v);
    }
    case 'allConditionsAt': {
      const active = PROPERTIES.filter((p) => state.properties[p.id]);
      const ok = active.length === 3 && active.every((p) => (state.propertyCondition[p.id] ?? 100) >= v);
      const min = Math.min(...active.map((p) => state.propertyCondition[p.id] ?? 100));
      return stateCheck(ok, min, v);
    }

    default:
      console.warn('Tipo de condição desconhecido:', t);
      return { done: false, current: 0, target: 1 };
  }
}

// ————— Tutorial e marcos —————

function tickTutorial(state) {
  const idx = state.missions.tutorialIndex;
  if (idx >= TUTORIAL_MISSIONS.length) return;
  const mission = TUTORIAL_MISSIONS[idx];
  const r = evaluateCheck(state, mission.check);
  if (r.done) {
    state.missions.tutorialIndex++;
    state.statistics.missionsCompleted++;
    state.lifetimeStatistics.missionsCompleted++;
    const parts = grantReward(state, mission.reward, { missionScale: true });
    toast('success', `Missão concluída: ${mission.name} (${parts.join(', ')})`);
    bus.emit('feedback', { tier: 'medium' });
    emitChange('missions');
  }
}

function tickMilestones(state) {
  for (const m of MILESTONE_MISSIONS) {
    if (state.missions.milestonesDone.includes(m.id)) continue;
    const r = evaluateCheck(state, m.check);
    if (r.done) {
      state.missions.milestonesDone.push(m.id);
      state.statistics.missionsCompleted++;
      state.lifetimeStatistics.missionsCompleted++;
      grantReward(state, m.reward, { missionScale: true });
      toast('success', `Marco atingido: ${m.name}!`);
      emitChange('missions');
    }
  }
}

// ————— Diárias e semanais —————

function templateAvailable(state, tpl) {
  switch (tpl.requires) {
    case 'managers': return state.reputation >= 10 || Object.keys(state.hiredManagers).length > 0;
    case 'projects': return state.campaign.completedChapters >= 3;
    case 'maintenance': return state.campaign.completedChapters >= 6;
    case 'rival': return state.campaign.completedChapters >= 3;
    case 'collection': return state.collection.owned.length > 0;
    case 'research': return state.hqUnlocked;
    default: return true;
  }
}

function makeMissionInstance(state, tpl) {
  const stats = state.statistics;
  const baseline = {};
  const key = tpl.check.type;
  if (!key.startsWith('lt_')) baseline[key] = stats[key] || 0;
  if (key === 'daysPlayed') baseline.daysPlayedCount = (stats.daysPlayed || []).length;
  if (tpl.check.incomeSeconds) baseline.__target = Math.max(100, (game.snapshot?.totalPerSec || 1) * tpl.check.incomeSeconds);
  if (key === 'incomeGrowth') baseline.income = game.snapshot?.totalPerSec || 0;
  if (key === 'portfolioGrowth') baseline.portfolio = game.snapshot ? portfolioValue(state, game.snapshot) : 0;
  return { tplId: tpl.id, baseline, done: false, collected: false };
}

export function ensureDailyMissions(state) {
  const today = localDateKey();
  if (state.missions.daily.date === today && state.missions.daily.list.length) return;
  const pool = DAILY_TEMPLATES.filter((t) => templateAvailable(state, t));
  const order = seededShuffle(`${today}:${state.rngSeed}`, pool.length);
  const picked = [];
  let adCount = 0;
  for (const i of order) {
    const tpl = pool[i];
    if (tpl.isAd && adCount >= 1) continue; // no máximo 1 missão de anúncio (PRD §15.3)
    if (picked.length >= BALANCE.dailyMissionCount) break;
    picked.push(tpl);
    if (tpl.isAd) adCount++;
  }
  state.missions.daily = { date: today, list: picked.map((t) => makeMissionInstance(state, t)), rerolled: [] };
  markDirty();
}

export function ensureWeeklyMissions(state) {
  const week = localWeekKey();
  if (state.missions.weekly.week === week && state.missions.weekly.list.length) return;
  const pool = WEEKLY_TEMPLATES.filter((t) => templateAvailable(state, t));
  const order = seededShuffle(`${week}:${state.rngSeed}`, pool.length);
  const picked = order.slice(0, BALANCE.weeklyMissionCount).map((i) => pool[i]);
  state.missions.weekly = { week, list: picked.map((t) => makeMissionInstance(state, t)) };
  markDirty();
}

export function rerollDaily(state, index) {
  const inst = state.missions.daily.list[index];
  if (!inst || inst.done || state.missions.daily.rerolled.includes(index)) return false;
  const usedIds = state.missions.daily.list.map((i) => i.tplId);
  const pool = DAILY_TEMPLATES.filter((t) => templateAvailable(state, t) && !usedIds.includes(t.id) && !t.isAd);
  if (!pool.length) return false;
  const order = seededShuffle(`${localDateKey()}:reroll${index}:${state.rngSeed}`, pool.length);
  state.missions.daily.list[index] = makeMissionInstance(state, pool[order[0]]);
  state.missions.daily.rerolled.push(index);
  markDirty();
  emitChange('missions');
  return true;
}

function dailyTpl(id) { return DAILY_TEMPLATES.find((t) => t.id === id); }
function weeklyTpl(id) { return WEEKLY_TEMPLATES.find((t) => t.id === id); }

export function missionProgress(state, inst, tpl) {
  return evaluateCheck(state, tpl.check, inst.baseline);
}

function tickPeriodics(state) {
  ensureDailyMissions(state);
  ensureWeeklyMissions(state);
  for (const inst of state.missions.daily.list) {
    if (!inst.done && missionProgress(state, inst, dailyTpl(inst.tplId)).done) {
      inst.done = true;
      emitChange('missions');
      toast('success', `Missão diária pronta para coletar: ${dailyTpl(inst.tplId).name}`);
    }
  }
  for (const inst of state.missions.weekly.list) {
    if (!inst.done && missionProgress(state, inst, weeklyTpl(inst.tplId)).done) {
      inst.done = true;
      emitChange('missions');
      toast('success', `Objetivo semanal pronto para coletar: ${weeklyTpl(inst.tplId).name}`);
    }
  }
  if (state.settings.autoCollectMissions && game.snapshot?.mods?.automation) {
    state.missions.daily.list.forEach((_, i) => collectDaily(state, i));
    state.missions.weekly.list.forEach((_, i) => collectWeekly(state, i));
  }
}

export function collectDaily(state, index) {
  const inst = state.missions.daily.list[index];
  if (!inst?.done || inst.collected) return false;
  inst.collected = true;
  const tpl = dailyTpl(inst.tplId);
  grantReward(state, tpl.rewardScale, { missionScale: true });
  state.statistics.dailiesCompleted = (state.statistics.dailiesCompleted || 0) + 1;
  state.lifetimeStatistics.dailiesCompleted = (state.lifetimeStatistics.dailiesCompleted || 0) + 1;
  state.statistics.missionsCompleted++;
  state.lifetimeStatistics.missionsCompleted++;
  emitChange('missions');
  return true;
}

export function collectWeekly(state, index) {
  const inst = state.missions.weekly.list[index];
  if (!inst?.done || inst.collected) return false;
  inst.collected = true;
  grantReward(state, weeklyTpl(inst.tplId).rewardScale, { missionScale: true });
  state.statistics.weekliesCompleted = (state.statistics.weekliesCompleted || 0) + 1;
  state.lifetimeStatistics.weekliesCompleted = (state.lifetimeStatistics.weekliesCompleted || 0) + 1;
  emitChange('missions');
  return true;
}

// ————— Conquistas —————

function tickAchievements(state) {
  for (const a of ACHIEVEMENTS) {
    if (state.achievementsDone.includes(a.id)) continue;
    const r = evaluateCheck(state, a.check);
    if (r.done) {
      state.achievementsDone.push(a.id);
      grantReward(state, a.reward);
      bus.emit('celebrate', { text: `Conquista: ${a.name}!` });
      unlockCollectionFromProgress(state);
      emitChange('missions');
    }
  }
}

// ————— Coleção: desbloqueios por origem (PRD §35.3) —————

const COLLECTION_TRIGGERS = [
  { id: 'facade_brick', check: { type: 'chapterDone', value: 2 } },
  { id: 'facade_glass', check: { type: 'roomsOfPropertyUnlocked', property: 'aurora', value: 12 } },
  { id: 'facade_marble', check: { type: 'chapterDone', value: 8 } },
  { id: 'facade_gold', check: { type: 'campaignDone', value: 1 } },
  { id: 'rec_classic', check: { type: 'facilityAt', id: 'recepcao', value: 10 } },
  { id: 'rec_creative', check: { type: 'satisfactionRoom', value: 100 } },
  { id: 'rec_tech', check: { type: 'researchBought', value: 12 } },
  { id: 'rec_council', check: { type: 'chapterDone', value: 12 } },
  { id: 'grd_plaza', check: { type: 'lt_eventsCompleted', value: 10 } },
  { id: 'grd_zen', check: { type: 'avgSatisfaction', value: 90 } },
  { id: 'grd_solar', check: { type: 'facilityAt', id: 'usina_solar', value: 10 } },
  { id: 'lit_neon', check: { type: 'activeSpecialty', specialty: 'tech', value: 5 } },
  { id: 'lit_exec', check: { type: 'managersHired', value: 12 } },
  { id: 'lit_aurora', check: { type: 'prestiges', value: 1 } },
  { id: 'lit_quantum', check: { type: 'roomUnlocked', value: '1102' } },
  { id: 'tr_contract', check: { type: 'lt_contractsSigned', value: 1 } },
  { id: 'tr_building', check: { type: 'roomsOfPropertyUnlocked', property: 'aurora', value: 12 } },
  { id: 'tr_campaign', check: { type: 'campaignDone', value: 1 } },
  { id: 'fx_coins', check: { type: 'prestiges', value: 2 } },
  { id: 'fx_holo', check: { type: 'lt_rivalWins', value: 3 } },
  { id: 'fx_aura', check: { type: 'prestiges', value: 5 } },
  { id: 'fx_skyline', check: { type: 'portfolioValue', value: 1e18 } },
];

export function unlockCollectionFromProgress(state) {
  for (const trig of COLLECTION_TRIGGERS) {
    if (state.collection.owned.includes(trig.id)) continue;
    let done = false;
    if (trig.check.type === 'facilityAt') {
      done = (state.facilities[trig.check.id] ?? -1) >= trig.check.value;
    } else {
      done = evaluateCheck(state, trig.check).done;
    }
    if (done) {
      state.collection.owned.push(trig.id);
      const item = COLLECTION_ITEMS.find((c) => c.id === trig.id);
      bus.emit('celebrate', { text: `Item de coleção desbloqueado: ${item?.name}!` });
      markDirty();
    }
  }
}

// ————— Campanha —————

export function currentChapter(state) {
  return CHAPTERS.find((c) => c.n === state.campaign.chapter) || null;
}

function tickCampaign(state) {
  if (state.campaign.finished) return;
  const ch = currentChapter(state);
  if (!ch) return;
  // Capítulo 12 exige a pesquisa Singularidade para a Zenith existir; objetivos reconhecem antecipados (PRD §30.3)
  let allDone = true;
  for (const obj of ch.objectives) {
    if (state.campaign.objectivesDone.includes(obj.id)) continue;
    const r = evaluateCheck(state, obj.check);
    if (r.done) {
      state.campaign.objectivesDone.push(obj.id);
      state.statistics.chapterStepsDone++;
      state.lifetimeStatistics.chapterStepsDone++;
      toast('success', `Objetivo do capítulo ${ch.n}: ${obj.name} ✓`);
      emitChange('campaign');
    } else {
      allDone = false;
    }
  }
  if (allDone) completeChapter(state, ch);
}

function completeChapter(state, ch) {
  state.campaign.completedChapters = Math.max(state.campaign.completedChapters, ch.n);
  grantReward(state, ch.reward, { sourceLabel: `Capítulo ${ch.n}` });
  // Desbloqueios de sistemas por capítulo
  if (ch.n >= 5) state.hqUnlocked = true;
  if (ch.n >= 6) state.marketUnlocked = true;
  if (ch.n === 7 || ch.n === 10) state.campaign.extraProjectSlots++;
  if (ch.n === 12) {
    state.campaign.finished = true;
    bus.emit('campaign-finale');
  } else {
    state.campaign.chapter = ch.n + 1;
  }
  bus.emit('chapter-complete', ch);
  bus.emit('celebrate', { text: `Capítulo ${ch.n} concluído: ${ch.title}!` });
  unlockCollectionFromProgress(state);
  markDirty();
  emitChange('campaign');
}

// ————— Rival (Augusto) — PRD §34.2 —————

export function maybeOfferRival(state, now = Date.now()) {
  if (state.campaign.completedChapters < 3 || state.campaign.rival) return;
  if (!state.nextRivalAt) state.nextRivalAt = now + 20 * 60_000;
  if (now < state.nextRivalAt) return;
  const pool = RIVAL_GOALS;
  const idx = seededShuffle(`rival:${now}:${state.rngSeed}`, pool.length)[0];
  const goal = pool[idx];
  const baseline = makeMissionInstance(state, { id: goal.id, check: { type: goal.type, value: goal.value } }).baseline;
  state.campaign.rival = {
    goalId: goal.id, baseline, offeredAt: now,
    deadline: now + goal.minutes * 60_000, accepted: false,
  };
  state.nextRivalAt = now + 45 * 60_000;
  bus.emit('rival-offer');
  markDirty();
}

export function acceptRival(state) {
  if (state.campaign.rival) { state.campaign.rival.accepted = true; markDirty(); emitChange('campaign'); }
}

export function declineRival(state) {
  if (state.campaign.rival) {
    state.campaign.rivalHistory.push({ goalId: state.campaign.rival.goalId, result: 'recusado' });
    state.campaign.rival = null;
    markDirty();
    emitChange('campaign');
  }
}

function tickRival(state, now = Date.now()) {
  const rv = state.campaign.rival;
  if (!rv?.accepted) return;
  const goal = RIVAL_GOALS.find((g) => g.id === rv.goalId);
  if (!goal) { state.campaign.rival = null; return; }
  const r = evaluateCheck(state, { type: goal.type, value: goal.value }, rv.baseline);
  if (r.done) {
    state.statistics.rivalWins++;
    state.lifetimeStatistics.rivalWins++;
    grantReward(state, goal.reward);
    state.campaign.rivalHistory.push({ goalId: goal.id, result: 'vitória' });
    state.campaign.rival = null;
    bus.emit('celebrate', { text: 'Você venceu a meta do Augusto!' });
    emitChange('campaign');
  } else if (now > rv.deadline) {
    state.campaign.rivalHistory.push({ goalId: goal.id, result: 'derrota' });
    state.campaign.rival = null;
    toast('info', 'O prazo do Augusto acabou. Ele está insuportável, mas você não perdeu nada.');
    emitChange('campaign');
  }
}

// ————— Calendário de retorno (PRD §36.3) —————

export function loginCalendarStatus(state) {
  const today = localDateKey();
  const claimedToday = state.dailyLogin.lastClaimDate === today;
  const nextDay = claimedToday ? state.dailyLogin.cycleDay : (state.dailyLogin.cycleDay % 7) + 1;
  return { claimedToday, nextDay, cycleDay: state.dailyLogin.cycleDay };
}

export function claimDailyLogin(state) {
  const today = localDateKey();
  if (state.dailyLogin.lastClaimDate === today) return false;
  const day = (state.dailyLogin.cycleDay % 7) + 1;
  const entry = LOGIN_CALENDAR[day - 1];
  grantReward(state, entry.reward);
  state.dailyLogin = { cycleDay: day === 7 ? 0 : day, lastClaimDate: today };
  toast('success', `Calendário de retorno — dia ${day}: ${entry.label}`);
  markDirty();
  emitChange('missions');
  return true;
}

// ————— Registro diário de jogo —————

function trackDayPlayed(state) {
  const today = localDateKey();
  for (const stats of [state.statistics, state.lifetimeStatistics]) {
    if (!Array.isArray(stats.daysPlayed)) stats.daysPlayed = [];
    if (!stats.daysPlayed.includes(today)) stats.daysPlayed.push(today);
  }
}

// ————— Tique principal da progressão —————

let tickCounter = 0;

export function tickProgression(state, now = Date.now()) {
  tickTutorial(state);
  tickCampaign(state);
  tickRival(state, now);
  // Verificações mais pesadas: a cada 2 segundos
  if (tickCounter++ % 2 === 0) {
    tickMilestones(state);
    tickPeriodics(state);
    tickAchievements(state);
    unlockCollectionFromProgress(state);
    maybeOfferRival(state, now);
    trackDayPlayed(state);
  }
}
