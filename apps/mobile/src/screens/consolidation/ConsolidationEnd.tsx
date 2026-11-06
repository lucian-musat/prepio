import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, CONSOLIDATION_TYPE_LABELS, radius, space, type ConsolidationExercise } from '@prepio/shared';
import type { Attempt } from '../../lib/consolidation';
import { AppText, Button, Enter, Icon, ScreenLayout, Surface } from '../../ui';
import { exerciseStatus } from './status';

type Props = {
  exercises: ConsolidationExercise[];
  attempts: Map<string, Attempt>;
  onBack: () => void;
  onRestart: () => void;
  /** Absent when every exercise is already correct. */
  onRestartWrong?: () => void;
  /** A row was tapped: open that exercise. */
  onOpen: (exerciseId: string) => void;
  next: { label: string; onPress: () => void };
};

/** One summary row's label: the type; an essay also says how many requirements it has. */
function labelOf(ex: ConsolidationExercise) {
  return ex.type === 'essay' ? `Eseu (${ex.requirements.length} ${ex.requirements.length === 1 ? 'cerință' : 'cerințe'})` : CONSOLIDATION_TYPE_LABELS[ex.type];
}

/**
 * „Consolidare parcursă” (types mockup flow screen 3): every exercise with its latest verdict, no grade. A row opens
 * its exercise (with the answer and feedback, if it was checked).
 */
export default function ConsolidationEnd({ exercises, attempts, onBack, onRestart, onRestartWrong, onOpen, next }: Props) {
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
            const label = labelOf(ex);
            const { chip, tone } = exerciseStatus(ex, attempts.get(ex.id));
            return (
              <Pressable
                key={ex.id}
                testID={`summary-${ex.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Exercițiul ${i + 1}, ${label}, ${chip}`}
                accessibilityHint="Deschide exercițiul"
                onPress={() => onOpen(ex.id)}
                style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
              >
                <View style={[styles.dot, { backgroundColor: tone.edge }]} />
                <AppText role="note" style={styles.fill}>
                  {label}
                </AppText>
                <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                  <AppText role="badge" style={{ color: tone.fg }}>
                    {chip}
                  </AppText>
                </View>
                <Icon name="chevron-right" size={16} tint={color.textMuted} />
              </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    minHeight: 48,
    paddingVertical: space[2.5],
    paddingHorizontal: space[1],
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: color.surfaceMuted },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.border },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  chip: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: space[2] },
});
