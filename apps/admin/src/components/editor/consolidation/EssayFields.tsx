'use client';

import { Form } from 'react-bootstrap';
import type { EssayRequirement } from '@prepio/shared';
import SortableList from '../cards/SortableList';
import { AiContextField, AiTemplateField } from './AiFields';
import CreditCostField from './CreditCostField';
import type { FieldsProps } from './exerciseModel';

export const MAX_REQUIREMENTS = 6;

/** 1–6 requirement cards: text, own required AI context, optional model answer and template, argumentation flag. */
export default function EssayFields({ idPrefix, draft, onChange, templates, aiTemplates }: FieldsProps<'essay'>) {
  const setRequirements = (requirements: EssayRequirement[]) => {
    // drop the context and AI template of removed requirements
    const ids = new Set(requirements.map((r) => r.id));
    const kept = Object.fromEntries(Object.entries(draft.ai.requirements).filter(([id]) => ids.has(id)));
    const keptTemplates = Object.fromEntries(Object.entries(draft.ai.requirementTemplates).filter(([id]) => ids.has(id)));
    onChange({ ...draft, requirements, ai: { ...draft.ai, requirements: kept, requirementTemplates: keptTemplates } });
  };
  const patch = (i: number, p: Partial<EssayRequirement>) =>
    setRequirements(draft.requirements.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setAiTemplate = (id: string, v: string | null) => {
    const { [id]: _removed, ...rest } = draft.ai.requirementTemplates;
    onChange({ ...draft, ai: { ...draft.ai, requirementTemplates: v ? { ...rest, [id]: v } : rest } });
  };
  const setContext = (id: string, v: string) =>
    onChange({ ...draft, ai: { ...draft.ai, requirements: { ...draft.ai.requirements, [id]: v } } });

  return (
    <>
    <CreditCostField idPrefix={idPrefix} value={draft.creditCost} requirements={draft.requirements.length} onChange={(creditCost) => onChange({ ...draft, creditCost })} />
    <fieldset className="mb-3">
      <legend className="form-label fs-6 mb-1">Cerințe ({draft.requirements.length}/{MAX_REQUIREMENTS})</legend>
      <SortableList
        items={draft.requirements}
        onChange={setRequirements}
        itemName="cerința"
        addLabel="Adaugă cerință"
        addDisabled={draft.requirements.length >= MAX_REQUIREMENTS}
        onAdd={() =>
          setRequirements([...draft.requirements, { id: crypto.randomUUID(), text: '', modelAnswer: null, templateId: null, argument: false }])
        }
        render={(r, i) => {
          const n = i + 1;
          const id = `${idPrefix}-req-${r.id}`;
          return (
            <>
              <Form.Group className="mb-2" controlId={`${id}-text`}>
                <Form.Label>Cerința {n}</Form.Label>
                <Form.Control as="textarea" rows={2} value={r.text} onChange={(e) => patch(i, { text: e.target.value })} />
              </Form.Group>
              <AiTemplateField
                controlId={`${id}-ai-template`}
                label={`Șablon AI, cerința ${n}`}
                type="essay_requirement"
                templates={aiTemplates}
                value={draft.ai.requirementTemplates[r.id] ?? null}
                onChange={(v) => setAiTemplate(r.id, v)}
              />
              <AiContextField
                controlId={`${id}-ai`}
                label={`Context pentru AI, cerința ${n}`}
                value={draft.ai.requirements[r.id] ?? ''}
                onChange={(v) => setContext(r.id, v)}
              />
              <Form.Group className="mb-2" controlId={`${id}-model`}>
                <Form.Label>Răspuns model, cerința {n} (opțional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={r.modelAnswer ?? ''}
                  onChange={(e) => patch(i, { modelAnswer: e.target.value === '' ? null : e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-2" controlId={`${id}-template`}>
                <Form.Label>Șablon de rezolvare, cerința {n} (opțional)</Form.Label>
                <Form.Select value={r.templateId ?? ''} onChange={(e) => patch(i, { templateId: e.target.value || null })}>
                  <option value="">Fără șablon</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Check
                id={`${id}-argument`}
                type="checkbox"
                label="Cerință de argumentare (verifică conectorii)"
                checked={r.argument}
                onChange={(e) => patch(i, { argument: e.target.checked })}
              />
            </>
          );
        }}
      />
    </fieldset>
    </>
  );
}
