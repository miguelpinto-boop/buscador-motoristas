// Propriedades, andares, escritórios e instalações — PRD §10, §12, §29
// Valores canônicos em notação numérica (nunca texto formatado).

export const PROPERTIES = [
  {
    id: 'aurora',
    name: 'Edifício Aurora',
    tagline: 'Introdução e negócios locais',
    icon: '🏢',
    theme: 'aurora',
    unlock: { chapter: 0, rep: 0, cost: 0 }, // inicial
  },
  {
    id: 'torre',
    name: 'Torre Central',
    tagline: 'Empresas nacionais e globais',
    icon: '🏙️',
    theme: 'torre',
    unlock: { chapter: 4, rep: 650, cost: 500e6 },
  },
  {
    id: 'campus',
    name: 'Campus Horizonte',
    tagline: 'Tecnologia avançada e fim de campanha',
    icon: '🌆',
    theme: 'campus',
    unlock: { chapter: 8, rep: 2500, cost: 600e12, prestiges: 1 },
  },
];

// Andares — desbloqueio e bônus (PRD §10.3; Torre/Campus escalados de forma consistente)
export const FLOORS = [
  // Edifício Aurora
  { id: 'aurora_1', property: 'aurora', number: 1, name: 'Térreo', cost: 0, rep: 0, bonus: 1.00, requires: null },
  { id: 'aurora_2', property: 'aurora', number: 2, name: '2º Andar', cost: 12_000, rep: 40, bonus: 1.05, requires: { allRoomsOfFloor: 'aurora_1' } },
  { id: 'aurora_3', property: 'aurora', number: 3, name: '3º Andar', cost: 450_000, rep: 180, bonus: 1.10, requires: { facilitiesAtLevel: { count: 2, level: 5 } } },
  { id: 'aurora_4', property: 'aurora', number: 4, name: '4º Andar', cost: 14_000_000, rep: 500, bonus: 1.15, requires: { managerAtLevel: 5 } },
  // Torre Central
  { id: 'torre_1', property: 'torre', number: 1, name: 'Base da Torre', cost: 0, rep: 650, bonus: 1.00, requires: null },
  { id: 'torre_2', property: 'torre', number: 2, name: 'Torre Média', cost: 12e9, rep: 1000, bonus: 1.05, requires: { allRoomsOfFloor: 'torre_1' } },
  { id: 'torre_3', property: 'torre', number: 3, name: 'Torre Alta', cost: 450e9, rep: 1500, bonus: 1.10, requires: { facilitiesAtLevel: { count: 6, level: 5 } } },
  { id: 'torre_4', property: 'torre', number: 4, name: 'Cobertura', cost: 14e12, rep: 2000, bonus: 1.15, requires: { managerAtLevel: 8 } },
  // Campus Horizonte
  { id: 'campus_1', property: 'campus', number: 1, name: 'Setor Inovação', cost: 0, rep: 2500, bonus: 1.00, requires: null },
  { id: 'campus_2', property: 'campus', number: 2, name: 'Setor Ciência', cost: 12e15, rep: 3000, bonus: 1.05, requires: { allRoomsOfFloor: 'campus_1' } },
  { id: 'campus_3', property: 'campus', number: 3, name: 'Setor Dados', cost: 450e15, rep: 3600, bonus: 1.10, requires: { facilitiesAtLevel: { count: 10, level: 5 } } },
  { id: 'campus_4', property: 'campus', number: 4, name: 'Setor Global', cost: 14e18, rep: 4200, bonus: 1.15, requires: { managerAtLevel: 10 } },
];

// Escritórios (PRD §10.1, §10.1.1, §10.1.2)
// growth: fator de crescimento do custo de upgrade (por andar)
export const OFFICES = [
  // ——— Edifício Aurora ———
  { id: '101', property: 'aurora', floor: 'aurora_1', name: 'Garagem Adaptada', unlockCost: 0, baseIncome: 1, cost: { structure: 20, tech: 30, comfort: 25 }, maxLevel: 25, growth: 1.14 },
  { id: '102', property: 'aurora', floor: 'aurora_1', name: 'Estúdio Freelancer', unlockCost: 500, baseIncome: 4, cost: { structure: 80, tech: 110, comfort: 95 }, maxLevel: 30, growth: 1.14 },
  { id: '103', property: 'aurora', floor: 'aurora_1', name: 'Central de Atendimento', unlockCost: 3500, baseIncome: 18, cost: { structure: 350, tech: 450, comfort: 400 }, maxLevel: 35, growth: 1.14 },
  { id: '201', property: 'aurora', floor: 'aurora_2', name: 'Agência Criativa', unlockCost: 18_000, baseIncome: 70, cost: { structure: 1800, tech: 2300, comfort: 2100 }, maxLevel: 40, growth: 1.15 },
  { id: '202', property: 'aurora', floor: 'aurora_2', name: 'Hub de E-commerce', unlockCost: 60_000, baseIncome: 220, cost: { structure: 6000, tech: 7500, comfort: 6800 }, maxLevel: 45, growth: 1.15 },
  { id: '203', property: 'aurora', floor: 'aurora_2', name: 'Consultoria Regional', unlockCost: 180_000, baseIncome: 650, cost: { structure: 18_000, tech: 22_000, comfort: 20_000 }, maxLevel: 50, growth: 1.15 },
  { id: '301', property: 'aurora', floor: 'aurora_3', name: 'FinTech Regional', unlockCost: 600_000, baseIncome: 1900, cost: { structure: 55_000, tech: 75_000, comfort: 65_000 }, maxLevel: 55, growth: 1.16 },
  { id: '302', property: 'aurora', floor: 'aurora_3', name: 'Estúdio de Jogos', unlockCost: 1_800_000, baseIncome: 5500, cost: { structure: 170_000, tech: 230_000, comfort: 195_000 }, maxLevel: 60, growth: 1.16 },
  { id: '303', property: 'aurora', floor: 'aurora_3', name: 'Laboratório HealthTech', unlockCost: 5_500_000, baseIncome: 16_000, cost: { structure: 520_000, tech: 700_000, comfort: 600_000 }, maxLevel: 65, growth: 1.16 },
  { id: '401', property: 'aurora', floor: 'aurora_4', name: 'Sede Corporativa', unlockCost: 18_000_000, baseIncome: 48_000, cost: { structure: 1_700_000, tech: 2_300_000, comfort: 2_000_000 }, maxLevel: 70, growth: 1.17 },
  { id: '402', property: 'aurora', floor: 'aurora_4', name: 'Laboratório de IA', unlockCost: 55_000_000, baseIncome: 145_000, cost: { structure: 5_200_000, tech: 7_200_000, comfort: 6_000_000 }, maxLevel: 75, growth: 1.17 },
  { id: '403', property: 'aurora', floor: 'aurora_4', name: 'Campus Big Tech', unlockCost: 180_000_000, baseIncome: 450_000, cost: { structure: 17_000_000, tech: 23_000_000, comfort: 20_000_000 }, maxLevel: 80, growth: 1.17 },
  // ——— Torre Central ———
  { id: '501', property: 'torre', floor: 'torre_1', name: 'Escritório Jurídico Prime', unlockCost: 600e6, baseIncome: 1.3e6, cost: { structure: 60e6, tech: 85e6, comfort: 70e6 }, maxLevel: 85, growth: 1.14 },
  { id: '502', property: 'torre', floor: 'torre_1', name: 'Estúdio de Streaming', unlockCost: 1.8e9, baseIncome: 3.8e6, cost: { structure: 180e6, tech: 260e6, comfort: 220e6 }, maxLevel: 90, growth: 1.14 },
  { id: '503', property: 'torre', floor: 'torre_1', name: 'Centro Logístico Inteligente', unlockCost: 5.5e9, baseIncome: 11e6, cost: { structure: 550e6, tech: 760e6, comfort: 650e6 }, maxLevel: 95, growth: 1.14 },
  { id: '601', property: 'torre', floor: 'torre_2', name: 'Bolsa de Serviços', unlockCost: 18e9, baseIncome: 32e6, cost: { structure: 1.8e9, tech: 2.4e9, comfort: 2.1e9 }, maxLevel: 100, growth: 1.15 },
  { id: '602', property: 'torre', floor: 'torre_2', name: 'Centro de Cibersegurança', unlockCost: 55e9, baseIncome: 95e6, cost: { structure: 5.5e9, tech: 7.8e9, comfort: 6.4e9 }, maxLevel: 105, growth: 1.15 },
  { id: '603', property: 'torre', floor: 'torre_2', name: 'Instituto de Pesquisa', unlockCost: 180e9, baseIncome: 280e6, cost: { structure: 18e9, tech: 25e9, comfort: 21e9 }, maxLevel: 110, growth: 1.15 },
  { id: '701', property: 'torre', floor: 'torre_3', name: 'Sede Nacional', unlockCost: 600e9, baseIncome: 850e6, cost: { structure: 60e9, tech: 82e9, comfort: 70e9 }, maxLevel: 115, growth: 1.16 },
  { id: '702', property: 'torre', floor: 'torre_3', name: 'Estúdio de Realidade Estendida', unlockCost: 1.8e12, baseIncome: 2.5e9, cost: { structure: 180e9, tech: 250e9, comfort: 215e9 }, maxLevel: 120, growth: 1.16 },
  { id: '703', property: 'torre', floor: 'torre_3', name: 'BioTech Prime', unlockCost: 5.5e12, baseIncome: 7.5e9, cost: { structure: 550e9, tech: 760e9, comfort: 650e9 }, maxLevel: 125, growth: 1.16 },
  { id: '801', property: 'torre', floor: 'torre_4', name: 'Bolsa Global', unlockCost: 18e12, baseIncome: 22e9, cost: { structure: 1.8e12, tech: 2.5e12, comfort: 2.1e12 }, maxLevel: 130, growth: 1.17 },
  { id: '802', property: 'torre', floor: 'torre_4', name: 'Nuvem Soberana', unlockCost: 55e12, baseIncome: 65e9, cost: { structure: 5.5e12, tech: 7.8e12, comfort: 6.5e12 }, maxLevel: 135, growth: 1.17 },
  { id: '803', property: 'torre', floor: 'torre_4', name: 'Torre Executiva Internacional', unlockCost: 180e12, baseIncome: 200e9, cost: { structure: 18e12, tech: 25e12, comfort: 21e12 }, maxLevel: 140, growth: 1.17 },
  // ——— Campus Horizonte ———
  { id: '901', property: 'campus', floor: 'campus_1', name: 'Incubadora Global', unlockCost: 600e12, baseIncome: 600e9, cost: { structure: 60e12, tech: 85e12, comfort: 70e12 }, maxLevel: 145, growth: 1.14 },
  { id: '902', property: 'campus', floor: 'campus_1', name: 'Centro de Energia Limpa', unlockCost: 1.8e15, baseIncome: 1.8e12, cost: { structure: 180e12, tech: 260e12, comfort: 220e12 }, maxLevel: 150, growth: 1.14 },
  { id: '903', property: 'campus', floor: 'campus_1', name: 'Laboratório Robótico', unlockCost: 5.5e15, baseIncome: 5.4e12, cost: { structure: 550e12, tech: 780e12, comfort: 650e12 }, maxLevel: 155, growth: 1.14 },
  { id: '1001', property: 'campus', floor: 'campus_2', name: 'Centro Aeroespacial', unlockCost: 18e15, baseIncome: 16e12, cost: { structure: 1.8e15, tech: 2.5e15, comfort: 2.1e15 }, maxLevel: 160, growth: 1.15 },
  { id: '1002', property: 'campus', floor: 'campus_2', name: 'Instituto Genômico', unlockCost: 55e15, baseIncome: 48e12, cost: { structure: 5.5e15, tech: 7.8e15, comfort: 6.5e15 }, maxLevel: 165, growth: 1.15 },
  { id: '1003', property: 'campus', floor: 'campus_2', name: 'Fazenda Vertical Corporativa', unlockCost: 180e15, baseIncome: 145e12, cost: { structure: 18e15, tech: 25e15, comfort: 21e15 }, maxLevel: 170, growth: 1.15 },
  { id: '1101', property: 'campus', floor: 'campus_3', name: 'Cidade de Dados', unlockCost: 600e15, baseIncome: 430e12, cost: { structure: 60e15, tech: 85e15, comfort: 70e15 }, maxLevel: 175, growth: 1.16 },
  { id: '1102', property: 'campus', floor: 'campus_3', name: 'Centro Quântico', unlockCost: 1.8e18, baseIncome: 1.3e15, cost: { structure: 180e15, tech: 260e15, comfort: 220e15 }, maxLevel: 180, growth: 1.16 },
  { id: '1103', property: 'campus', floor: 'campus_3', name: 'Distrito de Automação', unlockCost: 5.5e18, baseIncome: 3.9e15, cost: { structure: 550e15, tech: 780e15, comfort: 650e15 }, maxLevel: 185, growth: 1.16 },
  { id: '1201', property: 'campus', floor: 'campus_4', name: 'Conselho Multinacional', unlockCost: 18e18, baseIncome: 12e15, cost: { structure: 1.8e18, tech: 2.5e18, comfort: 2.1e18 }, maxLevel: 190, growth: 1.17 },
  { id: '1202', property: 'campus', floor: 'campus_4', name: 'Núcleo de Inovação Mundial', unlockCost: 55e18, baseIncome: 36e15, cost: { structure: 5.5e18, tech: 7.8e18, comfort: 6.5e18 }, maxLevel: 195, growth: 1.17 },
  { id: '1203', property: 'campus', floor: 'campus_4', name: 'Sede do Império Corporativo', unlockCost: 180e18, baseIncome: 110e15, cost: { structure: 18e18, tech: 25e18, comfort: 21e18 }, maxLevel: 200, growth: 1.17 },
];

// Instalações compartilhadas (PRD §12; Torre e Campus §10.1.1/§10.1.2) — total: 13
// effect: { type, value } aplicado por nível.
export const FACILITIES = [
  // Edifício Aurora
  { id: 'recepcao', property: 'aurora', name: 'Recepção', icon: '🛎️', buildCost: 5000, maxLevel: 20, upgradeBase: 1000,
    effect: { type: 'incomeTotal', value: 0.005 }, desc: '+0,5% na renda total por nível',
    milestones: { 5: { incomeTotal: 0.03 }, 10: { rep: 5 }, 15: { eventPositiveDuration: 0.10 }, 20: { incomeTotal: 0.10 } } },
  { id: 'cafeteria', property: 'aurora', name: 'Cafeteria', icon: '☕', buildCost: 35_000, maxLevel: 20, upgradeBase: 7000,
    effect: { type: 'satisfactionAll', value: 0.75 }, desc: '+0,75 de satisfação em todas as salas por nível',
    milestones: { 5: { satisfactionAll: 2 }, 10: { rep: 8 }, 15: { incomeTotal: 0.03 }, 20: { satisfactionAll: 5 } } },
  { id: 'sala_ti', property: 'aurora', name: 'Sala de TI', icon: '💻', buildCost: 250_000, maxLevel: 20, upgradeBase: 50_000,
    effect: { type: 'specialtyIncome', specialty: 'tech', value: 0.01 }, desc: '+1% na renda de empresas de tecnologia por nível',
    milestones: { 5: { specialtyIncome: 0.05 }, 10: { rep: 10 }, 15: { incomeTotal: 0.02 }, 20: { specialtyIncome: 0.10 } } },
  { id: 'academia', property: 'aurora', name: 'Academia', icon: '🏋️', buildCost: 2_000_000, maxLevel: 20, upgradeBase: 400_000,
    effect: { type: 'incomeAndSatisfaction', income: 0.005, satisfaction: 0.5 }, desc: '+0,5% de renda e +0,5 de satisfação por nível',
    milestones: { 5: { satisfactionAll: 2 }, 10: { rep: 12 }, 15: { incomeTotal: 0.03 }, 20: { incomeTotal: 0.08 } } },
  { id: 'seguranca', property: 'aurora', name: 'Segurança', icon: '🛡️', buildCost: 12_000_000, maxLevel: 20, upgradeBase: 2_400_000,
    effect: { type: 'eventPenaltyReduction', value: 0.03 }, desc: 'Reduz penalidades de eventos em 3% por nível',
    milestones: { 5: { rep: 10 }, 10: { incomeTotal: 0.02 }, 15: { eventPenaltyReduction: 0.10 }, 20: { incomeTotal: 0.08 } } },
  // Torre Central
  { id: 'restaurante', property: 'torre', name: 'Restaurante Executivo', icon: '🍽️', buildCost: 2e9, maxLevel: 20, upgradeBase: 400e6,
    effect: { type: 'satisfactionAll', value: 0.75 }, desc: '+0,75 de satisfação em todas as salas por nível',
    milestones: { 5: { satisfactionAll: 2 }, 10: { rep: 20 }, 15: { incomeTotal: 0.03 }, 20: { satisfactionAll: 5 } } },
  { id: 'datacenter', property: 'torre', name: 'Data Center', icon: '🗄️', buildCost: 12e9, maxLevel: 20, upgradeBase: 2.4e9,
    effect: { type: 'specialtyIncome', specialty: 'tech', value: 0.012 }, desc: '+1,2% na renda de empresas de tecnologia por nível',
    milestones: { 5: { specialtyIncome: 0.05 }, 10: { rep: 25 }, 15: { incomeTotal: 0.02 }, 20: { specialtyIncome: 0.10 } } },
  { id: 'auditorio', property: 'torre', name: 'Auditório', icon: '🎤', buildCost: 60e9, maxLevel: 20, upgradeBase: 12e9,
    effect: { type: 'incomeTotal', value: 0.006 }, desc: '+0,6% na renda total por nível',
    milestones: { 5: { rep: 20 }, 10: { incomeTotal: 0.03 }, 15: { eventPositiveDuration: 0.10 }, 20: { incomeTotal: 0.10 } } },
  { id: 'heliponto', property: 'torre', name: 'Heliponto', icon: '🚁', buildCost: 300e9, maxLevel: 20, upgradeBase: 60e9,
    effect: { type: 'incomeTotal', value: 0.007 }, desc: '+0,7% na renda total por nível',
    milestones: { 5: { rep: 30 }, 10: { incomeTotal: 0.03 }, 15: { incomeTotal: 0.04 }, 20: { incomeTotal: 0.12 } } },
  // Campus Horizonte
  { id: 'usina_solar', property: 'campus', name: 'Usina Solar', icon: '☀️', buildCost: 2e15, maxLevel: 20, upgradeBase: 400e12,
    effect: { type: 'incomeTotal', value: 0.006 }, desc: '+0,6% na renda total por nível (bônus verde)', green: true,
    milestones: { 5: { rep: 40 }, 10: { incomeTotal: 0.03 }, 15: { incomeTotal: 0.05 }, 20: { incomeTotal: 0.12 } } },
  { id: 'mobilidade', property: 'campus', name: 'Centro de Mobilidade', icon: '🚈', buildCost: 12e15, maxLevel: 20, upgradeBase: 2.4e15,
    effect: { type: 'satisfactionAll', value: 0.8 }, desc: '+0,8 de satisfação em todas as salas por nível', green: true,
    milestones: { 5: { satisfactionAll: 2 }, 10: { rep: 45 }, 15: { incomeTotal: 0.03 }, 20: { satisfactionAll: 5 } } },
  { id: 'prototipagem', property: 'campus', name: 'Laboratório de Prototipagem', icon: '🔬', buildCost: 60e15, maxLevel: 20, upgradeBase: 12e15,
    effect: { type: 'specialtyIncome', specialty: 'tech', value: 0.015 }, desc: '+1,5% na renda de empresas de tecnologia por nível',
    milestones: { 5: { specialtyIncome: 0.06 }, 10: { rep: 50 }, 15: { incomeTotal: 0.03 }, 20: { specialtyIncome: 0.12 } } },
  { id: 'sustentabilidade', property: 'campus', name: 'Centro de Sustentabilidade', icon: '🌱', buildCost: 300e15, maxLevel: 20, upgradeBase: 60e15,
    effect: { type: 'incomeAndSatisfaction', income: 0.006, satisfaction: 0.6 }, desc: '+0,6% de renda e +0,6 de satisfação por nível', green: true,
    milestones: { 5: { rep: 50 }, 10: { incomeTotal: 0.03 }, 15: { satisfactionAll: 3 }, 20: { incomeTotal: 0.12 } } },
];

// Departamentos da Sede Administrativa (PRD §31.1) — nível 1 a 20
export const HQ_DEPARTMENTS = [
  { id: 'financeiro', name: 'Financeiro', icon: '💰', desc: 'Custo, renda e contratos', maxLevel: 20,
    baseCost: 2e6, growth: 1.35, effect: { incomeTotal: 0.005, contractDiscount: 0.005 } },
  { id: 'operacoes', name: 'Operações', icon: '⚙️', desc: 'Instalações, manutenção e tempo offline', maxLevel: 20,
    baseCost: 5e6, growth: 1.35, effect: { facilityDiscount: 0.005, maintenanceDiscount: 0.01 } },
  { id: 'pessoas', name: 'Pessoas', icon: '🧑‍🤝‍🧑', desc: 'Gestores, satisfação e treinamento', maxLevel: 20,
    baseCost: 10e6, growth: 1.35, effect: { satisfactionAll: 0.25, trainDiscount: 0.005 } },
  { id: 'inovacao', name: 'Inovação', icon: '💡', desc: 'PP, projetos e empresas tecnológicas', maxLevel: 20,
    baseCost: 20e6, growth: 1.35, effect: { ppBonus: 0.01, techIncome: 0.005 } },
  { id: 'marketing', name: 'Marketing', icon: '📣', desc: 'REP, propostas e eventos positivos', maxLevel: 20,
    baseCost: 40e6, growth: 1.35, effect: { repBonus: 0.01, eventPositive: 0.01 } },
  { id: 'sustentabilidade_hq', name: 'Sustentabilidade', icon: '♻️', desc: 'Eficiência, condição e bônus verdes', maxLevel: 20,
    baseCost: 80e6, growth: 1.35, effect: { greenBonus: 0.01, conditionRecovery: 0.5 } },
];

// Estados visuais das salas (PRD §10.4)
export const ROOM_VISUAL_STAGES = [
  { minAvg: 0, name: 'Básica', cls: 'stage-basic' },
  { minAvg: 5, name: 'Reformada', cls: 'stage-renovated' },
  { minAvg: 15, name: 'Moderna', cls: 'stage-modern' },
  { minAvg: 30, name: 'Executiva', cls: 'stage-executive' },
  { minAvg: Infinity, name: 'Premium', cls: 'stage-premium' }, // atingido no nível máximo
];

export const officeById = (id) => OFFICES.find((o) => o.id === id);
export const floorById = (id) => FLOORS.find((f) => f.id === id);
export const facilityById = (id) => FACILITIES.find((f) => f.id === id);
export const propertyById = (id) => PROPERTIES.find((p) => p.id === id);
export const officesOfFloor = (floorId) => OFFICES.filter((o) => o.floor === floorId);
export const floorsOfProperty = (propId) => FLOORS.filter((f) => f.property === propId);
export const facilitiesOfProperty = (propId) => FACILITIES.filter((f) => f.property === propId);
