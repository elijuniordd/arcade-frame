import { expect, test, type Locator, type Page } from '@playwright/test';
import { getVariation } from '../src/content';
import { essentialBlockIds } from '../src/evaluation/evaluate';
import type { VariationId } from '../src/types';
import { blockText, freshStart } from './helpers';

/** Ativa um controle só pelo teclado: foco + Enter (ou Espaço). Nenhum clique de mouse. */
async function press(target: Locator, key: 'Enter' | 'Space' = 'Enter') {
  await target.focus();
  await expect(target).toBeFocused();
  await target.press(key);
}

async function openCategoryByKeyboard(page: Page, text: string) {
  const details = page.locator('details.category', { hasText: text });
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await press(details.locator('summary'));
}

test('fluxo completo apenas com o teclado', async ({ page }) => {
  const id: VariationId = 'doacoes-a';
  const { scenario, variation } = getVariation(id);
  await freshStart(page);

  // O primeiro Tab leva ao link “Pular para o conteúdo”.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();

  await press(page.getByRole('button', { name: 'COMEÇAR A JOGAR' }));
  // Ao trocar de tela, o foco vai para o título.
  await expect(page.getByRole('heading', { name: 'Mural de pedidos' })).toBeFocused();
  await press(page.getByRole('button', { name: 'ATENDER PEDIDO' }).first());
  await press(page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }), 'Space');
  await expect(page.getByRole('heading', { name: 'Converse com Dona Lúcia' })).toBeFocused();

  for (const q of variation.questions) await press(page.getByRole('button', { name: q.text, exact: true }));
  // Depois de perguntar, o foco vai para a resposta.
  await expect(page.locator('.exchange')).toBeFocused();
  await press(page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }));

  for (const b of essentialBlockIds(scenario, variation)) {
    const text = blockText(id, b);
    await openCategoryByKeyboard(page, text);
    await press(page.getByRole('button', { name: `Adicionar ao pedido: ${text}`, exact: true }));
  }
  // Reorganizar com botões (alternativa ao arrastar).
  const second = page.locator('.assembled').nth(1);
  const secondText = (await second.locator('.assembled__text').textContent()) ?? '';
  await press(second.getByRole('button', { name: /^Mover para cima/ }));
  await expect(page.locator('.assembled').first().locator('.assembled__text')).toHaveText(secondText);

  // Editar texto pelo teclado.
  await press(page.locator('.assembled').first().getByRole('button', { name: 'EDITAR TEXTO' }));
  await page.keyboard.type(' Por favor.');
  await press(page.getByRole('button', { name: 'CONCLUIR EDIÇÃO' }));
  await expect(page.locator('.assembled').first()).toContainText('Por favor.');

  await press(page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }));
  await expect(page.getByRole('heading', { name: 'Teste a ferramenta antes de entregar' })).toBeFocused();

  // Usa a ferramenta pelo teclado: registrar uma doação de feijão.
  const tool = page.locator('.tool');
  await tool.getByLabel('Produto').first().focus();
  await tool.getByLabel('Produto').first().selectOption({ label: 'Feijão 1 kg' });
  await press(tool.getByRole('button', { name: 'Registrar doação' }));
  await expect(page.locator('li.test').nth(0).locator('.test__badge')).toHaveText('Passou');

  for (let i = 2; i <= 3; i++) await press(page.getByRole('button', { name: new RegExp(`^Fazer o teste ${i} por mim`) }));
  await press(page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first());
  await expect(page.getByRole('heading', { name: 'Missão concluída!' })).toBeFocused();
});

test('o foco do teclado é visível', async ({ page }) => {
  await freshStart(page);
  const button = page.getByRole('button', { name: 'COMEÇAR A JOGAR' });
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
  expect(outline).toBe('solid 3px');
});

test('áreas de toque têm pelo menos 44 × 44 px', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await page.getByRole('button', { name: 'ATENDER PEDIDO' }).first().click();
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'O que costuma dar errado?' }).click();
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a, select, input, summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) && !el.classList.contains('skip-link');
      })
      .map((el) => `${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
  expect(small).toEqual([]);
});
