import type { SeedTemplate } from './types';

/** Rich-text body in the card Markdown subset: „Pașii” as an ordered list, then an example and a warning callout. */
const body = (steps: string[], example: string, warning: string): string =>
  [
    '### Pașii',
    '',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    ':::exemplu',
    example,
    ':::',
    '',
    ':::atentie',
    warning,
    ':::',
  ].join('\n');

/**
 * Solution templates („Cum rezolv”), one per exercise type, adapted from the approved types mockup. The key is the
 * exercise type; seed exercises refer to templates by key, production matches them by title.
 */
export const TEMPLATES: SeedTemplate[] = [
  {
    key: 'short_answer',
    exerciseType: 'short_answer',
    title: 'Cum răspunzi la „Numiți / Precizați”',
    points: '2 puncte',
    body: body(
      [
        'Caută în sursa indicată (A sau B) exact termenul cerut.',
        'Scrie doar denumirea, fără explicații: la „Numiți” se punctează denumirea exactă.',
        'Păstrează forma din text (de exemplu, „Adunarea Națională”), cu majusculă dacă este un nume propriu.',
      ],
      'Cerința: Numiți orașul în care s-a întrunit, la 1 decembrie 1918, Adunarea Națională, precizat în sursa B.\n\n**Răspuns:** Alba Iulia.',
      'Nu adăuga informații din afara sursei: dacă scrii două variante și una este greșită, pierzi punctajul.',
    ),
  },
  {
    key: 'multi_answer',
    exerciseType: 'multi_answer',
    title: 'Cum răspunzi la „Menționați două…”',
    points: '2 × 3 puncte',
    body: body(
      [
        'Citește condiția: „atât în sursa A, cât și în sursa B” înseamnă că termenul trebuie să apară în ambele surse.',
        'Notează pe ciornă termenii din sursa A, apoi verifică-i în sursa B.',
        'Scrie fiecare răspuns separat, numerotat (1, 2).',
      ],
      'Cerința: Menționați două provincii unite cu România în 1918, precizate atât în sursa A, cât și în sursa B.\n\n**1.** Basarabia; **2.** Bucovina.',
      'Două formulări ale aceluiași lucru („Țara Românească” și „Valahia”) contează o singură dată.',
    ),
  },
  {
    key: 'source_info',
    exerciseType: 'source_info',
    title: 'Cum selectezi o informație din sursă',
    points: '2 puncte',
    body: body(
      [
        'Găsește cuvântul-cheie din cerință (de exemplu, „Alba Iulia”).',
        'Ia propoziția care spune ceva *despre* el, nu doar îl pomenește.',
        'Marchează informația completă, dar fără să adaugi propozițiile vecine.',
      ],
      'Cerința: Precizați, din sursa A, o informație referitoare la Adunarea de la Alba Iulia.\n\n**Răspuns:** „Adunarea Națională de la Alba Iulia a votat unirea Transilvaniei cu România”.',
      'O informație trunchiată („Adunarea Națională de la Alba Iulia a votat”) nu spune nimic: ia fragmentul până la capătul ideii.',
    ),
  },
  {
    key: 'source_letter',
    exerciseType: 'source_letter',
    title: 'Cum alegi sursa potrivită',
    points: '3 puncte',
    body: body(
      [
        'Reformulează afirmația din cerință cu cuvintele tale.',
        'Caută în fiecare sursă un fragment cu același sens, nu neapărat cu aceleași cuvinte.',
        'Scrie doar litera sursei.',
      ],
      'Afirmația: „regele a refuzat pacea impusă de Puterile Centrale”. Sursa B: „Regele Ferdinand nu a promulgat pacea” → **B**.',
      'Nu scrie fragmentul sau explicații: se cere doar litera.',
    ),
  },
  {
    key: 'cause_effect',
    exerciseType: 'cause_effect',
    title: 'Cum construiești o relație cauză-efect',
    points: '7 puncte: 2 + 2 informații, 3 relația',
    body: body(
      [
        'Caută conectorii din text: „deoarece”, „fiindcă”, „ca urmare”, „astfel”, „pentru a”, „ceea ce”.',
        'Partea de după „deoarece” este cauza; partea de după „ca urmare” sau „astfel” este efectul.',
        'Selectează **două informații** din aceeași sursă și precizează rolul fiecăreia.',
        'Formulează: „Cauza: …; efectul: …”.',
      ],
      'Sursa: „După revoluția bolșevică, Rusia a ieșit din război, iar România, rămasă izolată, a semnat armistițiul de la Focșani.”\n\n**Cauza:** „Rusia a ieșit din război”\n\n**Efectul:** „România, rămasă izolată, a semnat armistițiul de la Focșani”.',
      'Greșeala clasică este inversarea rolurilor. Întreabă-te: „Care s-a întâmplat din cauza celeilalte?”',
    ),
  },
  {
    key: 'facts',
    exerciseType: 'facts',
    title: 'Cum prezinți un fapt istoric',
    points: '2 × 3 puncte',
    body: body(
      [
        'Alege un fapt din perioada cerută (verifică anii!).',
        '**Prezentarea** nu este o simplă menționare: spune ce s-a întâmplat, când, cine a fost implicat și o consecință sau un detaliu.',
        'Scrie două-trei propoziții pentru fiecare fapt.',
      ],
      '„În 1866, România adoptă o constituție după modelul celei belgiene, care consacra separarea puterilor în stat și monarhia constituțională ereditară.”',
      '„Constituția din 1866”, scris singur, este doar o menționare și se punctează parțial.',
    ),
  },
  {
    key: 'comparison',
    exerciseType: 'comparison',
    title: 'Cum formulezi o asemănare sau o deosebire',
    points: '4 puncte',
    body: body(
      [
        'Identifică cele două acțiuni (sau documente) din perioada cerută.',
        'Pentru o asemănare, caută ce au în comun: scopul, participanții, rezultatul, tipul acțiunii. Pentru o deosebire, caută un criteriu la care diferă.',
        'Formulează o singură propoziție care le numește pe amândouă și spune explicit ce au în comun sau prin ce diferă.',
      ],
      '„Atât Adunarea electivă a Moldovei, cât și cea a Țării Românești l-au ales domn pe Alexandru Ioan Cuza, în ianuarie 1859.”',
      'Nu descrie acțiunile separat: asemănarea sau deosebirea trebuie spusă explicit („atât… cât și…”, „ambele”, „spre deosebire de…”).',
    ),
  },
  {
    key: 'viewpoint',
    exerciseType: 'viewpoint',
    title: 'Cum formulezi și susții un punct de vedere',
    points: '10 puncte: 4 punctul de vedere + 2 × 3 informațiile',
    body: body(
      [
        'Formulează o **apreciere**, nu o informație: „Consider că…”, „În opinia mea…”.',
        'Punctul de vedere trebuie să se refere exact la ce cere cerința (subiectul și perioada).',
        'Alege din sursă **două informații** care chiar îl susțin.',
      ],
      '„Consider că aducerea unui prinț străin a întărit statul român.” Susținut de: „punea capăt rivalităților dintre marile familii boierești”; „sporea prestigiul extern al statului”.',
      '„Carol a depus jurământul în 1866” este o informație, nu un punct de vedere.',
    ),
  },
  {
    key: 'argument',
    exerciseType: 'argument',
    title: 'Cum construiești un argument istoric',
    points: '4 puncte',
    body: body(
      [
        'Alege un fapt istoric relevant pentru afirmație (perioada, actorii).',
        'Prezintă faptul, nu doar îl numi.',
        'Leagă-l de afirmație printr-un **conector de cauzalitate** (deoarece, pentru că, întrucât).',
        'Încheie cu un **conector de concluzie** (așadar, prin urmare, în concluzie).',
      ],
      'Afirmația: „Românii au contribuit la realizarea Unirii Principatelor.”\n\n„Românii au contribuit la realizarea Unirii, deoarece în ianuarie 1859 adunările elective de la Iași și București l-au ales domn pe Alexandru Ioan Cuza, punând marile puteri în fața faptului împlinit. Așadar, afirmația este adevărată.”',
      'Fără conectori pierzi o parte din punctaj, chiar dacă faptul este corect.',
    ),
  },
  {
    key: 'essay',
    exerciseType: 'essay',
    title: 'Cum construiești eseul pe cerințe',
    points: '30 de puncte',
    body: body(
      [
        'Tratează fiecare cerință într-un paragraf separat, în ordinea dată.',
        'Respectă cronologia faptelor.',
        'Folosește limbajul istoric: termeni de epocă, date, nume.',
        'Evidențiază o relație cauză-efect.',
        'La „punct de vedere”: formulează-l și susține-l printr-un argument (fapt istoric și conectori).',
      ],
      'Paragraful 1: „În contextul crizei orientale, România proclamă independența la 9 mai 1877, deoarece Constituția otomană din 1876 îi încălca autonomia…”',
      'Încadrarea în limita de spațiu (aproximativ două pagini) se punctează: nu scrie prea puțin la o cerință.',
    ),
  },
];
