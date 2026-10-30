import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, radius, type WritingExercise as WritingExerciseData } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

/** Placeholder: Task 12 replaces this with the essay input and AI evaluation. */
export function WritingExercise({ exercise }: { exercise: WritingExerciseData }) {
  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{exercise.prompt}</Text>
      <Text style={styles.note}>Evaluarea cu AI va fi disponibilă în curând.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  prompt: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 15, color: colors.inkMuted },
});
