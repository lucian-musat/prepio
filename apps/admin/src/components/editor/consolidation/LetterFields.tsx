'use client';

import { Form } from 'react-bootstrap';
import type { SourceLabel } from '@prepio/shared';
import SpanMarker from './SpanMarker';
import { spanFromSelection } from './selection';
import type { FieldsProps } from './exerciseModel';

/** The correct letter and the optional evidence marked in the correct source. */
export default function LetterFields({ idPrefix, draft, onChange, sources }: FieldsProps<'source_letter'>) {
  const correct = sources.find((s) => s.label === draft.correct)?.source;

  const setCorrect = (label: SourceLabel) => {
    const id = sources.find((s) => s.label === label)?.source.id;
    // evidence must come from the correct source
    onChange({ ...draft, correct: label, evidence: draft.evidence && draft.evidence.sourceId === id ? draft.evidence : null });
  };

  return (
    <>
      <fieldset className="mb-3">
        <legend className="form-label fs-6 mb-1">Litera corectă</legend>
        {(['A', 'B'] as const).map((l) => (
          <Form.Check
            key={l}
            inline
            type="radio"
            id={`${idPrefix}-correct-${l}`}
            name={`${idPrefix}-correct`}
            label={`Sursa ${l}`}
            checked={draft.correct === l}
            onChange={() => setCorrect(l)}
          />
        ))}
      </fieldset>
      <div className="form-label mb-1">Fragmentul-dovadă (opțional), din sursa {draft.correct}</div>
      {correct ? (
        <SpanMarker
          source={correct}
          spans={draft.evidence ? [draft.evidence] : []}
          actions={[
            {
              label: 'Marchează fragmentul-dovadă',
              onClick: (sel) => onChange({ ...draft, evidence: spanFromSelection(correct.body, correct.id, sel, crypto.randomUUID()) }),
            },
          ]}
          hint={draft.evidence ? 'Un fragment nou îl înlocuiește pe cel existent.' : undefined}
          onChange={(s) => onChange({ ...draft, evidence: s })}
          onRemove={() => onChange({ ...draft, evidence: null })}
        />
      ) : (
        <p className="text-secondary">Alege sursa {draft.correct} ca să marchezi fragmentul-dovadă.</p>
      )}
    </>
  );
}
