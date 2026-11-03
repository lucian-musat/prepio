'use client';

import { useRef, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import type { CardImage } from '@prepio/shared';
import { uploadCardImage } from '@/app/(admin)/lessons/[id]/actions';
import { publicImageUrl } from '../common';
import type { FieldsProps } from './CardForm';
import RichTextInput from './RichTextInput';
import SortableList from './SortableList';

const orNull = (s: string) => (s === '' ? null : s);

export default function ImagesFields({ lessonId, idPrefix, draft, onChange }: FieldsProps<'images'>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setImage = (i: number, patch: Partial<CardImage>) =>
    onChange({ ...draft, images: draft.images.map((img, j) => (j === i ? { ...img, ...patch } : img)) });

  async function upload(files: File[]) {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    const added: CardImage[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadCardImage(lessonId, fd);
        if (!res.ok) {
          setError(res.error);
          break;
        }
        if (res.data) added.push({ path: res.data.path, alt: '', credit: null });
      }
    } catch {
      setError('Încărcarea imaginii a eșuat. Încearcă din nou.');
    } finally {
      // images uploaded before a failure are kept; updater form so edits made meanwhile survive
      if (added.length) onChange((d) => ({ ...d, images: [...d.images, ...added] }));
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  // Image paths are unique per upload, so they serve as row keys.
  const rows = draft.images.map((img) => ({ id: img.path, img }));

  return (
    <>
      <fieldset className="mb-3">
        <legend className="fs-6 fw-semibold">Imagini</legend>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        <SortableList
          items={rows}
          onChange={(next) => onChange({ ...draft, images: next.map((r) => r.img) })}
          itemName="imaginea"
          addLabel={uploading ? 'Se încarcă…' : 'Adaugă imagini'}
          addDisabled={uploading}
          onAdd={() => fileInput.current?.click()}
          render={({ img }, i) => (
            <div className="d-flex flex-wrap gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicImageUrl(img.path)}
                alt=""
                className="rounded border"
                style={{ width: 96, height: 96, objectFit: 'cover' }}
              />
              <div className="flex-grow-1" style={{ minWidth: 200 }}>
                <Form.Group className="mb-2" controlId={`${idPrefix}-alt-${i}`}>
                  <Form.Label className="small mb-1">Descriere (alt)</Form.Label>
                  <Form.Control size="sm" required value={img.alt} onChange={(e) => setImage(i, { alt: e.target.value })} />
                </Form.Group>
                <Form.Group controlId={`${idPrefix}-credit-${i}`}>
                  <Form.Label className="small mb-1">Sursa / creditul imaginii</Form.Label>
                  <Form.Control
                    size="sm"
                    value={img.credit ?? ''}
                    onChange={(e) => setImage(i, { credit: orNull(e.target.value) })}
                  />
                </Form.Group>
              </div>
            </div>
          )}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Încarcă imagini"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
        />
        <Form.Text className="d-block">JPEG, PNG sau WebP, max. 5 MB fiecare.</Form.Text>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="fs-6 fw-semibold">Afișare</legend>
        <Form.Check
          type="radio"
          id={`${idPrefix}-display-single`}
          name={`${idPrefix}-display`}
          label="O imagine mare / imagini una sub alta"
          checked={draft.display === 'single'}
          onChange={() => onChange({ ...draft, display: 'single' })}
        />
        <Form.Check
          type="radio"
          id={`${idPrefix}-display-gallery`}
          name={`${idPrefix}-display`}
          label="Galerie"
          checked={draft.display === 'gallery'}
          onChange={() => onChange({ ...draft, display: 'gallery' })}
        />
      </fieldset>

      <RichTextInput
        id={`${idPrefix}-images-text`}
        label="Text sub imagini"
        value={draft.text ?? ''}
        onChange={(text) => onChange({ ...draft, text: orNull(text) })}
      />
    </>
  );
}
