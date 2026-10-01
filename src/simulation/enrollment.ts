import type { CancelEnrollmentEvent, Course, EnrollEvent, EnrollmentConfig, EnrollmentState, SimFlag } from '../types';

/** Simulação de inscrições, vagas e lista de espera. */

type Draft<E> = Omit<E, 'seq' | 'forTest'>;

const has = (flags: readonly SimFlag[], flag: SimFlag) => flags.includes(flag);

export function createEnrollment(config: EnrollmentConfig): EnrollmentState {
  return {
    kind: 'enrollment',
    courses: config.courses.map((c) => ({ ...c, confirmed: [...c.confirmed], waitlist: [...c.waitlist] })),
  };
}

function replaceCourse(state: EnrollmentState, course: Course): EnrollmentState {
  return { ...state, courses: state.courses.map((c) => (c.id === course.id ? course : c)) };
}

export function enroll(
  state: EnrollmentState,
  flags: readonly SimFlag[],
  input: { person: string; courseId: string },
): { state: EnrollmentState; event: Draft<EnrollEvent> } {
  const course = state.courses.find((c) => c.id === input.courseId);
  const capacity = course?.capacity ?? 0;
  const base = {
    type: 'enr.enroll' as const,
    person: input.person,
    courseId: input.courseId,
    wasDuplicate: false,
    wasFull: false,
    countAfter: course?.confirmed.length ?? 0,
    capacity,
  };
  if (!has(flags, 'enr.enroll')) {
    return {
      state,
      event: { ...base, result: 'recusada', reason: 'sem-funcao', outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como registrar inscrições: o pedido não falou disso.' },
    };
  }
  if (!course) {
    return { state, event: { ...base, result: 'recusada', outcome: 'recusado', message: 'Turma não encontrada.' } };
  }

  const inConfirmed = course.confirmed.includes(input.person);
  const waitPos = course.waitlist.indexOf(input.person);
  const wasDuplicate = inConfirmed || waitPos >= 0;
  const wasFull = course.confirmed.length >= course.capacity;
  const flagsBase = { ...base, wasDuplicate, wasFull };
  const enforceCapacity = has(flags, 'enr.capacity') && !has(flags, 'enr.overbook');

  if (wasDuplicate && has(flags, 'enr.noDuplicate')) {
    const where = inConfirmed ? 'já tem inscrição confirmada nesta turma' : `já está na lista de espera desta turma (posição ${waitPos + 1})`;
    return {
      state,
      event: {
        ...flagsBase,
        result: 'recusada',
        reason: 'duplicada',
        outcome: 'recusado',
        message: `${input.person} ${where}. Nenhuma inscrição nova foi criada.`,
      },
    };
  }

  if (wasFull && enforceCapacity) {
    if (has(flags, 'enr.waitlist')) {
      const updated = { ...course, waitlist: [...course.waitlist, input.person] };
      return {
        state: replaceCourse(state, updated),
        event: {
          ...flagsBase,
          result: 'espera',
          reason: 'cheia',
          outcome: 'aceito',
          countAfter: updated.confirmed.length,
          message: `Turma cheia (${course.confirmed.length} de ${course.capacity} vagas). ${input.person} entrou na lista de espera, na posição ${updated.waitlist.length}.`,
        },
      };
    }
    return {
      state,
      event: {
        ...flagsBase,
        result: 'recusada',
        reason: 'cheia',
        outcome: 'recusado',
        message: `Turma cheia (${course.confirmed.length} de ${course.capacity} vagas). A inscrição de ${input.person} não foi confirmada.`,
      },
    };
  }

  const updated = { ...course, confirmed: [...course.confirmed, input.person] };
  return {
    state: replaceCourse(state, updated),
    event: {
      ...flagsBase,
      result: 'confirmada',
      outcome: 'aceito',
      countAfter: updated.confirmed.length,
      message: `Inscrição de ${input.person} confirmada em ${course.name} (${updated.confirmed.length} de ${course.capacity} vagas ocupadas).`,
    },
  };
}

export function cancelEnrollment(
  state: EnrollmentState,
  flags: readonly SimFlag[],
  input: { person: string; courseId: string },
): { state: EnrollmentState; event: Draft<CancelEnrollmentEvent> } {
  const course = state.courses.find((c) => c.id === input.courseId);
  const base = { type: 'enr.cancel' as const, person: input.person, courseId: input.courseId, waitlistBefore: course ? [...course.waitlist] : [] };
  if (!has(flags, 'enr.cancel')) {
    return {
      state,
      event: { ...base, outcome: 'recusado', unsupported: true, message: 'Esta ferramenta não tem como cancelar inscrições: o pedido não falou disso.' },
    };
  }
  if (!course || !course.confirmed.includes(input.person)) {
    return { state, event: { ...base, outcome: 'recusado', message: `${input.person} não tem inscrição confirmada nesta turma.` } };
  }
  const idx = course.confirmed.indexOf(input.person);
  const confirmed = [...course.confirmed.slice(0, idx), ...course.confirmed.slice(idx + 1)];
  const waitlist = [...course.waitlist];
  let promoted: string | undefined;
  if (confirmed.length < course.capacity && waitlist.length > 0) {
    if (has(flags, 'enr.promoteFirst')) promoted = waitlist.shift();
    else if (has(flags, 'enr.promoteLast')) promoted = waitlist.pop();
  }
  if (promoted) confirmed.push(promoted);
  const updated = { ...course, confirmed, waitlist };
  const free = updated.capacity - updated.confirmed.length;
  const promotedText = promoted ? ` ${promoted} saiu da lista de espera e teve a inscrição confirmada.` : '';
  return {
    state: replaceCourse(state, updated),
    event: {
      ...base,
      promoted,
      outcome: 'aceito',
      message: `Inscrição de ${input.person} cancelada em ${course.name}.${promotedText} Vagas livres: ${Math.max(0, free)} de ${updated.capacity}.`,
    },
  };
}
