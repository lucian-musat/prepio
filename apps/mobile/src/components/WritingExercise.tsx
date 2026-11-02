import { useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  color,
  feedbackText,
  MAX_ESSAY_CHARS,
  radius,
  space,
  type EvaluateResponse,
  type WritingExercise as WritingExerciseData,
} from '@prepio/shared';
import { evaluateEssay } from '../lib/api';
import { AppText, Button, Enter, ScoreRing, SCREEN_CONTENT_TOP, ScreenLayout, Skeleton, Surface, TextArea } from '../ui';
import type { LessonFrame } from './QuestionView';
import { fontFamily } from '../theme/fonts';

type Props = {
  exercise: WritingExerciseData;
  frame: LessonFrame;
  /** Label of the secondary action that moves on (allowed at any time: the exercise can be skipped). */
  nextLabel: string;
  onNext: () => void;
};

// Prototype `.skel .l` widths.
const SKELETON_LINES = [90, 75, 60];
// Prototype `.counter` side margin.
const COUNTER_INSET = 2;
// Prototype `.counter` sits 8 px under the textarea plus the ~6 px line-box descent below the inline
// textarea: 14 px in all.
const COUNTER_GAP = space[3.5];
// Prototype `reveal`: scroll so new content sits 12 px below the top bar.
const REVEAL_GAP = space[3];
// Below this window width the two action labels don't fit side by side (360 px phone: the submit
// label truncated), so the actions stack, the primary one last, where it sits on every other screen.
const STACK_ACTIONS_BELOW = 480;

function Result({ result }: { result: EvaluateResponse }) {
  return (
    <Surface padding={4.5} radius="xl">
      <Enter index={0} style={styles.grade}>
        <ScoreRing value={result.grade} min={result.gradeMin} max={result.gradeMax} />
        <View style={styles.gradeText}>
          <AppText role="section" accessibilityRole="header" style={styles.gradeTitle}>
            Nota ta
          </AppText>
          <AppText role="note" color="textMuted">
            {result.summary}
          </AppText>
        </View>
      </Enter>
      {result.suggestions.length > 0 ? (
        <>
          <Enter index={1}>
            <AppText role="eyebrow" color="textMuted" style={styles.suggLabel}>
              Ce poți îmbunătăți
            </AppText>
          </Enter>
          {/* Prototype `.result.stagger`: the list rises as one block, after the label. */}
          <Enter index={2} style={styles.sugg}>
            {result.suggestions.map((s, i) => (
              <View key={i} style={styles.suggRow}>
                <AppText role="list" color="primary" style={styles.arrow} importantForAccessibility="no" accessibilityElementsHidden>
                  →
                </AppText>
                <AppText role="list" style={styles.suggText}>
                  {s}
                </AppText>
              </View>
            ))}
          </Enter>
        </>
      ) : null}
    </Surface>
  );
}

/**
 * Writing exercise screen (prototype `writing()`): the prompt and answer field in a card; the
 * skeleton and then the AI evaluation appear under the counter and scroll into view. The action bar
 * holds "move on" (always available) and submit / resubmit.
 */
export function WritingExercise({ exercise, frame, nextLabel, onNext }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ref, not state: two presses in the same frame must still submit once.
  const busyRef = useRef(false);
  // Count of attempts and of results: each new skeleton and each new result scrolls into view once.
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const cardY = useRef(0);
  const scrolledKey = useRef<string | null>(null);

  const stacked = useWindowDimensions().width < STACK_ACTIONS_BELOW;
  const count = [...text].length;
  const over = count > MAX_ESSAY_CHARS;
  const canSubmit = !loading && text.trim().length > 0 && !over;

  const submit = async () => {
    if (busyRef.current || !canSubmit) return;
    busyRef.current = true;
    setAttempt((n) => n + 1);
    setLoading(true);
    setError(null);
    // A new attempt starts clean: an error after a resubmit must not sit next to the previous grade.
    setResult(null);
    try {
      setResult(await evaluateEssay({ exerciseId: exercise.id, text }));
      setResults((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluarea nu a reușit. Încearcă din nou.');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  // Bring the skeleton, then the result, into view once each (only the content scroll view moves).
  const outKey = loading ? `loading-${attempt}` : result ? `result-${results}` : null;
  const onOutLayout = (e: LayoutChangeEvent) => {
    if (!outKey || scrolledKey.current === outKey) return;
    scrolledKey.current = outKey;
    // Prototype `reveal`: 12 px of breathing room under the top bar.
    scrollRef.current?.scrollTo({ y: Math.max(0, SCREEN_CONTENT_TOP + cardY.current + e.nativeEvent.layout.y - REVEAL_GAP), animated: true });
  };

  return (
    <ScreenLayout
      title={frame.title}
      progress={frame.progress}
      onBack={frame.onBack}
      scrollRef={scrollRef}
      actions={
        <View testID="writing-actions" style={[styles.actions, stacked && styles.actionsStacked]}>
          <Button variant="secondary" label={nextLabel} onPress={onNext} />
          <Button
            flex={!stacked}
            label={result ? 'Retrimite' : 'Trimite pentru evaluare'}
            loading={loading}
            disabled={!loading && !canSubmit}
            onPress={() => void submit()}
          />
        </View>
      }
    >
      <View testID="writing-card" onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}>
        <Surface padding={5} radius="xl">
          <AppText role="eyebrow" color="primary">
            Exercițiu de scriere · evaluat cu AI
          </AppText>
          <AppText role="question" style={styles.prompt}>
            {exercise.prompt}
          </AppText>
          <TextArea
            value={text}
            onChangeText={setText}
            accessibilityLabel="Răspunsul tău"
            placeholder="Scrie răspunsul tău aici…"
            invalid={over}
          />
          <View style={styles.counter}>
            <AppText role="caption" color="textMuted" style={over && styles.dangerText}>
              {count} / {MAX_ESSAY_CHARS}
            </AppText>
          </View>

          {error ? (
            <View accessible accessibilityRole="alert" style={styles.error}>
              <AppText role="small" style={styles.dangerText}>
                {error}
              </AppText>
            </View>
          ) : null}
          {/* A direct child of the card, so its layout y + the card's y is its offset in the scroll content. */}
          {outKey ? (
            <View key={outKey} testID="evaluation-slot" onLayout={onOutLayout}>
              {loading ? <Skeleton lines={SKELETON_LINES} /> : result ? <Result result={result} /> : null}
            </View>
          ) : null}
        </Surface>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  // Prototype `.qcard h2` margins.
  prompt: { marginTop: space[1.5], marginBottom: space[4] },
  // Prototype `.counter`: margin 8px 2px 14px (see COUNTER_GAP).
  counter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: COUNTER_GAP,
    marginHorizontal: COUNTER_INSET,
    marginBottom: space[3.5],
  },
  // Same gap as the action bar row.
  actions: { flex: 1, flexDirection: 'row', gap: space[2.5] },
  actionsStacked: { flexDirection: 'column' },
  // feedbackText.wrong, not danger: AA contrast (danger is ~3.4:1 on dangerSubtle, ~3.9:1 on white).
  dangerText: { color: feedbackText.wrong },
  error: { padding: space[3], marginBottom: space[3.5], borderRadius: radius.md, backgroundColor: color.dangerSubtle },
  grade: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  gradeText: { flex: 1, gap: space[1] },
  // Prototype `.grade h3` has no heading letter-spacing.
  gradeTitle: { letterSpacing: 0 },
  // Prototype `.label-sm`: margin 18px 0 8px.
  suggLabel: { marginTop: space[4.5], marginBottom: space[2] },
  sugg: { gap: space[2] },
  suggRow: {
    flexDirection: 'row',
    gap: space[2.5],
    paddingVertical: space[2.5],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  suggText: { flex: 1 },
  // Prototype `.sugg li::before`: weight 800 (rendered bold).
  arrow: { fontFamily: fontFamily.bodyBold },
});
