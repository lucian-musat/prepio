import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  color,
  creditsLabel,
  extendAccessUntil,
  feedbackText,
  formatAccessDate,
  formatLei,
  plural,
  radius,
  space,
  type AccessStatus,
} from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../components/marker/SourcePanel';
import { PAYMENT_FOOTNOTE } from '../credits/PackagePicker';
import { lessonCount as lessonsLabel } from '../lib/lessonCount';
import { AppText, Button, Spinner, TextButton } from '../ui';
import { useAccess } from './AccessProvider';
import { useAccessPurchase } from './useAccessPurchase';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // the same backdrop as BuyCreditsSheet / TemplateSheet

type Props = {
  visible: boolean;
  /** The lesson that was tapped; without it (banner, consolidation) the sheet names no lesson. */
  lessonTitle?: string;
  /** Published lessons (Home data); without it the benefit reads „Toate lecțiile”. */
  lessonCount?: number;
  /** The button after a purchase; „Deschide lecția” with a lesson, otherwise „Continuă”. */
  doneLabel?: string;
  /**
   * Whether the tapped lesson is playable once the access is bought (the learning mode may still lock it, e.g. guided
   * order). False: the success button reads „Înapoi la lecții” and only closes the sheet. Default true.
   */
  canOpenAfterPurchase?: boolean;
  /** „Mai târziu”, the backdrop, Android back: nothing bought. */
  onClose: () => void;
  /** After „Ai acces complet!”: the caller moves on (opens the tapped lesson, back to the exercise). */
  onUnlocked: () => void;
};

/** The current end as `extendAccessUntil` wants it (null in the trial). */
const untilOf = (s: AccessStatus): string | null => (s.plan === 'trial' ? null : s.until.toISOString());

type Done = { bonus: number };

function Body({ lessonTitle, lessonCount, doneLabel, canOpenAfterPurchase = true, onClose, onUnlocked, onPending }: Omit<Props, 'visible'> & { onPending(p: boolean): void }) {
  const { status, offer, refresh } = useAccess();
  const { purchase, pending, error } = useAccessPurchase();
  const [done, setDone] = useState<Done | null>(null);
  // The wording is the one the student opened the sheet with („Deblochează” in the trial, „Reînnoiește” after).
  const [trial] = useState(() => status.plan === 'trial');

  useEffect(() => {
    if (!offer) void refresh(); // the offer could not be read yet (offline at start): try again
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => onPending(pending), [pending, onPending]);

  if (done) {
    // A tapped lesson that the learning mode still locks: back to Home, which shows the order.
    const stayHome = !!lessonTitle && !doneLabel && !canOpenAfterPurchase;
    return (
      <>
        <View style={styles.done}>
          {done.bonus > 0 ? (
            <AppText role="display" style={styles.big}>
              +{done.bonus}
            </AppText>
          ) : null}
          <AppText role="question" accessibilityRole="header" style={styles.center}>
            Ai acces complet!
          </AppText>
          <AppText role="body" color="textMuted" style={styles.center}>
            {/* The end date the server stored (applyPurchase), not a local estimate. */}
            {status.plan === 'trial' ? 'Toate lecțiile sunt deschise.' : `Toate lecțiile sunt deschise până la ${formatAccessDate(status.until)}.`}
          </AppText>
        </View>
        {stayHome ? (
          <>
            <Button label="Înapoi la lecții" onPress={onClose} />
            <AppText role="small" color="textMuted" style={styles.center}>
              Lecțiile se deschid în ordine, pe traseul ghidat.
            </AppText>
          </>
        ) : (
          <Button label={doneLabel ?? (lessonTitle ? 'Deschide lecția' : 'Continuă')} onPress={onUnlocked} />
        )}
      </>
    );
  }

  if (!offer) {
    return (
      <View style={styles.loading}>
        <Spinner />
      </View>
    );
  }

  const price = formatLei(offer.priceBani);
  const end = formatAccessDate(extendAccessUntil(untilOf(status), offer.durationMonths, new Date()));
  const buy = async () => {
    const bonus = offer.bonusCredits;
    if (await purchase()) setDone({ bonus });
  };
  const benefits = [
    `📚 ${lessonCount !== undefined && lessonCount > 1 ? `Toate cele ${lessonsLabel(lessonCount)}` : 'Toate lecțiile'}, în orice mod de învățare`,
    offer.bonusCredits > 0 ? `🪙 +${creditsLabel(offer.bonusCredits)} pentru profesorul digital` : null,
    `📅 Acces ${plural(offer.durationMonths, 'lună', 'luni')} — până la ${end}`,
    '🎁 Îți păstrezi creditele pe care le ai deja',
  ].filter((b): b is string => b !== null);

  return (
    <>
      <View style={styles.head}>
        <AppText role="question" accessibilityRole="header">
          {trial ? 'Deblochează toate lecțiile' : 'Reînnoiește accesul'}
        </AppText>
        {lessonTitle ? (
          <AppText role="small" color="textMuted">
            „{lessonTitle}” face parte din accesul complet.
          </AppText>
        ) : null}
      </View>
      <View style={styles.benefits}>
        {benefits.map((b) => (
          <AppText key={b} role="body">
            {b}
          </AppText>
        ))}
      </View>
      <View style={styles.price}>
        <AppText role="title">{price}</AppText>
        <AppText role="small" color="textMuted" style={styles.priceNote}>
          plată unică · nu se reînnoiește automat
        </AppText>
      </View>
      {error ? (
        <AppText role="small" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <Button label={`${trial ? 'Deblochează' : 'Reînnoiește'} · ${price}`} loading={pending} onPress={buy} />
      <TextButton label="Mai târziu" disabled={pending} onPress={onClose} />
    </>
  );
}

/**
 * „Deblochează toate lecțiile” (paid-access mockup): opens over Home when a lesson outside the trial is tapped (or
 * from the banner / a locked deep link), and over a consolidation exercise when the access ended mid-session. The
 * offer comes from `useAccess`; „Deblochează” buys it at once (no payment yet) and the sheet confirms with
 * „Ai acces complet!”. A bottom sheet on the phone, a centred dialog from 900 px, like BuyCreditsSheet.
 */
export default function PaywallSheet({ visible, onClose, ...rest }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;
  // Closing mid-purchase would hide its outcome (the purchase still applies either way).
  const pending = useRef(false);
  const [onPending] = useState(() => (p: boolean) => {
    pending.current = p;
  });
  useEffect(() => {
    if (!visible) pending.current = false;
  }, [visible]);
  const close = () => {
    if (!pending.current) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide fereastra" onPress={close} style={StyleSheet.absoluteFill} />
        {visible ? (
          <View
            testID="paywall-sheet"
            accessibilityViewIsModal
            style={[styles.sheet, dialog ? styles.dialog : { paddingBottom: insets.bottom + space[4] }]}
          >
            {dialog ? null : <View style={styles.grab} />}
            <ScrollView contentContainerStyle={styles.body}>
              {/* Mounted per opening: each one starts on the offer, with no old error. */}
              <Body {...rest} onClose={close} onPending={onPending} />
              <AppText role="caption" color="textMuted" style={styles.center}>
                {PAYMENT_FOOTNOTE}
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
  head: { gap: space[1] },
  benefits: { gap: space[1.5] },
  price: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[2] },
  priceNote: { flexShrink: 1 },
  error: { color: feedbackText.wrong },
  loading: { alignItems: 'center', paddingVertical: space[6] },
  done: { alignItems: 'center', gap: space[1], paddingVertical: space[2] },
  big: { color: feedbackText.good, fontSize: 36, lineHeight: 44 },
  center: { textAlign: 'center' },
});
