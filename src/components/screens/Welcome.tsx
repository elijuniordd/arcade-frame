import { useGame } from '../../engine/GameContext';
import { Brand } from '../game/Brand';
import { Button, Pixel, Tag } from '../ui/primitives';

export function Welcome() {
  const { state, dispatch, hasProgress } = useGame();
  const activeRun = state.active ? state.runs[state.active] : undefined;
  const canContinue = hasProgress;

  return (
    <div className="welcome">
      <section className="hero container" aria-labelledby="page-title">
        <Pixel color="teal">▸ OFICINA DE TECNOLOGIA DO BAIRRO</Pixel>
        <h1 id="page-title" tabIndex={-1} className="hero__title">
          <span className="sr-only">Oficina do Amanhã</span>
          <span aria-hidden="true">
            <Brand size="large" />
          </span>
        </h1>
        <ul className="hero__tags" aria-label="Temas do jogo">
          <li>
            <Tag color="yellow" tilt={-2}>
              TECNOLOGIA
            </Tag>
          </li>
          <li>
            <Tag color="teal" tilt={1}>
              COMUNIDADE
            </Tag>
          </li>
          <li>
            <Tag color="lilac" tilt={-1}>
              IA
            </Tag>
          </li>
        </ul>
        <p className="hero__lead">
          Moradores do bairro trazem pedidos de ajuda para a oficina. Você conversa com eles, monta um pedido claro para uma inteligência artificial e testa a
          ferramenta criada antes de entregá-la. Não precisa saber programar.
        </p>
        <div className="hero__actions">
          {canContinue && (
            <Button variant="primary" iconAfter="arrow-right" onClick={() => dispatch(activeRun ? { type: 'CONTINUE' } : { type: 'GO_WORKSHOP' })}>
              CONTINUAR PARTIDA
            </Button>
          )}
          <Button variant="primary" iconAfter={canContinue ? 'map' : 'arrow-right'} onClick={() => dispatch({ type: 'GO_WORKSHOP' })}>
            COMEÇAR A JOGAR
          </Button>
        </div>
        <ul className="stats" aria-label="Sobre o jogo">
          <li className="stat">
            <span className="stat__num">03</span>
            <span className="stat__label">pedidos</span>
          </li>
          <li className="stat">
            <span className="stat__num">06</span>
            <span className="stat__label">variações</span>
          </li>
          <li className="stat">
            <span className="stat__num">5–8</span>
            <span className="stat__label">min cada</span>
          </li>
          <li className="stat">
            <span className="stat__num">00</span>
            <span className="stat__label">cadastros</span>
          </li>
        </ul>
      </section>

      <section className="purpose" aria-labelledby="purpose-title">
        <div className="container purpose__grid">
          <div>
            <Pixel color="lime">▸ O PROPÓSITO</Pixel>
            <h2 id="purpose-title" className="display-title">
              Aprender tecnologia resolvendo problemas do bairro
            </h2>
          </div>
          <div className="purpose__text">
            <p>
              Uma ferramenta digital só ajuda quando entende o problema de verdade. Nesta oficina, você aprende a fazer isso em três passos — com linguagem do dia a
              dia e ajuda sempre disponível.
            </p>
            <ol className="howto">
              <li>
                <Tag color="teal" tilt={-1}>
                  INVESTIGAR
                </Tag>
                <span>Converse com a pessoa e descubra como ela trabalha, o que dá errado e o que precisa acontecer em cada situação.</span>
              </li>
              <li>
                <Tag color="yellow" tilt={1}>
                  CRIAR
                </Tag>
                <span>Monte um pedido claro para a IA, escolhendo e ajustando blocos de texto.</span>
              </li>
              <li>
                <Tag color="lime" tilt={-1}>
                  TESTAR
                </Tag>
                <span>Experimente a ferramenta criada. Respostas de IA podem ter falhas — testar é o que revela isso.</span>
              </li>
            </ol>
            <p className="muted">
              A IA deste jogo é simulada: as respostas são preparadas com antecedência e funcionam sem internet depois que a página carrega. Não há cronômetro, cadastro
              ou coleta de dados. Seu progresso fica salvo apenas neste navegador.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
