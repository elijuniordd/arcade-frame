import type { SimAction, SimEvent, SimFlag, Simulation, ToolConfig, ToolState } from '../types';
import { createInventory, donate, query, withdraw } from './inventory';
import { cancelEnrollment, createEnrollment, enroll } from './enrollment';
import { book, cancelBooking, createSchedule } from './schedule';

export { evaluateTests, allTestsPassed } from './checks';

/** Cria a ferramenta simulada a partir dos dados iniciais da missão. */
export function createSimulation(config: ToolConfig): Simulation {
  let tool: ToolState;
  switch (config.kind) {
    case 'inventory':
      tool = createInventory(config);
      break;
    case 'enrollment':
      tool = createEnrollment(config);
      break;
    case 'schedule':
      tool = createSchedule(config);
      break;
  }
  return { tool, events: [], seq: 0 };
}

/**
 * Aplica uma ação do jogador (ou de um teste automático) à ferramenta.
 * Nenhum código é gerado ou executado: o comportamento é escolhido a partir das
 * capacidades (flags) ligadas pelos blocos do pedido.
 */
export function applyAction(
  sim: Simulation,
  config: ToolConfig,
  flags: readonly SimFlag[],
  action: SimAction,
  forTest?: string,
): Simulation {
  const tool = sim.tool;
  let result: { state: ToolState; event: Omit<SimEvent, 'seq' | 'forTest'> } | null = null;

  if (tool.kind === 'inventory' && config.kind === 'inventory') {
    if (action.type === 'inv.donate') result = donate(tool, config, flags, action);
    else if (action.type === 'inv.withdraw') result = withdraw(tool, config, flags, action);
    else if (action.type === 'inv.query') result = query(tool, config, flags);
  } else if (tool.kind === 'enrollment' && config.kind === 'enrollment') {
    if (action.type === 'enr.enroll') result = enroll(tool, flags, action);
    else if (action.type === 'enr.cancel') result = cancelEnrollment(tool, flags, action);
  } else if (tool.kind === 'schedule' && config.kind === 'schedule') {
    if (action.type === 'sch.book') result = book(tool, config, flags, action);
    else if (action.type === 'sch.cancel') result = cancelBooking(tool, config, flags, action);
  }
  if (!result) return sim;

  const seq = sim.seq + 1;
  const event = { ...result.event, seq, ...(forTest ? { forTest } : {}) } as SimEvent;
  return { tool: result.state, events: [...sim.events, event], seq };
}
