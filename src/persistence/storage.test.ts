import { describe, expect, it } from 'vitest';
import { gameReducer, initialState } from '../engine/reducer';
import type { GameState } from '../types';
import { clearGame, detectStorage, loadGame, saveGame, SAVE_VERSION, STORAGE_KEY } from './storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

class BrokenStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
  getItem(): string | null {
    throw new Error('SecurityError');
  }
}

function playedState(): GameState {
  let s = gameReducer(initialState(), { type: 'OPEN_VARIATION', variationId: 'doacoes-a' });
  s = gameReducer(s, { type: 'SET_STEP', step: 'investigate' });
  s = gameReducer(s, { type: 'ASK', questionId: 'q-registra' });
  s = gameReducer(s, { type: 'SET_STEP', step: 'build' });
  s = gameReducer(s, { type: 'ADD_BLOCK', blockId: 'd-aco-entrada' });
  s = gameReducer(s, { type: 'ADD_BLOCK', blockId: 'd-aco-saida' });
  s = gameReducer(s, { type: 'EDIT_BLOCK', blockId: 'd-aco-saida', text: 'Anotar as saídas.' });
  s = gameReducer(s, { type: 'EXPERIMENT' });
  s = gameReducer(s, { type: 'RUN_TEST', testId: 't-excesso' });
  return s;
}

describe('persistência', () => {
  it('salva e restaura a partida, incluindo o estado da simulação', () => {
    const storage = new MemoryStorage();
    const state = playedState();
    expect(saveGame(storage, state)).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.state).toEqual(state);
    const run = loaded.state.runs['doacoes-a']!;
    expect(run.step).toBe('test');
    expect(run.assembly[1].text).toBe('Anotar as saídas.');
    expect(run.sim!.events).toHaveLength(1);
    expect(run.attempts[0].tests['t-excesso'].status).toBe('falhou');
  });

  it('o arquivo salvo tem versão de formato', () => {
    const storage = new MemoryStorage();
    saveGame(storage, initialState());
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(SAVE_VERSION);
  });

  it('sem progresso salvo, informa vazio', () => {
    expect(loadGame(new MemoryStorage()).status).toBe('empty');
  });

  it('JSON corrompido é tratado sem travar', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{isso não é json');
    expect(loadGame(storage).status).toBe('invalid');
  });

  it('versão incompatível é tratada sem travar', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, state: initialState() }));
    const r = loadGame(storage);
    expect(r.status).toBe('invalid');
  });

  it('dados parcialmente inválidos são reparados', () => {
    const storage = new MemoryStorage();
    const state = playedState();
    const broken = JSON.parse(JSON.stringify(state));
    broken.runs['doacoes-a'].sim = { tool: { kind: 'schedule' }, events: 'x', seq: 1 };
    broken.runs['doacoes-a'].assembly.push({ blockId: 'nao-existe', text: 'x' });
    broken.runs['inventada'] = { step: 'test' };
    broken.badges.push('falsa');
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }));
    const r = loadGame(storage);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.repaired).toBe(true);
    const run = r.state.runs['doacoes-a']!;
    expect(run.sim).toBeNull();
    expect(run.step).toBe('build'); // sem simulação válida, volta para a montagem
    expect(run.assembly.map((a) => a.blockId)).toEqual(['d-aco-entrada', 'd-aco-saida']);
    expect(Object.keys(r.state.runs)).toEqual(['doacoes-a']);
    expect(r.state.badges).not.toContain('falsa');
  });

  it('estado com tela de missão sem partida ativa volta para a oficina', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state: { screen: 'mission', active: 'doacoes-a', runs: {} } }));
    const r = loadGame(storage);
    expect(r.status === 'ok' && r.state.screen).toBe('workshop');
  });

  it('armazenamento indisponível é detectado', () => {
    expect(detectStorage(new BrokenStorage())).toBeNull();
    expect(detectStorage(null)).toBeNull();
    expect(loadGame(null).status).toBe('unavailable');
    expect(saveGame(null, initialState())).toBe(false);
    expect(saveGame(new BrokenStorage(), initialState())).toBe(false);
    expect(() => clearGame(new BrokenStorage())).not.toThrow();
  });

  it('apagar remove o progresso salvo', () => {
    const storage = new MemoryStorage();
    saveGame(storage, playedState());
    clearGame(storage);
    expect(loadGame(storage).status).toBe('empty');
  });
});
