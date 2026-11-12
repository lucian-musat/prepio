import { StyleSheet, View } from 'react-native';
import { CARD_TYPE_LABELS, color, radius, space, type Card } from '@prepio/shared';
import { AppText, Icon, Surface } from '../../ui';
import CardContentView from './CardContentView';

/**
 * One learning card: eyebrow row (position; the type chip only in the admin preview, `showType`), optional title,
 * then the typed content.
 */
export default function CardView({ card, eyebrow, showType = false }: { card: Card; eyebrow: string; showType?: boolean }) {
  return (
    <Surface padding={5} radius="xl">
      <View style={styles.eyebrowRow}>
        {showType ? (
          <View style={styles.chip}>
            <Icon name={card.type} size={14} tint={color.primary} />
            <AppText role="chip" color="primary">
              {CARD_TYPE_LABELS[card.type]}
            </AppText>
          </View>
        ) : null}
        <AppText role="eyebrow" color="primary">
          {eyebrow}
        </AppText>
      </View>
      {card.title ? (
        <AppText role="title" accessibilityRole="header" style={styles.title}>
          {card.title}
        </AppText>
      ) : null}
      <View style={styles.content}>
        <CardContentView card={card} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    backgroundColor: color.primarySubtle,
  },
  title: { marginTop: space[3] },
  content: { marginTop: space[3] },
});
