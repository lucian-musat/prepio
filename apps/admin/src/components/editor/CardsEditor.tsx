'use client';

import { useRef, useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { deleteItem, moveItem, saveCard, uploadCardImage } from '@/app/(admin)/lessons/[id]/actions';
import type { ActionResult } from '@/lib/actionResult';
import type { EditorCard } from '@/lib/data/lesson';
import { EmptyNote, ItemControls, publicImageUrl, useRunner } from './common';

function CardForm({ lessonId, initial, onSave, onCancel }: {
  lessonId: string;
  initial?: EditorCard;
  onSave: (c: { id?: string; title: string; body: string; image_path: string | null; image_credit: string }) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);
  const [credit, setCredit] = useState(initial?.image_credit ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadCardImage(lessonId, fd);
      if (res.ok && res.data) setImagePath(res.data.path);
      else if (!res.ok) setError(res.error);
    } catch {
      setError('Încărcarea imaginii a eșuat. Încearcă din nou.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError('Textul cartonașului nu poate fi gol.');
    setBusy(true);
    setError(null);
    try {
      const res = await onSave({ id: initial?.id, title, body, image_path: imagePath, image_credit: imagePath ? credit : '' });
      if (!res.ok) setError(res.error);
    } catch {
      setError('Operația a eșuat. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit} noValidate data-testid="card-form">
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3" controlId="card-title">
        <Form.Label>Titlu (opțional)</Form.Label>
        <Form.Control value={title} onChange={(e) => setTitle(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="card-body">
        <Form.Label>Text</Form.Label>
        <Form.Control as="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        <Form.Text>Text simplu; paragrafele se despart printr-un rând gol.</Form.Text>
      </Form.Group>
      <div className="mb-3">
        <Form.Label htmlFor="card-image">Imagine (JPEG, PNG sau WebP, max. 5 MB)</Form.Label>
        {imagePath && (
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicImageUrl(imagePath)} alt="Previzualizare imagine" className="img-thumbnail" style={{ maxHeight: 200 }} />
          </div>
        )}
        <Form.Control
          id="card-image"
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => pick((e.target as HTMLInputElement).files?.[0])}
        />
        {imagePath && (
          <Button variant="outline-danger" size="sm" className="mt-2" onClick={() => { setImagePath(null); setCredit(''); }}>
            Elimină imaginea
          </Button>
        )}
      </div>
      {imagePath && (
        <Form.Group className="mb-3" controlId="card-credit">
          <Form.Label>Sursa / creditul imaginii</Form.Label>
          <Form.Control value={credit} onChange={(e) => setCredit(e.target.value)} />
        </Form.Group>
      )}
      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={busy}>Salvează</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}

export default function CardsEditor({ lessonId, cards }: { lessonId: string; cards: EditorCard[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();

  const save = async (c: { id?: string; title: string; body: string; image_path: string | null; image_credit: string }) => {
    const res = await saveCard(lessonId, c);
    if (res.ok) setEditing(null);
    return res;
  };

  return (
    <>
      {alert}
      {cards.length === 0 && editing !== 'new' && <EmptyNote>Nu există carduri încă.</EmptyNote>}
      {cards.map((c, i) => (
        <Card className="mb-3" key={c.id} data-testid="card-item">
          <Card.Body>
            {editing === c.id ? (
              <CardForm lessonId={lessonId} initial={c} onSave={save} onCancel={() => setEditing(null)} />
            ) : (
              <div className="d-flex flex-wrap gap-3 align-items-start">
                {c.image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={publicImageUrl(c.image_path)} alt="" className="rounded" style={{ width: 96, height: 96, objectFit: 'cover' }} />
                )}
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <Card.Title as="h3" className="h6">{c.title || `Card ${i + 1}`}</Card.Title>
                  <Card.Text className="text-secondary mb-0" style={{ whiteSpace: 'pre-line' }}>
                    {c.body.length > 200 ? `${c.body.slice(0, 200)}…` : c.body}
                  </Card.Text>
                  {c.image_credit && <small className="text-secondary">Imagine: {c.image_credit}</small>}
                </div>
                <ItemControls
                  name={`cardul ${i + 1}`}
                  first={i === 0}
                  last={i === cards.length - 1}
                  disabled={pending}
                  onEdit={() => setEditing(c.id)}
                  onMove={(d) => run(() => moveItem('cards', c.id, d))}
                  onDelete={() => run(() => deleteItem('cards', c.id))}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <CardForm lessonId={lessonId} onSave={save} onCancel={() => setEditing(null)} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă card</Button>
      )}
    </>
  );
}
