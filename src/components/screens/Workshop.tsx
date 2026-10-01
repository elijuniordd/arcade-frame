import { SCENARIOS } from '../../content';
import { useGame } from '../../engine/GameContext';
import { chooseVariation, scenarioStatus, type ScenarioStatus } from '../../engine/selection';
import type { Scenario } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Icon, type IconName } from '../ui/Icon';
import { Button, Pixel, Tag } from '../ui/primitives';
import { BadgeGrid } from '../game/Badges';
import { WorkshopScene } from '../game/WorkshopScene';

const STATUS: Record<ScenarioStatus, { text: string; icon: IconName; color: 'white' | 'teal' | 'lime' | 'yellow' }> = {
  nova: { text: 'Nova', icon: 'sparkle', color: 'white' },
  andamento: { text: 'Em andamento', icon: 'hourglass', color: 'teal' },
  parcial: { text: '1 de 2 variações', icon: 'half', color: 'yellow' },
  concluida: { text: 'Concluída', icon: 'check', color: 'lime' },
};

export function Workshop() {
  const { state } = useGame();
  const done = (id: string) => SCENARIOS.find((s) => s.id === id)!.variations.some((v) => state.completions[v.id]);
  const allDone = SCENARIOS.every((s) => s.variations.every((v) => state.completions[v.id]));
  const suggested = SCENARIOS.find((s) => scenarioStatus(s, state) !== 'concluida');

  return (
    <div className="container workshop">
      <header className="page-head">
        <Pixel color="teal">▸ OFICINA</Pixel>
        <h1 id="page-title" tabIndex={-1} className="display-title">
          Mural de pedidos
        </h1>
        <p className="lead">
          Escolha um pedido de ajuda da comunidade. Você pode começar por qualquer um — para quem está começando, sugerimos seguir a ordem do mural.
        </p>
      </header>

      <section className="workshop__scene panel panel--surface" aria-labelledby="scene-heading">
        <h2 id="scene-heading" className="section-title">
          Sua oficina
        </h2>
        <WorkshopScene doacoes={done('doacoes')} vagas={done('vagas')} agenda={done('agenda')} all={allDone} />
        <ul className="upgrades">
          {SCENARIOS.map((s) => (
            <li key={s.id} className={done(s.id) ? 'is-on' : ''}>
              <Icon name={done(s.id) ? 'check' : 'lock'} size={18} />
              <span>
                {s.upgrade} — {done(s.id) ? 'melhoria conquistada' : `conclua “${s.title}”`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mural-title">
        <h2 id="mural-title" className="section-title">
          Pedidos da comunidade
        </h2>
        <ul className="mural">
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <MissionCard scenario={s} suggested={suggested?.id === s.id} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="badges-title" className="workshop__badges">
        <h2 id="badges-title" className="section-title">
          Conquistas
        </h2>
        <BadgeGrid earned={state.badges} />
      </section>
    </div>
  );
}

function MissionCard({ scenario, suggested }: { scenario: Scenario; suggested: boolean }) {
  const { state, dispatch } = useGame();
  const status = scenarioStatus(scenario, state);
  const choice = chooseVariation(scenario, state);
  const st = STATUS[status];
  const titleId = `card-${scenario.id}`;

  return (
    <article className={`mission-card mission-card--${status}`} aria-labelledby={titleId}>
      <div className="mission-card__top">
        <Pixel color="yellow" as="span">
          PEDIDO {String(scenario.number).padStart(2, '0')}
        </Pixel>
        <Tag color={st.color} icon={st.icon}>
          {st.text}
        </Tag>
      </div>
      {suggested && (
        <p className="mission-card__suggest">
          <Icon name="star" size={16} /> Sugestão para começar
        </p>
      )}
      <div className="mission-card__who">
        <Avatar spec={scenario.character.avatar} size={72} />
        <div>
          <h3 id={titleId} className="mission-card__title">
            {scenario.title}
          </h3>
          <p className="mission-card__person">
            <strong>{scenario.character.name}</strong> · {scenario.character.role}
          </p>
        </div>
      </div>
      <p className="mission-card__problem">{scenario.problem}</p>
      <p className="mission-card__meta">
        <Icon name="clock" size={16} /> {scenario.duration} por variação · sem tempo limite
      </p>
      <ul className="mission-card__vars" aria-label="Progresso nas variações">
        {scenario.variations.map((v) => {
          const completed = Boolean(state.completions[v.id]);
          const run = state.runs[v.id];
          const inProgress = !completed && run && (run.asked.length > 0 || run.step !== 'briefing');
          return (
            <li key={v.id}>
              <Icon name={completed ? 'check' : inProgress ? 'hourglass' : 'circle'} size={16} />
              <span>
                Variação {v.letter}: {v.title} — {completed ? 'concluída' : inProgress ? 'em andamento' : 'nova'}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mission-card__actions">
        {choice.kind === 'open' ? (
          <Button variant="primary" iconAfter="arrow-right" onClick={() => dispatch({ type: 'OPEN_VARIATION', variationId: choice.variationId })}>
            {choice.resume ? 'CONTINUAR' : status === 'parcial' ? 'JOGAR A OUTRA VARIAÇÃO' : 'ATENDER PEDIDO'}
          </Button>
        ) : (
          <>
            <p className="mission-card__choose">Você concluiu as duas variações. Qual quer repetir?</p>
            {scenario.variations.map((v) => (
              <Button key={v.id} variant="secondary" icon="refresh" onClick={() => dispatch({ type: 'OPEN_VARIATION', variationId: v.id, fresh: true })}>
                REPETIR {v.letter}: {v.title.toUpperCase()}
              </Button>
            ))}
          </>
        )}
      </div>
    </article>
  );
}
