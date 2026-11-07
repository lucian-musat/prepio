'use client';

import Link from 'next/link';
import { Form } from 'react-bootstrap';
import { AI_TEMPLATE_TYPE_LABELS, type AiTemplate, type AiTemplateType } from '@prepio/shared';
import { CountField } from './MultiAnswerFields';
import CreditCostField from './CreditCostField';
import SpansFields from './SpansFields';
import type { FieldsProps } from './exerciseModel';

export const AI_CONTEXT_HELP =
  'Faptele pe care AI-ul le folosește la verificare: perioada, ani, fapte/argumente acceptate, greșeli frecvente de conținut. Instrucțiunile de tip stau în șablonul AI. Elevul nu vede acest text.';

/** The required AI instruction template of an exercise (or essay requirement): only templates of `type`. */
export function AiTemplateField({ controlId, label = 'Șablon AI', type, templates, value, onChange }: {
  controlId: string;
  label?: string;
  type: AiTemplateType;
  templates: AiTemplate[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Form.Group className="mb-3" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <Form.Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Alege un șablon AI</option>
        {templates.filter((t) => t.type === type).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </Form.Select>
      <Form.Text className="d-block">
        <Link href="/ai-templates">Gestionează șabloanele AI</Link>
      </Form.Text>
    </Form.Group>
  );
}

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

function MainContext({ idPrefix, draft, onChange, aiTemplates }: Pick<FieldsProps<AiType>, 'idPrefix' | 'draft' | 'onChange' | 'aiTemplates'>) {
  return (
    <>
      <CreditCostField idPrefix={idPrefix} value={draft.creditCost} onChange={(creditCost) => onChange({ ...draft, creditCost })} />
      <AiTemplateField
        controlId={`${idPrefix}-ai-template`}
        type={draft.type}
        templates={aiTemplates}
        value={draft.ai.templateId}
        onChange={(templateId) => onChange({ ...draft, ai: { ...draft.ai, templateId } })}
      />
      <AiContextField
        controlId={`${idPrefix}-ai-main`}
        value={draft.ai.main}
        onChange={(main) => onChange({ ...draft, ai: { ...draft.ai, main } })}
      />
    </>
  );
}

type AnyOnChange = FieldsProps<AiType>['onChange'];

export function FactsFields({ idPrefix, draft, onChange, aiTemplates }: FieldsProps<'facts'>) {
  return (
    <>
      <CountField idPrefix={idPrefix} label="Câte fapte se cer (N)" value={draft.count} onChange={(count) => onChange({ ...draft, count })} />
      <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} aiTemplates={aiTemplates} />
    </>
  );
}

export function ComparisonFields({ idPrefix, draft, onChange, aiTemplates }: FieldsProps<'comparison'>) {
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
      <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} aiTemplates={aiTemplates} />
    </>
  );
}

export function ViewpointFields(props: FieldsProps<'viewpoint'>) {
  return (
    <>
      <SpansFields {...(props as unknown as FieldsProps<'source_info' | 'viewpoint'>)} />
      <MainContext idPrefix={props.idPrefix} draft={props.draft} onChange={props.onChange as AnyOnChange} aiTemplates={props.aiTemplates} />
    </>
  );
}

/** „Argumentare”: the statement to argue is the prompt, so only the context is needed. */
export function ArgumentFields({ idPrefix, draft, onChange, aiTemplates }: FieldsProps<'argument'>) {
  return <MainContext idPrefix={idPrefix} draft={draft} onChange={onChange as AnyOnChange} aiTemplates={aiTemplates} />;
}
