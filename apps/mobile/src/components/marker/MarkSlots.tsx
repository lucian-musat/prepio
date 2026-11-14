import { Pressable, StyleSheet, Text, View } from 'react-native';
import { border, color, layout, radius, space, type TextKey, type Verdict } from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import { verdictLabel } from '../../screens/consolidation/status';
import { t } from '../../texts/store';
import { AppText, Icon } from '../../ui';
import { VERDICT_TONE } from '../consolidation/verdictTone';
import { penLabel } from './MarkableText';
import type { MarkerMark, MarkerState, Pen } from './markerReducer';
import { markBg, slotName, slotPill, slotTone } from './numbered';
import { useSourcePanel } from './SourcePanel';

type Props = {
  kind: 'info' | 'support';
  /** Number of slots. */
  count: number;
  /** Numbered marker (spec 2026-11-11): each slot holds the mark with its `slot`, in its own colour and pill. */
  numbered?: boolean;
  state: MarkerState;
  textOf: (m: MarkerMark) => string;
  /** A slot was pressed: its pen, the index in `state.marks` of its mark (null when the slot is empty), and its number. */
  onOpen: (pen: Pen, markIndex: number | null, slot: number) => void;
  onRemove: (index: number) => void;
  /** After checking: no ✕ (the slots still open the source). */
  disabled?: boolean;
  /** The verdict of the mark at this index in `state.marks`, shown on its slot after checking. */
  verdictOf?: (markIndex: number) => Verdict | null;
};

// Slot titles and the ✕ labels, per pen; numbered when the exercise asks for several.
const TITLE: Record<Pen, TextKey> = {
  info: 'consolidation.marker.slot.info',
  support: 'consolidation.marker.slot.support',
  cause: 'consolidation.marker.slot.cause',
  effect: 'consolidation.marker.slot.effect',
};
const REMOVE = 28;
// The ✕ is drawn at the mockup's 28 px; its touch area reaches the 48 px minimum.
const REMOVE_SLOP = (layout.minTouch - REMOVE) / 2;

/**
 * The answer slots under the source (mockups `.slot` / `.mark`): a filled slot shows its mark's text in quotes
 * next to a bar in the pen's colour, with ✕; an empty one invites to mark. Pressing a slot opens the source
 * (inside a SourcePanel: the reader on the phone, the left column on desktop) with that pen.
 */
export default function MarkSlots({ kind, count, numbered = false, state, textOf, onOpen, onRemove, disabled = false, verdictOf }: Props) {
  const panel = useSourcePanel();
  const open = (pen: Pen, index: number | null, k: number) => {
    onOpen(pen, index, k);
    panel?.open(pen, index);
  };
  const indexed = state.marks.map((m, i) => ({ m, i }));
  const slot = (pen: Pen, k: number) => {
    const mine = indexed.filter((x) => x.m.pen === pen);
    const own = numbered ? mine.find((x) => x.m.slot === k) : mine[k];
    const title = numbered ? slotName(pen, k) : count > 1 ? `${t(TITLE[pen])} ${k + 1}` : t(TITLE[pen]);
    const common = {
      testID: `slot-${k}`,
      pen,
      slot: numbered ? k : undefined,
      title,
      current: numbered && !disabled && state.slot === k,
    };
    return own ? (
      <Slot
        key={`${pen}-${k}`}
        {...common}
        text={textOf(own.m)}
        verdict={verdictOf?.(own.i) ?? null}
        onPress={() => open(pen, own.i, k)}
        onRemove={disabled ? undefined : () => onRemove(own.i)}
      />
    ) : (
      <Slot key={`${pen}-${k}`} {...common} onPress={() => open(pen, null, k)} />
    );
  };

  const pen: Pen = kind === 'info' ? 'info' : 'support';
  return <View style={styles.list}>{Array.from({ length: count }, (_, k) => slot(pen, k))}</View>;
}

type SlotProps = {
  testID: string;
  pen: Pen;
  /** Numbered: the slot's number (its colour and pill); undefined for the pen's own colour. */
  slot?: number;
  title: string;
  /** Numbered: the slot a new selection fills (a border in its ink). */
  current: boolean;
  text?: string;
  verdict?: Verdict | null;
  onPress: () => void;
  onRemove?: () => void;
};

function Slot({ testID, pen, slot, title, current, text, verdict = null, onPress, onRemove }: SlotProps) {
  const filled = text !== undefined;
  const pill = slot === undefined ? null : slotPill(pen, slot);
  const pillView = pill ? (
    <View style={[styles.pill, { backgroundColor: pill.ink }]}>
      <Text style={styles.pillText}>{pill.label}</Text>
    </View>
  ) : null;
  // The ✕ is a sibling of the slot's pressable area, not inside it (a button inside a button is invalid on web).
  return (
    <View testID={testID} style={[styles.slot, !filled && styles.empty, current && slot !== undefined && [styles.current, { borderColor: slotTone(slot).ink }]]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t(filled ? 'consolidation.marker.slot.openMarked' : 'consolidation.marker.slot.openEmpty')}
        onPress={onPress}
        style={styles.open}
      >
        <View style={[styles.bar, { backgroundColor: markBg({ pen, slot }) }]} />
        {filled ? (
          <View style={styles.body}>
            <View style={styles.titleRow}>
              {pillView}
              <AppText role="badge" color="textMuted" style={styles.title}>
                {title}
              </AppText>
            </View>
            <AppText role="note">„{text}”</AppText>
          </View>
        ) : (
          <View style={[styles.body, styles.titleRow]}>
            {pillView}
            <AppText role="note" color="textMuted" style={styles.body}>
              {t('consolidation.marker.slot.emptyPrompt', { nume: slot === undefined ? penLabel(pen) : title })}
            </AppText>
          </View>
        )}
        {filled ? null : (
          <AppText role="label" color="primary">
            ›
          </AppText>
        )}
      </Pressable>
      {verdict ? (
        <View accessibilityLabel={t('consolidation.marker.verdictLabel', { verdict: verdictLabel(verdict) })} style={[styles.verdict, { backgroundColor: VERDICT_TONE[verdict].bg }]}>
          <AppText role="badge" style={{ color: VERDICT_TONE[verdict].fg }}>
            {verdictLabel(verdict)}
          </AppText>
        </View>
      ) : null}
      {filled && onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('consolidation.marker.removeLabel', { nume: title.toLowerCase() })}
          onPress={onRemove}
          hitSlop={{ top: REMOVE_SLOP, bottom: REMOVE_SLOP, left: REMOVE_SLOP, right: REMOVE_SLOP }}
          style={styles.remove}
        >
          <Icon name="close" size={space[4]} tint={color.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  slot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[2.5],
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.sm,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: space[2.5], alignSelf: 'stretch' },
  empty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  // 2 px border, the padding shrinks by the extra pixel so the content does not move.
  current: { borderWidth: 2, borderStyle: 'solid', padding: space[2.5] - 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[1.5] },
  pill: { borderRadius: 6, paddingHorizontal: 5, marginBottom: 2 },
  pillText: { fontFamily: fontFamily.bodyBold, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, color: color.surface },
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  body: { flex: 1 },
  title: { textTransform: 'uppercase', letterSpacing: 0.55, marginBottom: 2 },
  verdict: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: space[2] },
  remove: {
    width: REMOVE,
    height: REMOVE,
    borderRadius: 8,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
