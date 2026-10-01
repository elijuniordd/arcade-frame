import { getVariation } from '../../../content';
import { useGame } from '../../../engine/GameContext';
import type { MissionRun } from '../../../types';
import { InstructionPanel } from '../../game/Guidance';
import { Avatar } from '../../ui/Avatar';
import { Button, Panel, Pixel, Tag } from '../../ui/primitives';

export function Briefing({ run, level }: { run: MissionRun; level: 'completa' | 'curta' }) {
  const { dispatch } = useGame();
  const { scenario, variation } = getVariation(run.variationId);
  const c = scenario.character;
  return (
    <div className="step step--briefing">
      <div className="step__head">
        <Pixel color="teal">ETAPA 01 · PEDIDO DE AJUDA</Pixel>
        <h2 id="step-title" tabIndex={-1} className="step__title">
          {c.name} precisa de ajuda
        </h2>
      </div>
      <InstructionPanel step="briefing" level={level} />

      <div className="briefing">
        <Panel variant="section" className="briefing__story" labelledBy="story-title">
          <div className="person">
            <Avatar spec={c.avatar} size={112} />
            <div>
              <h3 id="story-title" className="person__name">
                {c.name}
              </h3>
              <p className="person__role">{c.role}</p>
              <p className="person__place">{scenario.place}</p>
            </div>
          </div>
          <blockquote className="quote">
            <p>{variation.situation}</p>
          </blockquote>
        </Panel>

        <Panel variant="surface" className="briefing__plan" labelledBy="plan-title">
          <h3 id="plan-title" className="section-title">
            O que você vai fazer
          </h3>
          <ol className="howto">
            <li>
              <Tag color="teal" tilt={-1}>
                INVESTIGAR
              </Tag>
              <span>Conversar com {c.name} para entender o problema.</span>
            </li>
            <li>
              <Tag color="yellow" tilt={1}>
                CRIAR
              </Tag>
              <span>Montar um pedido claro para a IA.</span>
            </li>
            <li>
              <Tag color="lime" tilt={-1}>
                TESTAR
              </Tag>
              <span>Experimentar a ferramenta criada e corrigir o pedido se algo falhar.</span>
            </li>
          </ol>
          <p className="briefing__learning">
            <strong>O que você vai aprender:</strong> {variation.learning}
          </p>
          <p className="muted">Sem tempo limite. Tentativas que não dão certo fazem parte do processo — você pode revisar quantas vezes quiser.</p>
        </Panel>
      </div>

      <div className="step__footer">
        <Button variant="primary" iconAfter="arrow-right" onClick={() => dispatch({ type: 'SET_STEP', step: 'investigate' })}>
          COMEÇAR A INVESTIGAR
        </Button>
      </div>
    </div>
  );
}
