import { StyleSheet, View } from 'react-native';
import { color, radius, space, type Card, type CardType, type TextKey } from '@prepio/shared';
import { AppText, Icon, Surface } from '../../ui';
import CardContentView from './CardContentView';
import { t } from '../../texts/store';

/** The type chip of the admin preview. */
const TYPE_LABELS: Record<CardType, TextKey> = {
  text: 'cards.type.text',
  images: 'cards.type.images',
  video: 'cards.type.video',
  timeline: 'cards.type.timeline',
  schema: 'cards.type.schema',
  link: 'cards.type.link',
};

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
              {t(TYPE_LABELS[card.type])}
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
