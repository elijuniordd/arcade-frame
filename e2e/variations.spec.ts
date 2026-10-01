import { expect, test } from '@playwright/test';
import { getVariation } from '../src/content';
import { essentialBlockIds } from '../src/evaluation/evaluate';
import type { VariationId } from '../src/types';
import { addBlock, askAll, expectTestStatus, openVariation, runAllTests } from './helpers';

const IDS: VariationId[] = ['doacoes-a', 'doacoes-b', 'vagas-a', 'vagas-b', 'agenda-a', 'agenda-b'];

test.describe('as seis variações podem ser concluídas pela interface', () => {
  for (const id of IDS) {
    test(id, async ({ page }) => {
      const { scenario, variation } = getVariation(id);
      await openVariation(page, id);
      await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
      await askAll(page, id);
      const essential = variation.facts.filter((f) => f.essential).length;
      await expect(page.locator('#descobertas')).toContainText(`Informações essenciais: ${essential} de ${essential}`);
      await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
      for (const b of essentialBlockIds(scenario, variation)) await addBlock(page, id, b);
      await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
      await runAllTests(page, id);
      for (let i = 0; i < variation.tests.length; i++) await expectTestStatus(page, i, 'Passou');
      await page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first().click();
      await expect(page.getByRole('heading', { name: 'Missão concluída!' })).toBeVisible();
    });
  }
});

test('testes feitos manualmente na ferramenta também contam (agenda A)', async ({ page }) => {
  const id: VariationId = 'agenda-a';
  const { scenario, variation } = getVariation(id);
  await openVariation(page, id);
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  // Sem a regra de conflito: a reserva sobreposta deve ser aceita (falha detectável).
  for (const b of essentialBlockIds(scenario, variation).filter((b) => b !== 'a-aco-conflito')) await addBlock(page, id, b);
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  const tool = page.locator('.tool');
  await tool.getByRole('combobox', { name: 'Espaço' }).selectOption({ label: 'Salão principal' });
  await tool.getByRole('combobox', { name: 'Início' }).selectOption({ label: '15:00' });
  await tool.getByRole('combobox', { name: 'Fim' }).selectOption({ label: '17:00' });
  await tool.getByRole('button', { name: 'Reservar' }).click();
  await expectTestStatus(page, 1, 'Falhou');
  await expect(tool.locator('.log__latest')).toContainText('Reserva confirmada');
});
