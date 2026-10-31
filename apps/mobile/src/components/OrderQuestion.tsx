import { StyleSheet, View } from 'react-native';
import { color, elevation, feedbackText, radius, space, type OrderItem } from '@prepio/shared';
import { AppText, Chip, Enter, IconButton } from '../ui';
import { solidShadow } from '../ui/elevation';

type Props = {
  /** Items in the learner's current order (owned by QuestionView). */
  order: OrderItem[];
  /** Items in the correct order. */
  items: OrderItem[];
  answered: boolean;
  /** Set once answered. */
  correct: boolean | null;
  onMove: (index: number, delta: -1 | 1) => void;
};

const BORDER = 2;

/** Chronological order question: rows with up/down buttons; once answered each row shows whether it's in place. */
export default function OrderQuestion({ order, items, answered, onMove }: Props) {
  return (
    <View style={styles.list}>
      {order.map((item, i) => {
        const inPlace = items[i]?.id === item.id;
        return (
          <Enter key={item.id} index={i}>
            <View style={[styles.row, answered && (inPlace ? styles.rowOk : styles.rowBad)]}>
              <AppText role="bodyStrong" color="textMuted" style={styles.index}>
                {i + 1}.
              </AppText>
              <AppText testID="order-item-text" role="option" style={styles.text}>
                {item.text}
              </AppText>
              {!answered ? (
                <View style={styles.buttons}>
                  <IconButton icon="up" disabled={i === 0} accessibilityLabel={`Mută în sus: ${item.text}`} onPress={() => onMove(i, -1)} />
                  <IconButton
                    icon="down"
                    disabled={i === order.length - 1}
                    accessibilityLabel={`Mută în jos: ${item.text}`}
                    onPress={() => onMove(i, 1)}
                  />
                </View>
              ) : null}
            </View>
          </Enter>
        );
      })}
    </View>
  );
}

/** Success-tinted box with the correct sequence (and year labels), shown in the content after a wrong order. */
export function CorrectOrder({ items }: { items: OrderItem[] }) {
  return (
    <View style={styles.correctBox}>
      <AppText role="bodyStrong" style={styles.correctTitle}>
        Ordinea corectă:
      </AppText>
      {items.map((item) => (
        <View key={item.id} style={styles.correctRow}>
          {item.label ? <Chip label={item.label} fg={feedbackText.good} bg={color.surface} /> : null}
          <AppText role="small" style={styles.text}>
            {item.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2.5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: space[12],
    paddingVertical: space[2],
    paddingLeft: space[3.5],
    paddingRight: space[2.5],
    backgroundColor: color.surface,
    borderWidth: BORDER,
    borderColor: color.border,
    borderRadius: radius.lg,
    boxShadow: solidShadow(elevation.optionRest.offsetY, elevation.optionRest.color),
  },
  rowOk: { borderColor: color.success, backgroundColor: color.successSubtle },
  rowBad: { borderColor: color.danger, backgroundColor: color.dangerSubtle },
  index: { minWidth: space[5] },
  text: { flex: 1 },
  buttons: { flexDirection: 'row', gap: space[2] },
  correctBox: {
    gap: space[2],
    padding: space[3.5],
    borderRadius: radius.lg,
    borderWidth: BORDER,
    borderColor: color.success,
    backgroundColor: color.successSubtle,
  },
  correctTitle: { color: feedbackText.good },
  correctRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
