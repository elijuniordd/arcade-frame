import { describe, expect, it } from 'vitest';
import { getScenario, getVariation } from '../content';
import { essentialBlockIds } from '../evaluation/evaluate';
import type { GameState, VariationId } from '../types';
import { canVisit, currentAttempt, gameReducer, initialState, type GameAction } from './reducer';
import { chooseVariation, scenarioStatus } from './selection';

const play = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);
const runOf = (state: GameState, id: VariationId) => state.runs[id]!;

function investigateAll(state: GameState, id: VariationId): GameState {
  const { variation } = getVariation(id);
  return play(state, ...variation.questions.map((q) => ({ type: 'ASK', questionId: q.id }) as GameAction));
}

function addBlocks(state: GameState, ids: string[]): GameState {
  return play(state, ...ids.map((blockId) => ({ type: 'ADD_BLOCK', blockId }) as GameAction));
}

function runTests(state: GameState, id: VariationId): GameState {
  const { variation } = getVariation(id);
  return play(state, ...variation.tests.map((t) => ({ type: 'RUN_TEST', testId: t.id }) as GameAction));
}

describe('fluxo investigar → montar → testar → revisar → concluir', () => {
  it('conclui a missão depois de revisar um pedido incompleto', () => {
    const id: VariationId = 'doacoes-a';
    const { scenario, variation } = getVariation(id);
    let s = play(initialState(), { type: 'GO_WORKSHOP' }, { type: 'OPEN_VARIATION', variationId: id });
    expect(s.screen).toBe('mission');
    expect(runOf(s, id).step).toBe('briefing');

    s = play(s, { type: 'SET_STEP', step: 'investigate' });
    s = investigateAll(s, id);
    expect(runOf(s, id).discovered).toEqual(expect.arrayContaining(variation.facts.map((f) => f.id)));
    expect(s.badges).toContain('investigar');

    s = play(s, { type: 'SET_STEP', step: 'build' });
    // Primeiro pedido: falta a regra de estoque.
    const incomplete = essentialBlockIds(scenario, variation).filter((b) => b !== 'd-aco-limite');
    s = addBlocks(s, incomplete);
    s = play(s, { type: 'EXPERIMENT' });
    expect(runOf(s, id).step).toBe('test');
    s = runTests(s, id);
    const first = currentAttempt(runOf(s, id))!;
    expect(first.tests['t-excesso'].status).toBe('falhou');
    expect(first.tests['t-doacao'].status).toBe('passou');
    // Sem todos os testes passando, a missão não pode ser concluída.
    expect(play(s, { type: 'COMPLETE' })).toBe(s);

    // Revisar: volta à montagem, adiciona o bloco e experimenta de novo.
    s = play(s, { type: 'SET_STEP', step: 'build' }, { type: 'ADD_BLOCK', blockId: 'd-aco-limite' }, { type: 'EXPERIMENT' });
    const run = runOf(s, id);
    expect(run.attempts).toHaveLength(2);
    expect(run.simResetNotice).toBe(true);
    expect(run.sim!.events).toHaveLength(0); // simulação recriada a partir dos dados iniciais
    expect(run.attempts[0].tests['t-excesso'].status).toBe('falhou'); // histórico preservado

    s = runTests(s, id);
    expect(Object.values(currentAttempt(runOf(s, id))!.tests).every((t) => t.status === 'passou')).toBe(true);
    s = play(s, { type: 'COMPLETE' });
    expect(runOf(s, id).step).toBe('result');
    expect(runOf(s, id).completed).toBe(true);
    expect(s.completions[id]).toEqual({ times: 1, bestScore: 10, attempts: 2 });
    expect(s.badges).toEqual(expect.arrayContaining(['investigar', 'testar', 'melhorar', 'doacoes', 'comunicar']));

    // Melhorar a solução volta à montagem mantendo o pedido.
    s = play(s, { type: 'IMPROVE' });
    expect(runOf(s, id).step).toBe('build');
    expect(runOf(s, id).assembly.length).toBeGreaterThan(0);
  });

  it('blocos incompatíveis impedem a experimentação até serem ajustados', () => {
    const id: VariationId = 'doacoes-a';
    const { scenario, variation } = getVariation(id);
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' }, { type: 'SET_STEP', step: 'build' });
    s = addBlocks(s, [...essentialBlockIds(scenario, variation), 'd-res-negativo']);
    expect(play(s, { type: 'EXPERIMENT' })).toBe(s);
    s = play(s, { type: 'REMOVE_BLOCK', blockId: 'd-res-negativo' }, { type: 'EXPERIMENT' });
    expect(runOf(s, id).step).toBe('test');
  });

  it('usar ajuda não altera a pontuação', () => {
    const id: VariationId = 'vagas-a';
    const { scenario, variation } = getVariation(id);
    const base = play(initialState(), { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' }, { type: 'SET_STEP', step: 'build' });
    const blocks = essentialBlockIds(scenario, variation).slice(0, 6);
    const withoutHelp = play(addBlocks(base, blocks), { type: 'EXPERIMENT' });
    const withHelp = play(
      addBlocks(base, blocks),
      { type: 'USE_HELP', step: 'investigate', level: 3 },
      { type: 'USE_HELP', step: 'build', level: 3 },
      { type: 'EXPERIMENT' },
    );
    expect(currentAttempt(runOf(withHelp, id))!.score).toBe(currentAttempt(runOf(withoutHelp, id))!.score);
    expect(runOf(withHelp, id).help.build).toBe(3);
  });

  it('editar o texto preserva a edição, mas não muda as regras da simulação', () => {
    const id: VariationId = 'agenda-a';
    const { scenario, variation } = getVariation(id);
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' }, { type: 'SET_STEP', step: 'build' });
    s = addBlocks(s, essentialBlockIds(scenario, variation));
    const before = play(s, { type: 'EXPERIMENT' });
    s = play(s, { type: 'EDIT_BLOCK', blockId: 'a-aco-conflito', text: 'Pode aceitar qualquer horário.' }, { type: 'EXPERIMENT' });
    expect(runOf(s, id).assembly.find((a) => a.blockId === 'a-aco-conflito')!.text).toBe('Pode aceitar qualquer horário.');
    expect(currentAttempt(runOf(s, id))!.flags).toEqual(currentAttempt(runOf(before, id))!.flags);
    expect(currentAttempt(runOf(s, id))!.editedBlockIds).toEqual(['a-aco-conflito']);
  });

  it('organizar e mover blocos muda apenas a ordem', () => {
    const id: VariationId = 'doacoes-a';
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' }, { type: 'SET_STEP', step: 'build' });
    s = addBlocks(s, ['d-ver-excesso', 'd-obj-estoque', 'd-ctx-ponto']);
    s = play(s, { type: 'MOVE_BLOCK', blockId: 'd-ctx-ponto', to: 0 });
    expect(runOf(s, id).assembly.map((a) => a.blockId)).toEqual(['d-ctx-ponto', 'd-ver-excesso', 'd-obj-estoque']);
    s = play(s, { type: 'SORT_BLOCKS' });
    expect(runOf(s, id).assembly.map((a) => a.blockId)).toEqual(['d-obj-estoque', 'd-ctx-ponto', 'd-ver-excesso']);
  });

  it('não permite pular para etapas ainda não liberadas', () => {
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: 'agenda-b' });
    s = play(s, { type: 'SET_STEP', step: 'test' });
    expect(runOf(s, 'agenda-b').step).toBe('briefing');
    expect(canVisit(runOf(s, 'agenda-b'), 'result')).toBe(false);
  });
});

describe('reiniciar e apagar', () => {
  it('reiniciar a missão recomeça só a missão atual e mantém as conclusões', () => {
    let s = initialState();
    s = { ...s, completions: { 'vagas-a': { times: 1, bestScore: 8, attempts: 1 } }, badges: ['vagas'] };
    s = play(s, { type: 'OPEN_VARIATION', variationId: 'doacoes-a' }, { type: 'SET_STEP', step: 'investigate' }, { type: 'ASK', questionId: 'q-quem' });
    s = play(s, { type: 'RESTART_MISSION' });
    expect(runOf(s, 'doacoes-a').asked).toEqual([]);
    expect(runOf(s, 'doacoes-a').step).toBe('briefing');
    expect(s.completions['vagas-a']).toBeDefined();
    expect(s.badges).toEqual(['vagas']);
  });

  it('apagar tudo volta ao estado inicial', () => {
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: 'doacoes-a' }, { type: 'SET_STEP', step: 'investigate' });
    s = play(s, { type: 'RESET_ALL' });
    expect(s).toEqual(initialState());
  });
});

describe('escolha de variação ao repetir um cenário', () => {
  const scenario = getScenario('doacoes');

  it('começa pela variação A', () => {
    expect(chooseVariation(scenario, initialState())).toEqual({ kind: 'open', variationId: 'doacoes-a', resume: false });
  });

  it('prioriza a variação ainda não concluída', () => {
    const s: GameState = { ...initialState(), completions: { 'doacoes-a': { times: 1, bestScore: 10, attempts: 1 } } };
    expect(chooseVariation(scenario, s)).toEqual({ kind: 'open', variationId: 'doacoes-b', resume: false });
  });

  it('retoma uma variação em andamento', () => {
    const s = play(initialState(), { type: 'OPEN_VARIATION', variationId: 'doacoes-b' });
    expect(chooseVariation(scenario, s)).toEqual({ kind: 'open', variationId: 'doacoes-b', resume: true });
  });

  it('com as duas concluídas, deixa o jogador escolher', () => {
    const s: GameState = {
      ...initialState(),
      completions: { 'doacoes-a': { times: 1, bestScore: 10, attempts: 1 }, 'doacoes-b': { times: 1, bestScore: 9, attempts: 2 } },
    };
    expect(chooseVariation(scenario, s)).toEqual({ kind: 'choose', options: ['doacoes-a', 'doacoes-b'] });
    expect(scenarioStatus(scenario, s)).toBe('concluida');
  });

  it('abrir de novo uma variação concluída cria uma nova partida', () => {
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: 'doacoes-a' });
    s = { ...s, runs: { 'doacoes-a': { ...runOf(s, 'doacoes-a'), completed: true, step: 'result' } } };
    s = play(s, { type: 'OPEN_VARIATION', variationId: 'doacoes-a' });
    expect(runOf(s, 'doacoes-a').completed).toBe(false);
    expect(runOf(s, 'doacoes-a').step).toBe('briefing');
  });
});

describe('as seis variações podem ser concluídas pelo fluxo do jogo', () => {
  const ids: VariationId[] = ['doacoes-a', 'doacoes-b', 'vagas-a', 'vagas-b', 'agenda-a', 'agenda-b'];
  it.each(ids)('%s', (id) => {
    const { scenario, variation } = getVariation(id);
    let s = play(initialState(), { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' });
    s = investigateAll(s, id);
    s = play(s, { type: 'SET_STEP', step: 'build' });
    s = addBlocks(s, essentialBlockIds(scenario, variation));
    s = play(s, { type: 'EXPERIMENT' });
    s = runTests(s, id);
    s = play(s, { type: 'COMPLETE' });
    expect(runOf(s, id).completed).toBe(true);
  });

  it('concluir as seis concede a conquista da oficina', () => {
    let s = initialState();
    for (const id of ids) {
      const { scenario, variation } = getVariation(id);
      s = play(s, { type: 'OPEN_VARIATION', variationId: id }, { type: 'SET_STEP', step: 'investigate' }, { type: 'SET_STEP', step: 'build' });
      s = addBlocks(s, essentialBlockIds(scenario, variation));
      s = runTests(play(s, { type: 'EXPERIMENT' }), id);
      s = play(s, { type: 'COMPLETE' });
    }
    expect(s.badges).toContain('oficina');
  });
});
