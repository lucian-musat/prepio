'use client';

import Link from 'next/link';
import { useId, useState, type ComponentType } from 'react';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import type { BacBarem, BacSection, ConsolidationType, SolutionTemplate, SourceLabel, SourceRef } from '@prepio/shared';
import { saveBacItem } from '@/app/(admin)/bac/actions';
import { FIELDS, ExerciseTypePicker } from '@/components/editor/consolidation/ExerciseForm';
import {
  changeType, cleanDraft, hasTypeContent, sourceName, type ExerciseDraft, type FieldsProps,
} from '@/components/editor/consolidation/exerciseModel';
import type { BacItemInput, BacSource } from '@/lib/data/bac';
import BaremFields from './BaremFields';
import EssayBaremFields from './EssayBaremFields';
import { baremToDraft, draftToBarem, type BaremDraft } from './baremModel';

const newId = () => crypto.randomUUID();
const FAILED = 'Operația a eșuat. Încearcă din nou.';
export const sectionLetter = (i: number) => String.fromCharCode(65 + i);

/**
 * One BAC requirement: the consolidation type fields (without credit cost and AI fields), its points,
 * the required „Cum rezolv” template and its barem.
 */
export default function BacItemForm({ subjectId, section, sources, templates, initial, initialPoints, initialBarem, errors, onDone, onCancel }: {
  subjectId: string;
  section: BacSection;
  /** The section's sources, in order (A, B, …). */
  sources: BacSource[];
  templates: SolutionTemplate[];
  initial: ExerciseDraft;
  initialPoints: number | null;
  initialBarem?: BacBarem;
  /** Stored validation errors of an existing item. */
  errors?: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const [draft, setDraft] = useState<ExerciseDraft>(initial);
  const [points, setPoints] = useState(initialPoints === null ? '' : String(initialPoints));
  const [barem, setBarem] = useState<BaremDraft>(() => baremToDraft(initialBarem));
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
  const optionName = (id: string) => {
    const i = sources.findIndex((s) => s.id === id);
    return `${sectionLetter(i)}. ${sourceName(sources[i]!)}`;
  };

  const suggested = templates.filter((t) => t.exerciseType === draft.type);
  const others = templates.filter((t) => t.exerciseType !== draft.type);
  const pointsNumber = /^\s*\d+\s*$/.test(points) ? Number(points) : Number.NaN;
  const requirementIds = draft.type === 'essay' ? draft.requirements.map((r) => r.id) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setServerError(null);
    const built = draftToBarem(barem, pointsNumber, requirementIds);
    if ('error' in built) return setServerError(built.error);
    const { ai: _ai, ...exercise } = cleanDraft(draft);
    setSaving(true);
    try {
      const res = await saveBacItem(subjectId, section, { ...exercise, points: pointsNumber } as BacItemInput, built.barem);
      if (res.ok) onDone();
      else setServerError(res.error);
    } catch {
      setServerError(FAILED);
    } finally {
      setSaving(false);
    }
  }

  const Fields = FIELDS[draft.type] as ComponentType<FieldsProps<ConsolidationType>>;

  return (
    <Form onSubmit={submit} noValidate data-testid="bac-item-form">
      {errors && errors.length > 0 && (
        <Alert variant="warning">
          <div className="fw-semibold">Cerința nu e validă; subiectul nu poate fi publicat:</div>
          {errors.map((m) => <div key={m}>{m}</div>)}
        </Alert>
      )}

      <div className="mb-3">
        <div className="form-label" aria-hidden>Tipul cerinței</div>
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
            <Form.Label>Sursa {i === 0 ? 'A' : 'B'} a cerinței</Form.Label>
            <Form.Select value={sourceAt(i)} disabled={i === 1 && sourceAt(0) === ''} onChange={(e) => setSourceAt(i, e.target.value)}>
              <option value="">Fără sursă</option>
              {sources
                .filter((s) => s.id !== sourceAt(1 - i))
                .map((s) => <option key={s.id} value={s.id}>{optionName(s.id)}</option>)}
            </Form.Select>
          </Form.Group>
        ))}
      </div>
      {sources.length === 0 && <p className="small text-secondary">Secțiunea nu are surse încă. Adaugă-le mai sus.</p>}

      <Fields key={draft.type} idPrefix={idPrefix} draft={draft} onChange={(next) => setDraft(next)} sources={resolved} templates={templates} aiTemplates={[]} bac />

      <div className="d-flex flex-wrap gap-3">
        <Form.Group className="mb-3" controlId={`${idPrefix}-points`} style={{ width: 160 }}>
          <Form.Label>Punctaj</Form.Label>
          <Form.Control type="number" min={1} max={30} value={points} onChange={(e) => setPoints(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3" controlId={`${idPrefix}-template`} style={{ minWidth: 240, flex: '1 1 240px' }}>
          <Form.Label>Cum rezolv</Form.Label>
          <Form.Select value={draft.templateId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, templateId: e.target.value || null }))}>
            <option value="">Alege un „Cum rezolv”</option>
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
          <Form.Text className="d-block">
            <Link href="/templates">Gestionează șabloanele</Link>
          </Form.Text>
        </Form.Group>
      </div>

      {draft.type === 'essay' ? (
        <EssayBaremFields idPrefix={idPrefix} requirements={draft.requirements} points={pointsNumber} draft={barem} onChange={setBarem} />
      ) : (
        <BaremFields idPrefix={idPrefix} points={pointsNumber} draft={barem} onChange={(r) => setBarem((b) => ({ ...b, ...r }))} />
      )}

      {serverError && <Alert variant="danger" style={{ whiteSpace: 'pre-line' }}>{serverError}</Alert>}
      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={saving}>Salvează</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}
