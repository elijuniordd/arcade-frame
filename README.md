# Oficina do Amanhã

Protótipo web jogável sobre **investigar necessidades, pedir soluções claras a uma IA e verificar resultados**. O jogador atua numa oficina de tecnologia de bairro e ajuda moradores a resolver problemas da comunidade, sem precisar saber programar.

- 3 cenários (Doações em ordem, Vagas para aprender, Agenda da comunidade), cada um com 2 variações de regras: 6 missões jogáveis de 5 a 8 minutos.
- Ciclo completo em cada missão: **conhecer → investigar → montar o pedido → testar → revisar → concluir**.
- IA **simulada**: as respostas e os comportamentos foram preparados com antecedência. Não há backend, API de IA, cadastro, analytics nem chamadas externas depois do carregamento.
- Progresso salvo no navegador (`localStorage`), com versão de formato.
- Português brasileiro, responsivo a partir de 360 px, jogável por teclado.

## Como instalar e executar

Requisitos: Node.js 18+ (testado com Node 22) e npm.

```bash
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:5173
```

Para gerar a versão de publicação:

```bash
npm run build      # verifica tipos (tsc) e gera a pasta dist/
npm run preview    # serve a pasta dist/ localmente
```

A pasta `dist/` é estática (HTML, CSS, JS e fontes locais) e pode ser publicada em qualquer hospedagem estática com HTTPS. O `base: './'` do Vite permite publicar também em subpastas.

## Testes

```bash
npm test               # Vitest: regras, avaliação, conteúdo, motor e persistência
npm run test:e2e       # Playwright: fluxo principal em desktop (1280 px) e celular (360 px)
npm run typecheck      # TypeScript
```

O Playwright gera o build e sobe o `vite preview` sozinho. Na primeira vez, se o navegador não estiver instalado, rode `npx playwright install chromium`.

O que é coberto:

| Arquivo | O que verifica |
| --- | --- |
| `src/simulation/simulation.test.ts` | Estoque (entradas, saídas, estoque negativo sem validação), validade (data de referência, lotes, consulta separada, bloqueio de vencidos), duplicidade, capacidade, fila e promoção (primeiro/último), conflitos de horário, horários adjacentes, intervalo obrigatório, equipamento compartilhado e liberação no cancelamento; resultados inconclusivos. |
| `src/evaluation/evaluate.test.ts` | Avaliação determinística: pontuação máxima, pedido vazio, ordem e repetição não mudam a nota, blocos que não ajudam não aumentam a nota, feedback específico, conflitos, capacidades da simulação. |
| `src/content/content.test.ts` | Integridade das 6 variações; perguntas revelam todas as informações; **as 6 variações são concluíveis**; remover cada bloco essencial com comportamento causa falha detectável; alternativas plausíveis porém erradas falham; copiar o pedido de uma variação para a outra não resolve tudo. |
| `src/engine/reducer.test.ts` | Fluxo investigar → montar → testar → revisar → concluir; ajuda não altera a pontuação; edição de texto preservada sem mudar as regras; reiniciar missão × apagar tudo; prioridade de variação não concluída. |
| `src/persistence/storage.test.ts` | Salvar/restaurar (inclusive a simulação), versão de formato, JSON corrompido, versão incompatível, dados parcialmente inválidos, armazenamento indisponível. |
| `e2e/game.spec.ts` | Fluxo completo com falha e revisão, recarregar a página restaura a partida, reiniciar e apagar, “Continuar partida”, dados inválidos, sem `localStorage`, blocos incompatíveis, ajuda em 3 níveis, nenhuma requisição externa, sem rolagem horizontal. |
| `e2e/variations.spec.ts` | As 6 variações concluídas pela interface; testes feitos manualmente na ferramenta também contam. |
| `e2e/keyboard.spec.ts` | Missão inteira só com teclado, foco visível, áreas de toque ≥ 44 × 44 px. |
| `e2e/a11y.spec.ts` | Auditoria automática axe-core (WCAG 2.0/2.1 A e AA, incluindo contraste) nas telas principais. |

> A auditoria automática não substitui testes com leitores de tela reais nem a validação de compreensão com pessoas iniciantes, que é uma etapa posterior e **ainda não foi realizada**.

## Estrutura do projeto

```
src/
  types.ts                 Tipos: cenários, variações, perguntas, informações, blocos, regras, testes, feedback, estado salvo
  content/                 1. Conteúdo
    scenarios/*.ts           missões, diálogos, conceitos, dicas, blocos, testes, impacto
    labels.ts, guidance.ts   títulos cotidianos + termos técnicos, orientações por etapa
  engine/                  2. Motor do jogo
    reducer.ts               transições de etapa, tentativas, conquistas (useReducer)
    selection.ts             escolha de variação e nível de orientação
    GameContext.tsx          Context API + salvamento automático + anúncios para leitores de tela
  evaluation/evaluate.ts   3. Avaliação determinística dos pedidos
  simulation/              4. Simulações (estoque, inscrições, agenda) e verificação dos casos de teste
  persistence/storage.ts   6. Persistência, versão de formato e reparo de dados
  components/              5. Interface (ui/, game/, screens/, tools/)
  styles/app.css           Tokens de cor, tipografia e espaçamento + componentes
e2e/                       Testes Playwright
```

## Como adicionar cenários e variações

1. Crie `src/content/scenarios/<cenario>.ts` exportando um `Scenario` (veja `doacoes.ts` como modelo) e registre-o em `SCENARIOS` (`src/content/index.ts`). Acrescente o novo id em `ScenarioId`/`VariationId` (`src/types.ts`) e um selo em `BADGES` (`src/content/labels.ts`).
2. No cenário, defina:
   - `blocks`: todos os blocos possíveis, com `category` e, quando o bloco liga um comportamento, `grants` (capacidades `SimFlag`).
   - `conflicts`: pares de blocos que se contradizem, com a explicação mostrada ao jogador.
   - `flagTexts`: o que a IA simulada diz ter construído e o que ela supõe quando algo falta.
3. Em cada uma das duas variações, defina situação, objetivo, objetivo de aprendizagem, perguntas (`reveals` aponta para `facts`), informações descobertas (com `concept` para apresentar o termo técnico depois do exemplo), ajuda em três níveis por etapa, `blockRoles` (papel de cada bloco **nesta** variação: `essencial`, `util`, `vago`, `irrelevante` ou `prejudicial`, com feedback), dados iniciais da ferramenta (`tool`), três casos de teste e o texto de impacto.
4. Se o cenário usar um tipo de ferramenta novo, crie a simulação em `src/simulation/`, os verificadores de teste em `checks.ts` e o componente em `src/components/tools/`.
5. Rode `npm test`. Os testes de conteúdo verificam automaticamente que a variação nova é concluível, que cada bloco essencial com comportamento é detectável por algum teste e que as duas variações exigem necessidades diferentes.

## Como funciona a avaliação determinística

A avaliação (`src/evaluation/evaluate.ts`) usa **somente os identificadores dos blocos escolhidos** e os metadados do conteúdo. Ela não interpreta texto livre.

- Cada bloco pertence a uma categoria; as categorias alimentam cinco critérios: **objetivo**, **contexto**, **requisitos** (dados, ações e regras, resultado esperado), **restrições** e **verificação**.
- Por critério: **completo** (2 pontos) quando todos os blocos essenciais da variação estão presentes e não há blocos vagos, irrelevantes ou prejudiciais naquela parte; **parcial** (1) quando há algum bloco essencial ou útil, mas falta algo ou há ruído; **faltando** (0) caso contrário. Total de 0 a 10.
- Cada critério traz feedback específico: o que falta (texto `missing` do bloco essencial) e por que blocos escolhidos não ajudam.
- Tamanho do pedido, ordem dos blocos, repetição, palavras técnicas e uso de ajuda **não** alteram a nota.
- Blocos incompatíveis (`conflicts`) são explicados e impedem a experimentação até que o jogador remova um deles.
- A simulação é ligada pelas capacidades (`grants`) dos blocos. Exemplos: sem o bloco de limite de estoque, a retirada excessiva deixa o estoque negativo; sem controle de duplicidade, a inscrição repetida é aceita; sem verificação de conflitos, reservas sobrepostas são aceitas. Os casos de teste detectam essas falhas.

## Limites da simulação e da edição de texto

- A “IA” é simulada: respostas e comportamentos foram preparados com antecedência para cada combinação de blocos. Nada é gerado, enviado a serviços externos ou executado como código — inclusive o texto editado pelo jogador.
- O jogador pode reescrever o texto dos blocos; a edição fica salva e aparece na prévia, mas **a avaliação e a ferramenta consideram o bloco escolhido, não as palavras**. O jogo explica isso na tela de montagem e na resposta da IA.
- As ferramentas usam listas fixas de pessoas, produtos, grupos e horários (dados fictícios) para manter os testes consistentes. A validade usa uma data de referência fixa da missão (14/10/2026).
- Ao revisar o pedido e experimentar de novo, a ferramenta é recriada a partir dos dados iniciais da missão; as tentativas anteriores ficam no histórico para comparação.

## Como reiniciar missões e apagar o progresso

- **Reiniciar a missão atual**: botão “REINICIAR MISSÃO” no topo da missão (com confirmação) ou em “Progresso” no menu. Só a missão atual volta ao começo; conclusões e conquistas são mantidas.
- **Apagar todo o progresso**: menu “Progresso” → “APAGAR TODO O PROGRESSO” → “SIM, APAGAR TUDO”. Remove missões, tentativas e conquistas deste navegador.
- Se o progresso salvo estiver corrompido ou for de outra versão, o jogo avisa e começa do zero sem travar. Se o navegador não permitir `localStorage` (por exemplo, em alguns modos privados), o jogo funciona normalmente e avisa que o progresso não será salvo.

## Identidade visual

A identidade segue a referência de arcade fornecida: fundo roxo muito escuro com grade discreta, seções em roxo médio, títulos em sans-serif pesada e caixa alta, etiquetas coloridas levemente rotacionadas e botões amarelos sólidos. A marca tipográfica “Oficina do Amanhã” é própria (não reproduz o logo da referência). As fontes são incluídas no build (Archivo Black, Inter e Pixelify Sans via Fontsource, licença OFL), com alternativas de sistema; a fonte pixel é usada apenas em indicadores curtos. O token `--color-border` foi clareado (#7A6889) para garantir contraste mínimo de 3:1 nas bordas de campos.
