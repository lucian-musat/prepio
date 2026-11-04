import { StyleSheet, View } from 'react-native';
import { space, type Lesson } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout, Surface, goBackOrHome } from '../../ui';
import { countLabel } from '../../lib/lessonCount';

type Props = {
  lesson: Lesson;
  guided: boolean;
  /** Set when the student has a saved position in this lesson. */
  onResume?: () => void;
  onLearn: () => void;
  onSkip: () => void;
};

/** Mockup screen 3: shown every time a lesson is opened, before the cards. */
export default function LessonStart({ lesson, guided, onResume, onLearn, onSkip }: Props) {
  // The test is the questions plus the writing exercises.
  const tests = lesson.questions.length + lesson.exercises.length;
  const hasCards = lesson.cards.length > 0;
  return (
    <ScreenLayout
      title="Lecție"
      onBack={goBackOrHome}
      actions={
        <View style={styles.stack}>
          {onResume ? <Button label="Continuă de unde ai rămas" onPress={onResume} /> : null}
          {hasCards ? (
            <Button label="Începe învățarea" variant={onResume ? 'secondary' : 'primary'} onPress={onLearn} />
          ) : null}
          <Button
            label="Știu deja — sari la exerciții"
            variant={onResume || hasCards ? 'secondary' : 'primary'}
            onPress={onSkip}
          />
        </View>
      }
    >
      <Surface style={styles.card}>
        <Enter index={0}>
          <AppText role="title" accessibilityRole="header">
            {lesson.title}
          </AppText>
        </Enter>
        <Enter index={1}>
          <AppText role="lead" color="textMuted">
            {`${countLabel(lesson.cards.length, 'card', 'carduri')} · ${countLabel(tests, 'exercițiu', 'exerciții')}`}
          </AppText>
        </Enter>
        {guided ? (
          <Enter index={2}>
            <AppText role="small" color="textMuted">
              Dacă răspunzi corect la toate, treci la lecția următoare.
            </AppText>
          </Enter>
        ) : null}
      </Surface>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2] },
  // Stacked full-width buttons in the action bar (it lays its children out in a row).
  stack: { flex: 1, gap: space[2.5] },
});
