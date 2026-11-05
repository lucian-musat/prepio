'use client';

import { useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { CONSOLIDATION_TYPES, CONSOLIDATION_TYPE_LABELS, type ConsolidationType } from '@prepio/shared';
import RichTextInput from '@/components/editor/cards/RichTextInput';
import { EmptyNote, useRunner } from '@/components/editor/common';
import type { TemplateWithUsage } from '@/lib/data/templates';
import { deleteTemplateAction, saveTemplateAction } from './actions';

function TemplateForm({ initial, onSaved, onCancel }: {
  initial?: TemplateWithUsage;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<ConsolidationType | ''>(initial?.exerciseType ?? '');
  const [points, setPoints] = useState(initial?.points ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const { run, pending, alert } = useRunner();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => saveTemplateAction({
        ...(initial ? { id: initial.id } : {}),
        title: title.trim(),
        exerciseType: type === '' ? null : type,
        points: points.trim(),
        body: body.trim(),
      }),
      onSaved,
    );
  };

  return (
    <Form onSubmit={submit}>
      {alert}
      <Form.Group className="mb-3" controlId="template-title">
        <Form.Label>Titlu</Form.Label>
        <Form.Control value={title} onChange={(e) => setTitle(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="template-type">
        <Form.Label>Tip</Form.Label>
        <Form.Select value={type} onChange={(e) => setType(e.target.value as ConsolidationType | '')}>
          <option value="">Orice tip</option>
          {CONSOLIDATION_TYPES.map((t) => (
            <option key={t} value={t}>{CONSOLIDATION_TYPE_LABELS[t]}</option>
          ))}
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3" controlId="template-points">
        <Form.Label>Punctaj la BAC</Form.Label>
        <Form.Control value={points} onChange={(e) => setPoints(e.target.value)} />
      </Form.Group>
      <RichTextInput id="template-body" label="Conținut" value={body} onChange={setBody} />
      <div className="d-flex gap-2">
        <Button type="submit" disabled={pending}>Salvează</Button>
        <Button variant="outline-secondary" disabled={pending} onClick={onCancel}>Anulează</Button>
      </div>
    </Form>
  );
}

function Row({ t, disabled, onEdit, onDelete }: {
  t: TemplateWithUsage;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="d-flex flex-wrap gap-3 align-items-start">
      <div className="flex-grow-1" style={{ minWidth: 200 }}>
        <div className="fw-semibold mb-1">{t.title}</div>
        <Badge bg="secondary" className="me-2">{t.exerciseType ? CONSOLIDATION_TYPE_LABELS[t.exerciseType] : 'Orice tip'}</Badge>
        <span className="text-secondary">Folosit în {t.usage} exerciții</span>
      </div>
      {confirming ? (
        <ButtonGroup size="sm">
          <Button variant="danger" disabled={disabled} onClick={() => { setConfirming(false); onDelete(); }}>Confirmă ștergerea</Button>
          <Button variant="outline-secondary" onClick={() => setConfirming(false)}>Anulează</Button>
        </ButtonGroup>
      ) : (
        <ButtonGroup size="sm">
          <Button variant="outline-primary" disabled={disabled} onClick={onEdit}>Editează</Button>
          <Button variant="outline-danger" disabled={disabled} onClick={() => setConfirming(true)}>Șterge</Button>
        </ButtonGroup>
      )}
    </div>
  );
}

export default function TemplatesEditor({ templates }: { templates: TemplateWithUsage[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();
  const close = () => setEditing(null);

  return (
    <>
      {alert}
      {templates.length === 0 && editing !== 'new' && <EmptyNote>Nu există șabloane încă.</EmptyNote>}
      {templates.map((t) => (
        <Card className="mb-3" key={t.id} data-testid="template-item">
          <Card.Body>
            {editing === t.id ? (
              <TemplateForm initial={t} onSaved={close} onCancel={close} />
            ) : (
              <Row t={t} disabled={pending} onEdit={() => setEditing(t.id)} onDelete={() => run(() => deleteTemplateAction(t.id))} />
            )}
          </Card.Body>
        </Card>
      ))}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <TemplateForm onSaved={close} onCancel={close} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă șablon</Button>
      )}
    </>
  );
}
