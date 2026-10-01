import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getVariation } from '../src/content';
import { essentialBlockIds } from '../src/evaluation/evaluate';
import type { VariationId } from '../src/types';
import { addBlock, askAll, freshStart, openVariation, runAllTests } from './helpers';

/** Auditoria automática (axe-core) com regras WCAG 2.0/2.1 A e AA, incluindo contraste de cores. */
async function audit(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${screen}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(summary).toEqual([]);
}

test('telas principais sem violações WCAG A/AA detectáveis automaticamente', async ({ page }) => {
  const id: VariationId = 'agenda-b';
  const { scenario, variation } = getVariation(id);
  await freshStart(page);
  await audit(page, 'boas-vindas');
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await audit(page, 'oficina');
  await openVariation(page, id);
  await audit(page, 'missão');
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await askAll(page, id);
  await page.getByRole('button', { name: 'AJUDA', exact: true }).click();
  await page.getByRole('button', { name: 'Ver uma pista' }).click();
  await audit(page, 'investigação');
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  for (const b of essentialBlockIds(scenario, variation).slice(0, 4)) await addBlock(page, id, b);
  await addBlock(page, id, 'a-res-semcancelar');
  await page.locator('.assembled').first().getByRole('button', { name: 'EDITAR TEXTO' }).click();
  await audit(page, 'montagem');
  await page.getByRole('button', { name: 'CONCLUIR EDIÇÃO' }).click();
  for (const b of essentialBlockIds(scenario, variation).slice(4)) await addBlock(page, id, b);
  await page.getByRole('button', { name: /^REMOVER: “Não permitir cancelamentos/ }).click();
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  await runAllTests(page, id);
  await audit(page, 'testes');
  await page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first().click();
  await audit(page, 'resultado');
  await page.getByRole('button', { name: 'Progresso' }).click();
  await audit(page, 'diálogo de progresso');
});
