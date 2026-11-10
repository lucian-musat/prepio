'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Form, InputGroup } from 'react-bootstrap';
import type { LessonStatus } from '@prepio/shared';
import { updateLesson } from '@/app/(admin)/lessons/[id]/actions';
import { setLessonStatus } from '@/app/(admin)/actions/tree';
import ConfirmModal from '@/components/ConfirmModal';
import { useRunner } from './common';

export default function LessonHeader({ id, title: initialTitle, status }: { id: string; title: string; status: LessonStatus }) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { run, pending, alert } = useRunner();
  const published = status === 'published';

  return (
    <div className="mb-4">
      <Link href="/" className="text-decoration-none small">← Înapoi la conținut</Link>
      <h1 className="h3 mt-2 d-flex align-items-center gap-2">
        Editează lecția{' '}
        <Badge bg={published ? 'success' : 'secondary'} data-testid="lesson-status">{published ? 'Publicată' : 'Ciornă'}</Badge>
      </h1>
      {alert}
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          run(() => updateLesson(id, { title }), () => setSaved(true));
        }}
      >
        <Form.Label htmlFor="lesson-title">Titlul lecției</Form.Label>
        <InputGroup>
          <Form.Control id="lesson-title" value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
          <Button type="submit" variant="primary" disabled={pending || !title.trim()}>Salvează titlul</Button>
          <Button
            variant={published ? 'outline-secondary' : 'outline-success'}
            disabled={pending}
            onClick={() => (published ? setConfirming(true) : run(() => setLessonStatus(id, 'published')))}
          >
            {published ? 'Retrage' : 'Publică'}
          </Button>
        </InputGroup>
        {saved && <Form.Text className="text-success" role="status">Titlul a fost salvat.</Form.Text>}
      </Form>
      <ConfirmModal
        show={confirming}
        heading="Retragi lecția din publicare? Elevii nu o vor mai vedea."
        body="Lecția va redeveni ciornă."
        confirmLabel="Retrage"
        onConfirm={() => { setConfirming(false); run(() => setLessonStatus(id, 'draft')); }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
