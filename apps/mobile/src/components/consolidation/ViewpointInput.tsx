import { StyleSheet, View } from 'react-native';
import { space, type ExerciseAnswer, type TextKey } from '@prepio/shared';
import { t } from '../../texts/store';
import { TextArea } from '../../ui';
import MarkSlots from '../marker/MarkSlots';
import { Field, MAX_CHARS, slotVerdict, useMarkText, useMarksAnswer, verdictOf, type MarkerInputProps } from './inputKit';

const VIEWPOINT_HEIGHT = 80; // mockup: a sentence or two
const COUNT_KEYS: Array<TextKey | null> = [
  null,
  'consolidation.input.viewpoint.support.one',
  'consolidation.input.viewpoint.support.two',
  'consolidation.input.viewpoint.support.three',
];

/** Punct de vedere: 1 · the point of view, 2 · the support marked in the source. */
export default function ViewpointInput({ exercise, sources, value, onChange, feedback, disabled, marker }: MarkerInputProps<'viewpoint'>) {
  const textOf = useMarkText(sources);
  const marks = marker.state.marks;
  const numbered = !!marker.cfg.numbered;
  useMarksAnswer<Extract<ExerciseAnswer, { type: 'viewpoint' }>>(
    marks,
    (of) => ({ type: 'viewpoint', text: value.text, marks: of('support') }),
    value,
    onChange,
  );
  const countKey = COUNT_KEYS[exercise.count];
  const support = countKey ? t(countKey) : t('consolidation.input.viewpoint.support.many', { n: exercise.count });
  return (
    <View style={styles.parts}>
      <Field label={t('consolidation.input.viewpoint.label')}>
        <TextArea
          value={value.text}
          onChangeText={(text) => onChange({ ...value, text })}
          accessibilityLabel={t('consolidation.input.viewpoint.fieldLabel')}
          placeholder={t('consolidation.input.viewpoint.placeholder')}
          minHeight={VIEWPOINT_HEIGHT}
          maxLength={MAX_CHARS}
          editable={!disabled}
          status={verdictOf(feedback, 'viewpoint')}
        />
      </Field>
      <Field label={t('consolidation.input.viewpoint.markLabel', { informatii: support })}>
        <MarkSlots
          kind="support"
          count={exercise.count}
          numbered={numbered}
          state={marker.state}
          textOf={textOf}
          onOpen={(_pen, _index, slot) => numbered && marker.dispatch({ type: 'setSlot', slot })}
          onRemove={(index) => marker.dispatch({ type: 'remove', index })}
          disabled={disabled}
          verdictOf={slotVerdict(feedback, marks)}
        />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({ parts: { gap: space[3] } });
