import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { color, feedbackText, formatAccessDate, plural, space } from '@prepio/shared';
import { AppText, Button, ProgressBar, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import { fetchMyReferrals, fetchReferralSummary, inviteUrl, monthsText, type ReferralRow, type ReferralSummary } from '../lib/referrals';
import { copyText, shareText } from '../lib/share';

const LOAD_FAILED = 'Nu am putut încărca invitațiile.';
const COPIED = 'Copiat ✓';
const COPY_FAILED = 'Nu am putut copia.';
const FEEDBACK_MS = 2500;
const CAP_REACHED = 'Ai atins limita de invitați recompensați; colegii noi nu mai aduc recompense.';
/** Below this width the two copy buttons stack, so their labels fit. */
const STACK_BELOW = 420;

const shareMessage = (link: string) => `Învață pentru BAC cu Prepio. Folosește linkul meu ca să te înregistrezi: ${link}`;

/** What a referral row says about itself, in the student's words. */
export function referralStatus(r: ReferralRow): string {
  switch (r.state) {
    case 'registered':
      return 'Cont creat, fără acces';
    case 'pending':
      return 'Cu acces · numără spre accesul gratuit';
    case 'consumed_access':
      return 'Cu acces · a contribuit la accesul gratuit';
    case 'converted_credits':
      return `Abonat · +${plural(r.rewardCredits, 'credit', 'credite')}`;
    case 'over_cap':
      return 'Abonat, fără recompensă (limita a fost atinsă)';
    default:
      return 'Abonat, fără recompensă';
  }
}

/** Over the cap new invitees bring nothing, so the screen promises nothing per colleague. */
function CapNote() {
  return (
    <AppText role="small" color="textMuted">
      {CAP_REACHED}
    </AppText>
  );
}

function SummaryBlock({ summary, rows }: { summary: ReferralSummary; rows: ReferralRow[] }) {
  if (!summary.hasAccess) {
    const left = Math.max(1, summary.threshold - summary.pendingCount);
    return (
      <Surface style={styles.stack}>
        {summary.capReached ? (
          <CapNote />
        ) : (
          <AppText role="bodyStrong">
            {`Încă ${plural(left, 'coleg', 'colegi')} care își cumpără acces și primești ${monthsText(summary.durationMonths)} gratis`}
          </AppText>
        )}
        <ProgressBar
          value={summary.threshold > 0 ? summary.pendingCount / summary.threshold : 0}
          accessibilityLabel="Progres spre accesul gratuit"
        />
        <AppText role="caption" color="textMuted">{`${summary.pendingCount} din ${summary.threshold}`}</AppText>
      </Surface>
    );
  }
  const subscribed = rows.filter((r) => r.state !== 'registered').length;
  const earned = summary.creditsEarned;
  const periods = summary.freePeriodsEarned;
  const totals = [
    plural(subscribed, 'abonat', 'abonați'),
    ...(earned > 0 ? [`${plural(earned, 'credit', 'credite')} ${earned === 1 ? 'câștigat' : 'câștigate'}`] : []),
    ...(periods > 0
      ? [periods === 1 ? 'o perioadă de acces gratuit câștigată' : `${periods} perioade de acces gratuit câștigate`]
      : []),
  ];
  return (
    <Surface style={styles.stack}>
      {summary.capReached ? (
        <CapNote />
      ) : (
        <AppText role="bodyStrong">{`Primești ${plural(summary.creditsPerInvitee, 'credit', 'credite')} pentru fiecare coleg care își cumpără acces`}</AppText>
      )}
      <AppText role="small" color="textMuted">
        {`Până acum: ${totals.join(' · ')}`}
      </AppText>
    </Surface>
  );
}

/** „Înregistrat 10 noiembrie 2026 · Abonat din 11 noiembrie 2026” (Bucharest dates), as the explainer promises. */
export function inviteeDates(r: ReferralRow): string {
  const registered = `Înregistrat ${formatAccessDate(new Date(r.createdAt))}`;
  return r.firstPaidAt ? `${registered} · Abonat din ${formatAccessDate(new Date(r.firstPaidAt))}` : registered;
}

function InviteeRow({ r }: { r: ReferralRow }) {
  const first = r.firstName?.trim() || 'Coleg';
  return (
    <View style={styles.row}>
      <AppText role="bodyStrong">{r.accountDeleted ? `${first} · cont șters` : first}</AppText>
      {!r.accountDeleted && r.email ? (
        <AppText role="caption" color="textMuted">
          {r.email}
        </AppText>
      ) : null}
      <AppText role="small" color="textMuted">
        {referralStatus(r)}
      </AppText>
      <AppText role="caption" color="textMuted">
        {inviteeDates(r)}
      </AppText>
    </View>
  );
}

/** „Invită colegi”: the student's code and link, how close they are to the reward, and their invitees. */
export default function InviteScreen() {
  const [data, setData] = useState<{ summary: ReferralSummary; rows: ReferralRow[] } | null>(null);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stacked = useWindowDimensions().width < STACK_BELOW;

  const load = useCallback(async () => {
    setError(false);
    setData(null);
    try {
      const [summary, rows] = await Promise.all([fetchReferralSummary(), fetchMyReferrals()]);
      if (mounted.current) setData({ summary, rows });
    } catch (e) {
      if (!mounted.current) return;
      console.warn('[referrals] the invite screen could not be loaded:', e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, [load]);

  const say = (text: string) => {
    setFeedback(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => mounted.current && setFeedback(''), FEEDBACK_MS);
  };
  const copy = async (text: string) => say((await copyText(text)) ? COPIED : COPY_FAILED);

  if (data && (!data.summary.enabled || !data.summary.code)) return <Redirect href="/" />;

  const code = data?.summary.code ?? '';
  const link = code ? inviteUrl(code) : '';
  const web = Platform.OS === 'web';

  const send = async () => {
    const r = await shareText(shareMessage(link));
    if (r === 'copied') say(COPIED);
    else if (r === 'failed') say(COPY_FAILED);
  };

  return (
    <ScreenLayout title="Invită colegi" onBack={goBackOrHome}>
      {error ? (
        <View style={styles.stack}>
          <AppText role="note" accessibilityRole="alert" style={styles.error}>
            {LOAD_FAILED}
          </AppText>
          <Button label="Reîncearcă" variant="secondary" onPress={() => void load()} />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Spinner accessibilityLabel="Se încarcă" />
        </View>
      ) : (
        <View style={styles.page}>
          <SummaryBlock summary={data.summary} rows={data.rows} />

          <Surface style={styles.stack}>
            <AppText role="caption" color="textMuted">
              Codul tău
            </AppText>
            <AppText role="section" selectable style={styles.code}>
              {code}
            </AppText>
            <Button label="Trimite linkul" onPress={() => void send()} />
            <View style={stacked ? styles.stack : styles.pair} testID="invite-copy-buttons">
              <Button label="Copiază linkul" variant="secondary" flex={!stacked} onPress={() => void copy(link)} />
              <Button label={web ? 'Copiază codul' : 'Trimite codul'} variant="secondary" flex={!stacked} onPress={() => void copy(code)} />
            </View>
            {feedback ? (
              <AppText role="small" accessibilityRole="alert" style={feedback === COPIED ? styles.ok : styles.error}>
                {feedback}
              </AppText>
            ) : null}
          </Surface>

          <View style={styles.stack}>
            <AppText role="section" accessibilityRole="header">
              Colegii invitați
            </AppText>
            {data.rows.length === 0 ? (
              <AppText role="note" color="textMuted">
                Încă nu ai invitat pe nimeni. Trimite linkul de mai sus.
              </AppText>
            ) : (
              data.rows.map((r) => <InviteeRow key={r.id} r={r} />)
            )}
          </View>

          <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={() => router.push('/recomandari')} style={styles.link}>
            Cum funcționează ›
          </AppText>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  page: { gap: space[5] },
  stack: { gap: space[3] },
  center: { alignItems: 'center', marginTop: space[12] },
  pair: { flexDirection: 'row', gap: space[2] },
  code: { letterSpacing: 2, color: color.primaryStrong },
  row: { gap: 2, borderBottomWidth: 1, borderBottomColor: color.border, paddingVertical: space[2.5] },
  error: { color: feedbackText.wrong },
  ok: { color: feedbackText.good },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start', minHeight: 44, paddingVertical: space[3], paddingRight: space[3] },
});
