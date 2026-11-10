'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { createBacSubject, setBacPublished, updateBacSubject } from '@/app/(admin)/bac/actions';
import ConfirmModal from '@/components/ConfirmModal';
import { useRunner } from '@/components/editor/common';
import { MAX_BAC_CREDIT_COST, MIN_BAC_CREDIT_COST, type BacSubjectForEdit } from '@/lib/data/bac';

const FAILED = 'Operația a eșuat. Încearcă din nou.';
const int = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : Number.NaN);

/**
 * Title, year, variant and credit cost of a subject. Without `subject` it creates one and opens its editor;
 * with one it edits it and shows the publish switch.
 */
export default function BacDetailsForm({ subject, onCancel }: {
  subject?: BacSubjectForEdit['subject'];
  onCancel?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState(subject?.title ?? '');
  const [year, setYear] = useState(String(subject?.year ?? new Date().getFullYear()));
  const [variant, setVariant] = useState(subject?.variant ?? '');
  const [cost, setCost] = useState(String(subject?.creditCost ?? 10));
  const [saved, setSaved] = useState(false);
  const { run, pending, alert } = useRunner();
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);

  const input = () => ({ title, year: int(year), variant, creditCost: int(cost) });
  const touch = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setSaved(false); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    if (!subject) {
      run(async () => {
        const res = await createBacSubject(input());
        if (res.ok && res.data) router.push(`/bac/${res.data.id}`);
        return res;
      });
    } else {
      run(() => updateBacSubject(subject.id, input()), () => setSaved(true));
    }
  };

  const togglePublished = async (published: boolean) => {
    if (!subject || publishing) return;
    setPublishErrors([]);
    setPublishing(true);
    try {
      const res = await setBacPublished(subject.id, published);
      if (!res.ok) setPublishErrors(res.error.split('\n'));
    } catch {
      setPublishErrors([FAILED]);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Form onSubmit={submit} noValidate data-testid="bac-details-form">
        {alert}
        <div className="d-flex flex-wrap gap-3">
          <Form.Group className="mb-3" controlId={`${id}-title`} style={{ flex: '2 1 260px' }}>
            <Form.Label>Titlu</Form.Label>
            <Form.Control value={title} onChange={touch(setTitle)} />
          </Form.Group>
          <Form.Group className="mb-3" controlId={`${id}-year`} style={{ width: 120 }}>
            <Form.Label>An</Form.Label>
            <Form.Control type="number" min={2000} max={2100} value={year} onChange={touch(setYear)} />
          </Form.Group>
          <Form.Group className="mb-3" controlId={`${id}-variant`} style={{ flex: '1 1 180px' }}>
            <Form.Label>Varianta</Form.Label>
            <Form.Control value={variant} onChange={touch(setVariant)} />
          </Form.Group>
          <Form.Group className="mb-3" controlId={`${id}-cost`} style={{ width: 170 }}>
            <Form.Label>Cost (credite)</Form.Label>
            <Form.Control type="number" min={MIN_BAC_CREDIT_COST} max={MAX_BAC_CREDIT_COST} value={cost} onChange={touch(setCost)} />
            <Form.Text>Între {MIN_BAC_CREDIT_COST} și {MAX_BAC_CREDIT_COST}, luate la fiecare trimitere.</Form.Text>
          </Form.Group>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
          <ButtonGroup>
            <Button type="submit" variant="primary" disabled={pending}>{subject ? 'Salvează detaliile' : 'Creează subiectul'}</Button>
            {onCancel && <Button variant="outline-secondary" onClick={onCancel} disabled={pending}>Anulează</Button>}
          </ButtonGroup>
          {saved && <span className="text-success" role="status">Detaliile au fost salvate.</span>}
        </div>
      </Form>

      {subject && (
        <Card className="mt-2">
          <Card.Body>
            <Form.Check
              type="switch"
              id={`${id}-published`}
              label="Publicat"
              checked={subject.published}
              disabled={publishing}
              onChange={(e) => (e.target.checked ? void togglePublished(true) : setConfirmingOff(true))}
            />
            <Form.Text>Elevii văd doar subiectele publicate. Publicarea cere totalul de 90 de puncte și cerințe valide.</Form.Text>
            {publishErrors.length > 0 && (
              <Alert variant="danger" className="mt-3 mb-0" dismissible onClose={() => setPublishErrors([])}>
                {publishErrors.map((m) => <div key={m}>{m}</div>)}
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}
      <ConfirmModal
        show={confirmingOff}
        heading="Retragi subiectul din publicare?"
        body="Elevii nu îl vor mai vedea."
        confirmLabel="Retrage"
        onConfirm={() => { setConfirmingOff(false); void togglePublished(false); }}
        onCancel={() => setConfirmingOff(false)}
      />
    </>
  );
}
