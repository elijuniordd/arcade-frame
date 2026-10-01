import { STEPS } from '../../content/labels';
import { canVisit } from '../../engine/reducer';
import type { MissionRun, Step } from '../../types';
import { Icon } from '../ui/Icon';

/** Indicador de etapas: mostra onde o jogador está e permite voltar a etapas já liberadas. */
export function StepIndicator({ run, onSelect }: { run: MissionRun; onSelect: (step: Step) => void }) {
  const currentIndex = STEPS.findIndex((s) => s.id === run.step);
  return (
    <nav className="steps" aria-label="Etapas da missão">
      <p className="steps__current" aria-hidden="true">
        Etapa {currentIndex + 1} de {STEPS.length}: {STEPS[currentIndex]?.label}
      </p>
      <ol className="steps__list">
        {STEPS.map((s, i) => {
          const current = s.id === run.step;
          const available = canVisit(run, s.id);
          const done = i < currentIndex || (s.id === 'result' && run.completed);
          const stateText = current ? 'etapa atual' : done ? 'etapa visitada' : available ? 'disponível' : 'ainda bloqueada';
          return (
            <li key={s.id} className={['steps__item', current && 'is-current', done && 'is-done'].filter(Boolean).join(' ')}>
              <button
                type="button"
                className="steps__btn"
                onClick={() => onSelect(s.id)}
                disabled={!available || current}
                aria-current={current ? 'step' : undefined}
                aria-label={`${i + 1}. ${s.label} — ${stateText}`}
              >
                <span className="steps__num" aria-hidden="true">
                  {done && !current ? <Icon name="check" size={14} /> : String(i + 1).padStart(2, '0')}
                </span>
                <span className="steps__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
