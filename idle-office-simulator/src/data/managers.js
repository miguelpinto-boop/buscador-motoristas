// Gestores — PRD §14
// bonus/bonus5: efeitos estruturados; value escala com o nível (core/formulas.js).
// Tipos de efeito:
//   floorIncome        +% renda no andar designado
//   totalIncome        +% renda total
//   propertyIncome     +% renda da propriedade onde está designado
//   satisfaction       +pontos de satisfação no andar
//   specialtyIncome    +% renda de empresas da especialidade (no andar)
//   contractDiscount   -% custo de contratos
//   facilityDiscount   -% custo de instalações
//   trainDiscountTI    -% custo da Sala de TI
//   eventPenalty       -% em penalidades de eventos
//   ppBonus            +% Pontos de Pesquisa
//   projectSpeed       -% duração de projetos
//   projectReward      +% recompensa de projetos
//   repBonus           +% REP de contratos
//   conditionBonus     +pontos de condição efetiva
//   satisfactionFloor  +satisfação mínima efetiva
//   extraManager       +1 gestor extra na propriedade
//   researchDiscount   -% custo de pesquisa
//   extraProposal      +propostas especiais

export const RARITIES = {
  common: { name: 'Comum', color: '#a1a1aa' },
  uncommon: { name: 'Incomum', color: '#22c55e' },
  rare: { name: 'Raro', color: '#3b82f6' },
  epic: { name: 'Épico', color: '#a855f7' },
  legendary: { name: 'Lendário', color: '#f59e0b' },
  mythic: { name: 'Mítico', color: '#ef4444' },
  unique: { name: 'Lendário Único', color: '#facc15' },
};

export const MANAGERS = [
  { id: 'M01', name: 'Ana', title: 'Administradora Júnior', rarity: 'common', cost: 2000, rep: 10,
    bonus: { type: 'floorIncome', value: 0.03 }, bonus5: { type: 'satisfaction', value: 3 } },
  { id: 'M02', name: 'Carlos', title: 'Especialista em Vendas', rarity: 'common', cost: 8000, rep: 30,
    bonus: { type: 'specialtyIncome', specialty: 'commerce', value: 0.05 }, bonus5: { type: 'contractDiscount', value: 0.05 } },
  { id: 'M03', name: 'Júlia', title: 'Designer de Ambientes', rarity: 'uncommon', cost: 30_000, rep: 70,
    bonus: { type: 'satisfaction', value: 5 }, bonus5: { type: 'specialtyIncome', specialty: 'creative', value: 0.05 } },
  { id: 'M04', name: 'Bruno', title: 'Coordenador de TI', rarity: 'uncommon', cost: 100_000, rep: 120,
    bonus: { type: 'specialtyIncome', specialty: 'tech', value: 0.07 }, bonus5: { type: 'trainDiscountTI', value: 0.05 } },
  { id: 'M05', name: 'Marina', title: 'Analista Financeira', rarity: 'rare', cost: 450_000, rep: 220,
    bonus: { type: 'floorIncome', value: 0.08 }, bonus5: { type: 'specialtyIncome', specialty: 'finance', value: 0.05 } },
  { id: 'M06', name: 'Rafael', title: 'Gerente de Operações', rarity: 'rare', cost: 1_500_000, rep: 320,
    bonus: { type: 'facilityDiscount', value: 0.05 }, bonus5: { type: 'floorIncome', value: 0.10 } },
  { id: 'M07', name: 'Camila', title: 'Diretora de Pessoas', rarity: 'epic', cost: 6_000_000, rep: 480,
    bonus: { type: 'satisfaction', value: 10 }, bonus5: { type: 'floorIncomeHighSat', value: 0.08, minSat: 90 } },
  { id: 'M08', name: 'Diego', title: 'Diretor de Segurança', rarity: 'epic', cost: 20_000_000, rep: 620,
    bonus: { type: 'eventPenalty', value: 0.20 }, bonus5: { type: 'specialtyIncome2', specialties: ['health', 'finance'], value: 0.10 } },
  { id: 'M09', name: 'Helena', title: 'Vice-Presidente Global', rarity: 'legendary', cost: 70_000_000, rep: 800,
    bonus: { type: 'floorIncome', value: 0.18 }, bonus5: { type: 'totalIncome', value: 0.05 } },
  { id: 'M10', name: 'Victor', title: 'Visionário da Tecnologia', rarity: 'legendary', cost: 200_000_000, rep: 1000,
    bonus: { type: 'specialtyIncome', specialty: 'tech', value: 0.25 }, bonus5: { type: 'totalIncome', value: 0.08 } },
  { id: 'M11', name: 'Sofia', title: 'Diretora Jurídica', rarity: 'rare', cost: 450e6, rep: 1150,
    bonus: { type: 'specialtyIncome', specialty: 'corporate', value: 0.12 }, bonus5: { type: 'eventPenalty', value: 0.25 } },
  { id: 'M12', name: 'Leandro', title: 'Produtor Executivo', rarity: 'rare', cost: 800e6, rep: 1250,
    bonus: { type: 'specialtyIncome', specialty: 'creative', value: 0.14 }, bonus5: { type: 'projectSpeed', value: 0.15 } },
  { id: 'M13', name: 'Aline', title: 'Chefe de Logística', rarity: 'epic', cost: 1.5e9, rep: 1350,
    bonus: { type: 'specialtyIncome', specialty: 'commerce', value: 0.16 }, bonus5: { type: 'facilityDiscount', value: 0.08 } },
  { id: 'M14', name: 'Marcos', title: 'Diretor de Cibersegurança', rarity: 'epic', cost: 3e9, rep: 1500,
    bonus: { type: 'specialtyIncome', specialty: 'tech', value: 0.18 }, bonus5: { type: 'eventPenalty', value: 0.40 } },
  { id: 'M15', name: 'Renata', title: 'Diretora de Sustentabilidade', rarity: 'epic', cost: 6e9, rep: 1650,
    bonus: { type: 'greenBonus', value: 0.20 }, bonus5: { type: 'conditionBonus', value: 10 } },
  { id: 'M16', name: 'Eduardo', title: 'Pesquisador-Chefe', rarity: 'legendary', cost: 12e9, rep: 1800,
    bonus: { type: 'ppBonus', value: 0.20 }, bonus5: { type: 'researchDiscount', value: 0.10 } },
  { id: 'M17', name: 'Beatriz', title: 'Diretora Aeroespacial', rarity: 'legendary', cost: 25e9, rep: 2000,
    bonus: { type: 'specialtyIncome', specialty: 'aerospace', value: 0.25 }, bonus5: { type: 'projectSpeedLong', value: 0.20 } },
  { id: 'M18', name: 'Otávio', title: 'Arquiteto de Sistemas', rarity: 'legendary', cost: 50e9, rep: 2200,
    bonus: { type: 'totalIncome', value: 0.10 }, bonus5: { type: 'automationEarly', value: 1 } },
  { id: 'M19', name: 'Lívia', title: 'Cientista Genômica', rarity: 'mythic', cost: 100e9, rep: 2500,
    bonus: { type: 'specialtyIncome', specialty: 'health', value: 0.30 }, bonus5: { type: 'satisfactionFloor', value: 5 } },
  { id: 'M20', name: 'Gustavo', title: 'Estrategista Global', rarity: 'mythic', cost: 200e9, rep: 2800,
    bonus: { type: 'propertyIncome', value: 0.25 }, bonus5: { type: 'repBonus', value: 0.20 } },
  { id: 'M21', name: 'Yasmin', title: 'Engenheira Quântica', rarity: 'mythic', cost: 500e9, rep: 3100,
    bonus: { type: 'categoryIncome', category: 9, value: 0.35 }, bonus5: { type: 'ppBonus', value: 0.25 } },
  { id: 'M22', name: 'André', title: 'Embaixador Corporativo', rarity: 'mythic', cost: 1e12, rep: 3400,
    bonus: { type: 'contractDiscount', value: 0.20 }, bonus5: { type: 'extraProposal', value: 1 } },
  { id: 'M23', name: 'Helena II', title: 'Presidente do Conselho', rarity: 'mythic', cost: 2.5e12, rep: 3800,
    bonus: { type: 'totalIncome', value: 0.18 }, bonus5: { type: 'extraManager', value: 1 } },
  { id: 'M24', name: 'Miguel', title: 'Fundador Visionário', rarity: 'unique', cost: 0, rep: 4500, campaignOnly: true,
    bonus: { type: 'totalIncome', value: 0.25 }, bonus5: { type: 'projectReward', value: 0.15 } },
];

export const managerById = (id) => MANAGERS.find((m) => m.id === id);
