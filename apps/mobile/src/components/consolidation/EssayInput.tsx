import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, radius, space, VERDICT_LABELS, type EssayRequirement, type ExerciseFeedback } from '@prepio/shared';
import { evaluateConsolidation } from '../../lib/api';
import { mergeItems, essayProgress } from '../../screens/consolidation/checking';
import { Analyzing, CheckError, Disclosure, FeedbackBox } from '../../screens/consolidation/FeedbackView';
import { AppText, TextArea } from '../../ui';
import ConnectorChips from './ConnectorChips';
import { MAX_CHARS, type InputProps } from './inputKit';
import { VERDICT_TONE } from './verdictTone';

const PART_HEIGHT = 110;
const filled = (s: string | undefined) => !!s && s.trim() !== '';

type Props = InputProps<'essay'> & {
  /** A requirement was checked: the feedback with its item merged in (the screen saves the attempt). */
  onFeedback: (feedback: ExerciseFeedback) => void;
  /** Ids of the requirements' templates that exist; their „💡” opens the sheet. */
  templateIds?: Set<string>;
  onOpenTemplate?: (templateId: string) => void;
  /** Whether any requirement check is in flight (the whole-essay check waits for them). */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Eseu pe cerințe (types mockup): a collapsible card per requirement with its number, text and state chip, a field
 * with a character count, the connector chips for an argument and „Verifică cerința”, which asks the AI about that
 * requirement alone. Below, „Eseul întreg”: what the whole-essay check (in the action bar) looks at.
 */
export default function EssayInput({ exercise, value, onChange, feedback, disabled, onFeedback, templateIds, onOpenTemplate, onBusyChange }: Props) {
  const reqs = exercise.requirements;
  const [open, setOpen] = useState<Set<string>>(() => new Set(reqs[0] ? [reqs[0].id] : []));
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The text each requirement had when it was checked: once edited, its verdict no longer applies.
  const [checkedText, setCheckedText] = useState<Record<string, string>>({});
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

  const check = async (r: EssayRequirement) => {
    setBusy((b) => ({ ...b, [r.id]: true }));
    setErrors((e) => ({ ...e, [r.id]: '' }));
    const sent = value.parts[r.id] ?? '';
    try {
      const res = await evaluateConsolidation({ exerciseId: exercise.id, target: { requirementId: r.id }, answer: value });
      const merged = mergeItems(latest.current, res.items.filter((i) => i.key === r.id));
      latest.current = merged;
      setCheckedText((c) => ({ ...c, [r.id]: sent }));
      onFeedback(merged);
    } catch (e) {
      setErrors((x) => ({ ...x, [r.id]: e instanceof Error && e.message ? e.message : 'Evaluarea nu a reușit. Încearcă din nou.' }));
    } finally {
      setBusy((b) => ({ ...b, [r.id]: false }));
    }
  };

  const written = reqs.filter((r) => filled(value.parts[r.id])).length;
  const { ok } = essayProgress(exercise, feedback);

  return (
    <View style={styles.list}>
      <AppText role="note" color="textMuted">
        Scrie fiecare cerință în câmpul ei. Le poți verifica pe rând; la final primești și feedback pe eseul întreg (structură,
        cronologie, limbaj).
      </AppText>
      {reqs.map((r, i) => {
        const text = value.parts[r.id] ?? '';
        const item = feedback?.items.find((x) => x.key === r.id);
        // Edited since its check: the old verdict is stale (the feedback stays as a hint).
        const stale = !!item && checkedText[r.id] !== undefined && checkedText[r.id] !== text;
        const current = stale ? undefined : item;
        const isOpen = open.has(r.id);
        const tone = current ? VERDICT_TONE[current.verdict] : null;
        const state = current ? VERDICT_LABELS[current.verdict] : filled(text) ? 'Neverificat' : 'Necompletat';
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Verifică cerința ${i + 1}`}
                    accessibilityState={{ disabled: disabled || !!busy[r.id] || !filled(text) }}
                    disabled={disabled || !!busy[r.id] || !filled(text)}
                    onPress={() => check(r)}
                    style={[styles.small, (disabled || busy[r.id] || !filled(text)) && styles.off]}
                  >
                    <AppText role="label" color="primary">
                      Verifică cerința
                    </AppText>
                  </Pressable>
                </View>
                {busy[r.id] ? <Analyzing /> : null}
                {errors[r.id] ? <CheckError message={errors[r.id]!} onRetry={() => check(r)} /> : null}
                {item && !busy[r.id] ? <FeedbackBox item={item} /> : null}
                {item && r.modelAnswer ? <Disclosure label="Vezi un răspuns model" lines={[r.modelAnswer]} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={styles.whole}>
        <AppText role="bodyStrong">Eseul întreg</AppText>
        <AppText role="note" color="textMuted">
          Structură (introducere, cuprins, încheiere), cronologie, limbaj istoric, relația cauză-efect, încadrare în spațiu.
        </AppText>
        <AppText role="caption" color="textMuted">
          {written < reqs.length ? `Disponibil după ce toate cele ${reqs.length} cerințe sunt scrise · ` : ''}
          {ok} din {reqs.length} corecte
        </AppText>
      </View>
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
  whole: {
    gap: space[1],
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space[3],
  },
});
