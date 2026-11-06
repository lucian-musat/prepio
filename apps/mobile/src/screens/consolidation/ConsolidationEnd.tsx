import { StyleSheet, View } from 'react-native';
import { border, color, CONSOLIDATION_TYPE_LABELS, radius, space, VERDICT_LABELS, type ConsolidationExercise } from '@prepio/shared';
import { VERDICT_TONE } from '../../components/consolidation/verdictTone';
import type { Attempt } from '../../lib/consolidation';
import { AppText, Button, Enter, ScreenLayout, Surface } from '../../ui';
import { essayProgress } from './checking';

type Props = {
  exercises: ConsolidationExercise[];
  attempts: Map<string, Attempt>;
  onBack: () => void;
  onRestart: () => void;
  /** Absent when every exercise is already correct. */
  onRestartWrong?: () => void;
  next: { label: string; onPress: () => void };
};

const MUTED = { fg: color.textMuted, bg: color.surfaceMuted, edge: color.border };

/** One summary row's label and chip: the latest verdict; an essay without a whole verdict shows „n din N”. */
function rowOf(ex: ConsolidationExercise, attempt: Attempt | undefined) {
  const label = ex.type === 'essay' ? `Eseu (${ex.requirements.length} ${ex.requirements.length === 1 ? 'cerință' : 'cerințe'})` : CONSOLIDATION_TYPE_LABELS[ex.type];
  if (attempt?.verdict) return { label, chip: VERDICT_LABELS[attempt.verdict], tone: VERDICT_TONE[attempt.verdict] };
  if (ex.type === 'essay' && attempt) {
    const { ok, total } = essayProgress(ex, attempt.feedback);
    return { label, chip: `${ok} din ${total}`, tone: ok === total ? VERDICT_TONE.ok : ok > 0 ? VERDICT_TONE.almost : MUTED };
  }
  return { label, chip: 'Nerezolvat', tone: MUTED };
}

/** „Consolidare parcursă” (types mockup flow screen 3): every exercise with its latest verdict, no grade. */
export default function ConsolidationEnd({ exercises, attempts, onBack, onRestart, onRestartWrong, next }: Props) {
  return (
    <ScreenLayout
      title="Consolidare"
      progress={1}
      progressLabel="Progres consolidare"
      onBack={onBack}
      actions={
        <View style={styles.stack}>
          <Button label="Reia consolidarea" onPress={onRestart} />
          {onRestartWrong ? <Button label="Reia doar ce nu a fost corect" variant="secondary" onPress={onRestartWrong} /> : null}
          <Button label={next.label} variant="secondary" onPress={next.onPress} />
        </View>
      }
    >
      <Enter index={0} style={styles.head}>
        <AppText role="celebrate" accessibilityRole="header" style={styles.centre}>
          Consolidare parcursă
        </AppText>
        <AppText role="lead" color="textMuted" style={styles.centre}>
          Fără note, doar unde mai ai de lucrat.
        </AppText>
      </Enter>
      <Enter index={1}>
        <Surface padding={2} radius="lg">
          {exercises.map((ex, i) => {
            const r = rowOf(ex, attempts.get(ex.id));
            return (
              <View key={ex.id} testID={`summary-${ex.id}`} style={[styles.row, i > 0 && styles.divider]}>
                <View style={[styles.dot, { backgroundColor: r.tone.edge }]} />
                <AppText role="note" style={styles.fill}>
                  {r.label}
                </AppText>
                <View style={[styles.chip, { backgroundColor: r.tone.bg }]}>
                  <AppText role="badge" style={{ color: r.tone.fg }}>
                    {r.chip}
                  </AppText>
                </View>
              </View>
            );
          })}
        </Surface>
      </Enter>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, gap: space[2.5] },
  head: { gap: space[1], marginTop: space[3], marginBottom: space[4] },
  centre: { textAlign: 'center' },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingVertical: space[2.5], paddingHorizontal: space[1] },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.border },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  chip: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: space[2] },
});
