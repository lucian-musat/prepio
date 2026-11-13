import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@prepio/shared';
import { AppText, Enter, feedbackConfig } from '../ui';

/** The first-exercise-of-the-day message, floating above the bottom safe-area inset on any screen. */
export default function StreakToast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + space[4] }]}>
      <Enter config={feedbackConfig} style={styles.toast}>
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
