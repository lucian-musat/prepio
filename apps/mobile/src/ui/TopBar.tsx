import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { border, color, gradient, layout, radius, space } from '@prepio/shared';
import AppText from './AppText';
import IconButton from './IconButton';
import ProgressBar from './ProgressBar';
import { raisedShadow } from './elevation';
import { webTransition } from './motion';

/** Back to the previous screen, or to Home when the screen was opened directly (deep link / reload). */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type Props = {
  title?: string;
  logo?: boolean;
  progress?: number;
  /** Accessible name of the progress bar (default "Progres"). */
  progressLabel?: string;
  onBack?: () => void;
  /** Right-aligned control (e.g. the profile button). */
  trailing?: ReactNode;
  /** A full-width row under the progress (e.g. the consolidation exercise map). */
  below?: ReactNode;
  raised: boolean;
};

const LOGO_MARK = space[6] + space[1]; // 28 px
const HERO_POINTS = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }; // 135deg

function Logo() {
  return (
    <View style={styles.logo} accessibilityRole="header">
      <LinearGradient
        colors={[...gradient.hero.colors]}
        locations={[...gradient.hero.locations]}
        {...HERO_POINTS}
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <AppText role="logoMark" color="onPrimary">P</AppText>
      </LinearGradient>
      <AppText role="logo">Prepio</AppText>
    </View>
  );
}

/** Fixed screen header: back button, title or logo, and (optionally) the lesson progress. */
export default function TopBar({ title, logo = false, progress, progressLabel, onBack, trailing, below, raised }: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  return (
    <View testID="top-bar" style={[styles.bar, wide && styles.wide, raised && styles.raised]}>
      {onBack ? <IconButton icon="back" accessibilityLabel="Înapoi" onPress={onBack} /> : null}
      {logo ? <Logo /> : null}
      {title ? (
        <AppText role="bar" numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
      ) : null}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {progress !== undefined ? (
        // Full-width row so it always wraps under the title; the bar inside is capped at 720 px and centred.
        // (A max-width on the flex item itself lets it fit next to the title on wide screens.)
        <View style={styles.progressRow}>
          <View style={styles.progress}>
            <ProgressBar value={progress} accessibilityLabel={progressLabel} />
          </View>
        </View>
      ) : null}
      {below ? <View style={styles.below}>{below}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2.5],
    paddingTop: space[4],
    paddingHorizontal: layout.gutter,
    paddingBottom: space[3],
    backgroundColor: color.bg,
    borderBottomWidth: border.hairline,
    borderBottomColor: 'transparent',
    zIndex: 3,
    ...webTransition(['border-color', 'box-shadow']),
  },
  // Prototype desktop: 18 / 32 / 14.
  wide: { paddingTop: space[4.5], paddingHorizontal: layout.gutterWide, paddingBottom: space[3.5] },
  raised: { borderBottomColor: color.border, boxShadow: raisedShadow('down') },
  title: { flex: 1 },
  trailing: { marginLeft: 'auto' },
  progressRow: { flexBasis: '100%', width: '100%', marginTop: space[1.5] },
  progress: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }, // centred at 720 px on desktop, like the prototype
  below: { flexBasis: '100%', width: '100%' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  mark: { width: LOGO_MARK, height: LOGO_MARK, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
});
