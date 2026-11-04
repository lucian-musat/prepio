import { EXTRA_CARDS } from '../extraCards';
import type { SeedLesson } from '../types';

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
      type: 'timeline',
      title: 'Pașii Unirii (1857–1862)',
      points: [
        {
          id: 'point-0',
          date: 'octombrie 1857',
          title: 'Adunările ad-hoc cer unirea',
          details:
            'Rezoluțiile cer unirea Principatelor într-un stat cu numele România, condus de un prinț străin.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-1',
          date: 'august 1858',
          title: 'Convenția de la Paris',
          details:
            'Principatele Unite ale Moldovei și Valahiei: câte un domn, un guvern și o adunare în fiecare principat.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-2',
          date: '5 ianuarie 1859',
          title: 'Cuza, ales domn al Moldovei',
          details: 'Adunarea electivă de la Iași îl alege pe Alexandru Ioan Cuza.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-3',
          date: '24 ianuarie 1859',
          title: 'Cuza, ales domn al Țării Românești',
          details: 'Dubla alegere pune marile puteri în fața faptului împlinit.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-4',
          date: 'decembrie 1861',
          title: 'Imperiul Otoman acceptă unirea deplină',
          details: 'Recunoașterea este valabilă doar pe durata domniei lui Cuza.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-5',
          date: 'ianuarie 1862',
          title: 'Guvern unic și adunare unică',
          details: 'Capitala devine București; statul se numește Principatele Unite Române.',
          key: false,
          imagePath: null,
        },
      ],
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
  exercises: [
    {
      prompt:
        'Scrie introducerea unui eseu despre constituirea statului român modern în perioada 1857–1866.',
      criteria: [
        'Contextualizarea temei: precizarea, pe scurt, a contextului în care se constituie statul român modern (de exemplu: înfrângerea Rusiei în Războiul Crimeii, Congresul de la Paris din 1856, garanția colectivă a marilor puteri, dorința de unire a românilor).',
        'Enunțarea clară a temei eseului: constituirea statului român modern în perioada 1857–1866 (Unirea Principatelor și consolidarea statului prin reformele lui Alexandru Ioan Cuza).',
        'Anunțarea, la nivel general, a ideilor care vor fi dezvoltate în cuprins (de exemplu: acțiunile românilor din 1857–1859, unificarea instituțiilor, reformele), fără a le dezvolta.',
        'Introducerea are 3–6 propoziții și nu conține detalii specifice cuprinsului (enumerări de date, prevederi ale legilor etc.).',
        'Utilizarea limbajului istoric adecvat (de exemplu: unire, stat modern, autonomie, garanție colectivă, reforme).',
        'Ideile sunt înlănțuite logic, iar exprimarea este clară și corectă.',
      ].join('\n'),
    },
    {
      prompt:
        'Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta și utilizând relația cauză-efect.',
      criteria: [
        'Menționarea unei acțiuni desfășurate de români în perioada 1857–1859 (de exemplu: rezoluțiile Adunărilor ad-hoc din 1857, organizarea adunărilor elective, dubla alegere a lui Alexandru Ioan Cuza din 5 și 24 ianuarie 1859).',
        'Precizarea a două informații corecte referitoare la acțiunea menționată (de exemplu: data, locul, participanții, conținutul hotărârilor, urmările).',
        'Utilizarea explicită a relației cauză-efect (de exemplu: „Deoarece Convenția de la Paris nu interzicea alegerea aceleiași persoane în ambele Principate, unioniștii l-au ales pe Cuza domn și la București.”).',
        'Folosirea conectorilor care exprimă cauzalitatea (deoarece, pentru că) și concluzia (așadar, astfel).',
        'Acțiunea se încadrează corect în perioada 1857–1859 (reformele lui Cuza sau evenimentele de după 1859 nu se punctează).',
        'Utilizarea limbajului istoric adecvat și prezentarea ideilor în succesiune cronologică/logică.',
      ].join('\n'),
    },
  ],
};
