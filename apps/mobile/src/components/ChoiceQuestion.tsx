import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { space, type ChoiceOption } from '@prepio/shared';
import { Enter, OptionRow, type OptionState } from '../ui';

type Props = {
  options: ChoiceOption[];
  multiple: boolean;
  answered: boolean;
  /** Ids the learner picked (owned by QuestionView). */
  selected: string[];
  onToggle: (id: string) => void;
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Prototype: after a wrong answer, the correct option turns green 300 ms after the wrong one shakes.
export const REVEAL_CORRECT_DELAY_MS = 300;

function stateOf(o: ChoiceOption, picked: boolean, answered: boolean, revealCorrect: boolean): OptionState {
  if (!answered) return picked ? 'selected' : 'idle';
  if (o.correct) return picked || revealCorrect ? 'correct' : 'idle';
  return picked ? 'wrong' : 'idle';
}

// After checking, the result is part of the name so screen readers hear it (colour alone is not enough).
function a11yLabel(o: ChoiceOption, picked: boolean, answered: boolean) {
  if (!answered || (!o.correct && !picked)) return o.text;
  return `${o.text}, ${o.correct ? 'corect' : 'greșit'}${picked ? ', ai ales-o' : ''}`;
}

/** Single / multiple choice options (prototype `.opts`): staggered OptionRows, display-only once answered. */
export default function ChoiceQuestion({ options, multiple, answered, selected, onToggle }: Props) {
  const reduced = useReducedMotion();
  const [revealCorrect, setRevealCorrect] = useState(false);
  useEffect(() => {
    if (!answered) return setRevealCorrect(false);
    if (reduced) return setRevealCorrect(true);
    const t = setTimeout(() => setRevealCorrect(true), REVEAL_CORRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [answered, reduced]);

  return (
    <View style={styles.list}>
      {options.map((o, i) => {
        const picked = selected.includes(o.id);
        return (
          <Enter key={o.id} index={i}>
            <OptionRow
              label={o.text}
              marker={multiple ? 'checkbox' : (LETTERS[i] ?? String(i + 1))}
              state={stateOf(o, picked, answered, revealCorrect)}
              // Checked = the learner picked it; a revealed correct answer they didn't pick stays unchecked.
              checked={picked}
              accessibilityLabel={a11yLabel(o, picked, answered)}
              onPress={answered ? undefined : () => onToggle(o.id)}
            />
          </Enter>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2.5] },
});
