import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DIFFICULTY_LABELS, colors, difficultyColors, type Difficulty } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <View style={[styles.badge, { backgroundColor: difficultyColors[difficulty] }]}>
      <Text style={styles.text}>{DIFFICULTY_LABELS[difficulty]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 },
  text: { color: colors.paper, fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
