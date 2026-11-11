import { View } from 'react-native';
import { AppText, ScreenLayout, goBackOrHome } from '../ui';
import { CONTACT_EMAIL, POLICY_DATE } from '../lib/legal';
import { Item, LegalLink, OperatorDetails, Section, legalStyles } from './legal/LegalSection';

/** Public privacy policy (reachable signed out). Static text only: it never queries Supabase. */
export default function PrivacyScreen() {
  return (
    <ScreenLayout title="Politica de confidențialitate" onBack={goBackOrHome}>
      <View style={legalStyles.stack}>
        <AppText role="lead" color="textMuted">
          {`Prepio este o aplicație de pregătire pentru BAC. Aici explicăm ce date folosim, de ce, cine le prelucrează și cum le poți șterge.`}
        </AppText>
        <AppText role="small" color="textMuted">
          {`Ultima actualizare: ${POLICY_DATE}.`}
        </AppText>

        <Section title="Cine răspunde de datele tale">
          <AppText role="body">Operatorul datelor tale, adică cel care decide cum sunt folosite, este:</AppText>
          <OperatorDetails />
        </Section>

        <Section title="Vârsta minimă">
          <Item>Prepio este pentru elevii de liceu care au cel puțin 14 ani.</Item>
          <Item>Dacă ai sub 18 ani, folosești Prepio cu acordul părintelui sau al tutorelui.</Item>
          <Item>
            {`Părintele sau tutorele poate cere oricând, la ${CONTACT_EMAIL}, informații despre datele contului sau ștergerea contului.`}
          </Item>
          <Item>Nu colectăm cu bună știință date de la persoane mai mici de 14 ani.</Item>
          <Item>Dacă aflăm că un cont aparține unei persoane sub 14 ani, contul este șters, împreună cu datele lui.</Item>
        </Section>

        <Section title="Ce date colectăm">
          <Item>Numele tău, așa cum îl introduci în aplicație sau cum apare în contul Google.</Item>
          <Item>Adresa ta de email, folosită pentru autentificare (cu cod trimis pe email sau cu contul Google).</Item>
          <Item>Numele din profilul Google, dacă intri cu Google.</Item>
          <Item>Creditele: soldul, cumpărările de pachete și istoricul verificărilor.</Item>
          <Item>Progresul tău în lecții și răspunsurile la exercițiile de consolidare.</Item>
          <Item>Lucrările BAC: răspunsurile, eseurile și notele primite.</Item>
          <Item>Accesul complet: perioadele și istoricul obținerii lui.</Item>
          <Item>
            Un istoric al activității tale în aplicație (de exemplu când ai deschis aplicația sau ai terminat o lecție),
            folosit pentru suport și pentru siguranța contului.
          </Item>
          <Item>
            Data la care ai confirmat că ai cel puțin 14 ani (și, dacă ai sub 18 ani, că ai acordul părintelui sau al
            tutorelui) și versiunea termenilor acceptată.
          </Item>
        </Section>

        <Section title="De ce le folosim">
          <Item>Pentru a-ți crea și păstra contul și a te recunoaște la fiecare intrare.</Item>
          <Item>Pentru a-ți salva progresul în lecții.</Item>
          <Item>
            Temeiul legal pentru cont, progres și verificări este contractul dintre noi, adică termenii de utilizare pe care
            îi accepți (art. 6 alin. (1) lit. b din GDPR).
          </Item>
          <Item>
            Pentru siguranța aplicației și pentru găsirea și repararea erorilor, temeiul legal este interesul nostru legitim
            (art. 6 alin. (1) lit. f din GDPR).
          </Item>
        </Section>

        <Section title="Cine prelucrează datele">
          <Item>
            Supabase găzduiește baza de date și autentificarea, pe servere în Londra (Regatul Unit; Comisia Europeană
            recunoaște un nivel adecvat de protecție a datelor pentru Regatul Unit).
          </Item>
          <Item>Vercel găzduiește site-urile Prepio.</Item>
          <Item>
            OpenAI verifică răspunsurile la exercițiile de consolidare și lucrările BAC, inclusiv eseurile: textul
            răspunsului tău este trimis către OpenAI pentru evaluare și poate fi prelucrat în afara UE (în SUA).
          </Item>
          <Item>
            Sentry ne ajută să aflăm de erorile din aplicație. Datele sunt stocate în UE. Sentry primește detaliile erorii,
            date despre dispozitiv sau browser și un identificator tehnic al contului, dar nu numele, adresa de email sau
            răspunsurile tale.
          </Item>
        </Section>

        <Section title="Cât timp păstrăm datele">
          <AppText role="body">
            Păstrăm datele contului până când îl ștergi. La ștergere, datele contului sunt șterse.
          </AppText>
          <AppText role="body">
            Păstrăm doar o amprentă ireversibilă a adresei de email, ca să știm că ai primit deja creditele de bun venit.
          </AppText>
          <AppText role="body">
            Dacă un cont este șters în timp ce e suspendat sau dacă un administrator blochează reînregistrarea, păstrăm o
            amprentă ireversibilă a adresei de email și motivul, ca să nu poată fi creat un cont nou.
          </AppText>
        </Section>

        <Section title="Drepturile tale">
          <Item>Poți cere să vezi, să corectezi sau să ștergi datele tale.</Item>
          <Item>Îți poți șterge contul singur, urmând pașii din pagina de ștergere a contului.</Item>
          <LegalLink href="/sterge-cont">Cum îți ștergi contul</LegalLink>
          <Item>{`Pentru orice cerere, scrie-ne la ${CONTACT_EMAIL}.`}</Item>
        </Section>

        <Section title="Contact">
          <AppText role="body">{`Pentru întrebări despre datele tale: ${CONTACT_EMAIL}.`}</AppText>
          <AppText role="body">Regulile de folosire a aplicației sunt în termenii de utilizare.</AppText>
          <LegalLink href="/termeni">Termeni de utilizare</LegalLink>
        </Section>
      </View>
    </ScreenLayout>
  );
}
