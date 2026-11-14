import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { AppText } from '../ui';
import { t } from '../texts/store';
import { MODE_INFO, type LearningMode } from '../lib/learningMode';

type Props = { value: LearningMode; onChange: (mode: LearningMode) => void; disabled?: boolean };

const MODES = Object.keys(MODE_INFO) as LearningMode[];

/** Two selectable cards (radio group) describing the learning modes; the guided one is tagged as recommended. */
export default function LearningModePicker({ value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.stack} accessibilityRole="radiogroup">
      {MODES.map((mode) => {
        const info = MODE_INFO[mode];
        const selected = mode === value;
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={info.name}
            accessibilityState={{ checked: selected, disabled }}
            // react-native-web 0.21 ignores accessibilityState; the aria props reach the DOM.
            aria-checked={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => onChange(mode)}
            style={[styles.card, selected && styles.selected]}
          >
            {mode === 'guided' ? (
              <AppText role="eyebrow" color="primaryStrong">
                {t('onboarding.mode.recommended')}
              </AppText>
            ) : null}
            <AppText role="bodyStrong">{`${info.icon} ${info.name}`}</AppText>
            <View style={styles.points}>
              {info.points.map((p, i) => (
                <View key={i} style={styles.point}>
                  <AppText role="small" color="textMuted">
                    •
                  </AppText>
                  <AppText role="small" color="textMuted" style={styles.pointText}>
                    {p}
                  </AppText>
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  card: {
    gap: space[1],
    padding: space[3.5],
    borderWidth: border.thick,
    borderRadius: radius.lg,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  selected: { borderColor: color.primary, backgroundColor: color.primarySubtle },
  points: { gap: space[1], marginTop: space[1] },
  point: { flexDirection: 'row', gap: space[2] },
  pointText: { flex: 1 },
});
