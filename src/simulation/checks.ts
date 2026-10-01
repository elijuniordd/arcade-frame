import type { SimEvent, SimFlag, TestCase, TestCheckKind, TestResult } from '../types';
import { formatRange } from './format';

/**
 * Verificação dos casos de teste.
 *
 * Cada verificador olha o histórico de eventos da ferramenta e devolve o
 * resultado do evento mais recente que corresponde ao teste. Assim o jogador
 * pode testar manualmente (usando a ferramenta) ou pelo botão “Fazer o teste por mim”.
 */

type Verdict = TestResult | null;
type Checker = (event: SimEvent, flags: readonly SimFlag[]) => Verdict;

const pass = (message: string): TestResult => ({ status: 'passou', message });
const fail = (message: string): TestResult => ({ status: 'falhou', message });
const inconclusive = (message: string): TestResult => ({ status: 'inconclusivo', message });

const checkers: Record<Exclude<TestCheckKind, 'inv.lotsDifferentDates'>, Checker> = {
  'inv.donation': (e) => {
    if (e.type !== 'inv.donate' || e.outcome !== 'aceito') return null;
    return pass(`A doação entrou e o total do produto aumentou. ${e.message}`);
  },
  'inv.withdrawValid': (e) => {
    if (e.type !== 'inv.withdraw' || e.reason === 'quantidade' || e.qty > e.availableBefore) return null;
    if (e.outcome === 'aceito') return pass(`A retirada foi registrada e o estoque diminuiu para ${e.stockAfter}.`);
    return fail(`Uma retirada possível foi recusada: ${e.message}`);
  },
  'inv.withdrawExcess': (e) => {
    if (e.type !== 'inv.withdraw' || e.reason === 'quantidade' || e.qty <= e.availableBefore) return null;
    if (e.outcome === 'recusado' && e.reason === 'estoque') {
      return pass('A ferramenta recusou a retirada e mostrou quanto existe. O estoque não ficou negativo.');
    }
    if (e.outcome === 'aceito') {
      return fail(
        `A ferramenta aceitou retirar ${e.qty} quando havia ${e.availableBefore}. O estoque ficou em ${e.stockAfter} — um número impossível na prateleira. O pedido não dizia o que fazer quando faltasse produto.`,
      );
    }
    return null;
  },
  'inv.queryAvailability': (e) => {
    if (e.type !== 'inv.query') return null;
    if (e.separated) return pass('A consulta separou os itens disponíveis dos vencidos, usando a data de referência da missão.');
    if (e.hiddenExpired > 0) {
      return fail(
        `A consulta contou ${e.hiddenExpired} unidade(s) vencida(s) como disponíveis. Quem olhar a tela vai prometer produtos que não podem ser entregues.`,
      );
    }
    return inconclusive('Não há itens vencidos no estoque agora, então não dá para saber se a consulta separa os vencidos.');
  },
  'inv.distributeExpired': (e) => {
    if (e.type !== 'inv.withdraw' || !e.touchedExpired) return null;
    if (e.outcome === 'recusado' && e.reason === 'vencido') return pass('A entrega do lote vencido foi bloqueada, com o aviso de qual lote separar.');
    if (e.outcome === 'aceito') {
      return fail('A ferramenta entregou produto de um lote vencido sem nenhum aviso. Uma família poderia receber leite fora da validade.');
    }
    return null;
  },
  'enr.valid': (e) => {
    if (e.type !== 'enr.enroll' || e.wasDuplicate || e.wasFull || e.reason === 'sem-funcao') return null;
    if (e.result === 'confirmada') return pass(`Inscrição confirmada (${e.countAfter} de ${e.capacity} vagas ocupadas).`);
    return fail(`Uma inscrição com vaga disponível não foi confirmada: ${e.message}`);
  },
  'enr.duplicate': (e) => {
    if (e.type !== 'enr.enroll' || !e.wasDuplicate) return null;
    if (e.reason === 'duplicada') return pass('A ferramenta percebeu que a pessoa já estava inscrita e não ocupou outra vaga.');
    if (e.result === 'confirmada') {
      return fail(`A mesma pessoa foi inscrita duas vezes na mesma turma e agora ocupa duas vagas (${e.countAfter} de ${e.capacity}).`);
    }
    return inconclusive(
      'A inscrição repetida foi barrada porque a turma estava cheia, não porque a pessoa já estava inscrita. Teste a repetição em uma turma com vaga.',
    );
  },
  'enr.full': (e) => {
    if (e.type !== 'enr.enroll' || !e.wasFull || e.wasDuplicate) return null;
    if (e.result === 'confirmada') {
      return fail(`A turma cheia aceitou mais uma pessoa: agora são ${e.countAfter} inscrições para ${e.capacity} vagas.`);
    }
    if (e.result === 'espera') return pass('A inscrição não foi confirmada além do limite: a pessoa foi para a lista de espera.');
    return pass('A ferramenta respeitou o limite de vagas e explicou que a turma está cheia.');
  },
  'enr.waitlist': (e) => {
    if (e.type !== 'enr.enroll' || !e.wasFull || e.wasDuplicate) return null;
    if (e.result === 'espera') return pass('A pessoa entrou na lista de espera e ficou sabendo sua posição.');
    if (e.result === 'confirmada') {
      return fail(`A turma cheia aceitou mais uma pessoa (${e.countAfter} para ${e.capacity} vagas) em vez de usar a lista de espera.`);
    }
    return fail('A pessoa foi recusada e ninguém anotou seu interesse. Quando abrir uma vaga, ela não vai ser chamada.');
  },
  'enr.cancelConfirmed': (e) => {
    if (e.type !== 'enr.cancel' || e.outcome !== 'aceito') return null;
    return pass('A inscrição foi cancelada e a vaga foi liberada.');
  },
  'enr.promotionOrder': (e) => {
    if (e.type !== 'enr.cancel' || e.outcome !== 'aceito') return null;
    if (e.waitlistBefore.length === 0) return null;
    const first = e.waitlistBefore[0];
    if (e.waitlistBefore.length < 2) {
      if (e.promoted === first) {
        return inconclusive('Havia só uma pessoa na fila. Ela foi chamada, mas com uma pessoa só não dá para saber se a ordem é respeitada.');
      }
      return fail(`A vaga abriu, mas ${first}, que estava na lista de espera, não foi chamado(a).`);
    }
    if (e.promoted === first) return pass(`${first}, que esperava há mais tempo, foi chamado(a) primeiro. A ordem da fila foi respeitada.`);
    if (e.promoted) return fail(`A ferramenta chamou ${e.promoted}, mas ${first} estava esperando há mais tempo. A ordem da fila não foi respeitada.`);
    return fail(`A vaga abriu e ficou parada: ninguém da lista de espera foi chamado, nem ${first}, que era o(a) primeiro(a).`);
  },
  'sch.freeAdjacent': (e) => {
    if (e.type !== 'sch.book' || e.reason === 'horario' || e.overlaps || !e.adjacent) return null;
    if (e.outcome === 'aceito') return pass('A reserva colada na anterior foi aceita: horários que só se encostam não se sobrepõem.');
    if (e.reason === 'intervalo') {
      return fail('A ferramenta recusou um horário livre só porque ele encosta em outro. A responsável disse que isso é permitido.');
    }
    return fail(`Um horário livre foi recusado: ${e.message}`);
  },
  'sch.conflict': (e) => {
    if (e.type !== 'sch.book' || e.reason === 'horario' || !e.overlaps) return null;
    if (e.outcome === 'recusado') return pass('A reserva conflitante foi recusada e a ferramenta mostrou quem ocupa o horário.');
    return fail(`A ferramenta aceitou uma reserva por cima de outra (${formatRange(e.start, e.end)}). Dois grupos vão chegar ao mesmo tempo.`);
  },
  'sch.cancel': (e) => {
    if (e.type !== 'sch.cancel' || e.outcome !== 'aceito') return null;
    return pass('A reserva foi cancelada e o horário voltou a ficar livre.');
  },
  'sch.roomWithEquipment': (e, flags) => {
    if (e.type !== 'sch.book' || e.reason === 'horario' || !e.equipmentRequested || e.equipmentClash || e.overlaps) return null;
    if (!flags.includes('sch.equipment')) {
      return fail('A sala foi reservada, mas a ferramenta não tem onde registrar o projetor. Ninguém vai saber que ele está combinado.');
    }
    if (e.outcome === 'aceito') return pass('A sala e o projetor foram reservados juntos.');
    return fail(`Uma reserva possível foi recusada: ${e.message}`);
  },
  'sch.equipmentClash': (e, flags) => {
    if (e.type !== 'sch.book' || e.reason === 'horario' || !e.equipmentRequested || !e.equipmentClash || e.overlaps) return null;
    if (e.outcome === 'recusado' && e.reason === 'equipamento') {
      return pass('A ferramenta percebeu que o projetor já estava em outra sala e não prometeu o mesmo aparelho duas vezes.');
    }
    if (!flags.includes('sch.equipment')) {
      return fail('A ferramenta não registra o projetor, então aceitou a reserva sem perceber que ele já estava na outra sala.');
    }
    return fail('A ferramenta prometeu o mesmo projetor para duas salas ao mesmo tempo.');
  },
  'sch.releaseAfterCancel': (e, flags) => {
    if (e.type !== 'sch.cancel' || e.outcome !== 'aceito' || !e.hadEquipment) return null;
    if (e.equipmentReleased && flags.includes('sch.equipment')) return pass('Ao cancelar, a sala e o projetor voltaram a ficar disponíveis.');
    if (!flags.includes('sch.equipment')) {
      return fail('A reserva foi cancelada, mas a ferramenta não registra o projetor. Ninguém fica sabendo que ele ficou livre.');
    }
    return fail('A sala foi liberada, mas o projetor continuou bloqueado no horário cancelado.');
  },
};

const pending: TestResult = { status: 'pendente', message: 'Ainda não testado.' };

const definitive = (v: Verdict) => v?.status === 'passou' || v?.status === 'falhou';

/** O evento mais recente decide; um resultado inconclusivo não apaga um resultado definitivo anterior. */
function merge(current: Verdict, next: Verdict): Verdict {
  if (!next) return current;
  if (!definitive(next) && definitive(current)) return current;
  return next;
}

function checkLots(events: SimEvent[], testId: string): Verdict {
  let verdict: Verdict = null;
  const seen = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.type !== 'inv.donate') continue;
    if (e.unsupported) {
      if (e.forTest === testId) verdict = merge(verdict, fail(`Não deu para fazer o teste. ${e.message}`));
      continue;
    }
    if (e.outcome !== 'aceito') continue;
    if (!e.expiryStored) {
      verdict = merge(verdict, fail('O lote entrou só como quantidade: a ferramenta não guarda a validade. Lotes com datas diferentes viram um único total.'));
      continue;
    }
    const dates = seen.get(e.product) ?? new Set<string>();
    dates.add(e.expiry ?? '');
    seen.set(e.product, dates);
    verdict = merge(
      verdict,
      dates.size >= 2
        ? pass('Os lotes do mesmo produto ficaram separados, cada um com sua validade.')
        : { status: 'pendente', message: 'Um lote registrado com validade. Agora registre outro lote do mesmo produto com outra data.' },
    );
  }
  return verdict;
}

export function evaluateTests(tests: TestCase[], events: SimEvent[], flags: readonly SimFlag[]): Record<string, TestResult> {
  const out: Record<string, TestResult> = {};
  for (const test of tests) {
    if (test.check === 'inv.lotsDifferentDates') {
      out[test.id] = checkLots(events, test.id) ?? pending;
      continue;
    }
    const checker = checkers[test.check];
    let verdict: Verdict = null;
    for (const e of events) {
      const v = e.unsupported && e.forTest === test.id ? fail(`Não deu para fazer o teste. ${e.message}`) : checker(e, flags);
      verdict = merge(verdict, v);
    }
    out[test.id] = verdict ?? pending;
  }
  return out;
}

export function allTestsPassed(tests: TestCase[], results: Record<string, TestResult>): boolean {
  return tests.length > 0 && tests.every((t) => results[t.id]?.status === 'passou');
}
