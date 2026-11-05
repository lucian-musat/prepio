'use client';

import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import type { AnswerSpan } from '@prepio/shared';
import SortableList from '../cards/SortableList';
import SpanMarker, { type MarkerAction } from './SpanMarker';
import { spanFromSelection } from './selection';
import type { FieldsProps } from './exerciseModel';

/**
 * The valid cause → effect pairs. „Adaugă pereche” starts a two-step mode on the source:
 * „Marchează cauza”, then „Marchează efectul”.
 */
export default function PairsFields({ idPrefix, draft, onChange, sources }: FieldsProps<'cause_effect'>) {
  const source = sources[0]?.source;
  // null = not building; { cause: null } = waiting for the cause; { cause } = waiting for the effect
  const [building, setBuilding] = useState<{ cause: AnswerSpan | null } | null>(null);

  const causeIds = new Set(draft.pairs.map((p) => p.cause.id));
  if (building?.cause) causeIds.add(building.cause.id);
  const spans = [...draft.pairs.flatMap((p) => [p.cause, p.effect]), ...(building?.cause ? [building.cause] : [])];

  const actions: MarkerAction[] = !source || !building
    ? []
    : building.cause === null
      ? [{ label: 'Marchează cauza', onClick: (sel) => setBuilding({ cause: spanFromSelection(source.body, source.id, sel, crypto.randomUUID()) }) }]
      : [
          {
            label: 'Marchează efectul',
            onClick: (sel) => {
              const effect = spanFromSelection(source.body, source.id, sel, crypto.randomUUID());
              onChange({ ...draft, pairs: [...draft.pairs, { id: crypto.randomUUID(), cause: building.cause!, effect, explanation: null }] });
              setBuilding(null);
            },
          },
        ];

  const hint = !building
    ? 'Apasă „Adaugă pereche”, apoi marchează cauza și efectul.'
    : building.cause === null
      ? 'Selectează cauza în text și apasă „Marchează cauza”.'
      : 'Acum selectează efectul și apasă „Marchează efectul”.';

  const changeSpan = (s: AnswerSpan) => {
    if (building?.cause?.id === s.id) return setBuilding({ cause: s });
    onChange({
      ...draft,
      pairs: draft.pairs.map((p) => (p.cause.id === s.id ? { ...p, cause: s } : p.effect.id === s.id ? { ...p, effect: s } : p)),
    });
  };
  const removeSpan = (id: string) => {
    if (building?.cause?.id === id) return setBuilding({ cause: null });
    onChange({ ...draft, pairs: draft.pairs.filter((p) => p.cause.id !== id && p.effect.id !== id) });
  };

  return (
    <>
      <div className="form-label mb-1">Perechile cauză → efect valide</div>
      {source ? (
        <SpanMarker
          source={source}
          spans={spans}
          actions={actions}
          hint={hint}
          toneOf={(s) => (causeIds.has(s.id) ? 'cause' : 'effect')}
          onChange={changeSpan}
          onRemove={removeSpan}
        />
      ) : (
        <p className="text-secondary">Alege sursa A ca să marchezi perechile pe text.</p>
      )}
      {building && (
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="small">
            Pereche nouă: {building.cause ? <>cauza „{building.cause.text}” → efectul?</> : 'cauza?'}
          </span>
          <Button size="sm" variant="outline-secondary" onClick={() => setBuilding(null)}>Anulează perechea</Button>
        </div>
      )}
      <div className="mb-3">
        <SortableList
          items={draft.pairs}
          onChange={(pairs) => onChange({ ...draft, pairs })}
          itemName="perechea"
          addLabel="Adaugă pereche"
          addDisabled={!source || building !== null}
          onAdd={() => setBuilding({ cause: null })}
          render={(p, i) => (
            <>
              <div className="mb-2">
                <span className="rounded px-1" style={{ background: '#b8e6dc' }}>„{p.cause.text}”</span>
                <span className="mx-2" aria-label="a dus la">→</span>
                <span className="rounded px-1" style={{ background: '#ffd9c2' }}>„{p.effect.text}”</span>
              </div>
              <Form.Control
                id={`${idPrefix}-pair-${p.id}`}
                size="sm"
                aria-label={`Explicația perechii ${i + 1} (opțional)`}
                placeholder="Explicație (opțional), afișată după verificare"
                value={p.explanation ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    pairs: draft.pairs.map((x) => (x.id === p.id ? { ...x, explanation: e.target.value === '' ? null : e.target.value } : x)),
                  })
                }
              />
            </>
          )}
        />
      </div>
    </>
  );
}
