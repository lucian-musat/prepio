'use client';

import { useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { tokenizeSource, type Source } from '@prepio/shared';
import { deleteSource, moveItem } from '@/app/(admin)/lessons/[id]/actions';
import type { EditorConsolidation } from '@/lib/data/consolidation';
import { EmptyNote, ItemControls, useRunner } from '../common';
import SourceForm from './SourceForm';
import { plural } from './plural';
import { exercisesCount, sourceName } from './exerciseModel';

/** The lesson's sources: list, add, edit, delete (a source used by an exercise can't be deleted). */
export default function SourcesEditor({ lessonId, sources, exercises }: {
  lessonId: string;
  sources: Source[];
  exercises: EditorConsolidation['exercises'];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();
  const usage = (id: string) => exercises.filter((e) => e.exercise.sources.some((s) => s.sourceId === id)).length;

  return (
    <>
      {alert}
      {sources.length === 0 && editing !== 'new' && <EmptyNote>Nu există surse încă.</EmptyNote>}
      {sources.map((s, i) => {
        const used = usage(s.id);
        return (
          <Card className="mb-3" key={s.id} data-testid="source-item">
            <Card.Body>
              {editing === s.id ? (
                <SourceForm lessonId={lessonId} initial={s} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="d-flex flex-wrap gap-3 align-items-start">
                  <div className="flex-grow-1" style={{ minWidth: 200 }}>
                    <Card.Title as="h3" className="h6 mb-1 text-break">{sourceName(s)}</Card.Title>
                    <Card.Text className="text-secondary small mb-0">
                      {[s.author, s.work].filter(Boolean).join(', ') || 'Fără autor'} · {plural(tokenizeSource(s.body).words.length, 'cuvânt', 'cuvinte')} ·{' '}
                      <span>{used ? `folosită în ${exercisesCount(used)}` : 'nefolosită încă'}</span>
                    </Card.Text>
                  </div>
                  <ItemControls
                    name={`sursa ${i + 1}`}
                    first={i === 0}
                    last={i === sources.length - 1}
                    disabled={pending}
                    onEdit={() => setEditing(s.id)}
                    onMove={(d) => run(() => moveItem('sources', s.id, d))}
                    onDelete={() => run(() => deleteSource(s.id))}
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
            <SourceForm lessonId={lessonId} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="outline-primary" onClick={() => setEditing('new')}>Adaugă sursă</Button>
      )}
    </>
  );
}
