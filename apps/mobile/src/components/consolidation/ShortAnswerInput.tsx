import { TextField } from '../../ui';
import { Field, MAX_CHARS, type InputProps } from './inputKit';

/** Răspuns scurt: one field; after checking its border is green / red. */
export default function ShortAnswerInput({ value, onChange, feedback, disabled }: InputProps<'short_answer'>) {
  return (
    <Field label="Răspunsul tău">
      <TextField
        value={value.text}
        onChangeText={(text) => onChange({ type: 'short_answer', text })}
        accessibilityLabel="Răspunsul tău"
        placeholder="Scrie răspunsul…"
        autoCorrect={false}
        autoComplete="off"
        maxLength={MAX_CHARS}
        editable={!disabled}
        status={feedback?.verdict ?? undefined}
      />
    </Field>
  );
}
