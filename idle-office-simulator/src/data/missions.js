// Missões — PRD §15 e §36
// check: condição declarativa avaliada por systems/progression.js
//   Tipos baseados em estatísticas do ciclo (contadores): upgradesBought, contractsSigned,
//   taps, adsWatched, facilityUpgrades, managersTrained, offlineCollections, eventsCompleted,
//   moneyEarned, moneySpent, projectsCompleted, conditionRestored, requestsCompleted,
//   ppEarned, rivalWins, itemsEquipped, chapterStepsDone, maintenancesDone, researchBought,
//   newContractsSigned, daysPlayed
//   Tipos baseados em estado: roomUnlocked, floorUnlocked, incomeRate, categoryLevel,
//   satisfactionRoom, facilityBuilt, managersHired, roomsUnlockedCount, repTotal,
//   facilitiesBuiltCount, facilityMaxed, discoveredCount, avgSatisfaction, prestiges,
//   propertyUnlocked, roomPremium, incomeGrowth

// ——— Tutorial (PRD §15.1) — sequência de 15 ———
export const TUTORIAL_MISSIONS = [
  { id: 'tut01', name: 'Comprar um upgrade', check: { type: 'upgradesBought', value: 1 }, reward: { money: 50 } },
  { id: 'tut02', name: 'Elevar uma categoria ao nível 3', check: { type: 'categoryLevel', value: 3 }, reward: { money: 100, rep: 2 } },
  { id: 'tut03', name: 'Desbloquear a sala 102', check: { type: 'roomUnlocked', value: '102' }, reward: { money: 250, rep: 3 } },
  { id: 'tut04', name: 'Assinar um novo contrato', check: { type: 'contractsSigned', value: 1 }, reward: { money: 500, rep: 5 } },
  { id: 'tut05', name: 'Atingir $10/s', check: { type: 'incomeRate', value: 10 }, reward: { money: 1000, rep: 5 } },
  { id: 'tut06', name: 'Liberar a sala 103', check: { type: 'roomUnlocked', value: '103' }, reward: { money: 2000, rep: 8 } },
  { id: 'tut07', name: 'Construir a Recepção', check: { type: 'facilityBuilt', value: 'recepcao' }, reward: { money: 3000, rep: 10 } },
  { id: 'tut08', name: 'Contratar um gestor', check: { type: 'managersHired', value: 1 }, reward: { money: 5000, rep: 10 } },
  { id: 'tut09', name: 'Atingir 75 de satisfação em uma sala', check: { type: 'satisfactionRoom', value: 75 }, reward: { money: 7500, rep: 12 } },
  { id: 'tut10', name: 'Liberar o segundo andar', check: { type: 'floorUnlocked', value: 'aurora_2' }, reward: { money: 15_000, rep: 15 } },
  { id: 'tut11', name: 'Completar um evento', check: { type: 'eventsCompleted', value: 1 }, reward: { money: 25_000, rep: 20 } },
  { id: 'tut12', name: 'Atingir $1.000/s', check: { type: 'incomeRate', value: 1000 }, reward: { money: 50_000, rep: 25 } },
  { id: 'tut13', name: 'Concluir o primeiro projeto empresarial', check: { type: 'projectsCompleted', value: 1 }, reward: { money: 100_000, pp: 10 } },
  { id: 'tut14', name: 'Desbloquear a Torre Central', check: { type: 'propertyUnlocked', value: 'torre' }, reward: { money: 1e6, rep: 40 } },
  { id: 'tut15', name: 'Comprar a primeira pesquisa', check: { type: 'researchBought', value: 1 }, reward: { money: 2e6, pp: 15 } },
];

// ——— Marcos (PRD §15.2) — 40 no total ———
const M = (id, name, check, reward) => ({ id, name, check, reward });
export const MILESTONE_MISSIONS = [
  // Escritórios: 3, 6, 12, 18, 24, 30, 36 (7)
  ...[3, 6, 12, 18, 24, 30, 36].map((n, i) =>
    M(`mk_rooms_${n}`, `Desbloquear ${n} escritórios`, { type: 'roomsUnlockedCount', value: n },
      { money: 500 * 10 ** (i + 1), rep: 10 + i * 10 })),
  // Renda: $100/s, $10 mil/s, $1 mi/s, $1 bi/s, $1 tri/s, $1 qua/s (6)
  ...[[100, '100/s'], [1e4, '10 mil/s'], [1e6, '1 mi/s'], [1e9, '1 bi/s'], [1e12, '1 tri/s'], [1e15, '1 qua/s']].map(([v, label], i) =>
    M(`mk_income_${i}`, `Atingir renda de $${label}`, { type: 'incomeRate', value: v },
      { money: v * 120, rep: 15 + i * 15 })),
  // Reputação: 100, 500, 1000, 2500, 5000 (5)
  ...[100, 500, 1000, 2500, 5000].map((v, i) =>
    M(`mk_rep_${v}`, `Acumular ${v} REP`, { type: 'repTotal', value: v },
      { money: 10 ** (4 + i * 2), pp: 5 + i * 5 })),
  // Instalações: construir 5, 9, 13 e uma no nível máximo (4)
  ...[5, 9, 13].map((v, i) =>
    M(`mk_fac_${v}`, `Construir ${v} instalações`, { type: 'facilitiesBuiltCount', value: v },
      { money: 10 ** (5 + i * 3), rep: 20 + i * 15 })),
  M('mk_fac_max', 'Elevar uma instalação ao nível máximo', { type: 'facilityMaxed', value: 1 }, { money: 1e9, rep: 60 }),
  // Gestores: 3, 6, 12, 18, 24 (5)
  ...[3, 6, 12, 18, 24].map((v, i) =>
    M(`mk_mgr_${v}`, `Contratar ${v} gestores`, { type: 'managersHired', value: v },
      { money: 10 ** (4 + i * 2), rep: 15 + i * 15 })),
  // Contratos: descobrir 6, 12, 18, 24, 30, 36 empresas (6)
  ...[6, 12, 18, 24, 30, 36].map((v, i) =>
    M(`mk_disc_${v}`, `Descobrir ${v} empresas`, { type: 'discoveredCount', value: v },
      { money: 10 ** (4 + i * 2), rep: 12 + i * 12 })),
  // Satisfação média: 80, 90, 95 (3)
  ...[80, 90, 95].map((v, i) =>
    M(`mk_sat_${v}`, `Atingir satisfação média ${v}`, { type: 'avgSatisfaction', value: v },
      { money: 10 ** (6 + i * 3), rep: 30 + i * 20 })),
  // Prestígios: 1, 3, 5, 10 (4)
  ...[1, 3, 5, 10].map((v, i) =>
    M(`mk_prest_${v}`, `Completar ${v} Prestígio${v > 1 ? 's' : ''}`, { type: 'prestiges', value: v },
      { pl: 2 + i * 3, rep: 50 })),
];

// ——— Modelos de missão diária (PRD §15.3) — 20 modelos ———
// rewardScale: multiplica a renda/s atual para escalar a recompensa.
export const DAILY_TEMPLATES = [
  { id: 'd01', name: 'Comprar 10 upgrades', check: { type: 'upgradesBought', value: 10 }, rewardScale: { moneySeconds: 300 } },
  { id: 'd02', name: 'Ganhar 10 minutos de renda', check: { type: 'moneyEarned', incomeSeconds: 600 }, rewardScale: { moneySeconds: 200, rep: 3 } },
  { id: 'd03', name: 'Tocar em "Trabalhar" 25 vezes', check: { type: 'taps', value: 25 }, rewardScale: { moneySeconds: 240 } },
  { id: 'd04', name: 'Concluir um anúncio recompensado', check: { type: 'adsWatched', value: 1 }, rewardScale: { moneySeconds: 300 }, isAd: true },
  { id: 'd05', name: 'Melhorar uma instalação', check: { type: 'facilityUpgrades', value: 1 }, rewardScale: { moneySeconds: 240, rep: 2 } },
  { id: 'd06', name: 'Assinar um contrato', check: { type: 'contractsSigned', value: 1 }, rewardScale: { moneySeconds: 300, rep: 3 } },
  { id: 'd07', name: 'Atingir satisfação 85 em uma sala', check: { type: 'satisfactionRoom', value: 85 }, rewardScale: { moneySeconds: 300, rep: 3 } },
  { id: 'd08', name: 'Treinar um gestor', check: { type: 'managersTrained', value: 1 }, rewardScale: { moneySeconds: 300 }, requires: 'managers' },
  { id: 'd09', name: 'Coletar ganhos offline', check: { type: 'offlineCollections', value: 1 }, rewardScale: { moneySeconds: 200 } },
  { id: 'd10', name: 'Completar um evento', check: { type: 'eventsCompleted', value: 1 }, rewardScale: { moneySeconds: 300, rep: 4 } },
  { id: 'd11', name: 'Aumentar a renda em 20%', check: { type: 'incomeGrowth', value: 0.20 }, rewardScale: { moneySeconds: 400, rep: 5 } },
  { id: 'd12', name: 'Gastar 15 minutos de renda', check: { type: 'moneySpent', incomeSeconds: 900 }, rewardScale: { moneySeconds: 300 } },
  { id: 'd13', name: 'Concluir um projeto empresarial', check: { type: 'projectsCompleted', value: 1 }, rewardScale: { moneySeconds: 350, pp: 3 }, requires: 'projects' },
  { id: 'd14', name: 'Restaurar 10 pontos de Condição', check: { type: 'conditionRestored', value: 10 }, rewardScale: { moneySeconds: 250 }, requires: 'maintenance' },
  { id: 'd15', name: 'Atender uma solicitação de inquilino', check: { type: 'requestsCompleted', value: 1 }, rewardScale: { moneySeconds: 300, rep: 3 }, requires: 'maintenance' },
  { id: 'd16', name: 'Obter Pontos de Pesquisa', check: { type: 'ppEarned', value: 1 }, rewardScale: { moneySeconds: 300 }, requires: 'projects' },
  { id: 'd17', name: 'Levar uma sala ao estado Premium', check: { type: 'roomPremium', value: 1 }, rewardScale: { moneySeconds: 500, rep: 8 } },
  { id: 'd18', name: 'Vencer uma meta do rival', check: { type: 'rivalWins', value: 1 }, rewardScale: { moneySeconds: 400, rep: 5 }, requires: 'rival' },
  { id: 'd19', name: 'Equipar um item de coleção', check: { type: 'itemsEquipped', value: 1 }, rewardScale: { moneySeconds: 250 }, requires: 'collection' },
  { id: 'd20', name: 'Completar uma etapa de capítulo', check: { type: 'chapterStepsDone', value: 1 }, rewardScale: { moneySeconds: 350, rep: 4 } },
];

// ——— Modelos semanais (PRD §36.2) — 12 modelos ———
export const WEEKLY_TEMPLATES = [
  { id: 'w01', name: 'Concluir 3 projetos', check: { type: 'projectsCompleted', value: 3 }, rewardScale: { moneySeconds: 1800, pp: 10 }, requires: 'projects' },
  { id: 'w02', name: 'Ganhar 150 REP', check: { type: 'repEarned', value: 150 }, rewardScale: { moneySeconds: 1500, pp: 8 } },
  { id: 'w03', name: 'Comprar 60 upgrades', check: { type: 'upgradesBought', value: 60 }, rewardScale: { moneySeconds: 1500 } },
  { id: 'w04', name: 'Atingir satisfação média 85', check: { type: 'avgSatisfaction', value: 85 }, rewardScale: { moneySeconds: 1200, rep: 15 } },
  { id: 'w05', name: 'Vencer um desafio do rival', check: { type: 'rivalWins', value: 1 }, rewardScale: { moneySeconds: 1800, rep: 20 }, requires: 'rival' },
  { id: 'w06', name: 'Realizar 3 manutenções', check: { type: 'maintenancesDone', value: 3 }, rewardScale: { moneySeconds: 1200 }, requires: 'maintenance' },
  { id: 'w07', name: 'Comprar 2 pesquisas', check: { type: 'researchBought', value: 2 }, rewardScale: { moneySeconds: 1800, pp: 10 }, requires: 'research' },
  { id: 'w08', name: 'Assinar 3 contratos inéditos', check: { type: 'newContractsSigned', value: 3 }, rewardScale: { moneySeconds: 1500, rep: 15 } },
  { id: 'w09', name: 'Treinar gestores 5 vezes', check: { type: 'managersTrained', value: 5 }, rewardScale: { moneySeconds: 1500 }, requires: 'managers' },
  { id: 'w10', name: 'Completar 5 eventos', check: { type: 'eventsCompleted', value: 5 }, rewardScale: { moneySeconds: 1500, rep: 15 } },
  { id: 'w11', name: 'Aumentar o valor do portfólio em 50%', check: { type: 'portfolioGrowth', value: 0.5 }, rewardScale: { moneySeconds: 2400, pp: 12 } },
  { id: 'w12', name: 'Jogar em 3 dias diferentes', check: { type: 'daysPlayed', value: 3 }, rewardScale: { moneySeconds: 1800, rep: 20 } },
];

// ——— Calendário de retorno (PRD §36.3) — ciclo de 7 entradas ———
export const LOGIN_CALENDAR = [
  { day: 1, reward: { moneySeconds: 600 }, label: '10 min de renda' },
  { day: 2, reward: { rep: 10 }, label: '+10 REP' },
  { day: 3, reward: { moneySeconds: 1200 }, label: '20 min de renda' },
  { day: 4, reward: { pp: 5 }, label: '+5 PP' },
  { day: 5, reward: { moneySeconds: 2400 }, label: '40 min de renda' },
  { day: 6, reward: { rep: 25 }, label: '+25 REP' },
  { day: 7, reward: { pp: 15, collectionRoll: true }, label: '+15 PP e item de coleção' },
];
