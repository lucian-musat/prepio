'use client';

import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { creditsLabel } from '@prepio/shared';
import { useRunner } from '@/components/editor/common';
import { adjustCreditsAction } from '../actions';

/** The credit adjustment form; the header shows it in a dialog. */
export default function AdjustCreditsForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const { run, pending, alert } = useRunner();

  const delta = amount.trim() === '' ? NaN : Number(amount);

  function review() {
    setDone(null);
    if (!Number.isInteger(delta) || delta === 0) return setFormError('Introdu un număr diferit de 0.');
    if (!reason.trim()) return setFormError('Motivul este obligatoriu.');
    setFormError(null);
    setConfirming(true);
  }

  function apply() {
    let balance: number | undefined;
    run(
      async () => {
        const res = await adjustCreditsAction(userId, delta, reason);
        if (res.ok) balance = res.data;
        return res;
      },
      () => {
        setAmount('');
        setReason('');
        setConfirming(false);
        setDone(balance ?? null);
      },
    );
  }

  return (
    <>
      {alert}
      {formError && <div className="alert alert-danger" role="alert">{formError}</div>}
      <Form onSubmit={(e) => { e.preventDefault(); if (!confirming) review(); }}>
        <div className="d-flex flex-wrap gap-3 mb-3">
          <Form.Group controlId="adjust-amount" style={{ width: 160 }}>
            <Form.Label>Credite (±)</Form.Label>
            <Form.Control type="number" step={1} value={amount} disabled={confirming} onChange={(e) => { setAmount(e.target.value); setFormError(null); }} />
          </Form.Group>
          <Form.Group controlId="adjust-reason" className="flex-grow-1" style={{ minWidth: 240 }}>
            <Form.Label>Motiv</Form.Label>
            <Form.Control value={reason} maxLength={500} disabled={confirming} onChange={(e) => { setReason(e.target.value); setFormError(null); }} />
          </Form.Group>
        </div>
        {confirming ? (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span>{delta > 0 ? 'Adaugi' : 'Scazi'} {creditsLabel(Math.abs(delta))}. Confirmi?</span>
            <Button variant="primary" disabled={pending} onClick={apply}>Aplică</Button>
            <Button variant="outline-secondary" disabled={pending} onClick={() => setConfirming(false)}>Anulează</Button>
          </div>
        ) : (
          <div className="d-flex align-items-center gap-3">
            <Button type="submit" variant="primary">Continuă</Button>
            {done !== null && <span className="text-success" role="status">Ajustat. Sold nou: {done}.</span>}
          </div>
        )}
      </Form>
    </>
  );
}
