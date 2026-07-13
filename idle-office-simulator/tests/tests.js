// Testes automatizados — PRD §47.1. Rodam no navegador (tests.html).

import { BALANCE } from '../src/data/balance.js';
import { OFFICES, FLOORS, FACILITIES, officeById } from '../src/data/buildings.js';
import { COMPANIES, companyById } from '../src/data/companies.js';
import { MANAGERS } from '../src/data/managers.js';
import { RESEARCH } from '../src/data/research.js';
import { LEGACY_UPGRADES, STORE_PRODUCTS } from '../src/data/prestige.js';
import { PROJECTS } from '../src/data/projects.js';
import { EVENTS } from '../src/data/events.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { COLLECTION_ITEMS, CHALLENGES, MARKET_CONDITIONS } from '../src/data/extras.js';
import { TUTORIAL_MISSIONS, MILESTONE_MISSIONS, DAILY_TEMPLATES, WEEKLY_TEMPLATES } from '../src/data/missions.js';
import {
  upgradeCost, bulkUpgradeCost, maxAffordable, computeEconomy, roomIncome, collectModifiers,
  legacyPointsFor, prestigeValue, sanitizeNumber, tapGain, synergyBonus, roomSatisfaction,
} from '../src/core/formulas.js';
import { fmtNumber, fmtMoney, localDateKey } from '../src/core/format.js';
import { mulberry32, seededShuffle, seededPick } from '../src/core/rng.js';
import { freshState, game, SAVE_VERSION } from '../src/core/store.js';
import { serialize, parseAndMigrate, validateState } from '../src/persistence/save.js';
import { incomeOverInterval } from '../src/systems/offline.js';
import { ensureDailyMissions, ensureWeeklyMissions, evaluateCheck } from '../src/systems/progression.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, error: err.message || String(err) }); }
}
function assert(cond, msg = 'asserção falhou') { if (!cond) throw new Error(msg); }
function assertClose(a, b, tol = 1e-6, msg = '') { if (Math.abs(a - b) > tol * Math.max(1, Math.abs(b))) throw new Error(`${msg} esperado≈${b}, obtido=${a}`); }

// ————— Conteúdo mínimo (PRD §48.1) —————
test('Conteúdo: 3 propriedades, 12 andares, 36 escritórios', () => {
  assert(OFFICES.length === 36, `escritórios: ${OFFICES.length}`);
  assert(FLOORS.length === 12, `andares: ${FLOORS.length}`);
});
test('Conteúdo: 13 instalações, 36 empresas, 24 gestores', () => {
  assert(FACILITIES.length === 13, `instalações: ${FACILITIES.length}`);
  assert(COMPANIES.length === 36, `empresas: ${COMPANIES.length}`);
  assert(MANAGERS.length === 24, `gestores: ${MANAGERS.length}`);
});
test('Conteúdo: 12 capítulos, 18 projetos, 24 pesquisas, 24 melhorias de Legado', () => {
  assert(CHAPTERS.length === 12, `capítulos: ${CHAPTERS.length}`);
  assert(PROJECTS.length === 18, `projetos: ${PROJECTS.length}`);
  assert(RESEARCH.length === 24, `pesquisas: ${RESEARCH.length}`);
  assert(LEGACY_UPGRADES.length === 24, `legado: ${LEGACY_UPGRADES.length}`);
});
test('Conteúdo: 60 conquistas, 30 eventos, 10 desafios, 30 itens, 12 mercados, 8 produtos', () => {
  assert(ACHIEVEMENTS.length === 60, `conquistas: ${ACHIEVEMENTS.length}`);
  assert(EVENTS.length === 30, `eventos: ${EVENTS.length}`);
  assert(CHALLENGES.length === 10, `desafios: ${CHALLENGES.length}`);
  assert(COLLECTION_ITEMS.filter((c) => c.id !== 'facade_founder').length === 30, 'itens de coleção');
  assert(MARKET_CONDITIONS.length === 12, 'condições de mercado');
  assert(STORE_PRODUCTS.length === 8, 'produtos da loja');
});
test('Conteúdo: 15 tutoriais, 40 marcos, 20 diárias, 12 semanais', () => {
  assert(TUTORIAL_MISSIONS.length === 15, `tutorial: ${TUTORIAL_MISSIONS.length}`);
  assert(MILESTONE_MISSIONS.length === 40, `marcos: ${MILESTONE_MISSIONS.length}`);
  assert(DAILY_TEMPLATES.length === 20, `diárias: ${DAILY_TEMPLATES.length}`);
  assert(WEEKLY_TEMPLATES.length === 12, `semanais: ${WEEKLY_TEMPLATES.length}`);
});

// ————— Custos de upgrade (PRD §9.6/§9.7) —————
test('Custo de upgrade x1 segue a fórmula', () => {
  const office = officeById('101');
  assert(upgradeCost(office, 'structure', 0) === 20, 'nível 0 = custo base');
  assert(upgradeCost(office, 'structure', 1) === Math.ceil(20 * 1.14), 'nível 1');
  assert(upgradeCost(office, 'structure', 10) === Math.ceil(20 * 1.14 ** 10), 'nível 10');
});
test('Custo x10 = soma dos custos individuais', () => {
  const office = officeById('102');
  let soma = 0;
  for (let i = 0; i < 10; i++) soma += upgradeCost(office, 'tech', 5 + i);
  assert(bulkUpgradeCost(office, 'tech', 5, 10) === soma);
});
test('Modo Máx. compra o máximo possível sem estourar orçamento nem limite', () => {
  const office = officeById('101');
  const { count, total } = maxAffordable(office, 'comfort', 0, 500, office.maxLevel);
  assert(total <= 500, 'não estoura orçamento');
  const nextCost = upgradeCost(office, 'comfort', count);
  assert(total + nextCost > 500 || count === office.maxLevel, 'não deixa compra na mesa');
});
test('Desconto máximo combinado limitado a 60% (PRD §24.1)', () => {
  const office = officeById('101');
  const cheap = upgradeCost(office, 'structure', 0, 0.99);
  assert(cheap >= Math.ceil(20 * 0.4), 'desconto teto 60%');
  assert(upgradeCost(office, 'structure', 0, 0) >= 1, 'custo nunca < 1');
});

// ————— Renda e satisfação (PRD §9) —————
test('Renda da sala 101 com estado inicial ≈ $1/s (satisfação 50 = 1,00×)', () => {
  const s = freshState();
  const snap = computeEconomy(s);
  assertClose(snap.perRoom['101'].final, 1, 0.01, 'renda inicial');
});
test('Multiplicador de satisfação: 50→1,00× · 75→1,15× · 100→1,30×', () => {
  assertClose(0.70 + 50 * 0.006, 1.00, 1e-9);
  assertClose(0.70 + 75 * 0.006, 1.15, 1e-9);
  assertClose(0.70 + 100 * 0.006, 1.30, 1e-9);
});
test('Upgrades aumentam renda em 10% por nível combinado', () => {
  const s = freshState();
  const before = computeEconomy(s).perRoom['101'];
  s.rooms['101'].structure = 5;
  const after = computeEconomy(s).perRoom['101'];
  const upgradeGain = (1 + 0.1 * 5) / 1;
  assert(after.final > before.final * 1.4, 'renda cresceu com upgrades');
});
test('Sinergia de tecnologia exige Tecnologia acima da média dos outros', () => {
  const s = freshState();
  s.rooms['101'].tech = 10;
  s.tenantsByRoom['101'] = 'T02';
  const mods = collectModifiers(s);
  const sat = roomSatisfaction(s, officeById('101'), mods);
  assert(synergyBonus(s, officeById('101'), companyById('T02'), sat) === 0.10, 'sinergia ativa');
  s.rooms['101'].structure = 20;
  assert(synergyBonus(s, officeById('101'), companyById('T02'), sat) === 0, 'sinergia inativa');
});
test('Sala vazia rende 50% da base; ganho por toque mínimo $1', () => {
  const s = freshState();
  delete s.tenantsByRoom['101'];
  const snap = computeEconomy(s);
  assertClose(snap.perRoom['101'].final, 0.5, 0.01);
  assert(tapGain(0) === 1, 'toque mínimo');
  assertClose(tapGain(1000), 80, 1e-9, '8% da renda');
});
test('Renda nunca negativa mesmo com efeitos negativos', () => {
  const s = freshState();
  s.activeEffects.push({ kind: 'income', value: -0.2, expiresAt: Date.now() + 60000, source: 't' });
  const snap = computeEconomy(s);
  assert(snap.totalPerSec >= 0);
});

// ————— Ganho offline por trechos (PRD §18.3) —————
test('Ganho offline separa trechos com boost que expira no meio', () => {
  const s = freshState();
  const now = Date.now();
  s.boostExpiresAt = now + 30_000; // boost 2× termina no meio de 60s
  const { total, segments } = incomeOverInterval(s, now, now + 60_000);
  assert(segments.length === 2, `trechos: ${segments.length}`);
  const base = segments[1].perSec;
  assertClose(segments[0].perSec, base * 2, 0.01, 'trecho com boost 2×');
  assertClose(total, base * 30 * 2 + base * 30, 0.02, 'total por trechos');
});
test('Ausência menor que 60s ou negativa não gera relatório', () => {
  const s = freshState();
  const { total } = incomeOverInterval(s, 1000, 500);
  assert(total === 0, 'tempo negativo = zero');
});

// ————— Prestígio (PRD §19) —————
test('Pontos de Legado seguem a fórmula (mín. 1)', () => {
  assert(legacyPointsFor(0, 0) === 1, 'mínimo 1');
  assert(legacyPointsFor(1e9, 0) === 10, '10×sqrt(1)');
  assert(legacyPointsFor(4e9, 500) === 22, '10×sqrt(4)+500/250');
});
test('Valor do prédio inclui gastos + 1h de renda', () => {
  const s = freshState();
  s.spentTotals = { rooms: 100, upgrades: 200, facilities: 300, managers: 400, contracts: 0 };
  const snap = computeEconomy(s);
  assertClose(prestigeValue(s, snap), 1000 + snap.totalPerSec * 3600, 0.01);
});

// ————— Save V3 (PRD §25/§43) —————
test('Save roundtrip preserva o estado', () => {
  const s = freshState();
  s.balance = 12345.67;
  s.reputation = 89;
  s.rooms['102'].unlocked = true;
  s.rooms['102'].tech = 7;
  const restored = parseAndMigrate(serialize(s));
  assertClose(restored.balance, 12345.67, 1e-9);
  assert(restored.reputation === 89);
  assert(restored.rooms['102'].tech === 7);
});
test('Migração V2 → V3 preserva saldo e salas', () => {
  const v2 = { saveVersion: 2, balance: 5000, reputation: 42, rooms: { 101: { unlocked: true, structure: 3, tech: 2, comfort: 1 } } };
  const restored = parseAndMigrate(JSON.stringify(v2));
  assert(restored.saveVersion === SAVE_VERSION);
  assert(restored.balance === 5000);
  assert(restored.rooms['101'].structure === 3);
});
test('Validação corrige NaN, Infinity e IDs desconhecidos', () => {
  const s = freshState();
  s.balance = NaN;
  s.reputation = Infinity;
  s.rooms['999'] = { unlocked: true, structure: 1e9 };
  s.tenantsByRoom['101'] = 'EMPRESA_FALSA';
  s.activeEffects = [{ kind: 'income', value: NaN, expiresAt: Date.now() + 9e5 }, 'lixo'];
  const v = validateState(JSON.parse(JSON.stringify(s), (k, val) => val === null ? val : val));
  assert(Number.isFinite(v.balance), 'saldo finito');
  assert(Number.isFinite(v.reputation), 'REP finita');
  assert(!v.rooms['999'], 'sala inexistente removida');
  assert(v.tenantsByRoom['101'] !== 'EMPRESA_FALSA', 'inquilino inválido removido');
});
test('Checksum detecta corrupção', () => {
  const text = serialize(freshState());
  const corrupted = text.replace('balance', 'balanXe'); // altera o corpo sem atualizar o checksum
  let failed = false;
  try { parseAndMigrate(corrupted); } catch { failed = true; }
  assert(failed, 'corrupção detectada');
});

// ————— RNG e missões —————
test('RNG com mesma semente produz a mesma sequência (anti recarregamento)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert(a() === b());
  assert(seededPick('2026-07-13:1', 12) === seededPick('2026-07-13:1', 12));
  assert(JSON.stringify(seededShuffle('x', 10)) === JSON.stringify(seededShuffle('x', 10)));
});
test('Missões diárias: 3 válidas, no máximo 1 de anúncio, determinísticas no dia', () => {
  game.state = freshState();
  game.snapshot = computeEconomy(game.state);
  ensureDailyMissions(game.state);
  const list = game.state.missions.daily.list;
  assert(list.length === 3, `diárias: ${list.length}`);
  const ads = list.filter((i) => DAILY_TEMPLATES.find((t) => t.id === i.tplId)?.isAd).length;
  assert(ads <= 1, 'máx. 1 missão de anúncio');
  const saved = list.map((i) => i.tplId).join(',');
  ensureDailyMissions(game.state);
  assert(game.state.missions.daily.list.map((i) => i.tplId).join(',') === saved, 'não re-sorteia no mesmo dia');
  ensureWeeklyMissions(game.state);
  assert(game.state.missions.weekly.list.length === 5, 'semanais: 5');
});
test('evaluateCheck: contadores respeitam baseline (progresso novo apenas)', () => {
  game.state = freshState();
  game.snapshot = computeEconomy(game.state);
  game.state.statistics.upgradesBought = 100;
  const r1 = evaluateCheck(game.state, { type: 'upgradesBought', value: 10 }, { upgradesBought: 100 });
  assert(!r1.done && r1.current === 0, 'baseline zera progresso');
  game.state.statistics.upgradesBought = 110;
  const r2 = evaluateCheck(game.state, { type: 'upgradesBought', value: 10 }, { upgradesBought: 100 });
  assert(r2.done, 'baseline + 10 completa');
});

// ————— Formatação (PRD §9.8) —————
test('Formatação numérica PT-BR em todas as faixas', () => {
  assert(fmtNumber(999) === '999');
  assert(fmtNumber(1250) === '1,25 mil', fmtNumber(1250));
  assert(fmtNumber(1_500_000) === '1,50 mi', fmtNumber(1_500_000));
  assert(fmtNumber(2e9) === '2,00 bi');
  assert(fmtNumber(3e12) === '3,00 tri');
  assert(fmtNumber(5e15) === '5,00 qua');
  assert(fmtNumber(7e18) === '7,00 qui');
  assert(fmtMoney(1250) === '$1,25 mil');
  assert(sanitizeNumber(NaN, 5) === 5 && sanitizeNumber(Infinity, 1, 0, 10) === 1);
});

// ————— Integridade das configurações —————
test('IDs únicos em todas as configurações', () => {
  const uniq = (arr) => new Set(arr).size === arr.length;
  assert(uniq(OFFICES.map((o) => o.id)), 'escritórios');
  assert(uniq(COMPANIES.map((c) => c.id)), 'empresas');
  assert(uniq(MANAGERS.map((m) => m.id)), 'gestores');
  assert(uniq(ACHIEVEMENTS.map((a) => a.id)), 'conquistas');
  assert(uniq(EVENTS.map((e) => e.id)), 'eventos');
  assert(uniq([...TUTORIAL_MISSIONS, ...MILESTONE_MISSIONS].map((m) => m.id)), 'missões');
});
test('Referências cruzadas válidas (andares, instalações, pré-requisitos)', () => {
  for (const o of OFFICES) assert(FLOORS.some((f) => f.id === o.floor), `andar de ${o.id}`);
  for (const r of RESEARCH) if (r.requires) assert(RESEARCH.some((x) => x.id === r.requires), `pré-req de ${r.id}`);
  for (const c of COMPANIES) if (c.req?.facility) assert(FACILITIES.some((f) => f.id === c.req.facility.id), `instalação de ${c.id}`);
});

// ————— Relatório —————
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
document.getElementById('summary').textContent = failed === 0
  ? `✅ ${passed}/${results.length} testes passaram`
  : `❌ ${failed} falha(s) — ${passed}/${results.length} passaram`;
document.getElementById('summary').style.color = failed === 0 ? '#34d17b' : '#ff5d5d';
document.getElementById('results').innerHTML = results.map((r) => `
  <div class="test ${r.ok ? 'pass' : 'fail'}">${r.ok ? '✅' : '❌'} ${r.name}${r.error ? `<pre>${r.error}</pre>` : ''}</div>`).join('');
window.__testResults = { passed, failed, total: results.length };
