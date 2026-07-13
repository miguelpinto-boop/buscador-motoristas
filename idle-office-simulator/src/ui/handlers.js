// Despacho central de ações da UI — um único listener delegado (ui.js).

import { game, activeState, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { fmtMoney, fmtRate } from '../core/format.js';
import {
  tapWork, buyUpgrade, unlockRoom, unlockFloor, unlockProperty, switchProperty,
  signContract, buildFacility, upgradeFacility, hireManager, trainManager,
  assignManager, unassignManager, undoAssignment, upgradeHqDepartment, buyResearch,
  buyLegacyUpgrade, doMaintenance, resolveTenantRequest,
} from '../systems/actions.js';
import { rerollDaily, collectDaily, collectWeekly, claimDailyLogin, acceptRival, declineRival } from '../systems/progression.js';
import { startProject, cancelProject, collectProject, collectAllProjects, finishProjectInstantly } from '../systems/projects.js';
import { doPrestige, prestigePreview, activateEmpireMode } from '../systems/prestige.js';
import { resolveEvent, specialMet } from '../systems/events.js';
import { startChallenge, abandonChallenge } from '../systems/challenges.js';
import {
  playMockAd, applyCoffeeBoost, applyInvestor, applyRenovationDiscount,
  simulatePurchase, useTimeSkip, coffeeBoostAvailable, investorReady,
} from '../systems/monetization.js';
import { exportSave, previewImport, saveGame, restoreBackup, restorePrestigeCheckpoint, eraseAll } from '../persistence/save.js';
import { STORE_PRODUCTS } from '../data/prestige.js';
import { CHAPTERS, CHARACTERS } from '../data/campaign.js';
import { FLOORS, floorById, propertyById } from '../data/buildings.js';
import { managerById } from '../data/managers.js';
import { COUNCIL_GOALS } from '../data/extras.js';
import { ui, navigate, redraw, openModal, closeModal, closeAllModals, floatNumber, sounds, haptic, collectOffline, dialogueLine } from './ui.js';

// Globais usados por templates do ui.js/screens.js
window.__characters = CHARACTERS;
window.__specialMet = specialMet;
window.__councilGoal = (id) => COUNCIL_GOALS.find((g) => g.id === id);

const toast = (type, text) => bus.emit('toast', { type, text });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Modal de anúncio simulado: roda o mock e entrega a recompensa uma única vez. */
function watchAd(onSuccess) {
  const modal = openModal(`
    <h2>📺 Anúncio simulado</h2>
    <div class="card" style="text-align:center">
      <div id="ad-status" style="font-size:2rem;padding:18px">⏳</div>
      <div class="dim" id="ad-status-text">Carregando…</div>
    </div>
    <p class="mock-note">Simulação — nenhuma propaganda real é exibida.</p>
  `, { dismissible: false });
  const started = playMockAd((status) => {
    const ico = modal.querySelector('#ad-status');
    const txt = modal.querySelector('#ad-status-text');
    if (!ico) return;
    if (status === 'loading') { ico.textContent = '⏳'; txt.textContent = 'Carregando…'; }
    if (status === 'playing') { ico.textContent = '🎬'; txt.textContent = 'Reproduzindo anúncio simulado…'; }
    if (status === 'success') { ico.textContent = '✅'; txt.textContent = 'Recompensa liberada!'; }
    if (status === 'error') { ico.textContent = '❌'; txt.textContent = 'Falha no anúncio simulado.'; }
    if (status === 'idle') { closeModal(); redraw(); }
  }, onSuccess);
  if (!started) closeModal();
}

export function handleAction(action, data, el, event) {
  const state = activeState();
  const main = game.state;

  switch (action) {
    // ————— Navegação —————
    case 'nav': navigate(data.screen); break;
    case 'goals-tab': ui.sub.goals = data.tab; redraw(); break;
    case 'stats-tab': ui.sub.stats = data.tab; redraw(); break;
    case 'contract-filter': ui.contractFilter = data.filter; redraw(); break;
    case 'goto-contracts': ui.contractRoom = data.room; navigate('contracts'); break;
    case 'set-buymode': ui.buyMode = data.mode === 'max' ? 'max' : Number(data.mode); redraw(); break;

    // ————— Prédio —————
    case 'tap-work': {
      const gain = tapWork(state);
      sounds.tap();
      haptic(10);
      const x = event?.clientX ?? window.innerWidth / 2;
      const y = event?.clientY ?? 200;
      floatNumber(x, y, `+${fmtMoney(gain)}`);
      const moneyEl = document.querySelector('[data-hud="money"]');
      if (moneyEl) moneyEl.textContent = fmtMoney(state.balance);
      break;
    }
    case 'buy-upgrade': {
      const ok = buyUpgrade(state, data.room, data.cat, ui.buyMode === 'max' ? 'max' : Number(ui.buyMode));
      if (ok) { sounds.buy(); haptic(15); }
      break;
    }
    case 'unlock-room': unlockRoom(state, data.room); break;
    case 'unlock-floor': unlockFloor(state, data.floor); break;
    case 'unlock-property': unlockProperty(state, data.prop); break;
    case 'switch-property': switchProperty(state, data.prop); navigate('building'); break;
    case 'maintain': doMaintenance(state, data.prop); break;
    case 'build-facility': buildFacility(state, data.fac); break;
    case 'upgrade-facility': { if (upgradeFacility(state, data.fac)) sounds.buy(); break; }

    // ————— Contratos —————
    case 'sign-contract': {
      if (data.worse) {
        openModal(`
          <h2>⚠️ Atenção</h2>
          <p class="muted">Este contrato <strong class="loss">reduz</strong> a renda atual da sala. Deseja assinar mesmo assim?</p>
          <div class="grid-2" style="margin-top:12px">
            <button class="btn" data-modal-close>Cancelar</button>
            <button class="btn danger" data-action="sign-contract-confirm" data-room="${data.room}" data-company="${data.company}">Assinar</button>
          </div>`);
      } else {
        signContract(state, data.room, data.company);
      }
      break;
    }
    case 'sign-contract-confirm': closeModal(); signContract(state, data.room, data.company); break;

    // ————— Equipe —————
    case 'hire-manager': hireManager(state, data.mgr); break;
    case 'train-manager': trainManager(state, data.mgr); break;
    case 'unassign-manager': unassignManager(state, data.floor); break;
    case 'undo-assign': undoAssignment(state); break;
    case 'assign-manager': openAssignModal(state, data.mgr); break;
    case 'assign-floor': openFloorAssignModal(state, data.floor); break;
    case 'assign-confirm': closeModal(); assignManager(state, data.mgr, data.floor); break;

    // ————— Sede —————
    case 'hq-upgrade': upgradeHqDepartment(state, data.dept); break;
    case 'buy-research': buyResearch(state, data.node); break;

    // ————— Metas —————
    case 'collect-daily': collectDaily(state, Number(data.index)); break;
    case 'collect-weekly': collectWeekly(state, Number(data.index)); break;
    case 'reroll-daily': rerollDaily(state, Number(data.index)); break;
    case 'claim-login': claimDailyLogin(state); break;

    // ————— Campanha / rival —————
    case 'accept-rival': acceptRival(main); break;
    case 'decline-rival': declineRival(main); break;
    case 'chapter-dialogue': {
      const ch = CHAPTERS.find((c) => c.n === Number(data.n));
      if (ch) {
        openModal(`
          <h2>📖 Capítulo ${ch.n} — ${esc(ch.title)}</h2>
          ${ch.intro.map((d) => dialogueLine(d)).join('')}
          <button class="btn primary block" data-modal-close>Fechar</button>`);
      }
      break;
    }

    // ————— Projetos —————
    case 'start-project': startProject(state, data.project); break;
    case 'cancel-project': cancelProject(state, data.project); break;
    case 'collect-project': collectProject(state, data.project); break;
    case 'collect-all-projects': collectAllProjects(state); break;
    case 'instant-project': finishProjectInstantly(state, data.project); break;

    // ————— Desafios —————
    case 'start-challenge': {
      if (startChallenge(data.challenge)) navigate('building');
      break;
    }
    case 'abandon-challenge': abandonChallenge(); navigate('challenges'); break;

    // ————— Coleção —————
    case 'equip-collection': {
      const prop = state.currentProperty;
      const equipped = state.collection.equipped[prop];
      if (equipped[data.cat] === data.item) {
        delete equipped[data.cat];
      } else {
        equipped[data.cat] = data.item;
        state.statistics.itemsEquipped++;
        state.lifetimeStatistics.itemsEquipped++;
      }
      markDirty();
      emitChange('economy');
      break;
    }

    // ————— Prestígio —————
    case 'buy-legacy': buyLegacyUpgrade(main, data.legacy); break;
    case 'activate-empire': activateEmpireMode(main); break;
    case 'open-prestige-confirm': {
      const preview = prestigePreview(main);
      openModal(`
        <h2>💼 Vender o empreendimento</h2>
        <div class="card">
          <div class="row between small"><span class="muted">Você recebe</span><strong class="gain">+${preview.legacyPoints} Pontos de Legado</strong></div>
          <div class="row between small"><span class="muted">Valor do portfólio</span><strong>${fmtMoney(preview.value)}</strong></div>
        </div>
        <div class="card">
          <div class="small loss">Você perde: saldo, salas, upgrades, contratos, gestores, instalações e a REP do ciclo.</div>
          <div class="small gain" style="margin-top:4px">Você mantém: PL, melhorias permanentes, conquistas, coleção, estatísticas vitalícias e parte dos PP.</div>
        </div>
        <p class="muted small">Para confirmar, digite <strong>VENDER</strong>:</p>
        <input class="confirm-input" id="prestige-confirm-input" autocomplete="off" autocapitalize="characters" aria-label="Digite VENDER para confirmar">
        <button class="btn danger block" id="prestige-go-btn" disabled data-action="do-prestige">Confirmar venda</button>
      `);
      const input = document.getElementById('prestige-confirm-input');
      const btn = document.getElementById('prestige-go-btn');
      input?.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== 'VENDER'; });
      break;
    }
    case 'do-prestige': {
      closeAllModals();
      if (doPrestige(main)) navigate('building');
      break;
    }

    // ————— Loja / anúncios —————
    case 'ad-coffee': if (coffeeBoostAvailable(main)) watchAd(() => applyCoffeeBoost(main)); break;
    case 'ad-investor': if (investorReady(main)) watchAd(() => applyInvestor(main)); break;
    case 'ad-renovation': watchAd(() => applyRenovationDiscount(main)); break;
    case 'use-item': useTimeSkip(main, data.item); break;
    case 'store-buy': {
      const p = STORE_PRODUCTS.find((x) => x.id === data.product);
      if (!p) break;
      openModal(`
        <h2>${p.icon} ${esc(p.name)}</h2>
        <div class="card">
          <div class="row between"><span class="muted">Preço exibido</span><span class="price-pill">${p.price}</span></div>
          <div class="small" style="margin-top:6px">${esc(p.desc)}</div>
          <div class="dim" style="margin-top:4px">${p.type === 'unique' ? 'Compra única' : 'Consumível'}</div>
        </div>
        <div class="card" style="border-color:var(--accent)"><strong>“Simulação da versão local — nenhum valor será cobrado.”</strong></div>
        <div class="grid-2">
          <button class="btn" data-modal-close>Cancelar</button>
          <button class="btn primary" data-action="store-buy-confirm" data-product="${p.id}">Simular compra</button>
        </div>`);
      break;
    }
    case 'store-buy-confirm': closeModal(); simulatePurchase(main, data.product); break;

    // ————— Eventos —————
    case 'event-choice': resolveEvent(state, Number(data.index)); break;

    // ————— Notificações —————
    case 'open-notifications': openNotifications(main); break;
    case 'request-accept': resolveTenantRequest(main, Number(data.index), true); closeAllModals(); openNotifications(main); break;
    case 'request-decline': resolveTenantRequest(main, Number(data.index), false); closeAllModals(); openNotifications(main); break;
    case 'notif-accept-rival': acceptRival(main); closeAllModals(); navigate('campaign'); break;
    case 'notif-decline-rival': declineRival(main); closeAllModals(); break;

    // ————— Offline —————
    case 'offline-collect': collectOffline(false); break;
    case 'offline-collect-double': collectOffline(true); break;

    // ————— Onboarding —————
    case 'onboard-next': main.onboarding.step++; markDirty(); redraw(); break;
    case 'onboard-skip': main.onboarding.done = true; markDirty(); redraw(); break;
    case 'reset-tutorial': main.onboarding = { step: 0, done: false }; markDirty(); redraw(); toast('info', 'Tutorial reiniciado.'); break;

    // ————— Configurações / save —————
    case 'toggle-setting': {
      main.settings[data.key] = !main.settings[data.key];
      markDirty();
      redraw();
      break;
    }
    case 'export-save': {
      const text = exportSave(main);
      openModal(`
        <h2>📤 Exportar save</h2>
        <textarea readonly id="export-area" style="width:100%;height:130px;background:var(--bg);color:var(--text);border:1px solid var(--border-strong);border-radius:9px;padding:8px;font-size:0.7rem">${esc(text)}</textarea>
        <div class="grid-2" style="margin-top:10px">
          <button class="btn primary" id="copy-save-btn">📋 Copiar</button>
          <button class="btn" id="download-save-btn">💾 Baixar .json</button>
        </div>`);
      document.getElementById('copy-save-btn')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); toast('success', 'Save copiado!'); }
        catch { document.getElementById('export-area')?.select(); document.execCommand('copy'); toast('success', 'Save copiado!'); }
      });
      document.getElementById('download-save-btn')?.addEventListener('click', () => {
        const blob = new Blob([text], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `idle-office-save-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      break;
    }
    case 'import-save': {
      openModal(`
        <h2>📥 Importar save</h2>
        <p class="muted small">Cole o texto do save ou escolha um arquivo .json. Uma cópia de segurança do progresso atual será mantida.</p>
        <textarea id="import-area" style="width:100%;height:110px;background:var(--bg);color:var(--text);border:1px solid var(--border-strong);border-radius:9px;padding:8px;font-size:0.7rem;margin-top:8px" placeholder="Cole o save aqui…"></textarea>
        <input type="file" id="import-file" accept=".json,application/json" style="margin-top:8px;width:100%">
        <button class="btn primary block" style="margin-top:10px" id="import-preview-btn">Pré-visualizar</button>`);
      const doPreview = (text) => {
        try {
          const { state: imported, summary } = previewImport(text);
          openModal(`
            <h2>Confirmar importação</h2>
            <div class="card">
              <div class="row between small"><span class="muted">Salvo em</span><strong>${esc(summary.savedAt)}</strong></div>
              <div class="row between small"><span class="muted">Saldo</span><strong>${fmtMoney(summary.balance)}</strong></div>
              <div class="row between small"><span class="muted">Salas / Prestígios</span><strong>${summary.roomsUnlocked} / ${summary.prestiges}</strong></div>
            </div>
            ${main.lifetimeStatistics.playSeconds > (imported.lifetimeStatistics?.playSeconds || 0) ? '<div class="card" style="border-color:var(--red)"><span class="loss small">⚠️ O progresso atual parece MAIOR que o do save importado.</span></div>' : ''}
            <div class="grid-2">
              <button class="btn" data-modal-close>Cancelar</button>
              <button class="btn danger" id="import-confirm-btn">Substituir progresso</button>
            </div>`);
          document.getElementById('import-confirm-btn')?.addEventListener('click', () => {
            saveGame(main, { backup: true }); // backup do atual antes de importar (PRD §25.4)
            game.state = imported;
            saveGame(imported);
            closeAllModals();
            toast('success', 'Save importado com sucesso!');
            navigate('building');
          });
        } catch (err) {
          toast('error', 'Save inválido ou corrompido.');
        }
      };
      document.getElementById('import-preview-btn')?.addEventListener('click', () => {
        const text = document.getElementById('import-area')?.value || '';
        if (text.trim()) doPreview(text);
      });
      document.getElementById('import-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then(doPreview);
      });
      break;
    }
    case 'restore-backup': {
      const restored = restoreBackup();
      if (!restored) { toast('error', 'Nenhum backup disponível.'); break; }
      openModal(`
        <h2>♻️ Restaurar backup</h2>
        <p class="muted small">Backup de ${new Date(restored.lastSavedAt).toLocaleString('pt-BR')}. Substituir o progresso atual?</p>
        <div class="grid-2" style="margin-top:10px">
          <button class="btn" data-modal-close>Cancelar</button>
          <button class="btn danger" id="restore-backup-btn">Restaurar</button>
        </div>`);
      document.getElementById('restore-backup-btn')?.addEventListener('click', () => {
        game.state = restored;
        saveGame(restored);
        closeAllModals();
        navigate('building');
        toast('success', 'Backup restaurado.');
      });
      break;
    }
    case 'restore-checkpoint': {
      const restored = restorePrestigeCheckpoint();
      if (!restored) { toast('error', 'Nenhum checkpoint de Prestígio encontrado.'); break; }
      openModal(`
        <h2>⏪ Checkpoint de Prestígio</h2>
        <p class="muted small">Voltar ao estado imediatamente anterior ao último Prestígio (${new Date(restored.lastSavedAt).toLocaleString('pt-BR')})?</p>
        <div class="grid-2" style="margin-top:10px">
          <button class="btn" data-modal-close>Cancelar</button>
          <button class="btn danger" id="restore-cp-btn">Restaurar</button>
        </div>`);
      document.getElementById('restore-cp-btn')?.addEventListener('click', () => {
        game.state = restored;
        saveGame(restored);
        closeAllModals();
        navigate('building');
        toast('success', 'Checkpoint restaurado.');
      });
      break;
    }
    case 'reset-game': {
      openModal(`
        <h2>🗑️ Apagar todo o progresso</h2>
        <p class="muted">Esta ação é permanente. Para confirmar, digite <strong>APAGAR</strong>:</p>
        <input class="confirm-input" id="reset-confirm-input" autocomplete="off" autocapitalize="characters" aria-label="Digite APAGAR para confirmar">
        <button class="btn danger block" id="reset-go-btn" disabled>Apagar tudo</button>`);
      const input = document.getElementById('reset-confirm-input');
      const btn = document.getElementById('reset-go-btn');
      input?.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== 'APAGAR'; });
      btn?.addEventListener('click', () => {
        eraseAll();
        location.reload();
      });
      break;
    }

    default:
      console.warn('Ação desconhecida:', action);
  }
}

// ————— Modais auxiliares —————

function openAssignModal(state, mgrId) {
  const mgr = managerById(mgrId);
  const floors = FLOORS.filter((f) => state.floors[f.id]);
  openModal(`
    <h2>📍 Designar ${esc(mgr.name)}</h2>
    <p class="muted small">Escolha o andar. O impacto estimado considera o bônus principal do gestor.</p>
    ${floors.map((f) => {
      const current = state.managerAssignments[f.id];
      const prop = propertyById(f.property);
      return `<button class="event-choice" data-action="assign-confirm" data-mgr="${mgrId}" data-floor="${f.id}">
        <strong>${prop.icon} ${esc(f.name)}</strong> <span class="dim">(${esc(prop.name)})</span>
        ${current ? `<span class="special">Substitui ${esc(managerById(current)?.name || '')}</span>` : ''}
      </button>`;
    }).join('') || '<div class="empty-state">Nenhum andar liberado.</div>'}
  `);
}

function openFloorAssignModal(state, floorId) {
  const floor = floorById(floorId);
  const hired = Object.keys(state.hiredManagers);
  if (!hired.length) {
    navigate('team');
    toast('info', 'Contrate um gestor primeiro, na aba Equipe.');
    return;
  }
  openModal(`
    <h2>📍 Gestor para ${esc(floor.name)}</h2>
    ${hired.map((id) => {
      const m = managerById(id);
      const h = state.hiredManagers[id];
      const assigned = Object.entries(state.managerAssignments).find(([, x]) => x === id)?.[0];
      return `<button class="event-choice" data-action="assign-confirm" data-mgr="${id}" data-floor="${floorId}">
        <strong>${esc(m.name)} nv.${h.level}</strong> <span class="dim">${esc(m.title)}</span>
        ${assigned && assigned !== floorId ? `<span class="special">Sai de ${esc(floorById(assigned)?.name || '')}</span>` : ''}
      </button>`;
    }).join('')}
    ${state.managerAssignments[floorId] ? `<button class="btn danger block" data-action="unassign-manager" data-floor="${floorId}" data-modal-close>Remover gestor atual</button>` : ''}
  `);
}

function openNotifications(state) {
  const requests = state.tenantRequests || [];
  const rival = state.campaign.rival;
  const snap = snapFor(state);
  let inner = '';
  if (rival && !rival.accepted) {
    inner += `<div class="card" style="border-color:var(--red)">
      <h3>😈 Augusto lançou um desafio!</h3>
      <div class="row" style="margin-top:8px">
        <button class="btn small primary" data-action="notif-accept-rival">Aceitar</button>
        <button class="btn small ghost" data-action="notif-decline-rival">Recusar</button>
      </div>
    </div>`;
  }
  if (requests.length) {
    inner += requests.map((r, i) => `
      <div class="card">
        <h3>${r.icon} ${esc(r.name)}</h3>
        <div class="dim">Custo: ${fmtMoney(Math.max(20, (snap?.totalPerSec || 1) * r.costSeconds))} · Recompensa: +${r.reward.rep} REP e satisfação temporária</div>
        <div class="dim" data-countdown="${r.expiresAt}">expira em breve</div>
        <div class="row" style="margin-top:8px">
          <button class="btn small success" data-action="request-accept" data-index="${i}">Atender</button>
          <button class="btn small ghost" data-action="request-decline" data-index="${i}">Recusar</button>
        </div>
      </div>`).join('');
  }
  if (!inner) inner = '<div class="empty-state"><span class="ico">🔔</span>Nenhuma notificação no momento. Solicitações de inquilinos e desafios do rival aparecem aqui.</div>';
  openModal(`<h2>🔔 Notificações</h2>${inner}`);
}
