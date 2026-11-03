'use client';

import { Form } from 'react-bootstrap';
import type { SchemaBox } from '@prepio/shared';
import type { FieldsProps } from './CardForm';
import SortableList from './SortableList';

const orNull = (s: string) => (s === '' ? null : s);
const newId = () => crypto.randomUUID();

function BoxInputs({ idPrefix, box, onChange }: { idPrefix: string; box: SchemaBox; onChange: (b: SchemaBox) => void }) {
  return (
    <>
      <Form.Group className="mb-2" controlId={`${idPrefix}-text`}>
        <Form.Label className="small mb-1">Text</Form.Label>
        <Form.Control size="sm" value={box.text} onChange={(e) => onChange({ ...box, text: e.target.value })} />
      </Form.Group>
      <Form.Group controlId={`${idPrefix}-detail`}>
        <Form.Label className="small mb-1">Detaliu (opțional)</Form.Label>
        <Form.Control
          size="sm"
          as="textarea"
          rows={2}
          value={box.detail ?? ''}
          onChange={(e) => onChange({ ...box, detail: orNull(e.target.value) })}
        />
      </Form.Group>
    </>
  );
}

export default function SchemaFields({ idPrefix, draft, onChange }: FieldsProps<'schema'>) {
  const side = (
    key: 'causes' | 'consequences',
    labelKey: 'causesLabel' | 'consequencesLabel',
    itemName: string,
    addLabel: string,
    heading: string,
  ) => (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">{heading}</legend>
      <Form.Group className="mb-2" controlId={`${idPrefix}-${key}-label`}>
        <Form.Label className="small mb-1">Etichetă secțiune ({heading})</Form.Label>
        <Form.Control size="sm" value={draft[labelKey]} onChange={(e) => onChange({ ...draft, [labelKey]: e.target.value })} />
      </Form.Group>
      <SortableList
        items={draft[key]}
        onChange={(next) => onChange({ ...draft, [key]: next })}
        itemName={itemName}
        addLabel={addLabel}
        onAdd={() => onChange({ ...draft, [key]: [...draft[key], { id: newId(), text: '', detail: null }] })}
        render={(box, i) => (
          <BoxInputs
            idPrefix={`${idPrefix}-${key}-${i}`}
            box={box}
            onChange={(b) => onChange({ ...draft, [key]: draft[key].map((x, j) => (j === i ? b : x)) })}
          />
        )}
      />
    </fieldset>
  );
  return (
    <>
      {side('causes', 'causesLabel', 'cauza', '+ Adaugă cauză', 'Cauze')}
      <fieldset className="mb-3">
        <legend className="fs-6 fw-semibold">Eveniment central</legend>
        <BoxInputs idPrefix={`${idPrefix}-central`} box={draft.central} onChange={(central) => onChange({ ...draft, central })} />
      </fieldset>
      {side('consequences', 'consequencesLabel', 'urmarea', '+ Adaugă urmare', 'Urmări')}
    </>
  );
}
