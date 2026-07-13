// Campanha principal — PRD §30 — 12 capítulos, 6 personagens.
// objectives: condições declarativas (mesmos tipos das missões).
// dialogue: falas curtas, puláveis e revisíveis.

export const CHARACTERS = {
  clara: { name: 'Clara', role: 'Mentora e ex-administradora do Edifício Aurora', icon: '👩‍💼' },
  roberto: { name: 'Roberto', role: 'Investidor com metas de crescimento', icon: '🤵' },
  luna: { name: 'Luna', role: 'Especialista em design e satisfação', icon: '👩‍🎨' },
  caio: { name: 'Caio', role: 'Responsável por tecnologia e pesquisa', icon: '👨‍💻' },
  vera: { name: 'Vera', role: 'Auditora de desafios operacionais', icon: '🕵️‍♀️' },
  augusto: { name: 'Augusto', role: 'Rival empresarial', icon: '😈' },
};

const D = (who, text) => ({ who, text });

export const CHAPTERS = [
  {
    n: 1, title: 'As Chaves do Prédio',
    intro: [
      D('clara', 'Então é você quem comprou o velho Aurora... Ele já foi o orgulho da cidade.'),
      D('clara', 'Comece pequeno: reforme a garagem adaptada. Todo império começa em algum lugar.'),
    ],
    objectives: [
      { id: 'c1o1', name: 'Comprar 5 upgrades na sala 101', check: { type: 'roomTotalLevels', room: '101', value: 5 } },
      { id: 'c1o2', name: 'Atingir $5/s de renda', check: { type: 'incomeRate', value: 5 } },
      { id: 'c1o3', name: 'Completar as 2 primeiras missões do tutorial', check: { type: 'tutorialIndex', value: 2 } },
    ],
    outro: [D('clara', 'Nada mal! Agora que o prédio respira, vamos atrair inquilinos de verdade.')],
    reward: { money: 1000, rep: 10, unlocks: 'Sistema de contratos em destaque' },
  },
  {
    n: 2, title: 'Primeiros Inquilinos',
    intro: [
      D('roberto', 'Ouvi falar do seu projeto. Encha três salas e eu começo a levar você a sério.'),
      D('clara', 'O Roberto é direto, mas o dinheiro dele é bom. Vamos ocupar o térreo.'),
    ],
    objectives: [
      { id: 'c2o1', name: 'Ocupar três salas com inquilinos', check: { type: 'occupiedRooms', value: 3 } },
      { id: 'c2o2', name: 'Construir a Recepção', check: { type: 'facilityBuilt', value: 'recepcao' } },
      { id: 'c2o3', name: 'Contratar seu primeiro gestor', check: { type: 'managersHired', value: 1 } },
    ],
    outro: [D('roberto', 'Três salas ocupadas. Continue assim e falaremos de números maiores.')],
    reward: { money: 10_000, rep: 20 },
  },
  {
    n: 3, title: 'Nome no Mercado',
    intro: [
      D('luna', 'Um prédio bonito atrai empresas bonitas. Vamos cuidar da experiência de quem trabalha aqui.'),
      D('augusto', 'Aurora? Aquele prédio velho? Não dure muito, novato. O mercado é meu.'),
    ],
    objectives: [
      { id: 'c3o1', name: 'Atingir 180 REP', check: { type: 'repTotal', value: 180 } },
      { id: 'c3o2', name: 'Atingir satisfação 80 em uma sala', check: { type: 'satisfactionRoom', value: 80 } },
      { id: 'c3o3', name: 'Assinar um contrato de categoria 3', check: { type: 'activeCategory', value: 3 } },
    ],
    outro: [D('luna', 'Viu? Satisfação alta atrai contratos melhores. O Augusto que se cuide.')],
    reward: { money: 100_000, rep: 30, unlocks: 'Projetos empresariais' },
  },
  {
    n: 4, title: 'O Prédio Completo',
    intro: [
      D('clara', 'O quarto andar está fechado desde 2019. Abra essas portas e o Aurora estará completo.'),
      D('roberto', 'Complete o prédio e eu te apresento a Torre Central. Grande jogo, grandes números.'),
    ],
    objectives: [
      { id: 'c4o1', name: 'Liberar o 4º andar', check: { type: 'floorUnlocked', value: 'aurora_4' } },
      { id: 'c4o2', name: 'Desbloquear 10 salas', check: { type: 'roomsUnlockedCount', value: 10 } },
      { id: 'c4o3', name: 'Concluir um projeto empresarial', check: { type: 'projectsCompleted', value: 1 } },
    ],
    outro: [D('roberto', 'O Aurora completo... Clara ficaria orgulhosa. Ah, ela ESTÁ orgulhosa. Torre Central liberada.')],
    reward: { money: 5e6, rep: 60, unlocks: 'Torre Central disponível no Mapa' },
  },
  {
    n: 5, title: 'Na Liga Nacional',
    intro: [
      D('caio', 'Torre Central! Agora precisamos de uma sede administrativa de verdade. Eu cuido da tecnologia.'),
      D('augusto', 'Você na Torre Central? Aproveite enquanto dura. Meus advogados adoram concorrentes ousados.'),
    ],
    objectives: [
      { id: 'c5o1', name: 'Desbloquear a Torre Central', check: { type: 'propertyUnlocked', value: 'torre' } },
      { id: 'c5o2', name: 'Ocupar seis salas da Torre Central', check: { type: 'occupiedRoomsOfProperty', property: 'torre', value: 6 } },
      { id: 'c5o3', name: 'Melhorar um departamento da Sede', check: { type: 'hqLevels', value: 1 } },
    ],
    outro: [D('caio', 'A Sede está operacional. Agora temos Financeiro, Operações, Pessoas... um império de verdade.')],
    reward: { money: 50e9, rep: 100, unlocks: 'Departamentos da Sede' },
  },
  {
    n: 6, title: 'Auditoria Surpresa',
    intro: [
      D('vera', 'Vera, auditoria independente. Vou testar sua gestão com cenários controlados. Não é pessoal.'),
      D('clara', 'A Vera é dura, mas os desafios dela ensinam mais que qualquer consultoria.'),
    ],
    objectives: [
      { id: 'c6o1', name: 'Concluir um cenário de desafio', check: { type: 'challengesCompleted', value: 1 } },
      { id: 'c6o2', name: 'Realizar 2 manutenções', check: { type: 'maintenancesDone', value: 2 } },
      { id: 'c6o3', name: 'Atender 3 solicitações de inquilinos', check: { type: 'requestsCompleted', value: 3 } },
    ],
    outro: [D('vera', 'Aprovado. Poucos sobrevivem à minha primeira auditoria. O mercado dinâmico agora está nas suas mãos.')],
    reward: { money: 200e9, rep: 120, unlocks: 'Mercado dinâmico' },
  },
  {
    n: 7, title: 'Contrato Internacional',
    intro: [
      D('roberto', 'Empresas globais estão de olho na Torre. Assine com uma categoria 7 e o mundo vai te notar.'),
      D('augusto', 'Internacionais? Eu atendo esse mercado há décadas. Vamos ver quem fecha primeiro. Uma aposta?'),
    ],
    objectives: [
      { id: 'c7o1', name: 'Assinar um contrato de categoria 7', check: { type: 'activeCategory', value: 7 } },
      { id: 'c7o2', name: 'Atingir 1.400 REP', check: { type: 'repTotal', value: 1400 } },
      { id: 'c7o3', name: 'Vencer uma meta do rival', check: { type: 'rivalWins', value: 1 } },
    ],
    outro: [D('roberto', 'Contrato global assinado — e o Augusto perdendo apostas. Dia memorável. +1 espaço de projeto.')],
    reward: { money: 1e12, rep: 150, unlocks: 'Segundo espaço de projeto' },
  },
  {
    n: 8, title: 'A Torre no Topo',
    intro: [
      D('clara', 'A Torre Central completa seria manchete nacional. Vamos terminar o que começamos.'),
      D('caio', 'E depois... já ouviu falar do Campus Horizonte? O futuro mora lá.'),
    ],
    objectives: [
      { id: 'c8o1', name: 'Desbloquear as 12 salas da Torre Central', check: { type: 'roomsOfPropertyUnlocked', property: 'torre', value: 12 } },
      { id: 'c8o2', name: 'Construir as 4 instalações da Torre', check: { type: 'facilitiesOfPropertyBuilt', property: 'torre', value: 4 } },
      { id: 'c8o3', name: 'Atingir renda de $10 bi/s', check: { type: 'incomeRate', value: 10e9 } },
    ],
    outro: [D('caio', 'Torre concluída! O Campus Horizonte abriu as portas para nós. Tecnologia de ponta, aqui vamos nós.')],
    reward: { money: 100e12, rep: 300, unlocks: 'Campus Horizonte disponível no Mapa' },
  },
  {
    n: 9, title: 'O Futuro dos Escritórios',
    intro: [
      D('caio', 'O Campus é diferente de tudo. Pesquisa é a moeda de lá. Invista pesado na árvore de tecnologias.'),
      D('luna', 'E não esqueça das instalações verdes — o futuro é sustentável ou não é futuro.'),
    ],
    objectives: [
      { id: 'c9o1', name: 'Comprar oito pesquisas', check: { type: 'researchBought', value: 8 } },
      { id: 'c9o2', name: 'Desbloquear o Campus Horizonte', check: { type: 'propertyUnlocked', value: 'campus' } },
      { id: 'c9o3', name: 'Construir uma instalação verde', check: { type: 'greenFacilityBuilt', value: 1 } },
    ],
    outro: [D('luna', 'Instalações verdes operando! O Campus está redefinindo o que um escritório pode ser.')],
    reward: { money: 1e15, rep: 400, pp: 50, unlocks: 'Instalações verdes' },
  },
  {
    n: 10, title: 'Guerra de Talentos',
    intro: [
      D('augusto', 'Roubaram meu diretor de operações. Foi você? ... Foi você. Isso é guerra, entendeu? GUERRA.'),
      D('clara', 'Ignore o drama. Talentos vão onde há visão. Monte o maior time do mercado.'),
    ],
    objectives: [
      { id: 'c10o1', name: 'Contratar 18 gestores', check: { type: 'managersHired', value: 18 } },
      { id: 'c10o2', name: 'Treinar um gestor até o nível 8', check: { type: 'managerAtLevel', value: 8 } },
      { id: 'c10o3', name: 'Vencer 2 metas do rival', check: { type: 'rivalWins', value: 2 } },
    ],
    outro: [D('clara', 'Dezoito gestores de elite... O Augusto está contratando estagiários. Terceiro espaço de projeto liberado.')],
    reward: { money: 10e15, rep: 500, unlocks: 'Terceiro espaço de projeto' },
  },
  {
    n: 11, title: 'Império em Risco',
    intro: [
      D('vera', 'Três crises simultâneas se aproximam: mercado, infraestrutura e reputação. Vou observar de perto.'),
      D('clara', 'Todo império é testado. Resolva os eventos, mantenha a condição alta e proteja a satisfação.'),
    ],
    objectives: [
      { id: 'c11o1', name: 'Completar 5 eventos', check: { type: 'eventsCompleted', value: 5 } },
      { id: 'c11o2', name: 'Manter condição 90+ nas três propriedades', check: { type: 'allConditionsAt', value: 90 } },
      { id: 'c11o3', name: 'Atingir satisfação média 90', check: { type: 'avgSatisfaction', value: 90 } },
    ],
    outro: [D('vera', 'Três crises, zero colapsos. Registro em ata: este portfólio é antifragil. Bônus concedido.')],
    reward: { money: 100e15, rep: 700, effect: { kind: 'income', value: 0.10, minutes: 240 }, unlocks: 'Bônus de portfólio' },
  },
  {
    n: 12, title: 'Ícone da Cidade',
    intro: [
      D('roberto', 'A Zenith Industries. A maior do planeta. Se ela assinar com você, o jogo acabou — você venceu.'),
      D('augusto', '...Zenith? Você vai atrás da Zenith? Ok. Ok! Se conseguir, eu... eu admito que perdi.'),
      D('clara', 'Vá. O Aurora te trouxe até aqui. Termine a história.'),
    ],
    objectives: [
      { id: 'c12o1', name: 'Assinar com a Zenith Industries', check: { type: 'activeCompany', value: 'T36' } },
      { id: 'c12o2', name: 'Atingir valor de portfólio de $500 qui', check: { type: 'portfolioValue', value: 500e18 } },
      { id: 'c12o3', name: 'Concluir 15 projetos', check: { type: 'projectsCompleted', value: 15 } },
    ],
    outro: [
      D('augusto', 'Zenith Industries... no SEU prédio. Eu perdi. Você é o novo ícone da cidade. Parabéns... rival.'),
      D('clara', 'O menino da garagem adaptada virou dono do horizonte. Miguel, o Fundador Visionário, quer se juntar a você.'),
    ],
    reward: { money: 1e18, rep: 1000, manager: 'M24', unlocks: 'Modo Império e gestor M24' },
  },
];

// Metas do rival Augusto — desafios assíncronos locais (PRD §34.2)
export const RIVAL_GOALS = [
  { id: 'rv01', name: 'Corrida de Renda', desc: 'Augusto aposta que você não aumenta a renda em 30% em 20 minutos.', type: 'incomeGrowth', value: 0.30, minutes: 20, reward: { rep: 25 } },
  { id: 'rv02', name: 'Maratona de Reformas', desc: 'Compre 40 upgrades em 15 minutos, ou Augusto vence.', type: 'upgradesBought', value: 40, minutes: 15, reward: { rep: 20 } },
  { id: 'rv03', name: 'Guerra de Contratos', desc: 'Assine 3 contratos em 25 minutos para calar o Augusto.', type: 'contractsSigned', value: 3, minutes: 25, reward: { rep: 30 } },
  { id: 'rv04', name: 'Prova de Excelência', desc: 'Conclua 2 projetos em 4 horas. Augusto duvida.', type: 'projectsCompleted', value: 2, minutes: 240, reward: { pp: 15 } },
  { id: 'rv05', name: 'Duelo de Satisfação', desc: 'Atinja satisfação média 88 em 30 minutos.', type: 'avgSatisfaction', value: 88, minutes: 30, reward: { rep: 35, collectionRoll: true } },
];
