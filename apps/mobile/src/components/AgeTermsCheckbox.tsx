import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { border, color, layout, radius, space, stroke } from '@prepio/shared';
import { AppText, Icon } from '../ui';

/** The whole consent sentence: the checkbox's accessible name (the links are part of the visible text). */
export const AGE_TERMS_LABEL = 'Am cel puțin 16 ani și accept Termenii de utilizare și Politica de confidențialitate.';

const BOX = space[6]; // 24 px
const GLYPH = space[4]; // 16 px

type Props = { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean };

/**
 * The required 16+/terms checkbox (Welcome and the terms gate). The whole row toggles it (at least the 48 px touch
 * target); the two links inside the sentence open the public pages without toggling it.
 */
export default function AgeTermsCheckbox({ checked, onChange, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={AGE_TERMS_LABEL}
      accessibilityState={{ checked, disabled }}
      // react-native-web 0.21 ignores accessibilityState; the aria props reach the DOM.
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon name="check" size={GLYPH} stroke={stroke.iconBold} tint={color.onPrimary} /> : null}
      </View>
      <AppText role="small" style={styles.label}>
        {'Am cel puțin 16 ani și accept '}
        <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={() => router.push('/termeni')} style={styles.link}>
          Termenii de utilizare
        </AppText>
        {' și '}
        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={() => router.push('/confidentialitate')}
          style={styles.link}
        >
          Politica de confidențialitate
        </AppText>
        .
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: layout.minTouch, paddingVertical: space[1] },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radius.xs,
    borderWidth: border.thick,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { borderColor: color.primary, backgroundColor: color.primary },
  label: { flex: 1 },
  link: { textDecorationLine: 'underline' },
});
