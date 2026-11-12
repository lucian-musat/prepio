import { Pressable, StyleSheet, View } from 'react-native';
import { color, feedbackText, plural, radius, space, type BacAnswers, type BacItem } from '@prepio/shared';
import { answeredCount } from '../../lib/bac';
import { AppText, Button, Surface } from '../../ui';

export const ROMAN = ['', 'I', 'II', 'III'] as const;
const filled = (s: string | undefined) => !!s && s.trim() !== '';

/**
 * The unanswered items as the student reads them: „I.6”; for the essay, its missing requirements („III (cerința 4)”),
 * or „III” when none is written.
 */
export function emptyLabels(empty: BacItem[], answers: BacAnswers): string[] {
  return empty.map((item) => {
    if (item.type !== 'essay') return `${ROMAN[item.section]}.${item.number}`;
    const a = answers[item.id];
    const parts = a?.type === 'essay' ? a.parts : {};
    const missing = item.requirements.flatMap((r, i) => (filled(parts?.[r.id]) ? [] : [i + 1]));
    if (missing.length === item.requirements.length) return ROMAN[item.section];
    return `${ROMAN[item.section]} (${missing.length === 1 ? 'cerința' : 'cerințele'} ${missing.join(', ')})`;
  });
}

type Props = {
  items: BacItem[];
  answers: BacAnswers;
  cost: number;
  /** A failed submission's message (rate limit, grading failed, offline). */
  error: string | null;
  sending: boolean;
  onSend: () => void;
  onBack: () => void;
  /** An item in the lists was tapped: back to the paper, at that requirement. */
  onJump?: (item: BacItem) => void;
};

/** One line of the summary: a heading and a tappable chip per requirement. */
function ItemList({ heading, kind, items, labels, onJump }: { heading: string; kind: string; items: BacItem[]; labels: string[]; onJump?: (item: BacItem) => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.list}>
      <AppText role="small" color="textMuted">
        {heading}
      </AppText>
      <View style={styles.chips}>
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${kind}: ${labels[i]}`}
            onPress={() => onJump?.(item)}
            style={styles.chip}
          >
            <AppText role="label" color="primary">
              {labels[i]}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * „Trimite la corectat” (mockup screen 3): how many requirements are answered completely, the partly written and the
 * empty ones (each opens its requirement), the warning and the two actions.
 */
export default function BacSubmitView({ items, answers, cost, error, sending, onSend, onBack, onJump }: Props) {
  const { answered, total, empty, partial } = answeredCount(items, answers);
  return (
    <View style={styles.root}>
      <Surface style={styles.card}>
        <AppText role="section" accessibilityRole="header">
          {`Ai răspuns complet la ${answered} din ${plural(total, 'cerință', 'cerințe')}`}
        </AppText>
        <ItemList heading="Incomplete:" kind="Incomplet" items={partial} labels={emptyLabels(partial, answers)} onJump={onJump} />
        <ItemList heading="Necompletate:" kind="Necompletat" items={empty} labels={emptyLabels(empty, answers)} onJump={onJump} />
      </Surface>
      <AppText role="note" color="textMuted">
        După ce predai lucrarea, nu mai poți schimba răspunsurile.
      </AppText>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <AppText role="small" style={styles.errorText}>
            {error}
          </AppText>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button label="Trimite la corectat" cost={cost} loading={sending} disabled={sending} onPress={onSend} />
        <Button label="Mai lucrez" variant="secondary" disabled={sending} onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[4] },
  card: { gap: space[2] },
  error: { backgroundColor: color.dangerSubtle, borderRadius: radius.md, padding: space[3] },
  errorText: { color: feedbackText.wrong },
  actions: { gap: space[2.5], marginTop: space[2] },
  list: { gap: space[1.5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
});
