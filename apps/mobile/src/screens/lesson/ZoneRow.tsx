import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { AppText } from '../../ui';

/** Tint of the consolidation zone (mockup `#EEE8FF`). */
export const CONSOLIDATION_TINT = '#EEE8FF';

type Props = {
  icon: string;
  title: string;
  subtitle: string;
  /** Extra line under the subtitle, e.g. why the zone is locked. */
  hint?: string;
  /** Tint behind the icon. */
  tint?: string;
  /** Right-hand marker: "✓" or a short call to action. */
  marker?: string;
  dimmed?: boolean;
  /** Outlined, for the zone to go to next. */
  highlight?: boolean;
  onPress?: () => void;
};

/** One zone of a lesson (mockup `.zone`): icon, name and a detail line; pressable when `onPress` is set. */
export default function ZoneRow({ icon, title, subtitle, hint, tint = color.primarySubtle, marker, dimmed, highlight, onPress }: Props) {
  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: tint }]}>
        <AppText role="section" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText role="bodyStrong">{title}</AppText>
        <AppText role="small" color="textMuted">
          {subtitle}
        </AppText>
        {hint ? (
          <AppText role="small" color="textMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
      {marker ? (
        <AppText role="label" color="primary">
          {marker}
        </AppText>
      ) : null}
    </>
  );
  const style = [styles.row, highlight && styles.highlight, dimmed && styles.dimmed];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={onPress} style={style}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.lg,
  },
  highlight: { borderWidth: 2, borderColor: color.primary },
  dimmed: { opacity: 0.55 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
