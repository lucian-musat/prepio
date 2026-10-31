import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DIFFICULTY_LABELS, legacyColors, legacyDifficultyColors, type Difficulty } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <View style={[styles.badge, { backgroundColor: legacyDifficultyColors[difficulty] }]}>
      <Text style={styles.text}>{DIFFICULTY_LABELS[difficulty]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 },
  text: { color: legacyColors.paper, fontFamily: fontFamily.legacyBodyBold, fontSize: 14 },
});
