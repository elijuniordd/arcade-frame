import { describe, expect, it } from 'vitest';
import { getVariation } from '../content';
import { essentialBlockIds, evaluatePrompt, findConflicts, flagsFor } from './evaluate';

const { scenario, variation } = getVariation('doacoes-a');
const essentials = essentialBlockIds(scenario, variation);
const status = (ids: string[], id: string) => evaluatePrompt(scenario, variation, ids).criteria.find((c) => c.id === id)!;

describe('avaliação determinística do pedido', () => {
  it('pedido completo recebe a pontuação máxima', () => {
    const e = evaluatePrompt(scenario, variation, essentials);
    expect(e.total).toBe(10);
    expect(e.criteria.every((c) => c.status === 'completo')).toBe(true);
  });

  it('pedido vazio recebe zero, com feedback para cada critério', () => {
    const e = evaluatePrompt(scenario, variation, []);
    expect(e.total).toBe(0);
    for (const c of e.criteria) expect(c.feedback.length).toBeGreaterThan(0);
  });

  it('é determinística: a mesma seleção sempre gera o mesmo resultado', () => {
    expect(evaluatePrompt(scenario, variation, essentials)).toEqual(evaluatePrompt(scenario, variation, essentials));
  });

  it('a ordem dos blocos não altera a nota', () => {
    const reversed = [...essentials].reverse();
    expect(evaluatePrompt(scenario, variation, reversed).total).toBe(evaluatePrompt(scenario, variation, essentials).total);
  });

  it('não recompensa repetição', () => {
    expect(evaluatePrompt(scenario, variation, [...essentials, ...essentials]).total).toBe(10);
  });

  it('não recompensa pedidos longos: blocos que não ajudam deixam o critério parcial', () => {
    const longer = [...essentials, 'd-ctx-historia', 'd-resu-grafico', 'd-ver-vago'];
    const e = evaluatePrompt(scenario, variation, longer);
    expect(e.total).toBeLessThan(10);
    expect(status(longer, 'contexto').status).toBe('parcial');
    expect(status(longer, 'contexto').feedback.join(' ')).toMatch(/história/);
  });

  it('feedback específico indica o que falta', () => {
    const without = essentials.filter((id) => id !== 'd-aco-limite');
    const req = status(without, 'requisitos');
    expect(req.status).toBe('parcial');
    expect(req.feedback.join(' ')).toMatch(/retirar mais do que existe/);
  });

  it('objetivo apenas vago conta como ausente', () => {
    expect(status(['d-obj-vago'], 'objetivo').status).toBe('ausente');
  });

  it('identifica blocos incompatíveis', () => {
    const conflicts = findConflicts(scenario, [...essentials, 'd-res-negativo']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].explanation).toMatch(/não consegue seguir os dois/);
  });

  it('os blocos escolhidos determinam as capacidades da simulação', () => {
    expect(flagsFor(scenario, variation, ['d-aco-entrada'])).toEqual(['inv.entries']);
    expect(flagsFor(scenario, variation, essentials)).toEqual(['inv.entries', 'inv.exits', 'inv.stockCheck']);
  });

  it('blocos que não pertencem à variação são ignorados', () => {
    const { variation: other } = getVariation('vagas-a');
    expect(evaluatePrompt(scenario, variation, Object.keys(other.blockRoles)).total).toBe(0);
  });
});
