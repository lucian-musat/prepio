'use client';

import { useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { formatAccessDate } from '@prepio/shared';
import { useRunner } from '@/components/editor/common';
import { grantAccessAction } from '../actions';
import { useNotify } from './Notice';

export default function GrantAccessDialog({ userId, show, onHide }: { userId: string; show: boolean; onHide: () => void }) {
  const [months, setMonths] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();
  const notify = useNotify();

  function submit() {
    const n = months.trim() === '' ? NaN : Number(months);
    if (!Number.isInteger(n) || n < 1 || n > 24) return setFormError('Alege între 1 și 24 de luni.');
    if (!reason.trim()) return setFormError('Scrie motivul.');
    setFormError(null);
    let until: string | undefined;
    run(
      async () => {
        const res = await grantAccessAction(userId, n, reason);
        if (res.ok) until = res.data;
        return res;
      },
      () => {
        setMonths('');
        setReason('');
        notify(until ? `Acces acordat până la ${formatAccessDate(new Date(until))}.` : 'Acces acordat.');
        onHide();
      },
    );
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Acordă acces</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {alert}
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p className="text-muted small">Lunile se adaugă la accesul curent. Nu se adaugă credite.</p>
          <Form.Group controlId="grant-months" className="mb-3">
            <Form.Label>Număr de luni</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              value={months}
              onChange={(e) => { setMonths(e.target.value); setFormError(null); }}
            />
            <Form.Text muted>Între 1 și 24.</Form.Text>
          </Form.Group>
          <Form.Group controlId="grant-reason">
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
          <Button type="submit" variant="primary" disabled={pending}>Acordă acces</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
