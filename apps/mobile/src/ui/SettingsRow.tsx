import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, space } from '@prepio/shared';
import AppText from './AppText';
import { Icon } from './IconButton';

type Props = {
  label: string;
  /** A second line under the label (the plan, the balance): it wraps, so nothing is cut on a phone. */
  value?: string;
  /** After the label (e.g. a progress badge). */
  badge?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** Draws the hairline above it (every row but the first of a group). */
  divider?: boolean;
  /** Overrides the default „label · value”. */
  accessibilityLabel?: string;
};

/** One row of a settings list: label, optional value under it, chevron. Read as „label · value”. */
export default function SettingsRow({ label, value, badge, onPress, disabled, divider, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${label} · ${value}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <View style={styles.head}>
          <AppText role="bodyStrong">{label}</AppText>
          {badge}
        </View>
        {value ? (
          <AppText role="small" color="textMuted">
            {value}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" tint={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2.5], paddingHorizontal: space[4] },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.border },
  pressed: { backgroundColor: color.surfaceMuted },
  text: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
});
