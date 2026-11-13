import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, feedbackText, radius, space, type Question } from '@prepio/shared';
import { AppText, Button, Confetti, Enter, Icon, ScoreRing, ScreenLayout, goBackOrHome } from '../../ui';
import ZoneRow, { CONSOLIDATION_TINT } from './ZoneRow';
import type { AttemptOutcome } from '../../lib/lessonFlow';
import { t } from '../../texts/store';

const CONFETTI_DELAY_MS = 200;
const goHome = () => router.replace('/');

/** Opens the consolidation run of a lesson. */
export const startConsolidation = (lessonId: string) => router.push(`/lesson/${lessonId}/consolidare`);

/** Mockup flow screen 2: the card that announces the unlocked consolidation. */
export function ConsolidationUnlocked() {
  return (
    <Enter index={4} style={styles.unlocked}>
      <ZoneRow icon="🎯" title={t('lesson.result.consolidationUnlocked')} subtitle={t('lesson.result.consolidationUnlockedHint')} tint={CONSOLIDATION_TINT} />
    </Enter>
  );
}

/** Ring plus the same score line as the free-mode done screen; nothing for a lesson without questions. */
function Score({ outcome }: { outcome: AttemptOutcome }) {
  if (outcome.total === 0) return null;
  const score = t('lesson.result.score', { corecte: outcome.correct, total: outcome.total });
  return (
    <>
      <Enter index={0}>
        <ScoreRing value={outcome.correct} min={0} max={outcome.total} showMax label={score} />
      </Enter>
      <Enter index={1}>
        <AppText role="bodyStrong" color="textMuted" style={styles.centre}>
          {score}
        </AppText>
      </Enter>
    </>
  );
}

type PassedProps = {
  outcome: AttemptOutcome;
  /** Title of the lesson this pass unlocked (only when it was locked before this pass). */
  unlocked?: string;
  /** Id of the lesson to go on to (the first unfinished one), if there is one. */
  nextId?: string;
  /** Lesson id and number of consolidation exercises; the consolidation card and button show when n > 0. */
  consolidation?: { lessonId: string; count: number };
};

/** Mockup screen 4, right: every answer correct, the lesson is finished. */
export function GuidedPassed({ outcome, unlocked, nextId, consolidation }: PassedProps) {
  const hasConsolidation = !!consolidation && consolidation.count > 0;
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setBurst(1), CONFETTI_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.fill}>
      <ScreenLayout
        title={t('lesson.result.finishedTitle')}
        progress={1}
        onBack={goBackOrHome}
        actions={
          <View style={styles.stack}>
            {hasConsolidation ? <Button label={t('lesson.result.startConsolidation')} onPress={() => startConsolidation(consolidation.lessonId)} /> : null}
            {nextId ? (
              <Button
                label={t('lesson.result.nextLesson')}
                variant={hasConsolidation ? 'secondary' : 'primary'}
                onPress={() => router.replace(`/lesson/${nextId}`)}
              />
            ) : null}
            {/* The next lesson is the secondary action; with none (or without consolidation) home takes that place. */}
            {!nextId || !hasConsolidation ? (
              <Button label={t('lesson.result.goHome')} variant={nextId || hasConsolidation ? 'secondary' : 'primary'} onPress={goHome} />
            ) : null}
          </View>
        }
      >
        <View style={styles.result}>
          <Score outcome={outcome} />
          <Enter index={2}>
            <AppText role="celebrate" accessibilityRole="header" style={styles.centre}>
              {t('lesson.result.passed')}
            </AppText>
          </Enter>
          {unlocked ? (
            <Enter index={3}>
              <AppText role="lead" color="textMuted" style={styles.centre}>
                {t('lesson.result.unlocked', { titlu: unlocked })}
              </AppText>
            </Enter>
          ) : null}
          {hasConsolidation ? <ConsolidationUnlocked /> : null}
        </View>
      </ScreenLayout>
      <Confetti trigger={burst} />
    </View>
  );
}

/** The right answer of a question, as one line: the correct options, or the order. */
export function correctAnswerText(q: Question): string {
  if (q.type === 'chronological_order') return q.options.map((o) => o.text).join(' → ');
  const right = q.options.filter((o) => o.correct).map((o) => o.text);
  return right.length === 1
    ? t('lesson.test.correctAnswer', { raspuns: right[0]! })
    : t('lesson.test.correctAnswers', { raspunsuri: right.join('; ') });
}

/** A missed question that opens in place: its prompt, then the right answer and the explanation. */
function Mistake({ number, question }: { number: number; question: Question }) {
  const [open, setOpen] = useState(false);
  const label = t('lesson.result.mistake', { n: number, intrebare: question.prompt });
  return (
    <View style={styles.mistake}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.mistakeHead}
      >
        <AppText role="bodyStrong" style={styles.mistakeTitle}>
          {label}
        </AppText>
        <Icon name={open ? 'up' : 'down'} tint={color.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.mistakeBody}>
          <AppText role="small" style={styles.right}>
            {question.type === 'chronological_order' ? t('lesson.result.correctOrder', { ordine: correctAnswerText(question) }) : correctAnswerText(question)}
          </AppText>
          {question.explanation ? <AppText role="small">{question.explanation}</AppText> : null}
        </View>
      ) : null}
    </View>
  );
}

type FailedProps = {
  outcome: AttemptOutcome;
  /** The lesson's questions, in order: the missed ones open to show the right answer. */
  questions?: Question[];
  /** Undefined when the lesson has no cards to review. */
  onReviewCards?: () => void;
  onRetake: () => void;
};

/** Mockup screen 4, left: not every answer correct; the whole test is taken again. */
export function GuidedFailed({ outcome, questions = [], onReviewCards, onRetake }: FailedProps) {
  return (
    <ScreenLayout
      title={t('lesson.result.failedTitle')}
      progress={1}
      onBack={goBackOrHome}
      actions={
        <View style={styles.stack}>
          {onReviewCards ? <Button label={t('lesson.result.reviewCards')} onPress={onReviewCards} /> : null}
          <Button label={t('lesson.result.retakeNow')} variant={onReviewCards ? 'secondary' : 'primary'} onPress={onRetake} />
        </View>
      }
    >
      <View style={styles.result}>
        <Score outcome={outcome} />
        <Enter index={2}>
          <AppText role="celebrate" accessibilityRole="header" style={styles.centre}>
            {t('lesson.result.almost')}
          </AppText>
        </Enter>
        <Enter index={3}>
          <AppText role="small" color="textMuted" style={styles.centre}>
            {t('lesson.result.failedBody')}
          </AppText>
        </Enter>
        <Enter index={4} style={styles.note}>
          <AppText role="label" style={styles.noteText}>
            {t('lesson.result.mistakes')}
          </AppText>
          {outcome.wrong.map((n) =>
            questions[n - 1] ? (
              <Mistake key={n} number={n} question={questions[n - 1]!} />
            ) : (
              <AppText key={n} role="small" style={styles.noteText}>{t('lesson.result.mistakeNumber', { n })}</AppText>
            ),
          )}
        </Enter>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Prototype `.done-wrap` spacing.
  result: { alignItems: 'center', gap: space[3], paddingVertical: space[6], paddingHorizontal: space[2] },
  centre: { textAlign: 'center' },
  note: {
    alignSelf: 'stretch',
    backgroundColor: color.dangerSubtle,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  noteText: { color: feedbackText.wrong, textAlign: 'center' },
  mistake: { backgroundColor: color.surface, borderRadius: radius.md, marginTop: space[2] },
  mistakeHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44, paddingHorizontal: space[3], paddingVertical: space[2] },
  mistakeTitle: { flex: 1 },
  mistakeBody: { gap: space[2], paddingHorizontal: space[3], paddingBottom: space[3] },
  right: { color: feedbackText.good, fontWeight: '700' },
  stack: { flex: 1, gap: space[2.5] },
  unlocked: { alignSelf: 'stretch', marginTop: space[3] },
});
