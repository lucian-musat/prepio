import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { layout, space } from '@prepio/shared';
import { AppText, Button, Enter, Hero, LessonListItem, ScreenLayout, Spinner, Surface } from '../ui';
import { fetchHome, type HomeData } from '../lib/content';
import { lessonCount } from '../lib/lessonCount';

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
function LessonList({ lessons, wide }: { lessons: Lesson[]; wide: boolean }) {
  const item = (lesson: Lesson, i: number) => (
    <Enter key={lesson.id} testID={`enter-lesson-${lesson.id}`} index={stagger(i)} style={wide ? styles.cell : undefined}>
      <LessonListItem index={i} title={lesson.title} onPress={() => router.push(`/lesson/${lesson.id}`)} />
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

export default function HomeScreen() {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    fetchHome().then(setData, () => setFailed(true));
  }, []);

  useEffect(load, [load]);

  if (failed) {
    return (
      <ScreenLayout logo>
        <Surface style={styles.error}>
          <AppText role="section">Nu am putut încărca lecțiile</AppText>
          <AppText role="small" color="textMuted">
            Verifică conexiunea la internet și încearcă din nou.
          </AppText>
          <Button label="Reîncearcă" onPress={load} />
        </Surface>
      </ScreenLayout>
    );
  }

  if (!data) {
    return (
      <ScreenLayout logo>
        <View style={styles.loader}>
          <Spinner />
        </View>
      </ScreenLayout>
    );
  }

  const total = data.sections.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <ScreenLayout logo>
      <Enter testID="enter-hero" index={0}>
        <Hero welcomeMessage={data.welcomeMessage} lessonCount={total} />
      </Enter>
      {data.sections.map((section, s) => {
        const title = section.path.join(' › ');
        return (
          <View key={title}>
            <Enter testID={`enter-section-${s}`} index={stagger(1 + 2 * s)} style={styles.header}>
              <AppText role="section" accessibilityRole="header" style={styles.headerTitle}>
                {title}
              </AppText>
              <AppText role="caption" color="textMuted" style={styles.headerCount}>
                {lessonCount(section.lessons.length)}
              </AppText>
            </Enter>
            <LessonList lessons={section.lessons} wide={wide} />
          </View>
        );
      })}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  error: { gap: space[3] },
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
