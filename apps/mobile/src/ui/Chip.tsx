import { StyleSheet, View } from 'react-native';
import { radius, space } from '@prepio/shared';
import AppText from './AppText';

type Props = { label: string; fg: string; bg: string; size?: 'chip' | 'badge' };

// Prototype `.chip` is padded 5/10 and `.diff` 2/8 around a ~1.5 line-height; our roles have tighter
// line heights, so the vertical padding is one step larger to keep the same rendered height.
const pad = {
  chip: { paddingVertical: space[1.5], paddingHorizontal: space[2.5] },
  badge: { paddingVertical: space[1], paddingHorizontal: space[2] },
} as const;

/** Small rounded label: `chip` (prototype `.chip`) or the smaller `badge` (prototype `.diff`). */
export default function Chip({ label, fg, bg, size = 'chip' }: Props) {
  return (
    <View style={[styles.chip, pad[size], { backgroundColor: bg }]}>
      <AppText role={size} style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
});
