'use client';

import { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import {
  CONSOLIDATION_TYPE_LABELS, type BacBarem, type BacItem, type BacSection, type ConsolidationExercise, type ConsolidationType, type SolutionTemplate,
} from '@prepio/shared';
import { deleteBacItem, moveBacItem } from '@/app/(admin)/bac/actions';
import { EmptyNote, ItemControls, useRunner } from '@/components/editor/common';
import { ExerciseTypePicker } from '@/components/editor/consolidation/ExerciseForm';
import { draftFor, toDraft } from '@/components/editor/consolidation/exerciseModel';
import type { BacSource } from '@/lib/data/bac';
import BacItemForm from './BacItemForm';
import BacSourcesEditor from './BacSourcesEditor';

const newId = () => crypto.randomUUID();
const NO_AI = { main: '', requirements: {}, templateId: null, requirementTemplates: {} };

/** The exercise part of an item (the BAC-only fields are edited apart, so they never count as type content). */
function draftOf(item: BacItem) {
  const { section: _s, number: _n, points: _p, ...exercise } = item;
  return toDraft(exercise as ConsolidationExercise, NO_AI);
}

type Editing ={ id: string } | { type: ConsolidationType } | 'picking' | null;

/** One „Subiectul I / II / III” tab: its sources, then its numbered requirements. */
export default function BacSectionTab({ subjectId, section, sources, items, barems, errors, templates }: {
  subjectId: string;
  section: BacSection;
  sources: BacSource[];
  items: BacItem[];
  barems: Record<string, BacBarem>;
  errors: Record<string, string[]>;
  templates: SolutionTemplate[];
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const { run, pending, alert } = useRunner();
  const editingId = editing && typeof editing === 'object' && 'id' in editing ? editing.id : null;
  const adding = editing !== null && (editing === 'picking' || 'type' in editing);
  const total = items.reduce((t, i) => t + i.points, 0);
  const close = () => setEditing(null);

  return (
    <>
      <section className="mb-4" aria-labelledby={`bac-sources-${section}`}>
        <h3 id={`bac-sources-${section}`} className="h5">Surse</h3>
        <BacSourcesEditor subjectId={subjectId} section={section} sources={sources} items={items} />
      </section>
      <section aria-labelledby={`bac-items-${section}`}>
        <h3 id={`bac-items-${section}`} className="h5">Cerințe <span className="text-secondary fw-normal">· {total} p</span></h3>
        {alert}
        {items.length === 0 && !adding && <EmptyNote>Nu există cerințe încă.</EmptyNote>}
        {items.map((item, i) => {
          const errs = errors[item.id] ?? [];
          return (
            <Card className="mb-3" key={item.id} data-testid="bac-item">
              <Card.Body>
                {editingId === item.id ? (
                  <BacItemForm
                    subjectId={subjectId}
                    section={section}
                    sources={sources}
                    templates={templates}
                    initial={draftOf(item)}
                    initialPoints={item.points}
                    initialBarem={barems[item.id]}
                    errors={errs}
                    onDone={close}
                    onCancel={close}
                  />
                ) : (
                  <div className="d-flex flex-wrap gap-3 align-items-start">
                    <div className="flex-grow-1" style={{ minWidth: 200 }}>
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <Badge bg="secondary-subtle" text="secondary-emphasis" className="fw-normal">{CONSOLIDATION_TYPE_LABELS[item.type]}</Badge>
                        <Badge bg="primary-subtle" text="primary-emphasis" className="fw-normal">{item.points} p</Badge>
                        {errs.length > 0 && <Badge bg="danger">Invalid</Badge>}
                      </div>
                      <Card.Text className="mb-1 fw-semibold text-break">{item.number}. {item.prompt}</Card.Text>
                      {errs.length > 0 && (
                        <ul className="small text-danger mb-0 ps-3">
                          {errs.map((m) => <li key={m}>{m}</li>)}
                        </ul>
                      )}
                    </div>
                    <ItemControls
                      name={`cerința ${item.number}`}
                      first={i === 0}
                      last={i === items.length - 1}
                      disabled={pending}
                      onEdit={() => setEditing({ id: item.id })}
                      onMove={(d) => run(() => moveBacItem(item.id, d === 'up' ? -1 : 1))}
                      onDelete={() => run(() => deleteBacItem(item.id))}
                    />
                  </div>
                )}
              </Card.Body>
            </Card>
          );
        })}

        {editing === 'picking' && (
          <Card className="mb-3">
            <Card.Body>
              <div className="form-label">Alege tipul cerinței</div>
              <ExerciseTypePicker value={null} onChange={(type) => setEditing({ type })} />
              <div className="mt-3">
                <Button variant="outline-secondary" size="sm" onClick={close}>Anulează</Button>
              </div>
            </Card.Body>
          </Card>
        )}
        {editing !== null && typeof editing === 'object' && 'type' in editing && (
          <Card className="mb-3">
            <Card.Body>
              <BacItemForm
                subjectId={subjectId}
                section={section}
                sources={sources}
                templates={templates}
                initial={draftFor(editing.type, newId)}
                initialPoints={null}
                onDone={close}
                onCancel={close}
              />
            </Card.Body>
          </Card>
        )}
        {!adding && <Button variant="primary" onClick={() => setEditing('picking')}>Adaugă cerință</Button>}
      </section>
    </>
  );
}
