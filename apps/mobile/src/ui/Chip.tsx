import { StyleSheet, View } from 'react-native';
import { radius, space } from '@prepio/shared';
import AppText from './AppText';

type Props = { label: string; fg: string; bg: string; size?: 'chip' | 'badge' };

// Prototype `.chip` is 27 px tall (5 px padding around the emoji line box) and `.diff` 19 px (2 px
// padding around an 11 px line). The chip role's 15 px line box + 6 px padding gives the same 27 px.
const pad = {
  chip: { paddingVertical: space[1.5], paddingHorizontal: space[2.5] },
  badge: { paddingVertical: space[1] / 2, paddingHorizontal: space[2] },
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
