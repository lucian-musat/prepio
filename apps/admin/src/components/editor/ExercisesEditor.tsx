'use client';

import { useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { deleteItem, moveItem, saveExercise } from '@/app/(admin)/lessons/[id]/actions';
import type { EditorExercise } from '@/lib/data/lesson';
import { EmptyNote, ItemControls, useRunner } from './common';

function ExerciseForm({ initial, onSave, onCancel }: {
  initial?: EditorExercise;
  onSave: (e: { id?: string; prompt: string; criteria: string }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [criteria, setCriteria] = useState(initial?.criteria ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return setError('Enunțul exercițiului nu poate fi gol.');
    if (!criteria.trim()) return setError('Criteriile nu pot fi goale.');
    setBusy(true);
    setError(null);
    try {
      setError(await onSave({ id: initial?.id, prompt, criteria }));
    } catch {
      setError('Operația a eșuat. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit} noValidate data-testid="exercise-form">
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3" controlId="ex-prompt">
        <Form.Label>Enunț</Form.Label>
        <Form.Control as="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="ex-criteria">
        <Form.Label>Criterii de evaluare</Form.Label>
        <Form.Control as="textarea" rows={5} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        <Form.Text>Câte un criteriu pe rând.</Form.Text>
      </Form.Group>
      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={busy}>Salvează</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}

export default function ExercisesEditor({ lessonId, exercises }: { lessonId: string; exercises: EditorExercise[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();

  const save = async (e: { id?: string; prompt: string; criteria: string }) => {
    const res = await saveExercise(lessonId, e);
    if (res.ok) {
      setEditing(null);
      return null;
    }
    return res.error;
  };

  return (
    <>
      {alert}
      {exercises.length === 0 && editing !== 'new' && <EmptyNote>Nu există exerciții de redactare încă.</EmptyNote>}
      {exercises.map((x, i) => (
        <Card className="mb-3" key={x.id} data-testid="exercise-item">
          <Card.Body>
            {editing === x.id ? (
              <ExerciseForm initial={x} onSave={save} onCancel={() => setEditing(null)} />
            ) : (
              <div className="d-flex flex-wrap gap-3 align-items-start">
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <Card.Text className="mb-1 fw-semibold">{x.prompt}</Card.Text>
                  <Card.Text className="text-secondary mb-0" style={{ whiteSpace: 'pre-line' }}>{x.criteria}</Card.Text>
                </div>
                <ItemControls
                  name={`exercițiul ${i + 1}`}
                  first={i === 0}
                  last={i === exercises.length - 1}
                  disabled={pending}
                  onEdit={() => setEditing(x.id)}
                  onMove={(d) => run(() => moveItem('writing_exercises', x.id, d))}
                  onDelete={() => run(() => deleteItem('writing_exercises', x.id))}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <ExerciseForm onSave={save} onCancel={() => setEditing(null)} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă exercițiu</Button>
      )}
    </>
  );
}
