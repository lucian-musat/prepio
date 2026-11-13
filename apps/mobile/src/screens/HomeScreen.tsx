import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { border, color, layout, radius, space } from '@prepio/shared';
import { AppText, Button, Chip, Enter, Hero, Icon, LessonListItem, ScreenLayout, Spinner, Surface } from '../ui';
import { fetchHome, type HomeData } from '../lib/content';
import { lessonCount } from '../lib/lessonCount';
import { lessonAccess, orderedLessons, type LessonState } from '../lib/lessonFlow';
import { MODE_INFO, modeOf } from '../lib/learningMode';
import { fetchProgress, type Progress } from '../lib/progress';
import { useAuth } from '../auth/AuthProvider';
import HeaderPills from '../streak/HeaderPills';
import { useAccess } from '../access/AccessProvider';
import AccessBanner from '../access/AccessBanner';
import PaywallSheet from '../access/PaywallSheet';
import InviteNote from '../components/InviteNote';
import ContinueCard from './home/ContinueCard';
import { continueTarget, lockedReason } from '../lib/homeContinue';
import { t } from '../texts/store';
import { progressBadge, useReferralSummary } from '../referrals/useReferralSummary';

// The prototype staggers the first six children (40 … 290 ms); later ones start with the sixth.
const LAST_STAGGER = 5;
const stagger = (i: number) => Math.min(i, LAST_STAGGER);

type Lesson = HomeData['sections'][number]['lessons'][number];

function pairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

/** A section's lessons: one column on phones, a two-column grid on wide screens (prototype desktop `.lessons`). */
function LessonList({
  lessons,
  wide,
  access,
  finished,
  numbers,
  onPaywall,
}: {
  lessons: Lesson[];
  wide: boolean;
  access: Map<string, LessonState>;
  finished: Set<string>;
  /** Each lesson's 1-based place in the whole Home order (guided mode is one order across sections). */
  numbers: Map<string, number>;
  onPaywall: (lessonId: string) => void;
}) {
  const item = (lesson: Lesson, i: number) => {
    const number = numbers.get(lesson.id) ?? i + 1;
    const state = access.get(lesson.id);
    return (
      <Enter key={lesson.id} testID={`enter-lesson-${lesson.id}`} index={stagger(i)} style={wide ? styles.cell : undefined}>
        <LessonListItem
          index={number - 1}
          number={number}
          title={lesson.title}
          state={state}
          reason={lockedReason(state, number)}
          finished={finished.has(lesson.id)}
          onPress={() => (state === 'paywall' ? onPaywall(lesson.id) : router.push(`/lesson/${lesson.id}`))}
        />
      </Enter>
    );
  };
  // A one-lesson section takes the full width instead of half a grid row.
  if (!wide || lessons.length === 1) return <View style={styles.lessons}>{lessons.map(item)}</View>;
  return (
    <View style={styles.lessons}>
      {pairs(lessons).map((row, r) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((lesson, c) => item(lesson, r * 2 + c))}
          {/* An odd last lesson keeps its half width, like a CSS grid cell. */}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Top-bar avatar: the name's initial (or "?"), opens the profile screen. */
function ProfileButton() {
  const { profile } = useAuth();
  const initial = profile?.displayName?.trim() ? [...profile.displayName.trim()][0].toUpperCase() : '?';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.profileLabel')}
      onPress={() => router.push('/profile')}
      style={styles.avatar}
    >
      <AppText role="bar" color="primaryStrong">
        {initial}
      </AppText>
    </Pressable>
  );
}

/** Top-bar trailing slot: the streak and credit pills, then the profile avatar. */
function HomeTrailing({ onSolve }: { onSolve?: () => void }) {
  return (
    <View style={styles.trailing}>
      <HeaderPills onSolve={onSolve} />
      <ProfileButton />
    </View>
  );
}

export default function HomeScreen() {
  const referral = useReferralSummary();
  const referralBadge = referral ? progressBadge(referral) : null;
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const [progress, setProgress] = useState<Progress | null>(null);
  const { profile } = useAuth();
  const { canOpen, refresh: refreshAccess, ready: accessReady } = useAccess();
  // The paywall sheet: for a tapped lesson outside the plan, or with no lesson (the banner's offer).
  const [sheet, setSheet] = useState<{ lessonId: string | null } | null>(null);
  const openPaywall = useCallback((lessonId: string) => setSheet({ lessonId }), []);
  // `/?paywall=<id>`: a locked deep link that LessonAccessGuard sent back here.
  const { paywall: paywallParam } = useLocalSearchParams<{ paywall?: string }>();
  const handledParam = useRef<string | null>(null);
  const loaded = useRef(false);
  const cancel = useRef<(() => void) | undefined>(undefined);

  // Home and progress load together. A refresh on refocus (back from a lesson) keeps the stale
  // list on screen and ignores a failure; only the first load shows the error surface.
  const fetchAll = useCallback(() => {
    cancel.current?.(); // a newer load supersedes an in-flight one
    let live = true;
    // Refocus also re-reads the plan and the free lesson (an admin may have reordered, or access may have ended).
    void refreshAccess();
    Promise.all([fetchHome(), fetchProgress()]).then(
      ([home, prog]) => {
        if (!live) return;
        loaded.current = true;
        setFailed(false);
        setData(home);
        setProgress(prog);
      },
      () => live && !loaded.current && setFailed(true),
    );
    cancel.current = () => {
      live = false;
    };
    return cancel.current;
  }, [refreshAccess]);

  // Blur / unmount cancels whichever load is latest, including one started by retry.
  useFocusEffect(
    useCallback(() => {
      fetchAll();
      return () => cancel.current?.();
    }, [fetchAll]),
  );

  // Once the lessons and the plan are known: open the sheet for a linked lesson the plan does not include; an
  // openable or unknown id only clears the parameter.
  useEffect(() => {
    if (!paywallParam) {
      handledParam.current = null; // the same link can open the sheet again later
      return;
    }
    if (handledParam.current === paywallParam || !data || !accessReady) return;
    handledParam.current = paywallParam;
    const known = orderedLessons(data.sections).some((l) => l.id === paywallParam);
    if (known && !canOpen(paywallParam)) setSheet({ lessonId: paywallParam });
    else router.setParams({ paywall: undefined });
  }, [paywallParam, data, accessReady, canOpen]);

  const closeSheet = () => {
    setSheet(null);
    if (paywallParam) router.setParams({ paywall: undefined });
  };
  const unlocked = () => {
    const id = sheet?.lessonId;
    closeSheet();
    if (id) router.push(`/lesson/${id}`);
  };

  const retry = () => {
    setFailed(false);
    setData(null);
    loaded.current = false;
    fetchAll();
  };

  if (failed) {
    return (
      <ScreenLayout logo trailing={<HomeTrailing />}>
        <Surface style={styles.error}>
          <AppText role="section">{t('home.loadFailed')}</AppText>
          <AppText role="small" color="textMuted">
            {t('errors.checkConnection')}
          </AppText>
          <Button label={t('common.retryButton')} onPress={retry} />
        </Surface>
      </ScreenLayout>
    );
  }

  if (!data || !progress || !accessReady) {
    return (
      <ScreenLayout logo trailing={<HomeTrailing />}>
        <View style={styles.loader}>
          <Spinner />
        </View>
      </ScreenLayout>
    );
  }

  const total = data.sections.reduce((sum, s) => sum + s.lessons.length, 0);
  const mode = modeOf(profile);
  const order = orderedLessons(data.sections);
  const numbers = new Map(order.map((l, i) => [l.id, i + 1]));
  const access = lessonAccess(order, progress.finished, mode, canOpen);
  const target = continueTarget(order, access, progress);
  const returning = progress.finished.size > 0 || progress.positions.size > 0;
  const name = profile?.displayName?.trim();
  const greeting = returning ? (name ? t('home.hero.welcomeBack', { nume: name }) : t('home.hero.welcomeBackNoName')) : undefined;
  // Lessons finished before the plan lost them still count as done.
  const done = orderedLessons(data.sections).filter((l) => progress.finished.has(l.id)).length;
  // Would the tapped lesson be playable with full access? (guided order may still lock it)
  const afterPurchase = sheet?.lessonId ? lessonAccess(orderedLessons(data.sections), progress.finished, mode, () => true).get(sheet.lessonId) : undefined;
  const sheetTitle = sheet?.lessonId ? orderedLessons(data.sections).find((l) => l.id === sheet.lessonId)?.title : undefined;
  const openLesson = (id: string) => router.push(`/lesson/${id}`);
  // The streak sheet's „Rezolvă un exercițiu” does what the continue card does.
  const solve = target ? () => openLesson(target.lesson.id) : undefined;

  return (
    <ScreenLayout logo trailing={<HomeTrailing onSolve={solve} />}>
      <AccessBanner onOffer={() => setSheet({ lessonId: null })} />
      <Enter testID="enter-hero" index={0}>
        <Hero lessonCount={total} greeting={greeting} />
      </Enter>
      <View style={styles.modeChip}>
        <Chip
          label={t('home.modeChip', { icon: MODE_INFO[mode].icon, mod: MODE_INFO[mode].name, terminate: done, total })}
          fg={color.primaryStrong}
          bg={color.primarySubtle}
        />
      </View>
      {target ? (
        <ContinueCard target={target} number={numbers.get(target.lesson.id) ?? 1} onPress={() => openLesson(target.lesson.id)} />
      ) : null}
      <InviteNote enabled={referral !== null} finishedCount={done} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.bac.title')} onPress={() => router.push('/bac')} style={styles.bacCard}>
        <Surface style={styles.bacRow}>
          <AppText role="section">📝</AppText>
          <View style={styles.bacText}>
            <AppText role="bodyStrong">{t('home.bac.title')}</AppText>
            <AppText role="small" color="textMuted">
              {t('home.bac.subtitle')}
            </AppText>
          </View>
          <View testID="bac-card-chevron" accessible={false}>
            <Icon name="chevron-right" tint={color.textMuted} />
          </View>
        </Surface>
      </Pressable>
      {data.sections.map((section, s) => {
        const title = section.path.join(' › ');
        // The last level is the title; the levels above it sit over it as a small line.
        const parents = section.path.slice(0, -1).join(' › ');
        return (
          <View key={`${s}:${title}`}>
            <Enter testID={`enter-section-${s}`} index={stagger(1 + 2 * s)} style={styles.header}>
              <View style={styles.headerTitle}>
                {parents ? (
                  <AppText role="caption" color="textMuted">
                    {parents}
                  </AppText>
                ) : null}
                <AppText role="section" accessibilityRole="header" accessibilityLabel={title}>
                  {section.path[section.path.length - 1]}
                </AppText>
              </View>
              <AppText role="caption" color="textMuted" style={styles.headerCount}>
                {lessonCount(section.lessons.length)}
              </AppText>
            </Enter>
            <LessonList lessons={section.lessons} wide={wide} access={access} finished={progress.finished} numbers={numbers} onPaywall={openPaywall} />
          </View>
        );
      })}
      {referral ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/invita')} style={styles.invite} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <AppText role="small" color="textMuted">
            {referralBadge ? t('home.invite.linkWithProgress', { progres: referralBadge }) : t('home.invite.link')}
          </AppText>
        </Pressable>
      ) : null}
      <PaywallSheet visible={sheet !== null} lessonTitle={sheetTitle} lessonCount={total} canOpenAfterPurchase={afterPurchase !== 'locked'} onClose={closeSheet} onUnlocked={unlocked} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  error: { gap: space[3] },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  avatar: {
    width: space[10],
    height: space[10],
    borderRadius: radius.pill,
    borderWidth: border.hairline,
    borderColor: color.border,
    backgroundColor: color.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChip: { marginBottom: space[4] },
  bacCard: { marginBottom: space[6] },
  bacRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  bacText: { flex: 1 },
  invite: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: space[4] },
  loader: { marginTop: space[12], alignItems: 'center' },
  // Prototype `.sec-title`: baseline-aligned title and count, 10 px above the list.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
    marginBottom: space[2.5],
  },
  headerTitle: { flexShrink: 1 },
  // Long paths wrap the title, never the count.
  headerCount: { flexShrink: 0 },
  // Prototype `.lessons`: 10 px gap, 24 px below each section.
  lessons: { gap: space[2.5], marginBottom: space[6] },
  row: { flexDirection: 'row', gap: space[2.5] },
  cell: { flex: 1 },
});
