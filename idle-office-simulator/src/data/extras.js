// Coleção, cenários de desafio e condições de mercado — PRD §35, §37, §34

// ——— Coleção — 30 itens + 1 exclusivo da loja (PRD §35.2) ———
// bonus: pequeno bônus econômico (soma limitada a 5%/7% — balance.collectionBonusCap)
// source: de onde o item vem (texto de origem obrigatório).
const C = (id, cat, name, source, bonus = 0) => ({ id, cat, name, source, bonus });

export const COLLECTION_CATEGORIES = [
  { id: 'facade', name: 'Fachadas', icon: '🏛️' },
  { id: 'reception', name: 'Recepções', icon: '🛋️' },
  { id: 'garden', name: 'Jardins', icon: '🌳' },
  { id: 'lighting', name: 'Iluminação', icon: '💡' },
  { id: 'trophy', name: 'Troféus', icon: '🏆' },
  { id: 'fx', name: 'Efeitos de Prestígio', icon: '✨' },
];

export const COLLECTION_ITEMS = [
  // Fachadas
  C('facade_brick', 'facade', 'Tijolo Restaurado', 'Concluir o capítulo 2', 0.002),
  C('facade_glass', 'facade', 'Vidro Azul', 'Conquista "Prédio Completo"', 0.003),
  C('facade_marble', 'facade', 'Mármore Executivo', 'Concluir o capítulo 8', 0.004),
  C('facade_garden', 'facade', 'Jardim Vertical', 'Medalha de ouro em "Edifício antigo"', 0.004),
  C('facade_gold', 'facade', 'Horizonte Dourado', 'Concluir a campanha', 0.005),
  // Recepções
  C('rec_classic', 'reception', 'Clássica', 'Recepção no nível 10', 0.002),
  C('rec_creative', 'reception', 'Criativa', 'Conquista "Satisfação Perfeita"', 0.003),
  C('rec_tech', 'reception', 'Tecnológica', 'Comprar 12 pesquisas', 0.004),
  C('rec_green', 'reception', 'Sustentável', 'Concluir o projeto Certificação Verde', 0.004),
  C('rec_council', 'reception', 'Conselho Global', 'Concluir o capítulo 12', 0.005),
  // Jardins
  C('grd_bonsai', 'garden', 'Bonsai Corporativo', 'Calendário de retorno — 7º dia', 0.002),
  C('grd_plaza', 'garden', 'Praça Urbana', 'Completar 10 eventos', 0.003),
  C('grd_zen', 'garden', 'Jardim Zen', 'Satisfação média 90', 0.003),
  C('grd_solar', 'garden', 'Estufa Solar', 'Usina Solar no nível 10', 0.004),
  C('grd_forest', 'garden', 'Bosque Horizonte', 'Concluir o projeto Cidade Inteligente', 0.005),
  // Iluminação
  C('lit_industrial', 'lighting', 'Industrial', 'Medalha em "Começo com dívida"', 0.002),
  C('lit_neon', 'lighting', 'Neon Criativo', 'Conquista "Império Tecnológico"', 0.003),
  C('lit_exec', 'lighting', 'Executiva', 'Contratar 12 gestores', 0.003),
  C('lit_aurora', 'lighting', 'Aurora', 'Primeiro Prestígio', 0.004),
  C('lit_quantum', 'lighting', 'Quântica', 'Centro Quântico desbloqueado', 0.005),
  // Troféus
  C('tr_contract', 'trophy', 'Primeiro Contrato', 'Assinar o primeiro contrato', 0.001),
  C('tr_building', 'trophy', 'Prédio Completo', 'Completar o Edifício Aurora', 0.002),
  C('tr_audit', 'trophy', 'Auditoria Perfeita', 'Três medalhas em um cenário de Vera', 0.003),
  C('tr_campaign', 'trophy', 'Campanha Concluída', 'Concluir os 12 capítulos', 0.004),
  C('tr_empire', 'trophy', 'Império Eterno', 'Entrar no Modo Império', 0.005),
  // Efeitos de Prestígio
  C('fx_coins', 'fx', 'Chuva de Moedas', 'Realizar 2 Prestígios', 0.003),
  C('fx_holo', 'fx', 'Planta Holográfica', 'Vencer o rival 3 vezes', 0.003),
  C('fx_aura', 'fx', 'Aura Dourada', 'Realizar 5 Prestígios', 0.004),
  C('fx_skyline', 'fx', 'Skyline Animado', 'Valor de portfólio $1 qui', 0.004),
  C('fx_portal', 'fx', 'Portal Corporativo', 'Concluir o Projeto Horizonte', 0.005),
  // Exclusivo da loja simulada (não conta para os 30 da coleção base)
  C('facade_founder', 'facade', 'Tema Fundador', 'Loja simulada — Tema Fundador', 0),
];

export const collectionItemById = (id) => COLLECTION_ITEMS.find((c) => c.id === id);

// ——— Cenários de desafio — Auditoria de Vera (PRD §37) — 10 cenários ———
// goal: meta a atingir dentro da duração; medals: limiares de tempo/resultado (3 medalhas).
// modifiers: alteram o estado inicial/regras do cenário (estado separado do save principal).
const CH = (id, name, desc, minutes, modifiers, goal, medals) => ({ id, name, desc, minutes, modifiers, goal, medals });

export const CHALLENGES = [
  CH('c01', 'Começo com dívida', 'Comece devendo $500 e reconstrua o térreo.', 15,
    { startMoney: -500 }, { type: 'incomeRate', value: 25 },
    [{ atMinutes: 15 }, { atMinutes: 10 }, { atMinutes: 6 }]),
  CH('c02', 'Apenas empresas criativas', 'Somente contratos criativos estão disponíveis.', 20,
    { onlySpecialty: 'creative' }, { type: 'incomeRate', value: 60 },
    [{ atMinutes: 20 }, { atMinutes: 14 }, { atMinutes: 9 }]),
  CH('c03', 'Tecnologia cara', 'Upgrades de Tecnologia custam o triplo.', 20,
    { techCostMult: 3 }, { type: 'incomeRate', value: 50 },
    [{ atMinutes: 20 }, { atMinutes: 14 }, { atMinutes: 9 }]),
  CH('c04', 'Satisfação crítica', 'A satisfação começa no mínimo e cada ponto vale mais.', 15,
    { satisfactionStart: 50, satisfactionWeight: 2 }, { type: 'satisfactionRoom', value: 85 },
    [{ atMinutes: 15 }, { atMinutes: 11 }, { atMinutes: 7 }]),
  CH('c05', 'Uma hora para crescer', 'Renda máxima em uma janela de 60 minutos.', 60,
    {}, { type: 'incomeRate', value: 500 },
    [{ atMinutes: 60 }, { atMinutes: 40 }, { atMinutes: 25 }]),
  CH('c06', 'Auditoria Surpresa', 'Sem gestores e com fiscalização: eventos a cada 3 minutos.', 20,
    { noManagers: true, eventEveryMs: 180000 }, { type: 'eventsCompleted', value: 4 },
    [{ atMinutes: 20 }, { atMinutes: 15 }, { atMinutes: 11 }]),
  CH('c07', 'Mercado instável', 'A condição de mercado muda a cada 2 minutos.', 25,
    { marketShuffleMs: 120000 }, { type: 'incomeRate', value: 80 },
    [{ atMinutes: 25 }, { atMinutes: 18 }, { atMinutes: 12 }]),
  CH('c08', 'Edifício antigo', 'A condição começa em 30 e cai com o tempo.', 20,
    { conditionStart: 30, conditionDecayPerMin: 1 }, { type: 'conditionAt', value: 80 },
    [{ atMinutes: 20 }, { atMinutes: 14 }, { atMinutes: 9 }]),
  CH('c09', 'Projeto gigante', 'Conclua a Feira Regional com metade dos recursos.', 30,
    { incomeMult: 0.5 }, { type: 'projectsCompleted', value: 1 },
    [{ atMinutes: 30 }, { atMinutes: 24 }, { atMinutes: 18 }]),
  CH('c10', 'Império eficiente', 'Alcance a maior renda possível com no máximo 30 upgrades.', 20,
    { maxUpgrades: 30 }, { type: 'incomeRate', value: 40 },
    [{ atMinutes: 20 }, { atMinutes: 15 }, { atMinutes: 10 }]),
];

export const challengeById = (id) => CHALLENGES.find((c) => c.id === id);

// ——— Condições diárias de mercado (PRD §34.1) — 12 condições ———
// Impacto negativo máximo: 10% (balance.marketMaxPenalty).
const MK = (id, name, icon, desc, bonus, penalty = null) => ({ id, name, icon, desc, bonus, penalty });

export const MARKET_CONDITIONS = [
  MK('mk01', 'Boom de Tecnologia', '🚀', 'Empresas de tecnologia rendem +15%.', { specialty: 'tech', value: 0.15 }),
  MK('mk02', 'Alta do Setor Criativo', '🎨', 'Empresas criativas rendem +15%.', { specialty: 'creative', value: 0.15 }),
  MK('mk03', 'Crédito Barato', '🏦', 'Upgrades custam 10% menos.', { upgradeDiscount: 0.10 }),
  MK('mk04', 'Procura por Saúde', '🩺', 'Empresas de saúde rendem +18%.', { specialty: 'health', value: 0.18 }),
  MK('mk05', 'Expansão do Comércio', '🛒', 'Empresas de comércio rendem +15%.', { specialty: 'commerce', value: 0.15 }),
  MK('mk06', 'Agenda Sustentável', '🌿', 'Sustentabilidade +18%; energia intensiva -5%.', { specialty: 'sustainability', value: 0.18 }, { specialty: 'tech', value: 0.05 }),
  MK('mk07', 'Escassez de Talentos', '🧑‍💼', 'Treinamento de gestores custa +10%; satisfação vale +10%.', { satisfactionWeight: 0.10 }, { trainCostUp: 0.10 }),
  MK('mk08', 'Energia Cara', '⚡', 'Renda total -8%; instalações verdes anulam metade.', { greenMitigation: 0.5 }, { incomeTotal: 0.08 }),
  MK('mk09', 'Auditoria Reguladora', '📋', 'Financeiras -8%; REP de contratos +10%.', { repBonus: 0.10 }, { specialty: 'finance', value: 0.08 }),
  MK('mk10', 'Semana de Inovação', '💡', '+15% de Pontos de Pesquisa.', { ppBonus: 0.15 }),
  MK('mk11', 'Mercado Estável', '⚖️', 'Nenhum efeito hoje. Bom dia para planejar.', {}),
  MK('mk12', 'Corrida Global', '🌍', 'Empresas categoria 7+ rendem +12%.', { minCategory: 7, value: 0.12 }),
];

export const marketById = (id) => MARKET_CONDITIONS.find((m) => m.id === id);

// ——— Solicitações de inquilinos (PRD §33.2) ———
export const TENANT_REQUESTS = [
  { id: 'req01', name: 'Melhorar a internet', icon: '📶', costSeconds: 60, reward: { rep: 4, satisfaction: 3 } },
  { id: 'req02', name: 'Trocar o mobiliário', icon: '🪑', costSeconds: 90, reward: { rep: 5, satisfaction: 4 } },
  { id: 'req03', name: 'Reforçar a segurança', icon: '🔒', costSeconds: 80, reward: { rep: 5, satisfaction: 3 } },
  { id: 'req04', name: 'Realizar evento interno', icon: '🎉', costSeconds: 120, reward: { rep: 8, satisfaction: 5 } },
  { id: 'req05', name: 'Corrigir a climatização', icon: '❄️', costSeconds: 70, reward: { rep: 4, satisfaction: 4 } },
  { id: 'req06', name: 'Ampliar horário da cafeteria', icon: '☕', costSeconds: 60, reward: { rep: 4, satisfaction: 3 } },
];

// ——— Metas do Conselho (Modo Império, PRD §38.3) ———
export const COUNCIL_GOALS = [
  { id: 'cg01', name: 'Dobrar o valor do portfólio', type: 'portfolioGrowth', value: 1.0, reward: { pl: 3 } },
  { id: 'cg02', name: 'Concluir 5 projetos', type: 'projectsCompleted', value: 5, reward: { pl: 2 } },
  { id: 'cg03', name: 'Ganhar 500 REP', type: 'repEarned', value: 500, reward: { pl: 2 } },
  { id: 'cg04', name: 'Comprar 200 upgrades', type: 'upgradesBought', value: 200, reward: { pl: 2 } },
  { id: 'cg05', name: 'Completar 8 eventos', type: 'eventsCompleted', value: 8, reward: { pl: 2 } },
];
