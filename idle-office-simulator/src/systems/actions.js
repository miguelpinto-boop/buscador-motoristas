// Ações de gameplay — toda alteração de estado passa por aqui (PRD §26.3).
// Cada ação valida, altera o estado, marca para salvar e emite eventos para a UI.

import { BALANCE } from '../data/balance.js';
import {
  OFFICES, FLOORS, FACILITIES, PROPERTIES, HQ_DEPARTMENTS,
  officeById, floorById, facilityById, propertyById, officesOfFloor, facilitiesOfProperty,
} from '../data/buildings.js';
import { COMPANIES, companyById, categoryByN, CATEGORIES } from '../data/companies.js';
import { MANAGERS, managerById } from '../data/managers.js';
import { RESEARCH, researchById } from '../data/research.js';
import { legacyById, LEGACY_UPGRADES } from '../data/prestige.js';
import { COLLECTION_ITEMS, collectionItemById } from '../data/extras.js';
import {
  upgradeCost, bulkUpgradeCost, maxAffordable, facilityUpgradeCost, managerTrainCost,
  hqLevelCost, legacyLevelCost, tapGain, contractRequirementsMet, maintenanceCost,
  effectiveCondition,
} from '../core/formulas.js';
import { game, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { nextRandom } from '../core/rng.js';

const toast = (type, text) => bus.emit('toast', { type, text });

// ————— Dinheiro, REP, PP: entradas e saídas —————

export function earn(state, amount, { silent = false } = {}) {
  if (!(amount > 0)) return 0;
  state.balance += amount;
  state.statistics.moneyEarned += amount;
  state.lifetimeStatistics.moneyEarned += amount;
  if (!silent) markDirty();
  return amount;
}

export function spend(state, amount, category = null) {
  amount = Math.ceil(amount);
  if (amount <= 0) return true;
  if (state.balance < amount) return false;
  state.balance -= amount;
  state.statistics.moneySpent += amount;
  state.lifetimeStatistics.moneySpent += amount;
  if (category) state.spentTotals[category] = (state.spentTotals[category] || 0) + amount;
  markDirty();
  return true;
}

export function grantRep(state, amount) {
  if (!(amount > 0)) return 0;
  const mods = snapFor(state)?.mods;
  const final = amount * (mods?.repMult || 1);
  state.reputation += final;
  state.statistics.repEarned += final;
  state.lifetimeStatistics.repEarned += final;
  markDirty();
  return final;
}

export function grantPP(state, amount) {
  if (!(amount > 0)) return 0;
  const mods = snapFor(state)?.mods;
  const final = Math.round(amount * (mods?.ppMult || 1));
  state.researchPoints += final;
  state.statistics.ppEarned += final;
  state.lifetimeStatistics.ppEarned += final;
  markDirty();
  return final;
}

/** Entrega uma recompensa estruturada (missões, capítulos, eventos, projetos). */
export function grantReward(state, reward, { missionScale = false, sourceLabel = '' } = {}) {
  if (!reward) return [];
  const parts = [];
  const snapshot = snapFor(state);
  const missionMult = missionScale ? (snapshot?.mods?.missionMult || 1) : 1;
  if (reward.money) {
    const v = reward.money * missionMult;
    earn(state, v);
    parts.push(`+$${Math.round(v).toLocaleString('pt-BR')}`);
  }
  if (reward.moneySeconds) {
    const v = Math.max(10, (snapshot?.totalPerSec || 1) * reward.moneySeconds) * missionMult;
    earn(state, v);
    parts.push('+dinheiro');
  }
  if (reward.rep) { grantRep(state, reward.rep * missionMult); parts.push(`+${reward.rep} REP`); }
  if (reward.pp) { grantPP(state, reward.pp); parts.push(`+${reward.pp} PP`); }
  if (reward.pl) { state.legacyPoints += reward.pl; parts.push(`+${reward.pl} PL`); }
  if (reward.effect) {
    addEffect(state, reward.effect.kind, reward.effect.value, reward.effect.minutes, sourceLabel);
    parts.push('bônus temporário');
  }
  if (reward.collection) { grantCollectionItem(state, reward.collection); parts.push('item de coleção'); }
  if (reward.collectionRoll) { grantRandomCollectionItem(state); parts.push('item de coleção'); }
  if (reward.manager) {
    if (!state.hiredManagers[reward.manager]) {
      state.hiredManagers[reward.manager] = { level: 1, xp: 0 };
      state.statistics.managersHiredCount++;
      state.lifetimeStatistics.managersHiredCount++;
      parts.push('gestor exclusivo');
    }
  }
  if (reward.items) {
    for (const [k, v] of Object.entries(reward.items)) state.inventory[k] = (state.inventory[k] || 0) + v;
  }
  markDirty();
  return parts;
}

export function addEffect(state, kind, value, minutes, source = '') {
  // Efeitos negativos limitados (PRD §24.1)
  if (kind === 'income' && value < 0) value = Math.max(value, -BALANCE.eventMaxIncomePenalty);
  state.activeEffects.push({ kind, value, expiresAt: Date.now() + minutes * 60_000, source });
  markDirty();
}

export function grantCollectionItem(state, itemId) {
  const item = collectionItemById(itemId);
  if (!item || state.collection.owned.includes(itemId)) return false;
  state.collection.owned.push(itemId);
  bus.emit('celebrate', { text: `Item de coleção: ${item.name}!` });
  markDirty();
  return true;
}

export function grantRandomCollectionItem(state) {
  const missing = COLLECTION_ITEMS.filter((c) => c.id !== 'facade_founder' && !state.collection.owned.includes(c.id));
  if (!missing.length) return false;
  const pick = missing[Math.floor(nextRandom(state) * missing.length)];
  return grantCollectionItem(state, pick.id);
}

// ————— Trabalhar (ganho ativo) —————

export function tapWork(state) {
  const gain = tapGain(snapFor(state)?.totalPerSec || 0);
  earn(state, gain, { silent: true });
  state.statistics.taps++;
  state.lifetimeStatistics.taps++;
  return gain;
}

// ————— Upgrades de sala —————

function upgradeDiscountFor(state, category) {
  const mods = snapFor(state)?.mods;
  let d = mods?.upgradeDiscount || 0;
  if (state.renovations?.count > 0) d += state.renovations.discount;
  return Math.min(d, BALANCE.maxCombinedDiscount);
}

function catCostMult(state, category) {
  if (state.challengeMods?.techCostMult && category === 'tech') return state.challengeMods.techCostMult;
  return 1;
}

/** Informações de compra para a UI (custo de x1/x10/x25/Máx). */
export function upgradeQuote(state, officeId, category, mode) {
  const office = officeById(officeId);
  const room = state.rooms[officeId];
  if (!office || !room?.unlocked) return null;
  const level = room[category];
  if (level >= office.maxLevel) return { count: 0, total: 0, maxed: true };
  const discount = upgradeDiscountFor(state, category);
  const mult = catCostMult(state, category);
  if (mode === 'max') {
    const { count, total } = maxAffordable(office, category, level, state.balance, office.maxLevel, discount, mult);
    return { count, total, maxed: false };
  }
  const count = Math.min(mode, office.maxLevel - level);
  return { count, total: bulkUpgradeCost(office, category, level, count, discount, mult), maxed: false };
}

export function buyUpgrade(state, officeId, category, mode = 1) {
  if (state.challengeMods?.maxUpgrades && state.statistics.upgradesBought >= state.challengeMods.maxUpgrades) {
    toast('error', 'Limite de upgrades do cenário atingido.');
    return false;
  }
  const quote = upgradeQuote(state, officeId, category, mode);
  if (!quote || quote.count <= 0) return false;
  if (!spend(state, quote.total, 'upgrades')) return false;
  const room = state.rooms[officeId];
  const office = officeById(officeId);
  room[category] += quote.count;
  state.statistics.upgradesBought += quote.count;
  state.lifetimeStatistics.upgradesBought += quote.count;
  // Consome descontos por quantidade (Reforma Expressa / Caixa de Reformas)
  if (state.adReduction.upgradesLeft > 0) state.adReduction.upgradesLeft = Math.max(0, state.adReduction.upgradesLeft - quote.count);
  if (state.renovations.count > 0) state.renovations.count = Math.max(0, state.renovations.count - quote.count);
  checkUpgradeMilestones(state, office, room);
  if (room.structure >= office.maxLevel && room.tech >= office.maxLevel && room.comfort >= office.maxLevel) {
    state.statistics.roomPremium++;
    state.lifetimeStatistics.roomPremium++;
    bus.emit('celebrate', { text: `${office.name} atingiu o estado Premium!` });
  }
  emitChange('economy');
  return true;
}

/** Marcos de upgrade por sala (PRD §11.4). */
function checkUpgradeMilestones(state, office, room) {
  const sum = room.structure + room.tech + room.comfort;
  const maxSum = office.maxLevel * 3;
  for (let i = 0; i < BALANCE.upgradeMilestones.length; i++) {
    const ms = BALANCE.upgradeMilestones[i];
    const target = ms.sum === -1 ? maxSum : ms.sum;
    if (sum >= target && !room.milestones.includes(i)) {
      room.milestones.push(i);
      if (ms.rep) grantRep(state, ms.rep);
      if (ms.cashPct) earn(state, Math.max(50, (snapFor(state)?.perRoom?.[office.id]?.final || 1) * ms.cashPct));
      if (ms.permBonus) room.permBonus = (room.permBonus || 0) + ms.permBonus;
      toast('success', `Marco da sala ${office.name}: nível combinado ${ms.sum === -1 ? 'máximo' : ms.sum}!`);
    }
  }
}

// ————— Desbloqueios —————

export function unlockRoom(state, officeId) {
  const office = officeById(officeId);
  const room = state.rooms[officeId];
  if (!office || !room || room.unlocked) return false;
  if (!state.floors[office.floor]) { toast('error', 'Libere o andar primeiro.'); return false; }
  const discount = snapFor(state)?.mods?.unlockDiscount || 0;
  const cost = Math.ceil(office.unlockCost * (1 - discount));
  if (!spend(state, cost, 'rooms')) { toast('error', 'Saldo insuficiente.'); return false; }
  room.unlocked = true;
  bus.emit('celebrate', { text: `${office.name} desbloqueada!` });
  emitChange('economy');
  return true;
}

export function floorRequirementsMet(state, floor) {
  const missing = [];
  if (state.reputation < floor.rep) missing.push(`${floor.rep} REP`);
  const req = floor.requires;
  if (req?.allRoomsOfFloor) {
    const rooms = officesOfFloor(req.allRoomsOfFloor);
    if (!rooms.every((o) => state.rooms[o.id].unlocked)) missing.push('todas as salas do andar anterior');
  }
  if (req?.facilitiesAtLevel) {
    const count = FACILITIES.filter((f) => (state.facilities[f.id] ?? -1) >= req.facilitiesAtLevel.level).length;
    if (count < req.facilitiesAtLevel.count) missing.push(`${req.facilitiesAtLevel.count} instalações no nível ${req.facilitiesAtLevel.level}`);
  }
  if (req?.managerAtLevel) {
    const ok = Object.values(state.hiredManagers).some((m) => m.level >= req.managerAtLevel);
    if (!ok) missing.push(`um gestor no nível ${req.managerAtLevel}`);
  }
  return missing;
}

export function unlockFloor(state, floorId) {
  const floor = floorById(floorId);
  if (!floor || state.floors[floorId]) return false;
  if (!state.properties[floor.property]) { toast('error', 'Desbloqueie a propriedade primeiro.'); return false; }
  const missing = floorRequirementsMet(state, floor);
  if (missing.length) { toast('error', `Requisitos pendentes: ${missing.join(', ')}.`); return false; }
  const discount = snapFor(state)?.mods?.unlockDiscount || 0;
  if (!spend(state, Math.ceil(floor.cost * (1 - discount)), 'rooms')) { toast('error', 'Saldo insuficiente.'); return false; }
  state.floors[floorId] = true;
  bus.emit('celebrate', { text: `${floor.name} liberado!` });
  emitChange('economy');
  return true;
}

export function propertyRequirements(state, prop) {
  const u = prop.unlock;
  return [
    { label: `Concluir o capítulo ${u.chapter}`, ok: u.chapter === 0 || state.campaign.completedChapters >= u.chapter },
    { label: `${u.rep} REP`, ok: state.reputation >= u.rep },
    ...(u.prestiges ? [{ label: `${u.prestiges} Prestígio(s)`, ok: state.prestigeCount >= u.prestiges }] : []),
  ];
}

export function unlockProperty(state, propId) {
  const prop = propertyById(propId);
  if (!prop || state.properties[propId]) return false;
  const reqs = propertyRequirements(state, prop);
  if (!reqs.every((r) => r.ok)) { toast('error', 'Requisitos da propriedade ainda não atendidos.'); return false; }
  if (!spend(state, prop.unlock.cost, 'rooms')) { toast('error', 'Saldo insuficiente.'); return false; }
  state.properties[propId] = true;
  const firstFloor = FLOORS.find((f) => f.property === propId && f.number === 1);
  if (firstFloor) state.floors[firstFloor.id] = true;
  bus.emit('celebrate', { text: `${prop.name} agora faz parte do seu portfólio!` });
  emitChange('economy');
  return true;
}

export function switchProperty(state, propId) {
  if (!state.properties[propId]) return false;
  state.currentProperty = propId;
  markDirty();
  emitChange('nav');
  return true;
}

// ————— Contratos —————

export function categoryAvailable(state, cat) {
  const c = categoryByN(cat);
  if (!c) return false;
  if (state.reputation < c.rep) return false;
  if (cat >= 8) {
    const unlocked = snapFor(state)?.mods?.unlockedCategories || [];
    if (!unlocked.includes(cat)) return false;
  }
  return true;
}

export function canSignContract(state, officeId, companyId) {
  const office = officeById(officeId);
  const company = companyById(companyId);
  const room = state.rooms[officeId];
  if (!office || !company || !room?.unlocked) return { ok: false, reason: 'Sala bloqueada' };
  if (state.challengeMods?.onlySpecialty && company.specialty !== state.challengeMods.onlySpecialty) {
    return { ok: false, reason: 'Cenário permite apenas outra especialidade' };
  }
  if (!categoryAvailable(state, company.cat)) {
    const c = categoryByN(company.cat);
    return { ok: false, reason: company.cat >= 8 && state.reputation >= c.rep ? 'Requer pesquisa de mercado' : `Requer ${c.rep} REP` };
  }
  // Condição muito baixa: empresas premium recusam (PRD §33.1)
  const cond = effectiveCondition(state, office.property, snapFor(state)?.mods);
  if (company.cat >= 5 && cond < BALANCE.condition.premiumBlockBelow) {
    return { ok: false, reason: 'Condição do prédio muito baixa para empresas premium' };
  }
  if (!contractRequirementsMet(state, office, company, snapFor(state)?.perRoom?.[officeId]?.satisfaction ?? null)) {
    return { ok: false, reason: 'Requisitos da sala não atendidos' };
  }
  return { ok: true };
}

export function signContract(state, officeId, companyId) {
  const check = canSignContract(state, officeId, companyId);
  if (!check.ok) { toast('error', check.reason); return false; }
  const company = companyById(companyId);
  if (state.tenantsByRoom[officeId] === companyId) return false;
  const payKey = `${officeId}:${companyId}`;
  state.paidContracts = state.paidContracts || [];
  const alreadyPaid = state.paidContracts.includes(payKey);
  if (!alreadyPaid) {
    const discount = snapFor(state)?.mods?.contractDiscount || 0;
    if (!spend(state, Math.ceil(company.cost * (1 - discount)), 'contracts')) { toast('error', 'Saldo insuficiente.'); return false; }
    state.paidContracts.push(payKey);
  }
  state.tenantsByRoom[officeId] = companyId;
  state.statistics.contractsSigned++;
  state.lifetimeStatistics.contractsSigned++;
  if (!state.discoveredTenants.includes(companyId)) {
    state.discoveredTenants.push(companyId);
    state.statistics.newContractsSigned++;
    state.lifetimeStatistics.newContractsSigned++;
  }
  // REP inicial: apenas na primeira contratação da empresa no ciclo (PRD §13.4)
  if (!state.repGrantedTenants.includes(companyId)) {
    state.repGrantedTenants.push(companyId);
    if (company.rep) grantRep(state, company.rep);
  }
  toast('success', `Contrato assinado: ${company.name}`);
  emitChange('economy');
  return true;
}

// ————— Instalações —————

export function facilityBuildCost(state, facility) {
  const mods = snapFor(state)?.mods;
  let discount = mods?.facilityDiscount || 0;
  // Instalação Modular (L20): primeira instalação de cada propriedade
  const builtInProp = facilitiesOfProperty(facility.property).some((f) => (state.facilities[f.id] ?? -1) >= 0);
  if (!builtInProp && mods?.firstFacilityDiscount) discount += mods.firstFacilityDiscount;
  return Math.ceil(facility.buildCost * (1 - Math.min(discount, BALANCE.maxCombinedDiscount)));
}

export function buildFacility(state, facilityId) {
  const fac = facilityById(facilityId);
  if (!fac || (state.facilities[facilityId] ?? -1) >= 0) return false;
  if (!state.properties[fac.property]) { toast('error', 'Propriedade bloqueada.'); return false; }
  if (!spend(state, facilityBuildCost(state, fac), 'facilities')) { toast('error', 'Saldo insuficiente.'); return false; }
  state.facilities[facilityId] = 0;
  state.statistics.facilityUpgrades++;
  state.lifetimeStatistics.facilityUpgrades++;
  bus.emit('celebrate', { text: `${fac.name} construída!` });
  emitChange('economy');
  return true;
}

export function upgradeFacility(state, facilityId) {
  const fac = facilityById(facilityId);
  const lvl = state.facilities[facilityId] ?? -1;
  if (!fac || lvl < 0 || lvl >= fac.maxLevel) return false;
  let discount = snapFor(state)?.mods?.facilityDiscount || 0;
  if (facilityId === 'sala_ti') discount += snapFor(state)?.mods?.tiDiscount || 0;
  if (!spend(state, facilityUpgradeCost(fac, lvl, discount), 'facilities')) { toast('error', 'Saldo insuficiente.'); return false; }
  state.facilities[facilityId] = lvl + 1;
  state.statistics.facilityUpgrades++;
  state.lifetimeStatistics.facilityUpgrades++;
  if (fac.milestones?.[lvl + 1]?.rep) grantRep(state, fac.milestones[lvl + 1].rep);
  emitChange('economy');
  return true;
}

// ————— Gestores —————

export function managerAvailable(state, mgr) {
  if (mgr.campaignOnly) return !!state.hiredManagers[mgr.id];
  if (['M19', 'M20', 'M21', 'M22', 'M23'].includes(mgr.id) && !snapFor(state)?.mods?.eliteManagersUnlocked) return false;
  return state.reputation >= mgr.rep;
}

export function hireManager(state, managerId) {
  if (state.challengeMods?.noManagers) { toast('error', 'Este cenário não permite gestores.'); return false; }
  const mgr = managerById(managerId);
  if (!mgr || state.hiredManagers[managerId]) return false;
  if (!managerAvailable(state, mgr)) { toast('error', `Requer ${mgr.rep} REP.`); return false; }
  const discount = snapFor(state)?.mods?.hireDiscount || 0;
  if (!spend(state, Math.ceil(mgr.cost * (1 - discount)), 'managers')) { toast('error', 'Saldo insuficiente.'); return false; }
  const startLevel = Math.min(BALANCE.managerMaxLevel, snapFor(state)?.mods?.managerStartLevel || 1);
  state.hiredManagers[managerId] = { level: startLevel, xp: 0 };
  state.statistics.managersHiredCount++;
  state.lifetimeStatistics.managersHiredCount++;
  toast('success', `${mgr.name} entrou para a equipe!`);
  emitChange('economy');
  return true;
}

export function trainManager(state, managerId) {
  const mgr = managerById(managerId);
  const hired = state.hiredManagers[managerId];
  if (!mgr || !hired || hired.level >= BALANCE.managerMaxLevel) return false;
  const repReq = BALANCE.managerTrainRepRequired[hired.level + 1];
  if (repReq && state.reputation < repReq) { toast('error', `Treinar até o nível ${hired.level + 1} requer ${repReq} REP.`); return false; }
  const mods = snapFor(state)?.mods;
  const cost = managerTrainCost(mgr, hired.level, mods?.trainDiscount || 0) * (mods?.trainCostMult || 1);
  if (!spend(state, cost, 'managers')) { toast('error', 'Saldo insuficiente.'); return false; }
  hired.level++;
  state.statistics.managersTrained++;
  state.lifetimeStatistics.managersTrained++;
  if (hired.level === 5) toast('success', `${mgr.name} desbloqueou o bônus secundário!`);
  emitChange('economy');
  return true;
}

export function assignManager(state, managerId, floorId) {
  if (!state.hiredManagers[managerId] || !floorById(floorId) || !state.floors[floorId]) return false;
  // Remove alocação anterior do gestor (um gestor não ocupa dois andares — PRD §14)
  for (const [fId, mId] of Object.entries(state.managerAssignments)) {
    if (mId === managerId) delete state.managerAssignments[fId];
  }
  state.lastAssignment = { floorId, prev: state.managerAssignments[floorId] || null, at: Date.now() };
  state.managerAssignments[floorId] = managerId;
  markDirty();
  emitChange('economy');
  return true;
}

export function unassignManager(state, floorId) {
  if (!state.managerAssignments[floorId]) return false;
  delete state.managerAssignments[floorId];
  markDirty();
  emitChange('economy');
  return true;
}

/** Desfazer alocação por até 10 segundos (PRD §39). */
export function undoAssignment(state) {
  const last = state.lastAssignment;
  if (!last || Date.now() - last.at > 10_000) return false;
  if (last.prev) state.managerAssignments[last.floorId] = last.prev;
  else delete state.managerAssignments[last.floorId];
  state.lastAssignment = null;
  markDirty();
  emitChange('economy');
  return true;
}

// ————— Sede Administrativa —————

export function upgradeHqDepartment(state, deptId) {
  if (!state.hqUnlocked) { toast('error', 'A Sede é liberada no capítulo 5.'); return false; }
  const dept = HQ_DEPARTMENTS.find((d) => d.id === deptId);
  const lvl = state.hqDepartments[deptId] || 0;
  if (!dept || lvl >= dept.maxLevel) return false;
  if (!spend(state, hqLevelCost(dept, lvl), 'facilities')) { toast('error', 'Saldo insuficiente.'); return false; }
  state.hqDepartments[deptId] = lvl + 1;
  emitChange('economy');
  return true;
}

// ————— Pesquisa —————

export function buyResearch(state, nodeId) {
  if (!state.hqUnlocked) { toast('error', 'A pesquisa é liberada com a Sede (capítulo 5).'); return false; }
  const node = researchById(nodeId);
  if (!node || state.researchNodes.includes(nodeId)) return false;
  if (node.requires && !state.researchNodes.includes(node.requires)) { toast('error', 'Pesquise o nó anterior primeiro.'); return false; }
  const discount = snapFor(state)?.mods?.researchDiscount || 0;
  const cost = Math.ceil(node.cost * (1 - discount));
  if (state.researchPoints < cost) { toast('error', `Requer ${cost} PP.`); return false; }
  state.researchPoints -= cost;
  state.researchNodes.push(nodeId);
  state.statistics.researchBought++;
  state.lifetimeStatistics.researchBought++;
  bus.emit('celebrate', { text: `Pesquisa concluída: ${node.name}!` });
  emitChange('economy');
  return true;
}

// ————— Legado (melhorias permanentes) —————

export function buyLegacyUpgrade(state, legacyId) {
  const def = legacyById(legacyId);
  const lvl = state.legacyUpgrades[legacyId] || 0;
  if (!def || lvl >= def.maxLevel) return false;
  const cost = legacyLevelCost(def, lvl);
  if (state.legacyPoints < cost) { toast('error', `Requer ${cost} PL.`); return false; }
  state.legacyPoints -= cost;
  state.legacyUpgrades[legacyId] = lvl + 1;
  toast('success', `${def.name} — nível ${lvl + 1}`);
  markDirty();
  emitChange('economy');
  return true;
}

// ————— Manutenção e solicitações (PRD §33) —————

export function doMaintenance(state, propId) {
  const cond = state.propertyCondition[propId] ?? 100;
  if (cond >= 100) { toast('info', 'A propriedade já está em condição perfeita.'); return false; }
  const income = snapFor(state)?.perProperty?.[propId] || 0;
  const cost = maintenanceCost(income, snapFor(state)?.mods?.maintenanceDiscount || 0);
  if (!spend(state, cost)) { toast('error', 'Saldo insuficiente.'); return false; }
  const restored = Math.min(BALANCE.condition.maintenanceRestore, 100 - cond);
  state.propertyCondition[propId] = cond + restored;
  state.statistics.conditionRestored += restored;
  state.lifetimeStatistics.conditionRestored += restored;
  state.statistics.maintenancesDone++;
  state.lifetimeStatistics.maintenancesDone++;
  toast('success', `Condição +${restored} (${propId === 'aurora' ? 'Edifício Aurora' : propId === 'torre' ? 'Torre Central' : 'Campus Horizonte'})`);
  emitChange('economy');
  return true;
}

export function resolveTenantRequest(state, requestIndex, accept) {
  const req = state.tenantRequests[requestIndex];
  if (!req) return false;
  if (accept) {
    const cost = Math.max(20, (snapFor(state)?.totalPerSec || 1) * req.costSeconds);
    if (!spend(state, cost)) { toast('error', 'Saldo insuficiente.'); return false; }
    grantRep(state, req.reward.rep || 0);
    if (req.reward.satisfaction) addEffect(state, 'satisfaction', req.reward.satisfaction, 15, 'Solicitação atendida');
    state.statistics.requestsCompleted++;
    state.lifetimeStatistics.requestsCompleted++;
    toast('success', 'Solicitação atendida!');
  }
  state.tenantRequests.splice(requestIndex, 1);
  markDirty();
  emitChange('state');
  return true;
}

// ————— Automação (pesquisa r10, PRD §39) —————

export function runAutomation(state) {
  const mods = snapFor(state)?.mods;
  if (!mods?.automation || !state.settings.autoBuy) return;
  const reserve = state.settings.reserveMoney || 0;
  let bought = 0;
  for (const office of OFFICES) {
    const room = state.rooms[office.id];
    if (!room?.unlocked) continue;
    for (const cat of ['structure', 'tech', 'comfort']) {
      if (bought >= 6) return; // limite por tique para não travar
      if (room[cat] >= office.maxLevel) continue;
      const cost = upgradeCost(office, cat, room[cat], mods.upgradeDiscount, catCostMult(state, cat));
      if (state.balance - cost >= reserve) {
        if (buyUpgrade(state, office.id, cat, 1)) bought++;
      }
    }
  }
}
