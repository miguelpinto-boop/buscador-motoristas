// Painel de depuração — ativado apenas com ?debug=1 (PRD §27).
// Inclui o simulador econômico (PRD §44) e telemetria local opcional.

import { game, freshState, markDirty, emitChange } from '../core/store.js';
import { computeEconomy, upgradeCost, maxAffordable, portfolioValue } from '../core/formulas.js';
import { OFFICES, FLOORS, FACILITIES, PROPERTIES } from '../data/buildings.js';
import { COMPANIES } from '../data/companies.js';
import { MANAGERS } from '../data/managers.js';
import { RESEARCH } from '../data/research.js';
import { COLLECTION_ITEMS, MARKET_CONDITIONS } from '../data/extras.js';
import { CHAPTERS } from '../data/campaign.js';
import { EVENTS } from '../data/events.js';
import { incomeOverInterval } from '../systems/offline.js';
import { adState } from '../systems/monetization.js';
import { saveGame, parseAndMigrate, serialize } from '../persistence/save.js';
import { doPrestige } from '../systems/prestige.js';
import { bus } from '../core/bus.js';
import { fmtMoney, fmtRate, fmtDuration } from '../core/format.js';

const toast = (type, text) => bus.emit('toast', { type, text });

export function initDebugPanel() {
  if (!new URLSearchParams(location.search).has('debug')) return;

  const el = document.createElement('div');
  el.id = 'debug-panel';
  el.style.cssText = `position:fixed;bottom:70px;right:8px;z-index:200;background:#111a;border:1px solid #f0f;
    border-radius:10px;padding:8px;max-width:270px;max-height:60vh;overflow-y:auto;font-size:11px;color:#fff;backdrop-filter:blur(6px)`;

  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin:2px 0;padding:5px 8px;background:#333;color:#fff;border:1px solid #555;border-radius:6px;font-size:11px;text-align:left;cursor:pointer';
    b.addEventListener('click', () => { fn(); markDirty(); emitChange('debug'); });
    return b;
  };

  const S = () => game.state;
  const title = document.createElement('div');
  title.innerHTML = '<strong style="color:#f0f">🐞 DEBUG</strong>';
  el.appendChild(title);

  const actions = [
    ['+$1 mil', () => S().balance += 1000],
    ['+$1 mi', () => S().balance += 1e6],
    ['+$1 bi', () => S().balance += 1e9],
    ['+$1 tri', () => S().balance += 1e12],
    ['+$1 qui', () => S().balance += 1e18],
    ['+100 REP', () => S().reputation += 100],
    ['+1000 REP', () => S().reputation += 1000],
    ['+50 PP', () => S().researchPoints += 50],
    ['+10 PL', () => S().legacyPoints += 10],
    ['Avançar 1 min', () => timeSkip(60)],
    ['Avançar 1 hora', () => timeSkip(3600)],
    ['Avançar 24 horas', () => timeSkip(86400)],
    ['Simular ausência 2h', () => { S().lastSavedAt = Date.now() - 2 * 3600e3; bus.emit('offline-return', debugOfflineReport(2 * 3600)); }],
    ['Liberar tudo (salas/andares/props)', unlockEverything],
    ['Upgrades nível 20 (salas abertas)', () => Object.values(S().rooms).forEach((r) => { if (r.unlocked) { r.structure = r.tech = r.comfort = 20; } })],
    ['Construir todas as instalações', () => FACILITIES.forEach((f) => { if (S().facilities[f.id] < 0) S().facilities[f.id] = 5; })],
    ['Contratar todos os gestores', () => MANAGERS.forEach((m) => { S().hiredManagers[m.id] = S().hiredManagers[m.id] || { level: 5, xp: 0 }; })],
    ['Descobrir todas as empresas', () => { S().discoveredTenants = COMPANIES.map((c) => c.id); }],
    ['Liberar toda a pesquisa', () => { S().researchNodes = RESEARCH.map((r) => r.id); S().hqUnlocked = true; }],
    ['Completar capítulo atual', completeCurrentChapter],
    ['Forçar evento agora', () => { S().events.nextAt = Date.now() - 1; }],
    ['Sortear novo mercado', () => { S().marketCondition = { date: null, id: 'mk11' }; S().marketUnlocked = true; }],
    ['Boost 2× por 1h', () => { S().boostExpiresAt = Date.now() + 3600e3; }],
    ['Remover boosts/efeitos', () => { S().boostExpiresAt = 0; S().activeEffects = []; }],
    ['Condição -30 (prop. atual)', () => { const p = S().currentProperty; S().propertyCondition[p] = Math.max(0, S().propertyCondition[p] - 30); }],
    ['Desbloquear coleção completa', () => { S().collection.owned = COLLECTION_ITEMS.map((c) => c.id); }],
    ['Anúncio: chance de falha 50%', () => { adState.failChance = adState.failChance ? 0 : 0.5; toast('info', `Falha de anúncio: ${adState.failChance * 100}%`); }],
    ['Validar save (roundtrip)', validateSaveRoundtrip],
    ['Validar economia da sala 101', validateRoomEconomy],
    ['Prestígio de teste (força)', () => { S().reputation = Math.max(S().reputation, 900); Object.values(S().rooms).slice(0, 12).forEach((r) => r.unlocked = true); S().floors.aurora_4 = true; }],
    ['Reiniciar ciclo (save novo)', () => { game.state = freshState(); saveGame(game.state); location.reload(); }],
    ['📊 Simulador econômico', runEconomicSimulator],
  ];
  for (const [label, fn] of actions) el.appendChild(btn(label, fn));

  const output = document.createElement('pre');
  output.id = 'debug-output';
  output.style.cssText = 'white-space:pre-wrap;font-size:10px;color:#0f0;max-height:150px;overflow:auto';
  el.appendChild(output);
  document.body.appendChild(el);

  function timeSkip(seconds) {
    const snap = computeEconomy(S());
    S().balance += snap.totalPerSec * seconds;
    // Projetos avançam junto
    for (const p of S().projects.active) p.endsAt -= seconds * 1000;
    toast('info', `+${fmtDuration(seconds)} simulados (${fmtMoney(snap.totalPerSec * seconds)})`);
  }

  function debugOfflineReport(seconds) {
    const snap = computeEconomy(S());
    return {
      awaySeconds: seconds, consideredSeconds: seconds, limitHours: snap.mods.offlineHours,
      baseRate: snap.totalPerSec, segments: [{ perSec: snap.totalPerSec }], total: snap.totalPerSec * seconds, doubled: false,
    };
  }

  function unlockEverything() {
    const s = S();
    for (const p of PROPERTIES) s.properties[p.id] = true;
    for (const f of FLOORS) s.floors[f.id] = true;
    for (const o of OFFICES) s.rooms[o.id].unlocked = true;
  }

  function completeCurrentChapter() {
    const s = S();
    const ch = CHAPTERS.find((c) => c.n === s.campaign.chapter);
    if (!ch) return;
    for (const o of ch.objectives) if (!s.campaign.objectivesDone.includes(o.id)) s.campaign.objectivesDone.push(o.id);
    toast('info', `Objetivos do capítulo ${ch.n} marcados — o tique da campanha concluirá.`);
  }

  function validateSaveRoundtrip() {
    try {
      const text = serialize(S());
      const restored = parseAndMigrate(text);
      const ok = Math.abs(restored.balance - S().balance) < 1 && restored.reputation === S().reputation;
      output.textContent = ok ? '✅ Save roundtrip OK' : '❌ Divergência no roundtrip';
    } catch (err) {
      output.textContent = `❌ ${err.message}`;
    }
  }

  function validateRoomEconomy() {
    const snap = computeEconomy(S());
    const info = snap.perRoom['101'];
    const room = S().rooms['101'];
    output.textContent = [
      `Sala 101: níveis ${room.structure}/${room.tech}/${room.comfort}`,
      `satisfação=${info?.satisfaction.toFixed(1)} renda=${fmtRate(info?.final || 0)}`,
      `próximo upgrade Estrutura: ${fmtMoney(upgradeCost(OFFICES[0], 'structure', room.structure))}`,
      `renda total: ${fmtRate(snap.totalPerSec)}`,
    ].join('\n');
  }

  // Simulador econômico (PRD §44): estratégia gulosa de compra por N dias simulados
  function runEconomicSimulator() {
    const horizons = [['1 hora', 3600], ['1 dia', 86400], ['7 dias', 7 * 86400], ['30 dias', 30 * 86400]];
    const lines = [];
    for (const [label, seconds] of horizons) {
      const sim = structuredClone ? structuredClone(S()) : JSON.parse(JSON.stringify(S()));
      const step = 60; // 1 minuto por passo
      let stuckSteps = 0;
      for (let t = 0; t < seconds; t += step) {
        const snap = computeEconomy(sim, Date.now());
        sim.balance += snap.totalPerSec * step + Math.max(1, snap.totalPerSec * 0.08) * 4; // renda + 4 toques/min
        let bought = false;
        // Estratégia: desbloquear sala mais barata, depois upgrade mais barato
        for (const o of OFFICES) {
          if (!sim.rooms[o.id].unlocked && sim.floors[o.floor] && sim.balance >= o.unlockCost) {
            sim.balance -= o.unlockCost; sim.rooms[o.id].unlocked = true; bought = true; break;
          }
        }
        if (!bought) {
          let best = null;
          for (const o of OFFICES) {
            const r = sim.rooms[o.id];
            if (!r.unlocked) continue;
            for (const cat of ['structure', 'tech', 'comfort']) {
              if (r[cat] >= o.maxLevel) continue;
              const c = upgradeCost(o, cat, r[cat]);
              if (c <= sim.balance && (!best || c < best.cost)) best = { o, cat, cost: c };
            }
          }
          if (best) { sim.balance -= best.cost; sim.rooms[best.o.id][best.cat]++; bought = true; }
        }
        stuckSteps = bought ? 0 : stuckSteps + 1;
      }
      const finalSnap = computeEconomy(sim, Date.now());
      const blocked = stuckSteps > (12 * 3600) / step; // >12h sem conseguir comprar nada
      lines.push(`${label}: renda ${fmtRate(finalSnap.totalPerSec)} · saldo ${fmtMoney(sim.balance)}${blocked ? ' ⚠️ possível travamento' : ' ✅'}`);
    }
    output.textContent = `📊 Simulação (estratégia gulosa):\n${lines.join('\n')}`;
  }
}
