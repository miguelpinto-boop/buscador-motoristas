// Configuração central de balanceamento — PRD §9, §24
// Todos os tempos, custos e multiplicadores do jogo vivem aqui.

export const BALANCE = {
  // Estado inicial (PRD §10.2)
  initialBalance: 100,
  initialReputation: 0,

  // Economia (PRD §9)
  roomUpgradeRate: 0.10,          // cada nível combinado = +10% na renda base ajustada
  tapPercent: 0.08,               // ganho por toque = 8% da renda/s (mín. $1)
  tapMinimum: 1,

  // Satisfação (PRD §9.2)
  satisfactionBase: 50,
  satisfactionMin: 50,
  satisfactionMax: 100,
  satisfactionIncomeBase: 0.70,   // mult = 0.70 + satisfacao * 0.006
  satisfactionIncomeRate: 0.006,
  // contribuição dos upgrades para a satisfação (configurável)
  satisfactionPerComfortLevel: 0.6,
  satisfactionPerStructureLevel: 0.3,
  satisfactionUnmetReqPenalty: 15,

  // Fatores de crescimento de custo de upgrade por andar (PRD §9.6)
  upgradeGrowthByFloor: [1.14, 1.15, 1.16, 1.17],

  // Instalações (PRD §12.1)
  facilityCostGrowth: 1.18,

  // Gestores (PRD §14.3)
  managerTrainBaseRate: 0.25,
  managerTrainGrowth: 1.55,
  managerMaxLevel: 10,
  managerLevelScale: 0.20,        // efeito por nível: base × (1 + 0.20 × (nível-1))
  managerTrainRepRequired: {      // níveis 5-9 exigem REP mínima
    5: 100, 6: 200, 7: 350, 8: 550, 9: 800,
  },

  // Ganho offline (PRD §18)
  offlineLimitHoursDefault: 8,
  offlineLimitHoursVip: 24,
  offlineLimitHoursMax: 36,
  offlineMinSeconds: 60,

  // Eventos aleatórios (PRD §17)
  eventIntervalMinMs: 6 * 60 * 1000,
  eventIntervalMaxMs: 12 * 60 * 1000,
  eventDecisionSeconds: 25,
  eventGraceMinutes: 10,          // sem eventos negativos nos primeiros 10 min do save
  eventMaxIncomePenalty: 0.20,    // efeitos negativos limitados a 20% da renda

  // Prestígio (PRD §19)
  prestige: {
    minRooms: 12,
    minReputation: 900,
    minIncomePerSecond: 1e6,
    requiresFloor4: true,
    requiresCategory6Tenant: true,
    plMoneyDivisor: 1e9,          // PL = 10 × sqrt(valor / 1e9) + REP/250
    plMoneyFactor: 10,
    plRepDivisor: 250,
    incomeHoursInValue: 3600,     // valorDoPredio inclui renda × 3600
    ppRetention: 0.50,            // 50% dos PP mantidos por padrão
  },

  // Boosts / anúncios simulados (PRD §20)
  ads: {
    loadMs: 1000,
    playMs: 2000,
    coffeeBoostMult: 2,
    coffeeBoostHours: 4,
    coffeeBoostMaxHours: 12,
    investorIntervalMinMs: 10 * 60 * 1000,
    investorIntervalMaxMs: 15 * 60 * 1000,
    investorRewardMinutes: 30,
    renovationDiscount: 0.20,
    renovationUpgrades: 10,
    renovationMaxUpgrades: 30,
  },

  // Soft caps (PRD §24.1)
  maxCombinedDiscount: 0.60,

  // Manutenção e Condição (PRD §33)
  condition: {
    maintenanceIncomeSeconds: 300, // custo = renda da propriedade/s × 300
    maintenanceRestore: 10,
    maintenanceMinCost: 100,
    maintenanceMaxCost: 1e21,
    satisfactionPenaltyBelow80: 5,   // até -5 de satisfação (50–79)
    incomePenaltyBelow50: 0.10,      // até -10% renda (20–49)
    premiumBlockBelow: 20,           // <20: empresas premium (cat 5+) recusam
  },

  // Mercado (PRD §34) — impacto negativo máximo 10%
  marketMaxPenalty: 0.10,

  // Missões diárias/semanais (PRD §36)
  dailyMissionCount: 3,
  weeklyMissionCount: 5,
  dailyRerollsPerMission: 1,

  // Coleção (PRD §35.3)
  collectionBonusCap: 0.05,
  collectionBonusCapUpgraded: 0.07, // com melhoria L23

  // Marcos de upgrade por sala (PRD §11.4)
  upgradeMilestones: [
    { sum: 15, rep: 5, cashPct: 0, permBonus: 0 },
    { sum: 30, rep: 10, cashPct: 60, permBonus: 0 },      // cashPct = segundos de renda da sala
    { sum: 60, rep: 20, cashPct: 0, permBonus: 0.02 },
    { sum: 100, rep: 30, cashPct: 0, permBonus: 0 },
    { sum: -1, rep: 50, cashPct: 0, permBonus: 0 },       // -1 = nível máximo total
  ],

  // Salvamento (PRD §25)
  autosaveIntervalMs: 10_000,
  saveKey: 'idleOfficeSaveV3',
  backupKey: 'idleOfficeSaveV3_backup',
  checkpointKey: 'idleOfficeSaveV3_checkpoint',

  // Loop (PRD §26.4, §46)
  economyTickMs: 1000,
  renderTickMs: 250,

  // Modo Império (PRD §38.3)
  empire: {
    requiresPrestiges: 3,
  },
};
