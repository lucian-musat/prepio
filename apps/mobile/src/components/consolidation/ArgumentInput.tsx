import { t } from '../../texts/store';
import { TextArea } from '../../ui';
import ConnectorChips from './ConnectorChips';
import { Field, MAX_CHARS, type InputProps } from './inputKit';

/** Argumentare: one field and the live connector chips. */
export default function ArgumentInput({ value, onChange, feedback, disabled }: InputProps<'argument'>) {
  return (
    <Field label={t('consolidation.input.argument.label')}>
      <TextArea
        value={value.text}
        onChangeText={(text) => onChange({ type: 'argument', text })}
        accessibilityLabel={t('consolidation.input.argument.label')}
        placeholder={t('consolidation.input.argument.placeholder')}
        maxLength={MAX_CHARS}
        editable={!disabled}
        status={feedback?.verdict ?? undefined}
      />
      <ConnectorChips text={value.text} />
    </Field>
  );
}
