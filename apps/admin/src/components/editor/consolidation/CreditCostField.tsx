'use client';

import { Form } from 'react-bootstrap';
import { MAX_CREDIT_COST, MIN_CREDIT_COST, creditsLabel } from '@prepio/shared';

const OPTIONS = Array.from({ length: MAX_CREDIT_COST - MIN_CREDIT_COST + 1 }, (_, i) => MIN_CREDIT_COST + i);

/** How many credits one AI check costs the student. With `requirements` (essay) the cost is per requirement. */
export default function CreditCostField({ idPrefix, value, onChange, requirements }: {
  idPrefix: string;
  value: number;
  onChange: (n: number) => void;
  requirements?: number;
}) {
  const perRequirement = requirements !== undefined;
  return (
    <Form.Group className="mb-3" controlId={`${idPrefix}-credit-cost`} style={{ maxWidth: 260 }}>
      <Form.Label>{perRequirement ? 'Cost pe cerință' : 'Cost verificare'}</Form.Label>
      <Form.Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
      </Form.Select>
      <Form.Text>
        {perRequirement
          ? `Eseul întreg: ${creditsLabel(value * requirements)}.`
          : 'Credite luate elevului la fiecare verificare.'}
      </Form.Text>
    </Form.Group>
  );
}
