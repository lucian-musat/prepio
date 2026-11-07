'use client';

import { useState } from 'react';
import { Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { AI_TEMPLATE_TYPES, AI_TEMPLATE_TYPE_LABELS, type AiTemplateType } from '@prepio/shared';
import { EmptyNote, useRunner } from '@/components/editor/common';
import { plural } from '@/components/editor/consolidation/plural';
import type { AiTemplateWithUsage } from '@/lib/data/aiTemplates';
import { deleteAiTemplateAction, saveAiTemplateAction } from './actions';

function AiTemplateForm({ initial, onSaved, onCancel }: {
  initial?: AiTemplateWithUsage;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<AiTemplateType>(initial?.type ?? AI_TEMPLATE_TYPES[0]!);
  const [criteria, setCriteria] = useState(initial?.criteria ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords ?? '');
  const [responseFormat, setResponseFormat] = useState(initial?.responseFormat ?? '');
  const { run, pending, alert } = useRunner();
  const typeLocked = (initial?.usage ?? 0) > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => saveAiTemplateAction({
        ...(initial ? { id: initial.id } : {}),
        title: title.trim(),
        type,
        criteria: criteria.trim(),
        keywords: keywords.trim(),
        responseFormat: responseFormat.trim(),
      }),
      onSaved,
    );
  };

  return (
    <Form onSubmit={submit}>
      {alert}
      <Form.Group className="mb-3" controlId="ai-template-title">
        <Form.Label>Titlu</Form.Label>
        <Form.Control value={title} onChange={(e) => setTitle(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="ai-template-type">
        <Form.Label>Tip</Form.Label>
        <Form.Select value={type} disabled={typeLocked} onChange={(e) => setType(e.target.value as AiTemplateType)}>
          {AI_TEMPLATE_TYPES.map((t) => (
            <option key={t} value={t}>{AI_TEMPLATE_TYPE_LABELS[t]}</option>
          ))}
        </Form.Select>
        {typeLocked && <Form.Text muted>Tipul nu se poate schimba cât timp șablonul este folosit.</Form.Text>}
      </Form.Group>
      <Form.Group className="mb-3" controlId="ai-template-criteria">
        <Form.Label>Ce urmărește AI-ul în răspuns</Form.Label>
        <Form.Control as="textarea" rows={5} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="ai-template-keywords">
        <Form.Label>Cuvinte cheie</Form.Label>
        <Form.Control as="textarea" rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="ai-template-format">
        <Form.Label>Cum formulează răspunsul</Form.Label>
        <Form.Control as="textarea" rows={3} value={responseFormat} onChange={(e) => setResponseFormat(e.target.value)} />
      </Form.Group>
      <div className="d-flex gap-2">
        <Button type="submit" disabled={pending}>Salvează</Button>
        <Button variant="outline-secondary" disabled={pending} onClick={onCancel}>Anulează</Button>
      </div>
    </Form>
  );
}

function Row({ t, disabled, onEdit, onDelete }: {
  t: AiTemplateWithUsage;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="d-flex flex-wrap gap-3 align-items-start">
      <div className="flex-grow-1" style={{ minWidth: 200 }}>
        <div className="fw-semibold mb-1">{t.title}</div>
        <span className="text-secondary">Folosit în {plural(t.usage, 'exercițiu', 'exerciții')}</span>
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

export default function AiTemplatesEditor({ templates }: { templates: AiTemplateWithUsage[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();
  const close = () => setEditing(null);

  return (
    <>
      {alert}
      {templates.length === 0 && editing !== 'new' && <EmptyNote>Nu există șabloane AI încă.</EmptyNote>}
      {AI_TEMPLATE_TYPES.map((type) => {
        const group = templates.filter((t) => t.type === type);
        if (group.length === 0) return null;
        return (
          <section key={type} className="mb-4">
            <h2 className="h5 mb-3">{AI_TEMPLATE_TYPE_LABELS[type]}</h2>
            {group.map((t) => (
              <Card className="mb-3" key={t.id} data-testid="ai-template-item">
                <Card.Body>
                  {editing === t.id ? (
                    <AiTemplateForm initial={t} onSaved={close} onCancel={close} />
                  ) : (
                    <Row t={t} disabled={pending} onEdit={() => setEditing(t.id)} onDelete={() => run(() => deleteAiTemplateAction(t.id))} />
                  )}
                </Card.Body>
              </Card>
            ))}
          </section>
        );
      })}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <AiTemplateForm onSaved={close} onCancel={close} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă șablon AI</Button>
      )}
    </>
  );
}
