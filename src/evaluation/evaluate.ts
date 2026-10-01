import type {
  BlockCategory,
  BlockConflict,
  BlockNote,
  CriterionId,
  CriterionResult,
  CriterionStatus,
  Evaluation,
  PromptBlock,
  Scenario,
  SimFlag,
  Variation,
} from '../types';

/**
 * Avaliação determinística do pedido.
 *
 * Considera SOMENTE os identificadores dos blocos escolhidos e os metadados
 * definidos no conteúdo (categoria, papel na variação, capacidades e conflitos).
 * O texto editado pelo jogador é preservado, mas não é interpretado.
 * Tamanho do pedido, palavras técnicas, ordem e uso de ajuda não alteram a nota.
 */

export const CRITERIA: { id: CriterionId; title: string; everyday: string; categories: BlockCategory[] }[] = [
  { id: 'objetivo', title: 'Clareza do objetivo', everyday: 'Dá para entender o que você quer?', categories: ['objetivo'] },
  { id: 'contexto', title: 'Contexto relevante', everyday: 'A IA sabe onde e por que isso vai ser usado?', categories: ['contexto'] },
  {
    id: 'requisitos',
    title: 'Requisitos necessários',
    everyday: 'O pedido diz o que registrar, o que fazer e o que mostrar?',
    categories: ['dados', 'acoes', 'resultado'],
  },
  { id: 'restricoes', title: 'Restrições', everyday: 'O pedido diz quais limites e cuidados respeitar?', categories: ['restricoes'] },
  { id: 'verificacao', title: 'Critérios de verificação', everyday: 'O pedido diz como conferir se funciona?', categories: ['verificacao'] },
];

const POINTS: Record<CriterionStatus, number> = { completo: 2, parcial: 1, ausente: 0 };
const NOISE = new Set(['vago', 'irrelevante', 'prejudicial']);

export function availableBlocks(scenario: Scenario, variation: Variation): PromptBlock[] {
  return scenario.blocks.filter((b) => variation.blockRoles[b.id]);
}

/** Pares de blocos escolhidos que se contradizem. */
export function findConflicts(scenario: Scenario, selected: readonly string[]): BlockConflict[] {
  const set = new Set(selected);
  return scenario.conflicts.filter((c) => set.has(c.a) && set.has(c.b));
}

/** Capacidades ligadas na simulação: união das capacidades dos blocos escolhidos. */
export function flagsFor(scenario: Scenario, variation: Variation, selected: readonly string[]): SimFlag[] {
  const flags = new Set<SimFlag>();
  for (const id of new Set(selected)) {
    if (!variation.blockRoles[id]) continue;
    const block = scenario.blocks.find((b) => b.id === id);
    block?.grants?.forEach((f) => flags.add(f));
  }
  return [...flags].sort();
}

function evaluateCriterion(
  scenario: Scenario,
  variation: Variation,
  selected: Set<string>,
  def: (typeof CRITERIA)[number],
): CriterionResult {
  const inCategory = scenario.blocks.filter((b) => def.categories.includes(b.category) && variation.blockRoles[b.id]);
  const essentials = inCategory.filter((b) => variation.blockRoles[b.id].quality === 'essencial');
  const chosen = inCategory.filter((b) => selected.has(b.id));
  const chosenEssentials = essentials.filter((b) => selected.has(b.id));
  const chosenUseful = chosen.filter((b) => variation.blockRoles[b.id].quality === 'util');
  const noise = chosen.filter((b) => NOISE.has(variation.blockRoles[b.id].quality));
  const missing = essentials.filter((b) => !selected.has(b.id));

  let status: CriterionStatus;
  if (missing.length === 0 && noise.length === 0 && essentials.length > 0) status = 'completo';
  else if (chosenEssentials.length > 0 || chosenUseful.length > 0) status = 'parcial';
  else status = 'ausente';

  const feedback: string[] = [];
  if (status === 'completo') feedback.push(completeText[def.id]);
  if (chosen.length === 0) feedback.push(emptyText[def.id]);
  for (const b of missing) {
    const hint = variation.blockRoles[b.id].missing;
    if (hint) feedback.push(hint);
  }
  if (missing.length > 0 && chosen.length > 0 && !missing.some((b) => variation.blockRoles[b.id].missing)) {
    feedback.push('Ainda falta algo importante nesta parte. Consulte o painel “O que já descobrimos”.');
  }
  for (const b of noise) feedback.push(variation.blockRoles[b.id].feedback);

  return { id: def.id, status, points: POINTS[status], feedback };
}

const completeText: Record<CriterionId, string> = {
  objetivo: 'O objetivo diz claramente o que a ferramenta precisa resolver.',
  contexto: 'O contexto explica onde a ferramenta será usada e qual problema existe hoje.',
  requisitos: 'O pedido diz o que registrar, quais ações e regras seguir e o que mostrar.',
  restricoes: 'Os limites e cuidados importantes foram informados.',
  verificacao: 'O pedido descreve situações concretas para conferir se a solução funciona.',
};

const emptyText: Record<CriterionId, string> = {
  objetivo: 'Nenhum objetivo foi escolhido. Sem ele, a IA precisa adivinhar o que você quer.',
  contexto: 'Nenhum contexto foi escolhido. A IA não sabe quem vai usar nem qual problema existe hoje.',
  requisitos: 'O pedido não diz o que a ferramenta precisa registrar ou fazer.',
  restricoes: 'Nenhum limite ou cuidado foi informado.',
  verificacao: 'O pedido não diz como conferir se a ferramenta funciona. Sem isso, falhas passam despercebidas.',
};

export function evaluatePrompt(scenario: Scenario, variation: Variation, selectedIds: readonly string[]): Evaluation {
  // Repetir um bloco não conta duas vezes.
  const selected = new Set(selectedIds.filter((id) => variation.blockRoles[id]));
  const criteria = CRITERIA.map((def) => evaluateCriterion(scenario, variation, selected, def));
  const notes: BlockNote[] = [...selected].map((id) => ({
    blockId: id,
    quality: variation.blockRoles[id].quality,
    feedback: variation.blockRoles[id].feedback,
  }));
  return {
    criteria,
    total: criteria.reduce((sum, c) => sum + c.points, 0),
    max: CRITERIA.length * 2,
    conflicts: findConflicts(scenario, [...selected]),
    notes,
    flags: flagsFor(scenario, variation, [...selected]),
  };
}

/** Capacidades necessárias para a variação: as concedidas pelos blocos essenciais. */
export function requiredFlags(scenario: Scenario, variation: Variation): SimFlag[] {
  const essentials = Object.entries(variation.blockRoles)
    .filter(([, role]) => role.quality === 'essencial')
    .map(([id]) => id);
  return flagsFor(scenario, variation, essentials);
}

/** Pedido de referência (todos os essenciais) — usado em testes e na ajuda direta. */
export function essentialBlockIds(scenario: Scenario, variation: Variation): string[] {
  return scenario.blocks.filter((b) => variation.blockRoles[b.id]?.quality === 'essencial').map((b) => b.id);
}
