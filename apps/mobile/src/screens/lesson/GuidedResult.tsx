import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, feedbackText, radius, space } from '@prepio/shared';
import { AppText, Button, Confetti, Enter, ScoreRing, ScreenLayout, goBackOrHome } from '../../ui';
import type { AttemptOutcome } from '../../lib/lessonFlow';

const CONFETTI_DELAY_MS = 200;
const goHome = () => router.replace('/');

/** Ring plus the same score line as the free-mode done screen; nothing for a lesson without questions. */
function Score({ outcome }: { outcome: AttemptOutcome }) {
  if (outcome.total === 0) return null;
  return (
    <>
      <Enter index={0}>
        <ScoreRing value={outcome.correct} min={0} max={outcome.total} />
      </Enter>
      <Enter index={1}>
        <AppText role="bodyStrong" color="textMuted" style={styles.centre}>
          {outcome.correct} din {outcome.total} întrebări corecte
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
};

/** Mockup screen 4, right: every answer correct, the lesson is finished. */
export function GuidedPassed({ outcome, unlocked, nextId }: PassedProps) {
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
          <View style={styles.stack}>
            {nextId ? <Button label="Mergi la lecția următoare" onPress={() => router.replace(`/lesson/${nextId}`)} /> : null}
            <Button label="Înapoi acasă" variant={nextId ? 'secondary' : 'primary'} onPress={goHome} />
          </View>
        }
      >
        <View style={styles.result}>
          <Score outcome={outcome} />
          <Enter index={2}>
            <AppText role="celebrate" accessibilityRole="header" style={styles.centre}>
              Lecție terminată! 🎉
            </AppText>
          </Enter>
          {unlocked ? (
            <Enter index={3}>
              <AppText role="lead" color="textMuted" style={styles.centre}>
                Ai deblocat: {unlocked}
              </AppText>
            </Enter>
          ) : null}
        </View>
      </ScreenLayout>
      <Confetti trigger={burst} />
    </View>
  );
}

type FailedProps = {
  outcome: AttemptOutcome;
  /** Undefined when the lesson has no cards to review. */
  onReviewCards?: () => void;
  onRetake: () => void;
};

/** Mockup screen 4, left: not every answer correct; the whole test is taken again. */
export function GuidedFailed({ outcome, onReviewCards, onRetake }: FailedProps) {
  return (
    <ScreenLayout
      title="Rezultat"
      progress={1}
      onBack={goBackOrHome}
      actions={
        <View style={styles.stack}>
          {onReviewCards ? <Button label="Revezi cardurile" onPress={onReviewCards} /> : null}
          <Button label="Reia testul acum" variant={onReviewCards ? 'secondary' : 'primary'} onPress={onRetake} />
        </View>
      }
    >
      <View style={styles.result}>
        <Score outcome={outcome} />
        <Enter index={2}>
          <AppText role="celebrate" accessibilityRole="header" style={styles.centre}>
            Aproape!
          </AppText>
        </Enter>
        <Enter index={3}>
          <AppText role="small" color="textMuted" style={styles.centre}>
            Ca să treci mai departe, ai nevoie de toate răspunsurile corecte. Revezi cardurile și încearcă din nou.
          </AppText>
        </Enter>
        <Enter index={4} style={styles.note}>
          <AppText role="label" style={styles.noteText}>
            {`Ai greșit la: ${outcome.wrong.map((n) => `întrebarea ${n}`).join(', ')}`}
          </AppText>
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
  stack: { flex: 1, gap: space[2.5] },
});
