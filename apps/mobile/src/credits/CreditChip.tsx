import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, creditsLabel, feedbackText, palette, radius, space } from '@prepio/shared';
import { AppText } from '../ui';
import { easing, timing } from '../ui/motion';
import Coin from './Coin';
import { useCredits } from './CreditsProvider';

const FLOAT_MS = 900;
const FLOAT_RISE = 18;

/** „−2” / „+50” rising from the chip and fading out. */
function Floating({ delta }: { delta: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, timing(FLOAT_MS, easing.out));
    // Mount-only: a new change remounts this (keyed by the change id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateY: -p.value * FLOAT_RISE }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.float, style]}>
      <AppText role="label" style={{ color: delta < 0 ? feedbackText.wrong : feedbackText.good }}>
        {delta < 0 ? `−${-delta}` : `+${delta}`}
      </AppText>
    </Animated.View>
  );
}

/** Balance pill for the top bars: coin + balance, red when below `need`; opens the credits page. */
export default function CreditChip({ need }: { need?: number }) {
  const { balance, change } = useCredits();
  const reduced = useReducedMotion();
  const seen = useRef(change?.id ?? 0); // a change from before this chip mounted is not replayed
  const [floating, setFloating] = useState<{ id: number; delta: number } | null>(null);
  useEffect(() => {
    if (!change || change.id === seen.current) return;
    seen.current = change.id;
    if (reduced) return;
    setFloating(change);
    const t = setTimeout(() => setFloating((f) => (f?.id === change.id ? null : f)), FLOAT_MS);
    return () => clearTimeout(t);
  }, [change, reduced]);

  if (balance === null) return null;
  const low = need !== undefined && balance < need;
  return (
    <View>
      <Pressable
        testID="credit-chip"
        accessibilityRole="button"
        accessibilityLabel={`Ai ${creditsLabel(balance)}. Deschide creditele mele.`}
        onPress={() => router.push('/credits')}
        hitSlop={8}
        style={[styles.chip, low ? styles.low : styles.normal]}
      >
        <Coin size={14} />
        <AppText role="label" style={{ color: low ? feedbackText.wrong : palette.yellow[800] }}>
          {balance}
        </AppText>
      </Pressable>
      {floating ? <Floating key={floating.id} delta={floating.delta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
  normal: { backgroundColor: color.accentSubtle, borderColor: palette.yellow[200] },
  low: { backgroundColor: color.dangerSubtle, borderColor: palette.red[200] },
  float: { position: 'absolute', top: -space[1], right: 0, left: 0, alignItems: 'center' },
});
