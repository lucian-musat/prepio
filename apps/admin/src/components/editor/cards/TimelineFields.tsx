'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import type { TimelinePoint } from '@prepio/shared';
import { uploadCardImage } from '@/app/(admin)/lessons/[id]/actions';
import { publicImageUrl } from '../common';
import type { FieldsProps } from './CardForm';
import SortableList from './SortableList';
import { useBusyReporter } from './useBusyReporter';

const orNull = (s: string) => (s === '' ? null : s);
const newId = () => crypto.randomUUID();

export default function TimelineFields({ lessonId, idPrefix, draft, onChange, onBusyChange }: FieldsProps<'timeline'>) {
  const begin = useBusyReporter(onBusyChange);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef(new Map<string, HTMLInputElement>());

  // By point id, not index: the list may be reordered while an upload runs.
  const setPoint = (id: string, patch: Partial<TimelinePoint>) =>
    onChange((d) => ({ ...d, points: d.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  async function upload(id: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading((s) => new Set(s).add(id));
    const end = begin();
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadCardImage(lessonId, fd);
      if (!res.ok) setError(res.error);
      else if (res.data) setPoint(id, { imagePath: res.data.path });
    } catch {
      setError('Încărcarea imaginii a eșuat. Încearcă din nou.');
    } finally {
      end();
      setUploading((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      const input = fileInputs.current.get(id);
      if (input) input.value = '';
    }
  }

  return (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">Puncte pe axa timpului</legend>
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      <SortableList
        items={draft.points}
        onChange={(points) => onChange({ ...draft, points })}
        itemName="punctul"
        addLabel="+ Adaugă punct"
        onAdd={() =>
          onChange({ ...draft, points: [...draft.points, { id: newId(), date: '', title: '', details: null, key: false, imagePath: null }] })
        }
        render={(p, i) => (
          <>
            <Form.Group className="mb-2" controlId={`${idPrefix}-date-${i}`}>
              <Form.Label className="small mb-1">Data</Form.Label>
              <Form.Control size="sm" placeholder="ex. 1 decembrie 1918" value={p.date} onChange={(e) => setPoint(p.id, { date: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2" controlId={`${idPrefix}-title-${i}`}>
              <Form.Label className="small mb-1">Titlu</Form.Label>
              <Form.Control size="sm" value={p.title} onChange={(e) => setPoint(p.id, { title: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2" controlId={`${idPrefix}-details-${i}`}>
              <Form.Label className="small mb-1">Detalii (opțional)</Form.Label>
              <Form.Control
                size="sm"
                as="textarea"
                rows={2}
                value={p.details ?? ''}
                onChange={(e) => setPoint(p.id, { details: orNull(e.target.value) })}
              />
            </Form.Group>
            <Form.Check
              className="mb-2"
              id={`${idPrefix}-key-${i}`}
              label="Moment cheie ★"
              checked={p.key}
              onChange={(e) => setPoint(p.id, { key: e.target.checked })}
            />
            <div className="d-flex flex-wrap align-items-center gap-2">
              {p.imagePath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicImageUrl(p.imagePath)} alt="" className="rounded border" style={{ width: 56, height: 56, objectFit: 'cover' }} />
              )}
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={uploading.has(p.id)}
                onClick={() => fileInputs.current.get(p.id)?.click()}
              >
                {uploading.has(p.id) ? 'Se încarcă…' : p.imagePath ? 'Schimbă imaginea' : 'Adaugă imagine'}
              </Button>
              {p.imagePath && (
                <Button size="sm" variant="outline-danger" onClick={() => setPoint(p.id, { imagePath: null })}>Elimină imaginea</Button>
              )}
              <input
                ref={(el) => {
                  if (el) fileInputs.current.set(p.id, el);
                  else fileInputs.current.delete(p.id);
                }}
                type="file"
                hidden
                aria-label={`Imagine punctul ${i + 1}`}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => upload(p.id, e.target.files?.[0])}
              />
            </div>
          </>
        )}
      />
    </fieldset>
  );
}
