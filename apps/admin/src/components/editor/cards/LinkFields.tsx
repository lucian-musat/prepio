'use client';

import { useRef, useState } from 'react';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import type { LinkImage } from '@prepio/shared';
import { fetchLinkMetadata, uploadCardImage } from '@/app/(admin)/lessons/[id]/actions';
import type { LinkMetadata } from '@/lib/linkPreview';
import { publicImageUrl } from '../common';
import type { FieldsProps } from './CardForm';
import RichTextInput from './RichTextInput';
import { useBusyReporter } from './useBusyReporter';

const orNull = (s: string) => (s === '' ? null : s);
const imageSrc = (img: LinkImage) => (img.kind === 'url' ? img.url : publicImageUrl(img.path));

export default function LinkFields({ lessonId, idPrefix, draft, onChange, onBusyChange }: FieldsProps<'link'>) {
  const begin = useBusyReporter(onBusyChange);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<LinkMetadata | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Only what the page actually provided is applied; the rest of the draft is left as it is.
  const apply = (m: LinkMetadata) =>
    onChange((d) => ({
      ...d,
      pageTitle: m.title ?? d.pageTitle,
      description: m.description ?? d.description,
      image: m.imageUrl ? { kind: 'url', url: m.imageUrl } : d.image,
    }));

  async function autofill() {
    setError(null);
    setPending(null);
    setFetching(true);
    const end = begin();
    try {
      const res = await fetchLinkMetadata(draft.url);
      if (!res.ok) setError(res.error);
      else if (res.data) {
        const m = res.data;
        const overwrites =
          (m.title && draft.pageTitle.trim() !== '') || (m.description && draft.description) || (m.imageUrl && draft.image);
        if (overwrites) setPending(m);
        else apply(m);
      }
    } catch {
      setError('Nu am putut citi pagina. Completează manual.');
    } finally {
      end();
      setFetching(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    const end = begin();
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadCardImage(lessonId, fd);
      if (!res.ok) setError(res.error);
      else if (res.data) {
        const path = res.data.path;
        onChange((d) => ({ ...d, image: { kind: 'path', path } }));
      }
    } catch {
      setError('Încărcarea imaginii a eșuat. Încearcă din nou.');
    } finally {
      end();
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <>
      <Form.Group className="mb-2" controlId={`${idPrefix}-url`}>
        <Form.Label>URL</Form.Label>
        <Form.Control type="url" value={draft.url} onChange={(e) => onChange({ ...draft, url: e.target.value })} />
      </Form.Group>
      <div className="mb-3">
        <Button variant="outline-primary" size="sm" disabled={fetching} onClick={autofill}>
          {fetching ? 'Se citește pagina…' : 'Completează automat'}
        </Button>
      </div>
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {pending && (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
          <span className="me-auto">Câmpurile completate vor fi înlocuite cu datele paginii.</span>
          <ButtonGroup size="sm">
            <Button
              variant="warning"
              onClick={() => {
                apply(pending);
                setPending(null);
              }}
            >
              Înlocuiește
            </Button>
            <Button variant="outline-secondary" onClick={() => setPending(null)}>Anulează</Button>
          </ButtonGroup>
        </Alert>
      )}

      <Form.Group className="mb-3" controlId={`${idPrefix}-page-title`}>
        <Form.Label>Titlul paginii</Form.Label>
        <Form.Control value={draft.pageTitle} onChange={(e) => onChange({ ...draft, pageTitle: e.target.value })} />
      </Form.Group>
      <Form.Group className="mb-3" controlId={`${idPrefix}-description`}>
        <Form.Label>Descriere</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={draft.description ?? ''}
          onChange={(e) => onChange({ ...draft, description: orNull(e.target.value) })}
        />
      </Form.Group>

      <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
        {draft.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc(draft.image)} alt="" className="rounded border" style={{ width: 96, height: 96, objectFit: 'cover' }} />
        )}
        <Button size="sm" variant="outline-secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? 'Se încarcă…' : 'Încarcă altă imagine'}
        </Button>
        {draft.image && (
          <Button size="sm" variant="outline-danger" onClick={() => onChange({ ...draft, image: null })}>Elimină imaginea</Button>
        )}
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Imagine previzualizare"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>

      <RichTextInput
        id={`${idPrefix}-link-text`}
        label="Text deasupra"
        value={draft.text ?? ''}
        onChange={(text) => onChange({ ...draft, text: orNull(text) })}
      />
    </>
  );
}
