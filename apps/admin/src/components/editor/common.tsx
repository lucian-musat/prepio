'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Alert, Button, ButtonGroup } from 'react-bootstrap';
import type { ActionResult } from '@/lib/actionResult';

/** Runs server actions, keeps the latest error for display and never lets a rejection escape. */
export function useRunner() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) onOk?.();
        else setError(res.error);
      } catch {
        setError('Operația a eșuat. Încearcă din nou.');
      }
    });
  };
  const alert = error ? (
    <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>
  ) : null;
  return { run, pending, alert };
}

/** Edit / up / down / delete controls; delete asks for a second click. */
export function ItemControls({
  name, first, last, disabled, onEdit, onMove, onDelete,
}: {
  name: string;
  first: boolean;
  last: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <ButtonGroup size="sm">
        <Button variant="danger" disabled={disabled} onClick={() => { setConfirming(false); onDelete(); }}>Confirmă ștergerea</Button>
        <Button variant="outline-secondary" onClick={() => setConfirming(false)}>Anulează</Button>
      </ButtonGroup>
    );
  }
  return (
    <ButtonGroup size="sm">
      <Button variant="outline-primary" disabled={disabled} onClick={onEdit}>Editează</Button>
      <Button variant="outline-secondary" aria-label={`Mută sus ${name}`} disabled={disabled || first} onClick={() => onMove('up')}>↑</Button>
      <Button variant="outline-secondary" aria-label={`Mută jos ${name}`} disabled={disabled || last} onClick={() => onMove('down')}>↓</Button>
      <Button variant="outline-danger" disabled={disabled} onClick={() => setConfirming(true)}>Șterge</Button>
    </ButtonGroup>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-secondary">{children}</p>;
}

export const publicImageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`;
