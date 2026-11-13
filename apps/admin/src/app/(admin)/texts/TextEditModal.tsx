'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Form, Modal } from 'react-bootstrap';
import { validateTextValue } from '@prepio/shared';
import type { UiTextRow } from '@/lib/data/uiTexts';

export default function TextEditModal({
  row, pending, error, onSave, onClose,
}: {
  row: UiTextRow;
  pending: boolean;
  error: string | null;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const initial = row.value ?? row.defaultText ?? '';
  const [value, setValue] = useState(initial);
  const problem = validateTextValue({ vars: row.vars, optional: row.optional }, value);
  const unchanged = value === initial;

  return (
    <Modal show onHide={onClose} size="lg" backdrop="static">
      <Form onSubmit={(e) => { e.preventDefault(); if (!problem && !unchanged) onSave(value); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Editează textul</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1"><code className="small">{row.key}</code></p>
          {row.description && <p className="text-muted small">{row.description}</p>}
          <p className="small mb-2"><strong>Text implicit:</strong> {row.defaultText}</p>
          {row.vars.length > 0 && (
            <p className="small mb-2">
              Variabile obligatorii:{' '}
              {row.vars.map((v) => <Badge key={v} bg="secondary" className="me-1">{`{${v}}`}</Badge>)}
            </p>
          )}
          <Form.Group controlId="ui-text-value">
            <Form.Label>Text</Form.Label>
            <Form.Control as="textarea" rows={6} value={value} isInvalid={!!problem} onChange={(e) => setValue(e.target.value)} />
            {row.optional && <Form.Text muted>Lasă gol ca să ascunzi textul.</Form.Text>}
          </Form.Group>
          {problem && <Alert variant="danger" className="mt-3 mb-0 py-2" role="alert">{problem}</Alert>}
          {error && <Alert variant="danger" className="mt-3 mb-0 py-2">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Anulează</Button>
          <Button type="submit" variant="primary" disabled={pending || !!problem || unchanged}>Salvează</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
