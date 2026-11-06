import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, creditsLabel, feedbackText, gradient, radius, space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, Spinner, goBackOrHome } from '../ui';
import Coin from '../credits/Coin';
import { useCredits } from '../credits/CreditsProvider';
import PackagePicker, { PAYMENT_FOOTNOTE } from '../credits/PackagePicker';
import { fetchLedger, ledgerLabel, type StudentLedgerEntry } from '../lib/credits';

const PAGE = 30; // fetchLedger's default page size: a full page means there may be more
const HERO_POINTS = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }; // 135deg, as the top bar logo
const LOAD_FAILED = 'Nu am putut încărca istoricul.';
const dateFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });

/** „3 nov.” */
const formatDay = (iso: string) => dateFormat.format(new Date(iso));

function HistoryRow({ entry }: { entry: StudentLedgerEntry }) {
  const gain = entry.delta > 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <AppText role="bodyStrong">{ledgerLabel(entry)}</AppText>
        <AppText role="caption" color="textMuted">
          {formatDay(entry.createdAt)}
        </AppText>
      </View>
      <AppText
        role="bodyStrong"
        accessibilityLabel={`${gain ? 'plus' : 'minus'} ${creditsLabel(Math.abs(entry.delta))}`}
        style={{ color: gain ? feedbackText.good : feedbackText.wrong }}
      >
        {gain ? `+${entry.delta}` : `−${-entry.delta}`}
      </AppText>
    </View>
  );
}

/** „Creditele mele” (credits purchase mockup, step 3): the balance, the packages and the ledger, newest first. */
export default function CreditsScreen() {
  const { balance, refresh } = useCredits();
  const [entries, setEntries] = useState<StudentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
    // Mount-only: the balance must be fresh when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (before?: number) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const rows = await (before === undefined ? fetchLedger() : fetchLedger({ before }));
      if (!mounted.current) return;
      setEntries((cur) => [...cur, ...rows.filter((r) => !cur.some((c) => c.id === r.id))]);
      setMore(rows.length >= PAGE);
    } catch (e) {
      if (!mounted.current) return;
      console.warn('[credits] history could not be loaded:', e);
      setError(LOAD_FAILED);
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const have = balance ?? 0;
  const last = entries[entries.length - 1];

  return (
    <ScreenLayout title="Creditele mele" onBack={goBackOrHome}>
      <View style={styles.stack}>
        <LinearGradient
          colors={[...gradient.hero.colors]}
          locations={[...gradient.hero.locations]}
          {...HERO_POINTS}
          style={styles.card}
        >
          <AppText role="eyebrow" color="onPrimary">
            Sold
          </AppText>
          <View style={styles.balance}>
            <Coin size={28} />
            <AppText role="display" color="onPrimary" style={styles.big}>
              {String(have)}
            </AppText>
          </View>
          <AppText role="note" color="onPrimary">
            {`≈ ${Math.floor(have / 2)}–${have} verificări`}
          </AppText>
        </LinearGradient>

        <View style={styles.section}>
          <AppText role="section" accessibilityRole="header">
            Cumpără credite
          </AppText>
          <PackagePicker onBought={() => {}} />
          <AppText role="caption" color="textMuted" style={styles.center}>
            {PAYMENT_FOOTNOTE}
          </AppText>
        </View>

        <View style={styles.section}>
          <AppText role="section" accessibilityRole="header">
            Istoric
          </AppText>
          {entries.map((e) => (
            <HistoryRow key={e.id} entry={e} />
          ))}
          {loading ? (
            <View style={styles.center}>
              <Spinner accessibilityLabel="Se încarcă istoricul" />
            </View>
          ) : null}
          {!loading && !error && entries.length === 0 ? (
            <AppText role="note" color="textMuted">
              Încă nu ai folosit credite.
            </AppText>
          ) : null}
          {error ? (
            <AppText role="note" accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          {!loading && (error || more) ? (
            <Button
              label={error && entries.length === 0 ? 'Reîncearcă' : 'Încarcă mai multe'}
              variant="secondary"
              onPress={() => void load(error && entries.length === 0 ? undefined : last?.id)}
            />
          ) : null}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
  card: { borderRadius: radius.lg, padding: space[5], gap: space[1] },
  balance: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  big: { fontSize: 40, lineHeight: 48 },
  section: { gap: space[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: space[2.5],
  },
  rowText: { flex: 1, gap: 2 },
  center: { alignItems: 'center', textAlign: 'center' },
  error: { color: feedbackText.wrong },
});
