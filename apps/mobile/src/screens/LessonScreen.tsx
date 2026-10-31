import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space, type Lesson } from '@prepio/shared';
import CardStepper from '../components/CardStepper';
import QuestionView, { type LessonFrame } from '../components/QuestionView';
import { WritingExercise } from '../components/WritingExercise';
import { fetchLesson } from '../lib/content';
import { AppText, Button, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';

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

  // Exercises and done keep their old content for now (Task 7 restyles them) inside the lesson frame.
  if (phase === 'exercises' && exercise) {
    const f = frame(`Exercițiul ${eIndex + 1} din ${lesson.exercises.length}`);
    return (
      <ScreenLayout
        key={exercise.id}
        title={f.title}
        progress={f.progress}
        onBack={f.onBack}
        actions={
          <Button flex label={eIndex + 1 < lesson.exercises.length ? 'Următorul exercițiu' : 'Continuă'} onPress={nextExercise} />
        }
      >
        <WritingExercise exercise={exercise} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title="Lecție terminată"
      progress={1}
      onBack={goBackOrHome}
      actions={<Button flex label="Înapoi la lecții" onPress={() => router.replace('/')} />}
    >
      <Surface style={styles.message}>
        <AppText role="display">Lecție terminată</AppText>
        <AppText role="small" color="textMuted">
          {lesson.title}
        </AppText>
        <AppText role="bodyStrong">
          {correctCount} din {lesson.questions.length} întrebări corecte
        </AppText>
      </Surface>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  message: { gap: space[3] },
  loader: { paddingTop: space[12], alignItems: 'center' },
});
