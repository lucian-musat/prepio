'use client';

import { useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { tokenizeSource, type BacItem, type BacSection } from '@prepio/shared';
import { deleteBacSource, moveBacSource, previewBacSourceImpact, saveBacSource } from '@/app/(admin)/bac/actions';
import { EmptyNote, ItemControls, useRunner } from '@/components/editor/common';
import SourceForm from '@/components/editor/consolidation/SourceForm';
import { sourceName } from '@/components/editor/consolidation/exerciseModel';
import { plural } from '@/components/editor/consolidation/plural';
import type { BacSource } from '@/lib/data/bac';
import { sectionLetter } from './BacItemForm';

/** One section's sources (A, B, … in order): list, add, edit, delete (a source used by an item can't be deleted). */
export default function BacSourcesEditor({ subjectId, section, sources, items }: {
  subjectId: string;
  section: BacSection;
  sources: BacSource[];
  items: BacItem[];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();
  const usage = (id: string) => items.filter((i) => i.sources.some((s) => s.sourceId === id)).length;
  const form = (initial?: BacSource) => (
    <SourceForm
      lessonId={subjectId}
      initial={initial}
      save={(input) => saveBacSource(subjectId, section, input)}
      previewImpact={previewBacSourceImpact}
      onDone={() => setEditing(null)}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <>
      {alert}
      {sources.length === 0 && editing !== 'new' && <EmptyNote>Nu există surse încă.</EmptyNote>}
      {sources.map((s, i) => {
        const used = usage(s.id);
        return (
          <Card className="mb-3" key={s.id} data-testid="bac-source">
            <Card.Body>
              {editing === s.id ? (
                form(s)
              ) : (
                <div className="d-flex flex-wrap gap-3 align-items-start">
                  <div className="flex-grow-1" style={{ minWidth: 200 }}>
                    <Card.Title as="h4" className="h6 mb-1 text-break">Sursa {sectionLetter(i)} · {sourceName(s)}</Card.Title>
                    <Card.Text className="text-secondary small mb-0">
                      {[s.author, s.work].filter(Boolean).join(', ') || 'Fără autor'} · {plural(tokenizeSource(s.body).words.length, 'cuvânt', 'cuvinte')} ·{' '}
                      {used ? `folosită în ${plural(used, 'cerință', 'cerințe')}` : 'nefolosită încă'}
                    </Card.Text>
                  </div>
                  <ItemControls
                    name={`sursa ${sectionLetter(i)}`}
                    first={i === 0}
                    last={i === sources.length - 1}
                    disabled={pending}
                    onEdit={() => setEditing(s.id)}
                    onMove={(d) => run(() => moveBacSource(s.id, d === 'up' ? -1 : 1))}
                    onDelete={() => run(() => deleteBacSource(s.id))}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        );
      })}
      {editing === 'new' ? (
        <Card className="mb-3"><Card.Body>{form()}</Card.Body></Card>
      ) : (
        <Button variant="outline-primary" onClick={() => setEditing('new')}>Adaugă sursă</Button>
      )}
    </>
  );
}
