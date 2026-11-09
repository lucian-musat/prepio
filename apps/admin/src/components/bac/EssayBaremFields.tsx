'use client';

import { Form } from 'react-bootstrap';
import type { BacEssayStyle, EssayRequirement } from '@prepio/shared';
import BaremFields from './BaremFields';
import { essayRequirementPoints, stylePoints, type BaremDraft, type RequirementDraft } from './baremModel';

const STYLE: Array<[keyof BacEssayStyle, string]> = [
  ['language', 'Limbaj istoric'],
  ['structure', 'Structurare'],
  ['order', 'Succesiune'],
  ['length', 'Limita de spațiu'],
];

/** The essay's barem: a general text, one rule per requirement, then „Ordonarea și exprimarea ideilor”. */
export default function EssayBaremFields({ idPrefix, requirements, points, draft, onChange }: {
  idPrefix: string;
  requirements: EssayRequirement[];
  /** The item's points (the sum must match). */
  points: number;
  draft: BaremDraft;
  onChange: (next: BaremDraft) => void;
}) {
  const reqOf = (id: string): RequirementDraft => draft.requirements[id] ?? { text: '', steps: '', points: '' };
  const setReq = (id: string, patch: Partial<RequirementDraft>) =>
    onChange({ ...draft, requirements: { ...draft.requirements, [id]: { ...reqOf(id), ...patch } } });
  const setStyle = (key: keyof BacEssayStyle, v: string) => {
    const n = Number.parseInt(v, 10);
    onChange({ ...draft, style: { ...draft.style, [key]: Number.isFinite(n) && n >= 0 ? n : 0 } });
  };
  const reqSum = essayRequirementPoints(draft, requirements.map((r) => r.id));
  const rest = stylePoints(draft.style);

  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6 mb-2 fw-semibold">Barem</legend>
      <BaremFields
        idPrefix={`${idPrefix}-general`}
        label="Barem general"
        withSteps={false}
        points={points}
        draft={{ text: draft.text, steps: draft.steps }}
        onChange={(r) => onChange({ ...draft, ...r })}
      />
      {requirements.map((r, i) => {
        const n = i + 1;
        const q = reqOf(r.id);
        const id = `${idPrefix}-req-${r.id}`;
        return (
          <div key={r.id} className="border rounded p-2 mb-2">
            <Form.Group className="mb-2" controlId={`${id}-points`} style={{ maxWidth: 200 }}>
              <Form.Label>Punctaj cerință {n}</Form.Label>
              <Form.Control type="number" min={1} max={30} value={q.points} onChange={(e) => setReq(r.id, { points: e.target.value })} />
            </Form.Group>
            <BaremFields
              idPrefix={id}
              label={`Barem cerință ${n}`}
              stepsLabel={`Trepte cerință ${n}`}
              points={Number(q.points) || 0}
              draft={q}
              onChange={(next) => setReq(r.id, next)}
            />
          </div>
        );
      })}
      <fieldset className="border rounded p-2 mb-2">
        <legend className="form-label fs-6 mb-1 float-none w-auto px-1">Ordonarea și exprimarea ideilor</legend>
        <div className="d-flex flex-wrap gap-3">
          {STYLE.map(([key, label]) => (
            <Form.Group key={key} controlId={`${idPrefix}-style-${key}`} style={{ width: 150 }}>
              <Form.Label>{label}</Form.Label>
              <Form.Control type="number" min={0} max={10} value={draft.style[key]} onChange={(e) => setStyle(key, e.target.value)} />
            </Form.Group>
          ))}
        </div>
      </fieldset>
      <div className={reqSum + rest === points ? 'small text-secondary' : 'small text-danger'} data-testid="essay-sum">
        Cerințe {reqSum} p + ordonare {rest} p = {reqSum + rest} p
        {Number.isFinite(points) && reqSum + rest !== points && ` (punctajul cerinței este ${points} p)`}
      </div>
    </fieldset>
  );
}
