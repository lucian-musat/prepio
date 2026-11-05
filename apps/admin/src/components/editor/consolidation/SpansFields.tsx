'use client';

import type { AnswerSpan } from '@prepio/shared';
import { CountField } from './MultiAnswerFields';
import SpanMarker from './SpanMarker';
import type { FieldsProps } from './exerciseModel';

/** N plus the answer spans marked on the exercise's source. Shared by „Informație din sursă” and „Punct de vedere”. */
export default function SpansFields({ idPrefix, draft, onChange, sources }: FieldsProps<'source_info' | 'viewpoint'>) {
  const source = sources[0]?.source;
  const setSpans = (spans: AnswerSpan[]) => onChange({ ...draft, spans });
  return (
    <>
      <CountField idPrefix={idPrefix} label="Câte informații se cer (N)" value={draft.count} onChange={(count) => onChange({ ...draft, count })} />
      <div className="form-label mb-1">
        {draft.type === 'viewpoint' ? 'Informațiile-suport valide' : 'Informațiile corecte'} ({draft.spans.length} marcate)
      </div>
      {source ? (
        <SpanMarker
          source={source}
          spans={draft.spans}
          toneOf={() => (draft.type === 'viewpoint' ? 'support' : 'info')}
          onAdd={(s) => setSpans([...draft.spans, s])}
          onChange={(s) => setSpans(draft.spans.map((x) => (x.id === s.id ? s : x)))}
          onRemove={(id) => setSpans(draft.spans.filter((x) => x.id !== id))}
        />
      ) : (
        <p className="text-secondary">Alege sursa A ca să marchezi răspunsurile pe text.</p>
      )}
    </>
  );
}
