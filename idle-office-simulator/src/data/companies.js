// Empresas e contratos — PRD §13
// requirement: condições mínimas da sala/prédio para assinar o contrato.

export const CATEGORIES = [
  { n: 1, name: 'Microempresa', rep: 0 },
  { n: 2, name: 'Agência', rep: 30 },
  { n: 3, name: 'Scale-up', rep: 100 },
  { n: 4, name: 'Corporação', rep: 250 },
  { n: 5, name: 'Enterprise', rep: 500 },
  { n: 6, name: 'Unicórnio', rep: 900 },
  { n: 7, name: 'Global', rep: 1200 },
  { n: 8, name: 'Megacorp', rep: 2000 },
  { n: 9, name: 'FutureTech', rep: 3500 },
];

export const SPECIALTIES = {
  general: { name: 'Geral', icon: '🏢' },
  tech: { name: 'Tecnologia', icon: '💻' },
  creative: { name: 'Criativa', icon: '🎨' },
  corporate: { name: 'Corporativa', icon: '📊' },
  finance: { name: 'Financeira', icon: '🏦' },
  health: { name: 'Saúde', icon: '🩺' },
  commerce: { name: 'Comércio', icon: '🛒' },
  sustainability: { name: 'Sustentabilidade', icon: '🌿' },
  aerospace: { name: 'Aeroespacial', icon: '🚀' },
};

// Sinergias por especialidade (PRD §13.3)
export const SYNERGIES = {
  tech: { desc: 'Tecnologia da sala acima da média dos outros upgrades', bonus: 0.10 },
  creative: { desc: 'Conforto acima da média dos outros upgrades', bonus: 0.10 },
  corporate: { desc: 'Estrutura acima da média dos outros upgrades', bonus: 0.10 },
  finance: { desc: 'Estrutura e Tecnologia com diferença máxima de 5 níveis', bonus: 0.12 },
  health: { desc: 'Satisfação acima de 85 e Segurança construída', bonus: 0.12 },
  commerce: { desc: 'Cafeteria construída e satisfação acima de 75', bonus: 0.08 },
  general: { desc: 'Os três upgrades com diferença máxima de 3 níveis', bonus: 0.15 },
  sustainability: { desc: 'Instalação verde construída na propriedade', bonus: 0.10 },
  aerospace: { desc: 'Tecnologia da sala no nível 90 ou superior', bonus: 0.12 },
};

// requirement types: structure/tech/comfort/avg (nível), facility {id, level},
// satisfaction, greenFacilitiesAt, chapter, balancedAt (3 upgrades equilibrados), legendaryManagers
export const COMPANIES = [
  { id: 'T01', name: 'Oficina Digital', cat: 1, specialty: 'general', mult: 1.00, cost: 0, req: {}, rep: 0 },
  { id: 'T02', name: 'Café & Código', cat: 1, specialty: 'tech', mult: 1.05, cost: 250, req: { tech: 2 }, rep: 3 },
  { id: 'T03', name: 'Coletivo Criativo', cat: 1, specialty: 'creative', mult: 1.10, cost: 600, req: { comfort: 3 }, rep: 4 },
  { id: 'T04', name: 'Agência Prisma', cat: 2, specialty: 'creative', mult: 1.25, cost: 3000, req: { avg: 4 }, rep: 6 },
  { id: 'T05', name: 'Contábil Mais', cat: 2, specialty: 'corporate', mult: 1.30, cost: 5000, req: { structure: 5 }, rep: 7 },
  { id: 'T06', name: 'ByteWorks', cat: 2, specialty: 'tech', mult: 1.40, cost: 8000, req: { tech: 7 }, rep: 8 },
  { id: 'T07', name: 'LojaViva', cat: 3, specialty: 'commerce', mult: 1.60, cost: 35_000, req: { avg: 10 }, rep: 12 },
  { id: 'T08', name: 'Rocket Marketing', cat: 3, specialty: 'creative', mult: 1.75, cost: 60_000, req: { comfort: 14 }, rep: 14 },
  { id: 'T09', name: 'Nexa Sistemas', cat: 3, specialty: 'tech', mult: 1.90, cost: 100_000, req: { tech: 16 }, rep: 16 },
  { id: 'T10', name: 'Banco Horizonte', cat: 4, specialty: 'finance', mult: 2.20, cost: 500_000, req: { structure: 20 }, rep: 25 },
  { id: 'T11', name: 'Pixel Forge', cat: 4, specialty: 'tech', mult: 2.45, cost: 850_000, req: { tech: 24 }, rep: 28 },
  { id: 'T12', name: 'MedCore', cat: 4, specialty: 'health', mult: 2.70, cost: 1_400_000, req: { avg: 22, facility: { id: 'seguranca', level: 3 } }, rep: 30 },
  { id: 'T13', name: 'Grupo Atlas', cat: 5, specialty: 'corporate', mult: 3.20, cost: 6_000_000, req: { structure: 32 }, rep: 45 },
  { id: 'T14', name: 'CloudNation', cat: 5, specialty: 'tech', mult: 3.60, cost: 10_000_000, req: { tech: 36, facility: { id: 'sala_ti', level: 8 } }, rep: 50 },
  { id: 'T15', name: 'Viva Global', cat: 5, specialty: 'creative', mult: 4.00, cost: 16_000_000, req: { comfort: 38, facility: { id: 'academia', level: 5 } }, rep: 55 },
  { id: 'T16', name: 'Quantum Labs', cat: 6, specialty: 'tech', mult: 4.80, cost: 50_000_000, req: { tech: 48, facility: { id: 'sala_ti', level: 15 } }, rep: 80 },
  { id: 'T17', name: 'Aurora Capital', cat: 6, specialty: 'finance', mult: 5.40, cost: 90_000_000, req: { structure: 52, facility: { id: 'seguranca', level: 12 } }, rep: 90 },
  { id: 'T18', name: 'Omnitech Global', cat: 6, specialty: 'general', mult: 6.00, cost: 160_000_000, req: { avg: 50, allFacilitiesAt: 10 }, rep: 100 },
  // Expansão — categorias 7 a 9
  { id: 'T19', name: 'Legalis Partners', cat: 7, specialty: 'corporate', mult: 6.5, cost: 400e6, req: { structure: 70 }, rep: 110 },
  { id: 'T20', name: 'StreamWave Studios', cat: 7, specialty: 'creative', mult: 6.8, cost: 700e6, req: { comfort: 72, facility: { id: 'auditorio', level: 3 } }, rep: 115 },
  { id: 'T21', name: 'CargoSphere', cat: 7, specialty: 'commerce', mult: 7.1, cost: 1.2e9, req: { avg: 74 }, rep: 120 },
  { id: 'T22', name: 'CyberShield', cat: 7, specialty: 'tech', mult: 7.4, cost: 2e9, req: { tech: 78, facility: { id: 'datacenter', level: 5 } }, rep: 125 },
  { id: 'T23', name: 'Nova Energia', cat: 7, specialty: 'sustainability', mult: 7.7, cost: 3.5e9, req: { structure: 75 }, rep: 130 },
  { id: 'T24', name: 'BioPulse', cat: 7, specialty: 'health', mult: 8.0, cost: 6e9, req: { satisfaction: 92, facility: { id: 'seguranca', level: 18 } }, rep: 135 },
  { id: 'T25', name: 'Atlas Aero', cat: 8, specialty: 'aerospace', mult: 8.5, cost: 25e9, req: { tech: 95, facility: { id: 'heliponto', level: 5 } }, rep: 150 },
  { id: 'T26', name: 'GreenGrid', cat: 8, specialty: 'sustainability', mult: 9.0, cost: 45e9, req: { facility: { id: 'usina_solar', level: 8 } }, rep: 155 },
  { id: 'T27', name: 'MetaWorks', cat: 8, specialty: 'creative', mult: 9.5, cost: 80e9, req: { comfort: 105 }, rep: 160 },
  { id: 'T28', name: 'Horizon Robotics', cat: 8, specialty: 'tech', mult: 10.0, cost: 140e9, req: { tech: 110, facility: { id: 'prototipagem', level: 6 } }, rep: 170 },
  { id: 'T29', name: 'Global Nexus', cat: 8, specialty: 'general', mult: 11.0, cost: 250e9, req: { balancedAt: 108 }, rep: 180 },
  { id: 'T30', name: 'Orbital Finance', cat: 8, specialty: 'finance', mult: 12.0, cost: 450e9, req: { structure: 115, tech: 115 }, rep: 190 },
  { id: 'T31', name: 'Genoma One', cat: 9, specialty: 'health', mult: 13.0, cost: 2e12, req: { roomUnlocked: '1002' }, rep: 220 },
  { id: 'T32', name: 'Quantum Cloud', cat: 9, specialty: 'tech', mult: 14.0, cost: 4e12, req: { roomAtLevel: { id: '1102', avg: 10 } }, rep: 230 },
  { id: 'T33', name: 'Terra Nova', cat: 9, specialty: 'sustainability', mult: 15.0, cost: 8e12, req: { greenFacilitiesAt: 10 }, rep: 240 },
  { id: 'T34', name: 'Singularity Systems', cat: 9, specialty: 'tech', mult: 16.0, cost: 16e12, req: { tech: 175 }, rep: 260 },
  { id: 'T35', name: 'NovaCorp Alliance', cat: 9, specialty: 'general', mult: 17.0, cost: 32e12, req: { avg: 170, legendaryManagers: 3 }, rep: 280 },
  { id: 'T36', name: 'Zenith Industries', cat: 9, specialty: 'general', mult: 18.0, cost: 64e12, req: { chapter: 12, avgSatisfaction: 95 }, rep: 300 },
];

export const companyById = (id) => COMPANIES.find((c) => c.id === id);
export const categoryByN = (n) => CATEGORIES.find((c) => c.n === n);
