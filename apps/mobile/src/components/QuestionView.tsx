import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type Animated from 'react-native-reanimated';
import {
  checkAnswer,
  color,
  feedbackText,
  motion,
  radius,
  shuffleForDisplay,
  space,
  stroke,
  type Answer,
  typeScale,
  type OrderItem,
  type Question,
} from '@prepio/shared';
import { AppText, Button, Confetti, Enter, Icon, Pop, SCREEN_CONTENT_TOP, ScreenLayout, Surface, easing, feedbackConfig } from '../ui';
import ChoiceQuestion from './ChoiceQuestion';
import DifficultyBadge from './DifficultyBadge';
import OrderQuestion, { CorrectOrder } from './OrderQuestion';

export type LessonFrame = { title: string; progress: number; onBack: () => void };

type Props = {
  question: Question;
  onAnswered: (correct: boolean) => void;
  /** Called by the "next" button shown after checking. */
  onNext?: () => void;
  /** Label of the button shown after checking. */
  nextLabel?: string;
  frame: LessonFrame;
};

const TYPE_LABELS: Record<Question['type'], string> = {
  single_choice: 'Alegere unică',
  multiple_choice: 'Alegere multiplă',
  chronological_order: 'Ordine cronologică',
};

// The action bar repeats a single correct answer only when it fits on about one line.
const SHORT_ANSWER_MAX = 60;
// Prototype `reveal`: scroll so new content sits 12 px below the top bar.
const REVEAL_GAP = space[3];
const SEE_ABOVE = 'Vezi răspunsul corect mai sus.';

// Badge: 15 px line + 2 × 2 px padding (Chip `badge`), against the 16 px eyebrow line.
const BADGE_OVERHANG = (typeScale.badge.lineHeight + space[1] - typeScale.eyebrow.lineHeight) / 2;
const ICON_SIZE = space[6] + space[1]; // 28 px circle (prototype `.feedback .ic`)
const ICON_GLYPH = space[4];

const verdictText = (good: boolean) => (good ? 'Corect, bravo!' : 'Nu chiar.');

/** Verdict icon in a circle that pops in (prototype `.feedback .ic`). */
function VerdictIcon({ good }: { good: boolean }) {
  return (
    <Pop duration={motion.duration.slow} style={[styles.icon, { backgroundColor: good ? color.success : color.danger }]}>
      <Icon name={good ? 'check' : 'close'} size={ICON_GLYPH} stroke={stroke.iconBold} tint={color.onPrimary} />
    </Pop>
  );
}

function Verdict({ good, line }: { good: boolean; line: string | null }) {
  const tint = { color: good ? feedbackText.good : feedbackText.wrong };
  return (
    <View style={styles.verdict}>
      <VerdictIcon good={good} />
      <View style={styles.verdictText}>
        <AppText role="verdict" style={tint}>
          {verdictText(good)}
        </AppText>
        {line ? (
          <AppText role="small" style={tint} numberOfLines={2}>
            {line}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One question screen: the question card scrolls, "Verifică" and then the verdict + next button live
 * in the fixed action bar. Each thing is said once: the options mark the right answer, the bar names a short one
 * (or points up), the explanation sits under the options, and a wrong order shows the correct sequence there.
 */
export default function QuestionView({ question, onAnswered, onNext, nextLabel = 'Următoarea întrebare', frame }: Props) {
  const isOrder = question.type === 'chronological_order';
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<OrderItem[]>(() => (isOrder ? shuffleForDisplay(question.options) : []));
  const [correct, setCorrect] = useState<boolean | null>(null);
  const answered = correct !== null;
  // Refs, not state: two presses in the same frame must still count once (Button has no latch).
  const answeredRef = useRef(false);
  const nextRef = useRef(false);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrolledRef = useRef(false);

  const correctTexts = question.type === 'chronological_order' ? [] : question.options.filter((o) => o.correct).map((o) => o.text);

  /** Second line of the verdict in the action bar: only after a wrong answer, never the explanation again. */
  const barLine = (ok: boolean): string | null => {
    if (ok) return null;
    const only = correctTexts.length === 1 ? correctTexts[0]! : null;
    if (correctTexts.length === 0) return null; // nothing is revealed above, so there is nothing to point at
    return only && only.length <= SHORT_ANSWER_MAX ? `Răspuns corect: ${only}` : SEE_ABOVE;
  };

  const toggle = (id: string) => {
    if (answered) return;
    if (question.type === 'multiple_choice') {
      setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    } else {
      setSelected([id]);
    }
  };

  const move = (i: number, delta: -1 | 1) => {
    if (answered) return;
    setOrder((cur) => {
      const j = i + delta;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const submit = () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    const answer: Answer =
      question.type === 'chronological_order'
        ? { type: 'chronological_order', order: order.map((o) => o.id) }
        : { type: question.type, selected };
    const ok = checkAnswer(question, answer);
    setCorrect(ok);
    onAnswered(ok);
    // An explicit announcement: a live region on the freshly mounted feedback slot is unreliable.
    AccessibilityInfo.announceForAccessibility(`${verdictText(ok)} ${barLine(ok) ?? ''}`.trim());
  };

  const next = () => {
    if (nextRef.current) return;
    nextRef.current = true;
    onNext?.();
  };

  // Bring the revealed answer / explanation into view (only the content scroll view moves).
  const onRevealLayout = (e: LayoutChangeEvent) => {
    if (scrolledRef.current) return;
    scrolledRef.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, SCREEN_CONTENT_TOP + e.nativeEvent.layout.y - REVEAL_GAP), animated: true });
  };

  const line = correct === null ? null : barLine(correct);

  const canCheck = isOrder || selected.length > 0;
  // Choice questions mark the right options in place; only a wrong order needs the sequence spelled out.
  const showCorrectOrder = correct === false && question.type === 'chronological_order';
  const hasReveal = showCorrectOrder || !!(answered && question.explanation);

  return (
    <View style={styles.fill}>
      <ScreenLayout
        title={frame.title}
        progress={frame.progress}
        onBack={frame.onBack}
        scrollRef={scrollRef}
        tone={correct === null ? 'neutral' : correct ? 'good' : 'wrong'}
        feedback={answered ? <Verdict good={!!correct} line={line} /> : undefined}
        actions={
          answered ? (
            <Button key="next" flex label={nextLabel} tone={correct ? 'success' : 'primary'} onPress={next} />
          ) : (
            <Button key="check" flex label="Verifică" disabled={!canCheck} onPress={submit} />
          )
        }
      >
        <View style={styles.content}>
          <Surface padding={5} radius="xl">
            {/* Prototype `.qcard.stagger`: eyebrow, prompt and options rise one after another. */}
            <Enter index={0} style={styles.header}>
              <AppText role="eyebrow" color="primary">
                {TYPE_LABELS[question.type]}
              </AppText>
              <View style={styles.badge}>
                <DifficultyBadge difficulty={question.difficulty} />
              </View>
            </Enter>
            <Enter index={1}>
              <AppText role="question" style={question.type === 'multiple_choice' ? styles.promptWithHint : styles.prompt}>
                {question.prompt}
              </AppText>
              {question.type === 'multiple_choice' ? (
                <AppText role="small" color="textMuted" style={styles.hint}>
                  Alege toate variantele corecte.
                </AppText>
              ) : null}
            </Enter>
            <Enter index={2}>
              {question.type === 'chronological_order' ? (
                <OrderQuestion order={order} items={question.options} answered={answered} onMove={move} />
              ) : (
                <ChoiceQuestion
                  options={question.options}
                  multiple={question.type === 'multiple_choice'}
                  answered={answered}
                  selected={selected}
                  onToggle={toggle}
                />
              )}
            </Enter>
          </Surface>

          {hasReveal ? (
            <View onLayout={onRevealLayout}>
              <Enter config={feedbackConfig} curve={easing.standard} style={styles.reveal}>
                {showCorrectOrder && question.type === 'chronological_order' ? <CorrectOrder items={question.options} /> : null}
                {question.explanation ? (
                  <Surface padding={4} radius="lg">
                    <AppText role="small">{question.explanation}</AppText>
                  </Surface>
                ) : null}
              </Enter>
            </View>
          ) : null}
        </View>
      </ScreenLayout>
      <Confetti trigger={correct ? 1 : 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  // The badge (app-only) is taller than the eyebrow line; it overhangs so the prompt sits where the prototype has it.
  badge: { marginVertical: -BADGE_OVERHANG },
  prompt: { marginTop: space[1.5], marginBottom: space[4] },
  promptWithHint: { marginTop: space[1.5], marginBottom: space[1] },
  hint: { marginBottom: space[4] },
  reveal: { gap: space[3] },
  // Prototype `.feedback`: padding 2px 0 12px.
  verdict: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingTop: space[1] / 2, paddingBottom: space[3] },
  icon: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  verdictText: { flex: 1 },
});
