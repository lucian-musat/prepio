'use client';

import { useRef, useState } from 'react';
import { Button, Card, Form, Table } from 'react-bootstrap';
import { formatLei, parseLei, pricePerCredit } from '@prepio/shared';
import { useRunner } from '@/components/editor/common';
import type { CreditSettingsInput, PackageInput } from '@/lib/data/credits';
import { saveCreditSettingsAction } from './actions';

type Row = { key: number; id?: string; credits: string; price: string; featured: boolean; active: boolean };

const priceText = (bani: number) => formatLei(bani).replace(/ lei$/, '');

/** Per-credit price, or a dash while credits or price are not valid. */
function perCredit(r: Row): string {
  const bani = parseLei(r.price);
  const credits = Number(r.credits);
  if (bani === null || bani <= 0 || !Number.isInteger(credits) || credits <= 0) return '—';
  return pricePerCredit(bani, credits);
}

export default function CreditsForm({ initial }: { initial: CreditSettingsInput }) {
  const nextKey = useRef(initial.packages.length);
  const [welcome, setWelcome] = useState(String(initial.welcomeCredits));
  const [rows, setRows] = useState<Row[]>(() =>
    initial.packages.map((p, i) => ({
      key: i,
      id: p.id,
      credits: String(p.credits),
      price: priceText(p.priceBani),
      featured: p.featured,
      active: p.active,
    })),
  );
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();

  const change = (fn: () => void) => { fn(); setSaved(false); setFormError(null); };
  const patch = (key: number, p: Partial<Row>) => change(() => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r))));
  const move = (i: number, d: -1 | 1) =>
    change(() =>
      setRows((rs) => {
        const next = [...rs];
        [next[i], next[i + d]] = [next[i + d], next[i]];
        return next;
      }),
    );
  const feature = (key: number) => change(() => setRows((rs) => rs.map((r) => ({ ...r, featured: r.key === key }))));
  const setActive = (key: number, active: boolean) => patch(key, active ? { active } : { active, featured: false });
  const add = () =>
    change(() => setRows((rs) => [...rs, { key: nextKey.current++, credits: '', price: '', featured: false, active: true }]));

  function submit() {
    setSaved(false);
    const welcomeCredits = Number(welcome);
    const packages: PackageInput[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const bani = parseLei(r.price);
      const credits = r.credits.trim() === '' ? NaN : Number(r.credits);
      if (!Number.isInteger(credits) || credits < 1 || credits > 10000) {
        return setFormError(`Pachetul ${i + 1}: numărul de credite trebuie să fie între 1 și 10000.`);
      }
      if (bani === null || bani <= 0) return setFormError(`Pachetul ${i + 1}: prețul trebuie să fie mai mare de 0.`);
      packages.push({ ...(r.id ? { id: r.id } : {}), credits, priceBani: bani, featured: r.featured, active: r.active });
    }
    setFormError(null);
    run(
      () => saveCreditSettingsAction({ welcomeCredits: welcome.trim() === '' ? NaN : welcomeCredits, packages }),
      () => setSaved(true),
    );
  }

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {alert}
      {formError && <div className="alert alert-danger" role="alert">{formError}</div>}
      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h2" className="h5 mb-3">Credite</Card.Title>
          <Form.Group controlId="welcome-credits" className="mb-4" style={{ maxWidth: 240 }}>
            <Form.Label>Credite de bun venit</Form.Label>
            <Form.Control type="number" min={0} max={1000} step={1} value={welcome} onChange={(e) => change(() => setWelcome(e.target.value))} />
            <Form.Text muted>Primite o singură dată la crearea contului.</Form.Text>
          </Form.Group>

          <Table responsive size="sm" className="align-middle">
            <thead>
              <tr>
                <th>Credite</th>
                <th>Preț (lei)</th>
                <th>/ credit</th>
                <th>Cel mai ales</th>
                <th>Activ</th>
                <th aria-label="Ordine" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td style={{ width: 120 }}>
                    <Form.Control
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      aria-label={`Credite pachet ${i + 1}`}
                      value={r.credits}
                      onChange={(e) => patch(r.key, { credits: e.target.value })}
                    />
                  </td>
                  <td style={{ width: 140 }}>
                    <Form.Control
                      inputMode="decimal"
                      aria-label={`Preț pachet ${i + 1} (lei)`}
                      value={r.price}
                      onChange={(e) => patch(r.key, { price: e.target.value })}
                    />
                  </td>
                  <td className="text-nowrap">{perCredit(r)}</td>
                  <td>
                    <Form.Check
                      type="radio"
                      name="featured-package"
                      aria-label={`Cel mai ales: pachet ${i + 1}`}
                      checked={r.featured}
                      disabled={!r.active}
                      onChange={() => feature(r.key)}
                    />
                  </td>
                  <td>
                    <Form.Check
                      type="switch"
                      id={`package-active-${r.key}`}
                      aria-label={`Activ: pachet ${i + 1}`}
                      checked={r.active}
                      onChange={(e) => setActive(r.key, e.target.checked)}
                    />
                  </td>
                  <td className="text-nowrap">
                    <Button variant="outline-secondary" size="sm" className="me-1" aria-label={`Mută pachetul ${i + 1} în sus`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                    <Button variant="outline-secondary" size="sm" aria-label={`Mută pachetul ${i + 1} în jos`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Form.Text muted className="d-block mb-3">Pachetele nu se șterg; dezactivează-le.</Form.Text>
          <Button variant="outline-primary" size="sm" onClick={add}>Adaugă pachet</Button>
        </Card.Body>
      </Card>

      <div className="d-flex align-items-center gap-3 mb-4">
        <Button type="submit" variant="primary" disabled={pending}>Salvează creditele</Button>
        {saved && <span className="text-success" role="status">Creditele au fost salvate.</span>}
      </div>
    </Form>
  );
}
