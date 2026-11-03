'use client';

import { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { CARD_TYPE_LABELS, cardImagePaths } from '@prepio/shared';
import { deleteItem, moveItem, saveCard } from '@/app/(admin)/lessons/[id]/actions';
import type { CardInput, EditorCard } from '@/lib/data/lesson';
import CardForm from './cards/CardForm';
import CardPreview from './cards/CardPreview';
import { cardSummary } from './cards/cardSummary';
import { EmptyNote, ItemControls, publicImageUrl, useRunner } from './common';

export default function CardsEditor({ lessonId, cards }: { lessonId: string; cards: EditorCard[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();

  const save = async (c: CardInput) => {
    const res = await saveCard(lessonId, c);
    if (res.ok) setEditing(null);
    return res;
  };

  return (
    <>
      {alert}
      {cards.length === 0 && editing !== 'new' && <EmptyNote>Nu există carduri încă.</EmptyNote>}
      {cards.map((c, i) => {
        const thumb = cardImagePaths(c)[0];
        return (
          <Card className="mb-3" key={c.id} data-testid="card-item">
            <Card.Body>
              {editing === c.id ? (
                <CardForm
                  lessonId={lessonId}
                  initial={c}
                  onSave={save}
                  onCancel={() => setEditing(null)}
                  preview={(d) => <CardPreview draft={d} index={i} total={cards.length} />}
                />
              ) : (
                <div className="d-flex flex-wrap gap-3 align-items-start">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicImageUrl(thumb)} alt="" className="rounded" style={{ width: 96, height: 96, objectFit: 'cover' }} />
                  )}
                  <div className="flex-grow-1" style={{ minWidth: 200 }}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <Badge bg="secondary-subtle" text="secondary-emphasis" className="fw-normal">{CARD_TYPE_LABELS[c.type]}</Badge>
                      <Card.Title as="h3" className="h6 mb-0">{c.title || `Card ${i + 1}`}</Card.Title>
                    </div>
                    <Card.Text className="text-secondary mb-0 text-break">{cardSummary(c)}</Card.Text>
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
        );
      })}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <CardForm
              lessonId={lessonId}
              onSave={save}
              onCancel={() => setEditing(null)}
              preview={(d) => <CardPreview draft={d} index={cards.length} total={cards.length + 1} />}
            />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă card</Button>
      )}
    </>
  );
}
