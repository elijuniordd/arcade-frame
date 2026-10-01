import { expect, test } from '@playwright/test';
import { getVariation } from '../src/content';
import { essentialBlockIds } from '../src/evaluation/evaluate';
import { STORAGE_KEY } from '../src/persistence/storage';
import type { VariationId } from '../src/types';
import { addBlock, askAll, blockText, expectTestStatus, freshStart, openVariation, runAllTests } from './helpers';

test.describe('fluxo principal: investigar → montar → testar → revisar → concluir', () => {
  test('conclui Doações em ordem (A) depois de corrigir um pedido incompleto', async ({ page }) => {
    const id: VariationId = 'doacoes-a';
    const { scenario, variation } = getVariation(id);
    await freshStart(page);

    await expect(page.getByRole('button', { name: 'COMEÇAR A JOGAR' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CONTINUAR PARTIDA' })).toHaveCount(0);
    await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
    await expect(page.getByRole('heading', { name: 'Mural de pedidos' })).toBeVisible();
    await page.getByRole('button', { name: 'ATENDER PEDIDO' }).first().click();

    // Apresentação
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Doações em ordem');
    await expect(page.getByText(variation.goal)).toBeVisible();
    await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();

    // Investigação: a resposta revela informação útil e explica o porquê.
    await page.getByRole('button', { name: 'Se alguém tentar retirar mais produtos do que vocês têm, o que deve acontecer?' }).click();
    await expect(page.locator('.exchange')).toContainText('Não pode deixar!');
    await expect(page.locator('.insight')).toContainText('regra de negócio');
    await expect(page.locator('#descobertas')).toContainText('Retiradas maiores que o estoque devem ser recusadas');
    for (const q of variation.questions.filter((q) => q.id !== 'q-excesso')) {
      await page.getByRole('button', { name: q.text, exact: true }).click();
    }
    await expect(page.getByRole('button', { name: /Já perguntado/ })).toHaveCount(variation.questions.length);
    await expect(page.locator('#descobertas')).toContainText('Informações essenciais: 4 de 4');
    await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();

    // Montagem: pedido sem a regra de estoque.
    const essentials = essentialBlockIds(scenario, variation);
    for (const b of essentials.filter((b) => b !== 'd-aco-limite')) await addBlock(page, id, b);
    await expect(page.locator('.preview__list li')).toHaveCount(essentials.length - 1);
    await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();

    // Teste: IA simulada identificada e falha detectável.
    await expect(page.getByRole('heading', { name: /Resposta da IA — tentativa 1/ })).toBeVisible();
    await expect(page.getByText('IA SIMULADA').first()).toBeVisible();
    await runAllTests(page, id);
    await expectTestStatus(page, 0, 'Passou');
    await expectTestStatus(page, 1, 'Passou');
    await expectTestStatus(page, 2, 'Falhou');
    await expect(page.locator('li.test').nth(2)).toContainText('O estoque ficou em -4');
    await expect(page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first()).toBeDisabled();

    // Revisão: adiciona a regra e experimenta de novo.
    await page.getByRole('button', { name: 'REVISAR O PEDIDO' }).first().click();
    await addBlock(page, id, 'd-aco-limite');
    await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
    await expect(page.getByText('Os testes foram reiniciados')).toBeVisible();
    await expectTestStatus(page, 2, 'Não testado');
    await runAllTests(page, id);
    for (let i = 0; i < 3; i++) await expectTestStatus(page, i, 'Passou');
    await expect(page.locator('.history-table tbody tr')).toHaveCount(2);

    await page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first().click();
    await expect(page.getByRole('heading', { name: 'Missão concluída!' })).toBeVisible();
    await expect(page.getByText(variation.impact)).toBeVisible();
    await expect(page.getByRole('button', { name: 'MELHORAR MINHA SOLUÇÃO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JOGAR OUTRA VARIAÇÃO' })).toBeVisible();

    // Repetir o cenário prioriza a variação não concluída.
    await page.locator('.result-actions').getByRole('button', { name: 'VOLTAR À OFICINA' }).click();
    await expect(page.locator('.upgrades li.is-on')).toContainText('Prateleira de doações organizada');
    const card = page.locator('article.mission-card', { hasText: 'Doações em ordem' });
    await expect(card).toContainText('Variação A: Entradas e saídas — concluída');
    await card.getByRole('button', { name: 'JOGAR A OUTRA VARIAÇÃO' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lotes e validade');
  });
});

test('atualizar a página restaura a partida e o estado da simulação', async ({ page }) => {
  const id: VariationId = 'vagas-a';
  const { scenario, variation } = getVariation(id);
  await openVariation(page, id);
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  for (const b of essentialBlockIds(scenario, variation).filter((b) => b !== 'v-aco-duplicada')) await addBlock(page, id, b);
  // Edita um texto: deve ser preservado.
  await page.getByRole('button', { name: 'EDITAR TEXTO' }).first().click();
  await page.getByLabel(/Texto do bloco/).fill('Organizar as inscrições da biblioteca.');
  await page.getByRole('button', { name: 'CONCLUIR EDIÇÃO' }).click();
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  await page.getByRole('button', { name: /^Fazer o teste 2 por mim/ }).click();
  await expectTestStatus(page, 1, 'Falhou');
  await expect(page.locator('.course').first()).toContainText('3 de 4 vagas ocupadas');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Teste a ferramenta antes de entregar' })).toBeVisible();
  await expectTestStatus(page, 1, 'Falhou');
  await expect(page.locator('.course').first()).toContainText('3 de 4 vagas ocupadas');
  await expect(page.locator('.people').first()).toContainText('Joaquim');
  await page.getByRole('button', { name: 'REVISAR O PEDIDO' }).first().click();
  await expect(page.locator('.assembled').first()).toContainText('Organizar as inscrições da biblioteca.');
  await expect(page.locator('.assembled').first()).toContainText('TEXTO EDITADO');
});

test('reiniciar a missão e apagar todo o progresso', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await page.getByRole('button', { name: 'ATENDER PEDIDO' }).nth(1).click();
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'Quem vai usar a ferramenta?' }).click();
  await expect(page.locator('#descobertas')).toContainText('Rafael e Cris');

  // Reiniciar a missão atual.
  await page.getByRole('button', { name: 'REINICIAR MISSÃO' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reiniciar esta missão?' });
  await dialog.getByRole('button', { name: 'REINICIAR MISSÃO' }).click();
  await expect(page.getByRole('heading', { name: 'Rafael precisa de ajuda' })).toBeVisible();
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await expect(page.locator('#descobertas')).toContainText('Ainda nada por aqui');

  // Apagar todo o progresso.
  await page.getByRole('button', { name: 'Progresso' }).click();
  const progress = page.getByRole('dialog', { name: 'Seu progresso' });
  await progress.getByRole('button', { name: 'APAGAR TODO O PROGRESSO' }).click();
  await progress.getByRole('button', { name: 'SIM, APAGAR TUDO' }).click();
  await expect(page.getByRole('button', { name: 'COMEÇAR A JOGAR' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUAR PARTIDA' })).toHaveCount(0);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(saved.state.runs).toEqual({});
});

test('mostra CONTINUAR PARTIDA quando há progresso salvo', async ({ page }) => {
  await openVariation(page, 'agenda-a');
  await page.getByRole('button', { name: 'Oficina do Amanhã — página inicial' }).click();
  await page.getByRole('button', { name: 'CONTINUAR PARTIDA' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Agenda da comunidade');
});

test('dados salvos inválidos não travam o jogo', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{corrompido'), STORAGE_KEY);
  await page.reload();
  await expect(page.getByText('Não foi possível usar o progresso salvo')).toBeVisible();
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await page.getByRole('button', { name: 'ATENDER PEDIDO' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dona Lúcia precisa de ajuda' })).toBeVisible();
});

test('sem armazenamento disponível, o jogo funciona e avisa', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText('O progresso não será salvo')).toBeVisible();
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await page.getByRole('button', { name: 'ATENDER PEDIDO' }).first().click();
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'O que costuma dar errado?' }).click();
  await expect(page.locator('.exchange')).toBeVisible();
});

test('blocos incompatíveis são explicados e bloqueiam a experimentação até o ajuste', async ({ page }) => {
  const id: VariationId = 'agenda-a';
  await openVariation(page, id);
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  await addBlock(page, id, 'a-aco-conflito');
  await addBlock(page, id, 'a-aco-intervalo');
  await expect(page.getByText('Instruções que se contradizem', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' })).toBeDisabled();
  await page.getByRole('button', { name: new RegExp(`^REMOVER: “${blockText(id, 'a-aco-intervalo').slice(0, 20)}`) }).click();
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' })).toBeEnabled();
});

test('ajuda em três níveis fica disponível e não muda a pontuação', async ({ page }) => {
  const id: VariationId = 'doacoes-b';
  const { scenario, variation } = getVariation(id);
  await openVariation(page, id);
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await page.getByRole('button', { name: 'AJUDA', exact: true }).click();
  await page.getByRole('button', { name: 'Ver uma pista' }).click();
  await page.getByRole('button', { name: 'Ver um exemplo' }).click();
  await page.getByRole('button', { name: 'Ver orientação direta' }).click();
  await expect(page.locator('.help')).toContainText(variation.help.investigate.direta);
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  for (const b of essentialBlockIds(scenario, variation)) await addBlock(page, id, b);
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  await expect(page.getByRole('heading', { name: 'Avaliação do pedido: 10 de 10' })).toBeVisible();
});

test('a partida não faz chamadas externas', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol !== 'data:') external.push(r.url());
  });
  const id: VariationId = 'agenda-b';
  const { scenario, variation } = getVariation(id);
  await openVariation(page, id);
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await askAll(page, id);
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  for (const b of essentialBlockIds(scenario, variation)) await addBlock(page, id, b);
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  await runAllTests(page, id);
  expect(external).toEqual([]);
});

test('não há rolagem horizontal nas telas principais', async ({ page }) => {
  const id: VariationId = 'agenda-b';
  const { scenario, variation } = getVariation(id);
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await freshStart(page);
  await noOverflow();
  await page.getByRole('button', { name: 'COMEÇAR A JOGAR' }).click();
  await noOverflow();
  await openVariation(page, id);
  await noOverflow();
  await page.getByRole('button', { name: 'COMEÇAR A INVESTIGAR' }).click();
  await askAll(page, id);
  await noOverflow();
  await page.getByRole('button', { name: 'MONTAR O PEDIDO', exact: true }).click();
  for (const b of essentialBlockIds(scenario, variation)) await addBlock(page, id, b);
  await noOverflow();
  await page.getByRole('button', { name: 'EXPERIMENTAR SOLUÇÃO' }).click();
  await runAllTests(page, id);
  await noOverflow();
  await page.getByRole('button', { name: 'CONCLUIR MISSÃO' }).first().click();
  await noOverflow();
});
