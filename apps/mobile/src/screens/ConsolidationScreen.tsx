import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space, type LessonSummary } from '@prepio/shared';
import { useAuth } from '../auth/AuthProvider';
import { useAccess } from '../access/AccessProvider';
import {
  fetchAttempts,
  fetchConsolidation,
  fetchRun,
  moveRun,
  newRun,
  resolveRun,
  runAt,
  saveAttempt,
  saveRun,
  type Attempt,
  type ConsolidationData,
  type Run,
} from '../lib/consolidation';
import { fetchHome } from '../lib/content';
import { modeOf, type LearningMode } from '../lib/learningMode';
import { lessonAccess, orderedLessons } from '../lib/lessonFlow';
import { fetchProgress } from '../lib/progress';
import { t } from '../texts/store';
import { AppText, Button, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import ExerciseMap from '../components/consolidation/ExerciseMap';
import { emptyAnswer } from './consolidation/checking';
import ConsolidationEnd from './consolidation/ConsolidationEnd';
import ExerciseScreen, { type Draft } from './consolidation/ExerciseScreen';
import { exerciseStatus } from './consolidation/status';

type Loaded = {
  data: ConsolidationData;
  finished: Set<string>;
  order: LessonSummary[];
  attempts: Map<string, Attempt>;
};

function Message({ title, body, action }: { title: string; body?: string; action: { label: string; onPress: () => void } }) {
  return (
    <ScreenLayout title={t('consolidation.screenTitle')} onBack={goBackOrHome}>
      <Surface style={styles.message}>
        <AppText role="section">{title}</AppText>
        {body ? (
          <AppText role="small" color="textMuted">
            {body}
          </AppText>
        ) : null}
        <Button label={action.label} onPress={action.onPress} />
      </Surface>
    </ScreenLayout>
  );
}

/** The lesson to go on to after consolidation: guided, the current one; free, the next in order. */
function nextLesson(
  order: LessonSummary[],
  finished: Set<string>,
  lessonId: string,
  mode: LearningMode,
  canOpen: (id: string) => boolean,
) {
  if (mode === 'guided') {
    const access = lessonAccess(order, finished, 'guided', canOpen);
    return order.find((l) => access.get(l.id) === 'current');
  }
  const at = order.findIndex((l) => l.id === lessonId);
  const following = at >= 0 ? order[at + 1] : undefined;
  return following && canOpen(following.id) ? following : undefined;
}

// Run and attempt writes never block the student: a failure is only logged, like lesson positions.
const persistRun = (lessonId: string, run: Run) => saveRun(lessonId, run).catch((e) => console.warn('Could not save the consolidation run', e));

/**
 * `/lesson/[id]/consolidare`: the lesson's consolidation run (spec "Consolidation run"). Only for a finished lesson.
 * Opening resumes an unfinished run, shows the summary after a finished one, or starts a new full run.
 * The student moves freely through the run (previous, skip, the exercise map); leaving the last one finishes it.
 * An exercise opens as the student last left it in this session, otherwise on its latest attempt (checked).
 */
export default function ConsolidationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = String(id);
  const mode = modeOf(useAuth().profile);
  const { canOpen } = useAccess();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const [tries, setTries] = useState(0);
  const runRef = useRef<Run | null>(null);
  runRef.current = run;
  // Per exercise, how the student left it in this session (answer + feedback): kept in memory only.
  const drafts = useRef(new Map<string, Draft>());

  useEffect(() => {
    let cancelled = false;
    setLoaded(undefined);
    (async () => {
      const [data, progress, home] = await Promise.all([fetchConsolidation(lessonId), fetchProgress(), fetchHome()]);
      const finished = progress.finished;
      const order = orderedLessons(home.sections);
      if (!finished.has(lessonId) || data.exercises.length === 0) return { data, finished, order, attempts: new Map(), start: null };
      const ids = data.exercises.map((e) => e.id);
      const [attempts, saved] = await Promise.all([fetchAttempts(ids), fetchRun(lessonId)]);
      return { data, finished, order, attempts, start: resolveRun(ids, saved, attempts) };
    })().then(
      ({ start, ...l }) => {
        if (cancelled) return;
        setLoaded(l);
        if (start?.kind === 'new') persistRun(lessonId, start.run);
        setRun(start && start.kind !== 'end' ? start.run : null);
      },
      (e) => {
        console.warn('Could not load the consolidation', e);
        if (!cancelled) setLoaded(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lessonId, reload]);

  if (loaded === null) {
    return (
      <Message
        title={t('consolidation.loadFailed')}
        body={t('errors.checkConnection')}
        action={{ label: t('common.retryButton'), onPress: () => setReload((n) => n + 1) }}
      />
    );
  }
  if (loaded === undefined) {
    return (
      <ScreenLayout title={t('consolidation.screenTitle')} onBack={goBackOrHome}>
        <View style={styles.loader}>
          <Spinner />
        </View>
      </ScreenLayout>
    );
  }

  const { data, finished, order, attempts } = loaded;
  const backToLesson = { label: t('consolidation.backToLesson'), onPress: () => router.replace(`/lesson/${lessonId}`) };
  if (!finished.has(lessonId)) {
    return <Message title={t('consolidation.locked.title')} body={t('consolidation.locked.body')} action={backToLesson} />;
  }
  if (data.exercises.length === 0) {
    return <Message title={t('consolidation.empty')} action={backToLesson} />;
  }

  const ids = data.exercises.map((e) => e.id);
  const begin = (r: Run) => {
    setTries(0);
    setRun(r);
    persistRun(lessonId, r);
  };
  // „Reia…” starts over: the run's exercises open empty (their attempts stay, as the map shows).
  const start = (onlyNotCorrect: boolean) => {
    drafts.current.clear();
    for (const ex of data.exercises) drafts.current.set(ex.id, { answer: emptyAnswer(ex), feedback: null });
    begin(newRun(ids, attempts, onlyNotCorrect));
  };

  const exercise = run ? data.exercises.find((e) => e.id === run.exerciseIds[run.index]) : undefined;
  if (!run || !exercise) {
    const next = nextLesson(order, finished, lessonId, mode, canOpen);
    return (
      <ConsolidationEnd
        exercises={data.exercises}
        attempts={attempts}
        onBack={goBackOrHome}
        onRestart={() => start(false)}
        onRestartWrong={newRun(ids, attempts, true).exerciseIds.length > 0 ? () => start(true) : undefined}
        onOpen={(exerciseId) => {
          // A row shows what was done: blank drafts (a „Reia…” placeholder, a retry left empty) give way to the
          // stored attempts; work typed in this session stays.
          for (const ex of data.exercises) {
            const d = drafts.current.get(ex.id);
            if (d && !d.feedback && JSON.stringify(d.answer) === JSON.stringify(emptyAnswer(ex))) drafts.current.delete(ex.id);
          }
          begin(runAt(ids, exerciseId));
        }}
        next={
          next
            ? { label: t('consolidation.end.nextLesson'), onPress: () => router.replace(`/lesson/${next.id}`) }
            : { label: t('consolidation.end.goHome'), onPress: () => router.replace('/') }
        }
      />
    );
  }

  const onChecked = (a: Attempt) => {
    // The summary reads the latest attempts; keep the local copy current whatever the save does.
    setLoaded((l) => (l ? { ...l, attempts: new Map(l.attempts).set(a.exerciseId, a) } : l));
    saveAttempt(a).catch((e) => console.warn('Could not save the consolidation attempt', e));
  };
  // Previous / next / skip / the map: past the last exercise the run is finished and the end screen shows.
  const go = (index: number) => {
    const cur = runRef.current;
    if (!cur || index === cur.index) return;
    const nextRun = moveRun(cur, index);
    persistRun(lessonId, nextRun);
    setTries(0);
    setRun(nextRun.finished ? null : nextRun);
  };
  const next = () => go(run.index + 1);
  const retry = () => {
    drafts.current.set(exercise.id, { answer: emptyAnswer(exercise), feedback: null });
    setTries((n) => n + 1);
  };
  const attempt = attempts.get(exercise.id);
  const initial = drafts.current.get(exercise.id) ?? (attempt ? { answer: attempt.answer, feedback: attempt.feedback } : null);
  const byId = new Map(data.exercises.map((e) => [e.id, e] as const));
  const mapItems = run.exerciseIds.flatMap((id) => {
    const ex = byId.get(id);
    return ex ? [{ id, ...exerciseStatus(ex, attempts.get(id)) }] : [];
  });

  return (
    <ExerciseScreen
      key={`${run.index}-${exercise.id}-${tries}`}
      exercise={exercise}
      sources={data.sources}
      templates={data.templates}
      index={run.index}
      total={run.exerciseIds.length}
      onBack={goBackOrHome}
      onChecked={onChecked}
      onContinue={next}
      onSkip={next}
      onPrev={run.index > 0 ? () => go(run.index - 1) : undefined}
      onRetry={retry}
      initial={initial}
      onDraft={(d) => drafts.current.set(exercise.id, d)}
      map={(busy) => <ExerciseMap items={mapItems} current={run.index} onJump={go} disabled={busy} />}
    />
  );
}

const styles = StyleSheet.create({
  message: { gap: space[3] },
  loader: { paddingTop: space[12], alignItems: 'center' },
});
