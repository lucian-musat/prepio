import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, ScreenLayout, goBackOrHome } from '../ui';
import { CONTACT_EMAIL, POLICY_DATE } from '../lib/legal';

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

/** Public privacy policy (reachable signed out). Static text only: it never queries Supabase. */
export default function PrivacyScreen() {
  return (
    <ScreenLayout title="Politica de confidențialitate" onBack={goBackOrHome}>
      <View style={styles.stack}>
        <AppText role="lead" color="textMuted">
          {`Prepio este o aplicație de pregătire pentru BAC. Aici explicăm ce date folosim, de ce, cine le prelucrează și cum le poți șterge.`}
        </AppText>
        <AppText role="small" color="textMuted">
          {`Ultima actualizare: ${POLICY_DATE}.`}
        </AppText>

        <Section title="Ce date colectăm">
          <Item>Numele tău, așa cum îl introduci în aplicație sau cum apare în contul Google.</Item>
          <Item>Adresa ta de email, folosită pentru autentificare (cu cod trimis pe email sau cu contul Google).</Item>
          <Item>Numele din profilul Google, dacă intri cu Google.</Item>
        </Section>

        <Section title="De ce le folosim">
          <Item>Pentru a-ți crea și păstra contul și a te recunoaște la fiecare intrare.</Item>
          <Item>Mai târziu, pentru a-ți salva progresul în lecții.</Item>
        </Section>

        <Section title="Cine prelucrează datele">
          <Item>
            Supabase găzduiește baza de date și autentificarea, pe servere în Londra (Regatul Unit; Comisia Europeană
            recunoaște un nivel adecvat de protecție a datelor pentru Regatul Unit).
          </Item>
          <Item>Vercel găzduiește site-urile Prepio.</Item>
          <Item>
            OpenAI evaluează eseurile scrise în lecții: textul eseului tău este trimis către OpenAI pentru evaluare și
            poate fi prelucrat în afara UE (în SUA).
          </Item>
        </Section>

        <Section title="Cât timp păstrăm datele">
          <AppText role="body">
            Păstrăm datele contului până când îl ștergi. La ștergere, datele contului sunt șterse.
          </AppText>
        </Section>

        <Section title="Drepturile tale">
          <Item>Poți cere să vezi, să corectezi sau să ștergi datele tale.</Item>
          <Item>Îți poți șterge contul singur, urmând pașii din pagina de ștergere a contului.</Item>
          <AppText role="body" color="primaryStrong" accessibilityRole="link" onPress={() => router.push('/sterge-cont')} style={styles.link}>
            Cum îți ștergi contul
          </AppText>
          <Item>{`Pentru orice cerere, scrie-ne la ${CONTACT_EMAIL}.`}</Item>
        </Section>

        <Section title="Contact">
          <AppText role="body">{`Pentru întrebări despre datele tale: ${CONTACT_EMAIL}.`}</AppText>
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
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
