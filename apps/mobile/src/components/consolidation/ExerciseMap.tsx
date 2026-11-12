import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { color, layout, radius, space } from '@prepio/shared';
import { MUTED, type StatusTone } from '../../screens/consolidation/status';
import { AppText } from '../../ui';
import { VERDICT_TONE } from './verdictTone';

const LEGEND: Array<[string, StatusTone]> = [
  ['corect', VERDICT_TONE.ok],
  ['aproape', VERDICT_TONE.almost],
  ['mai lucrează', VERDICT_TONE.no],
  ['nerezolvat', MUTED],
];

export type MapItem = { id: string; chip: string; tone: StatusTone };

type Props = {
  items: MapItem[];
  /** Index of the exercise on screen. */
  current: number;
  onJump: (index: number) => void;
  /** While a check is running nothing can be left. */
  disabled?: boolean;
};

const DOT = 28;
const MIN_SLOT = 32; // the narrowest a slot gets before the row scrolls (11+ exercises on a phone)
const MAX_SLOT = layout.minTouch;

/**
 * The run's exercises as a row of numbered dots under the header, each in the colours of its latest state
 * (as on the end screen), the current one ringed. A tap jumps to that exercise. The slots share the width (up to
 * 48 px each), so ten fit a 360 px phone; with more than fit, the row scrolls and keeps the current one in view.
 */
export default function ExerciseMap({ items, current, onJump, disabled = false }: Props) {
  const [width, setWidth] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const slot = width > 0 ? Math.max(MIN_SLOT, Math.min(MAX_SLOT, width / items.length)) : MIN_SLOT;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  useEffect(() => {
    if (width > 0 && slot * items.length > width) scroll.current?.scrollTo?.({ x: Math.max(0, (current + 0.5) * slot - width / 2), animated: true });
  }, [current, slot, width, items.length]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((it, i) => {
          const here = i === current;
          return (
            <Pressable
              key={it.id}
              testID={`map-${it.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Exercițiul ${i + 1}, ${it.chip}`}
              accessibilityState={{ selected: here, disabled }}
              aria-selected={here}
              disabled={disabled}
              onPress={() => {
                if (!here) onJump(i);
              }}
              style={[styles.slot, { width: slot }]}
            >
              <View style={[styles.dot, { backgroundColor: it.tone.bg, borderColor: it.tone.edge }, here && styles.here]}>
                <AppText role="label" style={{ color: it.tone.fg }}>
                  {i + 1}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View testID="map-legend" style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {LEGEND.map(([label, tone]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tone.bg, borderColor: tone.edge }]} />
            <AppText role="caption" color="textMuted">
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', marginTop: space[1] },
  row: { flexGrow: 1, justifyContent: 'center' },
  slot: { height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // The current exercise: a primary ring around the dot (its state colours stay inside).
  here: { borderWidth: 2.5, borderColor: color.primary, transform: [{ scale: 1.1 }] },
  // What the dot colours mean (each dot's own label already says it to screen readers).
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space[3], rowGap: space[1], marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  legendDot: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1.5 },
});
