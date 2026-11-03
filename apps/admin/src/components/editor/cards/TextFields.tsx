'use client';

import type { FieldsProps } from './CardForm';
import RichTextInput from './RichTextInput';

export default function TextFields({ idPrefix, draft, onChange }: FieldsProps<'text'>) {
  return (
    <RichTextInput
      id={`${idPrefix}-text`}
      label="Text"
      required
      value={draft.text}
      onChange={(text) => onChange({ ...draft, text })}
    />
  );
}
