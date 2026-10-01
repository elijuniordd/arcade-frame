import type { Step } from '../types';

/**
 * Orientações de cada etapa. A versão completa aparece nas primeiras missões;
 * depois, a orientação fica mais curta — e a versão completa continua a um clique.
 */
export const STEP_GUIDANCE: Record<Step, { what: string; why: string; short: string }> = {
  briefing: {
    what: 'Conheça a pessoa que pediu ajuda e o problema que ela enfrenta.',
    why: 'Ainda não é hora de pensar em tecnologia. Uma boa solução começa entendendo o dia a dia de quem vai usá-la.',
    short: 'Leia o pedido de ajuda e comece a investigar.',
  },
  investigate: {
    what: 'Antes de pedir uma solução, descubra como a pessoa trabalha. Pergunte o que ela registra, quais dificuldades encontra e o que precisa acontecer em cada situação.',
    why: 'Uma IA só sabe o que você conta para ela. Cada resposta importante vai para o painel “O que já descobrimos” e vai ajudar a montar o pedido.',
    short: 'Faça perguntas e reúna as informações importantes.',
  },
  build: {
    what: 'Monte um pedido para a IA escolhendo blocos. Um bom pedido diz o que você quer, onde será usado, o que registrar, o que fazer em cada situação, quais cuidados ter, o que mostrar e como conferir.',
    why: 'Pedidos vagos geram soluções que parecem certas, mas esquecem coisas importantes. Use o painel “O que já descobrimos” como guia. Você também pode editar o texto dos blocos.',
    short: 'Escolha os blocos do pedido usando o que você descobriu.',
  },
  test: {
    what: 'A IA simulada criou uma ferramenta a partir do seu pedido. Faça cada teste usando a ferramenta ou o botão “Fazer o teste por mim”.',
    why: 'Respostas de IA podem parecer seguras e, ainda assim, ter falhas. Testar situações reais é a forma de descobrir isso antes de entregar a ferramenta.',
    short: 'Teste a ferramenta antes de entregar.',
  },
  result: {
    what: 'Veja o impacto da sua solução e o que você aprendeu.',
    why: 'Revisar o caminho ajuda a fazer pedidos ainda melhores na próxima missão.',
    short: 'Confira o resultado e escolha o próximo passo.',
  },
};

export const EDIT_NOTICE =
  'Você pode reescrever o texto dos blocos com suas palavras. Nesta versão do jogo, a avaliação automática e a IA simulada consideram o bloco escolhido — não as palavras editadas. Assim, editar o texto nunca muda as regras da simulação sem você saber.';

export const AI_WARNING =
  'Uma IA pode responder com confiança mesmo quando faltou algo no pedido. Por isso, toda solução precisa ser testada antes de ser entregue.';
