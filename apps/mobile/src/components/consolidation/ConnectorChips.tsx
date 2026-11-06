import { StyleSheet, View } from 'react-native';
import { color, detectConnectors, radius, space } from '@prepio/shared';
import { AppText } from '../../ui';
import { VERDICT_TONE } from './verdictTone';

/** The two connector chips under an argument (types mockup `.conn`): they light up live as the student types. */
export default function ConnectorChips({ text }: { text: string }) {
  const found = detectConnectors(text);
  return (
    <View style={styles.row}>
      <Chip on={found.causal} label="Conector de cauzalitate" />
      <Chip on={found.conclusion} label="Conector de concluzie" />
    </View>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <View
      accessibilityLabel={`${label}: ${on ? 'folosit' : 'lipsește'}`}
      accessibilityLiveRegion="polite"
      style={[styles.chip, { backgroundColor: on ? VERDICT_TONE.ok.bg : color.surfaceMuted }]}
    >
      <AppText role="chip" style={{ color: on ? VERDICT_TONE.ok.fg : color.textMuted }}>
        {on ? '✓' : '○'} {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  chip: { borderRadius: radius.pill, paddingVertical: space[1], paddingHorizontal: space[2.5] },
});
