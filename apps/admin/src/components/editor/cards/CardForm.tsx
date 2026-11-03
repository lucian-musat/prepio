'use client';

import { useId, useState, type ComponentType, type ReactNode } from 'react';
import { Alert, Button, ButtonGroup, Col, Form, Row } from 'react-bootstrap';
import { emptyCardContent, validateCard, type Card, type CardType } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { CardInput } from '@/lib/data/lesson';
import ImagesFields from './ImagesFields';
import TextFields from './TextFields';
import TypePicker from './TypePicker';

export type CardDraft<T extends CardType = CardType> = Extract<CardInput, { type: T }>;

/** Props of a type's field group. `onChange` also takes an updater, for async results (uploads). */
export type FieldsProps<T extends CardType> = {
  lessonId: string;
  /** Unique per form; prefix for element ids. */
  idPrefix: string;
  draft: CardDraft<T>;
  onChange: (next: CardDraft<T> | ((current: CardDraft<T>) => CardDraft<T>)) => void;
};

/** Field groups per card type; types without an entry show a placeholder. */
export const FIELDS: { [T in CardType]?: ComponentType<FieldsProps<T>> } = {
  text: TextFields,
  images: ImagesFields,
};

const newId = () => crypto.randomUUID();

// Key-sorted, id-free form of a value, so drafts compare with fresh empty content.
const normalize = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(normalize)
    : v !== null && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v).filter(([k]) => k !== 'id').sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)]),
        )
      : v;

/** True when the draft's type-specific fields differ from that type's empty content. */
export function hasTypeContent(draft: CardInput): boolean {
  const content: Record<string, unknown> = { ...draft };
  delete content.title;
  return JSON.stringify(normalize(content)) !== JSON.stringify(normalize(emptyCardContent(draft.type, newId)));
}

function toInput(card: Card): CardInput {
  const input: Partial<Card> = { ...card };
  delete input.position;
  return input as CardInput;
}

export default function CardForm({ lessonId, initial, onSave, onCancel, preview }: {
  lessonId: string;
  initial?: Card;
  onSave: (c: CardInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
  preview?: (draft: CardInput) => ReactNode;
}) {
  const idPrefix = useId();
  const [draft, setDraft] = useState<CardInput>(() =>
    initial ? toInput(initial) : { title: null, ...emptyCardContent('text', newId) } as CardInput,
  );
  const [pendingType, setPendingType] = useState<CardType | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const errors = attempted ? validateCard(draft) : [];

  const applyType = (type: CardType) => {
    setPendingType(null);
    setDraft((d) => ({ ...(d.id ? { id: d.id } : {}), title: d.title, ...emptyCardContent(type, newId) }) as CardInput);
  };
  const pickType = (type: CardType) => {
    if (type === draft.type) return setPendingType(null);
    if (hasTypeContent(draft)) setPendingType(type);
    else applyType(type);
  };

  // Updaters are dropped if the type changed in the meantime (e.g. an upload finishing after a switch).
  const type = draft.type;
  const onFieldsChange = (next: CardInput | ((current: CardInput) => CardInput)) =>
    setDraft((d) => (typeof next === 'function' ? (d.type === type ? next(d) : d) : next));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (validateCard(draft).length) return;
    setSaving(true);
    try {
      const res = await onSave(draft);
      if (!res.ok) setServerError(res.error);
    } catch {
      setServerError('Operația a eșuat. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  }

  const Fields = FIELDS[draft.type] as ComponentType<FieldsProps<CardType>> | undefined;

  return (
    <Form onSubmit={submit} noValidate data-testid="card-form">
      <Row className="g-4">
        <Col lg={preview ? 6 : 12}>
          {errors.length > 0 && (
            <Alert variant="danger">
              {errors.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </Alert>
          )}
          {serverError && <Alert variant="danger">{serverError}</Alert>}

          <Form.Group className="mb-3" controlId={`${idPrefix}-title`}>
            <Form.Label>Titlu (opțional)</Form.Label>
            <Form.Control
              value={draft.title ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value === '' ? null : e.target.value }))}
            />
          </Form.Group>

          <div className="mb-3">
            <div className="form-label" aria-hidden>Tipul cardului</div>
            <TypePicker value={draft.type} onChange={pickType} />
            {pendingType && (
              <Alert variant="warning" className="mt-2 mb-0 d-flex flex-wrap align-items-center gap-2">
                <span className="me-auto">Schimbi tipul? Conținutul specific tipului actual se va pierde.</span>
                <ButtonGroup size="sm">
                  <Button variant="warning" onClick={() => applyType(pendingType)}>Schimbă tipul</Button>
                  <Button variant="outline-secondary" onClick={() => setPendingType(null)}>Anulează</Button>
                </ButtonGroup>
              </Alert>
            )}
          </div>

          {Fields ? (
            <Fields key={draft.type} lessonId={lessonId} idPrefix={idPrefix} draft={draft} onChange={onFieldsChange} />
          ) : (
            <p className="text-secondary">Câmpurile pentru acest tip vin în curând.</p>
          )}

          <ButtonGroup>
            <Button type="submit" variant="primary" disabled={saving}>Salvează</Button>
            <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>Anulează</Button>
          </ButtonGroup>
        </Col>
        {preview && <Col lg={6}>{preview(draft)}</Col>}
      </Row>
    </Form>
  );
}
