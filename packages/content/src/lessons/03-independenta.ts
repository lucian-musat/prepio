import { EXTRA_CARDS } from '../extraCards';
import type { SeedConsolidation, SeedLesson, SeedSource } from '../types';

const sources: SeedSource[] = [
  {
    key: 'a',
    title: 'Proclamarea independenței',
    author: 'Manual de istorie',
    work: 'clasa a XII-a',
    body:
      'Constituția otomană din decembrie 1876 considera România o „provincie privilegiată” a Imperiului, ceea ce ' +
      'încălca autonomia statului român. De aceea, guvernul condus de Ion C. Brătianu a hotărât că independența putea ' +
      'fi obținută doar pe calea armelor, în colaborare cu Rusia.\n\n' +
      'La 4 aprilie 1877, cele două state au semnat la București o convenție. Potrivit acesteia, trupele ruse puteau ' +
      'traversa teritoriul României spre Balcani, iar Rusia se obliga să respecte drepturile politice ale statului ' +
      'român și să-i apere integritatea teritorială. La 9 mai 1877, ministrul de externe Mihail Kogălniceanu a ' +
      'declarat în Adunarea Deputaților: „Suntem independenți; suntem națiune de sine stătătoare”. Tributul ' +
      'datorat Porții a fost redirecționat către armată.',
  },
  {
    key: 'b',
    title: 'Războiul de Independență și recunoașterea independenței',
    author: 'Sinteză de istorie a românilor',
    work: 'epoca modernă',
    body:
      'Înfrânți la Plevna în vara anului 1877, rușii au cerut ajutorul armatei române. Ca urmare, trupele române au ' +
      'trecut Dunărea, iar prințul Carol a primit comanda trupelor ruso-române de lângă Plevna. La 30 august 1877, ' +
      'românii au cucerit reduta Grivița 1, iar la 28 noiembrie 1877, după un lung asediu, Osman Pașa a capitulat la ' +
      'Plevna. Armata română a cucerit și Rahova, în noiembrie 1877, și Smârdanul, în ianuarie 1878.\n\n' +
      '[...] Congresul de la Berlin din 1878 a recunoscut independența României, dar a impus cedarea sudului ' +
      'Basarabiei către Rusia. În schimb, România a primit Dobrogea, Delta Dunării și Insula Șerpilor.',
  },
];

const exercises: SeedConsolidation[] = [
  {
    type: 'short_answer',
    prompt: 'Numiți ministrul de externe care a declarat independența României în Adunarea Deputaților, precizat în sursa A.',
    template: 'short_answer',
    sources: ['a', 'b'],
    accepted: ['Mihail Kogălniceanu', 'Kogălniceanu', 'M. Kogălniceanu'],
    mistakes: [
      { answer: 'Ion C. Brătianu', message: 'Ion C. Brătianu conducea guvernul. Caută în sursa A cine era ministru de externe.' },
      { answer: 'Carol', message: 'Prințul Carol a sancționat actul, dar declarația din Adunarea Deputaților a fost făcută de ministrul de externe.' },
    ],
    explanation: 'Numele ministrului apare în sursa A, în fraza despre 9 mai 1877.',
  },
  {
    type: 'multi_answer',
    prompt: 'Menționați două lupte la care a participat armata română, precizate în sursa B.',
    template: 'multi_answer',
    sources: ['a', 'b'],
    count: 2,
    groups: [['Plevna'], ['Grivița', 'Grivița 1', 'reduta Grivița', 'reduta Grivița 1'], ['Rahova'], ['Smârdan', 'Smârdanul']],
    explanation: 'Sursa B numește Plevna, reduta Grivița 1, Rahova și Smârdanul.',
  },
  {
    type: 'source_info',
    prompt: 'Precizați, din sursa dată, o informație referitoare la convenția încheiată de România cu Rusia.',
    template: 'source_info',
    sources: ['a'],
    count: 1,
    spans: [
      { source: 'a', quote: 'La 4 aprilie 1877, cele două state au semnat la București o convenție' },
      { source: 'a', quote: 'trupele ruse puteau traversa teritoriul României spre Balcani' },
      { source: 'a', quote: 'Rusia se obliga să respecte drepturile politice ale statului român' },
      { source: 'a', quote: 'să-i apere integritatea teritorială' },
    ],
    explanation: 'Informațiile despre convenția cu Rusia se află la începutul celui de-al doilea paragraf.',
  },
  {
    type: 'source_letter',
    prompt: 'Scrieți litera corespunzătoare sursei care susține că independența României a fost recunoscută pe plan internațional.',
    template: 'source_letter',
    sources: ['a', 'b'],
    correct: 'B',
    evidence: { source: 'b', quote: 'Congresul de la Berlin din 1878 a recunoscut independența României' },
    explanation: 'Sursa A vorbește despre proclamarea independenței; recunoașterea ei de către marile puteri, la Congresul de la Berlin, apare în sursa B.',
  },
  {
    type: 'cause_effect',
    prompt: 'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa dată, precizând rolul fiecăreia.',
    template: 'cause_effect',
    sources: ['b'],
    pairs: [
      {
        cause: { source: 'b', quote: 'rușii au cerut ajutorul armatei române' },
        effect: { source: 'b', quote: 'trupele române au trecut Dunărea' },
        explanation: 'Conectorul „Ca urmare” introduce efectul cererii de ajutor.',
      },
      {
        cause: { source: 'b', quote: 'Înfrânți la Plevna în vara anului 1877' },
        effect: { source: 'b', quote: 'rușii au cerut ajutorul armatei române' },
        explanation: 'Înfrângerile de la Plevna i-au determinat pe ruși să ceară ajutorul românilor.',
      },
    ],
  },
  {
    type: 'facts',
    prompt: 'Prezentați două fapte istorice desfășurate de România în perioada 1914–1918.',
    template: 'facts',
    sources: [],
    count: 2,
    modelAnswer:
      '1. În august 1916, România a semnat un tratat politic și o convenție militară cu Antanta, care îi recunoșteau ' +
      'drepturile asupra Transilvaniei, Banatului și Bucovinei; apoi a declarat război Austro-Ungariei, iar armata ' +
      'română a intrat în Transilvania.\n' +
      '2. În vara anului 1917, armata română reorganizată a obținut victoria de la Mărăști și a oprit ofensiva ' +
      'germano-austro-ungară la Mărășești și Oituz, astfel încât Moldova a rămas neocupată.',
    ai: {
      main: [
        'Perioada: 1914–1918 (Primul Război Mondial). Faptele privesc România.',
        'Fapte acceptate (exemple): Consiliul de Coroană de la Sinaia (3 august 1914) hotărăște neutralitatea, deși regele Carol I dorea intrarea în război alături de Puterile Centrale; tratatul politic și convenția militară cu Antanta (august 1916), care recunoșteau drepturile României asupra Transilvaniei, Banatului și Bucovinei; intrarea în război și ofensiva în Transilvania (1916); înfrângerea de la Turtucaia, ocuparea Bucureștiului (decembrie 1916) și mutarea autorităților la Iași; victoriile de la Mărăști, Mărășești și Oituz (vara lui 1917); armistițiul de la Focșani (decembrie 1917) și pacea de la Buftea-București (mai 1918), nepromulgată de regele Ferdinand; reintrarea în război (noiembrie 1918); unirea Basarabiei (27 martie 1918), a Bucovinei (28 noiembrie 1918) și a Transilvaniei, Banatului, Crișanei și Maramureșului (1 decembrie 1918, Alba Iulia).',
        'Greșeli frecvente: fapte din afara perioadei (Războiul de Independență, 1877–1878; aderarea la Tripla Alianță, 1883; Conferința de pace de la Paris, 1919–1920); date greșite (de exemplu, intrarea în război în 1914); confuzia dintre Antanta și Puterile Centrale.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'comparison',
    prompt:
      'Menționați o asemănare între Convenția româno-rusă din aprilie 1877 și tratatul încheiat de România cu Antanta ' +
      'în august 1916.',
    template: 'comparison',
    sources: [],
    variant: 'similarity',
    modelAnswer:
      'Atât Convenția româno-rusă din 1877, cât și tratatul cu Antanta din 1916 au fost încheiate de România cu mari ' +
      'puteri înaintea intrării ei în război, pentru a-și atinge obiectivele naționale.',
    ai: {
      main: [
        'Tema: două acorduri încheiate de România cu mari puteri înaintea intrării ei într-un război.',
        'Convenția româno-rusă (4 aprilie 1877, București): permitea trecerea trupelor ruse prin România spre Balcani; Rusia se obliga să respecte drepturile politice ale României și să-i apere integritatea teritorială; a precedat proclamarea independenței (9 mai 1877) și participarea României la război. Rusia a încălcat-o la Congresul de la Berlin (1878), când a obținut sudul Basarabiei.',
        'Tratatul politic și convenția militară cu Antanta (august 1916): încheiate cu Franța, Marea Britanie, Rusia și Italia; recunoșteau drepturile României asupra Transilvaniei, Banatului și Bucovinei; au precedat declarația de război adresată Austro-Ungariei și intrarea României în Primul Război Mondial.',
        'Asemănări acceptate (exemple): ambele au fost încheiate cu mari puteri (în ambele, Rusia a fost parte); ambele au precedat intrarea României într-un război; ambele urmăreau obiective naționale (independența, respectiv unitatea națională); ambele cuprindeau angajamente ale marilor puteri privind teritoriul României (integritatea teritorială, respectiv drepturile asupra unor provincii).',
        'Deosebiri (nu asemănări): în 1877 România a încheiat acordul doar cu Rusia, în 1916 cu patru mari puteri ale Antantei; în 1877 obiectivul era independența, în 1916 unitatea națională.',
        'Greșeli frecvente: confuzia tratatului din 1916 cu aderarea la Tripla Alianță (1883); afirmația că în 1916 România a intrat în război alături de Puterile Centrale; date greșite.',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'viewpoint',
    prompt:
      'Formulați, pe baza sursei date, un punct de vedere referitor la participarea armatei române la Războiul de ' +
      'Independență, susținându-l cu două informații selectate din sursă.',
    template: 'viewpoint',
    sources: ['b'],
    count: 2,
    spans: [
      { source: 'b', quote: 'rușii au cerut ajutorul armatei române' },
      { source: 'b', quote: 'prințul Carol a primit comanda trupelor ruso-române de lângă Plevna' },
      { source: 'b', quote: 'românii au cucerit reduta Grivița 1' },
      { source: 'b', quote: 'Osman Pașa a capitulat la Plevna' },
      { source: 'b', quote: 'Armata română a cucerit și Rahova, în noiembrie 1877, și Smârdanul, în ianuarie 1878' },
      { source: 'b', quote: 'Congresul de la Berlin din 1878 a recunoscut independența României' },
    ],
    modelAnswer:
      'Consider că armata română a avut un rol important în Războiul de Independență. Informații-suport: ' +
      '„rușii au cerut ajutorul armatei române”; „românii au cucerit reduta Grivița 1”.',
    ai: {
      main: [
        'Tema: participarea armatei române la Războiul de Independență (1877–1878), pe baza sursei date.',
        'Puncte de vedere acceptate (exemple): armata română a avut un rol important / decisiv în luptele de la Plevna; România și-a câștigat independența prin efort militar propriu; participarea armatei române a contribuit la recunoașterea independenței.',
        'Informații-suport potrivite din sursă: rușii au cerut ajutorul armatei române; prințul Carol a primit comanda trupelor ruso-române de lângă Plevna; cucerirea redutei Grivița 1 (30 august 1877); capitularea lui Osman Pașa la Plevna (28 noiembrie 1877); cucerirea Rahovei și a Smârdanului; recunoașterea independenței la Congresul de la Berlin (doar pentru un punct de vedere despre urmările participării la război).',
        'Greșeli frecvente: afirmația că armata română a luptat împotriva Rusiei; confuzia luptelor din 1877–1878 cu cele din Primul Război Mondial (Mărăști, Mărășești, Oituz); aprecieri despre altă temă (de exemplu, despre aderarea la Tripla Alianță).',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'argument',
    prompt:
      'Argumentați, printr-un fapt istoric relevant, afirmația conform căreia independența României a fost obținută ' +
      'pe calea armelor.',
    template: 'argument',
    sources: [],
    modelAnswer:
      'Independența României a fost obținută pe calea armelor, deoarece, după proclamarea ei la 9 mai 1877, armata ' +
      'română a trecut Dunărea și a luptat alături de cea rusă: la 30 august 1877 a cucerit reduta Grivița 1, iar la ' +
      '28 noiembrie 1877 Osman Pașa a capitulat la Plevna. Prin urmare, afirmația este adevărată.',
    ai: {
      main: [
        'Perioada și tema: Războiul de Independență (1877–1878) și obținerea independenței României.',
        'Fapte relevante acceptate: hotărârea guvernului Ion C. Brătianu de a obține independența pe calea armelor, în colaborare cu Rusia (Convenția din 4 aprilie 1877); bombardarea orașelor românești de la Dunăre de către artileria otomană (aprilie 1877); trecerea Dunării de către armata română, la cererea rușilor înfrânți la Plevna; comanda trupelor ruso-române de lângă Plevna, încredințată prințului Carol; cucerirea redutei Grivița 1 (30 august 1877); capitularea lui Osman Pașa la Plevna (28 noiembrie 1877); cucerirea Rahovei (noiembrie 1877) și a Smârdanului (ianuarie 1878); recunoașterea independenței la Congresul de la Berlin (1878), după participarea României la război.',
        'Proclamarea independenței (9 mai 1877), singură, nu susține afirmația: arată doar declararea ei, nu obținerea pe câmpul de luptă; contează ce rol a avut armata română.',
        'Greșeli frecvente: luptele din Primul Război Mondial (Mărăști, Mărășești, Oituz, 1917); afirmația că România a luptat împotriva Rusiei; afirmația că independența a fost recunoscută la San Stefano fără condiții sau că România a participat la tratatul de la San Stefano; date greșite (1866, 1881).',
      ].join('\n'),
      requirements: {},
    },
  },
  {
    type: 'essay',
    prompt:
      'Elaborați un eseu despre România în relațiile internaționale în perioada 1877–1918, respectând următoarele cerințe:',
    template: 'essay',
    sources: [],
    requirements: [
      {
        id: 'r1',
        text: 'Menționați două fapte istorice la care participă România în perioada 1877–1878.',
        modelAnswer: 'Convenția româno-rusă (4 aprilie 1877); cucerirea redutei Grivița 1 (30 august 1877).',
        template: 'facts',
        argument: false,
      },
      {
        id: 'r2',
        text: 'Prezentați o acțiune diplomatică desfășurată de România în perioada 1878–1914.',
        modelAnswer:
          'În octombrie 1883, guvernul condus de Ion C. Brătianu a încheiat un tratat secret cu Austro-Ungaria, la care ' +
          'a aderat și Germania. Astfel, România s-a apropiat de Tripla Alianță, deoarece se temea de Rusia, care îi ' +
          'luase sudul Basarabiei în 1878, și dorea să iasă din izolare.',
        template: 'facts',
        argument: false,
      },
      {
        id: 'r3',
        text: 'Precizați o cauză a intrării României în Primul Război Mondial, în anul 1916.',
        modelAnswer:
          'România urmărea realizarea unității naționale, iar tratatul cu Antanta din august 1916 îi recunoștea drepturile ' +
          'asupra Transilvaniei, Banatului și Bucovinei.',
        template: 'cause_effect',
        argument: false,
      },
      {
        id: 'r4',
        text:
          'Formulați un punct de vedere referitor la politica externă a României în perioada 1916–1918 și susțineți-l ' +
          'printr-un argument istoric.',
        modelAnswer:
          'Consider că politica externă a României din perioada 1916–1918 a urmărit realizarea unității naționale, ' +
          'deoarece în august 1916 România a încheiat cu Antanta un tratat care îi recunoștea drepturile asupra ' +
          'Transilvaniei, Banatului și Bucovinei, apoi a declarat război Austro-Ungariei. Așadar, intrarea în război ' +
          'a avut ca scop eliberarea românilor din Austro-Ungaria.',
        template: 'argument',
        argument: true,
      },
    ],
    ai: {
      main: '',
      requirements: {
        r1: [
          'Perioada: 1877–1878 (Războiul de Independență). Se cer fapte la care participă România.',
          'Fapte acceptate: Convenția româno-rusă (4 aprilie 1877); proclamarea independenței (9 mai 1877); trecerea Dunării de către armata română (1877); cucerirea redutei Grivița 1 (30 august 1877); asediul și capitularea Plevnei (28 noiembrie 1877); cucerirea Rahovei (noiembrie 1877); cucerirea Smârdanului (ianuarie 1878); Congresul de la Berlin (1878), care a recunoscut independența României.',
          'Greșeli frecvente: fapte din afara perioadei (aderarea la Tripla Alianță, 1883; Războaiele Balcanice, 1912–1913; Primul Război Mondial); afirmația că România a participat la încheierea tratatului de la San Stefano (a fost încheiat fără ea).',
        ].join('\n'),
        r2: [
          'Perioada: 1878–1914 (acțiuni diplomatice ale României).',
          'Acțiuni acceptate: participarea României la Congresul de la Berlin (1878; delegația română, Ion C. Brătianu și Mihail Kogălniceanu, a fost ascultată, dar nu a luat parte la decizii; independența recunoscută cu condiții, sudul Basarabiei cedat Rusiei, Dobrogea primită); aderarea la Tripla Alianță (octombrie 1883, tratat secret cu Austro-Ungaria, la care a aderat Germania; cauze: temerea față de Rusia și izolarea diplomatică); participarea la al Doilea Război Balcanic și Pacea de la București (august 1913), prin care România a obținut Cadrilaterul (sudul Dobrogei); Consiliul de Coroană de la Sinaia (3 august 1914), care a hotărât neutralitatea.',
          'Greșeli frecvente: confuzia Triplei Alianțe cu Antanta; afirmația că, în 1883, România a intrat într-un război; date greșite; fapte din afara perioadei (Războiul de Independență, 1877; tratatul cu Antanta, 1916).',
        ].join('\n'),
        r3: [
          'Tema: cauzele intrării României în Primul Război Mondial (august 1916).',
          'Cauze acceptate: dorința de a realiza unitatea națională (eliberarea românilor din Transilvania, Banat și Bucovina, aflate în Austro-Ungaria); tratatul politic și convenția militară cu Antanta (august 1916), care recunoșteau drepturile României asupra acestor provincii; situația favorabilă de pe front din vara lui 1916 (ofensiva rusă condusă de generalul Brusilov).',
          'Greșeli frecvente: afirmația că România a intrat în război alături de Puterile Centrale; obiective privind Basarabia în 1916 (Basarabia se afla în Rusia, aliată în Antanta); confuzia cu intrarea în Războiul de Independență (1877); data greșită (1914).',
        ].join('\n'),
        r4: [
          'Tema punctului de vedere: politica externă a României în perioada 1916–1918. Puncte de vedere acceptate (exemple): a urmărit realizarea unității naționale; alianța cu Antanta a fost o alegere potrivită; România a dus o politică externă dificilă, în condiții de izolare, după ieșirea Rusiei din război.',
          'Fapte potrivite pentru argument, din perioada 1916–1918: tratatul cu Antanta (august 1916); intrarea în război și ofensiva în Transilvania (1916); victoriile de la Mărăști, Mărășești și Oituz (1917); armistițiul de la Focșani (decembrie 1917) și pacea de la Buftea-București (mai 1918), nepromulgată de regele Ferdinand; reintrarea în război (noiembrie 1918); unirea Basarabiei (27 martie 1918), a Bucovinei (28 noiembrie 1918) și a Transilvaniei (1 decembrie 1918).',
          'Greșeli frecvente: fapte din afara perioadei (neutralitatea din 1914, Conferința de pace de la Paris, 1919–1920); confuzia dintre Antanta și Puterile Centrale.',
        ].join('\n'),
      },
    },
  },
];

export const independenta: SeedLesson = {
  key: 'independenta-relatii-internationale',
  nodeKey: 'romania-marile-aliante',
  title: 'Războiul de Independență și România în relațiile internaționale (1875–1918)',
  status: 'published',
  cards: [
    {
      type: 'text',
      title: 'Criza orientală și Convenția româno-rusă (1875–1877)',
      text:
        '### Criza orientală (1875–1877)\n' +
        'În 1875, răscoalele antiotomane din Bosnia și Herțegovina au redeschis „criza orientală”. În 1876, ' +
        'Serbia și Muntenegru au intrat în război cu Imperiul Otoman, iar bulgarii s-au răsculat. Constituția ' +
        'otomană din decembrie 1876 considera România o „provincie privilegiată” a Imperiului, ceea ce încălca ' +
        'autonomia ei. De aceea, guvernul condus de Ion C. Brătianu a decis că independența putea fi obținută ' +
        'doar pe calea armelor, în colaborare cu Rusia.\n\n' +
        '### Convenția româno-rusă (aprilie 1877)\n' +
        'La 4 aprilie 1877, România și Rusia au semnat la București o convenție: trupele ruse puteau traversa ' +
        'teritoriul României spre Balcani, iar Rusia se obliga să respecte drepturile politice ale statului ' +
        'român și să mențină și să apere integritatea lui teritorială. La 12 aprilie 1877, Rusia a declarat ' +
        'război Imperiului Otoman, iar artileria otomană a bombardat orașele românești de la Dunăre. Astfel, ' +
        'România a intrat de fapt în război.',
    },
    {
      type: 'text',
      title: 'Proclamarea independenței (9 mai 1877)',
      text:
        'La 9 mai 1877, în Adunarea Deputaților, ministrul de externe Mihail Kogălniceanu a declarat: ' +
        '„Suntem independenți; suntem națiune de sine stătătoare”. În aceeași zi, Senatul a adoptat o ' +
        'moțiune asemănătoare, iar la 10 mai 1877 actul a fost sancționat de domnitorul Carol. Tributul datorat Porții a fost redirecționat ' +
        'către armată. Independența proclamată trebuia însă apărată pe câmpul de luptă și recunoscută de ' +
        'marile puteri.',
    },
    {
      type: 'images',
      title: 'Războiul: Plevna, Grivița, Rahova, Smârdan',
      display: 'single',
      images: [
        {
          path: 'grivita-1877.jpg',
          alt: 'Trupele române atacând reduta Grivița (1877)',
          credit:
            'Atacul trupelor române asupra redutei Grivița (1877), ilustrație de Henryk Dembitzky (1881). Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Înfrânți la Plevna în vara lui 1877, rușii au cerut ajutorul armatei române. Aceasta a trecut ' +
        'Dunărea, iar prințul Carol a primit comanda trupelor ruso-române de lângă Plevna. La 30 august 1877, ' +
        'românii au cucerit reduta Grivița 1. După un lung asediu, Osman Pașa a capitulat la Plevna, la ' +
        '28 noiembrie 1877. Armata română a cucerit și Rahova (noiembrie 1877) și Smârdanul (ianuarie 1878), ' +
        'în apropiere de Vidin. Așadar, România și-a câștigat independența prin efort militar propriu.',
    },
    {
      type: 'text',
      title: 'San Stefano și Congresul de la Berlin (1878)',
      text:
        'Tratatul de pace de la San Stefano (martie 1878), încheiat fără participarea României, recunoștea ' +
        'independența, dar Rusia urma să anexeze sudul Basarabiei. Congresul de la Berlin (iunie–iulie 1878) ' +
        'a recunoscut independența României cu două condiții: modificarea articolului 7 din Constituție ' +
        '(naturalizarea necreștinilor) și cedarea sudului Basarabiei (Cahul, Bolgrad, Ismail) către Rusia. ' +
        'În schimb, România a primit Dobrogea, Delta Dunării și Insula Șerpilor. Rusia încălca astfel ' +
        'Convenția din 1877.',
    },
    {
      type: 'text',
      title: 'Regatul României și Tripla Alianță (1881–1883)',
      text:
        'La 14 martie 1881, România a fost proclamată regat, iar Carol I a fost încoronat la 10 mai 1881 cu ' +
        'o coroană făurită din oțelul unui tun capturat la Plevna. Pierderea sudului Basarabiei a arătat ' +
        'pericolul rusesc și izolarea României. De aceea, în octombrie 1883, România a aderat la Tripla ' +
        'Alianță (Germania, Austro-Ungaria, Italia), printr-un tratat secret, cu caracter defensiv, încheiat ' +
        'cu Austro-Ungaria, la care a aderat și Germania. Tratatul era cunoscut doar de rege și de câțiva ' +
        'oameni politici.',
    },
    {
      type: 'text',
      title: 'România în Primul Război Mondial (1914–1916)',
      text:
        '### Neutralitatea (1914–1916)\n' +
        'La izbucnirea Primului Război Mondial, Consiliul de Coroană de la Sinaia (3 august 1914) a hotărât ' +
        'neutralitatea, deși regele Carol I dorea intrarea în război alături de Puterile Centrale. Argumentele ' +
        'au fost: tratatul cu Tripla Alianță era defensiv, iar Austro-Ungaria atacase Serbia fără să consulte ' +
        'România; în plus, opinia publică dorea eliberarea românilor din Transilvania și Bucovina, aflați sub ' +
        'stăpânire austro-ungară. După moartea lui Carol I (1914), a urmat la tron Ferdinand I.\n\n' +
        '### Intrarea în război alături de Antanta (1916)\n' +
        'În august 1916, România a semnat un tratat politic și o convenție militară cu Antanta (Franța, Marea ' +
        'Britanie, Rusia, Italia), care îi recunoșteau drepturile asupra Transilvaniei, Banatului și ' +
        'Bucovinei. Apoi, România a declarat război Austro-Ungariei, iar armata română a intrat în ' +
        'Transilvania. Atacată și din sud de trupele germane și bulgare (înfrângerea de la Turtucaia), armata ' +
        's-a retras. În decembrie 1916 Bucureștiul a fost ocupat, iar autoritățile s-au mutat la Iași.',
    },
    {
      type: 'images',
      title: 'Mărăști, Mărășești, Oituz (1917) și pacea din 1918',
      display: 'single',
      images: [
        {
          path: 'marasesti-1917.jpg',
          alt: 'Trupe române la Mărășești (1917)',
          credit:
            'Trupe române la Mărășești (1917), fotografie de epocă. Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'În vara lui 1917, armata română reorganizată a obținut victoria de la Mărăști și a oprit ofensiva ' +
        'germano-austro-ungară la Mărășești și Oituz. După revoluția bolșevică, Rusia a ieșit din război, iar ' +
        'România, rămasă izolată, a semnat armistițiul de la Focșani (decembrie 1917) și pacea de la ' +
        'Buftea-București (mai 1918): pierdea Dobrogea, ceda crestele Carpaților Austro-Ungariei și acorda ' +
        'Germaniei controlul petrolului. Regele Ferdinand nu a promulgat pacea, iar România a reintrat în ' +
        'război în noiembrie 1918.',
    },
    {
      type: 'images',
      title: 'Unirea din 1918',
      display: 'single',
      images: [
        {
          path: 'harta-romania-1918.jpg',
          alt: 'Harta României după unirile din 1918',
          credit:
            'România după unirile din 1918, hartă de Spiridon Ion Cepleanu. Sursa: Wikimedia Commons, licență CC BY-SA 3.0',
        },
      ],
      text:
        'Destrămarea Imperiului Rus și a Austro-Ungariei a permis realizarea unității naționale. Sfatul Țării ' +
        'a votat unirea Basarabiei cu România la 27 martie 1918. Congresul General al Bucovinei a hotărât ' +
        'unirea la 28 noiembrie 1918. Adunarea Națională de la Alba Iulia a votat, la 1 decembrie 1918, unirea ' +
        'Transilvaniei, Banatului, Crișanei și Maramureșului cu România. Unirile au fost recunoscute prin ' +
        'tratatele Conferinței de pace de la Paris (1919–1920). Așadar, s-a format România Mare.',
    },
    ...(EXTRA_CARDS['independenta-relatii-internationale'] ?? []),
  ],
  questions: [
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'La ce dată a fost proclamată independența României?',
      options: [
        { id: 'a', text: '24 ianuarie 1859', correct: false },
        { id: 'b', text: '1 iulie 1866', correct: false },
        { id: 'c', text: '9 mai 1877', correct: true },
        { id: 'd', text: '14 martie 1881', correct: false },
      ],
      explanation:
        'Independența a fost proclamată la 9 mai 1877 în Adunarea Deputaților. Celelalte date: dubla alegere ' +
        'a lui Cuza la București (1859), promulgarea Constituției (1866) și proclamarea Regatului (1881).',
    },
    {
      type: 'single_choice',
      difficulty: 'easy',
      prompt: 'Cine a declarat independența României în Adunarea Deputaților, la 9 mai 1877?',
      options: [
        { id: 'a', text: 'Ion C. Brătianu', correct: false },
        { id: 'b', text: 'Mihail Kogălniceanu', correct: true },
        { id: 'c', text: 'Carol I', correct: false },
        { id: 'd', text: 'Lascăr Catargiu', correct: false },
      ],
      explanation:
        'Mihail Kogălniceanu, ministru de externe, a declarat: „Suntem independenți; suntem națiune de sine ' +
        'stătătoare”. Ion C. Brătianu era prim-ministru, iar Carol a sancționat actul votat de Parlament.',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'Ce prevedea Convenția româno-rusă din 4 aprilie 1877?',
      options: [
        {
          id: 'a',
          text: 'Trecerea trupelor ruse prin România, cu respectarea integrității teritoriale a statului român',
          correct: true,
        },
        { id: 'b', text: 'Recunoașterea independenței României de către Rusia', correct: false },
        { id: 'c', text: 'Cedarea sudului Basarabiei către Rusia', correct: false },
        { id: 'd', text: 'Aderarea României la Tripla Alianță', correct: false },
      ],
      explanation:
        'Convenția permitea trecerea armatei ruse spre Balcani, iar Rusia garanta integritatea teritorială ' +
        'a României. Cedarea sudului Basarabiei a fost impusă abia la Congresul de la Berlin (1878), ' +
        'încălcând această convenție.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: 'Care dintre următoarele lupte au fost purtate de armata română în Războiul de Independență (1877–1878)?',
      options: [
        { id: 'a', text: 'Grivița', correct: true },
        { id: 'b', text: 'Rahova', correct: true },
        { id: 'c', text: 'Smârdan', correct: true },
        { id: 'd', text: 'Mărășești', correct: false },
        { id: 'e', text: 'Turtucaia', correct: false },
      ],
      explanation:
        'Grivița (august 1877), Rahova (noiembrie 1877) și Smârdan (ianuarie 1878) sunt lupte din Războiul de ' +
        'Independență. Mărășești (1917) și Turtucaia (1916) aparțin Primului Război Mondial.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: 'Ce condiții a impus Congresul de la Berlin (1878) pentru recunoașterea independenței României?',
      options: [
        { id: 'a', text: 'Modificarea articolului 7 din Constituție', correct: true },
        { id: 'b', text: 'Cedarea sudului Basarabiei către Rusia', correct: true },
        { id: 'c', text: 'Aderarea României la Tripla Alianță', correct: false },
        { id: 'd', text: 'Plata unui tribut anual către Imperiul Otoman', correct: false },
        { id: 'e', text: 'Renunțarea la Dobrogea', correct: false },
      ],
      explanation:
        'România trebuia să permită naturalizarea necreștinilor (articolul 7) și să cedeze Rusiei sudul ' +
        'Basarabiei. Dobrogea nu a fost pierdută, ci primită de România, iar tributul a încetat odată cu ' +
        'independența. Aderarea la Tripla Alianță (1883) a fost o decizie ulterioară a României.',
    },
    {
      type: 'chronological_order',
      difficulty: 'medium',
      prompt: 'Ordonează cronologic următoarele evenimente din relațiile internaționale ale României.',
      options: [
        { id: 'a', text: 'Izbucnirea crizei orientale', label: '1875' },
        { id: 'b', text: 'Proclamarea independenței', label: '1877' },
        { id: 'c', text: 'Congresul de la Berlin', label: '1878' },
        { id: 'd', text: 'Proclamarea Regatului României', label: '1881' },
        { id: 'e', text: 'Aderarea la Tripla Alianță', label: '1883' },
      ],
      explanation:
        'Criza orientală (1875) a creat contextul războiului; independența proclamată în 1877 a fost ' +
        'recunoscută la Berlin (1878); consolidarea statului a dus la proclamarea Regatului (1881), iar ' +
        'temerea față de Rusia la aderarea la Tripla Alianță (1883).',
    },
    {
      type: 'chronological_order',
      difficulty: 'hard',
      prompt: 'Ordonează cronologic următoarele evenimente legate de alianțele și războaiele României.',
      options: [
        { id: 'a', text: 'Aderarea la Tripla Alianță', label: '1883' },
        { id: 'b', text: 'Hotărârea neutralității la Consiliul de Coroană de la Sinaia', label: '1914' },
        { id: 'c', text: 'Semnarea tratatului cu Antanta și intrarea în război', label: '1916' },
        { id: 'd', text: 'Bătălia de la Mărășești', label: '1917' },
        { id: 'e', text: 'Adunarea Națională de la Alba Iulia', label: '1918' },
      ],
      explanation:
        'România a fost legată de Tripla Alianță din 1883, dar în 1914 a ales neutralitatea; în 1916 a intrat ' +
        'în război alături de Antanta, în 1917 a rezistat la Mărășești, iar la 1 decembrie 1918 s-a hotărât ' +
        'unirea Transilvaniei cu România.',
    },
    {
      type: 'single_choice',
      difficulty: 'medium',
      prompt: 'De ce a hotărât Consiliul de Coroană de la Sinaia (august 1914) neutralitatea României?',
      options: [
        {
          id: 'a',
          text:
            'Tratatul cu Tripla Alianță era defensiv, iar Austro-Ungaria declanșase războiul fără să consulte România.',
          correct: true,
        },
        { id: 'b', text: 'România semnase deja un tratat de alianță cu Antanta.', correct: false },
        { id: 'c', text: 'Regele Carol I a cerut neutralitatea.', correct: false },
        { id: 'd', text: 'Armata română era angajată în Războaiele Balcanice.', correct: false },
      ],
      explanation:
        'Deoarece Austro-Ungaria nu fusese atacată, ci declanșase ea războiul, fără să consulte România, ' +
        'tratatul defensiv nu obliga România să intre în război. ' +
        'Carol I dorea, de fapt, intrarea alături de Puterile Centrale, tratatul cu Antanta a fost semnat ' +
        'abia în 1916, iar Războaiele Balcanice se încheiaseră în 1913.',
    },
    {
      type: 'single_choice',
      difficulty: 'hard',
      prompt: 'Care dintre următoarele a fost o prevedere a păcii de la Buftea-București (1918)?',
      options: [
        { id: 'a', text: 'Cedarea crestelor Carpaților către Austro-Ungaria', correct: true },
        { id: 'b', text: 'Recunoașterea unirii Transilvaniei cu România', correct: false },
        { id: 'c', text: 'Recunoașterea independenței României', correct: false },
        { id: 'd', text: 'Primirea Dobrogei de către România', correct: false },
      ],
      explanation:
        'Pacea impusă de Puterile Centrale era foarte grea: România pierdea Dobrogea, ceda crestele ' +
        'Carpaților Austro-Ungariei și acorda Germaniei controlul asupra petrolului. Independența fusese ' +
        'recunoscută în 1878, iar unirea Transilvaniei a avut loc abia la 1 decembrie 1918.',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: 'Ce provincii s-au unit cu România în anul 1918?',
      options: [
        { id: 'a', text: 'Basarabia', correct: true },
        { id: 'b', text: 'Bucovina', correct: true },
        { id: 'c', text: 'Transilvania', correct: true },
        { id: 'd', text: 'Cadrilaterul', correct: false },
        { id: 'e', text: 'Dobrogea', correct: false },
      ],
      explanation:
        'În 1918 s-au unit cu România Basarabia (27 martie), Bucovina (28 noiembrie) și Transilvania, ' +
        'împreună cu Banatul, Crișana și Maramureșul (1 decembrie). Dobrogea a intrat în componența ' +
        'României în 1878, iar Cadrilaterul în 1913, după al Doilea Război Balcanic.',
    },
  ],
  sources,
  consolidation: exercises,
};
