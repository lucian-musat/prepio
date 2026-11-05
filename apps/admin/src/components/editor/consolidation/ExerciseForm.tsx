'use client';

import { useId, useState, type ComponentType } from 'react';
import { Alert, Button, ButtonGroup, Form, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import {
  CONSOLIDATION_TYPES, CONSOLIDATION_TYPE_LABELS,
  type ConsolidationType, type SolutionTemplate, type Source, type SourceLabel, type SourceRef,
} from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { ExerciseInput } from '@/lib/data/consolidation';
import { ArgumentFields, ComparisonFields, FactsFields, ViewpointFields } from './AiFields';
import EssayFields from './EssayFields';
import LetterFields from './LetterFields';
import MultiAnswerFields from './MultiAnswerFields';
import PairsFields from './PairsFields';
import ShortAnswerFields from './ShortAnswerFields';
import SpansFields from './SpansFields';
import { changeType, cleanDraft, hasTypeContent, sourceName, type ExerciseDraft, type FieldsProps } from './exerciseModel';

// SpansFields serves both span types; the per-type map needs it narrowed to each one.
const SpansFor = <T extends 'source_info' | 'viewpoint'>() => SpansFields as unknown as ComponentType<FieldsProps<T>>;

/** Field groups per exercise type. */
export const FIELDS: { [T in ConsolidationType]: ComponentType<FieldsProps<T>> } = {
  short_answer: ShortAnswerFields,
  multi_answer: MultiAnswerFields,
  source_info: SpansFor<'source_info'>(),
  source_letter: LetterFields,
  cause_effect: PairsFields,
  facts: FactsFields,
  comparison: ComparisonFields,
  viewpoint: ViewpointFields,
  argument: ArgumentFields,
  essay: EssayFields,
};

const newId = () => crypto.randomUUID();

/** Ten radio toggle buttons, one per exercise type. */
export function ExerciseTypePicker({ value, onChange }: { value: ConsolidationType | null; onChange: (t: ConsolidationType) => void }) {
  const name = useId();
  return (
    <ToggleButtonGroup
      type="radio"
      name={name}
      value={value ?? undefined}
      onChange={(t: ConsolidationType) => onChange(t)}
      role="radiogroup"
      aria-label="Tipul exercițiului"
      className="flex-wrap"
    >
      {CONSOLIDATION_TYPES.map((t) => (
        <ToggleButton key={t} id={`${name}-${t}`} value={t} variant="outline-primary" size="sm">
          {CONSOLIDATION_TYPE_LABELS[t]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export default function ExerciseForm({ initial, sources, templates, errors, onSave, onCancel }: {
  initial: ExerciseDraft;
  /** The lesson's sources. */
  sources: Source[];
  templates: SolutionTemplate[];
  /** Stored validation errors of an existing exercise (e.g. detached spans). */
  errors?: string[];
  onSave: (input: ExerciseInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const [draft, setDraft] = useState<ExerciseDraft>(initial);
  const [pendingType, setPendingType] = useState<ConsolidationType | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyType = (type: ConsolidationType) => {
    setPendingType(null);
    setDraft((d) => changeType(d, type, newId));
  };
  const pickType = (type: ConsolidationType) => {
    if (type === draft.type) return setPendingType(null);
    if (hasTypeContent(draft)) setPendingType(type);
    else applyType(type);
  };

  const sourceAt = (i: number) => draft.sources[i]?.sourceId ?? '';
  const setSourceAt = (i: number, id: string) => {
    const ids = [sourceAt(0), sourceAt(1)];
    ids[i] = id;
    const refs: SourceRef[] = ids.filter((x) => x !== '').map((sourceId, j) => ({ sourceId, label: j === 0 ? 'A' : 'B' }));
    setDraft((d) => ({ ...d, sources: refs }));
  };
  const resolved = draft.sources.flatMap((r) => {
    const source = sources.find((s) => s.id === r.sourceId);
    return source ? [{ label: r.label as SourceLabel, source }] : [];
  });

  const suggested = templates.filter((t) => t.exerciseType === draft.type);
  const others = templates.filter((t) => t.exerciseType !== draft.type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setServerError(null);
    setSaving(true);
    try {
      const res = await onSave(cleanDraft(draft));
      if (!res.ok) setServerError(res.error);
    } catch {
      setServerError('Operația a eșuat. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  }

  const Fields = FIELDS[draft.type] as ComponentType<FieldsProps<ConsolidationType>>;

  return (
    <Form onSubmit={submit} noValidate data-testid="exercise-form">
      {errors && errors.length > 0 && (
        <Alert variant="warning">
          <div className="fw-semibold">Exercițiul nu e valid și nu apare elevilor:</div>
          {errors.map((m) => <div key={m}>{m}</div>)}
        </Alert>
      )}

      <div className="mb-3">
        <div className="form-label" aria-hidden>Tipul exercițiului</div>
        <ExerciseTypePicker value={draft.type} onChange={pickType} />
        {pendingType && (
          <Alert variant="warning" className="mt-2 mb-0 d-flex flex-wrap align-items-center gap-2">
            <span className="me-auto">Schimbi tipul? Câmpurile specifice tipului actual se vor pierde.</span>
            <ButtonGroup size="sm">
              <Button variant="warning" onClick={() => applyType(pendingType)}>Schimbă tipul</Button>
              <Button variant="outline-secondary" onClick={() => setPendingType(null)}>Anulează</Button>
            </ButtonGroup>
          </Alert>
        )}
      </div>

      <Form.Group className="mb-3" controlId={`${idPrefix}-prompt`}>
        <Form.Label>Enunț</Form.Label>
        <Form.Control as="textarea" rows={2} value={draft.prompt} onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))} />
      </Form.Group>

      <div className="d-flex flex-wrap gap-3 mb-3">
        {[0, 1].map((i) => (
          <Form.Group key={i} controlId={`${idPrefix}-source-${i}`} style={{ minWidth: 220, flex: '1 1 220px' }}>
            <Form.Label>Sursa {i === 0 ? 'A' : 'B'}</Form.Label>
            <Form.Select value={sourceAt(i)} disabled={i === 1 && sourceAt(0) === ''} onChange={(e) => setSourceAt(i, e.target.value)}>
              <option value="">Fără sursă</option>
              {sources
                .filter((s) => s.id !== sourceAt(1 - i))
                .map((s) => <option key={s.id} value={s.id}>{sourceName(s)}</option>)}
            </Form.Select>
          </Form.Group>
        ))}
      </div>
      {sources.length === 0 && <p className="small text-secondary">Lecția nu are surse încă. Adaugă-le în secțiunea Surse.</p>}

      <Form.Group className="mb-3" controlId={`${idPrefix}-template`}>
        <Form.Label>Șablon de rezolvare</Form.Label>
        <Form.Select value={draft.templateId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, templateId: e.target.value || null }))}>
          <option value="">Fără șablon</option>
          {suggested.length > 0 && (
            <optgroup label="Pentru acest tip">
              {suggested.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Alte șabloane">
              {others.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </optgroup>
          )}
        </Form.Select>
        {!draft.templateId && <Form.Text className="text-warning-emphasis d-block">Exercițiul nu are șablon de rezolvare.</Form.Text>}
      </Form.Group>

      <Fields key={draft.type} idPrefix={idPrefix} draft={draft} onChange={(next) => setDraft(next)} sources={resolved} templates={templates} />

      {/* the essay's model answers belong to its requirements */}
      {draft.type !== 'essay' && (
        <Form.Group className="mb-3" controlId={`${idPrefix}-model`}>
          <Form.Label>Răspuns model (opțional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={draft.modelAnswer ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, modelAnswer: e.target.value === '' ? null : e.target.value }))}
          />
        </Form.Group>
      )}
      <Form.Group className="mb-3" controlId={`${idPrefix}-explanation`}>
        <Form.Label>Explicație (opțional)</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={draft.explanation ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value === '' ? null : e.target.value }))}
        />
        <Form.Text>Arătată elevului după verificare (ex. „Caută în sursa B cuvântul…”).</Form.Text>
      </Form.Group>

      {serverError && <Alert variant="danger">{serverError}</Alert>}
      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={saving}>Salvează</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}
