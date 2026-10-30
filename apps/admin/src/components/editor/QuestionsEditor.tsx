'use client';

import { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { DIFFICULTY_LABELS, type Question } from '@prepio/shared';
import { deleteItem, moveItem, saveQuestion } from '@/app/(admin)/lessons/[id]/actions';
import type { QuestionInput } from '@/lib/data/lesson';
import { EmptyNote, ItemControls, useRunner } from './common';
import QuestionForm from './QuestionForm';

const TYPE_LABELS = {
  single_choice: 'Alegere simplă',
  multiple_choice: 'Alegere multiplă',
  chronological_order: 'Ordine cronologică',
} as const;

export default function QuestionsEditor({ lessonId, questions }: { lessonId: string; questions: Question[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { run, pending, alert } = useRunner();

  const save = async (q: QuestionInput) => {
    const res = await saveQuestion(lessonId, q);
    if (res.ok) setEditing(null);
    return res;
  };

  return (
    <>
      {alert}
      {questions.length === 0 && editing !== 'new' && <EmptyNote>Nu există întrebări încă.</EmptyNote>}
      {questions.map((q, i) => (
        <Card className="mb-3" key={q.id} data-testid="question-item">
          <Card.Body>
            {editing === q.id ? (
              <QuestionForm initial={q} onSave={save} onCancel={() => setEditing(null)} />
            ) : (
              <div className="d-flex flex-wrap gap-3 align-items-start">
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <div className="mb-1">
                    <Badge bg="secondary" className="me-1">{TYPE_LABELS[q.type]}</Badge>
                    <Badge bg="light" text="dark" className="border">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                  </div>
                  <Card.Text className="mb-1 fw-semibold">{q.prompt}</Card.Text>
                  <Card.Text className="text-secondary mb-0">{q.options.length} {q.type === 'chronological_order' ? 'elemente' : 'variante'}</Card.Text>
                </div>
                <ItemControls
                  name={`întrebarea ${i + 1}`}
                  first={i === 0}
                  last={i === questions.length - 1}
                  disabled={pending}
                  onEdit={() => setEditing(q.id)}
                  onMove={(d) => run(() => moveItem('questions', q.id, d))}
                  onDelete={() => run(() => deleteItem('questions', q.id))}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
      {editing === 'new' ? (
        <Card className="mb-3">
          <Card.Body>
            <QuestionForm onSave={save} onCancel={() => setEditing(null)} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setEditing('new')}>Adaugă întrebare</Button>
      )}
    </>
  );
}
