'use client';

import { Button, Form } from 'react-bootstrap';
import { joinLines, splitLines, type FieldsProps } from './exerciseModel';

export default function ShortAnswerFields({ idPrefix, draft, onChange }: FieldsProps<'short_answer'>) {
  const setMistake = (i: number, patch: Partial<{ answer: string; message: string }>) =>
    onChange({ ...draft, mistakes: draft.mistakes.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <>
      <Form.Group className="mb-3" controlId={`${idPrefix}-accepted`}>
        <Form.Label>Variante acceptate (una pe rând)</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={joinLines(draft.accepted)}
          onChange={(e) => onChange({ ...draft, accepted: splitLines(e.target.value) })}
        />
        <Form.Text>Comparația ignoră majusculele, diacriticele și punctuația; secolele se normalizează („XIV” = „14”).</Form.Text>
      </Form.Group>

      <fieldset className="mb-3">
        <legend className="form-label fs-6 mb-1">Greșeli frecvente (opțional)</legend>
        {draft.mistakes.map((m, i) => (
          <div key={i} className="d-flex flex-wrap gap-2 align-items-start border rounded p-2 mb-2">
            <Form.Control
              aria-label={`Răspuns greșit ${i + 1}`}
              placeholder="Răspunsul greșit"
              value={m.answer}
              onChange={(e) => setMistake(i, { answer: e.target.value })}
              style={{ maxWidth: 260 }}
            />
            <Form.Control
              aria-label={`Mesaj pentru greșeala ${i + 1}`}
              placeholder="Mesajul afișat elevului"
              value={m.message}
              onChange={(e) => setMistake(i, { message: e.target.value })}
              className="flex-grow-1"
              style={{ minWidth: 200, width: 'auto' }}
            />
            <Button
              size="sm"
              variant="outline-danger"
              aria-label={`Șterge greșeala ${i + 1}`}
              onClick={() => onChange({ ...draft, mistakes: draft.mistakes.filter((_, j) => j !== i) })}
            >
              Șterge
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline-primary"
          onClick={() => onChange({ ...draft, mistakes: [...draft.mistakes, { answer: '', message: '' }] })}
        >
          Adaugă greșeală frecventă
        </Button>
      </fieldset>
    </>
  );
}
