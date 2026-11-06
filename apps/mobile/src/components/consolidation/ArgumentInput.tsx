import { TextArea } from '../../ui';
import ConnectorChips from './ConnectorChips';
import { Field, MAX_CHARS, type InputProps } from './inputKit';

/** Argumentare: one field and the live connector chips. */
export default function ArgumentInput({ value, onChange, feedback, disabled }: InputProps<'argument'>) {
  return (
    <Field label="Argumentul tău">
      <TextArea
        value={value.text}
        onChangeText={(text) => onChange({ type: 'argument', text })}
        accessibilityLabel="Argumentul tău"
        placeholder="Faptul istoric, apoi conectorii: deoarece…, așadar…"
        maxLength={MAX_CHARS}
        editable={!disabled}
        status={feedback?.verdict ?? undefined}
      />
      <ConnectorChips text={value.text} />
    </Field>
  );
}
