// Estado central — única fonte de verdade (PRD §26.3).
// A UI nunca altera o estado diretamente: ações vivem em src/systems/.

import { BALANCE } from '../data/balance.js';
import { OFFICES, FLOORS, FACILITIES, PROPERTIES, HQ_DEPARTMENTS } from '../data/buildings.js';
import { bus } from './bus.js';

export const SAVE_VERSION = 3;

/** Estatísticas zeradas (por ciclo). */
export function freshStats() {
  return {
    playSeconds: 0,
    moneyEarned: 0,
    moneySpent: 0,
    upgradesBought: 0,
    contractsSigned: 0,
    newContractsSigned: 0,
    taps: 0,
    adsWatched: 0,
    simulatedPurchases: 0,
    facilityUpgrades: 0,
    managersTrained: 0,
    managersHiredCount: 0,
    offlineCollections: 0,
    offlineSecondsRewarded: 0,
    offlineMaxHours: 0,
    eventsCompleted: 0,
    missionsCompleted: 0,
    dailiesCompleted: 0,
    weekliesCompleted: 0,
    projectsCompleted: 0,
    excellentProjects: 0,
    conditionRestored: 0,
    maintenancesDone: 0,
    requestsCompleted: 0,
    ppEarned: 0,
    repEarned: 0,
    rivalWins: 0,
    itemsEquipped: 0,
    chapterStepsDone: 0,
    researchBought: 0,
    roomPremium: 0,
    maxIncomeRate: 0,
    daysPlayed: [],
    marketConditionsSeen: [],
    negativeMarketDays: 0,
  };
}

/** Estado das salas: todas bloqueadas exceto a 101 (PRD §10.2). */
function freshRooms() {
  const rooms = {};
  for (const o of OFFICES) {
    rooms[o.id] = { unlocked: o.id === '101', structure: 0, tech: 0, comfort: 0, permBonus: 0, milestones: [] };
  }
  return rooms;
}

function freshFloors() {
  const floors = {};
  for (const f of FLOORS) floors[f.id] = f.id === 'aurora_1';
  return floors;
}

function freshFacilities() {
  const fac = {};
  for (const f of FACILITIES) fac[f.id] = -1; // -1 = não construída
  return fac;
}

function freshHq() {
  const hq = {};
  for (const d of HQ_DEPARTMENTS) hq[d.id] = 0;
  return hq;
}

/** Cria um estado de ciclo novo (usado no início e após Prestígio). */
export function freshCycleState() {
  return {
    balance: BALANCE.initialBalance,
    reputation: BALANCE.initialReputation,
    researchPoints: 0,
    rooms: freshRooms(),
    floors: freshFloors(),
    facilities: freshFacilities(),
    hqDepartments: freshHq(),
    tenantsByRoom: { 101: 'T01' },       // contrato inicial gratuito (PRD §10.2)
    discoveredTenants: ['T01'],
    repGrantedTenants: ['T01'],
    hiredManagers: {},
    managerAssignments: {},
    researchNodes: [],
    patentBonusCycle: 0,
    properties: { aurora: true, torre: false, campus: false },
    currentProperty: 'aurora',
    propertyCondition: { aurora: 100, torre: 100, campus: 100 },
    tenantRequests: [],
    nextRequestAt: 0,
    projects: { active: [], history: [] },
    activeEffects: [],
    boostExpiresAt: 0,
    adReduction: { upgradesLeft: 0, discount: 0 },
    investorAvailableAt: 0,
    events: { nextAt: 0, pending: null, resolvedCount: 0 },
    spentTotals: { rooms: 0, upgrades: 0, facilities: 0, managers: 0, contracts: 0 },
    statistics: freshStats(),
  };
}

/** Estado completo de um save novo (V3). */
export function freshState(now = Date.now()) {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    lastSavedAt: now,
    currentCycle: 1,
    rngSeed: (now ^ 0x9E3779B9) >>> 0,

    ...freshCycleState(),

    // Persistente entre Prestígios (PRD §19.5)
    legacyPoints: 0,
    legacyUpgrades: {},
    prestigeCount: 0,
    prestigeHistory: [],
    achievementsDone: [],
    lifetimeStatistics: freshStats(),
    permanentMultipliers: { income: 0, offlineHours: 0 },
    purchases: [],
    inventory: { skip4h: 0, skip24h: 0, instantProject: 0 },
    renovations: { count: 0, discount: 0 },
    collection: { owned: [], equipped: { aurora: {}, torre: {}, campus: {} } },
    challenges: { medals: {}, completed: [] },
    empireMode: { active: false, councilGoal: null, bestCycleSeconds: 0 },

    // Missões e campanha
    missions: {
      tutorialIndex: 0,
      tutorialCollected: [],
      milestonesDone: [],
      milestonesCollected: [],
      daily: { date: null, list: [], rerolled: [] },
      weekly: { week: null, list: [] },
      baseline: { income: 0, portfolio: 0 },
    },
    campaign: {
      chapter: 1,
      completedChapters: 0,
      objectivesDone: [],
      introSeen: [],
      finished: false,
      extraProjectSlots: 0,
      rival: null,             // meta ativa do rival
      rivalHistory: [],
    },
    hqUnlocked: false,
    marketUnlocked: false,
    marketCondition: { date: null, id: 'mk11' },
    dailyLogin: { cycleDay: 0, lastClaimDate: null },

    // Sessão / interface
    onboarding: { step: 0, done: false },
    settings: {
      sound: true, music: true, reducedMotion: false, autoBuy: false,
      autoCollectMissions: false, reserveMoney: 0, helpSeen: [],
    },
    offlineLimitHours: BALANCE.offlineLimitHoursDefault,
  };
}

// ————— Instância global —————

export const game = {
  state: null,
  snapshot: null,          // último snapshot econômico
  dirty: false,            // pede salvamento
  sessionStart: Date.now(),
  challengeRun: null,      // execução de cenário de desafio (estado separado)
};

export function markDirty() {
  game.dirty = true;
}

/** Snapshot econômico correto para o estado dado (save principal ou cenário de desafio). */
export function snapFor(state) {
  if (game.challengeRun && game.challengeRun.state === state) return game.challengeRun.snapshot;
  return game.snapshot;
}

/** Estado ativo para a UI: cenário em execução ou save principal. */
export function activeState() {
  return game.challengeRun && !game.challengeRun.finished ? game.challengeRun.state : game.state;
}

export function emitChange(scope = 'state') {
  bus.emit('change', scope);
}
