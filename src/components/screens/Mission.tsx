import { useEffect, useRef, useState } from 'react';
import { getVariation } from '../../content';
import { useGame } from '../../engine/GameContext';
import { guidanceLevel } from '../../engine/selection';
import type { Step } from '../../types';
import { HelpPanel } from '../game/Guidance';
import { StepIndicator } from '../game/StepIndicator';
import { Dialog } from '../ui/Dialog';
import { Button, Pixel } from '../ui/primitives';
import { Briefing } from './steps/Briefing';
import { Investigate } from './steps/Investigate';
import { Build } from './steps/Build';
import { TestLab } from './steps/TestLab';
import { Result } from './steps/Result';

export function Mission() {
  const { state, dispatch } = useGame();
  const run = state.active ? state.runs[state.active] : undefined;
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const firstRender = useRef(true);
  const step = run?.step;

  // Ao mudar de etapa: volta ao topo e leva o foco ao título da etapa.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('step-title')?.focus({ preventScroll: true });
  }, [step]);

  if (!run) return null;
  const { scenario, variation } = getVariation(run.variationId);
  const level = guidanceLevel(state);
  const helpStep: Step = run.step === 'result' ? 'test' : run.step;
  const helpKey = helpStep as keyof typeof variation.help;

  return (
    <div className="mission">
      <section className="mission-bar" aria-labelledby="page-title">
        <div className="container">
          <div className="mission-bar__top">
            <Pixel color="lime">
              MISSÃO {String(scenario.number).padStart(2, '0')} · VARIAÇÃO {variation.letter}
            </Pixel>
            <div className="mission-bar__actions">
              <Button small variant={helpOpen ? 'primary' : 'secondary'} icon="help" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen} aria-controls="help-area">
                AJUDA
              </Button>
              <Button small variant="ghost" icon="refresh" onClick={() => setConfirmRestart(true)}>
                REINICIAR MISSÃO
              </Button>
              <Button small variant="ghost" icon="home" onClick={() => dispatch({ type: 'GO_WORKSHOP' })}>
                VOLTAR À OFICINA
              </Button>
            </div>
          </div>
          <h1 id="page-title" tabIndex={-1} className="mission-bar__title">
            {scenario.title} <span className="mission-bar__subtitle">— {variation.title}</span>
          </h1>
          <p className="mission-bar__goal">
            <strong>Objetivo:</strong> {variation.goal}
          </p>
          {variation.referenceNote && <p className="mission-bar__ref">{variation.referenceNote}</p>}
          <StepIndicator run={run} onSelect={(s) => dispatch({ type: 'SET_STEP', step: s })} />
        </div>
      </section>

      <div className="container mission__body">
        <div id="help-area">
          {helpOpen && (
            <HelpPanel
              help={variation.help[helpKey]}
              opened={run.help[helpStep] ?? 0}
              onOpen={(lvl) => dispatch({ type: 'USE_HELP', step: helpStep, level: lvl })}
              onClose={() => setHelpOpen(false)}
            />
          )}
        </div>
        {run.step === 'briefing' && <Briefing run={run} level={level} />}
        {run.step === 'investigate' && <Investigate run={run} level={level} />}
        {run.step === 'build' && <Build run={run} level={level} />}
        {run.step === 'test' && <TestLab run={run} level={level} />}
        {run.step === 'result' && <Result run={run} />}
      </div>

      <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)} title="Reiniciar esta missão?">
        <p>
          A conversa, o pedido e os testes de <strong>{scenario.title} — variação {variation.letter}</strong> voltam ao começo.
        </p>
        <p>Missões concluídas e conquistas continuam salvas. Para apagar tudo, use “Progresso” no menu.</p>
        <div className="dialog__actions">
          <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
            CANCELAR
          </Button>
          <Button
            variant="danger"
            icon="refresh"
            onClick={() => {
              dispatch({ type: 'RESTART_MISSION' });
              setConfirmRestart(false);
              setHelpOpen(false);
            }}
          >
            REINICIAR MISSÃO
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
