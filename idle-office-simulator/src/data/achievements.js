// Conquistas — PRD §16 — 60 conquistas permanentes entre Prestígios.
// check usa os mesmos tipos das missões (avaliadas sobre estatísticas VITALÍCIAS quando fizer sentido).
// reward: { rep } | { pl } | {} (apenas selo visual)

const A = (id, cat, name, desc, check, reward = {}) => ({ id, cat, name, desc, check, reward });

export const ACHIEVEMENTS = [
  // Construção
  A('a01', 'Construção', 'Primeira Reforma', 'Compre seu primeiro upgrade', { type: 'lt_upgradesBought', value: 1 }, { rep: 5 }),
  A('a02', 'Construção', 'Prédio Completo', 'Desbloqueie as 12 salas do Edifício Aurora', { type: 'roomsOfPropertyUnlocked', property: 'aurora', value: 12 }, { rep: 40 }),
  A('a03', 'Construção', 'Sala Premium', 'Leve uma sala ao estado Premium', { type: 'lt_roomPremium', value: 1 }, { rep: 30 }),
  A('a04', 'Construção', 'Mestre das Instalações', 'Eleve uma instalação ao nível 20', { type: 'facilityMaxed', value: 1 }, { rep: 50 }),
  A('a05', 'Construção', 'Reformador em Série', 'Compre 500 upgrades (vitalício)', { type: 'lt_upgradesBought', value: 500 }, { rep: 25 }),
  // Economia
  A('a06', 'Economia', 'Primeiro Milhão', 'Acumule $1 milhão ganho', { type: 'lt_moneyEarned', value: 1e6 }, { rep: 15 }),
  A('a07', 'Economia', 'Primeiro Bilhão', 'Acumule $1 bilhão ganho', { type: 'lt_moneyEarned', value: 1e9 }, { rep: 40 }),
  A('a08', 'Economia', 'Renda de $1 milhão/s', 'Atinja $1 mi por segundo', { type: 'incomeRate', value: 1e6 }, { rep: 50 }),
  A('a09', 'Economia', 'Investidor Incansável', 'Gaste $100 milhões (vitalício)', { type: 'lt_moneySpent', value: 100e6 }, { rep: 30 }),
  A('a10', 'Economia', 'Primeiro Trilhão', 'Acumule $1 trilhão ganho', { type: 'lt_moneyEarned', value: 1e12 }, { pl: 2 }),
  // Empresas
  A('a11', 'Empresas', 'Primeiro Contrato', 'Assine seu primeiro contrato', { type: 'lt_contractsSigned', value: 1 }, { rep: 5 }),
  A('a12', 'Empresas', 'Catálogo Completo', 'Descubra as 36 empresas', { type: 'discoveredCount', value: 36 }, { pl: 3 }),
  A('a13', 'Empresas', 'Império Tecnológico', 'Tenha 5 empresas de Tecnologia ativas ao mesmo tempo', { type: 'activeSpecialty', specialty: 'tech', value: 5 }, { rep: 40 }),
  A('a14', 'Empresas', 'Satisfação Perfeita', 'Atinja satisfação 100 em uma sala', { type: 'satisfactionRoom', value: 100 }, { rep: 30 }),
  A('a15', 'Empresas', 'Rede de Negócios', 'Assine 50 contratos (vitalício)', { type: 'lt_contractsSigned', value: 50 }, { rep: 25 }),
  // Equipe
  A('a16', 'Equipe', 'Primeiro Gestor', 'Contrate um gestor', { type: 'lt_managersHiredCount', value: 1 }, { rep: 10 }),
  A('a17', 'Equipe', 'Equipe Completa', 'Contrate 12 gestores no mesmo ciclo', { type: 'managersHired', value: 12 }, { rep: 40 }),
  A('a18', 'Equipe', 'Gestor nível 10', 'Treine um gestor até o nível máximo', { type: 'managerAtLevel', value: 10 }, { rep: 40 }),
  A('a19', 'Equipe', 'Quatro Andares Gerenciados', 'Tenha gestores em 4 andares ao mesmo tempo', { type: 'assignedManagers', value: 4 }, { rep: 25 }),
  A('a20', 'Equipe', 'Caçador de Talentos', 'Contrate os 24 gestores (vitalício)', { type: 'lt_managersHiredCount', value: 24 }, { pl: 3 }),
  // Retorno e Prestígio
  A('a21', 'Retorno', 'Bem-vindo de Volta', 'Colete ganhos offline pela primeira vez', { type: 'lt_offlineCollections', value: 1 }, { rep: 5 }),
  A('a22', 'Retorno', 'Oito Horas Produtivas', 'Colete 8 horas de ganho offline de uma vez', { type: 'lt_offlineMaxHours', value: 8 }, { rep: 20 }),
  A('a23', 'Prestígio', 'Primeiro Legado', 'Realize seu primeiro Prestígio', { type: 'prestiges', value: 1 }, { pl: 2 }),
  A('a24', 'Prestígio', 'Cinco Prestígios', 'Realize 5 Prestígios', { type: 'prestiges', value: 5 }, { pl: 5 }),
  A('a25', 'Retorno', 'Assíduo', 'Jogue em 7 dias diferentes (vitalício)', { type: 'lt_daysPlayed', value: 7 }, { rep: 20 }),
  // Eventos e missões
  A('a26', 'Eventos', 'Resolvedor de Problemas', 'Complete seu primeiro evento', { type: 'lt_eventsCompleted', value: 1 }, { rep: 5 }),
  A('a27', 'Eventos', 'Dez Eventos', 'Complete 10 eventos (vitalício)', { type: 'lt_eventsCompleted', value: 10 }, { rep: 20 }),
  A('a28', 'Missões', 'Missão Cumprida', 'Complete 10 missões diárias (vitalício)', { type: 'lt_dailiesCompleted', value: 10 }, { rep: 15 }),
  A('a29', 'Missões', 'Semana Produtiva', 'Complete 5 objetivos semanais (vitalício)', { type: 'lt_weekliesCompleted', value: 5 }, { rep: 25 }),
  A('a30', 'Eventos', 'Cinquenta Eventos', 'Complete 50 eventos (vitalício)', { type: 'lt_eventsCompleted', value: 50 }, { pl: 2 }),
  // Propriedades e portfólio
  A('a31', 'Portfólio', 'Dono do Quarteirão', 'Complete o Edifício Aurora (12 salas)', { type: 'roomsOfPropertyUnlocked', property: 'aurora', value: 12 }, { rep: 30 }),
  A('a32', 'Portfólio', 'Torre Central Aberta', 'Desbloqueie a Torre Central', { type: 'propertyUnlocked', value: 'torre' }, { rep: 50 }),
  A('a33', 'Portfólio', 'Campus Horizonte', 'Desbloqueie o Campus Horizonte', { type: 'propertyUnlocked', value: 'campus' }, { pl: 3 }),
  A('a34', 'Portfólio', 'Três Propriedades Ativas', 'Tenha as três propriedades desbloqueadas', { type: 'propertiesUnlocked', value: 3 }, { pl: 3 }),
  A('a35', 'Portfólio', 'Portfólio de Um Trilhão', 'Atinja valor de portfólio de $1 tri', { type: 'portfolioValue', value: 1e12 }, { rep: 60 }),
  A('a36', 'Portfólio', 'Magnata Imobiliário', 'Desbloqueie as 36 salas', { type: 'roomsUnlockedCount', value: 36 }, { pl: 5 }),
  // Projetos e pesquisa
  A('a37', 'Projetos', 'Primeiro Projeto', 'Conclua um projeto empresarial', { type: 'lt_projectsCompleted', value: 1 }, { rep: 10 }),
  A('a38', 'Projetos', 'Resultado Excelente', 'Obtenha um resultado excelente em um projeto', { type: 'lt_excellentProjects', value: 1 }, { rep: 20 }),
  A('a39', 'Projetos', 'Dez Projetos', 'Conclua 10 projetos (vitalício)', { type: 'lt_projectsCompleted', value: 10 }, { rep: 30 }),
  A('a40', 'Pesquisa', 'Cem Pontos de Pesquisa', 'Acumule 100 PP ganhos (vitalício)', { type: 'lt_ppEarned', value: 100 }, { rep: 25 }),
  A('a41', 'Pesquisa', 'Árvore pela Metade', 'Compre 12 pesquisas', { type: 'researchBought', value: 12 }, { rep: 40 }),
  A('a42', 'Pesquisa', 'Singularidade Corporativa', 'Compre a pesquisa Singularidade Corporativa', { type: 'researchNode', value: 'r24' }, { pl: 5 }),
  // Manutenção e mercado
  A('a43', 'Manutenção', 'Síndico Atento', 'Realize sua primeira manutenção', { type: 'lt_maintenancesDone', value: 1 }, { rep: 10 }),
  A('a44', 'Manutenção', 'Condição Perfeita', 'Mantenha uma propriedade em condição 100', { type: 'conditionAt', value: 100 }, { rep: 15 }),
  A('a45', 'Manutenção', 'Cem Solicitações', 'Atenda 100 solicitações de inquilinos (vitalício)', { type: 'lt_requestsCompleted', value: 100 }, { pl: 2 }),
  A('a46', 'Mercado', 'Sobreviveu à Crise', 'Jogue durante uma condição negativa de mercado', { type: 'lt_negativeMarketDays', value: 1 }, { rep: 10 }),
  A('a47', 'Mercado', 'Mestre do Mercado', 'Jogue em 10 condições de mercado diferentes (vitalício)', { type: 'lt_marketConditionsSeen', value: 10 }, { rep: 25 }),
  A('a48', 'Mercado', 'Imune à Auditoria', 'Vença o cenário Auditoria Surpresa', { type: 'challengeMedal', value: 'c06' }, { rep: 30 }),
  // Campanha e rival
  A('a49', 'Campanha', 'Capítulo Um', 'Conclua o capítulo 1', { type: 'chapterDone', value: 1 }, { rep: 10 }),
  A('a50', 'Campanha', 'Metade da Jornada', 'Conclua o capítulo 6', { type: 'chapterDone', value: 6 }, { rep: 40 }),
  A('a51', 'Campanha', 'Vitória sobre Augusto', 'Vença um desafio do rival', { type: 'lt_rivalWins', value: 1 }, { rep: 25 }),
  A('a52', 'Campanha', 'Auditoria Aprovada', 'Conclua o capítulo 6 e um cenário de desafio', { type: 'chapterAndChallenge', chapter: 6 }, { rep: 30 }),
  A('a53', 'Campanha', 'Ícone da Cidade', 'Conclua o capítulo 12', { type: 'chapterDone', value: 12 }, { pl: 5 }),
  A('a54', 'Campanha', 'Campanha Concluída', 'Conclua todos os capítulos', { type: 'campaignDone', value: 1 }, { pl: 5 }),
  // Coleção e desafios
  A('a55', 'Coleção', 'Primeiro Item', 'Obtenha um item de coleção', { type: 'collectionCount', value: 1 }, { rep: 10 }),
  A('a56', 'Coleção', 'Dez Itens', 'Obtenha 10 itens de coleção', { type: 'collectionCount', value: 10 }, { rep: 30 }),
  A('a57', 'Coleção', 'Coleção Completa', 'Obtenha os 30 itens de coleção', { type: 'collectionCount', value: 30 }, { pl: 5 }),
  A('a58', 'Desafios', 'Primeira Medalha', 'Ganhe uma medalha em um cenário de desafio', { type: 'medalsCount', value: 1 }, { rep: 15 }),
  A('a59', 'Desafios', 'Trinta Medalhas', 'Ganhe 30 medalhas em cenários', { type: 'medalsCount', value: 30 }, { pl: 5 }),
  A('a60', 'Desafios', 'Todos os Cenários', 'Complete os 10 cenários de desafio', { type: 'challengesCompleted', value: 10 }, { pl: 3 }),
];

export const ACHIEVEMENT_CATEGORIES = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
