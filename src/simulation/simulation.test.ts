import { describe, expect, it } from 'vitest';
import type { EnrollmentConfig, InventoryConfig, ScheduleConfig, SimAction, SimFlag, Simulation, ToolConfig } from '../types';
import { applyAction, createSimulation, evaluateTests } from './index';
import { totalOf, validOf } from './inventory';
import { overlaps } from './schedule';
import { getVariation } from '../content';

function run(config: ToolConfig, flags: SimFlag[], actions: SimAction[]): Simulation {
  let sim = createSimulation(config);
  for (const a of actions) sim = applyAction(sim, config, flags, a);
  return sim;
}
const last = (sim: Simulation) => sim.events[sim.events.length - 1];

const inventory: InventoryConfig = {
  kind: 'inventory',
  products: [
    { id: 'oleo', name: 'Óleo', unit: 'garrafa(s)' },
    { id: 'leite', name: 'Leite', unit: 'caixa(s)' },
  ],
  lots: [
    { id: 'L1', product: 'oleo', qty: 6 },
    { id: 'L2', product: 'leite', qty: 6, expiry: '2026-10-10' },
    { id: 'L3', product: 'leite', qty: 10, expiry: '2026-10-20' },
  ],
  referenceDate: '2026-10-14',
};

describe('estoque', () => {
  const base: SimFlag[] = ['inv.entries', 'inv.exits'];

  it('registra doações somando ao estoque', () => {
    const sim = run(inventory, base, [{ type: 'inv.donate', product: 'oleo', qty: 4 }]);
    expect(last(sim).outcome).toBe('aceito');
    expect(totalOf(sim.tool as never, 'oleo')).toBe(10);
  });

  it('rejeita quantidades não positivas', () => {
    const sim = run(inventory, base, [{ type: 'inv.donate', product: 'oleo', qty: 0 }]);
    expect(last(sim).outcome).toBe('recusado');
  });

  it('sem validação de estoque, uma retirada excessiva deixa o estoque negativo', () => {
    const sim = run(inventory, base, [{ type: 'inv.withdraw', product: 'oleo', qty: 10 }]);
    const e = last(sim);
    expect(e.outcome).toBe('aceito');
    expect(e.type === 'inv.withdraw' && e.stockAfter).toBe(-4);
  });

  it('com validação de estoque, a retirada excessiva é recusada e o estoque não muda', () => {
    const sim = run(inventory, [...base, 'inv.stockCheck'], [{ type: 'inv.withdraw', product: 'oleo', qty: 10 }]);
    const e = last(sim);
    expect(e.outcome).toBe('recusado');
    expect(e.type === 'inv.withdraw' && e.reason).toBe('estoque');
    expect(totalOf(sim.tool as never, 'oleo')).toBe(6);
  });

  it('“nunca bloquear” anula a validação de estoque', () => {
    const sim = run(inventory, [...base, 'inv.stockCheck', 'inv.allowNegative'], [{ type: 'inv.withdraw', product: 'oleo', qty: 10 }]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('retirada válida desconta do estoque', () => {
    const sim = run(inventory, [...base, 'inv.stockCheck'], [{ type: 'inv.withdraw', product: 'oleo', qty: 4 }]);
    expect(totalOf(sim.tool as never, 'oleo')).toBe(2);
  });

  it('sem validade registrada, doações não guardam a data', () => {
    const sim = run(inventory, base, [{ type: 'inv.donate', product: 'leite', qty: 3, expiry: '2026-11-01' }]);
    const e = last(sim);
    expect(e.type === 'inv.donate' && e.expiryStored).toBe(false);
  });

  it('com validade, exige a data e cria lotes separados', () => {
    const flags: SimFlag[] = [...base, 'inv.expiry'];
    const noDate = run(inventory, flags, [{ type: 'inv.donate', product: 'leite', qty: 3 }]);
    expect(last(noDate).outcome).toBe('recusado');
    const sim = run(inventory, flags, [
      { type: 'inv.donate', product: 'leite', qty: 3, expiry: '2026-11-01' },
      { type: 'inv.donate', product: 'leite', qty: 3, expiry: '2026-12-01' },
    ]);
    const tool = sim.tool as { lots: { product: string; expiry?: string }[] };
    expect(tool.lots.filter((l) => l.product === 'leite').map((l) => l.expiry)).toEqual(['2026-10-10', '2026-10-20', '2026-11-01', '2026-12-01']);
  });

  it('itens que vencem na própria data de referência ainda estão válidos', () => {
    const sim = run({ ...inventory, lots: [{ id: 'X', product: 'leite', qty: 2, expiry: '2026-10-14' }] }, base, []);
    expect(validOf(sim.tool as never, 'leite', '2026-10-14')).toBe(2);
  });

  it('consulta sem separação conta vencidos como disponíveis', () => {
    const sim = run(inventory, [...base, 'inv.expiry'], [{ type: 'inv.query' }]);
    const e = last(sim);
    expect(e.type === 'inv.query' && e.separated).toBe(false);
    expect(e.type === 'inv.query' && e.hiddenExpired).toBe(6);
  });

  it('consulta com separação mostra disponíveis e vencidos', () => {
    const sim = run(inventory, [...base, 'inv.expiry', 'inv.separateExpired'], [{ type: 'inv.query' }]);
    const e = last(sim);
    expect(e.type === 'inv.query' && e.rows.find((r) => r.product === 'leite')).toEqual({ product: 'leite', available: 10, expired: 6 });
  });

  it('sem bloqueio, entregar do lote vencido é aceito', () => {
    const sim = run(inventory, [...base, 'inv.expiry'], [{ type: 'inv.withdraw', product: 'leite', qty: 2, lotId: 'L2' }]);
    const e = last(sim);
    expect(e.outcome).toBe('aceito');
    expect(e.type === 'inv.withdraw' && e.touchedExpired).toBe(true);
  });

  it('sem validade registrada, a entrega sai do lote mais antigo (vencido) sem aviso', () => {
    const sim = run(inventory, base, [{ type: 'inv.withdraw', product: 'leite', qty: 2 }]);
    const e = last(sim);
    expect(e.type === 'inv.withdraw' && e.touchedExpired).toBe(true);
  });

  it('com bloqueio, entregar do lote vencido é recusado', () => {
    const sim = run(inventory, [...base, 'inv.expiry', 'inv.blockExpired'], [{ type: 'inv.withdraw', product: 'leite', qty: 2, lotId: 'L2' }]);
    const e = last(sim);
    expect(e.outcome).toBe('recusado');
    expect(e.type === 'inv.withdraw' && e.reason).toBe('vencido');
  });

  it('com bloqueio, entrega automática ignora lotes vencidos', () => {
    const sim = run(inventory, [...base, 'inv.expiry', 'inv.blockExpired'], [{ type: 'inv.withdraw', product: 'leite', qty: 2 }]);
    const e = last(sim);
    expect(e.outcome).toBe('aceito');
    expect(e.type === 'inv.withdraw' && e.touchedExpired).toBe(false);
  });

  it('sem a função de saída, a retirada não existe', () => {
    const sim = run(inventory, ['inv.entries'], [{ type: 'inv.withdraw', product: 'oleo', qty: 1 }]);
    expect(last(sim).unsupported).toBe(true);
  });
});

const enrollment: EnrollmentConfig = {
  kind: 'enrollment',
  people: ['Ana', 'Beto', 'Caio', 'Duda', 'Eli'],
  courses: [
    { id: 'c1', name: 'Curso 1', schedule: '', capacity: 2, confirmed: ['Ana'], waitlist: [] },
    { id: 'c2', name: 'Curso 2', schedule: '', capacity: 2, confirmed: ['Ana', 'Beto'], waitlist: ['Caio', 'Duda'] },
  ],
};

describe('inscrições', () => {
  const base: SimFlag[] = ['enr.enroll', 'enr.capacity'];
  const courses = (sim: Simulation) => (sim.tool as { courses: { id: string; confirmed: string[]; waitlist: string[] }[] }).courses;

  it('sem controle de duplicidade, uma inscrição repetida é aceita', () => {
    const sim = run(enrollment, base, [{ type: 'enr.enroll', person: 'Ana', courseId: 'c1' }]);
    expect(courses(sim)[0].confirmed).toEqual(['Ana', 'Ana']);
  });

  it('com controle de duplicidade, a repetição é recusada', () => {
    const sim = run(enrollment, [...base, 'enr.noDuplicate'], [{ type: 'enr.enroll', person: 'Ana', courseId: 'c1' }]);
    const e = last(sim);
    expect(e.type === 'enr.enroll' && e.reason).toBe('duplicada');
    expect(courses(sim)[0].confirmed).toEqual(['Ana']);
  });

  it('com capacidade, turma cheia não confirma novas inscrições', () => {
    const sim = run(enrollment, base, [{ type: 'enr.enroll', person: 'Eli', courseId: 'c2' }]);
    expect(last(sim).outcome).toBe('recusado');
    expect(courses(sim)[1].confirmed).toHaveLength(2);
  });

  it('sem capacidade, a turma cheia aceita mais gente', () => {
    const sim = run(enrollment, ['enr.enroll'], [{ type: 'enr.enroll', person: 'Eli', courseId: 'c2' }]);
    expect(courses(sim)[1].confirmed).toHaveLength(3);
  });

  it('“nunca recusar” anula a capacidade', () => {
    const sim = run(enrollment, [...base, 'enr.overbook'], [{ type: 'enr.enroll', person: 'Eli', courseId: 'c2' }]);
    expect(courses(sim)[1].confirmed).toHaveLength(3);
  });

  it('com lista de espera, turma cheia coloca a pessoa na fila', () => {
    const sim = run(enrollment, [...base, 'enr.waitlist'], [{ type: 'enr.enroll', person: 'Eli', courseId: 'c2' }]);
    expect(courses(sim)[1].waitlist).toEqual(['Caio', 'Duda', 'Eli']);
  });

  it('promove a primeira pessoa da fila ao cancelar', () => {
    const sim = run(enrollment, [...base, 'enr.cancel', 'enr.promoteFirst'], [{ type: 'enr.cancel', person: 'Beto', courseId: 'c2' }]);
    expect(courses(sim)[1].confirmed).toEqual(['Ana', 'Caio']);
    expect(courses(sim)[1].waitlist).toEqual(['Duda']);
  });

  it('a regra “chamar o último” fura a fila', () => {
    const sim = run(enrollment, [...base, 'enr.cancel', 'enr.promoteLast'], [{ type: 'enr.cancel', person: 'Beto', courseId: 'c2' }]);
    expect(courses(sim)[1].confirmed).toEqual(['Ana', 'Duda']);
  });

  it('sem regra de promoção, a vaga fica parada', () => {
    const sim = run(enrollment, [...base, 'enr.cancel'], [{ type: 'enr.cancel', person: 'Beto', courseId: 'c2' }]);
    expect(courses(sim)[1].confirmed).toEqual(['Ana']);
    expect(courses(sim)[1].waitlist).toEqual(['Caio', 'Duda']);
  });

  it('sem cancelamento, a ação não existe', () => {
    const sim = run(enrollment, base, [{ type: 'enr.cancel', person: 'Beto', courseId: 'c2' }]);
    expect(last(sim).unsupported).toBe(true);
  });
});

const schedule: ScheduleConfig = {
  kind: 'schedule',
  day: 'Sábado',
  openHour: 8,
  closeHour: 22,
  equipmentName: 'Projetor',
  spaces: [
    { id: 's1', name: 'Sala 1' },
    { id: 's2', name: 'Sala 2' },
  ],
  groups: ['G'],
  reservations: [
    { id: 'R1', space: 's1', start: 840, end: 960, group: 'A', equipment: false, status: 'ativa', equipmentHeld: false },
    { id: 'R2', space: 's1', start: 540, end: 660, group: 'B', equipment: true, status: 'ativa', equipmentHeld: false },
  ],
};

describe('agenda', () => {
  const book = (space: string, start: number, end: number, equipment = false): SimAction => ({ type: 'sch.book', space, start, end, group: 'G', equipment });

  it('intervalos que só se encostam não se sobrepõem', () => {
    expect(overlaps(840, 960, 960, 1080)).toBe(false);
    expect(overlaps(840, 960, 900, 1020)).toBe(true);
  });

  it('sem verificação de conflitos, reservas sobrepostas são aceitas', () => {
    const sim = run(schedule, ['sch.book'], [book('s1', 900, 1020)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('com verificação, reservas sobrepostas são recusadas', () => {
    const sim = run(schedule, ['sch.book', 'sch.noOverlap'], [book('s1', 900, 1020)]);
    const e = last(sim);
    expect(e.type === 'sch.book' && e.reason).toBe('conflito');
  });

  it('horários adjacentes são permitidos', () => {
    const sim = run(schedule, ['sch.book', 'sch.noOverlap'], [book('s1', 960, 1080)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('o mesmo horário em outro espaço é permitido', () => {
    const sim = run(schedule, ['sch.book', 'sch.noOverlap'], [book('s2', 840, 960)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('a regra de 1 hora de intervalo recusa horários adjacentes', () => {
    const sim = run(schedule, ['sch.book', 'sch.bufferHour'], [book('s1', 960, 1080)]);
    const e = last(sim);
    expect(e.type === 'sch.book' && e.reason).toBe('intervalo');
  });

  it('cancelar libera o horário', () => {
    const sim = run(schedule, ['sch.book', 'sch.noOverlap', 'sch.cancel'], [{ type: 'sch.cancel', reservationId: 'R1' }, book('s1', 900, 1020)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('sem controle do equipamento, o projetor pode ir para duas salas', () => {
    const sim = run(schedule, ['sch.book', 'sch.equipment'], [book('s2', 600, 720, true)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('com controle, o mesmo equipamento em outra sala no mesmo horário é recusado', () => {
    const sim = run(schedule, ['sch.book', 'sch.equipment', 'sch.equipmentConflict'], [book('s2', 600, 720, true)]);
    const e = last(sim);
    expect(e.type === 'sch.book' && e.reason).toBe('equipamento');
  });

  it('sem liberação, o equipamento continua preso após o cancelamento', () => {
    const flags: SimFlag[] = ['sch.book', 'sch.equipment', 'sch.equipmentConflict', 'sch.cancel'];
    const sim = run(schedule, flags, [{ type: 'sch.cancel', reservationId: 'R2' }, book('s2', 600, 720, true)]);
    const e = last(sim);
    expect(e.type === 'sch.book' && e.reason).toBe('equipamento');
  });

  it('com liberação, o equipamento fica livre após o cancelamento', () => {
    const flags: SimFlag[] = ['sch.book', 'sch.equipment', 'sch.equipmentConflict', 'sch.cancel', 'sch.releaseEquipment'];
    const sim = run(schedule, flags, [{ type: 'sch.cancel', reservationId: 'R2' }, book('s2', 600, 720, true)]);
    expect(last(sim).outcome).toBe('aceito');
  });

  it('recusa horário com fim antes do início', () => {
    const sim = run(schedule, ['sch.book'], [book('s2', 720, 600)]);
    const e = last(sim);
    expect(e.type === 'sch.book' && e.reason).toBe('horario');
  });
});

describe('verificação dos casos de teste', () => {
  it('marca falha com o motivo quando a ferramenta não tem o recurso', () => {
    const { variation } = getVariation('vagas-b');
    let sim = createSimulation(variation.tool);
    const flags: SimFlag[] = ['enr.enroll', 'enr.capacity', 'enr.waitlist'];
    sim = applyAction(sim, variation.tool, flags, { type: 'enr.cancel', person: 'Davi', courseId: 'internet' }, 't-cancelar');
    const results = evaluateTests(variation.tests, sim.events, flags);
    expect(results['t-cancelar'].status).toBe('falhou');
    expect(results['t-promocao'].status).toBe('pendente');
  });

  it('teste de repetição é inconclusivo quando a turma cheia barra antes', () => {
    const { variation } = getVariation('vagas-a');
    const flags: SimFlag[] = ['enr.enroll', 'enr.capacity'];
    let sim = createSimulation(variation.tool);
    sim = applyAction(sim, variation.tool, flags, { type: 'enr.enroll', person: 'Rosa', courseId: 'planilhas' });
    expect(evaluateTests(variation.tests, sim.events, flags)['t-repetida'].status).toBe('inconclusivo');
  });

  it('promoção com uma só pessoa na fila é inconclusiva', () => {
    const { variation } = getVariation('vagas-b');
    const tool = variation.tool as EnrollmentConfig;
    const config: EnrollmentConfig = { ...tool, courses: tool.courses.map((c) => (c.id === 'internet' ? { ...c, waitlist: ['Severino'] } : c)) };
    const flags: SimFlag[] = ['enr.enroll', 'enr.capacity', 'enr.cancel', 'enr.waitlist', 'enr.promoteFirst'];
    let sim = createSimulation(config);
    sim = applyAction(sim, config, flags, { type: 'enr.cancel', person: 'Davi', courseId: 'internet' });
    expect(evaluateTests(variation.tests, sim.events, flags)['t-promocao'].status).toBe('inconclusivo');
  });

  it('um resultado inconclusivo posterior não apaga uma aprovação anterior', () => {
    const { variation } = getVariation('vagas-b');
    const flags: SimFlag[] = ['enr.enroll', 'enr.capacity', 'enr.cancel', 'enr.waitlist', 'enr.promoteFirst'];
    let sim = createSimulation(variation.tool);
    sim = applyAction(sim, variation.tool, flags, { type: 'enr.cancel', person: 'Davi', courseId: 'internet' }); // Severino sobe; fica Lia
    sim = applyAction(sim, variation.tool, flags, { type: 'enr.cancel', person: 'Bianca', courseId: 'internet' }); // só Lia na fila
    expect(evaluateTests(variation.tests, sim.events, flags)['t-promocao'].status).toBe('passou');
  });
});
