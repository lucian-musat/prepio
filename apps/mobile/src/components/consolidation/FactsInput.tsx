import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { TextArea } from '../../ui';
import { Field, MAX_CHARS, verdictOf, type InputProps } from './inputKit';

// Mockup `textarea.in`: 110 px, two of them on a phone screen.
const FACT_HEIGHT = 110;

/** Prezentare fapte: one field per fact, each coloured from that fact's feedback. */
export default function FactsInput({ exercise, value, onChange, feedback, disabled }: InputProps<'facts'>) {
  const set = (i: number, text: string) => onChange({ type: 'facts', texts: value.texts.map((t, k) => (k === i ? text : t)) });
  return (
    <View style={styles.list}>
      {Array.from({ length: exercise.count }, (_, i) => (
        <Field key={i} label={`Faptul istoric ${i + 1}`}>
          <TextArea
            value={value.texts[i] ?? ''}
            onChangeText={(t) => set(i, t)}
            accessibilityLabel={`Faptul istoric ${i + 1}`}
            placeholder="Ce s-a întâmplat, când, cine…"
            minHeight={FACT_HEIGHT}
            maxLength={MAX_CHARS}
            editable={!disabled}
            status={verdictOf(feedback, `fact-${i}`)}
          />
        </Field>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: space[2.5] } });
