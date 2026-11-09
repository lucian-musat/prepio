import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, feedbackText, markerPen, radius, space } from '@prepio/shared';
import RichText from '../../components/cards/RichText';
import { AppText } from '../../ui';

/**
 * „💡 Cum rezolv” on a BAC item: the solution template's body in a collapsible block, open by default (the paper has
 * no checks, so the method stays in view while the student writes).
 */
export default function BacHint({ body }: { body: string }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.box} testID="bac-hint">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Ascunde indicațiile' : 'Arată indicațiile'}
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
      >
        <AppText role="label" style={styles.title}>
          💡 Cum rezolv
        </AppText>
        <AppText role="label" style={styles.title} accessible={false}>
          {open ? '▲' : '▼'}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <RichText source={body} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: color.accentSubtle,
    borderWidth: 1.5,
    borderColor: markerPen.info, // the same yellow as the consolidation „💡 Cum rezolv” pill
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space[3] },
  title: { color: feedbackText.almost },
  body: { paddingHorizontal: space[3], paddingBottom: space[3] },
});
