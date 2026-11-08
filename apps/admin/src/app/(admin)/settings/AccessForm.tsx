'use client';

import { useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import { validateAccessSettings } from '@/lib/data/accessSettings';
import type { AccessSettings } from '@/lib/data/accessSettings';
import { UserError } from '@/lib/data/db';
import { saveAccessSettings } from './actions';

const priceText = (bani: number) => `${Math.floor(bani / 100)},${String(bani % 100).padStart(2, '0')}`;

export default function AccessForm({ initial }: { initial: AccessSettings }) {
  const [price, setPrice] = useState(priceText(initial.priceBani));
  const [bonus, setBonus] = useState(String(initial.bonusCredits));
  const [months, setMonths] = useState(String(initial.durationMonths));
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();

  const change = (fn: () => void) => { fn(); setSaved(false); setFormError(null); };

  function submit() {
    setSaved(false);
    const input = {
      price,
      bonusCredits: bonus.trim() === '' ? NaN : Number(bonus),
      durationMonths: months.trim() === '' ? NaN : Number(months),
    };
    try {
      validateAccessSettings(input);
    } catch (e) {
      return setFormError(e instanceof UserError ? e.message : 'Valori invalide.');
    }
    setFormError(null);
    run(() => saveAccessSettings(input), () => setSaved(true));
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
          <Card.Title as="h2" className="h5 mb-3">Acces</Card.Title>
          <div className="d-flex flex-wrap gap-3 mb-2">
            <Form.Group controlId="access-price" style={{ width: 200 }}>
              <Form.Label>Preț acces (lei)</Form.Label>
              <Form.Control inputMode="decimal" value={price} onChange={(e) => change(() => setPrice(e.target.value))} />
            </Form.Group>
            <Form.Group controlId="access-bonus" style={{ width: 200 }}>
              <Form.Label>Credite incluse</Form.Label>
              <Form.Control type="number" min={0} max={10000} step={1} value={bonus} onChange={(e) => change(() => setBonus(e.target.value))} />
            </Form.Group>
            <Form.Group controlId="access-months" style={{ width: 200 }}>
              <Form.Label>Durată (luni)</Form.Label>
              <Form.Control type="number" min={1} max={24} step={1} value={months} onChange={(e) => change(() => setMonths(e.target.value))} />
            </Form.Group>
          </div>
          <Form.Text muted>Modificările se aplică doar plăților viitoare.</Form.Text>
        </Card.Body>
      </Card>

      <div className="d-flex align-items-center gap-3 mb-4">
        <Button type="submit" variant="primary" disabled={pending}>Salvează accesul</Button>
        {saved && <span className="text-success" role="status">Oferta de acces a fost salvată.</span>}
      </div>
    </Form>
  );
}
