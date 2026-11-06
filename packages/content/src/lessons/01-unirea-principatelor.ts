import { EXTRA_CARDS } from '../extraCards';
import { essayFromWriting } from '../consolidation';
import type { SeedConsolidation, SeedLesson, SeedSource } from '../types';

const sources: SeedSource[] = [
  {
    key: 'a',
    title: 'Adunările ad-hoc și Convenția de la Paris',
    author: 'Manual de istorie',
    work: 'clasa a XII-a',
    body:
      'Congresul de pace de la Paris, din 1856, a hotărât ca românii să-și exprime dorințele privind organizarea ' +
      'Principatelor prin Adunări ad-hoc. Întrunite în toamna anului 1857, adunările de la Iași și București au cerut ' +
      'unirea Moldovei și a Țării Românești într-un singur stat, cu numele România, condus de un prinț străin dintr-o ' +
      'familie domnitoare a Europei.\n\n' +
      'Marile puteri nu au acceptat însă unirea deplină. De aceea, Convenția de la Paris, semnată în august 1858, a ' +
      'creat Principatele Unite ale Moldovei și Valahiei, dar fiecare principat păstra propriul domn, guvern și ' +
      'adunare. Instituțiile comune erau doar Comisia Centrală de la Focșani și Înalta Curte de Justiție și Casație. ' +
      'Astfel, unirea acceptată de puteri era una limitată, un compromis între dorința românilor și interesele ' +
      'marilor puteri.',
  },
  {
    key: 'b',
    title: 'Domnia lui Alexandru Ioan Cuza',
    author: 'Sinteză de istorie a românilor',
    work: 'epoca modernă',
    body:
      'Convenția de la Paris nu interzicea alegerea aceleiași persoane ca domn în ambele Principate. Profitând de ' +
      'această lacună, Adunarea electivă a Moldovei l-a ales pe Alexandru Ioan Cuza la 5 ianuarie 1859, iar ' +
      'Adunarea electivă a Țării Românești, sub presiunea mulțimii din București, l-a ales și ea la 24 ianuarie ' +
      '1859. [...]\n\n' +
      'Prin legea secularizării din decembrie 1863, averile mănăstirești au trecut în proprietatea statului, astfel ' +
      'că aproximativ un sfert din terenul agricol al țării a devenit proprietate de stat. Pentru a ocoli opoziția ' +
      'Adunării, dominată de marii proprietari, Cuza a dat lovitura de stat din 2 mai 1864 și a supus unui plebiscit ' +
      'Statutul Dezvoltător al Convenției de la Paris. Ca urmare, legea rurală a putut fi adoptată în august 1864: ' +
      'claca și dijma au fost desființate, iar clăcașii au fost împroprietăriți, în schimbul unei despăgubiri.',
  },
];

const b = (quote: string) => ({ source: 'b', quote });

const exercises: SeedConsolidation[] = [
  {
    type: 'short_answer',
    prompt: 'Numiți actul cu caracter constituțional supus plebiscitului în 1864, precizat în sursa B.',
    template: 'short_answer',
    sources: ['a', 'b'],
    accepted: ['Statutul Dezvoltător', 'Statutul Dezvoltător al Convenției de la Paris', 'Statutul Dezvoltător al Convenției'],
    mistakes: [
      {
        answer: 'Convenția de la Paris',
        message: 'Convenția de la Paris (1858) este actul pe care l-a dezvoltat. Caută în sursa B actul supus plebiscitului în 1864.',
      },
    ],
    explanation: 'Actul apare în sursa B, în fraza despre lovitura de stat din 2 mai 1864.',
  },
  {
    type: 'multi_answer',
    prompt: 'Menționați cele două principate precizate atât în sursa A, cât și în sursa B.',
    template: 'multi_answer',
    sources: ['a', 'b'],
    count: 2,
    groups: [
      ['Moldova', 'Moldovei'],
      ['Țara Românească', 'Țării Românești', 'Muntenia', 'Valahia', 'Valahiei'],
    ],
    explanation: 'Ambele surse vorbesc despre Moldova și Țara Românească (numită în Convenția de la Paris „Valahia”).',
  },
  {
    type: 'source_info',
    prompt: 'Precizați, din sursa A, o informație referitoare la Convenția de la Paris.',
    template: 'source_info',
    sources: ['a'],
    count: 1,
    spans: [
      { source: 'a', quote: 'semnată în august 1858' },
      { source: 'a', quote: 'a creat Principatele Unite ale Moldovei și Valahiei' },
      { source: 'a', quote: 'fiecare principat păstra propriul domn, guvern și adunare' },
      { source: 'a', quote: 'Instituțiile comune erau doar Comisia Centrală de la Focșani și Înalta Curte de Justiție și Casație' },
    ],
    explanation: 'Informațiile despre Convenția de la Paris se află în al doilea paragraf al sursei A.',
  },
  {
    type: 'source_letter',
    prompt: 'Scrieți litera corespunzătoare sursei care susține că marile puteri au acceptat doar o unire limitată a Principatelor.',
    template: 'source_letter',
    sources: ['a', 'b'],
    correct: 'A',
    evidence: { source: 'a', quote: 'unirea acceptată de puteri era una limitată' },
    explanation: 'Sursa A spune că „unirea acceptată de puteri era una limitată”; sursa B vorbește despre dubla alegere și despre reformele lui Cuza.',
  },
  {
    type: 'cause_effect',
    prompt: 'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa dată, precizând rolul fiecăreia.',
    template: 'cause_effect',
    sources: ['b'],
    pairs: [
      {
        cause: b('Convenția de la Paris nu interzicea alegerea aceleiași persoane ca domn în ambele Principate'),
        effect: b('l-a ales pe Alexandru Ioan Cuza'),
        explanation: 'Unioniștii au folosit lacuna Convenției: același domn a fost ales în ambele Principate.',
      },
      {
        cause: b('averile mănăstirești au trecut în proprietatea statului'),
        effect: b('aproximativ un sfert din terenul agricol al țării a devenit proprietate de stat'),
        explanation: 'Conectorul „astfel că” introduce efectul secularizării.',
      },
      {
        cause: b('Pentru a ocoli opoziția Adunării, dominată de marii proprietari'),
        effect: b('Cuza a dat lovitura de stat din 2 mai 1864'),
        explanation: '„Pentru a” arată scopul, adică motivul loviturii de stat.',
      },
      {
        cause: b('Cuza a dat lovitura de stat din 2 mai 1864 și a supus unui plebiscit Statutul Dezvoltător al Convenției de la Paris'),
        effect: b('legea rurală a putut fi adoptată în august 1864'),
        explanation: 'Conectorul „Ca urmare” introduce efectul loviturii de stat și al Statutului Dezvoltător.',
      },
      {
        cause: b('legea rurală a putut fi adoptată în august 1864'),
        effect: b('claca și dijma au fost desființate'),
        explanation: 'Desființarea clăcii și a dijmei este o urmare a legii rurale.',
      },
      {
        cause: b('legea rurală a putut fi adoptată în august 1864'),
        effect: b('clăcașii au fost împroprietăriți'),
        explanation: 'Împroprietărirea clăcașilor este o urmare a legii rurale.',
      },
    ],
  },
  {
    type: 'viewpoint',
    prompt:
      'Formulați, pe baza sursei date, un punct de vedere referitor la reformele adoptate în timpul domniei lui ' +
      'Alexandru Ioan Cuza, susținându-l cu două informații selectate din sursă.',
    template: 'viewpoint',
    sources: ['b'],
    count: 2,
    spans: [
      b('averile mănăstirești au trecut în proprietatea statului'),
      b('aproximativ un sfert din terenul agricol al țării a devenit proprietate de stat'),
      b('claca și dijma au fost desființate'),
      b('clăcașii au fost împroprietăriți'),
    ],
    modelAnswer:
      'Consider că reformele adoptate în timpul domniei lui Alexandru Ioan Cuza au modernizat societatea românească. ' +
      'Informații-suport: „claca și dijma au fost desființate”; „clăcașii au fost împroprietăriți”.',
    ai: {
      main: [
        'Tema: reformele din timpul domniei lui Alexandru Ioan Cuza (1859–1866), pe baza sursei date: secularizarea averilor mănăstirești (decembrie 1863), lovitura de stat și Statutul Dezvoltător (mai 1864), legea rurală (august 1864).',
        'Puncte de vedere acceptate (exemple): reformele au modernizat societatea românească; reformele au consolidat statul român modern; legea rurală a îmbunătățit situația țăranilor; secularizarea a întărit statul din punct de vedere economic.',
        'Informații-suport potrivite din sursă: trecerea averilor mănăstirești în proprietatea statului; aproximativ un sfert din terenul agricol a devenit proprietate de stat; desființarea clăcii și a dijmei; împroprietărirea clăcașilor.',
        'Nu este punct de vedere: o simplă informație („Cuza a dat legea rurală”), o apreciere despre altă temă (de exemplu, despre dubla alegere din 1859) sau o apreciere vagă, fără legătură cu reformele.',
        'Greșeli frecvente: confundarea legii rurale (1864) cu secularizarea (1863); afirmația că reformele au fost adoptate după abdicarea lui Cuza (1866); informații-suport care nu susțin punctul de vedere formulat (de exemplu, dubla alegere pentru un punct de vedere despre reforme).',
      ].join('\n'),
      requirements: {},
    },
  },
];

export const unireaPrincipatelor: SeedLesson = {
  key: 'unirea-principatelor-cuza',
  nodeKey: 'statul-roman-modern-romania-mare',
  title: 'Unirea Principatelor și domnia lui Alexandru Ioan Cuza (1857–1866)',
  status: 'published',
  cards: [
    {
      type: 'text',
      title: 'Contextul internațional: Războiul Crimeii (1853–1856)',
      text:
        'Războiul Crimeii s-a încheiat cu înfrângerea Rusiei. Prin Tratatul de la Paris (martie 1856), ' +
        'Moldova și Țara Românească au rămas sub suzeranitate otomană, dar au fost puse sub garanția colectivă ' +
        'a celor șapte mari puteri, iar protectoratul rusesc a încetat. Moldova a primit sudul Basarabiei ' +
        '(Cahul, Bolgrad, Ismail). Pentru a afla dorințele românilor, marile puteri au hotărât convocarea ' +
        'unor Adunări ad-hoc. Astfel, problema Unirii a devenit o chestiune europeană.',
    },
    {
      type: 'images',
      title: 'Adunările ad-hoc (1857)',
      display: 'single',
      images: [
        {
          path: 'hora-unirii-aman.jpg',
          alt: 'Tabloul „Hora Unirii la Craiova” de Theodor Aman',
          credit: 'Theodor Aman, „Hora Unirii la Craiova”. Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Primele alegeri din Moldova (iulie 1857) au fost falsificate de caimacamul Nicolae Vogoride, adversar ' +
        'al Unirii, și au fost anulate la presiunea Franței. După noi alegeri, Adunările ad-hoc s-au întrunit ' +
        'în toamna lui 1857, iar la Iași Mihail Kogălniceanu a prezentat propunerea unionistă. Rezoluțiile ' +
        'adoptate în octombrie 1857 cereau: respectarea autonomiei și neutralitatea Principatelor, unirea lor ' +
        'într-un stat cu numele România, prinț străin dintr-o familie domnitoare a Europei, o adunare ' +
        'reprezentativă și garanția colectivă a marilor puteri.',
    },
    {
      type: 'images',
      title: 'Convenția de la Paris (1858)',
      display: 'single',
      images: [
        {
          path: 'harta-romania-1859-1878.jpg',
          alt: 'Harta Principatelor Unite (România) între 1859 și 1878',
          credit:
            'Teritoriul Principatelor Unite (România) între 1859 și 1878, hartă de Spiridon Manoliu. Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Marile puteri au răspuns rezoluțiilor prin Convenția de la Paris (august 1858), care a funcționat ca o ' +
        'constituție. Statul se numea „Principatele Unite ale Moldovei și Valahiei”, dar fiecare principat ' +
        'păstra propriul domn, guvern și adunare. Instituțiile comune erau Comisia Centrală de la Focșani și ' +
        'Înalta Curte de Justiție și Casație. Convenția prevedea separarea puterilor și egalitatea în fața legii. ' +
        'Așadar, unirea acceptată de puteri era limitată, mai mult formală.',
    },
    {
      type: 'images',
      title: 'Dubla alegere a lui Alexandru Ioan Cuza (1859)',
      display: 'single',
      images: [
        {
          path: 'cuza.jpg',
          alt: 'Portretul lui Alexandru Ioan Cuza',
          credit:
            'Alexandru Ioan Cuza, portret de Carol Popp de Szathmari (1864). Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Convenția de la Paris nu interzicea alegerea aceleiași persoane ca domn în ambele Principate. ' +
        'Profitând de această lacună, Adunarea electivă a Moldovei l-a ales pe Alexandru Ioan Cuza la ' +
        '5 ianuarie 1859, iar Adunarea electivă a Țării Românești, sub presiunea mulțimii din București, ' +
        'la 24 ianuarie 1859. Astfel, românii au pus marile puteri în fața faptului împlinit. Conferința ' +
        'de la Paris a recunoscut dubla alegere în același an.',
    },
    {
      type: 'text',
      title: 'Unificarea instituțiilor (1859–1862)',
      text:
        'Cuza a unificat treptat instituțiile celor două Principate (armata, vămile, serviciul telegrafic). ' +
        'În decembrie 1861, Imperiul Otoman a acceptat unirea deplină pe durata domniei lui Cuza, iar domnul a ' +
        'proclamat: „Unirea este îndeplinită, naționalitatea română este întemeiată”. În ianuarie 1862 s-au ' +
        'format un guvern unic, condus de Barbu Catargiu, și o adunare unică, iar capitala a devenit București. ' +
        'Statul s-a numit oficial Principatele Unite Române, dar se folosea tot mai des numele de România.',
    },
    {
      type: 'text',
      title: 'Secularizarea averilor mănăstirești (1863)',
      text:
        'Multe mănăstiri erau „închinate” unor locuri sfinte din afara țării (Muntele Athos, Ierusalim), ' +
        'iar veniturile lor ieșeau din Principate. În decembrie 1863, guvernul condus de Mihail Kogălniceanu ' +
        'a adoptat legea secularizării averilor mănăstirești. Prin această lege, aproximativ un sfert din ' +
        'terenul agricol al țării a trecut în proprietatea statului. Astfel, veniturile statului au crescut, ' +
        'iar statul a obținut pământ care putea fi folosit pentru împroprietărirea țăranilor.',
    },
    {
      type: 'text',
      title: 'Lovitura de stat și Statutul Dezvoltător (1864)',
      text:
        'Adunarea, dominată de marii proprietari conservatori, s-a opus proiectului de reformă agrară. ' +
        'De aceea, la 2 mai 1864, Cuza a dizolvat Adunarea (lovitura de stat) și a supus unui plebiscit ' +
        'Statutul Dezvoltător al Convenției de la Paris. Statutul îi dădea domnului inițiativa legislativă ' +
        'și drept de veto, crea Senatul (Corpul Ponderator), astfel încât Parlamentul devenea bicameral, ' +
        'și era însoțit de o nouă lege electorală, cu un cens mai scăzut. Astfel, s-a instaurat un regim ' +
        'autoritar, care a permis adoptarea reformelor.',
    },
    {
      type: 'images',
      title: 'Legea rurală și legea instrucțiunii publice (1864)',
      display: 'single',
      images: [
        {
          path: 'kogalniceanu.jpg',
          alt: 'Portretul lui Mihail Kogălniceanu',
          credit: 'Mihail Kogălniceanu, autor necunoscut. Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Legea rurală (august 1864), promovată de Mihail Kogălniceanu, a desființat claca, dijma și celelalte ' +
        'obligații ale țăranilor față de proprietari și i-a împroprietărit pe clăcași cu loturi stabilite după ' +
        'numărul vitelor de muncă, în schimbul unei despăgubiri plătite în 15 ani. Legea instrucțiunii publice ' +
        '(1864) a organizat învățământul pe trei niveluri (primar, secundar, superior) și a făcut învățământul ' +
        'primar obligatoriu și gratuit. Așadar, reformele au modernizat societatea românească.',
    },
    {
      type: 'text',
      title: 'Abdicarea lui Cuza (1866)',
      text:
        'Reformele și regimul autoritar l-au izolat pe Cuza. Conservatorii, nemulțumiți de legea rurală, și ' +
        'liberalii radicali, care criticau guvernarea personală, s-au aliat într-o grupare numită ' +
        '„monstruoasa coaliție”. În noaptea de 10/11 februarie 1866, Cuza a fost obligat să abdice. Puterea ' +
        'a fost preluată de o Locotenență domnească, iar politicienii au căutat un prinț străin, așa cum ' +
        'ceruseră Adunările ad-hoc.',
    },
    ...(EXTRA_CARDS['unirea-principatelor-cuza'] ?? []),
  ],
  questions: [
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'În ce an s-au întrunit Adunările ad-hoc din Moldova și Țara Românească?',
      options: [
        { id: 'a', text: '1848', correct: false },
        { id: 'b', text: '1856', correct: false },
        { id: 'c', text: '1857', correct: true },
        { id: 'd', text: '1859', correct: false },
      ],
      explanation:
        'Adunările ad-hoc s-au întrunit în 1857, conform hotărârii Congresului de la Paris din 1856, pentru ' +
        'a exprima dorințele românilor privind organizarea Principatelor.',
    },
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'Cine a fost ales domn al Moldovei la 5 ianuarie 1859 și al Țării Românești la 24 ianuarie 1859?',
      options: [
        { id: 'a', text: 'Mihail Kogălniceanu', correct: false },
        { id: 'b', text: 'Alexandru Ioan Cuza', correct: true },
        { id: 'c', text: 'Barbu Catargiu', correct: false },
        { id: 'd', text: 'Carol de Hohenzollern-Sigmaringen', correct: false },
      ],
      explanation:
        'Alexandru Ioan Cuza a fost ales domn în ambele Principate (dubla alegere). Kogălniceanu a fost ' +
        'prim-ministru, Barbu Catargiu a condus primul guvern unic (1862), iar Carol a venit abia în 1866.',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'Ce prevedere (sau lipsă de prevedere) a Convenției de la Paris (1858) a făcut posibilă dubla alegere?',
      options: [
        {
          id: 'a',
          text: 'Nu interzicea alegerea aceleiași persoane ca domn în ambele Principate.',
          correct: true,
        },
        { id: 'b', text: 'Permitea aducerea unui prinț străin pe tronul Principatelor.', correct: false },
        { id: 'c', text: 'Desființa suzeranitatea otomană asupra Principatelor.', correct: false },
        { id: 'd', text: 'Prevedea un guvern unic pentru Moldova și Țara Românească.', correct: false },
      ],
      explanation:
        'Convenția stabilea câte un domn pentru fiecare principat, dar nu interzicea ca aceeași persoană să ' +
        'fie aleasă în ambele. Unioniștii au folosit această lacună. Suzeranitatea otomană s-a menținut, iar ' +
        'guvernul unic a apărut abia în 1862.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: 'Care dintre următoarele cereri se regăsesc în rezoluțiile Adunărilor ad-hoc (1857)?',
      options: [
        { id: 'a', text: 'Unirea Principatelor într-un singur stat, cu numele România', correct: true },
        { id: 'b', text: 'Prinț străin dintr-o familie domnitoare a Europei', correct: true },
        { id: 'c', text: 'Neutralitatea teritoriului Principatelor', correct: true },
        { id: 'd', text: 'Proclamarea independenței față de Imperiul Otoman', correct: false },
        { id: 'e', text: 'Instaurarea republicii', correct: false },
      ],
      explanation:
        'Rezoluțiile cereau autonomia (nu independența), neutralitatea, unirea într-un stat numit România, ' +
        'prinț străin, adunare reprezentativă și garanția colectivă a marilor puteri. Independența a fost ' +
        'proclamată abia în 1877.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: 'Care dintre următoarele reforme au fost adoptate în timpul domniei lui Alexandru Ioan Cuza?',
      options: [
        { id: 'a', text: 'Secularizarea averilor mănăstirești', correct: true },
        { id: 'b', text: 'Legea rurală, care i-a împroprietărit pe clăcași', correct: true },
        { id: 'c', text: 'Legea instrucțiunii publice', correct: true },
        { id: 'd', text: 'Introducerea votului universal masculin', correct: false },
        { id: 'e', text: 'Adoptarea unei constituții după modelul celei belgiene', correct: false },
      ],
      explanation:
        'Secularizarea (1863), legea rurală (1864) și legea instrucțiunii publice (1864) aparțin domniei lui ' +
        'Cuza. Constituția după model belgian a fost adoptată în iulie 1866, după abdicarea lui Cuza, sub ' +
        'Carol I, iar votul universal masculin a fost introdus abia după Primul Război Mondial (1918).',
    },
    {
      type: 'chronological_order',
      difficulty: 'medium',
      prompt: 'Ordonează cronologic etapele Unirii Principatelor.',
      options: [
        { id: 'a', text: 'Congresul de pace de la Paris', label: '1856' },
        { id: 'b', text: 'Întrunirea Adunărilor ad-hoc', label: '1857' },
        { id: 'c', text: 'Adoptarea Convenției de la Paris', label: '1858' },
        { id: 'd', text: 'Dubla alegere a lui Alexandru Ioan Cuza', label: '1859' },
        { id: 'e', text: 'Recunoașterea unirii depline de către Imperiul Otoman', label: '1861' },
      ],
      explanation:
        'Congresul de la Paris (1856) a hotărât consultarea românilor prin Adunările ad-hoc (1857); marile ' +
        'puteri au răspuns prin Convenția de la Paris (1858), pe care românii au depășit-o prin dubla alegere ' +
        '(1859); unirea deplină a fost recunoscută în 1861.',
    },
    {
      type: 'chronological_order',
      difficulty: 'hard',
      prompt: 'Ordonează cronologic următoarele evenimente din domnia lui Alexandru Ioan Cuza.',
      options: [
        { id: 'a', text: 'Formarea guvernului unic și stabilirea capitalei la București', label: '1862' },
        { id: 'b', text: 'Secularizarea averilor mănăstirești', label: '1863' },
        { id: 'c', text: 'Adoptarea legii rurale', label: '1864' },
        { id: 'd', text: 'Abdicarea lui Alexandru Ioan Cuza', label: '1866' },
      ],
      explanation:
        'După unificarea instituțiilor (1862), guvernul Kogălniceanu a adoptat secularizarea (1863), apoi, ' +
        'după lovitura de stat din mai 1864, legea rurală (august 1864). Cuza a abdicat în februarie 1866.',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'Care a fost o consecință directă a legii rurale din 1864?',
      options: [
        {
          id: 'a',
          text: 'Desființarea clăcii și împroprietărirea clăcașilor, în schimbul unei despăgubiri',
          correct: true,
        },
        { id: 'b', text: 'Trecerea averilor mănăstirești în proprietatea statului', correct: false },
        { id: 'c', text: 'Introducerea învățământului primar obligatoriu și gratuit', correct: false },
        { id: 'd', text: 'Înființarea Senatului', correct: false },
      ],
      explanation:
        'Legea rurală i-a eliberat pe țărani de obligațiile față de proprietari și le-a dat pământ, pe care ' +
        'l-au plătit în 15 ani. Celelalte variante sunt efectele altor măsuri: secularizarea (1863), legea ' +
        'instrucțiunii (1864) și Statutul Dezvoltător (1864).',
    },
    {
      type: 'single_choice',
      difficulty: 'hard',
      prompt: 'Ce explică formarea „monstruoasei coaliții” care l-a obligat pe Cuza să abdice în 1866?',
      options: [
        {
          id: 'a',
          text:
            'Conservatorii, nemulțumiți de legea rurală, și liberalii radicali, care criticau regimul autoritar, s-au aliat împotriva domnului.',
          correct: true,
        },
        {
          id: 'b',
          text: 'Marile puteri garante au cerut înlăturarea lui Cuza după proclamarea independenței.',
          correct: false,
        },
        {
          id: 'c',
          text: 'Țăranii s-au revoltat împotriva secularizării averilor mănăstirești.',
          correct: false,
        },
        {
          id: 'd',
          text: 'Liberalii și conservatorii doreau revenirea la două state separate.',
          correct: false,
        },
      ],
      explanation:
        'Coaliția a fost numită „monstruoasă” deoarece a reunit adversari politici: conservatori și liberali ' +
        'radicali. Ei nu doreau desfacerea Unirii, ci înlocuirea lui Cuza cu un prinț străin. Independența ' +
        'nu fusese încă proclamată (1877).',
    },
  ],
  sources,
  consolidation: [
    ...exercises,
    essayFromWriting(
      'Scrie introducerea unui eseu despre constituirea statului român modern în perioada 1857–1866.',
      [
        'Contextualizarea temei: precizarea, pe scurt, a contextului în care se constituie statul român modern (de exemplu: înfrângerea Rusiei în Războiul Crimeii, Congresul de la Paris din 1856, garanția colectivă a marilor puteri, dorința de unire a românilor).',
        'Enunțarea clară a temei eseului: constituirea statului român modern în perioada 1857–1866 (Unirea Principatelor și consolidarea statului prin reformele lui Alexandru Ioan Cuza).',
        'Anunțarea, la nivel general, a ideilor care vor fi dezvoltate în cuprins (de exemplu: acțiunile românilor din 1857–1859, unificarea instituțiilor, reformele), fără a le dezvolta.',
        'Introducerea are 3–6 propoziții și nu conține detalii specifice cuprinsului (enumerări de date, prevederi ale legilor etc.).',
        'Utilizarea limbajului istoric adecvat (de exemplu: unire, stat modern, autonomie, garanție colectivă, reforme).',
        'Ideile sunt înlănțuite logic, iar exprimarea este clară și corectă.',
      ].join('\n'),
    ),
    essayFromWriting(
      'Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta și utilizând relația cauză-efect.',
      [
        'Menționarea unei acțiuni desfășurate de români în perioada 1857–1859 (de exemplu: rezoluțiile Adunărilor ad-hoc din 1857, organizarea adunărilor elective, dubla alegere a lui Alexandru Ioan Cuza din 5 și 24 ianuarie 1859).',
        'Precizarea a două informații corecte referitoare la acțiunea menționată (de exemplu: data, locul, participanții, conținutul hotărârilor, urmările).',
        'Utilizarea explicită a relației cauză-efect (de exemplu: „Deoarece Convenția de la Paris nu interzicea alegerea aceleiași persoane în ambele Principate, unioniștii l-au ales pe Cuza domn și la București.”).',
        'Folosirea conectorilor care exprimă cauzalitatea (deoarece, pentru că) și concluzia (așadar, astfel).',
        'Acțiunea se încadrează corect în perioada 1857–1859 (reformele lui Cuza sau evenimentele de după 1859 nu se punctează).',
        'Utilizarea limbajului istoric adecvat și prezentarea ideilor în succesiune cronologică/logică.',
      ].join('\n'),
    ),
  ],
};
