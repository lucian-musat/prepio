import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { border, color, layout, radius, space, stroke } from '@prepio/shared';
import { AppText, Icon } from '../ui';

/** The consent sentence: the checkbox's visible text and accessible name. */
export const AGE_TERMS_LABEL =
  'Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. ' +
  'Dacă am sub 18 ani, am acordul părintelui sau tutorelui pentru a folosi Prepio și pentru plăți.';

/** Screen-reader hint on a button disabled until the consent is checked. */
export const CONSENT_HINT = 'Bifează confirmarea de mai sus.';

const BOX = space[6]; // 24 px
const GLYPH = space[4]; // 16 px

const LINKS: Array<{ label: string; href: Href }> = [
  { label: 'Termenii de utilizare', href: '/termeni' },
  { label: 'Politica de confidențialitate', href: '/confidentialitate' },
];

type Props = { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean };

/**
 * The required 14+/parental consent/terms checkbox (Welcome and the terms gate). The checkbox row holds only the box and the plain
 * sentence (at least the 48 px touch target); the two pages are separate links below it, so screen readers reach
 * them on their own and a link is never inside the checkbox.
 */
export default function AgeTermsCheckbox({ checked, onChange, disabled = false }: Props) {
  return (
    <View style={styles.stack}>
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
          {AGE_TERMS_LABEL}
        </AppText>
      </Pressable>
      <View style={styles.links}>
        {LINKS.map(({ label, href }) => (
          <Pressable
            key={label}
            accessibilityRole="link"
            accessibilityLabel={label}
            onPress={() => router.push(href)}
            style={styles.linkHit}
          >
            <AppText role="small" color="primaryStrong" style={styles.link}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[1] },
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
  // Indented under the sentence (box + gap), wrapping on a narrow phone.
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], paddingLeft: BOX + space[3] },
  linkHit: { minHeight: layout.minTouch, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
});
