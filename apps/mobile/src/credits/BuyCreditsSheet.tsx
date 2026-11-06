import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, creditsLabel, feedbackText, formatLei, palette, pricePerCredit, radius, space, type CreditPackage } from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../components/marker/SourcePanel';
import { CreditsApiError, fetchCreditPackages, purchaseCredits } from '../lib/credits';
import { AppText, Button, Spinner } from '../ui';
import Coin from './Coin';
import { useCredits } from './CreditsProvider';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // the same backdrop as TemplateSheet
const PURCHASE_FAILED = 'Achiziția nu a reușit. Încearcă din nou.';
const FOOTNOTE = 'Plata nu e încă activă — cererea a fost aprobată automat.';

type Props = {
  visible: boolean;
  /** What the blocked check costs (the server's number after a 402). */
  required: number;
  /** What „Verifică acum” will cost. */
  cost: number;
  /** Backdrop, Android back, „Înapoi la exercițiu”: back to the exercise, its answer untouched. */
  onClose: () => void;
  onSkip: () => void;
  /** After a purchase: run the check that was blocked. */
  onCheckNow: () => void;
};

type Phase = 'loading' | 'loadFailed' | 'choose' | 'buying' | 'done';

/** The package rows: credits, price and price per credit, „CEL MAI ALES” on the featured one; one is selected. */
function PackageList({
  packages,
  selected,
  onSelect,
  disabled,
}: {
  packages: CreditPackage[];
  selected: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.packages}>
      {packages.map((p) => {
        const on = p.id === selected;
        const per = pricePerCredit(p.priceBani, p.credits);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={`${creditsLabel(p.credits)}, ${formatLei(p.priceBani)}, ${per}${p.featured ? ', cel mai ales' : ''}`}
            disabled={disabled}
            onPress={() => onSelect(p.id)}
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
  );
}

/**
 * „Îți mai trebuie N credite” (credits purchase mockup): opens over the exercise when a check costs more than the
 * balance. Choose a package and buy it (approved at once, no payment yet), or skip the exercise; after the purchase
 * „Verifică acum” runs the blocked check. A bottom sheet on the phone, a centred dialog from 900 px.
 */
export default function BuyCreditsSheet({ visible, required, cost, onClose, onSkip, onCheckNow }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;
  const { balance, setBalance } = useCredits();
  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);
  const inFlight = useRef(false);
  // Drops a package list or a purchase result that arrives after the sheet closed or reopened.
  const session = useRef(0);

  /** Reads the active packages; `spinner` replaces the list while it loads (a reload after a 409 keeps it). */
  const load = useCallback(async (spinner: boolean) => {
    const id = session.current;
    if (spinner) setPhase('loading');
    try {
      const list = await fetchCreditPackages();
      if (id !== session.current) return;
      setPackages(list);
      setSelected((cur) => (cur && list.some((p) => p.id === cur) ? cur : ((list.find((p) => p.featured) ?? list[0])?.id ?? null)));
      setPhase('choose');
    } catch (e) {
      if (id !== session.current) return;
      console.warn('[credits] packages could not be loaded:', e);
      setPhase('loadFailed');
    }
  }, []);

  useEffect(() => {
    session.current += 1;
    if (!visible) return;
    setError('');
    setSelected(null);
    setPackages([]);
    void load(true);
  }, [visible, load]);

  const buy = async () => {
    const pkg = packages.find((p) => p.id === selected);
    if (!pkg || inFlight.current) return;
    inFlight.current = true;
    const id = session.current;
    setPhase('buying');
    setError('');
    try {
      const res = await purchaseCredits(pkg.id);
      setBalance(res.balance);
      if (id !== session.current) return;
      setAdded(res.credits);
      setPhase('done');
    } catch (e) {
      if (id !== session.current) return;
      setError(e instanceof Error && e.message ? e.message : PURCHASE_FAILED);
      setPhase('choose');
      if (e instanceof CreditsApiError && e.code === 'package_unavailable') void load(false);
    } finally {
      inFlight.current = false;
    }
  };

  const buying = phase === 'buying';
  // Closing mid-purchase would hide its outcome; the result still updates the balance either way.
  const close = () => {
    if (!buying) onClose();
  };
  const have = balance ?? 0;
  const pkg = packages.find((p) => p.id === selected) ?? null;
  const skip = <Button label="Sari peste exercițiu" variant="secondary" disabled={buying} onPress={onSkip} />;

  const body =
    phase === 'done' ? (
      <>
        <View style={styles.done}>
          <AppText role="display" style={styles.big}>
            +{added}
          </AppText>
          <AppText role="question" accessibilityRole="header">
            Credite adăugate!
          </AppText>
          <AppText role="body" color="textMuted">
            Acum ai {creditsLabel(have)}.
          </AppText>
        </View>
        <Button label="Verifică acum" cost={cost} onPress={onCheckNow} />
        <Button label="Înapoi la exercițiu" variant="secondary" onPress={onClose} />
      </>
    ) : (
      <>
        <AppText role="question" accessibilityRole="header">
          Îți mai trebuie {creditsLabel(Math.max(required - have, 1))}
        </AppText>
        <AppText
          role="note"
          color="textMuted"
          accessibilityLabel={`Verificarea cu profesorul digital costă ${creditsLabel(required)} la acest exercițiu. Ai ${have}. Răspunsul tău rămâne salvat.`}
        >
          Verificarea cu profesorul digital costă{' '}
          <View style={styles.inlineCoin}>
            <Coin size={13} />
          </View>{' '}
          <AppText role="note" style={styles.strong}>
            {required}
          </AppText>{' '}
          la acest exercițiu. Ai <AppText role="note" style={styles.strong}>{have}</AppText>. Răspunsul tău rămâne salvat.
        </AppText>
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
          <PackageList packages={packages} selected={selected} onSelect={setSelected} disabled={buying} />
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
        {skip}
      </>
    );

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide fereastra" onPress={close} style={StyleSheet.absoluteFill} />
        {visible ? (
          <View
            testID="buy-credits-sheet"
            accessibilityViewIsModal
            style={[styles.sheet, dialog ? styles.dialog : { paddingBottom: insets.bottom + space[4] }]}
          >
            {dialog ? null : <View style={styles.grab} />}
            <ScrollView contentContainerStyle={styles.body}>
              {body}
              <AppText role="caption" color="textMuted" style={styles.footnote}>
                {FOOTNOTE}
              </AppText>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: BACKDROP },
  rootDialog: { justifyContent: 'center', alignItems: 'center', padding: space[6] },
  sheet: { maxHeight: '86%', backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  dialog: { width: '100%', maxWidth: DIALOG_MAX, borderRadius: radius.xl, paddingBottom: space[2] },
  grab: { width: 42, height: 5, borderRadius: 9, backgroundColor: color.border, alignSelf: 'center', marginTop: space[2], marginBottom: space[1] },
  body: { padding: space[4.5], paddingTop: space[2], gap: space[3] },
  fill: { flex: 1 },
  strong: { color: color.text, fontWeight: '700' },
  // A View inside Text: inline on native; on web it needs inline-flex not to break the line.
  inlineCoin: Platform.OS === 'web' ? ({ display: 'inline-flex', verticalAlign: 'middle' } as never) : {},
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
  done: { alignItems: 'center', gap: space[1], paddingVertical: space[2] },
  big: { color: feedbackText.good, fontSize: 36, lineHeight: 44 },
  footnote: { textAlign: 'center' },
});
