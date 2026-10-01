import type { GameState, Scenario, VariationId } from '../types';

export type ScenarioChoice =
  | { kind: 'open'; variationId: VariationId; resume: boolean }
  | { kind: 'choose'; options: VariationId[] };

/**
 * Decide qual variação abrir ao escolher um cenário:
 * 1. uma variação ainda não concluída que já está em andamento;
 * 2. senão, a primeira variação ainda não concluída;
 * 3. com as duas concluídas, o jogador escolhe qual repetir.
 */
export function chooseVariation(scenario: Scenario, state: Pick<GameState, 'runs' | 'completions'>): ScenarioChoice {
  const notDone = scenario.variations.filter((v) => !state.completions[v.id]);
  if (notDone.length > 0) {
    const inProgress = notDone.find((v) => {
      const run = state.runs[v.id];
      return run && !run.completed;
    });
    const pick = inProgress ?? notDone[0];
    return { kind: 'open', variationId: pick.id, resume: Boolean(inProgress) };
  }
  return { kind: 'choose', options: scenario.variations.map((v) => v.id) };
}

export type ScenarioStatus = 'nova' | 'andamento' | 'parcial' | 'concluida';

export function scenarioStatus(scenario: Scenario, state: Pick<GameState, 'runs' | 'completions'>): ScenarioStatus {
  const done = scenario.variations.filter((v) => state.completions[v.id]).length;
  if (done === scenario.variations.length) return 'concluida';
  const started = scenario.variations.some((v) => {
    const run = state.runs[v.id];
    return run && !run.completed && (run.asked.length > 0 || run.step !== 'briefing');
  });
  if (started) return 'andamento';
  if (done > 0) return 'parcial';
  return 'nova';
}

/** A orientação fica mais curta depois da primeira missão concluída (a ajuda continua disponível). */
export function guidanceLevel(state: Pick<GameState, 'completions'>): 'completa' | 'curta' {
  return Object.keys(state.completions).length === 0 ? 'completa' : 'curta';
}
