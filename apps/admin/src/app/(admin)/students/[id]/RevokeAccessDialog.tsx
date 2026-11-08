'use client';

import { useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { revokeAccessAction } from '../actions';
import { useNotify } from './Notice';

export default function RevokeAccessDialog({ userId, show, onHide }: { userId: string; show: boolean; onHide: () => void }) {
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();
  const notify = useNotify();

  function submit() {
    if (!reason.trim()) return setFormError('Scrie motivul.');
    setFormError(null);
    run(() => revokeAccessAction(userId, reason), () => {
      setReason('');
      notify('Accesul a fost retras.');
      onHide();
    });
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Retrage accesul</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {alert}
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p className="text-muted small">Elevul revine la trial acum. Creditele rămân.</p>
          <Form.Group controlId="revoke-reason">
            <Form.Label>Motiv</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setFormError(null); }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={pending} onClick={onHide}>Renunță</Button>
          <Button type="submit" variant="danger" disabled={pending}>Retrage accesul</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
