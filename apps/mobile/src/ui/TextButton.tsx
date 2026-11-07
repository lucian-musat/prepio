import { Pressable, StyleSheet } from 'react-native';
import { layout, opacity } from '@prepio/shared';
import AppText from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** danger: a destructive choice (e.g. deleting the account). */
  tone?: 'primary' | 'danger';
};

/** Quiet text-only action (underlined link) for a secondary choice under the main buttons; 48 px touch target. */
export default function TextButton({ label, onPress, disabled = false, tone = 'primary' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.hit, (pressed || disabled) && styles.dim]}
    >
      <AppText role="label" color={tone} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: layout.minTouch, alignSelf: 'center', justifyContent: 'center' },
  dim: { opacity: opacity.disabled },
  label: { textAlign: 'center', textDecorationLine: 'underline' },
});
