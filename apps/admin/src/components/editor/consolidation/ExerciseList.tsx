'use client';

import { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { CONSOLIDATION_TYPE_LABELS, type ConsolidationType } from '@prepio/shared';
import { deleteItem, moveItem, saveConsolidationExercise } from '@/app/(admin)/lessons/[id]/actions';
import type { EditorConsolidation, ExerciseInput } from '@/lib/data/consolidation';
import { EmptyNote, ItemControls, useRunner } from '../common';
import ExerciseForm, { ExerciseTypePicker } from './ExerciseForm';
import { draftFor, toDraft } from './exerciseModel';

const newId = () => crypto.randomUUID();

type Editing = { id: string } | { type: ConsolidationType } | 'picking' | null;

export default function ExerciseList({ lessonId, data }: { lessonId: string; data: EditorConsolidation }) {
  const { sources, exercises, templates } = data;
  const [editing, setEditing] = useState<Editing>(null);
  const { run, pending, alert } = useRunner();

  const save = async (input: ExerciseInput) => {
    const res = await saveConsolidationExercise(lessonId, input);
    if (res.ok) setEditing(null);
    return res;
  };
  const editingId = editing && typeof editing === 'object' && 'id' in editing ? editing.id : null;
  const adding = editing !== null && (editing === 'picking' || 'type' in editing);

  return (
    <>
      {alert}
      {exercises.length === 0 && !adding && <EmptyNote>Nu există exerciții încă.</EmptyNote>}
      {exercises.map(({ exercise: ex, ai, errors }, i) => (
        <Card className="mb-3" key={ex.id} data-testid="exercise-item">
          <Card.Body>
            {editingId === ex.id ? (
              <ExerciseForm
                initial={toDraft(ex, ai)}
                sources={sources}
                templates={templates}
                errors={errors}
                onSave={save}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="d-flex flex-wrap gap-3 align-items-start">
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <Badge bg="secondary-subtle" text="secondary-emphasis" className="fw-normal">{CONSOLIDATION_TYPE_LABELS[ex.type]}</Badge>
                    {errors.length > 0 && <Badge bg="danger">Invalid</Badge>}
                  </div>
                  <Card.Text className="mb-1 fw-semibold text-break">{ex.prompt || `Exercițiul ${i + 1}`}</Card.Text>
                  {errors.length > 0 && (
                    <ul className="small text-danger mb-0 ps-3">
                      {errors.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  )}
                </div>
                <ItemControls
                  name={`exercițiul ${i + 1}`}
                  first={i === 0}
                  last={i === exercises.length - 1}
                  disabled={pending}
                  onEdit={() => setEditing({ id: ex.id })}
                  onMove={(d) => run(() => moveItem('consolidation_exercises', ex.id, d))}
                  onDelete={() => run(() => deleteItem('consolidation_exercises', ex.id))}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      ))}

      {editing === 'picking' && (
        <Card className="mb-3">
          <Card.Body>
            <div className="form-label">Alege tipul exercițiului</div>
            <ExerciseTypePicker value={null} onChange={(type) => setEditing({ type })} />
            <div className="mt-3">
              <Button variant="outline-secondary" size="sm" onClick={() => setEditing(null)}>Anulează</Button>
            </div>
          </Card.Body>
        </Card>
      )}
      {editing !== null && typeof editing === 'object' && 'type' in editing && (
        <Card className="mb-3">
          <Card.Body>
            <ExerciseForm
              initial={draftFor(editing.type, newId)}
              sources={sources}
              templates={templates}
              onSave={save}
              onCancel={() => setEditing(null)}
            />
          </Card.Body>
        </Card>
      )}
      {!adding && (
        <Button variant="primary" onClick={() => setEditing('picking')}>Adaugă exercițiu</Button>
      )}
    </>
  );
}
