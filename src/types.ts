/**
 * Tipos centrais do jogo. O conteúdo (src/content), o motor (src/engine),
 * a avaliação (src/evaluation) e as simulações (src/simulation) dependem
 * apenas destes tipos — nunca uns dos detalhes internos dos outros.
 */

export type ScenarioId = 'doacoes' | 'vagas' | 'agenda';
export type VariationId = 'doacoes-a' | 'doacoes-b' | 'vagas-a' | 'vagas-b' | 'agenda-a' | 'agenda-b';
export type ToolKind = 'inventory' | 'enrollment' | 'schedule';

/** Etapas de uma partida, na ordem em que aparecem. */
export type Step = 'briefing' | 'investigate' | 'build' | 'test' | 'result';

/* ------------------------------------------------------------------ */
/* Investigação                                                        */
/* ------------------------------------------------------------------ */

/** Tipo de informação descoberta. O título cotidiano vem antes do termo técnico. */
export type FactKind =
  | 'usuarios'
  | 'problema'
  | 'dados'
  | 'regras'
  | 'restricoes'
  | 'resultado'
  | 'verificacao';

export interface Concept {
  term: string;
  explanation: string;
}

export interface Fact {
  id: string;
  kind: FactKind;
  text: string;
  /** Informações essenciais contam para o reconhecimento de investigação. */
  essential: boolean;
  /** Termo técnico apresentado depois do exemplo concreto. */
  concept?: Concept;
}

export type QuestionUsefulness = 'essencial' | 'util' | 'pouco-util';

export interface Question {
  id: string;
  text: string;
  answer: string;
  reveals: string[];
  /** Explica por que a pergunta ajuda — ou o que ajudaria mais, sem punir. */
  why: string;
  usefulness: QuestionUsefulness;
}

export interface HelpSet {
  pista: string;
  exemplo: string;
  direta: string;
}

/* ------------------------------------------------------------------ */
/* Pedido (prompt)                                                     */
/* ------------------------------------------------------------------ */

export type BlockCategory =
  | 'objetivo'
  | 'contexto'
  | 'dados'
  | 'acoes'
  | 'restricoes'
  | 'resultado'
  | 'verificacao';

export type BlockQuality = 'essencial' | 'util' | 'vago' | 'irrelevante' | 'prejudicial';

/** Capacidades da ferramenta simulada ligadas por blocos do pedido. */
export type SimFlag =
  // estoque
  | 'inv.entries'
  | 'inv.exits'
  | 'inv.stockCheck'
  | 'inv.allowNegative'
  | 'inv.expiry'
  | 'inv.separateExpired'
  | 'inv.blockExpired'
  // inscrições
  | 'enr.enroll'
  | 'enr.capacity'
  | 'enr.overbook'
  | 'enr.noDuplicate'
  | 'enr.cancel'
  | 'enr.waitlist'
  | 'enr.promoteFirst'
  | 'enr.promoteLast'
  // agenda
  | 'sch.book'
  | 'sch.noOverlap'
  | 'sch.bufferHour'
  | 'sch.cancel'
  | 'sch.equipment'
  | 'sch.equipmentConflict'
  | 'sch.releaseEquipment';

export interface PromptBlock {
  id: string;
  category: BlockCategory;
  text: string;
  /** Comportamentos que este bloco liga na solução simulada. */
  grants?: SimFlag[];
}

/** Papel do bloco em uma variação específica (o mesmo bloco pode ser essencial em A e útil em B). */
export interface BlockRole {
  quality: BlockQuality;
  /** Comentário educativo mostrado quando o bloco está no pedido. */
  feedback: string;
  /** Dica mostrada quando um bloco essencial está faltando. */
  missing?: string;
}

export interface BlockConflict {
  a: string;
  b: string;
  explanation: string;
}

/** Texto usado pela IA simulada para descrever o que construiu. */
export interface FlagText {
  built: string;
  /** Suposição silenciosa que a IA faz quando a capacidade falta. */
  assumption?: string;
}

export interface AssembledBlock {
  blockId: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Avaliação                                                           */
/* ------------------------------------------------------------------ */

export type CriterionId = 'objetivo' | 'contexto' | 'requisitos' | 'restricoes' | 'verificacao';
export type CriterionStatus = 'completo' | 'parcial' | 'ausente';

export interface CriterionResult {
  id: CriterionId;
  status: CriterionStatus;
  points: number;
  feedback: string[];
}

export interface BlockNote {
  blockId: string;
  quality: BlockQuality;
  feedback: string;
}

export interface Evaluation {
  criteria: CriterionResult[];
  total: number;
  max: number;
  conflicts: BlockConflict[];
  notes: BlockNote[];
  flags: SimFlag[];
}

/* ------------------------------------------------------------------ */
/* Simulações                                                          */
/* ------------------------------------------------------------------ */

export interface Lot {
  id: string;
  product: string;
  qty: number;
  /** Data ISO (aaaa-mm-dd). Ausente quando a ferramenta não guarda validade. */
  expiry?: string;
}

export interface ProductInfo {
  id: string;
  name: string;
  unit: string;
}

export interface InventoryConfig {
  kind: 'inventory';
  products: ProductInfo[];
  lots: Lot[];
  /** Data de referência fixa da missão (aaaa-mm-dd). */
  referenceDate?: string;
}

export interface Course {
  id: string;
  name: string;
  schedule: string;
  capacity: number;
  confirmed: string[];
  waitlist: string[];
}

export interface EnrollmentConfig {
  kind: 'enrollment';
  people: string[];
  courses: Course[];
}

export interface Reservation {
  id: string;
  space: string;
  start: number; // minutos desde 00:00
  end: number;
  group: string;
  equipment: boolean;
  status: 'ativa' | 'cancelada';
  /** O equipamento continua bloqueado mesmo após o cancelamento? */
  equipmentHeld: boolean;
}

export interface SpaceInfo {
  id: string;
  name: string;
}

export interface ScheduleConfig {
  kind: 'schedule';
  day: string;
  spaces: SpaceInfo[];
  equipmentName?: string;
  groups: string[];
  reservations: Reservation[];
  openHour: number;
  closeHour: number;
}

export type ToolConfig = InventoryConfig | EnrollmentConfig | ScheduleConfig;

export type SimAction =
  | { type: 'inv.donate'; product: string; qty: number; expiry?: string }
  | { type: 'inv.withdraw'; product: string; qty: number; lotId?: string }
  | { type: 'inv.query' }
  | { type: 'enr.enroll'; person: string; courseId: string }
  | { type: 'enr.cancel'; person: string; courseId: string }
  | { type: 'sch.book'; space: string; start: number; end: number; group: string; equipment: boolean }
  | { type: 'sch.cancel'; reservationId: string };

export type EventOutcome = 'aceito' | 'recusado' | 'consulta';

interface BaseEvent {
  seq: number;
  outcome: EventOutcome;
  message: string;
  /** A ferramenta não tinha essa função. */
  unsupported?: boolean;
  /** Teste que disparou a ação pelo botão “Fazer o teste por mim”. */
  forTest?: string;
}

export interface DonateEvent extends BaseEvent {
  type: 'inv.donate';
  product: string;
  qty: number;
  expiry?: string;
  expiryStored: boolean;
}

export interface WithdrawEvent extends BaseEvent {
  type: 'inv.withdraw';
  product: string;
  qty: number;
  lotId?: string;
  availableBefore: number;
  stockAfter: number;
  touchedExpired: boolean;
  reason?: 'estoque' | 'vencido' | 'quantidade';
}

export interface QueryEvent extends BaseEvent {
  type: 'inv.query';
  separated: boolean;
  rows: { product: string; available: number; expired: number }[];
  /** Unidades vencidas que a consulta contou como disponíveis. */
  hiddenExpired: number;
}

export interface EnrollEvent extends BaseEvent {
  type: 'enr.enroll';
  person: string;
  courseId: string;
  wasDuplicate: boolean;
  wasFull: boolean;
  result: 'confirmada' | 'espera' | 'recusada';
  reason?: 'duplicada' | 'cheia' | 'sem-funcao';
  countAfter: number;
  capacity: number;
}

export interface CancelEnrollmentEvent extends BaseEvent {
  type: 'enr.cancel';
  person: string;
  courseId: string;
  waitlistBefore: string[];
  promoted?: string;
}

export interface BookEvent extends BaseEvent {
  type: 'sch.book';
  space: string;
  start: number;
  end: number;
  group: string;
  equipmentRequested: boolean;
  equipmentIgnored: boolean;
  overlaps: boolean;
  adjacent: boolean;
  equipmentClash: boolean;
  reason?: 'conflito' | 'intervalo' | 'equipamento' | 'horario';
}

export interface CancelBookingEvent extends BaseEvent {
  type: 'sch.cancel';
  reservationId: string;
  hadEquipment: boolean;
  equipmentReleased: boolean;
}

export type SimEvent =
  | DonateEvent
  | WithdrawEvent
  | QueryEvent
  | EnrollEvent
  | CancelEnrollmentEvent
  | BookEvent
  | CancelBookingEvent;

export interface InventoryState {
  kind: 'inventory';
  lots: Lot[];
  nextLot: number;
}

export interface EnrollmentState {
  kind: 'enrollment';
  courses: Course[];
}

export interface ScheduleState {
  kind: 'schedule';
  reservations: Reservation[];
  nextId: number;
}

export type ToolState = InventoryState | EnrollmentState | ScheduleState;

export interface Simulation {
  tool: ToolState;
  events: SimEvent[];
  seq: number;
}

/* ------------------------------------------------------------------ */
/* Testes                                                              */
/* ------------------------------------------------------------------ */

export type TestCheckKind =
  | 'inv.donation'
  | 'inv.withdrawValid'
  | 'inv.withdrawExcess'
  | 'inv.lotsDifferentDates'
  | 'inv.queryAvailability'
  | 'inv.distributeExpired'
  | 'enr.valid'
  | 'enr.duplicate'
  | 'enr.full'
  | 'enr.waitlist'
  | 'enr.cancelConfirmed'
  | 'enr.promotionOrder'
  | 'sch.freeAdjacent'
  | 'sch.conflict'
  | 'sch.cancel'
  | 'sch.roomWithEquipment'
  | 'sch.equipmentClash'
  | 'sch.releaseAfterCancel';

export interface TestCase {
  id: string;
  title: string;
  /** O que fazer na ferramenta. */
  instruction: string;
  /** O que deveria acontecer se a solução estiver certa. */
  expected: string;
  check: TestCheckKind;
  /** Ações equivalentes executadas pelo botão “Fazer o teste por mim”. */
  autoActions: SimAction[];
}

export type TestStatus = 'pendente' | 'passou' | 'falhou' | 'inconclusivo';

export interface TestResult {
  status: TestStatus;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

export interface Character {
  name: string;
  role: string;
  avatar: AvatarSpec;
}

export interface AvatarSpec {
  skin: string;
  hair: string;
  hairStyle: 'coque' | 'curto' | 'cacheado' | 'longo';
  shirt: string;
  glasses?: boolean;
}

export interface Variation {
  id: VariationId;
  scenarioId: ScenarioId;
  letter: 'A' | 'B';
  title: string;
  /** Situação inicial contada pela personagem. */
  situation: string;
  /** Objetivo da missão, sempre visível. */
  goal: string;
  /** Objetivo de aprendizagem. */
  learning: string;
  /** Destaque fixo (por exemplo, a data de referência). */
  referenceNote?: string;
  questions: Question[];
  facts: Fact[];
  help: Record<'briefing' | 'investigate' | 'build' | 'test', HelpSet>;
  /** Papel de cada bloco disponível nesta variação. Só blocos listados aparecem. */
  blockRoles: Record<string, BlockRole>;
  tool: ToolConfig;
  tests: TestCase[];
  /** Impacto mostrado na conclusão. */
  impact: string;
  /** Aprendizados resumidos na conclusão. */
  takeaways: string[];
}

export interface Scenario {
  id: ScenarioId;
  number: number;
  title: string;
  tag: string;
  character: Character;
  place: string;
  problem: string;
  duration: string;
  toolKind: ToolKind;
  blocks: PromptBlock[];
  conflicts: BlockConflict[];
  flagTexts: Partial<Record<SimFlag, FlagText>>;
  variations: [Variation, Variation];
  /** Melhoria visual da oficina ao concluir o cenário. */
  upgrade: string;
}

/* ------------------------------------------------------------------ */
/* Estado salvo                                                        */
/* ------------------------------------------------------------------ */

export interface AttemptSummary {
  number: number;
  blockIds: string[];
  editedBlockIds: string[];
  flags: SimFlag[];
  score: number;
  max: number;
  criteria: Record<CriterionId, CriterionStatus>;
  tests: Record<string, TestResult>;
}

export interface MissionRun {
  variationId: VariationId;
  step: Step;
  /** Etapa mais avançada já alcançada (para navegação). */
  furthest: Step;
  asked: string[];
  discovered: string[];
  assembly: AssembledBlock[];
  /** Nível de ajuda aberto por etapa (0 a 3). Não afeta pontuação. */
  help: Partial<Record<Step, number>>;
  attempts: AttemptSummary[];
  sim: Simulation | null;
  /** Mostrar aviso “os testes foram reiniciados”. */
  simResetNotice: boolean;
  completed: boolean;
}

export type BadgeId =
  | 'investigar'
  | 'comunicar'
  | 'testar'
  | 'melhorar'
  | 'doacoes'
  | 'vagas'
  | 'agenda'
  | 'oficina';

export interface Completion {
  times: number;
  bestScore: number;
  attempts: number;
}

export type Screen = 'welcome' | 'workshop' | 'mission';

export interface GameState {
  screen: Screen;
  active: VariationId | null;
  runs: Partial<Record<VariationId, MissionRun>>;
  completions: Partial<Record<VariationId, Completion>>;
  badges: BadgeId[];
}
