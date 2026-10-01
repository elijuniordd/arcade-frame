import { useState } from 'react';
import type { EnrollmentConfig, EnrollmentState, SimAction, SimEvent, SimFlag } from '../../types';
import { Icon } from '../ui/Icon';
import { EventLog, Missing, SelectField, ToolForm, ToolFrame } from './common';

interface Props {
  config: EnrollmentConfig;
  tool: EnrollmentState;
  flags: SimFlag[];
  events: SimEvent[];
  onAction: (a: SimAction) => void;
}

export function EnrollmentTool({ config, tool, flags, events, onAction }: Props) {
  const [person, setPerson] = useState(config.people[0]);
  const [course, setCourse] = useState(config.courses[0].id);
  const canCancel = flags.includes('enr.cancel');
  const usesWaitlist = flags.includes('enr.waitlist');

  return (
    <ToolFrame title="Inscrições nos cursos" subtitle="Biblioteca comunitária">
      <div className="tool-grid">
        <section aria-labelledby="courses-title" className="tool-data">
          <h4 id="courses-title" className="tool-data__title">
            Turmas
          </h4>
          <ul className="courses">
            {tool.courses.map((c) => {
              const over = c.confirmed.length > c.capacity;
              return (
                <li key={c.id} className="course">
                  <p className="course__name">{c.name}</p>
                  <p className="course__meta">
                    {c.schedule} · <strong>{c.confirmed.length} de {c.capacity} vagas ocupadas</strong>
                    {c.confirmed.length >= c.capacity && !over && ' (turma cheia)'}
                  </p>
                  <p className="course__sub">Inscrições confirmadas</p>
                  <ol className="people">
                    {c.confirmed.map((p, i) => (
                      <li key={`${p}-${i}`}>
                        <span>{p}</span>
                        {canCancel && (
                          <button
                            type="button"
                            className="btn btn--tool btn--small"
                            onClick={() => onAction({ type: 'enr.cancel', person: p, courseId: c.id })}
                            aria-label={`Cancelar a inscrição de ${p} em ${c.name}`}
                          >
                            <Icon name="x" size={16} />
                            <span>Cancelar</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  {(usesWaitlist || c.waitlist.length > 0) && (
                    <>
                      <p className="course__sub">{usesWaitlist ? 'Lista de espera (ordem de chegada)' : 'Lista de espera anotada no caderno — esta ferramenta não usa'}</p>
                      {c.waitlist.length === 0 ? (
                        <p className="muted small">Ninguém na lista.</p>
                      ) : (
                        <ol className="people people--wait">
                          {c.waitlist.map((p, i) => (
                            <li key={`${p}-${i}`}>
                              <span>
                                {i + 1}º — {p}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {!canCancel && <Missing title="Cancelar inscrição" reason="Esta função não foi criada: o pedido não falou de cancelamentos." />}
        </section>

        <div className="tool-actions">
          {flags.includes('enr.enroll') ? (
            <ToolForm title="Nova inscrição" submit="Inscrever" onSubmit={() => onAction({ type: 'enr.enroll', person, courseId: course })}>
              <SelectField label="Pessoa" value={person} onChange={setPerson} options={config.people.map((p) => ({ value: p, label: p }))} />
              <SelectField label="Turma" value={course} onChange={setCourse} options={config.courses.map((c) => ({ value: c.id, label: c.name }))} />
            </ToolForm>
          ) : (
            <Missing title="Nova inscrição" reason="Esta função não foi criada: o pedido não falou de registrar inscrições." />
          )}
          <p className="muted small">Os nomes são de pessoas fictícias da missão. O jogo não pede nem guarda dados de quem joga.</p>
        </div>
      </div>
      <EventLog events={events} />
    </ToolFrame>
  );
}
