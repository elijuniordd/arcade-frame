import { expect, type Page } from '@playwright/test';
import { getVariation } from '../src/content';
import { newRun } from '../src/engine/reducer';
import { SAVE_VERSION, STORAGE_KEY } from '../src/persistence/storage';
import type { VariationId } from '../src/types';

export const blockText = (variationId: VariationId, blockId: string) => {
  const { scenario } = getVariation(variationId);
  return scenario.blocks.find((b) => b.id === blockId)!.text;
};

/** Começa do zero (sem progresso salvo). */
export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/** Abre diretamente uma variação, gravando um progresso salvo válido antes de carregar. */
export async function openVariation(page: Page, id: VariationId) {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: STORAGE_KEY,
      value: JSON.stringify({
        version: SAVE_VERSION,
        state: { screen: 'mission', active: id, runs: { [id]: newRun(id) }, completions: {}, badges: [] },
      }),
    },
  );
  await page.reload();
}

export async function askAll(page: Page, id: VariationId) {
  const { variation } = getVariation(id);
  for (const q of variation.questions) await page.getByRole('button', { name: q.text, exact: true }).click();
}

/** Adiciona um bloco ao pedido, abrindo a categoria se ela estiver fechada. */
export async function addBlock(page: Page, id: VariationId, blockId: string) {
  const text = blockText(id, blockId);
  const details = page.locator('details.category', { hasText: text });
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator('summary').click();
  await page.getByRole('button', { name: `Adicionar ao pedido: ${text}`, exact: true }).click();
}

export async function runAllTests(page: Page, id: VariationId) {
  const { variation } = getVariation(id);
  for (let i = 1; i <= variation.tests.length; i++) {
    await page.getByRole('button', { name: new RegExp(`^Fazer o teste ${i} por mim`) }).click();
  }
}

export async function expectTestStatus(page: Page, index: number, status: 'Passou' | 'Falhou' | 'Não testado' | 'Inconclusivo') {
  const card = page.locator('li.test').nth(index);
  await expect(card.locator('.test__badge')).toHaveText(status);
}
