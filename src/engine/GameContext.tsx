import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { clearGame, detectStorage, loadGame, saveGame } from '../persistence/storage';
import type { GameState } from '../types';
import { gameReducer, initialState, type GameAction } from './reducer';

export type StorageNotice = 'none' | 'unavailable' | 'invalid' | 'repaired' | 'save-failed';

interface GameContextValue {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** Havia progresso salvo quando o jogo abriu (ou existe agora). */
  hasProgress: boolean;
  storageAvailable: boolean;
  notice: StorageNotice;
  noticeDetail?: string;
  dismissNotice: () => void;
  /** Apaga todo o progresso salvo e volta ao início. */
  eraseAll: () => void;
  /** Anuncia uma mensagem importante para leitores de tela. */
  announce: (message: string) => void;
  announcement: string;
}

const GameContext = createContext<GameContextValue | null>(null);

interface Boot {
  state: GameState;
  storage: Storage | null;
  notice: StorageNotice;
  detail?: string;
}

function boot(storageOverride?: Storage | null): Boot {
  const storage = detectStorage(storageOverride);
  const result = loadGame(storage);
  switch (result.status) {
    case 'ok':
      return { state: result.state, storage, notice: result.repaired ? 'repaired' : 'none' };
    case 'empty':
      return { state: initialState(), storage, notice: 'none' };
    case 'invalid':
      return { state: initialState(), storage, notice: 'invalid', detail: result.reason };
    case 'unavailable':
      return { state: initialState(), storage: null, notice: 'unavailable' };
  }
}

export function hasMeaningfulProgress(state: GameState): boolean {
  return Object.keys(state.runs).length > 0 || Object.keys(state.completions).length > 0;
}

export function GameProvider({ children, storage: storageOverride }: { children: ReactNode; storage?: Storage | null }) {
  const bootRef = useRef<Boot>();
  if (!bootRef.current) bootRef.current = boot(storageOverride);
  const storage = bootRef.current.storage;

  const [state, dispatch] = useReducer(gameReducer, bootRef.current.state);
  const [notice, setNotice] = useState<StorageNotice>(bootRef.current.notice);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!storage) return;
    if (!saveGame(storage, state)) setNotice('save-failed');
  }, [state, storage]);

  const announce = useCallback((message: string) => {
    // Limpa antes para que a mesma mensagem seja anunciada de novo.
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(message), 50);
  }, []);

  const eraseAll = useCallback(() => {
    clearGame(storage);
    dispatch({ type: 'RESET_ALL' });
    announce('Todo o progresso foi apagado.');
  }, [storage, announce]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      dispatch,
      hasProgress: hasMeaningfulProgress(state),
      storageAvailable: storage !== null,
      notice,
      noticeDetail: bootRef.current?.detail,
      dismissNotice: () => setNotice('none'),
      eraseAll,
      announce,
      announcement,
    }),
    [state, notice, storage, eraseAll, announce, announcement],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro de GameProvider');
  return ctx;
}
