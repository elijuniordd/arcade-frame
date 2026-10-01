import { useState } from 'react';
import { STEP_GUIDANCE } from '../../content/guidance';
import type { HelpSet, Step } from '../../types';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/primitives';

/**
 * Painel de instrução (turquesa): o que fazer e por que fazer.
 * Nas primeiras missões aparece completo; depois, resumido — com a versão completa a um clique.
 */
export function InstructionPanel({ step, level, extra }: { step: Step; level: 'completa' | 'curta'; extra?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(level === 'completa');
  const g = STEP_GUIDANCE[step];
  return (
    <div className="guide" role="note" aria-label="Orientação da etapa">
      <Icon name="map" size={26} className="guide__icon" />
      <div className="guide__body">
        <p className="guide__what">{expanded ? g.what : g.short}</p>
        {expanded && <p className="guide__why">{g.why}</p>}
        {extra}
        {level === 'curta' && (
          <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Mostrar orientação resumida' : 'Mostrar orientação completa'}
          </button>
        )}
      </div>
    </div>
  );
}

const LEVELS: { key: keyof HelpSet; title: string; button: string }[] = [
  { key: 'pista', title: 'Pista', button: 'Ver uma pista' },
  { key: 'exemplo', title: 'Exemplo', button: 'Ver um exemplo' },
  { key: 'direta', title: 'Orientação direta', button: 'Ver orientação direta' },
];

/** Ajuda em três níveis. Usar ajuda nunca reduz a pontuação. */
export function HelpPanel({ help, opened, onOpen, onClose }: { help: HelpSet; opened: number; onOpen: (level: number) => void; onClose: () => void }) {
  return (
    <section className="help" aria-labelledby="help-title">
      <div className="help__head">
        <h2 id="help-title" className="help__title">
          <Icon name="help" /> Ajuda desta etapa
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar ajuda">
          <Icon name="x" />
        </button>
      </div>
      <p className="help__note">Use quantas vezes quiser: pedir ajuda não reduz a sua pontuação.</p>
      <ol className="help__levels">
        {LEVELS.map((l, i) => (
          <li key={l.key} className="help__level">
            {opened > i ? (
              <div>
                <p className="help__level-title">
                  {i + 1}. {l.title}
                </p>
                <p>{help[l.key]}</p>
              </div>
            ) : opened === i ? (
              <Button small icon="plus" onClick={() => onOpen(i + 1)}>
                {l.button}
              </Button>
            ) : (
              <p className="help__locked">
                {i + 1}. {l.title} — disponível depois do nível anterior
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
