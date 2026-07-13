// Salvamento V3 — PRD §25 e §43.
// Save principal + backup automático + checkpoint de Prestígio + export/import.
// Validação defensiva: NaN/Infinity/negativos corrigidos, IDs desconhecidos ignorados.

import { BALANCE } from '../data/balance.js';
import { SAVE_VERSION, freshState, freshStats, game } from '../core/store.js';
import { sanitizeNumber } from '../core/formulas.js';
import { OFFICES, FLOORS, FACILITIES, HQ_DEPARTMENTS } from '../data/buildings.js';
import { COMPANIES } from '../data/companies.js';
import { MANAGERS } from '../data/managers.js';
import { LEGACY_UPGRADES } from '../data/prestige.js';
import { RESEARCH } from '../data/research.js';
import { COLLECTION_ITEMS } from '../data/extras.js';
import { bus } from '../core/bus.js';

// Checksum simples (FNV-1a) para detectar corrupção (PRD §43.2)
function checksum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function serialize(state) {
  const body = JSON.stringify(state);
  return JSON.stringify({ v: SAVE_VERSION, c: checksum(body), body });
}

export function deserialize(raw) {
  const wrapper = JSON.parse(raw);
  if (wrapper && typeof wrapper === 'object' && 'body' in wrapper) {
    if (wrapper.c && checksum(wrapper.body) !== wrapper.c) {
      throw new Error('checksum');
    }
    return JSON.parse(wrapper.body);
  }
  return wrapper; // formato antigo sem envelope (V2)
}

// ————— Migração V2 → V3 (PRD §43.2) —————
// V2 era um objeto plano sem envelope, com chaves em inglês parecidas.
function migrateV2toV3(old) {
  const s = freshState(old.createdAt || Date.now());
  s.balance = sanitizeNumber(old.balance ?? old.money, s.balance, 0);
  s.reputation = sanitizeNumber(old.reputation ?? old.rep, 0, 0);
  s.legacyPoints = sanitizeNumber(old.legacyPoints, 0, 0);
  s.prestigeCount = sanitizeNumber(old.prestigeCount ?? old.prestiges, 0, 0);
  if (old.rooms && typeof old.rooms === 'object') {
    for (const [id, r] of Object.entries(old.rooms)) {
      if (s.rooms[id] && r && typeof r === 'object') {
        s.rooms[id].unlocked = !!r.unlocked;
        s.rooms[id].structure = sanitizeNumber(r.structure ?? r.estrutura, 0, 0);
        s.rooms[id].tech = sanitizeNumber(r.tech ?? r.tecnologia, 0, 0);
        s.rooms[id].comfort = sanitizeNumber(r.comfort ?? r.conforto, 0, 0);
      }
    }
  }
  s.rooms['101'].unlocked = true;
  return s;
}

const MIGRATIONS = { 2: migrateV2toV3 };

// ————— Validação (PRD §25.4) —————

const validIds = {
  office: new Set(OFFICES.map((o) => o.id)),
  floor: new Set(FLOORS.map((f) => f.id)),
  facility: new Set(FACILITIES.map((f) => f.id)),
  company: new Set(COMPANIES.map((c) => c.id)),
  manager: new Set(MANAGERS.map((m) => m.id)),
  legacy: new Set(LEGACY_UPGRADES.map((l) => l.id)),
  research: new Set(RESEARCH.map((r) => r.id)),
  collection: new Set(COLLECTION_ITEMS.map((c) => c.id)),
  hq: new Set(HQ_DEPARTMENTS.map((d) => d.id)),
};

function sanitizeStats(target, source) {
  const clean = freshStats();
  if (source && typeof source === 'object') {
    for (const k of Object.keys(clean)) {
      if (Array.isArray(clean[k])) {
        clean[k] = Array.isArray(source[k]) ? source[k].slice(0, 400) : [];
      } else {
        clean[k] = sanitizeNumber(source[k], 0, 0);
      }
    }
  }
  return clean;
}

/** Preenche campos ausentes, corrige tipos e remove IDs desconhecidos. */
export function validateState(data) {
  const base = freshState(data.createdAt || Date.now());
  const s = { ...base, ...data };
  s.saveVersion = SAVE_VERSION;
  const now = Date.now();

  s.balance = sanitizeNumber(s.balance, base.balance, -1e6);
  s.reputation = sanitizeNumber(s.reputation, 0, 0);
  s.legacyPoints = sanitizeNumber(s.legacyPoints, 0, 0);
  s.researchPoints = sanitizeNumber(s.researchPoints, 0, 0);
  s.currentCycle = sanitizeNumber(s.currentCycle, 1, 1);
  s.prestigeCount = sanitizeNumber(s.prestigeCount, 0, 0);
  s.rngSeed = sanitizeNumber(s.rngSeed, base.rngSeed, 0) >>> 0;
  s.createdAt = sanitizeNumber(s.createdAt, now, 0);
  s.lastSavedAt = Math.min(sanitizeNumber(s.lastSavedAt, now, 0), now + 60_000);

  // Salas
  const rooms = base.rooms;
  if (s.rooms && typeof s.rooms === 'object') {
    for (const [id, r] of Object.entries(s.rooms)) {
      if (!validIds.office.has(id) || !r || typeof r !== 'object') continue;
      const office = OFFICES.find((o) => o.id === id);
      rooms[id] = {
        unlocked: !!r.unlocked,
        structure: Math.floor(sanitizeNumber(r.structure, 0, 0, office.maxLevel)),
        tech: Math.floor(sanitizeNumber(r.tech, 0, 0, office.maxLevel)),
        comfort: Math.floor(sanitizeNumber(r.comfort, 0, 0, office.maxLevel)),
        permBonus: sanitizeNumber(r.permBonus, 0, 0, 1),
        milestones: Array.isArray(r.milestones) ? r.milestones.filter((x) => typeof x === 'number') : [],
      };
    }
  }
  rooms['101'].unlocked = true;
  s.rooms = rooms;

  // Andares / instalações / sede
  const floors = base.floors;
  if (s.floors) for (const id of Object.keys(s.floors)) if (validIds.floor.has(id)) floors[id] = !!s.floors[id];
  floors.aurora_1 = true;
  s.floors = floors;

  const fac = base.facilities;
  if (s.facilities) {
    for (const [id, lvl] of Object.entries(s.facilities)) {
      if (validIds.facility.has(id)) {
        const def = FACILITIES.find((f) => f.id === id);
        fac[id] = Math.floor(sanitizeNumber(lvl, -1, -1, def.maxLevel));
      }
    }
  }
  s.facilities = fac;

  const hq = base.hqDepartments;
  if (s.hqDepartments) {
    for (const [id, lvl] of Object.entries(s.hqDepartments)) {
      if (validIds.hq.has(id)) hq[id] = Math.floor(sanitizeNumber(lvl, 0, 0, 20));
    }
  }
  s.hqDepartments = hq;

  // Inquilinos e gestores
  const tenants = {};
  if (s.tenantsByRoom) {
    for (const [roomId, cId] of Object.entries(s.tenantsByRoom)) {
      if (validIds.office.has(roomId) && validIds.company.has(cId) && s.rooms[roomId].unlocked) tenants[roomId] = cId;
    }
  }
  if (!tenants['101'] && Object.keys(tenants).length === 0) tenants['101'] = 'T01';
  s.tenantsByRoom = tenants;
  s.discoveredTenants = (Array.isArray(s.discoveredTenants) ? s.discoveredTenants : ['T01']).filter((id) => validIds.company.has(id));
  if (!s.discoveredTenants.includes('T01')) s.discoveredTenants.push('T01');
  s.repGrantedTenants = (Array.isArray(s.repGrantedTenants) ? s.repGrantedTenants : ['T01']).filter((id) => validIds.company.has(id));

  const hired = {};
  if (s.hiredManagers) {
    for (const [id, m] of Object.entries(s.hiredManagers)) {
      if (validIds.manager.has(id) && m) hired[id] = { level: Math.floor(sanitizeNumber(m.level, 1, 1, BALANCE.managerMaxLevel)), xp: sanitizeNumber(m.xp, 0, 0) };
    }
  }
  s.hiredManagers = hired;
  const assigns = {};
  if (s.managerAssignments) {
    const used = new Set();
    for (const [floorId, mgrId] of Object.entries(s.managerAssignments)) {
      if (validIds.floor.has(floorId) && hired[mgrId] && !used.has(mgrId)) {
        assigns[floorId] = mgrId;
        used.add(mgrId);
      }
    }
  }
  s.managerAssignments = assigns;

  // Pesquisa / legado / coleção
  s.researchNodes = (Array.isArray(s.researchNodes) ? s.researchNodes : []).filter((id) => validIds.research.has(id));
  const legacy = {};
  if (s.legacyUpgrades) {
    for (const [id, lvl] of Object.entries(s.legacyUpgrades)) {
      if (validIds.legacy.has(id)) {
        const def = LEGACY_UPGRADES.find((l) => l.id === id);
        legacy[id] = Math.floor(sanitizeNumber(lvl, 0, 0, def.maxLevel));
      }
    }
  }
  s.legacyUpgrades = legacy;
  if (!s.collection || typeof s.collection !== 'object') s.collection = base.collection;
  s.collection.owned = (Array.isArray(s.collection.owned) ? s.collection.owned : []).filter((id) => validIds.collection.has(id));
  if (!s.collection.equipped || typeof s.collection.equipped !== 'object') s.collection.equipped = base.collection.equipped;
  for (const prop of ['aurora', 'torre', 'campus']) {
    if (!s.collection.equipped[prop] || typeof s.collection.equipped[prop] !== 'object') s.collection.equipped[prop] = {};
    for (const [cat, itemId] of Object.entries(s.collection.equipped[prop])) {
      if (!s.collection.owned.includes(itemId)) delete s.collection.equipped[prop][cat];
    }
  }

  // Efeitos ativos: remove expirados e inválidos (PRD §25.4)
  s.activeEffects = (Array.isArray(s.activeEffects) ? s.activeEffects : [])
    .filter((fx) => fx && typeof fx === 'object' && fx.expiresAt > now && ['income', 'satisfaction', 'upgradeDiscount'].includes(fx.kind))
    .map((fx) => ({ kind: fx.kind, value: sanitizeNumber(fx.value, 0, -0.2, 5), expiresAt: sanitizeNumber(fx.expiresAt, now, 0), source: String(fx.source || '') }));
  s.boostExpiresAt = sanitizeNumber(s.boostExpiresAt, 0, 0, now + 48 * 3600e3);

  // Projetos ativos
  if (!s.projects || typeof s.projects !== 'object') s.projects = base.projects;
  s.projects.active = (Array.isArray(s.projects.active) ? s.projects.active : [])
    .filter((p) => p && typeof p.id === 'string')
    .map((p) => ({ id: p.id, startedAt: sanitizeNumber(p.startedAt, now, 0), endsAt: sanitizeNumber(p.endsAt, now, 0), seed: sanitizeNumber(p.seed, 1, 0) >>> 0, collected: !!p.collected }));
  s.projects.history = Array.isArray(s.projects.history) ? s.projects.history.slice(-50) : [];

  // Condição das propriedades
  if (!s.propertyCondition || typeof s.propertyCondition !== 'object') s.propertyCondition = base.propertyCondition;
  for (const p of ['aurora', 'torre', 'campus']) {
    s.propertyCondition[p] = sanitizeNumber(s.propertyCondition[p], 100, 0, 100);
  }
  if (!s.properties || typeof s.properties !== 'object') s.properties = base.properties;
  s.properties.aurora = true;
  if (!['aurora', 'torre', 'campus'].includes(s.currentProperty) || !s.properties[s.currentProperty]) s.currentProperty = 'aurora';

  // Estatísticas
  s.statistics = sanitizeStats(base.statistics, s.statistics);
  s.lifetimeStatistics = sanitizeStats(base.lifetimeStatistics, s.lifetimeStatistics);
  if (!s.spentTotals || typeof s.spentTotals !== 'object') s.spentTotals = base.spentTotals;
  for (const k of ['rooms', 'upgrades', 'facilities', 'managers', 'contracts']) {
    s.spentTotals[k] = sanitizeNumber(s.spentTotals[k], 0, 0);
  }

  // Missões e campanha: garante estruturas
  if (!s.missions || typeof s.missions !== 'object') s.missions = base.missions;
  for (const k of Object.keys(base.missions)) if (s.missions[k] === undefined) s.missions[k] = base.missions[k];
  s.missions.tutorialIndex = Math.floor(sanitizeNumber(s.missions.tutorialIndex, 0, 0, 15));
  if (!s.campaign || typeof s.campaign !== 'object') s.campaign = base.campaign;
  for (const k of Object.keys(base.campaign)) if (s.campaign[k] === undefined) s.campaign[k] = base.campaign[k];
  s.campaign.chapter = Math.floor(sanitizeNumber(s.campaign.chapter, 1, 1, 13));
  s.campaign.completedChapters = Math.floor(sanitizeNumber(s.campaign.completedChapters, 0, 0, 12));

  if (!s.settings || typeof s.settings !== 'object') s.settings = base.settings;
  for (const k of Object.keys(base.settings)) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
  if (!s.inventory || typeof s.inventory !== 'object') s.inventory = base.inventory;
  for (const k of Object.keys(base.inventory)) s.inventory[k] = Math.floor(sanitizeNumber(s.inventory[k], 0, 0));
  s.purchases = (Array.isArray(s.purchases) ? s.purchases : []).filter((p) => typeof p === 'string');
  if (!s.permanentMultipliers || typeof s.permanentMultipliers !== 'object') s.permanentMultipliers = base.permanentMultipliers;
  s.permanentMultipliers.income = sanitizeNumber(s.permanentMultipliers.income, 0, 0, 2);
  s.permanentMultipliers.offlineHours = sanitizeNumber(s.permanentMultipliers.offlineHours, 0, 0, 36);
  s.achievementsDone = (Array.isArray(s.achievementsDone) ? s.achievementsDone : []).filter((a) => typeof a === 'string');
  if (!s.challenges || typeof s.challenges !== 'object') s.challenges = base.challenges;
  if (!s.challenges.medals || typeof s.challenges.medals !== 'object') s.challenges.medals = {};
  s.challenges.completed = Array.isArray(s.challenges.completed) ? s.challenges.completed : [];
  if (!s.empireMode || typeof s.empireMode !== 'object') s.empireMode = base.empireMode;
  if (!s.dailyLogin || typeof s.dailyLogin !== 'object') s.dailyLogin = base.dailyLogin;
  if (!s.events || typeof s.events !== 'object') s.events = base.events;
  s.events.pending = null; // evento pendente não sobrevive ao reload (o cronômetro seria injusto)
  if (!s.onboarding || typeof s.onboarding !== 'object') s.onboarding = base.onboarding;
  if (!s.adReduction || typeof s.adReduction !== 'object') s.adReduction = base.adReduction;
  s.adReduction.upgradesLeft = Math.floor(sanitizeNumber(s.adReduction.upgradesLeft, 0, 0, BALANCE.ads.renovationMaxUpgrades));
  if (!s.renovations || typeof s.renovations !== 'object') s.renovations = base.renovations;
  s.tenantRequests = (Array.isArray(s.tenantRequests) ? s.tenantRequests : []).slice(0, 3);
  if (!s.marketCondition || typeof s.marketCondition !== 'object') s.marketCondition = base.marketCondition;
  s.offlineLimitHours = sanitizeNumber(s.offlineLimitHours, BALANCE.offlineLimitHoursDefault, 1, BALANCE.offlineLimitHoursMax);

  return s;
}

// ————— Carregar / salvar —————

export function loadRaw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function parseAndMigrate(raw) {
  let data = deserialize(raw);
  if (!data || typeof data !== 'object') throw new Error('save inválido');
  let v = sanitizeNumber(data.saveVersion, 2, 0);
  if (v > SAVE_VERSION) throw new Error('save de versão mais nova');
  while (v < SAVE_VERSION) {
    const mig = MIGRATIONS[v];
    data = mig ? mig(data) : data;
    v += 1;
    data.saveVersion = v;
  }
  return validateState(data);
}

/** Carrega o save; em caso de falha, tenta o backup; senão, estado novo. */
export function loadGame() {
  const attempts = [BALANCE.saveKey, BALANCE.backupKey];
  for (const key of attempts) {
    const raw = loadRaw(key);
    if (!raw) continue;
    try {
      const state = parseAndMigrate(raw);
      if (key === BALANCE.backupKey) console.warn('Save principal corrompido — backup restaurado.');
      return { state, isNew: false, fromBackup: key === BALANCE.backupKey };
    } catch (err) {
      console.error(`Falha ao carregar ${key}:`, err);
    }
  }
  return { state: freshState(), isNew: true, fromBackup: false };
}

let lastBackupAt = 0;

/** Salva o estado atual. Mantém backup do save anterior (escrita segura, PRD §43.1). */
export function saveGame(state, { backup = false } = {}) {
  try {
    state.lastSavedAt = Date.now();
    const current = loadRaw(BALANCE.saveKey);
    // Backup do save anterior a cada 5 minutos ou quando pedido
    if (current && (backup || Date.now() - lastBackupAt > 5 * 60_000)) {
      try { localStorage.setItem(BALANCE.backupKey, current); lastBackupAt = Date.now(); } catch { /* espaço cheio: segue sem backup */ }
    }
    localStorage.setItem(BALANCE.saveKey, serialize(state));
    game.dirty = false;
    return true;
  } catch (err) {
    console.error('Falha ao salvar:', err);
    bus.emit('toast', { type: 'error', text: 'Não foi possível salvar o progresso.' });
    return false;
  }
}

/** Checkpoint antes do Prestígio (PRD §43.1). */
export function savePrestigeCheckpoint(state) {
  try { localStorage.setItem(BALANCE.checkpointKey, serialize(state)); } catch { /* ignora */ }
}

export function restorePrestigeCheckpoint() {
  const raw = loadRaw(BALANCE.checkpointKey);
  if (!raw) return null;
  try { return parseAndMigrate(raw); } catch { return null; }
}

export function restoreBackup() {
  const raw = loadRaw(BALANCE.backupKey);
  if (!raw) return null;
  try { return parseAndMigrate(raw); } catch { return null; }
}

// ————— Exportação / importação (PRD §25.5) —————

export function exportSave(state) {
  return serialize(state);
}

/** Valida um texto de save e devolve um resumo para pré-visualização. */
export function previewImport(text) {
  const state = parseAndMigrate(text.trim());
  return {
    state,
    summary: {
      savedAt: new Date(state.lastSavedAt).toLocaleString('pt-BR'),
      balance: state.balance,
      reputation: state.reputation,
      cycle: state.currentCycle,
      prestiges: state.prestigeCount,
      roomsUnlocked: Object.values(state.rooms).filter((r) => r.unlocked).length,
    },
  };
}

export function eraseAll() {
  try {
    localStorage.removeItem(BALANCE.saveKey);
    localStorage.removeItem(BALANCE.backupKey);
    localStorage.removeItem(BALANCE.checkpointKey);
  } catch { /* ignora */ }
}
