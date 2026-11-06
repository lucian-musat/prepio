'use client';

import { useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { reactivateStudentAction, suspendStudentAction } from '../actions';

export default function SuspendDialog({ userId, show, onHide }: { userId: string; show: boolean; onHide: () => void }) {
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();

  function submit() {
    if (!reason.trim()) return setFormError('Motivul este obligatoriu.');
    setFormError(null);
    run(() => suspendStudentAction(userId, reason), () => {
      setReason('');
      onHide();
    });
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Suspendă contul</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {alert}
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form.Group controlId="suspend-reason">
            <Form.Label>Motiv (îl vede elevul)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              required
              maxLength={500}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setFormError(null); }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={pending} onClick={onHide}>Renunță</Button>
          <Button type="submit" variant="danger" disabled={pending}>Suspendă</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export function ReactivateDialog({
  userId, blocked, show, onHide,
}: {
  userId: string;
  blocked: boolean;
  show: boolean;
  onHide: () => void;
}) {
  const { run, pending, alert } = useRunner();
  return (
    <Modal show={show} onHide={onHide} centered aria-labelledby="reactivate-dialog-text">
      <Modal.Body>
        {alert}
        <p id="reactivate-dialog-text" className="mb-0">
          {`Reactivezi contul? Elevul își recapătă accesul imediat.${blocked ? ' Emailul nu va mai fi blocat la reînregistrare.' : ''}`}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={pending} onClick={onHide}>Renunță</Button>
        <Button variant="success" disabled={pending} onClick={() => run(() => reactivateStudentAction(userId), onHide)}>
          Reactivează
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
