import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { border, color, consolidationColor, elevation, radius, readingMinutes, space, tokenizeSource, type Source, type SourceLabel } from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import { AppText } from '../../ui';
import { solidShadow } from '../../ui/elevation';

const PREVIEW_LINES = 4;
const PREVIEW = { size: 15, lineHeight: 25.5 }; // mockup .preview: Literata 15 / 1.7
const FADE = 60;

/** „3 paragrafe”, „1 paragraf”, „21 de paragrafe” (Romanian: „de” from 20 on). */
function paragraphs(n: number): string {
  if (n === 1) return '1 paragraf';
  return n % 100 >= 20 || n % 100 === 0 ? `${n} de paragrafe` : `${n} paragrafe`;
}

export function sourceMeta(source: Source): string {
  const n = tokenizeSource(source.body).paragraphCount;
  return [source.author, paragraphs(n), `~${readingMinutes(source.body)} min`].filter(Boolean).join(' · ');
}

type Props = { source: Source; label: SourceLabel; marking: boolean; onPress: () => void };

/**
 * Preview of a long source in the exercise (long-sources mockup `.srccard`): the letter tile, „Sursa B”, the
 * author with the paragraph count and reading time, the first lines fading out, and the button into the reader.
 * The whole card opens the reader.
 */
export default function SourceCard({ source, label, marking, onPress }: Props) {
  const action = marking ? '📖 Citește și marchează' : '📖 Citește sursa';
  const preview = source.body.split(/\r?\n[^\S\r\n]*\r?\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  return (
    <Pressable
      testID={`source-card-${label}`}
      accessibilityRole="button"
      accessibilityLabel={`Sursa ${label}, ${sourceMeta(source)}. ${marking ? 'Citește și marchează' : 'Citește sursa'}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.head}>
        <View style={styles.tile}>
          <AppText role="section" color="primary">
            {label}
          </AppText>
        </View>
        <View style={styles.fill}>
          <AppText role="bodyStrong">Sursa {label}</AppText>
          <AppText role="caption" color="textMuted">
            {sourceMeta(source)}
          </AppText>
        </View>
      </View>
      <View style={styles.preview} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text numberOfLines={PREVIEW_LINES} style={styles.previewText}>
          {preview}
        </Text>
        <LinearGradient colors={[`${consolidationColor.paper}00`, consolidationColor.paper]} style={styles.fade} pointerEvents="none" />
      </View>
      <View style={styles.open}>
        <AppText role="button" color="onPrimary">
          {action}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: {
    backgroundColor: consolidationColor.paper,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    boxShadow: solidShadow(elevation.card.offsetY, elevation.card.color),
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingTop: space[3], paddingHorizontal: space[3], paddingBottom: space[1.5] },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: color.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { paddingHorizontal: space[3.5], paddingTop: 2, maxHeight: PREVIEW.lineHeight * PREVIEW_LINES + 2, overflow: 'hidden' },
  previewText: { fontFamily: fontFamily.reading, fontSize: PREVIEW.size, lineHeight: PREVIEW.lineHeight, color: color.text },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE },
  open: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: space[3],
    padding: space[2.5],
    borderRadius: radius.sm,
    backgroundColor: color.primary,
    boxShadow: solidShadow(3, color.primaryStrong),
  },
});
