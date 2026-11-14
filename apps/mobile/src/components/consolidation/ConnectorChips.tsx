import { StyleSheet, View } from 'react-native';
import { color, detectConnectors, radius, space } from '@prepio/shared';
import { t } from '../../texts/store';
import { AppText } from '../../ui';
import { VERDICT_TONE } from './verdictTone';

/** The two connector chips under an argument (types mockup `.conn`): they light up live as the student types. */
export default function ConnectorChips({ text }: { text: string }) {
  const found = detectConnectors(text);
  return (
    <View style={styles.row}>
      <Chip on={found.causal} label={t('consolidation.input.connectors.causal')} />
      <Chip on={found.conclusion} label={t('consolidation.input.connectors.conclusion')} />
    </View>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <View
      accessibilityLabel={t(on ? 'consolidation.input.connectors.used' : 'consolidation.input.connectors.missing', { conector: label })}
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
