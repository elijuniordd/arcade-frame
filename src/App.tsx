import { useEffect, useRef, useState } from 'react';
import { SCENARIOS } from './content';
import { GameProvider, useGame } from './engine/GameContext';
import { Brand } from './components/game/Brand';
import { BadgeGrid } from './components/game/Badges';
import { Mission } from './components/screens/Mission';
import { Welcome } from './components/screens/Welcome';
import { Workshop } from './components/screens/Workshop';
import { Dialog } from './components/ui/Dialog';
import { Button, Notice, Tag } from './components/ui/primitives';

export function App({ storage }: { storage?: Storage | null }) {
  return (
    <GameProvider storage={storage}>
      <Shell />
    </GameProvider>
  );
}

type DialogId = 'how' | 'progress' | null;

function Shell() {
  const { state, announcement } = useGame();
  const [dialog, setDialog] = useState<DialogId>(null);
  const first = useRef(true);

  // Ao trocar de tela, volta ao topo e leva o foco ao título principal.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [state.screen, state.active]);

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Header onOpen={setDialog} />
      <StorageNotice />
      <main id="conteudo" tabIndex={-1}>
        {state.screen === 'welcome' && <Welcome />}
        {state.screen === 'workshop' && <Workshop />}
        {state.screen === 'mission' && <Mission />}
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            <strong>Oficina do Amanhã</strong> — protótipo de jogo educativo. A IA deste jogo é simulada, com respostas preparadas com antecedência. Sem cadastro, sem coleta de
            dados e sem rastreamento.
          </p>
        </div>
      </footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <HowToPlayDialog open={dialog === 'how'} onClose={() => setDialog(null)} />
      <ProgressDialog open={dialog === 'progress'} onClose={() => setDialog(null)} />
    </>
  );
}

function Header({ onOpen }: { onOpen: (d: DialogId) => void }) {
  const { state, dispatch, hasProgress } = useGame();
  const activeRun = state.active ? state.runs[state.active] : undefined;
  const showContinue = state.screen !== 'mission' && activeRun && !activeRun.completed;
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button type="button" className="brand-btn" onClick={() => dispatch({ type: 'GO_WELCOME' })} aria-label="Oficina do Amanhã — página inicial">
          <Brand />
        </button>
        <nav aria-label="Principal" className="site-nav">
          <ul>
            <li>
              <button type="button" className="nav-btn" aria-current={state.screen === 'workshop' ? 'page' : undefined} onClick={() => dispatch({ type: 'GO_WORKSHOP' })}>
                Oficina
              </button>
            </li>
            <li>
              <button type="button" className="nav-btn" onClick={() => onOpen('how')}>
                Como jogar
              </button>
            </li>
            <li>
              <button type="button" className="nav-btn" onClick={() => onOpen('progress')}>
                Progresso
              </button>
            </li>
          </ul>
        </nav>
        {showContinue ? (
          <Button variant="primary" small iconAfter="arrow-right" onClick={() => dispatch({ type: 'CONTINUE' })}>
            CONTINUAR
          </Button>
        ) : state.screen === 'welcome' ? (
          <Button variant="primary" small iconAfter="arrow-right" onClick={() => dispatch({ type: 'GO_WORKSHOP' })}>
            {hasProgress ? 'IR À OFICINA' : 'JOGAR'}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function StorageNotice() {
  const { notice, noticeDetail, dismissNotice, storageAvailable } = useGame();
  if (!storageAvailable) {
    return (
      <div className="container notice-area">
        <Notice tone="alert" title="O progresso não será salvo">
          Este navegador não permite guardar dados (por exemplo, em modo privado ou com armazenamento bloqueado). Você pode jogar normalmente, mas ao fechar ou atualizar a
          página a partida recomeça.
        </Notice>
      </div>
    );
  }
  if (notice === 'none') return null;
  const text =
    notice === 'invalid'
      ? `Não foi possível usar o progresso salvo (${noticeDetail ?? 'formato desconhecido'}). Começamos uma partida nova; nada mais foi alterado.`
      : notice === 'repaired'
        ? 'Parte do progresso salvo estava incompleta e foi ajustada. Se algo parecer estranho, você pode reiniciar a missão.'
        : 'Não foi possível salvar o progresso agora (o armazenamento do navegador pode estar cheio). Você pode continuar jogando.';
  return (
    <div className="container notice-area">
      <Notice tone="info" title="Sobre o seu progresso" onClose={dismissNotice}>
        {text}
      </Notice>
    </div>
  );
}

function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Como jogar">
      <ol className="howto">
        <li>
          <Tag color="teal">INVESTIGAR</Tag>
          <span>Escolha perguntas para entender como a pessoa trabalha. O que for importante vai para o painel “O que já descobrimos”.</span>
        </li>
        <li>
          <Tag color="yellow">CRIAR</Tag>
          <span>Monte um pedido para a IA com blocos: objetivo, contexto, o que registrar, regras, cuidados, resultado e como conferir. Você pode editar, mover e remover blocos.</span>
        </li>
        <li>
          <Tag color="lime">TESTAR</Tag>
          <span>A IA simulada cria uma ferramenta. Faça os testes. Se algo falhar, revise o pedido e experimente de novo.</span>
        </li>
      </ol>
      <p>
        O botão <strong>AJUDA</strong> fica no topo de cada missão e oferece três níveis: uma pista, um exemplo e uma orientação direta. Usar ajuda não reduz a pontuação.
      </p>
      <p>Não há cronômetro. Tudo funciona com mouse, toque ou teclado (Tab para navegar, Enter ou Espaço para escolher).</p>
      <div className="dialog__actions">
        <Button variant="primary" onClick={onClose}>
          ENTENDI
        </Button>
      </div>
    </Dialog>
  );
}

function ProgressDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, eraseAll, storageAvailable } = useGame();
  const [confirm, setConfirm] = useState(false);
  const activeRun = state.active ? state.runs[state.active] : undefined;
  const close = () => {
    setConfirm(false);
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} title="Seu progresso">
      <p>{storageAvailable ? 'O progresso fica salvo apenas neste navegador.' : 'Neste navegador o progresso não está sendo salvo.'}</p>
      <ul className="progress-list">
        {SCENARIOS.map((s) => (
          <li key={s.id}>
            <strong>{s.title}</strong>:{' '}
            {s.variations.map((v) => `variação ${v.letter} ${state.completions[v.id] ? 'concluída' : state.runs[v.id] ? 'em andamento' : 'nova'}`).join(' · ')}
          </li>
        ))}
      </ul>
      <h3 className="subhead">Conquistas</h3>
      <BadgeGrid earned={state.badges} />

      <h3 className="subhead">Recomeçar</h3>
      {activeRun && !activeRun.completed && (
        <div className="dialog__row">
          <p>Reiniciar a missão atual volta só ela ao começo. Conquistas e missões concluídas são mantidas.</p>
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => {
              dispatch({ type: 'RESTART_MISSION' });
              close();
            }}
          >
            REINICIAR MISSÃO ATUAL
          </Button>
        </div>
      )}
      <div className="dialog__row">
        <p>Apagar todo o progresso remove missões, tentativas e conquistas deste navegador. Não pode ser desfeito.</p>
        {confirm ? (
          <div className="dialog__actions">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              CANCELAR
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                eraseAll();
                close();
              }}
            >
              SIM, APAGAR TUDO
            </Button>
          </div>
        ) : (
          <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>
            APAGAR TODO O PROGRESSO
          </Button>
        )}
      </div>
    </Dialog>
  );
}
