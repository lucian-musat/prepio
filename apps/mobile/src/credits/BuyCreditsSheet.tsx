import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, feedbackText, radius, space, type TextKey } from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../components/marker/SourcePanel';
import { AppText, Button } from '../ui';
import Coin from './Coin';
import { useCredits } from './CreditsProvider';
import PackagePicker from './PackagePicker';
import { creditCount } from '../lib/counts';
import { t } from '../texts/store';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // the same backdrop as TemplateSheet

/** What the sheet is for: a consolidation check (the default) or submitting a BAC paper. */
export type BuyCreditsVariant = 'exercise' | 'bac';

/** The text keys per variant (read at render time: the overrides apply). A BAC paper has no tail after the cost. */
const COPY: Record<BuyCreditsVariant, { action: TextKey; back: TextKey; lead: TextKey; tail: TextKey | null; kept: TextKey }> = {
  exercise: {
    action: 'credits.buy.action.exercise',
    back: 'credits.buy.back.exercise',
    lead: 'credits.buy.lead.exercise',
    tail: 'credits.buy.tail.exercise',
    kept: 'credits.buy.kept.exercise',
  },
  bac: {
    action: 'credits.buy.action.bac',
    back: 'credits.buy.back.bac',
    lead: 'credits.buy.lead.bac',
    tail: null,
    kept: 'credits.buy.kept.bac',
  },
};

/** „Înapoi la exercițiu” / „Înapoi la lucrare” (also the paywall's button after a purchase, from useCreditGate). */
export const backLabel = (variant: BuyCreditsVariant = 'exercise') => t(COPY[variant].back);

type Props = {
  visible: boolean;
  /** `bac`: „Trimite acum”, „Înapoi la lucrare” and no skip button. */
  variant?: BuyCreditsVariant;
  /** What the blocked check costs (the server's number after a 402). */
  required: number;
  /** What „Verifică acum” will cost. */
  cost: number;
  /** Backdrop, Android back, „Înapoi la exercițiu”: back to the exercise, its answer untouched. */
  onClose: () => void;
  onSkip: () => void;
  /** A check of this exercise is still in flight: skipping now would lose its (paid) result. */
  skipDisabled?: boolean;
  /** After a purchase: run the check that was blocked. */
  onCheckNow: () => void;
};

/**
 * „Îți mai trebuie N credite” (credits purchase mockup): opens over the exercise when a check costs more than the
 * balance. Choose a package and buy it (approved at once, no payment yet), or skip the exercise; after the purchase
 * „Verifică acum” runs the blocked check. A bottom sheet on the phone, a centred dialog from 900 px.
 */
export default function BuyCreditsSheet({ visible, variant = 'exercise', required, cost, onClose, onSkip, skipDisabled = false, onCheckNow }: Props) {
  const keys = COPY[variant];
  const copy = {
    action: t(keys.action),
    back: t(keys.back),
    lead: t(keys.lead),
    tail: keys.tail ? ` ${t(keys.tail)}` : '',
    kept: t(keys.kept),
  };
  const havePrefix = t('credits.buy.havePrefix');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;
  const { balance } = useCredits();
  const [added, setAdded] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  // The picker mounts with the sheet (inside `visible`), so it reloads on each open; „done” is reset here.

  useEffect(() => {
    if (!visible) return;
    setAdded(null);
    setBuying(false);
  }, [visible]);

  // Closing mid-purchase would hide its outcome; the result still updates the balance either way.
  const close = () => {
    if (!buying) onClose();
  };
  const have = balance ?? 0;
  const skip =
    variant === 'bac' ? null : <Button label={t('credits.buy.skip')} variant="secondary" disabled={buying || skipDisabled} onPress={onSkip} />;
  // A package that still leaves the balance short: back to the packages (the title says what is still missing), so
  // „Verifică acum” never runs a check the balance cannot pay for.
  const enough = have >= cost;

  const body =
    added !== null && enough ? (
      <>
        <View style={styles.done}>
          <AppText role="display" style={styles.big}>
            +{added}
          </AppText>
          <AppText role="question" accessibilityRole="header">
            {t('credits.buy.added')}
          </AppText>
          <AppText role="body" color="textMuted">
            {t('credits.buy.have', { credite: creditCount(have) })}
          </AppText>
        </View>
        <Button label={copy.action} cost={cost} onPress={onCheckNow} />
        <Button label={copy.back} variant="secondary" onPress={onClose} />
      </>
    ) : (
      <>
        <AppText role="question" accessibilityRole="header">
          {t('credits.buy.missing', { credite: creditCount(Math.max(required - have, 1)) })}
        </AppText>
        <AppText
          role="note"
          color="textMuted"
          accessibilityLabel={`${copy.lead} ${creditCount(required)}${copy.tail}. ${havePrefix} ${have}. ${copy.kept}`}
        >
          {copy.lead}{' '}
          <View style={styles.inlineCoin}>
            <Coin size={13} />
          </View>{' '}
          <AppText role="note" style={styles.strong}>
            {required}
          </AppText>
          {copy.tail}. {havePrefix} <AppText role="note" style={styles.strong}>{have}</AppText>. {copy.kept}
        </AppText>
        <PackagePicker onBought={(_, credits) => setAdded(credits)} onBusyChange={setBuying} />
        {skip}
      </>
    );

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.closeWindow')} onPress={close} style={StyleSheet.absoluteFill} />
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
                {t('credits.footnote')}
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
  strong: { color: color.text, fontWeight: '700' },
  // A View inside Text: inline on native; on web it needs inline-flex not to break the line.
  inlineCoin: Platform.OS === 'web' ? ({ display: 'inline-flex', verticalAlign: 'middle' } as never) : {},
  done: { alignItems: 'center', gap: space[1], paddingVertical: space[2] },
  big: { color: feedbackText.good, fontSize: 36, lineHeight: 44 },
  footnote: { textAlign: 'center' },
});
