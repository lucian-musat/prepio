'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Modal } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { deleteStudentAction } from '../actions';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function DeleteDialog({
  userId, email, suspended, suspendedReason, show, onHide,
}: {
  userId: string;
  email: string;
  suspended: boolean;
  suspendedReason: string | null;
  show: boolean;
  onHide: () => void;
}) {
  const router = useRouter();
  // A suspended student's email is always blocked on delete (with the suspension reason).
  const [block, setBlock] = useState(suspended);
  const [reason, setReason] = useState(suspendedReason ?? '');
  const [confirmEmail, setConfirmEmail] = useState('');
  const { run, pending, alert } = useRunner();
  const blocked = suspended || block;
  const matches = email !== '' && same(confirmEmail, email);

  function submit() {
    if (!matches) return;
    run(
      () => deleteStudentAction(userId, { confirmEmail, block: blocked, reason: blocked ? reason : '' }),
      () => router.push('/students?notice=deleted'),
    );
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Șterge contul</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {alert}
          <p>Se șterg definitiv contul și toate datele elevului.</p>
          <Form.Group controlId="delete-block" className="mb-3">
            <Form.Check
              type="checkbox"
              label="Blochează reînregistrarea cu acest email"
              checked={blocked}
              disabled={suspended}
              onChange={(e) => setBlock(e.target.checked)}
            />
            {suspended && <Form.Text>Elevul e suspendat: emailul se blochează automat.</Form.Text>}
          </Form.Group>
          {blocked && (
            <Form.Group controlId="delete-reason" className="mb-3">
              <Form.Label>Motiv (îl vede elevul dacă revine)</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Form.Group>
          )}
          <Form.Group controlId="delete-confirm-email">
            <Form.Label>Scrie emailul elevului ca să confirmi</Form.Label>
            <Form.Control type="email" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={pending} onClick={onHide}>Renunță</Button>
          <Button type="submit" variant="danger" disabled={pending || !matches}>Șterge definitiv</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
