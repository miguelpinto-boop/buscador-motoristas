// Eventos aleatórios, mercado dinâmico e solicitações de inquilinos — PRD §17, §33.2, §34.1.

import { BALANCE } from '../data/balance.js';
import { EVENTS, eventById } from '../data/events.js';
import { MARKET_CONDITIONS, marketById, TENANT_REQUESTS } from '../data/extras.js';
import { FACILITIES, OFFICES, PROPERTIES } from '../data/buildings.js';
import { managerById } from '../data/managers.js';
import { game, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { nextRandom, randomInt, seededPick } from '../core/rng.js';
import { localDateKey } from '../core/format.js';
import { earn, spend, grantRep, grantPP, addEffect } from './actions.js';

const toast = (type, text) => bus.emit('toast', { type, text });

// ————— Eventos aleatórios —————

function scheduleNextEvent(state, now = Date.now()) {
  const interval = state.challengeMods?.eventEveryMs
    ?? randomInt(state, BALANCE.eventIntervalMinMs, BALANCE.eventIntervalMaxMs);
  state.events.nextAt = now + interval;
  markDirty();
}

/** Verifica o requisito especial de uma escolha (PRD §17.2). */
export function specialMet(state, req) {
  if (!req) return false;
  const snap = snapFor(state);
  if (req.facility) return (state.facilities[req.facility.id] ?? -1) >= req.facility.level;
  if (req.structureAvg) {
    const rooms = Object.values(state.rooms).filter((r) => r.unlocked);
    const avg = rooms.reduce((a, r) => a + r.structure, 0) / Math.max(1, rooms.length);
    return avg >= req.structureAvg;
  }
  if (req.satisfactionAvg) return (snap?.avgSatisfaction || 0) >= req.satisfactionAvg;
  if (req.rep) return state.reputation >= req.rep;
  if (req.hq) return (state.hqDepartments[req.hq] || 0) >= 1;
  if (req.managerSpecialty) {
    return Object.keys(state.hiredManagers).some((id) => {
      const d = managerById(id);
      return d && (d.bonus.specialty === req.managerSpecialty || d.bonus5?.specialty === req.managerSpecialty
        || d.bonus.specialties?.includes(req.managerSpecialty) || d.bonus5?.specialties?.includes(req.managerSpecialty));
    });
  }
  if (req.managerType) {
    return Object.keys(state.hiredManagers).some((id) => {
      const d = managerById(id);
      return d && (d.bonus.type === req.managerType || d.bonus5?.type === req.managerType);
    });
  }
  if (req.research) return state.researchNodes.includes(req.research);
  if (req.chapterDone) return state.campaign.completedChapters >= req.chapterDone;
  if (req.greenFacility) return FACILITIES.some((f) => f.green && (state.facilities[f.id] ?? -1) >= 0);
  if (req.collectionCount) return state.collection.owned.length >= req.collectionCount;
  if (req.roomUnlocked) return !!state.rooms[req.roomUnlocked]?.unlocked;
  if (req.projectSlotFree) return state.projects.active.length < (snapFor(state)?.mods?.projectSlots || 1);
  return false;
}

export function maybeTriggerEvent(state, now = Date.now()) {
  if (state.events.pending) return;
  if (document.hidden) return;                              // pausa com aba oculta (PRD §17.1)
  if (bus._modalOpen) return;                               // não surgir sobre outro modal
  if (state.events.nextAt === 0) { scheduleNextEvent(state, now); return; }
  if (now < state.events.nextAt) return;
  // Sem eventos negativos nos primeiros minutos do save (PRD §24.2)
  const saveAgeMin = (now - state.createdAt) / 60_000;
  let pool = EVENTS;
  if (saveAgeMin < BALANCE.eventGraceMinutes) pool = EVENTS.filter((e) => !e.negative);
  if (!pool.length) { scheduleNextEvent(state, now); return; }
  const ev = pool[Math.floor(nextRandom(state) * pool.length)];
  state.events.pending = { id: ev.id, startedAt: now, deadline: now + BALANCE.eventDecisionSeconds * 1000, pausedAt: null };
  markDirty();
  bus.emit('event-show');
}

/** Aplica um pacote de resultados de evento. */
function applyOutcome(state, out, penaltyReduction) {
  const parts = [];
  const income = snapFor(state)?.totalPerSec || 1;
  const reduce = (v) => v * (1 - penaltyReduction);
  if (out.chance !== undefined) {
    const roll = nextRandom(state);
    const branch = roll < out.chance ? out.win : out.lose;
    return applyOutcome(state, branch || {}, penaltyReduction);
  }
  if (out.costSeconds) {
    const cost = Math.min(state.balance, Math.ceil(reduce(income * out.costSeconds)));
    if (cost > 0) { state.balance -= cost; state.statistics.moneySpent += cost; state.lifetimeStatistics.moneySpent += cost; parts.push(`-$${Math.round(cost).toLocaleString('pt-BR')}`); }
  }
  if (out.gainSeconds) { const v = income * out.gainSeconds; earn(state, v); parts.push('+dinheiro'); }
  if (out.rep) {
    if (out.rep > 0) { grantRep(state, out.rep); parts.push(`+${out.rep} REP`); }
    else { state.reputation = Math.max(0, state.reputation + reduce(out.rep)); parts.push(`${out.rep} REP`); }
  }
  if (out.pp) { grantPP(state, out.pp); parts.push(`+${out.pp} PP`); }
  if (out.condition) {
    const prop = state.currentProperty;
    const delta = out.condition < 0 ? reduce(out.condition) : out.condition;
    state.propertyCondition[prop] = Math.max(0, Math.min(100, (state.propertyCondition[prop] ?? 100) + delta));
    parts.push(`condição ${delta > 0 ? '+' : ''}${Math.round(delta)}`);
  }
  if (out.effect) {
    let { kind, value, minutes } = out.effect;
    if (value < 0) value = -reduce(-value);
    const positiveBonus = snapFor(state)?.mods?.eventPositiveBonus || 0;
    if (value > 0 && positiveBonus) minutes = minutes * (1 + positiveBonus);
    addEffect(state, kind, value, minutes, 'Evento');
    parts.push(value > 0 ? 'bônus temporário' : 'efeito temporário');
  }
  return parts;
}

export function resolveEvent(state, choiceIndex) {
  const pending = state.events.pending;
  if (!pending) return false;
  const ev = eventById(pending.id);
  state.events.pending = null;
  if (!ev) { scheduleNextEvent(state); return false; }
  const choice = ev.choices[choiceIndex] || ev.choices[0];
  const penaltyReduction = snapFor(state)?.mods?.eventPenaltyReduction || 0;
  let out = choice.out;
  let specialText = null;
  if (choice.special && specialMet(state, choice.special.req)) {
    out = choice.special.out;
    specialText = choice.special.text;
  }
  const parts = applyOutcome(state, out, penaltyReduction);
  state.events.resolvedCount++;
  state.statistics.eventsCompleted++;
  state.lifetimeStatistics.eventsCompleted++;
  scheduleNextEvent(state);
  emitChange('economy');
  bus.emit('event-resolved', { event: ev, choice, parts, specialText });
  return true;
}

/** Tempo esgotado: aplica a escolha B (mais conservadora) automaticamente. */
export function expireEvent(state) {
  if (!state.events.pending) return;
  resolveEvent(state, 1);
}

// Pausa o cronômetro do evento com a aba oculta (PRD §17.1)
export function pauseEventTimer(state, now = Date.now()) {
  if (state.events.pending && !state.events.pending.pausedAt) state.events.pending.pausedAt = now;
}
export function resumeEventTimer(state, now = Date.now()) {
  const p = state.events.pending;
  if (p?.pausedAt) {
    p.deadline += now - p.pausedAt;
    p.pausedAt = null;
  }
}

// ————— Mercado dinâmico (PRD §34.1) —————

export function ensureMarketCondition(state) {
  if (!state.marketUnlocked) return;
  const today = localDateKey();
  if (state.marketCondition.date === today) return;
  const shuffleKey = state.challengeMods?.marketShuffleMs
    ? `${today}:${Math.floor(Date.now() / state.challengeMods.marketShuffleMs)}`
    : today;
  const idx = seededPick(`${shuffleKey}:${state.createdAt}`, MARKET_CONDITIONS.length);
  const cond = MARKET_CONDITIONS[idx];
  state.marketCondition = { date: today, id: cond.id };
  if (!state.lifetimeStatistics.marketConditionsSeen.includes(cond.id)) {
    state.lifetimeStatistics.marketConditionsSeen.push(cond.id);
  }
  if (cond.penalty && Object.keys(cond.penalty).length) state.lifetimeStatistics.negativeMarketDays++;
  toast('info', `Mercado de hoje: ${cond.icon} ${cond.name} — ${cond.desc}`);
  markDirty();
}

// ————— Solicitações de inquilinos (PRD §33.2) —————

export function maybeCreateRequest(state, now = Date.now()) {
  if (state.campaign.completedChapters < 5) return;
  if (state.tenantRequests.length >= 3) return;
  if (!state.nextRequestAt) { state.nextRequestAt = now + 8 * 60_000; return; }
  if (now < state.nextRequestAt) return;
  const occupied = Object.keys(state.tenantsByRoom);
  if (!occupied.length) return;
  const tpl = TENANT_REQUESTS[Math.floor(nextRandom(state) * TENANT_REQUESTS.length)];
  const roomId = occupied[Math.floor(nextRandom(state) * occupied.length)];
  state.tenantRequests.push({ ...tpl, roomId, createdAt: now, expiresAt: now + 2 * 3600e3 });
  state.nextRequestAt = now + randomInt(state, 10, 20) * 60_000;
  toast('info', `Nova solicitação de inquilino: ${tpl.name}`);
  markDirty();
  emitChange('state');
}

export function expireRequests(state, now = Date.now()) {
  const before = state.tenantRequests.length;
  state.tenantRequests = state.tenantRequests.filter((r) => r.expiresAt > now);
  if (state.tenantRequests.length !== before) { markDirty(); emitChange('state'); }
}
