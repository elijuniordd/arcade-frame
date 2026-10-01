import { useState } from 'react';
import { formatRange, formatTime } from '../../simulation/format';
import { equipmentHolders, spaceName } from '../../simulation/schedule';
import type { Reservation, ScheduleConfig, ScheduleState, SimAction, SimEvent, SimFlag } from '../../types';
import { Icon } from '../ui/Icon';
import { EventLog, Missing, SelectField, ToolForm, ToolFrame } from './common';

interface Props {
  config: ScheduleConfig;
  tool: ScheduleState;
  flags: SimFlag[];
  events: SimEvent[];
  onAction: (a: SimAction) => void;
}

/** Distribui reservas em faixas: reservas sobrepostas aparecem em faixas diferentes (e ficam visíveis). */
function lanes(items: Reservation[]): Reservation[][] {
  const out: Reservation[][] = [];
  for (const r of [...items].sort((a, b) => a.start - b.start)) {
    const lane = out.find((l) => l.every((x) => x.end <= r.start || x.start >= r.end));
    if (lane) lane.push(r);
    else out.push([r]);
  }
  return out;
}

export function ScheduleTool({ config, tool, flags, events, onAction }: Props) {
  const hours = Array.from({ length: config.closeHour - config.openHour + 1 }, (_, i) => config.openHour + i);
  const [space, setSpace] = useState(config.spaces[0].id);
  const [start, setStart] = useState(String(16 * 60));
  const [end, setEnd] = useState(String(18 * 60));
  const [group, setGroup] = useState(config.groups[0]);
  const [equipment, setEquipment] = useState(false);
  const hasEquipment = Boolean(config.equipmentName);
  const tracksEquipment = hasEquipment && flags.includes('sch.equipment');
  const canCancel = flags.includes('sch.cancel');
  const span = (config.closeHour - config.openHour) * 60;
  const timeOptions = hours.map((h) => ({ value: String(h * 60), label: formatTime(h * 60) }));

  return (
    <ToolFrame title="Agenda do centro comunitário" subtitle={config.day}>
      <div className="tool-grid">
        <section aria-labelledby="agenda-title" className="tool-data">
          <h4 id="agenda-title" className="tool-data__title">
            Agenda por espaço
          </h4>
          {config.spaces.map((s) => {
            const active = tool.reservations.filter((r) => r.space === s.id && r.status === 'ativa').sort((a, b) => a.start - b.start);
            const cancelled = tool.reservations.filter((r) => r.space === s.id && r.status === 'cancelada');
            return (
              <div key={s.id} className="space">
                <p className="space__name">{s.name}</p>
                <div className="timeline" aria-hidden="true">
                  {lanes(active).map((lane, li) => (
                    <div key={li} className="timeline__lane">
                      {lane.map((r) => (
                        <span
                          key={r.id}
                          className={['timeline__slot', r.equipment && 'has-equip'].filter(Boolean).join(' ')}
                          style={{ left: `${((r.start - config.openHour * 60) / span) * 100}%`, width: `${((r.end - r.start) / span) * 100}%` }}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="timeline__scale">
                    {[config.openHour, 12, 16, config.closeHour].map((h) => (
                      <span key={h} style={{ left: `${((h - config.openHour) / (config.closeHour - config.openHour)) * 100}%` }}>
                        {h}h
                      </span>
                    ))}
                  </div>
                </div>
                {active.length === 0 ? (
                  <p className="muted small">Sem reservas ativas.</p>
                ) : (
                  <ul className="slots">
                    {active.map((r) => (
                      <li key={r.id}>
                        <span>
                          <strong>{formatRange(r.start, r.end)}</strong> · {r.group}
                          {r.equipment && tracksEquipment && ` · com ${config.equipmentName?.toLowerCase()}`}
                        </span>
                        {canCancel && (
                          <button
                            type="button"
                            className="btn btn--tool btn--small"
                            onClick={() => onAction({ type: 'sch.cancel', reservationId: r.id })}
                            aria-label={`Cancelar a reserva de ${r.group}, ${s.name}, ${formatRange(r.start, r.end)}`}
                          >
                            <Icon name="x" size={16} />
                            <span>Cancelar</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {cancelled.length > 0 && (
                  <p className="muted small">
                    Canceladas: {cancelled.map((r) => `${formatRange(r.start, r.end)} (${r.group})`).join('; ')}
                  </p>
                )}
              </div>
            );
          })}
          {hasEquipment && (
            <div className="equipment">
              <p className="space__name">
                <Icon name="sparkle" size={18} /> {config.equipmentName}
              </p>
              {tracksEquipment ? (
                equipmentHolders(tool).length === 0 ? (
                  <p>Livre o dia todo.</p>
                ) : (
                  <ul className="slots">
                    {equipmentHolders(tool)
                      .sort((a, b) => a.start - b.start)
                      .map((r) => (
                        <li key={r.id}>
                          <span>
                            Ocupado <strong>{formatRange(r.start, r.end)}</strong> — {spaceName(config, r.space)}, {r.group}
                            {r.status === 'cancelada' && ' (reserva cancelada)'}
                          </span>
                        </li>
                      ))}
                  </ul>
                )
              ) : (
                <p className="muted">Esta ferramenta não registra o {config.equipmentName?.toLowerCase()}.</p>
              )}
            </div>
          )}
          {!canCancel && <Missing title="Cancelar reserva" reason="Esta função não foi criada: o pedido não falou de cancelamentos." />}
        </section>

        <div className="tool-actions">
          {flags.includes('sch.book') ? (
            <ToolForm
              title="Nova reserva"
              submit="Reservar"
              onSubmit={() => onAction({ type: 'sch.book', space, start: Number(start), end: Number(end), group, equipment: tracksEquipment && equipment })}
            >
              <SelectField label="Espaço" value={space} onChange={setSpace} options={config.spaces.map((s) => ({ value: s.id, label: s.name }))} />
              <SelectField label="Início" value={start} onChange={setStart} options={timeOptions} />
              <SelectField label="Fim" value={end} onChange={setEnd} options={timeOptions} />
              <SelectField label="Grupo" value={group} onChange={setGroup} options={config.groups.map((g) => ({ value: g, label: g }))} />
              {tracksEquipment && (
                <label className="check">
                  <input type="checkbox" checked={equipment} onChange={(e) => setEquipment(e.target.checked)} />
                  <span>Usar o {config.equipmentName?.toLowerCase()}</span>
                </label>
              )}
            </ToolForm>
          ) : (
            <Missing title="Nova reserva" reason="Esta função não foi criada: o pedido não falou de registrar reservas." />
          )}
        </div>
      </div>
      <EventLog events={events} />
    </ToolFrame>
  );
}
