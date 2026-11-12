import { StyleSheet, View } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { AppText, Button, Surface } from '../../ui';
import type { ContinueTarget } from '../../lib/homeContinue';

const EYEBROW: Record<ContinueTarget['kind'], string> = {
  first: 'Începe de aici',
  resume: 'Continuă de unde ai rămas',
  next: 'Următoarea lecție',
};

type Props = { target: ContinueTarget; number: number; onPress: () => void };

/** Home's first call to action: the lesson to resume or start, with where the student left it. */
export default function ContinueCard({ target, number, onPress }: Props) {
  return (
    <Surface testID="continue-card" style={styles.card}>
      <View style={styles.text}>
        <AppText role="eyebrow" color="primary">
          {EYEBROW[target.kind]}
        </AppText>
        <AppText role="section">{`Lecția ${number} · ${target.lesson.title}`}</AppText>
        {target.where ? (
          <AppText role="small" color="textMuted">
            {target.where}
          </AppText>
        ) : null}
      </View>
      <Button label={target.kind === 'resume' ? 'Continuă lecția' : 'Începe lecția'} onPress={onPress} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3], borderWidth: border.thick, borderColor: color.primary, borderRadius: radius.lg, marginBottom: space[5] },
  text: { gap: space[1] },
});
