import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_TEMPLATE_TYPES,
  DEFAULT_ESSAY_STYLE,
  exerciseToRow,
  type BacBarem,
  type BacItem,
  type BacSection,
  type ConsolidationExercise,
  type Source,
  type SourceLabel,
} from '@prepio/shared';
import { check, toExercise } from './consolidation';
import type { SeedBacItem, SeedBacRule, SeedBacSource, SeedBacSubject, SeedConsolidation } from './types';

// ---------------------------------------------------------------- Istorie 2026 · Varianta 3

const SOURCE_I_A =
  'În 1858, cele șapte puteri au semnat Convenția de la Paris. [...] Era un document cu unele dispoziții foarte ' +
  'înaintate și altele retrograde. În problema unirii Moldovei cu Țara Românească - fundamentală pentru români - se ' +
  'alesese o cale de compromis. [...] Menținute sub suzeranitatea Porții [Imperiul Otoman] și sub „garanția colectivă” ' +
  'a puterilor, cele două țări urmau „să se administreze liber și în afara oricărei ingerințe a Înaltei Porți”, ' +
  'purtând denumirea de „Principatele Unite ale Moldovei și Țării Românești”, separația administrativ-politică fiind ' +
  'însă menținută mai departe. Fiecare Principat urma să fie condus de câte un domn și miniștrii săi, ultimii supuși ' +
  'responsabilității ministeriale. Puterea legislativă trebuia să fie exercitată colectiv de domn, Adunarea din țara ' +
  'respectivă și Comisia centrală nou instituită, comună Principatelor. Puterii judecătorești trebuia să i se asigure ' +
  'independența [...]. Domnul urma să fie ales în fiecare țară pe viață de către Adunarea electivă. Domn putea fi ' +
  'fiecare muntean sau moldovean, cu un venit de 3 000 de galbeni și având îndeplinite funcții publice timp de zece ' +
  'ani. [...] În ansamblu, Convenția de la Paris, deși nu acorda Unirea, apropia pe români de momentul realizării ' +
  'unificării celor două Principate.';

const SOURCE_I_B =
  'Începuturile domniei lui Al. I. Cuza au fost anevoioase fiindcă domnul era obligat să colaboreze cu două guverne, ' +
  'unul la Iași și celălalt la București. Abia la sfârșitul anului 1861, Imperiul Otoman a recunoscut unirea ' +
  'politico-administrativă a Moldovei cu Țara Românească pe timpul domniei lui Cuza [...].\n\n' +
  'Unirea, odată realizată, neînțelegerile politice au reapărut cu puteri sporite de însemnătatea problemelor de ' +
  'rezolvat, între care cea mai dificilă era, desigur, elaborarea Legii rurale [...]. O altă problemă a estompat ' +
  'temporar confruntarea în jurul Legii rurale: secularizarea averilor mănăstirești [...]. Prin legea din [...] 1863 ' +
  'au fost trecute în proprietatea statului „toate averile mănăstirești”. Ca urmare, aproximativ un sfert din ' +
  'teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care dispuneau autoritățile pentru ' +
  'viitoarea împroprietărire. Cu scopul de a elimina obstacolele din calea împroprietăririi, ca și a altor reforme, ' +
  'Cuza [...] a promulgat o nouă constituție (Statutul Dezvoltător), care întărea puterea domnului în detrimentul ' +
  'legislativului.';

const SOURCE_II =
  'Pentru a nu permite pătrunderea tătarilor în Transilvania, regele Ungariei, Ludovic de Anjou a hotărât să ' +
  'înființeze pe versantul estic al Carpaților o marcă, adică o formațiune politico-militară de apărare. În fruntea ' +
  'acestei formațiuni l-a numit pe Dragoș. [...]\n\n' +
  'Fondarea statului independent Moldova este legată de numele voievodului Bogdan. [...] Acesta [...] își arătase ' +
  'nesupunerea față de regele Ungariei, fapt pentru care fusese îndepărtat din demnitatea de voievod al Țării ' +
  'Maramureșului. Era vorba de fapt de o răscoală a unor români în frunte cu Bogdan care se răzvrătiseră împotriva ' +
  'dominației maghiare. [...] Răzvrătiții au fost nevoiți să treacă peste munți, la est de Carpați. [...] Bogdan, ' +
  'probabil cu susținerea românilor din Estul Carpaților, l-a îndepărtat pe Balc, urmașul lui Dragoș, de la putere, ' +
  'forțându-l să plece din Moldova. Ludovic I nu putea accepta ca Moldova să iasă de sub stăpânirea sa. În anul 1364 el ' +
  'a trimis o oaste împotriva lui Bogdan, care a fost înfrântă de acesta, astfel că Moldova ieșea de sub dominație ' +
  'ungară [...].\n\n' +
  'Moldova începe să participe activ în politica internațională în timpul lui Lațcu (1369-1375) [...] când a apărut ' +
  'pericolul reluării expansiunii maghiare în spațiul est-carpatic sub motivul „readucerii” populației de aici la [...] ' +
  'catolicism. Pentru a preîntâmpina acest pericol, Lațcu [...] a adresat papei Urban al V-lea rugămintea de a ' +
  'înființa o episcopie catolică în Moldova [...]. Astfel, Siretul, devenit de curând capitală a Moldovei, obținea și ' +
  'statutul de reședință episcopală. [...] Moldova continuă să se afirme în relațiile internaționale din Europa de Est ' +
  'și Sud-Est în timpul lui Petru I Mușat (1375-1391). [...] Evenimentul cel mai important în politica externă a lui ' +
  'Petru I Mușat a fost semnarea [...] Tratatului moldo-polon de la Lemberg (Liov). [...] Pentru Moldova, importanța ' +
  'politică a acestui tratat consta în faptul că Petru I Mușat își asigura astfel protecția Poloniei împotriva vechilor ' +
  'pretenții maghiare la pământurile est-carpatice. [...] Pentru consolidarea țării și recunoașterea ei internațională ' +
  '[...], Petru I Mușat a hotărât să înființeze o mitropolie ortodoxă.';

const a = (quote: string) => ({ source: 'i-a', quote });
const b = (quote: string) => ({ source: 'i-b', quote });
const ii = (quote: string) => ({ source: 'ii', quote });

/** The barem's closing remark for answers that may be quoted, mentioned or written in a sentence. */
const ANY_WORDING = 'Se punctează orice mod de redactare a răspunsului corect (prin precizare/menționare sau în enunț).';
const ANY_WORDING_QUOTE = 'Se punctează orice mod de redactare a răspunsului corect (prin citat din sursă/menționare sau în enunț).';
const CONNECTORS =
  'prin precizarea a două informații referitoare la acest fapt și prin utilizarea conectorilor care exprimă ' +
  'cauzalitatea (deoarece, pentru că etc.) și concluzia (așadar, astfel etc.)';

const SUBIECTUL_I: SeedBacItem[] = [
  {
    section: 1,
    points: 2,
    type: 'short_answer',
    prompt: 'Numiți noua constituție precizată în sursa B.',
    template: 'short_answer',
    sources: ['i-b'],
    accepted: ['Statutul Dezvoltător', 'Statutul Dezvoltător al Convenției de la Paris'],
    mistakes: [
      { answer: 'Convenția de la Paris', message: 'Convenția de la Paris apare în sursa A; sursa B numește noua constituție.' },
      { answer: 'Constituția din 1866', message: 'Sursa B se referă la constituția promulgată de Cuza, nu la cea din 1866.' },
    ],
    barem: { text: `2 puncte pentru răspunsul: Statutul Dezvoltător ${ANY_WORDING}`, steps: null },
  },
  {
    section: 1,
    points: 2,
    type: 'source_info',
    prompt: 'Precizați, din sursa A, o informație referitoare la domn.',
    template: 'source_info',
    sources: ['i-a'],
    count: 1,
    spans: [
      a('Fiecare Principat urma să fie condus de câte un domn și miniștrii săi'),
      a('Puterea legislativă trebuia să fie exercitată colectiv de domn'),
      a('Domnul urma să fie ales în fiecare țară pe viață de către Adunarea electivă'),
      a('Domn putea fi fiecare muntean sau moldovean'),
    ],
    barem: {
      text:
        '2 puncte pentru oricare dintre răspunsurile: Fiecare Principat urma să fie condus de câte un domn și miniștrii ' +
        'săi; Puterea legislativă trebuia să fie exercitată colectiv de domn, Adunarea din țara respectivă și Comisia ' +
        'centrală; Domnul urma să fie ales în fiecare țară pe viață de către Adunarea electivă; Domn putea fi fiecare ' +
        `muntean sau moldovean, cu un venit de 3 000 de galbeni etc. ${ANY_WORDING_QUOTE}`,
      steps: null,
    },
  },
  {
    section: 1,
    points: 6,
    type: 'multi_answer',
    prompt: 'Menționați două spații istorice, precizate atât în sursa A, cât și în sursa B.',
    template: 'multi_answer',
    sources: ['i-a', 'i-b'],
    count: 2,
    groups: [
      ['Moldova', 'Principatul Moldovei'],
      ['Țara Românească', 'Valahia', 'Muntenia', 'Principatul Țării Românești'],
    ],
    barem: { text: `câte 3 puncte pentru fiecare dintre răspunsurile: Moldova, Țara Românească ${ANY_WORDING} (3px2=6p)`, steps: [0, 3, 6] },
  },
  {
    section: 1,
    points: 3,
    type: 'source_letter',
    prompt: 'Scrieți litera corespunzătoare sursei care susține că puterile ajung la un compromis în problema unirii românilor.',
    template: 'source_letter',
    sources: ['i-a', 'i-b'],
    correct: 'A',
    evidence: a('În problema unirii Moldovei cu Țara Românească - fundamentală pentru români - se alesese o cale de compromis'),
    barem: { text: '3 puncte pentru scrierea literei A', steps: [0, 3] },
  },
  {
    section: 1,
    points: 7,
    type: 'cause_effect',
    prompt:
      'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa B, precizând rolul fiecăreia ' +
      'dintre aceste informații (cauză, respectiv efect).',
    template: 'cause_effect',
    sources: ['i-b'],
    pairs: [
      {
        cause: b('Prin legea din [...] 1863 au fost trecute în proprietatea statului „toate averile mănăstirești”'),
        effect: b('a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire'),
        explanation: '„Ca urmare” și „ceea ce” leagă secularizarea de suprafața mărită pentru împroprietărire.',
      },
      {
        cause: b('Prin legea din [...] 1863 au fost trecute în proprietatea statului „toate averile mănăstirești”'),
        effect: b('aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului'),
        explanation: '„Ca urmare” introduce efectul secularizării averilor mănăstirești.',
      },
      {
        cause: b('aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului'),
        effect: b('a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire'),
        explanation: '„Ceea ce” arată efectul trecerii pământurilor mănăstirești în patrimoniul statului.',
      },
      {
        cause: b('Cu scopul de a elimina obstacolele din calea împroprietăririi, ca și a altor reforme'),
        effect: b('Cuza [...] a promulgat o nouă constituție (Statutul Dezvoltător)'),
        explanation: '„Cu scopul de a” arată motivul pentru care Cuza a promulgat Statutul Dezvoltător.',
      },
      {
        cause: b('domnul era obligat să colaboreze cu două guverne, unul la Iași și celălalt la București'),
        effect: b('Începuturile domniei lui Al. I. Cuza au fost anevoioase'),
        explanation: '„Fiindcă” introduce cauza: cele două guverne au făcut anevoioase începuturile domniei.',
      },
    ],
    barem: {
      text:
        '7 puncte pentru scrierea oricărei relații cauză-efect stabilite între două informații selectate din sursa B, ' +
        'precizând rolul fiecăreia dintre aceste informații (cauză, respectiv efect). Exemple: cauză: Prin legea din ' +
        '[...] 1863 au fost trecute în proprietatea statului „toate averile mănăstirești” și efect: Ca urmare, ' +
        'aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care ' +
        'dispuneau autoritățile pentru viitoarea împroprietărire SAU cauză: Cu scopul de a elimina obstacolele din calea ' +
        'împroprietăririi, ca și a altor reforme și efect: Cuza [...] a promulgat o nouă constituție (Statutul ' +
        'Dezvoltător) SAU cauză: domnul era obligat să colaboreze cu două guverne, unul la Iași și celălalt la ' +
        'București și efect: Începuturile domniei lui Al. I. Cuza au fost anevoioase etc.',
      steps: [0, 7],
    },
  },
  {
    section: 1,
    points: 6,
    type: 'facts',
    prompt: 'Prezentați două fapte istorice din perioada 1866-1886 referitoare la România.',
    template: 'facts',
    sources: [],
    count: 2,
    barem: {
      text:
        'câte 1 punct pentru menționarea oricăror două fapte istorice din perioada 1866-1886 referitoare la România ' +
        '(1px2=2p) Exemple: aducerea pe tron a lui Carol I (1866), adoptarea Constituției din 1866, proclamarea ' +
        'independenței (9 mai 1877), participarea la Războiul ruso-româno-turc (1877-1878), Congresul de pace de la ' +
        'Berlin (1878), revizuirea articolului 7 al Constituției (1879), proclamarea Regatului României (1881), aderarea ' +
        'la Tripla Alianță (1883) etc. câte 2 puncte pentru prezentarea fiecărui fapt istoric menționat - o scurtă ' +
        'expunere în care sunt precizate două informații referitoare la faptul istoric (2px2=4p)',
      steps: null,
    },
  },
  {
    section: 1,
    points: 4,
    type: 'comparison',
    prompt: 'Menționați o asemănare între două acțiuni desfășurate de România în relațiile internaționale din perioada 1917-1920.',
    template: 'comparison',
    sources: [],
    variant: 'similarity',
    barem: {
      text:
        '4 puncte pentru menționarea oricărei asemănări între două acțiuni desfășurate de România în relațiile ' +
        'internaționale din perioada 1917-1920 (de exemplu: semnarea tratatelor de pace de la Saint-Germain (1919) și ' +
        'de la Trianon (1920), participarea la Conferința de Pace de la Paris și semnarea tratatului de la Paris privind ' +
        'Basarabia (1920) etc.) Exemple: au caracter diplomatic; sunt tratate semnate în cadrul Conferinței de Pace de ' +
        'la Paris; recunosc pe plan internațional unirea unor provincii cu România etc. Se punctează exclusiv ' +
        'menționarea asemănării (nu se iau în considerare alte informații). Punctajul se acordă pentru orice mod de ' +
        'redactare a răspunsului corect (prin precizare/menționare sau în enunț).',
      steps: [0, 4],
    },
  },
];

const SUBIECTUL_II: SeedBacItem[] = [
  {
    section: 2,
    points: 2,
    type: 'short_answer',
    prompt: 'Numiți capitala Moldovei, precizată în sursa dată.',
    template: 'short_answer',
    sources: ['ii'],
    accepted: ['Siret', 'Siretul', 'orașul Siret'],
    mistakes: [{ answer: 'Suceava', message: 'Sursa dată numește altă capitală a Moldovei.' }],
    barem: { text: `2 puncte pentru răspunsul: Siret/Siretul ${ANY_WORDING}`, steps: null },
  },
  {
    section: 2,
    points: 2,
    type: 'short_answer',
    prompt: 'Precizați secolul la care se referă sursa dată.',
    template: 'short_answer',
    sources: ['ii'],
    accepted: ['al XIV-lea', 'secolul al XIV-lea', 'XIV', '14'],
    mistakes: [],
    barem: { text: `2 puncte pentru răspunsul: al XIV-lea ${ANY_WORDING}`, steps: null },
  },
  {
    section: 2,
    points: 6,
    type: 'multi_answer',
    prompt:
      'Menționați conducătorul răscoalei din Țara Maramureșului și o acțiune desfășurată de acesta în Moldova, la care ' +
      'se referă sursa dată.',
    template: 'multi_answer',
    sources: ['ii'],
    count: 2,
    groups: [
      ['Bogdan', 'voievodul Bogdan', 'Bogdan I'],
      [
        'l-a îndepărtat pe Balc',
        'l-a îndepărtat pe Balc de la putere',
        'l-a îndepărtat pe Balc, urmașul lui Dragoș, de la putere',
        'l-a îndepărtat pe Balc, urmașul lui Dragoș, de la putere, forțându-l să plece din Moldova',
        'l-a alungat pe Balc',
        'l-a alungat pe Balc din Moldova',
        'l-a forțat pe Balc să plece din Moldova',
        'îndepărtarea lui Balc',
        'îndepărtarea lui Balc de la putere',
        'a înfrânt oastea trimisă de Ludovic I',
        'a înfrânt oastea lui Ludovic I',
        'a înfrânt oastea regelui Ungariei',
        'a învins oastea trimisă de Ludovic I',
        'a învins oastea lui Ludovic I',
        'a învins oastea regelui Ungariei',
        'a înfrânt oastea maghiară',
        'a învins oastea maghiară',
        'înfrângerea oastei lui Ludovic I',
        'înfrângerea oastei maghiare',
      ],
    ],
    barem: {
      text:
        '3 puncte pentru răspunsul: Bogdan 3 puncte pentru menționarea oricărei acțiuni desfășurate de acesta în ' +
        'Moldova, precizate în sursa dată Exemple: l-a îndepărtat pe Balc, urmașul lui Dragoș, de la putere, forțându-l ' +
        `să plece din Moldova; a înfrânt oastea trimisă de Ludovic I împotriva sa (1364) etc. ${ANY_WORDING_QUOTE}`,
      steps: [0, 3, 6],
    },
  },
  {
    section: 2,
    points: 6,
    type: 'source_info',
    prompt: 'Menționați, din sursa dată, două informații referitoare la marcă.',
    template: 'source_info',
    sources: ['ii'],
    count: 2,
    spans: [
      ii('Pentru a nu permite pătrunderea tătarilor în Transilvania'),
      ii('a hotărât să înființeze pe versantul estic al Carpaților o marcă'),
      ii('o formațiune politico-militară de apărare'),
      ii('În fruntea acestei formațiuni l-a numit pe Dragoș'),
    ],
    barem: {
      text:
        'câte 3 puncte pentru menționarea, din sursa dată, a oricăror două informații referitoare la marcă (3px2=6p) ' +
        'Exemple: este înființată pentru a nu permite pătrunderea tătarilor în Transilvania; este înființată de regele ' +
        'Ungariei, Ludovic de Anjou, pe versantul estic al Carpaților; este o formațiune politico-militară de apărare; în ' +
        `fruntea acestei formațiuni l-a numit pe Dragoș etc. ${ANY_WORDING_QUOTE}`,
      steps: [0, 3, 6],
    },
  },
  {
    section: 2,
    points: 10,
    type: 'viewpoint',
    prompt:
      'Formulați, pe baza sursei date, un punct de vedere referitor la acțiunile conducătorilor Moldovei, în perioada ' +
      '1369-1391, susținându-l cu două informații selectate din sursă.',
    template: 'viewpoint',
    sources: ['ii'],
    count: 2,
    spans: [
      ii('Moldova începe să participe activ în politica internațională în timpul lui Lațcu (1369-1375)'),
      ii('Lațcu [...] a adresat papei Urban al V-lea rugămintea de a înființa o episcopie catolică în Moldova'),
      ii('Siretul, devenit de curând capitală a Moldovei, obținea și statutul de reședință episcopală'),
      ii('Moldova continuă să se afirme în relațiile internaționale din Europa de Est și Sud-Est în timpul lui Petru I Mușat (1375-1391)'),
      ii('Evenimentul cel mai important în politica externă a lui Petru I Mușat a fost semnarea [...] Tratatului moldo-polon de la Lemberg (Liov)'),
      ii('Petru I Mușat își asigura astfel protecția Poloniei împotriva vechilor pretenții maghiare la pământurile est-carpatice'),
      ii('Petru I Mușat a hotărât să înființeze o mitropolie ortodoxă'),
    ],
    barem: {
      text:
        '4 puncte pentru formularea, pe baza sursei date, a oricărui punct de vedere referitor la acțiunile ' +
        'conducătorilor Moldovei, în perioada 1369-1391 câte 3 puncte pentru selectarea, din sursa dată, a oricăror ' +
        'două informații care susțin punctul de vedere formulat (3px2=6p) Exemple: Acțiunile conducătorilor Moldovei, ' +
        'în perioada 1369-1391, contribuie la afirmarea internațională a țării. Informațiile care susțin punctul de ' +
        'vedere sunt: Lațcu [...] a adresat papei Urban al V-lea rugămintea de a înființa o episcopie catolică în ' +
        'Moldova și Evenimentul cel mai important în politica externă a lui Petru I Mușat a fost semnarea [...] ' +
        'Tratatului moldo-polon de la Lemberg (Liov). SAU Acțiunile conducătorilor Moldovei, în perioada 1369-1391, ' +
        'urmăresc apărarea țării față de pretențiile maghiare. Informațiile care susțin punctul de vedere sunt: Pentru a ' +
        'preîntâmpina acest pericol, Lațcu [...] a adresat papei Urban al V-lea rugămintea de a înființa o episcopie ' +
        'catolică în Moldova și Petru I Mușat își asigura astfel protecția Poloniei împotriva vechilor pretenții maghiare ' +
        'la pământurile est-carpatice etc. Punctajul total (10 puncte) sau cel parțial (7 puncte) se acordă răspunsului ' +
        'format din punctul de vedere și din cele două informații/o informație selectate/selectată din sursă. Nu se ' +
        'punctează doar punctul de vedere sau doar informațiile/informația.',
      steps: [0, 7, 10],
    },
  },
  {
    section: 2,
    points: 4,
    type: 'argument',
    prompt:
      'Argumentați, printr-un fapt istoric relevant, afirmația conform căreia în secolul al XV-lea românii participă la ' +
      'acțiuni militare cu caracter antiotoman. (Se punctează prezentarea unui fapt istoric relevant și utilizarea ' +
      'conectorilor care exprimă cauzalitatea și concluzia.)',
    template: 'argument',
    sources: [],
    barem: {
      text:
        '4 puncte pentru argumentarea afirmației date - prezentarea oricărui fapt istoric relevant (de exemplu: ' +
        'participarea lui Iancu de Hunedoara la cruciada de la Varna (1444), apărarea Belgradului de către Iancu de ' +
        'Hunedoara (1456), atacul de noapte al lui Vlad Țepeș împotriva oastei lui Mahomed al II-lea (1462), victoria ' +
        `lui Ștefan cel Mare de la Vaslui (1475) etc.) ${CONNECTORS}`,
      steps: [0, 4],
    },
  },
];

const ESSAY_ARGUMENT =
  'prezentarea oricărui fapt istoric relevant, prin precizarea a două informații referitoare la acest fapt și ' +
  'utilizarea conectorilor care exprimă cauzalitatea (deoarece, pentru că etc.) și concluzia (așadar, astfel etc.)';

const ESSAY_RULES: Record<string, SeedBacRule> = {
  r1: {
    points: 5,
    steps: [0, 1, 2, 3, 5],
    text:
      '2 puncte pentru precizarea constituției României adoptate în etapa stalinismului (de exemplu: Constituția din ' +
      '1948, Constituția din 1952 etc.) 3 puncte pentru prezentarea constituției precizate - o scurtă expunere în care ' +
      'sunt precizate două informații referitoare la aceasta și se utilizează relația cauză-efect (de exemplu: ' +
      'Constituția din 1952 este elaborată după modelul constituției sovietice din 1936, consfințește rolul conducător ' +
      'al Partidului Muncitoresc Român, înființează Regiunea Autonomă Maghiară; Constituția din 1948 consfințește ' +
      'Republica Populară Română, proclamată după abdicarea regelui Mihai I, și stabilește Marea Adunare Națională ca ' +
      'organ suprem al puterii de stat etc.) 1 punct pentru precizarea doar a unei informații referitoare la ' +
      'constituția precizată',
  },
  r2: {
    points: 6,
    steps: [0, 3, 6],
    text:
      'câte 3 puncte pentru menționarea oricăror două acțiuni politice desfășurate de România în relațiile ' +
      'internaționale din perioada 1955-1969 (de exemplu: aderarea la Organizația Tratatului de la Varșovia (1955), ' +
      'admiterea în ONU (1955), retragerea trupelor sovietice din România (1958), Declarația din aprilie 1964, ' +
      'stabilirea relațiilor diplomatice cu R.F. Germania (1967), menținerea relațiilor diplomatice cu Israelul după ' +
      'Războiul de Șase Zile (1967), condamnarea invadării Cehoslovaciei (1968), vizita președintelui S.U.A. Richard ' +
      'Nixon la București (1969) etc.) (3px2=6p)',
  },
  r3: {
    points: 7,
    steps: [0, 1, 3, 4, 6, 7],
    text:
      '1 punct pentru precizarea oricărei practici politice utilizate în România, în perioada 1970-1988 (de exemplu: ' +
      'cultul personalității, „revoluția culturală” inițiată prin Tezele din iulie 1971, cumulul de funcții, rotația ' +
      'cadrelor, sistematizarea teritorială, cenzura, controlul exercitat de Securitate etc.) câte 3 puncte pentru ' +
      'menționarea oricăror două aspecte referitoare la aceasta (de exemplu: glorificarea lui Nicolae Ceaușescu în ' +
      'presă, artă și manifestări de masă, festivalul național „Cântarea României”, crearea funcției de președinte al ' +
      'Republicii (1974), promovarea Elenei Ceaușescu și a membrilor familiei în funcții de conducere etc.) (3px2=6p)',
  },
  r4: {
    points: 6,
    steps: [0, 2, 4, 6],
    text:
      '2 puncte pentru formularea oricărui punct de vedere referitor la democrația din România în perioada 1990-1997 ' +
      '(de exemplu: În perioada 1990-1997, în România se refac instituțiile statului democratic., Democrația din ' +
      'România se consolidează în perioada 1990-1997. etc.) 4 puncte pentru susținerea punctului de vedere formulat ' +
      `printr-un argument istoric – ${ESSAY_ARGUMENT} (de exemplu: alegerile libere din 20 mai 1990, adoptarea ` +
      'Constituției din 1991, aprobată prin referendum la 8 decembrie 1991, alternanța la guvernare după alegerile din ' +
      '1996 etc.)',
  },
};

const SUBIECTUL_III: SeedBacItem[] = [
  {
    section: 3,
    points: 30,
    type: 'essay',
    prompt:
      'Elaborați, în aproximativ două pagini, un eseu despre evoluția politică a României în a doua jumătate a ' +
      'secolului al XX-lea, având în vedere:',
    template: 'essay',
    sources: [],
    requirements: [
      {
        id: 'r1',
        text: 'prezentarea constituției României adoptate în etapa stalinismului, în a doua jumătate a secolului al XX-lea;',
        modelAnswer: null,
        template: 'facts',
        argument: false,
      },
      {
        id: 'r2',
        text: 'menționarea a două acțiuni politice desfășurate de România în relațiile internaționale din perioada 1955-1969;',
        modelAnswer: null,
        template: 'facts',
        argument: false,
      },
      {
        id: 'r3',
        text:
          'precizarea unei practici politice utilizate în România, în perioada 1970-1988 și menționarea a două aspecte ' +
          'referitoare la aceasta;',
        modelAnswer: null,
        template: 'facts',
        argument: false,
      },
      {
        id: 'r4',
        text:
          'formularea unui punct de vedere referitor la democrația din România în perioada 1990-1997 și susținerea ' +
          'acestuia printr-un argument istoric.',
        modelAnswer: null,
        template: 'argument',
        argument: true,
      },
    ],
    barem: {
      text:
        'Informația istorică – 24 de puncte, distribuite pe cerințe (5 + 6 + 7 + 6). Ordonarea și exprimarea ideilor ' +
        'menționate – 6 puncte distribuite astfel: 2 puncte pentru utilizarea limbajului istoric adecvat (1 punct pentru ' +
        'utilizarea parțială a limbajului istoric adecvat); 1 punct pentru structurarea eseului (introducere - cuprins - ' +
        'concluzie); 2 puncte pentru respectarea succesiunii cronologice/logice a faptelor istorice (1 punct pentru ' +
        'respectarea parțială a succesiunii cronologice/logice a faptelor istorice); 1 punct pentru respectarea limitei ' +
        'de spațiu.',
      steps: null,
      requirements: ESSAY_RULES,
    },
  },
];

const SOURCES_2026_V3: SeedBacSource[] = [
  { key: 'i-a', section: 1, title: null, author: 'D. Berindei', work: 'Istoria românilor', body: SOURCE_I_A },
  { key: 'i-b', section: 1, title: null, author: 'F. Constantiniu', work: 'O istorie sinceră a poporului român', body: SOURCE_I_B },
  { key: 'ii', section: 2, title: null, author: 'I. Țurcanu', work: 'Istoria românilor', body: SOURCE_II },
];

/** Transcribed from `E_c_istorie_2026_var_03_LRO`; the barem is written in the style of the official 2025 barem. */
export const ISTORIE_2026_V3: SeedBacSubject = {
  title: 'Istorie 2026 · Varianta 3',
  year: 2026,
  variant: 'Varianta 3',
  creditCost: 10,
  published: true,
  sources: SOURCES_2026_V3,
  items: [...SUBIECTUL_I, ...SUBIECTUL_II, ...SUBIECTUL_III],
};

export const BAC_SUBJECTS: SeedBacSubject[] = [ISTORIE_2026_V3];

// ---------------------------------------------------------------- conversion and writing

export type BacSeedSource = Source & { section: BacSection };
export type ConvertedBacSubject = { sources: BacSeedSource[]; items: Array<{ item: BacItem; barem: BacBarem }> };

const LETTERS: SourceLabel[] = ['A', 'B'];
/** BAC items carry no AI context: `toExercise` still needs an AI template per type, its result is discarded. */
const NO_AI_TEMPLATES = new Map(AI_TEMPLATE_TYPES.map((t) => [t, t]));

/**
 * Turns a seed subject into the shared model: source keys become ids, quotes become offsets (via `toExercise`), item
 * source links are labelled with the source's letter within its section (A = first, B = second), items are numbered
 * within their section, template keys become ids. Throws on an unknown key, a quote not in its source, a source of
 * another section or a section with more than two sources.
 */
export function toBacSubject(subject: SeedBacSubject, templateIds: Map<string, string>, newId: () => string): ConvertedBacSubject {
  const fail = (msg: string): never => {
    throw new Error(`BAC subject „${subject.title}”: ${msg}`);
  };
  const positions = new Map<number, number>();
  const sources: BacSeedSource[] = subject.sources.map((s) => {
    const position = positions.get(s.section) ?? 0;
    positions.set(s.section, position + 1);
    if (position >= LETTERS.length) fail(`section ${s.section} has more than ${LETTERS.length} sources`);
    return { id: newId(), position, section: s.section, title: s.title, author: s.author, work: s.work, body: s.body };
  });
  const byKey = new Map(subject.sources.map((s, i) => [s.key, sources[i]!]));
  const sourceIds = new Map([...byKey].map(([k, s]) => [k, s.id]));
  const bodies = new Map(subject.sources.map((s) => [s.key, s.body]));

  const numbers = new Map<number, number>();
  const items = subject.items.map((seedItem) => {
    const number = (numbers.get(seedItem.section) ?? 0) + 1;
    numbers.set(seedItem.section, number);
    const where = `${seedItem.section}.${number}`;
    const { section, points, barem: seedBarem, ...rest } = seedItem;
    for (const key of rest.sources) {
      const s = byKey.get(key) ?? fail(`item ${where}: unknown source „${key}”`);
      if (s.section !== section) fail(`item ${where}: source „${key}” is not in section ${section}`);
    }
    const { exercise } = toExercise(rest as SeedConsolidation, sourceIds, bodies, templateIds, NO_AI_TEMPLATES, newId);
    const refs = exercise.sources
      .map((r) => ({ sourceId: r.sourceId, label: LETTERS[sources.find((s) => s.id === r.sourceId)!.position]! }))
      .sort((x, y) => x.label.localeCompare(y.label));
    const item: BacItem = { ...(exercise as ConsolidationExercise), sources: refs, section, number, points };

    const barem: BacBarem = { text: seedBarem.text, points, steps: seedBarem.steps, essay: null };
    if (item.type === 'essay') {
      const requirements = Object.fromEntries(
        item.requirements.map((r) => {
          const rule = seedBarem.requirements?.[r.id] ?? fail(`item ${where}: no barem for requirement „${r.id}”`);
          return [r.id, { text: rule.text, points: rule.points, steps: rule.steps }];
        }),
      );
      barem.essay = { requirements, style: { ...DEFAULT_ESSAY_STYLE } };
    }
    return { item, barem };
  });
  return { sources, items };
}

/**
 * Inserts every seed subject whose title is not in `bac_subjects` yet (idempotent by title: an existing subject, with
 * its students' attempts, is never touched). Every subject is converted (and so checked) before anything is written.
 * When a write fails, the subject inserted by this call is deleted again and the error rethrown. Returns how many
 * subjects were inserted.
 */
export async function writeBacSubjects(
  client: SupabaseClient,
  templateIds: Map<string, string>,
  newId: () => string,
  subjects: SeedBacSubject[] = BAC_SUBJECTS,
): Promise<number> {
  const existing = check(
    await client.from('bac_subjects').select('title').in('title', subjects.map((s) => s.title)),
    'find BAC subjects',
  ) as { title: string }[];
  const missing = subjects.filter((s) => !existing.some((e) => e.title === s.title));
  const converted = missing.map((s) => ({ subject: s, ...toBacSubject(s, templateIds, newId) }));

  for (const c of converted) {
    const subjectId = newId();
    try {
      await insertBacSubject(client, subjectId, c);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Items first: their source links restrict deleting the sources that the subject's cascade would remove.
      const items = await client.from('bac_items').delete().eq('subject_id', subjectId);
      const subject = items.error ? items : await client.from('bac_subjects').delete().eq('id', subjectId);
      const rollback = subject.error ? `ROLLBACK FAILED (${subject.error.message})` : 'the subject was removed again';
      throw new Error(`${message} (BAC subject „${c.subject.title}”: ${rollback})`);
    }
  }
  return converted.length;
}

async function insertBacSubject(
  client: SupabaseClient,
  subjectId: string,
  { subject, sources, items }: { subject: SeedBacSubject } & ConvertedBacSubject,
): Promise<void> {
  check(
    await client.from('bac_subjects').insert({
      id: subjectId,
      title: subject.title,
      year: subject.year,
      variant: subject.variant,
      credit_cost: subject.creditCost,
      published: subject.published,
    }),
    'insert BAC subject',
  );
  check(
    await client.from('bac_sources').insert(
      sources.map((s) => ({
        id: s.id,
        subject_id: subjectId,
        section: s.section,
        position: s.position,
        title: s.title,
        author: s.author,
        work: s.work,
        body: s.body,
      })),
    ),
    'insert BAC sources',
  );
  const positions = new Map<number, number>();
  check(
    await client.from('bac_items').insert(
      items.map(({ item }) => {
        const position = positions.get(item.section) ?? 0;
        positions.set(item.section, position + 1);
        // Same row fields as the admin: the consolidation credit cost is not stored on BAC items.
        const { id, position: _p, sources: _s, section, number: _n, points, ...ex } = item;
        const row = exerciseToRow(ex as Parameters<typeof exerciseToRow>[0]);
        return {
          id,
          subject_id: subjectId,
          section,
          position,
          type: row.type,
          prompt: row.prompt,
          content: row.content,
          template_id: row.template_id,
          points,
        };
      }),
    ),
    'insert BAC items',
  );
  const links = items.flatMap(({ item }) =>
    item.sources.map((s, position) => ({ item_id: item.id, source_id: s.sourceId, label: s.label, position })),
  );
  if (links.length) check(await client.from('bac_item_sources').insert(links), 'insert BAC item sources');
  check(await client.from('bac_item_barem').insert(items.map(({ item, barem }) => ({ item_id: item.id, barem }))), 'insert BAC barems');
}
