import { StyleSheet, View } from 'react-native';
import { space, type ExerciseAnswer } from '@prepio/shared';
import { TextArea } from '../../ui';
import MarkSlots from '../marker/MarkSlots';
import { Field, MAX_CHARS, slotVerdict, useMarkText, useMarksAnswer, verdictOf, type MarkerInputProps } from './inputKit';

const VIEWPOINT_HEIGHT = 80; // mockup: a sentence or two
const COUNT_WORDS = ['', 'o informație care îl susține', 'două informații care îl susțin', 'trei informații care îl susțin'];

/** Punct de vedere: 1 · the point of view, 2 · the support marked in the source. */
export default function ViewpointInput({ exercise, sources, value, onChange, feedback, disabled, marker }: MarkerInputProps<'viewpoint'>) {
  const textOf = useMarkText(sources);
  const marks = marker.state.marks;
  useMarksAnswer<Extract<ExerciseAnswer, { type: 'viewpoint' }>>(
    marks,
    (of) => ({ type: 'viewpoint', text: value.text, marks: of('support') }),
    value,
    onChange,
  );
  const support = COUNT_WORDS[exercise.count] ?? `${exercise.count} informații care îl susțin`;
  return (
    <View style={styles.parts}>
      <Field label="1 · Punctul tău de vedere">
        <TextArea
          value={value.text}
          onChangeText={(text) => onChange({ ...value, text })}
          accessibilityLabel="Punctul tău de vedere"
          placeholder="Consider că…"
          minHeight={VIEWPOINT_HEIGHT}
          maxLength={MAX_CHARS}
          editable={!disabled}
          status={verdictOf(feedback, 'viewpoint')}
        />
      </Field>
      <Field label={`2 · Marchează în sursă ${support}`}>
        <MarkSlots
          kind="support"
          count={exercise.count}
          state={marker.state}
          textOf={textOf}
          onOpen={() => {}}
          onRemove={(index) => marker.dispatch({ type: 'remove', index })}
          disabled={disabled}
          verdictOf={slotVerdict(feedback, marks)}
        />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({ parts: { gap: space[3] } });
