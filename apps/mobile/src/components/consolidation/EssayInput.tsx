import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, creditsLabel, plural, radius, space, VERDICT_LABELS, wordCount, type EssayRequirement, type ExerciseFeedback } from '@prepio/shared';
import { evaluateConsolidation } from '../../lib/api';
import { mergeItems, essayProgress } from '../../screens/consolidation/checking';
import { Analyzing, CheckError, Disclosure, FeedbackBox } from '../../screens/consolidation/FeedbackView';
import { AppText, TextArea } from '../../ui';
import Coin from '../../credits/Coin';
import type { CreditGate } from '../../credits/useCreditGate';
import ConnectorChips from './ConnectorChips';
import { MAX_CHARS, type InputProps } from './inputKit';
import { VERDICT_TONE } from './verdictTone';

const PART_HEIGHT = 110;
const filled = (s: string | undefined) => !!s && s.trim() !== '';

type Props = InputProps<'essay'> & {
  /** A requirement was checked: the feedback with its item merged in (the screen saves the attempt). */
  onFeedback?: (feedback: ExerciseFeedback) => void;
  /** Ids of the requirements' templates that exist; their „💡” opens the sheet. */
  templateIds?: Set<string>;
  onOpenTemplate?: (templateId: string) => void;
  /** Whether any requirement check is in flight (the screen keeps its navigation still meanwhile). */
  onBusyChange?: (busy: boolean) => void;
  /**
   * The screen's credit gate: a check without enough credits opens the buy sheet instead. Without it (a BAC paper)
   * the requirements are only written: no „Verifică cerința”, and the total word count instead of the progress.
   */
  gate?: CreditGate;
};

/**
 * Eseu pe cerințe (types mockup): a collapsible card per requirement with its number, text and state chip, a field
 * with a character count, the connector chips for an argument and „Verifică cerința”, which asks the AI about that
 * requirement alone. Below, how many requirements are right; there is no whole-essay check.
 */
export default function EssayInput({ exercise, value, onChange, feedback, disabled, onFeedback, templateIds, onOpenTemplate, onBusyChange, gate }: Props) {
  const reqs = exercise.requirements;
  const [open, setOpen] = useState<Set<string>>(() => new Set(reqs[0] ? [reqs[0].id] : []));
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The text each requirement had when it was checked: once edited, its verdict no longer applies. A restored
  // essay (coming back to it) starts from the stored texts of its checked requirements.
  const [checkedText, setCheckedText] = useState<Record<string, string>>(() =>
    Object.fromEntries(reqs.filter((r) => feedback?.items.some((i) => i.key === r.id)).map((r) => [r.id, value.parts[r.id] ?? ''])),
  );
  const anyBusy = Object.values(busy).some(Boolean);
  useEffect(() => {
    onBusyChange?.(anyBusy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyBusy]);
  // Checks can overlap: each result merges into the latest feedback, not the one it started with.
  const latest = useRef(feedback);
  latest.current = feedback;

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Requirements with a check in flight, synchronously: `busy` is state, so a fast double tap would send (and pay
  // for) the same check twice.
  const inFlight = useRef<Set<string>>(new Set());

  const check = async (r: EssayRequirement) => {
    if (!gate || !onFeedback || inFlight.current.has(r.id)) return;
    inFlight.current.add(r.id);
    const run = () => void check(r);
    if (!gate.allow(exercise.creditCost, run)) {
      inFlight.current.delete(r.id);
      return;
    }
    setBusy((b) => ({ ...b, [r.id]: true }));
    setErrors((e) => ({ ...e, [r.id]: '' }));
    const sent = value.parts[r.id] ?? '';
    try {
      const res = await evaluateConsolidation({ exerciseId: exercise.id, target: { requirementId: r.id }, answer: value });
      if (res.credits) gate.settle(res.credits.balance);
      const merged = mergeItems(latest.current, res.items.filter((i) => i.key === r.id));
      latest.current = merged;
      setCheckedText((c) => ({ ...c, [r.id]: sent }));
      onFeedback(merged);
    } catch (e) {
      if (gate.onError(e, run)) return;
      setErrors((x) => ({ ...x, [r.id]: e instanceof Error && e.message ? e.message : 'Evaluarea nu a reușit. Încearcă din nou.' }));
    } finally {
      inFlight.current.delete(r.id);
      setBusy((b) => ({ ...b, [r.id]: false }));
    }
  };

  const { ok } = essayProgress(exercise, feedback);

  return (
    <View style={styles.list}>
      <AppText role="note" color="textMuted">
        {gate ? 'Scrie fiecare cerință în câmpul ei și verifică-le pe rând.' : 'Scrie fiecare cerință în câmpul ei.'}
      </AppText>
      {reqs.map((r, i) => {
        const text = value.parts[r.id] ?? '';
        const item = feedback?.items.find((x) => x.key === r.id);
        // Edited since its check: the old verdict is stale (the feedback stays as a hint).
        const stale = !!item && checkedText[r.id] !== undefined && checkedText[r.id] !== text;
        const current = stale ? undefined : item;
        const isOpen = open.has(r.id);
        const tone = current ? VERDICT_TONE[current.verdict] : null;
        const state = current ? VERDICT_LABELS[current.verdict] : filled(text) ? (gate ? 'Neverificat' : 'Completat') : 'Necompletat';
        return (
          <View key={r.id} testID={`requirement-${r.id}`} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityHint={isOpen ? 'Restrânge cerința' : 'Deschide cerința'}
              onPress={() => toggle(r.id)}
              style={styles.head}
            >
              <View style={styles.n}>
                <AppText role="label" color="primary">
                  {i + 1}
                </AppText>
              </View>
              <AppText role="label" style={styles.fill}>
                {r.text}
              </AppText>
              <View style={[styles.chip, { backgroundColor: tone?.bg ?? color.surfaceMuted }]}>
                <AppText role="badge" style={{ color: tone?.fg ?? color.textMuted }}>
                  {state}
                </AppText>
              </View>
            </Pressable>
            {isOpen ? (
              <View style={styles.body}>
                <TextArea
                  value={text}
                  onChangeText={(t) => onChange({ type: 'essay', parts: { ...value.parts, [r.id]: t } })}
                  accessibilityLabel={`Cerința ${i + 1}`}
                  placeholder="Scrie aici…"
                  minHeight={PART_HEIGHT}
                  maxLength={MAX_CHARS}
                  editable={!disabled}
                  status={current?.verdict}
                />
                {r.argument ? <ConnectorChips text={text} /> : null}
                <View style={styles.row}>
                  <AppText role="caption" color="textMuted" style={styles.fill}>
                    {text.length} caractere
                  </AppText>
                  {r.templateId && templateIds?.has(r.templateId) && onOpenTemplate ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Cum rezolv cerința ${i + 1}`} onPress={() => onOpenTemplate(r.templateId!)} style={styles.small}>
                      <AppText role="label" color="primary">
                        💡
                      </AppText>
                    </Pressable>
                  ) : null}
                  {gate ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Verifică cerința ${i + 1}, costă ${creditsLabel(exercise.creditCost)}`}
                    accessibilityState={{ disabled: disabled || !!busy[r.id] || !filled(text) }}
                    disabled={disabled || !!busy[r.id] || !filled(text)}
                    onPress={() => check(r)}
                    style={[styles.small, styles.smallRow, (disabled || busy[r.id] || !filled(text)) && styles.off]}
                  >
                    <AppText role="label" color="primary">
                      Verifică cerința
                    </AppText>
                    <Coin size={12} />
                    <AppText role="label" color="primary">
                      {exercise.creditCost}
                    </AppText>
                  </Pressable>
                  ) : null}
                </View>
                {busy[r.id] ? <Analyzing /> : null}
                {errors[r.id] ? <CheckError message={errors[r.id]!} onRetry={() => check(r)} /> : null}
                {item && !busy[r.id] ? <FeedbackBox showVerdict={false} item={item} /> : null}
                {item && r.modelAnswer ? <Disclosure label="Vezi un răspuns model" lines={[r.modelAnswer]} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      <AppText role="caption" color="textMuted">
        {gate
          ? `${ok} din ${reqs.length} cerințe corecte`
          : `${plural(reqs.reduce((n, r) => n + wordCount(value.parts[r.id] ?? ''), 0), 'cuvânt', 'cuvinte')} în total`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2.5] },
  fill: { flex: 1 },
  card: {
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], padding: space[3], minHeight: 48 },
  n: { width: 28, height: 28, borderRadius: radius.xs, backgroundColor: color.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: space[2] },
  body: { paddingHorizontal: space[3], paddingBottom: space[3], gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  small: {
    borderWidth: 1.5,
    borderColor: color.primary,
    backgroundColor: color.surface,
    borderRadius: radius.xs,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    minHeight: 40,
    justifyContent: 'center',
  },
  off: { opacity: 0.45 },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
});
