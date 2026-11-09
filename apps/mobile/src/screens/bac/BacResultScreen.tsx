import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BAC_GRADE_NOTE, color, formatGrade, radius, space, type BacItemResult } from '@prepio/shared';
import { fetchLatestGraded, type BacAttemptView } from '../../lib/bac';
import { AppText, Button, ScreenLayout, Spinner, Surface } from '../../ui';
import { ROMAN } from './BacSubmitView';

/** Back to the subject list: the screen below when there is one (the list pushed the paper), otherwise the list. */
export function backToSubjects() {
  if (router.canGoBack()) router.back();
  else router.replace('/bac');
}

/** The items to work on: below full marks, by section and number. */
export function toWorkOn(results: BacItemResult[]): BacItemResult[] {
  return results.filter((r) => r.points < r.max).sort((a, b) => a.section - b.section || a.number - b.number);
}

/** „I.5”; the essay (Subiectul III's only item) is just „III”. */
function itemLabel(r: BacItemResult, results: BacItemResult[]): string {
  const alone = results.filter((x) => x.section === r.section).length === 1;
  return r.section === 3 && alone ? ROMAN[3] : `${ROMAN[r.section]}.${r.number}`;
}

type ViewProps = {
  grade: number;
  results: BacItemResult[];
  /** „Reia subiectul”: an empty paper of the same subject. */
  onRedo: () => void;
  onDone: () => void;
};

/**
 * The result of a graded paper (mockup screen 4): „Nota ta”, the grade large, the note that it is indicative, then
 * „De lucrat” — every item below full marks with its one-line feedback and points — or the congratulation when there is
 * none; „Reia subiectul” (it costs credits again) and „Înapoi la subiecte”.
 */
export function BacResultView({ grade, results, onRedo, onDone }: ViewProps) {
  const work = toWorkOn(results);
  return (
    <ScreenLayout
      title="Rezultat"
      onBack={onDone}
      actions={
        <View style={styles.actions}>
          <Button label="Reia subiectul" variant="secondary" onPress={onRedo} />
          <AppText role="caption" color="textMuted" style={styles.center}>
            Reluarea necesită credite suplimentare.
          </AppText>
          <Button label="Înapoi la subiecte" onPress={onDone} />
        </View>
      }
    >
      <View style={styles.gradeBox}>
        <AppText role="label" color="textMuted">
          Nota ta
        </AppText>
        <AppText role="display" style={styles.grade} accessibilityRole="header">
          {formatGrade(grade)}
        </AppText>
        <AppText role="caption" color="textMuted" style={styles.center}>
          {BAC_GRADE_NOTE}
        </AppText>
      </View>
      {work.length ? (
        <View style={styles.list}>
          <AppText role="eyebrow" color="textMuted" accessibilityRole="header">
            De lucrat
          </AppText>
          {work.map((r) => {
            const label = itemLabel(r, results);
            return (
              <Surface key={r.itemId} testID="bac-result-row" style={styles.row}>
                <AppText role="small" style={styles.fill}>
                  {r.feedback ? `${label} — ${r.feedback}` : label}
                </AppText>
                <AppText role="label" color="textMuted">
                  {`${r.points} / ${r.max} p`}
                </AppText>
              </Surface>
            );
          })}
        </View>
      ) : (
        <Surface style={styles.congrats}>
          <AppText role="bodyStrong" style={styles.center}>
            Felicitări! Ai luat punctajul maxim la toate cerințele.
          </AppText>
        </Surface>
      )}
    </ScreenLayout>
  );
}

/** `/bac/[id]/rezultat`: the latest graded attempt of the subject. */
export default function BacResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; attempt: BacAttemptView | null }>({
    status: 'loading',
    attempt: null,
  });

  const load = useCallback(() => {
    let live = true;
    setState({ status: 'loading', attempt: null });
    fetchLatestGraded(id).then(
      (attempt) => live && setState({ status: 'ready', attempt }),
      (e) => {
        console.warn('[bac] the result could not be read:', e);
        if (live) setState({ status: 'error', attempt: null });
      },
    );
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => load(), [load]);

  const a = state.attempt;
  if (state.status === 'ready' && a && a.grade != null) {
    return <BacResultView grade={a.grade} results={a.results ?? []} onRedo={() => router.replace(`/bac/${id}`)} onDone={backToSubjects} />;
  }
  return (
    <ScreenLayout title="Rezultat" onBack={backToSubjects}>
      {state.status === 'loading' ? (
        <View style={styles.loader}>
          <Spinner />
        </View>
      ) : state.status === 'error' ? (
        <Surface style={styles.list}>
          <AppText role="section">Nu am putut încărca rezultatul</AppText>
          <AppText role="small" color="textMuted">
            Verifică conexiunea la internet și încearcă din nou.
          </AppText>
          <Button label="Reîncearcă" onPress={load} />
        </Surface>
      ) : (
        <View style={styles.list}>
          <AppText role="body" color="textMuted">
            Nu ai încă un rezultat la acest subiect.
          </AppText>
          <Button label="Înapoi la subiecte" variant="secondary" onPress={backToSubjects} />
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  actions: { flex: 1, gap: space[2] },
  gradeBox: { alignItems: 'center', gap: space[1], paddingVertical: space[4] },
  grade: { fontSize: 56, lineHeight: 64, color: color.primaryStrong },
  list: { gap: space[2.5] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], borderRadius: radius.lg },
  congrats: { borderRadius: radius.lg, backgroundColor: color.successSubtle },
  loader: { marginTop: space[12], alignItems: 'center' },
});
