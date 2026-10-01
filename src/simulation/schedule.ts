import type { BookEvent, CancelBookingEvent, Reservation, ScheduleConfig, ScheduleState, SimFlag } from '../types';
import { formatRange } from './format';

/** Simulação de reservas de espaços e de um equipamento compartilhado. */

type Draft<E> = Omit<E, 'seq' | 'forTest'>;

const has = (flags: readonly SimFlag[], flag: SimFlag) => flags.includes(flag);

/** Intervalos [início, fim) se sobrepõem. Horários que apenas se encostam não se sobrepõem. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function createSchedule(config: ScheduleConfig): ScheduleState {
  return { kind: 'schedule', reservations: config.reservations.map((r) => ({ ...r })), nextId: config.reservations.length + 1 };
}

export function spaceName(config: ScheduleConfig, id: string): string {
  return config.spaces.find((s) => s.id === id)?.name ?? id;
}

/** Reservas que ocupam o equipamento: ativas com equipamento ou canceladas sem liberação. */
export function equipmentHolders(state: ScheduleState): Reservation[] {
  return state.reservations.filter((r) => (r.status === 'ativa' && r.equipment) || (r.status === 'cancelada' && r.equipmentHeld));
}

export function book(
  state: ScheduleState,
  config: ScheduleConfig,
  flags: readonly SimFlag[],
  input: { space: string; start: number; end: number; group: string; equipment: boolean },
): { state: ScheduleState; event: Draft<BookEvent> } {
  const active = state.reservations.filter((r) => r.status === 'ativa' && r.space === input.space);
  const overlapping = active.filter((r) => overlaps(input.start, input.end, r.start, r.end));
  const adjacent = active.some((r) => r.end === input.start || r.start === input.end);
  const near = active.filter((r) => overlaps(input.start, input.end, r.start - 60, r.end + 60));
  const clashWith = input.equipment
    ? equipmentHolders(state).find((r) => overlaps(input.start, input.end, r.start, r.end))
    : undefined;
  const supportsEquipment = has(flags, 'sch.equipment');
  const base = {
    type: 'sch.book' as const,
    space: input.space,
    start: input.start,
    end: input.end,
    group: input.group,
    equipmentRequested: input.equipment,
    equipmentIgnored: input.equipment && !supportsEquipment,
    overlaps: overlapping.length > 0,
    adjacent,
    equipmentClash: Boolean(clashWith),
  };
  const place = spaceName(config, input.space);
  const equipmentName = config.equipmentName ?? 'equipamento';

  if (!has(flags, 'sch.book')) {
    return {
      state,
      event: { ...base, outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como registrar reservas: o pedido não falou disso.' },
    };
  }
  if (!(input.end > input.start)) {
    return { state, event: { ...base, outcome: 'recusado', reason: 'horario', message: 'O horário de fim precisa ser depois do horário de início.' } };
  }
  if (has(flags, 'sch.bufferHour') && near.length > 0) {
    const r = near[0];
    return {
      state,
      event: {
        ...base,
        outcome: 'recusado',
        reason: 'intervalo',
        message: `Reserva recusada: é preciso deixar 1 hora livre entre reservas. ${place} está com “${r.group}” das ${formatRange(r.start, r.end)}.`,
      },
    };
  }
  if (has(flags, 'sch.noOverlap') && overlapping.length > 0) {
    const r = overlapping[0];
    return {
      state,
      event: {
        ...base,
        outcome: 'recusado',
        reason: 'conflito',
        message: `Conflito de horário: ${place} já está reservado para “${r.group}” das ${formatRange(r.start, r.end)}.`,
      },
    };
  }
  const wantsEquipment = input.equipment && supportsEquipment;
  if (wantsEquipment && has(flags, 'sch.equipmentConflict') && clashWith) {
    const status = clashWith.status === 'cancelada' ? ' (reserva cancelada, mas o equipamento não foi liberado)' : '';
    return {
      state,
      event: {
        ...base,
        outcome: 'recusado',
        reason: 'equipamento',
        message: `O ${equipmentName.toLowerCase()} já está reservado em ${spaceName(config, clashWith.space)} das ${formatRange(clashWith.start, clashWith.end)}${status}. Escolha outro horário ou reserve sem ${equipmentName.toLowerCase()}.`,
      },
    };
  }

  const reservation: Reservation = {
    id: `R${state.nextId}`,
    space: input.space,
    start: input.start,
    end: input.end,
    group: input.group,
    equipment: wantsEquipment,
    status: 'ativa',
    equipmentHeld: false,
  };
  const next: ScheduleState = { ...state, reservations: [...state.reservations, reservation], nextId: state.nextId + 1 };
  const equipmentText = wantsEquipment ? ` com ${equipmentName.toLowerCase()}` : '';
  const ignoredText = base.equipmentIgnored ? ` (esta ferramenta não tem onde registrar o ${equipmentName.toLowerCase()})` : '';
  return {
    state: next,
    event: {
      ...base,
      outcome: 'aceito',
      message: `Reserva confirmada: ${place}, ${formatRange(input.start, input.end)}, “${input.group}”${equipmentText}${ignoredText}.`,
    },
  };
}

export function cancelBooking(
  state: ScheduleState,
  config: ScheduleConfig,
  flags: readonly SimFlag[],
  input: { reservationId: string },
): { state: ScheduleState; event: Draft<CancelBookingEvent> } {
  const target = state.reservations.find((r) => r.id === input.reservationId);
  const base = {
    type: 'sch.cancel' as const,
    reservationId: input.reservationId,
    hadEquipment: Boolean(target?.equipment),
    equipmentReleased: false,
  };
  if (!has(flags, 'sch.cancel')) {
    return {
      state,
      event: { ...base, outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como cancelar reservas: o pedido não falou disso.' },
    };
  }
  if (!target || target.status !== 'ativa') {
    return { state, event: { ...base, outcome: 'recusado', message: 'Essa reserva não está ativa.' } };
  }
  const held = target.equipment && !has(flags, 'sch.releaseEquipment');
  const next: ScheduleState = {
    ...state,
    reservations: state.reservations.map((r) => (r.id === target.id ? { ...r, status: 'cancelada', equipmentHeld: held } : r)),
  };
  return {
    state: next,
    event: {
      ...base,
      equipmentReleased: target.equipment && !held,
      outcome: 'aceito',
      message: `Reserva de “${target.group}” cancelada. ${spaceName(config, target.space)} está livre das ${formatRange(target.start, target.end)}.`,
    },
  };
}
