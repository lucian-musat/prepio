'use client';

import { Button, Modal } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { resetProgressAction } from '../actions';
import { useNotify } from './Notice';

/** Confirms resetting one lesson (`lesson`) or the whole path (`lesson` null). */
export default function ResetDialog({
  userId, lesson, show, onHide,
}: {
  userId: string;
  lesson: { id: string; title: string } | null;
  show: boolean;
  onHide: () => void;
}) {
  const { run, pending, alert } = useRunner();
  const notify = useNotify();
  const text = lesson
    ? `Resetezi lecția „${lesson.title}”? Se șterg progresul și răspunsurile salvate ale elevului la această lecție. Creditele nu se schimbă.`
    : 'Resetezi tot parcursul elevului? Se șterg progresul și răspunsurile salvate la toate lecțiile. Creditele nu se schimbă.';
  return (
    <Modal show={show} onHide={onHide} centered aria-labelledby="reset-dialog-text">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">Resetează parcursul</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {alert}
        <p id="reset-dialog-text" className="mb-0">{text}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={pending} onClick={onHide}>Renunță</Button>
        <Button variant="danger" disabled={pending} onClick={() => run(() => resetProgressAction(userId, lesson?.id ?? null), () => {
          notify(lesson ? `Parcursul lecției „${lesson.title}” a fost resetat.` : 'Tot parcursul a fost resetat.');
          onHide();
        })}>
          Resetează
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
