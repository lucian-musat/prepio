import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space, type Lesson, type LessonSummary } from '@prepio/shared';
import CardStepper from '../components/CardStepper';
import QuestionView, { type LessonFrame } from '../components/QuestionView';
import { WritingExercise } from '../components/WritingExercise';
import { useAuth } from '../auth/AuthProvider';
import { fetchHome, fetchLesson } from '../lib/content';
import { modeOf } from '../lib/learningMode';
import { attemptOutcome, lessonAccess, orderedLessons, resumePoint, type AttemptOutcome } from '../lib/lessonFlow';
import { fetchProgress, markFinished, savePosition, type LessonPosition, type Progress } from '../lib/progress';
import { AppText, Button, Confetti, Enter, Pop, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import LessonStart from './lesson/LessonStart';
import { GuidedFailed, GuidedPassed } from './lesson/GuidedResult';

export type Phase = 'start' | 'cards' | 'questions' | 'exercises' | 'done';
type Results = LessonPosition['results'];
/** A phase inside the lesson (everything after the start screen). */
type Step = Exclude<Phase, 'start'>;

const PHASES: Step[] = ['cards', 'questions', 'exercises', 'done'];
const sizeOf = (lesson: Lesson, phase: Phase) =>
  phase === 'cards'
    ? lesson.cards.length
    : phase === 'questions'
      ? lesson.questions.length
      : phase === 'exercises'
        ? lesson.exercises.length
        : 1;

/** First phase at or after `from` that has content ("done" always does). */
const firstNonEmpty = (lesson: Lesson, from: Step): Step =>
  PHASES.slice(PHASES.indexOf(from)).find((p) => sizeOf(lesson, p) > 0) ?? 'done';
const nextPhase = (lesson: Lesson, current: Step): Step =>
  firstNonEmpty(lesson, PHASES[PHASES.indexOf(current) + 1] ?? 'done');

/**
 * Share of the lesson reached: steps are cards + questions + exercises, the current step counts as
 * reached, and the done screen is 1.
 */
export function lessonProgress(lesson: Lesson, phase: Phase, index: number): number {
  const c = lesson.cards.length;
  const q = lesson.questions.length;
  const total = c + q + lesson.exercises.length;
  if (phase === 'done' || total === 0) return 1;
  if (phase === 'start') return 0;
  const offset = phase === 'cards' ? 0 : phase === 'questions' ? c : c + q;
  return Math.min(1, (offset + index + 1) / total);
}

function Message({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <ScreenLayout title="Lecție" onBack={goBackOrHome}>
      <Surface style={styles.message}>
        <AppText role="section">{title}</AppText>
        {body ? (
          <AppText role="small" color="textMuted">
            {body}
          </AppText>
        ) : null}
        {onRetry ? <Button label="Reîncearcă" onPress={onRetry} /> : null}
        <Button
          label="Înapoi la lecții"
          variant={onRetry ? 'secondary' : 'primary'}
          onPress={() => router.replace('/')}
        />
      </Surface>
    </ScreenLayout>
  );
}

function Loading() {
  return (
    <ScreenLayout title="Lecție" onBack={goBackOrHome}>
      <View style={styles.loader}>
        <Spinner />
      </View>
    </ScreenLayout>
  );
}

type Loaded = { lesson: Lesson; order: LessonSummary[]; progress: Progress };
/** The end of an attempt; `saving` / `error` while the finished mark is being written. */
type End = { outcome: AttemptOutcome; status: 'saving' | 'saved' | 'error'; error?: string };

/**
 * Runs progress writes one after another: they are upserts on the same row, so a late position save must
 * never land after the finished mark (or the cleared position) and bring a resume point back.
 */
function useWriteQueue() {
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  return <T,>(write: () => Promise<T>): Promise<T> => {
    // A failed write never breaks the chain: the next one runs after it settles either way.
    const run = tail.current.catch(() => undefined).then(write);
    tail.current = run;
    return run;
  };
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mode = modeOf(useAuth().profile);
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [phase, setPhase] = useState<Phase>('start');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Results>({});
  const [end, setEnd] = useState<End | null>(null);
  const mounted = useRef(true);
  const enqueue = useWriteQueue();
  // Position writes never block the student: a failure is only logged.
  const save = (lessonId: string, position: LessonPosition | null) =>
    enqueue(() => savePosition(lessonId, position)).catch((e) =>
      console.warn('Could not save the lesson position', e),
    );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Lesson, order and progress load together; a new id (next lesson) starts again at the start screen.
  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setFailed(false);
    setPhase('start');
    setEnd(null);
    Promise.all([fetchLesson(String(id)), fetchHome(), fetchProgress()]).then(
      ([lesson, home, progress]) => !cancelled && setData(lesson ? { lesson, order: orderedLessons(home.sections), progress } : null),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  if (failed) {
    return (
      <Message
        title="Nu am putut încărca lecția"
        body="Verifică conexiunea la internet și încearcă din nou."
        onRetry={() => setReload((n) => n + 1)}
      />
    );
  }
  if (data === undefined) return <Loading />;
  if (data === null) return <Message title="Lecția nu a fost găsită" />;

  const { lesson, order, progress } = data;
  if (mode === 'guided' && lessonAccess(order, progress.finished, mode).get(lesson.id) === 'locked') {
    return <Message title="Lecția este blocată" body="Termină mai întâi lecțiile de dinainte, în ordine." />;
  }

  // Writes the finished mark; the result content waits for it, a failure offers a retry.
  const commit = (outcome: AttemptOutcome) => {
    setEnd({ outcome, status: 'saving' });
    enqueue(() => markFinished(lesson.id)).then(
      () => mounted.current && setEnd({ outcome, status: 'saved' }),
      (e: Error) => mounted.current && setEnd({ outcome, status: 'error', error: e.message }),
    );
  };

  const finish = (r: Results) => {
    const outcome = attemptOutcome(lesson, r);
    setPhase('done');
    if (mode === 'guided' && !outcome.passed) {
      // Not finished (and a finished lesson stays finished): only the attempt is cleared.
      setEnd({ outcome, status: 'saved' });
      save(lesson.id, null);
    } else {
      commit(outcome);
    }
  };

  const goTo = (to: Step, i: number, r: Results) => {
    if (to === 'done') return finish(r);
    setPhase(to);
    setIndex(i);
    setResults(r);
    save(lesson.id, { phase: to, index: i, results: r });
  };
  const startCards = () => goTo('cards', 0, {});
  const startTest = () => goTo(firstNonEmpty(lesson, 'questions'), 0, {});

  if (phase === 'start') {
    const resume = resumePoint(lesson, progress.positions.get(lesson.id) ?? null);
    return (
      <LessonStart
        lesson={lesson}
        guided={mode === 'guided'}
        onResume={resume ? () => goTo(resume.phase, resume.index, resume.results) : undefined}
        onLearn={startCards}
        onSkip={startTest}
      />
    );
  }

  if (phase === 'done') {
    return (
      <LessonEnd
        {...data}
        mode={mode}
        end={end}
        onRetrySave={commit}
        onReviewCards={startCards}
        onRetake={startTest}
      />
    );
  }

  const frame = (title: string): LessonFrame => ({ title, progress: lessonProgress(lesson, phase, index), onBack: goBackOrHome });
  const question = lesson.questions[index];
  const exercise = lesson.exercises[index];
  const advance = () => goTo(nextPhase(lesson, phase), 0, results);
  const somethingAfterCards = lesson.questions.length + lesson.exercises.length > 0;
  const nextIn = (size: number) => () => (index + 1 < size ? goTo(phase, index + 1, results) : advance());

  if (phase === 'cards') {
    return (
      <CardStepper
        cards={lesson.cards}
        initialIndex={index}
        onFinish={advance}
        frame={frame(lesson.title)}
        finishLabel={somethingAfterCards ? 'La exerciții' : 'Continuă'}
        onIndexChange={(i) => goTo('cards', i, results)}
        onSkip={somethingAfterCards ? startTest : undefined}
      />
    );
  }

  if (phase === 'questions' && question) {
    return (
      <QuestionView
        key={question.id}
        question={question}
        frame={frame(`Întrebarea ${index + 1} din ${lesson.questions.length}`)}
        onAnswered={(ok) => goTo('questions', index, { ...results, [question.id]: ok })}
        onNext={nextIn(lesson.questions.length)}
        nextLabel={index + 1 < lesson.questions.length ? 'Următoarea întrebare' : 'Continuă'}
      />
    );
  }

  if (phase === 'exercises' && exercise) {
    return (
      <WritingExercise
        key={exercise.id}
        exercise={exercise}
        frame={frame(`Exercițiul ${index + 1} din ${lesson.exercises.length}`)}
        nextLabel={index + 1 < lesson.exercises.length ? 'Următorul exercițiu' : 'Continuă'}
        onNext={nextIn(lesson.exercises.length)}
      />
    );
  }

  return <Loading />;
}

type EndProps = Loaded & {
  mode: 'guided' | 'free';
  end: End | null;
  onRetrySave: (outcome: AttemptOutcome) => void;
  onReviewCards: () => void;
  onRetake: () => void;
};

/** The screen after the last step: waits for the finished mark, then the free or guided result. */
function LessonEnd({ lesson, order, progress, mode, end, onRetrySave, onReviewCards, onRetake }: EndProps) {
  if (!end || end.status === 'saving') return <Loading />;
  const { outcome } = end;
  if (end.status === 'error') {
    return (
      <ScreenLayout title="Lecție" onBack={goBackOrHome} actions={<Button flex label="Reîncearcă" onPress={() => onRetrySave(outcome)} />}>
        <Surface style={styles.message}>
          <AppText role="small" color="danger" accessibilityRole="alert">
            {end.error}
          </AppText>
        </Surface>
      </ScreenLayout>
    );
  }
  if (mode === 'free') return <LessonDone title={lesson.title} correct={outcome.correct} total={outcome.total} />;
  if (!outcome.passed) {
    return <GuidedFailed outcome={outcome} onReviewCards={lesson.cards.length > 0 ? onReviewCards : undefined} onRetake={onRetake} />;
  }
  const at = order.findIndex((l) => l.id === lesson.id);
  const next = at >= 0 ? order[at + 1] : undefined;
  // "Ai deblocat" only on the pass that actually opened the next lesson, not on a redo.
  const unlocked = next && !progress.finished.has(lesson.id) ? next.title : undefined;
  return <GuidedPassed outcome={outcome} unlocked={unlocked} nextId={next?.id} />;
}

/** 🎓 that pops in (prototype `.done-wrap .big`: `pop 600ms` spring). */
function Cap() {
  return (
    <Pop duration={POP_MS} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={styles.cap}>🎓</Text>
    </Pop>
  );
}

/** Lesson done (prototype `finish()`): centred cap, heading, lesson title, score; confetti on enter. */
function LessonDone({ title, correct, total }: { title: string; correct: number; total: number }) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBurst(1), CONFETTI_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.fill}>
      <ScreenLayout
        title="Lecție terminată"
        progress={1}
        onBack={goBackOrHome}
        actions={<Button flex label="Înapoi la lecții" onPress={() => router.replace('/')} />}
      >
        <View style={styles.done}>
          {/* Prototype: `.done-wrap .big` only pops (its own animation replaces the stagger rise). */}
          <Cap />
          <Enter index={1}>
            <AppText role="celebrate" accessibilityRole="header" style={styles.doneTitle}>
              Ai terminat lecția!
            </AppText>
          </Enter>
          <Enter index={2}>
            <AppText role="lead" color="textMuted" style={styles.centre}>
              {title}
            </AppText>
          </Enter>
          {total > 0 ? (
            <Enter index={3}>
              <AppText role="bodyStrong" style={[styles.centre, styles.score]}>
                {correct} din {total} întrebări corecte
              </AppText>
            </Enter>
          ) : null}
        </View>
      </ScreenLayout>
      <Confetti trigger={burst} />
    </View>
  );
}

// Prototype `.done-wrap`: 56 px emoji, padding 30px 8px, h2 margin 10px 0 6px; confetti 200 ms after mount.
const CAP_SIZE = 56;
// The prototype's line box for the 56 px emoji (Nunito Sans `normal` raised by the emoji font): 80.6 px.
const CAP_LINE_HEIGHT = 80;
const DONE_PAD_V = 30;
const CONFETTI_DELAY_MS = 200;
const POP_MS = 600;

const styles = StyleSheet.create({
  message: { gap: space[3] },
  loader: { paddingTop: space[12], alignItems: 'center' },
  fill: { flex: 1 },
  done: { alignItems: 'center', paddingVertical: DONE_PAD_V, paddingHorizontal: space[2] },
  // The emoji has no font role: the system emoji font at the prototype's size.
  cap: { fontSize: CAP_SIZE, lineHeight: CAP_LINE_HEIGHT, textAlign: 'center' },
  doneTitle: { marginTop: space[2.5], marginBottom: space[1.5], textAlign: 'center' },
  centre: { textAlign: 'center' },
  score: { marginTop: space[5] },
});
