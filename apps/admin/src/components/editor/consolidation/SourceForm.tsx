'use client';

import { useId, useState } from 'react';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import type { Source } from '@prepio/shared';
import { previewSourceImpact, saveSource } from '@/app/(admin)/lessons/[id]/actions';
import type { SourceImpact } from '@/lib/data/consolidation';

const FAILED = 'Operația a eșuat. Încearcă din nou.';

/**
 * Add / edit a source. Saving an edited text first asks for the impact: marked answers that would no
 * longer be found are listed and the save needs a confirmation (they get flagged in their exercises).
 */
export default function SourceForm({ lessonId, initial, onDone, onCancel }: {
  lessonId: string;
  initial?: Source;
  onDone: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [work, setWork] = useState(initial?.work ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [impact, setImpact] = useState<SourceImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const busy = async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(FAILED);
    } finally {
      setSaving(false);
    }
  };

  const doSave = async () => {
    const res = await saveSource(lessonId, { ...(initial ? { id: initial.id } : {}), title: title || null, author, work, body });
    if (res.ok) onDone();
    else setError(res.error);
  };
  const save = () => busy(doSave);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setImpact(null);
    if (!initial || body === initial.body) return void save();
    void busy(async () => {
      const res = await previewSourceImpact(initial.id, body);
      if (!res.ok) return setError(res.error);
      const list = res.data ?? [];
      if (list.length) setImpact(list);
      else await doSave();
    });
  };

  return (
    <Form onSubmit={submit} noValidate data-testid="source-form">
      <div className="d-flex flex-wrap gap-3">
        <Form.Group className="mb-3" controlId={`${id}-title`} style={{ flex: '1 1 220px' }}>
          <Form.Label>Titlu (opțional)</Form.Label>
          <Form.Control value={title} onChange={(e) => setTitle(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3" controlId={`${id}-author`} style={{ flex: '1 1 180px' }}>
          <Form.Label>Autor</Form.Label>
          <Form.Control value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3" controlId={`${id}-work`} style={{ flex: '1 1 220px' }}>
          <Form.Label>Lucrare</Form.Label>
          <Form.Control value={work} onChange={(e) => setWork(e.target.value)} />
        </Form.Group>
      </div>
      <Form.Group className="mb-3" controlId={`${id}-body`}>
        <Form.Label>Text</Form.Label>
        <Form.Control as="textarea" rows={8} value={body} onChange={(e) => { setBody(e.target.value); setImpact(null); }} />
        <Form.Text>Paragrafele se despart printr-un rând gol. „[...]” marchează omisiunile.</Form.Text>
      </Form.Group>

      {impact && (
        <Alert variant="warning">
          <div className="fw-semibold mb-1">Aceste răspunsuri marcate nu se mai găsesc în textul nou:</div>
          <ul className="mb-2 ps-3">
            {impact.map((x) => (
              <li key={x.exerciseId}>
                {x.prompt || 'Exercițiu fără enunț'}: {x.detached.map((t) => `„${t}”`).join(', ')}
              </li>
            ))}
          </ul>
          <div className="mb-2 small">Exercițiile afectate vor fi marcate invalide până le corectezi.</div>
          <ButtonGroup size="sm">
            <Button variant="warning" disabled={saving} onClick={() => void save()}>Salvează oricum</Button>
            <Button variant="outline-secondary" onClick={() => setImpact(null)}>Anulează</Button>
          </ButtonGroup>
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={saving}>Salvează sursa</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}
