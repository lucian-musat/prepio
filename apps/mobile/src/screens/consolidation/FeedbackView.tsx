import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, motion, radius, space, stroke, type ConsolidationExercise, type ExerciseFeedback, type FeedbackItem } from '@prepio/shared';
import { VERDICT_TONE } from '../../components/consolidation/verdictTone';
import { AppText, Button, Enter, Icon, Pop, Spinner, easing, feedbackConfig } from '../../ui';

const ICON = 24;
const ICON_GLYPH = 13;

export const AI_NOTE = 'Feedback generat cu AI pe baza indicațiilor profesorului. Poate greși.';
// Mixed types: say which part the AI judged (types mockup).
const MIXED_NOTE: Partial<Record<ConsolidationExercise['type'], string>> = {
  viewpoint: 'Punctul de vedere e evaluat cu AI și poate greși; informațiile sunt verificate exact.',
  argument: 'Conectorii sunt verificați automat; faptul istoric e evaluat cu AI și poate greși.',
};

/** One verdict box (types mockup `.fb`): the icon, the title, then what was good and what to improve. */
export function FeedbackBox({ item, children }: { item: FeedbackItem; children?: React.ReactNode }) {
  const tone = VERDICT_TONE[item.verdict];
  const ink = { color: tone.fg };
  return (
    <Enter config={feedbackConfig} curve={easing.standard} style={[styles.box, { backgroundColor: tone.bg }]}>
      <View style={styles.head} accessibilityRole="header">
        <Pop duration={motion.duration.slow} style={[styles.icon, { backgroundColor: tone.edge }]}>
          {item.verdict === 'almost' ? (
            <AppText role="label" color="onPrimary" style={styles.bang}>
              !
            </AppText>
          ) : (
            <Icon name={item.verdict === 'ok' ? 'check' : 'close'} size={ICON_GLYPH} stroke={stroke.iconBold} tint={color.onPrimary} />
          )}
        </Pop>
        <AppText role="verdict" style={[styles.title, ink]}>
          {item.title}
        </AppText>
      </View>
      {item.ai ? (
        <>
          {item.good.length ? <Lines heading="Bine:" lines={item.good} ink={ink} /> : null}
          {item.improve.length ? <Lines heading="Ce poți îmbunătăți" lines={item.improve} ink={ink} /> : null}
        </>
      ) : (
        [...item.good, ...item.improve].map((line, i) => (
          <AppText key={i} role="note" style={ink}>
            {line}
          </AppText>
        ))
      )}
      {children}
    </Enter>
  );
}

function Lines({ heading, lines, ink }: { heading: string; lines: string[]; ink: { color: string } }) {
  return (
    <View style={styles.lines}>
      <AppText role="eyebrow" style={ink}>
        {heading}
      </AppText>
      {lines.map((l, i) => (
        <View key={i} style={styles.bullet}>
          <AppText role="note" style={ink}>
            •
          </AppText>
          <AppText role="note" style={[styles.fill, ink]}>
            {l}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** „Vezi răspunsul” and the like: a tap reveals the correct answer / model answer. */
export function Disclosure({ label, lines, note }: { label: string; lines: string[]; note?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.disclosure}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((x) => !x)} style={styles.toggle}>
        <AppText role="label" color="primary">
          {label}
        </AppText>
        <AppText role="label" color="primary" accessibilityElementsHidden importantForAccessibility="no">
          {open ? '▴' : '▾'}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.model}>
          {lines.map((l, i) => (
            <AppText key={i} role="note">
              {lines.length > 1 ? `• ${l}` : l}
            </AppText>
          ))}
          {note ? (
            <AppText role="note" color="textMuted">
              {note}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** What the disclosure under the feedback reveals for this exercise, if anything. */
function revealOf(ex: ConsolidationExercise, fb: ExerciseFeedback): { label: string; lines: string[]; note: string | null } | null {
  // The explanation is already the feedback text of these two types.
  const note = ex.type === 'short_answer' || ex.type === 'source_letter' ? null : ex.explanation;
  if (fb.reveal?.length) {
    const label =
      ex.type === 'source_info' ? 'Vezi toate informațiile corecte' : ex.type === 'cause_effect' ? 'Vezi relațiile posibile din sursă' : 'Vezi răspunsul';
    return { label, lines: fb.reveal, note };
  }
  if (ex.modelAnswer) return { label: 'Vezi un răspuns model', lines: [ex.modelAnswer], note };
  return note ? { label: 'Vezi explicația', lines: [note], note: null } : null;
}

/** Loading row while the AI judges the answer (types mockup `.loading`). */
export function Analyzing() {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <Spinner />
      <AppText role="note" color="textMuted">
        Se analizează răspunsul…
      </AppText>
    </View>
  );
}

/** A failed AI check: the API's message and a retry. */
export function CheckError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <AppText role="note" style={{ color: VERDICT_TONE.no.fg }}>
        {message}
      </AppText>
      <Button label="Reîncearcă" variant="secondary" onPress={onRetry} />
    </View>
  );
}

type Props = {
  exercise: ConsolidationExercise;
  feedback: ExerciseFeedback;
  /** Cause-effect with the roles inverted: swaps them back (and clears the feedback). */
  onSwap?: () => void;
};

/**
 * The checked answer's feedback, inline under the answer (types mockup): a verdict box per item (per fact under
 * „FAPTUL i”), „⇅ Inversează rolurile” for swapped roles, the „Vezi …” disclosure and the AI note.
 * The essay shows only its whole-essay item here; each requirement's feedback sits in its own card.
 */
export default function FeedbackView({ exercise, feedback, onSwap }: Props) {
  const items = exercise.type === 'essay' ? feedback.items.filter((i) => i.key === 'whole') : feedback.items;
  const reveal = revealOf(exercise, feedback);
  const ai = items.some((i) => i.ai);
  return (
    <View testID="feedback" style={styles.list}>
      {items.map((item) => {
        const fact = exercise.type === 'facts' ? /^fact-(\d+)$/.exec(item.key) : null;
        return (
          <View key={item.key} style={styles.group}>
            {fact ? (
              <AppText role="eyebrow" color="textMuted">
                {`Faptul ${Number(fact[1]) + 1}`.toUpperCase()}
              </AppText>
            ) : null}
            <FeedbackBox item={item}>
              {feedback.swapped && onSwap && item.key === 'relation' ? (
                <Pressable accessibilityRole="button" onPress={onSwap} style={styles.swap}>
                  <AppText role="label" color="primary">
                    ⇅ Inversează rolurile
                  </AppText>
                </Pressable>
              ) : null}
            </FeedbackBox>
          </View>
        );
      })}
      {reveal && (exercise.type !== 'essay' || items.length > 0) ? <Disclosure {...reveal} /> : null}
      {ai ? (
        <AppText role="caption" color="textMuted">
          {MIXED_NOTE[exercise.type] ?? AI_NOTE}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2.5] },
  group: { gap: space[1.5] },
  fill: { flex: 1 },
  box: { borderRadius: radius.md, padding: space[3], gap: space[1] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  icon: { width: ICON, height: ICON, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  bang: { lineHeight: ICON },
  title: { flex: 1 },
  lines: { gap: 2, marginTop: space[1] },
  bullet: { flexDirection: 'row', gap: space[1.5] },
  swap: {
    alignSelf: 'flex-start',
    marginTop: space[2],
    borderWidth: 1.5,
    borderColor: color.primary,
    backgroundColor: color.surface,
    borderRadius: radius.xs,
    paddingVertical: space[1.5],
    paddingHorizontal: space[3],
  },
  disclosure: { gap: space[1.5] },
  toggle: { alignSelf: 'flex-start', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  model: {
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.sm,
    padding: space[3],
    gap: space[1],
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space[3],
  },
  error: { gap: space[2.5], backgroundColor: color.dangerSubtle, borderRadius: radius.md, padding: space[3] },
});
