import { EXTRA_CARDS } from '../extraCards';
import type { SeedConsolidation, SeedLesson, SeedSource } from '../types';

const sources: SeedSource[] = [
  {
    key: 'a',
    title: 'Aducerea prințului străin',
    author: 'Manual de istorie',
    work: 'clasa a XII-a',
    body:
      'După abdicarea lui Alexandru Ioan Cuza, în februarie 1866, puterea a fost preluată de o Locotenență ' +
      'domnească. Oamenii politici au căutat un prinț străin, așa cum ceruseră Adunările ad-hoc, deoarece un domn ' +
      'dintr-o familie domnitoare a Europei putea pune capăt rivalităților dintre marile familii boierești și putea ' +
      'spori prestigiul extern al statului.\n\n' +
      'După ce Filip de Flandra a refuzat tronul, Ion C. Brătianu a negociat cu Carol de Hohenzollern-Sigmaringen, ' +
      'rudă cu familia regală a Prusiei și susținut de Napoleon al III-lea. Alegerea lui Carol a fost aprobată ' +
      'printr-un plebiscit în aprilie 1866, iar la 10 mai 1866 noul domn a depus jurământul la București.',
  },
  {
    key: 'b',
    title: 'Constituția din 1866',
    author: 'Sinteză de istorie a românilor',
    work: 'epoca modernă',
    body:
      'La 1 iulie 1866, Carol a promulgat Constituția votată de Adunarea Constituantă, după modelul Constituției ' +
      'Belgiei din 1831. Textul a fost elaborat și adoptat fără consultarea Imperiului Otoman și a puterilor ' +
      'garante, ceea ce a făcut din el un act de afirmare a autonomiei. Constituția stabilea că statul se numește ' +
      'România, iar forma de guvernământ era monarhia constituțională ereditară.\n\n' +
      'Constituția consacra separarea puterilor în stat. Puterea legislativă era exercitată de domn împreună cu ' +
      'Reprezentanța națională, formată din Adunarea Deputaților și Senat. Puterea executivă era încredințată ' +
      'domnului, care o exercita prin miniștri, iar puterea judecătorească aparținea curților și tribunalelor.\n\n' +
      'Erau garantate libertatea presei, libertatea conștiinței și libertatea întrunirilor, iar proprietatea era ' +
      'declarată „sacră și inviolabilă”. Totuși, votul era cenzitar, astfel că marea majoritate a populației avea ' +
      'o influență redusă asupra vieții politice.',
  },
];

const b = (quote: string) => ({ source: 'b', quote });

const exercises: SeedConsolidation[] = [
  {
    type: 'short_answer',
    prompt: 'Numiți prințul străin care a depus jurământul la București în 1866, precizat în sursa A.',
    template: 'short_answer',
    sources: ['a', 'b'],
    accepted: [
      'Carol de Hohenzollern-Sigmaringen',
      'Carol de Hohenzollern',
      'Carol',
      'Carol I',
      'Carol I de Hohenzollern-Sigmaringen',
    ],
    mistakes: [
      { answer: 'Filip de Flandra', message: 'Filip de Flandra a refuzat tronul. Citește din nou sursa A.' },
      { answer: 'Ion C. Brătianu', message: 'Ion C. Brătianu a negociat aducerea prințului, dar nu a devenit domn.' },
    ],
    explanation: 'Numele noului domn apare în al doilea paragraf al sursei A.',
  },
  {
    type: 'multi_answer',
    prompt: 'Menționați două libertăți garantate de Constituție, precizate în sursa B.',
    template: 'multi_answer',
    sources: ['a', 'b'],
    count: 2,
    groups: [
      ['libertatea presei', 'presei', 'presa'],
      ['libertatea conștiinței', 'conștiinței', 'conștiința'],
      ['libertatea întrunirilor', 'întrunirilor', 'întrunirile'],
    ],
    explanation: 'Sursa B enumeră libertatea presei, libertatea conștiinței și libertatea întrunirilor.',
  },
  {
    type: 'source_info',
    prompt: 'Menționați, din sursa dată, două informații referitoare la organizarea puterilor în stat.',
    template: 'source_info',
    sources: ['b'],
    count: 2,
    spans: [
      b('Constituția consacra separarea puterilor în stat'),
      b('Puterea legislativă era exercitată de domn împreună cu Reprezentanța națională'),
      b('Puterea executivă era încredințată domnului'),
      b('puterea judecătorească aparținea curților și tribunalelor'),
    ],
    explanation: 'Informațiile despre puterile statului se află în al doilea paragraf al sursei.',
  },
  {
    type: 'source_letter',
    prompt: 'Scrieți litera corespunzătoare sursei care susține că alegerea noului domn a fost aprobată prin vot popular.',
    template: 'source_letter',
    sources: ['a', 'b'],
    correct: 'A',
    evidence: { source: 'a', quote: 'Alegerea lui Carol a fost aprobată printr-un plebiscit în aprilie 1866' },
    explanation: 'Plebiscitul este o consultare a populației prin vot. Sursa A: „Alegerea lui Carol a fost aprobată printr-un plebiscit”.',
  },
  {
    type: 'cause_effect',
    prompt: 'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa dată, precizând rolul fiecăreia.',
    template: 'cause_effect',
    sources: ['b'],
    pairs: [
      {
        cause: b('fără consultarea Imperiului Otoman și a puterilor garante'),
        effect: b('un act de afirmare a autonomiei'),
        explanation: 'Conectorul „ceea ce” introduce efectul: românii și-au dat singuri o constituție.',
      },
      {
        cause: b('votul era cenzitar'),
        effect: b('marea majoritate a populației avea o influență redusă asupra vieții politice'),
        explanation: 'Conectorul „astfel că” introduce efectul votului cenzitar.',
      },
    ],
  },
  {
    type: 'facts',
    prompt: 'Prezentați două fapte istorice referitoare la statul român în perioada 1866–1881.',
    template: 'facts',
    sources: [],
    count: 2,
    modelAnswer:
      '1. În aprilie 1866, alegerea lui Carol de Hohenzollern-Sigmaringen ca domn a fost aprobată printr-un plebiscit, ' +
      'iar la 10 mai 1866 acesta a depus jurământul la București. Astfel, s-a împlinit cererea Adunărilor ad-hoc ' +
      'privind aducerea unui prinț străin.\n' +
      '2. La 1 iulie 1866 a fost promulgată Constituția, elaborată după modelul Constituției Belgiei din 1831. Ea ' +
      'stabilea numele de România, monarhia constituțională ereditară și separarea puterilor în stat și garanta ' +
      'drepturi și libertăți precum libertatea presei și a întrunirilor.',
    ai: {
      main: [
        'Perioada: 1866–1881 (de la aducerea prințului străin până la proclamarea Regatului). Faptele privesc statul român.',
        'Fapte acceptate (exemple): abdicarea lui Alexandru Ioan Cuza (februarie 1866) și Locotenența domnească; refuzul lui Filip de Flandra; aprobarea alegerii lui Carol de Hohenzollern-Sigmaringen prin plebiscit (aprilie 1866) și depunerea jurământului (10 mai 1866); promulgarea Constituției (1 iulie 1866), după modelul belgian din 1831 (numele de România, monarhie constituțională ereditară, separarea puterilor, Parlament bicameral, drepturi și libertăți, vot cenzitar); Convenția cu Rusia (4 aprilie 1877); proclamarea independenței (9 mai 1877) și Războiul de Independență (1877–1878); recunoașterea independenței la Congresul de la Berlin (1878), cu revizuirea articolului 7 al Constituției (1879); proclamarea Regatului (martie 1881) și încoronarea lui Carol I ca rege (mai 1881).',
        'Două prevederi ale Constituției din 1866 țin de același fapt (promulgarea Constituției).',
        'Greșeli frecvente: fapte din afara perioadei (reformele lui Cuza, 1863–1864; votul universal, 1917); atribuirea Constituției lui Cuza; afirmația că, în 1866, Carol a devenit rege (a fost domn până în 1881); date greșite.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'comparison',
    prompt: 'Menționați o deosebire între Convenția de la Paris (1858) și Constituția din 1866.',
    template: 'comparison',
    sources: [],
    variant: 'difference',
    modelAnswer:
      'Spre deosebire de Convenția de la Paris, impusă în 1858 de marile puteri, Constituția din 1866 a fost ' +
      'elaborată și votată de Adunarea Constituantă a României, fără consultarea puterilor garante.',
    ai: {
      main: [
        'Tema: două acte cu caracter constituțional ale statului român modern, Convenția de la Paris (august 1858) și Constituția din 1866 (1 iulie 1866).',
        'Convenția de la Paris: elaborată de marile puteri garante (act impus din afară); statul se numea Principatele Unite ale Moldovei și Valahiei; fiecare principat avea propriul domn, ales pe viață de Adunarea electivă, propriul guvern și propria adunare; instituții comune: Comisia Centrală de la Focșani și Înalta Curte de Justiție și Casație; domnul trebuia să fie pământean.',
        'Constituția din 1866: elaborată și votată de Adunarea Constituantă, fără consultarea Imperiului Otoman și a puterilor garante; statul se numea România; monarhie constituțională ereditară, cu un prinț străin (Carol I); un singur Parlament, bicameral (Adunarea Deputaților și Senatul); drepturi și libertăți cetățenești garantate, după modelul Constituției Belgiei din 1831.',
        'Deosebiri acceptate (exemple): cine a elaborat actul (marile puteri / Adunarea Constituantă); numele statului; domn ales pe viață, pământean / monarhie ereditară cu prinț străin; doi domni și două adunări / un singur domn și un Parlament bicameral.',
        'Elemente comune (asemănări, nu deosebiri): separarea puterilor apare în ambele.',
        'Greșeli frecvente: atribuirea numelui „România” Convenției; confuzia Convenției cu Statutul Dezvoltător (1864); afirmația că, potrivit Convenției, domnul era un prinț străin.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'viewpoint',
    prompt:
      'Formulați, pe baza sursei date, un punct de vedere referitor la caracterul Constituției din 1866, ' +
      'susținându-l cu două informații selectate din sursă.',
    template: 'viewpoint',
    sources: ['b'],
    count: 2,
    spans: [
      b('după modelul Constituției Belgiei din 1831'),
      b('Constituția consacra separarea puterilor în stat'),
      b('Erau garantate libertatea presei, libertatea conștiinței și libertatea întrunirilor'),
      b('proprietatea era declarată „sacră și inviolabilă”'),
      b('votul era cenzitar'),
    ],
    modelAnswer:
      'Consider că Constituția din 1866 a avut un caracter liberal și modern pentru epoca sa. Informații-suport: ' +
      '„Constituția consacra separarea puterilor în stat”; „Erau garantate libertatea presei, libertatea conștiinței ' +
      'și libertatea întrunirilor”.',
    ai: {
      main: [
        'Tema: caracterul Constituției din 1866 (promulgată la 1 iulie 1866, sub Carol I), pe baza sursei date.',
        'Puncte de vedere acceptate (exemple): Constituția a avut un caracter liberal / modern / democratic pentru epoca sa; a contribuit la modernizarea statului român; a consacrat principiile statului de drept. Este acceptat și un punct de vedere nuanțat sau critic, dacă este susținut de sursă (de exemplu: Constituția avea limite, deoarece votul era cenzitar).',
        'Informații-suport potrivite din sursă: modelul Constituției Belgiei din 1831; separarea puterilor în stat; garantarea libertății presei, a conștiinței și a întrunirilor; proprietatea „sacră și inviolabilă”; votul cenzitar (doar pentru un punct de vedere despre limitele Constituției). Votul cenzitar nu susține caracterul democratic, iar libertățile nu susțin limitele.',
        'Greșeli frecvente: afirmația că Constituția introducea votul universal; atribuirea ei lui Alexandru Ioan Cuza; confuzia cu Convenția de la Paris (1858); aprecieri despre altă temă (de exemplu, despre aducerea prințului străin) sau prea vagi („Constituția a fost importantă”), fără precizarea caracterului ei.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'argument',
    prompt:
      'Argumentați, printr-un fapt istoric relevant, afirmația conform căreia Constituția din 1866 a contribuit la ' +
      'modernizarea statului român.',
    template: 'argument',
    sources: [],
    modelAnswer:
      'Constituția din 1866 a contribuit la modernizarea statului român, deoarece a consacrat separarea puterilor în ' +
      'stat: puterea legislativă era exercitată de domn și de Parlamentul bicameral, iar cea executivă de domn, prin ' +
      'miniștri, care răspundeau pentru actele guvernării. În plus, ea garanta drepturi și libertăți precum libertatea ' +
      'presei și a întrunirilor. Așadar, afirmația este adevărată.',
    ai: {
      main: [
        'Perioada și tema: Constituția din 1866 (promulgată la 1 iulie 1866, la începutul domniei lui Carol I) și contribuția ei la modernizarea statului român.',
        'Fapte relevante acceptate: consacrarea separării puterilor în stat (legislativă: domnul și Parlamentul bicameral, adică Adunarea Deputaților și Senatul; executivă: domnul, prin miniștri; judecătorească: curțile și tribunalele); garantarea drepturilor și libertăților cetățenești (egalitatea în fața legii, libertatea presei, a conștiinței, a întrunirilor și a asocierii); suveranitatea națională și responsabilitatea ministerială; monarhia constituțională ereditară, care punea capăt luptelor pentru tron; modelul Constituției Belgiei din 1831, una dintre cele mai liberale ale epocii; adoptarea fără consultarea Imperiului Otoman și a puterilor garante (afirmarea autonomiei); consacrarea numelui de România.',
        'Greșeli frecvente: atribuirea Constituției lui Alexandru Ioan Cuza; o dată greșită (1859, 1877); afirmația că instituia votul universal (votul era cenzitar; votul universal a fost introdus abia prin modificarea din 1917); confuzia cu Convenția de la Paris (1858) sau cu Statutul Dezvoltător (1864). Votul cenzitar este o limită a Constituției și nu susține afirmația.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'essay',
    prompt:
      'Elaborați un eseu despre instaurarea monarhiei constituționale în România, în perioada 1866–1881, respectând ' +
      'următoarele cerințe:',
    template: 'essay',
    sources: [],
    requirements: [
      {
        id: 'r1',
        text: 'Menționați două fapte istorice referitoare la aducerea prințului străin pe tronul României, în anul 1866.',
        modelAnswer:
          'Aprobarea alegerii lui Carol de Hohenzollern-Sigmaringen printr-un plebiscit (aprilie 1866); depunerea ' +
          'jurământului de către Carol la București (10 mai 1866).',
        template: 'facts',
        argument: false,
      },
      {
        id: 'r2',
        text: 'Prezentați un fapt istoric referitor la organizarea puterilor în stat, potrivit Constituției din 1866.',
        modelAnswer:
          'Constituția din 1866 consacra separarea puterilor în stat: puterea legislativă era exercitată de domn împreună ' +
          'cu Reprezentanța națională, formată din Adunarea Deputaților și Senat; puterea executivă era încredințată ' +
          'domnului, care o exercita prin miniștri; puterea judecătorească aparținea curților și tribunalelor.',
        template: 'facts',
        argument: false,
      },
      {
        id: 'r3',
        text: 'Precizați o cauză a aducerii unui prinț străin pe tronul României, în anul 1866.',
        modelAnswer:
          'Un prinț dintr-o familie domnitoare a Europei putea pune capăt rivalităților dintre marile familii boierești ' +
          'pentru tron.',
        template: 'cause_effect',
        argument: false,
      },
      {
        id: 'r4',
        text:
          'Formulați un punct de vedere referitor la rolul Constituției din 1866 în modernizarea statului român și ' +
          'susțineți-l printr-un argument istoric.',
        modelAnswer:
          'Consider că Constituția din 1866 a contribuit la modernizarea statului român, deoarece a garantat drepturi și ' +
          'libertăți cetățenești, precum libertatea presei, a conștiinței și a întrunirilor, după modelul Constituției ' +
          'Belgiei din 1831. Așadar, statul român a adoptat principiile liberale ale epocii.',
        template: 'argument',
        argument: true,
      },
    ],
    ai: {
      main: '',
      requirements: {
        r1: [
          'Tema: aducerea prințului străin în 1866.',
          'Fapte acceptate: abdicarea lui Alexandru Ioan Cuza (februarie 1866) și preluarea puterii de către Locotenența domnească; oferirea tronului lui Filip de Flandra și refuzul acestuia; negocierile purtate de Ion C. Brătianu cu Carol de Hohenzollern-Sigmaringen; sprijinul lui Napoleon al III-lea; aprobarea alegerii lui Carol prin plebiscit (aprilie 1866); depunerea jurământului de către Carol la București (10 mai 1866).',
          'Greșeli frecvente: fapte din alt an (independența, 1877; proclamarea Regatului, 1881); afirmația că Filip de Flandra a domnit; afirmația că, în 1866, Carol a devenit rege.',
        ].join('\n'),
        r2: [
          'Tema: organizarea puterilor în stat potrivit Constituției din 1866 (promulgată la 1 iulie 1866).',
          'Elemente acceptate: separarea puterilor în stat; puterea legislativă, exercitată de domn împreună cu Reprezentanța națională (Parlament bicameral: Adunarea Deputaților și Senatul); puterea executivă, încredințată domnului, care o exercita prin miniștri (responsabilitatea ministerială: actele domnului erau contrasemnate de un ministru); puterea judecătorească, a curților și tribunalelor; monarhia constituțională ereditară; votul cenzitar, pe colegii.',
          'Greșeli frecvente: afirmația că domnul avea puterea judecătorească sau că putea guverna fără miniștri; Parlament unicameral; votul universal (introdus abia prin modificarea din 1917); confuzia cu Statutul Dezvoltător (1864) sau cu Convenția de la Paris (1858).',
        ].join('\n'),
        r3: [
          'Tema: cauzele aducerii unui prinț străin pe tronul României (1866).',
          'Cauze acceptate: punerea capătului rivalităților dintre marile familii boierești pentru tron; creșterea prestigiului extern al statului; sprijinul marilor puteri pentru menținerea Unirii (un prinț dintr-o familie domnitoare a Europei); îndeplinirea cererii Adunărilor ad-hoc din 1857; abdicarea lui Cuza și dorința de a asigura stabilitatea statului prin monarhia ereditară.',
          'Greșeli frecvente: afirmația că prințul străin a fost impus de Imperiul Otoman; legarea aducerii lui Carol de independență (1877); confuzia cu dubla alegere a lui Cuza (1859).',
        ].join('\n'),
        r4: [
          'Tema punctului de vedere: rolul Constituției din 1866 în modernizarea statului român. Puncte de vedere acceptate (exemple): a contribuit la modernizare; a avut un caracter liberal pentru epoca sa.',
          'Fapte potrivite pentru argument: separarea puterilor în stat; garantarea drepturilor și libertăților (libertatea presei, a conștiinței, a întrunirilor, egalitatea în fața legii); responsabilitatea ministerială; modelul belgian din 1831; adoptarea fără consultarea Imperiului Otoman și a puterilor garante; numele de România; monarhia constituțională ereditară.',
          'Greșeli frecvente: votul universal (votul era cenzitar); atribuirea Constituției lui Cuza; date greșite.',
        ].join('\n'),
      },
    },
  },
];

export const constitutia1866: SeedLesson = {
  key: 'constitutia-1866',
  nodeKey: 'constitutiile-din-romania',
  title: 'Constituția din 1866 și monarhia constituțională',
  status: 'published',
  cards: [
    {
      type: 'images',
      title: 'Aducerea prințului străin (1866)',
      display: 'single',
      images: [
        {
          path: 'ion-c-bratianu.jpg',
          alt: 'Fotografie a lui Ion C. Brătianu',
          credit:
            'Ion C. Brătianu, fotografie de Carol Popp de Szathmari (anii 1860). Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'După abdicarea lui Cuza, Locotenența domnească a căutat un prinț străin, așa cum ceruseră Adunările ' +
        'ad-hoc. Deoarece Filip de Flandra a refuzat, Ion C. Brătianu a negociat cu Carol de ' +
        'Hohenzollern-Sigmaringen, rudă cu familia regală a Prusiei și susținut de Napoleon al III-lea. ' +
        'Un plebiscit (aprilie 1866) a aprobat alegerea, iar Carol a depus jurământul la București la ' +
        '10 mai 1866. Un prinț străin punea capăt rivalităților dintre marile familii boierești și sporea ' +
        'prestigiul extern al statului.',
    },
    {
      type: 'images',
      title: 'Carol I (domn 1866–1881, rege 1881–1914)',
      display: 'single',
      images: [
        {
          path: 'carol-i.jpg',
          alt: 'Fotografie a regelui Carol I',
          credit: 'Regele Carol I, fotografie (cca 1905–1914). Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Carol I a domnit 48 de ani. În timpul domniei sale a fost adoptată Constituția din 1866, a fost ' +
        'cucerită independența (1877–1878) și a fost proclamat Regatul (1881). El a respectat, în general, ' +
        'regulile monarhiei constituționale: numea primul-ministru și miniștrii, dar actele sale trebuiau ' +
        'contrasemnate de un ministru, care răspundea pentru ele. Astfel, Carol I a asigurat stabilitatea ' +
        'politică a statului român modern.',
    },
    {
      type: 'text',
      title: 'Adoptarea Constituției (1 iulie 1866)',
      text:
        'Adunarea Constituantă a dezbătut și votat noua Constituție, promulgată de Carol la 1 iulie 1866. ' +
        'Modelul a fost Constituția Belgiei din 1831, una dintre cele mai liberale ale epocii. Constituția a ' +
        'fost elaborată și adoptată fără consultarea Imperiului Otoman și a puterilor garante, deși România ' +
        'era încă sub suzeranitate otomană. Așadar, adoptarea ei a fost un act de afirmare a autonomiei, ' +
        'un pas spre independență. Ea a înlocuit Convenția de la Paris și Statutul Dezvoltător.',
    },
    {
      type: 'text',
      title: 'Numele statului și forma de guvernământ',
      text:
        'Articolul 1 prevedea: „Principatele Unite Române constituie un singur stat indivizibil, sub ' +
        'denumirea de România”. Forma de guvernământ era monarhia constituțională ereditară: tronul se ' +
        'moștenea în familia lui Carol, pe linie masculină, prin primogenitură. Constituția consacra ' +
        'suveranitatea națională („Toate puterile statului emană de la națiune”) și responsabilitatea ' +
        'ministerială: domnul era inviolabil, iar miniștrii răspundeau pentru actele guvernării.',
    },
    {
      type: 'text',
      title: 'Separarea puterilor în stat',
      text:
        'Constituția aplica principiul separării puterilor. Puterea legislativă era exercitată de domn ' +
        'împreună cu Reprezentanța națională, adică un Parlament bicameral (Adunarea Deputaților și Senatul). ' +
        'Puterea executivă aparținea domnului, care o exercita prin miniștri. Puterea judecătorească era ' +
        'exercitată de curți și tribunale. Domnul avea atribuții largi: numea și revoca miniștrii, sancționa ' +
        'și promulga legile (avea drept de veto), putea dizolva Parlamentul și era comandantul armatei.',
    },
    {
      type: 'text',
      title: 'Drepturi și libertăți cetățenești',
      text:
        'Constituția garanta egalitatea în fața legii, libertatea conștiinței, a presei, a întrunirilor și a ' +
        'asocierii, libertatea învățământului, inviolabilitatea domiciliului și a persoanei. Proprietatea era ' +
        'declarată „sacră și inviolabilă”. Datorită acestor prevederi, Constituția din 1866 era una dintre ' +
        'cele mai democratice din Europa vremii. Avea însă și limite: articolul 7 permitea naturalizarea ' +
        'doar străinilor de religie creștină.',
    },
    {
      type: 'text',
      title: 'Votul cenzitar',
      text:
        'Dreptul de vot depindea de avere și de venit (cens). Alegătorii erau împărțiți în colegii: patru ' +
        'pentru Adunarea Deputaților și două pentru Senat. Cei mai mulți țărani votau indirect, prin delegați, ' +
        'în colegiul al IV-lea. Astfel, un număr mic de alegători bogați alegea majoritatea parlamentarilor, ' +
        'iar marea majoritate a populației avea o influență redusă asupra vieții politice. Votul cenzitar ' +
        'este principala limită democratică a Constituției din 1866.',
    },
    {
      type: 'text',
      title: 'Modificări și înlocuirea Constituției',
      text:
        'Constituția a fost modificată de trei ori. În 1879, articolul 7 a fost revizuit, deoarece Congresul ' +
        'de la Berlin condiționase recunoașterea independenței de acordarea drepturilor civile și politice ' +
        'fără deosebire de religie. În 1884, colegiile electorale pentru Adunarea Deputaților au fost reduse ' +
        'de la patru la trei, iar titlul de rege a fost consacrat în Constituție. În 1917, la Iași, au fost ' +
        'introduse principiile votului universal și al exproprierii pentru reforma agrară. Constituția a rămas în vigoare ' +
        'până în 1923.',
    },
    ...(EXTRA_CARDS['constitutia-1866'] ?? []),
  ],
  questions: [
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'Ce constituție a servit drept model pentru Constituția României din 1866?',
      options: [
        { id: 'a', text: 'Constituția Franței din 1791', correct: false },
        { id: 'b', text: 'Constituția Belgiei din 1831', correct: true },
        { id: 'c', text: 'Constituția Prusiei din 1850', correct: false },
        { id: 'd', text: 'Constituția Statelor Unite din 1787', correct: false },
      ],
      explanation:
        'Constituția din 1866 a fost inspirată de Constituția Belgiei din 1831, considerată una dintre cele ' +
        'mai liberale din Europa acelei vremi.',
    },
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'Ce formă de guvernământ a consacrat Constituția din 1866?',
      options: [
        { id: 'a', text: 'Republica parlamentară', correct: false },
        { id: 'b', text: 'Monarhia absolută', correct: false },
        { id: 'c', text: 'Monarhia constituțională ereditară', correct: true },
        { id: 'd', text: 'Domnia electivă pe viață', correct: false },
      ],
      explanation:
        'Constituția a stabilit monarhia constituțională ereditară: tronul se moștenea în familia lui Carol, ' +
        'iar puterile domnului erau limitate de Constituție. Domnia electivă pe viață fusese prevăzută de ' +
        'Convenția de la Paris (1858).',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'Care dintre următoarele afirmații despre adoptarea Constituției din 1866 este corectă?',
      options: [
        {
          id: 'a',
          text: 'A fost elaborată și adoptată fără consultarea Imperiului Otoman și a puterilor garante.',
          correct: true,
        },
        { id: 'b', text: 'A fost impusă de marile puteri la Congresul de la Berlin.', correct: false },
        { id: 'c', text: 'A fost adoptată după proclamarea independenței României.', correct: false },
        { id: 'd', text: 'A fost elaborată de Alexandru Ioan Cuza înainte de abdicare.', correct: false },
      ],
      explanation:
        'Constituția a fost votată de Adunarea Constituantă și promulgată de Carol la 1 iulie 1866, fără ' +
        'acordul suzeranului sau al puterilor garante, ceea ce a fost un act de afirmare a autonomiei. ' +
        'Congresul de la Berlin a avut loc în 1878, iar independența a fost proclamată în 1877.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: 'Potrivit Constituției din 1866, cine exercita puterea legislativă?',
      options: [
        { id: 'a', text: 'Domnul', correct: true },
        { id: 'b', text: 'Adunarea Deputaților', correct: true },
        { id: 'c', text: 'Senatul', correct: true },
        { id: 'd', text: 'Înalta Curte de Casație', correct: false },
        { id: 'e', text: 'Comisia Centrală de la Focșani', correct: false },
      ],
      explanation:
        'Puterea legislativă era exercitată colectiv de domn și de Reprezentanța națională (Adunarea ' +
        'Deputaților și Senatul). Domnul participa prin inițiativa legislativă și prin sancționarea legilor. ' +
        'Curtea de Casație ținea de puterea judecătorească, iar Comisia Centrală de la Focșani fusese o ' +
        'instituție a Convenției de la Paris.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: 'Ce drepturi și libertăți erau garantate de Constituția din 1866?',
      options: [
        { id: 'a', text: 'Libertatea presei', correct: true },
        { id: 'b', text: 'Libertatea întrunirilor', correct: true },
        { id: 'c', text: 'Libertatea conștiinței', correct: true },
        { id: 'd', text: 'Votul universal', correct: false },
        { id: 'e', text: 'Dreptul de vot al femeilor', correct: false },
      ],
      explanation:
        'Constituția garanta libertățile presei, întrunirilor, asocierii și conștiinței. Votul era însă ' +
        'cenzitar (după avere), iar femeile nu aveau drept de vot. Votul universal masculin a fost introdus ' +
        'prin modificarea din 1917 și aplicat din 1918.',
    },
    {
      type: 'chronological_order',
      difficulty: 'medium',
      prompt: 'Ordonează cronologic următoarele evenimente legate de Constituția din 1866.',
      options: [
        { id: 'a', text: 'Revizuirea articolului 7 privind naturalizarea', label: '1879' },
        { id: 'b', text: 'Proclamarea Regatului României', label: '1881' },
        { id: 'c', text: 'Reducerea colegiilor electorale de la patru la trei', label: '1884' },
        { id: 'd', text: 'Introducerea votului universal și a exproprierii pentru reforma agrară', label: '1917' },
      ],
      explanation:
        'Revizuirea articolului 7 (1879) a fost cerută la Congresul de la Berlin; Regatul a fost proclamat ' +
        'în 1881, iar revizuirea din 1884 a consacrat titlul de rege și a redus colegiile; modificările din ' +
        '1917 au fost adoptate la Iași, în timpul Primului Război Mondial.',
    },
    {
      type: 'chronological_order',
      difficulty: 'hard',
      prompt: 'Ordonează cronologic următoarele acte cu caracter constituțional din istoria României.',
      options: [
        { id: 'a', text: 'Convenția de la Paris', label: '1858' },
        { id: 'b', text: 'Statutul Dezvoltător al Convenției de la Paris', label: '1864' },
        { id: 'c', text: 'Constituția adoptată după modelul belgian', label: '1866' },
        { id: 'd', text: 'Constituția care a consacrat statul național unitar după Marea Unire', label: '1923' },
      ],
      explanation:
        'Convenția de la Paris (1858) a funcționat ca o constituție, fiind completată de Statutul Dezvoltător ' +
        '(1864). Ambele au fost înlocuite de Constituția din 1866, care a rămas în vigoare până la adoptarea ' +
        'Constituției din 1923.',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'Care prevedere a Constituției din 1866 reprezenta o limită a caracterului ei democratic?',
      options: [
        { id: 'a', text: 'Separarea puterilor în stat', correct: false },
        { id: 'b', text: 'Responsabilitatea ministerială', correct: false },
        { id: 'c', text: 'Votul cenzitar, pe colegii stabilite după avere', correct: true },
        { id: 'd', text: 'Libertatea presei', correct: false },
      ],
      explanation:
        'Votul cenzitar făcea ca dreptul de vot să depindă de avere, astfel încât majoritatea populației ' +
        '(în special țăranii) avea o influență redusă. Celelalte variante sunt principii democratice ale ' +
        'Constituției.',
    },
    {
      type: 'single_choice',
      difficulty: 'hard',
      prompt: 'Ce modificare a Constituției din 1866 a fost determinată de hotărârile Congresului de la Berlin (1878)?',
      options: [
        { id: 'a', text: 'Introducerea votului universal', correct: false },
        { id: 'b', text: 'Revizuirea articolului 7, pentru a permite naturalizarea necreștinilor', correct: true },
        { id: 'c', text: 'Schimbarea numelui statului în România', correct: false },
        { id: 'd', text: 'Reducerea numărului colegiilor electorale', correct: false },
      ],
      explanation:
        'Congresul de la Berlin a condiționat recunoașterea independenței de eliminarea discriminării pe ' +
        'criterii religioase, de aceea articolul 7 a fost revizuit în 1879. Numele de România apărea deja în ' +
        'textul din 1866, colegiile au fost reduse în 1884, iar votul universal a fost introdus în 1917.',
    },
  ],
  sources,
  consolidation: exercises,
};
