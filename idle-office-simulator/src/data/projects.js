// Projetos empresariais — PRD §32 — 18 projetos temporizados (continuam offline).
// req: mesmos tipos de requisitos declarativos dos contratos/eventos.
// reward: { money?: segundosDeRenda, rep?, pp?, effect?, collection? }

const P = (id, name, minutes, req, reward, opts = {}) => ({
  id, name, minutes, req, reward,
  costSeconds: opts.costSeconds || 0,       // custo inicial em segundos de renda
  excellentChance: opts.excellentChance ?? 0.15,
  desc: opts.desc || '',
  done: opts.done || 'Projeto concluído com sucesso.',
  repeatable: opts.repeatable ?? true,
  long: minutes >= 480,                      // projetos longos (bônus M17)
});

export const PROJECTS = [
  P('P01', 'Renovação de Marca', 5, { activeSpecialty: 'creative' }, { pp: 5 },
    { desc: 'Uma empresa criativa moderniza a identidade do prédio.', done: 'A nova marca deu o que falar.' }),
  P('P02', 'Migração de Servidores', 10, { tech: 15 }, { pp: 8 },
    { desc: 'Atualize a infraestrutura digital dos inquilinos.', done: 'Migração concluída sem downtime.' }),
  P('P03', 'Feira Regional', 15, { facility: { id: 'cafeteria', level: 1 } }, { moneySeconds: 600, rep: 8 },
    { desc: 'Organize uma feira de negócios no prédio.', done: 'A feira atraiu novos olhares para o prédio.' }),
  P('P04', 'Auditoria Contábil', 20, { activeSpecialty: 'finance' }, { pp: 12 },
    { desc: 'Uma financeira audita e otimiza as contas.', done: 'Contas em dia e processos otimizados.' }),
  P('P05', 'Campanha Nacional', 30, { propertyUnlocked: 'torre' }, { pp: 18 },
    { desc: 'Uma campanha publicitária em escala nacional.', done: 'O empreendimento virou referência nacional.' }),
  P('P06', 'Plano de Cibersegurança', 45, { facility: { id: 'datacenter', level: 1 } }, { pp: 22 },
    { desc: 'Blindagem digital completa do portfólio.', done: 'Nenhuma brecha encontrada nos testes.' }),
  P('P07', 'Expansão Logística', 60, { activeCategorySpecialty: { specialty: 'commerce', cat: 7 } }, { effect: { kind: 'income', value: 0.10, minutes: 60 } },
    { desc: 'Otimize as rotas de distribuição dos inquilinos.', done: 'Entregas 2× mais rápidas — renda temporária em alta.' }),
  P('P08', 'Programa de Saúde', 120, { activeSpecialty: 'health', facility: { id: 'academia', level: 1 } }, { effect: { kind: 'satisfaction', value: 8, minutes: 120 } },
    { desc: 'Um programa de bem-estar para todos os funcionários.', done: 'Satisfação geral em alta.' }),
  P('P09', 'Certificação Verde', 180, { activeSpecialty: 'sustainability' }, { pp: 35 },
    { desc: 'Certifique o portfólio em padrões ambientais.', done: 'Certificação obtida com nota máxima.' }),
  P('P10', 'Convenção Internacional', 240, { facility: { id: 'auditorio', level: 10 } }, { rep: 120 },
    { desc: 'Receba uma convenção com delegações do mundo todo.', done: 'O prédio apareceu na imprensa internacional.' }),
  P('P11', 'Fusão Corporativa', 360, { activeCategoryCount: { cat: 8, count: 2 } }, { moneySeconds: 7200 },
    { desc: 'Intermedie a fusão de duas gigantes.', done: 'A fusão gerou comissões milionárias.' }),
  P('P12', 'Lançamento Robótico', 480, { roomUnlocked: '903' }, { pp: 60 },
    { desc: 'Apoie o lançamento de uma linha de robôs.', done: 'Os robôs são um sucesso de vendas.' }),
  P('P13', 'Missão Aeroespacial', 600, { activeSpecialty: 'aerospace' }, { pp: 75 },
    { desc: 'Participe de uma missão espacial privada.', done: 'Lançamento perfeito. O céu não é mais o limite.' }),
  P('P14', 'Sequenciamento Genômico', 720, { roomUnlocked: '1002' }, { pp: 90 },
    { desc: 'Financie um projeto de pesquisa genômica.', done: 'Descobertas publicadas em revistas de prestígio.' }),
  P('P15', 'Rede Quântica', 960, { roomUnlocked: '1102' }, { pp: 120 },
    { desc: 'Construa a primeira rede de comunicação quântica.', done: 'A rede quântica está online.' }),
  P('P16', 'Cidade Inteligente', 1080, { propertiesUnlocked: 3 }, { effect: { kind: 'income', value: 0.15, minutes: 240 } },
    { desc: 'Integre suas propriedades a um projeto de cidade inteligente.', done: 'Seu portfólio agora é vitrine de urbanismo.' }),
  P('P17', 'Fórum Mundial', 1200, { chapterDone: 11 }, { pp: 160 },
    { desc: 'Sedie o fórum mundial de negócios.', done: 'Líderes globais elogiaram a organização.' }),
  P('P18', 'Projeto Horizonte', 1440, { chapterDone: 12 }, { collection: 'fx_portal' },
    { desc: 'O projeto definitivo do seu império corporativo.', done: 'O Projeto Horizonte transformou a cidade para sempre.', repeatable: false, excellentChance: 0 }),
];

export const projectById = (id) => PROJECTS.find((p) => p.id === id);
