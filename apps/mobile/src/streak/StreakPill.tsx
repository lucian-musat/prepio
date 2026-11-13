import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { color, plural, radius, space } from '@prepio/shared';
import { AppText } from '../ui';
import StreakSheet from './StreakSheet';
import { useStreak } from './StreakProvider';

/**
 * The top-bar streak pill „🔥 5” (yellow tint while the streak is alive, grey „🔥 0” without one); opens the details
 * sheet. Renders nothing until the streak is known.
 */
export default function StreakPill({ onSolve }: { onSolve?: () => void }) {
  const { summary } = useStreak();
  const [open, setOpen] = useState(false);
  if (!summary) return null;
  const alive = summary.current > 0;
  return (
    <>
      <Pressable
        testID="streak-pill"
        accessibilityRole="button"
        accessibilityLabel={`Serie de ${plural(summary.current, 'zi', 'zile')}, deschide detaliile`}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[styles.pill, { backgroundColor: alive ? color.accentSubtle : color.surfaceMuted }]}
      >
        <AppText role="label" style={{ color: alive ? color.onAccent : color.textMuted }}>
          {`🔥 ${summary.current}`}
        </AppText>
      </Pressable>
      <StreakSheet visible={open} onClose={() => setOpen(false)} onSolve={onSolve} />
    </>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingVertical: space[1], paddingHorizontal: space[2] },
});
