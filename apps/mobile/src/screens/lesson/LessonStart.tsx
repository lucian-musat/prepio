import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { color, layout, space, type Lesson } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout, Surface, TextButton, goBackOrHome } from '../../ui';
import { t, tPlural } from '../../texts/store';
import type { ZoneProgress } from '../../lib/lessonProgressLabel';
import ZoneRow, { CONSOLIDATION_TINT } from './ZoneRow';
import HeaderPills from '../../streak/HeaderPills';

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
      {onResume ? <Button label={t('lesson.start.resume')} onPress={onResume} /> : null}
      {!onResume && onRetake ? <Button label={t('lesson.start.retake')} onPress={onRetake} /> : null}
      {hasCards ? <Button label={t('lesson.start.learn')} variant={lead ? 'secondary' : 'primary'} onPress={onLearn} /> : null}
      {/* With nothing to learn first, going to the verification is the main action; otherwise a quiet link. */}
      {onRetake && !onResume ? null : lead || hasCards ? (
        <TextButton label={t('lesson.start.skip')} onPress={onSkip} />
      ) : (
        <Button label={t('lesson.start.skip')} onPress={onSkip} />
      )}
    </View>
  );
  return (
    <ScreenLayout title={t('lesson.screenTitle')} pageTitle={lesson.title} onBack={goBackOrHome} trailing={<HeaderPills />} actions={wide ? undefined : buttons}>
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
              title={t('lesson.start.learnZone')}
              subtitle={tPlural(lesson.cards.length, 'lesson.cardCount.one', 'lesson.cardCount.many')}
              hint={progress.learn}
              marker={finished ? '✓' : undefined}
            />
            <ZoneRow
              icon="✅"
              title={t('lesson.start.checkZone')}
              subtitle={tPlural(lesson.questions.length, 'lesson.questionCount.one', 'lesson.questionCount.many')}
              hint={progress.check}
              tint={color.accentSubtle}
              marker={finished ? '✓' : undefined}
            />
            {consolidation > 0 ? (
              <ZoneRow
                icon="🎯"
                title={t('lesson.start.consolidateZone')}
                subtitle={t('lesson.start.consolidateSubtitle', { exercitii: tPlural(consolidation, 'lesson.exerciseCount.one', 'lesson.exerciseCount.many') })}
                hint={finished ? progress.consolidate : t('lesson.start.consolidateLocked')}
                tint={CONSOLIDATION_TINT}
                marker={finished ? t(progress.consolidate ? 'lesson.start.consolidateContinue' : 'lesson.start.consolidateStart') : undefined}
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
              {t('lesson.start.finished')}
            </AppText>
          </Enter>
        ) : guided ? (
          <Enter index={2}>
            <AppText role="small" color="textMuted">
              {t('lesson.start.guidedHint')}
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
