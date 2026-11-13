import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@prepio/shared';
import { AppText, Enter, feedbackConfig } from '../ui';
import { TOP_BAR_HEIGHT } from '../ui/TopBar';

// Slides in from above, since the toast sits at the top.
const toastConfig = { ...feedbackConfig, translateY: -feedbackConfig.translateY };

/** The first-exercise-of-the-day message, floating just below the top bar (safe-area top inset + bar height) on any screen. At the top so it never covers the primary action at the bottom. */
export default function StreakToast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View testID="streak-toast-wrap" style={[styles.wrap, { top: insets.top + TOP_BAR_HEIGHT }]}>
      <Enter config={toastConfig} style={styles.toast}>
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" testID="streak-toast">
          <AppText role="bodyStrong" style={styles.text}>{text}</AppText>
        </View>
      </Enter>
    </View>
  );
}

const styles = StyleSheet.create({
  // pointerEvents lives in style: the prop form is deprecated on react-native-web.
  wrap: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space[4] },
  toast: { backgroundColor: color.text, borderRadius: radius.lg, paddingVertical: space[3], paddingHorizontal: space[4], maxWidth: 480 },
  text: { color: color.bg, textAlign: 'center' },
});
