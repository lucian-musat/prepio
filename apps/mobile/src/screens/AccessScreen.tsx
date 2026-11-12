import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { color, creditsLabel, feedbackText, formatAccessDate, formatLei, gradient, plural, radius, space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, Spinner, goBackOrHome } from '../ui';
import { useAccess } from '../access/AccessProvider';
import { useAccessPurchase } from '../access/useAccessPurchase';
import { useAuth } from '../auth/AuthProvider';
import Coin from '../credits/Coin';
import { useCredits } from '../credits/CreditsProvider';
import { fetchAccessHistory, type AccessHistoryEntry } from '../lib/access';

const DAYS_PER_MONTH = 30;
const HERO_POINTS = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }; // 135deg, as the credits card

/** One history row, read like a credit row: what happened, the date under it, the amount on the right. */
function historyRow(h: AccessHistoryEntry): { title: string; amount: string | null } {
  const months = h.months !== null ? plural(h.months, 'lună', 'luni') : null;
  if (h.kind === 'purchase') return { title: months ? `Acces ${months}` : 'Acces', amount: h.priceBani !== null ? formatLei(h.priceBani) : null };
  if (h.kind === 'referral_reward') return { title: 'Acces gratuit din recomandări', amount: months ? `+${months}` : null };
  if (h.kind === 'admin_grant') return { title: 'Acces acordat', amount: months ? `+${months}` : null };
  return { title: 'Acces retras', amount: null };
}

/** „Acces la lecții” (paid-access mockup, step 3): the plan, what it includes, renewing and the access history. */
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
    <ScreenLayout title="Acces la lecții" onBack={goBackOrHome}>
      <View style={styles.stack}>
        {full ? (
          <LinearGradient colors={[...gradient.hero.colors]} locations={[...gradient.hero.locations]} {...HERO_POINTS} style={styles.hero}>
            <AppText role="eyebrow" color="onPrimary">
              Acces
            </AppText>
            <AppText role="section" color="onPrimary">
              ★ Acces complet
            </AppText>
            <AppText role="body" color="onPrimary">{`Activ până la ${until}`}</AppText>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
            </View>
            <AppText role="caption" color="onPrimary">{`mai ai ${plural(status.daysLeft, 'zi', 'zile')}`}</AppText>
          </LinearGradient>
        ) : (
          <View style={styles.card}>
            <AppText role="eyebrow" color="textMuted">
              Acces
            </AppText>
            {trial ? (
              <>
                <AppText role="section">Perioadă de probă</AppText>
                <AppText role="body" color="textMuted">
                  Acum ai deschisă doar lecția gratuită. Cu accesul complet le deschizi pe toate.
                </AppText>
              </>
            ) : (
              <>
                <AppText role="section">Acces expirat</AppText>
                <AppText role="body" color="textMuted">{`Accesul tău a expirat pe ${until}. Lecțiile terminate rămân bifate, dar nu le mai poți deschide.`}</AppText>
              </>
            )}
          </View>
        )}

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

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${balance !== null ? creditsLabel(balance) : 'Credite'} · Creditele mele`}
          onPress={() => router.push('/credits')}
          style={styles.balance}
        >
          <Coin size={22} />
          <AppText role="bodyStrong" style={styles.grow}>
            {balance !== null ? creditsLabel(balance) : '—'}
          </AppText>
          <AppText role="small" color="primaryStrong">
            Creditele mele ›
          </AppText>
        </Pressable>

        {history.length > 0 ? (
          <View style={styles.section}>
            <AppText role="section" accessibilityRole="header">
              Istoric
            </AppText>
            {history.map((h, i) => {
              const row = historyRow(h);
              return (
                <View key={`${h.createdAt}-${i}`} style={styles.row}>
                  <View style={styles.grow}>
                    <AppText role="bodyStrong">{row.title}</AppText>
                    <AppText role="caption" color="textMuted">
                      {formatAccessDate(new Date(h.createdAt))}
                    </AppText>
                  </View>
                  {row.amount ? <AppText role="bodyStrong">{row.amount}</AppText> : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  hero: { borderRadius: radius.lg, padding: space[5], gap: space[1.5] },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, padding: space[4], gap: space[2] },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', marginTop: space[2] },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.onPrimary },
  buy: { gap: space[2] },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space[4],
  },
  grow: { flex: 1 },
  section: { gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: space[2.5],
  },
  center: { alignItems: 'center', textAlign: 'center' },
  good: { color: feedbackText.good },
  error: { color: feedbackText.wrong },
});
