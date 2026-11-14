import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@prepio/shared';
import { creditCount } from '../lib/counts';
import { t } from '../texts/store';
import { AppText } from '../ui';
import Coin from './Coin';

/** „✦ Profesorul digital · 🪙 2” (+ „/ cerință”): what a check by the digital teacher costs. */
export default function CostTag({ cost, perRequirement = false }: { cost: number; perRequirement?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={t(perRequirement ? 'credits.costTag.labelPerRequirement' : 'credits.costTag.label', { credite: creditCount(cost) })}
      style={styles.tag}
    >
      <AppText role="eyebrow" color="textMuted" accessible={false}>
        {t('credits.costTag.text')}
      </AppText>
      <Coin size={12} />
      <AppText role="eyebrow" color="textMuted" accessible={false}>
        {cost}
      </AppText>
      {perRequirement ? (
        <AppText role="eyebrow" color="textMuted" accessible={false}>
          {t('credits.costTag.perRequirement')}
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
