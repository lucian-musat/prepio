'use client';

import { Form } from 'react-bootstrap';
import SortableList from '../cards/SortableList';
import { joinLines, splitLines, type FieldsProps } from './exerciseModel';

/** N plus the accepted groups; each group is one answer with its synonyms. */
export default function MultiAnswerFields({ idPrefix, draft, onChange }: FieldsProps<'multi_answer'>) {
  return (
    <>
      <CountField idPrefix={idPrefix} label="Câte răspunsuri se cer (N)" value={draft.count} onChange={(count) => onChange({ ...draft, count })} />
      <fieldset className="mb-3">
        <legend className="form-label fs-6 mb-1">Grupuri acceptate</legend>
        <Form.Text className="d-block mb-2">
          Fiecare grup e un răspuns cu sinonimele lui (ex. Țara Românească / Muntenia / Valahia). Pot fi mai multe grupuri decât N.
        </Form.Text>
        <SortableList
          items={draft.groups}
          onChange={(groups) => onChange({ ...draft, groups })}
          itemName="grupul"
          addLabel="Adaugă grup"
          onAdd={() => onChange({ ...draft, groups: [...draft.groups, { id: crypto.randomUUID(), variants: [] }] })}
          render={(g, i) => (
            <Form.Control
              as="textarea"
              rows={2}
              aria-label={`Variantele grupului ${i + 1} (una pe rând)`}
              placeholder={`Grupul ${i + 1}: variantele, una pe rând`}
              value={joinLines(g.variants)}
              onChange={(e) =>
                onChange({ ...draft, groups: draft.groups.map((x) => (x.id === g.id ? { ...x, variants: splitLines(e.target.value) } : x)) })
              }
            />
          )}
        />
      </fieldset>
    </>
  );
}

/** Number input for N; an empty field is kept as 0 (validation reports it). */
export function CountField({ idPrefix, label, value, onChange }: {
  idPrefix: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Form.Group className="mb-3" controlId={`${idPrefix}-count`} style={{ maxWidth: 260 }}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        type="number"
        min={1}
        step={1}
        value={Number.isFinite(value) && value > 0 ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Math.trunc(Number(e.target.value)))}
      />
    </Form.Group>
  );
}
