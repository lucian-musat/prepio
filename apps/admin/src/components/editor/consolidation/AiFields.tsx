'use client';

import { Form } from 'react-bootstrap';
import { CountField } from './MultiAnswerFields';
import SpansFields from './SpansFields';
import type { FieldsProps } from './exerciseModel';

export const AI_CONTEXT_HELP =
  'Ce trebuie să știe AI-ul ca să dea feedback corect: perioada, tema, faptele/argumentele acceptate, greșeli frecvente. Elevul nu vede acest text.';

/** The required „Context pentru AI” textarea. */
export function AiContextField({ controlId, label = 'Context pentru AI', value, onChange }: {
  controlId: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Form.Group className="mb-3" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <Form.Control as="textarea" rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      <Form.Text>{AI_CONTEXT_HELP}</Form.Text>
    </Form.Group>
  );
}

type AiType = 'facts' | 'comparison' | 'viewpoint' | 'argument';

function MainContext({ idPrefix, draft, onChange }: Pick<FieldsProps<AiType>, 'idPrefix' | 'draft' | 'onChange'>) {
  return (
    <AiContextField
      controlId={`${idPrefix}-ai-main`}
      value={draft.ai.main}
      onChange={(main) => onChange({ ...draft, ai: { ...draft.ai, main } })}
    />
  );
}

type AnyOnChange = FieldsProps<AiType>['onChange'];

export function FactsFields({ idPrefix, draft, onChange }: FieldsProps<'facts'>) {
  return (
    <>
      <CountField idPrefix={idPrefix} label="Câte fapte se cer (N)" value={draft.count} onChange={(count) => onChange({ ...draft, count })} />
      <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} />
    </>
  );
}

export function ComparisonFields({ idPrefix, draft, onChange }: FieldsProps<'comparison'>) {
  return (
    <>
      <fieldset className="mb-3">
        <legend className="form-label fs-6 mb-1">Cerința</legend>
        {([['similarity', 'Asemănare'], ['difference', 'Deosebire']] as const).map(([variant, label]) => (
          <Form.Check
            key={variant}
            inline
            type="radio"
            name={`${idPrefix}-variant`}
            id={`${idPrefix}-variant-${variant}`}
            label={label}
            checked={draft.variant === variant}
            onChange={() => onChange({ ...draft, variant })}
          />
        ))}
      </fieldset>
      <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} />
    </>
  );
}

export function ViewpointFields(props: FieldsProps<'viewpoint'>) {
  return (
    <>
      <SpansFields {...(props as unknown as FieldsProps<'source_info' | 'viewpoint'>)} />
      <MainContext idPrefix={props.idPrefix} draft={props.draft} onChange={props.onChange as AnyOnChange} />
    </>
  );
}

/** „Argumentare”: the statement to argue is the prompt, so only the context is needed. */
export function ArgumentFields({ idPrefix, draft, onChange }: FieldsProps<'argument'>) {
  return <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} />;
}
