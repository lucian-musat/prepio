import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, formatAccessDate, formatGrade, radius, space, type BacItemResult } from '@prepio/shared';
import { fetchLatestGraded, fetchOpenAttempt, type BacAttemptView } from '../../lib/bac';
import { AppText, Button, ScreenLayout, Spinner, Surface } from '../../ui';
import { t } from '../../texts/store';
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

/** Points per Subiect, in order: „Subiectul I · 5 / 9 p”. */
export function subtotals(results: BacItemResult[]): string[] {
  return ([1, 2, 3] as const).flatMap((s) => {
    const rows = results.filter((r) => r.section === s);
    if (!rows.length) return [];
    const sum = (k: 'points' | 'max') => rows.reduce((t, r) => t + r[k], 0);
    return [t('bac.result.subtotal', { subiect: ROMAN[s], puncte: sum('points'), max: sum('max') })];
  });
}

type ViewProps = {
  grade: number;
  results: BacItemResult[];
  /** When it was graded (ISO); shown with the ex officio points. */
  gradedAt?: string | null;
  /** „Reia subiectul”: an empty paper of the same subject. */
  onRedo: () => void;
  /** Set when another attempt of the subject is already open: „Continuă lucrarea începută” replaces the retake. */
  onContinue?: () => void;
  onDone: () => void;
};

/**
 * The result of a graded paper (mockup screen 4): „Nota ta”, the grade large, the note that it is indicative, then
 * „De lucrat” — every item below full marks with its one-line feedback and points — or the congratulation when there is
 * none; „Reia subiectul” (it costs credits again) and „Înapoi la subiecte”.
 */
export function BacResultView({ grade, results, gradedAt, onRedo, onContinue, onDone }: ViewProps) {
  const work = toWorkOn(results);
  return (
    <ScreenLayout
      title={t('bac.result.title')}
      onBack={onDone}
      actions={
        <View style={styles.actions}>
          {onContinue ? (
            <Button label={t('bac.result.continue')} variant="secondary" onPress={onContinue} />
          ) : (
            <>
              <Button label={t('bac.result.redo')} variant="secondary" onPress={onRedo} />
              <AppText role="caption" color="textMuted" style={styles.center}>
                {t('bac.result.redoNote')}
              </AppText>
            </>
          )}
          <Button label={t('bac.backToSubjects')} onPress={onDone} />
        </View>
      }
    >
      <View style={styles.gradeBox}>
        <AppText role="label" color="textMuted">
          {t('bac.result.yourGrade')}
        </AppText>
        <AppText role="display" style={styles.grade} accessibilityRole="header">
          {formatGrade(grade)}
        </AppText>
        <AppText role="caption" color="textMuted" style={styles.center}>
          {t('bac.result.gradeNote')}
        </AppText>
        <AppText role="caption" color="textMuted" style={styles.center}>
          {gradedAt
            ? t('bac.result.gradedOn', { data: formatAccessDate(new Date(gradedAt)) })
            : t('bac.result.exOfficio')}
        </AppText>
      </View>
      <View style={styles.subtotals}>
        {subtotals(results).map((line) => (
          <AppText key={line} role="label" color="textMuted">
            {line}
          </AppText>
        ))}
      </View>
      {work.length ? (
        <View style={styles.list}>
          <AppText role="eyebrow" color="textMuted" accessibilityRole="header">
            {t('bac.result.workOn')}
          </AppText>
          {work.map((r) => {
            const label = itemLabel(r, results);
            return (
              <Surface key={r.itemId} testID="bac-result-row" style={styles.row}>
                <AppText role="small" style={styles.fill}>
                  {r.feedback ? `${label}: ${r.feedback}` : label}
                </AppText>
                <AppText role="label" color="textMuted">
                  {t('bac.result.points', { puncte: r.points, max: r.max })}
                </AppText>
              </Surface>
            );
          })}
        </View>
      ) : (
        <Surface style={styles.congrats}>
          <AppText role="bodyStrong" style={styles.center}>
            {t('bac.result.congrats')}
          </AppText>
        </Surface>
      )}
    </ScreenLayout>
  );
}

/** `/bac/[id]/rezultat`: the latest graded attempt of the subject. */
export default function BacResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; attempt: BacAttemptView | null; open?: boolean }>({
    status: 'loading',
    attempt: null,
  });

  const load = useCallback(() => {
    let live = true;
    setState({ status: 'loading', attempt: null });
    // An open attempt only changes the action; failing to read it never hides the result.
    Promise.all([fetchLatestGraded(id), fetchOpenAttempt(id).catch(() => null)]).then(
      ([attempt, open]) => live && setState({ status: 'ready', attempt, open: open?.status === 'draft' }),
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
    return (
      <BacResultView
        grade={a.grade}
        results={a.results ?? []}
        gradedAt={a.gradedAt}
        onRedo={() => router.replace(`/bac/${id}`)}
        onContinue={state.open ? () => router.replace(`/bac/${id}`) : undefined}
        onDone={backToSubjects}
      />
    );
  }
  return (
    <ScreenLayout title={t('bac.result.title')} onBack={backToSubjects}>
      {state.status === 'loading' ? (
        <View style={styles.loader}>
          <Spinner />
        </View>
      ) : state.status === 'error' ? (
        <Surface style={styles.list}>
          <AppText role="section">{t('bac.result.loadFailed')}</AppText>
          <AppText role="small" color="textMuted">
            {t('errors.checkConnection')}
          </AppText>
          <Button label={t('common.retryButton')} onPress={load} />
        </Surface>
      ) : (
        <View style={styles.list}>
          <AppText role="body" color="textMuted">
            {t('bac.result.none')}
          </AppText>
          <Button label={t('bac.backToSubjects')} variant="secondary" onPress={backToSubjects} />
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
  subtotals: { alignItems: 'center', gap: space[1], marginBottom: space[4] },
  grade: { fontSize: 56, lineHeight: 64, color: color.primaryStrong },
  list: { gap: space[2.5] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], borderRadius: radius.lg },
  congrats: { borderRadius: radius.lg, backgroundColor: color.successSubtle },
  loader: { marginTop: space[12], alignItems: 'center' },
});
