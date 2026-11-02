import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, gradient, radius, space } from '@prepio/shared';
import { AppText } from '../../ui';
import { withAlpha } from '../../ui/elevation';

const POINTS = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }; // 135deg, like the logo mark
const BODY_ALPHA = 0.92;
const CIRCLE = 180;
const CIRCLE_ALPHA = 0.14;

type Props = { title: string; body: string };

/** Welcome card: the Home hero's gradient and decorative circle, with the welcome copy. */
export default function AuthHero({ title, body }: Props) {
  return (
    <LinearGradient colors={[...gradient.hero.colors]} locations={[...gradient.hero.locations]} {...POINTS} style={styles.hero}>
      <AppText role="display" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText style={styles.body}>{body}</AppText>
      <View pointerEvents="none" style={styles.circle} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space[5], overflow: 'hidden' },
  title: { color: color.onPrimary, marginBottom: space[2] },
  body: { color: withAlpha(color.onPrimary, BODY_ALPHA) },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    right: -50,
    top: -60,
    backgroundColor: withAlpha(color.onPrimary, CIRCLE_ALPHA),
  },
});
