import { StyleSheet, View } from 'react-native';
import { space, type SourceLabel } from '@prepio/shared';
import { OptionRow, type OptionState } from '../../ui';
import type { InputProps } from './inputKit';

const LETTERS: SourceLabel[] = ['A', 'B'];

/**
 * Litera sursei: the single-choice rows A / B (the lesson questions' option UI). After checking the correct letter
 * is green and a wrong pick red; the evidence is highlighted in the source by the exercise screen.
 */
export default function LetterInput({ exercise, value, onChange, feedback, disabled }: InputProps<'source_letter'>) {
  const checked = feedback !== null;
  const stateOf = (l: SourceLabel): OptionState => {
    if (checked && l === exercise.correct) return 'correct';
    if (checked && l === value.letter) return 'wrong';
    return l === value.letter ? 'selected' : 'idle';
  };
  const labelOf = (l: SourceLabel) => {
    const s = stateOf(l);
    return s === 'correct' ? `Sursa ${l}, răspunsul corect` : s === 'wrong' ? `Sursa ${l}, alegerea ta, greșită` : `Sursa ${l}`;
  };
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {LETTERS.map((l) => (
        <OptionRow
          key={l}
          marker={l}
          label={`Sursa ${l}`}
          state={stateOf(l)}
          checked={l === value.letter}
          accessibilityLabel={labelOf(l)}
          disabled={disabled}
          onPress={() => onChange({ type: 'source_letter', letter: l })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: space[2.5] } });
