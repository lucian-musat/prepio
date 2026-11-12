import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { color, feedbackText, formatGrade, hasFullAccess, radius, space } from '@prepio/shared';
import { AppText, Button, Chip, Icon, ScreenLayout, Spinner, Surface, goBackOrHome } from '../../ui';
import { useAccess } from '../../access/AccessProvider';
import PaywallSheet from '../../access/PaywallSheet';
import Coin from '../../credits/Coin';
import CreditChip from '../../credits/CreditChip';
import { fetchBacList, type BacListRow } from '../../lib/bac';

const ROMAN = ['', 'I', 'II', 'III'];

/** The state chip of a row: text and tones. */
function stateChip(r: BacListRow): { label: string; fg: string; bg: string } {
  switch (r.state) {
    case 'draft':
      return {
        label: r.position
          ? `În lucru · Subiectul ${ROMAN[r.position.section]}, cerința ${r.position.index + 1}`
          : 'În lucru',
        fg: feedbackText.almost,
        bg: color.accentSubtle,
      };
    case 'grading':
      return { label: 'Se corectează…', fg: color.primaryStrong, bg: color.primarySubtle };
    case 'failed':
      return { label: 'Corectarea nu a reușit', fg: feedbackText.wrong, bg: color.dangerSubtle };
    case 'completed':
      return {
        label: r.lastGrade != null ? `✓ Completat · ${formatGrade(r.lastGrade)}` : '✓ Completat',
        fg: feedbackText.good,
        bg: color.successSubtle,
      };
    default:
      return { label: 'Neînceput', fg: color.textMuted, bg: color.surfaceMuted };
  }
}

function SubjectRow({ row, locked, onPress }: { row: BacListRow; locked: boolean; onPress: () => void }) {
  const chip = stateChip(row);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={row.title} onPress={onPress}>
      <Surface style={styles.row}>
        <View style={styles.rowText}>
          <AppText role="bodyStrong">{row.title}</AppText>
          <Chip label={chip.label} fg={chip.fg} bg={chip.bg} />
          <View style={styles.cost} accessible accessibilityLabel={`Costă ${row.creditCost} credite`}>
            <Coin size={12} />
            <AppText role="eyebrow" color="textMuted" accessible={false}>
              {row.creditCost}
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
      </Surface>
    </Pressable>
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
          <AppText role="section">Nu am putut încărca subiectele</AppText>
          <AppText role="small" color="textMuted">
            Verifică conexiunea la internet și încearcă din nou.
          </AppText>
          <Button label="Reîncearcă" onPress={retry} />
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
          Nu există încă subiecte publicate.
        </AppText>
      );
    }
    const years = [...new Set(rows.map((r) => r.year))];
    return years.map((year) => (
      <View key={year} style={styles.group}>
        <AppText role="caption" color="textMuted" accessibilityRole="header">
          {`Istorie · ${year}`}
        </AppText>
        {rows
          .filter((r) => r.year === year)
          .map((r) => (
            <SubjectRow
              key={r.id}
              row={r}
              locked={!full}
              onPress={() =>
                // A completed subject (no open attempt) opens its latest result, which offers „Reia subiectul”.
                full ? router.push(r.state === 'completed' ? `/bac/${r.id}/rezultat` : `/bac/${r.id}`) : setPaywall(true)
              }
            />
          ))}
      </View>
    ));
  };

  return (
    <ScreenLayout title="Subiecte BAC" onBack={goBackOrHome} trailing={<CreditChip />}>
      {body()}
      <PaywallSheet
        visible={paywall}
        canOpenAfterPurchase={false}
        doneLabel="Înapoi la subiecte"
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: radius.lg },
  rowText: { flex: 1, gap: space[2] },
  cost: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
