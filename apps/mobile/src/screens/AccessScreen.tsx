import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, creditsLabel, feedbackText, formatAccessDate, formatLei, plural, radius, space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, Spinner, goBackOrHome } from '../ui';
import { useAccess } from '../access/AccessProvider';
import { useAccessPurchase } from '../access/useAccessPurchase';
import { useAuth } from '../auth/AuthProvider';
import { useCredits } from '../credits/CreditsProvider';
import { fetchAccessHistory, type AccessHistoryEntry } from '../lib/access';

const DAYS_PER_MONTH = 30;

function historyLabel(h: AccessHistoryEntry): string {
  const months = h.months !== null ? plural(h.months, 'lună', 'luni') : null;
  if (h.kind === 'purchase') {
    return [formatAccessDate(new Date(h.createdAt)), months ? `Acces ${months}` : 'Acces', h.priceBani !== null ? formatLei(h.priceBani) : null]
      .filter(Boolean)
      .join(' · ');
  }
  if (h.kind === 'referral_reward') return 'Recomandări';
  if (h.kind === 'admin_grant') return months ? `Acces acordat · ${months}` : 'Acces acordat';
  return 'Acces retras';
}

/** „Abonamentul meu” (paid-access mockup, step 3): the plan, what it includes, renewing and the access history. */
export default function AccessScreen() {
  const { status, offer, refresh } = useAccess();
  const { purchase, pending, error } = useAccessPurchase();
  const { balance } = useCredits();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [history, setHistory] = useState<AccessHistoryEntry[]>([]);
  const [bought, setBought] = useState(false);

  useEffect(() => {
    void refresh(); // the plan must be fresh when the page opens
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetchAccessHistory(userId).then(
      (rows) => live && setHistory(rows),
      (e) => console.warn('[access] history could not be loaded:', e), // the section just stays hidden
    );
    return () => {
      live = false;
    };
  }, [userId, status]); // a purchase changes the status: the new entry shows up

  const full = status.plan === 'full' || status.plan === 'expiring';
  const trial = status.plan === 'trial';
  const months = offer?.durationMonths ?? 3;
  const price = offer ? formatLei(offer.priceBani) : null;
  // The period start isn't stored: the bar is the days left over the length of one offer period, clamped to 0..1.
  const fraction = full ? Math.min(1, Math.max(0, status.daysLeft / (months * DAYS_PER_MONTH))) : 0;
  const until = status.plan === 'trial' ? null : formatAccessDate(status.until);
  const verb = trial ? 'Deblochează' : status.plan === 'expired' ? 'Reînnoiește' : `Prelungește cu ${plural(months, 'lună', 'luni')}`;

  const buy = async () => {
    setBought(false); // a new attempt must not keep showing the previous success
    if (await purchase()) setBought(true);
  };

  const includes = [
    'Toate lecțiile',
    offer && offer.bonusCredits > 0 ? `+${plural(offer.bonusCredits, 'credit', 'credite')} la fiecare plată` : null,
    plural(months, 'lună', 'luni'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScreenLayout title="Abonamentul meu" onBack={goBackOrHome}>
      <View style={styles.stack}>
        <View style={[styles.card, full && styles.cardFull]}>
          {full ? (
            <>
              <AppText role="section">★ Acces complet</AppText>
              <AppText role="body">{`Activ până la ${until}`}</AppText>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
                style={styles.track}
              >
                <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
              </View>
              <AppText role="caption" color="textMuted">{`mai ai ${plural(status.daysLeft, 'zi', 'zile')}`}</AppText>
            </>
          ) : trial ? (
            <>
              <AppText role="section">Trial</AppText>
              <AppText role="body" color="textMuted">
                Ai deschisă doar lecția gratuită. Restul se deblochează cu accesul complet.
              </AppText>
            </>
          ) : (
            <>
              <AppText role="section">Acces expirat</AppText>
              <AppText role="body" color="textMuted">{`Accesul a expirat pe ${until}. Lecțiile terminate rămân marcate, dar sunt blocate.`}</AppText>
            </>
          )}
        </View>

        <View style={styles.card}>
          <AppText role="section" accessibilityRole="header">
            Ce include
          </AppText>
          <AppText role="body">{includes}</AppText>
        </View>

        {bought ? (
          <AppText role="bodyStrong" accessibilityLiveRegion="polite" style={styles.good}>
            Ai acces complet!
          </AppText>
        ) : null}
        {error ? (
          <AppText role="small" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </AppText>
        ) : null}
        {offer && price ? (
          <View style={styles.buy}>
            <Button label={`${verb} · ${price}`} loading={pending} onPress={buy} />
            {full && until ? (
              <AppText role="caption" color="textMuted" style={styles.center}>
                {`Lunile noi se adaugă după ${until}.`}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.center}>
            <Spinner accessibilityLabel="Se încarcă oferta" />
          </View>
        )}

        <View style={styles.balance}>
          <AppText role="body" style={styles.grow}>
            {balance !== null ? creditsLabel(balance) : '—'}
          </AppText>
          <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} hitSlop={8}>
            <AppText role="small" color="primaryStrong" style={styles.link}>
              Creditele mele
            </AppText>
          </Pressable>
        </View>

        {history.length > 0 ? (
          <View style={styles.section}>
            <AppText role="section" accessibilityRole="header">
              Istoric
            </AppText>
            {history.map((h, i) => (
              <View key={`${h.createdAt}-${i}`} style={styles.row}>
                <AppText role="bodyStrong">{historyLabel(h)}</AppText>
                {h.kind !== 'purchase' ? (
                  <AppText role="caption" color="textMuted">
                    {formatAccessDate(new Date(h.createdAt))}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, padding: space[4], gap: space[2] },
  cardFull: { borderColor: feedbackText.good },
  track: { height: 8, borderRadius: 4, backgroundColor: color.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: feedbackText.good },
  buy: { gap: space[2] },
  balance: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  grow: { flex: 1 },
  link: { textDecorationLine: 'underline' },
  section: { gap: space[2] },
  row: { gap: 2, borderBottomWidth: 1, borderBottomColor: color.border, paddingVertical: space[2.5] },
  center: { alignItems: 'center', textAlign: 'center' },
  good: { color: feedbackText.good },
  error: { color: feedbackText.wrong },
});
