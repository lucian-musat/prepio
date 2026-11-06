import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { TextField } from '../../ui';
import { Field, MAX_CHARS, type InputProps } from './inputKit';

/** Răspunsuri multiple: N numbered fields, each coloured from its own verdict after checking. */
export default function MultiAnswerInput({ exercise, value, onChange, feedback, disabled }: InputProps<'multi_answer'>) {
  const set = (i: number, text: string) => onChange({ type: 'multi_answer', texts: value.texts.map((t, k) => (k === i ? text : t)) });
  return (
    <View style={styles.list}>
      {Array.from({ length: exercise.count }, (_, i) => (
        <Field key={i} label={`${i + 1}.`}>
          <TextField
            value={value.texts[i] ?? ''}
            onChangeText={(t) => set(i, t)}
            accessibilityLabel={`Răspunsul ${i + 1}`}
            placeholder="Scrie răspunsul…"
            autoCorrect={false}
            autoComplete="off"
            maxLength={MAX_CHARS}
            editable={!disabled}
            status={feedback?.fields?.[i]}
          />
        </Field>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: space[2.5] } });
