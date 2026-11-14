import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { color, formatAccessDate, formatLei, hasFullAccess, planTone, radius, space } from '@prepio/shared';
import { useCredits } from '../credits/CreditsProvider';
import { creditCount, dayCount, monthCount } from '../lib/counts';
import { t } from '../texts/store';
import { AppText } from '../ui';
import { useAccess } from './AccessProvider';

/** The Bucharest day („YYYY-MM-DD”) the renewal banner was last closed on. Best-effort, per device. */
export const BANNER_DISMISS_KEY = 'prepio.accessBanner.dismissedDay';

/** The calendar day in Europe/Bucharest, „YYYY-MM-DD”. */
export function bucharestDay(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** „Progresul și cele 18 credite rămân ale tale.” — the credits are not lost when access ends. */
function keptLine(balance: number | null): string {
  if (balance !== null && balance > 1) return t('access.banner.keptMany', { credite: creditCount(balance) });
  if (balance === 1) return t('access.banner.keptOne');
  return t('access.banner.keptNone');
}

/**
 * Home banner (paid-access mockup): in the trial and after expiry the offer with „Vezi oferta” / „Reînnoiește”
 * (opens the paywall sheet); in the last 7 days the orange renewal banner, which can be closed until the next
 * Bucharest day. Nothing with full access or for an admin. The dismissal lives in AsyncStorage (localStorage on
 * the web); when storage fails the banner simply shows.
 */
export default function AccessBanner({ onOffer }: { onOffer: () => void }) {
  const { status, offer, isAdmin } = useAccess();
  const { balance } = useCredits();
  // undefined while the stored dismissal is read (the renewal banner waits for it, so it does not flash).
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    (async () => {
      let day: string | null = null;
      try {
        day = (await AsyncStorage.getItem(BANNER_DISMISS_KEY)) ?? null;
      } catch {
        // Blocked / unavailable storage: show the banner.
      }
      if (live) setDismissed(day);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (isAdmin || !offer || status.plan === 'full') return null;
  const expiring = status.plan === 'expiring';
  if (expiring && (dismissed === undefined || dismissed === bucharestDay(new Date()))) return null;

  const price = formatLei(offer.priceBani);
  const months = monthCount(offer.durationMonths);
  const bonus = offer.bonusCredits;

  const close = () => {
    const today = bucharestDay(new Date());
    setDismissed(today);
    try {
      AsyncStorage.setItem(BANNER_DISMISS_KEY, today).catch(() => {});
    } catch {
      // Best-effort: hidden for this session only.
    }
  };

  if (expiring && hasFullAccess(status)) {
    const vars = {
      zile: dayCount(status.daysLeft),
      data: formatAccessDate(status.until),
      luni: months,
      adaugate: offer.durationMonths === 1 ? t('access.banner.addedOne') : t('access.banner.addedMany'),
    };
    return (
      <View testID="access-banner" style={[styles.banner, styles.warn]}>
        <View style={styles.row}>
          <AppText role="small" style={[styles.text, { color: planTone.expiring.fg }]}>
            {bonus > 0 ? t('access.banner.expiringBonus', { ...vars, credite: creditCount(bonus) }) : t('access.banner.expiring', vars)}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('access.banner.hide')} hitSlop={12} onPress={close} style={styles.close}>
            <AppText role="label" style={{ color: planTone.expiring.fg }}>
              ✕
            </AppText>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('access.banner.renew', { pret: price })} onPress={onOffer} style={[styles.cta, styles.ctaWarn]}>
          <AppText role="label" style={styles.ctaWarnText}>
            {t('access.banner.renew', { pret: price })}
          </AppText>
        </Pressable>
      </View>
    );
  }

  const trial = status.plan === 'trial';
  const label = trial ? t('access.banner.seeOffer', { pret: price }) : t('access.banner.renew', { pret: price });
  return (
    <View testID="access-banner" style={[styles.banner, styles.offer]}>
      {trial ? (
        <AppText role="small" style={[styles.text, styles.onOffer]}>
          <AppText role="small" style={[styles.onOffer, styles.strong]}>
            {t('access.banner.trialBold')}
          </AppText>
          {' '}
          {bonus > 0 ? t('access.banner.trialRestBonus', { luni: months, credite: creditCount(bonus) }) : t('access.banner.trialRest', { luni: months })}
        </AppText>
      ) : status.plan === 'expired' ? (
        <AppText role="small" style={[styles.text, styles.onOffer]}>
          {t('access.banner.expired', { data: formatAccessDate(status.until), pastrat: keptLine(balance) })}
        </AppText>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onOffer} style={[styles.cta, styles.ctaOffer]}>
        <AppText role="label" color="primary">
          {label}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.md, padding: space[3], gap: space[2], marginBottom: space[4] },
  offer: { backgroundColor: color.primary },
  warn: { backgroundColor: planTone.expiring.bg, borderWidth: 1, borderColor: planTone.expiring.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  // Long Romanian sentences wrap inside the banner at 360 px.
  text: { flexShrink: 1, flexGrow: 1 },
  onOffer: { color: color.onPrimary },
  strong: { fontWeight: '700' },
  close: { paddingHorizontal: space[1] },
  cta: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingVertical: space[1.5], paddingHorizontal: space[2.5] },
  ctaOffer: { backgroundColor: color.surface },
  ctaWarn: { backgroundColor: planTone.expiring.fg },
  ctaWarnText: { color: color.onPrimary },
});
