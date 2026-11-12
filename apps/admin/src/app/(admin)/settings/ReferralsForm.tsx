'use client';

import { useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { UserError } from '@/lib/data/db';
import { monthsText, validateReferralSettings } from '@/lib/data/referralSettings';
import type { ReferralSettings } from '@/lib/data/referralSettings';
import { saveReferralSettings } from './actions';

const toNumber = (s: string) => (s.trim() === '' ? NaN : Number(s));

export default function ReferralsForm({ initial, durationMonths }: { initial: ReferralSettings; durationMonths: number }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [threshold, setThreshold] = useState(String(initial.threshold));
  const [credits, setCredits] = useState(String(initial.creditsPerInvitee));
  const [maxRewarded, setMaxRewarded] = useState(String(initial.maxRewarded));
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();

  const change = (fn: () => void) => { fn(); setSaved(false); setFormError(null); };

  function submit() {
    setSaved(false);
    const input = {
      enabled,
      threshold: toNumber(threshold),
      creditsPerInvitee: toNumber(credits),
      maxRewarded: toNumber(maxRewarded),
    };
    try {
      validateReferralSettings(input);
    } catch (e) {
      return setFormError(e instanceof UserError ? e.message : 'Valori invalide.');
    }
    setFormError(null);
    run(() => saveReferralSettings(input), () => setSaved(true));
  }

  return (
    <Form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {alert}
      {formError && <div className="alert alert-danger" role="alert">{formError}</div>}
      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h2" className="h5 mb-3">Recomandări</Card.Title>
          <Form.Group className="mb-3" controlId="referrals-enabled">
            <Form.Check
              type="switch"
              label="Recomandări active"
              checked={enabled}
              onChange={(e) => change(() => setEnabled(e.target.checked))}
            />
            <Form.Text muted>Oprit: nimeni nu primește recompense și codurile nu se mai aplică. Ține-l oprit până există plăți reale.</Form.Text>
          </Form.Group>
          <div className="d-flex flex-wrap gap-3 mb-2">
            <Form.Group controlId="referrals-threshold" style={{ width: 220 }}>
              <Form.Label>Invitați pentru acces gratuit</Form.Label>
              <Form.Control type="number" min={1} max={100} step={1} value={threshold} onChange={(e) => change(() => setThreshold(e.target.value))} />
            </Form.Group>
            <Form.Group controlId="referrals-credits" style={{ width: 260 }}>
              <Form.Label>Credite pe invitat (cu acces activ)</Form.Label>
              <Form.Control type="number" min={0} max={10000} step={1} value={credits} onChange={(e) => change(() => setCredits(e.target.value))} />
            </Form.Group>
            <Form.Group controlId="referrals-max" style={{ width: 280 }}>
              <Form.Label>Limită de invitați recompensați per elev</Form.Label>
              <Form.Control type="number" min={1} max={10000} step={1} value={maxRewarded} onChange={(e) => change(() => setMaxRewarded(e.target.value))} />
            </Form.Group>
          </div>
          <Form.Text muted>Durata accesului gratuit este cea de la Acces (acum {monthsText(durationMonths)}).</Form.Text>
        </Card.Body>
      </Card>

      <div className="d-flex align-items-center gap-3 mb-4">
        <Button type="submit" variant="primary" disabled={pending}>Salvează recomandările</Button>
        {saved && <span className="text-success" role="status">Setările recomandărilor au fost salvate.</span>}
      </div>
    </Form>
  );
}
