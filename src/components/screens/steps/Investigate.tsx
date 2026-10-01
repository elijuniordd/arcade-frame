import { useEffect, useRef } from 'react';
import { getVariation } from '../../../content';
import { FACT_KINDS } from '../../../content/labels';
import { useGame } from '../../../engine/GameContext';
import type { MissionRun, Question } from '../../../types';
import { DiscoveredPanel } from '../../game/DiscoveredPanel';
import { InstructionPanel } from '../../game/Guidance';
import { Avatar } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { Button, Pixel } from '../../ui/primitives';

export function Investigate({ run, level }: { run: MissionRun; level: 'completa' | 'curta' }) {
  const { dispatch, announce } = useGame();
  const { scenario, variation } = getVariation(run.variationId);
  const c = scenario.character;
  const lastId = run.asked[run.asked.length - 1];
  const last = variation.questions.find((q) => q.id === lastId);
  const previous = run.asked.slice(0, -1).map((id) => variation.questions.find((q) => q.id === id)!).reverse();
  const answerRef = useRef<HTMLDivElement>(null);
  const askedCount = useRef(run.asked.length);

  const essentialTotal = variation.facts.filter((f) => f.essential).length;
  const essentialFound = variation.facts.filter((f) => f.essential && run.discovered.includes(f.id)).length;
  const missing = essentialTotal - essentialFound;

  useEffect(() => {
    if (run.asked.length > askedCount.current && last) {
      answerRef.current?.focus();
      const newFacts = last.reveals.length;
      announce(`${c.name} respondeu. ${newFacts > 0 ? `${newFacts} nova(s) informação(ões) no painel “O que já descobrimos”.` : ''}`);
    }
    askedCount.current = run.asked.length;
  }, [run.asked.length, last, announce, c.name]);

  const ask = (q: Question) => dispatch({ type: 'ASK', questionId: q.id });

  return (
    <div className="step step--investigate">
      <div className="step__head">
        <Pixel color="teal">ETAPA 02 · INVESTIGAR</Pixel>
        <h2 id="step-title" tabIndex={-1} className="step__title">
          Converse com {c.name}
        </h2>
      </div>

      <div className="investigate">
        <div className="investigate__side">
          <InstructionPanel step="investigate" level={level} />
          <div className="panel panel--section person-card">
            <div className="person">
              <Avatar spec={c.avatar} size={96} />
              <div>
                <p className="person__name">{c.name}</p>
                <p className="person__role">{c.role}</p>
              </div>
            </div>
            <blockquote className="quote quote--small">
              <p>{variation.situation}</p>
            </blockquote>
          </div>
          <DiscoveredPanel facts={variation.facts} discovered={run.discovered} />
        </div>

        <div className="investigate__talk">
          <section className="conversation" aria-labelledby="conv-title">
            <h3 id="conv-title" className="section-title">
              Conversa
            </h3>
            {last ? (
              <div className="exchange" ref={answerRef} tabIndex={-1} aria-label="Última resposta">
                <p className="bubble bubble--player">
                  <span className="bubble__who">Você</span>
                  {last.text}
                </p>
                <div className="bubble bubble--npc">
                  <span className="bubble__who">{c.name}</span>
                  <p>{last.answer}</p>
                </div>
                <Insight question={last} run={run} />
              </div>
            ) : (
              <p className="conversation__empty">Escolha uma pergunta abaixo para começar a conversa.</p>
            )}
          </section>

          <section className="questions" aria-labelledby="questions-title">
            <h3 id="questions-title" className="section-title">
              Escolha uma pergunta
            </h3>
            <ul className="questions__list">
              {variation.questions.map((q) => {
                const asked = run.asked.includes(q.id);
                return (
                  <li key={q.id}>
                    <button type="button" className={['question', asked && 'is-asked'].filter(Boolean).join(' ')} onClick={() => ask(q)} disabled={asked}>
                      <Icon name={asked ? 'check' : 'chat'} size={20} />
                      <span className="question__text">{q.text}</span>
                      {asked && <span className="question__state">Já perguntado</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {previous.length > 0 && (
            <details className="history">
              <summary>Ver respostas anteriores ({previous.length})</summary>
              <ul>
                {previous.map((q) => (
                  <li key={q.id}>
                    <p className="history__q">{q.text}</p>
                    <p>{q.answer}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="step__footer step__footer--split">
        <p className="step__status" aria-live="polite">
          {missing === 0 ? (
            <>
              <Icon name="check" size={18} /> Você reuniu todas as informações essenciais.
            </>
          ) : (
            <>
              <Icon name="info" size={18} /> Ainda faltam {missing} informação(ões) essencial(is). Você pode continuar mesmo assim e voltar a conversar depois.
            </>
          )}
        </p>
        <Button variant="primary" iconAfter="arrow-right" onClick={() => dispatch({ type: 'SET_STEP', step: 'build' })}>
          MONTAR O PEDIDO
        </Button>
      </div>
    </div>
  );
}

function Insight({ question, run }: { question: Question; run: MissionRun }) {
  const { variation } = getVariation(run.variationId);
  const facts = variation.facts.filter((f) => question.reveals.includes(f.id));
  const weak = question.usefulness === 'pouco-util';
  return (
    <div className={['insight', weak && 'insight--weak'].filter(Boolean).join(' ')}>
      <p className="insight__title">
        <Icon name={weak ? 'info' : 'search'} size={18} /> {weak ? 'Sobre essa pergunta' : 'Por que essa pergunta ajuda'}
      </p>
      <p>{question.why}</p>
      {facts.map((f) => (
        <div key={f.id} className="insight__fact">
          <p>
            <strong>Nova informação — {FACT_KINDS[f.kind].title}:</strong> {f.text}
          </p>
          {f.concept && (
            <p className="concept">
              <span className="concept__term">{f.concept.term}</span> {f.concept.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
