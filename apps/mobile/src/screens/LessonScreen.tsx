import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { space, type Lesson } from '@prepio/shared';
import CardStepper from '../components/CardStepper';
import QuestionView, { type LessonFrame } from '../components/QuestionView';
import { WritingExercise } from '../components/WritingExercise';
import { fetchLesson } from '../lib/content';
import { AppText, Button, Confetti, Enter, ScreenLayout, Spinner, Surface, easing, goBackOrHome, timing } from '../ui';

export type Phase = 'cards' | 'questions' | 'exercises' | 'done';

const PHASES: Phase[] = ['cards', 'questions', 'exercises', 'done'];
const sizeOf = (lesson: Lesson, phase: Phase) =>
  phase === 'cards'
    ? lesson.cards.length
    : phase === 'questions'
      ? lesson.questions.length
      : phase === 'exercises'
        ? lesson.exercises.length
        : 1;

/** First phase at or after `from` that has content ("done" always does). */
const firstNonEmpty = (lesson: Lesson, from: Phase): Phase =>
  PHASES.slice(PHASES.indexOf(from)).find((p) => sizeOf(lesson, p) > 0) ?? 'done';
const nextPhase = (lesson: Lesson, current: Phase): Phase =>
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
  const offset = phase === 'cards' ? 0 : phase === 'questions' ? c : c + q;
  return Math.min(1, (offset + index + 1) / total);
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <ScreenLayout title="Lecție" onBack={goBackOrHome}>
      <Surface style={styles.message}>
        <AppText role="section">{title}</AppText>
        {body ? (
          <AppText role="small" color="textMuted">
            {body}
          </AppText>
        ) : null}
        <Button label="Înapoi la lecții" onPress={() => router.replace('/')} />
      </Surface>
    </ScreenLayout>
  );
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('cards');
  const [cIndex, setCIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [eIndex, setEIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLesson(undefined);
    setFailed(false);
    fetchLesson(String(id)).then(
      (l) => {
        if (cancelled) return;
        setLesson(l);
        if (l) setPhase(firstNonEmpty(l, 'cards'));
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) {
    return <Message title="Nu am putut încărca lecția" body="Verifică conexiunea la internet și încearcă din nou." />;
  }

  if (lesson === undefined) {
    return (
      <ScreenLayout title="Lecție" onBack={goBackOrHome}>
        <View style={styles.loader}>
          <Spinner />
        </View>
      </ScreenLayout>
    );
  }

  if (lesson === null) return <Message title="Lecția nu a fost găsită" />;

  const advance = () => setPhase(nextPhase(lesson, phase));
  const question = lesson.questions[qIndex];
  const exercise = lesson.exercises[eIndex];

  const nextQuestion = () => {
    if (qIndex + 1 < lesson.questions.length) setQIndex(qIndex + 1);
    else advance();
  };
  const nextExercise = () => {
    if (eIndex + 1 < lesson.exercises.length) setEIndex(eIndex + 1);
    else advance();
  };

  const index = phase === 'cards' ? cIndex : phase === 'questions' ? qIndex : phase === 'exercises' ? eIndex : 0;
  const frame = (title: string): LessonFrame => ({ title, progress: lessonProgress(lesson, phase, index), onBack: goBackOrHome });
  const somethingAfterCards = lesson.questions.length + lesson.exercises.length > 0;

  if (phase === 'cards') {
    return (
      <CardStepper
        cards={lesson.cards}
        onFinish={advance}
        frame={frame(lesson.title)}
        finishLabel={somethingAfterCards ? 'La exerciții' : 'Continuă'}
        onIndexChange={setCIndex}
      />
    );
  }

  if (phase === 'questions' && question) {
    return (
      <QuestionView
        key={question.id}
        question={question}
        frame={frame(`Întrebarea ${qIndex + 1} din ${lesson.questions.length}`)}
        onAnswered={(ok) => {
          if (ok) setCorrectCount((n) => n + 1);
        }}
        onNext={nextQuestion}
        nextLabel={qIndex + 1 < lesson.questions.length ? 'Următoarea întrebare' : 'Continuă'}
      />
    );
  }

  if (phase === 'exercises' && exercise) {
    return (
      <WritingExercise
        key={exercise.id}
        exercise={exercise}
        frame={frame(`Exercițiul ${eIndex + 1} din ${lesson.exercises.length}`)}
        nextLabel={eIndex + 1 < lesson.exercises.length ? 'Următorul exercițiu' : 'Continuă'}
        onNext={nextExercise}
      />
    );
  }

  return <LessonDone title={lesson.title} correct={correctCount} total={lesson.questions.length} />;
}

/** 🎓 that pops in (prototype `.done-wrap .big`: `pop 600ms` spring). */
function Cap() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : POP_FROM);
  useEffect(() => {
    if (reduced) return;
    scale.value = withSequence(
      withTiming(POP_PEAK, timing(POP_MS * POP_PEAK_AT, easing.pop)),
      withTiming(1, timing(POP_MS * (1 - POP_PEAK_AT), easing.pop)),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={styles.cap}>🎓</Text>
    </Animated.View>
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
          <Enter index={0}>
            <Cap />
          </Enter>
          <Enter index={1}>
            <AppText role="display" accessibilityRole="header" style={styles.doneTitle}>
              Ai terminat lecția!
            </AppText>
          </Enter>
          <Enter index={2}>
            <AppText role="body" color="textMuted" style={styles.centre}>
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
const CAP_LINE_HEIGHT = 68; // ~1.2 x CAP_SIZE, so the glyph isn't clipped
const DONE_PAD_V = 30;
const CONFETTI_DELAY_MS = 200;
const POP_MS = 600;
const POP_FROM = 0.6;
const POP_PEAK = 1.18;
const POP_PEAK_AT = 0.6;

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
