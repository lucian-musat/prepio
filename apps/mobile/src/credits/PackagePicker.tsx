import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, creditsLabel, feedbackText, formatLei, palette, pricePerCredit, radius, space, type CreditPackage } from '@prepio/shared';
import { CreditsApiError, fetchCreditPackages, PURCHASE_FAILED, purchaseCredits } from '../lib/credits';
import { AppText, Button, Spinner } from '../ui';
import Coin from './Coin';
import { useCredits } from './CreditsProvider';

export const PAYMENT_FOOTNOTE = 'Plata nu e încă activă — cererea a fost aprobată automat.';

type Phase = 'loading' | 'loadFailed' | 'choose' | 'buying';

type Props = {
  /** After a purchase: the new balance and how many credits the package added. */
  onBought: (balance: number, credits: number) => void;
  /** True while a purchase is in flight (the host should not close over its outcome). */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * The package rows (credits, price, price per credit, „CEL MAI ALES” on the featured one) with the error line and
 * the buy button. Loads the active packages itself and buys the selected one; the balance is updated here, the host
 * only reacts through `onBought`. Shared by the „Îți mai trebuie” sheet and the credits page.
 */
export default function PackagePicker({ onBought, onBusyChange }: Props) {
  const { setBalance } = useCredits();
  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const busyCb = useRef(onBusyChange);
  busyCb.current = onBusyChange;

  /** Reads the active packages; `spinner` replaces the list while it loads (a reload after a 409 keeps it). */
  const load = useCallback(async (spinner: boolean) => {
    if (spinner) setPhase('loading');
    try {
      const list = await fetchCreditPackages();
      if (!mounted.current) return;
      setPackages(list);
      setSelected((cur) => (cur && list.some((p) => p.id === cur) ? cur : ((list.find((p) => p.featured) ?? list[0])?.id ?? null)));
      setPhase('choose');
    } catch (e) {
      if (!mounted.current) return;
      console.warn('[credits] packages could not be loaded:', e);
      setPhase('loadFailed');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(true);
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const buy = async () => {
    const pkg = packages.find((p) => p.id === selected);
    if (!pkg || inFlight.current) return;
    inFlight.current = true;
    setPhase('buying');
    setError('');
    busyCb.current?.(true);
    try {
      const res = await purchaseCredits(pkg.id);
      // The balance follows the purchase even if the host went away meanwhile.
      setBalance(res.balance);
      if (!mounted.current) return;
      onBought(res.balance, res.credits);
      setPhase('choose');
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error && e.message ? e.message : PURCHASE_FAILED);
      setPhase('choose');
      if (e instanceof CreditsApiError && e.code === 'package_unavailable') void load(false);
    } finally {
      inFlight.current = false;
      busyCb.current?.(false);
    }
  };

  const buying = phase === 'buying';
  const pkg = packages.find((p) => p.id === selected) ?? null;

  return (
    <View style={styles.root}>
      {phase === 'loading' ? (
        <View style={styles.status}>
          <Spinner accessibilityLabel="Se încarcă pachetele" />
        </View>
      ) : phase === 'loadFailed' ? (
        <View style={styles.status}>
          <AppText role="note" style={styles.error}>
            Nu am putut încărca pachetele.
          </AppText>
          <Button label="Reîncearcă" variant="secondary" compact onPress={() => void load(true)} />
        </View>
      ) : packages.length === 0 ? (
        <AppText role="note" color="textMuted" style={styles.statusText}>
          Nu sunt pachete disponibile acum.
        </AppText>
      ) : (
        <View accessibilityRole="radiogroup" style={styles.packages}>
          {packages.map((p) => {
            const on = p.id === selected;
            const per = pricePerCredit(p.priceBani, p.credits);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: buying }}
                accessibilityLabel={`${creditsLabel(p.credits)}, ${formatLei(p.priceBani)}, ${per}${p.featured ? ', cel mai ales' : ''}`}
                disabled={buying}
                onPress={() => setSelected(p.id)}
                style={[styles.pkg, on && styles.pkgOn]}
              >
                {p.featured ? (
                  <View style={styles.badge}>
                    <AppText role="badge" style={styles.badgeText}>
                      CEL MAI ALES
                    </AppText>
                  </View>
                ) : null}
                <Coin size={16} />
                <AppText role="bodyStrong" style={styles.fill}>
                  {creditsLabel(p.credits)}
                </AppText>
                <View style={styles.price}>
                  <AppText role="bodyStrong">{formatLei(p.priceBani)}</AppText>
                  <AppText role="caption" color="textMuted">
                    {per}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? (
        <AppText role="note" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      {phase === 'choose' || phase === 'buying' ? (
        <Button
          label={pkg ? `Cumpără ${creditsLabel(pkg.credits)} · ${formatLei(pkg.priceBani)}` : 'Cumpără'}
          disabled={!pkg}
          loading={buying}
          onPress={buy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  fill: { flex: 1 },
  packages: { gap: space[2.5], paddingTop: space[1.5] },
  pkg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: space[2.5],
    paddingHorizontal: space[3],
    minHeight: 56,
  },
  pkgOn: { borderColor: color.primary, backgroundColor: color.primarySubtle },
  badge: {
    position: 'absolute',
    top: -9,
    right: space[2.5],
    backgroundColor: palette.yellow[400],
    borderRadius: radius.pill,
    paddingVertical: 1,
    paddingHorizontal: space[1.5],
  },
  badgeText: { color: color.onAccent },
  price: { alignItems: 'flex-end' },
  status: { alignItems: 'center', gap: space[2], paddingVertical: space[3] },
  statusText: { textAlign: 'center' },
  error: { color: feedbackText.wrong, textAlign: 'center' },
});
