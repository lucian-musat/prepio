import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, RadioButton } from 'react-native-paper';
import { legacyColors, legacyRadius, type Answer, type ChoiceOption } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

type Props = {
  type: 'single_choice' | 'multiple_choice';
  options: ChoiceOption[];
  answered: boolean;
  onSubmit: (answer: Answer) => void;
};

export default function ChoiceQuestion({ type, options, answered, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const multiple = type === 'multiple_choice';

  const toggle = (id: string) => {
    if (answered) return;
    if (!multiple) setSelected([id]);
    else setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const isSelected = selected.includes(o.id);
        const status: 'checked' | 'unchecked' = isSelected ? 'checked' : 'unchecked';
        const rowStyle = [
          styles.row,
          answered && o.correct && styles.rowCorrect,
          answered && isSelected && !o.correct && styles.rowWrong,
        ];
        const common = {
          label: o.text,
          status,
          onPress: () => toggle(o.id),
          disabled: answered,
          style: rowStyle,
          labelStyle: styles.label,
          color: legacyColors.bordeaux,
          position: 'leading' as const,
        };
        return multiple ? (
          <Checkbox.Item key={o.id} {...common} />
        ) : (
          <RadioButton.Item key={o.id} {...common} value={o.id} />
        );
      })}
      {!answered ? (
        <Button
          mode="contained"
          disabled={selected.length === 0}
          onPress={() => onSubmit({ type, selected })}
        >
          Verifică
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    backgroundColor: legacyColors.paper,
    borderWidth: 1,
    borderColor: legacyColors.border,
    borderRadius: legacyRadius,
  },
  rowCorrect: { borderColor: legacyColors.success, backgroundColor: '#E6F0E4', borderWidth: 2 },
  rowWrong: { borderColor: legacyColors.error, backgroundColor: '#F6E3E1', borderWidth: 2 },
  label: { fontFamily: fontFamily.body, fontSize: 17, color: legacyColors.ink, textAlign: 'left' },
});
