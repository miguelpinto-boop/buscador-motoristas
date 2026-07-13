// Projetos empresariais — PRD §32. Continuam durante ausência; RNG com semente salva.

import { PROJECTS, projectById } from '../data/projects.js';
import { game, snapFor, markDirty, emitChange } from '../core/store.js';
import { bus } from '../core/bus.js';
import { mulberry32, nextRandom } from '../core/rng.js';
import { grantReward, spend, addEffect } from './actions.js';
import { evaluateCheck } from './progression.js';
import { companyById } from '../data/companies.js';

const toast = (type, text) => bus.emit('toast', { type, text });

/** Requisito do projeto atendido? */
export function projectRequirementMet(state, project) {
  const req = project.req || {};
  if (req.activeSpecialty) {
    if (!Object.values(state.tenantsByRoom).some((id) => companyById(id)?.specialty === req.activeSpecialty)) return false;
  }
  if (req.activeCategorySpecialty) {
    const { specialty, cat } = req.activeCategorySpecialty;
    if (!Object.values(state.tenantsByRoom).some((id) => {
      const c = companyById(id);
      return c && c.specialty === specialty && c.cat >= cat;
    })) return false;
  }
  if (req.activeCategoryCount) {
    const n = Object.values(state.tenantsByRoom).filter((id) => (companyById(id)?.cat || 0) >= req.activeCategoryCount.cat).length;
    if (n < req.activeCategoryCount.count) return false;
  }
  if (req.tech) {
    if (!Object.values(state.rooms).some((r) => r.unlocked && r.tech >= req.tech)) return false;
  }
  if (req.facility && (state.facilities[req.facility.id] ?? -1) < req.facility.level) return false;
  if (req.propertyUnlocked && !state.properties[req.propertyUnlocked]) return false;
  if (req.propertiesUnlocked && Object.values(state.properties).filter(Boolean).length < req.propertiesUnlocked) return false;
  if (req.roomUnlocked && !state.rooms[req.roomUnlocked]?.unlocked) return false;
  if (req.chapterDone && state.campaign.completedChapters < req.chapterDone) return false;
  return true;
}

export function projectsUnlocked(state) {
  if (state.challengeMods) return true; // cenários de desafio liberam projetos
  return state.campaign.completedChapters >= 3;
}

export function projectSlots(state) {
  return snapFor(state)?.mods?.projectSlots || 1;
}

export function projectDurationMs(state, project) {
  const mods = snapFor(state)?.mods;
  let mult = mods?.projectSpeedMult || 1;
  if (project.long && mods?.projectSpeedLongMult) mult *= mods.projectSpeedLongMult;
  return project.minutes * 60_000 * mult;
}

export function startProject(state, projectId) {
  if (!projectsUnlocked(state)) { toast('error', 'Projetos são liberados no capítulo 3.'); return false; }
  const project = projectById(projectId);
  if (!project) return false;
  if (state.projects.active.some((p) => p.id === projectId)) { toast('error', 'Este projeto já está em andamento.'); return false; }
  if (!project.repeatable && state.projects.history.some((h) => h.id === projectId)) { toast('error', 'Projeto único já concluído.'); return false; }
  if (state.projects.active.length >= projectSlots(state)) { toast('error', 'Todos os espaços de projeto estão ocupados.'); return false; }
  if (!projectRequirementMet(state, project)) { toast('error', 'Requisitos do projeto não atendidos.'); return false; }
  if (project.costSeconds) {
    const cost = Math.ceil((snapFor(state)?.totalPerSec || 1) * project.costSeconds);
    if (!spend(state, cost)) { toast('error', 'Saldo insuficiente para iniciar.'); return false; }
  }
  const now = Date.now();
  // Semente persistida: recarregar não re-sorteia o resultado (PRD §32)
  const seed = Math.floor(nextRandom(state) * 0xFFFFFFFF) >>> 0;
  state.projects.active.push({ id: projectId, startedAt: now, endsAt: now + projectDurationMs(state, project), seed, collected: false });
  toast('success', `Projeto iniciado: ${project.name}`);
  markDirty();
  emitChange('projects');
  return true;
}

export function cancelProject(state, projectId) {
  const idx = state.projects.active.findIndex((p) => p.id === projectId);
  if (idx < 0) return false;
  const project = projectById(projectId);
  // Cancelar devolve no máximo 50% do custo e não entrega recompensa (PRD §32)
  if (project?.costSeconds) {
    const refund = Math.ceil((snapFor(state)?.totalPerSec || 1) * project.costSeconds * 0.5);
    state.balance += refund;
  }
  state.projects.active.splice(idx, 1);
  toast('info', 'Projeto cancelado.');
  markDirty();
  emitChange('projects');
  return true;
}

export function finishProjectInstantly(state, projectId) {
  const active = state.projects.active.find((p) => p.id === projectId);
  if (!active) return false;
  if ((state.inventory.instantProject || 0) < 1) return false;
  state.inventory.instantProject--;
  active.endsAt = Date.now();
  markDirty();
  emitChange('projects');
  return true;
}

/** Coleta um projeto concluído. `silent` para coleta em lote. */
export function collectProject(state, projectId, { silent = false } = {}) {
  const idx = state.projects.active.findIndex((p) => p.id === projectId);
  if (idx < 0) return false;
  const active = state.projects.active[idx];
  if (Date.now() < active.endsAt) return false;
  const project = projectById(projectId);
  state.projects.active.splice(idx, 1);
  if (!project) return false;

  const mods = snapFor(state)?.mods;
  // Resultado excelente: determinístico pela semente salva
  const rand = mulberry32(active.seed);
  const chance = Math.min(0.95, project.excellentChance + (mods?.excellentChanceBonus || 0));
  const excellent = rand() < chance;
  const rewardMult = (mods?.projectRewardMult || 1) * (excellent ? 1.5 : 1);

  const reward = { ...project.reward };
  if (reward.moneySeconds) reward.moneySeconds *= rewardMult;
  if (reward.rep) reward.rep = Math.round(reward.rep * rewardMult);
  if (reward.pp) reward.pp = Math.round(reward.pp * rewardMult);
  grantReward(state, reward, { sourceLabel: project.name });

  // Patentes (pesquisa r21): excelentes concedem bônus permanente no ciclo
  if (excellent && mods?.patentAvailable) {
    state.patentBonusCycle = (state.patentBonusCycle || 0) + 0.02;
  }

  state.projects.history.push({ id: projectId, finishedAt: Date.now(), excellent });
  state.statistics.projectsCompleted++;
  state.lifetimeStatistics.projectsCompleted++;
  if (excellent) {
    state.statistics.excellentProjects++;
    state.lifetimeStatistics.excellentProjects++;
  }
  if (!silent) {
    bus.emit('celebrate', { text: excellent ? `Resultado EXCELENTE: ${project.name}!` : `${project.done}` });
  }
  markDirty();
  emitChange('projects');
  return true;
}

/** Coleta em lote (PRD §32). */
export function collectAllProjects(state) {
  const ready = state.projects.active.filter((p) => Date.now() >= p.endsAt).map((p) => p.id);
  let count = 0;
  for (const id of ready) if (collectProject(state, id, { silent: true })) count++;
  if (count > 0) toast('success', `${count} projeto(s) coletado(s).`);
  return count;
}

export function readyProjects(state) {
  const now = Date.now();
  return state.projects.active.filter((p) => now >= p.endsAt);
}
