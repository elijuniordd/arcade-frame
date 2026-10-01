import { getVariation } from '../../content';
import { AI_WARNING } from '../../content/guidance';
import { QUALITY_LABEL, STATUS_LABEL } from '../../content/labels';
import { CRITERIA, evaluatePrompt, requiredFlags } from '../../evaluation/evaluate';
import type { AttemptSummary, MissionRun, TestCase, TestResult, TestStatus } from '../../types';
import { Icon, type IconName } from '../ui/Icon';
import { Button, Notice, Tag } from '../ui/primitives';

/* ------------------------------------------------------------------ */
/* Resposta da IA simulada                                             */
/* ------------------------------------------------------------------ */

export function AiResponse({ run, attempt }: { run: MissionRun; attempt: AttemptSummary }) {
  const { scenario, variation } = getVariation(run.variationId);
  const built = attempt.flags.map((f) => scenario.flagTexts[f]?.built).filter(Boolean) as string[];
  const assumptions = requiredFlags(scenario, variation)
    .filter((f) => !attempt.flags.includes(f))
    .map((f) => scenario.flagTexts[f]?.assumption)
    .filter((t, i, arr): t is string => Boolean(t) && arr.indexOf(t) === i);

  return (
    <section className="panel panel--ai ai" aria-labelledby="ai-title">
      <div className="ai__head">
        <Tag color="lilac" icon="bot" tilt={-1}>
          IA SIMULADA
        </Tag>
        <h3 id="ai-title" className="ai__title">
          Resposta da IA — tentativa {attempt.number}
        </h3>
      </div>
      <p className="muted small">Esta não é uma IA de verdade: a resposta foi preparada com antecedência e depende apenas dos blocos escolhidos.</p>
      <div className="ai__bubble">
        {built.length > 0 ? (
          <>
            <p>Pronto! Criei uma ferramenta para {scenario.character.name}. Ela tem:</p>
            <ul>
              {built.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Pronto! Criei uma tela inicial para {scenario.character.name}, mas o pedido não dizia o que a ferramenta deveria fazer.</p>
        )}
        {assumptions.length > 0 && (
          <>
            <p>Onde o pedido não dizia nada, decidi assim:</p>
            <ul>
              {assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        )}
        <p>Está tudo funcionando. É só usar!</p>
      </div>
      <Notice tone="info" title="Confie, mas verifique">
        {AI_WARNING}
      </Notice>
      {attempt.editedBlockIds.length > 0 && (
        <p className="muted small">
          <Icon name="edit" size={16} /> Você editou o texto de {attempt.editedBlockIds.length} bloco(s). Nesta versão, a IA simulada considerou os blocos escolhidos, não as palavras
          editadas.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Casos de teste                                                      */
/* ------------------------------------------------------------------ */

export const TEST_STATUS: Record<TestStatus, { label: string; icon: IconName }> = {
  pendente: { label: 'Não testado', icon: 'circle' },
  passou: { label: 'Passou', icon: 'check' },
  falhou: { label: 'Falhou', icon: 'x' },
  inconclusivo: { label: 'Inconclusivo', icon: 'alert' },
};

export function TestCard({ test, index, result, onRun }: { test: TestCase; index: number; result: TestResult; onRun: () => void }) {
  const s = TEST_STATUS[result.status];
  return (
    <li className={`test test--${result.status}`}>
      <div className="test__head">
        <span className="test__badge">
          <Icon name={s.icon} size={18} />
          {s.label}
        </span>
        <h4 className="test__title">
          Teste {index + 1}: {test.title}
        </h4>
      </div>
      <p>
        <strong>O que fazer:</strong> {test.instruction}
      </p>
      <p>
        <strong>O que deveria acontecer:</strong> {test.expected}
      </p>
      {result.status !== 'pendente' && <p className="test__result">{result.message}</p>}
      {result.status === 'pendente' && result.message !== 'Ainda não testado.' && <p className="test__result">{result.message}</p>}
      <Button small variant="secondary" icon="play" onClick={onRun} aria-label={`Fazer o teste ${index + 1} por mim: ${test.title}`}>
        {result.status === 'pendente' ? 'FAZER O TESTE POR MIM' : 'REPETIR O TESTE POR MIM'}
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Avaliação do pedido                                                 */
/* ------------------------------------------------------------------ */

export function CriteriaFeedback({ run, attempt }: { run: MissionRun; attempt: AttemptSummary }) {
  const { scenario, variation } = getVariation(run.variationId);
  const evaluation = evaluatePrompt(scenario, variation, attempt.blockIds);
  const notes = evaluation.notes.filter((n) => n.quality !== 'essencial');
  return (
    <section className="criteria" aria-labelledby="criteria-title">
      <h3 id="criteria-title" className="section-title">
        Avaliação do pedido: {evaluation.total} de {evaluation.max}
      </h3>
      <p className="muted small">
        A avaliação olha para os blocos escolhidos — não para o tamanho do pedido nem para palavras técnicas. Usar ajuda não muda a pontuação.
      </p>
      <ul className="criteria__list">
        {evaluation.criteria.map((c) => {
          const def = CRITERIA.find((d) => d.id === c.id)!;
          const st = STATUS_LABEL[c.status];
          return (
            <li key={c.id} className={`criterion criterion--${c.status}`}>
              <div className="criterion__head">
                <span className="criterion__status">
                  <Icon name={st.icon} size={18} /> {st.text}
                </span>
                <p className="criterion__title">
                  {def.everyday} <span className="term">— {def.title}</span>
                </p>
              </div>
              <ul className="criterion__feedback">
                {c.feedback.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <details className="notes">
          <summary>Comentários sobre outros blocos escolhidos ({notes.length})</summary>
          <ul>
            {notes.map((n) => (
              <li key={n.blockId}>
                <Tag color={n.quality === 'util' ? 'teal' : n.quality === 'prejudicial' ? 'pink' : 'outline'}>{QUALITY_LABEL[n.quality].toUpperCase()}</Tag>{' '}
                <span className="notes__block">“{scenario.blocks.find((b) => b.id === n.blockId)?.text}”</span> — {n.feedback}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Evolução entre tentativas                                           */
/* ------------------------------------------------------------------ */

export function AttemptHistory({ run }: { run: MissionRun }) {
  const { variation } = getVariation(run.variationId);
  if (run.attempts.length === 0) return null;
  return (
    <section className="history-table" aria-labelledby="attempts-title">
      <h3 id="attempts-title" className="section-title">
        Evolução entre tentativas
      </h3>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabela de tentativas (role para o lado se necessário)">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Tentativa</th>
              <th scope="col">Pedido</th>
              <th scope="col">Testes que passaram</th>
              <th scope="col">Mudanças no pedido</th>
            </tr>
          </thead>
          <tbody>
            {run.attempts.map((a, i) => {
              const prev = run.attempts[i - 1];
              const passed = variation.tests.filter((t) => a.tests[t.id]?.status === 'passou').length;
              const added = prev ? a.blockIds.filter((id) => !prev.blockIds.includes(id)).length : a.blockIds.length;
              const removed = prev ? prev.blockIds.filter((id) => !a.blockIds.includes(id)).length : 0;
              return (
                <tr key={a.number}>
                  <th scope="row">
                    {a.number}
                    {i === run.attempts.length - 1 && ' (atual)'}
                  </th>
                  <td>
                    {a.score} de {a.max}
                  </td>
                  <td>
                    {passed} de {variation.tests.length}
                  </td>
                  <td>{prev ? `+${added} / −${removed} bloco(s)` : `${added} bloco(s)`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
