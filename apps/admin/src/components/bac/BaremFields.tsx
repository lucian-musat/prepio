'use client';

import { Form } from 'react-bootstrap';
import type { RuleDraft } from './baremModel';

/** „Barem” (the transcribed portion) and „Trepte de punctaj” of one rule. */
export default function BaremFields({ idPrefix, label = 'Barem', stepsLabel = 'Trepte de punctaj', withSteps = true, points, draft, onChange }: {
  idPrefix: string;
  label?: string;
  stepsLabel?: string;
  /** False for the essay's general text (the essay is scored per requirement). */
  withSteps?: boolean;
  /** The rule's maximum, for the help text. */
  points: number;
  draft: RuleDraft;
  onChange: (next: RuleDraft) => void;
}) {
  return (
    <>
      <Form.Group className="mb-2" controlId={`${idPrefix}-barem`}>
        <Form.Label>{label}</Form.Label>
        <Form.Control as="textarea" rows={3} value={draft.text} onChange={(e) => onChange({ ...draft, text: e.target.value })} />
        <Form.Text>Textul din barem, transcris. Elevul nu îl vede.</Form.Text>
      </Form.Group>
      {withSteps && (
        <Form.Group className="mb-3" controlId={`${idPrefix}-steps`} style={{ maxWidth: 360 }}>
          <Form.Label>{stepsLabel}</Form.Label>
          <Form.Control value={draft.steps} placeholder="ex. 0, 7, 10" onChange={(e) => onChange({ ...draft, steps: e.target.value })} />
          <Form.Text>
            Punctajele permise, separate prin virgulă. Gol = orice punctaj întreg de la 0 la {Number.isFinite(points) ? points : 'punctaj'}.
          </Form.Text>
        </Form.Group>
      )}
    </>
  );
}
