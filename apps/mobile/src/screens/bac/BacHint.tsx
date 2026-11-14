import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, feedbackText, markerPen, radius, space } from '@prepio/shared';
import RichText from '../../components/cards/RichText';
import { AppText, Icon } from '../../ui';
import { t } from '../../texts/store';

/**
 * „💡 Cum rezolv” on a BAC item: the solution template's body in a collapsible block, collapsed by default (owner,
 * 2026-11-10: open it took most of the screen). Each item mounts its own block, so every item starts collapsed.
 */
export default function BacHint({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.box} testID="bac-hint">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? t('bac.hint.hide') : t('bac.hint.show')}
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
      >
        <AppText role="label" style={styles.title}>
          {t('consolidation.exercise.howTo')}
        </AppText>
        <View testID={open ? 'bac-hint-chevron-up' : 'bac-hint-chevron-down'} accessible={false}>
          <Icon name={open ? 'up' : 'down'} tint={feedbackText.almost} />
        </View>
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
