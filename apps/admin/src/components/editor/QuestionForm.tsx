'use client';

import { useState } from 'react';
import { Alert, Button, ButtonGroup, Form, InputGroup } from 'react-bootstrap';
import { DIFFICULTY_LABELS, validateQuestion, type Difficulty, type Question, type QuestionType } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { QuestionInput } from '@/lib/data/lesson';
import {
  changeType, draftFromQuestion, draftToInput, emptyDraft, emptyOption, isChoice, type DraftOption, type QuestionDraft,
} from './questionModel';

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Alegere simplă',
  multiple_choice: 'Alegere multiplă',
  chronological_order: 'Ordine cronologică',
};

type Props = {
  initial?: Question;
  onSave: (q: QuestionInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
};

export default function QuestionForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(() => (initial ? draftFromQuestion(initial) : emptyDraft()));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setOption = (i: number, patch: Partial<DraftOption>) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const setCorrect = (i: number, correct: boolean) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o, j) => (d.type === 'single_choice' ? { ...o, correct: j === i } : j === i ? { ...o, correct } : o)),
    }));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.options.length) return d;
      const options = [...d.options];
      [options[i], options[j]] = [options[j], options[i]];
      return { ...d, options };
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = draftToInput(draft);
    const problems = validateQuestion({ ...input, id: input.id ?? 'new', position: 0 } as Question);
    if (draft.options.some((o) => !o.text.trim())) problems.push('Textul variantei nu poate fi gol.');
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const res = await onSave(input);
      if (!res.ok) setErrors([res.error]);
    } catch {
      setErrors(['Operația a eșuat. Încearcă din nou.']);
    } finally {
      setSaving(false);
    }
  }

  const choice = isChoice(draft.type);

  return (
    <Form onSubmit={submit} noValidate data-testid="question-form">
      {errors.length > 0 && (
        <Alert variant="danger">
          {errors.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </Alert>
      )}
      <div className="row g-3 mb-3">
        <Form.Group className="col-sm-6" controlId="q-type">
          <Form.Label>Tip</Form.Label>
          <Form.Select value={draft.type} onChange={(e) => setDraft((d) => changeType(d, e.target.value as QuestionType))}>
            {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="col-sm-6" controlId="q-difficulty">
          <Form.Label>Dificultate</Form.Label>
          <Form.Select value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
              <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>
      <Form.Group className="mb-3" controlId="q-prompt">
        <Form.Label>Enunț</Form.Label>
        <Form.Control as="textarea" rows={2} value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} />
      </Form.Group>

      <fieldset className="mb-3">
        <legend className="fs-6 fw-semibold">{choice ? 'Variante' : 'Elemente (în ordinea cronologică corectă)'}</legend>
        {draft.options.map((o, i) => {
          const n = i + 1;
          return (
            <InputGroup className="mb-2" key={o.id}>
              {choice ? (
                <InputGroup.Text>
                  <Form.Check
                    type={draft.type === 'single_choice' ? 'radio' : 'checkbox'}
                    name="correct"
                    aria-label={`Corectă ${n}`}
                    title="Răspuns corect"
                    checked={o.correct}
                    onChange={(e) => setCorrect(i, e.target.checked)}
                  />
                </InputGroup.Text>
              ) : (
                <InputGroup.Text>{n}</InputGroup.Text>
              )}
              <Form.Control
                aria-label={choice ? `Varianta ${n}` : `Element ${n}`}
                placeholder={choice ? `Varianta ${n}` : `Element ${n}`}
                value={o.text}
                onChange={(e) => setOption(i, { text: e.target.value })}
              />
              {!choice && (
                <Form.Control
                  aria-label={`An / etichetă ${n}`}
                  placeholder="An / etichetă (opțional)"
                  style={{ maxWidth: '12rem' }}
                  value={o.label}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                />
              )}
              {!choice && (
                <>
                  <Button variant="outline-secondary" aria-label={`Mută sus ${n}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button variant="outline-secondary" aria-label={`Mută jos ${n}`} disabled={i === draft.options.length - 1} onClick={() => move(i, 1)}>↓</Button>
                </>
              )}
              <Button
                variant="outline-danger"
                aria-label={`Elimină opțiunea ${n}`}
                disabled={draft.options.length <= 2}
                onClick={() => set({ options: draft.options.filter((_, j) => j !== i) })}
              >
                ×
              </Button>
            </InputGroup>
          );
        })}
        <Button variant="outline-primary" size="sm" onClick={() => set({ options: [...draft.options, emptyOption()] })}>
          {choice ? 'Adaugă variantă' : 'Adaugă element'}
        </Button>
      </fieldset>

      <Form.Group className="mb-3" controlId="q-explanation">
        <Form.Label>Explicație (opțional)</Form.Label>
        <Form.Control as="textarea" rows={2} value={draft.explanation} onChange={(e) => set({ explanation: e.target.value })} />
      </Form.Group>

      <ButtonGroup>
        <Button type="submit" variant="primary" disabled={saving}>Salvează</Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>Anulează</Button>
      </ButtonGroup>
    </Form>
  );
}
