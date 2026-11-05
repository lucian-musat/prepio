import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, markerPen, radius, space } from '@prepio/shared';
import { AppText, Icon } from '../../ui';
import { PEN_LABEL } from './MarkableText';
import type { MarkerMark, MarkerState, Pen } from './markerReducer';
import { useSourcePanel } from './SourcePanel';

type Props = {
  kind: 'info' | 'support' | 'cause_effect';
  /** Number of slots for info / support (cause-effect always has two). */
  count: number;
  state: MarkerState;
  textOf: (m: MarkerMark) => string;
  /** A slot was pressed: its pen, and the index in `state.marks` of its mark (null when the slot is empty). */
  onOpen: (pen: Pen, markIndex: number | null) => void;
  onRemove: (index: number) => void;
  onSwap?: () => void;
};

// Slot titles and the ✕ labels, per pen; numbered when the exercise asks for several.
const TITLE: Record<Pen, string> = { info: 'Informația', support: 'Informația-suport', cause: 'Cauza', effect: 'Efectul' };

/**
 * The answer slots under the source (mockups `.slot` / `.mark`): a filled slot shows its mark's text in quotes
 * next to a bar in the pen's colour, with ✕; an empty one invites to mark. Pressing a slot opens the source
 * (inside a SourcePanel: the reader on the phone, the left column on desktop) with that pen.
 */
export default function MarkSlots({ kind, count, state, textOf, onOpen, onRemove, onSwap }: Props) {
  const panel = useSourcePanel();
  const open = (pen: Pen, index: number | null) => {
    onOpen(pen, index);
    panel?.open(pen, index);
  };
  const indexed = state.marks.map((m, i) => ({ m, i }));
  const slot = (pen: Pen, k: number, numbered: boolean) => {
    const own = indexed.filter((x) => x.m.pen === pen)[k];
    const title = numbered ? `${TITLE[pen]} ${k + 1}` : TITLE[pen];
    return own ? (
      <Slot key={`${pen}-${k}`} pen={pen} title={title} text={textOf(own.m)} onPress={() => open(pen, own.i)} onRemove={() => onRemove(own.i)} />
    ) : (
      <Slot key={`${pen}-${k}`} pen={pen} title={title} onPress={() => open(pen, null)} />
    );
  };

  if (kind === 'cause_effect') {
    const both = state.marks.some((m) => m.pen === 'cause') && state.marks.some((m) => m.pen === 'effect');
    return (
      <View style={styles.list}>
        {slot('cause', 0, false)}
        <AppText role="label" color="textMuted" style={styles.arrow}>
          ↓ a dus la
        </AppText>
        {slot('effect', 0, false)}
        {both && onSwap ? (
          <Pressable accessibilityRole="button" onPress={onSwap} style={styles.swap}>
            <AppText role="label" color="primary">
              ⇅ Inversează rolurile
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const pen: Pen = kind === 'info' ? 'info' : 'support';
  return <View style={styles.list}>{Array.from({ length: count }, (_, k) => slot(pen, k, count > 1))}</View>;
}

function Slot({ pen, title, text, onPress, onRemove }: { pen: Pen; title: string; text?: string; onPress: () => void; onRemove?: () => void }) {
  const filled = text !== undefined;
  // The ✕ is a sibling of the slot's pressable area, not inside it (a button inside a button is invalid on web).
  return (
    <View style={[styles.slot, !filled && styles.empty]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={filled ? 'Deschide sursa la acest marcaj' : 'Deschide sursa ca să marchezi'}
        onPress={onPress}
        style={styles.open}
      >
        <View style={[styles.bar, { backgroundColor: markerPen[pen] }]} />
        {filled ? (
          <View style={styles.body}>
            <AppText role="badge" color="textMuted" style={styles.title}>
              {title}
            </AppText>
            <AppText role="note">„{text}”</AppText>
          </View>
        ) : (
          <AppText role="note" color="textMuted" style={styles.body}>
            {PEN_LABEL[pen]}: marchează în text
          </AppText>
        )}
        {filled ? null : (
          <AppText role="label" color="primary">
            ›
          </AppText>
        )}
      </Pressable>
      {filled && onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Șterge ${title.toLowerCase()}`} onPress={onRemove} style={styles.remove}>
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
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  body: { flex: 1 },
  title: { textTransform: 'uppercase', letterSpacing: 0.55, marginBottom: 2 },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { alignSelf: 'center' },
  swap: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
  },
});
