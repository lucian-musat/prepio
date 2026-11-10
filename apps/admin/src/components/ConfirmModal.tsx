'use client';

import { Button, Modal } from 'react-bootstrap';

/** Small confirm dialog: a heading, one line of text, Anulează and a confirm button. */
export default function ConfirmModal({ show, heading, body, confirmLabel, onConfirm, onCancel }: {
  show: boolean;
  heading: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">{heading}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">{body}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel}>Anulează</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}
