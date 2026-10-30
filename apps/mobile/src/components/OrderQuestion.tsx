import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { colors, radius, shuffleForDisplay, type Answer, type OrderItem } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

type Props = {
  /** Items in the correct order; shuffled here for display. */
  items: OrderItem[];
  answered: boolean;
  /** Set once answered. */
  correct: boolean | null;
  onSubmit: (answer: Answer) => void;
};

export default function OrderQuestion({ items, answered, correct, onSubmit }: Props) {
  const [order, setOrder] = useState(() => shuffleForDisplay(items));

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };

  return (
    <View style={styles.wrap}>
      {order.map((item, i) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.index}>{i + 1}.</Text>
          <Text testID="order-item-text" style={styles.text}>
            {item.text}
          </Text>
          {!answered ? (
            <View style={styles.buttons}>
              <IconButton
                icon="chevron-up"
                size={22}
                disabled={i === 0}
                accessibilityLabel={`Mută în sus: ${item.text}`}
                onPress={() => move(i, -1)}
              />
              <IconButton
                icon="chevron-down"
                size={22}
                disabled={i === order.length - 1}
                accessibilityLabel={`Mută în jos: ${item.text}`}
                onPress={() => move(i, 1)}
              />
            </View>
          ) : null}
        </View>
      ))}
      {!answered ? (
        <Button mode="contained" onPress={() => onSubmit({ type: 'chronological_order', order: order.map((o) => o.id) })}>
          Verifică
        </Button>
      ) : null}
      {answered && correct === false ? (
        <View style={styles.correctBox}>
          <Text style={styles.correctTitle}>Ordinea corectă:</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.correctRow}>
              {item.label ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{item.label}</Text>
                </View>
              ) : null}
              <Text style={styles.text}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
  },
  index: { fontFamily: fontFamily.bodyBold, color: colors.inkMuted, fontSize: 17 },
  text: { flex: 1, fontFamily: fontFamily.body, fontSize: 17, color: colors.ink, paddingVertical: 8 },
  buttons: { flexDirection: 'row' },
  correctBox: {
    gap: 6,
    padding: 12,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: '#E6F0E4',
  },
  correctTitle: { fontFamily: fontFamily.bodyBold, color: colors.success, fontSize: 17 },
  correctRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  chipText: { color: colors.paper, fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
