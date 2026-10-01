import { getVariation, SCENARIOS, VARIATION_IDS } from '../content';
import { CATEGORY_ORDER } from '../content/labels';
import { evaluatePrompt } from '../evaluation/evaluate';
import { allTestsPassed, applyAction, createSimulation, evaluateTests } from '../simulation';
import type {
  AttemptSummary,
  BadgeId,
  CriterionId,
  CriterionStatus,
  GameState,
  MissionRun,
  SimAction,
  Step,
  VariationId,
} from '../types';

export const STEP_ORDER: Step[] = ['briefing', 'investigate', 'build', 'test', 'result'];

export type GameAction =
  | { type: 'GO_WELCOME' }
  | { type: 'GO_WORKSHOP' }
  | { type: 'OPEN_VARIATION'; variationId: VariationId; fresh?: boolean }
  | { type: 'CONTINUE' }
  | { type: 'SET_STEP'; step: Step }
  | { type: 'ASK'; questionId: string }
  | { type: 'ADD_BLOCK'; blockId: string }
  | { type: 'REMOVE_BLOCK'; blockId: string }
  | { type: 'MOVE_BLOCK'; blockId: string; to: number }
  | { type: 'EDIT_BLOCK'; blockId: string; text: string }
  | { type: 'RESET_BLOCK_TEXT'; blockId: string }
  | { type: 'SORT_BLOCKS' }
  | { type: 'EXPERIMENT' }
  | { type: 'SIM_ACTION'; action: SimAction }
  | { type: 'RUN_TEST'; testId: string }
  | { type: 'DISMISS_RESET_NOTICE' }
  | { type: 'USE_HELP'; step: Step; level: number }
  | { type: 'COMPLETE' }
  | { type: 'IMPROVE' }
  | { type: 'RESTART_MISSION' }
  | { type: 'RESET_ALL' }
  | { type: 'LOAD'; state: GameState };

export function initialState(): GameState {
  return { screen: 'welcome', active: null, runs: {}, completions: {}, badges: [] };
}

export function newRun(variationId: VariationId): MissionRun {
  return {
    variationId,
    step: 'briefing',
    furthest: 'briefing',
    asked: [],
    discovered: [],
    assembly: [],
    help: {},
    attempts: [],
    sim: null,
    simResetNotice: false,
    completed: false,
  };
}

const stepIndex = (s: Step) => STEP_ORDER.indexOf(s);

export function canVisit(run: MissionRun, step: Step): boolean {
  switch (step) {
    case 'briefing':
    case 'investigate':
      return true;
    case 'build':
      return stepIndex(run.furthest) >= stepIndex('build');
    case 'test':
      return run.attempts.length > 0 && run.sim !== null;
    case 'result':
      return run.completed;
  }
}

function addBadges(badges: BadgeId[], ...more: BadgeId[]): BadgeId[] {
  const set = new Set(badges);
  more.forEach((b) => set.add(b));
  return [...set];
}

export function allEssentialFound(run: MissionRun): boolean {
  const { variation } = getVariation(run.variationId);
  return variation.facts.filter((f) => f.essential).every((f) => run.discovered.includes(f.id));
}

export function currentAttempt(run: MissionRun): AttemptSummary | undefined {
  return run.attempts[run.attempts.length - 1];
}

function withRun(state: GameState, run: MissionRun, extra: Partial<GameState> = {}): GameState {
  return { ...state, ...extra, runs: { ...state.runs, [run.variationId]: run } };
}

function activeRun(state: GameState): MissionRun | undefined {
  return state.active ? state.runs[state.active] : undefined;
}

function moveTo(run: MissionRun, step: Step): MissionRun {
  const furthest = stepIndex(step) > stepIndex(run.furthest) ? step : run.furthest;
  return { ...run, step, furthest };
}

/** Aplica ações na simulação e recalcula os resultados dos testes da tentativa atual. */
function simulate(run: MissionRun, actions: SimAction[], forTest?: string): MissionRun {
  const attempt = currentAttempt(run);
  if (!run.sim || !attempt) return run;
  const { variation } = getVariation(run.variationId);
  let sim = run.sim;
  for (const action of actions) sim = applyAction(sim, variation.tool, attempt.flags, action, forTest);
  const tests = evaluateTests(variation.tests, sim.events, attempt.flags);
  const attempts = [...run.attempts.slice(0, -1), { ...attempt, tests }];
  return { ...run, sim, attempts, simResetNotice: false };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOAD':
      return action.state;
    case 'RESET_ALL':
      return initialState();
    case 'GO_WELCOME':
      return { ...state, screen: 'welcome' };
    case 'GO_WORKSHOP':
      return { ...state, screen: 'workshop' };
    case 'CONTINUE': {
      const run = activeRun(state);
      return run ? { ...state, screen: 'mission' } : { ...state, screen: 'workshop' };
    }
    case 'OPEN_VARIATION': {
      if (!VARIATION_IDS.includes(action.variationId)) return state;
      const existing = state.runs[action.variationId];
      const run = existing && !existing.completed && !action.fresh ? existing : newRun(action.variationId);
      return withRun(state, run, { screen: 'mission', active: action.variationId });
    }
    case 'RESTART_MISSION': {
      if (!state.active) return state;
      return withRun(state, newRun(state.active), { screen: 'mission' });
    }
  }

  const run = activeRun(state);
  if (!run) return state;
  const { scenario, variation } = getVariation(run.variationId);

  switch (action.type) {
    case 'SET_STEP': {
      if (action.step === 'build' && stepIndex(run.furthest) < stepIndex('build')) {
        // Avançar da investigação para a montagem é sempre permitido.
        if (run.step !== 'investigate') return state;
        return withRun(state, moveTo(run, 'build'));
      }
      if (action.step === 'investigate' && run.step === 'briefing') return withRun(state, moveTo(run, 'investigate'));
      if (!canVisit(run, action.step)) return state;
      return withRun(state, moveTo(run, action.step));
    }
    case 'ASK': {
      const q = variation.questions.find((x) => x.id === action.questionId);
      if (!q || run.asked.includes(q.id)) return state;
      const discovered = [...run.discovered, ...q.reveals.filter((f) => !run.discovered.includes(f))];
      const next = { ...run, asked: [...run.asked, q.id], discovered };
      const badges = allEssentialFound(next) ? addBadges(state.badges, 'investigar') : state.badges;
      return withRun(state, next, { badges });
    }
    case 'ADD_BLOCK': {
      const block = scenario.blocks.find((b) => b.id === action.blockId);
      if (!block || !variation.blockRoles[block.id] || run.assembly.some((a) => a.blockId === block.id)) return state;
      return withRun(state, { ...run, assembly: [...run.assembly, { blockId: block.id, text: block.text }] });
    }
    case 'REMOVE_BLOCK':
      return withRun(state, { ...run, assembly: run.assembly.filter((a) => a.blockId !== action.blockId) });
    case 'MOVE_BLOCK': {
      const from = run.assembly.findIndex((a) => a.blockId === action.blockId);
      if (from < 0) return state;
      const to = Math.max(0, Math.min(run.assembly.length - 1, action.to));
      if (to === from) return state;
      const assembly = [...run.assembly];
      const [item] = assembly.splice(from, 1);
      assembly.splice(to, 0, item);
      return withRun(state, { ...run, assembly });
    }
    case 'EDIT_BLOCK':
      return withRun(state, {
        ...run,
        assembly: run.assembly.map((a) => (a.blockId === action.blockId ? { ...a, text: action.text.slice(0, 600) } : a)),
      });
    case 'RESET_BLOCK_TEXT': {
      const block = scenario.blocks.find((b) => b.id === action.blockId);
      if (!block) return state;
      return withRun(state, { ...run, assembly: run.assembly.map((a) => (a.blockId === action.blockId ? { ...a, text: block.text } : a)) });
    }
    case 'SORT_BLOCKS': {
      const cat = (id: string) => CATEGORY_ORDER.indexOf(scenario.blocks.find((b) => b.id === id)?.category ?? 'verificacao');
      const assembly = run.assembly
        .map((a, i) => ({ a, i }))
        .sort((x, y) => cat(x.a.blockId) - cat(y.a.blockId) || x.i - y.i)
        .map((x) => x.a);
      return withRun(state, { ...run, assembly });
    }
    case 'EXPERIMENT': {
      const ids = run.assembly.map((a) => a.blockId);
      if (ids.length === 0) return state;
      const evaluation = evaluatePrompt(scenario, variation, ids);
      if (evaluation.conflicts.length > 0) return state;
      const criteria = Object.fromEntries(evaluation.criteria.map((c) => [c.id, c.status])) as Record<CriterionId, CriterionStatus>;
      const sim = createSimulation(variation.tool);
      const attempt: AttemptSummary = {
        number: run.attempts.length + 1,
        blockIds: ids,
        editedBlockIds: run.assembly
          .filter((a) => a.text !== scenario.blocks.find((b) => b.id === a.blockId)?.text)
          .map((a) => a.blockId),
        flags: evaluation.flags,
        score: evaluation.total,
        max: evaluation.max,
        criteria,
        tests: evaluateTests(variation.tests, [], evaluation.flags),
      };
      const next = moveTo(
        { ...run, attempts: [...run.attempts, attempt], sim, simResetNotice: run.attempts.length > 0 },
        'test',
      );
      const badges = evaluation.total === evaluation.max ? addBadges(state.badges, 'comunicar') : state.badges;
      return withRun(state, next, { badges });
    }
    case 'SIM_ACTION': {
      if (run.step !== 'test') return state;
      const next = simulate(run, [action.action]);
      return withRun(state, next, { badges: testBadges(state.badges, next) });
    }
    case 'RUN_TEST': {
      if (run.step !== 'test') return state;
      const test = variation.tests.find((t) => t.id === action.testId);
      if (!test) return state;
      const next = simulate(run, test.autoActions, test.id);
      return withRun(state, next, { badges: testBadges(state.badges, next) });
    }
    case 'DISMISS_RESET_NOTICE':
      return withRun(state, { ...run, simResetNotice: false });
    case 'USE_HELP': {
      const level = Math.max(run.help[action.step] ?? 0, Math.min(3, action.level));
      return withRun(state, { ...run, help: { ...run.help, [action.step]: level } });
    }
    case 'COMPLETE': {
      const attempt = currentAttempt(run);
      if (!attempt || !allTestsPassed(variation.tests, attempt.tests)) return state;
      const prev = state.completions[run.variationId];
      const completions = {
        ...state.completions,
        [run.variationId]: {
          times: (prev?.times ?? 0) + (run.completed ? 0 : 1),
          bestScore: Math.max(prev?.bestScore ?? 0, attempt.score),
          attempts: run.attempts.length,
        },
      };
      const improved = run.attempts.slice(0, -1).some((a) => Object.values(a.tests).some((t) => t.status === 'falhou'));
      let badges = addBadges(state.badges, 'testar', scenario.id);
      if (improved) badges = addBadges(badges, 'melhorar');
      if (SCENARIOS.every((s) => s.variations.every((v) => completions[v.id]))) badges = addBadges(badges, 'oficina');
      return withRun(state, moveTo({ ...run, completed: true }, 'result'), { completions, badges });
    }
    case 'IMPROVE':
      return withRun(state, moveTo(run, 'build'));
    default:
      return state;
  }
}

function testBadges(badges: BadgeId[], run: MissionRun): BadgeId[] {
  const attempt = currentAttempt(run);
  if (!attempt) return badges;
  const allRun = Object.values(attempt.tests).every((t) => t.status !== 'pendente');
  return allRun ? addBadges(badges, 'testar') : badges;
}
