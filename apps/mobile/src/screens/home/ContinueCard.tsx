import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { border, color, layout, radius, space, type TextKey } from '@prepio/shared';
import { AppText, Button, Surface } from '../../ui';
import type { ContinueTarget } from '../../lib/homeContinue';
import { t } from '../../texts/store';

const EYEBROW: Record<ContinueTarget['kind'], TextKey> = {
  first: 'home.continue.first',
  resume: 'home.continue.resume',
  next: 'home.continue.next',
};

type Props = { target: ContinueTarget; number: number; onPress: () => void };

/**
 * Home's first call to action: the lesson to resume or start, with where the student left it. The button sits under
 * the text on phones and beside it on wide screens.
 */
export default function ContinueCard({ target, number, onPress }: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  return (
    <Surface testID="continue-card" style={[styles.card, wide && styles.cardWide]}>
      <View style={[styles.text, wide && styles.textWide]}>
        <AppText role="eyebrow" color="primary">
          {t(EYEBROW[target.kind])}
        </AppText>
        <AppText role="section">{t('home.continue.title', { n: number, titlu: target.lesson.title })}</AppText>
        {target.where ? (
          <AppText role="small" color="textMuted">
            {target.where}
          </AppText>
        ) : null}
      </View>
      <Button label={t(target.kind === 'resume' ? 'home.continue.resumeButton' : 'home.continue.startButton')} onPress={onPress} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3], borderWidth: border.thick, borderColor: color.primary, borderRadius: radius.lg, marginBottom: space[5] },
  cardWide: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  text: { gap: space[1] },
  textWide: { flex: 1 },
});
