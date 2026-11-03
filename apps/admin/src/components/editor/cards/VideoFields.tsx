'use client';

import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { parseYouTubeId } from '@prepio/shared';
import type { FieldsProps } from './CardForm';
import RichTextInput from './RichTextInput';

const orNull = (s: string) => (s === '' ? null : s);
const toSeconds = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));

export default function VideoFields({ idPrefix, draft, onChange }: FieldsProps<'video'>) {
  // The input keeps what was typed; the draft only stores the recognised id ('' when not recognised).
  const [raw, setRaw] = useState(draft.youtubeId);
  const id = parseYouTubeId(raw);
  const set = (value: string) => {
    setRaw(value);
    onChange((d) => ({ ...d, youtubeId: parseYouTubeId(value) ?? '' }));
  };

  return (
    <>
      <Form.Group className="mb-3" controlId={`${idPrefix}-yt`}>
        <Form.Label>Link YouTube</Form.Label>
        <Form.Control value={raw} isInvalid={raw.trim() !== '' && !id} onChange={(e) => set(e.target.value)} />
        {raw.trim() !== '' && !id && (
          <Form.Control.Feedback type="invalid" className="d-block">Linkul YouTube nu este valid.</Form.Control.Feedback>
        )}
        {id && (
          <div className="mt-2">
            <div className="text-success small mb-1">Video recunoscut ✓</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              className="rounded border"
              style={{ width: 240, maxWidth: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
            />
          </div>
        )}
      </Form.Group>
      <div className="d-flex flex-wrap gap-3 mb-3">
        <Form.Group controlId={`${idPrefix}-start`}>
          <Form.Label>Start (secunde)</Form.Label>
          <Form.Control
            type="number"
            min={0}
            value={draft.startSeconds ?? ''}
            onChange={(e) => onChange({ ...draft, startSeconds: toSeconds(e.target.value) })}
          />
        </Form.Group>
        <Form.Group controlId={`${idPrefix}-end`}>
          <Form.Label>Final (secunde)</Form.Label>
          <Form.Control
            type="number"
            min={0}
            value={draft.endSeconds ?? ''}
            onChange={(e) => onChange({ ...draft, endSeconds: toSeconds(e.target.value) })}
          />
        </Form.Group>
      </div>
      <RichTextInput
        id={`${idPrefix}-video-text`}
        label="Text sub video"
        value={draft.text ?? ''}
        onChange={(text) => onChange({ ...draft, text: orNull(text) })}
      />
    </>
  );
}
