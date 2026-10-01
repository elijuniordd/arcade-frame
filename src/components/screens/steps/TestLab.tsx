import { useEffect, useRef } from 'react';
import { getVariation } from '../../../content';
import { useGame } from '../../../engine/GameContext';
import { currentAttempt } from '../../../engine/reducer';
import { allTestsPassed } from '../../../simulation';
import type { MissionRun, SimAction, TestStatus } from '../../../types';
import { AiResponse, AttemptHistory, CriteriaFeedback, TEST_STATUS, TestCard } from '../../game/Feedback';
import { InstructionPanel } from '../../game/Guidance';
import { EnrollmentTool } from '../../tools/EnrollmentTool';
import { InventoryTool } from '../../tools/InventoryTool';
import { ScheduleTool } from '../../tools/ScheduleTool';
import { Icon } from '../../ui/Icon';
import { Button, Notice, Pixel } from '../../ui/primitives';

export function TestLab({ run, level }: { run: MissionRun; level: 'completa' | 'curta' }) {
  const { dispatch, announce } = useGame();
  const { variation } = getVariation(run.variationId);
  const attempt = currentAttempt(run);
  const previous = useRef<Record<string, TestStatus>>({});

  // Anuncia mudanças nos resultados dos testes para leitores de tela.
  useEffect(() => {
    if (!attempt) return;
    const changed = variation.tests
      .map((t, i) => ({ t, i, r: attempt.tests[t.id] }))
      .filter(({ t, r }) => r && previous.current[t.id] !== undefined && previous.current[t.id] !== r.status && r.status !== 'pendente');
    for (const { t, i, r } of changed) announce(`Teste ${i + 1}, ${t.title}: ${TEST_STATUS[r.status].label}. ${r.message}`);
    previous.current = Object.fromEntries(variation.tests.map((t) => [t.id, attempt.tests[t.id]?.status ?? 'pendente']));
  }, [attempt, variation.tests, announce]);

  if (!attempt || !run.sim) return null;
  const results = variation.tests.map((t) => attempt.tests[t.id] ?? { status: 'pendente' as const, message: '' });
  const passed = results.filter((r) => r.status === 'passou').length;
  const failed = results.filter((r) => r.status === 'falhou').length;
  const pending = results.filter((r) => r.status === 'pendente').length;
  const allPassed = allTestsPassed(variation.tests, attempt.tests);
  const onAction = (action: SimAction) => dispatch({ type: 'SIM_ACTION', action });
  const tool = variation.tool;
  const sim = run.sim;

  const actions = (suffix: string) => (
    <div className="test-actions">
      <Button variant="secondary" icon="edit" onClick={() => dispatch({ type: 'SET_STEP', step: 'build' })}>
        REVISAR O PEDIDO
      </Button>
      <Button variant="primary" icon="check" disabled={!allPassed} onClick={() => dispatch({ type: 'COMPLETE' })} aria-describedby={`complete-why-${suffix}`}>
        CONCLUIR MISSÃO
      </Button>
      <p id={`complete-why-${suffix}`} className="test-actions__why">
        {allPassed
          ? 'Todos os testes passaram. Você pode concluir ou continuar melhorando o pedido.'
          : pending > 0
            ? `Faça todos os testes para concluir (${pending} ainda não testado${pending > 1 ? 's' : ''}).`
            : 'Para concluir, todos os testes precisam passar. Revise o pedido e experimente de novo — tentativas fazem parte do processo.'}
      </p>
    </div>
  );

  return (
    <div className="step step--test">
      <div className="step__head">
        <Pixel color="teal">ETAPA 04 · TESTAR</Pixel>
        <h2 id="step-title" tabIndex={-1} className="step__title">
          Teste a ferramenta antes de entregar
        </h2>
      </div>
      <InstructionPanel step="test" level={level} />

      {run.simResetNotice && (
        <Notice tone="info" title="Os testes foram reiniciados" onClose={() => dispatch({ type: 'DISMISS_RESET_NOTICE' })}>
          A ferramenta foi recriada a partir dos dados iniciais da missão, usando o seu novo pedido. Os resultados da tentativa anterior continuam guardados em “Evolução entre
          tentativas”.
        </Notice>
      )}

      <AiResponse run={run} attempt={attempt} />

      <div className="lab">
        <section className="lab__tests" aria-labelledby="tests-title">
          <h3 id="tests-title" className="section-title">
            Casos de teste
          </h3>
          <p className="lab__summary" role="status">
            <Icon name="flask" size={18} /> {passed} passou(aram) · {failed} falhou(aram) · {pending} não testado(s)
          </p>
          <p className="muted small">Faça cada teste usando a ferramenta, ou use “Fazer o teste por mim”. Os dois caminhos usam a mesma ferramenta.</p>
          <ol className="tests">
            {variation.tests.map((t, i) => (
              <TestCard key={t.id} test={t} index={i} result={results[i]} onRun={() => dispatch({ type: 'RUN_TEST', testId: t.id })} />
            ))}
          </ol>
          {allPassed && (
            <Notice tone="success" title="Todos os testes passaram!">
              A ferramenta faz o que {getVariation(run.variationId).scenario.character.name} precisa. Você já pode concluir a missão.
            </Notice>
          )}
          {failed > 0 && (
            <Notice tone="alert" title="Algum teste falhou">
              Isso não é uma derrota: é exatamente para isso que os testes servem. Leia o motivo da falha, confira a avaliação do pedido abaixo e revise os blocos.
            </Notice>
          )}
          {actions('testes')}
        </section>

        <div className="lab__tool">
          {tool.kind === 'inventory' && sim.tool.kind === 'inventory' && <InventoryTool config={tool} tool={sim.tool} flags={attempt.flags} events={sim.events} onAction={onAction} />}
          {tool.kind === 'enrollment' && sim.tool.kind === 'enrollment' && (
            <EnrollmentTool config={tool} tool={sim.tool} flags={attempt.flags} events={sim.events} onAction={onAction} />
          )}
          {tool.kind === 'schedule' && sim.tool.kind === 'schedule' && <ScheduleTool config={tool} tool={sim.tool} flags={attempt.flags} events={sim.events} onAction={onAction} />}
        </div>
      </div>

      <div className="lab__feedback">
        <CriteriaFeedback run={run} attempt={attempt} />
        <AttemptHistory run={run} />
      </div>
      {actions('fim')}
    </div>
  );
}
