import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, goBackOrHome } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { CONTACT_EMAIL } from '../lib/legal';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText role="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Item({ children }: { children: string }) {
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

/**
 * Public explanation of account deletion (reachable signed out, as Google Play requires). The primary action
 * depends on the session: signed out → sign in; signed in → the profile, where the account is deleted.
 */
export default function DeleteAccountInfoScreen() {
  const { status } = useAuth();
  const signedOut = status === 'signedOut';
  const ready = status === 'ready';

  return (
    <ScreenLayout
      title="Ștergerea contului"
      onBack={goBackOrHome}
      actions={
        signedOut ? (
          <Button label="Intră în cont" onPress={() => router.push('/')} />
        ) : ready ? (
          <Button label="Mergi la profil" onPress={() => router.push('/profile')} />
        ) : (
          <Button label="Continuă" onPress={() => router.push('/')} />
        )
      }
    >
      <View style={styles.stack}>
        <AppText role="lead" color="textMuted">
          Poți să îți ștergi contul Prepio oricând. Ștergerea este definitivă: după ce contul este șters, nu mai poate fi recuperat.
        </AppText>

        <Section title="Ce se șterge">
          <Item>Numele și adresa de email din cont.</Item>
          <Item>Contul de autentificare, fie cel Google, fie cel cu cod trimis pe email.</Item>
          <Item>Celelalte date legate de cont.</Item>
        </Section>

        <Section title="Ce nu se șterge">
          <AppText role="body">Lecțiile și exercițiile sunt conținut public și rămân disponibile.</AppText>
        </Section>

        <Section title="Cum îl ștergi">
          {signedOut ? (
            <AppText role="body">După ce intri, mergi la Profil → Șterge contul.</AppText>
          ) : ready ? (
            <AppText role="body">Din Profil alegi Șterge contul și confirmi ștergerea.</AppText>
          ) : (
            <AppText role="body">După ce completezi numele, mergi la Profil → Șterge contul.</AppText>
          )}
          <AppText role="body">{`Sau scrie-ne la ${CONTACT_EMAIL}.`}</AppText>
        </Section>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
  section: { gap: space[2] },
  item: { flexDirection: 'row', gap: space[2] },
  itemText: { flex: 1 },
});
