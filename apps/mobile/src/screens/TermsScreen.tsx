import { View } from 'react-native';
import { BAC_GRADE_NOTE } from '@prepio/shared';
import { AppText, ScreenLayout, goBackOrHome } from '../ui';
import { CONTACT_EMAIL, TERMS_DATE } from '../lib/legal';
import { Item, LegalLink, OperatorDetails, Section, legalStyles } from './legal/LegalSection';

/**
 * Public terms of use (reachable signed out). Static text only: it never queries Supabase.
 * Draft wording; the owner's lawyer reviews it before launch. A change of substance needs a new TERMS_VERSION.
 */
export default function TermsScreen() {
  return (
    <ScreenLayout title="Termeni de utilizare" onBack={goBackOrHome}>
      <View style={legalStyles.stack}>
        <AppText role="lead" color="textMuted">
          {`Acești termeni sunt regulile de folosire a aplicației Prepio. Când îți creezi contul, confirmi că i-ai citit și că îi accepți.`}
        </AppText>
        <AppText role="small" color="textMuted">
          {`Ultima actualizare: ${TERMS_DATE}.`}
        </AppText>

        <Section title="Cine suntem">
          <AppText role="body">Prepio este oferit de:</AppText>
          <OperatorDetails />
        </Section>

        <Section title="Ce este Prepio">
          <Item>Prepio este o aplicație de pregătire pentru examenul de bacalaureat, cu lecții, exerciții și subiecte de tip BAC.</Item>
          <Item>Poți folosi Prepio pe web și pe telefon.</Item>
          <Item>Prepio te ajută să înveți, dar nu înlocuiește școala, profesorii sau materialele oficiale ale examenului.</Item>
        </Section>

        <Section title="Cine poate folosi aplicația">
          <Item>Prepio este pentru elevii de liceu care au cel puțin 14 ani.</Item>
          <Item>
            Dacă ai sub 18 ani, ai nevoie de acordul părintelui sau al tutorelui ca să folosești Prepio și ca să cumperi
            credite sau acces complet.
          </Item>
          <Item>
            Când îți creezi contul, confirmi că ai cel puțin 14 ani și, dacă ai sub 18 ani, că ai acordul părintelui sau al
            tutorelui.
          </Item>
          <Item>
            {`Părintele sau tutorele poate cere oricând închiderea contului, la ${CONTACT_EMAIL}.`}
          </Item>
          <Item>
            Dacă aflăm că un cont aparține unei persoane sub 14 ani sau unui minor care folosește Prepio fără acordul
            părintelui, contul este șters. Pentru creditele sau accesul complet plătite și nefolosite, rambursăm suma
            plătită.
          </Item>
        </Section>

        <Section title="Contul tău">
          <Item>Intri în aplicație cu contul Google sau cu un cod trimis pe adresa ta de email.</Item>
          <Item>Un cont este pentru o singură persoană. Fiecare persoană are un singur cont.</Item>
          <Item>
            Dacă te-ai înregistrat cu codul de invitație al unui coleg, acel coleg vede prenumele și adresa ta de email în aplicația lui.
          </Item>
          <Item>
            Ai grijă de adresa de email și de contul Google cu care intri: cine are acces la ele poate intra și în contul
            tău Prepio.
          </Item>
        </Section>

        <Section title="Credite și acces">
          <Item>
            Creditele sunt unități din aplicație cu care plătești verificarea unor răspunsuri, de exemplu un eseu sau un
            subiect BAC. Când îți creezi contul, poți primi credite de bun venit.
          </Item>
          <Item>
            Accesul complet deschide toate lecțiile pentru o perioadă. Fără el, ai deschisă doar lecția gratuită.
          </Item>
          <Item>Dacă ai sub 18 ani, cumperi credite sau acces complet doar cu acordul părintelui sau al tutorelui.</Item>
          <Item>
            În acest moment nu încasăm plăți: pachetele de credite și accesul complet se obțin fără bani. Înainte să
            introducem plățile, vom afișa în aplicație prețurile și condițiile, inclusiv cele de rambursare.
          </Item>
        </Section>

        <Section title="Notele și verificările sunt orientative">
          <Item>
            Unele răspunsuri, cum sunt eseurile și subiectele BAC, sunt verificate automat, cu inteligență artificială
            (OpenAI), nu de un profesor. Detaliile sunt în politica de confidențialitate.
          </Item>
          <Item>{BAC_GRADE_NOTE}</Item>
          <Item>Verificarea automată poate greși. Folosește notele și comentariile ca ajutor la învățat.</Item>
          <Item>
            Notele din Prepio nu sunt note oficiale și nu îți influențează rezultatul la examenul de bacalaureat.
          </Item>
        </Section>

        <Section title="Folosire corectă">
          <Item>Nu îți împarți contul cu altcineva și nu folosești contul altei persoane.</Item>
          <Item>Nu folosești aplicația în mod abuziv și nu încerci să-i ocolești limitele sau protecțiile.</Item>
          <Item>Nu accesezi aplicația automat, cu roboți sau scripturi, și nu copiezi conținutul în masă.</Item>
          <Item>Nu trimiți texte ilegale, jignitoare sau care nu au legătură cu învățatul.</Item>
        </Section>

        <Section title="Conținutul">
          <Item>
            Lecțiile, exercițiile, explicațiile și celelalte materiale din Prepio aparțin operatorului, cu excepția celor
            preluate din alte surse, care sunt indicate ca atare.
          </Item>
          <Item>Le poți folosi doar pentru studiul tău personal. Nu le copia, nu le distribui și nu le vinde.</Item>
          <Item>Răspunsurile și eseurile tale rămân ale tale.</Item>
        </Section>

        <Section title="Suspendarea și ștergerea contului">
          <Item>
            Putem suspenda un cont care încalcă acești termeni. Cât timp contul e suspendat, nu poți folosi aplicația.
          </Item>
          <Item>
            Dacă un cont suspendat este șters, putem bloca crearea unui cont nou cu aceeași adresă de email.
          </Item>
          <Item>
            Îți poți șterge contul oricând, din Profil. La ștergere, datele contului sunt șterse, iar creditele și accesul
            rămase se pierd.
          </Item>
          <LegalLink href="/sterge-cont">Cum îți ștergi contul</LegalLink>
        </Section>

        <Section title="Răspundere">
          <Item>Ne străduim ca aplicația să funcționeze bine și conținutul să fie corect.</Item>
          <Item>Nu garantăm că aplicația va fi mereu disponibilă sau fără erori și nu garantăm un anumit rezultat la examen.</Item>
          <Item>Dacă găsești o greșeală în conținut, scrie-ne și o corectăm.</Item>
          <Item>Răspunderea noastră este limitată în măsura în care legea o permite.</Item>
        </Section>

        <Section title="Modificări">
          <Item>Putem schimba acești termeni. Când o facem, actualizăm data de mai sus.</Item>
          <Item>La următoarea intrare în aplicație îți cerem să accepți noua versiune înainte să continui.</Item>
          <Item>
            {`Dacă nu o accepți, nu mai poți folosi aplicația. Poți ieși din cont și ne poți cere ștergerea contului la ${CONTACT_EMAIL}.`}
          </Item>
        </Section>

        <Section title="Legea aplicabilă">
          <Item>Acești termeni sunt guvernați de legea română.</Item>
          <Item>{`Dacă apare o neînțelegere, încercăm mai întâi să o rezolvăm împreună: scrie-ne la ${CONTACT_EMAIL}.`}</Item>
          <Item>Dacă nu reușim, neînțelegerea se rezolvă de instanțele competente din România.</Item>
          <Item>Drepturile pe care ți le dă legea ca utilizator și consumator rămân valabile.</Item>
        </Section>

        <Section title="Contact">
          <AppText role="body">{`Pentru întrebări despre acești termeni: ${CONTACT_EMAIL}.`}</AppText>
          <AppText role="body">Cum folosim datele tale afli din politica de confidențialitate.</AppText>
          <LegalLink href="/confidentialitate">Politica de confidențialitate</LegalLink>
        </Section>
      </View>
    </ScreenLayout>
  );
}
