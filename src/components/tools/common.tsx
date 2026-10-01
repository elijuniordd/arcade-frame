import type { ReactNode } from 'react';
import type { SimEvent } from '../../types';
import { Icon } from '../ui/Icon';
import { Tag } from '../ui/primitives';

export function ToolFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="tool" aria-labelledby="tool-title">
      <div className="tool__head">
        <Tag color="lilac" icon="bot">
          IA SIMULADA
        </Tag>
        <h3 id="tool-title" className="tool__title">
          {title}
        </h3>
        {subtitle && <p className="tool__subtitle">{subtitle}</p>}
      </div>
      <div className="tool__body">{children}</div>
    </section>
  );
}

/** Seção de função que a IA não criou porque o pedido não pediu. */
export function Missing({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="tool-missing">
      <p className="tool-missing__title">
        <Icon name="lock" size={18} /> {title}
      </p>
      <p>{reason}</p>
    </div>
  );
}

export function ToolForm({ title, onSubmit, children, submit }: { title: string; onSubmit: () => void; children: ReactNode; submit: string }) {
  return (
    <form
      className="tool-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset>
        <legend>{title}</legend>
        <div className="tool-form__fields">{children}</div>
        <button type="submit" className="btn btn--tool">
          <span>{submit}</span>
        </button>
      </fieldset>
    </form>
  );
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input type="number" inputMode="numeric" min={1} max={999} step={1} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const OUTCOME_ICON = { aceito: 'check', recusado: 'x', consulta: 'search' } as const;
const OUTCOME_TEXT = { aceito: 'Aceito', recusado: 'Recusado', consulta: 'Consulta' } as const;

export function EventLog({ events }: { events: SimEvent[] }) {
  const latest = events[events.length - 1];
  return (
    <section className="log" aria-labelledby="log-title">
      <h4 id="log-title" className="log__title">
        Histórico da ferramenta
      </h4>
      <div className="log__latest" aria-live="polite" aria-atomic="true">
        {latest ? (
          <p className={`log__item log__item--${latest.outcome}`}>
            <Icon name={OUTCOME_ICON[latest.outcome]} size={18} />
            <span>
              <strong>{OUTCOME_TEXT[latest.outcome]}:</strong> {latest.message}
            </span>
          </p>
        ) : (
          <p className="muted">Nenhuma ação ainda. Use a ferramenta ou os botões de teste.</p>
        )}
      </div>
      {events.length > 1 && (
        <details className="log__older">
          <summary>Ações anteriores ({events.length - 1})</summary>
          <ol>
            {events
              .slice(0, -1)
              .reverse()
              .map((e) => (
                <li key={e.seq} className={`log__item log__item--${e.outcome}`}>
                  <Icon name={OUTCOME_ICON[e.outcome]} size={16} />
                  <span>
                    <strong>{OUTCOME_TEXT[e.outcome]}:</strong> {e.message}
                    {e.forTest && <span className="muted"> (teste automático)</span>}
                  </span>
                </li>
              ))}
          </ol>
        </details>
      )}
    </section>
  );
}
