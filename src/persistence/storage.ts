import { getVariation, isVariationId } from '../content';
import { BADGES } from '../content/labels';
import type {
  AssembledBlock,
  AttemptSummary,
  BadgeId,
  Completion,
  GameState,
  MissionRun,
  Screen,
  Simulation,
  Step,
  TestResult,
  VariationId,
} from '../types';

/**
 * Persistência no navegador (localStorage), com versão de formato.
 * Dados inválidos ou incompatíveis nunca travam o jogo: o que não puder ser
 * aproveitado é descartado e o jogo segue a partir de um estado válido.
 */

export const STORAGE_KEY = 'oficina-do-amanha:progresso';
export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  state: GameState;
}

export type LoadResult =
  | { status: 'ok'; state: GameState; repaired: boolean }
  | { status: 'empty' }
  | { status: 'invalid'; reason: string }
  | { status: 'unavailable' };

/** Retorna o localStorage se ele puder ser usado; caso contrário, null. */
export function detectStorage(candidate?: Storage | null): Storage | null {
  try {
    const storage = candidate === undefined ? window.localStorage : candidate;
    if (!storage) return null;
    const probe = `${STORAGE_KEY}:teste`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function loadGame(storage: Storage | null): LoadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'O arquivo de progresso está corrompido.' };
  }
  if (!isObject(parsed) || typeof parsed.version !== 'number') {
    return { status: 'invalid', reason: 'O progresso salvo não tem um formato reconhecido.' };
  }
  if (parsed.version !== SAVE_VERSION) {
    return { status: 'invalid', reason: `O progresso foi salvo em outra versão do jogo (${String(parsed.version)}).` };
  }
  const result = sanitizeState(parsed.state);
  if (!result) return { status: 'invalid', reason: 'O progresso salvo está incompleto.' };
  return { status: 'ok', state: result.state, repaired: result.repaired };
}

export function saveGame(storage: Storage | null, state: GameState): boolean {
  if (!storage) return false;
  try {
    const file: SaveFile = { version: SAVE_VERSION, state };
    storage.setItem(STORAGE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(storage: Storage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

const STEPS: Step[] = ['briefing', 'investigate', 'build', 'test', 'result'];
const SCREENS: Screen[] = ['welcome', 'workshop', 'mission'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function sanitizeState(raw: unknown): { state: GameState; repaired: boolean } | null {
  if (!isObject(raw)) return null;
  let repaired = false;

  const runs: Partial<Record<VariationId, MissionRun>> = {};
  if (isObject(raw.runs)) {
    for (const [key, value] of Object.entries(raw.runs)) {
      const run = isVariationId(key) ? sanitizeRun(key, value) : null;
      if (run) {
        runs[key as VariationId] = run.run;
        repaired ||= run.repaired;
      } else repaired = true;
    }
  }

  const completions: Partial<Record<VariationId, Completion>> = {};
  if (isObject(raw.completions)) {
    for (const [key, value] of Object.entries(raw.completions)) {
      if (isVariationId(key) && isObject(value) && typeof value.times === 'number' && typeof value.bestScore === 'number') {
        completions[key] = { times: value.times, bestScore: value.bestScore, attempts: typeof value.attempts === 'number' ? value.attempts : 1 };
      } else repaired = true;
    }
  }

  const badges = isStringArray(raw.badges) ? (raw.badges.filter((b) => b in BADGES) as BadgeId[]) : [];
  let active = isVariationId(raw.active) && runs[raw.active] ? (raw.active as VariationId) : null;
  let screen: Screen = SCREENS.includes(raw.screen as Screen) ? (raw.screen as Screen) : 'welcome';
  if (screen === 'mission' && !active) {
    screen = 'workshop';
    repaired = true;
  }
  if (raw.active && !active) {
    active = null;
    repaired = true;
  }
  return { state: { screen, active, runs, completions, badges }, repaired };
}

function sanitizeRun(variationId: VariationId, raw: unknown): { run: MissionRun; repaired: boolean } | null {
  if (!isObject(raw)) return null;
  const { variation } = getVariation(variationId);
  let repaired = false;

  const questionIds = new Set(variation.questions.map((q) => q.id));
  const factIds = new Set(variation.facts.map((f) => f.id));
  const asked = isStringArray(raw.asked) ? raw.asked.filter((id) => questionIds.has(id)) : [];
  const discovered = isStringArray(raw.discovered) ? raw.discovered.filter((id) => factIds.has(id)) : [];

  const assembly: AssembledBlock[] = [];
  if (Array.isArray(raw.assembly)) {
    for (const item of raw.assembly) {
      if (isObject(item) && typeof item.blockId === 'string' && typeof item.text === 'string' && variation.blockRoles[item.blockId]) {
        if (!assembly.some((a) => a.blockId === item.blockId)) assembly.push({ blockId: item.blockId, text: item.text.slice(0, 600) });
      } else repaired = true;
    }
  }

  const attempts: AttemptSummary[] = [];
  if (Array.isArray(raw.attempts)) {
    for (const a of raw.attempts) {
      if (isObject(a) && isStringArray(a.blockIds) && isStringArray(a.flags) && typeof a.score === 'number' && isObject(a.criteria) && isObject(a.tests)) {
        attempts.push({
          number: typeof a.number === 'number' ? a.number : attempts.length + 1,
          blockIds: a.blockIds,
          editedBlockIds: isStringArray(a.editedBlockIds) ? a.editedBlockIds : [],
          flags: a.flags as AttemptSummary['flags'],
          score: a.score,
          max: typeof a.max === 'number' ? a.max : 10,
          criteria: a.criteria as AttemptSummary['criteria'],
          tests: sanitizeTests(a.tests),
        });
      } else repaired = true;
    }
  }

  let sim: Simulation | null = null;
  if (raw.sim !== null && raw.sim !== undefined) {
    if (isValidSim(raw.sim, variation.tool.kind) && attempts.length > 0) sim = raw.sim as Simulation;
    else repaired = true;
  }

  let step: Step = STEPS.includes(raw.step as Step) ? (raw.step as Step) : 'briefing';
  let furthest: Step = STEPS.includes(raw.furthest as Step) ? (raw.furthest as Step) : step;
  const completed = raw.completed === true;
  if (step === 'test' && !sim) {
    step = 'build';
    repaired = true;
  }
  if (step === 'result' && !completed) {
    step = sim ? 'test' : 'build';
    repaired = true;
  }
  if (STEPS.indexOf(furthest) < STEPS.indexOf(step)) furthest = step;

  const help: MissionRun['help'] = {};
  if (isObject(raw.help)) {
    for (const [k, v] of Object.entries(raw.help)) {
      if (STEPS.includes(k as Step) && typeof v === 'number') help[k as Step] = Math.max(0, Math.min(3, v));
    }
  }

  return {
    run: {
      variationId,
      step,
      furthest,
      asked,
      discovered,
      assembly,
      help,
      attempts,
      sim,
      simResetNotice: raw.simResetNotice === true,
      completed,
    },
    repaired,
  };
}

function sanitizeTests(raw: Record<string, unknown>): Record<string, TestResult> {
  const out: Record<string, TestResult> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isObject(v) && typeof v.status === 'string' && typeof v.message === 'string' && ['pendente', 'passou', 'falhou', 'inconclusivo'].includes(v.status)) {
      out[k] = { status: v.status as TestResult['status'], message: v.message };
    }
  }
  return out;
}

function isValidSim(raw: unknown, kind: string): boolean {
  if (!isObject(raw) || !isObject(raw.tool) || !Array.isArray(raw.events) || typeof raw.seq !== 'number') return false;
  const tool = raw.tool;
  if (tool.kind !== kind) return false;
  if (kind === 'inventory') return Array.isArray(tool.lots) && tool.lots.every((l) => isObject(l) && typeof l.qty === 'number' && typeof l.product === 'string');
  if (kind === 'enrollment')
    return Array.isArray(tool.courses) && tool.courses.every((c) => isObject(c) && isStringArray(c.confirmed) && isStringArray(c.waitlist));
  if (kind === 'schedule')
    return Array.isArray(tool.reservations) && tool.reservations.every((r) => isObject(r) && typeof r.start === 'number' && typeof r.end === 'number');
  return false;
}
