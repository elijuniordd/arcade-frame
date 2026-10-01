import { FACT_KINDS, FACT_ORDER } from '../../content/labels';
import type { Fact } from '../../types';
import { Icon } from '../ui/Icon';

/** Painel “O que já descobrimos”, organizado por títulos cotidianos com o termo técnico ao lado. */
export function DiscoveredPanel({ facts, discovered, headingLevel = 2, id = 'descobertas' }: { facts: Fact[]; discovered: string[]; headingLevel?: 2 | 3; id?: string }) {
  const known = facts.filter((f) => discovered.includes(f.id));
  const essentialTotal = facts.filter((f) => f.essential).length;
  const essentialFound = known.filter((f) => f.essential).length;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className="discovered" aria-labelledby={`${id}-title`} id={id}>
      <H id={`${id}-title`} className="discovered__title">
        <Icon name="pin" /> O que já descobrimos
      </H>
      <p className="discovered__count">
        Informações essenciais: <strong>{essentialFound} de {essentialTotal}</strong>
      </p>
      {known.length === 0 ? (
        <p className="discovered__empty">Ainda nada por aqui. Cada resposta importante da conversa aparece neste painel.</p>
      ) : (
        <dl className="discovered__list">
          {FACT_ORDER.map((kind) => {
            const items = known.filter((f) => f.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind} className="discovered__group">
                <dt>
                  {FACT_KINDS[kind].title} <span className="term">— {FACT_KINDS[kind].term}</span>
                </dt>
                {items.map((f) => (
                  <dd key={f.id}>
                    {f.text}
                    {f.essential && <span className="sr-only"> (essencial)</span>}
                  </dd>
                ))}
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

/** Glossário com os termos já apresentados (sempre depois de um exemplo concreto). */
export function Glossary({ facts, discovered }: { facts: Fact[]; discovered: string[] }) {
  const concepts = facts.filter((f) => f.concept && discovered.includes(f.id)).map((f) => f.concept!);
  const unique = concepts.filter((c, i) => concepts.findIndex((x) => x.term === c.term) === i);
  if (unique.length === 0) return null;
  return (
    <dl className="glossary">
      {unique.map((c) => (
        <div key={c.term} className="glossary__item">
          <dt>{c.term}</dt>
          <dd>{c.explanation}</dd>
        </div>
      ))}
    </dl>
  );
}
