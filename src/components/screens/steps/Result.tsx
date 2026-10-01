import { getVariation, SCENARIOS } from '../../../content';
import { useGame } from '../../../engine/GameContext';
import { allEssentialFound, currentAttempt } from '../../../engine/reducer';
import { chooseVariation } from '../../../engine/selection';
import type { MissionRun } from '../../../types';
import { AttemptHistory } from '../../game/Feedback';
import { Glossary } from '../../game/DiscoveredPanel';
import { Avatar } from '../../ui/Avatar';
import { Icon, type IconName } from '../../ui/Icon';
import { Button, Panel, Pixel, Tag } from '../../ui/primitives';

export function Result({ run }: { run: MissionRun }) {
  const { state, dispatch } = useGame();
  const { scenario, variation } = getVariation(run.variationId);
  const attempt = currentAttempt(run)!;
  const other = scenario.variations.find((v) => v.id !== variation.id)!;
  const essentialTotal = variation.facts.filter((f) => f.essential).length;
  const essentialFound = variation.facts.filter((f) => f.essential && run.discovered.includes(f.id)).length;
  const hadFailure = run.attempts.slice(0, -1).some((a) => Object.values(a.tests).some((t) => t.status === 'falhou'));
  const next = SCENARIOS.find((s) => s.id !== scenario.id && s.variations.some((v) => !state.completions[v.id]));

  const indicators: { tag: string; icon: IconName; value: string; text: string; on: boolean }[] = [
    {
      tag: 'INVESTIGAR',
      icon: 'search',
      value: `${essentialFound}/${essentialTotal}`,
      text: allEssentialFound(run) ? 'Todas as informações essenciais descobertas.' : 'Algumas informações essenciais ficaram de fora da conversa.',
      on: allEssentialFound(run),
    },
    {
      tag: 'COMUNICAR',
      icon: 'chat',
      value: `${attempt.score}/${attempt.max}`,
      text: attempt.score === attempt.max ? 'Pedido completo nos cinco critérios.' : 'O pedido funcionou, mas ainda pode ficar mais claro.',
      on: attempt.score === attempt.max,
    },
    { tag: 'TESTAR', icon: 'flask', value: `${variation.tests.length}/${variation.tests.length}`, text: 'Todos os testes passaram.', on: true },
    {
      tag: 'MELHORAR',
      icon: 'wrench',
      value: `${run.attempts.length}x`,
      text: hadFailure ? 'Você encontrou uma falha nos testes e corrigiu o pedido.' : run.attempts.length > 1 ? 'Você revisou o pedido.' : 'Acertou na primeira tentativa.',
      on: hadFailure,
    },
  ];

  return (
    <div className="step step--result">
      <div className="step__head">
        <Pixel color="lime">ETAPA 05 · MISSÃO CONCLUÍDA</Pixel>
        <h2 id="step-title" tabIndex={-1} className="step__title display-title">
          Missão concluída!
        </h2>
      </div>

      <Panel variant="section" className="impact" labelledBy="impact-title">
        <div className="person">
          <Avatar spec={scenario.character.avatar} size={96} />
          <div>
            <h3 id="impact-title" className="section-title">
              Impacto na comunidade
            </h3>
            <p className="impact__text">{variation.impact}</p>
          </div>
        </div>
        <p className="impact__upgrade">
          <Icon name="sparkle" />
          <span>
            Nova melhoria na oficina: <strong>{scenario.upgrade}</strong>.
          </span>
        </p>
      </Panel>

      <section aria-labelledby="recognition-title">
        <h3 id="recognition-title" className="section-title">
          Reconhecimento
        </h3>
        <ul className="indicators">
          {indicators.map((ind, i) => (
            <li key={ind.tag} className={['indicator', ind.on && 'is-on'].filter(Boolean).join(' ')}>
              <Tag color={ind.on ? 'lime' : 'outline'} tilt={i % 2 === 0 ? -1 : 1} icon={ind.icon}>
                {ind.tag}
              </Tag>
              <span className="indicator__value">{ind.value}</span>
              <span className="indicator__text">{ind.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="result-grid">
        <Panel variant="surface" labelledBy="learned-title">
          <h3 id="learned-title" className="section-title">
            O que você aprendeu
          </h3>
          <ul className="takeaways">
            {variation.takeaways.map((t) => (
              <li key={t}>
                <Icon name="check" size={18} /> <span>{t}</span>
              </li>
            ))}
          </ul>
          <h4 className="subhead">Palavras da oficina</h4>
          <Glossary facts={variation.facts} discovered={run.discovered} />
        </Panel>
        <Panel variant="surface" as="div">
          <AttemptHistory run={run} />
        </Panel>
      </div>

      <div className="result-actions">
        <Button variant="primary" icon="wrench" onClick={() => dispatch({ type: 'IMPROVE' })}>
          MELHORAR MINHA SOLUÇÃO
        </Button>
        <Button variant="secondary" icon="refresh" onClick={() => dispatch({ type: 'OPEN_VARIATION', variationId: other.id })}>
          JOGAR OUTRA VARIAÇÃO
        </Button>
        <Button variant="secondary" icon="home" onClick={() => dispatch({ type: 'GO_WORKSHOP' })}>
          VOLTAR À OFICINA
        </Button>
      </div>
      {next && (
        <p className="next">
          Próxima missão sugerida: <strong>{next.title}</strong>, com {next.character.name}.{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              const choice = chooseVariation(next, state);
              if (choice.kind === 'open') dispatch({ type: 'OPEN_VARIATION', variationId: choice.variationId });
              else dispatch({ type: 'GO_WORKSHOP' });
            }}
          >
            Ir para a próxima missão
          </button>
        </p>
      )}
    </div>
  );
}
