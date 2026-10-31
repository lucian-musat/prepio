import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import {
  legacyColors,
  MAX_ESSAY_CHARS,
  legacyRadius,
  type EvaluateResponse,
  type WritingExercise as WritingExerciseData,
} from '@prepio/shared';
import { evaluateEssay } from '../lib/api';
import { fontFamily } from '../theme/fonts';

export function WritingExercise({ exercise }: { exercise: WritingExerciseData }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = [...text].length;
  const canSubmit = !loading && text.trim().length > 0 && count <= MAX_ESSAY_CHARS;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await evaluateEssay({ exerciseId: exercise.id, text }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluarea nu a reușit. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.prompt}>{exercise.prompt}</Text>
      </View>

      <TextInput
        mode="outlined"
        multiline
        numberOfLines={10}
        value={text}
        onChangeText={setText}
        accessibilityLabel="Răspunsul tău"
        placeholder="Scrie răspunsul tău aici"
        style={styles.input}
      />
      <Text style={[styles.counter, count > MAX_ESSAY_CHARS && { color: legacyColors.error }]}>
        {count} / {MAX_ESSAY_CHARS}
      </Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.body}>Se evaluează…</Text>
        </View>
      ) : (
        <Button mode="contained" onPress={() => void submit()} disabled={!canSubmit}>
          {result ? 'Retrimite' : 'Trimite pentru evaluare'}
        </Button>
      )}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.grade}>
            Nota: {result.grade} / {result.gradeMax}
          </Text>
          <Text style={styles.body}>{result.summary}</Text>
          {result.suggestions.map((s, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.body}>•</Text>
              <Text style={[styles.body, styles.bulletText]}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    backgroundColor: legacyColors.paper,
    borderRadius: legacyRadius,
    borderWidth: 1,
    borderColor: legacyColors.border,
    padding: 16,
    gap: 8,
  },
  prompt: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26, color: legacyColors.ink },
  input: { minHeight: 200, fontFamily: fontFamily.body, fontSize: 17, backgroundColor: legacyColors.paper },
  counter: { fontFamily: fontFamily.body, fontSize: 15, color: legacyColors.inkMuted, textAlign: 'right' },
  error: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26, color: legacyColors.error },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' },
  bullet: { flexDirection: 'row', gap: 8 },
  bulletText: { flex: 1 },
  grade: { fontFamily: fontFamily.headingBold, fontSize: 22, color: legacyColors.bordeaux },
  body: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26, color: legacyColors.ink },
});
