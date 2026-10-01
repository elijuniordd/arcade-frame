import type { Scenario, ScenarioId, Variation, VariationId } from '../types';
import { doacoes } from './scenarios/doacoes';
import { vagas } from './scenarios/vagas';
import { agenda } from './scenarios/agenda';

/** Ordem sugerida para iniciantes. */
export const SCENARIOS: Scenario[] = [doacoes, vagas, agenda];

export const VARIATION_IDS: VariationId[] = SCENARIOS.flatMap((s) => s.variations.map((v) => v.id));

export function getScenario(id: ScenarioId): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Cenário desconhecido: ${id}`);
  return s;
}

export function getVariation(id: VariationId): { scenario: Scenario; variation: Variation } {
  for (const scenario of SCENARIOS) {
    const variation = scenario.variations.find((v) => v.id === id);
    if (variation) return { scenario, variation };
  }
  throw new Error(`Variação desconhecida: ${id}`);
}

export function isVariationId(value: unknown): value is VariationId {
  return typeof value === 'string' && (VARIATION_IDS as string[]).includes(value);
}
