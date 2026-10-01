import type {
  DonateEvent,
  InventoryConfig,
  InventoryState,
  Lot,
  QueryEvent,
  SimFlag,
  WithdrawEvent,
} from '../types';
import { formatDate, isExpired } from './format';

/**
 * Simulação de estoque e validade.
 *
 * Os lotes representam o que existe fisicamente na prateleira (inclusive a validade
 * impressa na embalagem). Se o pedido não incluiu a validade, a ferramenta
 * simplesmente não usa essa informação — e é isso que os testes revelam.
 */

type Draft<E> = Omit<E, 'seq' | 'forTest'>;

const has = (flags: readonly SimFlag[], flag: SimFlag) => flags.includes(flag);

export function createInventory(config: InventoryConfig): InventoryState {
  return { kind: 'inventory', lots: config.lots.map((lot) => ({ ...lot })), nextLot: config.lots.length + 1 };
}

export function productName(config: InventoryConfig, productId: string): string {
  return config.products.find((p) => p.id === productId)?.name ?? productId;
}

function unitLabel(config: InventoryConfig, productId: string, qty: number): string {
  const p = config.products.find((x) => x.id === productId);
  if (!p) return String(qty);
  return `${qty} ${p.unit}`;
}

export function totalOf(state: InventoryState, productId: string): number {
  return state.lots.filter((l) => l.product === productId).reduce((sum, l) => sum + l.qty, 0);
}

export function validOf(state: InventoryState, productId: string, referenceDate?: string): number {
  return state.lots
    .filter((l) => l.product === productId && !isExpired(l.expiry, referenceDate))
    .reduce((sum, l) => sum + l.qty, 0);
}

/** A ferramenta só considera validade quando o pedido incluiu esse dado. */
export function tracksExpiry(flags: readonly SimFlag[], config: InventoryConfig): boolean {
  return has(flags, 'inv.expiry') && Boolean(config.referenceDate);
}

export function donate(
  state: InventoryState,
  config: InventoryConfig,
  flags: readonly SimFlag[],
  input: { product: string; qty: number; expiry?: string },
): { state: InventoryState; event: Draft<DonateEvent> } {
  const base = { type: 'inv.donate' as const, product: input.product, qty: input.qty, expiry: input.expiry, expiryStored: false };
  if (!has(flags, 'inv.entries')) {
    return {
      state,
      event: { ...base, outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como registrar doações: o pedido não falou de entradas.' },
    };
  }
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    return { state, event: { ...base, outcome: 'recusado', message: 'Informe uma quantidade inteira maior que zero.' } };
  }
  const storeExpiry = tracksExpiry(flags, config);
  if (storeExpiry && !input.expiry) {
    return { state, event: { ...base, outcome: 'recusado', message: 'Informe a data de validade do lote.' } };
  }
  const lot: Lot = {
    id: `L${state.nextLot}`,
    product: input.product,
    qty: input.qty,
    expiry: storeExpiry ? input.expiry : undefined,
  };
  const next: InventoryState = { ...state, lots: [...state.lots, lot], nextLot: state.nextLot + 1 };
  const total = totalOf(next, input.product);
  const message = storeExpiry
    ? `Lote ${lot.id} registrado: ${unitLabel(config, input.product, input.qty)} de ${productName(config, input.product)}, validade ${formatDate(input.expiry)}. Total do produto: ${total}.`
    : `Doação registrada: ${unitLabel(config, input.product, input.qty)} de ${productName(config, input.product)}. Total do produto: ${total}.`;
  return { state: next, event: { ...base, expiryStored: storeExpiry, outcome: 'aceito', message } };
}

export function withdraw(
  state: InventoryState,
  config: InventoryConfig,
  flags: readonly SimFlag[],
  input: { product: string; qty: number; lotId?: string },
): { state: InventoryState; event: Draft<WithdrawEvent> } {
  const ref = config.referenceDate;
  const expiryTracked = tracksExpiry(flags, config);
  const stockCheck = has(flags, 'inv.stockCheck') && !has(flags, 'inv.allowNegative');
  const blockExpired = expiryTracked && has(flags, 'inv.blockExpired');
  const name = productName(config, input.product);
  const base = {
    type: 'inv.withdraw' as const,
    product: input.product,
    qty: input.qty,
    lotId: input.lotId,
    availableBefore: 0,
    stockAfter: totalOf(state, input.product),
    touchedExpired: false,
  };

  if (!has(flags, 'inv.exits')) {
    return {
      state,
      event: { ...base, outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como registrar retiradas: o pedido não falou de saídas.' },
    };
  }
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    return { state, event: { ...base, outcome: 'recusado', reason: 'quantidade', message: 'Informe uma quantidade inteira maior que zero.' } };
  }

  // Lote escolhido explicitamente (só existe quando a ferramenta guarda validade).
  const chosen = expiryTracked && input.lotId ? state.lots.find((l) => l.id === input.lotId && l.product === input.product) : undefined;

  let candidates: Lot[];
  if (chosen) {
    candidates = [chosen];
  } else {
    candidates = state.lots.filter((l) => l.product === input.product);
    if (expiryTracked) {
      // Primeiro o que vence antes.
      candidates = [...candidates].sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'));
      if (blockExpired) candidates = candidates.filter((l) => !isExpired(l.expiry, ref));
    }
  }
  const availableBefore = candidates.reduce((sum, l) => sum + Math.max(0, l.qty), 0);

  if (chosen && blockExpired && isExpired(chosen.expiry, ref)) {
    return {
      state,
      event: {
        ...base,
        availableBefore,
        touchedExpired: true,
        outcome: 'recusado',
        reason: 'vencido',
        message: `Entrega bloqueada: o lote ${chosen.id} de ${name} venceu em ${formatDate(chosen.expiry)}. Separe esse lote para descarte.`,
      },
    };
  }

  if (stockCheck && input.qty > availableBefore) {
    return {
      state,
      event: {
        ...base,
        availableBefore,
        outcome: 'recusado',
        reason: 'estoque',
        message: `Retirada recusada: você pediu ${unitLabel(config, input.product, input.qty)}, mas só há ${availableBefore} disponível(is) de ${name}.`,
      },
    };
  }

  // Desconta dos lotes na ordem. Sem validação, o restante vira estoque negativo.
  let remaining = input.qty;
  let touchedExpired = false;
  const lots = state.lots.map((l) => ({ ...l }));
  const order = candidates.map((c) => lots.find((l) => l.id === c.id)!);
  for (const lot of order) {
    if (remaining <= 0) break;
    const take = Math.min(Math.max(0, lot.qty), remaining);
    if (take > 0) {
      lot.qty -= take;
      remaining -= take;
      if (isExpired(lot.expiry, ref)) touchedExpired = true;
    }
  }
  let nextLot = state.nextLot;
  if (remaining > 0) {
    const target = order[order.length - 1];
    if (target) {
      target.qty -= remaining;
      if (isExpired(target.expiry, ref)) touchedExpired = true;
    } else {
      lots.push({ id: `L${nextLot}`, product: input.product, qty: -remaining });
      nextLot += 1;
    }
  }
  const next: InventoryState = { ...state, lots, nextLot };
  const stockAfter = totalOf(next, input.product);
  const lotText = chosen ? ` do lote ${chosen.id}` : '';
  return {
    state: next,
    event: {
      ...base,
      availableBefore,
      stockAfter,
      touchedExpired,
      outcome: 'aceito',
      message: `Retirada registrada: ${unitLabel(config, input.product, input.qty)} de ${name}${lotText}. Estoque de ${name}: ${stockAfter}.`,
    },
  };
}

export function query(
  state: InventoryState,
  config: InventoryConfig,
  flags: readonly SimFlag[],
): { state: InventoryState; event: Draft<QueryEvent> } {
  const ref = config.referenceDate;
  const separated = tracksExpiry(flags, config) && has(flags, 'inv.separateExpired');
  let hiddenExpired = 0;
  const rows = config.products.map((p) => {
    const total = totalOf(state, p.id);
    const valid = validOf(state, p.id, ref);
    const expired = total - valid;
    if (!separated) hiddenExpired += Math.max(0, expired);
    return separated ? { product: p.id, available: valid, expired } : { product: p.id, available: total, expired: 0 };
  });
  const parts = rows.map((r) => {
    const name = productName(config, r.product);
    return separated ? `${name}: ${r.available} disponíveis, ${r.expired} vencidos` : `${name}: ${r.available} disponíveis`;
  });
  return {
    state,
    event: { type: 'inv.query', separated, rows, hiddenExpired, outcome: 'consulta', message: `Consulta de disponibilidade — ${parts.join(' · ')}.` },
  };
}
