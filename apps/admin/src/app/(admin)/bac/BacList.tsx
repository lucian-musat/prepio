'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Table } from 'react-bootstrap';
import { BAC_TOTAL_POINTS } from '@prepio/shared';
import BacDetailsForm from '@/components/bac/BacDetailsForm';
import { EmptyNote, useRunner } from '@/components/editor/common';
import type { BacSubjectListRow } from '@/lib/data/bac';
import { deleteBacSubject } from './actions';

/** The subjects table with „Adaugă subiect” and a delete that asks for a second click. */
export default function BacList({ subjects }: { subjects: BacSubjectListRow[] }) {
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { run, pending, alert } = useRunner();

  return (
    <>
      {alert}
      {adding ? (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title as="h2" className="h5 mb-3">Subiect nou</Card.Title>
            <BacDetailsForm onCancel={() => setAdding(false)} />
          </Card.Body>
        </Card>
      ) : (
        <Button variant="primary" className="mb-3" onClick={() => setAdding(true)}>Adaugă subiect</Button>
      )}

      {subjects.length === 0 ? (
        <EmptyNote>Nu există subiecte încă.</EmptyNote>
      ) : (
        <Table responsive hover className="align-middle">
          <thead>
            <tr>
              <th>Titlu</th>
              <th>An</th>
              <th>Varianta</th>
              <th>Cost</th>
              <th>Total</th>
              <th>Stare</th>
              <th aria-label="Acțiuni" />
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} data-testid="bac-row">
                <td className="text-break"><Link href={`/bac/${s.id}`}>{s.title}</Link></td>
                <td>{s.year}</td>
                <td>{s.variant}</td>
                <td>{s.creditCost}</td>
                <td className={s.totalPoints === BAC_TOTAL_POINTS ? 'text-success' : undefined}>{s.totalPoints} / {BAC_TOTAL_POINTS}</td>
                <td>
                  <Badge bg={s.published ? 'success' : 'secondary'}>{s.published ? 'Publicat' : 'Ciornă'}</Badge>
                </td>
                <td className="text-end text-nowrap">
                  {confirming === s.id ? (
                    <ButtonGroup size="sm">
                      <Button variant="danger" disabled={pending} onClick={() => { setConfirming(null); run(() => deleteBacSubject(s.id)); }}>
                        Confirmă ștergerea
                      </Button>
                      <Button variant="outline-secondary" onClick={() => setConfirming(null)}>Anulează</Button>
                    </ButtonGroup>
                  ) : (
                    <Button size="sm" variant="outline-danger" disabled={pending} aria-label={`Șterge ${s.title}`} onClick={() => setConfirming(s.id)}>
                      Șterge
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
