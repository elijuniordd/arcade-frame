import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './index';
import { essentialBlockIds, evaluatePrompt, findConflicts, flagsFor, requiredFlags } from '../evaluation/evaluate';
import { allTestsPassed, applyAction, createSimulation, evaluateTests } from '../simulation';
import type { Scenario, SimFlag, Variation } from '../types';

/** Executa todos os testes da variação, na ordem, pelo botão “Fazer o teste por mim”. */
function runAllTests(variation: Variation, flags: SimFlag[]) {
  let sim = createSimulation(variation.tool);
  for (const t of variation.tests) {
    for (const a of t.autoActions) sim = applyAction(sim, variation.tool, flags, a, t.id);
  }
  return evaluateTests(variation.tests, sim.events, flags);
}

const allVariations: [Scenario, Variation][] = SCENARIOS.flatMap((s) => s.variations.map((v) => [s, v] as [Scenario, Variation]));

describe('integridade do conteúdo', () => {
  it('tem três cenários com duas variações cada', () => {
    expect(SCENARIOS).toHaveLength(3);
    expect(allVariations).toHaveLength(6);
  });

  it.each(allVariations.map(([s, v]) => [v.id, s, v] as const))('%s: referências válidas', (_id, scenario, variation) => {
    const blockIds = new Set(scenario.blocks.map((b) => b.id));
    for (const id of Object.keys(variation.blockRoles)) expect(blockIds.has(id), id).toBe(true);
    for (const c of scenario.conflicts) {
      expect(blockIds.has(c.a)).toBe(true);
      expect(blockIds.has(c.b)).toBe(true);
    }
    const factIds = new Set(variation.facts.map((f) => f.id));
    for (const q of variation.questions) for (const f of q.reveals) expect(factIds.has(f), f).toBe(true);
    expect(variation.tests).toHaveLength(3);
  });

  it.each(allVariations.map(([, v]) => [v.id, v] as const))('%s: as perguntas revelam todas as informações essenciais', (_id, variation) => {
    const revealed = new Set(variation.questions.flatMap((q) => q.reveals));
    for (const f of variation.facts) expect(revealed.has(f.id), f.id).toBe(true);
    // Toda pergunta explica sua utilidade; perguntas pouco úteis não revelam nada, mas explicam o que ajudaria mais.
    for (const q of variation.questions) expect(q.why.length).toBeGreaterThan(20);
  });

  it.each(allVariations.map(([s, v]) => [v.id, s, v] as const))('%s: todas as categorias têm um bloco essencial', (_id, scenario, variation) => {
    const categories = new Set(essentialBlockIds(scenario, variation).map((id) => scenario.blocks.find((b) => b.id === id)!.category));
    expect([...categories].sort()).toEqual(['acoes', 'contexto', 'dados', 'objetivo', 'restricoes', 'resultado', 'verificacao']);
  });

  it.each(allVariations.map(([s, v]) => [v.id, s, v] as const))('%s: há alternativas plausíveis (vagas, irrelevantes ou prejudiciais)', (_id, _s, variation) => {
    const qualities = new Set(Object.values(variation.blockRoles).map((r) => r.quality));
    expect(qualities.has('vago')).toBe(true);
    expect(qualities.has('irrelevante')).toBe(true);
    expect(qualities.has('prejudicial')).toBe(true);
  });
});

describe('as seis variações podem ser concluídas', () => {
  it.each(allVariations.map(([s, v]) => [v.id, s, v] as const))('%s: o pedido completo passa em todos os testes', (_id, scenario, variation) => {
    const ids = essentialBlockIds(scenario, variation);
    expect(findConflicts(scenario, ids)).toEqual([]);
    const evaluation = evaluatePrompt(scenario, variation, ids);
    expect(evaluation.total).toBe(evaluation.max);
    const results = runAllTests(variation, evaluation.flags);
    for (const t of variation.tests) expect(results[t.id].status, `${t.id}: ${results[t.id].message}`).toBe('passou');
    expect(allTestsPassed(variation.tests, results)).toBe(true);
  });
});

describe('pedidos incompletos geram falhas previsíveis', () => {
  // Remover cada bloco que liga uma capacidade necessária precisa fazer algum teste falhar.
  const cases = allVariations.flatMap(([scenario, variation]) =>
    essentialBlockIds(scenario, variation)
      .filter((id) => (scenario.blocks.find((b) => b.id === id)!.grants ?? []).length > 0)
      .map((id) => [`${variation.id} sem ${id}`, scenario, variation, id] as const),
  );

  it.each(cases)('%s', (_name, scenario, variation, removed) => {
    const ids = essentialBlockIds(scenario, variation).filter((id) => id !== removed);
    const flags = flagsFor(scenario, variation, ids);
    const results = runAllTests(variation, flags);
    const failed = variation.tests.filter((t) => results[t.id].status === 'falhou');
    expect(failed.length, JSON.stringify(results)).toBeGreaterThan(0);
  });

  it.each(allVariations.map(([s, v]) => [v.id, s, v] as const))('%s: blocos prejudiciais causam falhas ou conflitos', (_id, scenario, variation) => {
    const essentials = essentialBlockIds(scenario, variation);
    const harmful = Object.entries(variation.blockRoles)
      .filter(([, r]) => r.quality === 'prejudicial')
      .map(([id]) => id);
    for (const h of harmful) {
      const ids = [...essentials, h];
      const conflicts = findConflicts(scenario, ids);
      if (conflicts.length > 0) continue;
      const results = runAllTests(variation, flagsFor(scenario, variation, ids));
      const evaluation = evaluatePrompt(scenario, variation, ids);
      // Sem conflito explícito, o bloco prejudicial precisa ao menos reduzir a avaliação.
      expect(evaluation.total, h).toBeLessThan(evaluation.max);
      void results;
    }
  });
});

describe('copiar o pedido de outra variação não resolve tudo', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s', (_id, scenario) => {
    const [a, b] = scenario.variations;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      // Cada variação exige pelo menos uma capacidade diferente.
      const missing = requiredFlags(scenario, to).filter((f) => !requiredFlags(scenario, from).includes(f));
      expect(missing.length, `${from.id} → ${to.id}`).toBeGreaterThan(0);
      const copied = essentialBlockIds(scenario, from).filter((id) => to.blockRoles[id]);
      const results = runAllTests(to, flagsFor(scenario, to, copied));
      expect(allTestsPassed(to.tests, results), `${from.id} → ${to.id}`).toBe(false);
    }
  });
});

describe('alternativas plausíveis, mas erradas, falham nos testes', () => {
  const swap = (variationId: string, remove: string, add: string) => {
    const [scenario, variation] = allVariations.find(([, v]) => v.id === variationId)!;
    const ids = [...essentialBlockIds(scenario, variation).filter((id) => id !== remove), add];
    expect(findConflicts(scenario, ids)).toEqual([]);
    return runAllTests(variation, flagsFor(scenario, variation, ids));
  };

  it('estoque: “nunca bloquear” no lugar da regra de limite deixa o estoque negativo', () => {
    expect(swap('doacoes-a', 'd-aco-limite', 'd-res-negativo')['t-excesso'].status).toBe('falhou');
  });

  it('agenda: exigir 1 hora de intervalo recusa horários colados', () => {
    const r = swap('agenda-a', 'a-aco-conflito', 'a-aco-intervalo');
    expect(r['t-livre'].status).toBe('falhou');
    expect(r['t-conflito'].status).toBe('passou');
  });

  it('fila: chamar o último da lista fura a fila', () => {
    const [scenario, variation] = allVariations.find(([, v]) => v.id === 'vagas-b')!;
    const ids = [...essentialBlockIds(scenario, variation).filter((id) => id !== 'v-aco-promover' && id !== 'v-res-justica'), 'v-aco-ultimo'];
    const r = runAllTests(variation, flagsFor(scenario, variation, ids));
    expect(r['t-promocao'].status).toBe('falhou');
  });

  it('inscrições: “nunca recusar” no lugar do limite lota a turma', () => {
    expect(swap('vagas-a', 'v-aco-limite', 'v-res-lotar')['t-cheia'].status).toBe('falhou');
  });
});
