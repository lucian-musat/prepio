import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, feedbackText, palette, planTone, radius, space } from '@prepio/shared';
import { useAccess } from '../access/AccessProvider';
import { creditCount, dayCount } from '../lib/counts';
import { t } from '../texts/store';
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

type Plan = { tone: keyof typeof planTone; text: string; label: string };

/** The plan half of the pill, always a word: „Probă”, „★ Acces”, the last 7 days „⏳ n zile”, „Expirat”. */
function usePlan(): Plan {
  const { status, isAdmin } = useAccess();
  if (isAdmin || status.plan === 'full') return { tone: 'full', text: t('credits.chip.full'), label: t('credits.chip.fullLabel') };
  if (status.plan === 'expiring') {
    const zile = dayCount(status.daysLeft);
    return { tone: 'expiring', text: t('credits.chip.expiring', { zile }), label: t('credits.chip.expiringLabel', { zile }) };
  }
  if (status.plan === 'expired') return { tone: 'expiring', text: t('credits.chip.expired'), label: t('credits.chip.expiredLabel') };
  return { tone: 'trial', text: t('credits.chip.trial'), label: t('credits.chip.trialLabel') };
}

/**
 * The top-bar pill: plan + coin + balance in one element („Probă · 🪙 12”, „★ Acces · 🪙 112”, „⏳ 5 zile · 🪙 40”),
 * red when the balance is below `need`; floats „−2” / „+50” on balance changes; opens „Acces la lecții”.
 */
export default function CreditChip({ need }: { need?: number }) {
  const { balance, change } = useCredits();
  const plan = usePlan();
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
  const tone = planTone[plan.tone];
  return (
    <View>
      <Pressable
        testID="credit-chip"
        accessibilityRole="button"
        accessibilityLabel={t('credits.chip.label', { plan: plan.label, credite: creditCount(balance) })}
        onPress={() => router.push('/abonament')}
        hitSlop={8}
        style={[styles.chip, low ? styles.low : { backgroundColor: tone.bg, borderColor: tone.border }]}
      >
        <AppText role="label" numberOfLines={1} style={{ color: tone.fg }}>
          {plan.text}
        </AppText>
        <Coin size={14} />
        <AppText role="label" style={{ color: low ? feedbackText.wrong : tone.fg }}>
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
  low: { backgroundColor: color.dangerSubtle, borderColor: palette.red[200] },
  float: { position: 'absolute', top: -space[1], right: 0, left: 0, alignItems: 'center' },
});
