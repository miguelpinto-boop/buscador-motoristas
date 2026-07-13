// Núcleo da interface — navegação em pilha, cabeçalho, modais, toasts e game feel.
// A UI assina eventos do bus e nunca altera o estado diretamente (PRD §26.3).

import { game, activeState, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { fmtMoney, fmtRate, fmtClock, fmtNumber, fmtDuration } from '../core/format.js';
import { tapGain } from '../core/formulas.js';
import { BALANCE } from '../data/balance.js';
import { SCREENS, SCREEN_META, renderScreen } from './screens.js';
import { handleAction } from './handlers.js';
import { initMusic } from './music.js';
import { eventById } from '../data/events.js';
import { collectOfflineReturn } from '../systems/offline.js';
import { playMockAd } from '../systems/monetization.js';
import { saveGame } from '../persistence/save.js';

export const ui = {
  screen: 'building',
  sub: {},               // subaba por tela (ex.: goals → 'tutorial')
  buyMode: 1,            // x1 | 10 | 25 | 'max'
  contractRoom: null,    // sala selecionada na tela de contratos
  contractFilter: 'all',
  eventModalEl: null,
  offlineReport: null,
};

const $ = (id) => document.getElementById(id);

// ————— Áudio simples via WebAudio (PRD §41.1) —————

let audioCtx = null;
function beep(freq = 660, duration = 0.07, type = 'sine', volume = 0.04) {
  const state = game.state;
  if (!state?.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* áudio indisponível */ }
}

/** Vibração háptica leve em celulares (desligável nas configurações). */
export function haptic(ms = 10) {
  if (!game.state?.settings.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* sem suporte */ }
}

export const sounds = {
  tap: () => beep(520, 0.05, 'triangle'),
  buy: () => beep(700, 0.08, 'sine'),
  success: () => { beep(660, 0.07); setTimeout(() => beep(880, 0.09), 70); },
  error: () => beep(190, 0.12, 'square', 0.03),
  celebrate: () => { beep(660, 0.08); setTimeout(() => beep(830, 0.08), 90); setTimeout(() => beep(990, 0.14), 180); },
};

// ————— Toasts —————

const toastQueue = [];
function showToast({ type = 'info', text }) {
  const root = $('toast-root');
  if (root.children.length >= 3) root.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  root.appendChild(el);
  if (type === 'success') sounds.success();
  if (type === 'error') sounds.error();
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 350);
  }, 3400);
}

// ————— Modais (pilha) —————

const modalStack = [];

export function openModal(html, { onClose = null, dismissible = true } = {}) {
  const root = $('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${dismissible ? '<button class="close-x" data-modal-close aria-label="Fechar">✕</button>' : ''}${html}</div>`;
  if (dismissible) {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  }
  root.appendChild(backdrop);
  modalStack.push({ el: backdrop, onClose, dismissible });
  bus._modalOpen = true;
  const focusable = backdrop.querySelector('button, input, select, textarea');
  focusable?.focus();
  return backdrop;
}

export function closeModal() {
  const top = modalStack.pop();
  if (!top) return;
  top.el.remove();
  top.onClose?.();
  bus._modalOpen = modalStack.length > 0;
}

export function closeAllModals() {
  while (modalStack.length) closeModal();
}

// ————— Números flutuantes e celebração (PRD §23, skill game-feel) —————

export function floatNumber(x, y, text, color = null) {
  if (game.state?.settings.reducedMotion) return;
  const root = $('float-root');
  if (root.children.length > 14) root.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = 'float-num';
  el.textContent = text;
  if (color) el.style.color = color;
  el.style.left = `${x + (Math.random() * 36 - 18)}px`;
  el.style.top = `${y - 18}px`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1050);
}

function confettiBurst() {
  if (game.state?.settings.reducedMotion) return;
  const root = $('float-root');
  const colors = ['#ffc233', '#34d17b', '#4f8ef7', '#a97df5', '#ff5d5d'];
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = `${Math.random() * 0.5}s`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}

function celebrate({ text }) {
  confettiBurst();
  sounds.celebrate();
  const el = document.createElement('div');
  el.className = 'celebrate-banner';
  el.textContent = `🎉 ${text}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2450);
}

// ————— Cabeçalho fixo (PRD §21.1) —————

function renderHeader() {
  const state = activeState();
  const snap = snapFor(state);
  if (!state || !snap) return;
  const inChallenge = state !== game.state;
  const boostLeft = Math.max(0, (state.boostExpiresAt || 0) - Date.now());
  const effects = (state.activeEffects || []).filter((fx) => fx.expiresAt > Date.now());
  const tempMult = snap.mods.tempIncomeMult;
  $('app-header').innerHTML = `
    <div class="hud-row">
      <div>
        <div class="hud-money" data-hud="money">${fmtMoney(state.balance)}</div>
        <div class="hud-rate" data-hud="rate">${fmtRate(snap.totalPerSec)}</div>
      </div>
      <div class="row">
        ${inChallenge ? '<span class="tag purple">CENÁRIO</span>' : ''}
        <button class="icon-btn" data-action="open-notifications" aria-label="Notificações">🔔${notifCount(state) ? '<span class="badge-dot" style="position:absolute;margin-left:14px;margin-top:-14px;width:9px;height:9px;border-radius:50%;background:var(--red);display:inline-block"></span>' : ''}</button>
        <button class="icon-btn" data-action="nav" data-screen="settings" aria-label="Configurações">⚙️</button>
      </div>
    </div>
    <div class="hud-chips">
      <span class="chip">⭐ <strong data-hud="rep">${fmtNumber(Math.floor(state.reputation))}</strong> REP</span>
      ${state.hqUnlocked || state.researchPoints > 0 ? `<span class="chip">🔬 <strong data-hud="pp">${fmtNumber(state.researchPoints)}</strong> PP</span>` : ''}
      ${!inChallenge && (game.state.prestigeCount > 0 || game.state.legacyPoints > 0) ? `<span class="chip">🏆 <strong data-hud="pl">${fmtNumber(game.state.legacyPoints)}</strong> PL</span>` : ''}
      ${tempMult > 1.01 ? `<span class="chip boost">🔥 ×${tempMult.toFixed(2).replace('.', ',')}</span>` : tempMult < 0.99 ? `<span class="chip" style="border-color:var(--red);color:var(--red)">▼ ×${tempMult.toFixed(2).replace('.', ',')}</span>` : ''}
      ${boostLeft > 0 ? `<span class="chip boost">☕ <span data-hud="boost">${fmtClock(boostLeft)}</span></span>` : ''}
      ${effects.length ? `<span class="chip">✨ ${effects.length} efeito(s)</span>` : ''}
    </div>`;
}

function notifCount(state) {
  let n = state.tenantRequests?.length || 0;
  if (state.campaign?.rival && !state.campaign.rival.accepted) n++;
  return n;
}

// Atualizações de alta frequência sem reconstruir o DOM (PRD §26.4)
function lightUpdate() {
  const state = activeState();
  const snap = snapFor(state);
  if (!state || !snap) return;
  const money = document.querySelector('[data-hud="money"]');
  if (money) {
    money.textContent = fmtMoney(state.balance);
    money.classList.remove('balance-tick');
    void money.offsetWidth;
    if (snap.totalPerSec > 0 && !state.settings?.reducedMotion) money.classList.add('balance-tick');
  }
  const rate = document.querySelector('[data-hud="rate"]');
  if (rate) rate.textContent = fmtRate(snap.totalPerSec);
  const rep = document.querySelector('[data-hud="rep"]');
  if (rep) rep.textContent = fmtNumber(Math.floor(state.reputation));
  const pp = document.querySelector('[data-hud="pp"]');
  if (pp) pp.textContent = fmtNumber(state.researchPoints);
  const boost = document.querySelector('[data-hud="boost"]');
  if (boost) boost.textContent = fmtClock(Math.max(0, (state.boostExpiresAt || 0) - Date.now()));
  // Cronômetros e barras dinâmicas da tela atual
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const target = Number(el.dataset.countdown);
    el.textContent = fmtClock(Math.max(0, target - Date.now()));
  });
  document.querySelectorAll('[data-progress-until]').forEach((el) => {
    const end = Number(el.dataset.progressUntil);
    const start = Number(el.dataset.progressFrom);
    const pct = Math.min(100, Math.max(0, ((Date.now() - start) / Math.max(1, end - start)) * 100));
    el.style.width = `${pct}%`;
  });
  // Botões de compra "acendem" em tempo real quando o saldo alcança o custo
  document.querySelectorAll('[data-cost]').forEach((btn) => {
    const cost = Number(btn.dataset.cost);
    if (!Number.isFinite(cost) || btn.disabled) return;
    const affordable = state.balance >= cost;
    btn.classList.toggle('primary', affordable);
    btn.classList.toggle('affordable', affordable);
  });
  // Barra de progresso da "Próxima meta"
  const goalBar = document.querySelector('[data-goal-cost]');
  if (goalBar) {
    const cost = Number(goalBar.dataset.goalCost);
    goalBar.style.width = `${Math.min(100, (state.balance / Math.max(1, cost)) * 100)}%`;
    const goalPct = document.querySelector('[data-goal-pct]');
    if (goalPct) goalPct.textContent = `${Math.min(100, Math.floor((state.balance / Math.max(1, cost)) * 100))}%`;
  }
  // Cronômetro do evento pendente
  if (ui.eventModalEl && state.events.pending) {
    const barEl = ui.eventModalEl.querySelector('.event-timer > span');
    const p = state.events.pending;
    if (barEl && !p.pausedAt) {
      const total = BALANCE.eventDecisionSeconds * 1000;
      const left = Math.max(0, p.deadline - Date.now());
      barEl.style.width = `${(left / total) * 100}%`;
    }
  }
}

// ————— Navegação (PRD §21.2) —————

const NAV_ITEMS = [
  { id: 'building', ico: '🏢', label: 'Prédio' },
  { id: 'map', ico: '🗺️', label: 'Mapa' },
  { id: 'contracts', ico: '📋', label: 'Contratos' },
  { id: 'team', ico: '🧑‍💼', label: 'Equipe' },
  { id: 'hq', ico: '🏛️', label: 'Sede' },
  { id: 'goals', ico: '🎯', label: 'Metas' },
  { id: 'more', ico: '➕', label: 'Mais' },
];
const MORE_SCREENS = ['projects', 'challenges', 'collection', 'stats', 'prestige', 'store', 'settings', 'campaign', 'more'];

function renderNav() {
  const activeNav = MORE_SCREENS.includes(ui.screen) ? 'more' : ui.screen;
  $('app-nav').innerHTML = NAV_ITEMS.map((item) => `
    <button class="nav-btn ${activeNav === item.id ? 'active' : ''}" data-action="nav" data-screen="${item.id}" aria-label="${item.label}" ${activeNav === item.id ? 'aria-current="page"' : ''}>
      <span class="ico" aria-hidden="true">${item.ico}</span>
      <span>${item.label}</span>
    </button>`).join('');
}

export function navigate(screenId) {
  if (!SCREENS[screenId]) screenId = 'building';
  ui.screen = screenId;
  renderNav();
  redraw();
  $('app-main').scrollTop = 0;
  window.scrollTo({ top: 0 });
}

export function redraw() {
  const state = activeState();
  if (!state) return;
  const main = $('app-main');
  document.body.className = `theme-${state.currentProperty}${state.settings?.reducedMotion ? ' reduced-motion' : ''}`;
  renderHeader();
  renderScreen(ui.screen, main, state);
  renderOnboarding();
}

// ————— Modal de evento (PRD §17) —————

function showEventModal() {
  const state = activeState();
  const pending = state.events.pending;
  if (!pending) return;
  const ev = eventById(pending.id);
  if (!ev) return;
  sounds.error();
  const el = openModal(`
    <h2>⚡ ${ev.name}</h2>
    <p class="muted">${ev.desc}</p>
    <div class="event-timer"><span style="width:100%"></span></div>
    ${ev.choices.map((c, i) => {
      const specialOk = c.special && window.__specialMet?.(state, c.special.req);
      return `<button class="event-choice" data-action="event-choice" data-index="${i}">
        <strong>${c.label}</strong>
        ${specialOk ? `<span class="special">★ ${c.special.text}</span>` : ''}
      </button>`;
    }).join('')}
    <p class="dim" style="text-align:center">Sem resposta, a segunda opção é aplicada automaticamente.</p>
  `, { dismissible: false });
  ui.eventModalEl = el;
}

function onEventResolved({ event, parts, specialText }) {
  if (ui.eventModalEl) { closeModal(); ui.eventModalEl = null; }
  const detail = [specialText, parts.join(' · ')].filter(Boolean).join(' — ');
  showToast({ type: 'info', text: `${event.name}: ${detail || 'resolvido.'}` });
  redraw();
}

// ————— Modal de retorno offline (PRD §18.4) —————

function showOfflineModal(report) {
  ui.offlineReport = report;
  const state = game.state;
  openModal(`
    <h2>👋 Bem-vindo de volta!</h2>
    <div class="card">
      <div class="row between small"><span class="muted">Tempo ausente</span><strong>${fmtDuration(report.awaySeconds)}</strong></div>
      <div class="row between small"><span class="muted">Tempo considerado (limite ${report.limitHours}h)</span><strong>${fmtDuration(report.consideredSeconds)}</strong></div>
      <div class="row between small"><span class="muted">Renda base</span><strong>${fmtRate(report.baseRate)}</strong></div>
      ${report.segments.length > 1 ? `<div class="row between small"><span class="muted">Trechos com bônus</span><strong>${report.segments.length}</strong></div>` : ''}
      <hr style="border-color:var(--border);margin:8px 0">
      <div class="row between"><span>Total recebido</span><strong class="gain">${fmtMoney(report.total)}</strong></div>
    </div>
    <button class="btn primary block" data-action="offline-collect">Coletar</button>
    <button class="btn ad-btn block" style="margin-top:8px" data-action="offline-collect-double" id="offline-2x-btn">📺 Assistir anúncio e receber 2×</button>
    <p class="mock-note">Anúncio simulado — nenhuma propaganda real é exibida.</p>
  `, { dismissible: false });
}

export function collectOffline(doubled) {
  if (!ui.offlineReport) return;
  const state = game.state;
  if (doubled) {
    const btn = document.getElementById('offline-2x-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Carregando anúncio…'; }
    playMockAd(
      (status) => { if (btn && status === 'playing') btn.textContent = 'Reproduzindo…'; },
      () => {
        const amount = collectOfflineReturn(state, ui.offlineReport, true);
        ui.offlineReport = null;
        closeAllModals();
        showToast({ type: 'success', text: `Ganho offline em dobro: ${fmtMoney(amount)}` });
        redraw();
      },
    );
  } else {
    const amount = collectOfflineReturn(state, ui.offlineReport, false);
    ui.offlineReport = null;
    closeAllModals();
    showToast({ type: 'success', text: `Ganho offline: ${fmtMoney(amount)}` });
    redraw();
  }
}

// ————— Onboarding contextual (PRD §22) —————

const ONBOARD_STEPS = [
  { text: 'Este é o seu saldo e a sua renda por segundo. O prédio gera dinheiro sozinho — e o botão "Trabalhar" acelera as coisas.', who: 'Clara', doneWhen: (s) => s.statistics.taps >= 1 || s.statistics.upgradesBought >= 1 },
  { text: 'Compre seu primeiro upgrade na Garagem Adaptada. Estrutura, Tecnologia e Conforto aumentam a renda.', who: 'Clara', doneWhen: (s) => s.statistics.upgradesBought >= 1 },
  { text: 'Missão concluída! Acompanhe as próximas na aba Metas — cada uma dá dinheiro e Reputação.', who: 'Clara', doneWhen: (s) => s.missions.tutorialIndex >= 2 },
  { text: 'Junte dinheiro e desbloqueie a próxima sala. Salas novas significam novos aluguéis.', who: 'Clara', doneWhen: (s) => s.statistics.contractsSigned >= 1 || Object.values(s.rooms).filter((r) => r.unlocked).length >= 2 },
  { text: 'Visite a aba Contratos: empresas melhores pagam multiplicadores maiores. Fique de olho nos requisitos.', who: 'Roberto', doneWhen: (s) => s.statistics.contractsSigned >= 1 },
  { text: 'A satisfação (50–100) multiplica a renda da sala. Conforto, instalações e gestores aumentam a satisfação.', who: 'Luna', doneWhen: (s) => (s.facilities.recepcao ?? -1) >= 0 || s.missions.tutorialIndex >= 7 },
  { text: 'Instalações como a Recepção dão bônus para o prédio inteiro. Elas ficam no fim da tela Prédio.', who: 'Luna', doneWhen: (s) => (s.facilities.recepcao ?? -1) >= 0 },
  { text: 'Gestores dão bônus passivos por andar. Contrate na aba Equipe e use "Designar".', who: 'Clara', doneWhen: (s) => Object.keys(s.hiredManagers).length >= 1 },
  { text: 'Sua próxima grande meta: liberar o 2º andar. O requisito aparece no topo do andar bloqueado.', who: 'Roberto', doneWhen: (s) => s.floors.aurora_2 },
  { text: 'Quando o prédio estiver forte, o Prestígio permite vender tudo por Pontos de Legado e recomeçar mais poderoso. Sem pressa!', who: 'Clara', doneWhen: (s) => s.onboarding.step > 9 },
];

function renderOnboarding() {
  const root = $('onboard-root');
  const state = game.state;
  if (!state || state.onboarding.done || game.challengeRun) { root.innerHTML = ''; return; }
  let step = state.onboarding.step;
  // Avança passos já cumpridos
  while (step < ONBOARD_STEPS.length && ONBOARD_STEPS[step].doneWhen(state)) {
    step++;
  }
  // Passo 10 (prestígio) só aparece com o 3º andar liberado (PRD §22.1)
  if (step === 9 && !state.floors.aurora_3) { root.innerHTML = ''; state.onboarding.step = 9; return; }
  if (step >= ONBOARD_STEPS.length) {
    state.onboarding.done = true;
    state.onboarding.step = step;
    markDirty();
    root.innerHTML = '';
    return;
  }
  if (step !== state.onboarding.step) { state.onboarding.step = step; markDirty(); }
  const tip = ONBOARD_STEPS[step];
  root.innerHTML = `
    <div class="onboard-tip" role="status">
      <div class="who">${tip.who} diz:</div>
      <div class="small">${tip.text}</div>
      <div class="row" style="margin-top:9px;justify-content:flex-end">
        <button class="btn small ghost" data-action="onboard-skip">Pular tutorial</button>
        <button class="btn small primary" data-action="onboard-next">Entendi</button>
      </div>
    </div>`;
}

// ————— Banner de atualização do PWA (PRD §42) —————

function showSwUpdateBanner(reg) {
  if (document.querySelector('.sw-banner')) return;
  const el = document.createElement('div');
  el.className = 'sw-banner';
  el.innerHTML = `
    <span class="small" style="flex:1">🔄 Atualização disponível!</span>
    <button class="btn small primary" id="sw-update-btn">Atualizar</button>`;
  document.body.appendChild(el);
  el.querySelector('#sw-update-btn').addEventListener('click', () => {
    saveGame(game.state); // salva antes de recarregar (PRD §42)
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    setTimeout(() => location.reload(), 1200);
  });
}

// ————— Inicialização —————

export function initUI() {
  renderNav();
  redraw();
  initMusic();

  // Delegação de cliques: um único listener para toda a interface
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-modal-close]');
    if (el) { closeModal(); return; }
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    handleAction(actionEl.dataset.action, actionEl.dataset, actionEl, e);
  });

  // Teclado: Esc fecha modais quando seguro (PRD §28)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      const top = modalStack[modalStack.length - 1];
      if (top.dismissible) closeModal();
    }
  });

  bus.on('toast', showToast);
  bus.on('celebrate', celebrate);
  bus.on('tick', lightUpdate);
  bus.on('change', () => redraw());
  bus.on('event-show', showEventModal);
  bus.on('event-resolved', onEventResolved);
  bus.on('offline-return', showOfflineModal);
  bus.on('sw-update', showSwUpdateBanner);
  bus.on('chapter-complete', (ch) => {
    openModal(`
      <h2>📖 Capítulo ${ch.n} concluído — ${ch.title}</h2>
      ${ch.outro.map((d) => dialogueLine(d)).join('')}
      ${ch.reward.unlocks ? `<div class="card"><strong>🔓 Desbloqueado:</strong> ${ch.reward.unlocks}</div>` : ''}
      <button class="btn primary block" data-modal-close>Continuar</button>`);
  });
  bus.on('campaign-finale', () => {
    openModal(`
      <h2>🏆 Ícone da Cidade</h2>
      <p>Você concluiu a campanha do Idle Office Simulator! O Modo Império está disponível na tela de Prestígio — e a cidade agora tem o seu nome no horizonte.</p>
      <button class="btn primary block" data-modal-close>🎆 Celebrar</button>`);
  });
  bus.on('rival-offer', () => { renderHeader(); showToast({ type: 'info', text: 'Augusto lançou um desafio! Veja em 🔔 Notificações.' }); });
  bus.on('challenge-over', () => { navigate('challenges'); });
}

export function dialogueLine(d) {
  return `<div class="dialogue-line">
    <span class="who-ico">${window.__characters?.[d.who]?.icon || '👤'}</span>
    <div class="bubble"><div class="who-name">${window.__characters?.[d.who]?.name || d.who}</div>${d.text}</div>
  </div>`;
}
