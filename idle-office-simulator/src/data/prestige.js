// Melhorias permanentes de Prestígio (Legado) — PRD §19.6 — 24 melhorias.
// costGrowth: custo do próximo nível = ceil(custoBase × costGrowth^nível)

const L = (id, name, desc, maxLevel, baseCost, effect, costGrowth = 1.6) => ({
  id, name, desc, maxLevel, baseCost, effect, costGrowth,
});

export const LEGACY_UPGRADES = [
  L('L01', 'Capital Inicial', '+$500 de saldo inicial por nível', 10, 1, { startMoney: 500 }),
  L('L02', 'Marca Reconhecida', '+2% de renda total por nível', 10, 1, { incomeTotal: 0.02 }),
  L('L03', 'Reforma Eficiente', '-2% no custo de upgrades por nível', 10, 2, { upgradeDiscount: 0.02 }),
  L('L04', 'Boa Reputação', '+5 REP inicial por nível', 5, 2, { startRep: 5 }),
  L('L05', 'Contratos Ágeis', '-3% no custo de contratos por nível', 5, 3, { contractDiscount: 0.03 }),
  L('L06', 'Obras Planejadas', '-3% no custo de salas e andares por nível', 5, 3, { unlockDiscount: 0.03 }),
  L('L07', 'Gestão Experiente', '+1 nível inicial para gestores contratados por nível', 5, 4, { managerStartLevel: 1 }),
  L('L08', 'Prédio Inteligente', '+3% no bônus das instalações por nível', 5, 4, { facilityBonus: 0.03 }),
  L('L09', 'Trabalho Remoto', '+3 horas no limite offline por nível', 4, 5, { offlineHours: 3 }),
  L('L10', 'Missões Lucrativas', '+5% nas recompensas de missões por nível', 5, 5, { missionBonus: 0.05 }),
  L('L11', 'Investidor Favorável', '+5% nas recompensas de anúncios por nível', 5, 6, { adBonus: 0.05 }),
  L('L12', 'Começo Acelerado', 'O primeiro andar começa totalmente liberado', 1, 25, { startFloor1: true }),
  L('L13', 'Memória de Pesquisa', 'Mantém +10% de PP por nível no Prestígio', 3, 8, { ppRetention: 0.10 }),
  L('L14', 'Projetos Paralelos', 'Libera um espaço permanente de projeto por nível', 2, 15, { projectSlots: 1 }),
  L('L15', 'Manutenção Inteligente', '-5% no custo de manutenção por nível', 5, 6, { maintenanceDiscount: 0.05 }),
  L('L16', 'Prestígio da Marca', '+4% de REP recebida por nível', 5, 7, { repBonus: 0.04 }),
  L('L17', 'Rede de Gestores', 'Gestores começam nos níveis 2/3/4 (por nível da melhoria)', 3, 10, { managerStartLevel: 1 }),
  L('L18', 'Contratos Herdados', 'Uma empresa por propriedade permanece descoberta por nível', 3, 12, { keepDiscovered: 1 }),
  L('L19', 'Cultura Forte', '+2 de satisfação mínima por nível', 5, 8, { satisfactionFloor: 2 }),
  L('L20', 'Instalação Modular', 'A primeira instalação de cada propriedade custa 20% menos por nível', 4, 10, { firstFacilityDiscount: 0.20 }),
  L('L21', 'Chance Excelente', '+2% por nível na chance de projetos excelentes', 5, 10, { excellentChance: 0.02 }),
  L('L22', 'Conselho Permanente', 'Metas de Conselho entregam +15% por nível', 3, 18, { councilBonus: 0.15 }),
  L('L23', 'Colecionador', 'O teto do bônus cosmético passa de 5% para 7%', 1, 25, { collectionCapUp: true }),
  L('L24', 'Império Eterno', 'Libera modificadores avançados do Modo Império', 1, 50, { empireModifiers: true }),
];

export const legacyById = (id) => LEGACY_UPGRADES.find((l) => l.id === id);

// Produtos da loja simulada — PRD §20.3 — nenhuma cobrança real.
export const STORE_PRODUCTS = [
  { id: 'starter', name: 'Pacote de Iniciante', price: 'R$ 2,90', type: 'unique', icon: '🎁',
    desc: 'Mínimo de $10.000, +10% de renda permanente e 1 salto de 4h',
    grant: { moneyMin: 10_000, moneySeconds: 3600, permIncome: 0.10, items: { skip4h: 1 } } },
  { id: 'vip', name: 'Gestor VIP', price: 'R$ 7,90', type: 'unique', icon: '👑',
    desc: 'Limite offline de 24h e +5% de renda permanente',
    grant: { offlineHours: 24, permIncome: 0.05 } },
  { id: 'skip4', name: 'Salto de 4 horas', price: 'R$ 0,90', type: 'consumable', icon: '⏩',
    desc: 'Recebe 4 horas da renda atual', grant: { items: { skip4h: 1 } } },
  { id: 'skip24', name: 'Salto de 24 horas', price: 'R$ 2,90', type: 'consumable', icon: '⏭️',
    desc: 'Recebe 24 horas da renda atual', grant: { items: { skip24h: 1 } } },
  { id: 'renovbox', name: 'Caixa de Reformas', price: 'R$ 1,90', type: 'consumable', icon: '🧰',
    desc: '50 upgrades com 25% de desconto', grant: { renovations: { count: 50, discount: 0.25 } } },
  { id: 'execpack', name: 'Pacote Executivo', price: 'R$ 4,90', type: 'consumable', icon: '💼',
    desc: '12h de boost 2× e 2 saltos de 4h', grant: { boostHours: 12, items: { skip4h: 2 } } },
  { id: 'researchkit', name: 'Kit de Pesquisa', price: 'R$ 3,90', type: 'consumable', icon: '🔬',
    desc: '50 PP simulados e 1 projeto instantâneo', grant: { pp: 50, items: { instantProject: 1 } } },
  { id: 'foundertheme', name: 'Tema Fundador', price: 'R$ 5,90', type: 'unique', icon: '🎨',
    desc: 'Fachada exclusiva e efeito visual, sem vantagem relevante', grant: { collection: 'facade_founder' } },
];
