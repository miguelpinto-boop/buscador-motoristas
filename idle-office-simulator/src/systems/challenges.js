// Cenários de desafio — Auditoria de Vera (PRD §37).
// Cada cenário roda em um estado separado do save principal, com regras modificadas.
// O progresso do cenário vive em memória: reiniciar não afeta a campanha.

import { CHALLENGES, challengeById } from '../data/extras.js';
import { freshState, game, markDirty, emitChange } from '../core/store.js';
import { computeEconomy } from '../core/formulas.js';
import { bus } from '../core/bus.js';
import { grantReward } from './actions.js';
import { maybeTriggerEvent, expireEvent } from './events.js';

const toast = (type, text) => bus.emit('toast', { type, text });

// Recompensas por medalha (bronze, prata, ouro)
const MEDAL_REWARDS = [
  { rep: 20 },
  { pp: 10 },
  { rep: 30, collectionRoll: true },
];

export function startChallenge(challengeId) {
  const ch = challengeById(challengeId);
  if (!ch || game.challengeRun) return false;
  const s = freshState();
  s.challengeMods = { ...ch.modifiers };
  if (ch.modifiers.startMoney !== undefined) s.balance = ch.modifiers.startMoney;
  if (ch.modifiers.conditionStart !== undefined) s.propertyCondition.aurora = ch.modifiers.conditionStart;
  if (ch.modifiers.incomeMult) s.challengeMods.incomeMult = ch.modifiers.incomeMult;
  // Cenários pulam onboarding e começam com eventos habilitados
  s.onboarding = { step: 99, done: true };
  s.missions.tutorialIndex = 99;
  game.challengeRun = {
    id: challengeId,
    state: s,
    startedAt: Date.now(),
    deadline: Date.now() + ch.minutes * 60_000,
    finished: false,
    snapshot: computeEconomy(s),
  };
  toast('info', `Cenário iniciado: ${ch.name}. Boa sorte!`);
  emitChange('challenge');
  return true;
}

export function abandonChallenge() {
  if (!game.challengeRun) return false;
  game.challengeRun = null;
  toast('info', 'Cenário encerrado. Nada foi perdido no save principal.');
  emitChange('challenge');
  return true;
}

function goalMet(ch, run) {
  const s = run.state;
  const snap = run.snapshot;
  const g = ch.goal;
  switch (g.type) {
    case 'incomeRate': return snap.totalPerSec >= g.value;
    case 'satisfactionRoom': return Math.max(0, ...Object.values(snap.perRoom).map((r) => r.satisfaction)) >= g.value;
    case 'eventsCompleted': return s.statistics.eventsCompleted >= g.value;
    case 'conditionAt': return (s.propertyCondition.aurora ?? 0) >= g.value;
    case 'projectsCompleted': return s.statistics.projectsCompleted >= g.value;
    default: return false;
  }
}

export function goalProgress(ch, run) {
  const s = run.state;
  const snap = run.snapshot;
  const g = ch.goal;
  switch (g.type) {
    case 'incomeRate': return { current: snap.totalPerSec, target: g.value };
    case 'satisfactionRoom': return { current: Math.max(0, ...Object.values(snap.perRoom).map((r) => r.satisfaction)), target: g.value };
    case 'eventsCompleted': return { current: s.statistics.eventsCompleted, target: g.value };
    case 'conditionAt': return { current: s.propertyCondition.aurora ?? 0, target: g.value };
    case 'projectsCompleted': return { current: s.statistics.projectsCompleted, target: g.value };
    default: return { current: 0, target: 1 };
  }
}

/** Tique do cenário (1×/s): economia própria, decadência de condição e verificação da meta. */
export function tickChallenge(now = Date.now()) {
  const run = game.challengeRun;
  if (!run || run.finished) return;
  const ch = challengeById(run.id);
  const s = run.state;

  run.snapshot = computeEconomy(s, now);
  const dt = 1;
  const gain = run.snapshot.totalPerSec * dt;
  s.balance += gain;
  s.statistics.moneyEarned += gain;
  s.statistics.playSeconds += dt;

  if (ch.modifiers.conditionDecayPerMin) {
    s.propertyCondition.aurora = Math.max(0, s.propertyCondition.aurora - ch.modifiers.conditionDecayPerMin / 60);
  }

  // Eventos dentro do cenário (ex.: Auditoria Surpresa)
  if (ch.modifiers.eventEveryMs) {
    maybeTriggerEvent(s, now);
    if (s.events.pending && !s.events.pending.pausedAt && now > s.events.pending.deadline) expireEvent(s);
  }

  if (goalMet(ch, run)) {
    finishChallenge(run, ch, now);
  } else if (now > run.deadline) {
    run.finished = true;
    toast('info', `Tempo esgotado em "${ch.name}". Tente novamente quando quiser.`);
    bus.emit('challenge-over', { challenge: ch, medals: 0 });
    emitChange('challenge');
  }
}

function finishChallenge(run, ch, now) {
  run.finished = true;
  const elapsedMin = (now - run.startedAt) / 60_000;
  let medals = 0;
  for (const m of ch.medals) if (elapsedMin <= m.atMinutes) medals++;
  medals = Math.max(1, medals);

  const main = game.state;
  const prev = main.challenges.medals[ch.id] || 0;
  // Recompensas únicas por medalha (apenas medalhas novas)
  for (let i = prev; i < medals; i++) grantReward(main, MEDAL_REWARDS[i]);
  main.challenges.medals[ch.id] = Math.max(prev, medals);
  if (!main.challenges.completed.includes(ch.id)) main.challenges.completed.push(ch.id);
  markDirty();
  bus.emit('celebrate', { text: `Cenário concluído: ${ch.name} — ${medals} medalha(s)!` });
  bus.emit('challenge-over', { challenge: ch, medals });
  emitChange('challenge');
}
