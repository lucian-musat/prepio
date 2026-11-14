import { StyleSheet } from 'react-native';
import { t } from '../../texts/store';
import { AppText, TextArea } from '../../ui';
import { Field, type InputProps } from './inputKit';

/** Asemănarea / deosebirea is one or two sentences (mockup counter „94 / 600”). */
export const COMPARISON_MAX = 600;

/** Asemănare / deosebire: one field with a character counter. */
export default function ComparisonInput({ value, onChange, feedback, disabled }: InputProps<'comparison'>) {
  return (
    <Field label={t('consolidation.input.yourAnswer')}>
      <TextArea
        value={value.text}
        onChangeText={(text) => onChange({ type: 'comparison', text })}
        accessibilityLabel={t('consolidation.input.yourAnswer')}
        placeholder={t('consolidation.input.comparison.placeholder')}
        maxLength={COMPARISON_MAX}
        editable={!disabled}
        status={feedback?.verdict ?? undefined}
      />
      <AppText role="caption" color="textMuted" style={styles.count}>
        {value.text.length} / {COMPARISON_MAX}
      </AppText>
    </Field>
  );
}

const styles = StyleSheet.create({ count: { textAlign: 'right' } });
