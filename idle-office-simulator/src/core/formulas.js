// Fórmulas econômicas puras — PRD §9, §11, §12, §13, §14, §19, §24, §33, §34.
// Nenhuma função aqui altera o estado nem toca o DOM.

import { BALANCE } from '../data/balance.js';
import {
  OFFICES, FLOORS, FACILITIES, PROPERTIES, HQ_DEPARTMENTS,
  officeById, floorById, facilityById, officesOfFloor, facilitiesOfProperty, ROOM_VISUAL_STAGES,
} from '../data/buildings.js';
import { COMPANIES, companyById, SYNERGIES, CATEGORIES } from '../data/companies.js';
import { MANAGERS, managerById } from '../data/managers.js';
import { LEGACY_UPGRADES, legacyById } from '../data/prestige.js';
import { RESEARCH, researchById } from '../data/research.js';
import { MARKET_CONDITIONS, marketById, COLLECTION_ITEMS, collectionItemById } from '../data/extras.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ————— Custos —————

/** Custo de um único nível de upgrade (PRD §9.6). */
export function upgradeCost(office, category, currentLevel, discount = 0, catCostMult = 1) {
  const base = office.cost[category] * catCostMult;
  const raw = Math.ceil(base * Math.pow(office.growth, currentLevel));
  return Math.max(1, Math.ceil(raw * (1 - clamp(discount, 0, BALANCE.maxCombinedDiscount))));
}

/** Custo total de `count` níveis a partir de `fromLevel`. */
export function bulkUpgradeCost(office, category, fromLevel, count, discount = 0, catCostMult = 1) {
  let total = 0;
  for (let i = 0; i < count; i++) total += upgradeCost(office, category, fromLevel + i, discount, catCostMult);
  return total;
}

/** Quantos níveis cabem no orçamento (modo Máx., PRD §9.7). */
export function maxAffordable(office, category, fromLevel, budget, maxLevel, discount = 0, catCostMult = 1) {
  let count = 0;
  let total = 0;
  while (fromLevel + count < maxLevel) {
    const c = upgradeCost(office, category, fromLevel + count, discount, catCostMult);
    if (total + c > budget) break;
    total += c;
    count++;
  }
  return { count, total };
}

/** Custo de upgrade de instalação (PRD §12.1). */
export function facilityUpgradeCost(facility, currentLevel, discount = 0) {
  const raw = Math.ceil(facility.upgradeBase * Math.pow(BALANCE.facilityCostGrowth, currentLevel));
  return Math.max(1, Math.ceil(raw * (1 - clamp(discount, 0, BALANCE.maxCombinedDiscount))));
}

/** Custo de treinamento de gestor (PRD §14.3). */
export function managerTrainCost(manager, currentLevel, discount = 0) {
  const base = manager.cost > 0 ? manager.cost : 1e12; // M24 (campanha) treina com custo fixo alto
  const raw = Math.ceil(base * BALANCE.managerTrainBaseRate * Math.pow(BALANCE.managerTrainGrowth, currentLevel - 1));
  return Math.max(1, Math.ceil(raw * (1 - clamp(discount, 0, BALANCE.maxCombinedDiscount))));
}

/** Custo de nível de departamento da Sede. */
export function hqLevelCost(dept, currentLevel) {
  return Math.ceil(dept.baseCost * Math.pow(dept.growth, currentLevel));
}

/** Custo do próximo nível de melhoria de Legado. */
export function legacyLevelCost(legacy, currentLevel) {
  return Math.ceil(legacy.baseCost * Math.pow(legacy.costGrowth, currentLevel));
}

// ————— Agregação de modificadores —————

function managerValue(mgr, def, level) {
  return def.value * (1 + BALANCE.managerLevelScale * (level - 1));
}

/**
 * Percorre Legado, pesquisa, Sede, gestores, instalações, mercado, compras,
 * coleção e efeitos ativos, e devolve um objeto único de modificadores.
 */
export function collectModifiers(state, now = Date.now()) {
  const m = {
    incomeMult: 1,                 // multiplicador permanente global
    tempIncomeMult: 1,             // efeitos temporários (eventos + boost de anúncio)
    upgradeDiscount: 0,
    unlockDiscount: 0,
    contractDiscount: 0,
    facilityDiscount: 0,
    trainDiscount: 0,
    hireDiscount: 0,
    maintenanceDiscount: 0,
    researchDiscount: 0,
    satisfactionFloor: BALANCE.satisfactionMin,
    satisfactionAllBonus: 0,       // global (Sede Pessoas, efeitos)
    offlineHours: BALANCE.offlineLimitHoursDefault,
    ppMult: 1, repMult: 1, missionMult: 1, adMult: 1,
    eventPenaltyReduction: 0,
    eventPositiveBonus: 0,
    projectSpeedMult: 1,
    projectRewardMult: 1,
    excellentChanceBonus: 0,
    greenBonusMult: 1,
    councilMult: 1,
    specialtyMult: {},             // global por especialidade (mercado, Sede)
    categoryMult: {},              // por categoria (pesquisa r22, M21)
    minCategoryMult: { min: 99, value: 0 },
    managerXp: false,
    automation: false,
    buyX25: false,
    unlockedCategories: [],        // categorias liberadas por pesquisa (8, 9)
    eliteManagersUnlocked: false,
    managerStartLevel: 1,
    managerPropertyShare: 0,
    projectSlots: 1,
    extraProposals: 0,
    patentBonus: 0,
    perProperty: {},               // propId → { incomeMult, satisfaction, specialtyMult, extraManagers, firstFacilityDiscount }
    perFloor: {},                  // floorId → { incomeMult, satisfaction, specialtyMult, highSat }
    trainCostMult: 1,
    satisfactionWeight: 0,
  };
  for (const p of PROPERTIES) {
    m.perProperty[p.id] = { incomeMult: 1, satisfaction: 0, specialtyMult: {}, extraManagers: 0, collectionBonus: 0 };
  }
  for (const f of FLOORS) {
    m.perFloor[f.id] = { incomeMult: 1, satisfaction: 0, specialtyMult: {}, highSat: null };
  }

  // Legado (PRD §19.6)
  for (const [id, level] of Object.entries(state.legacyUpgrades || {})) {
    const def = legacyById(id);
    if (!def || level <= 0) continue;
    const e = def.effect;
    if (e.incomeTotal) m.incomeMult *= 1 + e.incomeTotal * level;
    if (e.upgradeDiscount) m.upgradeDiscount += e.upgradeDiscount * level;
    if (e.contractDiscount) m.contractDiscount += e.contractDiscount * level;
    if (e.unlockDiscount) m.unlockDiscount += e.unlockDiscount * level;
    if (e.facilityBonus) m.greenBonusMult += 0; // aplicado via facilityEffectScale abaixo
    if (e.offlineHours) m.offlineHours += e.offlineHours * level;
    if (e.missionBonus) m.missionMult += e.missionBonus * level;
    if (e.adBonus) m.adMult += e.adBonus * level;
    if (e.maintenanceDiscount) m.maintenanceDiscount += e.maintenanceDiscount * level;
    if (e.repBonus) m.repMult += e.repBonus * level;
    if (e.managerStartLevel) m.managerStartLevel += e.managerStartLevel * level;
    if (e.satisfactionFloor) m.satisfactionFloor += e.satisfactionFloor * level;
    if (e.projectSlots) m.projectSlots += e.projectSlots * level;
    if (e.excellentChance) m.excellentChanceBonus += e.excellentChance * level;
    if (e.councilBonus) m.councilMult += e.councilBonus * level;
  }
  m.facilityEffectScale = 1 + (state.legacyUpgrades?.L08 || 0) * 0.03;
  m.firstFacilityDiscount = (state.legacyUpgrades?.L20 || 0) * 0.20;
  m.collectionCap = state.legacyUpgrades?.L23 ? BALANCE.collectionBonusCapUpgraded : BALANCE.collectionBonusCap;

  // Pesquisa (PRD §31.2)
  for (const id of state.researchNodes || []) {
    const def = researchById(id);
    if (!def) continue;
    const e = def.effect;
    if (e.incomeTotal) m.incomeMult *= 1 + e.incomeTotal;
    if (e.buyX25) m.buyX25 = true;
    if (e.contractDiscount) m.contractDiscount += e.contractDiscount;
    if (e.offlineBonus) m.offlineGainBonus = (m.offlineGainBonus || 0) + e.offlineBonus;
    if (e.unlockCategory) m.unlockedCategories.push(e.unlockCategory);
    if (e.facilityDiscount) m.facilityDiscount += e.facilityDiscount;
    if (e.offlineHours) m.offlineHours += e.offlineHours;
    if (e.offlineHoursSet) m.offlineHours = Math.max(m.offlineHours, e.offlineHoursSet);
    if (e.automation) m.automation = true;
    if (e.projectSlots) m.projectSlots += e.projectSlots;
    if (e.trainDiscount) m.trainDiscount += e.trainDiscount;
    if (e.satisfactionFloor) m.satisfactionFloor += e.satisfactionFloor;
    if (e.managerXp) m.managerXp = true;
    if (e.hireDiscount) m.hireDiscount += e.hireDiscount;
    if (e.managerPropertyShare) m.managerPropertyShare = e.managerPropertyShare;
    if (e.unlockEliteManagers) m.eliteManagersUnlocked = true;
    if (e.ppBonus) m.ppMult += e.ppBonus;
    if (e.projectSpeed) m.projectSpeedMult *= 1 - e.projectSpeed;
    if (e.patentBonus) m.patentAvailable = true;
    if (e.categoryIncome) m.categoryMult[e.categoryIncome.category] = (m.categoryMult[e.categoryIncome.category] || 0) + e.categoryIncome.value;
    if (e.ppRetention) m.ppRetentionBonus = (m.ppRetentionBonus || 0) + e.ppRetention;
    if (e.eventPenalty) m.eventPenaltyReduction += e.eventPenalty;
    if (e.conditionLoss) m.conditionLossReduction = (m.conditionLossReduction || 0) + e.conditionLoss;
  }

  // Espaços extras de projeto da campanha (capítulos 7 e 10)
  m.projectSlots += state.campaign?.extraProjectSlots || 0;

  // Bônus de patentes acumulado no ciclo (pesquisa r21)
  m.incomeMult *= 1 + (state.patentBonusCycle || 0);

  // Sede Administrativa (PRD §31.1)
  for (const dept of HQ_DEPARTMENTS) {
    const lvl = state.hqDepartments?.[dept.id] || 0;
    if (lvl <= 0) continue;
    const e = dept.effect;
    if (e.incomeTotal) m.incomeMult *= 1 + e.incomeTotal * lvl;
    if (e.contractDiscount) m.contractDiscount += e.contractDiscount * lvl;
    if (e.facilityDiscount) m.facilityDiscount += e.facilityDiscount * lvl;
    if (e.maintenanceDiscount) m.maintenanceDiscount += e.maintenanceDiscount * lvl;
    if (e.satisfactionAll) m.satisfactionAllBonus += e.satisfactionAll * lvl;
    if (e.trainDiscount) m.trainDiscount += e.trainDiscount * lvl;
    if (e.ppBonus) m.ppMult += e.ppBonus * lvl;
    if (e.techIncome) m.specialtyMult.tech = (m.specialtyMult.tech || 0) + e.techIncome * lvl;
    if (e.repBonus) m.repMult += e.repBonus * lvl;
    if (e.eventPositive) m.eventPositiveBonus += e.eventPositive * lvl;
    if (e.greenBonus) m.greenBonusMult += e.greenBonus * lvl;
  }

  // Instalações (PRD §12) — bônus por propriedade
  for (const fac of FACILITIES) {
    const lvl = state.facilities?.[fac.id] ?? -1;
    if (lvl < 0) continue; // -1 = não construída; 0 = construída nível 0
    const pp = m.perProperty[fac.property];
    const scale = m.facilityEffectScale * (fac.green ? m.greenBonusMult : 1);
    const e = fac.effect;
    if (e.type === 'incomeTotal') pp.incomeMult *= 1 + e.value * lvl * scale;
    if (e.type === 'satisfactionAll') pp.satisfaction += e.value * lvl * scale;
    if (e.type === 'specialtyIncome') pp.specialtyMult[e.specialty] = (pp.specialtyMult[e.specialty] || 0) + e.value * lvl * scale;
    if (e.type === 'incomeAndSatisfaction') {
      pp.incomeMult *= 1 + e.income * lvl * scale;
      pp.satisfaction += e.satisfaction * lvl * scale;
    }
    if (e.type === 'eventPenaltyReduction') m.eventPenaltyReduction += e.value * lvl;
    // Marcos das instalações (níveis 5/10/15/20)
    for (const [ms, bonus] of Object.entries(fac.milestones || {})) {
      if (lvl < Number(ms)) continue;
      if (bonus.incomeTotal) pp.incomeMult *= 1 + bonus.incomeTotal;
      if (bonus.satisfactionAll) pp.satisfaction += bonus.satisfactionAll;
      if (bonus.specialtyIncome) pp.specialtyMult[fac.effect.specialty || 'tech'] = (pp.specialtyMult[fac.effect.specialty || 'tech'] || 0) + bonus.specialtyIncome;
      if (bonus.eventPenaltyReduction) m.eventPenaltyReduction += bonus.eventPenaltyReduction;
      if (bonus.eventPositiveDuration) m.eventPositiveBonus += bonus.eventPositiveDuration;
    }
  }

  // Gestores designados (PRD §14) — bônus por andar
  for (const [floorId, mgrId] of Object.entries(state.managerAssignments || {})) {
    const hired = state.hiredManagers?.[mgrId];
    const def = managerById(mgrId);
    if (!hired || !def) continue;
    const lvl = hired.level;
    const fl = m.perFloor[floorId];
    if (!fl) continue;
    const floor = floorById(floorId);
    const propMods = floor ? m.perProperty[floor.property] : null;
    const apply = (b) => {
      if (!b) return;
      const v = managerValue(def, b, lvl);
      switch (b.type) {
        case 'floorIncome': fl.incomeMult *= 1 + v; break;
        case 'totalIncome': m.incomeMult *= 1 + v; break;
        case 'propertyIncome': if (propMods) propMods.incomeMult *= 1 + v; break;
        case 'satisfaction': fl.satisfaction += v; break;
        case 'specialtyIncome': fl.specialtyMult[b.specialty] = (fl.specialtyMult[b.specialty] || 0) + v; break;
        case 'specialtyIncome2': for (const s of b.specialties) fl.specialtyMult[s] = (fl.specialtyMult[s] || 0) + v; break;
        case 'floorIncomeHighSat': fl.highSat = { minSat: b.minSat, value: v }; break;
        case 'contractDiscount': m.contractDiscount += v; break;
        case 'facilityDiscount': m.facilityDiscount += v; break;
        case 'trainDiscountTI': m.tiDiscount = (m.tiDiscount || 0) + v; break;
        case 'eventPenalty': m.eventPenaltyReduction += v; break;
        case 'ppBonus': m.ppMult += v; break;
        case 'projectSpeed': m.projectSpeedMult *= 1 - v; break;
        case 'projectSpeedLong': m.projectSpeedLongMult = (m.projectSpeedLongMult || 1) * (1 - v); break;
        case 'projectReward': m.projectRewardMult += v; break;
        case 'repBonus': m.repMult += v; break;
        case 'conditionBonus': m.conditionBonus = (m.conditionBonus || 0) + v; break;
        case 'satisfactionFloor': m.satisfactionFloor += v; break;
        case 'extraManager': if (propMods) propMods.extraManagers += 1; break;
        case 'researchDiscount': m.researchDiscount += v; break;
        case 'greenBonus': m.greenBonusMult += v; break;
        case 'categoryIncome': m.categoryMult[b.category] = (m.categoryMult[b.category] || 0) + v; break;
        case 'extraProposal': m.extraProposals += 1; break;
        case 'automationEarly': break; // qualidade de vida: automações um nível antes (usado na UI)
      }
    };
    apply(def.bonus);
    if (lvl >= 5) apply(def.bonus5);
  }

  // Condição de mercado do dia (PRD §34.1)
  const market = marketById(state.marketCondition?.id);
  if (market && state.marketUnlocked) {
    const b = market.bonus || {};
    if (b.specialty) m.specialtyMult[b.specialty] = (m.specialtyMult[b.specialty] || 0) + b.value;
    if (b.upgradeDiscount) m.upgradeDiscount += b.upgradeDiscount;
    if (b.repBonus) m.repMult += b.repBonus;
    if (b.ppBonus) m.ppMult += b.ppBonus;
    if (b.satisfactionWeight) m.satisfactionWeight += b.satisfactionWeight;
    if (b.minCategory) m.minCategoryMult = { min: b.minCategory, value: b.value };
    const p = market.penalty || {};
    let incomePenalty = 0;
    if (p.incomeTotal) incomePenalty = Math.min(p.incomeTotal, BALANCE.marketMaxPenalty);
    if (incomePenalty > 0 && b.greenMitigation) {
      const hasGreen = FACILITIES.some((f) => f.green && (state.facilities?.[f.id] ?? -1) >= 0);
      if (hasGreen) incomePenalty *= 1 - b.greenMitigation;
    }
    if (incomePenalty > 0) m.tempIncomeMult *= 1 - incomePenalty;
    if (p.specialty) m.specialtyMult[p.specialty] = (m.specialtyMult[p.specialty] || 0) - Math.min(p.value, BALANCE.marketMaxPenalty);
    if (p.trainCostUp) m.trainCostMult *= 1 + p.trainCostUp;
  }

  // Compras simuladas permanentes (PRD §20.3)
  m.incomeMult *= 1 + (state.permanentMultipliers?.income || 0);
  if (state.permanentMultipliers?.offlineHours) {
    m.offlineHours = Math.max(m.offlineHours, state.permanentMultipliers.offlineHours);
  }
  m.offlineHours = Math.min(m.offlineHours, BALANCE.offlineLimitHoursMax);

  // Coleção equipada (PRD §35.3) — bônus por propriedade, com teto
  for (const p of PROPERTIES) {
    let sum = 0;
    const equipped = state.collection?.equipped?.[p.id] || {};
    for (const itemId of Object.values(equipped)) {
      const item = collectionItemById(itemId);
      if (item && (state.collection?.owned || []).includes(itemId)) sum += item.bonus;
    }
    m.perProperty[p.id].collectionBonus = Math.min(sum, m.collectionCap);
    m.perProperty[p.id].incomeMult *= 1 + m.perProperty[p.id].collectionBonus;
  }

  // Efeitos temporários ativos (eventos, projetos) — com expiração
  m.tempSatisfaction = 0;
  m.tempUpgradeDiscount = 0;
  for (const fx of state.activeEffects || []) {
    if (fx.expiresAt <= now) continue;
    if (fx.kind === 'income') m.tempIncomeMult *= 1 + fx.value;
    if (fx.kind === 'satisfaction') m.tempSatisfaction += fx.value;
    if (fx.kind === 'upgradeDiscount') m.tempUpgradeDiscount += fx.value;
  }
  m.upgradeDiscount += m.tempUpgradeDiscount;

  // Café Executivo / boost 2× (PRD §20.2-B)
  if ((state.boostExpiresAt || 0) > now) m.tempIncomeMult *= BALANCE.ads.coffeeBoostMult;

  // Reforma Expressa (desconto nos próximos N upgrades)
  if ((state.adReduction?.upgradesLeft || 0) > 0) m.upgradeDiscount += state.adReduction.discount || BALANCE.ads.renovationDiscount;

  // Prestígio: multiplicador por ciclo concluído
  m.prestigeMult = 1 + 0.05 * (state.prestigeCount || 0);

  // Teto combinado de descontos (PRD §24.1)
  for (const k of ['upgradeDiscount', 'unlockDiscount', 'contractDiscount', 'facilityDiscount', 'trainDiscount', 'hireDiscount', 'maintenanceDiscount', 'researchDiscount']) {
    m[k] = clamp(m[k], 0, BALANCE.maxCombinedDiscount);
  }
  m.eventPenaltyReduction = clamp(m.eventPenaltyReduction, 0, 0.90);

  // Modificadores de cenário de desafio (PRD §37)
  if (state.challengeMods) {
    const c = state.challengeMods;
    if (c.incomeMult) m.incomeMult *= c.incomeMult;
    if (c.satisfactionWeight) m.satisfactionWeight += c.satisfactionWeight - 1;
  }

  return m;
}

// ————— Satisfação e renda por sala —————

/** Verifica se os requisitos de um contrato continuam atendidos (para penalidade de satisfação). */
export function contractRequirementsMet(state, office, company, snapshotSat = null) {
  const room = state.rooms[office.id];
  if (!room) return false;
  const req = company.req || {};
  if (req.structure && room.structure < req.structure) return false;
  if (req.tech && room.tech < req.tech) return false;
  if (req.comfort && room.comfort < req.comfort) return false;
  const avg = (room.structure + room.tech + room.comfort) / 3;
  if (req.avg && avg < req.avg) return false;
  if (req.balancedAt) {
    const min = Math.min(room.structure, room.tech, room.comfort);
    const max = Math.max(room.structure, room.tech, room.comfort);
    if (min < req.balancedAt || max - min > 6) return false;
  }
  if (req.facility) {
    const lvl = state.facilities?.[req.facility.id] ?? -1;
    if (lvl < req.facility.level) return false;
  }
  if (req.allFacilitiesAt) {
    const facs = facilitiesOfProperty(office.property);
    if (!facs.every((f) => (state.facilities?.[f.id] ?? -1) >= req.allFacilitiesAt)) return false;
  }
  if (req.greenFacilitiesAt) {
    const greens = FACILITIES.filter((f) => f.green);
    if (!greens.every((f) => (state.facilities?.[f.id] ?? -1) >= req.greenFacilitiesAt)) return false;
  }
  if (req.roomUnlocked && !state.rooms[req.roomUnlocked]?.unlocked) return false;
  if (req.roomAtLevel) {
    const r2 = state.rooms[req.roomAtLevel.id];
    if (!r2?.unlocked) return false;
    if ((r2.structure + r2.tech + r2.comfort) / 3 < req.roomAtLevel.avg) return false;
  }
  if (req.tech2 && room.tech < req.tech2) return false;
  if (req.legendaryManagers) {
    const count = Object.keys(state.hiredManagers || {}).filter((id) => {
      const d = managerById(id);
      return d && (d.rarity === 'legendary' || d.rarity === 'mythic' || d.rarity === 'unique');
    }).length;
    if (count < req.legendaryManagers) return false;
  }
  if (req.chapter && (state.campaign?.completedChapters || 0) < req.chapter) return false;
  if (req.satisfaction && snapshotSat !== null && snapshotSat < req.satisfaction) return false;
  return true;
}

/** Satisfação de uma sala (PRD §9.2, §33.1). */
export function roomSatisfaction(state, office, mods) {
  const room = state.rooms[office.id];
  if (!room?.unlocked) return BALANCE.satisfactionMin;
  const floor = floorById(office.floor);
  const propMods = mods.perProperty[office.property];
  const floorMods = mods.perFloor[office.floor];

  let sat = (state.challengeMods?.satisfactionStart ?? BALANCE.satisfactionBase)
    + room.comfort * BALANCE.satisfactionPerComfortLevel
    + room.structure * BALANCE.satisfactionPerStructureLevel
    + propMods.satisfaction
    + floorMods.satisfaction
    + mods.satisfactionAllBonus
    + mods.tempSatisfaction;

  // Penalidade por requisitos de contrato não atendidos
  const tenantId = state.tenantsByRoom[office.id];
  if (tenantId) {
    const company = companyById(tenantId);
    if (company && !contractRequirementsMet(state, office, company)) {
      sat -= BALANCE.satisfactionUnmetReqPenalty;
    }
  }

  // Penalidade por condição da propriedade (50–79 → até -5)
  const cond = effectiveCondition(state, office.property, mods);
  if (cond < 80 && cond >= 50) sat -= ((80 - cond) / 30) * BALANCE.condition.satisfactionPenaltyBelow80;
  else if (cond < 50) sat -= BALANCE.condition.satisfactionPenaltyBelow80;

  return clamp(sat, mods.satisfactionFloor, BALANCE.satisfactionMax);
}

export function effectiveCondition(state, propertyId, mods) {
  const base = state.propertyCondition?.[propertyId] ?? 100;
  return clamp(base + (mods?.conditionBonus || 0), 0, 100);
}

/** Multiplicador de sinergia da especialidade (PRD §13.3). */
export function synergyBonus(state, office, company, satisfaction) {
  const room = state.rooms[office.id];
  if (!room || !company) return 0;
  const { structure: s, tech: t, comfort: c } = room;
  if (s + t + c === 0) return 0; // sala sem upgrades não gera sinergia
  const bonus = SYNERGIES[company.specialty]?.bonus || 0;
  switch (company.specialty) {
    case 'tech': return t > (s + c) / 2 ? bonus : 0;
    case 'creative': return c > (s + t) / 2 ? bonus : 0;
    case 'corporate': return s > (t + c) / 2 ? bonus : 0;
    case 'finance': return Math.abs(s - t) <= 5 ? bonus : 0;
    case 'health': return satisfaction > 85 && (state.facilities?.seguranca ?? -1) >= 0 ? bonus : 0;
    case 'commerce': return (state.facilities?.cafeteria ?? -1) >= 0 && satisfaction > 75 ? bonus : 0;
    case 'general': return Math.max(s, t, c) - Math.min(s, t, c) <= 3 ? bonus : 0;
    case 'sustainability': {
      const hasGreen = FACILITIES.some((f) => f.green && f.property === office.property && (state.facilities?.[f.id] ?? -1) >= 0);
      return hasGreen ? bonus : 0;
    }
    case 'aerospace': return t >= 90 ? bonus : 0;
    default: return 0;
  }
}

/** Renda final de uma sala (PRD §9.1, §9.3). */
export function roomIncome(state, office, mods) {
  const room = state.rooms[office.id];
  if (!room?.unlocked) return { gross: 0, final: 0, satisfaction: BALANCE.satisfactionMin, synergy: 0, tenantMult: 1 };

  const tenantId = state.tenantsByRoom[office.id];
  const company = tenantId ? companyById(tenantId) : null;
  const tenantMult = company ? company.mult : 0.5; // sala vazia rende 50% da base

  const totalLevels = room.structure + room.tech + room.comfort;
  const upgradeMult = 1 + BALANCE.roomUpgradeRate * totalLevels;
  const gross = office.baseIncome * tenantMult * upgradeMult * (1 + (room.permBonus || 0));

  const satisfaction = roomSatisfaction(state, office, mods);
  const satWeight = 1 + (mods.satisfactionWeight || 0);
  const satMult = BALANCE.satisfactionIncomeBase + satisfaction * BALANCE.satisfactionIncomeRate * satWeight;

  const floor = floorById(office.floor);
  const floorMods = mods.perFloor[office.floor];
  const propMods = mods.perProperty[office.property];

  let mult = satMult * (floor?.bonus || 1) * floorMods.incomeMult;
  if (floorMods.highSat && satisfaction >= floorMods.highSat.minSat) mult *= 1 + floorMods.highSat.value;

  const synergy = company ? synergyBonus(state, office, company, satisfaction) : 0;
  mult *= 1 + synergy;

  // Bônus de especialidade (instalações da propriedade + gestor do andar + globais)
  if (company) {
    const spec = company.specialty;
    const specBonus = (propMods.specialtyMult[spec] || 0) + (floorMods.specialtyMult[spec] || 0) + (mods.specialtyMult[spec] || 0);
    mult *= 1 + specBonus;
    const catBonus = mods.categoryMult[company.cat] || 0;
    if (catBonus) mult *= 1 + catBonus;
    if (company.cat >= mods.minCategoryMult.min) mult *= 1 + mods.minCategoryMult.value;
  }

  return { gross, final: gross * mult, satisfaction, synergy, tenantMult };
}

// ————— Snapshot econômico —————

/**
 * Calcula o snapshot completo da economia. Executado no máximo 1×/segundo (PRD §46).
 */
export function computeEconomy(state, now = Date.now()) {
  const mods = collectModifiers(state, now);
  const perRoom = {};
  const perProperty = {};
  let satSum = 0;
  let satCount = 0;

  for (const p of PROPERTIES) perProperty[p.id] = 0;

  for (const office of OFFICES) {
    const room = state.rooms[office.id];
    if (!room?.unlocked) continue;
    const r = roomIncome(state, office, mods);
    perRoom[office.id] = r;
    perProperty[office.property] += r.final;
    satSum += r.satisfaction;
    satCount++;
  }

  let total = 0;
  for (const p of PROPERTIES) {
    const propMods = mods.perProperty[p.id];
    let income = perProperty[p.id] * propMods.incomeMult;
    // Penalidade de condição 20–49 → até -10% (PRD §33.1)
    const cond = effectiveCondition(state, p.id, mods);
    if (cond < 50) {
      const pen = cond >= 20
        ? ((50 - cond) / 30) * BALANCE.condition.incomePenaltyBelow50
        : BALANCE.condition.incomePenaltyBelow50;
      income *= 1 - pen;
    }
    perProperty[p.id] = income;
    total += income;
  }

  total = total * mods.incomeMult * mods.prestigeMult * mods.tempIncomeMult;
  total = Math.max(0, total); // renda nunca negativa (PRD §24.1)

  return {
    mods,
    perRoom,
    perProperty,
    totalPerSec: total,
    avgSatisfaction: satCount ? satSum / satCount : BALANCE.satisfactionMin,
    computedAt: now,
  };
}

/** Ganho por toque (PRD §9.5). */
export function tapGain(totalPerSec) {
  return Math.max(BALANCE.tapMinimum, totalPerSec * BALANCE.tapPercent);
}

// ————— Estados visuais —————

export function roomVisualStage(office, room) {
  if (!room?.unlocked) return { name: 'Bloqueada', cls: 'stage-locked' };
  const avg = (room.structure + room.tech + room.comfort) / 3;
  if (room.structure >= office.maxLevel && room.tech >= office.maxLevel && room.comfort >= office.maxLevel) {
    return { name: 'Premium', cls: 'stage-premium' };
  }
  let stage = ROOM_VISUAL_STAGES[0];
  for (const s of ROOM_VISUAL_STAGES) {
    if (s.minAvg !== Infinity && avg >= s.minAvg) stage = s;
  }
  return stage;
}

// ————— Valor do portfólio e Prestígio —————

export function portfolioValue(state, snapshot) {
  const spent = state.spentTotals || {};
  return Math.max(0, state.balance)
    + (spent.rooms || 0) + (spent.upgrades || 0) + (spent.facilities || 0) + (spent.managers || 0)
    + (spent.contracts || 0)
    + snapshot.totalPerSec * 600;
}

/** Valor do empreendimento na venda (PRD §19.2). */
export function prestigeValue(state, snapshot) {
  const spent = state.spentTotals || {};
  return (spent.rooms || 0) + (spent.upgrades || 0) + (spent.facilities || 0) + (spent.managers || 0)
    + snapshot.totalPerSec * BALANCE.prestige.incomeHoursInValue;
}

/** Pontos de Legado recebidos (PRD §19.3). */
export function legacyPointsFor(value, reputation) {
  const p = BALANCE.prestige;
  return Math.max(1,
    Math.floor(p.plMoneyFactor * Math.sqrt(value / p.plMoneyDivisor))
    + Math.floor(reputation / p.plRepDivisor));
}

/** Requisitos de Prestígio atendidos? (PRD §19.1) */
export function prestigeRequirements(state, snapshot) {
  const p = BALANCE.prestige;
  const roomsUnlocked = Object.values(state.rooms).filter((r) => r.unlocked).length;
  const hasCat6 = Object.values(state.tenantsByRoom || {}).some((tid) => {
    const c = companyById(tid);
    return c && c.cat >= 6;
  });
  return [
    { label: `${p.minRooms} salas desbloqueadas`, ok: roomsUnlocked >= p.minRooms, value: `${roomsUnlocked}/${p.minRooms}` },
    { label: 'Quarto andar do Aurora liberado', ok: !!state.floors.aurora_4, value: state.floors.aurora_4 ? 'Sim' : 'Não' },
    { label: `${p.minReputation} REP`, ok: state.reputation >= p.minReputation, value: `${Math.floor(state.reputation)}/${p.minReputation}` },
    { label: 'Renda de $1 mi/s', ok: snapshot.totalPerSec >= p.minIncomePerSecond, value: `${Math.round(snapshot.totalPerSec).toLocaleString('pt-BR')}/s` },
    { label: 'Empresa categoria 6 ativa', ok: hasCat6, value: hasCat6 ? 'Sim' : 'Não' },
  ];
}

// ————— Manutenção (PRD §33.3) —————

export function maintenanceCost(propertyIncomePerSec, discount = 0) {
  const c = BALANCE.condition;
  const raw = propertyIncomePerSec * c.maintenanceIncomeSeconds;
  return clamp(Math.ceil(raw * (1 - discount)), c.maintenanceMinCost, c.maintenanceMaxCost);
}

// ————— Validação numérica (PRD §25.4) —————

export function sanitizeNumber(v, fallback = 0, min = -Infinity, max = Infinity) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return clamp(v, min, max);
}
