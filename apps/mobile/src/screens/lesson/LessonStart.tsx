import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { color, layout, space, type Lesson } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout, Surface, TextButton, goBackOrHome } from '../../ui';
import { countLabel } from '../../lib/lessonCount';
import type { ZoneProgress } from '../../lib/lessonProgressLabel';
import ZoneRow, { CONSOLIDATION_TINT } from './ZoneRow';
import CreditChip from '../../credits/CreditChip';

type Props = {
  lesson: Lesson;
  guided: boolean;
  /** The lesson is finished: its zones show ✓ and consolidation opens. */
  finished: boolean;
  /** Number of consolidation exercises; the zone is hidden at 0. */
  consolidation: number;
  /** Where the student left the cards / the test, and the last failed score (describeProgress). */
  progress?: ZoneProgress;
  /** Set after a failed test (and nothing saved since): „Reia testul” becomes the main action. */
  onRetake?: () => void;
  /** Set when the student has a saved position in this lesson. */
  onResume?: () => void;
  onLearn: () => void;
  onSkip: () => void;
};

/**
 * Mockup screen 3: shown every time a lesson is opened, before the cards. The buttons sit in the action bar on
 * phones and right under the card on wide screens.
 */
export default function LessonStart({ lesson, guided, finished, consolidation, progress = {}, onRetake, onResume, onLearn, onSkip }: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const hasCards = lesson.cards.length > 0;
  const lead = onResume ?? onRetake;
  const buttons = (
    <View style={styles.stack}>
      {onResume ? <Button label="Continuă de unde ai rămas" onPress={onResume} /> : null}
      {!onResume && onRetake ? <Button label="Reia testul" onPress={onRetake} /> : null}
      {hasCards ? <Button label="Începe învățarea" variant={lead ? 'secondary' : 'primary'} onPress={onLearn} /> : null}
      {/* With nothing to learn first, going to the verification is the main action; otherwise a quiet link. */}
      {onRetake && !onResume ? null : lead || hasCards ? (
        <TextButton label="Știu deja, sari la verificare" onPress={onSkip} />
      ) : (
        <Button label="Știu deja, sari la verificare" onPress={onSkip} />
      )}
    </View>
  );
  return (
    <ScreenLayout title="Lecție" pageTitle={lesson.title} onBack={goBackOrHome} trailing={<CreditChip />} actions={wide ? undefined : buttons}>
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
              hint={progress.learn}
              marker={finished ? '✓' : undefined}
            />
            <ZoneRow
              icon="✅"
              title="Verificare"
              subtitle={countLabel(lesson.questions.length, 'întrebare', 'întrebări')}
              hint={progress.check}
              tint={color.accentSubtle}
              marker={finished ? '✓' : undefined}
            />
            {consolidation > 0 ? (
              <ZoneRow
                icon="🎯"
                title="Consolidare"
                subtitle={`${countLabel(consolidation, 'exercițiu', 'exerciții')} tip BAC`}
                hint={finished ? progress.consolidate : 'Se deschide după ce termini verificarea'}
                tint={CONSOLIDATION_TINT}
                marker={finished ? (progress.consolidate ? 'Continuă ›' : 'Începe ›') : undefined}
                highlight={finished}
                dimmed={!finished}
                onPress={finished ? () => router.push(`/lesson/${lesson.id}/consolidare`) : undefined}
              />
            ) : null}
          </View>
        </Enter>
        {finished ? (
          <Enter index={2}>
            <AppText role="label" color="primary">
              ✓ Lecție terminată
            </AppText>
          </Enter>
        ) : guided ? (
          <Enter index={2}>
            <AppText role="small" color="textMuted">
              Dacă răspunzi corect la toate, treci la lecția următoare.
            </AppText>
          </Enter>
        ) : null}
      </Surface>
      {wide ? <View style={styles.inline}>{buttons}</View> : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  zones: { gap: space[2], marginTop: space[1] },
  card: { gap: space[2] },
  // Stacked full-width buttons in the action bar (it lays its children out in a row).
  stack: { flex: 1, gap: space[2.5] },
  inline: { marginTop: space[5] },
});
