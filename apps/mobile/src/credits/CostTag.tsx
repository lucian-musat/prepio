import { StyleSheet, View } from 'react-native';
import { color, creditsLabel, radius, space } from '@prepio/shared';
import { AppText } from '../ui';
import Coin from './Coin';

/** „✦ Profesorul digital · 🪙 2” (+ „/ cerință”): what a check by the digital teacher costs. */
export default function CostTag({ cost, perRequirement = false }: { cost: number; perRequirement?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`Profesorul digital, costă ${creditsLabel(cost)}${perRequirement ? ' pe cerință' : ''}`}
      style={styles.tag}
    >
      <AppText role="eyebrow" color="textMuted" accessible={false}>
        ✦ Profesorul digital ·
      </AppText>
      <Coin size={12} />
      <AppText role="eyebrow" color="textMuted" accessible={false}>
        {cost}
      </AppText>
      {perRequirement ? (
        <AppText role="eyebrow" color="textMuted" accessible={false}>
          / cerință
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
});
