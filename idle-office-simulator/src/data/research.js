// Árvore de Pesquisa — PRD §31.2 — 24 nós em 4 ramos.
// effect: efeito estruturado aplicado por selectors/economia.
// qol: true → pesquisa de qualidade de vida mantida no Prestígio (PRD §31.2 regras).

const R = (id, branch, name, desc, cost, effect, opts = {}) => ({
  id, branch, name, desc, cost, effect,
  requires: opts.requires || null,   // id do nó anterior no ramo
  qol: opts.qol || false,
});

export const RESEARCH = [
  // ——— Finanças ———
  R('r01', 'financas', 'Contabilidade Automatizada', '+5% de renda total', 10, { incomeTotal: 0.05 }),
  R('r02', 'financas', 'Compras em Escala', 'Libera o botão de upgrade x25', 15, { buyX25: true }, { requires: 'r01', qol: true }),
  R('r03', 'financas', 'Negociação Avançada', 'Contratos 8% mais baratos', 25, { contractDiscount: 0.08 }, { requires: 'r02' }),
  R('r04', 'financas', 'Fundo de Reserva', 'Eventos negativos financeiros 20% menores', 35, { eventPenalty: 0.20 }, { requires: 'r03' }),
  R('r05', 'financas', 'Dividendos Compostos', '+10% de ganho offline', 50, { offlineBonus: 0.10 }, { requires: 'r04' }),
  R('r06', 'financas', 'Mercado Global', 'Libera empresas da categoria 8', 80, { unlockCategory: 8 }, { requires: 'r05' }),
  // ——— Operações ———
  R('r07', 'operacoes', 'Manutenção Preventiva', 'Degradação de condição 30% menor', 12, { conditionLoss: 0.30 }),
  R('r08', 'operacoes', 'Gestão de Fornecedores', 'Instalações 8% mais baratas', 18, { facilityDiscount: 0.08 }, { requires: 'r07' }),
  R('r09', 'operacoes', 'Turno Estendido', 'Limite offline +4h', 30, { offlineHours: 4 }, { requires: 'r08', qol: true }),
  R('r10', 'operacoes', 'Automação Predial', 'Libera coleta automática de missões e compra automática de upgrades', 45, { automation: true }, { requires: 'r09', qol: true }),
  R('r11', 'operacoes', 'Centro de Comando', '+1 espaço de projeto', 60, { projectSlots: 1 }, { requires: 'r10', qol: true }),
  R('r12', 'operacoes', 'Operação 24/7', 'Limite offline global de 36h', 100, { offlineHoursSet: 36 }, { requires: 'r11', qol: true }),
  // ——— Pessoas ———
  R('r13', 'pessoas', 'Universidade Corporativa', 'Treinamento de gestores 10% mais barato', 12, { trainDiscount: 0.10 }),
  R('r14', 'pessoas', 'Cultura Positiva', '+5 de satisfação mínima', 20, { satisfactionFloor: 5 }, { requires: 'r13' }),
  R('r15', 'pessoas', 'Plano de Carreira', 'Gestores designados ganham experiência com o tempo', 32, { managerXp: true }, { requires: 'r14' }),
  R('r16', 'pessoas', 'Recrutamento Executivo', 'Reduz em 10% o custo de contratação de gestores', 45, { hireDiscount: 0.10 }, { requires: 'r15' }),
  R('r17', 'pessoas', 'Liderança Distribuída', 'Gestor designado afeta a propriedade inteira com 25% do bônus', 65, { managerPropertyShare: 0.25 }, { requires: 'r16' }),
  R('r18', 'pessoas', 'Conselho de Elite', 'Libera os gestores M19 a M24', 90, { unlockEliteManagers: true }, { requires: 'r17' }),
  // ——— Inovação ———
  R('r19', 'inovacao', 'Laboratório de Dados', '+10% de Pontos de Pesquisa', 15, { ppBonus: 0.10 }),
  R('r20', 'inovacao', 'Prototipagem Rápida', 'Projetos 10% mais rápidos', 22, { projectSpeed: 0.10 }, { requires: 'r19' }),
  R('r21', 'inovacao', 'Patentes', 'Projetos excelentes concedem +2% de renda permanente no ciclo', 35, { patentBonus: 0.02 }, { requires: 'r20' }),
  R('r22', 'inovacao', 'Computação Quântica', 'Empresas FutureTech (cat. 9) +10%', 55, { categoryIncome: { category: 9, value: 0.10 } }, { requires: 'r21' }),
  R('r23', 'inovacao', 'Rede de Pesquisa', 'PP mantidos no Prestígio +25%', 75, { ppRetention: 0.25 }, { requires: 'r22', qol: true }),
  R('r24', 'inovacao', 'Singularidade Corporativa', 'Libera empresas da categoria 9 e o final da campanha', 120, { unlockCategory: 9 }, { requires: 'r23' }),
];

export const RESEARCH_BRANCHES = [
  { id: 'financas', name: 'Finanças', icon: '💰' },
  { id: 'operacoes', name: 'Operações', icon: '⚙️' },
  { id: 'pessoas', name: 'Pessoas', icon: '🧑‍🤝‍🧑' },
  { id: 'inovacao', name: 'Inovação', icon: '💡' },
];

export const researchById = (id) => RESEARCH.find((r) => r.id === id);
