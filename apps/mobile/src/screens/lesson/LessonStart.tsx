import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, space, type Lesson } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout, Surface, TextButton, goBackOrHome } from '../../ui';
import { countLabel } from '../../lib/lessonCount';
import ZoneRow, { CONSOLIDATION_TINT } from './ZoneRow';

type Props = {
  lesson: Lesson;
  guided: boolean;
  /** The lesson is finished: its zones show ✓ and consolidation opens. */
  finished: boolean;
  /** Number of consolidation exercises; the zone is hidden at 0. */
  consolidation: number;
  /** Set when the student has a saved position in this lesson. */
  onResume?: () => void;
  onLearn: () => void;
  onSkip: () => void;
};

/** Mockup screen 3: shown every time a lesson is opened, before the cards. */
export default function LessonStart({ lesson, guided, finished, consolidation, onResume, onLearn, onSkip }: Props) {
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
          {/* With nothing to learn first, going to the verification is the main action; otherwise a quiet link. */}
          {onResume || hasCards ? (
            <TextButton label="Știu deja — sari la verificare" onPress={onSkip} />
          ) : (
            <Button label="Știu deja — sari la verificare" onPress={onSkip} />
          )}
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
          <View style={styles.zones}>
            <ZoneRow
              icon="📖"
              title="Învățare"
              subtitle={countLabel(lesson.cards.length, 'card', 'carduri')}
              marker={finished ? '✓' : undefined}
            />
            <ZoneRow
              icon="✅"
              title="Verificare"
              subtitle={countLabel(lesson.questions.length, 'întrebare', 'întrebări')}
              tint={color.accentSubtle}
              marker={finished ? '✓' : undefined}
            />
            {consolidation > 0 ? (
              <ZoneRow
                icon="🎯"
                title="Consolidare"
                subtitle={`${countLabel(consolidation, 'exercițiu', 'exerciții')} tip BAC`}
                hint={finished ? undefined : 'Se deschide după ce termini verificarea'}
                tint={CONSOLIDATION_TINT}
                marker={finished ? 'Începe ›' : undefined}
                highlight={finished}
                dimmed={!finished}
                onPress={finished ? () => router.push(`/lesson/${lesson.id}/consolidare`) : undefined}
              />
            ) : null}
          </View>
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
  zones: { gap: space[2], marginTop: space[1] },
  card: { gap: space[2] },
  // Stacked full-width buttons in the action bar (it lays its children out in a row).
  stack: { flex: 1, gap: space[2.5] },
});
