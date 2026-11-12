import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space, type Lesson, type LessonSummary } from '@prepio/shared';
import CardStepper from '../components/CardStepper';
import QuestionView, { type LessonFrame } from '../components/QuestionView';
import { useAuth } from '../auth/AuthProvider';
import { useAccess } from '../access/AccessProvider';
import { fetchHome, fetchLesson } from '../lib/content';
import { consolidationSummary, type ConsolidationSummary } from '../lib/consolidation';
import { modeOf } from '../lib/learningMode';
import { attemptOutcome, lessonAccess, orderedLessons, resumePoint, type AttemptOutcome } from '../lib/lessonFlow';
import { fetchProgress, markFinished, savePosition, type LessonPosition, type Progress } from '../lib/progress';
import { withTimeout } from '../lib/supabase';
import { logTestFailed } from '../lib/activity';
import { clearLastTest, readLastTest, saveLastTest, type LastTest } from '../lib/lastTest';
import { describeProgress } from '../lib/lessonProgressLabel';
import { AppText, Button, ConfirmDialog, Confetti, Enter, Pop, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import LessonStart from './lesson/LessonStart';
import { ConsolidationUnlocked, GuidedFailed, GuidedPassed, startConsolidation } from './lesson/GuidedResult';

export type Phase = 'start' | 'cards' | 'questions' | 'done';
type Results = LessonPosition['results'];
/** A phase inside the lesson (everything after the start screen). */
type Step = Exclude<Phase, 'start'>;

const PHASES: Step[] = ['cards', 'questions', 'done'];
const sizeOf = (lesson: Lesson, phase: Phase) =>
  phase === 'cards'
    ? lesson.cards.length
    : phase === 'questions'
      ? lesson.questions.length
      : 1;

/** First phase at or after `from` that has content ("done" always does). */
const firstNonEmpty = (lesson: Lesson, from: Step): Step =>
  PHASES.slice(PHASES.indexOf(from)).find((p) => sizeOf(lesson, p) > 0) ?? 'done';
const nextPhase = (lesson: Lesson, current: Step): Step =>
  firstNonEmpty(lesson, PHASES[PHASES.indexOf(current) + 1] ?? 'done');

/**
 * Share of the lesson reached: steps are cards + questions, the current step counts as
 * reached, and the done screen is 1.
 */
export function lessonProgress(lesson: Lesson, phase: Phase, index: number): number {
  const c = lesson.cards.length;
  const q = lesson.questions.length;
  const total = c + q;
  if (phase === 'done' || total === 0) return 1;
  if (phase === 'start') return 0;
  const offset = phase === 'cards' ? 0 : c;
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

type Loaded = {
  lesson: Lesson;
  order: LessonSummary[];
  progress: Progress;
  consolidation: number;
  consolidationScore: ConsolidationSummary | null;
  lastTest: LastTest | null;
};
/** The end of an attempt; `saving` / `error` while the finished mark is being written. */
type End = { outcome: AttemptOutcome; status: 'saving' | 'saved' | 'error' };

/** Shown for any failed finished mark: markFinished's own message, also used for a timeout. */
const SAVE_FAILED = 'Progresul nu a putut fi salvat. Încearcă din nou.';

/**
 * Runs progress writes one after another: they are upserts on the same row, so a late position save must
 * never land after the finished mark (or the cleared position) and bring a resume point back.
 */
function useWriteQueue() {
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  return <T,>(write: () => Promise<T>): Promise<T> => {
    // A failed write never breaks the chain: the next one runs after it settles either way.
    // Each write is capped by the auth timeout, so a stalled connection can't hold the queue (or the end
    // screen) forever: it fails like any other write.
    const run = tail.current.catch(() => undefined).then(() => withTimeout(write()));
    tail.current = run;
    return run;
  };
}

/** What skipping the cards means, per mode: shown before the student goes straight to the test. */
export const SKIP_MESSAGE = {
  guided:
    'Treci peste carduri și începi direct verificarea. Ca să treci la lecția următoare, trebuie să răspunzi corect la ' +
    'toate întrebările. Dacă greșești, revezi cardurile și reiei verificarea.',
  free: 'Treci peste carduri și începi direct verificarea. Lecția e terminată când ajungi la final. Poți reveni oricând la carduri.',
} as const;
export const SKIP_CONFIRM = 'Da, sari la verificare';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mode = modeOf(useAuth().profile);
  const { canOpen } = useAccess();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [phase, setPhase] = useState<Phase>('start');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Results>({});
  const [end, setEnd] = useState<End | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
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
    // A failed consolidation count only hides that zone: it never blocks the lesson.
    const summary = consolidationSummary(String(id)).catch((e): ConsolidationSummary | null => {
      console.warn('Could not count the consolidation exercises', e);
      return null;
    });
    Promise.all([fetchLesson(String(id)), fetchHome(), fetchProgress(), summary, readLastTest(String(id))]).then(
      ([lesson, home, progress, score, lastTest]) =>
        !cancelled &&
        setData(
          lesson
            ? { lesson, order: orderedLessons(home.sections), progress, consolidation: score?.count ?? 0, consolidationScore: score, lastTest }
            : null,
        ),
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

  const { lesson, order, progress, consolidation } = data;
  if (mode === 'guided' && lessonAccess(order, progress.finished, mode, canOpen).get(lesson.id) === 'locked') {
    return <Message title="Lecția este blocată" body="Termină mai întâi lecțiile de dinainte, în ordine." />;
  }

  // Writes the finished mark; the result content waits for it, a failure offers a retry.
  const commit = (outcome: AttemptOutcome) => {
    setEnd({ outcome, status: 'saving' });
    enqueue(() => markFinished(lesson.id)).then(
      () => mounted.current && setEnd({ outcome, status: 'saved' }),
      () => mounted.current && setEnd({ outcome, status: 'error' }),
    );
  };

  const finish = (r: Results) => {
    const outcome = attemptOutcome(lesson, r);
    setPhase('done');
    if (mode === 'guided' && !outcome.passed) {
      // Not finished (and a finished lesson stays finished): only the attempt is cleared.
      setEnd({ outcome, status: 'saved' });
      save(lesson.id, null);
      // The server keeps no failed attempt: its score stays on this device for the start screen.
      void saveLastTest(lesson.id, { correct: outcome.correct, total: outcome.total });
      // For the admin timeline; queued after the position write, since the server needs the progress row.
      // Best-effort: logTestFailed never throws, only the queue's timeout can reject.
      enqueue(() => logTestFailed(lesson.id)).catch(() => undefined);
    } else {
      void clearLastTest(lesson.id);
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
  // Skipping from the start screen or the cards asks first; the failed-test screen's retake does not.
  const requestSkip = () => setConfirmSkip(true);
  const skipDialog = (
    <ConfirmDialog
      visible={confirmSkip}
      title="Sari la verificare?"
      message={SKIP_MESSAGE[mode]}
      confirmLabel={SKIP_CONFIRM}
      onConfirm={() => {
        setConfirmSkip(false);
        startTest();
      }}
      onCancel={() => setConfirmSkip(false)}
    />
  );

  if (phase === 'start') {
    const resume = resumePoint(lesson, progress.positions.get(lesson.id) ?? null);
    const finished = progress.finished.has(lesson.id);
    const counts = { cards: lesson.cards.length, questions: lesson.questions.length };
    return (
      <>
        <LessonStart
          lesson={lesson}
          guided={mode === 'guided'}
          finished={finished}
          consolidation={consolidation}
          progress={describeProgress(resume, finished ? null : data.lastTest, counts, data.consolidationScore)}
          onRetake={!resume && !finished && data.lastTest && lesson.questions.length ? startTest : undefined}
          onResume={resume ? () => goTo(resume.phase, resume.index, resume.results) : undefined}
          onLearn={startCards}
          onSkip={requestSkip}
        />
        {skipDialog}
      </>
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
  const advance = () => goTo(nextPhase(lesson, phase), 0, results);
  const somethingAfterCards = lesson.questions.length > 0;
  const nextIn = (size: number) => () => (index + 1 < size ? goTo(phase, index + 1, results) : advance());

  if (phase === 'cards') {
    return (
      <>
        <CardStepper
          cards={lesson.cards}
          initialIndex={index}
          onFinish={advance}
          frame={frame(lesson.title)}
          finishLabel={somethingAfterCards ? 'La verificare' : 'Continuă'}
          onIndexChange={(i) => goTo('cards', i, results)}
          onSkip={somethingAfterCards ? requestSkip : undefined}
        />
        {skipDialog}
      </>
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
function LessonEnd({ lesson, order, progress, consolidation, mode, end, onRetrySave, onReviewCards, onRetake }: EndProps) {
  const { canOpen } = useAccess();
  if (!end || end.status === 'saving') return <Loading />;
  const { outcome } = end;
  if (end.status === 'error') {
    return (
      <ScreenLayout title="Lecție" onBack={goBackOrHome} actions={<Button flex label="Reîncearcă" onPress={() => onRetrySave(outcome)} />}>
        <Surface style={styles.message}>
          <AppText role="small" color="danger" accessibilityRole="alert">
            {SAVE_FAILED}
          </AppText>
        </Surface>
      </ScreenLayout>
    );
  }
  if (mode === 'free') {
    // Free mode: the next lesson is simply the next one in order (none after the last, none behind the paywall).
    const at = order.findIndex((l) => l.id === lesson.id);
    const following = at >= 0 ? order[at + 1]?.id : undefined;
    return (
      <LessonDone
        lessonId={lesson.id}
        nextId={following !== undefined && canOpen(following) ? following : undefined}
        title={lesson.title}
        correct={outcome.correct}
        total={outcome.total}
        consolidation={consolidation}
      />
    );
  }
  if (!outcome.passed) {
    return <GuidedFailed outcome={outcome} questions={lesson.questions} onReviewCards={lesson.cards.length > 0 ? onReviewCards : undefined} onRetake={onRetake} />;
  }
  // Go on to the lesson that is current once this pass counts: after a free → guided switch the finished
  // lessons need not be a prefix of the order, so it is not always the next one. "Ai deblocat" only when this
  // pass is what opened it (it was locked before), not on a redo.
  const before = lessonAccess(order, progress.finished, 'guided', canOpen);
  const after = lessonAccess(order, new Set([...progress.finished, lesson.id]), 'guided', canOpen);
  const next = order.find((l) => after.get(l.id) === 'current');
  const unlocked = next && before.get(next.id) === 'locked' ? next.title : undefined;
  return (
    <GuidedPassed
      outcome={outcome}
      unlocked={unlocked}
      nextId={next?.id}
      consolidation={{ lessonId: lesson.id, count: consolidation }}
    />
  );
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
function LessonDone({
  lessonId,
  nextId,
  title,
  correct,
  total,
  consolidation,
}: {
  lessonId: string;
  nextId: string | undefined;
  title: string;
  correct: number;
  total: number;
  consolidation: number;
}) {
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
        actions={
          consolidation > 0 ? (
            <View style={styles.stack}>
              <Button label="Începe consolidarea" onPress={() => startConsolidation(lessonId)} />
              {/* Same secondary action as the guided pass: the next lesson, or home after the last one. */}
              {nextId ? (
                <Button label="Mergi la lecția următoare" variant="secondary" onPress={() => router.replace(`/lesson/${nextId}`)} />
              ) : (
                <Button label="Înapoi acasă" variant="secondary" onPress={() => router.replace('/')} />
              )}
            </View>
          ) : (
            <Button flex label="Înapoi la lecții" onPress={() => router.replace('/')} />
          )
        }
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
          {consolidation > 0 ? <ConsolidationUnlocked /> : null}
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
  stack: { flex: 1, gap: space[2.5] },
});
