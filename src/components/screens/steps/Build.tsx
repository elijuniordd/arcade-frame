import { useRef, useState, type DragEvent } from 'react';
import { getVariation } from '../../../content';
import { EDIT_NOTICE } from '../../../content/guidance';
import { CATEGORIES, CATEGORY_ORDER } from '../../../content/labels';
import { useGame } from '../../../engine/GameContext';
import { availableBlocks, findConflicts } from '../../../evaluation/evaluate';
import type { AssembledBlock, BlockCategory, MissionRun, PromptBlock } from '../../../types';
import { DiscoveredPanel } from '../../game/DiscoveredPanel';
import { InstructionPanel } from '../../game/Guidance';
import { Icon } from '../../ui/Icon';
import { Button, Notice, Pixel, Tag, type TagColor } from '../../ui/primitives';

export function Build({ run, level }: { run: MissionRun; level: 'completa' | 'curta' }) {
  const { dispatch, announce } = useGame();
  const { scenario, variation } = getVariation(run.variationId);
  const blocks = availableBlocks(scenario, variation);
  const selectedIds = run.assembly.map((a) => a.blockId);
  const conflicts = findConflicts(scenario, selectedIds);
  const assemblyTitle = useRef<HTMLHeadingElement>(null);
  const blockOf = (id: string) => scenario.blocks.find((b) => b.id === id)!;

  const add = (b: PromptBlock) => {
    dispatch({ type: 'ADD_BLOCK', blockId: b.id });
    announce(`Bloco adicionado ao pedido (${CATEGORIES[b.category].term}). O pedido tem ${selectedIds.length + 1} bloco(s).`);
  };
  const remove = (id: string, refocus = false) => {
    dispatch({ type: 'REMOVE_BLOCK', blockId: id });
    announce(`Bloco removido do pedido.`);
    if (refocus) assemblyTitle.current?.focus();
  };

  const canExperiment = run.assembly.length > 0 && conflicts.length === 0;

  return (
    <div className="step step--build">
      <div className="step__head">
        <Pixel color="teal">ETAPA 03 · CRIAR</Pixel>
        <h2 id="step-title" tabIndex={-1} className="step__title">
          Monte o pedido para a IA
        </h2>
      </div>
      <InstructionPanel step="build" level={level} />

      <div className="build">
        <div className="build__source">
          <details className="panel panel--surface collapsible" open>
            <summary>
              <Icon name="pin" /> O que já descobrimos (consulte enquanto monta)
            </summary>
            <DiscoveredPanel facts={variation.facts} discovered={run.discovered} headingLevel={3} id="descobertas-build" />
            {run.discovered.length === 0 && (
              <Button small variant="secondary" icon="arrow-left" onClick={() => dispatch({ type: 'SET_STEP', step: 'investigate' })}>
                VOLTAR A INVESTIGAR
              </Button>
            )}
          </details>

          <section aria-labelledby="available-title" className="available">
            <h3 id="available-title" className="section-title">
              Blocos disponíveis
            </h3>
            <p className="muted">Abra cada parte do pedido e escolha os blocos que fazem sentido. Nem todo bloco ajuda: alguns são vagos ou não combinam com a missão.</p>
            {CATEGORY_ORDER.map((cat, i) => {
              const items = blocks.filter((b) => b.category === cat);
              if (items.length === 0) return null;
              const count = items.filter((b) => selectedIds.includes(b.id)).length;
              return (
                <details key={cat} className={`category cat--${CATEGORIES[cat].color}`} open={i === 0}>
                  <summary>
                    <span className="category__name">
                      {CATEGORIES[cat].title} <span className="term">— {CATEGORIES[cat].term}</span>
                    </span>
                    <span className="category__count">{count > 0 ? `${count} no pedido` : 'nenhum no pedido'}</span>
                  </summary>
                  <p className="category__hint">{CATEGORIES[cat].hint}</p>
                  <ul className="options">
                    {items.map((b) => {
                      const selected = selectedIds.includes(b.id);
                      return (
                        <li key={b.id} className={['option', selected && 'is-selected'].filter(Boolean).join(' ')}>
                          <p className="option__text">{b.text}</p>
                          {selected ? (
                            <div className="option__row">
                              <span className="option__state">
                                <Icon name="check" size={18} /> No pedido
                              </span>
                              <Button small variant="ghost" icon="minus" onClick={() => remove(b.id)} aria-label={`Remover do pedido: ${b.text}`}>
                                REMOVER
                              </Button>
                            </div>
                          ) : (
                            <Button small variant="secondary" icon="plus" onClick={() => add(b)} aria-label={`Adicionar ao pedido: ${b.text}`}>
                              ADICIONAR
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </section>
        </div>

        <div className="build__target">
          <section aria-labelledby="assembly-title" className="assembly panel panel--section">
            <div className="assembly__head">
              <h3 id="assembly-title" ref={assemblyTitle} tabIndex={-1} className="section-title">
                Seu pedido ({run.assembly.length} {run.assembly.length === 1 ? 'bloco' : 'blocos'})
              </h3>
              {run.assembly.length > 1 && (
                <Button small variant="ghost" icon="sort" onClick={() => dispatch({ type: 'SORT_BLOCKS' })}>
                  ORGANIZAR POR CATEGORIA
                </Button>
              )}
            </div>
            <p className="muted small">{EDIT_NOTICE}</p>
            {run.assembly.length === 0 ? (
              <p className="assembly__empty">Seu pedido está vazio. Adicione blocos da lista de blocos disponíveis.</p>
            ) : (
              <AssemblyList assembly={run.assembly} blockOf={blockOf} onRemove={(id) => remove(id, true)} />
            )}
            <Coverage selected={selectedIds.map(blockOf)} />
          </section>

          {conflicts.length > 0 && (
            <div className="conflicts" role="alert">
              {conflicts.map((c) => (
                <Notice key={`${c.a}-${c.b}`} tone="alert" title="Instruções que se contradizem">
                  <p>{c.explanation}</p>
                  <div className="conflicts__actions">
                    {[c.a, c.b].map((id) => (
                      <Button key={id} small variant="secondary" icon="minus" onClick={() => remove(id, true)}>
                        REMOVER: “{truncate(blockOf(id).text)}”
                      </Button>
                    ))}
                  </div>
                </Notice>
              ))}
            </div>
          )}

          <section aria-labelledby="preview-title" className="preview">
            <h3 id="preview-title" className="section-title">
              Prévia do pedido organizado
            </h3>
            {run.assembly.length === 0 ? (
              <p className="muted">A prévia aparece quando você adicionar blocos.</p>
            ) : (
              <ol className="preview__list">
                {run.assembly.map((a) => (
                  <li key={a.blockId}>
                    <span className="preview__cat">{CATEGORIES[blockOf(a.blockId).category].term}:</span> {a.text}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="experiment">
            {run.attempts.length > 0 && (
              <p className="muted small">
                <Icon name="refresh" size={16} /> Ao experimentar de novo, a ferramenta é recriada a partir dos dados iniciais da missão e os testes recomeçam. As tentativas
                anteriores ficam guardadas para comparação.
              </p>
            )}
            {!canExperiment && (
              <p className="experiment__why" id="experiment-why">
                <Icon name="info" size={16} />{' '}
                {run.assembly.length === 0 ? 'Adicione pelo menos um bloco para experimentar.' : 'Resolva as instruções que se contradizem para experimentar.'}
              </p>
            )}
            <Button
              variant="primary"
              icon="play"
              disabled={!canExperiment}
              aria-describedby={!canExperiment ? 'experiment-why' : undefined}
              onClick={() => {
                dispatch({ type: 'EXPERIMENT' });
                announce('A IA simulada criou uma ferramenta a partir do seu pedido. Agora é hora de testar.');
              }}
            >
              EXPERIMENTAR SOLUÇÃO
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncate(text: string, n = 48) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

const COLOR: Record<BlockCategory, TagColor> = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, CATEGORIES[c].color])) as Record<BlockCategory, TagColor>;

function AssemblyList({ assembly, blockOf, onRemove }: { assembly: AssembledBlock[]; blockOf: (id: string) => PromptBlock; onRemove: (id: string) => void }) {
  const { dispatch } = useGame();
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const onDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragging;
    if (id) dispatch({ type: 'MOVE_BLOCK', blockId: id, to: index });
    setDragging(null);
  };

  return (
    <ol className="assembled-list">
      {assembly.map((a, i) => {
        const block = blockOf(a.blockId);
        const edited = a.text !== block.text;
        const cat = CATEGORIES[block.category];
        const isEditing = editing === a.blockId;
        return (
          <li
            key={a.blockId}
            className={['assembled', `cat--${cat.color}`, dragging === a.blockId && 'is-dragging'].filter(Boolean).join(' ')}
            draggable={!isEditing}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', a.blockId);
              e.dataTransfer.effectAllowed = 'move';
              setDragging(a.blockId);
            }}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, i)}
          >
            <div className="assembled__head">
              <span className="assembled__pos" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Tag color={COLOR[block.category]}>{cat.term.toUpperCase()}</Tag>
              {edited && (
                <Tag color="outline" icon="edit">
                  TEXTO EDITADO
                </Tag>
              )}
            </div>
            {isEditing ? (
              <label className="field">
                <span className="field__label">Texto do bloco (a avaliação considera o bloco escolhido, não as palavras)</span>
                <textarea
                  value={a.text}
                  rows={4}
                  maxLength={600}
                  onChange={(e) => dispatch({ type: 'EDIT_BLOCK', blockId: a.blockId, text: e.target.value })}
                  autoFocus
                />
              </label>
            ) : (
              <p className="assembled__text">{a.text}</p>
            )}
            <div className="assembled__actions">
              <button
                type="button"
                className="icon-btn"
                disabled={i === 0}
                onClick={() => dispatch({ type: 'MOVE_BLOCK', blockId: a.blockId, to: i - 1 })}
                aria-label={`Mover para cima: ${truncate(block.text)}`}
              >
                <Icon name="arrow-up" />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={i === assembly.length - 1}
                onClick={() => dispatch({ type: 'MOVE_BLOCK', blockId: a.blockId, to: i + 1 })}
                aria-label={`Mover para baixo: ${truncate(block.text)}`}
              >
                <Icon name="arrow-down" />
              </button>
              <Button small variant="ghost" icon={isEditing ? 'check' : 'edit'} onClick={() => setEditing(isEditing ? null : a.blockId)} aria-expanded={isEditing}>
                {isEditing ? 'CONCLUIR EDIÇÃO' : 'EDITAR TEXTO'}
              </Button>
              {edited && (
                <Button small variant="ghost" icon="undo" onClick={() => dispatch({ type: 'RESET_BLOCK_TEXT', blockId: a.blockId })}>
                  TEXTO ORIGINAL
                </Button>
              )}
              <Button small variant="ghost" icon="trash" onClick={() => onRemove(a.blockId)} aria-label={`Remover do pedido: ${truncate(block.text)}`}>
                REMOVER
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Mostra quais partes do pedido têm pelo menos um bloco. Não revela se o bloco é bom — isso aparece nos testes. */
function Coverage({ selected }: { selected: PromptBlock[] }) {
  return (
    <div className="coverage">
      <p className="coverage__title">Partes do pedido preenchidas</p>
      <ul className="coverage__list">
        {CATEGORY_ORDER.map((cat) => {
          const has = selected.some((b) => b.category === cat);
          return (
            <li key={cat} className={has ? 'is-on' : ''}>
              <Icon name={has ? 'check' : 'circle'} size={16} />
              <span>
                {CATEGORIES[cat].term}
                <span className="sr-only">{has ? ': preenchida' : ': vazia'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
