'use client';

import { useId } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { CARD_TYPES, CARD_TYPE_LABELS, type CardType } from '@prepio/shared';

/** Six radio toggle buttons, one per card type. Confirming a destructive change is the caller's job. */
export default function TypePicker({ value, onChange }: { value: CardType; onChange: (type: CardType) => void }) {
  const name = useId();
  return (
    <ToggleButtonGroup
      type="radio"
      name={name}
      value={value}
      onChange={(t: CardType) => onChange(t)}
      role="radiogroup"
      aria-label="Tipul cardului"
      className="flex-wrap"
    >
      {CARD_TYPES.map((t) => (
        <ToggleButton key={t} id={`${name}-${t}`} value={t} variant="outline-primary">
          {CARD_TYPE_LABELS[t]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
