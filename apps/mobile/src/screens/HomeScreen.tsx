import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { border, color, layout, radius, space } from '@prepio/shared';
import { AppText, Button, Chip, Enter, Hero, LessonListItem, ScreenLayout, Spinner, Surface } from '../ui';
import { fetchHome, type HomeData } from '../lib/content';
import { lessonCount } from '../lib/lessonCount';
import { lessonAccess, orderedLessons, type LessonState } from '../lib/lessonFlow';
import { MODE_INFO, modeOf } from '../lib/learningMode';
import { fetchProgress, type Progress } from '../lib/progress';
import { useAuth } from '../auth/AuthProvider';
import CreditChip from '../credits/CreditChip';

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
function LessonList({ lessons, wide, access }: { lessons: Lesson[]; wide: boolean; access: Map<string, LessonState> }) {
  const item = (lesson: Lesson, i: number) => (
    <Enter key={lesson.id} testID={`enter-lesson-${lesson.id}`} index={stagger(i)} style={wide ? styles.cell : undefined}>
      <LessonListItem index={i} title={lesson.title} state={access.get(lesson.id)} onPress={() => router.push(`/lesson/${lesson.id}`)} />
    </Enter>
  );
  if (!wide) return <View style={styles.lessons}>{lessons.map(item)}</View>;
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
      accessibilityLabel="Profil"
      onPress={() => router.push('/profile')}
      style={styles.avatar}
    >
      <AppText role="bar" color="primaryStrong">
        {initial}
      </AppText>
    </Pressable>
  );
}

/** Top-bar trailing slot: the credit balance chip, then the profile avatar. */
function HomeTrailing() {
  return (
    <View style={styles.trailing}>
      <CreditChip />
      <ProfileButton />
    </View>
  );
}

export default function HomeScreen() {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const [progress, setProgress] = useState<Progress | null>(null);
  const { profile } = useAuth();
  const loaded = useRef(false);
  const cancel = useRef<(() => void) | undefined>(undefined);

  // Home and progress load together. A refresh on refocus (back from a lesson) keeps the stale
  // list on screen and ignores a failure; only the first load shows the error surface.
  const fetchAll = useCallback(() => {
    cancel.current?.(); // a newer load supersedes an in-flight one
    let live = true;
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
  }, []);

  // Blur / unmount cancels whichever load is latest, including one started by retry.
  useFocusEffect(
    useCallback(() => {
      fetchAll();
      return () => cancel.current?.();
    }, [fetchAll]),
  );

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
          <AppText role="section">Nu am putut încărca lecțiile</AppText>
          <AppText role="small" color="textMuted">
            Verifică conexiunea la internet și încearcă din nou.
          </AppText>
          <Button label="Reîncearcă" onPress={retry} />
        </Surface>
      </ScreenLayout>
    );
  }

  if (!data || !progress) {
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
  const access = lessonAccess(orderedLessons(data.sections), progress.finished, mode);
  const done = [...access.values()].filter((st) => st === 'finished').length;

  return (
    <ScreenLayout logo trailing={<HomeTrailing />}>
      <Enter testID="enter-hero" index={0}>
        <Hero welcomeMessage={data.welcomeMessage} lessonCount={total} />
      </Enter>
      <View style={styles.modeChip}>
        <Chip
          label={`${MODE_INFO[mode].icon} ${MODE_INFO[mode].name} · ${done} din ${total} terminate`}
          fg={color.primaryStrong}
          bg={color.primarySubtle}
        />
      </View>
      {data.sections.map((section, s) => {
        const title = section.path.join(' › ');
        return (
          <View key={`${s}:${title}`}>
            <Enter testID={`enter-section-${s}`} index={stagger(1 + 2 * s)} style={styles.header}>
              <AppText role="section" accessibilityRole="header" style={styles.headerTitle}>
                {title}
              </AppText>
              <AppText role="caption" color="textMuted" style={styles.headerCount}>
                {lessonCount(section.lessons.length)}
              </AppText>
            </Enter>
            <LessonList lessons={section.lessons} wide={wide} access={access} />
          </View>
        );
      })}
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
  loader: { marginTop: space[12], alignItems: 'center' },
  // Prototype `.sec-title`: baseline-aligned title and count, 10 px above the list.
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
