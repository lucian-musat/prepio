import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, plural, space } from '@prepio/shared';
import { AppText, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import { CONTACT_EMAIL } from '../lib/legal';
import { fetchReferralPublicSettings, monthsText, type ReferralPublicSettings } from '../lib/referrals';
import { Item, Section, legalStyles } from './legal/LegalSection';

type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; settings: ReferralPublicSettings };

/** The programme's numbers as phrases; without the live settings they read "stabilit de Prepio" (never invented). */
function phrases(s: ReferralPublicSettings | null) {
  return {
    colleagues: s ? plural(s.threshold, 'coleg', 'colegi') : 'numărul de colegi stabilit de Prepio',
    credits: s ? plural(s.creditsPerInvitee, 'credit', 'credite') : 'numărul de credite stabilit de Prepio',
    duration: s ? monthsText(s.durationMonths) : 'perioada stabilită de Prepio',
    cap: s ? plural(s.maxRewarded, 'coleg', 'colegi') : 'numărul de colegi stabilit de Prepio',
  };
}

function Question({ q, children }: { q: string; children: string }) {
  return (
    <View style={styles.faq}>
      <AppText role="bodyStrong">{q}</AppText>
      <AppText role="body">{children}</AppText>
    </View>
  );
}

/**
 * „Cum funcționează recomandările”: public (reachable signed out), static explanation with the live numbers of the
 * programme. Without readable settings the numbers are replaced by "stabilit de Prepio"; the page never crashes.
 * Describes what the database does (migrations 20261112*); the copy is a draft for the owner's review.
 */
export default function ReferralsInfoScreen() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetchReferralPublicSettings()
      .then((settings) => live && setState({ status: 'ready', settings }))
      .catch((e: unknown) => {
        console.warn('[referrals] the explainer could not read the settings:', e);
        if (live) setState({ status: 'failed' });
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScreenLayout title="Cum funcționează recomandările" onBack={goBackOrHome}>
      {state.status === 'loading' ? (
        <View style={styles.center}>
          <Spinner accessibilityLabel="Se încarcă" />
        </View>
      ) : (
        <Page settings={state.status === 'ready' ? state.settings : null} />
      )}
    </ScreenLayout>
  );
}

function Page({ settings }: { settings: ReferralPublicSettings | null }) {
  const p = phrases(settings);
  const off = settings != null && !settings.enabled;
  const two = settings ? plural(2 * settings.creditsPerInvitee, 'credit', 'credite') : '';

  return (
    <View style={legalStyles.stack}>
      {off ? (
        <Surface>
          <AppText role="bodyStrong" accessibilityRole="alert">
            Recomandările nu sunt active acum.
          </AppText>
          <AppText role="small" color="textMuted">
            Poți citi regulile, dar acum nu se primesc recompense și codurile nu sunt acceptate.
          </AppText>
        </Surface>
      ) : null}

      <Section title="Pe scurt">
        <AppText role="body">
          Dai codul sau linkul tău unui coleg. Când acel coleg își cumpără abonament la Prepio, tu primești o recompensă.
        </AppText>
        <Item>{`Dacă nu ai abonament activ (ești în perioada de probă sau abonamentul a expirat): colegii care își iau abonament se adună. Când ai ${p.colleagues}, primești ${p.duration} de acces gratuit.`}</Item>
        <Item>{`Dacă ai abonament activ: primești ${p.credits} pentru fiecare coleg care își ia abonament, imediat.`}</Item>
      </Section>

      <Section title="Cine este un coleg care a plătit">
        <Item>Un coleg se numără când își cumpără accesul complet (abonamentul) pentru prima dată. Contează doar prima cumpărare; reînnoirile nu aduc nimic în plus.</Item>
        <Item>Accesul primit de la un administrator nu contează ca plată.</Item>
        <Item>Un coleg care și-a creat cont cu codul tău, dar nu a cumpărat nimic, nu aduce nicio recompensă (încă).</Item>
      </Section>

      <Section title="Dacă nu ai abonament activ (probă sau expirat)">
        <Item>{`Fiecare coleg care își ia abonament este numărat. Când ai ${p.colleagues}, primești ${p.duration} de acces gratuit.`}</Item>
        <Item>Accesul gratuit este la fel ca un abonament cumpărat: aceleași lecții, aceleași funcții. Singura diferență este că nu vine cu credite bonus.</Item>
        <Item>Colegii care așteaptă rămân numărați până sunt folosiți. Ei nu expiră, nici dacă îți expiră ție accesul.</Item>
        <Item>Un coleg este folosit o singură dată. După ce primești accesul gratuit, numărătoarea începe de la zero cu colegii noi.</Item>
        <Item>Primești cel mult o perioadă de acces gratuit pentru fiecare coleg care plătește. Dacă mai mulți colegi așteaptă decât este nevoie, ceilalți rămân la rând pentru data viitoare.</Item>
      </Section>

      <Section title="Dacă ai abonament activ">
        <Item>{`Primești ${p.credits} pentru fiecare coleg care își ia abonament, imediat ce plătește.`}</Item>
        <Item>Un abonament activ înseamnă orice acces care nu a expirat, cumpărat sau dat de un administrator.</Item>
        <Item>Contează momentul în care plătește colegul: dacă atunci ai acces activ, primești credite; dacă nu, colegul așteaptă.</Item>
      </Section>

      <Section title="Dacă îți cumperi tu abonament">
        <Item>{`Colegii care așteaptă la tine se transformă în credite: primești ${p.credits} pentru fiecare.`}</Item>
        <Item>Nu primești și acces gratuit pentru aceiași colegi: un coleg aduce fie acces gratuit, fie credite, niciodată amândouă.</Item>
        <Item>Accesul oferit de un administrator nu transformă colegii în credite; doar cumpărarea ta o face.</Item>
      </Section>

      <Section title="Exemple">
        {settings ? (
          <>
            <Question q="Ana nu are abonament">
              {`Ana este în perioada de probă și invită colegi. Pe rând, colegii ei își iau abonament, iar Prepio îi numără. Când ajung la ${p.colleagues}, Ana primește ${p.duration} de acces gratuit, fără credite bonus. Colegii următori se numără din nou de la zero.`}
            </Question>
            <Question q="Mihai are abonament">
              {`Mihai are abonament activ. Doi colegi de-ai lui își iau abonament. Mihai primește câte ${p.credits} pentru fiecare, adică 2 × ${p.credits} = ${two}, imediat.`}
            </Question>
            <Question q="Ioana își cumpără abonament">
              {`Ioana nu avea abonament, iar un coleg de-al ei își luase deja abonament și aștepta. Când Ioana își cumpără și ea abonament, colegul care aștepta se transformă în ${p.credits} pentru ea.`}
            </Question>
          </>
        ) : (
          <AppText role="body">Exemplele cu cifre apar când Prepio poate încărca valorile actuale. Încearcă din nou mai târziu.</AppText>
        )}
      </Section>

      <Section title="Cum se folosește codul">
        <Item>Codul sau linkul se folosesc doar la înregistrare, în aplicația Prepio. Nu poți introduce un cod după ce ai terminat înregistrarea.</Item>
        <Item>Contul trebuie să fie nou: creat în ultimele 24 de ore, cu înregistrarea neterminată (termeni, nume și mod de învățare), fără cumpărături și fără lecții începute.</Item>
        <Item>Contul celui care te invită trebuie să fie mai vechi decât al tău. Nu îți poți folosi propriul cod.</Item>
        <Item>Poți avea un singur invitator. O singură persoană te poate invita, iar alegerea nu se mai schimbă.</Item>
        <Item>Cât timp recomandările sunt oprite, codurile nu sunt acceptate.</Item>
      </Section>

      <Section title="Reguli importante">
        <Item>Nu pierzi recompensa dacă prietenul tău anulează abonamentul sau îi este returnat banii mai târziu: ce ai primit rămâne al tău.</Item>
        <Item>{`Poți primi recompense pentru cel mult ${p.cap} (limita se verifică la prima plată a fiecărui coleg). Un coleg care plătește după ce limita a fost atinsă apare în listă ca „Abonat, fără recompensă (limita a fost atinsă)”.`}</Item>
        <Item>Un coleg nu aduce recompensă de două ori.</Item>
        <Item>Valorile (colegi necesari, credite, durata accesului) se pot schimba. Ce ai primit deja nu se modifică; la recompensele următoare se aplică valorile din acel moment.</Item>
      </Section>

      <Section title="Ce vede cel care te-a invitat">
        <Item>Cel care te-a invitat vede prenumele și adresa de e-mail, și dacă ai cumpărat abonament sau nu. Nu vede altceva despre contul tău.</Item>
        <Item>Tu vezi doar prenumele celui care te-a invitat, când te înregistrezi.</Item>
        <Item>Dacă îți ștergi contul după ce ai cumpărat abonament, în lista celui care te-a invitat rămâne doar prenumele tău, marcat „cont șters”; adresa de e-mail este ștearsă. Dacă nu ai cumpărat nimic, dispari din listă.</Item>
      </Section>

      <Section title="Unde vezi recomandările">
        <Item>Ecranul „Invită colegi” (din pagina principală sau din Profil): codul tău, linkul, colegii invitați și cât mai ai până la accesul gratuit.</Item>
        <Item>Istoricul creditelor: creditele primite pentru recomandări apar cu prenumele colegului.</Item>
        <Item>Istoricul accesului: accesul gratuit primit pentru recomandări apare acolo.</Item>
        <Item>Nu trimitem notificări: vezi schimbările data viitoare când deschizi ecranul „Invită colegi”.</Item>
      </Section>

      <Section title="Dacă Prepio oprește recomandările">
        <Item>Cât timp sunt oprite, nu se mai primesc recompense și codurile noi nu sunt acceptate.</Item>
        <Item>Recompensele deja primite rămân. Istoricul tău rămâne vizibil.</Item>
        <Item>Un coleg care plătește cât timp recomandările sunt oprite nu este recompensat, nici dacă ele sunt pornite din nou mai târziu.</Item>
      </Section>

      <Section title="Întrebări frecvente">
        <Question q="Invitatul a plătit după ce mi-am cumpărat eu abonamentul">
          {`Cât timp ai acces activ în momentul în care plătește, primești ${p.credits} pentru el, imediat. Nu așteaptă și nu se adună spre acces gratuit.`}
        </Question>
        <Question q="Abonamentul meu a expirat">
          {`Colegii care plătesc cât timp nu ai acces activ se adună, iar la ${p.colleagues} primești ${p.duration} de acces gratuit. Colegii deja adunați nu dispar. Dacă îți cumperi un abonament nou, se transformă în credite.`}
        </Question>
        <Question q="Invitatul și-a șters contul">
          Dacă plătise deja, recompensa rămâne și el rămâne în lista ta, cu prenumele și mențiunea „cont șters”. Dacă nu plătise, dispare din listă.
        </Question>
        <Question q="Pot introduce codul după ce m-am înregistrat?">
          Nu. Codul se introduce doar la înregistrare. După aceea, nu se mai poate adăuga.
        </Question>
        <Question q="De ce nu apare invitatul în listă?">
          Un coleg apare în listă doar dacă și-a creat contul cu codul tău. Dacă a intrat fără cod, a introdus codul după înregistrare, are un cont mai vechi de 24 de ore sau recomandările erau oprite, nu este legat de tine. Un coleg care și-a șters contul înainte să plătească dispare din listă.
        </Question>
        <Question q="Se pierd recompensele dacă invitatul anulează?">
          Nu. Odată ce a plătit, recompensa rămâne.
        </Question>
      </Section>

      <Section title="Cui te adresezi">
        <AppText role="body">{`Pentru întrebări sau dacă ți se pare că ceva nu s-a calculat corect, scrie-ne la ${CONTACT_EMAIL}.`}</AppText>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginTop: space[12] },
  faq: { gap: space[1], borderBottomWidth: 1, borderBottomColor: color.border, paddingBottom: space[3] },
});
