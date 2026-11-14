import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { color, feedbackText, formatGrade, hasFullAccess, radius, space } from '@prepio/shared';
import { AppText, Button, Chip, Icon, ScreenLayout, Spinner, Surface, goBackOrHome } from '../../ui';
import { useAccess } from '../../access/AccessProvider';
import PaywallSheet from '../../access/PaywallSheet';
import Coin from '../../credits/Coin';
import HeaderPills from '../../streak/HeaderPills';
import { fetchBacList, type BacListRow } from '../../lib/bac';
import { t } from '../../texts/store';

const ROMAN = ['', 'I', 'II', 'III'];

/** The state chip of a row: text and tones. */
function stateChip(r: BacListRow): { label: string; fg: string; bg: string } {
  switch (r.state) {
    case 'draft':
      return {
        label: r.position
          ? t('bac.list.state.draftAt', { subiect: ROMAN[r.position.section]!, n: r.position.index + 1 })
          : t('bac.list.state.draft'),
        fg: feedbackText.almost,
        bg: color.accentSubtle,
      };
    case 'grading':
      return { label: t('bac.list.state.grading'), fg: color.primaryStrong, bg: color.primarySubtle };
    case 'failed':
      return { label: t('bac.list.state.failed'), fg: feedbackText.wrong, bg: color.dangerSubtle };
    case 'completed':
      return {
        label: r.lastGrade != null ? t('bac.list.state.completedGrade', { nota: formatGrade(r.lastGrade) }) : t('bac.list.state.completed'),
        fg: feedbackText.good,
        bg: color.successSubtle,
      };
    default:
      return { label: t('bac.list.state.new'), fg: color.textMuted, bg: color.surfaceMuted };
  }
}

function SubjectRow({ row, locked, onPress, onResult }: { row: BacListRow; locked: boolean; onPress: () => void; onResult?: () => void }) {
  const chip = stateChip(row);
  // A paper in progress hides the last graded one in the chip: keep it reachable.
  const earlier = row.state !== 'completed' && row.lastGrade != null && onResult;
  // Two siblings in the card, never a button inside a button (invalid HTML on the web).
  return (
    <Surface style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={row.title} onPress={onPress} style={styles.row}>
        <View style={styles.rowText}>
          <AppText role="bodyStrong">{row.title}</AppText>
          <Chip label={chip.label} fg={chip.fg} bg={chip.bg} />
          <View style={styles.cost} accessible accessibilityLabel={t('bac.list.costLabel', { n: row.creditCost })}>
            <Coin size={12} />
            <AppText role="caption" color="textMuted" accessible={false}>
              {t('bac.list.cost', { n: row.creditCost })}
            </AppText>
          </View>
        </View>
        {locked ? (
          <AppText role="section">🔒</AppText>
        ) : (
          <View testID="bac-row-chevron" accessible={false}>
            <Icon name="chevron-right" tint={color.textMuted} />
          </View>
        )}
      </Pressable>
      {earlier ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bac.list.lastGradeLabel', { nota: formatGrade(row.lastGrade!) })}
          onPress={onResult}
          hitSlop={8}
          style={styles.earlier}
        >
          <AppText role="small" color="primary">{`${t('bac.list.lastGrade', { nota: formatGrade(row.lastGrade!) })} ›`}</AppText>
        </Pressable>
      ) : null}
    </Surface>
  );
}

/** „Subiecte BAC”: the published full subjects grouped by year, with the student's state on each. */
export default function BacListScreen() {
  const { status, isAdmin, ready } = useAccess();
  const [rows, setRows] = useState<BacListRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const loaded = useRef(false);
  const cancel = useRef<(() => void) | undefined>(undefined);
  const full = isAdmin || hasFullAccess(status);
  // `/bac?paywall=1`: BacAccessGuard sent a locked deep link here; open the sheet once, then clear the parameter.
  const { paywall: paywallParam } = useLocalSearchParams<{ paywall?: string }>();
  useEffect(() => {
    if (!paywallParam) return;
    setPaywall(true);
    router.setParams({ paywall: undefined });
  }, [paywallParam]);

  const load = useCallback(() => {
    cancel.current?.();
    let live = true;
    fetchBacList().then(
      (r) => {
        if (!live) return;
        loaded.current = true;
        setFailed(false);
        setRows(r);
      },
      () => live && !loaded.current && setFailed(true),
    );
    cancel.current = () => {
      live = false;
    };
    return cancel.current;
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => cancel.current?.();
    }, [load]),
  );

  const retry = () => {
    setFailed(false);
    setRows(null);
    loaded.current = false;
    load();
  };

  const body = () => {
    if (failed) {
      return (
        <Surface style={styles.error}>
          <AppText role="section">{t('bac.list.loadFailed')}</AppText>
          <AppText role="small" color="textMuted">
            {t('errors.checkConnection')}
          </AppText>
          <Button label={t('common.retryButton')} onPress={retry} />
        </Surface>
      );
    }
    if (!rows || !ready) {
      return (
        <View style={styles.loader}>
          <Spinner />
        </View>
      );
    }
    if (rows.length === 0) {
      return (
        <AppText role="body" color="textMuted">
          {t('bac.list.empty')}
        </AppText>
      );
    }
    const years = [...new Set(rows.map((r) => r.year))];
    const intro = (
      <Surface key="intro" style={styles.intro}>
        <AppText role="small" color="textMuted">
          {t('bac.list.intro')}
        </AppText>
      </Surface>
    );
    return [intro, ...years.map((year) => (
      <View key={year} style={styles.group}>
        <AppText role="caption" color="textMuted" accessibilityRole="header">
          {t('bac.list.yearHeading', { an: year })}
        </AppText>
        {rows
          .filter((r) => r.year === year)
          .map((r) => (
            <SubjectRow
              key={r.id}
              row={r}
              locked={!full}
              onResult={full ? () => router.push(`/bac/${r.id}/rezultat`) : undefined}
              onPress={() =>
                // A completed subject (no open attempt) opens its latest result, which offers „Reia subiectul”.
                full ? router.push(r.state === 'completed' ? `/bac/${r.id}/rezultat` : `/bac/${r.id}`) : setPaywall(true)
              }
            />
          ))}
      </View>
    ))];
  };

  return (
    <ScreenLayout title={t('bac.list.title')} onBack={goBackOrHome} trailing={<HeaderPills />}>
      {body()}
      <PaywallSheet
        visible={paywall}
        canOpenAfterPurchase={false}
        doneLabel={t('bac.backToSubjects')}
        onClose={() => setPaywall(false)}
        onUnlocked={() => setPaywall(false)}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  error: { gap: space[3] },
  loader: { marginTop: space[12], alignItems: 'center' },
  group: { gap: space[2.5], marginBottom: space[6] },
  card: { gap: space[2], borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: space[2] },
  cost: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  earlier: { alignSelf: 'flex-start' },
  intro: { marginBottom: space[4] },
});
