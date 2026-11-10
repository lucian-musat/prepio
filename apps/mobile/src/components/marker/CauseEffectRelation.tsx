import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, layout, markerInk, markerTint, radius, space, VERDICT_LABELS, type Verdict } from '@prepio/shared';
import { AppText, Icon } from '../../ui';
import { VERDICT_TONE } from '../consolidation/verdictTone';
import { ROLE, relationSentence, type Role } from './causeEffect';
import type { MarkerMark, MarkerState } from './markerReducer';
import { useSourcePanel } from './SourcePanel';

type Props = {
  state: MarkerState;
  textOf: (m: MarkerMark) => string;
  onRemove: (index: number) => void;
  onSwap: () => void;
  /** After checking: no ✕, no swap, no read-aloud check (the gaps still open the source). */
  disabled?: boolean;
  /** The verdict of the mark at this index in `state.marks`, shown on its gap after checking. */
  verdictOf?: (markIndex: number) => Verdict | null;
};

const REMOVE = 28;
const REMOVE_SLOP = (layout.minTouch - REMOVE) / 2;

/**
 * The cause-effect answer (mockup „★ Recomandat”): „Cauza · de ce?” ↓ a dus la ↓ „Efectul · ce a urmat?”. Pressing a
 * gap makes that role current and opens the source on it; with both filled, „Pentru că X, Y.” asks „Are sens?”.
 */
export default function CauseEffectRelation({ state, textOf, onRemove, onSwap, disabled = false, verdictOf }: Props) {
  const panel = useSourcePanel();
  const indexOf = (r: Role) => state.marks.findIndex((m) => m.pen === r);
  const gap = (r: Role) => {
    const index = indexOf(r);
    const mark = index >= 0 ? state.marks[index] : undefined;
    const verdict = mark ? verdictOf?.(index) ?? null : null;
    const on = !disabled && state.pen === r;
    return (
      <View style={styles.gapRow}>
        <Pressable
          testID={`ce-gap-${r}`}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          accessibilityHint={mark ? 'Deschide sursa la acest marcaj' : 'Deschide sursa ca să marchezi'}
          onPress={() => panel?.open(r, mark ? index : null)}
          style={[styles.gap, { borderColor: markerInk[r] }, mark ? { backgroundColor: markerTint[r] } : styles.empty, on && styles.on]}
        >
          <View style={styles.body}>
            <AppText role="badge" style={[styles.caption, { color: markerInk[r] }]}>
              {ROLE[r].gap}
            </AppText>
            <AppText role="note" color={mark ? 'text' : 'textMuted'}>
              {mark ? `„${textOf(mark)}”` : 'Atinge ca să marchezi'}
            </AppText>
          </View>
          {verdict ? (
            <View accessibilityLabel={`Verdict: ${VERDICT_LABELS[verdict]}`} style={[styles.verdict, { backgroundColor: VERDICT_TONE[verdict].bg }]}>
              <AppText role="badge" style={{ color: VERDICT_TONE[verdict].fg }}>
                {VERDICT_LABELS[verdict]}
              </AppText>
            </View>
          ) : null}
        </Pressable>
        {/* A sibling of the gap, not inside it (a button inside a button is invalid on web). */}
        {mark && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Șterge ${ROLE[r].name.toLowerCase()}`}
            onPress={() => onRemove(index)}
            hitSlop={{ top: REMOVE_SLOP, bottom: REMOVE_SLOP, left: REMOVE_SLOP, right: REMOVE_SLOP }}
            style={styles.remove}
          >
            <Icon name="close" size={space[4]} tint={color.textMuted} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const cause = state.marks[indexOf('cause')];
  const effect = state.marks[indexOf('effect')];
  return (
    <View style={styles.list}>
      {gap('cause')}
      <AppText role="label" color="primary" style={styles.arrow}>
        ↓ a dus la
      </AppText>
      {gap('effect')}
      {cause && effect && !disabled ? (
        <View testID="ce-check" style={styles.check}>
          <AppText role="note">
            Citește-o cu voce tare: <AppText role="note" style={styles.sentence}>{relationSentence(textOf(cause), textOf(effect))}</AppText>
          </AppText>
          <View style={styles.checkRow}>
            <AppText role="label">Are sens?</AppText>
            <AppText role="note" color="textMuted">
              Dacă nu,
            </AppText>
            <Pressable accessibilityRole="button" onPress={onSwap} style={styles.swap}>
              <AppText role="label" color="primary">
                ⇅ Inversează
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  gap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[2.5],
    borderWidth: border.thick,
    borderRadius: radius.sm,
  },
  empty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  on: { borderStyle: 'solid', boxShadow: `0px 0px 0px 3px ${color.primarySubtle}` },
  body: { flex: 1 },
  caption: { textTransform: 'uppercase', letterSpacing: 0.55, marginBottom: 2 },
  verdict: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: space[2] },
  remove: {
    width: REMOVE,
    height: REMOVE,
    borderRadius: 8,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { paddingLeft: space[1] },
  check: { gap: space[1.5], padding: space[2.5], backgroundColor: color.primarySubtle, borderRadius: radius.sm },
  sentence: { fontStyle: 'italic' },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1.5] },
  swap: {
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
  },
});
