// Telas do jogo — PRD §21, §29–§40. Renderização por tela, orientada a dados.

import { game, activeState, snapFor } from '../core/store.js';
import { BALANCE } from '../data/balance.js';
import {
  PROPERTIES, FLOORS, OFFICES, FACILITIES, HQ_DEPARTMENTS,
  officeById, floorById, facilityById, propertyById, officesOfFloor, floorsOfProperty, facilitiesOfProperty,
} from '../data/buildings.js';
import { COMPANIES, CATEGORIES, SPECIALTIES, SYNERGIES, companyById, categoryByN } from '../data/companies.js';
import { MANAGERS, RARITIES, managerById } from '../data/managers.js';
import { RESEARCH, RESEARCH_BRANCHES, researchById } from '../data/research.js';
import { LEGACY_UPGRADES, STORE_PRODUCTS, legacyById } from '../data/prestige.js';
import { PROJECTS, projectById } from '../data/projects.js';
import { TUTORIAL_MISSIONS, MILESTONE_MISSIONS, DAILY_TEMPLATES, WEEKLY_TEMPLATES, LOGIN_CALENDAR } from '../data/missions.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../data/achievements.js';
import { CHAPTERS, CHARACTERS, RIVAL_GOALS } from '../data/campaign.js';
import { COLLECTION_ITEMS, COLLECTION_CATEGORIES, CHALLENGES, MARKET_CONDITIONS, marketById, challengeById, collectionItemById } from '../data/extras.js';
import {
  upgradeCost, facilityUpgradeCost, managerTrainCost, hqLevelCost, legacyLevelCost,
  roomVisualStage, roomIncome, contractRequirementsMet, maintenanceCost, portfolioValue, effectiveCondition,
} from '../core/formulas.js';
import { fmtMoney, fmtRate, fmtNumber, fmtInt, fmtDuration, fmtClock, fmtPercent } from '../core/format.js';
import { upgradeQuote, floorRequirementsMet, propertyRequirements, canSignContract, managerAvailable, facilityBuildCost, categoryAvailable } from '../systems/actions.js';
import { missionProgress, evaluateCheck, loginCalendarStatus, currentChapter } from '../systems/progression.js';
import { projectRequirementMet, projectsUnlocked, projectSlots, projectDurationMs, readyProjects } from '../systems/projects.js';
import { prestigePreview, empireAvailable } from '../systems/prestige.js';
import { productAvailable, coffeeBoostAvailable, investorReady, adState } from '../systems/monetization.js';
import { ui } from './ui.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (cur, target) => Math.min(100, Math.max(0, (cur / Math.max(1e-9, target)) * 100));

function progressBar(cur, target, cls = '') {
  return `<div class="bar ${cls}"><span style="width:${pct(cur, target)}%"></span></div>`;
}

// ————— Próxima meta (PRD §40.3 — seta "próxima meta") —————

function nextGoalCard(state, snap) {
  // Prioridade: sala bloqueada mais barata do andar aberto → andar → propriedade → Prestígio
  let goal = null;
  const prop = state.currentProperty;
  const lockedRooms = OFFICES
    .filter((o) => o.property === prop && !state.rooms[o.id].unlocked && state.floors[o.floor])
    .sort((a, b) => a.unlockCost - b.unlockCost);
  if (lockedRooms.length) {
    goal = { label: `Desbloquear ${lockedRooms[0].name}`, cost: lockedRooms[0].unlockCost, hint: 'nova sala = novo aluguel' };
  } else {
    const lockedFloor = floorsOfProperty(prop).find((f) => !state.floors[f.id]);
    if (lockedFloor) {
      goal = { label: `Liberar ${lockedFloor.name}`, cost: lockedFloor.cost, hint: `${lockedFloor.rep} REP + requisitos do andar` };
    } else {
      const nextProp = PROPERTIES.find((p) => !state.properties[p.id]);
      if (nextProp) {
        goal = { label: `Comprar ${nextProp.name}`, cost: nextProp.unlock.cost, hint: `capítulo ${nextProp.unlock.chapter} e ${nextProp.unlock.rep} REP` };
      } else if (state === game.state) {
        const preview = prestigePreview(state);
        const okCount = preview.requirements.filter((r) => r.ok).length;
        return `<div class="card" style="border-color:var(--accent)">
          <div class="row between">
            <div><h3>🎯 Próxima meta: Prestígio</h3><div class="dim">${okCount}/${preview.requirements.length} requisitos · +${fmtInt(preview.legacyPoints)} PL previstos</div></div>
            <button class="btn small primary" data-action="nav" data-screen="prestige">Ver</button>
          </div>
        </div>`;
      }
    }
  }
  if (!goal) return '';
  const pctNow = Math.min(100, Math.floor((state.balance / Math.max(1, goal.cost)) * 100));
  return `<div class="card" style="border-color:var(--border-strong)">
    <div class="row between">
      <div style="flex:1">
        <h3>🎯 Próxima meta: ${esc(goal.label)}</h3>
        <div class="dim">${fmtMoney(goal.cost)} · ${esc(goal.hint)}</div>
        <div class="bar green" style="margin-top:6px"><span data-goal-cost="${goal.cost}" style="width:${pctNow}%"></span></div>
      </div>
      <strong class="dim" data-goal-pct style="margin-left:8px">${pctNow}%</strong>
    </div>
  </div>`;
}

// ————— Tela PRÉDIO (PRD §21.3) —————

function renderBuilding(el, state) {
  const snap = snapFor(state);
  const prop = propertyById(state.currentProperty);
  const floors = floorsOfProperty(prop.id);
  const cond = state.propertyCondition[prop.id] ?? 100;
  const inChallenge = state !== game.state;
  const ch = challengeById(game.challengeRun?.id);

  let html = '';

  if (inChallenge && ch) {
    const run = game.challengeRun;
    const left = Math.max(0, run.deadline - Date.now());
    html += `<div class="challenge-hud">
      <div class="row between"><strong>🕵️‍♀️ ${esc(ch.name)}</strong><span class="tag purple" data-countdown="${run.deadline}">${fmtClock(left)}</span></div>
      <div class="small muted" style="margin:4px 0">${esc(ch.desc)}</div>
      <button class="btn small danger" data-action="abandon-challenge">Encerrar cenário</button>
    </div>`;
  }

  const equipped = Object.values(state.collection.equipped[prop.id] || {})
    .map((id) => collectionItemById(id)?.name).filter(Boolean);
  html += `<div class="property-banner">
    <span class="ico">${prop.icon}</span>
    <div style="flex:1">
      <h2>${esc(prop.name)}</h2>
      <div class="dim">${esc(prop.tagline)}</div>
      ${equipped.length ? `<div class="dim">🖼️ ${equipped.map(esc).join(' · ')}</div>` : ''}
      <div class="condition-row">
        <span class="dim">Condição ${Math.round(cond)}</span>
        <div class="bar ${cond >= 80 ? 'green' : cond >= 50 ? '' : 'red'}" style="max-width:130px"><span style="width:${cond}%"></span></div>
        ${cond < 99.5 ? `<button class="btn small" data-action="maintain" data-prop="${prop.id}">🔧 ${fmtMoney(maintenanceCost(snap.perProperty[prop.id] || 0, snap.mods.maintenanceDiscount))}</button>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="small muted">Renda daqui</div>
      <strong class="gain">${fmtRate(snap.perProperty[prop.id] || 0)}</strong>
    </div>
  </div>`;

  html += `<button class="work-btn" data-action="tap-work" aria-label="Trabalhar para ganhar dinheiro">💼 Trabalhar</button>`;

  html += nextGoalCard(state, snap);

  const modes = [[1, 'x1'], [10, 'x10'], ...(snap.mods.buyX25 ? [[25, 'x25']] : []), ['max', 'Máx.']];
  html += `<div class="buymode-row"><span class="label">COMPRAR:</span>${modes.map(([m, label]) =>
    `<button class="buymode ${String(ui.buyMode) === String(m) ? 'active' : ''}" data-action="set-buymode" data-mode="${m}">${label}</button>`).join('')}</div>`;

  for (const floor of floors) {
    const unlocked = state.floors[floor.id];
    const rooms = officesOfFloor(floor.id);
    const mgrId = state.managerAssignments[floor.id];
    const mgr = mgrId ? managerById(mgrId) : null;

    if (!unlocked) {
      const missing = floorRequirementsMet(state, floor);
      const reqs = [
        fmtMoney(floor.cost),
        `${floor.rep} REP`,
        ...(floor.requires?.allRoomsOfFloor ? ['todas as salas do andar anterior'] : []),
        ...(floor.requires?.facilitiesAtLevel ? [`${floor.requires.facilitiesAtLevel.count} instalações nv. ${floor.requires.facilitiesAtLevel.level}`] : []),
        ...(floor.requires?.managerAtLevel ? [`gestor nv. ${floor.requires.managerAtLevel}`] : []),
      ];
      const canPay = state.balance >= floor.cost && missing.length === 0;
      html += `<div class="floor-block">
        <div class="floor-head">
          <span class="fh-title">🔒 ${esc(floor.name)} <span class="dim">(bônus ${floor.bonus.toFixed(2).replace('.', ',')}×)</span></span>
          <button class="btn small ${canPay ? 'primary affordable' : ''}" data-action="unlock-floor" data-floor="${floor.id}" data-cost="${floor.cost}">Liberar</button>
        </div>
        <div class="card"><div class="dim">Requisitos: ${reqs.join(' · ')}</div></div>
      </div>`;
      continue;
    }

    html += `<div class="floor-block">
      <div class="floor-head">
        <span class="fh-title">${esc(floor.name)} <span class="tag gold">×${floor.bonus.toFixed(2).replace('.', ',')}</span></span>
        <button class="btn small ghost fh-mgr" data-action="assign-floor" data-floor="${floor.id}">
          ${mgr ? `👤 ${esc(mgr.name)} nv.${state.hiredManagers[mgrId].level}` : '➕ Designar gestor'}
        </button>
      </div>`;

    for (const office of rooms) {
      html += roomCard(state, snap, office);
    }
    html += '</div>';
  }

  // Instalações (PRD §12)
  const facs = facilitiesOfProperty(prop.id);
  html += `<div class="section-title">Instalações compartilhadas</div>`;
  for (const fac of facs) {
    const lvl = state.facilities[fac.id] ?? -1;
    if (lvl < 0) {
      const cost = facilityBuildCost(state, fac);
      html += `<div class="card facility-card">
        <span class="ico">${fac.icon}</span>
        <div style="flex:1"><h3>${esc(fac.name)}</h3><div class="dim">${esc(fac.desc)}</div></div>
        <button class="btn ${state.balance >= cost ? 'primary affordable' : ''}" data-action="build-facility" data-fac="${fac.id}" data-cost="${cost}">${fmtMoney(cost)}</button>
      </div>`;
    } else {
      const maxed = lvl >= fac.maxLevel;
      const cost = facilityUpgradeCost(fac, lvl, snap.mods.facilityDiscount);
      html += `<div class="card facility-card">
        <span class="ico">${fac.icon}</span>
        <div style="flex:1">
          <h3>${esc(fac.name)} <span class="tag blue">nv. ${lvl}/${fac.maxLevel}</span></h3>
          <div class="dim">${esc(fac.desc)}</div>
          ${progressBar(lvl, fac.maxLevel, 'blue')}
        </div>
        ${maxed ? '<span class="tag gold">MÁX</span>' : `<button class="btn small ${state.balance >= cost ? 'primary' : ''}" data-action="upgrade-facility" data-fac="${fac.id}" data-cost="${cost}">▲ ${fmtMoney(cost)}</button>`}
      </div>`;
    }
  }

  el.innerHTML = html;
}

function roomCard(state, snap, office) {
  const room = state.rooms[office.id];
  const stage = roomVisualStage(office, room);

  if (!room.unlocked) {
    const canPay = state.balance >= office.unlockCost;
    return `<div class="room-card locked">
      <div class="row between">
        <div class="row"><div class="room-visual">🔒</div>
          <div><h3>${esc(office.name)}</h3><div class="dim">Renda base ${fmtRate(office.baseIncome)}</div></div>
        </div>
        <button class="btn ${canPay ? 'primary affordable' : ''}" data-action="unlock-room" data-room="${office.id}" data-cost="${office.unlockCost}">${fmtMoney(office.unlockCost)}</button>
      </div>
    </div>`;
  }

  const info = snap.perRoom[office.id] || { final: 0, satisfaction: 50, synergy: 0 };
  const tenantId = state.tenantsByRoom[office.id];
  const tenant = tenantId ? companyById(tenantId) : null;
  const stageEmojis = { 'stage-basic': '🚪', 'stage-renovated': '🛋️', 'stage-modern': '🖥️', 'stage-executive': '🏬', 'stage-premium': '🌟' };
  const totalSum = room.structure + room.tech + room.comfort;
  const nextMs = BALANCE.upgradeMilestones.find((m, i) => !room.milestones.includes(i) && m.sum !== -1);

  const cats = [['structure', '🧱 Estrutura'], ['tech', '💾 Tecnologia'], ['comfort', '🛋️ Conforto']];
  const upgradeRows = cats.map(([cat, label]) => {
    const q = upgradeQuote(state, office.id, cat, ui.buyMode === 'max' ? 'max' : Number(ui.buyMode));
    const lvl = room[cat];
    if (q?.maxed) {
      return `<div class="upgrade-row"><div><div class="u-name">${label}</div><div class="u-level">nível ${lvl}/${office.maxLevel}</div></div><span class="tag gold">MÁX</span></div>`;
    }
    const afford = q && q.count > 0 && state.balance >= q.total;
    return `<div class="upgrade-row">
      <div><div class="u-name">${label}</div><div class="u-level">nível ${lvl}/${office.maxLevel}</div></div>
      <button class="btn small ${afford ? 'primary' : ''}" data-action="buy-upgrade" data-room="${office.id}" data-cat="${cat}" data-cost="${q ? q.total : 0}" ${!q || q.count === 0 ? 'disabled' : ''}>
        ${q && q.count > 1 ? `+${q.count} · ` : ''}${q ? fmtMoney(q.total) : '—'}
      </button>
    </div>`;
  }).join('');

  return `<div class="room-card ${stage.cls}">
    <div class="row between">
      <div class="row">
        <div class="room-visual">${stageEmojis[stage.cls] || '🚪'}</div>
        <div>
          <h3>${esc(office.name)} <span class="tag">${stage.name}</span></h3>
          <div class="dim">${tenant ? `${SPECIALTIES[tenant.specialty].icon} ${esc(tenant.name)} (${tenant.mult.toFixed(2).replace('.', ',')}×)${info.synergy ? ` <span class="tag green">sinergia +${Math.round(info.synergy * 100)}%</span>` : ''}` : '<span class="loss">Sala vazia (renda 50%)</span>'}</div>
        </div>
      </div>
      <div style="text-align:right">
        <strong class="gain">${fmtRate(info.final)}</strong>
        <div><button class="btn small ghost" data-action="goto-contracts" data-room="${office.id}">Contratos ›</button></div>
      </div>
    </div>
    <div class="satisfaction-line">
      <span class="dim">😊 ${Math.round(info.satisfaction)}</span>
      <div class="bar ${info.satisfaction >= 85 ? 'green' : info.satisfaction >= 65 ? '' : 'red'}"><span style="width:${info.satisfaction}%"></span></div>
      ${nextMs ? `<span class="dim" title="Próximo marco">🏁 ${totalSum}/${nextMs.sum}</span>` : '<span class="tag gold">🏁</span>'}
    </div>
    ${upgradeRows}
  </div>`;
}

// ————— Tela MAPA (PRD §29) —————

function renderMap(el, state) {
  const snap = snapFor(state);
  const pv = portfolioValue(state, snap);
  let html = `<div class="card">
    <div class="row between"><span class="muted">Valor do portfólio</span><strong class="money">${fmtMoney(pv)}</strong></div>
    <div class="row between small"><span class="muted">Renda total</span><strong class="gain">${fmtRate(snap.totalPerSec)}</strong></div>
  </div>`;

  if (state.marketUnlocked) {
    const mk = marketById(state.marketCondition.id);
    if (mk) {
      html += `<div class="card">
        <h3>${mk.icon} Mercado de hoje: ${esc(mk.name)}</h3>
        <div class="muted small">${esc(mk.desc)}</div>
      </div>`;
    }
  }

  const effects = (state.activeEffects || []).filter((fx) => fx.expiresAt > Date.now());
  if (effects.length) {
    html += `<div class="card"><h3>✨ Efeitos ativos</h3>${effects.map((fx) => `
      <div class="row between small">
        <span class="muted">${fx.kind === 'income' ? 'Renda' : fx.kind === 'satisfaction' ? 'Satisfação' : 'Desconto em upgrades'} ${fx.value > 0 ? '+' : ''}${fx.kind === 'satisfaction' ? Math.round(fx.value) : Math.round(fx.value * 100) + '%'}${fx.source ? ` · ${esc(fx.source)}` : ''}</span>
        <span class="tag" data-countdown="${fx.expiresAt}">${fmtClock(fx.expiresAt - Date.now())}</span>
      </div>`).join('')}</div>`;
  }

  html += '<div class="section-title">Propriedades</div>';
  for (const prop of PROPERTIES) {
    const unlocked = state.properties[prop.id];
    const cond = state.propertyCondition[prop.id] ?? 100;
    if (unlocked) {
      const isCurrent = state.currentProperty === prop.id;
      const roomsOfProp = OFFICES.filter((o) => o.property === prop.id && state.rooms[o.id].unlocked).length;
      html += `<div class="map-card p-${prop.id}">
        ${isCurrent ? '<span class="current-pin tag gold">ATUAL</span>' : ''}
        <div class="row">
          <span class="ico">${prop.icon}</span>
          <div style="flex:1">
            <h3>${esc(prop.name)}</h3>
            <div class="dim">${esc(prop.tagline)} · ${roomsOfProp}/12 salas</div>
            <div class="small gain">${fmtRate(snap.perProperty[prop.id] || 0)}</div>
            <div class="condition-row"><span class="dim">Condição</span><div class="bar ${cond >= 80 ? 'green' : cond >= 50 ? '' : 'red'}"><span style="width:${cond}%"></span></div><span class="dim">${Math.round(cond)}</span></div>
          </div>
          ${isCurrent ? '' : `<button class="btn primary" data-action="switch-property" data-prop="${prop.id}">Visitar</button>`}
        </div>
      </div>`;
    } else {
      const reqs = propertyRequirements(state, prop);
      const allOk = reqs.every((r) => r.ok);
      const canPay = allOk && state.balance >= prop.unlock.cost;
      html += `<div class="map-card p-${prop.id} locked">
        <div class="row">
          <span class="ico">🔒</span>
          <div style="flex:1">
            <h3>${esc(prop.name)}</h3>
            <div class="dim">${esc(prop.tagline)}</div>
            ${reqs.map((r) => `<div class="small ${r.ok ? 'gain' : 'muted'}">${r.ok ? '✓' : '○'} ${esc(r.label)}</div>`).join('')}
            <div class="small ${state.balance >= prop.unlock.cost ? 'gain' : 'muted'}">${state.balance >= prop.unlock.cost ? '✓' : '○'} ${fmtMoney(prop.unlock.cost)}</div>
          </div>
          <button class="btn ${canPay ? 'primary affordable' : ''}" data-action="unlock-property" data-prop="${prop.id}" ${allOk ? '' : 'disabled'}>Comprar</button>
        </div>
      </div>`;
    }
  }
  el.innerHTML = html;
}

// ————— Tela CONTRATOS (PRD §21.4) —————

function renderContracts(el, state) {
  const snap = snapFor(state);
  const unlockedRooms = OFFICES.filter((o) => state.rooms[o.id]?.unlocked);
  if (!unlockedRooms.length) {
    el.innerHTML = '<div class="empty-state"><span class="ico">📋</span>Desbloqueie uma sala para assinar contratos.</div>';
    return;
  }
  if (!ui.contractRoom || !state.rooms[ui.contractRoom]?.unlocked) ui.contractRoom = unlockedRooms[0].id;
  const office = officeById(ui.contractRoom);
  const currentTenant = state.tenantsByRoom[office.id] ? companyById(state.tenantsByRoom[office.id]) : null;
  const currentIncome = snap.perRoom[office.id]?.final || 0;

  let html = `<div class="card">
    <label class="dim" for="contract-room-sel">Escolher sala</label>
    <select id="contract-room-sel" data-select="contract-room" style="width:100%;margin-top:5px;padding:10px;border-radius:9px;background:var(--bg);color:var(--text);border:1px solid var(--border-strong)">
      ${unlockedRooms.map((o) => `<option value="${o.id}" ${o.id === ui.contractRoom ? 'selected' : ''}>${esc(o.name)} — ${state.tenantsByRoom[o.id] ? esc(companyById(state.tenantsByRoom[o.id]).name) : 'vazia'}</option>`).join('')}
    </select>
    <div class="row between" style="margin-top:8px">
      <span class="muted small">Renda atual da sala</span><strong class="gain">${fmtRate(currentIncome)}</strong>
    </div>
  </div>`;

  const filters = [['all', 'Todas'], ['available', 'Disponíveis'], ['best', 'Melhor renda'], ['locked', 'Bloqueadas']];
  html += `<div class="subtabs">${filters.map(([f, label]) => `<button class="subtab ${ui.contractFilter === f ? 'active' : ''}" data-action="contract-filter" data-filter="${f}">${label}</button>`).join('')}</div>`;

  // Renda projetada com cada empresa
  const rows = COMPANIES.map((c) => {
    const check = canSignContract(state, office.id, c.id);
    const projState = { ...state, tenantsByRoom: { ...state.tenantsByRoom, [office.id]: c.id } };
    const projected = check.ok || currentTenant?.id === c.id ? roomIncome(projState, office, snap.mods).final : 0;
    return { c, check, projected };
  });

  // Empresas de categorias muito acima da REP atual ficam ocultas para não poluir
  const maxAvailableCat = Math.max(1, ...CATEGORIES.filter((c) => categoryAvailable(state, c.n)).map((c) => c.n));
  const horizon = maxAvailableCat + 1;
  const hiddenCount = rows.filter((r) => r.c.cat > horizon).length;

  let list = rows.filter((r) => r.c.cat <= horizon);
  if (ui.contractFilter === 'available') list = list.filter((r) => r.check.ok && state.tenantsByRoom[office.id] !== r.c.id);
  if (ui.contractFilter === 'locked') list = list.filter((r) => !r.check.ok);
  if (ui.contractFilter === 'best') list = list.filter((r) => r.check.ok).sort((a, b) => b.projected - a.projected);

  for (const { c, check, projected } of list) {
    const isCurrent = state.tenantsByRoom[office.id] === c.id;
    const discovered = state.discoveredTenants.includes(c.id);
    const cat = categoryByN(c.cat);
    const spec = SPECIALTIES[c.specialty];
    const alreadyPaid = (state.paidContracts || []).includes(`${office.id}:${c.id}`);
    const worse = check.ok && projected < currentIncome && !isCurrent;
    html += `<div class="card contract-card ${isCurrent ? 'active-here' : check.ok ? 'available' : 'locked-req'}">
      <div class="row between">
        <div>
          <h3>${spec.icon} ${esc(c.name)} ${isCurrent ? '<span class="tag gold">ATIVA AQUI</span>' : ''} ${!discovered ? '<span class="tag purple">NOVA</span>' : ''}</h3>
          <div class="dim">Cat. ${c.cat} — ${esc(cat.name)} · ${esc(spec.name)} · <strong>${c.mult.toFixed(2).replace('.', ',')}×</strong></div>
          <div class="dim">Sinergia: ${esc(SYNERGIES[c.specialty].desc)} (+${Math.round(SYNERGIES[c.specialty].bonus * 100)}%)</div>
          ${requirementText(c)}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="small muted">${alreadyPaid ? 'já pago' : fmtMoney(Math.ceil(c.cost * (1 - snap.mods.contractDiscount)))}</div>
          ${c.rep && !state.repGrantedTenants.includes(c.id) ? `<div class="small">⭐ +${c.rep}</div>` : ''}
        </div>
      </div>
      ${check.ok && !isCurrent ? `
        <div class="contract-compare">
          <div class="row between"><span class="muted">Renda atual → projetada</span>
          <span>${fmtRate(currentIncome)} → <strong class="${worse ? 'loss' : 'gain'}">${fmtRate(projected)}</strong></span></div>
          ${worse ? '<div class="loss small">⚠️ Este contrato REDUZ a renda da sala.</div>' : ''}
        </div>
        <button class="btn primary block" style="margin-top:8px" data-action="sign-contract" data-room="${office.id}" data-company="${c.id}" data-worse="${worse ? '1' : ''}">Assinar contrato</button>`
    : !check.ok ? `<div class="loss small" style="margin-top:6px">🔒 ${esc(check.reason)}</div>` : ''}
    </div>`;
  }

  if (hiddenCount > 0) {
    html += `<div class="card"><div class="dim" style="text-align:center">🔭 ${hiddenCount} empresa(s) de categorias superiores serão reveladas conforme sua Reputação crescer.</div></div>`;
  }

  el.innerHTML = html;
  el.querySelector('[data-select="contract-room"]')?.addEventListener('change', (e) => {
    ui.contractRoom = e.target.value;
    renderContracts(el, activeState());
  });
}

function requirementText(c) {
  const req = c.req || {};
  const parts = [];
  if (req.structure) parts.push(`Estrutura ${req.structure}`);
  if (req.tech) parts.push(`Tecnologia ${req.tech}`);
  if (req.comfort) parts.push(`Conforto ${req.comfort}`);
  if (req.avg) parts.push(`Média ${req.avg}`);
  if (req.balancedAt) parts.push(`3 upgrades equilibrados em ${req.balancedAt}`);
  if (req.facility) parts.push(`${facilityById(req.facility.id)?.name} nv. ${req.facility.level}`);
  if (req.allFacilitiesAt) parts.push(`todas as instalações nv. ${req.allFacilitiesAt}`);
  if (req.greenFacilitiesAt) parts.push(`instalações verdes nv. ${req.greenFacilitiesAt}`);
  if (req.satisfaction) parts.push(`Satisfação ${req.satisfaction}`);
  if (req.roomUnlocked) parts.push(`${officeById(req.roomUnlocked)?.name} desbloqueada`);
  if (req.roomAtLevel) parts.push(`${officeById(req.roomAtLevel.id)?.name} média ${req.roomAtLevel.avg}`);
  if (req.legendaryManagers) parts.push(`${req.legendaryManagers} gestores lendários+`);
  if (req.chapter) parts.push(`Capítulo ${req.chapter}`);
  if (req.avgSatisfaction) parts.push(`Satisfação média ${req.avgSatisfaction}`);
  return parts.length ? `<div class="dim">Requisitos: ${parts.join(' · ')}</div>` : '';
}

// ————— Tela EQUIPE (PRD §21.5) —————

function renderTeam(el, state) {
  const snap = snapFor(state);
  let html = '';
  const hired = MANAGERS.filter((m) => state.hiredManagers[m.id]);
  const hireable = MANAGERS.filter((m) => !state.hiredManagers[m.id] && managerAvailable(state, m) && !m.campaignOnly);
  const locked = MANAGERS.filter((m) => !state.hiredManagers[m.id] && (!managerAvailable(state, m) || m.campaignOnly));

  if (state.lastAssignment && Date.now() - state.lastAssignment.at <= 10_000) {
    html += `<button class="btn block" data-action="undo-assign">↩️ Desfazer última designação</button>`;
  }

  if (hired.length) {
    html += '<div class="section-title">Contratados</div>';
    for (const m of hired) {
      const h = state.hiredManagers[m.id];
      const assignedFloor = Object.entries(state.managerAssignments).find(([, id]) => id === m.id)?.[0];
      const maxed = h.level >= BALANCE.managerMaxLevel;
      const repReq = BALANCE.managerTrainRepRequired[h.level + 1];
      const trainCost = managerTrainCost(m, h.level, snap.mods.trainDiscount) * (snap.mods.trainCostMult || 1);
      html += `<div class="card manager-card" data-rarity="${m.rarity}">
        <div class="manager-avatar">🧑‍💼</div>
        <div style="flex:1">
          <h3>${esc(m.name)} <span class="tag" style="color:${RARITIES[m.rarity].color}">${RARITIES[m.rarity].name}</span></h3>
          <div class="dim">${esc(m.title)} · Nível ${h.level}/10</div>
          <div class="small">✦ ${managerBonusText(m.bonus, h.level)}</div>
          <div class="small ${h.level >= 5 ? '' : 'dim'}">${h.level >= 5 ? '✦' : '🔒 nv.5:'} ${managerBonusText(m.bonus5, h.level)}</div>
          <div class="dim">${assignedFloor ? `📍 ${floorById(assignedFloor)?.name} (${propertyById(floorById(assignedFloor)?.property)?.name})` : 'Sem andar designado'}</div>
          <div class="row" style="margin-top:7px">
            ${maxed ? '<span class="tag gold">NÍVEL MÁX</span>' : `<button class="btn small ${state.balance >= trainCost ? 'primary' : ''}" data-action="train-manager" data-mgr="${m.id}" data-cost="${trainCost}">📚 Treinar ${fmtMoney(trainCost)}${repReq ? ` (${repReq} REP)` : ''}</button>`}
            <button class="btn small" data-action="assign-manager" data-mgr="${m.id}">📍 Designar</button>
            ${assignedFloor ? `<button class="btn small ghost" data-action="unassign-manager" data-floor="${assignedFloor}">Remover</button>` : ''}
          </div>
        </div>
      </div>`;
    }
  }

  if (hireable.length) {
    html += '<div class="section-title">Disponíveis para contratar</div>';
    for (const m of hireable) {
      const cost = Math.ceil(m.cost * (1 - (snap.mods.hireDiscount || 0)));
      html += `<div class="card manager-card" data-rarity="${m.rarity}">
        <div class="manager-avatar">🧑‍💼</div>
        <div style="flex:1">
          <h3>${esc(m.name)} <span class="tag" style="color:${RARITIES[m.rarity].color}">${RARITIES[m.rarity].name}</span></h3>
          <div class="dim">${esc(m.title)}</div>
          <div class="small">✦ ${managerBonusText(m.bonus, 1)}</div>
          <div class="small dim">🔒 nv.5: ${managerBonusText(m.bonus5, 5)}</div>
          <button class="btn ${state.balance >= cost ? 'primary affordable' : ''} block" style="margin-top:7px" data-action="hire-manager" data-mgr="${m.id}" data-cost="${cost}">Contratar — ${fmtMoney(cost)}</button>
        </div>
      </div>`;
    }
  }

  if (locked.length) {
    html += '<div class="section-title">Bloqueados</div>';
    for (const m of locked) {
      const eliteLocked = ['M19', 'M20', 'M21', 'M22', 'M23'].includes(m.id) && !snap.mods.eliteManagersUnlocked;
      html += `<div class="card manager-card" data-rarity="${m.rarity}" style="opacity:0.65">
        <div class="manager-avatar">❓</div>
        <div style="flex:1">
          <h3>${esc(m.name)}</h3>
          <div class="dim">${esc(m.title)}</div>
          <div class="small dim">🔒 ${m.campaignOnly ? 'Recompensa do capítulo 12' : eliteLocked ? 'Requer pesquisa Conselho de Elite' : `Requer ${fmtInt(m.rep)} REP`}</div>
        </div>
      </div>`;
    }
  }

  el.innerHTML = html || '<div class="empty-state"><span class="ico">🧑‍💼</span>Ganhe Reputação para atrair gestores.</div>';
}

export function managerBonusText(b, level) {
  if (!b) return '';
  const v = (base) => `${Math.round(base * (1 + BALANCE.managerLevelScale * (Math.max(1, level) - 1)) * 100)}%`;
  const map = {
    floorIncome: () => `+${v(b.value)} de renda no andar`,
    totalIncome: () => `+${v(b.value)} de renda total`,
    propertyIncome: () => `+${v(b.value)} de renda na propriedade`,
    satisfaction: () => `+${Math.round(b.value * (1 + BALANCE.managerLevelScale * (level - 1)))} de satisfação no andar`,
    specialtyIncome: () => `+${v(b.value)} em empresas de ${SPECIALTIES[b.specialty]?.name}`,
    specialtyIncome2: () => `+${v(b.value)} em ${b.specialties.map((s) => SPECIALTIES[s]?.name).join(' e ')}`,
    floorIncomeHighSat: () => `+${v(b.value)} no andar com satisfação ${b.minSat}+`,
    contractDiscount: () => `contratos ${v(b.value)} mais baratos`,
    facilityDiscount: () => `instalações ${v(b.value)} mais baratas`,
    trainDiscountTI: () => `Sala de TI ${v(b.value)} mais barata`,
    eventPenalty: () => `eventos negativos ${v(b.value)} menores`,
    ppBonus: () => `+${v(b.value)} de PP`,
    projectSpeed: () => `projetos ${v(b.value)} mais rápidos`,
    projectSpeedLong: () => `projetos longos ${v(b.value)} mais rápidos`,
    projectReward: () => `+${v(b.value)} de recompensa em projetos`,
    repBonus: () => `+${v(b.value)} de REP recebida`,
    conditionBonus: () => `+${Math.round(b.value)} de condição efetiva`,
    satisfactionFloor: () => `satisfação mínima +${Math.round(b.value)}`,
    extraManager: () => 'um gestor extra na propriedade',
    researchDiscount: () => `pesquisa ${v(b.value)} mais barata`,
    greenBonus: () => `bônus verdes +${v(b.value)}`,
    categoryIncome: () => `+${v(b.value)} em empresas categoria ${b.category}`,
    extraProposal: () => 'propostas especiais +1',
    automationEarly: () => 'automações liberadas um nível antes',
  };
  return (map[b.type] || (() => ''))();
}

// ————— Tela SEDE (PRD §31) —————

function renderHq(el, state) {
  if (!state.hqUnlocked) {
    el.innerHTML = `<div class="empty-state"><span class="ico">🏛️</span>
      <h3>Sede Administrativa</h3>
      <p class="muted" style="margin-top:6px">A Sede é liberada no capítulo 5 da campanha — "Na Liga Nacional".</p>
      <button class="btn primary" style="margin-top:12px" data-action="nav" data-screen="campaign">Ver campanha</button>
    </div>`;
    return;
  }
  const snap = snapFor(state);
  let html = `<div class="card"><div class="row between"><span class="muted">Pontos de Pesquisa</span><strong>🔬 ${fmtNumber(state.researchPoints)} PP</strong></div></div>`;

  html += '<div class="section-title">Departamentos</div>';
  for (const dept of HQ_DEPARTMENTS) {
    const lvl = state.hqDepartments[dept.id] || 0;
    const maxed = lvl >= dept.maxLevel;
    const cost = hqLevelCost(dept, lvl);
    html += `<div class="card facility-card">
      <span class="ico">${dept.icon}</span>
      <div style="flex:1">
        <h3>${esc(dept.name)} <span class="tag blue">nv. ${lvl}/${dept.maxLevel}</span></h3>
        <div class="dim">${esc(dept.desc)}</div>
        ${progressBar(lvl, dept.maxLevel, 'blue')}
      </div>
      ${maxed ? '<span class="tag gold">MÁX</span>' : `<button class="btn small ${state.balance >= cost ? 'primary' : ''}" data-action="hq-upgrade" data-dept="${dept.id}" data-cost="${cost}">▲ ${fmtMoney(cost)}</button>`}
    </div>`;
  }

  html += '<div class="section-title">Árvore de Pesquisa</div>';
  for (const branch of RESEARCH_BRANCHES) {
    html += `<h3 style="margin:10px 2px 6px">${branch.icon} ${esc(branch.name)}</h3>`;
    for (const node of RESEARCH.filter((r) => r.branch === branch.id)) {
      const owned = state.researchNodes.includes(node.id);
      const reqOk = !node.requires || state.researchNodes.includes(node.requires);
      const cost = Math.ceil(node.cost * (1 - (snap.mods.researchDiscount || 0)));
      const affordable = state.researchPoints >= cost;
      html += `<div class="card research-node ${owned ? 'owned' : reqOk ? 'available' : 'locked'}">
        <div class="row between">
          <div>
            <h3>${esc(node.name)} ${owned ? '<span class="tag green">PESQUISADA</span>' : ''} ${node.qol ? '<span class="tag blue" title="Mantida no Prestígio">QV</span>' : ''}</h3>
            <div class="dim">${esc(node.desc)}${node.requires && !reqOk ? ` · requer ${esc(researchById(node.requires).name)}` : ''}</div>
          </div>
          ${owned ? '' : `<button class="btn small ${reqOk && affordable ? 'primary' : ''}" data-action="buy-research" data-node="${node.id}" ${reqOk ? '' : 'disabled'}>🔬 ${cost} PP</button>`}
        </div>
      </div>`;
    }
  }
  el.innerHTML = html;
}

// ————— Tela METAS (PRD §21.6) —————

function renderGoals(el, state) {
  const sub = ui.sub.goals || 'tutorial';
  const tabs = [['tutorial', '📖 Tutorial'], ['daily', '📅 Diárias'], ['milestones', '🏁 Marcos'], ['achievements', '🏆 Conquistas']];
  let html = `<div class="subtabs">${tabs.map(([t, label]) => `<button class="subtab ${sub === t ? 'active' : ''}" data-action="goals-tab" data-tab="${t}">${label}</button>`).join('')}</div>`;

  if (sub === 'tutorial') {
    const idx = state.missions.tutorialIndex;
    if (idx >= TUTORIAL_MISSIONS.length) {
      html += '<div class="empty-state"><span class="ico">🎓</span>Tutorial concluído! Confira os Marcos e as Diárias.</div>';
    } else {
      TUTORIAL_MISSIONS.forEach((m, i) => {
        if (i > idx + 2) return;
        const done = i < idx;
        const isCurrent = i === idx;
        const r = isCurrent ? evaluateCheck(state, m.check) : null;
        html += `<div class="card mission-card ${isCurrent ? '' : ''}" style="${done ? 'opacity:0.55' : ''} ${isCurrent ? 'border-color:var(--accent)' : ''}">
          <div class="m-head">
            <div><h3>${done ? '✅' : isCurrent ? '▶️' : '🔒'} ${i + 1}. ${esc(m.name)}</h3>
            <div class="dim">Recompensa: ${rewardText(m.reward)}</div></div>
          </div>
          ${isCurrent && r ? progressBar(r.current, r.target, 'green') : ''}
        </div>`;
      });
    }
  }

  if (sub === 'daily') {
    const login = loginCalendarStatus(state);
    html += `<div class="card">
      <div class="row between">
        <div><h3>🗓️ Calendário de retorno</h3><div class="dim">Dia ${login.claimedToday ? login.cycleDay : login.nextDay} de 7 — ${LOGIN_CALENDAR[(login.claimedToday ? login.cycleDay : login.nextDay) - 1]?.label || ''}</div></div>
        <button class="btn ${login.claimedToday ? '' : 'primary affordable'}" data-action="claim-login" ${login.claimedToday ? 'disabled' : ''}>${login.claimedToday ? 'Coletado ✓' : 'Coletar'}</button>
      </div>
    </div>`;

    html += '<div class="section-title">Missões diárias (renovam à meia-noite)</div>';
    state.missions.daily.list.forEach((inst, i) => {
      const tpl = DAILY_TEMPLATES.find((t) => t.id === inst.tplId);
      if (!tpl) return;
      const p = missionProgress(state, inst, tpl);
      html += missionCard(tpl.name, p, inst, `data-action="collect-daily" data-index="${i}"`,
        !inst.done && !state.missions.daily.rerolled.includes(i) ? `<button class="btn small ghost" data-action="reroll-daily" data-index="${i}">🔄 Trocar</button>` : '');
    });

    html += '<div class="section-title">Objetivos semanais</div>';
    state.missions.weekly.list.forEach((inst, i) => {
      const tpl = WEEKLY_TEMPLATES.find((t) => t.id === inst.tplId);
      if (!tpl) return;
      const p = missionProgress(state, inst, tpl);
      html += missionCard(tpl.name, p, inst, `data-action="collect-weekly" data-index="${i}"`);
    });
  }

  if (sub === 'milestones') {
    const done = state.missions.milestonesDone;
    const list = [...MILESTONE_MISSIONS].sort((a, b) => (done.includes(a.id) ? 1 : 0) - (done.includes(b.id) ? 1 : 0));
    for (const m of list) {
      const isDone = done.includes(m.id);
      const r = isDone ? null : evaluateCheck(state, m.check);
      html += `<div class="card mission-card" style="${isDone ? 'opacity:0.55' : ''}">
        <div class="m-head"><div><h3>${isDone ? '✅' : '🏁'} ${esc(m.name)}</h3>
        <div class="dim">${rewardText(m.reward)}</div></div>
        ${!isDone && r ? `<span class="dim">${fmtNumber(r.current)}/${fmtNumber(r.target)}</span>` : ''}</div>
        ${!isDone && r ? progressBar(r.current, r.target) : ''}
      </div>`;
    }
  }

  if (sub === 'achievements') {
    const doneCount = state.achievementsDone.length;
    html += `<div class="card"><div class="row between"><span class="muted">Progresso</span><strong>${doneCount}/${ACHIEVEMENTS.length}</strong></div>${progressBar(doneCount, ACHIEVEMENTS.length, 'green')}</div>`;
    for (const cat of ACHIEVEMENT_CATEGORIES) {
      html += `<div class="section-title">${esc(cat)}</div>`;
      for (const a of ACHIEVEMENTS.filter((x) => x.cat === cat)) {
        const unlocked = state.achievementsDone.includes(a.id);
        html += `<div class="card achievement-card ${unlocked ? 'unlocked' : ''}">
          <div class="a-ico">${unlocked ? '🏆' : '🔒'}</div>
          <div><h3>${esc(a.name)}</h3><div class="dim">${esc(a.desc)}${a.reward.rep ? ` · +${a.reward.rep} REP` : ''}${a.reward.pl ? ` · +${a.reward.pl} PL` : ''}</div></div>
        </div>`;
      }
    }
  }

  el.innerHTML = html;
}

function missionCard(name, p, inst, collectAttrs, extraBtns = '') {
  return `<div class="card mission-card ${inst.done && !inst.collected ? 'done-uncollected' : ''}" style="${inst.collected ? 'opacity:0.55' : ''}">
    <div class="m-head">
      <div><h3>${inst.collected ? '✅' : inst.done ? '🎁' : '◻️'} ${esc(name)}</h3></div>
      <div class="row">
        ${extraBtns}
        ${inst.done && !inst.collected ? `<button class="btn small success" ${collectAttrs}>Coletar</button>` : `<span class="dim">${fmtNumber(Math.min(p.current, p.target))}/${fmtNumber(p.target)}</span>`}
      </div>
    </div>
    ${!inst.done ? progressBar(p.current, p.target) : ''}
  </div>`;
}

function rewardText(r) {
  const parts = [];
  if (r.money) parts.push(fmtMoney(r.money));
  if (r.moneySeconds) parts.push('dinheiro');
  if (r.rep) parts.push(`${r.rep} REP`);
  if (r.pp) parts.push(`${r.pp} PP`);
  if (r.pl) parts.push(`${r.pl} PL`);
  return parts.join(' + ') || 'selo';
}

// ————— Tela MAIS —————

function renderMore(el, state) {
  const tiles = [
    ['campaign', '📖', 'Campanha'],
    ['projects', '🗂️', 'Projetos'],
    ['challenges', '🕵️‍♀️', 'Desafios'],
    ['collection', '🖼️', 'Coleção'],
    ['prestige', '🏆', 'Prestígio'],
    ['store', '🛒', 'Loja'],
    ['stats', '📊', 'Estatísticas'],
    ['settings', '⚙️', 'Configurações'],
  ];
  let html = `<div class="more-grid">${tiles.map(([id, ico, label]) =>
    `<button class="more-tile" data-action="nav" data-screen="${id}"><span class="ico">${ico}</span>${label}</button>`).join('')}</div>`;

  html += `<div class="section-title">Ajuda rápida</div>
  <div class="card"><h3>💡 Glossário</h3>
    <div class="small muted" style="margin-top:6px">
      <p><strong>$</strong> — Dinheiro do Escritório: compra upgrades, salas, contratos e gestores.</p>
      <p><strong>REP</strong> — Reputação: libera categorias de empresas e gestores. Não é gasta.</p>
      <p><strong>PP</strong> — Pontos de Pesquisa: compram tecnologias na Sede.</p>
      <p><strong>PL</strong> — Pontos de Legado: ganhos no Prestígio, compram melhorias permanentes.</p>
    </div>
  </div>
  <div class="card"><h3>🧮 Fórmulas simplificadas</h3>
    <div class="small muted" style="margin-top:6px">
      <p>Renda da sala = base × inquilino × (1 + 10% × níveis) × satisfação × bônus do andar/gestor/sinergia.</p>
      <p>Satisfação (50–100): multiplica a renda de 1,00× a 1,30×.</p>
      <p>Toque em Trabalhar = 8% da renda/s (mínimo $1).</p>
    </div>
  </div>`;
  el.innerHTML = html;
}

// ————— Tela CAMPANHA —————

function renderCampaign(el, state) {
  let html = '';
  const rv = state.campaign.rival;
  if (rv) {
    const goal = RIVAL_GOALS.find((g) => g.id === rv.goalId);
    if (goal) {
      const r = rv.accepted ? evaluateCheck(state, { type: goal.type, value: goal.value }, rv.baseline) : null;
      html += `<div class="card" style="border-color:var(--red)">
        <h3>😈 Desafio do Augusto: ${esc(goal.name)}</h3>
        <div class="muted small">${esc(goal.desc)}</div>
        ${rv.accepted ? `
          <div class="row between small" style="margin-top:6px"><span class="muted">Prazo</span><span class="tag red" data-countdown="${rv.deadline}">${fmtClock(rv.deadline - Date.now())}</span></div>
          ${r ? progressBar(r.current, r.target, 'red') : ''}`
      : `<div class="row" style="margin-top:8px">
          <button class="btn primary" data-action="accept-rival">Aceitar</button>
          <button class="btn ghost" data-action="decline-rival">Recusar</button>
        </div>`}
      </div>`;
    }
  }

  for (const ch of CHAPTERS) {
    const isDone = state.campaign.completedChapters >= ch.n;
    const isCurrent = state.campaign.chapter === ch.n && !isDone;
    const isLocked = ch.n > state.campaign.chapter;
    if (isLocked && ch.n > state.campaign.chapter + 1) continue;
    html += `<div class="card" style="${isDone ? 'opacity:0.6' : ''} ${isCurrent ? 'border-color:var(--accent)' : ''}">
      <div class="row between">
        <h3>${isDone ? '✅' : isCurrent ? '▶️' : '🔒'} Cap. ${ch.n} — ${esc(ch.title)}</h3>
        ${isCurrent ? `<button class="btn small ghost" data-action="chapter-dialogue" data-n="${ch.n}">💬 Diálogos</button>` : ''}
      </div>
      ${isCurrent ? ch.objectives.map((o) => {
        const done = state.campaign.objectivesDone.includes(o.id);
        const r = done ? null : evaluateCheck(state, o.check);
        return `<div class="objective-row">
          <span class="check">${done ? '✅' : '◻️'}</span>
          <span style="flex:1">${esc(o.name)}</span>
          ${!done && r ? `<span class="dim">${fmtNumber(Math.min(r.current, r.target))}/${fmtNumber(r.target)}</span>` : ''}
        </div>`;
      }).join('') : ''}
      ${isCurrent && ch.reward.unlocks ? `<div class="dim" style="margin-top:6px">🔓 Recompensa: ${esc(ch.reward.unlocks)}</div>` : ''}
    </div>`;
  }

  if (state.campaign.rivalHistory.length) {
    html += '<div class="section-title">Histórico do rival</div>';
    html += `<div class="card">${state.campaign.rivalHistory.slice(-8).map((h) => {
      const g = RIVAL_GOALS.find((x) => x.id === h.goalId);
      return `<div class="row between small"><span class="muted">${esc(g?.name || h.goalId)}</span><span class="${h.result === 'vitória' ? 'gain' : 'muted'}">${h.result}</span></div>`;
    }).join('')}</div>`;
  }

  el.innerHTML = html;
}

// ————— Tela PROJETOS —————

function renderProjects(el, state) {
  const snap = snapFor(state);
  if (!projectsUnlocked(state)) {
    el.innerHTML = `<div class="empty-state"><span class="ico">🗂️</span>
      <h3>Projetos empresariais</h3>
      <p class="muted" style="margin-top:6px">Liberados no capítulo 3 da campanha — "Nome no Mercado".</p>
      <button class="btn primary" style="margin-top:12px" data-action="nav" data-screen="campaign">Ver campanha</button></div>`;
    return;
  }
  const slots = projectSlots(state);
  const ready = readyProjects(state);
  let html = `<div class="card"><div class="row between">
    <span class="muted">Espaços de projeto</span><strong>${state.projects.active.length}/${slots}</strong></div>
    ${ready.length ? `<button class="btn success block" style="margin-top:8px" data-action="collect-all-projects">🎁 Coletar todos (${ready.length})</button>` : ''}
  </div>`;

  if (state.projects.active.length) {
    html += '<div class="section-title">Em andamento</div>';
    for (const active of state.projects.active) {
      const p = projectById(active.id);
      const done = Date.now() >= active.endsAt;
      html += `<div class="card">
        <div class="row between"><h3>${esc(p.name)}</h3>
        ${done ? `<button class="btn small success" data-action="collect-project" data-project="${p.id}">Coletar</button>`
      : `<span class="tag blue" data-countdown="${active.endsAt}">${fmtClock(active.endsAt - Date.now())}</span>`}</div>
        <div class="bar blue" style="margin-top:7px"><span data-progress-until="${active.endsAt}" data-progress-from="${active.startedAt}" style="width:${pct(Date.now() - active.startedAt, active.endsAt - active.startedAt)}%"></span></div>
        <div class="row" style="margin-top:7px">
          ${!done && (state.inventory.instantProject || 0) > 0 ? `<button class="btn small" data-action="instant-project" data-project="${p.id}">⚡ Concluir agora (${state.inventory.instantProject})</button>` : ''}
          ${!done ? `<button class="btn small ghost" data-action="cancel-project" data-project="${p.id}">Cancelar</button>` : ''}
        </div>
      </div>`;
    }
  }

  html += '<div class="section-title">Disponíveis</div>';
  for (const p of PROJECTS) {
    if (state.projects.active.some((a) => a.id === p.id)) continue;
    if (!p.repeatable && state.projects.history.some((h) => h.id === p.id)) continue;
    const reqOk = projectRequirementMet(state, p);
    const durMs = projectDurationMs(state, p);
    const chance = Math.min(0.95, p.excellentChance + (snap.mods.excellentChanceBonus || 0));
    html += `<div class="card" style="${reqOk ? '' : 'opacity:0.7'}">
      <div class="row between">
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="dim">${esc(p.desc)}</div>
          <div class="dim">⏱ ${fmtDuration(durMs / 1000)} · 🎁 ${rewardText(p.reward)}${chance > 0 ? ` · ⭐ ${Math.round(chance * 100)}% excelente` : ''}${p.costSeconds ? ` · custo ${fmtMoney((snap.totalPerSec || 1) * p.costSeconds)}` : ''}</div>
        </div>
        <button class="btn ${reqOk && state.projects.active.length < slots ? 'primary' : ''}" data-action="start-project" data-project="${p.id}" ${reqOk ? '' : 'disabled'}>Iniciar</button>
      </div>
      ${reqOk ? '' : `<div class="loss small" style="margin-top:5px">🔒 ${projectReqText(p)}</div>`}
    </div>`;
  }
  el.innerHTML = html;
}

function projectReqText(p) {
  const r = p.req || {};
  if (r.activeSpecialty) return `Requer empresa de ${SPECIALTIES[r.activeSpecialty]?.name} ativa`;
  if (r.activeCategorySpecialty) return `Requer ${SPECIALTIES[r.activeCategorySpecialty.specialty]?.name} categoria ${r.activeCategorySpecialty.cat}+`;
  if (r.activeCategoryCount) return `Requer ${r.activeCategoryCount.count} empresas categoria ${r.activeCategoryCount.cat}+`;
  if (r.tech) return `Requer sala com Tecnologia ${r.tech}`;
  if (r.facility) return `Requer ${facilityById(r.facility.id)?.name} nv. ${r.facility.level}`;
  if (r.propertyUnlocked) return `Requer ${propertyById(r.propertyUnlocked)?.name}`;
  if (r.propertiesUnlocked) return `Requer ${r.propertiesUnlocked} propriedades`;
  if (r.roomUnlocked) return `Requer ${officeById(r.roomUnlocked)?.name}`;
  if (r.chapterDone) return `Requer capítulo ${r.chapterDone}`;
  return 'Requisitos não atendidos';
}

// ————— Tela DESAFIOS —————

function renderChallenges(el, state) {
  let html = `<div class="card"><h3>🕵️‍♀️ Auditoria de Vera</h3>
    <div class="muted small">Partidas curtas com regras modificadas. O save principal continua intocado — e rodando.</div></div>`;
  if (game.challengeRun && !game.challengeRun.finished) {
    html += `<div class="card" style="border-color:var(--purple)">
      <h3>Cenário em andamento: ${esc(challengeById(game.challengeRun.id).name)}</h3>
      <button class="btn primary block" style="margin-top:8px" data-action="nav" data-screen="building">Ir para o cenário</button>
    </div>`;
  }
  for (const ch of CHALLENGES) {
    const medals = state.challenges.medals[ch.id] || 0;
    html += `<div class="card challenge-card">
      <div class="row between">
        <div>
          <h3>${esc(ch.name)}</h3>
          <div class="dim">${esc(ch.desc)}</div>
          <div class="dim">⏱ ${ch.minutes} min · Modificadores: ${challengeModText(ch)}</div>
          <div class="medals">${'🥇'.repeat(medals)}${'⚪'.repeat(3 - medals)}</div>
        </div>
        <button class="btn ${game.challengeRun ? '' : 'primary'}" data-action="start-challenge" data-challenge="${ch.id}" ${game.challengeRun && !game.challengeRun.finished ? 'disabled' : ''}>Iniciar</button>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

function challengeModText(ch) {
  const m = ch.modifiers;
  const parts = [];
  if (m.startMoney !== undefined) parts.push(`saldo inicial ${fmtMoney(m.startMoney)}`);
  if (m.onlySpecialty) parts.push(`apenas ${SPECIALTIES[m.onlySpecialty]?.name}`);
  if (m.techCostMult) parts.push(`Tecnologia ${m.techCostMult}× mais cara`);
  if (m.satisfactionWeight) parts.push('satisfação decisiva');
  if (m.noManagers) parts.push('sem gestores');
  if (m.eventEveryMs) parts.push(`eventos a cada ${Math.round(m.eventEveryMs / 60000)} min`);
  if (m.marketShuffleMs) parts.push('mercado instável');
  if (m.conditionStart !== undefined) parts.push(`condição inicial ${m.conditionStart}`);
  if (m.incomeMult) parts.push(`renda ×${m.incomeMult}`);
  if (m.maxUpgrades) parts.push(`máx. ${m.maxUpgrades} upgrades`);
  return parts.join(' · ') || 'nenhum';
}

// ————— Tela COLEÇÃO —————

function renderCollection(el, state) {
  const owned = state.collection.owned.length;
  const total = COLLECTION_ITEMS.filter((c) => c.id !== 'facade_founder').length;
  const cap = game.snapshot?.mods?.collectionCap || 0.05;
  let html = `<div class="card">
    <div class="row between"><span class="muted">Coleção</span><strong>${owned}/${total}</strong></div>
    ${progressBar(owned, total, 'green')}
    <div class="dim" style="margin-top:5px">Equipe um item por categoria em cada propriedade (bônus total até ${Math.round(cap * 100)}%). Propriedade atual: <strong>${esc(propertyById(state.currentProperty).name)}</strong></div>
  </div>`;
  for (const cat of COLLECTION_CATEGORIES) {
    html += `<div class="section-title">${cat.icon} ${esc(cat.name)}</div><div class="collection-grid">`;
    for (const item of COLLECTION_ITEMS.filter((c) => c.cat === cat.id)) {
      const has = state.collection.owned.includes(item.id);
      const equipped = state.collection.equipped[state.currentProperty]?.[cat.id] === item.id;
      html += `<div class="collection-item ${has ? '' : 'locked'} ${equipped ? 'equipped' : ''}">
        <div class="ico">${cat.icon}</div>
        <div class="small"><strong>${esc(item.name)}</strong></div>
        <div class="dim">${esc(item.source)}</div>
        ${item.bonus ? `<div class="dim">+${(item.bonus * 100).toFixed(1).replace('.', ',')}% renda</div>` : ''}
        ${has ? `<button class="btn small ${equipped ? '' : 'primary'}" style="margin-top:6px" data-action="equip-collection" data-item="${item.id}" data-cat="${cat.id}">${equipped ? 'Remover' : 'Equipar'}</button>` : '<div class="tag" style="margin-top:6px">🔒</div>'}
      </div>`;
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

// ————— Tela ESTATÍSTICAS (PRD §21.8) —————

function renderStats(el, state) {
  const sub = ui.sub.stats || 'cycle';
  const s = sub === 'cycle' ? state.statistics : state.lifetimeStatistics;
  const tiles = [
    ['⏱ Tempo jogado', fmtDuration(s.playSeconds)],
    ['💰 Dinheiro ganho', fmtMoney(s.moneyEarned)],
    ['💸 Dinheiro gasto', fmtMoney(s.moneySpent)],
    ['🔨 Upgrades comprados', fmtInt(s.upgradesBought)],
    ['📋 Contratos assinados', fmtInt(s.contractsSigned)],
    ['📈 Maior renda/s', fmtRate(s.maxIncomeRate)],
    ['😊 Satisfação média', `${Math.round(game.snapshot?.avgSatisfaction || 50)}`],
    ['⚡ Eventos concluídos', fmtInt(s.eventsCompleted)],
    ['🎯 Missões concluídas', fmtInt(s.missionsCompleted)],
    ['📺 Anúncios simulados', fmtInt(s.adsWatched)],
    ['🛒 Compras simuladas', fmtInt(s.simulatedPurchases)],
    ['🌙 Tempo offline pago', fmtDuration(s.offlineSecondsRewarded)],
    ['🗂️ Projetos concluídos', fmtInt(s.projectsCompleted)],
    ['⭐ REP ganha', fmtInt(s.repEarned)],
    ['🏆 Prestígios', fmtInt(state.prestigeCount)],
    ['🏅 PL ganhos', fmtInt(state.prestigeHistory.reduce((a, h) => a + h.pl, 0))],
  ];
  el.innerHTML = `
    <div class="subtabs">
      <button class="subtab ${sub === 'cycle' ? 'active' : ''}" data-action="stats-tab" data-tab="cycle">Ciclo atual (${state.currentCycle}º)</button>
      <button class="subtab ${sub === 'lifetime' ? 'active' : ''}" data-action="stats-tab" data-tab="lifetime">Vitalícias</button>
    </div>
    <div class="stats-grid">${tiles.map(([k, v]) => `<div class="stat-tile"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>`;
}

// ————— Tela PRESTÍGIO (PRD §21.9) —————

function renderPrestige(el, state) {
  const preview = prestigePreview(state);
  const allOk = preview.requirements.every((r) => r.ok);
  let html = `<div class="card">
    <h3>🏆 Prestígio — vender o portfólio</h3>
    <div class="muted small" style="margin:6px 0">Venda tudo, receba Pontos de Legado e recomece um ciclo mais forte. Conquistas, Legado e coleção permanecem.</div>
    ${preview.requirements.map((r) => `<div class="prestige-req"><span>${r.ok ? '<span class="ok">✓</span>' : '<span class="no">○</span>'} ${esc(r.label)}</span><span class="dim">${esc(String(r.value))}</span></div>`).join('')}
    <div class="row between" style="margin-top:10px"><span class="muted">Valor do empreendimento</span><strong class="money">${fmtMoney(preview.value)}</strong></div>
    <div class="row between"><span class="muted">Pontos de Legado previstos</span><strong class="gain">+${fmtInt(preview.legacyPoints)} PL</strong></div>
    <button class="btn ${allOk ? 'danger' : ''} block" style="margin-top:10px" data-action="open-prestige-confirm" ${allOk ? '' : 'disabled'}>💼 Vender o empreendimento</button>
  </div>`;

  // Modo Império (PRD §38.3)
  if (state.empireMode.active) {
    const goalDef = state.empireMode.councilGoal ? window.__councilGoal?.(state.empireMode.councilGoal.goalId) : null;
    html += `<div class="card" style="border-color:var(--accent)">
      <h3>👑 Modo Império ativo</h3>
      ${state.empireMode.councilGoal ? `<div class="small muted" style="margin-top:5px">Meta do Conselho: <strong>${esc(goalDef?.name || '')}</strong> (+${goalDef?.reward.pl || 0} PL)</div>` : ''}
      ${state.empireMode.bestCycleSeconds ? `<div class="dim">Melhor ciclo: ${fmtDuration(state.empireMode.bestCycleSeconds)}</div>` : ''}
    </div>`;
  } else if (empireAvailable(state)) {
    html += `<div class="card" style="border-color:var(--accent)">
      <h3>👑 Modo Império disponível!</h3>
      <div class="muted small">Metas de Conselho renováveis, progressão infinita e recordes de ciclo.</div>
      <button class="btn primary block" style="margin-top:8px" data-action="activate-empire">Ativar Modo Império</button>
    </div>`;
  }

  html += `<div class="section-title">Melhorias permanentes (${fmtInt(state.legacyPoints)} PL disponíveis)</div>`;
  for (const l of LEGACY_UPGRADES) {
    const lvl = state.legacyUpgrades[l.id] || 0;
    const maxed = lvl >= l.maxLevel;
    const cost = legacyLevelCost(l, lvl);
    html += `<div class="card legacy-card ${maxed ? 'maxed' : ''}">
      <div class="row between">
        <div>
          <h3>${esc(l.name)} <span class="tag ${maxed ? 'gold' : 'blue'}">nv. ${lvl}/${l.maxLevel}</span></h3>
          <div class="dim">${esc(l.desc)}</div>
        </div>
        ${maxed ? '<span class="tag gold">MÁX</span>' : `<button class="btn small ${state.legacyPoints >= cost ? 'primary' : ''}" data-action="buy-legacy" data-legacy="${l.id}">🏆 ${cost} PL</button>`}
      </div>
    </div>`;
  }

  if (state.prestigeHistory.length) {
    html += '<div class="section-title">Histórico de Prestígios</div><div class="card">';
    html += state.prestigeHistory.slice(-10).reverse().map((h) => `
      <div class="row between small"><span class="muted">Ciclo ${h.cycle} · ${new Date(h.at).toLocaleDateString('pt-BR')}</span>
      <span>${fmtMoney(h.value)} → <strong class="gain">+${h.pl} PL</strong></span></div>`).join('');
    html += '</div>';
  }
  el.innerHTML = html;
}

// ————— Tela LOJA (PRD §21.7) —————

function renderStore(el, state) {
  const snap = snapFor(state);
  const investorOk = investorReady(state);
  let html = '<div class="section-title">Anúncios recompensados (simulados)</div>';
  const coffeeLeft = Math.max(0, (state.boostExpiresAt || 0) - Date.now());
  html += `<div class="card">
    <div class="row between">
      <div><h3>☕ Café Executivo</h3><div class="dim">Renda 2× por 4h (acumula até 12h)${coffeeLeft > 0 ? ` · restam <span data-countdown="${state.boostExpiresAt}">${fmtClock(coffeeLeft)}</span>` : ''}</div></div>
      <button class="btn ad-btn" data-action="ad-coffee" ${coffeeBoostAvailable(state) ? '' : 'disabled'}>📺 Assistir</button>
    </div>
  </div>
  <div class="card">
    <div class="row between">
      <div><h3>😇 Investidor Anjo</h3><div class="dim">${investorOk ? 'Recompensa: 30 minutos de renda!' : `Volta em <span data-countdown="${state.investorAvailableAt}">${fmtClock(Math.max(0, (state.investorAvailableAt || 0) - Date.now()))}</span>`}</div></div>
      <button class="btn ad-btn" data-action="ad-investor" ${investorOk ? '' : 'disabled'}>📺 Assistir</button>
    </div>
  </div>
  <div class="card">
    <div class="row between">
      <div><h3>🔨 Reforma Expressa</h3><div class="dim">-20% nos próximos 10 upgrades (até 30)${state.adReduction.upgradesLeft ? ` · restam ${state.adReduction.upgradesLeft}` : ''}</div></div>
      <button class="btn ad-btn" data-action="ad-renovation" ${state.adReduction.upgradesLeft >= BALANCE.ads.renovationMaxUpgrades ? 'disabled' : ''}>📺 Assistir</button>
    </div>
  </div>
  <p class="mock-note">Anúncios simulados: nenhuma propaganda real é exibida e nada é cobrado.</p>`;

  html += '<div class="section-title">Inventário</div>';
  const inv = [
    ['skip4h', '⏩ Salto de 4 horas'],
    ['skip24h', '⏭️ Salto de 24 horas'],
    ['instantProject', '⚡ Projeto instantâneo (use na tela Projetos)'],
  ];
  const invRows = inv.filter(([k]) => (state.inventory[k] || 0) > 0);
  html += invRows.length ? invRows.map(([k, label]) => `
    <div class="card"><div class="row between">
      <span>${label} <span class="tag blue">×${state.inventory[k]}</span></span>
      ${k !== 'instantProject' ? `<button class="btn small primary" data-action="use-item" data-item="${k}">Usar</button>` : ''}
    </div></div>`).join('')
    : '<div class="card"><div class="dim">Inventário vazio. Os itens comprados aparecem aqui.</div></div>';

  html += '<div class="section-title">Ofertas simuladas</div>';
  for (const p of STORE_PRODUCTS) {
    const available = productAvailable(state, p);
    html += `<div class="card store-card" style="${available ? '' : 'opacity:0.55'}">
      <div class="row between">
        <div><h3>${p.icon} ${esc(p.name)} ${p.type === 'unique' ? '<span class="tag">ÚNICO</span>' : ''}</h3>
        <div class="dim">${esc(p.desc)}</div></div>
        ${available ? `<button class="btn" data-action="store-buy" data-product="${p.id}"><span class="price-pill">${p.price}</span></button>` : '<span class="tag green">ADQUIRIDO</span>'}
      </div>
    </div>`;
  }
  html += '<p class="mock-note">Simulação da versão local — nenhum valor será cobrado.</p>';
  el.innerHTML = html;
}

// ————— Tela CONFIGURAÇÕES —————

function renderSettings(el, state) {
  const s = state.settings;
  const toggle = (key, label, desc, value) => `
    <div class="card"><div class="row between">
      <div><h3>${label}</h3><div class="dim">${desc}</div></div>
      <button class="btn small ${value ? 'success' : ''}" data-action="toggle-setting" data-key="${key}" role="switch" aria-checked="${value}">${value ? 'Ligado' : 'Desligado'}</button>
    </div></div>`;

  let html = '<div class="section-title">Preferências</div>';
  html += toggle('sound', '🔊 Efeitos sonoros', 'Sons de compra, missão e celebração', s.sound);
  html += toggle('music', '🎵 Música ambiente', 'Trilha suave, diferente em cada propriedade', s.music);
  html += toggle('haptics', '📳 Vibração', 'Resposta tátil ao trabalhar e comprar (celular)', s.haptics);
  html += toggle('reducedMotion', '🎬 Reduzir animações', 'Modo econômico de animação', s.reducedMotion);
  const automation = game.snapshot?.mods?.automation;
  if (automation) {
    html += toggle('autoBuy', '🤖 Compra automática de upgrades', 'Compra upgrades acessíveis respeitando a reserva', s.autoBuy);
    html += toggle('autoCollectMissions', '🤖 Coleta automática de missões', 'Coleta diárias e semanais prontas', s.autoCollectMissions);
    html += `<div class="card"><h3>💰 Reserva mínima de saldo</h3>
      <div class="dim">Automações nunca gastam abaixo deste valor.</div>
      <input class="confirm-input" style="letter-spacing:0;text-align:left" type="number" min="0" value="${s.reserveMoney || 0}" data-input="reserve-money">
    </div>`;
  }

  html += '<div class="section-title">Save</div>';
  html += `<div class="grid-2">
    <button class="btn" data-action="export-save">📤 Exportar save</button>
    <button class="btn" data-action="import-save">📥 Importar save</button>
    <button class="btn" data-action="restore-backup">♻️ Restaurar backup</button>
    <button class="btn" data-action="restore-checkpoint">⏪ Checkpoint de Prestígio</button>
  </div>
  <div class="card" style="margin-top:10px">
    <div class="dim">Todos os dados ficam apenas neste dispositivo. Nenhuma informação pessoal é coletada ou enviada.</div>
  </div>
  <button class="btn block" style="margin-top:4px" data-action="reset-tutorial">🎓 Reiniciar tutorial</button>
  <button class="btn danger block" style="margin-top:8px" data-action="reset-game">🗑️ Apagar todo o progresso</button>`;

  html += `<div class="section-title">Sobre</div>
  <div class="card"><div class="dim">Idle Office Simulator v1.0 · Save V3 · PWA offline-first.<br>Jogo completo e gratuito — anúncios e compras são simulados.</div></div>`;
  el.innerHTML = html;
  el.querySelector('[data-input="reserve-money"]')?.addEventListener('change', (e) => {
    state.settings.reserveMoney = Math.max(0, Number(e.target.value) || 0);
  });
}

// ————— Registro de telas —————

export const SCREENS = {
  building: renderBuilding,
  map: renderMap,
  contracts: renderContracts,
  team: renderTeam,
  hq: renderHq,
  goals: renderGoals,
  more: renderMore,
  campaign: renderCampaign,
  projects: renderProjects,
  challenges: renderChallenges,
  collection: renderCollection,
  stats: renderStats,
  prestige: renderPrestige,
  store: renderStore,
  settings: renderSettings,
};

export const SCREEN_META = {
  building: 'Prédio', map: 'Mapa', contracts: 'Contratos', team: 'Equipe', hq: 'Sede',
  goals: 'Metas', more: 'Mais', campaign: 'Campanha', projects: 'Projetos', challenges: 'Desafios',
  collection: 'Coleção', stats: 'Estatísticas', prestige: 'Prestígio', store: 'Loja', settings: 'Configurações',
};

export function renderScreen(screenId, el, state) {
  const fn = SCREENS[screenId] || SCREENS.building;
  try {
    fn(el, state);
  } catch (err) {
    console.error(`Erro ao renderizar ${screenId}:`, err);
    el.innerHTML = `<div class="empty-state"><span class="ico">⚠️</span>Algo deu errado nesta tela. <button class="btn" data-action="nav" data-screen="building">Voltar ao Prédio</button></div>`;
  }
}
