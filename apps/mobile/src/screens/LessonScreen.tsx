import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
import { colors, radius, type Lesson } from '@prepio/shared';
import CardStepper from '../components/CardStepper';
import QuestionView from '../components/QuestionView';
import Screen from '../components/Screen';
import { WritingExercise } from '../components/WritingExercise';
import { fetchLesson } from '../lib/content';
import { fontFamily } from '../theme/fonts';

type Phase = 'cards' | 'questions' | 'exercises' | 'done';

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

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('cards');
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
    return (
      <Screen>
        <Card style={styles.box}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">Nu am putut încărca lecția</Text>
            <Text>Verifică conexiunea la internet și încearcă din nou.</Text>
            <Button mode="contained" onPress={() => router.replace('/')}>
              Înapoi la lecții
            </Button>
          </Card.Content>
        </Card>
      </Screen>
    );
  }

  if (lesson === undefined) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} accessibilityLabel="Se încarcă" />
      </Screen>
    );
  }

  if (lesson === null) {
    return (
      <Screen>
        <Card style={styles.box}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">Lecția nu a fost găsită</Text>
            <Button mode="contained" onPress={() => router.replace('/')}>
              Înapoi la lecții
            </Button>
          </Card.Content>
        </Card>
      </Screen>
    );
  }

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

  return (
    <Screen>
      <Text variant="headlineSmall" style={styles.title}>
        {lesson.title}
      </Text>

      {phase === 'cards' ? <CardStepper cards={lesson.cards} onFinish={advance} /> : null}

      {phase === 'questions' && question ? (
        <View style={styles.gap}>
          <Text style={styles.progress}>
            Întrebarea {qIndex + 1} din {lesson.questions.length}
          </Text>
          <QuestionView
            key={question.id}
            question={question}
            onAnswered={(ok) => {
              if (ok) setCorrectCount((n) => n + 1);
            }}
            onNext={nextQuestion}
            nextLabel={qIndex + 1 < lesson.questions.length ? 'Următoarea întrebare' : 'Continuă'}
          />
        </View>
      ) : null}

      {phase === 'exercises' && exercise ? (
        <View style={styles.gap}>
          <Text style={styles.progress}>
            Exercițiul {eIndex + 1} din {lesson.exercises.length}
          </Text>
          <WritingExercise key={exercise.id} exercise={exercise} />
          <Button mode="contained" onPress={nextExercise}>
            {eIndex + 1 < lesson.exercises.length ? 'Următorul exercițiu' : 'Continuă'}
          </Button>
        </View>
      ) : null}

      {phase === 'done' ? (
        <Card style={styles.box}>
          <Card.Content style={styles.gap}>
            <Text variant="titleLarge" style={styles.title}>
              Lecție terminată
            </Text>
            <Text style={styles.summary}>
              {correctCount} din {lesson.questions.length} întrebări corecte
            </Text>
            <Button mode="contained" onPress={() => router.replace('/')}>
              Înapoi la lecții
            </Button>
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.paper,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gap: { gap: 12 },
  loader: { marginTop: 48 },
  title: { fontFamily: fontFamily.headingBold, color: colors.bordeaux },
  progress: { fontFamily: fontFamily.body, color: colors.inkMuted },
  summary: { fontFamily: fontFamily.body, fontSize: 17, color: colors.ink },
});
