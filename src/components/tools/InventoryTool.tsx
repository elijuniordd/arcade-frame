import { useState } from 'react';
import { formatDate, isExpired } from '../../simulation/format';
import { productName, totalOf, tracksExpiry } from '../../simulation/inventory';
import type { InventoryConfig, InventoryState, SimAction, SimEvent, SimFlag } from '../../types';
import { Icon } from '../ui/Icon';
import { EventLog, Missing, NumberField, SelectField, ToolForm, ToolFrame } from './common';

interface Props {
  config: InventoryConfig;
  tool: InventoryState;
  flags: SimFlag[];
  events: SimEvent[];
  onAction: (a: SimAction) => void;
}

export function InventoryTool({ config, tool, flags, events, onAction }: Props) {
  const expiry = tracksExpiry(flags, config);
  const separate = expiry && flags.includes('inv.separateExpired');
  const productOptions = config.products.map((p) => ({ value: p.id, label: p.name }));
  const lastQuery = [...events].reverse().find((e) => e.type === 'inv.query');

  return (
    <ToolFrame title={config.referenceDate ? 'Controle de lotes e validade' : 'Controle de doações'} subtitle={config.referenceDate ? `Hoje na missão: ${formatDate(config.referenceDate)}` : undefined}>
      <div className="tool-grid">
        <section aria-labelledby="stock-title" className="tool-data">
          <h4 id="stock-title" className="tool-data__title">
            Estoque
          </h4>
          {expiry ? (
            <table className="table">
              <caption className="sr-only">Lotes em estoque</caption>
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Produto</th>
                  <th scope="col">Qtd.</th>
                  <th scope="col">Validade</th>
                  {separate && <th scope="col">Situação</th>}
                </tr>
              </thead>
              <tbody>
                {tool.lots
                  .filter((l) => l.qty !== 0)
                  .map((l) => {
                    const expired = isExpired(l.expiry, config.referenceDate);
                    return (
                      <tr key={l.id}>
                        <td>{l.id}</td>
                        <td>{productName(config, l.product)}</td>
                        <td>{l.qty}</td>
                        <td>{l.expiry ? formatDate(l.expiry) : 'sem data'}</td>
                        {separate && (
                          <td>
                            {expired ? (
                              <span className="status status--bad">
                                <Icon name="alert" size={16} /> Vencido
                              </span>
                            ) : (
                              <span className="status status--ok">
                                <Icon name="check" size={16} /> Válido
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <caption className="sr-only">Quantidade por produto</caption>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {config.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{totalOf(tool, p.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" className="btn btn--tool btn--small" onClick={() => onAction({ type: 'inv.query' })}>
            <Icon name="search" size={18} />
            <span>Consultar disponibilidade</span>
          </button>
          {lastQuery && lastQuery.type === 'inv.query' && (
            <div className="query">
              <p className="query__title">Resultado da última consulta</p>
              <ul>
                {lastQuery.rows.map((r) => (
                  <li key={r.product}>
                    <strong>{productName(config, r.product)}:</strong> {r.available} disponível(is)
                    {lastQuery.separated && `, ${r.expired} vencido(s) — separar para descarte`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="tool-actions">
          {flags.includes('inv.entries') ? (
            <DonateForm config={config} expiry={expiry} productOptions={productOptions} onAction={onAction} />
          ) : (
            <Missing title="Registrar doação" reason="Esta função não foi criada: o pedido não falou de registrar as doações que chegam." />
          )}
          {flags.includes('inv.exits') ? (
            <WithdrawForm config={config} tool={tool} expiry={expiry} productOptions={productOptions} onAction={onAction} />
          ) : (
            <Missing title="Registrar retirada" reason="Esta função não foi criada: o pedido não falou de registrar retiradas ou entregas." />
          )}
        </div>
      </div>
      <EventLog events={events} />
    </ToolFrame>
  );
}

function DonateForm({ config, expiry, productOptions, onAction }: { config: InventoryConfig; expiry: boolean; productOptions: { value: string; label: string }[]; onAction: (a: SimAction) => void }) {
  const [product, setProduct] = useState(config.products[0].id);
  const [qty, setQty] = useState('10');
  const [date, setDate] = useState('');
  return (
    <ToolForm
      title={expiry ? 'Registrar lote recebido' : 'Registrar doação'}
      submit={expiry ? 'Registrar lote' : 'Registrar doação'}
      onSubmit={() => onAction({ type: 'inv.donate', product, qty: Number(qty), ...(expiry ? { expiry: date || undefined } : {}) })}
    >
      <SelectField label="Produto" value={product} onChange={setProduct} options={productOptions} />
      <NumberField label="Quantidade" value={qty} onChange={setQty} />
      {expiry && (
        <label className="field">
          <span className="field__label">Validade</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
    </ToolForm>
  );
}

function WithdrawForm({
  config,
  tool,
  expiry,
  productOptions,
  onAction,
}: {
  config: InventoryConfig;
  tool: InventoryState;
  expiry: boolean;
  productOptions: { value: string; label: string }[];
  onAction: (a: SimAction) => void;
}) {
  const [product, setProduct] = useState(config.products[0].id);
  const [qty, setQty] = useState('1');
  const [lot, setLot] = useState('');
  const lots = tool.lots.filter((l) => l.product === product && l.qty > 0);
  return (
    <ToolForm
      title={expiry ? 'Registrar entrega' : 'Registrar retirada'}
      submit={expiry ? 'Registrar entrega' : 'Registrar retirada'}
      onSubmit={() => onAction({ type: 'inv.withdraw', product, qty: Number(qty), ...(expiry && lot ? { lotId: lot } : {}) })}
    >
      <SelectField
        label="Produto"
        value={product}
        onChange={(v) => {
          setProduct(v);
          setLot('');
        }}
        options={productOptions}
      />
      <NumberField label="Quantidade" value={qty} onChange={setQty} />
      {expiry && (
        <SelectField
          label="Lote"
          value={lot}
          onChange={setLot}
          options={[{ value: '', label: 'Automático (vence antes sai primeiro)' }, ...lots.map((l) => ({ value: l.id, label: `${l.id} — validade ${formatDate(l.expiry)} (${l.qty})` }))]}
        />
      )}
    </ToolForm>
  );
}
