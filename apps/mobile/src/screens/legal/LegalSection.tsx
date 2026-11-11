import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText } from '../../ui';
import { CONTACT_EMAIL, OPERATOR_ADDRESS, OPERATOR_CUI, OPERATOR_NAME } from '../../lib/legal';

/** Shared building blocks of the public legal pages (privacy policy, terms of use). */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText role="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export function Item({ children }: { children: string }) {
  return (
    <View style={styles.item}>
      <AppText role="body" color="textMuted">
        •
      </AppText>
      <AppText role="body" style={styles.itemText}>
        {children}
      </AppText>
    </View>
  );
}

export function LegalLink({ href, children }: { href: Href; children: string }) {
  return (
    <AppText role="body" color="primaryStrong" accessibilityRole="link" onPress={() => router.push(href)} style={styles.link}>
      {children}
    </AppText>
  );
}

/** Who runs Prepio and how to reach them; the values are placeholders in `lib/legal.ts` until the owner fills them. */
export function OperatorDetails() {
  return (
    <>
      <Item>{`Denumire: ${OPERATOR_NAME}`}</Item>
      <Item>{`Cod de identificare fiscală (CUI): ${OPERATOR_CUI}`}</Item>
      <Item>{`Sediu: ${OPERATOR_ADDRESS}`}</Item>
      <Item>{`Email: ${CONTACT_EMAIL}`}</Item>
    </>
  );
}

export const legalStyles = StyleSheet.create({
  stack: { gap: space[5] },
});

const styles = StyleSheet.create({
  section: { gap: space[2] },
  item: { flexDirection: 'row', gap: space[2] },
  itemText: { flex: 1 },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
