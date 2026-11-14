import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { color, feedbackText, formatAccessDate, gradient, radius, space } from '@prepio/shared';
import { AppText, Button, ProgressBar, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import { fetchMyReferrals, fetchReferralSummary, inviteUrl, monthsText, type ReferralRow, type ReferralSummary } from '../lib/referrals';
import { colleagueCount, creditCount } from '../lib/counts';
import { copyText, shareText } from '../lib/share';
import { t } from '../texts/store';

const FEEDBACK_MS = 2500;
/** Below this width the two copy buttons stack, so their labels fit. */
const STACK_BELOW = 420;

const shareMessage = (link: string) => t('invite.shareMessage', { link });

/** What a referral row says about itself, in the student's words. */
export function referralStatus(r: ReferralRow): string {
  switch (r.state) {
    case 'registered':
      return t('invite.status.registered');
    case 'pending':
      return t('invite.status.pending');
    case 'consumed_access':
      return t('invite.status.consumedAccess');
    case 'converted_credits':
      return t('invite.status.convertedCredits', { credite: creditCount(r.rewardCredits) });
    case 'over_cap':
      return t('invite.status.overCap');
    default:
      return t('invite.status.noReward');
  }
}

const HERO_POINTS = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }; // 135deg, as the credits card

/** The three steps, with the reward that applies to this student right now. */
function HowItWorks({ summary }: { summary: ReferralSummary }) {
  const reward = summary.hasAccess
    ? t('invite.how.rewardCredits', { credite: creditCount(summary.creditsPerInvitee) })
    : t('invite.how.rewardFree', { prag: summary.threshold, durata: monthsText(summary.durationMonths) });
  // Over the cap new invitees bring nothing: the summary below says so, the steps promise nothing.
  const steps = [t('invite.how.step1'), t('invite.how.step2'), ...(summary.capReached ? [] : [reward])];
  return (
    <LinearGradient colors={[...gradient.hero.colors]} locations={[...gradient.hero.locations]} {...HERO_POINTS} style={styles.hero}>
      <AppText role="eyebrow" color="onPrimary" accessibilityRole="header">
        {t('invite.how.title')}
      </AppText>
      {steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.stepNo}>
            <AppText role="small" style={styles.stepNoText}>
              {String(i + 1)}
            </AppText>
          </View>
          <AppText role="body" color="onPrimary" style={styles.grow}>
            {s}
          </AppText>
        </View>
      ))}
    </LinearGradient>
  );
}

/** Over the cap new invitees bring nothing, so the screen promises nothing per colleague. */
function CapNote() {
  return (
    <AppText role="small" color="textMuted">
      {t('invite.capReached')}
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
            {t('invite.summary.needMore', { colegi: colleagueCount(left), durata: monthsText(summary.durationMonths) })}
          </AppText>
        )}
        <ProgressBar
          value={summary.threshold > 0 ? summary.pendingCount / summary.threshold : 0}
          accessibilityLabel={t('invite.summary.progressLabel')}
        />
        <AppText role="caption" color="textMuted">{t('invite.summary.progress', { n: summary.pendingCount, total: summary.threshold })}</AppText>
      </Surface>
    );
  }
  const subscribed = rows.filter((r) => r.state !== 'registered').length;
  const earned = summary.creditsEarned;
  const periods = summary.freePeriodsEarned;
  const totals = [
    t('invite.summary.withAccess', { colegi: colleagueCount(subscribed) }),
    ...(earned > 0
      ? [t(earned === 1 ? 'invite.summary.creditsEarnedOne' : 'invite.summary.creditsEarnedMany', { credite: creditCount(earned) })]
      : []),
    ...(periods > 0 ? [periods === 1 ? t('invite.summary.periodOne') : t('invite.summary.periodMany', { n: periods })] : []),
  ];
  return (
    <Surface style={styles.stack}>
      {/* The steps above state the reward; here only the cap note and the totals. */}
      {summary.capReached ? <CapNote /> : null}
      <AppText role="body">
        {t('invite.summary.soFar', { totaluri: totals.join(' · ') })}
      </AppText>
    </Surface>
  );
}

/** „Cont creat pe 10 noiembrie 2026 · acces din 11 noiembrie 2026” (Bucharest dates), as the explainer promises. */
export function inviteeDates(r: ReferralRow): string {
  const registered = t('invite.list.registered', { data: formatAccessDate(new Date(r.createdAt)) });
  return r.firstPaidAt ? `${registered} · ${t('invite.list.paid', { data: formatAccessDate(new Date(r.firstPaidAt)) })}` : registered;
}

function InviteeRow({ r }: { r: ReferralRow }) {
  const first = r.firstName?.trim() || t('invite.list.anonymous');
  return (
    <View style={styles.row}>
      <AppText role="bodyStrong">{r.accountDeleted ? t('invite.list.deleted', { nume: first }) : first}</AppText>
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
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'failed'; text: string } | null>(null);
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

  /** Shows the outcome of a copy / share for a moment; the colour follows the kind, never the (editable) text. */
  const say = (kind: 'ok' | 'failed') => {
    setFeedback({ kind, text: kind === 'ok' ? t('invite.copied') : t('invite.copyFailed') });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => mounted.current && setFeedback(null), FEEDBACK_MS);
  };
  const copy = async (text: string) => say((await copyText(text)) ? 'ok' : 'failed');

  if (data && (!data.summary.enabled || !data.summary.code)) return <Redirect href="/" />;

  const code = data?.summary.code ?? '';
  const link = code ? inviteUrl(code) : '';
  const web = Platform.OS === 'web';

  const send = async () => {
    const r = await shareText(shareMessage(link));
    if (r === 'copied') say('ok');
    else if (r === 'failed') say('failed');
  };

  return (
    <ScreenLayout title={t('invite.screen.title')} onBack={goBackOrHome}>
      {error ? (
        <View style={styles.stack}>
          <AppText role="note" accessibilityRole="alert" style={styles.error}>
            {t('invite.loadFailed')}
          </AppText>
          <Button label={t('common.retryButton')} variant="secondary" onPress={() => void load()} />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Spinner accessibilityLabel={t('common.loading')} />
        </View>
      ) : (
        <View style={styles.page}>
          <HowItWorks summary={data.summary} />
          <SummaryBlock summary={data.summary} rows={data.rows} />

          <Surface style={styles.stack}>
            <AppText role="caption" color="textMuted">
              {t('invite.code.label')}
            </AppText>
            <AppText role="section" selectable style={styles.code}>
              {code}
            </AppText>
            <Button label={t('invite.code.sendLink')} onPress={() => void send()} />
            <View style={stacked ? styles.stack : styles.pair} testID="invite-copy-buttons">
              <Button label={t('invite.code.copyLink')} variant="secondary" flex={!stacked} onPress={() => void copy(link)} />
              <Button label={web ? t('invite.code.copyCode') : t('invite.code.sendCode')} variant="secondary" flex={!stacked} onPress={() => void copy(code)} />
            </View>
            {feedback ? (
              <AppText role="small" accessibilityRole="alert" style={feedback.kind === 'ok' ? styles.ok : styles.error}>
                {feedback.text}
              </AppText>
            ) : null}
          </Surface>

          <View style={styles.stack}>
            <AppText role="section" accessibilityRole="header">
              {t('invite.list.title')}
            </AppText>
            {data.rows.length === 0 ? (
              <AppText role="note" color="textMuted">
                {t('invite.list.empty')}
              </AppText>
            ) : (
              data.rows.map((r) => <InviteeRow key={r.id} r={r} />)
            )}
          </View>

          <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={() => router.push('/recomandari')} style={styles.link}>
            {t('invite.rules')}
          </AppText>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  page: { gap: space[5] },
  hero: { borderRadius: radius.lg, padding: space[5], gap: space[3] },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNoText: { color: color.primaryStrong, fontWeight: '700' },
  grow: { flex: 1 },
  stack: { gap: space[3] },
  center: { alignItems: 'center', marginTop: space[12] },
  pair: { flexDirection: 'row', gap: space[2] },
  code: { letterSpacing: 2, color: color.primaryStrong },
  row: { gap: 2, borderBottomWidth: 1, borderBottomColor: color.border, paddingVertical: space[2.5] },
  error: { color: feedbackText.wrong },
  ok: { color: feedbackText.good },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start', minHeight: 44, paddingVertical: space[3], paddingRight: space[3] },
});
